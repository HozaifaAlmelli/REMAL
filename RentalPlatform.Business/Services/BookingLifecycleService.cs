using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using RentalPlatform.Business.Exceptions;
using RentalPlatform.Business.Interfaces;
using RentalPlatform.Data;
using RentalPlatform.Data.Entities;
using RentalPlatform.Shared.Constants;
using RentalPlatform.Shared.Enums;

namespace RentalPlatform.Business.Services;

public class BookingLifecycleService : IBookingLifecycleService
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IUnitAvailabilityService _availabilityService;
    private readonly IInvoiceService _invoiceService;
    private readonly INotificationService _notificationService;
    private readonly ILogger<BookingLifecycleService> _logger;

    private const string InAppChannel = "in_app";
    private const string BookingConfirmedTemplateCode = "booking_confirmed";
    private const string BookingStatusChangedTemplateCode = "booking_status_changed";

    public BookingLifecycleService(
        IUnitOfWork unitOfWork,
        IUnitAvailabilityService availabilityService,
        IInvoiceService invoiceService,
        INotificationService notificationService,
        ILogger<BookingLifecycleService> logger)
    {
        _unitOfWork = unitOfWork;
        _availabilityService = availabilityService;
        _invoiceService = invoiceService;
        _notificationService = notificationService;
        _logger = logger;
    }

    public async Task<Booking> TransitionAsync(
        Guid bookingId,
        BookingStatus targetStatus,
        Guid changedByAdminUserId,
        string? notes,
        CancellationToken cancellationToken = default)
    {
        var booking = await GetBookingOrThrowAsync(bookingId, cancellationToken);
        await ValidateAdminExistsAsync(changedByAdminUserId, cancellationToken);

        if (!BookingStatusTransitions.IsValidTransition(booking.BookingStatus, targetStatus))
        {
            var allowed = BookingStatusTransitions.GetAllowedTargets(booking.BookingStatus);
            throw new ConflictException(
                $"Cannot transition booking {bookingId} from '{booking.BookingStatus}' to '{targetStatus}'. " +
                $"Allowed transitions: {(allowed.Length > 0 ? string.Join(", ", allowed) : "none (terminal state)")}.");
        }

        var transitionedBooking = targetStatus switch
        {
            BookingStatus.Confirmed => await ConfirmInternalAsync(booking, changedByAdminUserId, notes, cancellationToken),
            BookingStatus.Cancelled => await CancelInternalAsync(booking, changedByAdminUserId, notes, cancellationToken),
            _ => await ApplySimpleTransitionAsync(booking, targetStatus, changedByAdminUserId, notes, cancellationToken),
        };

        await NotifyClientOfStatusChangeAsync(transitionedBooking, targetStatus, cancellationToken);

        return transitionedBooking;
    }

    public async Task<Booking> ConfirmAsync(
        Guid bookingId,
        Guid changedByAdminUserId,
        string? notes,
        CancellationToken cancellationToken = default)
    {
        return await TransitionAsync(bookingId, BookingStatus.Confirmed, changedByAdminUserId, notes, cancellationToken);
    }

    public async Task<Booking> CancelAsync(
        Guid bookingId,
        Guid changedByAdminUserId,
        string? notes,
        CancellationToken cancellationToken = default)
    {
        return await TransitionAsync(bookingId, BookingStatus.Cancelled, changedByAdminUserId, notes, cancellationToken);
    }

    public async Task<Booking> CompleteAsync(
        Guid bookingId,
        Guid changedByAdminUserId,
        string? notes,
        CancellationToken cancellationToken = default)
    {
        return await TransitionAsync(bookingId, BookingStatus.Completed, changedByAdminUserId, notes, cancellationToken);
    }

    public async Task<Booking> CheckInAsync(
        Guid bookingId,
        Guid changedByAdminUserId,
        string? notes,
        CancellationToken cancellationToken = default)
    {
        return await TransitionAsync(bookingId, BookingStatus.CheckIn, changedByAdminUserId, notes, cancellationToken);
    }

    public async Task<Booking> LeftEarlyAsync(
        Guid bookingId,
        Guid changedByAdminUserId,
        string? notes,
        CancellationToken cancellationToken = default)
    {
        return await TransitionAsync(bookingId, BookingStatus.LeftEarly, changedByAdminUserId, notes, cancellationToken);
    }

    // ---------------------------------------------------------------
    //  Internal transition handlers with side effects
    // ---------------------------------------------------------------

    private async Task<Booking> ConfirmInternalAsync(
        Booking booking,
        Guid changedByAdminUserId,
        string? notes,
        CancellationToken cancellationToken)
    {
        var unit = await _unitOfWork.Units.FirstOrDefaultAsync(
            u => u.Id == booking.UnitId && u.IsActive && u.DeletedAt == null, cancellationToken);
        if (unit == null)
            throw new ConflictException(
                $"Cannot confirm booking {booking.Id}: unit {booking.UnitId} is no longer active or has been deleted.");

        var pricingStartDate = booking.CheckInDate;
        var pricingEndDate = booking.CheckOutDate.AddDays(-1);

        var availability = await _availabilityService.CheckOperationalAvailabilityAsync(
            booking.UnitId, pricingStartDate, pricingEndDate, booking.Id, cancellationToken);
        if (!availability.IsAvailable)
            throw new ConflictException(
                $"Cannot confirm booking {booking.Id}: unit {booking.UnitId} is not operationally available: {availability.Reason}");

        await EnsureNoOverlap(booking.UnitId, booking.CheckInDate, booking.CheckOutDate, booking.Id, cancellationToken);

        await using var tx = await _unitOfWork.BeginTransactionAsync(cancellationToken);
        try
        {
            var oldStatus = booking.BookingStatus;
            booking.BookingStatus = BookingStatus.Confirmed;
            booking.UpdatedAt = DateTime.UtcNow;

            _unitOfWork.Bookings.Update(booking);
            await AppendStatusHistoryAsync(booking.Id, oldStatus, BookingStatus.Confirmed, changedByAdminUserId, notes, cancellationToken);
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            // Only create an invoice if one does not already exist for this booking.
            // This handles cases where the booking was previously confirmed and the
            // status was rolled back manually while the invoice remained active.
            var existingInvoice = await _unitOfWork.Invoices.FirstOrDefaultAsync(
                i => i.BookingId == booking.Id && i.InvoiceStatus != "cancelled", cancellationToken);

            if (existingInvoice == null)
            {
                var invoiceNumber = $"INV-{booking.Id.ToString()[..8].ToUpper()}";
                var draftInvoice = await _invoiceService.CreateDraftFromBookingAsync(
                    booking.Id, invoiceNumber, "Auto-generated on confirmation", cancellationToken);
                await _invoiceService.IssueAsync(draftInvoice.Id, cancellationToken);
            }

            await tx.CommitAsync(cancellationToken);
        }
        catch
        {
            await tx.RollbackAsync(cancellationToken);
            throw;
        }

        return booking;
    }

    private async Task<Booking> CancelInternalAsync(
        Booking booking,
        Guid changedByAdminUserId,
        string? notes,
        CancellationToken cancellationToken)
    {
        var oldStatus = booking.BookingStatus;
        booking.BookingStatus = BookingStatus.Cancelled;
        booking.UpdatedAt = DateTime.UtcNow;

        _unitOfWork.Bookings.Update(booking);
        await AppendStatusHistoryAsync(booking.Id, oldStatus, BookingStatus.Cancelled, changedByAdminUserId, notes, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return booking;
    }

    private async Task<Booking> ApplySimpleTransitionAsync(
        Booking booking,
        BookingStatus targetStatus,
        Guid changedByAdminUserId,
        string? notes,
        CancellationToken cancellationToken)
    {
        var oldStatus = booking.BookingStatus;
        booking.BookingStatus = targetStatus;
        booking.UpdatedAt = DateTime.UtcNow;

        _unitOfWork.Bookings.Update(booking);
        await AppendStatusHistoryAsync(booking.Id, oldStatus, targetStatus, changedByAdminUserId, notes, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return booking;
    }

    // ---------------------------------------------------------------
    //  Private helpers
    // ---------------------------------------------------------------

    private async Task<Booking> GetBookingOrThrowAsync(Guid bookingId, CancellationToken cancellationToken)
    {
        var booking = await _unitOfWork.Bookings.GetByIdAsync(bookingId, cancellationToken);
        if (booking == null)
            throw new NotFoundException($"Booking with ID {bookingId} not found");
        return booking;
    }

    private async Task ValidateAdminExistsAsync(Guid adminUserId, CancellationToken cancellationToken)
    {
        var exists = await _unitOfWork.AdminUsers.ExistsAsync(
            a => a.Id == adminUserId && a.IsActive, cancellationToken);
        if (!exists)
            throw new NotFoundException($"Active admin user with ID {adminUserId} not found");
    }

    private async Task AppendStatusHistoryAsync(
        Guid bookingId,
        BookingStatus oldStatus,
        BookingStatus newStatus,
        Guid changedByAdminUserId,
        string? notes,
        CancellationToken cancellationToken)
    {
        var history = new BookingStatusHistory
        {
            Id = Guid.NewGuid(),
            BookingId = bookingId,
            OldStatus = oldStatus.ToString().ToLower(),
            NewStatus = newStatus.ToString().ToLower(),
            ChangedByAdminUserId = changedByAdminUserId,
            Notes = notes?.Trim(),
            ChangedAt = DateTime.UtcNow
        };

        await _unitOfWork.BookingStatusHistories.AddAsync(history, cancellationToken);
    }

    private async Task EnsureNoOverlap(
        Guid unitId,
        DateOnly checkInDate,
        DateOnly checkOutDate,
        Guid excludeBookingId,
        CancellationToken cancellationToken)
    {
        var holdingStatuses = BookingStatusTransitions.HoldingStatuses;
        var hasOverlap = await _unitOfWork.Bookings.Query()
            .Where(b => b.UnitId == unitId)
            .Where(b => holdingStatuses.Contains(b.BookingStatus))
            .Where(b => b.Id != excludeBookingId)
            .Where(b => checkInDate < b.CheckOutDate && checkOutDate > b.CheckInDate)
            .Where(b => b.Client.DeletedAt == null && b.Unit.DeletedAt == null)
            .AnyAsync(cancellationToken);

        if (hasOverlap)
            throw new ConflictException(
                $"Cannot confirm: the requested dates overlap with an existing booking on unit {unitId}");
    }

    private async Task NotifyClientOfStatusChangeAsync(
        Booking booking,
        BookingStatus targetStatus,
        CancellationToken cancellationToken)
    {
        var templateCode = targetStatus == BookingStatus.Confirmed
            ? BookingConfirmedTemplateCode
            : BookingStatusChangedTemplateCode;

        try
        {
            var variables = await BuildNotificationVariablesAsync(booking, targetStatus, cancellationToken);
            await _notificationService.CreateForClientAsync(
                templateCode,
                InAppChannel,
                booking.ClientId,
                variables,
                scheduledAt: null,
                cancellationToken);
        }
        catch (Exception ex) when (ex is NotFoundException or BusinessValidationException or ConflictException)
        {
            _logger.LogWarning(
                ex,
                "Booking {BookingId} transitioned to {BookingStatus}, but client notification template {TemplateCode} could not be used.",
                booking.Id,
                targetStatus,
                templateCode);
        }
    }

    private async Task<IReadOnlyDictionary<string, string>> BuildNotificationVariablesAsync(
        Booking booking,
        BookingStatus targetStatus,
        CancellationToken cancellationToken)
    {
        var unitName = booking.Unit?.Name;
        if (string.IsNullOrWhiteSpace(unitName))
        {
            var unit = await _unitOfWork.Units.GetByIdAsync(booking.UnitId, cancellationToken);
            unitName = unit?.Name;
        }

        var clientName = booking.Client?.Name;
        if (string.IsNullOrWhiteSpace(clientName))
        {
            var client = await _unitOfWork.Clients.GetByIdAsync(booking.ClientId, cancellationToken);
            clientName = client?.Name;
        }

        return new Dictionary<string, string>
        {
            ["booking_id"] = booking.Id.ToString(),
            ["booking_short_id"] = booking.Id.ToString()[..8].ToUpperInvariant(),
            ["booking_status"] = targetStatus.ToString(),
            ["client_name"] = clientName ?? "Client",
            ["unit_name"] = unitName ?? "your unit",
            ["check_in_date"] = booking.CheckInDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            ["check_out_date"] = booking.CheckOutDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            ["final_amount"] = booking.FinalAmount.ToString("N2", CultureInfo.InvariantCulture)
        };
    }
}
