using RentalPlatform.Business.Models;

namespace RentalPlatform.Business.Interfaces;

public interface IHistoricalOwnerAttributionService
{
    Task<HistoricalOwnerAttributionReviewResult> ReviewAsync(
        Guid bookingId,
        CancellationToken cancellationToken = default);

    Task<HistoricalOwnerCorrectionResult> CorrectAsync(
        CorrectHistoricalOwnerAttributionCommand command,
        CancellationToken cancellationToken = default);
}
