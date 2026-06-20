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
using RentalPlatform.Shared.Enums;

namespace RentalPlatform.Business.Services;

public class CrmLeadService : ICrmLeadService
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IBookingService _bookingService;
    private readonly IUnitAvailabilityService _availabilityService;

    private static readonly string[] AllowedSources = { "direct", "admin", "phone", "whatsapp", "website" };
    // A lead is "open" only through the early sales stages. Once it reaches Booked it is
    // either converted (-> Completed, becoming a Booking) or dropped (-> NotRelevant).
    // Confirmed/CheckIn/Completed belong to the BOOKING lifecycle, not the lead.
    private static readonly LeadStatus[] OpenStatuses =
    {
        LeadStatus.Prospecting,
        LeadStatus.Relevant,
        LeadStatus.NoAnswer,
        LeadStatus.Booked
    };

    private static readonly Dictionary<LeadStatus, LeadStatus[]> AllowedTransitions = new()
    {
        { LeadStatus.Prospecting, new[] { LeadStatus.Relevant, LeadStatus.NoAnswer, LeadStatus.NotRelevant } },
        { LeadStatus.Relevant,    new[] { LeadStatus.Booked, LeadStatus.NoAnswer, LeadStatus.NotRelevant } },
        { LeadStatus.NoAnswer,    new[] { LeadStatus.Relevant, LeadStatus.NotRelevant } },
        // Booked is the LAST lead stage: forward progress happens only via
        // ConvertToBookingAsync (which creates a Booking and moves the lead to Completed).
        // A Booked lead can otherwise only be dropped.
        { LeadStatus.Booked,      new[] { LeadStatus.NotRelevant } },
        { LeadStatus.Confirmed,   Array.Empty<LeadStatus>() },
        { LeadStatus.CheckIn,     Array.Empty<LeadStatus>() },
        { LeadStatus.NotRelevant, Array.Empty<LeadStatus>() },
        { LeadStatus.Completed,   Array.Empty<LeadStatus>() },
        { LeadStatus.Cancelled,   Array.Empty<LeadStatus>() },
        { LeadStatus.LeftEarly,   Array.Empty<LeadStatus>() },
    };

    public CrmLeadService(
        IUnitOfWork unitOfWork,
        IBookingService bookingService,
        IUnitAvailabilityService availabilityService)
    {
        _unitOfWork = unitOfWork;
        _bookingService = bookingService;
        _availabilityService = availabilityService;
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
            if (!Enum.TryParse<LeadStatus>(leadStatus.Trim(), ignoreCase: true, out var parsed))
                throw new BusinessValidationException($"Invalid lead status '{leadStatus}'.");
            query = query.Where(l => l.LeadStatus == parsed);
        }

        if (assignedAdminUserId.HasValue)
        {
            query = query.Where(l => l.AssignedAdminUserId == assignedAdminUserId.Value);
        }

        return await query.ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<CrmLead>> GetByClientIdAsync(Guid clientId, CancellationToken cancellationToken = default)
    {
        return await _unitOfWork.CrmLeads.Query()
            .Include(l => l.TargetUnit)
            .Where(l => l.ClientId == clientId)
            .OrderByDescending(l => l.CreatedAt)
            .ToListAsync(cancellationToken);
    }

    public Task<int> GetOpenCountAsync(CancellationToken cancellationToken = default)
    {
        return _unitOfWork.CrmLeads.Query()
            .CountAsync(lead => OpenStatuses.Contains(lead.LeadStatus), cancellationToken);
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
        ValidateContactInfo(contactName, contactPhone);
        ValidateDesiredStay(desiredCheckInDate, desiredCheckOutDate, guestCount);
        var normalizedSource = ValidateAndNormalizeSource(source);

        await ValidateOptionalReferencesAsync(
            clientId,
            targetUnitId,
            assignedAdminUserId,
            guestCount,
            cancellationToken);
        await EnsureDesiredDatesAvailableAsync(targetUnitId, desiredCheckInDate, desiredCheckOutDate, cancellationToken);
        await EnsureNoDuplicateOpenLeadAsync(
            clientId,
            targetUnitId,
            contactPhone,
            desiredCheckInDate,
            desiredCheckOutDate,
            guestCount,
            cancellationToken);

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
            LeadStatus = LeadStatus.Prospecting,
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

        ValidateContactInfo(contactName, contactPhone);
        ValidateDesiredStay(desiredCheckInDate, desiredCheckOutDate, guestCount);
        var normalizedSource = ValidateAndNormalizeSource(source);

        await ValidateOptionalReferencesAsync(
            clientId,
            targetUnitId,
            assignedAdminUserId,
            guestCount,
            cancellationToken);
        await EnsureDesiredDatesAvailableAsync(targetUnitId, desiredCheckInDate, desiredCheckOutDate, cancellationToken);

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

        if (!Enum.TryParse<LeadStatus>(leadStatus.Trim(), ignoreCase: true, out var targetStatus))
            throw new BusinessValidationException(
                $"Invalid lead status '{leadStatus}'. Allowed values: {string.Join(", ", Enum.GetNames<LeadStatus>())}");

        ValidateStatusTransition(lead.LeadStatus, targetStatus);

        lead.LeadStatus = targetStatus;
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
        await using var transaction = await _unitOfWork.BeginTransactionAsync(cancellationToken);
        try
        {
            // Unit first, then lead: every conversion uses the same lock order.
            await _unitOfWork.AcquireTransactionAdvisoryLockAsync(
                $"booking-unit:{unitId:N}",
                cancellationToken);
            await _unitOfWork.AcquireTransactionAdvisoryLockAsync(
                $"crm-lead:{leadId:N}",
                cancellationToken);

            var lead = await _unitOfWork.CrmLeads.GetByIdAsync(leadId, cancellationToken);
            if (lead == null)
                throw new NotFoundException($"CRM lead with ID {leadId} not found");

            await _unitOfWork.ReloadAsync(lead, cancellationToken);

            if (lead.LeadStatus != LeadStatus.Booked)
                throw new ConflictException(
                    $"CRM lead {leadId} must be in 'Booked' status before conversion. Current status: {lead.LeadStatus}.");

            if (lead.ClientId.HasValue && lead.ClientId.Value != clientId)
                throw new ConflictException(
                    $"CRM lead {leadId} is already linked to client {lead.ClientId.Value}, but conversion was requested for client {clientId}");

            if (lead.TargetUnitId.HasValue && lead.TargetUnitId.Value != unitId)
                throw new ConflictException(
                    $"CRM lead {leadId} is already linked to unit {lead.TargetUnitId.Value}, but conversion was requested for unit {unitId}");

            var booking = await _bookingService.CreateAsync(
                clientId: clientId,
                unitId: unitId,
                checkInDate: checkInDate,
                checkOutDate: checkOutDate,
                guestCount: guestCount,
                source: lead.Source,
                assignedAdminUserId: lead.AssignedAdminUserId,
                internalNotes: internalNotes,
                initialStatus: BookingStatus.Booked,
                cancellationToken: cancellationToken);

            // Completed is the available terminal lead state used to mean that
            // CRM ownership has ended and Booking is now authoritative.
            lead.LeadStatus = LeadStatus.Completed;
            lead.ClientId ??= clientId;
            lead.TargetUnitId ??= unitId;
            lead.UpdatedAt = DateTime.UtcNow;

            await _unitOfWork.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            return booking;
        }
        catch
        {
            await transaction.RollbackAsync(cancellationToken);
            throw;
        }
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

    private static void ValidateStatusTransition(LeadStatus currentStatus, LeadStatus targetStatus)
    {
        if (currentStatus == targetStatus)
            return;

        if (!AllowedTransitions.TryGetValue(currentStatus, out var allowed) || !allowed.Contains(targetStatus))
            throw new BusinessValidationException(
                $"Cannot transition CRM lead from '{currentStatus}' to '{targetStatus}'. " +
                $"Allowed transitions from '{currentStatus}': {(allowed?.Length > 0 ? string.Join(", ", allowed) : "none (terminal state)")}.");
    }

    private async Task ValidateOptionalReferencesAsync(
        Guid? clientId,
        Guid? targetUnitId,
        Guid? assignedAdminUserId,
        int? guestCount,
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
            var unit = await _unitOfWork.Units.Query()
                .AsNoTracking()
                .Where(u =>
                    u.Id == targetUnitId.Value &&
                    u.IsActive &&
                    u.DeletedAt == null)
                .Select(u => new { u.Name, u.MaxGuests })
                .FirstOrDefaultAsync(cancellationToken);

            if (unit == null)
                throw new NotFoundException($"Active unit with ID {targetUnitId.Value} not found");

            if (guestCount.HasValue && guestCount.Value > unit.MaxGuests)
            {
                var guestLabel = unit.MaxGuests == 1 ? "guest" : "guests";
                throw new BusinessValidationException(
                    $"{unit.Name} accepts up to {unit.MaxGuests} {guestLabel}. " +
                    "Reduce the guest count or choose another unit.");
            }
        }

        if (assignedAdminUserId.HasValue)
        {
            var adminExists = await _unitOfWork.AdminUsers.ExistsAsync(
                a => a.Id == assignedAdminUserId.Value && a.IsActive, cancellationToken);
            if (!adminExists)
                throw new NotFoundException($"Active admin user with ID {assignedAdminUserId.Value} not found");
        }
    }

    private async Task EnsureNoDuplicateOpenLeadAsync(
        Guid? clientId,
        Guid? targetUnitId,
        string contactPhone,
        DateOnly? desiredCheckInDate,
        DateOnly? desiredCheckOutDate,
        int? guestCount,
        CancellationToken cancellationToken)
    {
        if (!targetUnitId.HasValue || !desiredCheckInDate.HasValue || !desiredCheckOutDate.HasValue || !guestCount.HasValue)
            return;

        var normalizedPhone = contactPhone.Trim();
        var duplicateExists = await _unitOfWork.CrmLeads.Query()
            .AnyAsync(l =>
                l.TargetUnitId == targetUnitId.Value &&
                l.DesiredCheckInDate == desiredCheckInDate.Value &&
                l.DesiredCheckOutDate == desiredCheckOutDate.Value &&
                l.GuestCount == guestCount.Value &&
                OpenStatuses.Contains(l.LeadStatus) &&
                (clientId.HasValue ? l.ClientId == clientId.Value : l.ContactPhone == normalizedPhone),
                cancellationToken);

        if (duplicateExists)
            throw new ConflictException("A matching booking request is already open for these dates.");
    }

    private async Task EnsureDesiredDatesAvailableAsync(
        Guid? targetUnitId,
        DateOnly? desiredCheckInDate,
        DateOnly? desiredCheckOutDate,
        CancellationToken cancellationToken)
    {
        if (!targetUnitId.HasValue || !desiredCheckInDate.HasValue || !desiredCheckOutDate.HasValue)
            return;

        var availability = await _availabilityService.CheckOperationalAvailabilityAsync(
            targetUnitId.Value,
            desiredCheckInDate.Value,
            desiredCheckOutDate.Value.AddDays(-1),
            cancellationToken: cancellationToken);

        if (!availability.IsAvailable)
            throw new ConflictException(
                $"Unit {targetUnitId.Value} is not available for the requested lead dates: {availability.Reason}");
    }
}
