using RentalPlatform.Shared.Constants;

namespace RentalPlatform.Data.Exceptions;

public sealed class HistoricalOwnerCorrectionAuditImmutableException : Exception
{
    public string Code => HistoricalErrorCodes.OwnerCorrectionAuditImmutable;

    public HistoricalOwnerCorrectionAuditImmutableException()
        : base("Historical owner-attribution correction audit is immutable.")
    {
    }
}
