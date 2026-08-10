namespace RentalPlatform.API.DTOs.Responses.Bookings;

public sealed record HistoricalOwnerAttributionReviewResponse
{
    public Guid BookingId { get; init; }
    public Guid CurrentOwnerId { get; init; }
    public bool CanCorrect { get; init; }
    public bool PayoutReviewRequired { get; init; }
    public IReadOnlyList<string> Warnings { get; init; } = Array.Empty<string>();
}

public sealed record HistoricalOwnerAttributionCorrectionResponse
{
    public Guid CorrectionId { get; init; }
    public Guid BookingId { get; init; }
    public Guid PreviousOwnerId { get; init; }
    public Guid TargetOwnerId { get; init; }
    public Guid CorrectedByAdminUserId { get; init; }
    public string Reason { get; init; } = string.Empty;
    public string? Note { get; init; }
    public DateTime CorrectedAt { get; init; }
    public Guid HistoryEventId { get; init; }
    public IReadOnlyList<string> Warnings { get; init; } = Array.Empty<string>();
}
