using System;
using RentalPlatform.API.DTOs.Responses.Auth;

namespace RentalPlatform.API.DTOs.Responses.Bookings;

public record BookingListItemResponse
{
    public Guid Id { get; init; }
    public Guid ClientId { get; init; }
    public string? ClientName { get; init; }
    public string? ClientPhone { get; init; }
    public Guid UnitId { get; init; }
    public string? UnitName { get; init; }
    public Guid OwnerId { get; init; }
    public Guid? AssignedAdminUserId { get; init; }
    public string? AssignedAdminUserName { get; init; }
    public string? AssignedAdminUserRole { get; init; }
    public string BookingStatus { get; init; } = string.Empty;
    public DateOnly CheckInDate { get; init; }
    public DateOnly CheckOutDate { get; init; }
    public int GuestCount { get; init; }
    public decimal BaseAmount { get; init; }
    public decimal FinalAmount { get; init; }
    public string Source { get; init; } = string.Empty;
    public DateTime CreatedAt { get; init; }
    public bool IsAgedSoftHold { get; init; }
    public int? SoftHoldAgeDays { get; init; }
}

public record BookingDetailsResponse
{
    public Guid Id { get; init; }
    public Guid ClientId { get; init; }
    public Guid UnitId { get; init; }
    public string? UnitName { get; init; }
    public Guid OwnerId { get; init; }
    public Guid? AssignedAdminUserId { get; init; }
    public string? AssignedAdminUserName { get; init; }
    public string? AssignedAdminUserRole { get; init; }
    public string BookingStatus { get; init; } = string.Empty;
    public DateOnly CheckInDate { get; init; }
    public DateOnly CheckOutDate { get; init; }
    public int GuestCount { get; init; }
    public decimal BaseAmount { get; init; }
    public decimal FinalAmount { get; init; }
    public string Source { get; init; } = string.Empty;
    public string? InternalNotes { get; init; }
    public DateTime CreatedAt { get; init; }
    public DateTime UpdatedAt { get; init; }
    public bool IsAgedSoftHold { get; init; }
    public int? SoftHoldAgeDays { get; init; }
}

public record GuestBookingResponse
{
    public BookingDetailsResponse Booking { get; init; } = new();
    public AuthResponse Auth { get; init; } = null!;
}
