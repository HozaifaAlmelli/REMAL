namespace RentalPlatform.API.DTOs.Requests.ReportsAnalytics;

public sealed record GetOccupancyAnalyticsRequest
{
    public DateOnly From { get; init; }
    public DateOnly ToExclusive { get; init; }
}
