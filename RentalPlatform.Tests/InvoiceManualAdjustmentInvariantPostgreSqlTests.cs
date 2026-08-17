using Microsoft.EntityFrameworkCore;
using Npgsql;
using RentalPlatform.API.DTOs.Requests.Invoices;
using RentalPlatform.API.Validators;
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
public sealed class InvoiceManualAdjustmentInvariantPostgreSqlTests
{
    private const decimal InitialAmount = 10_000m;
    private readonly PostgreSqlFixture _fixture;

    public InvoiceManualAdjustmentInvariantPostgreSqlTests(PostgreSqlFixture fixture)
    {
        _fixture = fixture;
    }

    [Fact]
    public async Task PositiveAdjustmentMatchesPersistedItemTruthAndFinanceReads()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        await using var context = database.CreateDbContext();
        var state = await CreateDraftAsync(context);
        var service = new InvoiceService(new UnitOfWork(context));

        var adjusted = await service.AddManualAdjustmentAsync(
            state.InvoiceId, "Positive adjustment", 1, 2_000m);

        Assert.Equal(12_000m, adjusted.TotalAmount);
        await AssertPersistedTruthAsync(database, state.InvoiceId, 12_000m, 2);

        await using var financeContext = database.CreateDbContext();
        var finance = new FinanceSummaryService(new UnitOfWork(financeContext));
        var invoiceBalance = await finance.GetInvoiceBalanceAsync(state.InvoiceId);
        var bookingSnapshot = await finance.GetBookingFinanceSnapshotAsync(state.BookingId);
        Assert.Equal(12_000m, invoiceBalance.TotalAmount);
        Assert.Equal(12_000m, invoiceBalance.RemainingAmount);
        Assert.False(invoiceBalance.IsFullyPaid);
        Assert.Equal(12_000m, bookingSnapshot.InvoicedAmount);
        Assert.Equal(12_000m, bookingSnapshot.RemainingAmount);
    }

    [Fact]
    public async Task SequentialAndZeroAdjustmentsRemainCanonicalInTrackedContext()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        await using var context = database.CreateDbContext();
        var state = await CreateDraftAsync(context);
        var service = new InvoiceService(new UnitOfWork(context));

        await service.AddManualAdjustmentAsync(state.InvoiceId, "First", 1, 2_000m);
        await AssertPersistedTruthAsync(database, state.InvoiceId, 12_000m, 2);

        await service.AddManualAdjustmentAsync(state.InvoiceId, "Second", 1, 500m);
        await AssertPersistedTruthAsync(database, state.InvoiceId, 12_500m, 3);

        await service.AddManualAdjustmentAsync(state.InvoiceId, "Allowed zero", 1, 0m);
        await AssertPersistedTruthAsync(database, state.InvoiceId, 12_500m, 4);
    }

    [Fact]
    public async Task PublicValidationRejectsNegativeAmountAndAllowsZero()
    {
        var validator = new AddInvoiceManualAdjustmentRequestValidator();

        var negative = await validator.ValidateAsync(new AddInvoiceManualAdjustmentRequest
        {
            Description = "Unsupported negative adjustment", Quantity = 1, UnitAmount = -0.01m
        });
        var zero = await validator.ValidateAsync(new AddInvoiceManualAdjustmentRequest
        {
            Description = "Allowed zero adjustment", Quantity = 1, UnitAmount = 0m
        });

        Assert.False(negative.IsValid);
        Assert.Contains(negative.Errors, error =>
            error.PropertyName == nameof(AddInvoiceManualAdjustmentRequest.UnitAmount)
            && error.ErrorMessage == "UnitAmount must be 0 or greater.");
        Assert.True(zero.IsValid);
    }

    [Fact]
    public async Task FreshContextAdjustmentMatchesPersistedItemTruth()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        Guid invoiceId;
        await using (var setup = database.CreateDbContext())
        {
            invoiceId = (await CreateDraftAsync(setup)).InvoiceId;
        }

        await using (var adjustmentContext = database.CreateDbContext())
        {
            await new InvoiceService(new UnitOfWork(adjustmentContext))
                .AddManualAdjustmentAsync(invoiceId, "Fresh context", 2, 1_000m);
        }

        await AssertPersistedTruthAsync(database, invoiceId, 12_000m, 2);
    }

    [Fact]
    public async Task CallerOwnedTransactionKeepsItemAndTotalAtomic()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        Guid invoiceId;
        await using (var setup = database.CreateDbContext())
        {
            invoiceId = (await CreateDraftAsync(setup)).InvoiceId;
        }

        await using var context = database.CreateDbContext();
        await using var transaction = await context.Database.BeginTransactionAsync();
        await new InvoiceService(new UnitOfWork(context)).AddManualAdjustmentAsync(
            invoiceId, "Caller transaction", 1, 2_000m);

        await AssertPersistedTruthAsync(database, invoiceId, 10_000m, 1);
        await transaction.CommitAsync();
        await AssertPersistedTruthAsync(database, invoiceId, 12_000m, 2);
    }

    [Fact]
    public async Task IssuedInvoiceRejectsAdjustmentWithoutPartialMutation()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        await using var context = database.CreateDbContext();
        var state = await CreateDraftAsync(context);
        var service = new InvoiceService(new UnitOfWork(context));
        await service.IssueAsync(state.InvoiceId);

        var conflict = await Assert.ThrowsAsync<ConflictException>(() =>
            service.AddManualAdjustmentAsync(state.InvoiceId, "Rejected", 1, 2_000m));

        Assert.Null(conflict.Code);
        Assert.Equal(
            $"Cannot add items to invoice {state.InvoiceId}: current status is 'issued'. Only draft invoices can be modified.",
            conflict.Message);
        await AssertPersistedTruthAsync(database, state.InvoiceId, 10_000m, 1, "issued");
    }

    [Fact]
    public async Task DatabaseFailureRollsBackBothAdjustmentAndTotal()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        await using var context = database.CreateDbContext();
        var state = await CreateDraftAsync(context);
        var service = new InvoiceService(new UnitOfWork(context));

        await Assert.ThrowsAsync<DbUpdateException>(() => service.AddManualAdjustmentAsync(
            state.InvoiceId, new string('x', 256), 1, 2_000m));

        await AssertPersistedTruthAsync(database, state.InvoiceId, 10_000m, 1);
    }

    [Fact]
    public async Task ConcurrentAdjustmentsSerializeAndPreserveCanonicalTotal()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        Guid invoiceId;
        await using (var setup = database.CreateDbContext())
        {
            invoiceId = (await CreateDraftAsync(setup)).InvoiceId;
        }

        await using var gate = await HoldAdvisoryLockAsync(
            database, InvoiceMutationLocks.ForInvoice(invoiceId));
        var first = AddInFreshContextAsync(database, invoiceId, 2_000m);
        var second = AddInFreshContextAsync(database, invoiceId, 3_000m);
        await WaitForAdvisoryWaitersAsync(database, 2);
        await gate.CommitAsync();
        await Task.WhenAll(first, second);

        await AssertPersistedTruthAsync(database, invoiceId, 15_000m, 3);
    }

    [Fact]
    public async Task ReissueCopiesCanonicalTotalAndEveryItemOnce()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        await using var context = database.CreateDbContext();
        var state = await CreateDraftAsync(context);
        var service = new InvoiceService(new UnitOfWork(context));
        await service.AddManualAdjustmentAsync(state.InvoiceId, "Before reissue", 1, 2_000m);
        await service.IssueAsync(state.InvoiceId);

        var replacement = await service.ReissueAsync(
            state.InvoiceId, $"INV-R-{Guid.NewGuid():N}", "Canonical reissue");

        await AssertPersistedTruthAsync(database, state.InvoiceId, 12_000m, 2, "superseded");
        await AssertPersistedTruthAsync(database, replacement.Id, 12_000m, 2, "issued");
    }

    [Fact]
    public async Task CorrectedTotalDefinesOrdinarySettlementCapacity()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        await using var context = database.CreateDbContext();
        var state = await CreateDraftAsync(context);
        var unitOfWork = new UnitOfWork(context);
        var invoices = new InvoiceService(unitOfWork);
        var payments = new PaymentService(unitOfWork);
        await invoices.AddManualAdjustmentAsync(state.InvoiceId, "Capacity", 1, 2_000m);
        await invoices.IssueAsync(state.InvoiceId);

        var payment = await payments.CreateAsync(
            state.BookingId, state.InvoiceId, "cash", 12_000m, null, "Exact capacity");
        await payments.MarkPaidAsync(payment.Id, null, "Canonical total settlement");
        var conflict = await Assert.ThrowsAsync<ConflictException>(() => payments.CreateAsync(
            state.BookingId, state.InvoiceId, "cash", 0.01m, null, "Over capacity"));

        Assert.Null(conflict.Code);
        Assert.Contains("Amount owed: 12000.00", conflict.Message, StringComparison.Ordinal);
        Assert.Contains("remaining: 0.00", conflict.Message, StringComparison.Ordinal);

        context.ChangeTracker.Clear();
        var balance = await new FinanceSummaryService(unitOfWork)
            .GetInvoiceBalanceAsync(state.InvoiceId);
        Assert.Equal(12_000m, balance.TotalAmount);
        Assert.Equal(12_000m, balance.PaidAmount);
        Assert.Equal(0m, balance.RemainingAmount);
        Assert.True(balance.IsFullyPaid);
        Assert.False(await context.OwnerPayouts.AnyAsync(row => row.BookingId == state.BookingId));
    }

    [Fact]
    public async Task RepositoryAddRelationshipFixupAddsAdjustmentExactlyOnce()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        await using var context = database.CreateDbContext();
        var state = await CreateDraftAsync(context);
        var invoice = await context.Invoices.Include(row => row.InvoiceItems)
            .SingleAsync(row => row.Id == state.InvoiceId);
        var unitOfWork = new UnitOfWork(context);
        var item = NewAdjustment(invoice.Id, 2_000m);

        var countBeforeAdd = invoice.InvoiceItems.Count;
        await unitOfWork.InvoiceItems.AddAsync(item);
        var countAfterAdd = invoice.InvoiceItems.Count;

        Assert.Equal(1, countBeforeAdd);
        Assert.Equal(2, countAfterAdd);
        Assert.Single(invoice.InvoiceItems, row => ReferenceEquals(row, item));
        Assert.Single(invoice.InvoiceItems, row => row.Id == item.Id);
    }

    private static async Task<DraftState> CreateDraftAsync(AppDbContext context)
    {
        var booking = await SeedBookingAsync(context);
        var invoice = await new InvoiceService(new UnitOfWork(context))
            .CreateDraftFromBookingAsync(
                booking.Id, $"INV-OPS-{Guid.NewGuid():N}", "INV-OPS-01 fixture");
        return new DraftState(booking.Id, invoice.Id);
    }

    private static async Task AssertPersistedTruthAsync(
        PostgreSqlTestDatabase database,
        Guid invoiceId,
        decimal expectedTotal,
        int expectedItemCount,
        string expectedStatus = "draft")
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

    private static async Task AddInFreshContextAsync(
        PostgreSqlTestDatabase database,
        Guid invoiceId,
        decimal amount)
    {
        await using var context = database.CreateDbContext();
        await new InvoiceService(new UnitOfWork(context)).AddManualAdjustmentAsync(
            invoiceId, $"Concurrent {amount}", 1, amount);
    }

    private static InvoiceItem NewAdjustment(Guid invoiceId, decimal amount)
    {
        var now = DateTime.UtcNow;
        return new InvoiceItem
        {
            Id = Guid.NewGuid(), InvoiceId = invoiceId, LineType = "manual_adjustment",
            Description = "Relationship fixup proof", Quantity = 1, UnitAmount = amount,
            LineTotal = amount, CreatedAt = now, UpdatedAt = now
        };
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

    private static async Task<Booking> SeedBookingAsync(AppDbContext context)
    {
        var suffix = Guid.NewGuid().ToString("N");
        var owner = new Owner
        {
            Id = Guid.NewGuid(), Name = "INV-OPS-01 owner", Phone = TestPhone("20"),
            EmergencyPhone = TestPhone("21"), CommissionRate = 10m, Status = "active",
            PasswordHash = "test-only-hash"
        };
        var project = new Project
        {
            Id = Guid.NewGuid(), Name = $"INV-OPS-01 project {suffix}", IsActive = true
        };
        var client = new Client
        {
            Id = Guid.NewGuid(), Name = "INV-OPS-01 client", Phone = TestPhone("22"),
            PasswordHash = "test-only-hash", IsActive = true
        };
        var unit = new Unit
        {
            Id = Guid.NewGuid(), OwnerId = owner.Id, ProjectId = project.Id,
            Name = $"INV-OPS-01 unit {suffix}", UnitType = "apartment",
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
