using RentalPlatform.Business.Models;

namespace RentalPlatform.Business.Interfaces;

public interface IHistoricalBookingService
{
    Task<HistoricalBookingResult> RecordAsync(
        RecordHistoricalBookingCommand command,
        CancellationToken cancellationToken = default);
}
