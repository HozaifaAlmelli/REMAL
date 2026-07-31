using System.Text.Json;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;
using RentalPlatform.API.Authorization;
using RentalPlatform.API.Controllers;
using RentalPlatform.API.DTOs.Requests.Bookings;
using RentalPlatform.API.Models;
using RentalPlatform.API.Middleware;
using RentalPlatform.API.Filters;
using RentalPlatform.Business.Interfaces;
using RentalPlatform.API.Validators;
using RentalPlatform.Business.Exceptions;
using RentalPlatform.Business.Models;
using RentalPlatform.Business.Services;
using RentalPlatform.Business.Time;
using RentalPlatform.Shared.Constants;
using RentalPlatform.Shared.Enums;
using RentalPlatform.Data.Entities;
using Xunit;

namespace RentalPlatform.Tests;

[Trait(TestCategories.Name, TestCategories.Fast)]
public sealed class HistoricalBookingContractTests
{
    [Fact]
    public void ApiResponseCarriesCodeAndSafeMetadataWithoutUsingErrors()
    {
        var clientId = Guid.NewGuid();
        var response = ApiResponse.CreateFailure(
            "A client already exists.",
            errors: null,
            HistoricalErrorCodes.ClientPhoneAlreadyExists,
            new Dictionary<string, object?> { ["existingClientId"] = clientId });

        Assert.Equal(HistoricalErrorCodes.ClientPhoneAlreadyExists, response.Code);
        Assert.Empty(response.Errors!);
        Assert.Equal(clientId, response.Metadata!["existingClientId"]);

        var legacy = ApiResponse.CreateFailure("Legacy failure");
        Assert.Null(legacy.Code);
        Assert.Null(legacy.Metadata);
        var legacyJson = JsonSerializer.Serialize(legacy);
        Assert.DoesNotContain("\"code\"", legacyJson, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("\"metadata\"", legacyJson, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task MiddlewareTransportsCodeAndMetadataOutsideHumanErrors()
    {
        var existingClientId = Guid.NewGuid();
        var context = new DefaultHttpContext();
        context.Response.Body = new MemoryStream();
        var middleware = new ExceptionHandlingMiddleware(
            _ => throw new ConflictException(
                "A client already exists.",
                HistoricalErrorCodes.ClientPhoneAlreadyExists,
                new Dictionary<string, object?> { ["existingClientId"] = existingClientId }),
            NullLogger<ExceptionHandlingMiddleware>.Instance);

        await middleware.InvokeAsync(context);
        context.Response.Body.Position = 0;
        using var body = await JsonDocument.ParseAsync(context.Response.Body);

        Assert.Equal(StatusCodes.Status409Conflict, context.Response.StatusCode);
        Assert.Equal(
            HistoricalErrorCodes.ClientPhoneAlreadyExists,
            body.RootElement.GetProperty("code").GetString());
        Assert.Equal(
            existingClientId,
            body.RootElement.GetProperty("metadata").GetProperty("existingClientId").GetGuid());
        Assert.DoesNotContain(
            HistoricalErrorCodes.ClientPhoneAlreadyExists,
            body.RootElement.GetProperty("errors").EnumerateArray().Select(item => item.GetString()));
    }

    [Theory]
    [InlineData(false, false)]
    [InlineData(true, true)]
    public void ValidatorRejectsBothOrNeitherClientReferences(bool hasClientId, bool hasNewClient)
    {
        var request = ValidRequest() with
        {
            ClientId = hasClientId ? Guid.NewGuid() : null,
            NewClient = hasNewClient
                ? new NewHistoricalClientRequest
                {
                    Name = "Sanitized Client",
                    Phone = "+201000000099"
                }
                : null
        };

        var result = new RecordHistoricalBookingRequestValidator().Validate(request);

        var failure = Assert.Single(
            result.Errors,
            error => error.ErrorCode == HistoricalErrorCodes.ClientReferenceInvalid);
        Assert.Contains("exactly one", failure.ErrorMessage, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void ValidatorAcceptsZeroAmountAndRejectsInvalidReasonAndNegativeAmount()
    {
        var validator = new RecordHistoricalBookingRequestValidator();
        Assert.True(validator.Validate(ValidRequest() with { AgreedAmount = 0m }).IsValid);

        var invalid = validator.Validate(ValidRequest() with
        {
            HistoricalEntryReason = "invented_reason",
            AgreedAmount = -0.01m
        });
        Assert.All(
            invalid.Errors,
            error => Assert.Equal(HistoricalErrorCodes.ValidationError, error.ErrorCode));
    }

    [Fact]
    public void RequestContractRejectsPrivilegedUnknownFields()
    {
        var json = """
            {
              "unitId":"11111111-1111-1111-1111-111111111111",
              "clientId":"22222222-2222-2222-2222-222222222222",
              "checkInDate":"2026-01-01",
              "checkOutDate":"2026-01-02",
              "guestCount":1,
              "actualBookedAt":"2025-12-20",
              "historicalEntryReason":"offline_booking_recorded_after_stay",
              "originalSource":"offline_record",
              "agreedAmount":0,
              "ownerId":"33333333-3333-3333-3333-333333333333"
            }
            """;

        Assert.Throws<JsonException>(
            () => JsonSerializer.Deserialize<RecordHistoricalBookingRequest>(json));
    }

    [Fact]
    public void CanonicalHashNormalizesWhitespaceAndDiffersWhenBusinessValueChanges()
    {
        var key = Guid.NewGuid();
        var command = ValidCommand(key) with
        {
            HistoricalEntryNote = "  Sanitized   reconciliation note  "
        };
        var equivalent = command with
        {
            HistoricalEntryNote = "Sanitized reconciliation note"
        };
        var changed = equivalent with { AgreedAmount = equivalent.AgreedAmount + 0.01m };

        Assert.Equal(
            HistoricalRequestHasher.Compute(command),
            HistoricalRequestHasher.Compute(equivalent));
        Assert.NotEqual(
            HistoricalRequestHasher.Compute(equivalent),
            HistoricalRequestHasher.Compute(changed));
    }

    [Fact]
    public void CairoClockUsesCairoDateAcrossUtcMidnightIndependentlyOfServerTimezone()
    {
        var beforeCairoMidnight = new CairoBusinessClock(
            new FixedTimeProvider(new DateTimeOffset(2026, 7, 31, 20, 59, 59, TimeSpan.Zero)));
        var afterCairoMidnight = new CairoBusinessClock(
            new FixedTimeProvider(new DateTimeOffset(2026, 7, 31, 21, 0, 0, TimeSpan.Zero)));

        Assert.Equal(new DateOnly(2026, 7, 31), beforeCairoMidnight.CairoToday());
        Assert.Equal(new DateOnly(2026, 8, 1), afterCairoMidnight.CairoToday());
    }

    [Fact]
    public void HistoricalPermissionHasExactlyOneDescriptorAndNoOwnerOverride()
    {
        Assert.Single(
            PermissionKeys.Descriptors,
            descriptor => descriptor.Key == PermissionKeys.BookingsRecordHistorical);
        Assert.Contains(PermissionKeys.BookingsRecordHistorical, PermissionKeys.All);
        Assert.DoesNotContain("bookings:override_owner", PermissionKeys.All);
    }

    [Fact]
    public async Task HistoricalControllerUsesCanonicalRouteTrustedActorAndRequiredIdempotencyHeader()
    {
        var route = Assert.Single(
            typeof(HistoricalBookingsController).GetCustomAttributes(typeof(RouteAttribute), true)
                .Cast<RouteAttribute>());
        var action = typeof(HistoricalBookingsController).GetMethod("RecordHistoricalBooking")!;
        var post = Assert.Single(
            action.GetCustomAttributes(typeof(HttpPostAttribute), true).Cast<HttpPostAttribute>());
        var authorize = Assert.Single(
            action.GetCustomAttributes(typeof(AuthorizeAttribute), true).Cast<AuthorizeAttribute>());
        Assert.Single(
            action.GetCustomAttributes(typeof(RequireHistoricalIdempotencyKeyAttribute), true));
        Assert.Equal("api/internal/bookings", route.Template);
        Assert.Equal("historical", post.Template);
        Assert.Equal(PermissionKeys.BookingsRecordHistorical, authorize.Policy);

        var requestProperties = typeof(RecordHistoricalBookingRequest)
            .GetProperties()
            .Select(property => property.Name)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
        Assert.DoesNotContain("ownerId", requestProperties);
        Assert.DoesNotContain("ownerAttribution", requestProperties);
        Assert.DoesNotContain("createdByAdminUserId", requestProperties);
        Assert.DoesNotContain("bookingStatus", requestProperties);
        Assert.DoesNotContain("isHistorical", requestProperties);

        var service = new CapturingHistoricalBookingService();
        var controller = new HistoricalBookingsController(service)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext()
            }
        };
        var missingKey = await Assert.ThrowsAsync<BusinessValidationException>(
            () => controller.RecordHistoricalBooking(ValidRequest(), CancellationToken.None));
        Assert.Equal(HistoricalErrorCodes.IdempotencyKeyRequired, missingKey.Code);
        Assert.Null(service.Command);

        controller.Request.Headers["Idempotency-Key"] = Guid.NewGuid().ToString();
        var missingActor = await Assert.ThrowsAsync<UnauthorizedBusinessException>(
            () => controller.RecordHistoricalBooking(ValidRequest(), CancellationToken.None));
        Assert.Contains("admin user ID", missingActor.Message, StringComparison.OrdinalIgnoreCase);
        Assert.Null(service.Command);

        var actor = Guid.NewGuid();
        var key = Guid.NewGuid();
        controller.HttpContext.User = new ClaimsPrincipal(new ClaimsIdentity(
            new[] { new Claim(ClaimTypes.NameIdentifier, actor.ToString()) },
            "SanitizedTest"));
        controller.Request.Headers["Idempotency-Key"] = key.ToString();
        var response = await controller.RecordHistoricalBooking(
            ValidRequest(),
            CancellationToken.None);

        Assert.IsType<OkObjectResult>(response.Result);
        Assert.Equal(actor, service.Command!.ActorAdminUserId);
        Assert.Equal(key, service.Command.IdempotencyKey);
    }

    private static RecordHistoricalBookingRequest ValidRequest() => new()
    {
        UnitId = Guid.NewGuid(),
        ClientId = Guid.NewGuid(),
        CheckInDate = new DateOnly(2026, 1, 10),
        CheckOutDate = new DateOnly(2026, 1, 12),
        GuestCount = 2,
        ActualBookedAt = new DateOnly(2026, 1, 5),
        HistoricalEntryReason = HistoricalEntryReasons.OfflineBookingRecordedAfterStay,
        OriginalSource = "offline_record",
        AgreedAmount = 300m
    };

    private static RecordHistoricalBookingCommand ValidCommand(Guid idempotencyKey) => new(
        Guid.NewGuid(),
        Guid.NewGuid(),
        null,
        new DateOnly(2026, 1, 10),
        new DateOnly(2026, 1, 12),
        2,
        new DateOnly(2026, 1, 5),
        HistoricalEntryReasons.OfflineBookingRecordedAfterStay,
        null,
        "offline_record",
        null,
        300m,
        null,
        null,
        Guid.NewGuid(),
        idempotencyKey,
        "sanitized-test");

    private sealed class FixedTimeProvider : TimeProvider
    {
        private readonly DateTimeOffset _utcNow;

        public FixedTimeProvider(DateTimeOffset utcNow)
        {
            _utcNow = utcNow;
        }

        public override DateTimeOffset GetUtcNow() => _utcNow;
    }

    private sealed class CapturingHistoricalBookingService : IHistoricalBookingService
    {
        public RecordHistoricalBookingCommand? Command { get; private set; }

        public Task<HistoricalBookingResult> RecordAsync(
            RecordHistoricalBookingCommand command,
            CancellationToken cancellationToken = default)
        {
            Command = command;
            var booking = new Booking
            {
                Id = Guid.NewGuid(),
                ClientId = command.ClientId!.Value,
                UnitId = command.UnitId,
                OwnerId = Guid.NewGuid(),
                BookingStatus = BookingStatus.Completed,
                CheckInDate = command.CheckInDate,
                CheckOutDate = command.CheckOutDate,
                GuestCount = command.GuestCount,
                BaseAmount = command.AgreedAmount,
                FinalAmount = command.AgreedAmount,
                Source = "admin",
                IsHistorical = true,
                ActualBookedAt = command.ActualBookedAt,
                HistoricalEntryReason = command.HistoricalEntryReason,
                OriginalSource = command.OriginalSource,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };
            return Task.FromResult(new HistoricalBookingResult(
                booking,
                "Offline record",
                command.HistoricalEntryNote,
                command.ActorAdminUserId,
                command.IdempotencyKey,
                Guid.NewGuid(),
                IsReplay: false));
        }
    }
}
