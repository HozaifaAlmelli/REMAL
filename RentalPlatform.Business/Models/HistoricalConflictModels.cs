using RentalPlatform.Shared.Enums;

namespace RentalPlatform.Business.Models;

public sealed record HistoricalConflictBooking(
    Guid BookingId,
    BookingStatus Status,
    DateOnly CheckInDate,
    DateOnly CheckOutDate,
    Guid ClientId,
    string NormalizedPhone);

public sealed record HistoricalConflictDateBlock(
    Guid DateBlockId,
    DateOnly StartDate,
    DateOnly EndDate,
    string? Reason);

public sealed record HistoricalConflictResult(
    IReadOnlyList<HistoricalConflictBooking> HardConflicts,
    IReadOnlyList<HistoricalConflictBooking> SoftHolds,
    IReadOnlyList<HistoricalConflictDateBlock> ApprovedDateBlocks);

public sealed record HistoricalConflictRequest(
    Guid UnitId,
    DateOnly CheckInDate,
    DateOnly CheckOutDate,
    Guid ClientId,
    string NormalizedPhone,
    string? ExternalReference,
    IReadOnlyList<Guid> AcknowledgedDuplicateOf,
    IReadOnlyList<Guid> AcknowledgedDateBlockIds);
