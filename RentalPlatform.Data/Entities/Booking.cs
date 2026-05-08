using System;
using System.Collections.Generic;
using RentalPlatform.Shared.Enums;

namespace RentalPlatform.Data.Entities;

public class Booking
{
    public Guid Id { get; set; }
    public Guid ClientId { get; set; }
    public Guid UnitId { get; set; }
    public Guid OwnerId { get; set; }
    public Guid? AssignedAdminUserId { get; set; }
    public BookingStatus BookingStatus { get; set; }
    public DateOnly CheckInDate { get; set; }
    public DateOnly CheckOutDate { get; set; }
    public int GuestCount { get; set; }
    public decimal BaseAmount { get; set; }
    public decimal FinalAmount { get; set; }
    public string Source { get; set; } = null!;
    public string? InternalNotes { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    // Navigations (In Scope for this ticket)
    public Client Client { get; set; } = null!;
    public Unit Unit { get; set; } = null!;
    public Owner Owner { get; set; } = null!;
    public AdminUser? AssignedAdminUser { get; set; }
    public ICollection<BookingStatusHistory> StatusHistory { get; set; } = new List<BookingStatusHistory>();
    public ICollection<CrmNote> CrmNotes { get; set; } = new List<CrmNote>();
    public ICollection<CrmAssignment> CrmAssignments { get; set; } = new List<CrmAssignment>();
}
