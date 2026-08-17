namespace RentalPlatform.API.DTOs.Responses.Bookings;

public sealed record HistoricalBookingResponse
{
    public Guid Id { get; init; }
    public Guid ClientId { get; init; }
    public Guid UnitId { get; init; }
    public string? UnitName { get; init; }
    public Guid OwnerId { get; init; }
    public Guid? AssignedAdminUserId { get; init; }
    public string? AssignedAdminUserName { get; init; }
    public string? AssignedAdminUserRole { get; init; }
    public string BookingStatus { get; init; } = string.Empty;
    public DateOnly CheckInDate { get; init; }
    public DateOnly CheckOutDate { get; init; }
    public int GuestCount { get; init; }
    public decimal BaseAmount { get; init; }
    public decimal FinalAmount { get; init; }
    public string Source { get; init; } = string.Empty;
    public string? InternalNotes { get; init; }
    public DateTime CreatedAt { get; init; }
    public DateTime UpdatedAt { get; init; }
    public bool IsHistorical { get; init; }
    public DateOnly? ActualBookedAt { get; init; }
    public string? HistoricalEntryReason { get; init; }
    public string? HistoricalEntryNote { get; init; }
    public string? OriginalSource { get; init; }
    public string? OriginalSourceLabel { get; init; }
    public string? ExternalReference { get; init; }
    public decimal? AgreedAmount { get; init; }
    public DateTime RecordedAt { get; init; }
    public Guid RecordedByAdminUserId { get; init; }
    public Guid IdempotencyKey { get; init; }
    public Guid StatusHistoryEventId { get; init; }
    public bool IsAgedSoftHold { get; init; }
    public int? SoftHoldAgeDays { get; init; }
}
