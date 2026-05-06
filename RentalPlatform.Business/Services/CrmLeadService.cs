using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using RentalPlatform.Business.Exceptions;
using RentalPlatform.Business.Interfaces;
using RentalPlatform.Data;
using RentalPlatform.Data.Entities;

namespace RentalPlatform.Business.Services;

public class CrmLeadService : ICrmLeadService
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IBookingService _bookingService;

    private static readonly string[] AllowedSources = { "direct", "admin", "phone", "whatsapp", "website" };
    private static readonly string[] AllowedStatuses = { "new", "contacted", "qualified", "converted", "lost" };
    private const string DefaultLeadStatus = "new";

    public CrmLeadService(IUnitOfWork unitOfWork, IBookingService bookingService)
    {
        _unitOfWork = unitOfWork;
        _bookingService = bookingService;
    }

    public async Task<IReadOnlyList<CrmLead>> GetAllAsync(
        string? leadStatus = null,
        Guid? assignedAdminUserId = null,
        CancellationToken cancellationToken = default)
    {
        IQueryable<CrmLead> query = _unitOfWork.CrmLeads.Query()
            .Include(l => l.TargetUnit);

        if (!string.IsNullOrWhiteSpace(leadStatus))
        {
            var normalized = leadStatus.Trim().ToLower();
            query = query.Where(l => l.LeadStatus == normalized);
        }

        if (assignedAdminUserId.HasValue)
        {
            query = query.Where(l => l.AssignedAdminUserId == assignedAdminUserId.Value);
        }

        return await query.ToListAsync(cancellationToken);
    }

    public async Task<CrmLead?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        return await _unitOfWork.CrmLeads.Query()
            .Include(l => l.TargetUnit)
            .FirstOrDefaultAsync(l => l.Id == id, cancellationToken);
    }

    public async Task<CrmLead> CreateAsync(
        Guid? clientId,
        Guid? targetUnitId,
        Guid? assignedAdminUserId,
        string contactName,
        string contactPhone,
        string? contactEmail,
        DateOnly? desiredCheckInDate,
        DateOnly? desiredCheckOutDate,
        int? guestCount,
        string source,
        string? notes,
        CancellationToken cancellationToken = default)
    {
        // --- Input validation ---
        ValidateContactInfo(contactName, contactPhone);
        ValidateDesiredStay(desiredCheckInDate, desiredCheckOutDate, guestCount);
        var normalizedSource = ValidateAndNormalizeSource(source);

        // --- Optional reference checks ---
        await ValidateOptionalReferencesAsync(clientId, targetUnitId, assignedAdminUserId, cancellationToken);

        // --- Create lead entity ---
        var lead = new CrmLead
        {
            Id = Guid.NewGuid(),
            ClientId = clientId,
            TargetUnitId = targetUnitId,
            AssignedAdminUserId = assignedAdminUserId,
            ContactName = contactName.Trim(),
            ContactPhone = contactPhone.Trim(),
            ContactEmail = contactEmail?.Trim(),
            DesiredCheckInDate = desiredCheckInDate,
            DesiredCheckOutDate = desiredCheckOutDate,
            GuestCount = guestCount,
            LeadStatus = DefaultLeadStatus,
            Source = normalizedSource,
            Notes = notes?.Trim(),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await _unitOfWork.CrmLeads.AddAsync(lead, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return lead;
    }

    public async Task<CrmLead> UpdateAsync(
        Guid id,
        Guid? clientId,
        Guid? targetUnitId,
        Guid? assignedAdminUserId,
        string contactName,
        string contactPhone,
        string? contactEmail,
        DateOnly? desiredCheckInDate,
        DateOnly? desiredCheckOutDate,
        int? guestCount,
        string source,
        string? notes,
        CancellationToken cancellationToken = default)
    {
        var lead = await _unitOfWork.CrmLeads.GetByIdAsync(id, cancellationToken);
        if (lead == null)
            throw new NotFoundException($"CRM lead with ID {id} not found");

        // --- Input validation ---
        ValidateContactInfo(contactName, contactPhone);
        ValidateDesiredStay(desiredCheckInDate, desiredCheckOutDate, guestCount);
        var normalizedSource = ValidateAndNormalizeSource(source);

        // --- Optional reference checks ---
        await ValidateOptionalReferencesAsync(clientId, targetUnitId, assignedAdminUserId, cancellationToken);

        // --- Apply updates ---
        lead.ClientId = clientId;
        lead.TargetUnitId = targetUnitId;
        lead.AssignedAdminUserId = assignedAdminUserId;
        lead.ContactName = contactName.Trim();
        lead.ContactPhone = contactPhone.Trim();
        lead.ContactEmail = contactEmail?.Trim();
        lead.DesiredCheckInDate = desiredCheckInDate;
        lead.DesiredCheckOutDate = desiredCheckOutDate;
        lead.GuestCount = guestCount;
        lead.Source = normalizedSource;
        lead.Notes = notes?.Trim();
        lead.UpdatedAt = DateTime.UtcNow;

        _unitOfWork.CrmLeads.Update(lead);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return lead;
    }

    public async Task<CrmLead> SetStatusAsync(
        Guid id,
        string leadStatus,
        CancellationToken cancellationToken = default)
    {
        var lead = await _unitOfWork.CrmLeads.Query()
            .Include(l => l.TargetUnit)
            .FirstOrDefaultAsync(l => l.Id == id, cancellationToken);
        if (lead == null)
            throw new NotFoundException($"CRM lead with ID {id} not found");

        var normalizedStatus = ValidateAndNormalizeStatus(leadStatus);

        // Enforce state machine transitions
        ValidateStatusTransition(lead.LeadStatus, normalizedStatus);

        lead.LeadStatus = normalizedStatus;
        lead.UpdatedAt = DateTime.UtcNow;

        _unitOfWork.CrmLeads.Update(lead);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return lead;
    }

    public async Task<Booking> ConvertToBookingAsync(
        Guid leadId,
        Guid clientId,
        Guid unitId,
        DateOnly checkInDate,
        DateOnly checkOutDate,
        int guestCount,
        string? internalNotes,
        CancellationToken cancellationToken = default)
    {
        // --- Lead must exist ---
        var lead = await _unitOfWork.CrmLeads.GetByIdAsync(leadId, cancellationToken);
        if (lead == null)
            throw new NotFoundException($"CRM lead with ID {leadId} not found");

        // --- Lead must not already be converted or lost ---
        if (lead.LeadStatus == "converted")
            throw new ConflictException($"CRM lead {leadId} has already been converted to a booking");

        if (lead.LeadStatus == "lost")
            throw new ConflictException($"CRM lead {leadId} is marked as lost and cannot be converted");

        // --- Client/unit mismatch checks against pre-linked lead data ---
        if (lead.ClientId.HasValue && lead.ClientId.Value != clientId)
            throw new ConflictException(
                $"CRM lead {leadId} is already linked to client {lead.ClientId.Value}, but conversion was requested for client {clientId}");

        if (lead.TargetUnitId.HasValue && lead.TargetUnitId.Value != unitId)
            throw new ConflictException(
                $"CRM lead {leadId} is already linked to unit {lead.TargetUnitId.Value}, but conversion was requested for unit {unitId}");

        // --- Create booking via IBookingService (delegates all booking validation) ---
        var booking = await _bookingService.CreateAsync(
            clientId: clientId,
            unitId: unitId,
            checkInDate: checkInDate,
            checkOutDate: checkOutDate,
            guestCount: guestCount,
            source: lead.Source,
            assignedAdminUserId: lead.AssignedAdminUserId,
            internalNotes: internalNotes,
            cancellationToken: cancellationToken);

        // --- Booking creation succeeded => mark lead as converted ---
        lead.LeadStatus = "converted";

        if (!lead.ClientId.HasValue)
            lead.ClientId = clientId;

        if (!lead.TargetUnitId.HasValue)
            lead.TargetUnitId = unitId;

        lead.UpdatedAt = DateTime.UtcNow;

        _unitOfWork.CrmLeads.Update(lead);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return booking;
    }

    // ---------------------------------------------------------------
    //  Private helpers
    // ---------------------------------------------------------------

    private static void ValidateContactInfo(string contactName, string contactPhone)
    {
        if (string.IsNullOrWhiteSpace(contactName))
            throw new BusinessValidationException("Contact name is required");

        if (string.IsNullOrWhiteSpace(contactPhone))
            throw new BusinessValidationException("Contact phone is required");
    }

    private static void ValidateDesiredStay(DateOnly? checkInDate, DateOnly? checkOutDate, int? guestCount)
    {
        if (checkInDate.HasValue && checkOutDate.HasValue)
        {
            if (checkOutDate.Value <= checkInDate.Value)
                throw new BusinessValidationException("Desired check-out date must be after desired check-in date");
        }

        if (guestCount.HasValue && guestCount.Value <= 0)
            throw new BusinessValidationException("Guest count must be greater than zero");
    }

    private static string ValidateAndNormalizeSource(string source)
    {
        if (string.IsNullOrWhiteSpace(source))
            throw new BusinessValidationException("Lead source is required");

        var normalized = source.Trim().ToLower();
        if (!AllowedSources.Contains(normalized))
            throw new BusinessValidationException(
                $"Invalid lead source '{source}'. Allowed values: {string.Join(", ", AllowedSources)}");

        return normalized;
    }

    private static readonly Dictionary<string, string[]> AllowedTransitions = new()
    {
        { "new",       new[] { "contacted", "lost" } },
        { "contacted", new[] { "qualified", "lost" } },
        { "qualified", new[] { "converted", "lost" } },
        { "converted", Array.Empty<string>() },
        { "lost",      Array.Empty<string>() },
    };

    private static void ValidateStatusTransition(string currentStatus, string targetStatus)
    {
        if (currentStatus == targetStatus)
            return; // no-op is always allowed

        if (!AllowedTransitions.TryGetValue(currentStatus, out var allowed) || !allowed.Contains(targetStatus))
            throw new BusinessValidationException(
                $"Cannot transition CRM lead from '{currentStatus}' to '{targetStatus}'. " +
                $"Allowed transitions from '{currentStatus}': {(allowed?.Length > 0 ? string.Join(", ", allowed) : "none (terminal state)")}.");
    }

    private static string ValidateAndNormalizeStatus(string leadStatus)
    {
        if (string.IsNullOrWhiteSpace(leadStatus))
            throw new BusinessValidationException("Lead status is required");

        var normalized = leadStatus.Trim().ToLower();
        if (!AllowedStatuses.Contains(normalized))
            throw new BusinessValidationException(
                $"Invalid lead status '{leadStatus}'. Allowed values: {string.Join(", ", AllowedStatuses)}");

        return normalized;
    }

    private async Task ValidateOptionalReferencesAsync(
        Guid? clientId,
        Guid? targetUnitId,
        Guid? assignedAdminUserId,
        CancellationToken cancellationToken)
    {
        if (clientId.HasValue)
        {
            var clientExists = await _unitOfWork.Clients.ExistsAsync(
                c => c.Id == clientId.Value && c.IsActive && c.DeletedAt == null, cancellationToken);
            if (!clientExists)
                throw new NotFoundException($"Active client with ID {clientId.Value} not found");
        }

        if (targetUnitId.HasValue)
        {
            var unitExists = await _unitOfWork.Units.ExistsAsync(
                u => u.Id == targetUnitId.Value && u.IsActive && u.DeletedAt == null, cancellationToken);
            if (!unitExists)
                throw new NotFoundException($"Active unit with ID {targetUnitId.Value} not found");
        }

        if (assignedAdminUserId.HasValue)
        {
            var adminExists = await _unitOfWork.AdminUsers.ExistsAsync(
                a => a.Id == assignedAdminUserId.Value && a.IsActive, cancellationToken);
            if (!adminExists)
                throw new NotFoundException($"Active admin user with ID {assignedAdminUserId.Value} not found");
        }
    }
}
