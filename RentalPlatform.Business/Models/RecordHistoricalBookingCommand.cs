using RentalPlatform.Data.Entities;

namespace RentalPlatform.Business.Models;

public sealed record NewHistoricalClient(
    string Name,
    string Phone,
    string? Email);

public sealed record RecordHistoricalBookingCommand(
    Guid UnitId,
    Guid? ClientId,
    NewHistoricalClient? NewClient,
    DateOnly CheckInDate,
    DateOnly CheckOutDate,
    int GuestCount,
    DateOnly ActualBookedAt,
    string HistoricalEntryReason,
    string? HistoricalEntryNote,
    string OriginalSource,
    string? ExternalReference,
    decimal AgreedAmount,
    Guid? AssignedAdminUserId,
    string? InternalNotes,
    Guid ActorAdminUserId,
    Guid IdempotencyKey,
    string? CorrelationId);

public sealed record HistoricalBookingResult(
    Booking Booking,
    string OriginalSourceLabel,
    string? HistoricalEntryNote,
    Guid RecordedByAdminUserId,
    Guid IdempotencyKey,
    Guid StatusHistoryEventId,
    bool IsReplay);
