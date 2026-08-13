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
        await using var database = await _fixture.CreateTestDatabaseAsync();
        var state = await CreateActiveCapacityStateAsync(
            database, [12_000m], linkPaymentsToInvoice: false);
        await using var gate = await HoldAdvisoryLockAsync(database, PaymentLockKey(state.BookingId));

        var markPaid = CaptureMarkPaidAsync(database, state.PaymentIds[0]);
        var cancel = CaptureInvoiceCancelAsync(database, state.InvoiceId);
        await WaitForAdvisoryWaitersAsync(database, 2);
        await gate.CommitAsync();

        var paymentOutcome = await markPaid;
        var cancelOutcome = await cancel;
        Assert.NotEqual(paymentOutcome.Payment is not null, cancelOutcome.Invoice is not null);

        await using var verify = database.CreateDbContext();
        var ordinaryPaid = await OrdinaryPaidAsync(verify, state.BookingId);
        var capacity = await CurrentCapacityAsync(verify, state.BookingId);
        Assert.True(ordinaryPaid <= capacity, $"Paid {ordinaryPaid} exceeded capacity {capacity}.");
        if (cancelOutcome.Invoice is not null)
        {
            Assert.Equal(0m, ordinaryPaid);
            Assert.Equal(FallbackCapacity, capacity);
            Assert.Contains("overpayment", paymentOutcome.Error!.Message);
        }
        else
        {
            Assert.Equal(12_000m, ordinaryPaid);
            Assert.True(capacity >= 12_000m);
            Assert.Contains("already paid", cancelOutcome.Error!.Message);
        }
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
