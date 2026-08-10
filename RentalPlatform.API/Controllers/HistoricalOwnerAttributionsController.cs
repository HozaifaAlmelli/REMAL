using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RentalPlatform.API.Authorization;
using RentalPlatform.API.DTOs.Requests.Bookings;
using RentalPlatform.API.DTOs.Responses.Bookings;
using RentalPlatform.API.Filters;
using RentalPlatform.API.Models;
using RentalPlatform.Business.Exceptions;
using RentalPlatform.Business.Interfaces;
using RentalPlatform.Business.Models;
using RentalPlatform.Shared.Constants;

namespace RentalPlatform.API.Controllers;

[ApiController]
[Route("api/internal/bookings")]
public sealed class HistoricalOwnerAttributionsController : ControllerBase
{
    private readonly IHistoricalOwnerAttributionService _service;

    public HistoricalOwnerAttributionsController(IHistoricalOwnerAttributionService service)
    {
        _service = service;
    }

    [HttpGet("{bookingId:guid}/owner-attribution-review")]
    [Authorize(Policy = PermissionKeys.BookingsRead)]
    public async Task<ActionResult<ApiResponse<HistoricalOwnerAttributionReviewResponse>>> Review(
        Guid bookingId,
        CancellationToken cancellationToken)
    {
        var result = await _service.ReviewAsync(bookingId, cancellationToken);
        return Ok(ApiResponse<HistoricalOwnerAttributionReviewResponse>.CreateSuccess(new()
        {
            BookingId = result.BookingId,
            CurrentOwnerId = result.CurrentOwnerId,
            CanCorrect = result.CanCorrect,
            PayoutReviewRequired = result.PayoutReviewRequired,
            Warnings = result.Warnings
        }));
    }

    [HttpPost("{bookingId:guid}/owner-attribution-corrections")]
    [Authorize(Policy = PermissionKeys.BookingsCorrectOwnerAttribution)]
    [RequireHistoricalOwnerCorrectionIdempotencyKey]
    public async Task<ActionResult<ApiResponse<HistoricalOwnerAttributionCorrectionResponse>>> Correct(
        Guid bookingId,
        CorrectHistoricalOwnerAttributionRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _service.CorrectAsync(
            new CorrectHistoricalOwnerAttributionCommand(
                bookingId,
                request.ExpectedCurrentOwnerId,
                request.TargetOwnerId,
                request.Reason,
                request.Note,
                GetCurrentAdminId(),
                ResolveIdempotencyKey()),
            cancellationToken);

        var correction = result.Correction;
        return Ok(ApiResponse<HistoricalOwnerAttributionCorrectionResponse>.CreateSuccess(new()
        {
            CorrectionId = correction.Id,
            BookingId = correction.BookingId,
            PreviousOwnerId = correction.PreviousOwnerId,
            TargetOwnerId = correction.TargetOwnerId,
            CorrectedByAdminUserId = correction.CorrectedByAdminUserId,
            Reason = correction.Reason,
            Note = correction.Note,
            CorrectedAt = correction.CorrectedAt,
            HistoryEventId = result.HistoryEventId,
            Warnings = result.Warnings
        }));
    }

    private Guid GetCurrentAdminId()
    {
        var subject = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (Guid.TryParse(subject, out var actorId) && actorId != Guid.Empty)
            return actorId;
        throw new UnauthorizedBusinessException("Current admin user ID was not found in claims.");
    }

    private Guid ResolveIdempotencyKey()
    {
        if (HttpContext.Items.TryGetValue(
                RequireHistoricalOwnerCorrectionIdempotencyKeyAttribute.ContextItemKey,
                out var value) && value is Guid key && key != Guid.Empty)
        {
            return key;
        }

        throw new BusinessValidationException(
            "Idempotency-Key must be supplied as a valid UUID.",
            HistoricalErrorCodes.OwnerCorrectionIdempotencyKeyRequired);
    }
}
