using RentalPlatform.Shared.Constants;

namespace RentalPlatform.Data.Exceptions;

public sealed class HistoricalPaymentImmutableException : Exception
{
    public string Code => HistoricalErrorCodes.HistoricalPaymentImmutable;

    public HistoricalPaymentImmutableException()
        : base("Historical payment evidence is immutable.")
    {
    }
}
