using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Npgsql;
using RentalPlatform.Business.Services;
using RentalPlatform.Data;
using RentalPlatform.Data.Entities;
using RentalPlatform.Shared.Constants;
using RentalPlatform.Shared.Enums;
using RentalPlatform.Tests.Infrastructure;
using Xunit;

namespace RentalPlatform.Tests;

[Collection(PostgreSqlTestCollection.Name)]
[Trait(TestCategories.Name, TestCategories.PostgreSql)]
public sealed class HistoricalReportingPostgreSqlTests
{
    private static readonly DateTime RecordedAt = new(2026, 8, 10, 12, 0, 0, DateTimeKind.Utc);
    private static readonly DateOnly EvidenceDate = new(2026, 2, 5);
    private readonly PostgreSqlFixture _fixture;

    public HistoricalReportingPostgreSqlTests(PostgreSqlFixture fixture)
    {
        _fixture = fixture;
    }

    [Fact]
    public async Task RecordedStayAndReconciliationAxesPreserveHistoricalTruth()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        await using var context = database.CreateDbContext();
        var seed = await SeedMatrixAsync(context);

        var bookingService = new ReportingBookingAnalyticsService(
            new UnitOfWork(context),
            NullLogger<ReportingBookingAnalyticsService>.Instance);
        var financeService = new ReportingFinanceAnalyticsService(
            new UnitOfWork(context),
            NullLogger<ReportingFinanceAnalyticsService>.Instance);

        var recorded = await bookingService.GetDailySummaryAsync(
            new DateOnly(2026, 8, 1),
            new DateOnly(2026, 8, 31));
        var recordedToday = Assert.Single(recorded, row => row.BookingSource == "admin");
        Assert.Equal(2, recordedToday.HistoricalBookingsCount);
        Assert.Equal(3_234.56m, recordedToday.HistoricalAgreedAmount);

        var ordinaryOnly = await bookingService.GetDailySummaryAsync(
            new DateOnly(2026, 8, 1),
            new DateOnly(2026, 8, 31),
            cancellationToken: default,
            includeHistorical: false);
        Assert.Single(ordinaryOnly);
        Assert.Equal(1, ordinaryOnly.Sum(row => row.BookingsCreatedCount));
        Assert.All(ordinaryOnly, row => Assert.Equal(0, row.HistoricalBookingsCount));

        var historicalOnly = await bookingService.GetDailySummaryAsync(
            new DateOnly(2026, 8, 1),
            new DateOnly(2026, 8, 31),
            cancellationToken: default,
            includeHistorical: true,
            historicalOnly: true);
        Assert.Equal(2, historicalOnly.Sum(row => row.BookingsCreatedCount));
        Assert.Equal(3_234.56m, historicalOnly.Sum(row => row.HistoricalAgreedAmount));

        var stayRows = await bookingService.GetStayDailySummaryAsync(
            new DateOnly(2024, 12, 1),
            new DateOnly(2026, 1, 31));
        Assert.Contains(stayRows, row =>
            row.MetricDate == seed.LegacyHistorical.CheckInDate
            && row.IsHistorical
            && row.ReportingSource == "legacy_system"
            && row.HistoricalAgreedAmount == 1_234.56m);
        Assert.Contains(stayRows, row =>
            row.MetricDate == seed.ExternalHistorical.CheckInDate
            && row.IsHistorical
            && row.ReportingSource == "external_platform"
            && row.HistoricalAgreedAmount == 2_000m);
        Assert.DoesNotContain(stayRows, row =>
            row.MetricDate == DateOnly.FromDateTime(RecordedAt)
            && row.IsHistorical);

        Assert.Equal(
            recorded.Sum(row => row.BookingsCreatedCount),
            stayRows.Sum(row => row.BookingsCount));

        var financeRecorded = await financeService.GetDailySummaryAsync(
            new DateOnly(2026, 8, 1),
            new DateOnly(2026, 8, 31));
        var financeToday = Assert.Single(financeRecorded);
        Assert.Equal(2_000m, financeToday.TotalInvoicedAmount);
        Assert.Equal(800m, financeToday.TotalPaidAmount);
        Assert.Equal(1_200m, financeToday.TotalRemainingAmount);
        Assert.Equal(1_000m, financeToday.HistoricalInvoicedAmount);
        Assert.Equal(400m, financeToday.HistoricalInvoiceLinkedPaidAmount);
        Assert.Equal(600m, financeToday.HistoricalRemainingAmount);
        Assert.Equal(2, financeToday.OrdinaryOrphanPaymentCount);
        Assert.Equal(75m, financeToday.OrdinaryOrphanPaymentAmount);
        Assert.Equal(1, financeToday.HistoricalBookingOrdinaryOrphanPaymentCount);
        Assert.Equal(50m, financeToday.HistoricalBookingOrdinaryOrphanPaymentAmount);
        Assert.Equal(0, financeToday.HistoricalPaymentEvidenceCount);

        var financeSummary = await financeService.GetSummaryAsync(
            new DateOnly(2026, 8, 1),
            new DateOnly(2026, 8, 31));
        Assert.Equal(2, financeSummary.OrdinaryOrphanPaymentCount);
        Assert.Equal(75m, financeSummary.OrdinaryOrphanPaymentAmount);
        Assert.Equal(1, financeSummary.HistoricalBookingOrdinaryOrphanPaymentCount);
        Assert.Equal(50m, financeSummary.HistoricalBookingOrdinaryOrphanPaymentAmount);

        var evidenceRows = await financeService.GetDailySummaryAsync(EvidenceDate, EvidenceDate);
        var evidenceRow = Assert.Single(evidenceRows);
        Assert.Equal(0m, evidenceRow.TotalPaidAmount);
        Assert.Equal(0m, evidenceRow.TotalRemainingAmount);
        Assert.Equal(1, evidenceRow.HistoricalPaymentEvidenceCount);
        Assert.Equal(700.25m, evidenceRow.HistoricalPaymentEvidenceAmount);

        var financeStay = await financeService.GetStayDailySummaryAsync(
            seed.LegacyHistorical.CheckInDate,
            seed.LegacyHistorical.CheckInDate);
        var historicalFinanceStay = Assert.Single(financeStay);
        Assert.True(historicalFinanceStay.IsHistorical);
        Assert.Equal(1_000m, historicalFinanceStay.TotalInvoicedAmount);
        Assert.Equal(400m, historicalFinanceStay.InvoiceLinkedPaidAmount);
        Assert.Equal(600m, historicalFinanceStay.TotalRemainingAmount);
        Assert.Equal(1_234.56m, historicalFinanceStay.HistoricalAgreedAmount);

        var reconciliation = await bookingService.GetHistoricalReconciliationAsync(
            new DateOnly(2024, 1, 1),
            new DateOnly(2025, 12, 1));
        var legacy = Assert.Single(reconciliation, row => row.OriginalSource == "legacy_system");
        Assert.Equal(new DateOnly(2025, 1, 1), legacy.StayMonth);
        Assert.Equal(new DateOnly(2026, 8, 1), legacy.RecordedMonth);
        Assert.Equal(new DateOnly(2025, 1, 1), legacy.ActualBookedMonth);
        Assert.Equal(586m, legacy.EntryLagDaysP50);
        Assert.Equal(1, legacy.HistoricalPaymentEvidenceCount);
        Assert.Equal(700.25m, legacy.HistoricalPaymentEvidenceAmount);
        Assert.Equal(EvidenceDate, legacy.HistoricalPaymentEvidenceFirstPaidDate);
        Assert.Equal(EvidenceDate, legacy.HistoricalPaymentEvidenceLastPaidDate);

        await AssertIndependentSqlAsync(database, seed);
    }

    [Fact]
    public async Task MigrationVerifierRollbackAndReapplyPreserveThePriorViewContract()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        var root = FindRepositoryRoot();
        var migration = await File.ReadAllTextAsync(Path.Combine(
            root, "db", "migrations", "0063_add_historical_reporting_read_models.sql"));
        var verifier = await File.ReadAllTextAsync(Path.Combine(
            root, "db", "migrations", "0063_add_historical_reporting_read_models_verify.sql"));
        var rollback = await File.ReadAllTextAsync(Path.Combine(
            root, "db", "migrations", "0063_add_historical_reporting_read_models_rollback.sql"));

        await using var connection = await database.OpenConnectionAsync();
        await PostgreSqlFixture.ExecuteMigrationSqlAsync(connection, verifier);
        await PostgreSqlFixture.ExecuteMigrationSqlAsync(connection, rollback);

        Assert.Equal(8, await ColumnCountAsync(connection, "reporting_booking_daily_summary"));
        Assert.Equal(8, await ColumnCountAsync(connection, "reporting_finance_daily_summary"));
        Assert.False(await ViewExistsAsync(connection, "reporting_booking_stay_daily_summary"));
        Assert.False(await ViewExistsAsync(connection, "reporting_finance_stay_daily_summary"));
        Assert.False(await ViewExistsAsync(connection, "reporting_historical_entry_reconciliation"));

        await PostgreSqlFixture.ExecuteMigrationSqlAsync(connection, migration);
        await PostgreSqlFixture.ExecuteMigrationSqlAsync(connection, verifier);

        Assert.Equal(15, await ColumnCountAsync(connection, "reporting_booking_daily_summary"));
        Assert.Equal(19, await ColumnCountAsync(connection, "reporting_finance_daily_summary"));
        Assert.True(await ViewExistsAsync(connection, "reporting_booking_stay_daily_summary"));
        Assert.True(await ViewExistsAsync(connection, "reporting_finance_stay_daily_summary"));
        Assert.True(await ViewExistsAsync(connection, "reporting_historical_entry_reconciliation"));
    }

    [Fact]
    public async Task MigrationVerifierRejectsMalformedOwnedViewDictionary()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        var root = FindRepositoryRoot();
        var verifier = await File.ReadAllTextAsync(Path.Combine(
            root, "db", "migrations", "0063_add_historical_reporting_read_models_verify.sql"));

        await using var connection = await database.OpenConnectionAsync();
        await PostgreSqlFixture.ExecuteMigrationSqlAsync(
            connection,
            "DROP VIEW reporting_historical_entry_reconciliation; " +
            "CREATE VIEW reporting_historical_entry_reconciliation AS SELECT CURRENT_DATE AS stay_month;");

        var exception = await Assert.ThrowsAnyAsync<Exception>(
            () => PostgreSqlFixture.ExecuteMigrationSqlAsync(connection, verifier));

        Assert.Contains("reconciliation-view dictionary is invalid", exception.ToString(),
            StringComparison.OrdinalIgnoreCase);
    }

    private static async Task AssertIndependentSqlAsync(
        PostgreSqlTestDatabase database,
        SeedMatrix seed)
    {
        await using var connection = await database.OpenConnectionAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT
                (SELECT count(*) FROM bookings),
                (SELECT count(*) FROM bookings WHERE is_historical),
                (SELECT COALESCE(sum(agreed_amount), 0) FROM bookings WHERE is_historical),
                (SELECT COALESCE(sum(amount), 0) FROM payments
                 WHERE is_historical_record AND invoice_id IS NULL),
                (SELECT COALESCE(sum(amount), 0) FROM payments
                 WHERE NOT is_historical_record AND payment_status = 'paid'),
                (SELECT count(*) FROM payments
                 WHERE is_historical_record AND invoice_id IS NOT NULL),
                (SELECT count(*) FROM owner_payouts
                 WHERE booking_id IN (@legacy, @external));
            """;
        command.Parameters.AddWithValue("legacy", seed.LegacyHistorical.Id);
        command.Parameters.AddWithValue("external", seed.ExternalHistorical.Id);

        await using var reader = await command.ExecuteReaderAsync();
        Assert.True(await reader.ReadAsync());
        Assert.Equal(3L, reader.GetInt64(0));
        Assert.Equal(2L, reader.GetInt64(1));
        Assert.Equal(3_234.56m, reader.GetDecimal(2));
        Assert.Equal(700.25m, reader.GetDecimal(3));
        Assert.Equal(875m, reader.GetDecimal(4));
        Assert.Equal(0L, reader.GetInt64(5));
        Assert.Equal(0L, reader.GetInt64(6));
    }

    private static async Task<SeedMatrix> SeedMatrixAsync(AppDbContext context)
    {
        var suffix = Guid.NewGuid().ToString("N");
        var owner = new Owner
        {
            Id = Guid.NewGuid(), Name = "HB08A2 owner", Phone = TestPhone("20"),
            EmergencyPhone = TestPhone("21"), CommissionRate = 10m, Status = "active",
            PasswordHash = "test-only-hash", CreatedAt = RecordedAt, UpdatedAt = RecordedAt
        };
        var project = new Project
        {
            Id = Guid.NewGuid(), Name = $"HB08A2 project {suffix}", IsActive = true,
            CreatedAt = RecordedAt, UpdatedAt = RecordedAt
        };
        var client = new Client
        {
            Id = Guid.NewGuid(), Name = "HB08A2 client", Phone = TestPhone("22"),
            PasswordHash = "test-only-hash", IsActive = true,
            CreatedAt = RecordedAt, UpdatedAt = RecordedAt
        };
        var admin = new AdminUser
        {
            Id = Guid.NewGuid(), Name = "HB08A2 admin", Email = $"hb08a2-{suffix}@example.test",
            PasswordHash = "test-only-hash",
            RoleTemplateId = Guid.Parse("10000000-0000-0000-0000-000000000001"),
            IsActive = true, CreatedAt = RecordedAt, UpdatedAt = RecordedAt
        };
        var units = Enumerable.Range(1, 3).Select(index => new Unit
        {
            Id = Guid.NewGuid(), OwnerId = owner.Id, ProjectId = project.Id,
            Name = $"HB08A2 unit {index} {suffix}", UnitType = "apartment",
            Bedrooms = 2, Bathrooms = 1, MaxGuests = 4, BasePricePerNight = 100m,
            IsActive = true, IsVisibleInPortfolio = true,
            CreatedAt = RecordedAt, UpdatedAt = RecordedAt
        }).ToArray();

        var ordinary = Booking(units[0], client, owner, 1_000m, false, "direct",
            new DateOnly(2025, 6, 10), new DateOnly(2025, 6, 12));
        var legacy = Booking(units[1], client, owner, 1_234.56m, true, "admin",
            new DateOnly(2025, 1, 10), new DateOnly(2025, 1, 12), "legacy_system");
        var external = Booking(units[2], client, owner, 2_000m, true, "admin",
            new DateOnly(2024, 12, 15), new DateOnly(2024, 12, 18), "external_platform");

        var ordinaryInvoice = Invoice(ordinary, 1_000m, "ORD");
        var historicalInvoice = Invoice(legacy, 1_000m, "HIST");
        var ordinaryPayment = Payment(ordinary, 400m, ordinaryInvoice.Id, false, RecordedAt, null);
        var historicalInvoicePayment = Payment(legacy, 400m, historicalInvoice.Id, false, RecordedAt, null);
        var ordinaryOrphanPayment = Payment(ordinary, 25m, null, false, RecordedAt, null);
        var historicalBookingOrdinaryOrphanPayment = Payment(legacy, 50m, null, false, RecordedAt, null);
        var evidence = Payment(
            legacy,
            700.25m,
            null,
            true,
            EvidenceDate.ToDateTime(new TimeOnly(12, 0)),
            admin.Id);

        context.AddRange(owner, project, client, admin);
        context.Units.AddRange(units);
        context.Bookings.AddRange(ordinary, legacy, external);
        context.Invoices.AddRange(ordinaryInvoice, historicalInvoice);
        context.Payments.AddRange(
            ordinaryPayment,
            historicalInvoicePayment,
            ordinaryOrphanPayment,
            historicalBookingOrdinaryOrphanPayment,
            evidence);
        await context.SaveChangesAsync();

        return new SeedMatrix(ordinary, legacy, external);
    }

    private static Booking Booking(
        Unit unit,
        Client client,
        Owner owner,
        decimal amount,
        bool historical,
        string source,
        DateOnly checkIn,
        DateOnly checkOut,
        string? originalSource = null) => new()
    {
        Id = Guid.NewGuid(), ClientId = client.Id, UnitId = unit.Id, OwnerId = owner.Id,
        BookingStatus = historical ? BookingStatus.Completed : BookingStatus.Confirmed,
        CheckInDate = checkIn, CheckOutDate = checkOut, GuestCount = 2,
        BaseAmount = amount, FinalAmount = amount, AgreedAmount = historical ? amount : null,
        Source = source, IsHistorical = historical,
        ActualBookedAt = historical ? checkIn.AddDays(-9) : null,
        HistoricalEntryReason = historical ? HistoricalEntryReasons.ExternalPlatformImport : null,
        OriginalSource = originalSource,
        CreatedAt = RecordedAt, UpdatedAt = RecordedAt
    };

    private static Invoice Invoice(Booking booking, decimal amount, string prefix) => new()
    {
        Id = Guid.NewGuid(), BookingId = booking.Id,
        InvoiceNumber = $"HB08A2-{prefix}-{Guid.NewGuid():N}", InvoiceStatus = "issued",
        SubtotalAmount = amount, TotalAmount = amount, IssuedAt = RecordedAt,
        CreatedAt = RecordedAt, UpdatedAt = RecordedAt
    };

    private static Payment Payment(
        Booking booking,
        decimal amount,
        Guid? invoiceId,
        bool historical,
        DateTime paidAt,
        Guid? adminId) => new()
    {
        Id = Guid.NewGuid(), BookingId = booking.Id, InvoiceId = invoiceId,
        PaymentStatus = "paid", PaymentMethod = "cash", Amount = amount,
        IsHistoricalRecord = historical, CreatedByAdminUserId = adminId,
        RecordedReason = historical ? "Verified historical evidence" : null,
        PaidAt = paidAt, CreatedAt = RecordedAt, UpdatedAt = RecordedAt
    };

    private static async Task<int> ColumnCountAsync(NpgsqlConnection connection, string viewName)
    {
        await using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT count(*)::int
            FROM information_schema.columns
            WHERE table_schema = current_schema() AND table_name = @view;
            """;
        command.Parameters.AddWithValue("view", viewName);
        return (int)(await command.ExecuteScalarAsync())!;
    }

    private static async Task<bool> ViewExistsAsync(NpgsqlConnection connection, string viewName)
    {
        await using var command = connection.CreateCommand();
        command.CommandText = "SELECT to_regclass(@view) IS NOT NULL;";
        command.Parameters.AddWithValue("view", viewName);
        return (bool)(await command.ExecuteScalarAsync())!;
    }

    private static string FindRepositoryRoot()
    {
        for (var directory = new DirectoryInfo(AppContext.BaseDirectory);
             directory is not null;
             directory = directory.Parent)
        {
            if (File.Exists(Path.Combine(directory.FullName, "RentalPlatform.slnx")))
                return directory.FullName;
        }

        throw new DirectoryNotFoundException("Could not locate RentalPlatform.slnx.");
    }

    private static string TestPhone(string prefix)
    {
        var value = BitConverter.ToUInt32(Guid.NewGuid().ToByteArray(), 0) % 10_000_000_000L;
        return $"+{prefix}{value:D10}";
    }

    private sealed record SeedMatrix(
        Booking Ordinary,
        Booking LegacyHistorical,
        Booking ExternalHistorical);
}
