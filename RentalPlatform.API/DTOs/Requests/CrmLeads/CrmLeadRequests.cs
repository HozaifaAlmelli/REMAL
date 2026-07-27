using System;

namespace RentalPlatform.API.DTOs.Requests.CrmLeads;

public record PublicCreateCrmLeadRequest
{
    public Guid? ClientId { get; init; }
    public Guid? TargetUnitId { get; init; }
    public string ContactName { get; init; } = string.Empty;
    public string ContactPhone { get; init; } = string.Empty;
    public string? ContactEmail { get; init; }
    public DateOnly? DesiredCheckInDate { get; init; }
    public DateOnly? DesiredCheckOutDate { get; init; }
    public int? GuestCount { get; init; }
    public string Source { get; init; } = string.Empty;
    public string? Notes { get; init; }
}

/// <summary>
/// Dedicated storefront recommendation contract. It deliberately has no unit,
/// client, source, or classification fields; provenance is established by the
/// server-side endpoint and service method.
/// </summary>
public record PublicCreateRecommendationLeadRequest
{
    public string ContactName { get; init; } = string.Empty;
    public string ContactPhone { get; init; } = string.Empty;
    public string? ContactEmail { get; init; }
    public DateOnly? DesiredCheckInDate { get; init; }
    public DateOnly? DesiredCheckOutDate { get; init; }
    public int? GuestCount { get; init; }
    public string? Notes { get; init; }
}

public record InternalCreateCrmLeadRequest
{
    public Guid? ClientId { get; init; }
    public Guid? TargetUnitId { get; init; }
    public Guid? AssignedAdminUserId { get; init; }
    public string ContactName { get; init; } = string.Empty;
    public string ContactPhone { get; init; } = string.Empty;
    public string? ContactEmail { get; init; }
    public DateOnly? DesiredCheckInDate { get; init; }
    public DateOnly? DesiredCheckOutDate { get; init; }
    public int? GuestCount { get; init; }
    public string Source { get; init; } = string.Empty;
    public string? Notes { get; init; }
}

public record UpdateCrmLeadRequest
{
    public Guid? ClientId { get; init; }
    public Guid? TargetUnitId { get; init; }
    public Guid? AssignedAdminUserId { get; init; }
    public string ContactName { get; init; } = string.Empty;
    public string ContactPhone { get; init; } = string.Empty;
    public string? ContactEmail { get; init; }
    public DateOnly? DesiredCheckInDate { get; init; }
    public DateOnly? DesiredCheckOutDate { get; init; }
    public int? GuestCount { get; init; }
    public string Source { get; init; } = string.Empty;
    public string? Notes { get; init; }
}

public record UpdateCrmLeadStatusRequest
{
    public string LeadStatus { get; init; } = string.Empty;
}

public record ConvertLeadToBookingRequest
{
    public Guid ClientId { get; init; }
    public Guid UnitId { get; init; }
    public DateOnly CheckInDate { get; init; }
    public DateOnly CheckOutDate { get; init; }
    public int GuestCount { get; init; }
    public string? InternalNotes { get; init; }
}
