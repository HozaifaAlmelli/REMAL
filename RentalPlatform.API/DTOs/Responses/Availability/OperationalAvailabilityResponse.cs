using System;
using System.Collections.Generic;

namespace RentalPlatform.API.DTOs.Responses.Availability;

public record OperationalAvailabilityResponse
{
    public Guid UnitId { get; init; }
    public DateOnly StartDate { get; init; }
    public DateOnly EndDate { get; init; }
    public bool IsAvailable { get; init; }
    public string? Reason { get; init; }
    public List<DateOnly> BlockedDates { get; init; } = new();
    public List<DateOnly> HeldDates { get; init; } = new();
}
