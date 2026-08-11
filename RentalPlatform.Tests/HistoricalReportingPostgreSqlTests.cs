using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
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
    private static readonly DateTime RecordedAt = new(2026, 9, 20, 12, 0, 0, DateTimeKind.Utc);
    private static readonly DateOnly MixedStayDate = new(2025, 1, 10);
    private static readonly DateOnly EvidenceDate = new(2026, 3, 15);
    private readonly PostgreSqlFixture _fixture;

    public HistoricalReportingPostgreSqlTests(PostgreSqlFixture fixture) => _fixture = fixture;

    [Fact]
    public async Task RecordedStayAndReconciliationAxesPreserveHistoricalTruth()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        await using var context = database.CreateDbContext();
        var seed = await SeedMatrixAsync(context);
        var bookingLogger = new RecordingLogger<ReportingBookingAnalyticsService>();
        var financeLogger = new RecordingLogger<ReportingFinanceAnalyticsService>();
        var bookingService = new ReportingBookingAnalyticsService(
            new UnitOfWork(context), bookingLogger);
        var financeService = new ReportingFinanceAnalyticsService(
            new UnitOfWork(context), financeLogger);

        var recorded = await bookingService.GetDailySummaryAsync(
            DateOnly.FromDateTime(RecordedAt), DateOnly.FromDateTime(RecordedAt));
        var recordedAdmin = Assert.Single(recorded, row => row.BookingSource == "admin");
        Assert.Equal(seed.TotalBookings, recordedAdmin.BookingsCreatedCount);
        Assert.Equal(seed.HistoricalBookings, recordedAdmin.HistoricalBookingsCount);
        Assert.Equal(seed.HistoricalAgreedAmount, recordedAdmin.HistoricalAgreedAmount);
        Assert.Equal(1, recordedAdmin.HistoricalLegacySystemBookingsCount);
        Assert.Equal(1, recordedAdmin.HistoricalExternalPlatformBookingsCount);
        Assert.Equal(1, recordedAdmin.HistoricalOfflineRecordBookingsCount);
        Assert.Equal(2, recordedAdmin.HistoricalOtherSourceBookingsCount);
        Assert.Equal(
            recordedAdmin.HistoricalBookingsCount,
            recordedAdmin.HistoricalLegacySystemBookingsCount
                + recordedAdmin.HistoricalExternalPlatformBookingsCount
                + recordedAdmin.HistoricalOfflineRecordBookingsCount
                + recordedAdmin.HistoricalOtherSourceBookingsCount);

        var stayAll = await bookingService.GetStayDailySummaryAsync(MixedStayDate, MixedStayDate);
        var stayAllAdmin = Assert.Single(stayAll, row => row.BookingSource == "admin");
        Assert.Equal(seed.TotalBookings - 1, stayAllAdmin.StayBookingsCount);
        Assert.Equal(seed.HistoricalBookings, stayAllAdmin.HistoricalBookingsCount);
        Assert.Equal(1, stayAllAdmin.HistoricalLegacySystemBookingsCount);
        Assert.Equal(1, stayAllAdmin.HistoricalExternalPlatformBookingsCount);
        Assert.Equal(1, stayAllAdmin.HistoricalOfflineRecordBookingsCount);
        Assert.Equal(2, stayAllAdmin.HistoricalOtherSourceBookingsCount);

        var stayOrdinary = await bookingService.GetStayDailySummaryAsync(
            MixedStayDate, MixedStayDate, includeHistorical: false);
        var stayOrdinaryAdmin = Assert.Single(stayOrdinary, row => row.BookingSource == "admin");
        Assert.Equal(seed.OrdinaryBookings - 1, stayOrdinaryAdmin.StayBookingsCount);
        Assert.Equal(0, stayOrdinaryAdmin.HistoricalBookingsCount);

        var stayHistorical = await bookingService.GetStayDailySummaryAsync(
            MixedStayDate, MixedStayDate, includeHistorical: true, historicalOnly: true);
        var stayHistoricalAdmin = Assert.Single(stayHistorical, row => row.BookingSource == "admin");
        Assert.Equal(seed.HistoricalBookings, stayHistoricalAdmin.StayBookingsCount);
        Assert.Equal(seed.HistoricalAgreedAmount, stayHistoricalAdmin.TotalFinalAmount);
        Assert.Equal(stayAllAdmin.StayBookingsCount, stayOrdinaryAdmin.StayBookingsCount + stayHistoricalAdmin.StayBookingsCount);
        Assert.Equal(stayAllAdmin.TotalFinalAmount, stayOrdinaryAdmin.TotalFinalAmount + stayHistoricalAdmin.TotalFinalAmount);

        var recordedFinance = await financeService.GetDailySummaryAsync(
            DateOnly.FromDateTime(RecordedAt), DateOnly.FromDateTime(RecordedAt));
        var financeRecordedBucket = Assert.Single(recordedFinance);
        Assert.Equal(2, financeRecordedBucket.BookingsWithInvoiceCount);
        Assert.Equal(1, financeRecordedBucket.HistoricalBookingsWithInvoiceCount);
        Assert.Equal(2_000m, financeRecordedBucket.TotalInvoicedAmount);
        Assert.Equal(1_000m, financeRecordedBucket.HistoricalInvoicedAmount);
        Assert.Equal(800m, financeRecordedBucket.TotalPaidAmount);
        Assert.Equal(1_200m, financeRecordedBucket.TotalRemainingAmount);
        Assert.Equal(seed.HistoricalBookings, financeRecordedBucket.HistoricalBookingsCount);
        Assert.Equal(seed.HistoricalAgreedAmount, financeRecordedBucket.HistoricalAgreedAmount);
        Assert.Equal(2, financeRecordedBucket.OrdinaryUnlinkedPaidCount);
        Assert.Equal(75m, financeRecordedBucket.OrdinaryUnlinkedPaidAmount);
        Assert.Equal(2, financeRecordedBucket.HistoricalEvidenceRecordedCount);
        Assert.Equal(701.48m, financeRecordedBucket.HistoricalEvidenceRecordedAmount);

        var phantomEvidenceDate = await financeService.GetDailySummaryAsync(EvidenceDate, EvidenceDate);
        Assert.Empty(phantomEvidenceDate);

        var stayFinanceAll = Assert.Single(await financeService.GetStayDailySummaryAsync(MixedStayDate, MixedStayDate));
        var stayFinanceOrdinary = Assert.Single(await financeService.GetStayDailySummaryAsync(
            MixedStayDate, MixedStayDate, includeHistorical: false));
        var stayFinanceHistorical = Assert.Single(await financeService.GetStayDailySummaryAsync(
            MixedStayDate, MixedStayDate, includeHistorical: true, historicalOnly: true));

        Assert.Equal(2, stayFinanceAll.BookingsWithInvoiceCount);
        Assert.Equal(seed.TotalBookings - 1, stayFinanceAll.StayBookingsCount);
        Assert.Equal(1, stayFinanceAll.HistoricalBookingsWithInvoiceCount);
        Assert.Equal(2_000m, stayFinanceAll.TotalInvoicedAmount);
        Assert.Equal(1_000m, stayFinanceAll.HistoricalInvoicedAmount);
        Assert.Equal(seed.TotalFinalAmount, stayFinanceAll.TotalFinalAmount);
        Assert.Equal(seed.HistoricalAgreedAmount, stayFinanceAll.HistoricalAgreedAmount);
        Assert.Equal(1, stayFinanceOrdinary.BookingsWithInvoiceCount);
        Assert.Equal(seed.OrdinaryBookings - 1, stayFinanceOrdinary.StayBookingsCount);
        Assert.Equal(1_000m, stayFinanceOrdinary.TotalInvoicedAmount);
        Assert.Equal(seed.OrdinaryFinalAmount, stayFinanceOrdinary.TotalFinalAmount);
        Assert.Equal(1, stayFinanceHistorical.BookingsWithInvoiceCount);
        Assert.Equal(seed.HistoricalBookings, stayFinanceHistorical.StayBookingsCount);
        Assert.Equal(1_000m, stayFinanceHistorical.TotalInvoicedAmount);
        Assert.Equal(seed.HistoricalAgreedAmount, stayFinanceHistorical.TotalFinalAmount);
        Assert.Equal(
            stayFinanceAll.StayBookingsCount,
            stayFinanceOrdinary.StayBookingsCount + stayFinanceHistorical.StayBookingsCount);
        Assert.Equal(
            stayFinanceAll.BookingsWithInvoiceCount,
            stayFinanceOrdinary.BookingsWithInvoiceCount + stayFinanceHistorical.BookingsWithInvoiceCount);
        Assert.Equal(
            stayFinanceAll.TotalInvoicedAmount,
            stayFinanceOrdinary.TotalInvoicedAmount + stayFinanceHistorical.TotalInvoicedAmount);
        Assert.Equal(
            stayFinanceAll.TotalFinalAmount,
            stayFinanceOrdinary.TotalFinalAmount + stayFinanceHistorical.TotalFinalAmount);

        var reconciliation = await bookingService.GetHistoricalReconciliationAsync(
            new DateOnly(2025, 1, 1), new DateOnly(2025, 1, 1));
        Assert.Equal(seed.HistoricalBookings, reconciliation.Count);
        Assert.Equal(reconciliation.Count, reconciliation.Select(row => row.BookingId).Distinct().Count());
        var activeHistorical = Assert.Single(reconciliation, row => row.BookingId == seed.ActiveHistoricalId);
        Assert.Equal(DateOnly.FromDateTime(RecordedAt), activeHistorical.RecordedDate);
        Assert.Equal(RecordedAt, activeHistorical.RecordedAt);
        Assert.Equal(
            DateOnly.FromDateTime(RecordedAt).DayNumber - activeHistorical.ActualBookedAt.DayNumber,
            activeHistorical.EntryLagDays);
        Assert.Equal(1_000m, activeHistorical.InvoicedAmount);
        Assert.Equal(400m, activeHistorical.InvoiceLinkedPaidAmount);
        Assert.Equal(1, activeHistorical.OrdinaryUnlinkedPaidCount);
        Assert.Equal(50m, activeHistorical.OrdinaryUnlinkedPaidAmount);
        Assert.Equal(2, activeHistorical.HistoricalPaymentEvidenceCount);
        Assert.Equal(701.48m, activeHistorical.HistoricalPaymentEvidenceAmount);
        Assert.Equal(EvidenceDate, activeHistorical.FirstEvidencePaidDate);
        Assert.Equal(EvidenceDate.AddDays(1), activeHistorical.LastEvidencePaidDate);
        Assert.Equal(1, activeHistorical.OwnerAttributionCorrectionCount);
        Assert.NotNull(activeHistorical.LastOwnerAttributionCorrectedAt);
        Assert.Contains(bookingLogger.Messages, message =>
            message.StartsWith("reporting.historical.query", StringComparison.Ordinal));
        Assert.Contains(financeLogger.Messages, message =>
            message.StartsWith("reporting.historical.query", StringComparison.Ordinal));

        await AssertIndependentSqlAsync(database, seed);
    }

    [Fact]
    public async Task EntryLagAllowsTheCairoUtcMinusOneBoundaryWithFixedPersistedTime()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        await using var context = database.CreateDbContext();
        var seed = await SeedMatrixAsync(context);
        var boundaryCreatedAt = new DateTime(2026, 8, 9, 23, 30, 0, DateTimeKind.Utc);
        await context.Database.ExecuteSqlInterpolatedAsync(
            $"UPDATE bookings SET created_at = {boundaryCreatedAt} WHERE id = {seed.BoundaryHistoricalId}");
        context.ChangeTracker.Clear();

        var service = new ReportingBookingAnalyticsService(
            new UnitOfWork(context), NullLogger<ReportingBookingAnalyticsService>.Instance);
        var rows = await service.GetHistoricalReconciliationAsync(
            new DateOnly(2025, 1, 1), new DateOnly(2025, 1, 1));

        var boundary = Assert.Single(rows, row => row.BookingId == seed.BoundaryHistoricalId);
        Assert.Equal(boundaryCreatedAt, boundary.RecordedAt);
        Assert.Equal(new DateOnly(2026, 8, 10), boundary.ActualBookedAt);
        Assert.Equal(-1, boundary.EntryLagDays);
    }

    [Fact]
    public async Task OrdinaryZeroValueStayWithoutInvoiceRemainsVisibleInOrdinaryProjection()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        await using var context = database.CreateDbContext();
        await SeedMatrixAsync(context);
        var service = new ReportingFinanceAnalyticsService(
            new UnitOfWork(context), NullLogger<ReportingFinanceAnalyticsService>.Instance);
        var stayDate = MixedStayDate.AddDays(10);

        var row = Assert.Single(await service.GetStayDailySummaryAsync(
            stayDate, stayDate, includeHistorical: false));

        Assert.Equal(stayDate, row.StayStartDate);
        Assert.Equal(1, row.StayBookingsCount);
        Assert.Equal(0, row.BookingsWithInvoiceCount);
        Assert.Equal(0m, row.TotalInvoicedAmount);
        Assert.Equal(0m, row.TotalFinalAmount);
    }

    [Theory]
    [InlineData(OwnerPayoutStatus.Pending)]
    [InlineData(OwnerPayoutStatus.Scheduled)]
    [InlineData(OwnerPayoutStatus.Paid)]
    public async Task PayoutAmountsAreNotMultipliedByInvoiceFanOut(OwnerPayoutStatus status)
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        await using var context = database.CreateDbContext();
        var seed = await SeedMatrixAsync(context, status);
        var service = new ReportingFinanceAnalyticsService(
            new UnitOfWork(context), NullLogger<ReportingFinanceAnalyticsService>.Instance);

        var row = Assert.Single(await service.GetDailySummaryAsync(
            DateOnly.FromDateTime(RecordedAt), DateOnly.FromDateTime(RecordedAt)));

        Assert.Equal(status == OwnerPayoutStatus.Pending ? 4_500m : 0m, row.TotalPendingPayoutAmount);
        Assert.Equal(status == OwnerPayoutStatus.Scheduled ? 4_500m : 0m, row.TotalScheduledPayoutAmount);
        Assert.Equal(status == OwnerPayoutStatus.Paid ? 4_500m : 0m, row.TotalPaidPayoutAmount);
        Assert.Equal(2, await context.Invoices.CountAsync(invoice => invoice.BookingId == seed.ActiveHistoricalId));
    }

    [Fact]
    public async Task RecordedFinanceFrozenPrefixChangesOnlyTheRatifiedPayoutFanOutDefect()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        await using var context = database.CreateDbContext();
        await SeedMatrixAsync(context);
        var root = FindRepositoryRoot();
        var rollback = await File.ReadAllTextAsync(Path.Combine(root, "db", "migrations", "0063_add_historical_reporting_read_models_rollback.sql"));
        var migration = await File.ReadAllTextAsync(Path.Combine(root, "db", "migrations", "0063_add_historical_reporting_read_models.sql"));
        await using var connection = await database.OpenConnectionAsync();

        var corrected = await FinancePrefixAsync(connection);
        await PostgreSqlFixture.ExecuteMigrationSqlAsync(connection, rollback);
        var prior = await FinancePrefixAsync(connection);

        Assert.Equal(prior.BookingsWithInvoice, corrected.BookingsWithInvoice);
        Assert.Equal(prior.Invoiced, corrected.Invoiced);
        Assert.Equal(prior.Paid, corrected.Paid);
        Assert.Equal(prior.Remaining, corrected.Remaining);
        Assert.Equal(9_000m, prior.PendingPayout);
        Assert.Equal(4_500m, corrected.PendingPayout);
        Assert.Equal(prior.ScheduledPayout, corrected.ScheduledPayout);
        Assert.Equal(prior.PaidPayout, corrected.PaidPayout);

        await PostgreSqlFixture.ExecuteMigrationSqlAsync(connection, migration);
    }

    [Fact]
    public async Task RepresentativeReportingPlansExecuteWithoutAdditionalIndexes()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        await using var context = database.CreateDbContext();
        await SeedMatrixAsync(context);
        await using var connection = await database.OpenConnectionAsync();

        foreach (var query in new[]
                 {
                     "SELECT * FROM reporting_booking_stay_daily_summary WHERE stay_start_date BETWEEN DATE '2025-01-01' AND DATE '2025-01-31'",
                     "SELECT * FROM reporting_finance_stay_daily_summary WHERE stay_start_date BETWEEN DATE '2025-01-01' AND DATE '2025-01-31'",
                     "SELECT * FROM reporting_historical_entry_reconciliation WHERE stay_start_date BETWEEN DATE '2025-01-01' AND DATE '2025-01-31'",
                     "SELECT * FROM reporting_finance_daily_summary WHERE metric_date BETWEEN DATE '2026-09-01' AND DATE '2026-09-30'"
                 })
        {
            await using var command = connection.CreateCommand();
            command.CommandText = $"EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) {query};";
            await using var reader = await command.ExecuteReaderAsync();
            var plan = new List<string>();
            while (await reader.ReadAsync()) plan.Add(reader.GetString(0));
            Assert.Contains(plan, line => line.Contains("Execution Time", StringComparison.Ordinal));
        }
    }

    [Fact]
    public async Task MigrationVerifierRollbackAndReapplyPreserveThePriorViewContractAndData()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        await using var context = database.CreateDbContext();
        var seed = await SeedMatrixAsync(context);
        var before = await DataCountsAsync(context);
        var root = FindRepositoryRoot();
        var migration = await File.ReadAllTextAsync(Path.Combine(root, "db", "migrations", "0063_add_historical_reporting_read_models.sql"));
        var verifier = await File.ReadAllTextAsync(Path.Combine(root, "db", "migrations", "0063_add_historical_reporting_read_models_verify.sql"));
        var rollback = await File.ReadAllTextAsync(Path.Combine(root, "db", "migrations", "0063_add_historical_reporting_read_models_rollback.sql"));

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
        Assert.Equal(14, await ColumnCountAsync(connection, "reporting_booking_daily_summary"));
        Assert.Equal(14, await ColumnCountAsync(connection, "reporting_booking_stay_daily_summary"));
        Assert.Equal(16, await ColumnCountAsync(connection, "reporting_finance_daily_summary"));
        Assert.Equal(9, await ColumnCountAsync(connection, "reporting_finance_stay_daily_summary"));
        Assert.Equal(25, await ColumnCountAsync(connection, "reporting_historical_entry_reconciliation"));

        await using var afterContext = database.CreateDbContext();
        Assert.Equal(before, await DataCountsAsync(afterContext));
        Assert.Contains(await afterContext.Bookings.Select(booking => booking.Id).ToListAsync(), id => id == seed.ActiveHistoricalId);
    }

    [Theory]
    [InlineData("extra-recorded-booking-status")]
    [InlineData("missing-stay-provenance")]
    [InlineData("extra-recorded-finance-historical-paid")]
    [InlineData("stay-finance-wrong-second-column")]
    [InlineData("reconciliation-without-recorded-date")]
    [InlineData("reconciliation-wrong-agreed-precision")]
    [InlineData("wrong-provenance-remainder")]
    [InlineData("duplicate-reconciliation-grain")]
    [InlineData("phantom-evidence-date")]
    [InlineData("historical-evidence-in-settlement")]
    [InlineData("entry-lag-below-minus-one")]
    public async Task MigrationVerifierRejectsFinalContractMutations(string mutation)
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        await using var context = database.CreateDbContext();
        var seed = await SeedMatrixAsync(context);
        var root = FindRepositoryRoot();
        var verifier = await File.ReadAllTextAsync(Path.Combine(root, "db", "migrations", "0063_add_historical_reporting_read_models_verify.sql"));
        await using var connection = await database.OpenConnectionAsync();

        await ApplyVerifierMutationAsync(connection, mutation, seed);

        var failure = await Assert.ThrowsAnyAsync<Exception>(
            () => PostgreSqlFixture.ExecuteMigrationSqlAsync(connection, verifier));
        Assert.Contains("0063 verifier", failure.ToString(), StringComparison.OrdinalIgnoreCase);
    }

    private static async Task ApplyVerifierMutationAsync(
        NpgsqlConnection connection,
        string mutation,
        SeedMatrix seed)
    {
        var sql = mutation switch
        {
            "extra-recorded-booking-status" => """
                ALTER VIEW reporting_booking_daily_summary RENAME TO reporting_booking_daily_summary_base;
                CREATE VIEW reporting_booking_daily_summary AS
                SELECT *, 0::integer AS historical_completed_bookings_count
                FROM reporting_booking_daily_summary_base;
                """,
            "missing-stay-provenance" => """
                ALTER VIEW reporting_booking_stay_daily_summary RENAME TO reporting_booking_stay_daily_summary_base;
                CREATE VIEW reporting_booking_stay_daily_summary AS
                SELECT stay_start_date, booking_source, stay_bookings_count,
                       prospecting_bookings_count, confirmed_bookings_count,
                       cancelled_bookings_count, completed_bookings_count, total_final_amount,
                       historical_bookings_count, historical_agreed_amount,
                       historical_legacy_system_bookings_count,
                       historical_external_platform_bookings_count,
                       historical_offline_record_bookings_count
                FROM reporting_booking_stay_daily_summary_base;
                """,
            "extra-recorded-finance-historical-paid" => """
                ALTER VIEW reporting_finance_daily_summary RENAME TO reporting_finance_daily_summary_base;
                CREATE VIEW reporting_finance_daily_summary AS
                SELECT *, 0::numeric(14,2) AS historical_invoice_linked_paid_amount
                FROM reporting_finance_daily_summary_base;
                """,
            "stay-finance-wrong-second-column" => """
                ALTER VIEW reporting_finance_stay_daily_summary RENAME TO reporting_finance_stay_daily_summary_base;
                CREATE VIEW reporting_finance_stay_daily_summary AS
                SELECT stay_start_date, 'admin'::varchar(50) AS booking_source,
                       bookings_with_invoice_count, total_invoiced_amount, total_final_amount,
                       historical_bookings_count, historical_agreed_amount,
                       historical_bookings_with_invoice_count, historical_invoiced_amount
                FROM reporting_finance_stay_daily_summary_base;
                """,
            "reconciliation-without-recorded-date" => """
                ALTER VIEW reporting_historical_entry_reconciliation RENAME TO reporting_historical_entry_reconciliation_base;
                CREATE VIEW reporting_historical_entry_reconciliation AS
                SELECT booking_id, recorded_at, actual_booked_at, entry_lag_days,
                       stay_start_date, stay_end_date, stay_nights, booking_source, original_source,
                       historical_entry_reason, booking_status, unit_id, owner_id, agreed_amount,
                       invoiced_amount, invoice_linked_paid_amount, ordinary_unlinked_paid_count,
                       ordinary_unlinked_paid_amount, historical_payment_evidence_count,
                       historical_payment_evidence_amount, first_evidence_paid_date,
                       last_evidence_paid_date, owner_attribution_correction_count,
                       last_owner_attribution_corrected_at
                FROM reporting_historical_entry_reconciliation_base;
                """,
            "reconciliation-wrong-agreed-precision" => """
                ALTER VIEW reporting_historical_entry_reconciliation RENAME TO reporting_historical_entry_reconciliation_base;
                CREATE VIEW reporting_historical_entry_reconciliation AS
                SELECT booking_id, recorded_date, recorded_at, actual_booked_at, entry_lag_days,
                       stay_start_date, stay_end_date, stay_nights, booking_source, original_source,
                       historical_entry_reason, booking_status, unit_id, owner_id,
                       agreed_amount::numeric(14,2) AS agreed_amount, invoiced_amount,
                       invoice_linked_paid_amount, ordinary_unlinked_paid_count,
                       ordinary_unlinked_paid_amount, historical_payment_evidence_count,
                       historical_payment_evidence_amount, first_evidence_paid_date,
                       last_evidence_paid_date, owner_attribution_correction_count,
                       last_owner_attribution_corrected_at
                FROM reporting_historical_entry_reconciliation_base;
                """,
            "wrong-provenance-remainder" => """
                ALTER VIEW reporting_booking_daily_summary RENAME TO reporting_booking_daily_summary_base;
                CREATE VIEW reporting_booking_daily_summary AS
                SELECT metric_date, booking_source, bookings_created_count,
                       prospecting_bookings_count, confirmed_bookings_count,
                       cancelled_bookings_count, completed_bookings_count, total_final_amount,
                       historical_bookings_count, historical_agreed_amount,
                       historical_legacy_system_bookings_count,
                       historical_external_platform_bookings_count,
                       historical_offline_record_bookings_count,
                       0::integer AS historical_other_source_bookings_count
                FROM reporting_booking_daily_summary_base;
                """,
            "duplicate-reconciliation-grain" => """
                ALTER VIEW reporting_historical_entry_reconciliation RENAME TO reporting_historical_entry_reconciliation_base;
                CREATE VIEW reporting_historical_entry_reconciliation AS
                SELECT * FROM reporting_historical_entry_reconciliation_base
                UNION ALL
                SELECT * FROM reporting_historical_entry_reconciliation_base;
                """,
            "phantom-evidence-date" => """
                ALTER VIEW reporting_finance_daily_summary RENAME TO reporting_finance_daily_summary_base;
                CREATE VIEW reporting_finance_daily_summary AS
                SELECT * FROM reporting_finance_daily_summary_base
                UNION ALL
                SELECT DATE(p.paid_at), 0::integer, 0::numeric(14,2), 0::numeric(14,2),
                       0::numeric(14,2), 0::numeric(14,2), 0::numeric(14,2),
                       0::numeric(14,2), 0::integer, 0::numeric(14,2), 0::integer,
                       0::numeric(14,2), 0::integer, 0::numeric(14,2), count(*)::integer,
                       sum(p.amount)::numeric(14,2)
                FROM payments p
                WHERE p.is_historical_record AND p.invoice_id IS NULL AND p.payment_status = 'paid'
                GROUP BY DATE(p.paid_at);
                """,
            "historical-evidence-in-settlement" => """
                ALTER VIEW reporting_finance_daily_summary RENAME TO reporting_finance_daily_summary_base;
                CREATE VIEW reporting_finance_daily_summary AS
                SELECT metric_date, bookings_with_invoice_count, total_invoiced_amount,
                       (total_paid_amount + historical_evidence_recorded_amount)::numeric(14,2)
                           AS total_paid_amount,
                       (total_remaining_amount - historical_evidence_recorded_amount)::numeric(14,2)
                           AS total_remaining_amount,
                       total_pending_payout_amount, total_scheduled_payout_amount,
                       total_paid_payout_amount, historical_bookings_count,
                       historical_agreed_amount, historical_bookings_with_invoice_count,
                       historical_invoiced_amount, ordinary_unlinked_paid_count,
                       ordinary_unlinked_paid_amount, historical_evidence_recorded_count,
                       historical_evidence_recorded_amount
                FROM reporting_finance_daily_summary_base;
                """,
            "entry-lag-below-minus-one" =>
                $"UPDATE bookings SET created_at = actual_booked_at::timestamp - INTERVAL '2 days' WHERE id = '{seed.BoundaryHistoricalId}';",
            _ => throw new ArgumentOutOfRangeException(nameof(mutation), mutation, null)
        };

        await PostgreSqlFixture.ExecuteMigrationSqlAsync(connection, sql);
    }

    private static async Task AssertIndependentSqlAsync(PostgreSqlTestDatabase database, SeedMatrix seed)
    {
        await using var connection = await database.OpenConnectionAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT
              (SELECT count(*) FROM bookings),
              (SELECT count(*) FROM bookings WHERE is_historical),
              (SELECT count(*) FROM reporting_historical_entry_reconciliation),
              (SELECT count(DISTINCT booking_id) FROM reporting_historical_entry_reconciliation),
              (SELECT COALESCE(sum(amount), 0) FROM payments
               WHERE is_historical_record AND invoice_id IS NULL AND payment_status = 'paid'),
              (SELECT COALESCE(sum(amount), 0) FROM payments
               WHERE NOT is_historical_record AND invoice_id IS NULL AND payment_status = 'paid'),
              (SELECT count(*) FROM reporting_finance_daily_summary WHERE metric_date = @evidence_date),
              (SELECT total_pending_payout_amount FROM reporting_finance_daily_summary
               WHERE metric_date = @recorded_date),
              (SELECT count(*) FROM invoices
               WHERE booking_id = @cancelled_booking
                 AND invoice_status NOT IN ('cancelled', 'superseded')),
              (SELECT sum(bookings_created_count) FROM reporting_booking_daily_summary),
              (SELECT sum(stay_bookings_count) FROM reporting_booking_stay_daily_summary),
              (SELECT sum(historical_bookings_count) FROM reporting_booking_daily_summary),
              (SELECT sum(historical_bookings_count) FROM reporting_booking_stay_daily_summary),
              (SELECT sum(historical_agreed_amount) FROM reporting_booking_daily_summary),
              (SELECT sum(historical_agreed_amount) FROM reporting_finance_stay_daily_summary);
            """;
        command.Parameters.AddWithValue("evidence_date", EvidenceDate);
        command.Parameters.AddWithValue("recorded_date", DateOnly.FromDateTime(RecordedAt));
        command.Parameters.AddWithValue("cancelled_booking", seed.CancelledInvoiceHistoricalId);
        await using var reader = await command.ExecuteReaderAsync();
        Assert.True(await reader.ReadAsync());
        Assert.Equal(seed.TotalBookings, reader.GetInt64(0));
        Assert.Equal(seed.HistoricalBookings, reader.GetInt64(1));
        Assert.Equal(seed.HistoricalBookings, reader.GetInt64(2));
        Assert.Equal(seed.HistoricalBookings, reader.GetInt64(3));
        Assert.Equal(701.48m, reader.GetDecimal(4));
        Assert.Equal(75m, reader.GetDecimal(5));
        Assert.Equal(0L, reader.GetInt64(6));
        Assert.Equal(4_500m, reader.GetDecimal(7));
        Assert.Equal(0L, reader.GetInt64(8));
        Assert.Equal(reader.GetInt64(9), reader.GetInt64(10));
        Assert.Equal(seed.TotalBookings, reader.GetInt64(9));
        Assert.Equal(reader.GetInt64(11), reader.GetInt64(12));
        Assert.Equal(seed.HistoricalBookings, reader.GetInt64(11));
        Assert.Equal(reader.GetDecimal(13), reader.GetDecimal(14));
        Assert.Equal(seed.HistoricalAgreedAmount, reader.GetDecimal(13));
    }

    private static async Task<SeedMatrix> SeedMatrixAsync(
        AppDbContext context,
        OwnerPayoutStatus payoutStatus = OwnerPayoutStatus.Pending)
    {
        var suffix = Guid.NewGuid().ToString("N");
        var owner = Owner("20");
        var targetOwner = Owner("21");
        var project = new Project { Id = Guid.NewGuid(), Name = $"HB08A2 {suffix}", IsActive = true, CreatedAt = RecordedAt, UpdatedAt = RecordedAt };
        var client = new Client { Id = Guid.NewGuid(), Name = "HB08A2 client", Phone = TestPhone("22"), PasswordHash = "test", IsActive = true, CreatedAt = RecordedAt, UpdatedAt = RecordedAt };
        var admin = new AdminUser { Id = Guid.NewGuid(), Name = "HB08A2 admin", Email = $"hb08a2-{suffix}@example.test", PasswordHash = "test", RoleTemplateId = Guid.Parse("10000000-0000-0000-0000-000000000001"), IsActive = true, CreatedAt = RecordedAt, UpdatedAt = RecordedAt };
        var units = Enumerable.Range(1, 8).Select(index => new Unit
        {
            Id = Guid.NewGuid(), OwnerId = owner.Id, ProjectId = project.Id,
            Name = $"HB08A2 unit {index} {suffix}", UnitType = "apartment", Bedrooms = 2,
            Bathrooms = 1, MaxGuests = 4, BasePricePerNight = 100m, IsActive = true,
            IsVisibleInPortfolio = true, CreatedAt = RecordedAt, UpdatedAt = RecordedAt
        }).ToArray();

        await context.Database.ExecuteSqlRawAsync("""
            INSERT INTO booking_original_sources (code, label, is_active, created_at, updated_at)
            VALUES ('channel_manager', 'Channel manager', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT (code) DO NOTHING;
            """);

        var ordinaryInvoiced = Booking(units[0], client, owner, 1_000m, false, null);
        var ordinaryNoInvoice = Booking(units[1], client, owner, 200m, false, null);
        var historicalActive = Booking(units[2], client, owner, 1_200m, true, "legacy_system");
        var historicalNoInvoice = Booking(units[3], client, owner, 800m, true, "external_platform");
        var historicalCancelledInvoice = Booking(units[4], client, owner, 600m, true, "offline_record");
        var historicalOther = Booking(units[5], client, owner, 400m, true, "other");
        var boundaryHistorical = Booking(units[6], client, owner, 300m, true, "channel_manager");
        boundaryHistorical.ActualBookedAt = new DateOnly(2026, 8, 10);
        var ordinaryZeroNoInvoice = Booking(units[7], client, owner, 0m, false, null);
        ordinaryZeroNoInvoice.CheckInDate = MixedStayDate.AddDays(10);
        ordinaryZeroNoInvoice.CheckOutDate = MixedStayDate.AddDays(12);
        var bookings = new[] { ordinaryInvoiced, ordinaryNoInvoice, historicalActive, historicalNoInvoice, historicalCancelledInvoice, historicalOther, boundaryHistorical, ordinaryZeroNoInvoice };

        var ordinaryInvoice = Invoice(ordinaryInvoiced, 1_000m, "ORD", "issued");
        var historicalInvoiceOne = Invoice(historicalActive, 700m, "H1", "issued");
        var historicalInvoiceTwo = Invoice(historicalActive, 300m, "H2", "draft");
        var cancelledInvoice = Invoice(historicalCancelledInvoice, 500m, "HC", "cancelled");
        var supersededInvoice = Invoice(historicalCancelledInvoice, 250m, "HS", "superseded");

        context.AddRange(owner, targetOwner, project, client, admin);
        context.Units.AddRange(units);
        context.Bookings.AddRange(bookings);
        context.Invoices.AddRange(ordinaryInvoice, historicalInvoiceOne, historicalInvoiceTwo, cancelledInvoice, supersededInvoice);
        context.Payments.AddRange(
            Payment(ordinaryInvoiced, 400m, ordinaryInvoice.Id, false, RecordedAt, null),
            Payment(historicalActive, 400m, historicalInvoiceOne.Id, false, RecordedAt, null),
            Payment(ordinaryInvoiced, 25m, null, false, RecordedAt, null),
            Payment(historicalActive, 50m, null, false, RecordedAt, null),
            Payment(historicalActive, 700.25m, null, true, EvidenceDate.ToDateTime(new TimeOnly(12, 0)), admin.Id),
            Payment(historicalActive, 1.23m, null, true, EvidenceDate.AddDays(1).ToDateTime(new TimeOnly(12, 0)), admin.Id));
        context.OwnerPayouts.Add(new OwnerPayout
        {
            Id = Guid.NewGuid(), BookingId = historicalActive.Id, OwnerId = owner.Id,
            PayoutStatus = payoutStatus, GrossBookingAmount = 5_000m,
            CommissionRate = 10m, CommissionAmount = 500m, PayoutAmount = 4_500m,
            CreatedAt = RecordedAt, UpdatedAt = RecordedAt
        });
        context.HistoricalOwnerAttributionCorrections.Add(new HistoricalOwnerAttributionCorrection
        {
            Id = Guid.NewGuid(), BookingId = historicalActive.Id, PreviousOwnerId = owner.Id,
            TargetOwnerId = targetOwner.Id, CorrectedByAdminUserId = admin.Id,
            Reason = "accounting_reconciliation", CorrectedAt = RecordedAt.AddHours(1)
        });
        await context.SaveChangesAsync();

        foreach (var booking in bookings)
        {
            await context.Database.ExecuteSqlInterpolatedAsync(
                $"UPDATE bookings SET created_at = {RecordedAt}, updated_at = {RecordedAt} WHERE id = {booking.Id}");
        }
        context.ChangeTracker.Clear();

        return new SeedMatrix(
            bookings.Length,
            bookings.Count(booking => booking.IsHistorical),
            ordinaryInvoiced.FinalAmount + ordinaryNoInvoice.FinalAmount,
            bookings.Sum(booking => booking.FinalAmount),
            bookings.Where(booking => booking.IsHistorical).Sum(booking => booking.AgreedAmount ?? 0m),
            historicalActive.Id,
            historicalCancelledInvoice.Id,
            boundaryHistorical.Id);
    }

    private static Owner Owner(string prefix) => new()
    {
        Id = Guid.NewGuid(), Name = $"HB08A2 owner {prefix}", Phone = TestPhone(prefix),
        EmergencyPhone = TestPhone($"{prefix}9"), CommissionRate = 10m, Status = "active",
        PasswordHash = "test", CreatedAt = RecordedAt, UpdatedAt = RecordedAt
    };

    private static Booking Booking(Unit unit, Client client, Owner owner, decimal amount, bool historical, string? originalSource) => new()
    {
        Id = Guid.NewGuid(), ClientId = client.Id, UnitId = unit.Id, OwnerId = owner.Id,
        BookingStatus = historical ? BookingStatus.Completed : BookingStatus.Confirmed,
        CheckInDate = MixedStayDate, CheckOutDate = MixedStayDate.AddDays(2), GuestCount = 2,
        BaseAmount = amount, FinalAmount = amount, AgreedAmount = historical ? amount : null,
        Source = "admin", IsHistorical = historical,
        ActualBookedAt = historical ? new DateOnly(2025, 1, 1) : null,
        HistoricalEntryReason = historical ? HistoricalEntryReasons.ExternalPlatformImport : null,
        OriginalSource = originalSource, CreatedAt = RecordedAt, UpdatedAt = RecordedAt
    };

    private static Invoice Invoice(Booking booking, decimal amount, string prefix, string status) => new()
    {
        Id = Guid.NewGuid(), BookingId = booking.Id, InvoiceNumber = $"HB08A2-{prefix}-{Guid.NewGuid():N}",
        InvoiceStatus = status, SubtotalAmount = amount, TotalAmount = amount, IssuedAt = RecordedAt,
        CreatedAt = RecordedAt, UpdatedAt = RecordedAt
    };

    private static Payment Payment(Booking booking, decimal amount, Guid? invoiceId, bool historical, DateTime paidAt, Guid? adminId) => new()
    {
        Id = Guid.NewGuid(), BookingId = booking.Id, InvoiceId = invoiceId,
        PaymentStatus = "paid", PaymentMethod = "cash", Amount = amount,
        IsHistoricalRecord = historical, CreatedByAdminUserId = adminId,
        RecordedReason = historical ? "Verified historical evidence" : null,
        PaidAt = paidAt, CreatedAt = RecordedAt, UpdatedAt = RecordedAt
    };

    private static async Task<(int Bookings, int Payments, int Invoices, int Payouts, int Corrections)> DataCountsAsync(AppDbContext context) =>
        (await context.Bookings.CountAsync(), await context.Payments.CountAsync(),
         await context.Invoices.CountAsync(), await context.OwnerPayouts.CountAsync(),
         await context.HistoricalOwnerAttributionCorrections.CountAsync());

    private static async Task<int> ColumnCountAsync(NpgsqlConnection connection, string viewName)
    {
        await using var command = connection.CreateCommand();
        command.CommandText = "SELECT count(*)::int FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = @view;";
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

    private static async Task<FinancePrefix> FinancePrefixAsync(NpgsqlConnection connection)
    {
        await using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT bookings_with_invoice_count, total_invoiced_amount, total_paid_amount,
                   total_remaining_amount, total_pending_payout_amount,
                   total_scheduled_payout_amount, total_paid_payout_amount
            FROM reporting_finance_daily_summary
            WHERE metric_date = @recorded_date;
            """;
        command.Parameters.AddWithValue("recorded_date", DateOnly.FromDateTime(RecordedAt));
        await using var reader = await command.ExecuteReaderAsync();
        Assert.True(await reader.ReadAsync());
        return new FinancePrefix(
            reader.GetInt32(0), reader.GetDecimal(1), reader.GetDecimal(2), reader.GetDecimal(3),
            reader.GetDecimal(4), reader.GetDecimal(5), reader.GetDecimal(6));
    }

    private static string FindRepositoryRoot()
    {
        for (var directory = new DirectoryInfo(AppContext.BaseDirectory); directory is not null; directory = directory.Parent)
        {
            if (File.Exists(Path.Combine(directory.FullName, "RentalPlatform.slnx"))) return directory.FullName;
        }
        throw new DirectoryNotFoundException("Could not locate RentalPlatform.slnx.");
    }

    private static string TestPhone(string prefix)
    {
        var value = BitConverter.ToUInt32(Guid.NewGuid().ToByteArray(), 0) % 10_000_000_000L;
        return $"+{prefix}{value:D10}";
    }

    private sealed record SeedMatrix(
        int TotalBookings,
        int HistoricalBookings,
        decimal OrdinaryFinalAmount,
        decimal TotalFinalAmount,
        decimal HistoricalAgreedAmount,
        Guid ActiveHistoricalId,
        Guid CancelledInvoiceHistoricalId,
        Guid BoundaryHistoricalId)
    {
        public int OrdinaryBookings => TotalBookings - HistoricalBookings;
    }

    private sealed record FinancePrefix(
        int BookingsWithInvoice,
        decimal Invoiced,
        decimal Paid,
        decimal Remaining,
        decimal PendingPayout,
        decimal ScheduledPayout,
        decimal PaidPayout);

    private sealed class RecordingLogger<T> : Microsoft.Extensions.Logging.ILogger<T>
    {
        public List<string> Messages { get; } = [];

        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
        public bool IsEnabled(LogLevel logLevel) => true;

        public void Log<TState>(
            LogLevel logLevel,
            EventId eventId,
            TState state,
            Exception? exception,
            Func<TState, Exception?, string> formatter) =>
            Messages.Add(formatter(state, exception));
    }
}
