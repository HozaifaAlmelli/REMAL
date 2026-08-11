using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using RentalPlatform.Business.Exceptions;
using RentalPlatform.Business.Services;
using RentalPlatform.Data;
using RentalPlatform.Data.Entities;
using RentalPlatform.Shared.Enums;
using RentalPlatform.Tests.Infrastructure;
using Xunit;

namespace RentalPlatform.Tests;

[Collection(PostgreSqlTestCollection.Name)]
[Trait(TestCategories.Name, TestCategories.PostgreSql)]
public sealed class PaymentHistoricalEvidenceGuardPostgreSqlTests
{
    private static readonly DateTime RecordedAt = new(2026, 8, 11, 9, 0, 0, DateTimeKind.Utc);
    private static readonly DateTime EvidencePaidAt = new(2026, 2, 10, 8, 0, 0, DateTimeKind.Utc);
    private readonly PostgreSqlFixture _fixture;

    public PaymentHistoricalEvidenceGuardPostgreSqlTests(PostgreSqlFixture fixture)
    {
        _fixture = fixture;
    }

    [Fact]
    public Task EvidenceEqualToCapacityDoesNotBlockOrdinaryPayment() =>
        AssertEvidenceDoesNotConsumeCapacityAsync([10_000m]);

    [Fact]
    public Task EvidenceAboveCapacityDoesNotBlockOrdinaryPayment() =>
        AssertEvidenceDoesNotConsumeCapacityAsync([15_000m]);

    [Fact]
    public Task MultipleEvidenceRowsDoNotBlockOrdinaryPayment() =>
        AssertEvidenceDoesNotConsumeCapacityAsync([3_000m, 4_000m, 8_000m]);

    [Fact]
    public async Task OrdinaryPartialPaymentAndEvidenceAllowExactRemainingCapacity()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        await using var context = database.CreateDbContext();
        var seed = await SeedAsync(context, 10_000m);
        context.Payments.AddRange(
            OrdinaryPayment(seed, 4_000m, "paid", seed.Invoice.Id),
            HistoricalEvidence(seed, 7_000m));
        await context.SaveChangesAsync();

        var service = new PaymentService(new UnitOfWork(context));
        var payment = await service.CreateAsync(
            seed.Booking.Id, seed.Invoice.Id, "cash", 6_000m, null, "PAY-HIST-01 case C");
        await service.MarkPaidAsync(payment.Id, null, null);

        var conflict = await Assert.ThrowsAsync<ConflictException>(() => service.CreateAsync(
            seed.Booking.Id, seed.Invoice.Id, "cash", 0.01m, null, "real overpayment"));
        AssertCreateOverpaymentContract(conflict, seed.Booking.Id, 10_000m);
        await AssertFinanceTruthAsync(context, seed, 10_000m, 7_000m, true);
    }

    [Fact]
    public async Task OrdinaryUnlinkedPaymentStillConsumesCapacityWhileEvidenceDoesNot()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        await using var context = database.CreateDbContext();
        var seed = await SeedAsync(context, 10_000m);
        context.Payments.AddRange(
            OrdinaryPayment(seed, 4_000m, "paid", null),
            HistoricalEvidence(seed, 7_000m));
        await context.SaveChangesAsync();

        var service = new PaymentService(new UnitOfWork(context));
        var payment = await service.CreateAsync(
            seed.Booking.Id, seed.Invoice.Id, "cash", 6_000m, null, "PAY-HIST-01 case D");
        await service.MarkPaidAsync(payment.Id, null, null);

        var conflict = await Assert.ThrowsAsync<ConflictException>(() => service.CreateAsync(
            seed.Booking.Id, seed.Invoice.Id, "cash", 0.01m, null, "unlinked capacity proof"));
        AssertCreateOverpaymentContract(conflict, seed.Booking.Id, 10_000m);
        await AssertFinanceTruthAsync(context, seed, 10_000m, 7_000m, false);

        Assert.Equal(4_000m, await context.Payments
            .Where(paymentRow => paymentRow.BookingId == seed.Booking.Id
                && !paymentRow.IsHistoricalRecord
                && paymentRow.InvoiceId == null
                && paymentRow.PaymentStatus == "paid")
            .SumAsync(paymentRow => paymentRow.Amount));
    }

    [Fact]
    public async Task MixedLinkedUnlinkedAndEvidenceRowsUseOnlyOrdinarySettlementTruth()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        await using var context = database.CreateDbContext();
        var seed = await SeedAsync(context, 10_000m);
        context.Payments.AddRange(
            OrdinaryPayment(seed, 2_000m, "paid", seed.Invoice.Id),
            OrdinaryPayment(seed, 3_000m, "paid", null),
            HistoricalEvidence(seed, 20_000m));
        await context.SaveChangesAsync();

        var service = new PaymentService(new UnitOfWork(context));
        var payment = await service.CreateAsync(
            seed.Booking.Id, seed.Invoice.Id, "bank_transfer", 5_000m, null, "PAY-HIST-01 case F");
        await service.MarkPaidAsync(payment.Id, null, null);

        var conflict = await Assert.ThrowsAsync<ConflictException>(() => service.CreateAsync(
            seed.Booking.Id, null, "cash", 0.01m, null, "mixed capacity proof"));
        AssertCreateOverpaymentContract(conflict, seed.Booking.Id, 10_000m);
        await AssertFinanceTruthAsync(context, seed, 10_000m, 20_000m, false);

        var reporting = new ReportingFinanceAnalyticsService(
            new UnitOfWork(context),
            NullLogger<ReportingFinanceAnalyticsService>.Instance);
        var summary = await reporting.GetSummaryAsync();
        Assert.Equal(10_000m, summary.TotalPaidAmount);
        Assert.Equal(20_000m, summary.HistoricalPaymentEvidenceAmount);
        Assert.Equal(1, summary.OrdinaryUnlinkedPaidCount);
        Assert.Equal(3_000m, summary.OrdinaryUnlinkedPaidAmount);
    }

    [Fact]
    public async Task CancelledAndFailedRowsRemainExcludedWhilePendingRowsReserveCapacity()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        await using var context = database.CreateDbContext();
        var seed = await SeedAsync(context, 10_000m);
        context.Payments.AddRange(
            OrdinaryPayment(seed, 10_000m, "cancelled", null),
            OrdinaryPayment(seed, 10_000m, "failed", null),
            OrdinaryPayment(seed, 4_000m, "pending", null),
            HistoricalEvidence(seed, 10_000m));
        await context.SaveChangesAsync();

        var service = new PaymentService(new UnitOfWork(context));
        var pending = await service.CreateAsync(
            seed.Booking.Id, null, "cash", 6_000m, null, "PAY-HIST-01 case G");
        Assert.Equal("pending", pending.PaymentStatus);

        var conflict = await Assert.ThrowsAsync<ConflictException>(() => service.CreateAsync(
            seed.Booking.Id, null, "cash", 0.01m, null, "pending capacity proof"));
        AssertCreateOverpaymentContract(conflict, seed.Booking.Id, 10_000m);
    }

    [Fact]
    public async Task MarkPaidIgnoresEvidenceAndDoesNotDoubleCountCurrentPayment()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        await using var context = database.CreateDbContext();
        var seed = await SeedAsync(context, 10_000m);
        var pending = OrdinaryPayment(seed, 10_000m, "pending", seed.Invoice.Id);
        context.Payments.AddRange(pending, HistoricalEvidence(seed, 8_000m));
        await context.SaveChangesAsync();

        var service = new PaymentService(new UnitOfWork(context));
        var paid = await service.MarkPaidAsync(pending.Id, null, "PAY-HIST-01 status transition");
        Assert.Equal("paid", paid.PaymentStatus);

        var excess = OrdinaryPayment(seed, 0.01m, "pending", seed.Invoice.Id);
        context.Payments.Add(excess);
        await context.SaveChangesAsync();
        var conflict = await Assert.ThrowsAsync<ConflictException>(() =>
            service.MarkPaidAsync(excess.Id, null, null));
        Assert.Null(conflict.Code);
        Assert.Equal(
            $"Payment {excess.Id} cannot be marked as paid: this would result in an overpayment of 0.01. " +
            "Amount owed: 10000.00, Current paid: 10000.00, This payment: 0.01. Overpayments are not allowed.",
            conflict.Message);

        await AssertFinanceTruthAsync(context, seed, 10_000m, 8_000m, true);
    }

    private async Task AssertEvidenceDoesNotConsumeCapacityAsync(decimal[] evidenceAmounts)
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        await using var context = database.CreateDbContext();
        var seed = await SeedAsync(context, 10_000m);
        context.Payments.AddRange(evidenceAmounts.Select(amount => HistoricalEvidence(seed, amount)));
        await context.SaveChangesAsync();

        var service = new PaymentService(new UnitOfWork(context));
        var ordinary = await service.CreateAsync(
            seed.Booking.Id, seed.Invoice.Id, "cash", 10_000m, null, "PAY-HIST-01 evidence isolation");
        var paid = await service.MarkPaidAsync(ordinary.Id, null, null);

        Assert.False(paid.IsHistoricalRecord);
        Assert.Equal("paid", paid.PaymentStatus);
        await AssertFinanceTruthAsync(context, seed, 10_000m, evidenceAmounts.Sum(), true);
    }

    private static async Task AssertFinanceTruthAsync(
        AppDbContext context,
        SeededData seed,
        decimal ordinaryPaid,
        decimal evidenceAmount,
        bool invoicePaid)
    {
        context.ChangeTracker.Clear();
        var finance = new FinanceSummaryService(new UnitOfWork(context));
        var invoice = await finance.GetInvoiceBalanceAsync(seed.Invoice.Id);
        var booking = await finance.GetBookingFinanceSnapshotAsync(seed.Booking.Id);

        Assert.Equal(ordinaryPaid, invoice.PaidAmount);
        Assert.Equal(10_000m - ordinaryPaid, invoice.RemainingAmount);
        Assert.Equal(ordinaryPaid == 10_000m, invoice.IsFullyPaid);
        Assert.Equal(evidenceAmount, invoice.HistoricalPaymentEvidenceAmount);
        Assert.Equal(ordinaryPaid, booking.PaidAmount);
        Assert.Equal(10_000m - ordinaryPaid, booking.RemainingAmount);
        Assert.Equal(evidenceAmount, booking.HistoricalPaymentEvidenceAmount);

        var persistedInvoice = await context.Invoices.AsNoTracking()
            .SingleAsync(row => row.Id == seed.Invoice.Id);
        Assert.Equal(invoicePaid ? "paid" : "issued", persistedInvoice.InvoiceStatus);
        Assert.Equal(0, await context.OwnerPayouts.CountAsync(row => row.BookingId == seed.Booking.Id));
        Assert.Equal(evidenceAmount, await context.Payments
            .Where(row => row.BookingId == seed.Booking.Id
                && row.PaymentStatus == "paid"
                && row.IsHistoricalRecord
                && row.InvoiceId == null)
            .SumAsync(row => row.Amount));
        Assert.Equal(ordinaryPaid, await context.Payments
            .Where(row => row.BookingId == seed.Booking.Id
                && row.PaymentStatus == "paid"
                && !row.IsHistoricalRecord)
            .SumAsync(row => row.Amount));
    }

    private static void AssertCreateOverpaymentContract(
        ConflictException conflict,
        Guid bookingId,
        decimal committedTotal)
    {
        Assert.Null(conflict.Code);
        Assert.Equal(
            $"This payment of 0.01 exceeds the remaining balance for booking {bookingId}. " +
            $"Amount owed: 10000.00, already recorded (paid + pending): {committedTotal:F2}, remaining: 0.00. " +
            "Overpayments are not allowed.",
            conflict.Message);
    }

    private static async Task<SeededData> SeedAsync(AppDbContext context, decimal capacity)
    {
        var suffix = Guid.NewGuid().ToString("N");
        var owner = new Owner
        {
            Id = Guid.NewGuid(), Name = "PAY-HIST-01 owner", Phone = TestPhone("20"),
            EmergencyPhone = TestPhone("21"), CommissionRate = 10m, Status = "active",
            PasswordHash = "test-only-hash", CreatedAt = RecordedAt, UpdatedAt = RecordedAt
        };
        var project = new Project
        {
            Id = Guid.NewGuid(), Name = $"PAY-HIST-01 project {suffix}", IsActive = true,
            CreatedAt = RecordedAt, UpdatedAt = RecordedAt
        };
        var client = new Client
        {
            Id = Guid.NewGuid(), Name = "PAY-HIST-01 client", Phone = TestPhone("22"),
            PasswordHash = "test-only-hash", IsActive = true,
            CreatedAt = RecordedAt, UpdatedAt = RecordedAt
        };
        var admin = new AdminUser
        {
            Id = Guid.NewGuid(), Name = "PAY-HIST-01 admin",
            Email = $"pay-hist-01-{suffix}@example.test", PasswordHash = "test-only-hash",
            RoleTemplateId = Guid.Parse("10000000-0000-0000-0000-000000000001"),
            IsActive = true, CreatedAt = RecordedAt, UpdatedAt = RecordedAt
        };
        var unit = new Unit
        {
            Id = Guid.NewGuid(), OwnerId = owner.Id, ProjectId = project.Id,
            Name = $"PAY-HIST-01 unit {suffix}", UnitType = "apartment",
            Bedrooms = 2, Bathrooms = 1, MaxGuests = 4, BasePricePerNight = 1_000m,
            IsActive = true, IsVisibleInPortfolio = true,
            CreatedAt = RecordedAt, UpdatedAt = RecordedAt
        };
        var booking = new Booking
        {
            Id = Guid.NewGuid(), ClientId = client.Id, UnitId = unit.Id, OwnerId = owner.Id,
            BookingStatus = BookingStatus.Booked,
            CheckInDate = new DateOnly(2026, 9, 10), CheckOutDate = new DateOnly(2026, 9, 20),
            GuestCount = 2, BaseAmount = capacity, FinalAmount = capacity,
            Source = "admin", IsHistorical = false,
            CreatedAt = RecordedAt, UpdatedAt = RecordedAt
        };
        var invoice = new Invoice
        {
            Id = Guid.NewGuid(), BookingId = booking.Id,
            InvoiceNumber = $"PAY-HIST-01-{suffix}", InvoiceStatus = "issued",
            SubtotalAmount = capacity, TotalAmount = capacity, IssuedAt = RecordedAt,
            CreatedAt = RecordedAt, UpdatedAt = RecordedAt
        };

        context.AddRange(owner, project, client, admin, unit, booking, invoice);
        await context.SaveChangesAsync();
        return new SeededData(admin, booking, invoice);
    }

    private static Payment OrdinaryPayment(
        SeededData seed,
        decimal amount,
        string status,
        Guid? invoiceId) => new()
    {
        Id = Guid.NewGuid(), BookingId = seed.Booking.Id, InvoiceId = invoiceId,
        PaymentStatus = status, PaymentMethod = "cash", Amount = amount,
        IsHistoricalRecord = false,
        PaidAt = status == "paid" ? RecordedAt : null,
        CreatedAt = RecordedAt, UpdatedAt = RecordedAt
    };

    private static Payment HistoricalEvidence(SeededData seed, decimal amount) => new()
    {
        // Fault injection keeps the guard accountable to the persisted payment classification;
        // the production HistoricalPaymentService never routes Evidence through PaymentService.
        Id = Guid.NewGuid(), BookingId = seed.Booking.Id, InvoiceId = null,
        PaymentStatus = "paid", PaymentMethod = "cash", Amount = amount,
        IsHistoricalRecord = true, CreatedByAdminUserId = seed.Admin.Id,
        RecordedReason = "Verified off-platform payment evidence",
        PaidAt = EvidencePaidAt, CreatedAt = RecordedAt, UpdatedAt = RecordedAt
    };

    private static string TestPhone(string prefix)
    {
        var value = BitConverter.ToUInt32(Guid.NewGuid().ToByteArray(), 0) % 10_000_000_000L;
        return $"+{prefix}{value:D10}";
    }

    private sealed record SeededData(AdminUser Admin, Booking Booking, Invoice Invoice);
}
