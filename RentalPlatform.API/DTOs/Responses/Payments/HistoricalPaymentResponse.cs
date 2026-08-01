namespace RentalPlatform.API.DTOs.Responses.Payments;

public sealed record HistoricalPaymentResponse
{
    public Guid PaymentId { get; init; }
    public Guid BookingId { get; init; }
    public decimal Amount { get; init; }
    public string PaymentMethod { get; init; } = string.Empty;
    public DateTime PaidAt { get; init; }
    public string? ReferenceNumber { get; init; }
    public string Reason { get; init; } = string.Empty;
    public bool IsHistoricalRecord { get; init; }
    public Guid RecordedByAdminUserId { get; init; }
    public DateTime RecordedAt { get; init; }
    public Guid HistoryEventId { get; init; }
}
