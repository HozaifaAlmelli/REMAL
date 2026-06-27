using System;

namespace RentalPlatform.API.DTOs.Responses.DateBlocks;

public record DateBlockApprovalListItemResponse
{
    public Guid Id { get; init; }
    public Guid UnitId { get; init; }
    public string UnitName { get; init; } = string.Empty;
    public Guid OwnerId { get; init; }
    public string OwnerName { get; init; } = string.Empty;
    public DateOnly StartDate { get; init; }
    public DateOnly EndDate { get; init; }
    public string? Reason { get; init; }
    public string? Notes { get; init; }
    public Guid? ConflictingLeadId { get; init; }
    public DateOnly? ConflictingLeadStartDate { get; init; }
    public DateOnly? ConflictingLeadEndDate { get; init; }
    public Guid? ConflictingBookingId { get; init; }
    public DateOnly? ConflictingBookingCheckInDate { get; init; }
    public DateOnly? ConflictingBookingCheckOutDate { get; init; }
    public int ConflictCount { get; init; }
    public DateTime CreatedAt { get; init; }
}
