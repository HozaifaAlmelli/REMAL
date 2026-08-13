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
public sealed class InvoiceCrossWriterConcurrencyPostgreSqlTests
{
    private const decimal InitialAmount = 10_000m;
    private readonly PostgreSqlFixture _fixture;

    public InvoiceCrossWriterConcurrencyPostgreSqlTests(PostgreSqlFixture fixture)
    {
        _fixture = fixture;
    }

    [Fact]
    public async Task AdjustmentCommitBeforeIssueProducesIssuedCanonicalTotal()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        var state = await CreateDraftAsync(database);
        await using var adjustmentContext = database.CreateDbContext();
        await using var adjustmentTransaction = await adjustmentContext.Database.BeginTransactionAsync();

        await new InvoiceService(new UnitOfWork(adjustmentContext))
            .AddManualAdjustmentAsync(state.InvoiceId, "Adjustment wins", 1, 2_000m);

        var issue = CaptureIssueAsync(database, state.InvoiceId);
        await WaitForAdvisoryWaitersAsync(database, 1);
        await AssertInvoiceTruthAsync(database, state.InvoiceId, 10_000m, 1, "draft");
        await adjustmentTransaction.CommitAsync();

        Assert.NotNull((await issue).Invoice);
        await AssertInvoiceTruthAsync(database, state.InvoiceId, 12_000m, 2, "issued");
    }

    [Fact]
    public async Task IssueCommitBeforeAdjustmentRejectsWithoutPartialItem()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        var state = await CreateDraftAsync(database);
        await using var issueContext = database.CreateDbContext();
        await using var issueTransaction = await issueContext.Database.BeginTransactionAsync();

        await new InvoiceService(new UnitOfWork(issueContext)).IssueAsync(state.InvoiceId);

        var adjustment = CaptureAdjustmentAsync(database, state.InvoiceId, 2_000m);
        await WaitForAdvisoryWaitersAsync(database, 1);
        await AssertInvoiceTruthAsync(database, state.InvoiceId, 10_000m, 1, "draft");
        await issueTransaction.CommitAsync();

        AssertNonDraftAdjustmentConflict((await adjustment).Error, state.InvoiceId, "issued");
        await AssertInvoiceTruthAsync(database, state.InvoiceId, 10_000m, 1, "issued");
    }

    [Fact]
    public async Task StaleTrackedIssueCannotOverwriteCommittedAdjustment()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        var state = await CreateDraftAsync(database);
        await using var staleIssueContext = database.CreateDbContext();
        var staleInvoice = await staleIssueContext.Invoices
            .Include(invoice => invoice.InvoiceItems)
            .SingleAsync(invoice => invoice.Id == state.InvoiceId);
        Assert.Equal(10_000m, staleInvoice.TotalAmount);

        await using var adjustmentContext = database.CreateDbContext();
        await using var adjustmentTransaction = await adjustmentContext.Database.BeginTransactionAsync();
        await new InvoiceService(new UnitOfWork(adjustmentContext))
            .AddManualAdjustmentAsync(state.InvoiceId, "Committed before stale issue", 1, 2_000m);

        var issue = CaptureIssueAsync(staleIssueContext, state.InvoiceId);
        await WaitForAdvisoryWaitersAsync(database, 1);
        await adjustmentTransaction.CommitAsync();

        Assert.NotNull((await issue).Invoice);
        await AssertInvoiceTruthAsync(database, state.InvoiceId, 12_000m, 2, "issued");
    }

    [Fact]
    public async Task StaleTrackedAdjustmentCannotRevertCommittedIssue()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        var state = await CreateDraftAsync(database);
        await using var staleAdjustmentContext = database.CreateDbContext();
        var staleInvoice = await staleAdjustmentContext.Invoices
            .SingleAsync(invoice => invoice.Id == state.InvoiceId);
        Assert.Equal("draft", staleInvoice.InvoiceStatus);

        await using var issueContext = database.CreateDbContext();
        await using var issueTransaction = await issueContext.Database.BeginTransactionAsync();
        await new InvoiceService(new UnitOfWork(issueContext)).IssueAsync(state.InvoiceId);

        var adjustment = CaptureAdjustmentAsync(staleAdjustmentContext, state.InvoiceId, 2_000m);
        await WaitForAdvisoryWaitersAsync(database, 1);
        await issueTransaction.CommitAsync();

        AssertNonDraftAdjustmentConflict((await adjustment).Error, state.InvoiceId, "issued");
        await AssertInvoiceTruthAsync(database, state.InvoiceId, 10_000m, 1, "issued");
    }

    [Fact]
    public async Task AdjustmentCommitBeforeCancelPreservesAdjustedAggregateAndCancellation()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        var state = await CreateDraftAsync(database);
        await using var adjustmentContext = database.CreateDbContext();
        await using var adjustmentTransaction = await adjustmentContext.Database.BeginTransactionAsync();
        await new InvoiceService(new UnitOfWork(adjustmentContext))
            .AddManualAdjustmentAsync(state.InvoiceId, "Adjustment before cancel", 1, 2_000m);

        var cancel = CaptureCancelAsync(database, state.InvoiceId);
        await WaitForAdvisoryWaitersAsync(database, 1);
        await adjustmentTransaction.CommitAsync();

        Assert.NotNull((await cancel).Invoice);
        await AssertInvoiceTruthAsync(database, state.InvoiceId, 12_000m, 2, "cancelled");
    }

    [Fact]
    public async Task CancelCommitBeforeAdjustmentRejectsWithoutPartialItem()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        var state = await CreateDraftAsync(database);
        await using var cancelContext = database.CreateDbContext();
        await using var cancelTransaction = await cancelContext.Database.BeginTransactionAsync();
        await new InvoiceService(new UnitOfWork(cancelContext))
            .CancelAsync(state.InvoiceId, "Cancel wins");

        var adjustment = CaptureAdjustmentAsync(database, state.InvoiceId, 2_000m);
        await WaitForAdvisoryWaitersAsync(database, 1);
        await cancelTransaction.CommitAsync();

        AssertNonDraftAdjustmentConflict((await adjustment).Error, state.InvoiceId, "cancelled");
        await AssertInvoiceTruthAsync(database, state.InvoiceId, 10_000m, 1, "cancelled");
    }

    [Fact]
    public async Task IssueCommitBeforeCancelProducesTheExistingValidCancelledOrder()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        var state = await CreateDraftAsync(database);
        await using var issueContext = database.CreateDbContext();
        await using var issueTransaction = await issueContext.Database.BeginTransactionAsync();
        await new InvoiceService(new UnitOfWork(issueContext)).IssueAsync(state.InvoiceId);

        var cancel = CaptureCancelAsync(database, state.InvoiceId);
        await WaitForAdvisoryWaitersAsync(database, 1);
        await issueTransaction.CommitAsync();

        Assert.NotNull((await cancel).Invoice);
        await AssertInvoiceTruthAsync(database, state.InvoiceId, 10_000m, 1, "cancelled");
    }

    [Fact]
    public async Task CancelCommitBeforeIssueRejectsStaleDraftTransition()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        var state = await CreateDraftAsync(database);
        await using var cancelContext = database.CreateDbContext();
        await using var cancelTransaction = await cancelContext.Database.BeginTransactionAsync();
        await new InvoiceService(new UnitOfWork(cancelContext))
            .CancelAsync(state.InvoiceId, "Cancel before issue");

        var issue = CaptureIssueAsync(database, state.InvoiceId);
        await WaitForAdvisoryWaitersAsync(database, 1);
        await cancelTransaction.CommitAsync();

        var issueOutcome = await issue;
        Assert.NotNull(issueOutcome.Error);
        Assert.Contains("Only draft invoices can be issued", issueOutcome.Error.Message);
        await AssertInvoiceTruthAsync(database, state.InvoiceId, 10_000m, 1, "cancelled");
    }

    [Fact]
    public async Task AdjustmentAndReissueCannotShareAValidStartingStatus()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        var state = await CreateDraftAsync(database);

        var draftReissue = await CaptureReissueAsync(database, state.InvoiceId);
        Assert.NotNull(draftReissue.Error);
        Assert.Contains("Only issued or paid invoices can be re-issued", draftReissue.Error.Message);

        await using (var issueContext = database.CreateDbContext())
            await new InvoiceService(new UnitOfWork(issueContext)).IssueAsync(state.InvoiceId);

        var issuedAdjustment = await CaptureAdjustmentAsync(database, state.InvoiceId, 2_000m);
        AssertNonDraftAdjustmentConflict(issuedAdjustment.Error, state.InvoiceId, "issued");
        await AssertInvoiceTruthAsync(database, state.InvoiceId, 10_000m, 1, "issued");
    }

    [Fact]
    public async Task ReissueCommitBeforeCancelMatchesTheExistingSerialStatusRules()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        var state = await CreateDraftAsync(database);
        await using (var issueContext = database.CreateDbContext())
            await new InvoiceService(new UnitOfWork(issueContext)).IssueAsync(state.InvoiceId);

        await using var reissueContext = database.CreateDbContext();
        await using var reissueTransaction = await reissueContext.Database.BeginTransactionAsync();
        var replacement = await new InvoiceService(new UnitOfWork(reissueContext)).ReissueAsync(
            state.InvoiceId,
            $"INV-XW-R-{Guid.NewGuid():N}",
            "Reissue before cancel");

        var cancel = CaptureCancelAsync(database, state.InvoiceId);
        await WaitForAdvisoryWaitersAsync(database, 1);
        await reissueTransaction.CommitAsync();

        Assert.NotNull((await cancel).Invoice);
        await AssertInvoiceTruthAsync(database, state.InvoiceId, 10_000m, 1, "cancelled");
        await AssertInvoiceTruthAsync(database, replacement.Id, 10_000m, 1, "issued");
    }

    [Fact]
    public async Task CancelCommitBeforeReissueRejectsWithoutReplacement()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        var state = await CreateDraftAsync(database);
        await using (var issueContext = database.CreateDbContext())
            await new InvoiceService(new UnitOfWork(issueContext)).IssueAsync(state.InvoiceId);

        await using var cancelContext = database.CreateDbContext();
        await using var cancelTransaction = await cancelContext.Database.BeginTransactionAsync();
        await new InvoiceService(new UnitOfWork(cancelContext))
            .CancelAsync(state.InvoiceId, "Cancel before reissue");

        var reissue = CaptureReissueAsync(database, state.InvoiceId);
        await WaitForAdvisoryWaitersAsync(database, 1);
        await cancelTransaction.CommitAsync();

        var reissueOutcome = await reissue;
        Assert.NotNull(reissueOutcome.Error);
        Assert.Contains("Only issued or paid invoices can be re-issued", reissueOutcome.Error.Message);
        await AssertInvoiceTruthAsync(database, state.InvoiceId, 10_000m, 1, "cancelled");
        await using var verify = database.CreateDbContext();
        Assert.Equal(1, await verify.Invoices.CountAsync(invoice => invoice.BookingId == state.BookingId));
    }

    [Fact]
    public async Task AdjustmentBeforeMarkPaidKeepsAdjustedCapacityAuthoritative()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        var state = await CreateDraftAsync(database);
        var paymentId = await CreatePendingPaymentAsync(database, state, 10_000m);
        await using var adjustmentContext = database.CreateDbContext();
        await using var adjustmentTransaction = await adjustmentContext.Database.BeginTransactionAsync();
        await new InvoiceService(new UnitOfWork(adjustmentContext))
            .AddManualAdjustmentAsync(state.InvoiceId, "Adjustment before payment", 1, 2_000m);

        var markPaid = CaptureMarkPaidAsync(database, paymentId);
        await WaitForAdvisoryWaitersAsync(database, 1);
        await adjustmentTransaction.CommitAsync();

        Assert.NotNull((await markPaid).Payment);
        await AssertInvoiceTruthAsync(database, state.InvoiceId, 12_000m, 2, "draft");
        await AssertPaymentTruthAsync(database, paymentId, "paid");
    }

    [Fact]
    public async Task MarkPaidBeforeAdjustmentPreservesPaidStatusAndRejectsAdjustment()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        var state = await CreateDraftAsync(database);
        var paymentId = await CreatePendingPaymentAsync(database, state, 10_000m);
        await using var paymentContext = database.CreateDbContext();
        await using var paymentTransaction = await paymentContext.Database.BeginTransactionAsync();
        await new PaymentService(new UnitOfWork(paymentContext))
            .MarkPaidAsync(paymentId, null, "Payment wins");

        var adjustment = CaptureAdjustmentAsync(database, state.InvoiceId, 2_000m);
        await WaitForAdvisoryWaitersAsync(database, 1);
        await paymentTransaction.CommitAsync();

        AssertNonDraftAdjustmentConflict((await adjustment).Error, state.InvoiceId, "paid");
        await AssertInvoiceTruthAsync(database, state.InvoiceId, 10_000m, 1, "paid");
        await AssertPaymentTruthAsync(database, paymentId, "paid");
    }

    [Fact]
    public async Task CancelAndMarkPaidUsePaymentThenInvoiceLockOrderWithoutDeadlock()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        var state = await CreateDraftAsync(database);
        var paymentId = await CreatePendingPaymentAsync(database, state, 10_000m);
        await using var gate = await HoldAdvisoryLockAsync(
            database, InvoiceMutationLocks.ForInvoice(state.InvoiceId));

        var cancel = CaptureCancelAsync(database, state.InvoiceId);
        await WaitForAdvisoryWaitersAsync(database, 1);
        var markPaid = CaptureMarkPaidAsync(database, paymentId);
        await WaitForAdvisoryWaitersAsync(database, 2);
        await gate.CommitAsync();

        var cancelOutcome = await CompleteWithinAsync(
            cancel,
            TimeSpan.FromSeconds(10),
            "Cancellation must complete after the invoice gate is released.");
        var paymentOutcome = await CompleteWithinAsync(
            markPaid,
            TimeSpan.FromSeconds(10),
            "MarkPaid must follow cancellation without a payment/invoice lock cycle.");

        Assert.NotNull(cancelOutcome.Invoice);
        Assert.NotNull(paymentOutcome.Error);
        Assert.Contains("linked invoice", paymentOutcome.Error.Message);
        Assert.Contains("cancelled", paymentOutcome.Error.Message);
        await AssertInvoiceTruthAsync(database, state.InvoiceId, 10_000m, 1, "cancelled");
        await AssertPaymentTruthAsync(database, paymentId, "pending");
    }

    [Fact]
    public async Task DifferentInvoicesDoNotShareTheInvoiceMutationLock()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        var first = await CreateDraftAsync(database);
        var second = await CreateDraftAsync(database);
        await using var gate = await HoldAdvisoryLockAsync(
            database, InvoiceMutationLocks.ForInvoice(first.InvoiceId));

        var blocked = CaptureAdjustmentAsync(database, first.InvoiceId, 2_000m);
        await WaitForAdvisoryWaitersAsync(database, 1);
        var independent = await CompleteWithinAsync(
            CaptureAdjustmentAsync(database, second.InvoiceId, 3_000m),
            TimeSpan.FromSeconds(10),
            "A different invoice must not wait on another invoice's mutation lock.");

        Assert.NotNull(independent.Invoice);
        Assert.False(blocked.IsCompleted);
        await gate.CommitAsync();
        Assert.NotNull((await blocked).Invoice);
        await AssertInvoiceTruthAsync(database, first.InvoiceId, 12_000m, 2, "draft");
        await AssertInvoiceTruthAsync(database, second.InvoiceId, 13_000m, 2, "draft");
    }

    [Fact]
    public async Task ReissueJoinsCallerOwnedTransactionWithoutCommittingIt()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        var state = await CreateDraftAsync(database);
        await using (var issueContext = database.CreateDbContext())
            await new InvoiceService(new UnitOfWork(issueContext)).IssueAsync(state.InvoiceId);

        await using var reissueContext = database.CreateDbContext();
        await using var transaction = await reissueContext.Database.BeginTransactionAsync();
        var replacement = await new InvoiceService(new UnitOfWork(reissueContext)).ReissueAsync(
            state.InvoiceId,
            $"INV-XW-{Guid.NewGuid():N}",
            "Caller-owned reissue");

        await AssertInvoiceTruthAsync(database, state.InvoiceId, 10_000m, 1, "issued");
        await using (var beforeCommit = database.CreateDbContext())
            Assert.False(await beforeCommit.Invoices.AnyAsync(invoice => invoice.Id == replacement.Id));

        await transaction.CommitAsync();
        await AssertInvoiceTruthAsync(database, state.InvoiceId, 10_000m, 1, "superseded");
        await AssertInvoiceTruthAsync(database, replacement.Id, 10_000m, 1, "issued");
    }

    private static async Task<DraftState> CreateDraftAsync(PostgreSqlTestDatabase database)
    {
        await using var context = database.CreateDbContext();
        var booking = await SeedBookingAsync(context);
        var invoice = await new InvoiceService(new UnitOfWork(context)).CreateDraftFromBookingAsync(
            booking.Id,
            $"INV-XW-{Guid.NewGuid():N}",
            "INV-OPS-03 fixture");
        return new DraftState(booking.Id, invoice.Id);
    }

    private static async Task<Guid> CreatePendingPaymentAsync(
        PostgreSqlTestDatabase database,
        DraftState state,
        decimal amount)
    {
        await using var context = database.CreateDbContext();
        var payment = await new PaymentService(new UnitOfWork(context)).CreateAsync(
            state.BookingId,
            state.InvoiceId,
            "bank_transfer",
            amount,
            null,
            "INV-OPS-03 pending payment");
        return payment.Id;
    }

    private static async Task<InvoiceOutcome> CaptureAdjustmentAsync(
        PostgreSqlTestDatabase database,
        Guid invoiceId,
        decimal amount)
    {
        await using var context = database.CreateDbContext();
        return await CaptureAdjustmentAsync(context, invoiceId, amount);
    }

    private static async Task<InvoiceOutcome> CaptureAdjustmentAsync(
        AppDbContext context,
        Guid invoiceId,
        decimal amount)
    {
        try
        {
            var invoice = await new InvoiceService(new UnitOfWork(context))
                .AddManualAdjustmentAsync(invoiceId, $"Concurrent {amount}", 1, amount);
            return new InvoiceOutcome(invoice, null);
        }
        catch (ConflictException error)
        {
            return new InvoiceOutcome(null, error);
        }
    }

    private static async Task<InvoiceOutcome> CaptureIssueAsync(
        PostgreSqlTestDatabase database,
        Guid invoiceId)
    {
        await using var context = database.CreateDbContext();
        return await CaptureIssueAsync(context, invoiceId);
    }

    private static async Task<InvoiceOutcome> CaptureIssueAsync(
        AppDbContext context,
        Guid invoiceId)
    {
        try
        {
            var invoice = await new InvoiceService(new UnitOfWork(context)).IssueAsync(invoiceId);
            return new InvoiceOutcome(invoice, null);
        }
        catch (ConflictException error)
        {
            return new InvoiceOutcome(null, error);
        }
    }

    private static async Task<InvoiceOutcome> CaptureCancelAsync(
        PostgreSqlTestDatabase database,
        Guid invoiceId)
    {
        await using var context = database.CreateDbContext();
        try
        {
            var invoice = await new InvoiceService(new UnitOfWork(context))
                .CancelAsync(invoiceId, "INV-OPS-03 concurrent cancellation");
            return new InvoiceOutcome(invoice, null);
        }
        catch (ConflictException error)
        {
            return new InvoiceOutcome(null, error);
        }
    }

    private static async Task<InvoiceOutcome> CaptureReissueAsync(
        PostgreSqlTestDatabase database,
        Guid invoiceId)
    {
        await using var context = database.CreateDbContext();
        try
        {
            var invoice = await new InvoiceService(new UnitOfWork(context)).ReissueAsync(
                invoiceId,
                $"INV-XW-R-{Guid.NewGuid():N}",
                "INV-OPS-03 reissue census");
            return new InvoiceOutcome(invoice, null);
        }
        catch (ConflictException error)
        {
            return new InvoiceOutcome(null, error);
        }
    }

    private static async Task<PaymentOutcome> CaptureMarkPaidAsync(
        PostgreSqlTestDatabase database,
        Guid paymentId)
    {
        await using var context = database.CreateDbContext();
        try
        {
            var payment = await new PaymentService(new UnitOfWork(context))
                .MarkPaidAsync(paymentId, null, "INV-OPS-03 concurrent payment");
            return new PaymentOutcome(payment, null);
        }
        catch (ConflictException error)
        {
            return new PaymentOutcome(null, error);
        }
    }

    private static async Task AssertInvoiceTruthAsync(
        PostgreSqlTestDatabase database,
        Guid invoiceId,
        decimal expectedTotal,
        int expectedItemCount,
        string expectedStatus)
    {
        await using var context = database.CreateDbContext();
        var invoice = await context.Invoices.AsNoTracking()
            .SingleAsync(row => row.Id == invoiceId);
        var itemCount = await context.InvoiceItems.AsNoTracking()
            .CountAsync(row => row.InvoiceId == invoiceId);
        var itemSum = await context.InvoiceItems.AsNoTracking()
            .Where(row => row.InvoiceId == invoiceId)
            .SumAsync(row => row.LineTotal);

        Assert.Equal(expectedStatus, invoice.InvoiceStatus);
        Assert.Equal(expectedItemCount, itemCount);
        Assert.Equal(expectedTotal, itemSum);
        Assert.Equal(itemSum, invoice.SubtotalAmount);
        Assert.Equal(itemSum, invoice.TotalAmount);
    }

    private static async Task AssertPaymentTruthAsync(
        PostgreSqlTestDatabase database,
        Guid paymentId,
        string expectedStatus)
    {
        await using var context = database.CreateDbContext();
        var payment = await context.Payments.AsNoTracking()
            .SingleAsync(row => row.Id == paymentId);
        Assert.Equal(expectedStatus, payment.PaymentStatus);
    }

    private static void AssertNonDraftAdjustmentConflict(
        ConflictException? error,
        Guid invoiceId,
        string status)
    {
        Assert.NotNull(error);
        Assert.Null(error.Code);
        Assert.Equal(
            $"Cannot add items to invoice {invoiceId}: current status is '{status}'. Only draft invoices can be modified.",
            error.Message);
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

    private static async Task<Booking> SeedBookingAsync(AppDbContext context)
    {
        var suffix = Guid.NewGuid().ToString("N");
        var owner = new Owner
        {
            Id = Guid.NewGuid(), Name = "INV-OPS-03 owner", Phone = TestPhone("20"),
            EmergencyPhone = TestPhone("21"), CommissionRate = 10m, Status = "active",
            PasswordHash = "test-only-hash"
        };
        var project = new Project
        {
            Id = Guid.NewGuid(), Name = $"INV-OPS-03 project {suffix}", IsActive = true
        };
        var client = new Client
        {
            Id = Guid.NewGuid(), Name = "INV-OPS-03 client", Phone = TestPhone("22"),
            PasswordHash = "test-only-hash", IsActive = true
        };
        var unit = new Unit
        {
            Id = Guid.NewGuid(), OwnerId = owner.Id, ProjectId = project.Id,
            Name = $"INV-OPS-03 unit {suffix}", UnitType = "apartment",
            Bedrooms = 2, Bathrooms = 1, MaxGuests = 4, BasePricePerNight = 1_000m,
            IsActive = true, IsVisibleInPortfolio = true
        };
        var booking = new Booking
        {
            Id = Guid.NewGuid(), ClientId = client.Id, UnitId = unit.Id, OwnerId = owner.Id,
            BookingStatus = BookingStatus.Booked,
            CheckInDate = new DateOnly(2026, 11, 1), CheckOutDate = new DateOnly(2026, 11, 11),
            GuestCount = 2, BaseAmount = InitialAmount, FinalAmount = InitialAmount,
            Source = "admin", IsHistorical = false
        };
        context.AddRange(owner, project, client, unit, booking);
        await context.SaveChangesAsync();
        return booking;
    }

    private static string TestPhone(string prefix)
    {
        var value = BitConverter.ToUInt32(Guid.NewGuid().ToByteArray(), 0) % 10_000_000_000L;
        return $"+{prefix}{value:D10}";
    }

    private sealed record DraftState(Guid BookingId, Guid InvoiceId);
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
