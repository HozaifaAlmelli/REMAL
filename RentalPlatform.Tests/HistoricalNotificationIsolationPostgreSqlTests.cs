using System.Reflection;
using System.Runtime.CompilerServices;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
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

internal static class HistoricalNotificationIsolationTestStartup
{
    [ModuleInitializer]
    internal static void InitializeNpgsqlCompatibility()
    {
        // Direct service tests bypass API Program.cs, which enables this before
        // Npgsql and AppDbContext are initialized.
        AppContext.SetSwitch("Npgsql.EnableLegacyTimestampBehavior", true);
    }
}

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

        var sql = new List<string>();
        var services = new ServiceCollection();
        services.AddDbContext<AppDbContext>(options => options
            .UseNpgsql(database.ConnectionString)
            .LogTo(
                sql.Add,
                [DbLoggerCategory.Database.Command.Name],
                LogLevel.Information));
        services.AddScoped<IUnitOfWork, UnitOfWork>();
        services.AddScoped<INotificationService, NotificationService>();
        await using var provider = services.BuildServiceProvider();
        var job = new AutoCompleteBookingsJob(
            provider.GetRequiredService<IServiceScopeFactory>(),
            new FixedBusinessClock(new DateOnly(2026, 8, 16)),
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

        var notification = await verify.Notifications.AsNoTracking()
            .Include(item => item.Template)
            .SingleAsync();
        Assert.Equal(seed.Admin.Id, notification.AdminUserId);
        Assert.Null(notification.ClientId);
        Assert.Equal("in_app", notification.Channel);
        Assert.Equal("delivered", notification.NotificationStatus);
        Assert.Equal(
            "BOOKING_COMPLETED_WITH_BALANCE",
            notification.Template.TemplateCode,
            ignoreCase: true);
        Assert.Contains(
            seed.Ordinary.Id.ToString()[..8].ToUpperInvariant(),
            notification.Body,
            StringComparison.Ordinal);
        Assert.Equal(1, await verify.Notifications.CountAsync());

        var selectorCommands = sql.Where(command =>
            command.Contains("FROM bookings AS b", StringComparison.OrdinalIgnoreCase)
            && command.Contains("is_historical", StringComparison.OrdinalIgnoreCase)
            && command.Contains("check_in", StringComparison.OrdinalIgnoreCase))
            .ToArray();
        Assert.NotEmpty(selectorCommands);
        var historicalPredicate = new Regex(
            @"WHERE\s+NOT\s*\(?\s*b\.is_historical\s*\)?",
            RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);
        Assert.Contains(selectorCommands, command => historicalPredicate.IsMatch(
            command.Replace("\"", string.Empty, StringComparison.Ordinal)));

        var directNotifications = new CountingNotificationService(
            new NotificationService(new UnitOfWork(verify)));
        await InvokeOutstandingBalanceNotificationAsync(
            job,
            new UnitOfWork(verify),
            directNotifications,
            historical);
        Assert.Equal(0, directNotifications.AdminCreateCalls);
        Assert.Equal(1, await verify.Notifications.CountAsync());

        Assert.Equal(0, await verify.NotificationDeliveryLogs.CountAsync());
        Assert.Equal(0, await verify.Invoices.CountAsync());
        Assert.Equal(0, await verify.InvoiceItems.CountAsync());
        Assert.Equal(0, await verify.Payments.CountAsync());
        Assert.Equal(0, await verify.OwnerPayouts.CountAsync());
        Assert.Equal(0, await verify.CrmLeads.CountAsync());
        Assert.Equal(0, await verify.CrmNotes.CountAsync());
        Assert.Equal(0, await verify.CrmAssignments.CountAsync());
    }

    [Fact]
    public async Task ConfirmationCreatesOrdinaryInvoiceAndIsolatesHistoricalFaultFixture()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        await using var context = database.CreateDbContext();
        var seed = await SeedAsync(context);
        var unitOfWork = new UnitOfWork(context);
        var notifications = new CountingNotificationService(
            new NotificationService(unitOfWork));
        var lifecycle = new BookingLifecycleService(
            unitOfWork,
            new UnitAvailabilityService(unitOfWork),
            new InvoiceService(unitOfWork),
            notifications,
            NullLogger<BookingLifecycleService>.Instance);

        await lifecycle.ConfirmAsync(
            seed.Ordinary.Id,
            seed.Admin.Id,
            "ordinary confirmation");

        // Historical creation normally writes Completed directly. Booked is deliberate
        // fault injection proving a later lifecycle call cannot bypass HB-07 isolation.
        await lifecycle.ConfirmAsync(
            seed.Historical.Id,
            seed.Admin.Id,
            "historical fault-injection confirmation");

        context.ChangeTracker.Clear();
        var ordinary = await context.Bookings.AsNoTracking()
            .SingleAsync(booking => booking.Id == seed.Ordinary.Id);
        var historical = await context.Bookings.AsNoTracking()
            .SingleAsync(booking => booking.Id == seed.Historical.Id);
        Assert.Equal(BookingStatus.Confirmed, ordinary.BookingStatus);
        Assert.Equal(BookingStatus.Confirmed, historical.BookingStatus);

        foreach (var bookingId in new[] { ordinary.Id, historical.Id })
        {
            var history = await context.BookingStatusHistories.AsNoTracking()
                .SingleAsync(item => item.BookingId == bookingId);
            Assert.Equal("booked", history.OldStatus);
            Assert.Equal("confirmed", history.NewStatus);
            Assert.Equal(seed.Admin.Id, history.ChangedByAdminUserId);
        }

        var ordinaryInvoice = await context.Invoices.AsNoTracking()
            .Include(invoice => invoice.InvoiceItems)
            .SingleAsync(invoice => invoice.BookingId == ordinary.Id);
        Assert.Equal("issued", ordinaryInvoice.InvoiceStatus);
        Assert.NotNull(ordinaryInvoice.IssuedAt);
        Assert.Equal(ordinary.FinalAmount, ordinaryInvoice.SubtotalAmount);
        Assert.Equal(ordinary.FinalAmount, ordinaryInvoice.TotalAmount);
        var ordinaryItem = Assert.Single(ordinaryInvoice.InvoiceItems);
        Assert.Equal("booking_stay", ordinaryItem.LineType);
        Assert.Equal(1, ordinaryItem.Quantity);
        Assert.Equal(ordinary.FinalAmount, ordinaryItem.UnitAmount);
        Assert.Equal(ordinary.FinalAmount, ordinaryItem.LineTotal);

        Assert.Equal(0, await context.Invoices.CountAsync(invoice =>
            invoice.BookingId == historical.Id));
        Assert.Equal(0, await context.InvoiceItems.CountAsync(item =>
            item.Invoice.BookingId == historical.Id));
        Assert.Equal([ordinary.ClientId], notifications.ClientRecipients);
        Assert.Equal(1, notifications.ClientCreateCalls);
        Assert.InRange(
            await context.Notifications.CountAsync(item => item.ClientId == ordinary.ClientId),
            0,
            1);
        Assert.Equal(0, await context.Notifications.CountAsync(item =>
            item.ClientId == historical.ClientId));
        Assert.Equal(0, await context.NotificationDeliveryLogs.CountAsync());
        Assert.Equal(0, await context.OwnerPayouts.CountAsync());
        Assert.Equal(0, await context.CrmLeads.CountAsync());
        Assert.Equal(0, await context.CrmNotes.CountAsync());
        Assert.Equal(0, await context.CrmAssignments.CountAsync());
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

    private static async Task InvokeOutstandingBalanceNotificationAsync(
        AutoCompleteBookingsJob job,
        IUnitOfWork unitOfWork,
        INotificationService notificationService,
        Booking booking)
    {
        var method = typeof(AutoCompleteBookingsJob).GetMethod(
            "NotifyAdminsIfOutstandingBalanceAsync",
            BindingFlags.Instance | BindingFlags.NonPublic)
            ?? throw new InvalidOperationException(
                "Outstanding-balance notification entry point was not found.");
        var task = method.Invoke(
            job,
            [unitOfWork, notificationService, booking, CancellationToken.None]) as Task
            ?? throw new InvalidOperationException(
                "Outstanding-balance notification entry point did not return a task.");
        await task;
    }

    private static async Task<SeedData> SeedAsync(
        AppDbContext context,
        bool forAutomaticSweep = false)
    {
        await context.AdminUsers.ExecuteUpdateAsync(setters => setters
            .SetProperty(admin => admin.IsActive, false));

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
        var ordinaryClient = new Client
        {
            Id = Guid.NewGuid(), Name = "HB07 ordinary client", Phone = TestPhone("22"),
            PasswordHash = "test-only-hash", IsActive = true
        };
        var historicalClient = new Client
        {
            Id = Guid.NewGuid(), Name = "HB07 historical client", Phone = TestPhone("23"),
            PasswordHash = "test-only-hash", IsActive = true
        };
        var admin = new AdminUser
        {
            Id = Guid.NewGuid(), Name = "HB07 admin",
            Email = $"hb07-{suffix}@example.test", PasswordHash = "test-only-hash",
            RoleTemplateId = Guid.Parse("10000000-0000-0000-0000-000000000001"),
            IsActive = true
        };
        var ordinaryUnit = new Unit
        {
            Id = Guid.NewGuid(), OwnerId = owner.Id, ProjectId = project.Id,
            Name = $"HB07 ordinary unit {suffix}", UnitType = "apartment", Bedrooms = 2,
            Bathrooms = 1, MaxGuests = 4, BasePricePerNight = 100m,
            IsActive = true, IsVisibleInPortfolio = true
        };
        var historicalUnit = new Unit
        {
            Id = Guid.NewGuid(), OwnerId = owner.Id, ProjectId = project.Id,
            Name = $"HB07 historical unit {suffix}", UnitType = "apartment", Bedrooms = 2,
            Bathrooms = 1, MaxGuests = 4, BasePricePerNight = 100m,
            IsActive = true, IsVisibleInPortfolio = true
        };
        context.AddRange(
            owner,
            project,
            ordinaryClient,
            historicalClient,
            admin,
            ordinaryUnit,
            historicalUnit);
        await context.SaveChangesAsync();

        var ordinary = Booking(
            ordinaryUnit,
            owner,
            ordinaryClient,
            admin,
            false,
            forAutomaticSweep);
        var historical = Booking(
            historicalUnit,
            owner,
            historicalClient,
            admin,
            true,
            forAutomaticSweep);
        context.Bookings.AddRange(ordinary, historical);
        await context.SaveChangesAsync();
        return new SeedData(admin, ordinary, historical);
    }

    private static Booking Booking(
        Unit unit,
        Owner owner,
        Client client,
        AdminUser admin,
        bool historical,
        bool forAutomaticSweep) => new()
    {
        Id = Guid.NewGuid(), ClientId = client.Id, UnitId = unit.Id, OwnerId = owner.Id,
        AssignedAdminUserId = admin.Id,
        BookingStatus = forAutomaticSweep ? BookingStatus.CheckIn : BookingStatus.Booked,
        CheckInDate = forAutomaticSweep
            ? (historical ? new DateOnly(2020, 2, 1) : new DateOnly(2020, 1, 1))
            : (historical ? new DateOnly(2026, 7, 10) : new DateOnly(2026, 10, 10)),
        CheckOutDate = forAutomaticSweep
            ? (historical ? new DateOnly(2020, 2, 3) : new DateOnly(2020, 1, 3))
            : (historical ? new DateOnly(2026, 7, 12) : new DateOnly(2026, 10, 12)),
        GuestCount = 2,
        BaseAmount = forAutomaticSweep ? 250m : 100m,
        FinalAmount = forAutomaticSweep ? 250m : 100m,
        AgreedAmount = historical ? (forAutomaticSweep ? 250m : 100m) : null,
        Source = "admin", IsHistorical = historical,
        ActualBookedAt = historical
            ? (forAutomaticSweep ? new DateOnly(2020, 1, 20) : new DateOnly(2026, 7, 1))
            : null,
        HistoricalEntryReason = historical
            ? HistoricalEntryReasons.AccountingReconciliation
            : null,
        OriginalSource = historical ? "legacy_system" : null,
        CreatedAt = DateTime.UtcNow,
        UpdatedAt = DateTime.UtcNow
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

    private sealed class CountingNotificationService : INotificationService
    {
        private readonly INotificationService _inner;

        public CountingNotificationService(INotificationService inner)
        {
            _inner = inner;
        }

        public int AdminCreateCalls { get; private set; }
        public int ClientCreateCalls { get; private set; }
        public List<Guid> AdminRecipients { get; } = [];
        public List<Guid> ClientRecipients { get; } = [];

        public Task<IReadOnlyList<Notification>> GetAllAsync(
            string? notificationStatus = null,
            string? channel = null,
            Guid? templateId = null,
            CancellationToken cancellationToken = default) =>
            _inner.GetAllAsync(notificationStatus, channel, templateId, cancellationToken);

        public Task<Notification?> GetByIdAsync(
            Guid id,
            CancellationToken cancellationToken = default) =>
            _inner.GetByIdAsync(id, cancellationToken);

        public Task<Notification> CreateForAdminAsync(
            string templateCode,
            string channel,
            Guid adminUserId,
            IReadOnlyDictionary<string, string>? variables = null,
            DateTime? scheduledAt = null,
            CancellationToken cancellationToken = default)
        {
            AdminCreateCalls++;
            AdminRecipients.Add(adminUserId);
            return _inner.CreateForAdminAsync(
                templateCode,
                channel,
                adminUserId,
                variables,
                scheduledAt,
                cancellationToken);
        }

        public Task<Notification> CreateForClientAsync(
            string templateCode,
            string channel,
            Guid clientId,
            IReadOnlyDictionary<string, string>? variables = null,
            DateTime? scheduledAt = null,
            CancellationToken cancellationToken = default)
        {
            ClientCreateCalls++;
            ClientRecipients.Add(clientId);
            return _inner.CreateForClientAsync(
                templateCode,
                channel,
                clientId,
                variables,
                scheduledAt,
                cancellationToken);
        }

        public Task<Notification> CreateForOwnerAsync(
            string templateCode,
            string channel,
            Guid ownerId,
            IReadOnlyDictionary<string, string>? variables = null,
            DateTime? scheduledAt = null,
            CancellationToken cancellationToken = default) =>
            _inner.CreateForOwnerAsync(
                templateCode,
                channel,
                ownerId,
                variables,
                scheduledAt,
                cancellationToken);
    }

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
