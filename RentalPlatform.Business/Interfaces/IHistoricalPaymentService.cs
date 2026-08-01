using RentalPlatform.Business.Models;

namespace RentalPlatform.Business.Interfaces;

public interface IHistoricalPaymentService
{
    Task<HistoricalPaymentResult> RecordAsync(
        RecordHistoricalPaymentCommand command,
        CancellationToken cancellationToken = default);
}
