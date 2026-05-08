using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using RentalPlatform.Business.Exceptions;
using RentalPlatform.Business.Interfaces;
using RentalPlatform.Business.Models;
using RentalPlatform.Data;
using RentalPlatform.Shared.Enums;

namespace RentalPlatform.Business.Services;

public class OwnerPortalDashboardService : IOwnerPortalDashboardService
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IOwnerPortalUnitService _unitService;
    private readonly IOwnerPortalBookingService _bookingService;
    private readonly IOwnerPortalFinanceService _financeService;

    public OwnerPortalDashboardService(
        IUnitOfWork unitOfWork,
        IOwnerPortalUnitService unitService,
        IOwnerPortalBookingService bookingService,
        IOwnerPortalFinanceService financeService)
    {
        _unitOfWork     = unitOfWork;
        _unitService    = unitService;
        _bookingService = bookingService;
        _financeService = financeService;
    }

    public async Task<OwnerPortalDashboardSummaryResult> GetSummaryAsync(
        Guid ownerId,
        CancellationToken cancellationToken = default)
    {
        // Validate owner before fanning out to component services
        var owner = await _unitOfWork.Owners.GetByIdAsync(ownerId, cancellationToken);

        if (owner is null)
            throw new NotFoundException($"Owner {ownerId} not found.");

        if (owner.Status != "active")
            throw new BusinessValidationException($"Owner {ownerId} is not active.");

        // Sequential awaits — EF Core DbContext is not thread-safe; Task.WhenAll
        // with a shared context causes InvalidOperationException at runtime.
        var units          = await _unitService.GetAllByOwnerAsync(ownerId, cancellationToken: cancellationToken);
        var bookings       = await _bookingService.GetAllByOwnerAsync(ownerId, cancellationToken: cancellationToken);
        var financeSummary = await _financeService.GetSummaryByOwnerAsync(ownerId, cancellationToken);

        return new OwnerPortalDashboardSummaryResult
        {
            OwnerId                  = ownerId,
            TotalUnits               = units.Count,
            ActiveUnits              = units.Count(u => u.IsActive),
            TotalBookings            = bookings.Count,
            ConfirmedBookings        = bookings.Count(b => string.Equals(b.BookingStatus, nameof(BookingStatus.Confirmed), StringComparison.OrdinalIgnoreCase)),
            CompletedBookings        = bookings.Count(b => string.Equals(b.BookingStatus, nameof(BookingStatus.Completed), StringComparison.OrdinalIgnoreCase)),
            TotalPaidAmount          = financeSummary.TotalPaidAmount,
            TotalPendingPayoutAmount = financeSummary.TotalPendingPayoutAmount,
            TotalPaidPayoutAmount    = financeSummary.TotalPaidPayoutAmount,
        };
    }
}
