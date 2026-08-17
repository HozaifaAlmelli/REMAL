using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using RentalPlatform.Business.Exceptions;
using RentalPlatform.Business.Interfaces;
using RentalPlatform.Data;
using RentalPlatform.Data.ReadModels;

namespace RentalPlatform.Business.Services;

public class OwnerPortalBookingService : IOwnerPortalBookingService
{
    private readonly IUnitOfWork _unitOfWork;

    public OwnerPortalBookingService(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<IReadOnlyList<OwnerPortalBookingOverview>> GetAllByOwnerAsync(
        Guid ownerId,
        string? bookingStatus = null,
        DateOnly? checkInFrom = null,
        DateOnly? checkInTo = null,
        CancellationToken cancellationToken = default)
    {
        await ValidateOwnerAsync(ownerId, cancellationToken);

        if (checkInFrom.HasValue && checkInTo.HasValue && checkInFrom.Value > checkInTo.Value)
            throw new BusinessValidationException("checkInFrom must not be later than checkInTo.");

        var query = _unitOfWork.OwnerPortalBookingsOverview
            .Where(b => b.OwnerId == ownerId);

        if (!string.IsNullOrWhiteSpace(bookingStatus))
            query = query.Where(b => b.BookingStatus == bookingStatus);

        if (checkInFrom.HasValue)
            query = query.Where(b => b.CheckInDate >= checkInFrom.Value);

        if (checkInTo.HasValue)
            query = query.Where(b => b.CheckInDate <= checkInTo.Value);

        var bookings = await query
            .OrderByDescending(b => b.CreatedAt)
            .ToListAsync(cancellationToken);

        var bookingIds = bookings.Select(booking => booking.BookingId).ToArray();
        var historicalIds = await _unitOfWork.Bookings.Query()
            .Where(booking => booking.OwnerId == ownerId && bookingIds.Contains(booking.Id))
            .Where(booking => booking.IsHistorical)
            .Select(booking => booking.Id)
            .ToListAsync(cancellationToken);
        var historicalIdSet = historicalIds.ToHashSet();
        foreach (var booking in bookings)
            booking.IsHistorical = historicalIdSet.Contains(booking.BookingId);

        return bookings;
    }

    public async Task<OwnerPortalBookingOverview?> GetByOwnerAndBookingIdAsync(
        Guid ownerId,
        Guid bookingId,
        CancellationToken cancellationToken = default)
    {
        await ValidateOwnerAsync(ownerId, cancellationToken);

        var booking = await _unitOfWork.OwnerPortalBookingsOverview
            .Where(b => b.OwnerId == ownerId && b.BookingId == bookingId)
            .FirstOrDefaultAsync(cancellationToken);

        if (booking is null)
            throw new NotFoundException($"Booking {bookingId} not found in owner portal context.");

        booking.IsHistorical = await _unitOfWork.Bookings.Query()
            .Where(item => item.OwnerId == ownerId && item.Id == bookingId)
            .Select(item => item.IsHistorical)
            .SingleAsync(cancellationToken);

        return booking;
    }

    // -----------------------------------------------------------------------
    // Private helpers
    // -----------------------------------------------------------------------

    private async Task ValidateOwnerAsync(Guid ownerId, CancellationToken cancellationToken)
    {
        var owner = await _unitOfWork.Owners.GetByIdAsync(ownerId, cancellationToken);

        if (owner is null)
            throw new NotFoundException($"Owner {ownerId} not found.");

        if (owner.Status != "active")
            throw new BusinessValidationException($"Owner {ownerId} is not active.");
    }
}
