using System.Data;
using System.Text.Json;
using Npgsql;

namespace RentalPlatform.InvoiceAggregateAudit;

public static class Program
{
    public const string ConnectionStringEnvironmentVariable = "KAZA_INVOICE_AUDIT_DB";

    public static async Task<int> Main()
    {
        var connectionString = Environment.GetEnvironmentVariable(
            ConnectionStringEnvironmentVariable);
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            Console.Error.WriteLine(
                $"INV-AUDIT-01 configuration error: {ConnectionStringEnvironmentVariable} is required.");
            return InvoiceAggregateConsistencyGate.ConfigurationErrorExitCode;
        }

        return await InvoiceAggregateConsistencyGate.RunAsync(
            connectionString,
            Console.Out,
            Console.Error);
    }
}

public static class InvoiceAggregateConsistencyGate
{
    public const int PassExitCode = 0;
    public const int InconsistencyExitCode = 2;
    public const int VerificationErrorExitCode = 3;
    public const int ConfigurationErrorExitCode = 64;

    public const string AuditSql =
        """
        WITH invoice_truth AS (
            SELECT
                invoice.id AS invoice_id,
                invoice.booking_id,
                invoice.invoice_status,
                invoice.invoice_number,
                COUNT(item.id)::BIGINT AS item_count,
                COALESCE(SUM(item.line_total), 0::NUMERIC)::NUMERIC AS item_sum,
                invoice.subtotal_amount,
                invoice.total_amount,
                (invoice.subtotal_amount - COALESCE(SUM(item.line_total), 0::NUMERIC))::NUMERIC
                    AS subtotal_delta,
                (invoice.total_amount - invoice.subtotal_amount)::NUMERIC AS total_delta,
                invoice.subtotal_amount <> COALESCE(SUM(item.line_total), 0::NUMERIC)
                    AS subtotal_mismatch,
                invoice.total_amount <> invoice.subtotal_amount AS total_mismatch,
                COUNT(item.id) = 0 AS itemless_invalid,
                invoice.created_at,
                invoice.updated_at
            FROM invoices AS invoice
            LEFT JOIN invoice_items AS item ON item.invoice_id = invoice.id
            GROUP BY
                invoice.id,
                invoice.booking_id,
                invoice.invoice_status,
                invoice.invoice_number,
                invoice.subtotal_amount,
                invoice.total_amount,
                invoice.created_at,
                invoice.updated_at
        ),
        summary AS (
            SELECT
                COUNT(*)::BIGINT AS invoices_scanned,
                COUNT(*) FILTER (
                    WHERE NOT subtotal_mismatch
                      AND NOT total_mismatch
                      AND NOT itemless_invalid)::BIGINT AS consistent_invoices,
                COUNT(*) FILTER (
                    WHERE subtotal_mismatch
                       OR total_mismatch
                       OR itemless_invalid)::BIGINT AS inconsistent_invoices,
                COUNT(*) FILTER (WHERE subtotal_mismatch)::BIGINT AS subtotal_mismatches,
                COUNT(*) FILTER (WHERE total_mismatch)::BIGINT AS total_subtotal_mismatches,
                COUNT(*) FILTER (WHERE itemless_invalid)::BIGINT AS itemless_invalid_invoices,
                current_setting('transaction_read_only') = 'on' AS read_only_transaction
            FROM invoice_truth
        )
        SELECT
            'detail'::TEXT AS record_kind,
            truth.invoice_id,
            truth.booking_id,
            truth.invoice_status,
            truth.invoice_number,
            truth.item_count,
            truth.item_sum,
            truth.subtotal_amount,
            truth.total_amount,
            truth.subtotal_delta,
            truth.total_delta,
            truth.subtotal_mismatch,
            truth.total_mismatch,
            truth.itemless_invalid,
            truth.created_at,
            truth.updated_at,
            NULL::BIGINT AS invoices_scanned,
            NULL::BIGINT AS consistent_invoices,
            NULL::BIGINT AS inconsistent_invoices,
            NULL::BIGINT AS subtotal_mismatches,
            NULL::BIGINT AS total_subtotal_mismatches,
            NULL::BIGINT AS itemless_invalid_invoices,
            NULL::BOOLEAN AS read_only_transaction
        FROM invoice_truth AS truth
        WHERE truth.subtotal_mismatch
           OR truth.total_mismatch
           OR truth.itemless_invalid

        UNION ALL

        SELECT
            'summary'::TEXT,
            NULL::UUID,
            NULL::UUID,
            NULL::VARCHAR,
            NULL::VARCHAR,
            NULL::BIGINT,
            NULL::NUMERIC,
            NULL::NUMERIC,
            NULL::NUMERIC,
            NULL::NUMERIC,
            NULL::NUMERIC,
            NULL::BOOLEAN,
            NULL::BOOLEAN,
            NULL::BOOLEAN,
            NULL::TIMESTAMP,
            NULL::TIMESTAMP,
            summary.invoices_scanned,
            summary.consistent_invoices,
            summary.inconsistent_invoices,
            summary.subtotal_mismatches,
            summary.total_subtotal_mismatches,
            summary.itemless_invalid_invoices,
            summary.read_only_transaction
        FROM summary
        ORDER BY record_kind, invoice_id NULLS LAST
        """;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower
    };

    public static async Task<int> RunAsync(
        string connectionString,
        TextWriter output,
        TextWriter error,
        CancellationToken cancellationToken = default)
    {
        try
        {
            await using var connection = new NpgsqlConnection(connectionString);
            await connection.OpenAsync(cancellationToken);
            await using var transaction = await connection.BeginTransactionAsync(
                IsolationLevel.RepeatableRead,
                cancellationToken);

            await using (var readOnlyCommand = new NpgsqlCommand(
                "SET TRANSACTION READ ONLY",
                connection,
                transaction))
            {
                await readOnlyCommand.ExecuteNonQueryAsync(cancellationToken);
            }

            AuditSummary? summary = null;
            await using (var command = new NpgsqlCommand(AuditSql, connection, transaction)
            {
                CommandTimeout = 120
            })
            await using (var reader = await command.ExecuteReaderAsync(cancellationToken))
            {
                while (await reader.ReadAsync(cancellationToken))
                {
                    if (reader.GetString(0) == "detail")
                    {
                        var detail = ReadDetail(reader);
                        await output.WriteLineAsync(
                            $"INCONSISTENT {JsonSerializer.Serialize(detail, JsonOptions)}");
                        continue;
                    }

                    summary = ReadSummary(reader);
                }
            }

            await transaction.RollbackAsync(cancellationToken);

            if (summary is null || !summary.ReadOnlyTransaction)
            {
                await error.WriteLineAsync(
                    "INV-AUDIT-01 verification error: read-only execution was not proven.");
                return VerificationErrorExitCode;
            }

            await output.WriteLineAsync(
                $"SUMMARY {JsonSerializer.Serialize(summary, JsonOptions)}");
            if (summary.InconsistentInvoices > 0)
            {
                await output.WriteLineAsync("FAIL INV-AUDIT-01 detected inconsistent invoices.");
                return InconsistencyExitCode;
            }

            await output.WriteLineAsync("PASS INV-AUDIT-01 found no invoice aggregate inconsistencies.");
            return PassExitCode;
        }
        catch (Exception exception)
        {
            var code = exception is PostgresException postgresException
                ? postgresException.SqlState
                : "verification_failure";
            await error.WriteLineAsync(
                $"INV-AUDIT-01 verification error: database verification failed ({code}).");
            return VerificationErrorExitCode;
        }
    }

    private static AuditDetail ReadDetail(NpgsqlDataReader reader) => new(
        reader.GetGuid(1),
        reader.GetGuid(2),
        reader.GetString(3),
        reader.GetString(4),
        reader.GetInt64(5),
        reader.GetDecimal(6),
        reader.GetDecimal(7),
        reader.GetDecimal(8),
        reader.GetDecimal(9),
        reader.GetDecimal(10),
        reader.GetBoolean(11),
        reader.GetBoolean(12),
        reader.GetBoolean(13),
        reader.GetDateTime(14),
        reader.GetDateTime(15));

    private static AuditSummary ReadSummary(NpgsqlDataReader reader) => new(
        reader.GetInt64(16),
        reader.GetInt64(17),
        reader.GetInt64(18),
        reader.GetInt64(19),
        reader.GetInt64(20),
        reader.GetInt64(21),
        reader.GetBoolean(22));
}

public sealed record AuditDetail(
    Guid InvoiceId,
    Guid BookingId,
    string InvoiceStatus,
    string InvoiceNumber,
    long ItemCount,
    decimal ItemSum,
    decimal SubtotalAmount,
    decimal TotalAmount,
    decimal SubtotalDelta,
    decimal TotalDelta,
    bool SubtotalMismatch,
    bool TotalMismatch,
    bool ItemlessInvalid,
    DateTime CreatedAt,
    DateTime UpdatedAt);

public sealed record AuditSummary(
    long InvoicesScanned,
    long ConsistentInvoices,
    long InconsistentInvoices,
    long SubtotalMismatches,
    long TotalSubtotalMismatches,
    long ItemlessInvalidInvoices,
    bool ReadOnlyTransaction);
