using RentalPlatform.Shared.Enums;

namespace RentalPlatform.Business.Models;

public sealed record RentabilitySourceChange(
    string SourceType,
    Guid? SourceId = null,
    string? ActorType = null,
    Guid? ActorId = null,
    DateBlockProjectionChange? DateBlockChange = null);

public sealed record DateBlockProjectionChange(
    Guid DateBlockId,
    DateBlockProjectionChangeKind Kind,
    DateOnly StartDate,
    DateOnly EndDate,
    DateBlockStatus Status,
    bool IsDeleted);

public enum DateBlockProjectionChangeKind
{
    Upsert,
    Remove
}
