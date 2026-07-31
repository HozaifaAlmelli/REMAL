namespace RentalPlatform.Business.Models;

public sealed record BookingCreationOptions(
    bool AllowInactiveUnit = false,
    string? ClientNotFoundErrorCode = null,
    string? UnitNotFoundErrorCode = null,
    string? AdminUserNotFoundErrorCode = null,
    string? GuestCapacityErrorCode = null,
    string? OperationalConflictErrorCode = null,
    string? ConfirmedOverlapErrorCode = null);
