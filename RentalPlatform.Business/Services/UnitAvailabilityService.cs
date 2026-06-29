using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using RentalPlatform.Business.Exceptions;
using RentalPlatform.Business.Interfaces;
using RentalPlatform.Business.Models;
using RentalPlatform.Data;
using RentalPlatform.Shared.Constants;

namespace RentalPlatform.Business.Services;

public class UnitAvailabilityService : IUnitAvailabilityService
{
    private readonly IUnitOfWork _unitOfWork;

    public UnitAvailabilityService(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<UnitAvailabilityResult> CheckOperationalAvailabilityAsync(Guid unitId, DateOnly startDate, DateOnly endDate, Guid? excludeBookingId = null, CancellationToken cancellationToken = default)
    {
        if (startDate > endDate)
            throw new BusinessValidationException("Start date cannot be after end date");

        var unit = await _unitOfWork.Units.GetByIdAsync(unitId, cancellationToken);
        if (unit == null)
            throw new NotFoundException($"Unit {unitId} not found");

        if (!unit.IsActive)
            throw new BusinessValidationException($"Unit {unitId} is inactive and cannot be checked for availability");

        // Find operational blocks that overlap the requested range.
        // Callers treat the range as [startDate, endDate] inclusive (every caller passes
        // endDate as the last night, e.g. checkOut.AddDays(-1)), so the overlap is inclusive.
        var blocks = await _unitOfWork.DateBlocks.Query()
            .Where(db => db.UnitId == unitId)
            .Where(db => db.DeletedAt == null)
            .Where(db => startDate <= db.EndDate && endDate >= db.StartDate)
            .ToListAsync(cancellationToken);

        // Find firm holding bookings that overlap the requested range. endDate is the last
        // night (inclusive), so a booking that checks in on endDate still conflicts ->
        // endDate >= CheckInDate. CheckOutDate stays exclusive because the check-out day is free.
        var holdingStatuses = BookingStatusTransitions.HoldingStatuses;
        var bookingQuery = _unitOfWork.Bookings.Query()
            .Where(b => b.UnitId == unitId)
            .Where(b => holdingStatuses.Contains(b.BookingStatus))
            .Where(b => startDate < b.CheckOutDate && endDate >= b.CheckInDate)
            .Where(b => b.Client.DeletedAt == null && b.Unit.DeletedAt == null);

        if (excludeBookingId.HasValue)
        {
            bookingQuery = bookingQuery.Where(b => b.Id != excludeBookingId.Value);
        }

        var overlappingBookings = await bookingQuery.ToListAsync(cancellationToken);

        var softHoldStatuses = BookingStatusTransitions.SoftHoldStatuses;
        var softHoldQuery = _unitOfWork.Bookings.Query()
            .Where(b => b.UnitId == unitId)
            .Where(b => softHoldStatuses.Contains(b.BookingStatus))
            .Where(b => startDate < b.CheckOutDate && endDate >= b.CheckInDate)
            .Where(b => b.Client.DeletedAt == null && b.Unit.DeletedAt == null);

        if (excludeBookingId.HasValue)
        {
            softHoldQuery = softHoldQuery.Where(b => b.Id != excludeBookingId.Value);
        }

        var overlappingSoftHolds = await softHoldQuery.ToListAsync(cancellationToken);

        // Mark every requested day that is occupied by EITHER a date block OR a booking.
        // A date block found in the same range must not hide an overlapping booking, so both
        // sources are unioned here rather than returned independently.
        var blockedDates = new HashSet<DateOnly>();
        var heldDates = new HashSet<DateOnly>();
        for (var date = startDate; date <= endDate; date = date.AddDays(1))
        {
            var blockedByDateBlock = blocks.Any(db => date >= db.StartDate && date <= db.EndDate);
            var blockedByBooking = overlappingBookings.Any(b => date >= b.CheckInDate && date < b.CheckOutDate);
            var heldBySoftBooking = overlappingSoftHolds.Any(b => date >= b.CheckInDate && date < b.CheckOutDate);

            if (blockedByDateBlock || blockedByBooking)
            {
                blockedDates.Add(date);
            }

            if (heldBySoftBooking)
            {
                heldDates.Add(date);
            }
        }

        if (blockedDates.Count > 0)
        {
            return new UnitAvailabilityResult
            {
                UnitId = unitId,
                StartDate = startDate,
                EndDate = endDate,
                IsAvailable = false,
                // Preserve prior reason precedence: a date block, when present, wins over a booking.
                Reason = blocks.Count > 0 ? "date_blocked" : "date_booked",
                BlockedDates = blockedDates.OrderBy(d => d).ToList(),
                HeldDates = heldDates.OrderBy(d => d).ToList()
            };
        }

        return new UnitAvailabilityResult
        {
            UnitId = unitId,
            StartDate = startDate,
            EndDate = endDate,
            IsAvailable = true,
            Reason = null,
            BlockedDates = Array.Empty<DateOnly>(),
            HeldDates = heldDates.OrderBy(d => d).ToList()
        };
    }

    public async Task<UnitPricingResult> CalculatePricingAsync(Guid unitId, DateOnly startDate, DateOnly endDate, CancellationToken cancellationToken = default)
    {
        if (startDate > endDate)
            throw new BusinessValidationException("Start date cannot be after end date");

        var unit = await _unitOfWork.Units.GetByIdAsync(unitId, cancellationToken);
        if (unit == null)
            throw new NotFoundException($"Unit {unitId} not found");

        // Note: We use the inclusive sequence definition defined for this service
        
        var seasonalPrices = await _unitOfWork.SeasonalPricings.Query()
            .Where(sp => sp.UnitId == unitId)
            .Where(sp => startDate <= sp.EndDate && endDate >= sp.StartDate)
            .ToListAsync(cancellationToken);

        var nights = new List<NightlyPriceBreakdownItem>();
        decimal totalPrice = 0;

        for (var date = startDate; date <= endDate; date = date.AddDays(1))
        {
            var seasonal = seasonalPrices.FirstOrDefault(sp => date >= sp.StartDate && date <= sp.EndDate);
            
            var appliedPrice = seasonal != null ? seasonal.PricePerNight : unit.BasePricePerNight;
            var priceSource = seasonal != null ? "seasonal" : "base";

            nights.Add(new NightlyPriceBreakdownItem
            {
                Date = date,
                PricePerNight = appliedPrice,
                PriceSource = priceSource
            });

            totalPrice += appliedPrice;
        }

        return new UnitPricingResult
        {
            UnitId = unitId,
            StartDate = startDate,
            EndDate = endDate,
            TotalPrice = totalPrice,
            Nights = nights
        };
    }
}
