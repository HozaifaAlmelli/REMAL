using Microsoft.EntityFrameworkCore;
using Npgsql;
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
[Trait(TestCategories.Name, TestCategories.Concurrency)]
public sealed class InvoiceCapacityReservationInvariantPostgreSqlTests
{
    private const decimal FallbackCapacity = 12_000m;
    private const decimal RaisedCapacity = 14_000m;
    private readonly PostgreSqlFixture _fixture;

    public InvoiceCapacityReservationInvariantPostgreSqlTests(PostgreSqlFixture fixture)
    {
        _fixture = fixture;
    }

    [Fact]
    public async Task PendingOnlyOverflowRejectsCancellationWithoutPartialMutation()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        var state = await CreateRaisedCapacityStateAsync(database);
        var paymentId = await CreatePaymentAsync(database, state, 13_000m, invoiceLinked: true);

        var conflict = await AssertCancelConflictAsync(database, state.InvoiceId);

        AssertCapacityConflict(conflict, 13_000m, 0m, 13_000m);
        await AssertInvoiceAsync(database, state.InvoiceId, "draft", RaisedCapacity, 2, "INV-OPS-02 fixture");
        await AssertPaymentAsync(database, paymentId, "pending", 13_000m, state.InvoiceId);
    }

    [Fact]
    public async Task PaidAndPendingOverflowRejectsCancellation()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        var (state, paidId) = await CreateRaisedCapacityWithPreInvoicePaidAsync(database, 8_000m);
        var pendingId = await CreatePaymentAsync(database, state, 5_000m, invoiceLinked: true);

        var conflict = await AssertCancelConflictAsync(database, state.InvoiceId);

        AssertCapacityConflict(conflict, 13_000m, 8_000m, 5_000m);
        await AssertInvoiceAsync(database, state.InvoiceId, "draft", RaisedCapacity, 2, "INV-OPS-02 fixture");
        await AssertPaymentAsync(database, paidId, "paid", 8_000m, null);
        await AssertPaymentAsync(database, pendingId, "pending", 5_000m, state.InvoiceId);
    }

    [Fact]
    public async Task LegacyNormalizationPaidOnlyOverflowRejectsForManualReview()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        var state = await CreateLegacyInconsistentStateAsync(database);
        var paymentId = await CreatePaymentAsync(database, state, 13_000m, invoiceLinked: false);
        await MarkPaidAsync(database, paymentId);

        var conflict = await Assert.ThrowsAsync<ConflictException>(() =>
            AddAdjustmentAsync(database, state.InvoiceId, 0m));

        Assert.Null(conflict.Code);
        Assert.Contains("Cannot reduce settlement capacity to 12000.00", conflict.Message);
        Assert.Contains("already-paid ordinary payments total 13000.00", conflict.Message);
        Assert.Contains("Manual review is required", conflict.Message);
        await AssertInvoiceAsync(database, state.InvoiceId, "draft", RaisedCapacity, 1, "legacy inconsistent fixture", FallbackCapacity);
        await AssertPaymentAsync(database, paymentId, "paid", 13_000m, state.InvoiceId);
    }

    [Fact]
    public async Task ExactCommitmentBoundaryAllowsCancellation()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        var state = await CreateRaisedCapacityStateAsync(database);
        await CreatePaymentAsync(database, state, FallbackCapacity, invoiceLinked: true);

        var cancelled = await CancelAsync(database, state.InvoiceId);

        Assert.Equal("cancelled", cancelled.InvoiceStatus);
        await AssertInvoiceAsync(database, state.InvoiceId, "cancelled", RaisedCapacity, 2, "capacity shrink");
        Assert.Equal(FallbackCapacity, await OrdinaryCommittedAsync(database, state.BookingId));
        Assert.Equal(FallbackCapacity, await EffectiveCapacityAsync(database, state.BookingId));
    }

    [Fact]
    public async Task OneCentOverflowRejectsCancellation()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        var state = await CreateRaisedCapacityStateAsync(database);
        await CreatePaymentAsync(database, state, 12_000.01m, invoiceLinked: false);

        var conflict = await AssertCancelConflictAsync(database, state.InvoiceId);

        AssertCapacityConflict(conflict, 12_000.01m, 0m, 12_000.01m);
        await AssertInvoiceAsync(database, state.InvoiceId, "draft", RaisedCapacity, 2, "INV-OPS-02 fixture");
    }

    [Fact]
    public async Task HistoricalEvidenceDoesNotConsumeCapacity()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        var (state, _) = await CreateRaisedCapacityWithPreInvoicePaidAsync(database, 4_000m);
        await CreatePaymentAsync(database, state, 3_000m, invoiceLinked: false);
        var evidenceId = await AddHistoricalEvidenceAsync(database, state, 20_000m);

        var cancelled = await CancelAsync(database, state.InvoiceId);

        Assert.Equal("cancelled", cancelled.InvoiceStatus);
        Assert.Equal(7_000m, await OrdinaryCommittedAsync(database, state.BookingId));
        Assert.Equal(20_000m, await HistoricalEvidenceAsync(database, state.BookingId));
        await AssertPaymentAsync(database, evidenceId, "paid", 20_000m, null, isHistorical: true);
    }

    [Fact]
    public async Task FailedAndCancelledOrdinaryPaymentsDoNotConsumeCapacity()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        var state = await CreateRaisedCapacityStateAsync(database);
        var failedId = await CreatePaymentAsync(database, state, 7_000m, invoiceLinked: false);
        var cancelledId = await CreatePaymentAsync(database, state, 7_000m, invoiceLinked: false);
        await using (var context = database.CreateDbContext())
        {
            var payments = new PaymentService(new UnitOfWork(context));
            await payments.MarkFailedAsync(failedId, "excluded failed payment");
            await payments.CancelAsync(cancelledId, "excluded cancelled payment");
        }

        var cancelledInvoice = await CancelAsync(database, state.InvoiceId);

        Assert.Equal("cancelled", cancelledInvoice.InvoiceStatus);
        Assert.Equal(0m, await OrdinaryCommittedAsync(database, state.BookingId));
        await AssertPaymentAsync(database, failedId, "failed", 7_000m, null);
        await AssertPaymentAsync(database, cancelledId, "cancelled", 7_000m, null);
    }

    [Fact]
    public async Task OrdinaryUnlinkedPaidAndPendingRemainBookingScopedCommitments()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        var (state, paidId) = await CreateRaisedCapacityWithPreInvoicePaidAsync(database, 4_000m);
        var pendingId = await CreatePaymentAsync(database, state, 8_000.01m, invoiceLinked: false);

        var conflict = await AssertCancelConflictAsync(database, state.InvoiceId);

        AssertCapacityConflict(conflict, 12_000.01m, 4_000m, 8_000.01m);
        await AssertPaymentAsync(database, paidId, "paid", 4_000m, null);
        await AssertPaymentAsync(database, pendingId, "pending", 8_000.01m, null);
    }

    [Fact]
    public async Task LinkedPaidPaymentKeepsExistingCancellationConflict()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        var state = await CreateRaisedCapacityStateAsync(database);
        var paymentId = await CreatePaymentAsync(database, state, 8_000m, invoiceLinked: true);
        await MarkPaidAsync(database, paymentId);

        var conflict = await AssertCancelConflictAsync(database, state.InvoiceId);

        Assert.Null(conflict.Code);
        Assert.Equal(
            $"Invoice {state.InvoiceId} cannot be cancelled: there are paid payments linked to this invoice.",
            conflict.Message);
        await AssertInvoiceAsync(database, state.InvoiceId, "draft", RaisedCapacity, 2, "INV-OPS-02 fixture");
    }

    [Fact]
    public async Task LegacyNormalizationOverflowRejectsAndPreservesDurableState()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        var state = await CreateLegacyInconsistentStateAsync(database);
        var paymentId = await CreatePaymentAsync(database, state, 13_000m, invoiceLinked: false);

        var conflict = await Assert.ThrowsAsync<ConflictException>(() =>
            AddAdjustmentAsync(database, state.InvoiceId, 0m));

        AssertCapacityConflict(conflict, 13_000m, 0m, 13_000m);
        await AssertInvoiceAsync(database, state.InvoiceId, "draft", RaisedCapacity, 1, "legacy inconsistent fixture", FallbackCapacity);
        await AssertPaymentAsync(database, paymentId, "pending", 13_000m, null);
    }

    [Fact]
    public async Task LegacyNormalizationAtExactBoundarySucceeds()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        var state = await CreateLegacyInconsistentStateAsync(database);
        await CreatePaymentAsync(database, state, FallbackCapacity, invoiceLinked: false);

        var normalized = await AddAdjustmentAsync(database, state.InvoiceId, 0m);

        Assert.Equal(FallbackCapacity, normalized.SubtotalAmount);
        Assert.Equal(FallbackCapacity, normalized.TotalAmount);
        await AssertInvoiceAsync(database, state.InvoiceId, "draft", FallbackCapacity, 2, "legacy inconsistent fixture");
    }

    [Fact]
    public async Task ReservationCommittedFirstMakesWaitingCancellationReject()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        var state = await CreateRaisedCapacityStateAsync(database);
        await using var paymentContext = database.CreateDbContext();
        await using var paymentTransaction = await paymentContext.Database.BeginTransactionAsync();
        var payment = await new PaymentService(new UnitOfWork(paymentContext)).CreateAsync(
            state.BookingId, null, "cash", 13_000m, null, "reservation wins");

        var cancellation = CaptureCancelAsync(database, state.InvoiceId);
        await WaitForAdvisoryWaitersAsync(database, 1);
        await paymentTransaction.CommitAsync();

        var outcome = await cancellation;
        Assert.Null(outcome.Invoice);
        AssertCapacityConflict(outcome.Error!, 13_000m, 0m, 13_000m);
        await AssertPaymentAsync(database, payment.Id, "pending", 13_000m, null);
        await AssertInvoiceAsync(database, state.InvoiceId, "draft", RaisedCapacity, 2, "INV-OPS-02 fixture");
    }

    [Fact]
    public async Task CancellationCommittedFirstMakesWaitingReservationUseFallbackCapacity()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        var state = await CreateRaisedCapacityStateAsync(database);
        await using var cancelContext = database.CreateDbContext();
        await using var cancelTransaction = await cancelContext.Database.BeginTransactionAsync();
        await new InvoiceService(new UnitOfWork(cancelContext))
            .CancelAsync(state.InvoiceId, "cancellation wins");

        var reservation = CaptureCreateAsync(database, state.BookingId, 13_000m);
        await WaitForAdvisoryWaitersAsync(database, 1);
        await cancelTransaction.CommitAsync();

        var outcome = await reservation;
        Assert.Null(outcome.Payment);
        Assert.Contains("Amount owed: 12000.00", outcome.Error!.Message);
        Assert.Equal(0m, await OrdinaryCommittedAsync(database, state.BookingId));
        await AssertInvoiceAsync(database, state.InvoiceId, "cancelled", RaisedCapacity, 2, "cancellation wins");
    }

    [Fact]
    public async Task MarkPaidCommittedFirstMakesWaitingCancellationRejectPaidOnlyOverflow()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        var state = await CreateRaisedCapacityStateAsync(database);
        var paymentId = await CreatePaymentAsync(database, state, 13_000m, invoiceLinked: false);
        await using var paymentContext = database.CreateDbContext();
        await using var paymentTransaction = await paymentContext.Database.BeginTransactionAsync();
        await new PaymentService(new UnitOfWork(paymentContext))
            .MarkPaidAsync(paymentId, null, "settlement wins");

        var cancellation = CaptureCancelAsync(database, state.InvoiceId);
        await WaitForAdvisoryWaitersAsync(database, 1);
        await paymentTransaction.CommitAsync();

        var outcome = await cancellation;
        Assert.Null(outcome.Invoice);
        Assert.Equal(
            $"Invoice {state.InvoiceId} cannot be cancelled: there are paid payments linked to this invoice.",
            outcome.Error!.Message);
        await AssertPaymentAsync(database, paymentId, "paid", 13_000m, state.InvoiceId);
        await AssertInvoiceAsync(database, state.InvoiceId, "draft", RaisedCapacity, 2, "INV-OPS-02 fixture");
    }

    [Fact]
    public async Task CancellationValidationFirstRejectsBeforeWaitingMarkPaidProceeds()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        var state = await CreateRaisedCapacityStateAsync(database);
        var paymentId = await CreatePaymentAsync(database, state, 13_000m, invoiceLinked: false);
        await using var cancelContext = database.CreateDbContext();
        await using var cancelTransaction = await cancelContext.Database.BeginTransactionAsync();
        var conflict = await Assert.ThrowsAsync<ConflictException>(() =>
            new InvoiceService(new UnitOfWork(cancelContext)).CancelAsync(state.InvoiceId, "reject first"));
        AssertCapacityConflict(conflict, 13_000m, 0m, 13_000m);

        var markPaid = CaptureMarkPaidAsync(database, paymentId);
        await WaitForAdvisoryWaitersAsync(database, 1);
        await cancelTransaction.RollbackAsync();

        Assert.NotNull((await markPaid).Payment);
        await AssertPaymentAsync(database, paymentId, "paid", 13_000m, state.InvoiceId);
        await AssertInvoiceAsync(database, state.InvoiceId, "draft", RaisedCapacity, 2, "INV-OPS-02 fixture");
    }

    [Fact]
    public async Task PendingCancellationReleasedFirstAllowsWaitingInvoiceCancellation()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        var state = await CreateRaisedCapacityStateAsync(database);
        var paymentId = await CreatePaymentAsync(database, state, 13_000m, invoiceLinked: false);
        await using var gate = await HoldAdvisoryLockAsync(database, PaymentLockKey(state.BookingId));

        var invoiceCancellation = CaptureCancelAsync(database, state.InvoiceId);
        await WaitForAdvisoryWaitersAsync(database, 1);
        await CancelPaymentAsync(database, paymentId);
        await gate.CommitAsync();

        Assert.NotNull((await invoiceCancellation).Invoice);
        await AssertPaymentAsync(database, paymentId, "cancelled", 13_000m, null);
        await AssertInvoiceAsync(database, state.InvoiceId, "cancelled", RaisedCapacity, 2, "capacity shrink");
    }

    [Fact]
    public async Task InvoiceRejectionFirstDoesNotAutoCancelPendingPayment()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        var state = await CreateRaisedCapacityStateAsync(database);
        var paymentId = await CreatePaymentAsync(database, state, 13_000m, invoiceLinked: false);
        await using var cancelContext = database.CreateDbContext();
        await using var cancelTransaction = await cancelContext.Database.BeginTransactionAsync();
        var conflict = await Assert.ThrowsAsync<ConflictException>(() =>
            new InvoiceService(new UnitOfWork(cancelContext)).CancelAsync(state.InvoiceId, "reject first"));
        AssertCapacityConflict(conflict, 13_000m, 0m, 13_000m);

        await CancelPaymentAsync(database, paymentId);
        await cancelTransaction.RollbackAsync();

        await AssertPaymentAsync(database, paymentId, "cancelled", 13_000m, null);
        await AssertInvoiceAsync(database, state.InvoiceId, "draft", RaisedCapacity, 2, "INV-OPS-02 fixture");
    }

    [Fact]
    public async Task ReservationCommittedFirstMakesWaitingLegacyNormalizationReject()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        var state = await CreateLegacyInconsistentStateAsync(database);
        await using var paymentContext = database.CreateDbContext();
        await using var paymentTransaction = await paymentContext.Database.BeginTransactionAsync();
        await new PaymentService(new UnitOfWork(paymentContext)).CreateAsync(
            state.BookingId, null, "cash", 13_000m, null, "legacy reservation wins");

        var normalization = CaptureAdjustmentAsync(database, state.InvoiceId, 0m);
        await WaitForAdvisoryWaitersAsync(database, 1);
        await paymentTransaction.CommitAsync();

        var outcome = await normalization;
        Assert.Null(outcome.Invoice);
        AssertCapacityConflict(outcome.Error!, 13_000m, 0m, 13_000m);
        await AssertInvoiceAsync(database, state.InvoiceId, "draft", RaisedCapacity, 1, "legacy inconsistent fixture", FallbackCapacity);
    }

    [Fact]
    public async Task LegacyNormalizationHoldsPaymentBeforeInvoiceLockAndWinsBeforeReservation()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        var state = await CreateLegacyInconsistentStateAsync(database);
        await using var invoiceGate = await HoldAdvisoryLockAsync(
            database, InvoiceMutationLocks.ForInvoice(state.InvoiceId));

        var normalization = CaptureAdjustmentAsync(database, state.InvoiceId, 0m);
        await WaitForAdvisoryWaitersAsync(database, 1);
        var reservation = CaptureCreateAsync(database, state.BookingId, 13_000m);
        await WaitForAdvisoryWaitersAsync(database, 2);
        Assert.False(reservation.IsCompleted);
        await invoiceGate.CommitAsync();

        Assert.NotNull((await normalization).Invoice);
        var reservationOutcome = await reservation;
        Assert.Null(reservationOutcome.Payment);
        Assert.Contains("Amount owed: 12000.00", reservationOutcome.Error!.Message);
        await AssertInvoiceAsync(database, state.InvoiceId, "draft", FallbackCapacity, 2, "legacy inconsistent fixture");
    }

    [Fact]
    public async Task DifferentBookingNormalizationDoesNotSharePaymentLock()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        var first = await CreateLegacyInconsistentStateAsync(database);
        var second = await CreateLegacyInconsistentStateAsync(database);
        await using var gate = await HoldAdvisoryLockAsync(database, PaymentLockKey(first.BookingId));

        var blocked = CaptureAdjustmentAsync(database, first.InvoiceId, 0m);
        await WaitForAdvisoryWaitersAsync(database, 1);
        var independent = await CompleteWithinAsync(
            CaptureAdjustmentAsync(database, second.InvoiceId, 0m),
            TimeSpan.FromSeconds(10),
            "A different booking must not wait on the first booking's payment lock.");

        Assert.NotNull(independent.Invoice);
        Assert.False(blocked.IsCompleted);
        await gate.CommitAsync();
        Assert.NotNull((await blocked).Invoice);
    }

    private static async Task<CapacityState> CreateRaisedCapacityStateAsync(
        PostgreSqlTestDatabase database)
    {
        await using var context = database.CreateDbContext();
        var seed = await SeedBookingAsync(context);
        var invoices = new InvoiceService(new UnitOfWork(context));
        var draft = await invoices.CreateDraftFromBookingAsync(
            seed.Booking.Id, $"INV-CAP-{Guid.NewGuid():N}", "INV-OPS-02 fixture");
        var raised = await invoices.AddManualAdjustmentAsync(
            draft.Id, "Raise supported capacity", 1, RaisedCapacity - FallbackCapacity);
        Assert.Equal(RaisedCapacity, raised.TotalAmount);
        return new CapacityState(seed.Booking.Id, raised.Id, seed.Admin.Id);
    }

    private static async Task<(CapacityState State, Guid PaidPaymentId)>
        CreateRaisedCapacityWithPreInvoicePaidAsync(
            PostgreSqlTestDatabase database,
            decimal paidAmount)
    {
        await using var context = database.CreateDbContext();
        var seed = await SeedBookingAsync(context);
        var unitOfWork = new UnitOfWork(context);
        var payments = new PaymentService(unitOfWork);
        var paidPayment = await payments.CreateAsync(
            seed.Booking.Id, null, "cash", paidAmount, null, "pre-invoice ordinary payment");
        await payments.MarkPaidAsync(paidPayment.Id, null, "pre-invoice settlement");

        var invoices = new InvoiceService(unitOfWork);
        var draft = await invoices.CreateDraftFromBookingAsync(
            seed.Booking.Id, $"INV-CAP-{Guid.NewGuid():N}", "INV-OPS-02 fixture");
        var raised = await invoices.AddManualAdjustmentAsync(
            draft.Id, "Raise supported capacity", 1, RaisedCapacity - FallbackCapacity);
        return (new CapacityState(seed.Booking.Id, raised.Id, seed.Admin.Id), paidPayment.Id);
    }

    private static async Task<CapacityState> CreateLegacyInconsistentStateAsync(
        PostgreSqlTestDatabase database)
    {
        await using var context = database.CreateDbContext();
        var seed = await SeedBookingAsync(context);
        var invoice = await new InvoiceService(new UnitOfWork(context)).CreateDraftFromBookingAsync(
            seed.Booking.Id, $"INV-LEGACY-{Guid.NewGuid():N}", "legacy inconsistent fixture");
        invoice.SubtotalAmount = RaisedCapacity;
        invoice.TotalAmount = RaisedCapacity;
        context.Invoices.Update(invoice);
        await context.SaveChangesAsync();
        return new CapacityState(seed.Booking.Id, invoice.Id, seed.Admin.Id);
    }

    private static async Task<Seed> SeedBookingAsync(AppDbContext context)
    {
        var suffix = Guid.NewGuid().ToString("N");
        var now = new DateTime(2026, 8, 13, 12, 0, 0, DateTimeKind.Utc);
        var owner = new Owner
        {
            Id = Guid.NewGuid(), Name = "INV-OPS-02 owner", Phone = TestPhone("20"),
            EmergencyPhone = TestPhone("21"), CommissionRate = 10m, Status = "active",
            PasswordHash = "test-only-hash"
        };
        var project = new Project
        {
            Id = Guid.NewGuid(), Name = $"INV-OPS-02 project {suffix}", IsActive = true
        };
        var client = new Client
        {
            Id = Guid.NewGuid(), Name = "INV-OPS-02 client", Phone = TestPhone("22"),
            PasswordHash = "test-only-hash", IsActive = true
        };
        var admin = new AdminUser
        {
            Id = Guid.NewGuid(), Name = "INV-OPS-02 admin",
            Email = $"inv-ops-02-{suffix}@example.test", PasswordHash = "test-only-hash",
            RoleTemplateId = Guid.Parse("10000000-0000-0000-0000-000000000001"),
            IsActive = true, CreatedAt = now, UpdatedAt = now
        };
        var unit = new Unit
        {
            Id = Guid.NewGuid(), OwnerId = owner.Id, ProjectId = project.Id,
            Name = $"INV-OPS-02 unit {suffix}", UnitType = "apartment",
            Bedrooms = 2, Bathrooms = 1, MaxGuests = 4, BasePricePerNight = 1_200m,
            IsActive = true, IsVisibleInPortfolio = true
        };
        var booking = new Booking
        {
            Id = Guid.NewGuid(), ClientId = client.Id, UnitId = unit.Id, OwnerId = owner.Id,
            BookingStatus = BookingStatus.Booked,
            CheckInDate = new DateOnly(2026, 12, 1), CheckOutDate = new DateOnly(2026, 12, 11),
            GuestCount = 2, BaseAmount = FallbackCapacity, FinalAmount = FallbackCapacity,
            Source = "admin", IsHistorical = false
        };
        context.AddRange(owner, project, client, admin, unit, booking);
        await context.SaveChangesAsync();
        return new Seed(booking, admin);
    }

    private static async Task<Guid> CreatePaymentAsync(
        PostgreSqlTestDatabase database,
        CapacityState state,
        decimal amount,
        bool invoiceLinked)
    {
        await using var context = database.CreateDbContext();
        var payment = await new PaymentService(new UnitOfWork(context)).CreateAsync(
            state.BookingId,
            invoiceLinked ? state.InvoiceId : null,
            "cash",
            amount,
            null,
            "INV-OPS-02 ordinary commitment");
        return payment.Id;
    }

    private static async Task MarkPaidAsync(PostgreSqlTestDatabase database, Guid paymentId)
    {
        await using var context = database.CreateDbContext();
        await new PaymentService(new UnitOfWork(context)).MarkPaidAsync(
            paymentId, null, "INV-OPS-02 ordinary paid commitment");
    }

    private static async Task CancelPaymentAsync(PostgreSqlTestDatabase database, Guid paymentId)
    {
        await using var context = database.CreateDbContext();
        await new PaymentService(new UnitOfWork(context)).CancelAsync(
            paymentId, "INV-OPS-02 explicit operator cancellation");
    }

    private static async Task<Guid> AddHistoricalEvidenceAsync(
        PostgreSqlTestDatabase database,
        CapacityState state,
        decimal amount)
    {
        await using var context = database.CreateDbContext();
        var evidence = new Payment
        {
            Id = Guid.NewGuid(), BookingId = state.BookingId, InvoiceId = null,
            PaymentStatus = "paid", PaymentMethod = "cash", Amount = amount,
            IsHistoricalRecord = true, CreatedByAdminUserId = state.AdminId,
            RecordedReason = "Verified off-platform payment evidence",
            PaidAt = new DateTime(2026, 2, 10, 12, 0, 0, DateTimeKind.Utc),
            CreatedAt = new DateTime(2026, 8, 13, 12, 0, 0, DateTimeKind.Utc),
            UpdatedAt = new DateTime(2026, 8, 13, 12, 0, 0, DateTimeKind.Utc)
        };
        context.Payments.Add(evidence);
        await context.SaveChangesAsync();
        return evidence.Id;
    }

    private static async Task<Invoice> AddAdjustmentAsync(
        PostgreSqlTestDatabase database,
        Guid invoiceId,
        decimal amount)
    {
        await using var context = database.CreateDbContext();
        return await new InvoiceService(new UnitOfWork(context)).AddManualAdjustmentAsync(
            invoiceId, "INV-OPS-02 canonical normalization", 1, amount);
    }

    private static async Task<Invoice> CancelAsync(
        PostgreSqlTestDatabase database,
        Guid invoiceId)
    {
        await using var context = database.CreateDbContext();
        return await new InvoiceService(new UnitOfWork(context))
            .CancelAsync(invoiceId, "capacity shrink");
    }

    private static async Task<ConflictException> AssertCancelConflictAsync(
        PostgreSqlTestDatabase database,
        Guid invoiceId)
    {
        await using var context = database.CreateDbContext();
        return await Assert.ThrowsAsync<ConflictException>(() =>
            new InvoiceService(new UnitOfWork(context)).CancelAsync(invoiceId, "must reject"));
    }

    private static async Task<InvoiceOutcome> CaptureCancelAsync(
        PostgreSqlTestDatabase database,
        Guid invoiceId)
    {
        try
        {
            return new(await CancelAsync(database, invoiceId), null);
        }
        catch (ConflictException error)
        {
            return new(null, error);
        }
    }

    private static async Task<InvoiceOutcome> CaptureAdjustmentAsync(
        PostgreSqlTestDatabase database,
        Guid invoiceId,
        decimal amount)
    {
        try
        {
            return new(await AddAdjustmentAsync(database, invoiceId, amount), null);
        }
        catch (ConflictException error)
        {
            return new(null, error);
        }
    }

    private static async Task<PaymentOutcome> CaptureCreateAsync(
        PostgreSqlTestDatabase database,
        Guid bookingId,
        decimal amount)
    {
        await using var context = database.CreateDbContext();
        try
        {
            var payment = await new PaymentService(new UnitOfWork(context)).CreateAsync(
                bookingId, null, "cash", amount, null, "concurrent reservation");
            return new(payment, null);
        }
        catch (ConflictException error)
        {
            return new(null, error);
        }
    }

    private static async Task<PaymentOutcome> CaptureMarkPaidAsync(
        PostgreSqlTestDatabase database,
        Guid paymentId)
    {
        await using var context = database.CreateDbContext();
        try
        {
            var payment = await new PaymentService(new UnitOfWork(context)).MarkPaidAsync(
                paymentId, null, "concurrent settlement");
            return new(payment, null);
        }
        catch (ConflictException error)
        {
            return new(null, error);
        }
    }

    private static void AssertCapacityConflict(
        ConflictException conflict,
        decimal total,
        decimal paid,
        decimal pending)
    {
        Assert.Null(conflict.Code);
        Assert.Contains("Cannot reduce settlement capacity to 12000.00", conflict.Message);
        Assert.Contains(total.ToString("F2"), conflict.Message);
        Assert.Contains($"paid: {paid:F2}", conflict.Message);
        Assert.Contains($"pending: {pending:F2}", conflict.Message);
    }

    private static async Task AssertInvoiceAsync(
        PostgreSqlTestDatabase database,
        Guid invoiceId,
        string expectedStatus,
        decimal expectedStoredTotal,
        int expectedItemCount,
        string expectedNotes,
        decimal? expectedItemSum = null)
    {
        await using var context = database.CreateDbContext();
        var invoice = await context.Invoices.AsNoTracking().SingleAsync(row => row.Id == invoiceId);
        var itemCount = await context.InvoiceItems.AsNoTracking()
            .CountAsync(row => row.InvoiceId == invoiceId);
        var itemSum = await context.InvoiceItems.AsNoTracking()
            .Where(row => row.InvoiceId == invoiceId)
            .SumAsync(row => row.LineTotal);
        Assert.Equal(expectedStatus, invoice.InvoiceStatus);
        Assert.Equal(expectedStoredTotal, invoice.SubtotalAmount);
        Assert.Equal(expectedStoredTotal, invoice.TotalAmount);
        Assert.Equal(expectedItemCount, itemCount);
        Assert.Equal(expectedItemSum ?? expectedStoredTotal, itemSum);
        Assert.Equal(expectedNotes, invoice.Notes);
    }

    private static async Task AssertPaymentAsync(
        PostgreSqlTestDatabase database,
        Guid paymentId,
        string expectedStatus,
        decimal expectedAmount,
        Guid? expectedInvoiceId,
        bool isHistorical = false)
    {
        await using var context = database.CreateDbContext();
        var payment = await context.Payments.AsNoTracking().SingleAsync(row => row.Id == paymentId);
        Assert.Equal(expectedStatus, payment.PaymentStatus);
        Assert.Equal(expectedAmount, payment.Amount);
        Assert.Equal(expectedInvoiceId, payment.InvoiceId);
        Assert.Equal(isHistorical, payment.IsHistoricalRecord);
    }

    private static Task<decimal> OrdinaryCommittedAsync(
        PostgreSqlTestDatabase database,
        Guid bookingId) => QueryDecimalAsync(database, context => context.Payments
            .Where(payment => payment.BookingId == bookingId
                && !payment.IsHistoricalRecord
                && (payment.PaymentStatus == "paid" || payment.PaymentStatus == "pending"))
            .SumAsync(payment => payment.Amount));

    private static Task<decimal> HistoricalEvidenceAsync(
        PostgreSqlTestDatabase database,
        Guid bookingId) => QueryDecimalAsync(database, context => context.Payments
            .Where(payment => payment.BookingId == bookingId
                && payment.IsHistoricalRecord
                && payment.PaymentStatus == "paid")
            .SumAsync(payment => payment.Amount));

    private static async Task<decimal> EffectiveCapacityAsync(
        PostgreSqlTestDatabase database,
        Guid bookingId)
    {
        await using var context = database.CreateDbContext();
        var invoiceTotal = await context.Invoices.AsNoTracking()
            .Where(invoice => invoice.BookingId == bookingId
                && invoice.InvoiceStatus != "cancelled"
                && invoice.InvoiceStatus != "superseded")
            .Select(invoice => (decimal?)invoice.TotalAmount)
            .FirstOrDefaultAsync();
        return invoiceTotal ?? await context.Bookings.AsNoTracking()
            .Where(booking => booking.Id == bookingId)
            .Select(booking => booking.FinalAmount)
            .SingleAsync();
    }

    private static async Task<decimal> QueryDecimalAsync(
        PostgreSqlTestDatabase database,
        Func<AppDbContext, Task<decimal>> query)
    {
        await using var context = database.CreateDbContext();
        return await query(context);
    }

    private static async Task<HeldAdvisoryLock> HoldAdvisoryLockAsync(
        PostgreSqlTestDatabase database,
        string resourceKey)
    {
        var connection = await database.OpenConnectionAsync();
        var transaction = await connection.BeginTransactionAsync();
        await using var command = new NpgsqlCommand(
            "SELECT pg_advisory_xact_lock(hashtextextended(@resource_key, 0))",
            connection,
            transaction);
        command.Parameters.AddWithValue("resource_key", resourceKey);
        await command.ExecuteNonQueryAsync();
        return new HeldAdvisoryLock(connection, transaction);
    }

    private static async Task WaitForAdvisoryWaitersAsync(
        PostgreSqlTestDatabase database,
        int expectedCount)
    {
        var deadline = DateTime.UtcNow.AddSeconds(10);
        while (DateTime.UtcNow < deadline)
        {
            await using var connection = await database.OpenConnectionAsync();
            await using var command = new NpgsqlCommand(
                """
                SELECT COUNT(*)
                FROM pg_locks locks
                JOIN pg_stat_activity activity ON activity.pid = locks.pid
                WHERE activity.datname = @database_name
                  AND locks.locktype = 'advisory'
                  AND NOT locks.granted
                """,
                connection);
            command.Parameters.AddWithValue("database_name", database.DatabaseName);
            if (Convert.ToInt32(await command.ExecuteScalarAsync()) >= expectedCount)
                return;
            await Task.Delay(25);
        }

        Assert.Fail($"Expected at least {expectedCount} advisory-lock waiter(s).");
    }

    private static async Task<T> CompleteWithinAsync<T>(
        Task<T> operation,
        TimeSpan timeout,
        string failureMessage)
    {
        var completed = await Task.WhenAny(operation, Task.Delay(timeout));
        Assert.True(ReferenceEquals(completed, operation), failureMessage);
        return await operation;
    }

    private static string PaymentLockKey(Guid bookingId) => $"payment-booking:{bookingId:N}";

    private static string TestPhone(string prefix)
    {
        var value = BitConverter.ToUInt32(Guid.NewGuid().ToByteArray(), 0) % 10_000_000_000L;
        return $"+{prefix}{value:D10}";
    }

    private sealed record Seed(Booking Booking, AdminUser Admin);
    private sealed record CapacityState(Guid BookingId, Guid InvoiceId, Guid AdminId);
    private sealed record InvoiceOutcome(Invoice? Invoice, ConflictException? Error);
    private sealed record PaymentOutcome(Payment? Payment, ConflictException? Error);

    private sealed class HeldAdvisoryLock(
        NpgsqlConnection connection,
        System.Data.Common.DbTransaction transaction) : IAsyncDisposable
    {
        private bool _completed;

        public async Task CommitAsync()
        {
            await transaction.CommitAsync();
            _completed = true;
        }

        public async ValueTask DisposeAsync()
        {
            if (!_completed)
                await transaction.RollbackAsync();
            await transaction.DisposeAsync();
            await connection.DisposeAsync();
        }
    }
}
