using RentalPlatform.Business.Models;

namespace RentalPlatform.Business.Interfaces;

public interface IHistoricalConflictService
{
    Task ValidateAsync(
        HistoricalConflictRequest request,
        CancellationToken cancellationToken = default);
}
