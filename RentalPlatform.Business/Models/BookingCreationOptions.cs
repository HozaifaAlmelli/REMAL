namespace RentalPlatform.Business.Models;

public enum BookingAvailabilityPolicy
{
    Standard,
    HistoricalAuthoritative
}

public sealed record BookingCreationOptions(
    bool AllowInactiveUnit = false,
    string? ClientNotFoundErrorCode = null,
    string? UnitNotFoundErrorCode = null,
    string? AdminUserNotFoundErrorCode = null,
    string? GuestCapacityErrorCode = null,
    string? OperationalConflictErrorCode = null,
    string? ConfirmedOverlapErrorCode = null,
    BookingAvailabilityPolicy AvailabilityPolicy = BookingAvailabilityPolicy.Standard);
