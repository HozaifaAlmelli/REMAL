using System.Globalization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using RentalPlatform.Business.Exceptions;
using RentalPlatform.Business.Interfaces;
using RentalPlatform.Business.Models;
using RentalPlatform.Data;
using RentalPlatform.Data.Entities;
using RentalPlatform.Shared.Constants;
using RentalPlatform.Shared.Enums;

namespace RentalPlatform.Business.Services;

public class DateBlockApprovalService : IDateBlockApprovalService
{
    private const string InAppChannel = "in_app";
    private const string EmailChannel = "email";
    private const string ApprovalRequestTemplate = "OWNER_BLOCK_APPROVAL_REQUEST";
    private const string ApprovedTemplate = "OWNER_BLOCK_APPROVED";
    private const string RejectedTemplate = "OWNER_BLOCK_REJECTED";

    private static readonly BookingStatus[] HardBookingStatuses =
    {
        BookingStatus.Booked,
        BookingStatus.Confirmed,
        BookingStatus.CheckIn
    };

    private static readonly BookingStatus[] SoftBookingStatuses =
    {
        BookingStatus.Prospecting,
        BookingStatus.Relevant
    };

    private static readonly LeadStatus[] SoftLeadStatuses =
    {
        LeadStatus.Prospecting,
        LeadStatus.Relevant
    };

    private readonly IUnitOfWork _unitOfWork;
    private readonly INotificationService _notificationService;
    private readonly IBookingLifecycleService _bookingLifecycleService;
    private readonly ICrmLeadService _crmLeadService;
    private readonly ILogger<DateBlockApprovalService> _logger;

    public DateBlockApprovalService(
        IUnitOfWork unitOfWork,
        INotificationService notificationService,
        IBookingLifecycleService bookingLifecycleService,
        ICrmLeadService crmLeadService,
        ILogger<DateBlockApprovalService> logger)
    {
        _unitOfWork = unitOfWork;
        _notificationService = notificationService;
        _bookingLifecycleService = bookingLifecycleService;
        _crmLeadService = crmLeadService;
        _logger = logger;
    }

    public async Task<DateBlock> RequestOwnerBlockAsync(
        Guid ownerId,
        Guid unitId,
        DateOnly startDate,
        DateOnly endDate,
        string? reason,
        string? notes,
        CancellationToken cancellationToken = default)
    {
        ValidateRange(startDate, endDate);

        Unit unit;
        DateBlock block;
        int conflictCount = 0;

        await using var transaction = await _unitOfWork.BeginTransactionAsync(cancellationToken);
        try
        {
            unit = await GetOwnedUnitOrThrowAsync(ownerId, unitId, tracked: true, cancellationToken);

            await _unitOfWork.AcquireTransactionAdvisoryLockAsync(
                BuildUnitLockKey(unitId),
                cancellationToken);
            await _unitOfWork.ReloadAsync(unit, cancellationToken);

            if (unit.OwnerId != ownerId || unit.DeletedAt != null)
                throw new NotFoundException($"Unit {unitId} was not found for this owner.");

            await EnsureNoHardBookingOverlapAsync(unitId, startDate, endDate, cancellationToken);
            await EnsureNoDateBlockOverlapAsync(unitId, startDate, endDate, excludeBlockId: null, cancellationToken);

            var softConflicts = await FindSoftConflictsAsync(unitId, startDate, endDate, cancellationToken);
            conflictCount = softConflicts.Count;

            block = new DateBlock
            {
                Id = Guid.NewGuid(),
                UnitId = unitId,
                StartDate = startDate,
                EndDate = endDate,
                Reason = reason?.Trim(),
                Notes = notes?.Trim(),
                Status = softConflicts.HasAny
                    ? DateBlockStatus.PendingApproval
                    : DateBlockStatus.Approved,
                RequiresAdminSignoff = softConflicts.HasAny,
                ConflictingLeadId = softConflicts.Leads.FirstOrDefault()?.Id,
                ConflictingBookingId = softConflicts.Bookings.FirstOrDefault()?.Id
            };

            await _unitOfWork.DateBlocks.AddAsync(block, cancellationToken);
            await _unitOfWork.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
        }
        catch
        {
            await transaction.RollbackAsync(cancellationToken);
            throw;
        }

        if (block.Status == DateBlockStatus.PendingApproval)
        {
            await NotifyAdminsOfApprovalRequestAsync(
                unit.Name,
                startDate,
                endDate,
                conflictCount,
                cancellationToken);
        }

        return block;
    }

    public async Task<DateBlockPreflightResult> EvaluateAsync(
        Guid ownerId,
        Guid unitId,
        DateOnly startDate,
        DateOnly endDate,
        CancellationToken cancellationToken = default)
    {
        ValidateRange(startDate, endDate);
        await GetOwnedUnitOrThrowAsync(ownerId, unitId, tracked: false, cancellationToken);

        var dateBlockDates = await GetDateBlockConflictDatesAsync(unitId, startDate, endDate, cancellationToken);
        if (dateBlockDates.Count > 0)
        {
            return new DateBlockPreflightResult("hard_blocked", "date_block", dateBlockDates);
        }

        var hardBookingDates = await GetBookingConflictDatesAsync(
            unitId,
            startDate,
            endDate,
            HardBookingStatuses,
            cancellationToken);
        if (hardBookingDates.Count > 0)
        {
            return new DateBlockPreflightResult("hard_blocked", "booking", hardBookingDates);
        }

        var softConflicts = await FindSoftConflictsAsync(unitId, startDate, endDate, cancellationToken);
        if (softConflicts.HasAny)
        {
            var softDates = BuildSoftConflictDates(softConflicts, startDate, endDate);
            return new DateBlockPreflightResult("requires_approval", "active_pipeline", softDates);
        }

        return new DateBlockPreflightResult("clear", null, Array.Empty<DateOnly>());
    }

    public async Task<IReadOnlyList<DateBlockApprovalListItem>> GetPendingAsync(
        CancellationToken cancellationToken = default)
    {
        var blocks = await _unitOfWork.DateBlocks.Query()
            .AsNoTracking()
            .Include(block => block.Unit)
                .ThenInclude(unit => unit.Owner)
            .Where(block => block.Status == DateBlockStatus.PendingApproval)
            .Where(block => block.DeletedAt == null)
            .OrderBy(block => block.CreatedAt)
            .ToListAsync(cancellationToken);

        var items = new List<DateBlockApprovalListItem>(blocks.Count);
        foreach (var block in blocks)
        {
            var lead = block.ConflictingLeadId.HasValue
                ? await _unitOfWork.CrmLeads.Query()
                    .AsNoTracking()
                    .FirstOrDefaultAsync(lead => lead.Id == block.ConflictingLeadId.Value, cancellationToken)
                : null;

            var booking = block.ConflictingBookingId.HasValue
                ? await _unitOfWork.Bookings.Query()
                    .AsNoTracking()
                    .FirstOrDefaultAsync(booking => booking.Id == block.ConflictingBookingId.Value, cancellationToken)
                : null;

            var conflictCount = await CountSoftConflictsAsync(
                block.UnitId,
                block.StartDate,
                block.EndDate,
                cancellationToken);

            items.Add(new DateBlockApprovalListItem
            {
                Id = block.Id,
                UnitId = block.UnitId,
                UnitName = block.Unit?.Name ?? "Unknown unit",
                OwnerId = block.Unit?.OwnerId ?? Guid.Empty,
                OwnerName = block.Unit?.Owner?.Name ?? "Unknown owner",
                StartDate = block.StartDate,
                EndDate = block.EndDate,
                Reason = block.Reason,
                Notes = block.Notes,
                ConflictingLeadId = block.ConflictingLeadId,
                ConflictingLeadStartDate = lead?.DesiredCheckInDate,
                ConflictingLeadEndDate = lead?.DesiredCheckOutDate,
                ConflictingBookingId = block.ConflictingBookingId,
                ConflictingBookingCheckInDate = booking?.CheckInDate,
                ConflictingBookingCheckOutDate = booking?.CheckOutDate,
                ConflictCount = conflictCount,
                CreatedAt = block.CreatedAt
            });
        }

        return items;
    }

    public async Task<DateBlockResolutionResult> ResolveAsync(
        Guid blockId,
        string decision,
        Guid resolvingAdminId,
        string? notes,
        CancellationToken cancellationToken = default)
    {
        if (!IsApprovedDecision(decision) && !IsRejectedDecision(decision))
            throw new BusinessValidationException("Decision must be either 'approved' or 'rejected'.");

        DateBlock block;
        Guid ownerId;
        string unitName;
        int releasedConflictCount = 0;

        await using var transaction = await _unitOfWork.BeginTransactionAsync(cancellationToken);
        try
        {
            block = await _unitOfWork.DateBlocks.Query()
                .Include(dateBlock => dateBlock.Unit)
                    .ThenInclude(unit => unit.Owner)
                .FirstOrDefaultAsync(dateBlock => dateBlock.Id == blockId, cancellationToken)
                ?? throw new NotFoundException($"Date block {blockId} not found.");

            await _unitOfWork.AcquireTransactionAdvisoryLockAsync(
                BuildUnitLockKey(block.UnitId),
                cancellationToken);
            await _unitOfWork.ReloadAsync(block, cancellationToken);

            if (block.Status != DateBlockStatus.PendingApproval || block.DeletedAt != null)
                throw new ConflictException("This date-block request has already been resolved.");

            ownerId = block.Unit.OwnerId;
            unitName = block.Unit.Name;

            block.ResolvedByAdminUserId = resolvingAdminId;
            block.ResolvedAt = DateTime.UtcNow;
            block.RequiresAdminSignoff = false;

            if (IsApprovedDecision(decision))
            {
                var softConflicts = await FindSoftConflictsAsync(
                    block.UnitId,
                    block.StartDate,
                    block.EndDate,
                    cancellationToken);

                foreach (var lead in softConflicts.Leads)
                {
                    await _crmLeadService.SetStatusAsync(
                        lead.Id,
                        LeadStatus.NotRelevant.ToString(),
                        cancellationToken);
                }

                foreach (var booking in softConflicts.Bookings)
                {
                    await _bookingLifecycleService.TransitionAsync(
                        booking.Id,
                        BookingStatus.NotRelevant,
                        resolvingAdminId,
                        notes,
                        cancellationToken);
                }

                releasedConflictCount = softConflicts.Count;
                block.Status = DateBlockStatus.Approved;
            }
            else
            {
                block.Status = DateBlockStatus.Rejected;
                block.DeletedAt = DateTime.UtcNow;
            }

            _unitOfWork.DateBlocks.Update(block);
            await _unitOfWork.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
        }
        catch
        {
            await transaction.RollbackAsync(cancellationToken);
            throw;
        }

        var templateCode = IsApprovedDecision(decision) ? ApprovedTemplate : RejectedTemplate;
        await NotifyOwnerOfResolutionAsync(
            templateCode,
            ownerId,
            unitName,
            block.StartDate,
            block.EndDate,
            releasedConflictCount,
            cancellationToken);

        return new DateBlockResolutionResult(block, ownerId, unitName, releasedConflictCount);
    }

    public async Task<DateBlock> WithdrawOwnerBlockAsync(
        Guid ownerId,
        Guid unitId,
        Guid blockId,
        CancellationToken cancellationToken = default)
    {
        DateBlock block;

        await using var transaction = await _unitOfWork.BeginTransactionAsync(cancellationToken);
        try
        {
            // Ownership gate: the unit must belong to this owner.
            await GetOwnedUnitOrThrowAsync(ownerId, unitId, tracked: false, cancellationToken);

            // Serialize against a concurrent admin resolve on the same unit.
            await _unitOfWork.AcquireTransactionAdvisoryLockAsync(
                BuildUnitLockKey(unitId),
                cancellationToken);

            block = await _unitOfWork.DateBlocks.Query()
                .FirstOrDefaultAsync(
                    dateBlock => dateBlock.Id == blockId && dateBlock.UnitId == unitId,
                    cancellationToken)
                ?? throw new NotFoundException($"Date block {blockId} was not found for this unit.");

            if (block.DeletedAt != null || block.Status == DateBlockStatus.Rejected)
                throw new ConflictException("These dates have already been re-opened.");

            // Soft-delete: availability and the admin approval queue both filter on
            // DeletedAt IS NULL, so the dates free up and any pending request disappears.
            block.Status = DateBlockStatus.Rejected;
            block.DeletedAt = DateTime.UtcNow;
            block.RequiresAdminSignoff = false;

            _unitOfWork.DateBlocks.Update(block);
            await _unitOfWork.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
        }
        catch
        {
            await transaction.RollbackAsync(cancellationToken);
            throw;
        }

        return block;
    }

    private async Task<Unit> GetOwnedUnitOrThrowAsync(
        Guid ownerId,
        Guid unitId,
        bool tracked,
        CancellationToken cancellationToken)
    {
        var query = _unitOfWork.Units.Query()
            .Include(unit => unit.Owner)
            .Where(unit => unit.Id == unitId && unit.OwnerId == ownerId && unit.DeletedAt == null);

        if (!tracked)
            query = query.AsNoTracking();

        return await query.FirstOrDefaultAsync(cancellationToken)
            ?? throw new NotFoundException($"Unit {unitId} was not found for this owner.");
    }

    private async Task EnsureNoDateBlockOverlapAsync(
        Guid unitId,
        DateOnly startDate,
        DateOnly endDate,
        Guid? excludeBlockId,
        CancellationToken cancellationToken)
    {
        var query = _unitOfWork.DateBlocks.Query()
            .Where(block => block.UnitId == unitId)
            .Where(block => block.DeletedAt == null)
            .Where(block => startDate <= block.EndDate && endDate >= block.StartDate);

        if (excludeBlockId.HasValue)
            query = query.Where(block => block.Id != excludeBlockId.Value);

        if (await query.AnyAsync(cancellationToken))
            throw new ConflictException("The specified date range overlaps with an existing date block for this unit.");
    }

    private async Task EnsureNoHardBookingOverlapAsync(
        Guid unitId,
        DateOnly startDate,
        DateOnly endDate,
        CancellationToken cancellationToken)
    {
        var blockEndExclusive = endDate.AddDays(1);
        var hasBookingOverlap = await _unitOfWork.Bookings.Query()
            .Where(booking => booking.UnitId == unitId)
            .Where(booking => HardBookingStatuses.Contains(booking.BookingStatus))
            .Where(booking => booking.Client.DeletedAt == null && booking.Unit.DeletedAt == null)
            .AnyAsync(
                booking => startDate < booking.CheckOutDate && blockEndExclusive > booking.CheckInDate,
                cancellationToken);

        if (hasBookingOverlap)
            throw new ConflictException("This date range contains an active, confirmed booking and cannot be closed.");
    }

    private async Task<SoftConflictSet> FindSoftConflictsAsync(
        Guid unitId,
        DateOnly startDate,
        DateOnly endDate,
        CancellationToken cancellationToken)
    {
        var blockEndExclusive = endDate.AddDays(1);

        var leads = await _unitOfWork.CrmLeads.Query()
            .Where(lead => lead.TargetUnitId == unitId)
            .Where(lead => SoftLeadStatuses.Contains(lead.LeadStatus))
            .Where(lead => lead.DesiredCheckInDate.HasValue && lead.DesiredCheckOutDate.HasValue)
            .Where(lead =>
                startDate <= lead.DesiredCheckOutDate!.Value &&
                endDate >= lead.DesiredCheckInDate!.Value)
            .OrderBy(lead => lead.CreatedAt)
            .ToListAsync(cancellationToken);

        var bookings = await _unitOfWork.Bookings.Query()
            .Where(booking => booking.UnitId == unitId)
            .Where(booking => SoftBookingStatuses.Contains(booking.BookingStatus))
            .Where(booking => booking.Client.DeletedAt == null && booking.Unit.DeletedAt == null)
            .Where(booking => startDate < booking.CheckOutDate && blockEndExclusive > booking.CheckInDate)
            .OrderBy(booking => booking.CreatedAt)
            .ToListAsync(cancellationToken);

        return new SoftConflictSet(leads, bookings);
    }

    private async Task<int> CountSoftConflictsAsync(
        Guid unitId,
        DateOnly startDate,
        DateOnly endDate,
        CancellationToken cancellationToken)
    {
        var conflicts = await FindSoftConflictsAsync(unitId, startDate, endDate, cancellationToken);
        return conflicts.Count;
    }

    private async Task<IReadOnlyList<DateOnly>> GetDateBlockConflictDatesAsync(
        Guid unitId,
        DateOnly startDate,
        DateOnly endDate,
        CancellationToken cancellationToken)
    {
        var blocks = await _unitOfWork.DateBlocks.Query()
            .AsNoTracking()
            .Where(block => block.UnitId == unitId)
            .Where(block => block.DeletedAt == null)
            .Where(block => startDate <= block.EndDate && endDate >= block.StartDate)
            .ToListAsync(cancellationToken);

        return blocks
            .SelectMany(block => BuildInclusiveRange(
                MaxDate(startDate, block.StartDate),
                MinDate(endDate, block.EndDate)))
            .Distinct()
            .OrderBy(date => date)
            .ToList();
    }

    private async Task<IReadOnlyList<DateOnly>> GetBookingConflictDatesAsync(
        Guid unitId,
        DateOnly startDate,
        DateOnly endDate,
        IReadOnlyCollection<BookingStatus> statuses,
        CancellationToken cancellationToken)
    {
        var blockEndExclusive = endDate.AddDays(1);
        var bookings = await _unitOfWork.Bookings.Query()
            .AsNoTracking()
            .Where(booking => booking.UnitId == unitId)
            .Where(booking => statuses.Contains(booking.BookingStatus))
            .Where(booking => booking.Client.DeletedAt == null && booking.Unit.DeletedAt == null)
            .Where(booking => startDate < booking.CheckOutDate && blockEndExclusive > booking.CheckInDate)
            .ToListAsync(cancellationToken);

        return bookings
            .SelectMany(booking => BuildInclusiveRange(
                MaxDate(startDate, booking.CheckInDate),
                MinDate(endDate, booking.CheckOutDate.AddDays(-1))))
            .Distinct()
            .OrderBy(date => date)
            .ToList();
    }

    private static IReadOnlyList<DateOnly> BuildSoftConflictDates(
        SoftConflictSet conflicts,
        DateOnly startDate,
        DateOnly endDate)
    {
        return conflicts.Leads
            .SelectMany(lead => BuildInclusiveRange(
                MaxDate(startDate, lead.DesiredCheckInDate!.Value),
                MinDate(endDate, lead.DesiredCheckOutDate!.Value)))
            .Concat(conflicts.Bookings.SelectMany(booking => BuildInclusiveRange(
                MaxDate(startDate, booking.CheckInDate),
                MinDate(endDate, booking.CheckOutDate.AddDays(-1)))))
            .Distinct()
            .OrderBy(date => date)
            .ToList();
    }

    private async Task NotifyAdminsOfApprovalRequestAsync(
        string unitName,
        DateOnly startDate,
        DateOnly endDate,
        int conflictCount,
        CancellationToken cancellationToken)
    {
        try
        {
            var admins = await _unitOfWork.AdminUsers.Query()
                .AsNoTracking()
                .Include(admin => admin.RoleTemplate)
                .Where(admin => admin.IsActive && admin.RoleTemplate != null && admin.RoleTemplate.IsActive)
                .Where(admin =>
                    !admin.PermissionOverrides.Any(entry =>
                        entry.PermissionKey == RbacPermissionKeys.AvailabilityApprove &&
                        entry.ModifierType == "deny") &&
                    (admin.RoleTemplate!.Permissions.Any(permission =>
                         permission.PermissionKey == RbacPermissionKeys.AvailabilityApprove) ||
                     admin.PermissionOverrides.Any(entry =>
                         entry.PermissionKey == RbacPermissionKeys.AvailabilityApprove &&
                         entry.ModifierType == "grant")))
                .OrderBy(admin => admin.Name)
                .ToListAsync(cancellationToken);

            var variables = BuildNotificationVariables(unitName, startDate, endDate, conflictCount);
            foreach (var admin in admins)
            {
                await TryCreateAdminNotificationAsync(admin.Id, variables, cancellationToken);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Owner date-block approval request notification fan-out failed.");
        }
    }

    private async Task NotifyOwnerOfResolutionAsync(
        string templateCode,
        Guid ownerId,
        string unitName,
        DateOnly startDate,
        DateOnly endDate,
        int conflictCount,
        CancellationToken cancellationToken)
    {
        var variables = BuildNotificationVariables(unitName, startDate, endDate, conflictCount);
        await TryCreateOwnerNotificationAsync(templateCode, ownerId, InAppChannel, variables, cancellationToken);
        await TryCreateOwnerNotificationAsync(templateCode, ownerId, EmailChannel, variables, cancellationToken);
    }

    private async Task TryCreateAdminNotificationAsync(
        Guid adminId,
        IReadOnlyDictionary<string, string> variables,
        CancellationToken cancellationToken)
    {
        try
        {
            await _notificationService.CreateForAdminAsync(
                ApprovalRequestTemplate,
                InAppChannel,
                adminId,
                variables,
                scheduledAt: null,
                cancellationToken);
        }
        catch (Exception ex) when (ex is NotFoundException or BusinessValidationException or ConflictException)
        {
            _logger.LogWarning(
                ex,
                "Could not create owner date-block approval notification for admin {AdminUserId}.",
                adminId);
        }
    }

    private async Task TryCreateOwnerNotificationAsync(
        string templateCode,
        Guid ownerId,
        string channel,
        IReadOnlyDictionary<string, string> variables,
        CancellationToken cancellationToken)
    {
        try
        {
            await _notificationService.CreateForOwnerAsync(
                templateCode,
                channel,
                ownerId,
                variables,
                scheduledAt: null,
                cancellationToken);
        }
        catch (Exception ex) when (ex is NotFoundException or BusinessValidationException or ConflictException)
        {
            _logger.LogWarning(
                ex,
                "Could not create owner date-block resolution notification {TemplateCode} for owner {OwnerId}.",
                templateCode,
                ownerId);
        }
    }

    private static IReadOnlyDictionary<string, string> BuildNotificationVariables(
        string unitName,
        DateOnly startDate,
        DateOnly endDate,
        int conflictCount)
    {
        return new Dictionary<string, string>
        {
            ["unitName"] = unitName,
            ["startDate"] = FormatDate(startDate),
            ["endDate"] = FormatDate(endDate),
            ["conflictCount"] = conflictCount.ToString(CultureInfo.InvariantCulture)
        };
    }

    private static IEnumerable<DateOnly> BuildInclusiveRange(DateOnly startDate, DateOnly endDate)
    {
        if (endDate < startDate)
            yield break;

        for (var date = startDate; date <= endDate; date = date.AddDays(1))
            yield return date;
    }

    private static void ValidateRange(DateOnly startDate, DateOnly endDate)
    {
        if (startDate > endDate)
            throw new BusinessValidationException("Start date cannot be after end date.");
    }

    private static bool IsApprovedDecision(string decision) =>
        string.Equals(decision, "approved", StringComparison.OrdinalIgnoreCase);

    private static bool IsRejectedDecision(string decision) =>
        string.Equals(decision, "rejected", StringComparison.OrdinalIgnoreCase);

    private static string BuildUnitLockKey(Guid unitId) => $"booking-unit:{unitId:N}";

    private static DateOnly MaxDate(DateOnly left, DateOnly right) => left > right ? left : right;

    private static DateOnly MinDate(DateOnly left, DateOnly right) => left < right ? left : right;

    private static string FormatDate(DateOnly date) =>
        date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);

    private sealed record SoftConflictSet(
        IReadOnlyList<CrmLead> Leads,
        IReadOnlyList<Booking> Bookings)
    {
        public bool HasAny => Leads.Count > 0 || Bookings.Count > 0;
        public int Count => Leads.Count + Bookings.Count;
    }
}
