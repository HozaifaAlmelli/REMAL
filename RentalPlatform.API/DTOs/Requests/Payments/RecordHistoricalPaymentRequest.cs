using System.Text.Json.Serialization;

namespace RentalPlatform.API.DTOs.Requests.Payments;

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed record RecordHistoricalPaymentRequest
{
    public decimal Amount { get; init; }
    public string PaymentMethod { get; init; } = string.Empty;
    public DateTimeOffset PaidAt { get; init; }
    public string? ReferenceNumber { get; init; }
    public string Reason { get; init; } = string.Empty;
}
