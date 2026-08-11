namespace RentalPlatform.Data.ReadModels;

/// <summary>
/// Keyless read model for the owner_portal_bookings_overview SQL view.
/// Owner-facing booking inventory: status, dates, amount, source.
/// No invoice/payment/CRM/client-PII fields. Read-only, no key.
/// Scope frozen per DB-OP-03 / DA-OP-03.
/// </summary>
public sealed class OwnerPortalBookingOverview
{
    public Guid OwnerId { get; init; }
    public Guid BookingId { get; init; }
    public Guid UnitId { get; init; }
    public Guid ClientId { get; init; }
    public Guid? AssignedAdminUserId { get; init; }
    public string BookingStatus { get; init; } = string.Empty;
    public DateOnly CheckInDate { get; init; }
    public DateOnly CheckOutDate { get; init; }
    public int GuestCount { get; init; }
    public decimal FinalAmount { get; init; }
    public string Source { get; init; } = string.Empty;
    public DateTime CreatedAt { get; init; }
    public DateTime UpdatedAt { get; init; }
    public bool IsHistorical { get; set; }
}
