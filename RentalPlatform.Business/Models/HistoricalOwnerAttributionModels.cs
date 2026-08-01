using RentalPlatform.Data.Entities;

namespace RentalPlatform.Business.Models;

public sealed record CorrectHistoricalOwnerAttributionCommand(
    Guid BookingId,
    Guid ExpectedCurrentOwnerId,
    Guid TargetOwnerId,
    string Reason,
    string? Note,
    Guid ActorAdminUserId,
    Guid IdempotencyKey);

public sealed record HistoricalOwnerAttributionReviewResult(
    Guid BookingId,
    Guid CurrentOwnerId,
    bool CanCorrect,
    bool PayoutReviewRequired,
    IReadOnlyList<string> Warnings);

public sealed record HistoricalOwnerCorrectionResult(
    HistoricalOwnerAttributionCorrection Correction,
    Guid HistoryEventId,
    IReadOnlyList<string> Warnings,
    bool IsReplay);
