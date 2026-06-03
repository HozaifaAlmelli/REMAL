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

        // Find operational blocks that overlap the requested range
        var blocks = await _unitOfWork.DateBlocks.Query()
            .Where(db => db.UnitId == unitId)
            .Where(db => startDate <= db.EndDate && endDate >= db.StartDate)
            .ToListAsync(cancellationToken);

        var blockedDates = new HashSet<DateOnly>();

        if (blocks.Any())
        {
            // Calculate exactly which dates from the requested range are blocked
            for (var date = startDate; date <= endDate; date = date.AddDays(1))
            {
                if (blocks.Any(db => date >= db.StartDate && date <= db.EndDate))
                {
                    blockedDates.Add(date);
                }
            }
        }

        if (blockedDates.Any())
        {
            return new UnitAvailabilityResult
            {
                UnitId = unitId,
                StartDate = startDate,
                EndDate = endDate,
                IsAvailable = false,
                Reason = "date_blocked",
                BlockedDates = blockedDates.OrderBy(d => d).ToList()
            };
        }

        var holdingStatuses = BookingStatusTransitions.HoldingStatuses;
        var query = _unitOfWork.Bookings.Query()
            .Where(b => b.UnitId == unitId)
            .Where(b => holdingStatuses.Contains(b.BookingStatus))
            .Where(b => startDate < b.CheckOutDate && endDate > b.CheckInDate)
            .Where(b => b.Client.DeletedAt == null && b.Unit.DeletedAt == null);

        if (excludeBookingId.HasValue)
        {
            query = query.Where(b => b.Id != excludeBookingId.Value);
        }

        var overlappingBookings = await query.ToListAsync(cancellationToken);

        if (overlappingBookings.Any())
        {
            for (var date = startDate; date < endDate; date = date.AddDays(1))
            {
                if (overlappingBookings.Any(b => date >= b.CheckInDate && date < b.CheckOutDate))
                {
                    blockedDates.Add(date);
                }
            }

            return new UnitAvailabilityResult
            {
                UnitId = unitId,
                StartDate = startDate,
                EndDate = endDate,
                IsAvailable = false,
                Reason = "date_booked",
                BlockedDates = blockedDates.OrderBy(d => d).ToList()
            };
        }

        return new UnitAvailabilityResult
        {
            UnitId = unitId,
            StartDate = startDate,
            EndDate = endDate,
            IsAvailable = true,
            Reason = null,
            BlockedDates = Array.Empty<DateOnly>()
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
