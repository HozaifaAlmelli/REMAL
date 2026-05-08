using System;
using System.Collections.Generic;
using RentalPlatform.Shared.Enums;

namespace RentalPlatform.Data.Entities;

public class CrmLead
{
    public Guid Id { get; set; }
    public Guid? ClientId { get; set; }
    public Guid? TargetUnitId { get; set; }
    public Guid? AssignedAdminUserId { get; set; }
    public string ContactName { get; set; } = null!;
    public string ContactPhone { get; set; } = null!;
    public string? ContactEmail { get; set; }
    public DateOnly? DesiredCheckInDate { get; set; }
    public DateOnly? DesiredCheckOutDate { get; set; }
    public int? GuestCount { get; set; }
    public LeadStatus LeadStatus { get; set; }
    public string Source { get; set; } = null!;
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    // Navigations
    public Client? Client { get; set; }
    public Unit? TargetUnit { get; set; }
    public AdminUser? AssignedAdminUser { get; set; }
    public ICollection<CrmNote> CrmNotes { get; set; } = new List<CrmNote>();
    public ICollection<CrmAssignment> CrmAssignments { get; set; } = new List<CrmAssignment>();
}
