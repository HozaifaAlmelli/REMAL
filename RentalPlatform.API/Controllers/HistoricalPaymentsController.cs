using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RentalPlatform.API.Authorization;
using RentalPlatform.API.DTOs.Requests.Payments;
using RentalPlatform.API.DTOs.Responses.Payments;
using RentalPlatform.API.Filters;
using RentalPlatform.API.Models;
using RentalPlatform.Business.Exceptions;
using RentalPlatform.Business.Interfaces;
using RentalPlatform.Business.Models;
using RentalPlatform.Shared.Constants;

namespace RentalPlatform.API.Controllers;

[ApiController]
[Route("api/internal/bookings")]
public sealed class HistoricalPaymentsController : ControllerBase
{
    private readonly IHistoricalPaymentService _service;

    public HistoricalPaymentsController(IHistoricalPaymentService service)
    {
        _service = service;
    }

    [HttpPost("{bookingId:guid}/historical-payments")]
    [Authorize(Policy = PermissionKeys.PaymentsRecordHistorical)]
    [RequireHistoricalPaymentIdempotencyKey]
    public async Task<ActionResult<ApiResponse<HistoricalPaymentResponse>>> Record(
        Guid bookingId,
        RecordHistoricalPaymentRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _service.RecordAsync(
            new RecordHistoricalPaymentCommand(
                bookingId,
                request.Amount,
                request.PaymentMethod,
                request.PaidAt,
                request.ReferenceNumber,
                request.Reason,
                GetCurrentAdminId(),
                ResolveIdempotencyKey()),
            cancellationToken);

        return Ok(ApiResponse<HistoricalPaymentResponse>.CreateSuccess(Map(result)));
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
                RequireHistoricalPaymentIdempotencyKeyAttribute.ContextItemKey,
                out var value) && value is Guid key && key != Guid.Empty)
            return key;
        throw new BusinessValidationException(
            "Idempotency-Key must be supplied as a valid UUID.",
            HistoricalErrorCodes.HistoricalPaymentIdempotencyKeyRequired);
    }

    private static HistoricalPaymentResponse Map(HistoricalPaymentResult result) => new()
    {
        PaymentId = result.Payment.Id,
        BookingId = result.Payment.BookingId,
        Amount = result.Payment.Amount,
        PaymentMethod = result.Payment.PaymentMethod,
        PaidAt = result.Payment.PaidAt!.Value,
        ReferenceNumber = result.Payment.ReferenceNumber,
        Reason = result.Payment.RecordedReason!,
        IsHistoricalRecord = result.Payment.IsHistoricalRecord,
        RecordedByAdminUserId = result.Payment.CreatedByAdminUserId!.Value,
        RecordedAt = result.Payment.CreatedAt,
        HistoryEventId = result.HistoryEventId
    };
}
