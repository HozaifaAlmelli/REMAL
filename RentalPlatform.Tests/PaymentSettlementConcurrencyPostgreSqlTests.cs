using Microsoft.EntityFrameworkCore;
using Npgsql;
using RentalPlatform.Business.Exceptions;
using RentalPlatform.Business.Services;
using RentalPlatform.Data;
using RentalPlatform.Data.Entities;
using RentalPlatform.Shared.Enums;
using RentalPlatform.Tests.Infrastructure;
using Xunit;
using Xunit.Abstractions;

namespace RentalPlatform.Tests;

[Collection(PostgreSqlTestCollection.Name)]
[Trait(TestCategories.Name, TestCategories.PostgreSql)]
public sealed class PaymentSettlementConcurrencyPostgreSqlTests
{
    private const decimal FallbackCapacity = 10_000m;
    private readonly PostgreSqlFixture _fixture;
    private readonly ITestOutputHelper _output;

    public PaymentSettlementConcurrencyPostgreSqlTests(
        PostgreSqlFixture fixture,
        ITestOutputHelper output)
    {
        _fixture = fixture;
        _output = output;
    }

    [Fact]
    public async Task ConcurrentMarkPaidFromLegacyOverReservedStateCannotOverpay()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        var state = await CreateShrunkCapacityStateAsync(database, 6_000m, 6_000m);
        await using var gate = await HoldAdvisoryLockAsync(database, PaymentLockKey(state.BookingId));

        var first = CaptureMarkPaidAsync(database, state.FirstPaymentId);
        var second = CaptureMarkPaidAsync(database, state.SecondPaymentId);
        await WaitForAdvisoryWaitersAsync(database, 2);
        await gate.CommitAsync();

        var outcomes = await Task.WhenAll(first, second);
        await using var verify = database.CreateDbContext();
        var ordinaryPaid = await OrdinaryPaidAsync(verify, state.BookingId);
        var capacity = await CurrentCapacityAsync(verify, state.BookingId);
        _output.WriteLine(
            "Concurrent outcomes: success={0}, conflict={1}, ordinaryPaid={2}, capacity={3}",
            outcomes.Count(outcome => outcome.Payment is not null),
            outcomes.Count(outcome => outcome.Error is not null),
            ordinaryPaid,
            capacity);

        Assert.Equal(6_000m, ordinaryPaid);
        Assert.Equal(FallbackCapacity, capacity);
        Assert.Single(outcomes, outcome => outcome.Payment is not null);
        var rejection = Assert.Single(outcomes, outcome => outcome.Error is not null).Error!;
        Assert.Null(rejection.Code);
        Assert.Contains("this would result in an overpayment", rejection.Message);

        Assert.Equal(4_000m, capacity - ordinaryPaid);
        Assert.False(await verify.OwnerPayouts.AnyAsync(payout => payout.BookingId == state.BookingId));
        var recorded = await verify.ReportingFinanceDailySummaries.SingleAsync();
        Assert.Equal(0m, recorded.TotalPaidAmount);
        Assert.Equal(6_000m, recorded.OrdinaryUnlinkedPaidAmount);
    }

    [Fact]
    public async Task ConcurrentMarkPaidAllowsTwoPaymentsThatExactlyFitCapacity()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        var state = await CreateShrunkCapacityStateAsync(database, 6_000m, 4_000m);
        await using var gate = await HoldAdvisoryLockAsync(database, PaymentLockKey(state.BookingId));

        var first = CaptureMarkPaidAsync(database, state.FirstPaymentId);
        var second = CaptureMarkPaidAsync(database, state.SecondPaymentId);
        await WaitForAdvisoryWaitersAsync(database, 2);
        await gate.CommitAsync();

        var outcomes = await Task.WhenAll(first, second);
        Assert.All(outcomes, outcome => Assert.NotNull(outcome.Payment));
        await using var verify = database.CreateDbContext();
        Assert.Equal(FallbackCapacity, await OrdinaryPaidAsync(verify, state.BookingId));
        Assert.Equal(FallbackCapacity, await CurrentCapacityAsync(verify, state.BookingId));
    }

    [Fact]
    public async Task ConcurrentMarkPaidForSamePaymentTransitionsExactlyOnce()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        var state = await CreateActiveCapacityStateAsync(
            database, [FallbackCapacity], linkPaymentsToInvoice: true);
        await using var gate = await HoldAdvisoryLockAsync(database, PaymentLockKey(state.BookingId));

        var first = CaptureMarkPaidAsync(database, state.PaymentIds[0]);
        var second = CaptureMarkPaidAsync(database, state.PaymentIds[0]);
        await WaitForAdvisoryWaitersAsync(database, 2);
        await gate.CommitAsync();

        var outcomes = await Task.WhenAll(first, second);
        Assert.Single(outcomes, outcome => outcome.Payment is not null);
        var rejection = Assert.Single(outcomes, outcome => outcome.Error is not null).Error!;
        Assert.Null(rejection.Code);
        Assert.Contains("current status is 'paid'", rejection.Message);

        await using var verify = database.CreateDbContext();
        var payment = await verify.Payments.SingleAsync(row => row.Id == state.PaymentIds[0]);
        var invoice = await verify.Invoices.SingleAsync(row => row.Id == state.InvoiceId);
        Assert.Equal("paid", payment.PaymentStatus);
        Assert.NotNull(payment.PaidAt);
        Assert.Equal("paid", invoice.InvoiceStatus);
        Assert.Equal(FallbackCapacity, await OrdinaryPaidAsync(verify, state.BookingId));
    }

    [Fact]
    public async Task WaitingMarkPaidReReadsPaymentStatusAfterBookingLock()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        var state = await CreatePendingAtFallbackAsync(database, 6_000m);
        await using var gate = await HoldAdvisoryLockAsync(database, PaymentLockKey(state.BookingId));

        var markPaid = CaptureMarkPaidAsync(database, state.PaymentId);
        await WaitForAdvisoryWaitersAsync(database, 1);
        await using (var cancelContext = database.CreateDbContext())
        {
            await new PaymentService(new UnitOfWork(cancelContext))
                .CancelAsync(state.PaymentId, "PAY-OPS-01 stale-state proof");
        }
        await gate.CommitAsync();

        var outcome = await markPaid;
        Assert.Null(outcome.Payment);
        Assert.Contains("current status is 'cancelled'", outcome.Error!.Message);
        await using var verify = database.CreateDbContext();
        Assert.Equal("cancelled", await verify.Payments
            .Where(payment => payment.Id == state.PaymentId)
            .Select(payment => payment.PaymentStatus)
            .SingleAsync());
        Assert.Equal(0m, await OrdinaryPaidAsync(verify, state.BookingId));
    }

    [Fact]
    public async Task MarkPaidReloadsAlreadyTrackedPaymentBeforeStatusValidation()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        await using var callerContext = database.CreateDbContext();
        var booking = await SeedBookingAsync(callerContext);
        var callerService = new PaymentService(new UnitOfWork(callerContext));
        var trackedPayment = await callerService.CreateAsync(
            booking.Id,
            null,
            "cash",
            6_000m,
            null,
            "PAY-OPS-01 tracked-state reload proof");

        Assert.Equal(EntityState.Unchanged, callerContext.Entry(trackedPayment).State);
        Assert.Equal("pending", trackedPayment.PaymentStatus);

        await using (var externalContext = database.CreateDbContext())
        {
            await new PaymentService(new UnitOfWork(externalContext))
                .CancelAsync(trackedPayment.Id, "PAY-OPS-01 external cancellation");
        }

        await using (var databaseTruth = database.CreateDbContext())
        {
            var persisted = await databaseTruth.Payments.AsNoTracking()
                .SingleAsync(payment => payment.Id == trackedPayment.Id);
            Assert.Equal("cancelled", persisted.PaymentStatus);
            Assert.Null(persisted.PaidAt);
        }

        Assert.Equal("pending", trackedPayment.PaymentStatus);
        var conflict = await Assert.ThrowsAsync<ConflictException>(() =>
            callerService.MarkPaidAsync(trackedPayment.Id, null, "must observe cancellation"));
        Assert.Null(conflict.Code);
        Assert.Equal(
            $"Payment {trackedPayment.Id} cannot be marked as paid: current status is 'cancelled'. " +
            "Only pending payments can be marked as paid.",
            conflict.Message);

        await using var verify = database.CreateDbContext();
        var finalPayment = await verify.Payments.AsNoTracking()
            .SingleAsync(payment => payment.Id == trackedPayment.Id);
        Assert.Equal("cancelled", finalPayment.PaymentStatus);
        Assert.Null(finalPayment.PaidAt);
        Assert.Equal(6_000m, finalPayment.Amount);
        Assert.False(finalPayment.IsHistoricalRecord);
        Assert.Equal(0m, await OrdinaryPaidAsync(verify, booking.Id));
        Assert.False(await verify.Invoices.AnyAsync(invoice => invoice.BookingId == booking.Id));
        Assert.False(await verify.OwnerPayouts.AnyAsync(payout => payout.BookingId == booking.Id));
    }

    [Fact]
    public async Task ConcurrentMarkPaidAndCreateShareReservationBoundary()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        var state = await CreatePendingAtFallbackAsync(database, 6_000m);
        await using var gate = await HoldAdvisoryLockAsync(database, PaymentLockKey(state.BookingId));

        var markPaid = CaptureMarkPaidAsync(database, state.PaymentId);
        var create = CaptureCreateAsync(database, state.BookingId, 4_000m);
        await WaitForAdvisoryWaitersAsync(database, 2);
        await gate.CommitAsync();

        var paidOutcome = await markPaid;
        var createOutcome = await create;
        Assert.NotNull(paidOutcome.Payment);
        Assert.NotNull(createOutcome.Payment);

        await using var verify = database.CreateDbContext();
        var committed = await OrdinaryCommittedAsync(verify, state.BookingId);
        Assert.Equal(FallbackCapacity, committed);

        var service = new PaymentService(new UnitOfWork(verify));
        var rejection = await Assert.ThrowsAsync<ConflictException>(() => service.CreateAsync(
            state.BookingId, null, "cash", 0.01m, null, "PAY-OPS-01 real overpayment"));
        Assert.Null(rejection.Code);
        Assert.Contains("exceeds the remaining balance", rejection.Message);
    }

    [Fact]
    public async Task ConcurrentMarkPaidAndInvoiceCancelCannotCommitPaidAboveFinalCapacity()
    {
        var runId = Guid.NewGuid().ToString("N");
        await using var database = await _fixture.CreateTestDatabaseAsync();
        var state = await CreateActiveCapacityStateAsync(
            database, [12_000m], linkPaymentsToInvoice: false);
        await using var gate = await HoldAdvisoryLockAsync(database, PaymentLockKey(state.BookingId));

        _output.WriteLine(
            "PAY-OPS-F01 run={0} markPaidStart={1:O} booking={2} invoice={3} payment={4}",
            runId,
            DateTime.UtcNow,
            state.BookingId,
            state.InvoiceId,
            state.PaymentIds[0]);
        var markPaid = CaptureMarkPaidAsync(database, state.PaymentIds[0]);
        _output.WriteLine("PAY-OPS-F01 run={0} cancelStart={1:O}", runId, DateTime.UtcNow);
        var cancel = CaptureInvoiceCancelAsync(database, state.InvoiceId);
        var waiters = await WaitForAdvisoryWaitersOnKeyAsync(
            database,
            PaymentLockKey(state.BookingId),
            2);
        _output.WriteLine(
            "PAY-OPS-F01 run={0} paymentLockWaiters={1} waiterPids={2}",
            runId,
            waiters.Count,
            string.Join(',', waiters));
        await gate.CommitAsync();

        var paymentOutcome = await markPaid;
        var cancelOutcome = await cancel;
        var truth = await ReadMarkPaidCancelTruthAsync(database, state);
        _output.WriteLine(
            "PAY-OPS-F01 run={0} markPaidResult={1} cancelResult={2} " +
            "invoiceStatus={3} activeInvoice={4} finalAmount={5} capacity={6} " +
            "paymentStatus={7} paymentInvoice={8} ordinaryPaid={9} ordinaryPending={10} " +
            "ordinaryCommitment={11} paidWithinCapacity={12} commitmentWithinCapacity={13}",
            runId,
            paymentOutcome.Payment is not null ? "success" : paymentOutcome.Error?.Message,
            cancelOutcome.Invoice is not null ? "success" : cancelOutcome.Error?.Message,
            truth.InvoiceStatus,
            truth.ActiveInvoiceId,
            truth.BookingFinalAmount,
            truth.EffectiveCapacity,
            truth.PaymentStatus,
            truth.PaymentInvoiceId,
            truth.OrdinaryPaid,
            truth.OrdinaryPending,
            truth.OrdinaryCommitment,
            truth.PaidWithinCapacity,
            truth.CommitmentWithinCapacity);
        Assert.NotNull(paymentOutcome.Payment);
        Assert.Null(paymentOutcome.Error);
        Assert.Null(cancelOutcome.Invoice);
        AssertTruthfulCancelConflict(cancelOutcome.Error!, state.InvoiceId);
        AssertCanonicalMarkPaidCancelTruth(truth, state);
    }

    [Fact]
    public async Task MarkPaidFirstMakesWaitingInvoiceCancelObservePaidInvoice()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        var state = await CreateActiveCapacityStateAsync(
            database, [12_000m], linkPaymentsToInvoice: false);
        await using var paymentContext = database.CreateDbContext();
        await using var paymentTransaction = await paymentContext.Database.BeginTransactionAsync();

        var payment = await new PaymentService(new UnitOfWork(paymentContext))
            .MarkPaidAsync(state.PaymentIds[0], null, "PAY-OPS-F01 mark-paid-first");
        Assert.Equal("paid", payment.PaymentStatus);

        var cancel = CaptureInvoiceCancelAsync(database, state.InvoiceId);
        await WaitForAdvisoryWaitersOnKeyAsync(
            database,
            PaymentLockKey(state.BookingId),
            1);
        await paymentTransaction.CommitAsync();

        var cancelOutcome = await cancel;
        Assert.Null(cancelOutcome.Invoice);
        Assert.Equal("mark-paid-first", AssertTruthfulCancelConflict(
            cancelOutcome.Error!, state.InvoiceId));
        AssertCanonicalMarkPaidCancelTruth(
            await ReadMarkPaidCancelTruthAsync(database, state),
            state);
    }

    [Fact]
    public async Task CancelValidationFirstReportsReservationConflictThenMarkPaidSucceeds()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        var state = await CreateActiveCapacityStateAsync(
            database, [12_000m], linkPaymentsToInvoice: false);
        await using var cancelContext = database.CreateDbContext();
        await using var cancelTransaction = await cancelContext.Database.BeginTransactionAsync();

        var cancelConflict = await Assert.ThrowsAsync<ConflictException>(() =>
            new InvoiceService(new UnitOfWork(cancelContext))
                .CancelAsync(state.InvoiceId, "PAY-OPS-F01 cancel-validation-first"));
        Assert.Equal("cancel-validation-first", AssertTruthfulCancelConflict(
            cancelConflict, state.InvoiceId));

        var markPaid = CaptureMarkPaidAsync(database, state.PaymentIds[0]);
        await WaitForAdvisoryWaitersOnKeyAsync(
            database,
            PaymentLockKey(state.BookingId),
            1);
        await cancelTransaction.RollbackAsync();

        var paymentOutcome = await markPaid;
        Assert.NotNull(paymentOutcome.Payment);
        Assert.Null(paymentOutcome.Error);
        AssertCanonicalMarkPaidCancelTruth(
            await ReadMarkPaidCancelTruthAsync(database, state),
            state);
    }

    [Fact]
    public async Task ReissueWhileMarkPaidWaitsPreservesCapacityAndInvoiceLink()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        var state = await CreateActiveCapacityStateAsync(
            database, [12_000m], linkPaymentsToInvoice: false);
        await using var gate = await HoldAdvisoryLockAsync(database, PaymentLockKey(state.BookingId));

        var markPaid = CaptureMarkPaidAsync(database, state.PaymentIds[0]);
        await WaitForAdvisoryWaitersAsync(database, 1);
        var replacement = await CompleteWithinAsync(
            CaptureReissueAsync(database, state.InvoiceId),
            TimeSpan.FromSeconds(10),
            "Invoice reissue should not wait on the payment lock because it preserves capacity.");
        await gate.CommitAsync();

        var paymentOutcome = await markPaid;
        Assert.NotNull(paymentOutcome.Payment);
        await using var verify = database.CreateDbContext();
        var payment = await verify.Payments.SingleAsync(row => row.Id == state.PaymentIds[0]);
        Assert.Equal(replacement.Id, payment.InvoiceId);
        Assert.Equal(12_000m, await OrdinaryPaidAsync(verify, state.BookingId));
        Assert.True(await CurrentCapacityAsync(verify, state.BookingId) >= 12_000m);
    }

    [Fact]
    public async Task MarkPaidWhileReissueWaitsPreservesCapacityAndTransferredPaymentState()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        var state = await CreateActiveCapacityStateAsync(
            database, [12_000m], linkPaymentsToInvoice: false);
        await using var gate = await HoldAdvisoryLockAsync(
            database, InvoiceMutationLocks.ForInvoice(state.InvoiceId));

        var reissue = CaptureReissueAsync(database, state.InvoiceId);
        await WaitForAdvisoryWaitersAsync(database, 1);
        var markPaid = CaptureMarkPaidAsync(database, state.PaymentIds[0]);
        await WaitForAdvisoryWaitersAsync(database, 2);
        await gate.CommitAsync();
        var replacement = await CompleteWithinAsync(
            reissue,
            TimeSpan.FromSeconds(10),
            "Reissue and MarkPaid must complete without an invoice-lock deadlock.");
        var markPaidOutcome = await markPaid;
        Assert.NotNull(markPaidOutcome.Payment);

        await using var verify = database.CreateDbContext();
        var payment = await verify.Payments.SingleAsync(row => row.Id == state.PaymentIds[0]);
        Assert.Equal("paid", payment.PaymentStatus);
        Assert.Equal(replacement.Id, payment.InvoiceId);
        Assert.Equal(12_000m, await OrdinaryPaidAsync(verify, state.BookingId));
        Assert.True(await CurrentCapacityAsync(verify, state.BookingId) >= 12_000m);
    }

    [Fact]
    public async Task PaymentLocksRemainIndependentAcrossBookings()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        var first = await CreatePendingAtFallbackAsync(database, 4_000m);
        var second = await CreatePendingAtFallbackAsync(database, 4_000m);
        await using var gate = await HoldAdvisoryLockAsync(database, PaymentLockKey(first.BookingId));

        var blocked = CaptureMarkPaidAsync(database, first.PaymentId);
        await WaitForAdvisoryWaitersAsync(database, 1);
        var independent = await CompleteWithinAsync(
            CaptureMarkPaidAsync(database, second.PaymentId),
            TimeSpan.FromSeconds(10),
            "A different booking should not wait on another booking's settlement lock.");
        Assert.NotNull(independent.Payment);
        await gate.CommitAsync();
        Assert.NotNull((await blocked).Payment);
    }

    [Fact]
    public async Task MarkPaidComposesWithCallerOwnedTransactionWithoutCommittingIt()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        var state = await CreatePendingAtFallbackAsync(database, 4_000m);
        await using var context = database.CreateDbContext();
        await using var transaction = await context.Database.BeginTransactionAsync();

        var service = new PaymentService(new UnitOfWork(context));
        await service.MarkPaidAsync(state.PaymentId, null, "PAY-OPS-01 caller transaction");

        await using (var observer = database.CreateDbContext())
        {
            Assert.Equal("pending", await observer.Payments
                .Where(payment => payment.Id == state.PaymentId)
                .Select(payment => payment.PaymentStatus)
                .SingleAsync());
        }

        await transaction.CommitAsync();
        await using var verify = database.CreateDbContext();
        Assert.Equal("paid", await verify.Payments
            .Where(payment => payment.Id == state.PaymentId)
            .Select(payment => payment.PaymentStatus)
            .SingleAsync());
    }

    [Fact]
    public async Task NaturalConcurrentMarkPaidNeverExceedsLegacyCapacityAcrossTwelveFreshDatabases()
    {
        var violations = 0;
        for (var attempt = 0; attempt < 12; attempt++)
        {
            await using var database = await _fixture.CreateTestDatabaseAsync();
            var state = await CreateShrunkCapacityStateAsync(database, 6_000m, 6_000m);
            var start = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
            var first = StartTogetherAsync(start.Task, database, state.FirstPaymentId);
            var second = StartTogetherAsync(start.Task, database, state.SecondPaymentId);
            start.SetResult();
            await Task.WhenAll(first, second);

            await using var verify = database.CreateDbContext();
            var paid = await OrdinaryPaidAsync(verify, state.BookingId);
            var capacity = await CurrentCapacityAsync(verify, state.BookingId);
            if (paid > capacity)
                violations++;
        }

        _output.WriteLine("Natural concurrency attempts=12, violations={0}", violations);
        Assert.Equal(0, violations);
    }

    private async Task<RaceState> CreateShrunkCapacityStateAsync(
        PostgreSqlTestDatabase database,
        decimal firstAmount,
        decimal secondAmount)
    {
        var active = await CreateActiveCapacityStateAsync(
            database, [firstAmount, secondAmount], linkPaymentsToInvoice: false);
        await using var context = database.CreateDbContext();
        var unitOfWork = new UnitOfWork(context);
        var invoices = new InvoiceService(unitOfWork);
        if (firstAmount + secondAmount <= FallbackCapacity)
        {
            await invoices.CancelAsync(active.InvoiceId, "Valid capacity shrink");
        }
        else
        {
            // INV-OPS-02 now rejects this supported mutation. Keep PAY-OPS-01 accountable
            // for legacy rows that may already predate the capacity-shrink invariant.
            var invoice = await context.Invoices.SingleAsync(row => row.Id == active.InvoiceId);
            invoice.InvoiceStatus = "cancelled";
            invoice.UpdatedAt = DateTime.UtcNow;
            await context.SaveChangesAsync();
        }

        context.ChangeTracker.Clear();
        Assert.Equal(FallbackCapacity, await CurrentCapacityAsync(context, active.BookingId));
        Assert.Equal(firstAmount + secondAmount, await context.Payments
            .Where(payment => payment.BookingId == active.BookingId
                && !payment.IsHistoricalRecord
                && payment.PaymentStatus == "pending")
            .SumAsync(payment => payment.Amount));
        return new RaceState(
            active.BookingId,
            active.InvoiceId,
            active.PaymentIds[0],
            active.PaymentIds[1]);
    }

    private static async Task<ActiveCapacityState> CreateActiveCapacityStateAsync(
        PostgreSqlTestDatabase database,
        IReadOnlyList<decimal> paymentAmounts,
        bool linkPaymentsToInvoice)
    {
        await using var context = database.CreateDbContext();
        var booking = await SeedBookingAsync(context);
        var unitOfWork = new UnitOfWork(context);
        var invoices = new InvoiceService(unitOfWork);
        var payments = new PaymentService(unitOfWork);

        var draft = await invoices.CreateDraftFromBookingAsync(
            booking.Id, $"PAY-OPS-{Guid.NewGuid():N}", "PAY-OPS-01 supported setup");
        var requiredCapacity = paymentAmounts.Sum();
        var invoice = draft;
        if (requiredCapacity > draft.TotalAmount)
        {
            // Raise active capacity exactly to the supported pending reservations.
            invoice = await invoices.AddManualAdjustmentAsync(
                draft.Id,
                "Supported capacity increase",
                1,
                requiredCapacity - draft.TotalAmount);
        }

        Assert.True(invoice.TotalAmount >= requiredCapacity);
        var issued = await invoices.IssueAsync(invoice.Id);
        var paymentIds = new List<Guid>();
        foreach (var amount in paymentAmounts)
        {
            var payment = await payments.CreateAsync(
                booking.Id,
                linkPaymentsToInvoice ? issued.Id : null,
                "cash",
                amount,
                null,
                "PAY-OPS-01 pending reservation");
            paymentIds.Add(payment.Id);
        }

        return new ActiveCapacityState(booking.Id, issued.Id, paymentIds);
    }

    private static async Task<PendingState> CreatePendingAtFallbackAsync(
        PostgreSqlTestDatabase database,
        decimal amount)
    {
        await using var context = database.CreateDbContext();
        var booking = await SeedBookingAsync(context);
        var payment = await new PaymentService(new UnitOfWork(context)).CreateAsync(
            booking.Id, null, "cash", amount, null, "PAY-OPS-01 fallback reservation");
        return new PendingState(booking.Id, payment.Id);
    }

    private static async Task<Booking> SeedBookingAsync(AppDbContext context)
    {
        var suffix = Guid.NewGuid().ToString("N");
        var owner = new Owner
        {
            Id = Guid.NewGuid(), Name = "PAY-OPS-01 owner", Phone = TestPhone("20"),
            EmergencyPhone = TestPhone("21"), CommissionRate = 10m, Status = "active",
            PasswordHash = "test-only-hash"
        };
        var project = new Project
        {
            Id = Guid.NewGuid(), Name = $"PAY-OPS-01 project {suffix}", IsActive = true
        };
        var client = new Client
        {
            Id = Guid.NewGuid(), Name = "PAY-OPS-01 client", Phone = TestPhone("22"),
            PasswordHash = "test-only-hash", IsActive = true
        };
        var unit = new Unit
        {
            Id = Guid.NewGuid(), OwnerId = owner.Id, ProjectId = project.Id,
            Name = $"PAY-OPS-01 unit {suffix}", UnitType = "apartment",
            Bedrooms = 2, Bathrooms = 1, MaxGuests = 4, BasePricePerNight = 1_000m,
            IsActive = true, IsVisibleInPortfolio = true
        };
        var booking = new Booking
        {
            Id = Guid.NewGuid(), ClientId = client.Id, UnitId = unit.Id, OwnerId = owner.Id,
            BookingStatus = BookingStatus.Booked,
            CheckInDate = new DateOnly(2026, 10, 1), CheckOutDate = new DateOnly(2026, 10, 11),
            GuestCount = 2, BaseAmount = FallbackCapacity, FinalAmount = FallbackCapacity,
            Source = "admin", IsHistorical = false
        };
        context.AddRange(owner, project, client, unit, booking);
        await context.SaveChangesAsync();
        return booking;
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

    private static async Task<PaymentOutcome> CaptureMarkPaidAsync(
        PostgreSqlTestDatabase database,
        Guid paymentId)
    {
        await using var context = database.CreateDbContext();
        try
        {
            var payment = await new PaymentService(new UnitOfWork(context))
                .MarkPaidAsync(paymentId, null, "PAY-OPS-01 concurrent settlement");
            return new PaymentOutcome(payment, null);
        }
        catch (ConflictException error)
        {
            return new PaymentOutcome(null, error);
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
                bookingId, null, "bank_transfer", amount, null, "PAY-OPS-01 concurrent reservation");
            return new PaymentOutcome(payment, null);
        }
        catch (ConflictException error)
        {
            return new PaymentOutcome(null, error);
        }
    }

    private static async Task<InvoiceOutcome> CaptureInvoiceCancelAsync(
        PostgreSqlTestDatabase database,
        Guid invoiceId)
    {
        await using var context = database.CreateDbContext();
        try
        {
            var invoice = await new InvoiceService(new UnitOfWork(context))
                .CancelAsync(invoiceId, "PAY-OPS-01 concurrent capacity shrink");
            return new InvoiceOutcome(invoice, null);
        }
        catch (ConflictException error)
        {
            return new InvoiceOutcome(null, error);
        }
    }

    private static async Task<Invoice> CaptureReissueAsync(
        PostgreSqlTestDatabase database,
        Guid invoiceId)
    {
        await using var context = database.CreateDbContext();
        return await new InvoiceService(new UnitOfWork(context)).ReissueAsync(
            invoiceId,
            $"PAY-OPS-REISSUE-{Guid.NewGuid():N}",
            "PAY-OPS-01 capacity-preserving reissue");
    }

    private static async Task<PaymentOutcome> StartTogetherAsync(
        Task start,
        PostgreSqlTestDatabase database,
        Guid paymentId)
    {
        await start;
        return await CaptureMarkPaidAsync(database, paymentId);
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
            var count = Convert.ToInt32(await command.ExecuteScalarAsync());
            if (count >= expectedCount)
                return;
            await Task.Delay(25);
        }

        Assert.Fail($"Expected at least {expectedCount} advisory-lock waiter(s).");
    }

    private static async Task<IReadOnlyList<int>> WaitForAdvisoryWaitersOnKeyAsync(
        PostgreSqlTestDatabase database,
        string resourceKey,
        int expectedCount)
    {
        var deadline = DateTime.UtcNow.AddSeconds(10);
        while (DateTime.UtcNow < deadline)
        {
            await using var connection = await database.OpenConnectionAsync();
            await using var command = new NpgsqlCommand(
                """
                SELECT activity.pid
                FROM pg_locks AS locks
                JOIN pg_stat_activity AS activity ON activity.pid = locks.pid
                WHERE activity.datname = @database_name
                  AND locks.locktype = 'advisory'
                  AND NOT locks.granted
                  AND locks.classid = (
                      (hashtextextended(@resource_key, 0) >> 32) & 4294967295)::OID
                  AND locks.objid = (
                      hashtextextended(@resource_key, 0) & 4294967295)::OID
                ORDER BY activity.pid
                """,
                connection);
            command.Parameters.AddWithValue("database_name", database.DatabaseName);
            command.Parameters.AddWithValue("resource_key", resourceKey);
            var pids = new List<int>();
            await using var reader = await command.ExecuteReaderAsync();
            while (await reader.ReadAsync())
                pids.Add(reader.GetInt32(0));
            if (pids.Count >= expectedCount)
                return pids;
            await Task.Delay(25);
        }

        Assert.Fail(
            $"Expected at least {expectedCount} waiter(s) on advisory key '{resourceKey}'.");
        return [];
    }

    private static string AssertTruthfulCancelConflict(
        ConflictException conflict,
        Guid invoiceId)
    {
        Assert.Null(conflict.Code);
        if (conflict.Message ==
            $"Invoice {invoiceId} cannot be cancelled: invoice is already paid.")
        {
            return "mark-paid-first";
        }

        Assert.Contains("Cannot reduce settlement capacity to 10000.00", conflict.Message);
        Assert.Contains("12000.00 of ordinary paid and pending payment commitments remain", conflict.Message);
        Assert.Contains("(paid: 0.00, pending: 12000.00)", conflict.Message);
        return "cancel-validation-first";
    }

    private static void AssertCanonicalMarkPaidCancelTruth(
        MarkPaidCancelTruth truth,
        ActiveCapacityState state)
    {
        Assert.Equal(FallbackCapacity, truth.BookingFinalAmount);
        Assert.Equal(12_000m, truth.EffectiveCapacity);
        Assert.Equal(state.InvoiceId, truth.ActiveInvoiceId);
        Assert.Equal("paid", truth.ActiveInvoiceStatus);
        Assert.Equal("paid", truth.InvoiceStatus);
        Assert.Equal(12_000m, truth.InvoiceTotal);
        Assert.Equal("paid", truth.PaymentStatus);
        Assert.Equal(state.InvoiceId, truth.PaymentInvoiceId);
        Assert.Equal(12_000m, truth.PaymentAmount);
        Assert.Equal(12_000m, truth.OrdinaryPaid);
        Assert.Equal(0m, truth.OrdinaryPending);
        Assert.Equal(12_000m, truth.OrdinaryCommitment);
        Assert.True(truth.PaidWithinCapacity);
        Assert.True(truth.CommitmentWithinCapacity);
        Assert.Equal(1, truth.OrdinaryPaymentCount);
        Assert.Equal(0, truth.PayoutCount);
    }

    private static async Task<MarkPaidCancelTruth> ReadMarkPaidCancelTruthAsync(
        PostgreSqlTestDatabase database,
        ActiveCapacityState state)
    {
        await using var connection = await database.OpenConnectionAsync();
        await using var command = new NpgsqlCommand(
            """
            WITH active_invoice AS (
                SELECT id, invoice_status, total_amount
                FROM invoices
                WHERE booking_id = @booking_id
                  AND invoice_status NOT IN ('cancelled', 'superseded')
                ORDER BY created_at, id
                LIMIT 1
            ),
            commitments AS (
                SELECT
                    COALESCE(SUM(amount) FILTER (WHERE payment_status = 'paid'), 0) AS paid,
                    COALESCE(SUM(amount) FILTER (WHERE payment_status = 'pending'), 0) AS pending,
                    COUNT(*) AS payment_count
                FROM payments
                WHERE booking_id = @booking_id
                  AND NOT is_historical_record
                  AND payment_status IN ('paid', 'pending')
            )
            SELECT
                booking.final_amount,
                COALESCE(active_invoice.total_amount, booking.final_amount) AS effective_capacity,
                active_invoice.id,
                active_invoice.invoice_status,
                target_invoice.invoice_status,
                target_invoice.total_amount,
                payment.payment_status,
                payment.invoice_id,
                payment.amount,
                commitments.paid,
                commitments.pending,
                commitments.paid + commitments.pending AS commitment,
                commitments.paid <= COALESCE(active_invoice.total_amount, booking.final_amount),
                commitments.paid + commitments.pending
                    <= COALESCE(active_invoice.total_amount, booking.final_amount),
                commitments.payment_count,
                (SELECT COUNT(*) FROM owner_payouts WHERE booking_id = @booking_id)
            FROM bookings AS booking
            JOIN invoices AS target_invoice ON target_invoice.id = @invoice_id
            JOIN payments AS payment ON payment.id = @payment_id
            LEFT JOIN active_invoice ON TRUE
            CROSS JOIN commitments
            WHERE booking.id = @booking_id
            """,
            connection);
        command.Parameters.AddWithValue("booking_id", state.BookingId);
        command.Parameters.AddWithValue("invoice_id", state.InvoiceId);
        command.Parameters.AddWithValue("payment_id", state.PaymentIds[0]);
        await using var reader = await command.ExecuteReaderAsync();
        Assert.True(await reader.ReadAsync());
        return new MarkPaidCancelTruth(
            reader.GetDecimal(0),
            reader.GetDecimal(1),
            reader.IsDBNull(2) ? null : reader.GetGuid(2),
            reader.IsDBNull(3) ? null : reader.GetString(3),
            reader.GetString(4),
            reader.GetDecimal(5),
            reader.GetString(6),
            reader.IsDBNull(7) ? null : reader.GetGuid(7),
            reader.GetDecimal(8),
            reader.GetDecimal(9),
            reader.GetDecimal(10),
            reader.GetDecimal(11),
            reader.GetBoolean(12),
            reader.GetBoolean(13),
            reader.GetInt64(14),
            reader.GetInt64(15));
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

    private static Task<decimal> OrdinaryPaidAsync(AppDbContext context, Guid bookingId) =>
        context.Payments
            .Where(payment => payment.BookingId == bookingId
                && !payment.IsHistoricalRecord
                && payment.PaymentStatus == "paid")
            .SumAsync(payment => payment.Amount);

    private static Task<decimal> OrdinaryCommittedAsync(AppDbContext context, Guid bookingId) =>
        context.Payments
            .Where(payment => payment.BookingId == bookingId
                && !payment.IsHistoricalRecord
                && (payment.PaymentStatus == "paid" || payment.PaymentStatus == "pending"))
            .SumAsync(payment => payment.Amount);

    private static async Task<decimal> CurrentCapacityAsync(AppDbContext context, Guid bookingId)
    {
        var invoiceAmount = await context.Invoices
            .Where(invoice => invoice.BookingId == bookingId
                && invoice.InvoiceStatus != "cancelled"
                && invoice.InvoiceStatus != "superseded")
            .Select(invoice => (decimal?)invoice.TotalAmount)
            .FirstOrDefaultAsync();
        return invoiceAmount ?? await context.Bookings
            .Where(booking => booking.Id == bookingId)
            .Select(booking => booking.FinalAmount)
            .SingleAsync();
    }

    private static string PaymentLockKey(Guid bookingId) => $"payment-booking:{bookingId:N}";

    private static string TestPhone(string prefix)
    {
        var value = BitConverter.ToUInt32(Guid.NewGuid().ToByteArray(), 0) % 10_000_000_000L;
        return $"+{prefix}{value:D10}";
    }

    private sealed record RaceState(
        Guid BookingId,
        Guid InvoiceId,
        Guid FirstPaymentId,
        Guid SecondPaymentId);

    private sealed record PaymentOutcome(Payment? Payment, ConflictException? Error);

    private sealed record InvoiceOutcome(Invoice? Invoice, ConflictException? Error);

    private sealed record ActiveCapacityState(
        Guid BookingId,
        Guid InvoiceId,
        IReadOnlyList<Guid> PaymentIds);

    private sealed record MarkPaidCancelTruth(
        decimal BookingFinalAmount,
        decimal EffectiveCapacity,
        Guid? ActiveInvoiceId,
        string? ActiveInvoiceStatus,
        string InvoiceStatus,
        decimal InvoiceTotal,
        string PaymentStatus,
        Guid? PaymentInvoiceId,
        decimal PaymentAmount,
        decimal OrdinaryPaid,
        decimal OrdinaryPending,
        decimal OrdinaryCommitment,
        bool PaidWithinCapacity,
        bool CommitmentWithinCapacity,
        long OrdinaryPaymentCount,
        long PayoutCount);

    private sealed record PendingState(Guid BookingId, Guid PaymentId);

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
