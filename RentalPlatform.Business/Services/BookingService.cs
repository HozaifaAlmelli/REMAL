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
using RentalPlatform.Shared.Constants;
using RentalPlatform.Shared.Enums;
using RentalPlatform.Shared.Models;

namespace RentalPlatform.Business.Services;

public class BookingService : IBookingService
{
    private static readonly TimeSpan RecentDuplicateWindow = TimeSpan.FromSeconds(30);
    private readonly IUnitOfWork _unitOfWork;
    private readonly IUnitAvailabilityService _availabilityService;

    private static readonly string[] AllowedSources = { "direct", "admin", "phone", "whatsapp", "website" };

    public BookingService(IUnitOfWork unitOfWork, IUnitAvailabilityService availabilityService)
    {
        _unitOfWork = unitOfWork;
        _availabilityService = availabilityService;
    }

    public async Task<PagedResult<Booking>> GetAllAsync(
        string? bookingStatus = null,
        Guid? assignedAdminUserId = null,
        Guid? clientId = null,
        Guid? ownerId = null,
        string? search = null,
        DateOnly? checkInFrom = null,
        DateOnly? checkInTo = null,
        int page = 1,
        int pageSize = 20,
        bool agedSoftHoldsOnly = false,
        CancellationToken cancellationToken = default)
    {
        IQueryable<Booking> query = _unitOfWork.Bookings.Query()
            .Include(b => b.Unit)
            .Include(b => b.Client)
            .Include(b => b.AssignedAdminUser)
                .ThenInclude(admin => admin!.RoleTemplate);

        if (!string.IsNullOrWhiteSpace(bookingStatus))
        {
            if (!Enum.TryParse<BookingStatus>(bookingStatus.Trim(), ignoreCase: true, out var parsedStatus))
                throw new BusinessValidationException($"Invalid booking status '{bookingStatus}'.");
            query = query.Where(b => b.BookingStatus == parsedStatus);
        }

        if (assignedAdminUserId.HasValue)
            query = query.Where(b => b.AssignedAdminUserId == assignedAdminUserId.Value);

        if (clientId.HasValue)
            query = query.Where(b => b.ClientId == clientId.Value);

        if (ownerId.HasValue)
            query = query.Where(b => b.OwnerId == ownerId.Value);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();

            // Reference lookup: the portals show a booking/unit handle (BKG-xxxxxx /
            // UNIT-xxxxxx) that is just the tail of the GUID. Strip the cosmetic prefix
            // so the remaining hex can be matched against the id text — a "bkg" prefix
            // targets the booking id, "unit" the unit id, and a bare code matches either.
            var isUnitRef = s.StartsWith("unit");
            var isBookingRef = s.StartsWith("bkg");
            var code = s.TrimStart('#');
            if (isUnitRef) code = code.Substring(4);
            else if (isBookingRef) code = code.Substring(3);
            code = code.TrimStart('-', ' ');

            // Only treat the term as an id when there's a meaningful hex tail, so a stray
            // "unit" or a short name fragment never matches every row.
            var matchId = code.Length >= 4 &&
                code.All(ch => (ch >= '0' && ch <= '9') || (ch >= 'a' && ch <= 'f') || ch == '-');

            query = query.Where(b =>
                b.Client.Name.ToLower().Contains(s) ||
                b.Client.Phone.ToLower().Contains(s) ||
                b.Unit.Name.ToLower().Contains(s) ||
                (b.AssignedAdminUser != null && b.AssignedAdminUser.Name.ToLower().Contains(s)) ||
                (matchId && !isUnitRef && b.Id.ToString().Contains(code)) ||
                (matchId && !isBookingRef && b.Unit.Id.ToString().Contains(code)));
        }

        if (checkInFrom.HasValue)
            query = query.Where(b => b.CheckInDate >= checkInFrom.Value);

        if (checkInTo.HasValue)
            query = query.Where(b => b.CheckInDate <= checkInTo.Value);

        if (agedSoftHoldsOnly)
        {
            var softHoldStatuses = BookingStatusTransitions.SoftHoldStatuses;
            var cutoff = DateTime.UtcNow.AddDays(-BookingStatusTransitions.AgedSoftHoldThresholdDays);
            query = query
                .Where(b => softHoldStatuses.Contains(b.BookingStatus))
                .Where(b => b.CreatedAt <= cutoff);
        }

        var total = await query.CountAsync(cancellationToken);
        var items = await query
            .OrderByDescending(b => b.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        return new PagedResult<Booking>(items, total);
    }

    public async Task<Booking?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        return await _unitOfWork.Bookings.Query()
            .Include(b => b.Unit)
            .Include(b => b.Client)
            .Include(b => b.AssignedAdminUser)
                .ThenInclude(admin => admin!.RoleTemplate)
            .FirstOrDefaultAsync(b => b.Id == id, cancellationToken);
    }

    public async Task<Booking> CreateAsync(
        Guid clientId,
        Guid unitId,
        DateOnly checkInDate,
        DateOnly checkOutDate,
        int guestCount,
        string source,
        Guid? assignedAdminUserId,
        Guid? createdByAdminUserId,
        string? internalNotes,
        BookingStatus? initialStatus = null,
        bool requirePortfolioVisibility = false,
        bool rejectSoftHoldOverlaps = false,
        CancellationToken cancellationToken = default)
    {
        // --- Input validation ---
        ValidateStayDates(checkInDate, checkOutDate);
        ValidateGuestCount(guestCount);
        var normalizedSource = ValidateAndNormalizeSource(source);

        // --- Entity existence checks ---
        var client = await _unitOfWork.Clients.FirstOrDefaultAsync(
            c => c.Id == clientId && c.IsActive && c.DeletedAt == null, cancellationToken);
        if (client == null)
            throw new NotFoundException($"Active client with ID {clientId} not found");

        var unit = await _unitOfWork.Units.FirstOrDefaultAsync(
            u => u.Id == unitId
                && u.IsActive
                && (!requirePortfolioVisibility || u.IsVisibleInPortfolio)
                && u.DeletedAt == null,
            cancellationToken);
        if (unit == null)
            throw new NotFoundException(requirePortfolioVisibility
                ? $"Public unit with ID {unitId} not found"
                : $"Active unit with ID {unitId} not found");

        if (assignedAdminUserId.HasValue)
        {
            var adminExists = await _unitOfWork.AdminUsers.ExistsAsync(
                a => a.Id == assignedAdminUserId.Value && a.IsActive, cancellationToken);
            if (!adminExists)
                throw new NotFoundException($"Active admin user with ID {assignedAdminUserId.Value} not found");
        }

        if (createdByAdminUserId.HasValue)
        {
            var creatorExists = await _unitOfWork.AdminUsers.ExistsAsync(
                a => a.Id == createdByAdminUserId.Value && a.IsActive, cancellationToken);
            if (!creatorExists)
                throw new NotFoundException($"Active admin user with ID {createdByAdminUserId.Value} not found");
        }

        // --- Guest count vs unit capacity ---
        if (guestCount > unit.MaxGuests)
            throw new BusinessValidationException(
                $"Guest count ({guestCount}) exceeds unit maximum capacity ({unit.MaxGuests})");

        // --- Translate booking dates to pricing range (checkout - 1 day) ---
        var pricingStartDate = checkInDate;
        var pricingEndDate = checkOutDate.AddDays(-1);

        // --- Operational availability check (date blocks) ---
        var availability = await _availabilityService.CheckOperationalAvailabilityAsync(
            unitId, pricingStartDate, pricingEndDate, cancellationToken: cancellationToken);
        if (!availability.IsAvailable)
            throw new ConflictException(
                $"Unit {unitId} is not operationally available for the requested dates: {availability.Reason}");

        if (rejectSoftHoldOverlaps)
        {
            await EnsureNoActiveAvailabilityHoldOverlap(
                unitId,
                checkInDate,
                checkOutDate,
                excludeBookingId: null,
                cancellationToken);
        }

        // --- Confirmed booking overlap check ---
        await EnsureNoConfirmedOverlap(unitId, checkInDate, checkOutDate, excludeBookingId: null, cancellationToken);

        // --- Pricing snapshot ---
        var pricing = await _availabilityService.CalculatePricingAsync(
            unitId, pricingStartDate, pricingEndDate, cancellationToken);

        // --- Create booking entity ---
        var startingStatus = initialStatus ?? BookingStatus.Prospecting;

        var booking = new Booking
        {
            Id = Guid.NewGuid(),
            ClientId = clientId,
            UnitId = unitId,
            Unit = unit,
            OwnerId = unit.OwnerId, // snapshot from unit, not caller input
            AssignedAdminUserId = assignedAdminUserId,
            BookingStatus = startingStatus,
            CheckInDate = checkInDate,
            CheckOutDate = checkOutDate,
            GuestCount = guestCount,
            BaseAmount = pricing.TotalPrice,
            FinalAmount = pricing.TotalPrice,
            Source = normalizedSource,
            InternalNotes = internalNotes?.Trim(),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await _unitOfWork.Bookings.AddAsync(booking, cancellationToken);

        // --- Initial status history row ---
        var statusHistory = new BookingStatusHistory
        {
            Id = Guid.NewGuid(),
            BookingId = booking.Id,
            OldStatus = null,
            NewStatus = startingStatus.ToString().ToLower(),
            ChangedByAdminUserId = createdByAdminUserId,
            Notes = BookingHistoryEvents.BookingCreated,
            ChangedAt = DateTime.UtcNow
        };

        await _unitOfWork.BookingStatusHistories.AddAsync(statusHistory, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return booking;
    }

    public async Task<Booking> CreateQuickAsync(
        Guid clientId,
        Guid unitId,
        DateOnly checkInDate,
        DateOnly checkOutDate,
        int guestCount,
        string source,
        Guid? assignedAdminUserId,
        Guid? createdByAdminUserId,
        string? internalNotes,
        bool requirePortfolioVisibility = false,
        bool rejectSoftHoldOverlaps = false,
        CancellationToken cancellationToken = default)
    {
        if (_unitOfWork.HasActiveTransaction)
        {
            return await CreateQuickInCurrentTransactionAsync(
                clientId,
                unitId,
                checkInDate,
                checkOutDate,
                guestCount,
                source,
                assignedAdminUserId,
                createdByAdminUserId,
                internalNotes,
                requirePortfolioVisibility,
                rejectSoftHoldOverlaps,
                cancellationToken);
        }

        await using var transaction = await _unitOfWork.BeginTransactionAsync(cancellationToken);
        try
        {
            var booking = await CreateQuickInCurrentTransactionAsync(
                clientId,
                unitId,
                checkInDate,
                checkOutDate,
                guestCount,
                source,
                assignedAdminUserId,
                createdByAdminUserId,
                internalNotes,
                requirePortfolioVisibility,
                rejectSoftHoldOverlaps,
                cancellationToken);

            await transaction.CommitAsync(cancellationToken);
            return booking;
        }
        catch
        {
            await transaction.RollbackAsync(cancellationToken);
            throw;
        }
    }

    private async Task<Booking> CreateQuickInCurrentTransactionAsync(
        Guid clientId,
        Guid unitId,
        DateOnly checkInDate,
        DateOnly checkOutDate,
        int guestCount,
        string source,
        Guid? assignedAdminUserId,
        Guid? createdByAdminUserId,
        string? internalNotes,
        bool requirePortfolioVisibility,
        bool rejectSoftHoldOverlaps,
        CancellationToken cancellationToken)
    {
        await _unitOfWork.AcquireTransactionAdvisoryLockAsync(
            $"booking-unit:{unitId:N}",
            cancellationToken);

        var duplicateCutoff = DateTime.UtcNow.Subtract(RecentDuplicateWindow);
        var recentDuplicate = await _unitOfWork.Bookings.Query()
            .Include(b => b.Unit)
            .Include(b => b.Client)
            .Include(b => b.AssignedAdminUser)
                .ThenInclude(admin => admin!.RoleTemplate)
            .Where(b => b.ClientId == clientId)
            .Where(b => b.UnitId == unitId)
            .Where(b => b.CheckInDate == checkInDate && b.CheckOutDate == checkOutDate)
            .Where(b => b.BookingStatus == BookingStatus.Prospecting)
            .Where(b => b.CreatedAt >= duplicateCutoff)
            .OrderByDescending(b => b.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);

        if (recentDuplicate != null)
        {
            return recentDuplicate;
        }

        return await CreateAsync(
            clientId,
            unitId,
            checkInDate,
            checkOutDate,
            guestCount,
            source,
            assignedAdminUserId,
            createdByAdminUserId,
            internalNotes,
            BookingStatus.Prospecting,
            requirePortfolioVisibility,
            rejectSoftHoldOverlaps,
            cancellationToken);
    }

    public async Task<Booking> UpdatePendingAsync(
        Guid id,
        DateOnly checkInDate,
        DateOnly checkOutDate,
        int guestCount,
        string source,
        Guid? assignedAdminUserId,
        string? internalNotes,
        CancellationToken cancellationToken = default)
    {
        // --- Fetch and verify booking ---
        var booking = await _unitOfWork.Bookings.GetByIdAsync(id, cancellationToken);
        if (booking == null)
            throw new NotFoundException($"Booking with ID {id} not found");

        if (booking.BookingStatus != BookingStatus.Prospecting && booking.BookingStatus != BookingStatus.Relevant)
            throw new ConflictException(
                $"Booking {id} cannot be updated because its status is '{booking.BookingStatus}'. Only prospecting or relevant bookings can be updated.");

        // --- Input validation ---
        ValidateStayDates(checkInDate, checkOutDate);
        ValidateGuestCount(guestCount);
        var normalizedSource = ValidateAndNormalizeSource(source);

        // --- Verify admin if provided ---
        if (assignedAdminUserId.HasValue)
        {
            var adminExists = await _unitOfWork.AdminUsers.ExistsAsync(
                a => a.Id == assignedAdminUserId.Value && a.IsActive, cancellationToken);
            if (!adminExists)
                throw new NotFoundException($"Active admin user with ID {assignedAdminUserId.Value} not found");
        }

        // --- Load unit for capacity check ---
        var unit = await _unitOfWork.Units.FirstOrDefaultAsync(
            u => u.Id == booking.UnitId && u.IsActive && u.DeletedAt == null, cancellationToken);
        if (unit == null)
            throw new NotFoundException($"Active unit with ID {booking.UnitId} not found");

        if (guestCount > unit.MaxGuests)
            throw new BusinessValidationException(
                $"Guest count ({guestCount}) exceeds unit maximum capacity ({unit.MaxGuests})");

        // --- Translate booking dates to pricing range ---
        var pricingStartDate = checkInDate;
        var pricingEndDate = checkOutDate.AddDays(-1);

        // --- Re-check operational availability ---
        var availability = await _availabilityService.CheckOperationalAvailabilityAsync(
            booking.UnitId, pricingStartDate, pricingEndDate, booking.Id, cancellationToken);
        if (!availability.IsAvailable)
            throw new ConflictException(
                $"Unit {booking.UnitId} is not operationally available for the requested dates: {availability.Reason}");

        // --- Re-check confirmed overlap excluding self ---
        await EnsureNoConfirmedOverlap(booking.UnitId, checkInDate, checkOutDate, excludeBookingId: id, cancellationToken);

        // --- Re-compute pricing snapshot ---
        var pricing = await _availabilityService.CalculatePricingAsync(
            booking.UnitId, pricingStartDate, pricingEndDate, cancellationToken);

        // --- Apply updates ---
        booking.CheckInDate = checkInDate;
        booking.CheckOutDate = checkOutDate;
        booking.GuestCount = guestCount;
        booking.Unit = unit;
        booking.Source = normalizedSource;
        booking.AssignedAdminUserId = assignedAdminUserId;
        booking.InternalNotes = internalNotes?.Trim();
        booking.BaseAmount = pricing.TotalPrice;
        booking.FinalAmount = pricing.TotalPrice;
        booking.UpdatedAt = DateTime.UtcNow;

        _unitOfWork.Bookings.Update(booking);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return booking;
    }

    public async Task<IReadOnlyList<BookingStatusHistory>> GetStatusHistoryAsync(Guid bookingId, CancellationToken cancellationToken = default)
    {
        return await _unitOfWork.BookingStatusHistories.Query()
            .Include(h => h.Booking)
            .Include(h => h.ChangedByAdminUser)
            .Where(h => h.BookingId == bookingId)
            .OrderByDescending(h => h.ChangedAt)
            .ToListAsync(cancellationToken);
    }

    // ---------------------------------------------------------------
    //  Private helpers
    // ---------------------------------------------------------------

    private static void ValidateStayDates(DateOnly checkInDate, DateOnly checkOutDate)
    {
        if (checkOutDate <= checkInDate)
            throw new BusinessValidationException("Check-out date must be after check-in date");
    }

    private static void ValidateGuestCount(int guestCount)
    {
        if (guestCount <= 0)
            throw new BusinessValidationException("Guest count must be greater than zero");
    }

    private static string ValidateAndNormalizeSource(string source)
    {
        if (string.IsNullOrWhiteSpace(source))
            throw new BusinessValidationException("Booking source is required");

        var normalized = source.Trim().ToLower();
        if (!AllowedSources.Contains(normalized))
            throw new BusinessValidationException(
                $"Invalid booking source '{source}'. Allowed values: {string.Join(", ", AllowedSources)}");

        return normalized;
    }

    private async Task EnsureNoConfirmedOverlap(
        Guid unitId,
        DateOnly checkInDate,
        DateOnly checkOutDate,
        Guid? excludeBookingId,
        CancellationToken cancellationToken)
    {
        var holdingStatuses = BookingStatusTransitions.HoldingStatuses;
        var query = _unitOfWork.Bookings.Query()
            .Where(b => b.UnitId == unitId)
            .Where(b => holdingStatuses.Contains(b.BookingStatus))
            .Where(b => checkInDate < b.CheckOutDate && checkOutDate > b.CheckInDate)
            .Where(b => b.Client.DeletedAt == null && b.Unit.DeletedAt == null);

        if (excludeBookingId.HasValue)
        {
            query = query.Where(b => b.Id != excludeBookingId.Value);
        }

        var hasOverlap = await query.AnyAsync(cancellationToken);
        if (hasOverlap)
            throw new ConflictException(
                $"The requested dates overlap with an existing booking on unit {unitId}");
    }

    private async Task EnsureNoActiveAvailabilityHoldOverlap(
        Guid unitId,
        DateOnly checkInDate,
        DateOnly checkOutDate,
        Guid? excludeBookingId,
        CancellationToken cancellationToken)
    {
        var activeHoldStatuses = BookingStatusTransitions.ActiveAvailabilityHoldStatuses;
        var query = _unitOfWork.Bookings.Query()
            .Where(b => b.UnitId == unitId)
            .Where(b => activeHoldStatuses.Contains(b.BookingStatus))
            .Where(b => checkInDate < b.CheckOutDate && checkOutDate > b.CheckInDate)
            .Where(b => b.Client.DeletedAt == null && b.Unit.DeletedAt == null);

        if (excludeBookingId.HasValue)
        {
            query = query.Where(b => b.Id != excludeBookingId.Value);
        }

        if (await query.AnyAsync(cancellationToken))
        {
            throw new ConflictException(
                "Those dates were just requested or booked. Please pick different dates.");
        }
    }
}
