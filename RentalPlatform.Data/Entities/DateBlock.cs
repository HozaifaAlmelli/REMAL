using System;
using RentalPlatform.Shared.Enums;

namespace RentalPlatform.Data.Entities;

public class DateBlock
{
    public Guid Id { get; set; }
    public Guid UnitId { get; set; }
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    public string? Reason { get; set; }
    public string? Notes { get; set; }
    public DateBlockStatus Status { get; set; } = DateBlockStatus.Approved;
    public bool RequiresAdminSignoff { get; set; }
    public Guid? ConflictingLeadId { get; set; }
    public Guid? ConflictingBookingId { get; set; }
    public Guid? ResolvedByAdminUserId { get; set; }
    public DateTime? ResolvedAt { get; set; }
    public DateTime? DeletedAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public Unit Unit { get; set; } = null!;
    public CrmLead? ConflictingLead { get; set; }
    public Booking? ConflictingBooking { get; set; }
    public AdminUser? ResolvedByAdminUser { get; set; }
}
