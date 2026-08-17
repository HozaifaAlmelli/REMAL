using RentalPlatform.Business.Models;
using RentalPlatform.Data.Entities;

namespace RentalPlatform.Business.Interfaces;

public interface IRentableCapacityLedgerService
{
    DateOnly CurrentCairoDate { get; }

    Task EnterUnitMutationBoundaryAsync(
        Guid unitId,
        CancellationToken cancellationToken = default);

    Task RebuildCurrentAndFutureAsync(
        Unit unit,
        bool unitIsDeleted,
        bool isNewUnit,
        RentabilitySourceChange sourceChange,
        CancellationToken cancellationToken = default);
}
