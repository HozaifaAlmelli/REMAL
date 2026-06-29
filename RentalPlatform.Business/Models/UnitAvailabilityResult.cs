using System;
using System.Collections.Generic;

namespace RentalPlatform.Business.Models;

public class UnitAvailabilityResult
{
    public Guid UnitId { get; set; }
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    public bool IsAvailable { get; set; }
    public string? Reason { get; set; }
    public IReadOnlyList<DateOnly> BlockedDates { get; set; } = Array.Empty<DateOnly>();
    public IReadOnlyList<DateOnly> HeldDates { get; set; } = Array.Empty<DateOnly>();
}
