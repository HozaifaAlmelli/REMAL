using RentalPlatform.Business.Models;

namespace RentalPlatform.Business.Interfaces;

public interface IOccupancyAnalyticsService
{
    Task<OccupancyAnalyticsResult> GetAsync(
        DateOnly from,
        DateOnly toExclusive,
        CancellationToken cancellationToken = default);
}
