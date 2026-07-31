using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;
using Npgsql;
using System.Diagnostics.Metrics;
using System.Security.Claims;
using System.Text.Json;
using RentalPlatform.API.Controllers;
using RentalPlatform.API.DTOs.Requests.Bookings;
using RentalPlatform.API.DTOs.Responses.Bookings;
using RentalPlatform.API.Models;
using RentalPlatform.Business.Exceptions;
using RentalPlatform.Business.Interfaces;
using RentalPlatform.Business.Models;
using RentalPlatform.Business.Services;
using RentalPlatform.Business.Time;
using RentalPlatform.Data;
using RentalPlatform.Data.Entities;
using RentalPlatform.Shared.Constants;
using RentalPlatform.Shared.Enums;
using RentalPlatform.Tests.Infrastructure;
using Xunit;

namespace RentalPlatform.Tests;

[Collection(PostgreSqlTestCollection.Name)]
[Trait(TestCategories.Name, TestCategories.PostgreSql)]
public sealed class HistoricalBookingPostgreSqlTests
{
    private readonly PostgreSqlFixture _fixture;

    public HistoricalBookingPostgreSqlTests(PostgreSqlFixture fixture)
    {
        _fixture = fixture;
    }

    [Fact]
    public async Task CreationPersistsTruthfulStateAndIdempotencyReplaysWithoutSideEffects()
    {
        long createdMeasurements = 0;
        using var meterListener = new MeterListener
        {
            InstrumentPublished = (instrument, listener) =>
            {
                if (instrument.Meter.Name == "Kaza.Bookings.Historical")
                    listener.EnableMeasurementEvents(instrument);
            }
        };
        meterListener.SetMeasurementEventCallback<long>((instrument, measurement, _, _) =>
        {
            if (instrument.Name == "historical_booking_created_total")
                Interlocked.Add(ref createdMeasurements, measurement);
        });
        meterListener.Start();

        await using var database = await _fixture.CreateTestDatabaseAsync();
        await using var context = database.CreateDbContext();
        var data = await SeedAsync(context);
        var service = CreateService(context, new DateOnly(2026, 8, 1));
        var command = CreateCommand(data, Guid.NewGuid(), agreedAmount: 300m);

        var before = await SideEffectCounts.ReadAsync(context);
        var result = await service.RecordAsync(command);
        var after = await SideEffectCounts.ReadAsync(context);

        Assert.False(result.IsReplay);
        Assert.True(result.Booking.IsHistorical);
        Assert.Equal(BookingStatus.Completed, result.Booking.BookingStatus);
        Assert.Equal(300m, result.Booking.BaseAmount);
        Assert.Equal(300m, result.Booking.FinalAmount);
        Assert.Equal(data.Owner.Id, result.Booking.OwnerId);
        Assert.Equal("admin", result.Booking.Source);
        Assert.Equal("offline_record", result.Booking.OriginalSource);
        Assert.Equal(command.ActualBookedAt, result.Booking.ActualBookedAt);
        Assert.NotEqual(command.ActualBookedAt.ToDateTime(TimeOnly.MinValue), result.Booking.CreatedAt);
        Assert.Equal(before, after);

        var history = await context.BookingStatusHistories
            .AsNoTracking()
            .Where(item => item.BookingId == result.Booking.Id)
            .ToListAsync();
        var creation = Assert.Single(history);
        Assert.Null(creation.OldStatus);
        Assert.Equal("completed", creation.NewStatus);
        Assert.Equal(data.Admin.Id, creation.ChangedByAdminUserId);
        Assert.Equal(BookingHistoryEvents.HistoricalBookingRecorded, creation.Notes);
        Assert.Equal(result.StatusHistoryEventId, creation.Id);

        var idempotency = await context.IdempotencyKeys.AsNoTracking().SingleAsync(item =>
            item.ActorAdminUserId == data.Admin.Id &&
            item.Endpoint == HistoricalBookingService.Endpoint &&
            item.Key == command.IdempotencyKey.ToString("D"));
        Assert.Equal(result.Booking.Id, idempotency.BookingId);
        Assert.Equal(200, idempotency.ResponseStatus);
        Assert.NotNull(idempotency.CompletedAt);

        var replay = await service.RecordAsync(command);
        Assert.True(replay.IsReplay);
        Assert.Equal(result.Booking.Id, replay.Booking.Id);
        Assert.Equal(1, await context.Bookings.CountAsync(item => item.Id == result.Booking.Id));
        Assert.Equal(1, await context.BookingStatusHistories.CountAsync(item => item.BookingId == result.Booking.Id));
        Assert.Equal(1, Interlocked.Read(ref createdMeasurements));

        var conflict = await Assert.ThrowsAsync<ConflictException>(() =>
            service.RecordAsync(command with { AgreedAmount = 301m }));
        Assert.Equal(HistoricalErrorCodes.IdempotencyKeyReused, conflict.Code);
        Assert.Equal(1, await context.Bookings.CountAsync(item => item.Id == result.Booking.Id));

        var duplicateReference = await Assert.ThrowsAsync<ConflictException>(() =>
            service.RecordAsync(command with { IdempotencyKey = Guid.NewGuid() }));
        Assert.Equal(HistoricalErrorCodes.ExternalReferenceAlreadyExists, duplicateReference.Code);
        Assert.Equal(1, await context.Bookings.CountAsync(item => item.Id == result.Booking.Id));
    }

    [Fact]
    public async Task InitialAndReplayControllerResponsesAreSerializedIdenticallyWithAssignedAdmin()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        await using var context = database.CreateDbContext();
        var data = await SeedAsync(context);
        var service = CreateService(context, new DateOnly(2026, 8, 1));
        var key = Guid.NewGuid();
        var request = CreateRequest(data) with
        {
            AssignedAdminUserId = data.Admin.Id,
            ExternalReference = $"sanitized-response-{Guid.NewGuid():N}"
        };
        var controller = CreateController(service, data.Admin.Id, key);

        var initial = await controller.RecordHistoricalBooking(request, CancellationToken.None);
        var initialBody = Assert.IsType<OkObjectResult>(initial.Result).Value;
        var initialJson = JsonSerializer.Serialize(initialBody, JsonSerializerOptions.Web);

        var replay = await controller.RecordHistoricalBooking(request, CancellationToken.None);
        var replayBody = Assert.IsType<OkObjectResult>(replay.Result).Value;
        var replayJson = JsonSerializer.Serialize(replayBody, JsonSerializerOptions.Web);

        Assert.Equal(initialJson, replayJson);
        var initialEnvelope = Assert.IsType<ApiResponse<HistoricalBookingResponse>>(
            initialBody);
        var replayEnvelope = Assert.IsType<ApiResponse<HistoricalBookingResponse>>(
            replayBody);
        Assert.NotNull(initialEnvelope.Data);
        Assert.NotNull(replayEnvelope.Data);
        Assert.Equal(initialEnvelope.Data.Id, replayEnvelope.Data.Id);
        Assert.Equal(data.Admin.Name, replayEnvelope.Data.AssignedAdminUserName);
        Assert.Equal(1, await context.Bookings.CountAsync(item => item.Id == initialEnvelope.Data.Id));
        Assert.Equal(1, await context.BookingStatusHistories.CountAsync(item =>
            item.BookingId == initialEnvelope.Data.Id));
        Assert.Equal(1, await context.IdempotencyKeys.CountAsync(item =>
            item.ActorAdminUserId == data.Admin.Id && item.Key == key.ToString("D")));
    }

    [Fact]
    public async Task ValidationFailuresRollbackClaimsClientsBookingsAndHistory()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        await using var context = database.CreateDbContext();
        var data = await SeedAsync(context);
        var service = CreateService(context, new DateOnly(2026, 8, 1));

        var missingSource = CreateCommand(data, Guid.NewGuid()) with
        {
            OriginalSource = "not_seeded"
        };
        var sourceError = await Assert.ThrowsAsync<BusinessValidationException>(
            () => service.RecordAsync(missingSource));
        Assert.Equal(HistoricalErrorCodes.OriginalSourceInvalid, sourceError.Code);
        context.ChangeTracker.Clear();
        Assert.False(await context.IdempotencyKeys.AsNoTracking().AnyAsync(item =>
            item.Key == missingSource.IdempotencyKey.ToString("D")));
        Assert.False(await context.Bookings.AsNoTracking().AnyAsync(item =>
            item.ExternalReference == missingSource.ExternalReference));

        var duplicatePhone = CreateCommand(data, Guid.NewGuid()) with
        {
            ClientId = null,
            NewClient = new NewHistoricalClient(
                "Sanitized Duplicate",
                data.Client.Phone,
                null),
            ExternalReference = $"sanitized-{Guid.NewGuid():N}"
        };
        var phoneError = await Assert.ThrowsAsync<ConflictException>(
            () => service.RecordAsync(duplicatePhone));
        Assert.Equal(HistoricalErrorCodes.ClientPhoneAlreadyExists, phoneError.Code);
        Assert.Equal(data.Client.Id, phoneError.Metadata!["existingClientId"]);
        context.ChangeTracker.Clear();
        Assert.False(await context.IdempotencyKeys.AsNoTracking().AnyAsync(item =>
            item.Key == duplicatePhone.IdempotencyKey.ToString("D")));
        Assert.Equal(1, await context.Clients.IgnoreQueryFilters().CountAsync(item => item.Phone == data.Client.Phone));

        var unknownClient = CreateCommand(data, Guid.NewGuid()) with
        {
            ClientId = Guid.NewGuid(),
            ExternalReference = $"sanitized-{Guid.NewGuid():N}"
        };
        var clientError = await Assert.ThrowsAsync<NotFoundException>(
            () => service.RecordAsync(unknownClient));
        Assert.Equal(HistoricalErrorCodes.ClientNotFound, clientError.Code);
        context.ChangeTracker.Clear();
        Assert.False(await context.IdempotencyKeys.AsNoTracking().AnyAsync(item =>
            item.Key == unknownClient.IdempotencyKey.ToString("D")));

        var newPhone = TestPhone("23");
        var newClient = CreateCommand(data, Guid.NewGuid()) with
        {
            ClientId = null,
            NewClient = new NewHistoricalClient(
                "Sanitized Newly Created Client",
                newPhone,
                null),
            ExternalReference = $"sanitized-{Guid.NewGuid():N}"
        };
        var createdForNewClient = await service.RecordAsync(newClient);
        Assert.True(await context.Clients.AsNoTracking().AnyAsync(item =>
            item.Id == createdForNewClient.Booking.ClientId && item.Phone == newPhone));

        data.Owner.Status = "inactive";
        context.Owners.Update(data.Owner);
        await context.SaveChangesAsync();
        context.ChangeTracker.Clear();
        var ownerReview = CreateCommand(data, Guid.NewGuid()) with
        {
            ExternalReference = $"sanitized-{Guid.NewGuid():N}"
        };
        var ownerError = await Assert.ThrowsAsync<ConflictException>(
            () => service.RecordAsync(ownerReview));
        Assert.Equal(HistoricalErrorCodes.OwnerAttributionRequiresReview, ownerError.Code);
        context.ChangeTracker.Clear();
        Assert.False(await context.IdempotencyKeys.AsNoTracking().AnyAsync(item =>
            item.Key == ownerReview.IdempotencyKey.ToString("D")));

        data.Owner.Status = "active";
        context.Owners.Update(data.Owner);
        var source = await context.BookingOriginalSources.SingleAsync(item =>
            item.Code == "offline_record");
        source.IsActive = false;
        await context.SaveChangesAsync();
        context.ChangeTracker.Clear();

        var inactiveSource = CreateCommand(data, Guid.NewGuid()) with
        {
            ExternalReference = $"sanitized-{Guid.NewGuid():N}"
        };
        var inactiveSourceError = await Assert.ThrowsAsync<BusinessValidationException>(
            () => service.RecordAsync(inactiveSource));
        Assert.Equal(HistoricalErrorCodes.OriginalSourceInvalid, inactiveSourceError.Code);
        context.ChangeTracker.Clear();
        Assert.False(await context.IdempotencyKeys.AsNoTracking().AnyAsync(item =>
            item.Key == inactiveSource.IdempotencyKey.ToString("D")));
        Assert.True(await context.Bookings.AsNoTracking().AnyAsync(item =>
            item.Id == createdForNewClient.Booking.Id && item.OriginalSource == "offline_record"));
    }

    [Fact]
    public async Task ClientPhoneIdentityDistinguishesSelectableAndUnavailableClients()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        await using var context = database.CreateDbContext();
        var data = await SeedAsync(context);
        var service = CreateService(context, new DateOnly(2026, 8, 1));

        var activeDuplicate = CreateCommand(data, Guid.NewGuid()) with
        {
            ClientId = null,
            NewClient = new NewHistoricalClient("Sanitized Active Duplicate", data.Client.Phone, null),
            ExternalReference = $"sanitized-active-{Guid.NewGuid():N}"
        };
        var activeError = await Assert.ThrowsAsync<ConflictException>(
            () => service.RecordAsync(activeDuplicate));
        AssertClientMetadata(activeError, HistoricalErrorCodes.ClientPhoneAlreadyExists, data.Client.Id);

        var directRetry = activeDuplicate with
        {
            IdempotencyKey = Guid.NewGuid(),
            ClientId = data.Client.Id,
            NewClient = null,
            ExternalReference = $"sanitized-active-retry-{Guid.NewGuid():N}"
        };
        var retryResult = await service.RecordAsync(directRetry);
        Assert.Equal(data.Client.Id, retryResult.Booking.ClientId);

        var inactiveClient = CreateUnavailableClient(isActive: false, deletedAt: null);
        var deletedClient = CreateUnavailableClient(isActive: true, deletedAt: DateTime.UtcNow);
        context.Clients.AddRange(inactiveClient, deletedClient);
        await context.SaveChangesAsync();
        context.ChangeTracker.Clear();

        foreach (var unavailable in new[] { inactiveClient, deletedClient })
        {
            var command = CreateCommand(data, Guid.NewGuid()) with
            {
                ClientId = null,
                NewClient = new NewHistoricalClient(
                    "Sanitized Unavailable Duplicate",
                    unavailable.Phone,
                    null),
                ExternalReference = $"sanitized-review-{Guid.NewGuid():N}"
            };
            var error = await Assert.ThrowsAsync<ConflictException>(() => service.RecordAsync(command));
            AssertClientMetadata(error, HistoricalErrorCodes.ClientPhoneRequiresReview, unavailable.Id);
            Assert.DoesNotContain("retry with", error.Message, StringComparison.OrdinalIgnoreCase);
            context.ChangeTracker.Clear();
            Assert.False(await context.Bookings.AsNoTracking().AnyAsync(item =>
                item.ExternalReference == command.ExternalReference));
            var unchanged = await context.Clients.IgnoreQueryFilters().AsNoTracking()
                .SingleAsync(item => item.Id == unavailable.Id);
            Assert.Equal(unavailable.IsActive, unchanged.IsActive);
            DateTime? expectedDeletedAt = unavailable.DeletedAt is null
                ? null
                : unavailable.DeletedAt.Value.AddTicks(-(unavailable.DeletedAt.Value.Ticks % 10));
            Assert.Equal(expectedDeletedAt, unchanged.DeletedAt);
        }

        Assert.Equal(3, await context.Clients.IgnoreQueryFilters().CountAsync(item =>
            item.Id == data.Client.Id || item.Id == inactiveClient.Id || item.Id == deletedClient.Id));
    }

    [Fact]
    public async Task ConcurrentNewClientPhoneCreatesOneClientAndOneBooking()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        SeededData data;
        Unit secondUnit;
        await using (var seedContext = database.CreateDbContext())
        {
            data = await SeedAsync(seedContext);
            secondUnit = CreateUnit(data, "phone-race");
            seedContext.Units.Add(secondUnit);
            await seedContext.SaveChangesAsync();
        }

        var phone = TestPhone("25");
        var first = CreateCommand(data, Guid.NewGuid()) with
        {
            ClientId = null,
            NewClient = new NewHistoricalClient("Sanitized Phone Race", phone, null),
            ExternalReference = $"sanitized-phone-race-a-{Guid.NewGuid():N}"
        };
        var second = first with
        {
            UnitId = secondUnit.Id,
            IdempotencyKey = Guid.NewGuid(),
            ExternalReference = $"sanitized-phone-race-b-{Guid.NewGuid():N}"
        };

        await using var firstContext = database.CreateDbContext();
        await using var secondContext = database.CreateDbContext();
        var outcomes = await Task.WhenAll(
            CaptureOutcomeAsync(CreateService(firstContext, new DateOnly(2026, 8, 1)), first),
            CaptureOutcomeAsync(CreateService(secondContext, new DateOnly(2026, 8, 1)), second));

        Assert.Single(outcomes, outcome => outcome.Result is not null);
        var conflict = Assert.Single(outcomes, outcome => outcome.Error is not null).Error!;
        Assert.Equal(HistoricalErrorCodes.ClientPhoneAlreadyExists, conflict.Code);
        var metadata = Assert.IsAssignableFrom<IReadOnlyDictionary<string, object?>>(conflict.Metadata);
        Assert.Single(metadata);
        Assert.True(metadata.ContainsKey("existingClientId"));

        await using var verifyContext = database.CreateDbContext();
        Assert.Equal(1, await verifyContext.Clients.IgnoreQueryFilters().CountAsync(item => item.Phone == phone));
        Assert.Equal(1, await verifyContext.Bookings.CountAsync(item =>
            item.ExternalReference == first.ExternalReference ||
            item.ExternalReference == second.ExternalReference));
        Assert.Equal(1, await verifyContext.IdempotencyKeys.CountAsync(item =>
            item.Key == first.IdempotencyKey.ToString("D") ||
            item.Key == second.IdempotencyKey.ToString("D")));
    }

    [Fact]
    public async Task IdempotencyScopeAllowsSameKeyForDifferentActors()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        await using var context = database.CreateDbContext();
        var data = await SeedAsync(context);
        var secondAdmin = new AdminUser
        {
            Id = Guid.NewGuid(),
            Name = "Sanitized HB02 Second Admin",
            Email = $"hb02-second-{Guid.NewGuid():N}@example.test",
            PasswordHash = "test-only-hash",
            RoleTemplateId = Guid.Parse("10000000-0000-0000-0000-000000000001"),
            IsActive = true
        };
        context.AdminUsers.Add(secondAdmin);
        await context.SaveChangesAsync();

        var key = Guid.NewGuid();
        var service = CreateService(context, new DateOnly(2026, 8, 1));
        var first = await service.RecordAsync(CreateCommand(data, key));
        var second = await service.RecordAsync(CreateCommand(data, key) with
        {
            ActorAdminUserId = secondAdmin.Id
        });

        Assert.NotEqual(first.Booking.Id, second.Booking.Id);
        Assert.Equal(2, await context.IdempotencyKeys.CountAsync(item => item.Key == key.ToString("D")));
        Assert.Equal(2, await context.Bookings.CountAsync(item =>
            item.Id == first.Booking.Id || item.Id == second.Booking.Id));
    }

    [Fact]
    public async Task ConcurrentDifferentRequestsWithSameActorAndKeyReturnCodedConflict()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        SeededData data;
        Unit secondUnit;
        await using (var seedContext = database.CreateDbContext())
        {
            data = await SeedAsync(seedContext);
            secondUnit = new Unit
            {
                Id = Guid.NewGuid(),
                OwnerId = data.Owner.Id,
                ProjectId = data.Unit.ProjectId,
                Name = $"Sanitized HB02 Concurrent Unit {Guid.NewGuid():N}",
                UnitType = "apartment",
                Bedrooms = 1,
                Bathrooms = 1,
                MaxGuests = 2,
                BasePricePerNight = 900m,
                IsActive = true,
                IsVisibleInPortfolio = true
            };
            seedContext.Units.Add(secondUnit);
            await seedContext.SaveChangesAsync();
        }

        var key = Guid.NewGuid();
        var firstCommand = CreateCommand(data, key);
        var secondCommand = CreateCommand(data, key) with { UnitId = secondUnit.Id };
        await using var firstContext = database.CreateDbContext();
        await using var secondContext = database.CreateDbContext();
        var firstTask = CaptureOutcomeAsync(
            CreateService(firstContext, new DateOnly(2026, 8, 1)),
            firstCommand);
        var secondTask = CaptureOutcomeAsync(
            CreateService(secondContext, new DateOnly(2026, 8, 1)),
            secondCommand);

        var outcomes = await Task.WhenAll(firstTask, secondTask);

        Assert.Single(outcomes, outcome => outcome.Result is not null);
        var conflict = Assert.Single(outcomes, outcome => outcome.Error is not null).Error;
        Assert.Equal(HistoricalErrorCodes.IdempotencyKeyReused, conflict!.Code);
        await using var verifyContext = database.CreateDbContext();
        Assert.Equal(1, await verifyContext.IdempotencyKeys.CountAsync(item =>
            item.ActorAdminUserId == data.Admin.Id && item.Key == key.ToString("D")));
        Assert.Equal(1, await verifyContext.Bookings.CountAsync(item =>
            item.ExternalReference == firstCommand.ExternalReference ||
            item.ExternalReference == secondCommand.ExternalReference));
    }

    [Fact]
    public async Task ConcurrentIdenticalRequestsReplayOneSameUnitBooking()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        SeededData data;
        await using (var seedContext = database.CreateDbContext())
            data = await SeedAsync(seedContext);

        var command = CreateCommand(data, Guid.NewGuid()) with
        {
            AssignedAdminUserId = data.Admin.Id,
            ExternalReference = $"sanitized-identical-race-{Guid.NewGuid():N}"
        };
        await using var firstContext = database.CreateDbContext();
        await using var secondContext = database.CreateDbContext();
        var results = await Task.WhenAll(
            CreateService(firstContext, new DateOnly(2026, 8, 1)).RecordAsync(command),
            CreateService(secondContext, new DateOnly(2026, 8, 1)).RecordAsync(command));

        Assert.Equal(results[0].Booking.Id, results[1].Booking.Id);
        Assert.Single(results, result => !result.IsReplay);
        Assert.Single(results, result => result.IsReplay);
        Assert.Equal(results[0].Booking.AssignedAdminUser?.Name, results[1].Booking.AssignedAdminUser?.Name);

        await using var verifyContext = database.CreateDbContext();
        Assert.Equal(1, await verifyContext.Bookings.CountAsync(item => item.Id == results[0].Booking.Id));
        Assert.Equal(1, await verifyContext.BookingStatusHistories.CountAsync(item =>
            item.BookingId == results[0].Booking.Id));
        Assert.Equal(1, await verifyContext.IdempotencyKeys.CountAsync(item =>
            item.ActorAdminUserId == data.Admin.Id && item.Key == command.IdempotencyKey.ToString("D")));
    }

    [Fact]
    public async Task ExistingNormalCreateRemainsNonHistoricalAndUsesItsExistingHistoryContract()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        await using var context = database.CreateDbContext();
        var data = await SeedAsync(context);
        var unitOfWork = new UnitOfWork(context);
        var service = new BookingService(unitOfWork, new UnitAvailabilityService(unitOfWork));

        var booking = await service.CreateAsync(
            data.Client.Id,
            data.Unit.Id,
            new DateOnly(2027, 1, 10),
            new DateOnly(2027, 1, 12),
            1,
            "admin",
            null,
            data.Admin.Id,
            "Sanitized normal booking regression.");

        Assert.False(booking.IsHistorical);
        Assert.Equal(BookingStatus.Prospecting, booking.BookingStatus);
        Assert.Null(booking.ActualBookedAt);
        Assert.Null(booking.HistoricalEntryReason);
        Assert.Null(booking.OriginalSource);
        var history = Assert.Single(await context.BookingStatusHistories
            .AsNoTracking()
            .Where(item => item.BookingId == booking.Id)
            .ToListAsync());
        Assert.Equal(BookingHistoryEvents.BookingCreated, history.Notes);
    }

    [Fact]
    public async Task HistoricalReachableUnitAndAvailabilityFailuresHaveStableCodes()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        await using var context = database.CreateDbContext();
        var data = await SeedAsync(context);
        var service = CreateService(context, new DateOnly(2026, 8, 1));

        data.Unit.IsActive = false;
        await context.SaveChangesAsync();
        context.ChangeTracker.Clear();

        var inactiveHistorical = CreateCommand(data, Guid.NewGuid()) with
        {
            ExternalReference = $"sanitized-inactive-{Guid.NewGuid():N}"
        };
        var historicalResult = await service.RecordAsync(inactiveHistorical);
        Assert.Equal(data.Unit.Id, historicalResult.Booking.UnitId);

        var normalUnitOfWork = new UnitOfWork(context);
        var normalService = new BookingService(
            normalUnitOfWork,
            new UnitAvailabilityService(normalUnitOfWork));
        await Assert.ThrowsAsync<NotFoundException>(() => normalService.CreateAsync(
            data.Client.Id,
            data.Unit.Id,
            new DateOnly(2027, 1, 10),
            new DateOnly(2027, 1, 12),
            1,
            "admin",
            null,
            data.Admin.Id,
            "Sanitized normal inactive-unit regression."));

        var missing = CreateCommand(data, Guid.NewGuid()) with
        {
            UnitId = Guid.NewGuid(),
            ExternalReference = $"sanitized-missing-{Guid.NewGuid():N}"
        };
        var missingError = await Assert.ThrowsAsync<NotFoundException>(() => service.RecordAsync(missing));
        AssertStableCode(missingError, HistoricalErrorCodes.UnitNotFound);

        await context.Units.IgnoreQueryFilters()
            .Where(item => item.Id == data.Unit.Id)
            .ExecuteUpdateAsync(setters => setters.SetProperty(item => item.DeletedAt, DateTime.UtcNow));
        context.ChangeTracker.Clear();
        var deleted = CreateCommand(data, Guid.NewGuid()) with
        {
            ExternalReference = $"sanitized-deleted-{Guid.NewGuid():N}"
        };
        var deletedError = await Assert.ThrowsAsync<BusinessValidationException>(
            () => service.RecordAsync(deleted));
        AssertStableCode(deletedError, HistoricalErrorCodes.UnitDeletedUnsupported);

        await context.Units.IgnoreQueryFilters()
            .Where(item => item.Id == data.Unit.Id)
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(item => item.DeletedAt, (DateTime?)null)
                .SetProperty(item => item.IsActive, true));
        context.ChangeTracker.Clear();

        var capacity = CreateCommand(data, Guid.NewGuid()) with
        {
            GuestCount = data.Unit.MaxGuests + 1,
            ExternalReference = $"sanitized-capacity-{Guid.NewGuid():N}"
        };
        var capacityError = await Assert.ThrowsAsync<BusinessValidationException>(
            () => service.RecordAsync(capacity));
        AssertStableCode(capacityError, HistoricalErrorCodes.ValidationError);

        var dateBlock = new DateBlock
        {
            Id = Guid.NewGuid(),
            UnitId = data.Unit.Id,
            StartDate = new DateOnly(2026, 7, 20),
            EndDate = new DateOnly(2026, 7, 21),
            Reason = "maintenance",
            Status = DateBlockStatus.Approved,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        context.DateBlocks.Add(dateBlock);
        await context.SaveChangesAsync();
        context.ChangeTracker.Clear();
        var blocked = CreateCommand(data, Guid.NewGuid()) with
        {
            ExternalReference = $"sanitized-blocked-{Guid.NewGuid():N}"
        };
        var blockError = await Assert.ThrowsAsync<ConflictException>(() => service.RecordAsync(blocked));
        AssertStableCode(blockError, HistoricalErrorCodes.HistoricalOverlapConflict);

        await context.DateBlocks
            .Where(item => item.Id == dateBlock.Id)
            .ExecuteDeleteAsync();
        context.ChangeTracker.Clear();
        context.Bookings.Add(new Booking
        {
            Id = Guid.NewGuid(),
            ClientId = data.Client.Id,
            UnitId = data.Unit.Id,
            OwnerId = data.Owner.Id,
            BookingStatus = BookingStatus.Confirmed,
            CheckInDate = new DateOnly(2026, 7, 20),
            CheckOutDate = new DateOnly(2026, 7, 22),
            GuestCount = 1,
            BaseAmount = 100m,
            FinalAmount = 100m,
            Source = "admin",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        });
        await context.SaveChangesAsync();
        context.ChangeTracker.Clear();
        var overlap = CreateCommand(data, Guid.NewGuid()) with
        {
            ExternalReference = $"sanitized-overlap-{Guid.NewGuid():N}"
        };
        var overlapError = await Assert.ThrowsAsync<ConflictException>(() => service.RecordAsync(overlap));
        AssertStableCode(overlapError, HistoricalErrorCodes.HistoricalOverlapConflict);
    }

    [Fact]
    public async Task BoundaryAndIncompleteClaimReturnStableCodesWithoutCreatingRows()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        await using var context = database.CreateDbContext();
        var data = await SeedAsync(context);
        var cairoToday = new DateOnly(2026, 8, 1);
        var service = CreateService(context, cairoToday);

        var yesterday = CreateCommand(data, Guid.NewGuid()) with
        {
            CheckInDate = cairoToday.AddDays(-3),
            CheckOutDate = cairoToday.AddDays(-1),
            ActualBookedAt = cairoToday.AddDays(-4)
        };
        var accepted = await service.RecordAsync(yesterday);
        Assert.Equal(BookingStatus.Completed, accepted.Booking.BookingStatus);

        var today = CreateCommand(data, Guid.NewGuid()) with
        {
            CheckInDate = cairoToday.AddDays(-1),
            CheckOutDate = cairoToday,
            ActualBookedAt = cairoToday.AddDays(-2),
            ExternalReference = $"sanitized-{Guid.NewGuid():N}"
        };
        var todayError = await Assert.ThrowsAsync<BusinessValidationException>(
            () => service.RecordAsync(today));
        Assert.Equal(HistoricalErrorCodes.HistoricalCheckoutNotCompleted, todayError.Code);

        var tomorrow = today with
        {
            IdempotencyKey = Guid.NewGuid(),
            CheckInDate = cairoToday,
            CheckOutDate = cairoToday.AddDays(1)
        };
        var tomorrowError = await Assert.ThrowsAsync<BusinessValidationException>(
            () => service.RecordAsync(tomorrow));
        Assert.Equal(HistoricalErrorCodes.HistoricalCheckoutNotCompleted, tomorrowError.Code);

        var inProgress = CreateCommand(data, Guid.NewGuid()) with
        {
            ExternalReference = $"sanitized-{Guid.NewGuid():N}"
        };
        context.IdempotencyKeys.Add(new IdempotencyKey
        {
            ActorAdminUserId = data.Admin.Id,
            Endpoint = HistoricalBookingService.Endpoint,
            Key = inProgress.IdempotencyKey.ToString("D"),
            RequestHash = HistoricalRequestHasher.Compute(inProgress),
            CreatedAt = DateTime.UtcNow
        });
        await context.SaveChangesAsync();
        context.ChangeTracker.Clear();

        var first = await Assert.ThrowsAsync<ConflictException>(
            () => service.RecordAsync(inProgress));
        var second = await Assert.ThrowsAsync<ConflictException>(
            () => service.RecordAsync(inProgress));
        Assert.Equal(HistoricalErrorCodes.IdempotencyRequestInProgress, first.Code);
        Assert.Equal(HistoricalErrorCodes.IdempotencyRequestInProgress, second.Code);
        Assert.False(await context.Bookings.AsNoTracking().AnyAsync(item =>
            item.ExternalReference == inProgress.ExternalReference));
    }

    [Fact]
    public async Task FailureAfterBookingFlushRollsBackClientBookingHistoryAndIdempotencyClaim()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        await using var context = database.CreateDbContext();
        var data = await SeedAsync(context);
        var unitOfWork = new UnitOfWork(context);
        var availability = new UnitAvailabilityService(unitOfWork);
        var bookingService = new BookingService(unitOfWork, availability);
        var clientService = new ClientService(unitOfWork, NullLogger<ClientService>.Instance);
        var idempotency = new FailingCompletionStore(new HistoricalIdempotencyStore(unitOfWork));
        var service = new HistoricalBookingService(
            unitOfWork,
            bookingService,
            clientService,
            new FixedBusinessClock(new DateOnly(2026, 8, 1)),
            idempotency,
            NullLogger<HistoricalBookingService>.Instance);
        var newPhone = TestPhone("24");
        var command = CreateCommand(data, Guid.NewGuid()) with
        {
            ClientId = null,
            NewClient = new NewHistoricalClient("Sanitized Rollback Client", newPhone, null),
            ExternalReference = $"sanitized-rollback-{Guid.NewGuid():N}"
        };

        await Assert.ThrowsAsync<InvalidOperationException>(() => service.RecordAsync(command));
        context.ChangeTracker.Clear();

        Assert.False(await context.Clients.IgnoreQueryFilters().AsNoTracking()
            .AnyAsync(item => item.Phone == newPhone));
        Assert.False(await context.Bookings.AsNoTracking()
            .AnyAsync(item => item.ExternalReference == command.ExternalReference));
        Assert.False(await context.BookingStatusHistories.AsNoTracking()
            .AnyAsync(item => item.Notes == BookingHistoryEvents.HistoricalBookingRecorded));
        Assert.False(await context.IdempotencyKeys.AsNoTracking()
            .AnyAsync(item => item.Key == command.IdempotencyKey.ToString("D")));
    }

    [Fact]
    public async Task MigrationEnforcesVocabularyCoherenceAndConcurrentUniqueIndex()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        await using (var compatibilityConnection = await database.OpenConnectionAsync())
        {
            await using var existingRows = new NpgsqlCommand(
                """
                SELECT count(*)
                FROM bookings
                WHERE is_historical OR actual_booked_at IS NOT NULL
                   OR historical_entry_reason IS NOT NULL OR original_source IS NOT NULL
                   OR external_reference IS NOT NULL
                """,
                compatibilityConnection);
            Assert.Equal(0L, Convert.ToInt64(await existingRows.ExecuteScalarAsync()));
        }

        Guid bookingId;
        Guid actorId;
        Guid idempotencyKey;
        string externalReference;
        await using (var context = database.CreateDbContext())
        {
            var data = await SeedAsync(context);
            var command = CreateCommand(data, Guid.NewGuid(), agreedAmount: 25m);
            var result = await CreateService(context, new DateOnly(2026, 8, 1))
                .RecordAsync(command);
            bookingId = result.Booking.Id;
            actorId = data.Admin.Id;
            idempotencyKey = command.IdempotencyKey;
            externalReference = command.ExternalReference!;
        }

        await using var connection = await database.OpenConnectionAsync();

        await using (var sources = new NpgsqlCommand(
            "SELECT array_agg(code ORDER BY code) FROM booking_original_sources",
            connection))
        {
            var actual = (string[])(await sources.ExecuteScalarAsync())!;
            Assert.Equal(
                new[] { "external_platform", "legacy_system", "offline_record", "other" },
                actual);
        }

        await using (var invalidSource = new NpgsqlCommand(
            "UPDATE bookings SET original_source = 'invented_source' WHERE id = $1",
            connection))
        {
            invalidSource.Parameters.AddWithValue(bookingId);
            var exception = await Assert.ThrowsAsync<PostgresException>(
                () => invalidSource.ExecuteNonQueryAsync());
            Assert.Equal(PostgresErrorCodes.ForeignKeyViolation, exception.SqlState);
            Assert.Equal("fk_bookings_original_source", exception.ConstraintName);
        }

        await using (var index = new NpgsqlCommand(
            """
            SELECT indisunique AND indisvalid
            FROM pg_index
            WHERE indexrelid = 'ux_bookings_external_reference'::regclass
            """,
            connection))
        {
            Assert.True((bool)(await index.ExecuteScalarAsync())!);
        }

        await using (var permission = new NpgsqlCommand(
            """
            SELECT count(*)
            FROM rbac_role_template_permissions
            WHERE permission_key = 'bookings:record_historical'
              AND role_template_id = '10000000-0000-0000-0000-000000000001'
            """,
            connection))
        {
            Assert.Equal(1L, Convert.ToInt64(await permission.ExecuteScalarAsync()));
        }

        await using (var invalidReason = new NpgsqlCommand(
            "UPDATE bookings SET historical_entry_reason = 'invented_reason' WHERE id = $1",
            connection))
        {
            invalidReason.Parameters.AddWithValue(bookingId);
            var exception = await Assert.ThrowsAsync<PostgresException>(
                () => invalidReason.ExecuteNonQueryAsync());
            Assert.Equal(PostgresErrorCodes.CheckViolation, exception.SqlState);
            Assert.Equal("ck_bookings_historical_entry_reason", exception.ConstraintName);
        }

        await using (var incoherent = new NpgsqlCommand(
            "UPDATE bookings SET actual_booked_at = NULL WHERE id = $1",
            connection))
        {
            incoherent.Parameters.AddWithValue(bookingId);
            var exception = await Assert.ThrowsAsync<PostgresException>(
                () => incoherent.ExecuteNonQueryAsync());
            Assert.Equal(PostgresErrorCodes.CheckViolation, exception.SqlState);
            Assert.Equal("ck_bookings_historical_fields_coherent", exception.ConstraintName);
        }

        await using (var duplicateReference = new NpgsqlCommand(
            """
            INSERT INTO bookings (
                client_id, unit_id, owner_id, assigned_admin_user_id, booking_status,
                check_in_date, check_out_date, guest_count, base_amount, final_amount,
                source, internal_notes, external_reference, created_at, updated_at
            )
            SELECT
                client_id, unit_id, owner_id, assigned_admin_user_id, 'prospecting',
                check_in_date, check_out_date, guest_count, base_amount, final_amount,
                source, 'Sanitized duplicate-index probe', external_reference,
                CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
            FROM bookings WHERE id = $1
            """,
            connection))
        {
            duplicateReference.Parameters.AddWithValue(bookingId);
            var exception = await Assert.ThrowsAsync<PostgresException>(
                () => duplicateReference.ExecuteNonQueryAsync());
            Assert.Equal(PostgresErrorCodes.UniqueViolation, exception.SqlState);
            Assert.Equal("ux_bookings_external_reference", exception.ConstraintName);
        }

        await using (var duplicateIdempotency = new NpgsqlCommand(
            """
            INSERT INTO idempotency_keys (
                actor_admin_user_id, endpoint, key, request_hash, created_at
            ) VALUES ($1, $2, $3, 'different-hash', CURRENT_TIMESTAMP)
            """,
            connection))
        {
            duplicateIdempotency.Parameters.AddWithValue(actorId);
            duplicateIdempotency.Parameters.AddWithValue(HistoricalBookingService.Endpoint);
            duplicateIdempotency.Parameters.AddWithValue(idempotencyKey.ToString("D"));
            var exception = await Assert.ThrowsAsync<PostgresException>(
                () => duplicateIdempotency.ExecuteNonQueryAsync());
            Assert.Equal(PostgresErrorCodes.UniqueViolation, exception.SqlState);
            Assert.Equal("pk_idempotency_keys", exception.ConstraintName);
        }

        await using var persisted = new NpgsqlCommand(
            "SELECT external_reference FROM bookings WHERE id = $1",
            connection);
        persisted.Parameters.AddWithValue(bookingId);
        Assert.Equal(externalReference, await persisted.ExecuteScalarAsync());
    }

    [Fact]
    public async Task Migration0059RecoversFailedConcurrentBuildAndVerifierRejectsInvalidIndex()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        await using var context = database.CreateDbContext();
        var data = await SeedAsync(context);
        var firstBooking = CreateRawBooking(data, "duplicate-external-reference");
        var secondBooking = CreateRawBooking(data, "duplicate-external-reference");

        await using var failedConnection = await database.OpenConnectionAsync();
        await ExecuteSqlAsync(failedConnection, "DROP INDEX CONCURRENTLY IF EXISTS public.ux_bookings_external_reference");
        context.Bookings.AddRange(firstBooking, secondBooking);
        await context.SaveChangesAsync();
        context.ChangeTracker.Clear();

        await ExecuteSqlAsync(
            failedConnection,
            """
            CREATE TABLE IF NOT EXISTS schema_migrations (
                migration_number VARCHAR(10) PRIMARY KEY,
                migration_name VARCHAR(255) NOT NULL,
                applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            INSERT INTO schema_migrations (migration_number, migration_name)
            VALUES ('0058', '0058_add_historical_booking_domain.sql')
            ON CONFLICT (migration_number) DO NOTHING;
            """);

        var migrationSql = await File.ReadAllTextAsync(MigrationPath(
            "0059_add_historical_booking_external_reference_index.sql"));
        var verifierSql = await File.ReadAllTextAsync(MigrationPath(
            "0059_add_historical_booking_external_reference_index_verify.sql"));

        var failedBuild = await Assert.ThrowsAsync<PostgresException>(
            () => PostgreSqlFixture.ExecuteMigrationSqlAsync(failedConnection, migrationSql));
        Assert.Equal(PostgresErrorCodes.UniqueViolation, failedBuild.SqlState);
        var failedState = await ReadIndexStateAsync(
            failedConnection,
            "ux_bookings_external_reference__build");
        Assert.NotNull(failedState);
        Assert.False(failedState.Value.IsValid);
        Assert.False(failedState.Value.IsReady);
        Assert.Null(await ReadIndexStateAsync(failedConnection, "ux_bookings_external_reference"));
        Assert.Equal(0L, await MigrationLedgerCountAsync(failedConnection, "0059"));
        await Assert.ThrowsAnyAsync<Exception>(() => ExecuteSqlAsync(failedConnection, verifierSql));
        await failedConnection.CloseAsync();

        await using var connection = await database.OpenConnectionAsync();

        await ExecuteSqlAsync(
            connection,
            "UPDATE bookings SET external_reference = 'corrected-external-reference' WHERE id = $1",
            secondBooking.Id);
        await PostgreSqlFixture.ExecuteMigrationSqlAsync(connection, migrationSql);
        await ExecuteSqlAsync(connection, verifierSql);

        var recovered = await ReadIndexStateAsync(connection, "ux_bookings_external_reference");
        Assert.NotNull(recovered);
        Assert.True(recovered.Value.IsUnique);
        Assert.True(recovered.Value.IsValid);
        Assert.True(recovered.Value.IsReady);
        Assert.Equal("btree", recovered.Value.AccessMethod);
        Assert.Null(await ReadIndexStateAsync(connection, "ux_bookings_external_reference__build"));
        Assert.Equal(0L, await MigrationLedgerCountAsync(connection, "0059"));
        await PostgreSqlFixture.ExecuteMigrationSqlAsync(connection, migrationSql);
        await ExecuteSqlAsync(connection, verifierSql);
        Assert.Null(await ReadIndexStateAsync(connection, "ux_bookings_external_reference__build"));
        await ExecuteSqlAsync(
            connection,
            "INSERT INTO schema_migrations (migration_number, migration_name) VALUES ('0059', '0059_add_historical_booking_external_reference_index.sql')");
        Assert.Equal(1L, await MigrationLedgerCountAsync(connection, "0059"));

        await ExecuteSqlAsync(connection, "DROP INDEX CONCURRENTLY public.ux_bookings_external_reference");
        await ExecuteSqlAsync(
            connection,
            "UPDATE bookings SET external_reference = 'invalid-index-probe' WHERE id IN ($1, $2)",
            firstBooking.Id,
            secondBooking.Id);
        var invalidBuild = await Assert.ThrowsAsync<PostgresException>(() => ExecuteSqlAsync(
            connection,
            """
            CREATE UNIQUE INDEX CONCURRENTLY ux_bookings_external_reference
            ON public.bookings USING btree (external_reference)
            WHERE external_reference IS NOT NULL
            """));
        Assert.Equal(PostgresErrorCodes.UniqueViolation, invalidBuild.SqlState);
        var invalidCanonical = await ReadIndexStateAsync(connection, "ux_bookings_external_reference");
        Assert.NotNull(invalidCanonical);
        Assert.False(invalidCanonical.Value.IsValid);
        Assert.False(invalidCanonical.Value.IsReady);
        await Assert.ThrowsAnyAsync<Exception>(() => ExecuteSqlAsync(connection, verifierSql));

        await ExecuteSqlAsync(
            connection,
            "UPDATE bookings SET external_reference = 'invalid-index-corrected' WHERE id = $1",
            secondBooking.Id);
        await PostgreSqlFixture.ExecuteMigrationSqlAsync(connection, migrationSql);
        await ExecuteSqlAsync(connection, verifierSql);
        Assert.Null(await ReadIndexStateAsync(connection, "ux_bookings_external_reference__build"));

        await using (var duplicateProbe = new NpgsqlCommand(
            "UPDATE bookings SET external_reference = 'invalid-index-probe' WHERE id = $1",
            connection))
        {
            duplicateProbe.Parameters.AddWithValue(secondBooking.Id);
            var enforcement = await Assert.ThrowsAsync<PostgresException>(
                () => duplicateProbe.ExecuteNonQueryAsync());
            Assert.Equal(PostgresErrorCodes.UniqueViolation, enforcement.SqlState);
            Assert.Equal("ux_bookings_external_reference", enforcement.ConstraintName);
        }

        await ExecuteSqlAsync(
            connection,
            """
            CREATE TABLE hb02_later_migration_probe (id integer PRIMARY KEY);
            INSERT INTO schema_migrations (migration_number, migration_name)
            VALUES ('0060', 'sanitized_later_pending_probe.sql');
            """);
        Assert.Equal(1L, await MigrationLedgerCountAsync(connection, "0060"));

        await ExecuteSqlAsync(
            connection,
            """
            CREATE UNIQUE INDEX CONCURRENTLY ux_bookings_external_reference__build
            ON public.bookings USING btree (external_reference)
            WHERE external_reference IS NOT NULL
            """);
        var rollbackSql = await File.ReadAllTextAsync(MigrationPath(
            "0059_add_historical_booking_external_reference_index_rollback.sql"));
        await PostgreSqlFixture.ExecuteMigrationSqlAsync(connection, rollbackSql);
        Assert.Null(await ReadIndexStateAsync(connection, "ux_bookings_external_reference"));
        Assert.Null(await ReadIndexStateAsync(connection, "ux_bookings_external_reference__build"));
        await PostgreSqlFixture.ExecuteMigrationSqlAsync(connection, migrationSql);
        await ExecuteSqlAsync(connection, verifierSql);
    }

    private static HistoricalBookingsController CreateController(
        IHistoricalBookingService service,
        Guid actorAdminUserId,
        Guid idempotencyKey)
    {
        var principal = new ClaimsPrincipal(new ClaimsIdentity(
            new[] { new Claim(ClaimTypes.NameIdentifier, actorAdminUserId.ToString()) },
            "SanitizedPostgreSqlTest"));
        var httpContext = new DefaultHttpContext { User = principal };
        httpContext.Request.Headers["Idempotency-Key"] = idempotencyKey.ToString("D");
        return new HistoricalBookingsController(service)
        {
            ControllerContext = new ControllerContext { HttpContext = httpContext }
        };
    }

    private static RecordHistoricalBookingRequest CreateRequest(SeededData data) => new()
    {
        UnitId = data.Unit.Id,
        ClientId = data.Client.Id,
        CheckInDate = new DateOnly(2026, 7, 20),
        CheckOutDate = new DateOnly(2026, 7, 22),
        GuestCount = 2,
        ActualBookedAt = new DateOnly(2026, 7, 15),
        HistoricalEntryReason = HistoricalEntryReasons.OfflineBookingRecordedAfterStay,
        OriginalSource = "offline_record",
        AgreedAmount = 300m,
        InternalNotes = "Sanitized response-equivalence test."
    };

    private static Client CreateUnavailableClient(bool isActive, DateTime? deletedAt) => new()
    {
        Id = Guid.NewGuid(),
        Name = "Sanitized Unavailable Client",
        Phone = TestPhone("26"),
        PasswordHash = "test-only-hash",
        IsActive = isActive,
        DeletedAt = deletedAt,
        CreatedAt = DateTime.UtcNow,
        UpdatedAt = DateTime.UtcNow
    };

    private static Unit CreateUnit(SeededData data, string label) => new()
    {
        Id = Guid.NewGuid(),
        OwnerId = data.Owner.Id,
        ProjectId = data.Unit.ProjectId,
        Name = $"Sanitized HB02 {label} Unit {Guid.NewGuid():N}",
        UnitType = "apartment",
        Bedrooms = 1,
        Bathrooms = 1,
        MaxGuests = 2,
        BasePricePerNight = 900m,
        IsActive = true,
        IsVisibleInPortfolio = true
    };

    private static Booking CreateRawBooking(SeededData data, string externalReference) => new()
    {
        Id = Guid.NewGuid(),
        ClientId = data.Client.Id,
        UnitId = data.Unit.Id,
        OwnerId = data.Owner.Id,
        BookingStatus = BookingStatus.Prospecting,
        CheckInDate = new DateOnly(2027, 2, 1),
        CheckOutDate = new DateOnly(2027, 2, 2),
        GuestCount = 1,
        BaseAmount = 100m,
        FinalAmount = 100m,
        Source = "admin",
        ExternalReference = externalReference,
        CreatedAt = DateTime.UtcNow,
        UpdatedAt = DateTime.UtcNow
    };

    private static string MigrationPath(string fileName) => Path.Combine(
        Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..")),
        "db",
        "migrations",
        fileName);

    private static async Task ExecuteSqlAsync(
        NpgsqlConnection connection,
        string sql,
        params object[] values)
    {
        await using var command = new NpgsqlCommand(sql, connection) { CommandTimeout = 120 };
        foreach (var value in values)
            command.Parameters.AddWithValue(value);
        await command.ExecuteNonQueryAsync();
    }

    private static async Task<IndexState?> ReadIndexStateAsync(
        NpgsqlConnection connection,
        string indexName)
    {
        await using var command = new NpgsqlCommand(
            """
            SELECT i.indisunique, i.indisvalid, i.indisready, am.amname
            FROM pg_catalog.pg_class c
            JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
            JOIN pg_catalog.pg_index i ON i.indexrelid = c.oid
            JOIN pg_catalog.pg_am am ON am.oid = c.relam
            WHERE n.nspname = 'public' AND c.relname = $1
            """,
            connection);
        command.Parameters.AddWithValue(indexName);
        await using var reader = await command.ExecuteReaderAsync();
        if (!await reader.ReadAsync())
            return null;
        return new IndexState(
            reader.GetBoolean(0),
            reader.GetBoolean(1),
            reader.GetBoolean(2),
            reader.GetString(3));
    }

    private static async Task<long> MigrationLedgerCountAsync(
        NpgsqlConnection connection,
        string migrationNumber)
    {
        await using var command = new NpgsqlCommand(
            "SELECT count(*) FROM schema_migrations WHERE migration_number = $1",
            connection);
        command.Parameters.AddWithValue(migrationNumber);
        return Convert.ToInt64(await command.ExecuteScalarAsync());
    }

    private static void AssertClientMetadata(
        ConflictException exception,
        string expectedCode,
        Guid expectedClientId)
    {
        Assert.Equal(expectedCode, exception.Code);
        Assert.NotNull(exception.Metadata);
        var metadata = Assert.Single(exception.Metadata);
        Assert.Equal("existingClientId", metadata.Key);
        Assert.Equal(expectedClientId, metadata.Value);
    }

    private static void AssertStableCode(Exception exception, string expectedCode)
    {
        var coded = Assert.IsAssignableFrom<IBusinessErrorCode>(exception);
        Assert.False(string.IsNullOrWhiteSpace(coded.Code));
        Assert.Equal(expectedCode, coded.Code);
    }

    private static HistoricalBookingService CreateService(
        AppDbContext context,
        DateOnly cairoToday)
    {
        var unitOfWork = new UnitOfWork(context);
        var availability = new UnitAvailabilityService(unitOfWork);
        var bookingService = new BookingService(unitOfWork, availability);
        var clientService = new ClientService(
            unitOfWork,
            NullLogger<ClientService>.Instance);
        var idempotency = new HistoricalIdempotencyStore(unitOfWork);
        return new HistoricalBookingService(
            unitOfWork,
            bookingService,
            clientService,
            new FixedBusinessClock(cairoToday),
            idempotency,
            NullLogger<HistoricalBookingService>.Instance);
    }

    private static async Task<RecordOutcome> CaptureOutcomeAsync(
        HistoricalBookingService service,
        RecordHistoricalBookingCommand command)
    {
        try
        {
            return new RecordOutcome(await service.RecordAsync(command), null);
        }
        catch (ConflictException exception)
        {
            return new RecordOutcome(null, exception);
        }
    }

    private static RecordHistoricalBookingCommand CreateCommand(
        SeededData data,
        Guid idempotencyKey,
        decimal agreedAmount = 0m) => new(
        data.Unit.Id,
        data.Client.Id,
        null,
        new DateOnly(2026, 7, 20),
        new DateOnly(2026, 7, 22),
        2,
        new DateOnly(2026, 7, 15),
        HistoricalEntryReasons.OfflineBookingRecordedAfterStay,
        null,
        "offline_record",
        $"sanitized-{Guid.NewGuid():N}",
        agreedAmount,
        null,
        "Sanitized historical booking test.",
        data.Admin.Id,
        idempotencyKey,
        "sanitized-pg-test");

    private static async Task<SeededData> SeedAsync(AppDbContext context)
    {
        var suffix = Guid.NewGuid().ToString("N");
        var owner = new Owner
        {
            Id = Guid.NewGuid(),
            Name = "Sanitized HB02 Owner",
            Phone = TestPhone("20"),
            EmergencyPhone = TestPhone("21"),
            CommissionRate = 10m,
            Status = "active",
            PasswordHash = "test-only-hash"
        };
        var project = new Project
        {
            Id = Guid.NewGuid(),
            Name = $"Sanitized HB02 Project {suffix}",
            IsActive = true
        };
        var client = new Client
        {
            Id = Guid.NewGuid(),
            Name = "Sanitized HB02 Client",
            Phone = TestPhone("22"),
            PasswordHash = "test-only-hash",
            IsActive = true
        };
        var admin = new AdminUser
        {
            Id = Guid.NewGuid(),
            Name = "Sanitized HB02 Admin",
            Email = $"hb02-{suffix}@example.test",
            PasswordHash = "test-only-hash",
            RoleTemplateId = Guid.Parse("10000000-0000-0000-0000-000000000001"),
            IsActive = true
        };
        var unit = new Unit
        {
            Id = Guid.NewGuid(),
            OwnerId = owner.Id,
            ProjectId = project.Id,
            Name = $"Sanitized HB02 Unit {suffix}",
            UnitType = "apartment",
            Bedrooms = 2,
            Bathrooms = 1,
            MaxGuests = 4,
            BasePricePerNight = 1_000m,
            IsActive = true,
            IsVisibleInPortfolio = true
        };

        context.AddRange(owner, project, client, admin, unit);
        await context.SaveChangesAsync();
        return new SeededData(owner, client, admin, unit);
    }

    private static string TestPhone(string prefix)
    {
        var value = BitConverter.ToUInt32(Guid.NewGuid().ToByteArray(), 0) % 10_000_000_000L;
        return $"+{prefix}{value:D10}";
    }

    private sealed record SeededData(
        Owner Owner,
        Client Client,
        AdminUser Admin,
        Unit Unit);

    private sealed record RecordOutcome(
        HistoricalBookingResult? Result,
        ConflictException? Error);

    private readonly record struct IndexState(
        bool IsUnique,
        bool IsValid,
        bool IsReady,
        string AccessMethod);

    private sealed class FixedBusinessClock : IBusinessClock
    {
        private readonly DateOnly _today;

        public FixedBusinessClock(DateOnly today)
        {
            _today = today;
        }

        public DateOnly CairoToday() => _today;
    }

    private sealed class FailingCompletionStore : IHistoricalIdempotencyStore
    {
        private readonly IHistoricalIdempotencyStore _inner;

        public FailingCompletionStore(IHistoricalIdempotencyStore inner)
        {
            _inner = inner;
        }

        public Task<HistoricalIdempotencyClaim> ClaimAsync(
            Guid actorAdminUserId,
            string endpoint,
            Guid key,
            string requestHash,
            CancellationToken cancellationToken = default) =>
            _inner.ClaimAsync(
                actorAdminUserId,
                endpoint,
                key,
                requestHash,
                cancellationToken);

        public void Complete(
            Guid actorAdminUserId,
            string endpoint,
            Guid key,
            Guid bookingId) =>
            throw new InvalidOperationException("Sanitized forced failure after booking flush.");
    }

    private sealed record SideEffectCounts(
        int Invoices,
        int InvoiceItems,
        int Payments,
        int OwnerPayouts,
        int Notifications)
    {
        public static async Task<SideEffectCounts> ReadAsync(AppDbContext context) => new(
            await context.Invoices.CountAsync(),
            await context.InvoiceItems.CountAsync(),
            await context.Payments.CountAsync(),
            await context.OwnerPayouts.CountAsync(),
            await context.Notifications.CountAsync());
    }
}
