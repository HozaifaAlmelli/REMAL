using System.Text.Json.Serialization;

namespace RentalPlatform.API.DTOs.Requests.Bookings;

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed record RecordHistoricalBookingRequest
{
    public Guid UnitId { get; init; }
    public Guid? ClientId { get; init; }
    public NewHistoricalClientRequest? NewClient { get; init; }
    public DateOnly CheckInDate { get; init; }
    public DateOnly CheckOutDate { get; init; }
    public int GuestCount { get; init; }
    public DateOnly ActualBookedAt { get; init; }
    public string HistoricalEntryReason { get; init; } = string.Empty;
    public string? HistoricalEntryNote { get; init; }
    public string OriginalSource { get; init; } = string.Empty;
    public string? ExternalReference { get; init; }
    public decimal AgreedAmount { get; init; }
    public Guid? AssignedAdminUserId { get; init; }
    public string? InternalNotes { get; init; }
}

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed record NewHistoricalClientRequest
{
    public string Name { get; init; } = string.Empty;
    public string Phone { get; init; } = string.Empty;
    public string? Email { get; init; }
}
