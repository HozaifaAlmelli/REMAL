using System;

namespace RentalPlatform.API.DTOs.Responses.BookingLifecycle;

public record BookingStatusHistoryResponse
{
    public Guid Id { get; init; }
    public Guid BookingId { get; init; }
    public string? OldStatus { get; init; }
    public string NewStatus { get; init; } = string.Empty;
    public Guid? ChangedByAdminUserId { get; init; }
    public string ActorDisplayName { get; init; } = string.Empty;
    public string ActorType { get; init; } = string.Empty;
    public string? Notes { get; init; }
    public DateTime ChangedAt { get; init; }
}
