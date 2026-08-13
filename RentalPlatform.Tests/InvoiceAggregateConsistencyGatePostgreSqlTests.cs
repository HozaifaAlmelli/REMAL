using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using RentalPlatform.Business.Services;
using RentalPlatform.Data;
using RentalPlatform.Data.Entities;
using RentalPlatform.InvoiceAggregateAudit;
using RentalPlatform.Shared.Enums;
using RentalPlatform.Tests.Infrastructure;
using Xunit;

namespace RentalPlatform.Tests;

[Collection(PostgreSqlTestCollection.Name)]
[Trait(TestCategories.Name, TestCategories.PostgreSql)]
public sealed class InvoiceAggregateConsistencyGatePostgreSqlTests
{
    private readonly PostgreSqlFixture _fixture;

    public InvoiceAggregateConsistencyGatePostgreSqlTests(PostgreSqlFixture fixture)
    {
        _fixture = fixture;
    }

    [Fact]
    public async Task EmptyDatabasePassesWithZeroSummary()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();

        var result = await RunGateAsync(database.ConnectionString);

        Assert.Equal(InvoiceAggregateConsistencyGate.PassExitCode, result.ExitCode);
        AssertSummary(result, scanned: 0, consistent: 0, inconsistent: 0);
        Assert.Contains("PASS INV-AUDIT-01", result.Output);
    }

    [Fact]
    public async Task CanonicalInvoiceAndZeroValueLinePassExactComparison()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        var state = await CreateCanonicalInvoiceAsync(database, 12_000m);
        await using (var context = database.CreateDbContext())
        {
            await new InvoiceService(new UnitOfWork(context)).AddManualAdjustmentAsync(
                state.InvoiceId,
                "Zero-value canonical line",
                1,
                0m);
        }

        var result = await RunGateAsync(database.ConnectionString);

        Assert.Equal(InvoiceAggregateConsistencyGate.PassExitCode, result.ExitCode);
        AssertSummary(result, scanned: 1, consistent: 1, inconsistent: 0);
        Assert.DoesNotContain("INCONSISTENT", result.Output);
    }

    [Fact]
    public async Task LegacyInflatedAggregateFailsWithSubtotalMismatchOnly()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        var state = await CreateCanonicalInvoiceAsync(database, 12_000m);
        await SetStoredAmountsAsync(database, state.InvoiceId, 14_000m, 14_000m);

        var result = await RunGateAsync(database.ConnectionString);

        Assert.Equal(InvoiceAggregateConsistencyGate.InconsistencyExitCode, result.ExitCode);
        var detail = Assert.Single(ReadDetails(result));
        Assert.Equal(state.InvoiceId, detail.GetProperty("invoice_id").GetGuid());
        Assert.Equal(12_000m, detail.GetProperty("item_sum").GetDecimal());
        Assert.Equal(2_000m, detail.GetProperty("subtotal_delta").GetDecimal());
        Assert.True(detail.GetProperty("subtotal_mismatch").GetBoolean());
        Assert.False(detail.GetProperty("total_mismatch").GetBoolean());
        AssertSummary(result, scanned: 1, consistent: 0, inconsistent: 1,
            subtotalMismatches: 1, totalMismatches: 0);
    }

    [Fact]
    public async Task TotalOnlyMismatchFailsIndependently()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        var state = await CreateCanonicalInvoiceAsync(database, 12_000m);
        await DropTotalEqualsSubtotalConstraintAsync(database);
        await SetStoredAmountsAsync(database, state.InvoiceId, 12_000m, 14_000m);

        var result = await RunGateAsync(database.ConnectionString);

        Assert.Equal(InvoiceAggregateConsistencyGate.InconsistencyExitCode, result.ExitCode);
        var detail = Assert.Single(ReadDetails(result));
        Assert.False(detail.GetProperty("subtotal_mismatch").GetBoolean());
        Assert.True(detail.GetProperty("total_mismatch").GetBoolean());
        Assert.Equal(2_000m, detail.GetProperty("total_delta").GetDecimal());
        AssertSummary(result, scanned: 1, consistent: 0, inconsistent: 1,
            subtotalMismatches: 0, totalMismatches: 1);
    }

    [Fact]
    public async Task OneCentCombinedMismatchUsesExactNumericComparison()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        var state = await CreateCanonicalInvoiceAsync(database, 12_000m);
        await DropTotalEqualsSubtotalConstraintAsync(database);
        await SetStoredAmountsAsync(database, state.InvoiceId, 12_000.01m, 12_000.02m);

        var result = await RunGateAsync(database.ConnectionString);

        var detail = Assert.Single(ReadDetails(result));
        Assert.Equal(0.01m, detail.GetProperty("subtotal_delta").GetDecimal());
        Assert.Equal(0.01m, detail.GetProperty("total_delta").GetDecimal());
        Assert.True(detail.GetProperty("subtotal_mismatch").GetBoolean());
        Assert.True(detail.GetProperty("total_mismatch").GetBoolean());
    }

    [Fact]
    public async Task CancelledAndSupersededInconsistenciesRemainInPopulation()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        var cancelled = await CreateCanonicalInvoiceAsync(database, 12_000m, "cancelled");
        var superseded = await CreateCanonicalInvoiceAsync(database, 12_000m, "superseded");
        await SetStoredAmountsAsync(database, cancelled.InvoiceId, 14_000m, 14_000m);
        await SetStoredAmountsAsync(database, superseded.InvoiceId, 13_000m, 13_000m);

        var result = await RunGateAsync(database.ConnectionString);

        Assert.Equal(InvoiceAggregateConsistencyGate.InconsistencyExitCode, result.ExitCode);
        var details = ReadDetails(result);
        Assert.Equal(2, details.Count);
        Assert.Contains(details, row => row.GetProperty("invoice_status").GetString() == "cancelled");
        Assert.Contains(details, row => row.GetProperty("invoice_status").GetString() == "superseded");
        AssertSummary(result, scanned: 2, consistent: 0, inconsistent: 2,
            subtotalMismatches: 2);
    }

    [Fact]
    public async Task CanonicalAndLegacyReissueChainsAreClassifiedPerPersistedInvoice()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        await CreateCanonicalInvoiceAsync(database, 12_000m, "superseded");
        await CreateCanonicalInvoiceAsync(database, 12_000m, "issued");
        var legacySource = await CreateCanonicalInvoiceAsync(database, 12_000m, "superseded");
        var legacyReplacement = await CreateCanonicalInvoiceAsync(database, 12_000m, "issued");
        await SetStoredAmountsAsync(database, legacySource.InvoiceId, 14_000m, 14_000m);
        await SetStoredAmountsAsync(database, legacyReplacement.InvoiceId, 14_000m, 14_000m);

        var result = await RunGateAsync(database.ConnectionString);

        Assert.Equal(InvoiceAggregateConsistencyGate.InconsistencyExitCode, result.ExitCode);
        var ids = ReadDetails(result)
            .Select(row => row.GetProperty("invoice_id").GetGuid())
            .ToHashSet();
        Assert.Equal(2, ids.Count);
        Assert.Contains(legacySource.InvoiceId, ids);
        Assert.Contains(legacyReplacement.InvoiceId, ids);
        AssertSummary(result, scanned: 4, consistent: 2, inconsistent: 2,
            subtotalMismatches: 2);
    }

    [Fact]
    public async Task ItemlessInvoiceIsExplicitlyInvalidEvenWhenAmountsAreZero()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        var invoiceId = await CreateItemlessInvoiceAsync(database);

        var result = await RunGateAsync(database.ConnectionString);

        var detail = Assert.Single(ReadDetails(result));
        Assert.Equal(invoiceId, detail.GetProperty("invoice_id").GetGuid());
        Assert.True(detail.GetProperty("itemless_invalid").GetBoolean());
        Assert.False(detail.GetProperty("subtotal_mismatch").GetBoolean());
        AssertSummary(result, scanned: 1, consistent: 0, inconsistent: 1,
            itemlessInvalid: 1);
    }

    [Fact]
    public async Task MixedPopulationReportsEveryBadRowAndCorrectSummary()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        await CreateCanonicalInvoiceAsync(database, 12_000m);
        var inflated = await CreateCanonicalInvoiceAsync(database, 12_000m);
        var cancelled = await CreateCanonicalInvoiceAsync(database, 12_000m, "cancelled");
        await SetStoredAmountsAsync(database, inflated.InvoiceId, 14_000m, 14_000m);
        await SetStoredAmountsAsync(database, cancelled.InvoiceId, 13_000m, 13_000m);

        var result = await RunGateAsync(database.ConnectionString);

        Assert.Equal(2, ReadDetails(result).Count);
        AssertSummary(result, scanned: 3, consistent: 1, inconsistent: 2,
            subtotalMismatches: 2);
    }

    [Fact]
    public async Task ReadOnlyRunChangesNoInvoiceItemOrPaymentRows()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        var state = await CreateCanonicalInvoiceAsync(database, 12_000m);
        await SetStoredAmountsAsync(database, state.InvoiceId, 14_000m, 14_000m);
        var before = await ReadBusinessHashesAsync(database);

        var result = await RunGateAsync(database.ConnectionString);
        var after = await ReadBusinessHashesAsync(database);

        Assert.Equal(InvoiceAggregateConsistencyGate.InconsistencyExitCode, result.ExitCode);
        Assert.Equal(before, after);
        Assert.True(ReadSummary(result).GetProperty("read_only_transaction").GetBoolean());
    }

    [Fact]
    public async Task SelectOnlyRoleCanRunGateButCannotMutateInvoices()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        await CreateCanonicalInvoiceAsync(database, 12_000m);
        var role = $"inv_audit_{Guid.NewGuid():N}";
        var password = $"audit-{Guid.NewGuid():N}";
        await CreateSelectOnlyRoleAsync(database, role, password);
        try
        {
            var restrictedConnection = BuildRoleConnectionString(
                database.ConnectionString,
                role,
                password);

            var result = await RunGateAsync(restrictedConnection);

            Assert.Equal(InvoiceAggregateConsistencyGate.PassExitCode, result.ExitCode);
            await using var restricted = new NpgsqlConnection(restrictedConnection);
            await restricted.OpenAsync();
            var exception = await Assert.ThrowsAsync<PostgresException>(async () =>
            {
                await using var command = new NpgsqlCommand(
                    "UPDATE invoices SET updated_at = updated_at",
                    restricted);
                await command.ExecuteNonQueryAsync();
            });
            Assert.Equal(PostgresErrorCodes.InsufficientPrivilege, exception.SqlState);
        }
        finally
        {
            await DropRoleAsync(database, role);
        }
    }

    [Fact]
    public async Task QueryFailureFailsClosedWithoutLeakingDatabaseDetails()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        var role = $"inv_audit_none_{Guid.NewGuid():N}";
        var password = $"audit-{Guid.NewGuid():N}";
        await CreateNoSelectRoleAsync(database, role, password);
        try
        {
            var result = await RunGateAsync(BuildRoleConnectionString(
                database.ConnectionString,
                role,
                password));

            Assert.Equal(InvoiceAggregateConsistencyGate.VerificationErrorExitCode, result.ExitCode);
            Assert.Contains("database verification failed", result.Error);
            Assert.DoesNotContain(password, result.Error);
            Assert.DoesNotContain(database.ConnectionString, result.Error);
        }
        finally
        {
            await DropRoleAsync(database, role);
        }
    }

    [Fact]
    public async Task NonTrivialPopulationUsesOneSetBasedAuditCommand()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        var bookingId = await SeedBookingAsync(database, 100m);
        await InsertCanonicalInvoicesSetWiseAsync(database, bookingId, 500);

        var result = await RunGateAsync(database.ConnectionString);
        var plan = await ExplainAuditAsync(database);

        Assert.Equal(InvoiceAggregateConsistencyGate.PassExitCode, result.ExitCode);
        AssertSummary(result, scanned: 500, consistent: 500, inconsistent: 0);
        Assert.Contains("invoice_items", plan, StringComparison.OrdinalIgnoreCase);
    }

    private static async Task<GateRun> RunGateAsync(string connectionString)
    {
        using var output = new StringWriter();
        using var error = new StringWriter();
        var exitCode = await InvoiceAggregateConsistencyGate.RunAsync(
            connectionString,
            output,
            error);
        return new GateRun(exitCode, output.ToString(), error.ToString());
    }

    private static List<JsonElement> ReadDetails(GateRun result) => result.Output
        .Split(Environment.NewLine, StringSplitOptions.RemoveEmptyEntries)
        .Where(line => line.StartsWith("INCONSISTENT ", StringComparison.Ordinal))
        .Select(line => JsonDocument.Parse(line[13..]).RootElement.Clone())
        .ToList();

    private static JsonElement ReadSummary(GateRun result)
    {
        var line = result.Output
            .Split(Environment.NewLine, StringSplitOptions.RemoveEmptyEntries)
            .Single(row => row.StartsWith("SUMMARY ", StringComparison.Ordinal));
        return JsonDocument.Parse(line[8..]).RootElement.Clone();
    }

    private static void AssertSummary(
        GateRun result,
        long scanned,
        long consistent,
        long inconsistent,
        long subtotalMismatches = 0,
        long totalMismatches = 0,
        long itemlessInvalid = 0)
    {
        var summary = ReadSummary(result);
        Assert.Equal(scanned, summary.GetProperty("invoices_scanned").GetInt64());
        Assert.Equal(consistent, summary.GetProperty("consistent_invoices").GetInt64());
        Assert.Equal(inconsistent, summary.GetProperty("inconsistent_invoices").GetInt64());
        Assert.Equal(subtotalMismatches, summary.GetProperty("subtotal_mismatches").GetInt64());
        Assert.Equal(totalMismatches,
            summary.GetProperty("total_subtotal_mismatches").GetInt64());
        Assert.Equal(itemlessInvalid,
            summary.GetProperty("itemless_invalid_invoices").GetInt64());
        Assert.True(summary.GetProperty("read_only_transaction").GetBoolean());
    }

    private static async Task<InvoiceState> CreateCanonicalInvoiceAsync(
        PostgreSqlTestDatabase database,
        decimal amount,
        string status = "draft")
    {
        var bookingId = await SeedBookingAsync(database, amount);
        await using var context = database.CreateDbContext();
        var invoice = await new InvoiceService(new UnitOfWork(context))
            .CreateDraftFromBookingAsync(
                bookingId,
                $"INV-AUDIT-{Guid.NewGuid():N}",
                "INV-AUDIT-01 synthetic fixture");
        if (status != "draft")
        {
            invoice.InvoiceStatus = status;
            context.Invoices.Update(invoice);
            await context.SaveChangesAsync();
        }

        return new InvoiceState(bookingId, invoice.Id);
    }

    private static async Task<Guid> SeedBookingAsync(
        PostgreSqlTestDatabase database,
        decimal finalAmount)
    {
        await using var context = database.CreateDbContext();
        var suffix = Guid.NewGuid().ToString("N");
        var owner = new Owner
        {
            Id = Guid.NewGuid(), Name = "INV-AUDIT-01 owner", Phone = TestPhone("20"),
            EmergencyPhone = TestPhone("21"), CommissionRate = 10m, Status = "active",
            PasswordHash = "test-only-hash"
        };
        var project = new Project
        {
            Id = Guid.NewGuid(), Name = $"INV-AUDIT-01 project {suffix}", IsActive = true
        };
        var client = new Client
        {
            Id = Guid.NewGuid(), Name = "INV-AUDIT-01 client", Phone = TestPhone("22"),
            PasswordHash = "test-only-hash", IsActive = true
        };
        var unit = new Unit
        {
            Id = Guid.NewGuid(), OwnerId = owner.Id, ProjectId = project.Id,
            Name = $"INV-AUDIT-01 unit {suffix}", UnitType = "apartment",
            Bedrooms = 2, Bathrooms = 1, MaxGuests = 4, BasePricePerNight = finalAmount,
            IsActive = true, IsVisibleInPortfolio = true
        };
        var booking = new Booking
        {
            Id = Guid.NewGuid(), ClientId = client.Id, UnitId = unit.Id, OwnerId = owner.Id,
            BookingStatus = BookingStatus.Booked,
            CheckInDate = new DateOnly(2027, 1, 1), CheckOutDate = new DateOnly(2027, 1, 2),
            GuestCount = 2, BaseAmount = finalAmount, FinalAmount = finalAmount,
            Source = "admin", IsHistorical = false
        };
        context.AddRange(owner, project, client, unit, booking);
        await context.SaveChangesAsync();
        return booking.Id;
    }

    private static async Task SetStoredAmountsAsync(
        PostgreSqlTestDatabase database,
        Guid invoiceId,
        decimal subtotal,
        decimal total)
    {
        await using var connection = await database.OpenConnectionAsync();
        await using var command = new NpgsqlCommand(
            "UPDATE invoices SET subtotal_amount = @subtotal, total_amount = @total WHERE id = @id",
            connection);
        command.Parameters.AddWithValue("subtotal", subtotal);
        command.Parameters.AddWithValue("total", total);
        command.Parameters.AddWithValue("id", invoiceId);
        Assert.Equal(1, await command.ExecuteNonQueryAsync());
    }

    private static async Task DropTotalEqualsSubtotalConstraintAsync(
        PostgreSqlTestDatabase database)
    {
        await using var connection = await database.OpenConnectionAsync();
        await using var command = new NpgsqlCommand(
            "ALTER TABLE invoices DROP CONSTRAINT ck_invoices_total_equals_subtotal",
            connection);
        await command.ExecuteNonQueryAsync();
    }

    private static async Task<Guid> CreateItemlessInvoiceAsync(
        PostgreSqlTestDatabase database)
    {
        var bookingId = await SeedBookingAsync(database, 0m);
        await using var context = database.CreateDbContext();
        var invoice = new Invoice
        {
            Id = Guid.NewGuid(), BookingId = bookingId,
            InvoiceNumber = $"INV-AUDIT-EMPTY-{Guid.NewGuid():N}",
            InvoiceStatus = "draft", SubtotalAmount = 0m, TotalAmount = 0m,
            CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow
        };
        context.Invoices.Add(invoice);
        await context.SaveChangesAsync();
        return invoice.Id;
    }

    private static async Task<BusinessHashes> ReadBusinessHashesAsync(
        PostgreSqlTestDatabase database)
    {
        await using var connection = await database.OpenConnectionAsync();
        const string sql =
            """
            SELECT
                COALESCE((SELECT md5(string_agg(to_jsonb(row_value)::TEXT, '' ORDER BY row_value.id))
                          FROM invoices AS row_value), md5('')),
                COALESCE((SELECT md5(string_agg(to_jsonb(row_value)::TEXT, '' ORDER BY row_value.id))
                          FROM invoice_items AS row_value), md5('')),
                COALESCE((SELECT md5(string_agg(to_jsonb(row_value)::TEXT, '' ORDER BY row_value.id))
                          FROM payments AS row_value), md5(''))
            """;
        await using var command = new NpgsqlCommand(sql, connection);
        await using var reader = await command.ExecuteReaderAsync();
        Assert.True(await reader.ReadAsync());
        return new BusinessHashes(reader.GetString(0), reader.GetString(1), reader.GetString(2));
    }

    private static async Task CreateSelectOnlyRoleAsync(
        PostgreSqlTestDatabase database,
        string role,
        string password)
    {
        await CreateRoleAsync(database, role, password);
        await using var connection = await database.OpenConnectionAsync();
        var sql =
            $"GRANT USAGE ON SCHEMA public TO {QuoteIdentifier(role)}; " +
            $"GRANT SELECT ON invoices, invoice_items TO {QuoteIdentifier(role)};";
        await using var command = new NpgsqlCommand(sql, connection);
        await command.ExecuteNonQueryAsync();
    }

    private static async Task CreateNoSelectRoleAsync(
        PostgreSqlTestDatabase database,
        string role,
        string password)
    {
        await CreateRoleAsync(database, role, password);
        await using var connection = await database.OpenConnectionAsync();
        await using var command = new NpgsqlCommand(
            $"GRANT USAGE ON SCHEMA public TO {QuoteIdentifier(role)}",
            connection);
        await command.ExecuteNonQueryAsync();
    }

    private static async Task CreateRoleAsync(
        PostgreSqlTestDatabase database,
        string role,
        string password)
    {
        await using var connection = await database.OpenConnectionAsync();
        var escapedPassword = password.Replace("'", "''", StringComparison.Ordinal);
        await using var command = new NpgsqlCommand(
            $"CREATE ROLE {QuoteIdentifier(role)} LOGIN PASSWORD '{escapedPassword}'; " +
            $"GRANT CONNECT ON DATABASE {QuoteIdentifier(database.DatabaseName)} TO {QuoteIdentifier(role)};",
            connection);
        await command.ExecuteNonQueryAsync();
    }

    private static async Task DropRoleAsync(PostgreSqlTestDatabase database, string role)
    {
        NpgsqlConnection.ClearAllPools();
        await using var connection = await database.OpenConnectionAsync();
        await using var command = new NpgsqlCommand(
            $"DROP OWNED BY {QuoteIdentifier(role)}; DROP ROLE {QuoteIdentifier(role)};",
            connection);
        await command.ExecuteNonQueryAsync();
    }

    private static string BuildRoleConnectionString(
        string connectionString,
        string role,
        string password)
    {
        var builder = new NpgsqlConnectionStringBuilder(connectionString)
        {
            Username = role,
            Password = password,
            Pooling = false,
            ApplicationName = "INV-AUDIT-01 restricted-role proof"
        };
        return builder.ConnectionString;
    }

    private static async Task InsertCanonicalInvoicesSetWiseAsync(
        PostgreSqlTestDatabase database,
        Guid bookingId,
        int count)
    {
        await using var connection = await database.OpenConnectionAsync();
        const string sql =
            """
            WITH inserted AS (
                INSERT INTO invoices (
                    id, booking_id, invoice_number, invoice_status, subtotal_amount,
                    total_amount, created_at, updated_at)
                SELECT
                    gen_random_uuid(), @booking_id,
                    'INV-AUDIT-BULK-' || series::TEXT, 'cancelled', 100.00, 100.00,
                    TIMESTAMP '2026-08-14 00:00:00', TIMESTAMP '2026-08-14 00:00:00'
                FROM generate_series(1, @count) AS series
                RETURNING id
            )
            INSERT INTO invoice_items (
                id, invoice_id, line_type, description, quantity, unit_amount,
                line_total, created_at, updated_at)
            SELECT
                gen_random_uuid(), id, 'booking_stay', 'Synthetic canonical item', 1,
                100.00, 100.00, TIMESTAMP '2026-08-14 00:00:00',
                TIMESTAMP '2026-08-14 00:00:00'
            FROM inserted
            """;
        await using var command = new NpgsqlCommand(sql, connection);
        command.Parameters.AddWithValue("booking_id", bookingId);
        command.Parameters.AddWithValue("count", count);
        Assert.Equal(count, await command.ExecuteNonQueryAsync());
    }

    private static async Task<string> ExplainAuditAsync(PostgreSqlTestDatabase database)
    {
        await using var connection = await database.OpenConnectionAsync();
        await using var command = new NpgsqlCommand(
            "EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) " + InvoiceAggregateConsistencyGate.AuditSql,
            connection);
        await using var reader = await command.ExecuteReaderAsync();
        var lines = new List<string>();
        while (await reader.ReadAsync())
            lines.Add(reader.GetString(0));
        return string.Join(Environment.NewLine, lines);
    }

    private static string QuoteIdentifier(string identifier) =>
        $"\"{identifier.Replace("\"", "\"\"", StringComparison.Ordinal)}\"";

    private static string TestPhone(string prefix)
    {
        var value = BitConverter.ToUInt32(Guid.NewGuid().ToByteArray(), 0) % 10_000_000_000L;
        return $"+{prefix}{value:D10}";
    }

    private sealed record InvoiceState(Guid BookingId, Guid InvoiceId);
    private sealed record GateRun(int ExitCode, string Output, string Error);
    private sealed record BusinessHashes(string Invoices, string InvoiceItems, string Payments);
}
