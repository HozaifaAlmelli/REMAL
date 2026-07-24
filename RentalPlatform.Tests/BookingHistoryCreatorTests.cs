using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using RentalPlatform.API.Controllers;
using RentalPlatform.API.DTOs.Requests.BookingLifecycle;
using RentalPlatform.API.DTOs.Requests.Bookings;
using RentalPlatform.API.DTOs.Responses.BookingLifecycle;
using RentalPlatform.API.Models;
using RentalPlatform.Business.Interfaces;
using RentalPlatform.Business.Models;
using RentalPlatform.Business.Services;
using RentalPlatform.Data;
using RentalPlatform.Data.Entities;
using RentalPlatform.Shared.Constants;
using RentalPlatform.Shared.Enums;
using RentalPlatform.Shared.Models;
using Xunit;

namespace RentalPlatform.Tests;

public sealed class BookingHistoryCreatorTests
{
    [Fact]
    public async Task PortalCreationAndStatusChange_PreserveEachAuthenticatedActor()
    {
        await using var fixture = await BookingFixture.CreateAsync();
        var creatorController = fixture.CreateBookingsController(fixture.AdminAId);
        var request = fixture.CreateRequest(assignedAdminUserId: fixture.AdminBId);

        var createResult = await creatorController.CreateBooking(request);
        var createdBooking = Assert.IsType<OkObjectResult>(createResult.Result);
        Assert.NotNull(createdBooking.Value);

        var creationRow = Assert.Single(fixture.Context.BookingStatusHistories);
        Assert.Equal(fixture.AdminAId, creationRow.ChangedByAdminUserId);
        Assert.NotEqual(fixture.AdminBId, creationRow.ChangedByAdminUserId);

        fixture.Context.ChangeTracker.Clear();
        var viewerController = fixture.CreateBookingsController(fixture.AdminBId);
        var initialHistory = await GetHistoryAsync(viewerController, creationRow.BookingId);

        var initialEntry = Assert.Single(initialHistory);
        Assert.Equal(fixture.AdminAId, initialEntry.ChangedByAdminUserId);
        Assert.Equal("Sanitized Admin A", initialEntry.ActorDisplayName);
        Assert.Equal("admin", initialEntry.ActorType);

        var lifecycleController = fixture.CreateLifecycleController(fixture.AdminBId);
        await lifecycleController.RelevantBooking(
            creationRow.BookingId,
            new RelevantBookingRequest { Notes = "Sanitized follow-up completed." });

        fixture.Context.ChangeTracker.Clear();
        var refreshedHistory = await GetHistoryAsync(viewerController, creationRow.BookingId);
        Assert.Equal(2, refreshedHistory.Count);

        var creationAfterUpdate = Assert.Single(
            refreshedHistory,
            entry => entry.Notes == BookingHistoryEvents.BookingCreated);
        var statusUpdate = Assert.Single(
            refreshedHistory,
            entry => entry.Notes == "Sanitized follow-up completed.");

        Assert.Equal(fixture.AdminAId, creationAfterUpdate.ChangedByAdminUserId);
        Assert.Equal("Sanitized Admin A", creationAfterUpdate.ActorDisplayName);
        Assert.Equal(fixture.AdminBId, statusUpdate.ChangedByAdminUserId);
        Assert.Equal("Sanitized Admin B", statusUpdate.ActorDisplayName);
    }

    [Fact]
    public async Task HistoricalNullCreation_UsesOnlyDeterministicFallbacks()
    {
        await using var fixture = await BookingFixture.CreateAsync();
        var internalBooking = fixture.AddBooking("admin");
        var onlineBooking = fixture.AddBooking("website");
        fixture.Context.BookingStatusHistories.AddRange(
            fixture.CreateHistory(internalBooking.Id, null, "prospecting", null, BookingHistoryEvents.BookingCreated),
            fixture.CreateHistory(onlineBooking.Id, null, "prospecting", null, BookingHistoryEvents.BookingCreated));
        await fixture.Context.SaveChangesAsync();
        fixture.Context.ChangeTracker.Clear();

        var viewer = fixture.CreateBookingsController(fixture.AdminBId);
        var internalHistory = Assert.Single(await GetHistoryAsync(viewer, internalBooking.Id));
        var onlineHistory = Assert.Single(await GetHistoryAsync(viewer, onlineBooking.Id));

        Assert.Equal("Creator unavailable", internalHistory.ActorDisplayName);
        Assert.Equal("unavailable", internalHistory.ActorType);
        Assert.Equal("Online booking", onlineHistory.ActorDisplayName);
        Assert.Equal("online", onlineHistory.ActorType);
        Assert.Null(internalHistory.ChangedByAdminUserId);
        Assert.Null(onlineHistory.ChangedByAdminUserId);
    }

    [Fact]
    public async Task NullNonCreationActor_DoesNotInheritBookingCreator()
    {
        await using var fixture = await BookingFixture.CreateAsync();
        var booking = fixture.AddBooking("admin");
        fixture.Context.BookingStatusHistories.AddRange(
            fixture.CreateHistory(
                booking.Id,
                null,
                "prospecting",
                fixture.AdminAId,
                BookingHistoryEvents.BookingCreated),
            fixture.CreateHistory(
                booking.Id,
                "prospecting",
                "relevant",
                null,
                "Historical status actor was not recorded."));
        await fixture.Context.SaveChangesAsync();
        fixture.Context.ChangeTracker.Clear();

        var history = await GetHistoryAsync(
            fixture.CreateBookingsController(fixture.AdminBId),
            booking.Id);
        var statusEntry = Assert.Single(
            history,
            entry => entry.Notes == "Historical status actor was not recorded.");

        Assert.Equal("Actor unavailable", statusEntry.ActorDisplayName);
        Assert.Equal("unavailable", statusEntry.ActorType);
        Assert.Null(statusEntry.ChangedByAdminUserId);
    }

    [Fact]
    public async Task SystemAndDeactivatedActors_RemainExplicitAndRenderable()
    {
        await using var fixture = await BookingFixture.CreateAsync();
        fixture.AdminA.IsActive = false;
        var booking = fixture.AddBooking("admin");
        fixture.Context.BookingStatusHistories.AddRange(
            fixture.CreateHistory(
                booking.Id,
                null,
                "prospecting",
                fixture.AdminAId,
                BookingHistoryEvents.BookingCreated),
            fixture.CreateHistory(
                booking.Id,
                "check_in",
                "completed",
                null,
                BookingHistoryEvents.AutomaticCompletion));
        await fixture.Context.SaveChangesAsync();
        fixture.Context.ChangeTracker.Clear();

        var history = await GetHistoryAsync(
            fixture.CreateBookingsController(fixture.AdminBId),
            booking.Id);
        var creator = Assert.Single(
            history,
            entry => entry.Notes == BookingHistoryEvents.BookingCreated);
        var system = Assert.Single(
            history,
            entry => entry.Notes == BookingHistoryEvents.AutomaticCompletion);

        Assert.Equal("Sanitized Admin A", creator.ActorDisplayName);
        Assert.Equal("admin", creator.ActorType);
        Assert.Equal("System", system.ActorDisplayName);
        Assert.Equal("system", system.ActorType);
    }

    [Fact]
    public async Task PortalCreation_DerivesCreatorFromClaimsAndRejectsMissingIdentity()
    {
        await using var fixture = await BookingFixture.CreateAsync();
        var request = fixture.CreateRequest(assignedAdminUserId: fixture.AdminBId);
        var controller = fixture.CreateBookingsController(adminUserId: null);

        await Assert.ThrowsAsync<UnauthorizedAccessException>(
            () => controller.CreateBooking(request));
        Assert.Empty(fixture.Context.Bookings);
        Assert.Empty(fixture.Context.BookingStatusHistories);
    }

    private static async Task<IReadOnlyList<BookingStatusHistoryResponse>> GetHistoryAsync(
        BookingsController controller,
        Guid bookingId)
    {
        var action = await controller.GetBookingStatusHistory(bookingId);
        var ok = Assert.IsType<OkObjectResult>(action.Result);
        var envelope = Assert.IsType<ApiResponse<IReadOnlyList<BookingStatusHistoryResponse>>>(ok.Value);
        return Assert.IsAssignableFrom<IReadOnlyList<BookingStatusHistoryResponse>>(envelope.Data);
    }

    private sealed class BookingFixture : IAsyncDisposable
    {
        private readonly UnitOfWork _unitOfWork;
        private readonly BookingService _bookingService;
        private readonly BookingLifecycleService _lifecycleService;

        private BookingFixture(
            AppDbContext context,
            UnitOfWork unitOfWork,
            BookingService bookingService,
            BookingLifecycleService lifecycleService,
            AdminUser adminA,
            AdminUser adminB,
            Client client,
            Unit unit)
        {
            Context = context;
            _unitOfWork = unitOfWork;
            _bookingService = bookingService;
            _lifecycleService = lifecycleService;
            AdminA = adminA;
            AdminB = adminB;
            Client = client;
            Unit = unit;
        }

        public AppDbContext Context { get; }
        public AdminUser AdminA { get; }
        public AdminUser AdminB { get; }
        public Client Client { get; }
        public Unit Unit { get; }
        public Guid AdminAId => AdminA.Id;
        public Guid AdminBId => AdminB.Id;

        public static async Task<BookingFixture> CreateAsync()
        {
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase($"booking-history-{Guid.NewGuid():N}")
                .Options;
            var context = new AppDbContext(options);
            var roleTemplate = new RbacRoleTemplate
            {
                Id = Guid.NewGuid(),
                Name = "Sanitized Test Role",
                IsActive = true,
                IsSystem = false
            };
            var adminA = CreateAdmin("Sanitized Admin A", "admin-a@example.test", roleTemplate.Id);
            var adminB = CreateAdmin("Sanitized Admin B", "admin-b@example.test", roleTemplate.Id);
            var owner = new Owner
            {
                Id = Guid.NewGuid(),
                Name = "Sanitized Owner",
                Phone = "+201000000001",
                EmergencyPhone = "+201000000002",
                CommissionRate = 0.10m,
                Status = "active",
                PasswordHash = "not-used"
            };
            var project = new Project
            {
                Id = Guid.NewGuid(),
                Name = "Sanitized Project",
                IsActive = true
            };
            var client = new Client
            {
                Id = Guid.NewGuid(),
                Name = "Sanitized Client",
                Phone = "+201000000003",
                PasswordHash = "not-used",
                IsActive = true
            };
            var unit = new Unit
            {
                Id = Guid.NewGuid(),
                OwnerId = owner.Id,
                ProjectId = project.Id,
                Name = "Sanitized Unit",
                UnitType = "apartment",
                Bedrooms = 2,
                Bathrooms = 1,
                MaxGuests = 4,
                BasePricePerNight = 1_000m,
                IsActive = true,
                IsVisibleInPortfolio = true
            };

            context.AddRange(roleTemplate, adminA, adminB, owner, project, client, unit);
            await context.SaveChangesAsync();

            var unitOfWork = new UnitOfWork(context);
            var availability = new AvailableUnitService();
            var bookingService = new BookingService(unitOfWork, availability);
            var lifecycleService = new BookingLifecycleService(
                unitOfWork,
                availability,
                new UnusedInvoiceService(),
                new NoOpNotificationService(),
                NullLogger<BookingLifecycleService>.Instance);

            return new BookingFixture(
                context,
                unitOfWork,
                bookingService,
                lifecycleService,
                adminA,
                adminB,
                client,
                unit);
        }

        public CreateBookingRequest CreateRequest(Guid? assignedAdminUserId) => new()
        {
            ClientId = Client.Id,
            UnitId = Unit.Id,
            CheckInDate = new DateOnly(2027, 1, 10),
            CheckOutDate = new DateOnly(2027, 1, 12),
            GuestCount = 2,
            Source = "admin",
            AssignedAdminUserId = assignedAdminUserId,
            InternalNotes = "Sanitized booking."
        };

        public BookingsController CreateBookingsController(Guid? adminUserId)
        {
            var controller = new BookingsController(_bookingService);
            controller.ControllerContext = ControllerContextFor(adminUserId);
            return controller;
        }

        public BookingLifecycleController CreateLifecycleController(Guid adminUserId)
        {
            var controller = new BookingLifecycleController(_lifecycleService);
            controller.ControllerContext = ControllerContextFor(adminUserId);
            return controller;
        }

        public Booking AddBooking(string source)
        {
            var booking = new Booking
            {
                Id = Guid.NewGuid(),
                ClientId = Client.Id,
                UnitId = Unit.Id,
                OwnerId = Unit.OwnerId,
                BookingStatus = BookingStatus.Prospecting,
                CheckInDate = new DateOnly(2027, 2, 10),
                CheckOutDate = new DateOnly(2027, 2, 12),
                GuestCount = 2,
                BaseAmount = 2_000m,
                FinalAmount = 2_000m,
                Source = source
            };
            Context.Bookings.Add(booking);
            return booking;
        }

        public BookingStatusHistory CreateHistory(
            Guid bookingId,
            string? oldStatus,
            string newStatus,
            Guid? actorId,
            string notes) => new()
        {
            Id = Guid.NewGuid(),
            BookingId = bookingId,
            OldStatus = oldStatus,
            NewStatus = newStatus,
            ChangedByAdminUserId = actorId,
            Notes = notes,
            ChangedAt = DateTime.UtcNow
        };

        public ValueTask DisposeAsync() => Context.DisposeAsync();

        private static AdminUser CreateAdmin(string name, string email, Guid roleTemplateId) => new()
        {
            Id = Guid.NewGuid(),
            Name = name,
            Email = email,
            PasswordHash = "not-used",
            RoleTemplateId = roleTemplateId,
            IsActive = true
        };

        private static ControllerContext ControllerContextFor(Guid? adminUserId)
        {
            var claims = adminUserId.HasValue
                ? new[] { new Claim(ClaimTypes.NameIdentifier, adminUserId.Value.ToString()) }
                : Array.Empty<Claim>();
            var principal = new ClaimsPrincipal(new ClaimsIdentity(claims, "SanitizedTest"));
            return new ControllerContext
            {
                HttpContext = new DefaultHttpContext { User = principal }
            };
        }
    }

    private sealed class AvailableUnitService : IUnitAvailabilityService
    {
        public Task<UnitAvailabilityResult> CheckOperationalAvailabilityAsync(
            Guid unitId,
            DateOnly startDate,
            DateOnly endDate,
            Guid? excludeBookingId = null,
            CancellationToken cancellationToken = default) =>
            Task.FromResult(new UnitAvailabilityResult
            {
                UnitId = unitId,
                StartDate = startDate,
                EndDate = endDate,
                IsAvailable = true
            });

        public Task<UnitPricingResult> CalculatePricingAsync(
            Guid unitId,
            DateOnly startDate,
            DateOnly endDate,
            CancellationToken cancellationToken = default) =>
            Task.FromResult(new UnitPricingResult
            {
                UnitId = unitId,
                StartDate = startDate,
                EndDate = endDate,
                TotalPrice = 2_000m
            });
    }

    private sealed class NoOpNotificationService : INotificationService
    {
        public Task<IReadOnlyList<Notification>> GetAllAsync(
            string? notificationStatus = null,
            string? channel = null,
            Guid? templateId = null,
            CancellationToken cancellationToken = default) =>
            Task.FromResult<IReadOnlyList<Notification>>(Array.Empty<Notification>());

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
            Task.FromResult(new Notification { Id = Guid.NewGuid() });

        public Task<Notification> CreateForClientAsync(
            string templateCode,
            string channel,
            Guid clientId,
            IReadOnlyDictionary<string, string>? variables = null,
            DateTime? scheduledAt = null,
            CancellationToken cancellationToken = default) =>
            Task.FromResult(new Notification { Id = Guid.NewGuid() });

        public Task<Notification> CreateForOwnerAsync(
            string templateCode,
            string channel,
            Guid ownerId,
            IReadOnlyDictionary<string, string>? variables = null,
            DateTime? scheduledAt = null,
            CancellationToken cancellationToken = default) =>
            Task.FromResult(new Notification { Id = Guid.NewGuid() });
    }

    private sealed class UnusedInvoiceService : IInvoiceService
    {
        public Task<PagedResult<Invoice>> GetAllAsync(
            string? invoiceStatus = null,
            Guid? bookingId = null,
            int page = 1,
            int pageSize = 20,
            CancellationToken cancellationToken = default) =>
            throw new NotSupportedException();

        public Task<Invoice?> GetByIdAsync(
            Guid id,
            CancellationToken cancellationToken = default) =>
            throw new NotSupportedException();

        public Task<Invoice> CreateDraftFromBookingAsync(
            Guid bookingId,
            string? invoiceNumber,
            string? notes,
            CancellationToken cancellationToken = default) =>
            throw new NotSupportedException();

        public Task<Invoice> AddManualAdjustmentAsync(
            Guid invoiceId,
            string description,
            int quantity,
            decimal unitAmount,
            CancellationToken cancellationToken = default) =>
            throw new NotSupportedException();

        public Task<Invoice> IssueAsync(
            Guid id,
            CancellationToken cancellationToken = default) =>
            throw new NotSupportedException();

        public Task<Invoice> CancelAsync(
            Guid id,
            string? notes,
            CancellationToken cancellationToken = default) =>
            throw new NotSupportedException();

        public Task<Invoice> ReissueAsync(
            Guid id,
            string? newInvoiceNumber,
            string? notes,
            CancellationToken cancellationToken = default) =>
            throw new NotSupportedException();

        public Task<int> LinkOrphanedPaymentsAsync(
            CancellationToken cancellationToken = default) =>
            throw new NotSupportedException();
    }
}
