using System;

namespace RentalPlatform.API.DTOs.Responses.DateBlocks;

public record DateBlockResponse
{
    public Guid Id { get; init; }
    public Guid UnitId { get; init; }
    public DateOnly StartDate { get; init; }
    public DateOnly EndDate { get; init; }
    public string? Reason { get; init; }
    public string? Notes { get; init; }
    public string Status { get; init; } = string.Empty;
    public bool RequiresAdminSignoff { get; init; }
    public Guid? ConflictingLeadId { get; init; }
    public Guid? ConflictingBookingId { get; init; }
    public DateTime? ResolvedAt { get; init; }
    public DateTime CreatedAt { get; init; }
    public DateTime UpdatedAt { get; init; }
}
