namespace RentalPlatform.Business.Models;

public static class OccupancyUnavailableReasons
{
    public const string CoverageIncomplete = "coverage_incomplete";
    public const string ZeroCapacity = "zero_capacity";
    public const string IntegrityConflict = "integrity_conflict";
}

public sealed record OccupancyAnalyticsResult
{
    public required DateOnly From { get; init; }
    public required DateOnly ToExclusive { get; init; }
    public required long OccupiedUnitNights { get; init; }
    public long? AvailableUnitNights { get; init; }
    public decimal? OccupancyRate { get; init; }
    public required bool AvailabilityCoverageComplete { get; init; }
    public DateOnly? CoverageStartDate { get; init; }
    public string? UnavailableReason { get; init; }
}
