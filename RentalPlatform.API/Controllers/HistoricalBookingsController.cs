using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RentalPlatform.API.Authorization;
using RentalPlatform.API.DTOs.Requests.Bookings;
using RentalPlatform.API.DTOs.Responses.Bookings;
using RentalPlatform.API.Models;
using RentalPlatform.API.Filters;
using RentalPlatform.Business.Exceptions;
using RentalPlatform.Business.Interfaces;
using RentalPlatform.Business.Models;
using RentalPlatform.Shared.Constants;

namespace RentalPlatform.API.Controllers;

[ApiController]
[Route("api/internal/bookings")]
public sealed class HistoricalBookingsController : ControllerBase
{
    private readonly IHistoricalBookingService _historicalBookingService;

    public HistoricalBookingsController(IHistoricalBookingService historicalBookingService)
    {
        _historicalBookingService = historicalBookingService;
    }

    [HttpPost("historical")]
    [Authorize(Policy = PermissionKeys.BookingsRecordHistorical)]
    [RequireHistoricalIdempotencyKey]
    public async Task<ActionResult<ApiResponse<HistoricalBookingResponse>>> RecordHistoricalBooking(
        RecordHistoricalBookingRequest request,
        CancellationToken cancellationToken)
    {
        var idempotencyKey = ResolveIdempotencyKey();

        var actorAdminUserId = GetCurrentAdminId();
        var result = await _historicalBookingService.RecordAsync(
            new RecordHistoricalBookingCommand(
                request.UnitId,
                request.ClientId,
                request.NewClient is null
                    ? null
                    : new NewHistoricalClient(
                        request.NewClient.Name,
                        request.NewClient.Phone,
                        request.NewClient.Email),
                request.CheckInDate,
                request.CheckOutDate,
                request.GuestCount,
                request.ActualBookedAt,
                request.HistoricalEntryReason,
                request.HistoricalEntryNote,
                request.OriginalSource,
                request.ExternalReference,
                request.AgreedAmount,
                request.AssignedAdminUserId,
                request.InternalNotes,
                actorAdminUserId,
                idempotencyKey,
                HttpContext.TraceIdentifier,
                request.AcknowledgedDuplicateOf,
                request.AcknowledgedDateBlockIds),
            cancellationToken);

        return Ok(ApiResponse<HistoricalBookingResponse>.CreateSuccess(
            MapResponse(result),
            "Historical booking recorded successfully."));
    }

    private Guid GetCurrentAdminId()
    {
        var subject = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (Guid.TryParse(subject, out var adminUserId) && adminUserId != Guid.Empty)
            return adminUserId;

        throw new UnauthorizedBusinessException("Current admin user ID was not found in claims.");
    }

    private static HistoricalBookingResponse MapResponse(HistoricalBookingResult result)
    {
        var booking = result.Booking;
        return new HistoricalBookingResponse
        {
            Id = booking.Id,
            ClientId = booking.ClientId,
            UnitId = booking.UnitId,
            UnitName = booking.Unit?.Name,
            OwnerId = booking.OwnerId,
            AssignedAdminUserId = booking.AssignedAdminUserId,
            AssignedAdminUserName = booking.AssignedAdminUser?.Name,
            AssignedAdminUserRole = booking.AssignedAdminUser?.RoleTemplate?.Name
                ?? booking.AssignedAdminUser?.Role?.ToString(),
            BookingStatus = booking.BookingStatus.ToString(),
            CheckInDate = booking.CheckInDate,
            CheckOutDate = booking.CheckOutDate,
            GuestCount = booking.GuestCount,
            BaseAmount = booking.BaseAmount,
            FinalAmount = booking.FinalAmount,
            Source = booking.Source,
            InternalNotes = booking.InternalNotes,
            CreatedAt = booking.CreatedAt,
            UpdatedAt = booking.UpdatedAt,
            IsHistorical = booking.IsHistorical,
            ActualBookedAt = booking.ActualBookedAt,
            HistoricalEntryReason = booking.HistoricalEntryReason,
            HistoricalEntryNote = result.HistoricalEntryNote,
            OriginalSource = booking.OriginalSource,
            OriginalSourceLabel = result.OriginalSourceLabel,
            ExternalReference = booking.ExternalReference,
            AgreedAmount = booking.AgreedAmount,
            RecordedAt = booking.CreatedAt,
            RecordedByAdminUserId = result.RecordedByAdminUserId,
            IdempotencyKey = result.IdempotencyKey,
            StatusHistoryEventId = result.StatusHistoryEventId,
            IsAgedSoftHold = false,
            SoftHoldAgeDays = null
        };
    }

    private Guid ResolveIdempotencyKey()
    {
        if (HttpContext.Items.TryGetValue(
                RequireHistoricalIdempotencyKeyAttribute.ContextItemKey,
                out var value) && value is Guid key && key != Guid.Empty)
            return key;

        var header = Request.Headers["Idempotency-Key"].ToString();
        if (Guid.TryParse(header, out key) && key != Guid.Empty)
            return key;

        throw new BusinessValidationException(
            "Idempotency-Key must be supplied as a valid UUID.",
            HistoricalErrorCodes.IdempotencyKeyRequired);
    }
}
