namespace RentalPlatform.API.DTOs.Responses.ReportsAnalytics;

public sealed record OccupancyAnalyticsResponse
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
