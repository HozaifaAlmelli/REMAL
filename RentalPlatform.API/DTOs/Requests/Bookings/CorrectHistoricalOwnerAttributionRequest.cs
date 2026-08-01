using System.Text.Json.Serialization;

namespace RentalPlatform.API.DTOs.Requests.Bookings;

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed record CorrectHistoricalOwnerAttributionRequest
{
    public Guid ExpectedCurrentOwnerId { get; init; }
    public Guid TargetOwnerId { get; init; }
    public string Reason { get; init; } = string.Empty;
    public string? Note { get; init; }
}
