using System.Reflection;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using RentalPlatform.API.Services;
using RentalPlatform.Business.Interfaces;
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
public sealed class HistoricalNotificationIsolationPostgreSqlTests
{
    private readonly PostgreSqlFixture _fixture;

    public HistoricalNotificationIsolationPostgreSqlTests(PostgreSqlFixture fixture)
    {
        _fixture = fixture;
    }

    [Fact]
    public async Task AutomaticCompletionSweepExcludesHistoricalAndPreservesOrdinaryBehavior()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        SeedData seed;
        await using (var setup = database.CreateDbContext())
        {
            seed = await SeedAsync(setup, forAutomaticSweep: true);
        }

        var services = new ServiceCollection();
        services.AddDbContext<AppDbContext>(options => options.UseNpgsql(database.ConnectionString));
        services.AddScoped<IUnitOfWork, UnitOfWork>();
        services.AddScoped<INotificationService, NotificationService>();
        await using var provider = services.BuildServiceProvider();
        var job = new AutoCompleteBookingsJob(
            provider.GetRequiredService<IServiceScopeFactory>(),
            NullLogger<AutoCompleteBookingsJob>.Instance);

        await InvokeSweepAsync(job);

        await using var verify = database.CreateDbContext();
        var ordinary = await verify.Bookings.AsNoTracking()
            .SingleAsync(booking => booking.Id == seed.Ordinary.Id);
        var historical = await verify.Bookings.AsNoTracking()
            .SingleAsync(booking => booking.Id == seed.Historical.Id);
        Assert.Equal(BookingStatus.Completed, ordinary.BookingStatus);
        Assert.Equal(BookingStatus.CheckIn, historical.BookingStatus);
        Assert.Equal(1, await verify.BookingStatusHistories.CountAsync(history =>
            history.BookingId == ordinary.Id && history.Notes == BookingHistoryEvents.AutomaticCompletion));
        Assert.Equal(0, await verify.BookingStatusHistories.CountAsync(history =>
            history.BookingId == historical.Id));
        await AssertNoProhibitedRowsAsync(verify);
    }

    [Fact]
    public async Task LifecycleNotificationGuardSuppressesHistoricalAndPreservesOrdinaryNotification()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        await using var context = database.CreateDbContext();
        var seed = await SeedAsync(context);
        var notifications = new RecordingNotificationService();
        var unitOfWork = new UnitOfWork(context);
        var lifecycle = new BookingLifecycleService(
            unitOfWork,
            new UnitAvailabilityService(unitOfWork),
            new InvoiceService(unitOfWork),
            notifications,
            NullLogger<BookingLifecycleService>.Instance);

        await lifecycle.TransitionAsync(
            seed.Ordinary.Id,
            BookingStatus.NotRelevant,
            seed.Admin.Id,
            "ordinary transition");
        Assert.Equal([seed.Ordinary.ClientId], notifications.ClientRecipients);

        await lifecycle.TransitionAsync(
            seed.Historical.Id,
            BookingStatus.NotRelevant,
            seed.Admin.Id,
            "historical fault fixture");
        Assert.Equal([seed.Ordinary.ClientId], notifications.ClientRecipients);

        context.ChangeTracker.Clear();
        Assert.Equal(BookingStatus.NotRelevant, await context.Bookings.AsNoTracking()
            .Where(booking => booking.Id == seed.Ordinary.Id)
            .Select(booking => booking.BookingStatus)
            .SingleAsync());
        Assert.Equal(BookingStatus.NotRelevant, await context.Bookings.AsNoTracking()
            .Where(booking => booking.Id == seed.Historical.Id)
            .Select(booking => booking.BookingStatus)
            .SingleAsync());
        await AssertNoProhibitedRowsAsync(context);
    }

    private static async Task InvokeSweepAsync(AutoCompleteBookingsJob job)
    {
        var method = typeof(AutoCompleteBookingsJob).GetMethod(
            "RunSweepAsync",
            BindingFlags.Instance | BindingFlags.NonPublic)
            ?? throw new InvalidOperationException("Auto-complete sweep entry point was not found.");
        var task = method.Invoke(job, [CancellationToken.None]) as Task
            ?? throw new InvalidOperationException("Auto-complete sweep did not return a task.");
        await task;
    }

    private static async Task<SeedData> SeedAsync(
        AppDbContext context,
        bool forAutomaticSweep = false)
    {
        var suffix = Guid.NewGuid().ToString("N");
        var owner = new Owner
        {
            Id = Guid.NewGuid(), Name = "HB07 owner", Phone = TestPhone("20"),
            EmergencyPhone = TestPhone("21"), CommissionRate = 10m,
            Status = "active", PasswordHash = "test-only-hash"
        };
        var project = new Project
        {
            Id = Guid.NewGuid(), Name = $"HB07 project {suffix}", IsActive = true
        };
        var client = new Client
        {
            Id = Guid.NewGuid(), Name = "HB07 client", Phone = TestPhone("22"),
            PasswordHash = "test-only-hash", IsActive = true
        };
        var admin = new AdminUser
        {
            Id = Guid.NewGuid(), Name = "HB07 admin",
            Email = $"hb07-{suffix}@example.test", PasswordHash = "test-only-hash",
            RoleTemplateId = Guid.Parse("10000000-0000-0000-0000-000000000001"),
            IsActive = true
        };
        var unit = new Unit
        {
            Id = Guid.NewGuid(), OwnerId = owner.Id, ProjectId = project.Id,
            Name = $"HB07 unit {suffix}", UnitType = "apartment", Bedrooms = 2,
            Bathrooms = 1, MaxGuests = 4, BasePricePerNight = 100m,
            IsActive = true, IsVisibleInPortfolio = true
        };
        context.AddRange(owner, project, client, admin, unit);
        await context.SaveChangesAsync();

        var ordinary = Booking(unit, owner, client, false, forAutomaticSweep);
        var historical = Booking(unit, owner, client, true, forAutomaticSweep);
        context.Bookings.AddRange(ordinary, historical);
        await context.SaveChangesAsync();
        return new SeedData(admin, ordinary, historical);
    }

    private static Booking Booking(
        Unit unit,
        Owner owner,
        Client client,
        bool historical,
        bool forAutomaticSweep) => new()
    {
        Id = Guid.NewGuid(), ClientId = client.Id, UnitId = unit.Id, OwnerId = owner.Id,
        BookingStatus = forAutomaticSweep ? BookingStatus.CheckIn : BookingStatus.Booked,
        CheckInDate = forAutomaticSweep
            ? (historical ? new DateOnly(2020, 2, 1) : new DateOnly(2020, 1, 1))
            : (historical ? new DateOnly(2026, 7, 10) : new DateOnly(2026, 10, 10)),
        CheckOutDate = forAutomaticSweep
            ? (historical ? new DateOnly(2020, 2, 3) : new DateOnly(2020, 1, 3))
            : (historical ? new DateOnly(2026, 7, 12) : new DateOnly(2026, 10, 12)),
        GuestCount = 2,
        BaseAmount = forAutomaticSweep ? 0m : 100m,
        FinalAmount = forAutomaticSweep ? 0m : 100m,
        AgreedAmount = historical ? (forAutomaticSweep ? 0m : 100m) : null,
        Source = "admin", IsHistorical = historical,
        ActualBookedAt = historical
            ? (forAutomaticSweep ? new DateOnly(2020, 1, 20) : new DateOnly(2026, 7, 1))
            : null,
        HistoricalEntryReason = historical
            ? HistoricalEntryReasons.AccountingReconciliation
            : null,
        OriginalSource = historical ? "legacy_system" : null
    };

    private static async Task AssertNoProhibitedRowsAsync(AppDbContext context)
    {
        Assert.Equal(0, await context.Notifications.CountAsync());
        Assert.Equal(0, await context.NotificationDeliveryLogs.CountAsync());
        Assert.Equal(0, await context.Invoices.CountAsync());
        Assert.Equal(0, await context.InvoiceItems.CountAsync());
        Assert.Equal(0, await context.Payments.CountAsync());
        Assert.Equal(0, await context.OwnerPayouts.CountAsync());
        Assert.Equal(0, await context.CrmLeads.CountAsync());
        Assert.Equal(0, await context.CrmNotes.CountAsync());
        Assert.Equal(0, await context.CrmAssignments.CountAsync());
    }

    private static string TestPhone(string suffix) =>
        $"+2010{Random.Shared.Next(1000000, 9999999)}{suffix}"[..14];

    private sealed record SeedData(AdminUser Admin, Booking Ordinary, Booking Historical);

    private sealed class RecordingNotificationService : INotificationService
    {
        public List<Guid> ClientRecipients { get; } = [];

        public Task<IReadOnlyList<Notification>> GetAllAsync(
            string? notificationStatus = null,
            string? channel = null,
            Guid? templateId = null,
            CancellationToken cancellationToken = default) =>
            Task.FromResult<IReadOnlyList<Notification>>([]);

        public Task<Notification?> GetByIdAsync(
            Guid id,
            CancellationToken cancellationToken = default) =>
            Task.FromResult<Notification?>(null);

        public Task<Notification> CreateForAdminAsync(
            string templateCode,
            string channel,
            Guid adminUserId,
            IReadOnlyDictionary<string, string>? variables = null,
            DateTime? scheduledAt = null,
            CancellationToken cancellationToken = default) =>
            throw new InvalidOperationException("Admin notification was not expected.");

        public Task<Notification> CreateForClientAsync(
            string templateCode,
            string channel,
            Guid clientId,
            IReadOnlyDictionary<string, string>? variables = null,
            DateTime? scheduledAt = null,
            CancellationToken cancellationToken = default)
        {
            ClientRecipients.Add(clientId);
            return Task.FromResult(new Notification { Id = Guid.NewGuid() });
        }

        public Task<Notification> CreateForOwnerAsync(
            string templateCode,
            string channel,
            Guid ownerId,
            IReadOnlyDictionary<string, string>? variables = null,
            DateTime? scheduledAt = null,
            CancellationToken cancellationToken = default) =>
            throw new InvalidOperationException("Owner notification was not expected.");
    }
}
