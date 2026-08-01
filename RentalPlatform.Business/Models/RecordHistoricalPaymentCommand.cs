using RentalPlatform.Data.Entities;

namespace RentalPlatform.Business.Models;

public sealed record RecordHistoricalPaymentCommand(
    Guid BookingId,
    decimal Amount,
    string PaymentMethod,
    DateTimeOffset PaidAt,
    string? ReferenceNumber,
    string Reason,
    Guid ActorAdminUserId,
    Guid IdempotencyKey);

public sealed record HistoricalPaymentResult(
    Payment Payment,
    Guid HistoryEventId,
    bool IsReplay);
