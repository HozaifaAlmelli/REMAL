using RentalPlatform.Shared.Constants;

namespace RentalPlatform.Data.Exceptions;

public sealed class HistoricalFinancialSnapshotImmutableException : Exception
{
    public string Code => HistoricalErrorCodes.HistoricalFinancialSnapshotImmutable;

    public HistoricalFinancialSnapshotImmutableException()
        : base("The historical booking financial snapshot is immutable.")
    {
    }
}
