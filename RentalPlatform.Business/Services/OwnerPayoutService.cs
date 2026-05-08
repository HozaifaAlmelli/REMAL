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

public class OwnerPayoutService : IOwnerPayoutService
{
    private readonly IUnitOfWork _unitOfWork;

    public OwnerPayoutService(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<OwnerPayout?> GetByBookingIdAsync(Guid bookingId, CancellationToken cancellationToken = default)
    {
        var bookingExists = await _unitOfWork.Bookings.ExistsAsync(b => b.Id == bookingId, cancellationToken);
        if (!bookingExists)
            throw new NotFoundException($"Booking with ID {bookingId} not found");

        return await _unitOfWork.OwnerPayouts
            .FirstOrDefaultAsync(op => op.BookingId == bookingId, cancellationToken);
    }

    public async Task<IReadOnlyList<OwnerPayout>> GetByOwnerIdAsync(
        Guid ownerId,
        string? payoutStatus = null,
        CancellationToken cancellationToken = default)
    {
        var ownerExists = await _unitOfWork.Owners.ExistsAsync(o => o.Id == ownerId && o.DeletedAt == null, cancellationToken);
        if (!ownerExists)
            throw new NotFoundException($"Owner with ID {ownerId} not found");

        var query = _unitOfWork.OwnerPayouts.Query()
            .Where(op => op.OwnerId == ownerId);

        if (!string.IsNullOrWhiteSpace(payoutStatus))
            query = query.Where(op => op.PayoutStatus == payoutStatus.Trim().ToLower());

        return await query.OrderByDescending(op => op.CreatedAt).ToListAsync(cancellationToken);
    }

    public async Task<OwnerPayout> CreateOrUpdateFromBookingAsync(
        Guid bookingId,
        decimal commissionRate,
        string? notes,
        CancellationToken cancellationToken = default)
    {
        var booking = await _unitOfWork.Bookings.GetByIdAsync(bookingId, cancellationToken);
        if (booking == null)
            throw new NotFoundException($"Booking with ID {bookingId} not found");

        if (booking.BookingStatus != BookingStatus.Confirmed && booking.BookingStatus != BookingStatus.Completed)
            throw new ConflictException(
                $"Cannot create or update payout: booking {bookingId} has status '{booking.BookingStatus}'. Booking must be confirmed or completed.");

        if (commissionRate < 0 || commissionRate > 100)
            throw new BusinessValidationException("Commission rate must be between 0 and 100");

        var gross = booking.FinalAmount;
        var commissionAmount = Math.Round(gross * commissionRate / 100m, 2, MidpointRounding.AwayFromZero);
        var payoutAmount = gross - commissionAmount;

        var existing = await _unitOfWork.OwnerPayouts
            .FirstOrDefaultAsync(op => op.BookingId == bookingId, cancellationToken);

        if (existing != null)
        {
            if (existing.PayoutStatus != "pending")
                throw new ConflictException(
                    $"Payout for booking {bookingId} cannot be updated: current status is '{existing.PayoutStatus}'. Only pending payouts can be recalculated.");

            existing.GrossBookingAmount = gross;
            existing.CommissionRate = commissionRate;
            existing.CommissionAmount = commissionAmount;
            existing.PayoutAmount = payoutAmount;

            if (notes != null)
                existing.Notes = notes.Trim();

            existing.UpdatedAt = DateTime.UtcNow;

            _unitOfWork.OwnerPayouts.Update(existing);
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            return existing;
        }

        var payout = new OwnerPayout
        {
            Id = Guid.NewGuid(),
            BookingId = bookingId,
            OwnerId = booking.OwnerId,
            PayoutStatus = "pending",
            GrossBookingAmount = gross,
            CommissionRate = commissionRate,
            CommissionAmount = commissionAmount,
            PayoutAmount = payoutAmount,
            Notes = notes?.Trim(),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await _unitOfWork.OwnerPayouts.AddAsync(payout, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return payout;
    }

    public async Task<OwnerPayout> SetScheduledAsync(
        Guid payoutId,
        string? notes,
        CancellationToken cancellationToken = default)
    {
        var payout = await GetPayoutOrThrowAsync(payoutId, cancellationToken);

        if (payout.PayoutStatus != "pending")
            throw new ConflictException(
                $"Owner payout {payoutId} cannot be scheduled: current status is '{payout.PayoutStatus}'. Only pending payouts can be scheduled.");

        payout.PayoutStatus = "scheduled";
        payout.ScheduledAt ??= DateTime.UtcNow;

        if (notes != null)
            payout.Notes = notes.Trim();

        payout.UpdatedAt = DateTime.UtcNow;

        _unitOfWork.OwnerPayouts.Update(payout);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return payout;
    }

    public async Task<OwnerPayout> MarkPaidAsync(
        Guid payoutId,
        string? notes,
        CancellationToken cancellationToken = default)
    {
        var payout = await GetPayoutOrThrowAsync(payoutId, cancellationToken);

        if (payout.PayoutStatus != "scheduled")
            throw new ConflictException(
                $"Owner payout {payoutId} cannot be marked as paid: current status is '{payout.PayoutStatus}'. Only scheduled payouts can be marked as paid.");

        payout.PayoutStatus = "paid";
        payout.PaidAt ??= DateTime.UtcNow;

        if (notes != null)
            payout.Notes = notes.Trim();

        payout.UpdatedAt = DateTime.UtcNow;

        _unitOfWork.OwnerPayouts.Update(payout);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return payout;
    }

    public async Task<OwnerPayout> CancelAsync(
        Guid payoutId,
        string? notes,
        CancellationToken cancellationToken = default)
    {
        var payout = await GetPayoutOrThrowAsync(payoutId, cancellationToken);

        if (payout.PayoutStatus == "paid")
            throw new ConflictException($"Owner payout {payoutId} cannot be cancelled: payout is already paid.");

        if (payout.PayoutStatus == "cancelled")
            throw new ConflictException($"Owner payout {payoutId} is already cancelled.");

        payout.PayoutStatus = "cancelled";

        if (notes != null)
            payout.Notes = notes.Trim();

        payout.UpdatedAt = DateTime.UtcNow;

        _unitOfWork.OwnerPayouts.Update(payout);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return payout;
    }

    // ---------------------------------------------------------------
    //  Private helpers
    // ---------------------------------------------------------------

    private async Task<OwnerPayout> GetPayoutOrThrowAsync(Guid id, CancellationToken cancellationToken)
    {
        var payout = await _unitOfWork.OwnerPayouts.GetByIdAsync(id, cancellationToken);
        if (payout == null)
            throw new NotFoundException($"Owner payout with ID {id} not found");
        return payout;
    }
}
