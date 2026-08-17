using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
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
public sealed class HistoricalPaymentReportingPostgreSqlTests
{
    private static readonly DateTime RecordedAt =
        new(2026, 8, 5, 12, 0, 0, DateTimeKind.Utc);
    private static readonly DateTime EvidencePaidAt =
        new(2026, 2, 5, 12, 0, 0, DateTimeKind.Utc);
    private readonly PostgreSqlFixture _fixture;

    public HistoricalPaymentReportingPostgreSqlTests(PostgreSqlFixture fixture)
    {
        _fixture = fixture;
    }

    public static TheoryData<decimal, decimal, decimal, decimal, bool> SettlementCases => new()
    {
        { 4_000m, 0m, 4_000m, 6_000m, false },
        { 0m, 10_000m, 0m, 10_000m, false },
        { 4_000m, 7_000m, 4_000m, 6_000m, false },
        { 10_000m, 3_000m, 10_000m, 0m, true }
    };

    [Theory]
    [MemberData(nameof(SettlementCases))]
    public async Task InvoiceAndBookingSettlementKeepHistoricalEvidenceSeparate(
        decimal ordinaryPaid,
        decimal historicalEvidence,
        decimal expectedPaid,
        decimal expectedRemaining,
        bool expectedFullyPaid)
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        Guid bookingId;
        Guid invoiceId;

        await using (var context = database.CreateDbContext())
        {
            var seed = await SeedHistoricalBookingAsync(context, 10_000m, RecordedAt);
            bookingId = seed.Booking.Id;
            var invoice = AddInvoice(context, seed.Booking, 10_000m);
            invoiceId = invoice.Id;

            if (ordinaryPaid > 0)
            {
                // Preserve the established pre-invoice/orphan settlement contract in one case.
                Guid? ordinaryInvoiceId = ordinaryPaid == 4_000m ? null : invoice.Id;
                context.Payments.Add(OrdinaryPayment(seed.Booking, ordinaryPaid, ordinaryInvoiceId));
            }

            if (historicalEvidence > 0)
                context.Payments.Add(HistoricalEvidence(seed, historicalEvidence, EvidencePaidAt));

            await context.SaveChangesAsync();

            var finance = new FinanceSummaryService(new UnitOfWork(context));
            var invoiceBalance = await finance.GetInvoiceBalanceAsync(invoice.Id);
            var bookingSnapshot = await finance.GetBookingFinanceSnapshotAsync(seed.Booking.Id);

            Assert.Equal(expectedPaid, invoiceBalance.PaidAmount);
            Assert.Equal(expectedRemaining, invoiceBalance.RemainingAmount);
            Assert.Equal(expectedFullyPaid, invoiceBalance.IsFullyPaid);
            Assert.Equal(historicalEvidence > 0 ? 1 : 0, invoiceBalance.HistoricalPaymentEvidenceCount);
            Assert.Equal(historicalEvidence, invoiceBalance.HistoricalPaymentEvidenceAmount);

            Assert.Equal(expectedPaid, bookingSnapshot.PaidAmount);
            Assert.Equal(expectedRemaining, bookingSnapshot.RemainingAmount);
            Assert.Equal(historicalEvidence > 0 ? 1 : 0, bookingSnapshot.HistoricalPaymentEvidenceCount);
            Assert.Equal(historicalEvidence, bookingSnapshot.HistoricalPaymentEvidenceAmount);
        }

        await using var verify = database.CreateDbContext();
        var persistedInvoice = await verify.Invoices.AsNoTracking().SingleAsync(item => item.Id == invoiceId);
        Assert.Equal("issued", persistedInvoice.InvoiceStatus);
        Assert.Equal(10_000m, persistedInvoice.TotalAmount);
        Assert.Equal(historicalEvidence, await verify.Payments
            .Where(payment => payment.BookingId == bookingId && payment.IsHistoricalRecord)
            .SumAsync(payment => payment.Amount));
        Assert.False(await verify.Payments.AnyAsync(payment =>
            payment.BookingId == bookingId && payment.IsHistoricalRecord && payment.InvoiceId != null));
        Assert.False(await verify.OwnerPayouts.AnyAsync(payout => payout.BookingId == bookingId));
    }

    [Fact]
    public async Task NoInvoiceDoesNotManufactureSettlementAndEvidenceRemainsReportable()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        await using var context = database.CreateDbContext();
        var seed = await SeedHistoricalBookingAsync(context, 10_000m, RecordedAt);
        context.Payments.Add(HistoricalEvidence(seed, 10_000m, EvidencePaidAt));
        await context.SaveChangesAsync();

        var finance = new FinanceSummaryService(new UnitOfWork(context));
        var snapshot = await finance.GetBookingFinanceSnapshotAsync(seed.Booking.Id);
        var reporting = ReportingService(context);
        var evidencePeriod = await reporting.GetSummaryAsync(
            DateOnly.FromDateTime(EvidencePaidAt),
            DateOnly.FromDateTime(EvidencePaidAt));

        Assert.Null(snapshot.InvoiceId);
        Assert.Equal(0m, snapshot.InvoicedAmount);
        Assert.Equal(0m, snapshot.PaidAmount);
        Assert.Equal(0m, snapshot.RemainingAmount);
        Assert.Equal(1, snapshot.HistoricalPaymentEvidenceCount);
        Assert.Equal(10_000m, snapshot.HistoricalPaymentEvidenceAmount);
        Assert.Equal(0m, evidencePeriod.TotalPaidAmount);
        Assert.Equal(0m, evidencePeriod.TotalInvoicedAmount);
        Assert.Equal(0m, evidencePeriod.TotalRemainingAmount);
        Assert.Equal(1, evidencePeriod.HistoricalPaymentEvidenceCount);
        Assert.Equal(10_000m, evidencePeriod.HistoricalPaymentEvidenceAmount);
        Assert.False(await context.Invoices.AnyAsync(item => item.BookingId == seed.Booking.Id));
        Assert.False(await context.OwnerPayouts.AnyAsync(item => item.BookingId == seed.Booking.Id));
    }

    [Fact]
    public async Task FinanceOverviewUsesBookingDateForOrdinaryTruthAndPaidAtForEvidence()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        await using var context = database.CreateDbContext();
        var seed = await SeedHistoricalBookingAsync(context, 10_000m, RecordedAt);
        AddInvoice(context, seed.Booking, 10_000m);
        context.Payments.AddRange(
            OrdinaryPayment(seed.Booking, 4_000m, null, RecordedAt),
            HistoricalEvidence(seed, 7_000m, EvidencePaidAt));
        await context.SaveChangesAsync();

        var reporting = ReportingService(context);
        var recordedPeriod = await reporting.GetSummaryAsync(
            new DateOnly(2026, 8, 1),
            new DateOnly(2026, 8, 31));
        var evidencePeriod = await reporting.GetSummaryAsync(
            new DateOnly(2026, 2, 1),
            new DateOnly(2026, 2, 28));

        Assert.Equal(10_000m, recordedPeriod.TotalInvoicedAmount);
        Assert.Equal(4_000m, recordedPeriod.TotalPaidAmount);
        Assert.Equal(6_000m, recordedPeriod.TotalRemainingAmount);
        Assert.Equal(0, recordedPeriod.HistoricalPaymentEvidenceCount);
        Assert.Equal(0m, recordedPeriod.HistoricalPaymentEvidenceAmount);

        Assert.Equal(0m, evidencePeriod.TotalInvoicedAmount);
        Assert.Equal(0m, evidencePeriod.TotalPaidAmount);
        Assert.Equal(0m, evidencePeriod.TotalRemainingAmount);
        Assert.Equal(1, evidencePeriod.HistoricalPaymentEvidenceCount);
        Assert.Equal(7_000m, evidencePeriod.HistoricalPaymentEvidenceAmount);
    }

    private static ReportingFinanceAnalyticsService ReportingService(AppDbContext context) =>
        new(new UnitOfWork(context), NullLogger<ReportingFinanceAnalyticsService>.Instance);

    private static Invoice AddInvoice(AppDbContext context, Booking booking, decimal amount)
    {
        var invoice = new Invoice
        {
            Id = Guid.NewGuid(),
            BookingId = booking.Id,
            InvoiceNumber = $"HB08A-{Guid.NewGuid():N}",
            InvoiceStatus = "issued",
            SubtotalAmount = amount,
            TotalAmount = amount,
            IssuedAt = RecordedAt,
            CreatedAt = RecordedAt,
            UpdatedAt = RecordedAt
        };
        context.Invoices.Add(invoice);
        return invoice;
    }

    private static Payment OrdinaryPayment(
        Booking booking,
        decimal amount,
        Guid? invoiceId,
        DateTime? paidAt = null) => new()
    {
        Id = Guid.NewGuid(),
        BookingId = booking.Id,
        InvoiceId = invoiceId,
        PaymentStatus = "paid",
        PaymentMethod = "cash",
        Amount = amount,
        IsHistoricalRecord = false,
        PaidAt = paidAt ?? RecordedAt,
        CreatedAt = RecordedAt,
        UpdatedAt = RecordedAt
    };

    private static Payment HistoricalEvidence(SeededData seed, decimal amount, DateTime paidAt) => new()
    {
        Id = Guid.NewGuid(),
        BookingId = seed.Booking.Id,
        InvoiceId = null,
        PaymentStatus = "paid",
        PaymentMethod = "cash",
        Amount = amount,
        IsHistoricalRecord = true,
        CreatedByAdminUserId = seed.Admin.Id,
        RecordedReason = "Verified historical receipt",
        PaidAt = paidAt,
        CreatedAt = RecordedAt,
        UpdatedAt = RecordedAt
    };

    private static async Task<SeededData> SeedHistoricalBookingAsync(
        AppDbContext context,
        decimal agreedAmount,
        DateTime recordedAt)
    {
        var suffix = Guid.NewGuid().ToString("N");
        var owner = new Owner
        {
            Id = Guid.NewGuid(), Name = "HB08A test owner", Phone = TestPhone("20"),
            EmergencyPhone = TestPhone("21"), CommissionRate = 10m, Status = "active",
            PasswordHash = "test-only-hash", CreatedAt = recordedAt, UpdatedAt = recordedAt
        };
        var project = new Project
        {
            Id = Guid.NewGuid(), Name = $"HB08A test project {suffix}", IsActive = true,
            CreatedAt = recordedAt, UpdatedAt = recordedAt
        };
        var client = new Client
        {
            Id = Guid.NewGuid(), Name = "HB08A test client", Phone = TestPhone("22"),
            PasswordHash = "test-only-hash", IsActive = true,
            CreatedAt = recordedAt, UpdatedAt = recordedAt
        };
        var admin = new AdminUser
        {
            Id = Guid.NewGuid(), Name = "HB08A test admin",
            Email = $"hb08a-{suffix}@example.test", PasswordHash = "test-only-hash",
            RoleTemplateId = Guid.Parse("10000000-0000-0000-0000-000000000001"),
            IsActive = true, CreatedAt = recordedAt, UpdatedAt = recordedAt
        };
        var unit = new Unit
        {
            Id = Guid.NewGuid(), OwnerId = owner.Id, ProjectId = project.Id,
            Name = $"HB08A test unit {suffix}", UnitType = "apartment", Bedrooms = 2,
            Bathrooms = 1, MaxGuests = 4, BasePricePerNight = 100m,
            IsActive = true, IsVisibleInPortfolio = true,
            CreatedAt = recordedAt, UpdatedAt = recordedAt
        };
        var booking = new Booking
        {
            Id = Guid.NewGuid(), ClientId = client.Id, UnitId = unit.Id, OwnerId = owner.Id,
            BookingStatus = BookingStatus.Completed,
            CheckInDate = new DateOnly(2025, 1, 10), CheckOutDate = new DateOnly(2025, 1, 12),
            GuestCount = 2, BaseAmount = agreedAmount, FinalAmount = agreedAmount,
            AgreedAmount = agreedAmount, Source = "admin", IsHistorical = true,
            ActualBookedAt = new DateOnly(2025, 1, 1),
            HistoricalEntryReason = HistoricalEntryReasons.ExternalPlatformImport,
            OriginalSource = "legacy_system", CreatedAt = recordedAt, UpdatedAt = recordedAt
        };

        context.AddRange(owner, project, client, admin, unit, booking);
        await context.SaveChangesAsync();
        return new SeededData(admin, booking);
    }

    private static string TestPhone(string prefix)
    {
        var value = BitConverter.ToUInt32(Guid.NewGuid().ToByteArray(), 0) % 10_000_000_000L;
        return $"+{prefix}{value:D10}";
    }

    private sealed record SeededData(AdminUser Admin, Booking Booking);
}
