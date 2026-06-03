using System;
using System.Threading;
using System.Threading.Tasks;
using RentalPlatform.Business.Models;

namespace RentalPlatform.Business.Interfaces;

public interface IUnitAvailabilityService
{
    Task<UnitAvailabilityResult> CheckOperationalAvailabilityAsync(Guid unitId, DateOnly startDate, DateOnly endDate, Guid? excludeBookingId = null, CancellationToken cancellationToken = default);
    Task<UnitPricingResult> CalculatePricingAsync(Guid unitId, DateOnly startDate, DateOnly endDate, CancellationToken cancellationToken = default);
}
