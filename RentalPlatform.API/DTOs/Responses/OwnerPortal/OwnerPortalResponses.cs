using System;

namespace RentalPlatform.API.DTOs.Responses.OwnerPortal;

public record OwnerPortalUnitResponse
{
    public Guid UnitId { get; init; }
    public Guid ProjectId { get; init; }
    public string UnitName { get; init; } = string.Empty;
    public string UnitType { get; init; } = string.Empty;
    public bool IsActive { get; init; }
    public int Bedrooms { get; init; }
    public int Bathrooms { get; init; }
    public int MaxGuests { get; init; }
    public decimal BasePricePerNight { get; init; }
    public DateTime CreatedAt { get; init; }
    public DateTime UpdatedAt { get; init; }
}

public record OwnerPortalBookingResponse
{
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
    public bool IsHistorical { get; init; }
    public DateTime CreatedAt { get; init; }
    public DateTime UpdatedAt { get; init; }
}

public record OwnerPortalFinanceRowResponse
{
    public Guid BookingId { get; init; }
    public Guid UnitId { get; init; }
    public string UnitName { get; init; } = string.Empty;
    public string ClientName { get; init; } = string.Empty;
    public Guid? InvoiceId { get; init; }
    public string? InvoiceStatus { get; init; }
    public decimal InvoicedAmount { get; init; }
    public decimal PaidAmount { get; init; }
    public decimal RemainingAmount { get; init; }
    public Guid? PayoutId { get; init; }
    public string? PayoutStatus { get; init; }
    public decimal? PayoutAmount { get; init; }
    public DateTime? PayoutScheduledAt { get; init; }
    public DateTime? PayoutPaidAt { get; init; }
}

public record OwnerPortalFinanceSummaryResponse
{
    public Guid OwnerId { get; init; }
    public decimal TotalInvoicedAmount { get; init; }
    public decimal TotalPaidAmount { get; init; }
    public decimal TotalRemainingAmount { get; init; }
    public decimal TotalPendingPayoutAmount { get; init; }
    public decimal TotalScheduledPayoutAmount { get; init; }
    public decimal TotalPaidPayoutAmount { get; init; }
}

public record OwnerPortalDashboardSummaryResponse
{
    public Guid OwnerId { get; init; }
    public int TotalUnits { get; init; }
    public int ActiveUnits { get; init; }
    public int TotalBookings { get; init; }
    public int ConfirmedBookings { get; init; }
    public int CompletedBookings { get; init; }
    public decimal TotalPaidAmount { get; init; }
    public decimal TotalPendingPayoutAmount { get; init; }
    public decimal TotalPaidPayoutAmount { get; init; }
}

public record OwnerPortalProfileResponse
{
    public Guid Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public string Phone { get; init; } = string.Empty;
    public string? Email { get; init; }
    public decimal CommissionRate { get; init; }
    public string Status { get; init; } = string.Empty;
}
