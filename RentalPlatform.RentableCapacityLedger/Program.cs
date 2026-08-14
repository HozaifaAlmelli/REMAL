using System.Data;
using System.Globalization;
using System.Text.Json;
using Npgsql;

namespace RentalPlatform.RentableCapacityLedger;

public static class Program
{
    public const string ConnectionStringEnvironmentVariable = "KAZA_RENTABLE_CAPACITY_DB";

    public static async Task<int> Main(string[] args)
    {
        var connectionString = Environment.GetEnvironmentVariable(ConnectionStringEnvironmentVariable);
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            Console.Error.WriteLine(
                $"AN-OPS-01B1 configuration error: {ConnectionStringEnvironmentVariable} is required.");
            return RentableCapacityLedgerGate.ConfigurationErrorExitCode;
        }

        if (args.Length == 0 || string.Equals(args[0], "verify", StringComparison.OrdinalIgnoreCase))
        {
            return await RentableCapacityLedgerGate.RunAsync(
                connectionString,
                Console.Out,
                Console.Error);
        }

        if (args.Length == 4 &&
            string.Equals(args[0], "initialize", StringComparison.OrdinalIgnoreCase) &&
            string.Equals(args[1], "--epoch", StringComparison.OrdinalIgnoreCase) &&
            DateOnly.TryParseExact(
                args[2],
                "yyyy-MM-dd",
                CultureInfo.InvariantCulture,
                DateTimeStyles.None,
                out var epoch) &&
            string.Equals(args[3], "--confirm-opening-seed", StringComparison.Ordinal))
        {
            return await RentableCapacityLedgerInitializer.RunAsync(
                connectionString,
                epoch,
                CairoToday(),
                Console.Out,
                Console.Error);
        }

        Console.Error.WriteLine(
            "Usage: verify | initialize --epoch yyyy-MM-dd --confirm-opening-seed");
        return RentableCapacityLedgerGate.ConfigurationErrorExitCode;
    }

    private static DateOnly CairoToday()
    {
        TimeZoneInfo cairo;
        try
        {
            cairo = TimeZoneInfo.FindSystemTimeZoneById("Africa/Cairo");
        }
        catch (TimeZoneNotFoundException)
        {
            cairo = TimeZoneInfo.FindSystemTimeZoneById("Egypt Standard Time");
        }

        return DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, cairo));
    }
}

public static class RentableCapacityLedgerGate
{
    public const int PassExitCode = 0;
    public const int InconsistencyExitCode = 2;
    public const int VerificationErrorExitCode = 3;
    public const int ConfigurationErrorExitCode = 64;

    public const string IntegritySql =
        """
        WITH ledger AS (
            SELECT coverage_start_date, published_at, publication_status
            FROM rentable_capacity_ledger
            WHERE scope = 'global'
        ),
        expected_units AS (
            SELECT
                unit.id AS unit_id,
                CASE
                    WHEN unit.created_at <= ledger.published_at THEN ledger.coverage_start_date
                    ELSE (unit.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Africa/Cairo')::DATE
                END AS entry_date
            FROM units AS unit
            CROSS JOIN ledger
            WHERE ledger.publication_status = 'published'
        ),
        current_periods AS (
            SELECT period.*
            FROM unit_rentability_periods AS period
            WHERE period.superseded_at IS NULL
        ),
        valid_current_periods AS (
            SELECT period.*
            FROM current_periods AS period
            WHERE period.effective_to_date IS NULL
               OR period.effective_to_date > period.effective_from_date
        ),
        ordered AS (
            SELECT
                period.*,
                LAG(period.effective_to_date) OVER (
                    PARTITION BY period.unit_id ORDER BY period.effective_from_date, period.id
                ) AS previous_end,
                ROW_NUMBER() OVER (
                    PARTITION BY period.unit_id ORDER BY period.effective_from_date, period.id
                ) AS sequence_number
            FROM current_periods AS period
        ),
        issues AS (
            SELECT 'ledger_not_published'::TEXT AS issue, NULL::UUID AS unit_id
            WHERE (SELECT COUNT(*) FROM ledger WHERE publication_status = 'published') <> 1

            UNION ALL
            SELECT 'invalid_bounds', period.unit_id
            FROM unit_rentability_periods AS period
            WHERE period.effective_to_date IS NOT NULL
              AND period.effective_to_date <= period.effective_from_date

            UNION ALL
            SELECT 'malformed_supersession', period.unit_id
            FROM unit_rentability_periods AS period
            WHERE (period.superseded_at IS NULL) <> (period.superseded_by_revision_id IS NULL)

            UNION ALL
            SELECT 'missing_superseding_revision', period.unit_id
            FROM unit_rentability_periods AS period
            WHERE period.superseded_by_revision_id IS NOT NULL
              AND NOT EXISTS (
                  SELECT 1
                  FROM unit_rentability_periods AS successor
                  WHERE successor.unit_id = period.unit_id
                    AND successor.revision_id = period.superseded_by_revision_id
              )

            UNION ALL
            SELECT 'pre_epoch_claim', period.unit_id
            FROM unit_rentability_periods AS period
            CROSS JOIN ledger
            WHERE ledger.coverage_start_date IS NOT NULL
              AND period.effective_from_date < ledger.coverage_start_date

            UNION ALL
            SELECT 'overlap', left_period.unit_id
            FROM valid_current_periods AS left_period
            JOIN valid_current_periods AS right_period
              ON right_period.unit_id = left_period.unit_id
             AND right_period.id > left_period.id
             AND daterange(
                    left_period.effective_from_date,
                    left_period.effective_to_date,
                    '[)'
                 ) && daterange(
                    right_period.effective_from_date,
                    right_period.effective_to_date,
                    '[)'
                 )

            UNION ALL
            SELECT 'missing_opening_period', expected.unit_id
            FROM expected_units AS expected
            WHERE NOT EXISTS (
                SELECT 1
                FROM current_periods AS period
                WHERE period.unit_id = expected.unit_id
                  AND period.effective_from_date = expected.entry_date
            )

            UNION ALL
            SELECT 'timeline_gap', period.unit_id
            FROM ordered AS period
            WHERE period.sequence_number > 1
              AND period.previous_end IS DISTINCT FROM period.effective_from_date

            UNION ALL
            SELECT 'multiple_open_periods', period.unit_id
            FROM current_periods AS period
            WHERE period.effective_to_date IS NULL
            GROUP BY period.unit_id
            HAVING COUNT(*) > 1

            UNION ALL
            SELECT 'missing_open_period', expected.unit_id
            FROM expected_units AS expected
            WHERE NOT EXISTS (
                SELECT 1
                FROM current_periods AS period
                WHERE period.unit_id = expected.unit_id
                  AND period.effective_to_date IS NULL
            )
        )
        SELECT issue, unit_id
        FROM issues
        ORDER BY issue, unit_id
        """;

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
            await ExecuteAsync(connection, transaction, "SET TRANSACTION READ ONLY", cancellationToken);

            var issues = await ReadIssuesAsync(connection, transaction, cancellationToken);
            var readOnly = await ScalarAsync<bool>(
                connection,
                transaction,
                "SELECT current_setting('transaction_read_only') = 'on'",
                cancellationToken);
            await transaction.RollbackAsync(cancellationToken);

            if (!readOnly)
            {
                await error.WriteLineAsync(
                    "AN-OPS-01B1 verification error: read-only execution was not proven.");
                return VerificationErrorExitCode;
            }

            foreach (var issue in issues)
                await output.WriteLineAsync($"INCONSISTENT {JsonSerializer.Serialize(issue)}");

            await output.WriteLineAsync(
                $"SUMMARY {JsonSerializer.Serialize(new { issueCount = issues.Count, readOnly = true })}");
            if (issues.Count > 0)
            {
                await output.WriteLineAsync("FAIL AN-OPS-01B1 rentable-capacity ledger integrity failed.");
                return InconsistencyExitCode;
            }

            await output.WriteLineAsync("PASS AN-OPS-01B1 rentable-capacity ledger integrity verified.");
            return PassExitCode;
        }
        catch (Exception exception)
        {
            var code = exception is PostgresException postgres ? postgres.SqlState : "verification_failure";
            await error.WriteLineAsync(
                $"AN-OPS-01B1 verification error: database verification failed ({code}).");
            return VerificationErrorExitCode;
        }
    }

    internal static async Task<List<LedgerIssue>> ReadIssuesAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        CancellationToken cancellationToken)
    {
        var issues = new List<LedgerIssue>();
        await using var command = new NpgsqlCommand(IntegritySql, connection, transaction)
        {
            CommandTimeout = 120
        };
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            issues.Add(new LedgerIssue(
                reader.GetString(0),
                reader.IsDBNull(1) ? null : reader.GetGuid(1)));
        }

        return issues;
    }

    internal static async Task ExecuteAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        string sql,
        CancellationToken cancellationToken)
    {
        await using var command = new NpgsqlCommand(sql, connection, transaction);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    private static async Task<T> ScalarAsync<T>(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        string sql,
        CancellationToken cancellationToken)
    {
        await using var command = new NpgsqlCommand(sql, connection, transaction);
        return (T)(await command.ExecuteScalarAsync(cancellationToken))!;
    }
}

public static class RentableCapacityLedgerInitializer
{
    public const string SeedSql =
        """
        WITH boundaries AS (
            SELECT unit.id AS unit_id, @epoch::DATE AS boundary
            FROM units AS unit

            UNION

            SELECT block.unit_id, GREATEST(@epoch::DATE, block.start_date)
            FROM date_blocks AS block
            WHERE block.deleted_at IS NULL
              AND block.status IN ('pending_approval', 'approved')
              AND block.end_date >= @epoch::DATE

            UNION

            SELECT block.unit_id, block.end_date + 1
            FROM date_blocks AS block
            WHERE block.deleted_at IS NULL
              AND block.status IN ('pending_approval', 'approved')
              AND block.end_date >= @epoch::DATE
        ),
        segments AS (
            SELECT
                boundary.unit_id,
                boundary.boundary AS effective_from_date,
                LEAD(boundary.boundary) OVER (
                    PARTITION BY boundary.unit_id ORDER BY boundary.boundary
                ) AS effective_to_date
            FROM boundaries AS boundary
        ),
        resolved AS (
            SELECT
                segment.unit_id,
                segment.effective_from_date,
                segment.effective_to_date,
                CASE
                    WHEN unit.deleted_at IS NOT NULL OR NOT unit.is_active THEN FALSE
                    WHEN EXISTS (
                        SELECT 1
                        FROM date_blocks AS block
                        WHERE block.unit_id = segment.unit_id
                          AND block.deleted_at IS NULL
                          AND block.status IN ('pending_approval', 'approved')
                          AND block.start_date <= segment.effective_from_date
                          AND block.end_date >= segment.effective_from_date
                    ) THEN FALSE
                    ELSE TRUE
                END AS is_rentable,
                CASE
                    WHEN unit.deleted_at IS NOT NULL THEN 'unit_deleted'
                    WHEN NOT unit.is_active THEN 'unit_inactive'
                    WHEN EXISTS (
                        SELECT 1
                        FROM date_blocks AS block
                        WHERE block.unit_id = segment.unit_id
                          AND block.deleted_at IS NULL
                          AND block.status IN ('pending_approval', 'approved')
                          AND block.start_date <= segment.effective_from_date
                          AND block.end_date >= segment.effective_from_date
                    ) THEN 'date_block'
                    ELSE 'rentable'
                END AS resolved_reason
            FROM segments AS segment
            JOIN units AS unit ON unit.id = segment.unit_id
        ),
        marked AS (
            SELECT
                resolved.*,
                CASE
                    WHEN LAG(resolved.is_rentable) OVER unit_order IS DISTINCT FROM resolved.is_rentable
                      OR LAG(resolved.resolved_reason) OVER unit_order IS DISTINCT FROM resolved.resolved_reason
                    THEN 1 ELSE 0
                END AS new_group
            FROM resolved
            WINDOW unit_order AS (
                PARTITION BY resolved.unit_id ORDER BY resolved.effective_from_date
            )
        ),
        grouped AS (
            SELECT
                marked.*,
                SUM(marked.new_group) OVER (
                    PARTITION BY marked.unit_id ORDER BY marked.effective_from_date
                ) AS group_number
            FROM marked
        ),
        merged AS (
            SELECT
                unit_id,
                MIN(effective_from_date) AS effective_from_date,
                CASE WHEN BOOL_OR(effective_to_date IS NULL)
                    THEN NULL ELSE MAX(effective_to_date) END AS effective_to_date,
                is_rentable,
                resolved_reason
            FROM grouped
            GROUP BY unit_id, group_number, is_rentable, resolved_reason
        )
        INSERT INTO unit_rentability_periods (
            id,
            unit_id,
            effective_from_date,
            effective_to_date,
            is_rentable,
            resolved_reason,
            revision_id,
            change_source_type,
            change_source_id,
            actor_type,
            actor_id,
            recorded_at,
            superseded_at,
            superseded_by_revision_id
        )
        SELECT
            gen_random_uuid(),
            merged.unit_id,
            merged.effective_from_date,
            merged.effective_to_date,
            merged.is_rentable,
            merged.resolved_reason,
            @revision_id,
            'opening_seed',
            NULL,
            NULL,
            NULL,
            @published_at,
            NULL,
            NULL
        FROM merged
        """;

    public static async Task<int> RunAsync(
        string connectionString,
        DateOnly epoch,
        DateOnly currentCairoDate,
        TextWriter output,
        TextWriter error,
        CancellationToken cancellationToken = default)
    {
        if (epoch != currentCairoDate)
        {
            await error.WriteLineAsync(
                "AN-OPS-01B1 initialization refused: the epoch must equal the current Cairo date.");
            return RentableCapacityLedgerGate.ConfigurationErrorExitCode;
        }

        try
        {
            await using var connection = new NpgsqlConnection(connectionString);
            await connection.OpenAsync(cancellationToken);
            await using var transaction = await connection.BeginTransactionAsync(
                IsolationLevel.Serializable,
                cancellationToken);

            await RentableCapacityLedgerGate.ExecuteAsync(
                connection,
                transaction,
                "SELECT pg_advisory_xact_lock(hashtextextended('rentable-capacity:publication', 0))",
                cancellationToken);

            var mayInitialize = false;
            await using (var stateCommand = new NpgsqlCommand(
                """
                SELECT publication_status, coverage_start_date, published_at
                FROM rentable_capacity_ledger
                WHERE scope = 'global'
                FOR UPDATE
                """,
                connection,
                transaction))
            await using (var reader = await stateCommand.ExecuteReaderAsync(cancellationToken))
            {
                mayInitialize = await reader.ReadAsync(cancellationToken) &&
                    reader.GetString(0) == "uninitialized" &&
                    reader.IsDBNull(1) &&
                    reader.IsDBNull(2);
            }

            if (!mayInitialize)
            {
                await error.WriteLineAsync(
                    "AN-OPS-01B1 initialization refused: the ledger is already initialized or malformed.");
                await transaction.RollbackAsync(cancellationToken);
                return RentableCapacityLedgerGate.InconsistencyExitCode;
            }

            await using (var countCommand = new NpgsqlCommand(
                "SELECT COUNT(*) FROM unit_rentability_periods",
                connection,
                transaction))
            {
                if (Convert.ToInt64(await countCommand.ExecuteScalarAsync(cancellationToken)) != 0)
                {
                    await error.WriteLineAsync(
                        "AN-OPS-01B1 initialization refused: period rows already exist.");
                    await transaction.RollbackAsync(cancellationToken);
                    return RentableCapacityLedgerGate.InconsistencyExitCode;
                }
            }

            var publishedAt = DateTime.UtcNow;
            await using (var seedCommand = new NpgsqlCommand(SeedSql, connection, transaction))
            {
                seedCommand.Parameters.AddWithValue("epoch", epoch);
                seedCommand.Parameters.AddWithValue("revision_id", Guid.NewGuid());
                seedCommand.Parameters.AddWithValue("published_at", publishedAt);
                await seedCommand.ExecuteNonQueryAsync(cancellationToken);
            }

            await using (var publishCommand = new NpgsqlCommand(
                """
                UPDATE rentable_capacity_ledger
                SET publication_status = 'published',
                    coverage_start_date = @epoch,
                    published_at = @published_at,
                    updated_at = @published_at
                WHERE scope = 'global' AND publication_status = 'uninitialized'
                """,
                connection,
                transaction))
            {
                publishCommand.Parameters.AddWithValue("epoch", epoch);
                publishCommand.Parameters.AddWithValue("published_at", publishedAt);
                if (await publishCommand.ExecuteNonQueryAsync(cancellationToken) != 1)
                    throw new InvalidOperationException("The global ledger publication row changed during initialization.");
            }

            var issues = await RentableCapacityLedgerGate.ReadIssuesAsync(
                connection,
                transaction,
                cancellationToken);
            if (issues.Count > 0)
            {
                await error.WriteLineAsync(
                    $"AN-OPS-01B1 initialization failed integrity verification ({issues.Count} issue(s)).");
                await transaction.RollbackAsync(cancellationToken);
                return RentableCapacityLedgerGate.InconsistencyExitCode;
            }

            await transaction.CommitAsync(cancellationToken);
            await output.WriteLineAsync(
                $"PASS AN-OPS-01B1 opening state published at epoch {epoch:yyyy-MM-dd} after integrity verification.");
            return RentableCapacityLedgerGate.PassExitCode;
        }
        catch (Exception exception)
        {
            var code = exception is PostgresException postgres ? postgres.SqlState : "initialization_failure";
            await error.WriteLineAsync(
                $"AN-OPS-01B1 initialization error: opening-state publication failed ({code}).");
            return RentableCapacityLedgerGate.VerificationErrorExitCode;
        }
    }
}

public sealed record LedgerIssue(string Issue, Guid? UnitId);
