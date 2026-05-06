using System;

namespace RentalPlatform.API.DTOs.Responses.CrmLeads;

public record CrmLeadListItemResponse
{
    public Guid Id { get; init; }
    public Guid? ClientId { get; init; }
    public Guid? TargetUnitId { get; init; }
    public Guid? AssignedAdminUserId { get; init; }
    public string ContactName { get; init; } = string.Empty;
    public string ContactPhone { get; init; } = string.Empty;
    public string? ContactEmail { get; init; }
    public DateOnly? DesiredCheckInDate { get; init; }
    public DateOnly? DesiredCheckOutDate { get; init; }
    public int? GuestCount { get; init; }
    public string LeadStatus { get; init; } = string.Empty;
    public string Source { get; init; } = string.Empty;
    public string? TargetUnitName { get; init; }
    public DateTime CreatedAt { get; init; }
}

public record CrmLeadDetailsResponse
{
    public Guid Id { get; init; }
    public Guid? ClientId { get; init; }
    public Guid? TargetUnitId { get; init; }
    public Guid? AssignedAdminUserId { get; init; }
    public string ContactName { get; init; } = string.Empty;
    public string ContactPhone { get; init; } = string.Empty;
    public string? ContactEmail { get; init; }
    public DateOnly? DesiredCheckInDate { get; init; }
    public DateOnly? DesiredCheckOutDate { get; init; }
    public int? GuestCount { get; init; }
    public string LeadStatus { get; init; } = string.Empty;
    public string Source { get; init; } = string.Empty;
    public string? Notes { get; init; }
    public string? TargetUnitName { get; init; }
    public DateTime CreatedAt { get; init; }
    public DateTime UpdatedAt { get; init; }
}
