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

namespace RentalPlatform.Business.Services;

public class DateBlockService : IDateBlockService
{
    private readonly IUnitOfWork _unitOfWork;

    public DateBlockService(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<IReadOnlyList<DateBlock>> GetByUnitIdAsync(Guid unitId, CancellationToken cancellationToken = default)
    {
        return await _unitOfWork.DateBlocks.Query()
            .Where(db => db.UnitId == unitId)
            .Where(db => db.DeletedAt == null)
            .OrderBy(db => db.StartDate)
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<DateBlock>> GetOwnerBlocksByUnitIdAsync(
        Guid ownerId,
        Guid unitId,
        CancellationToken cancellationToken = default)
    {
        var ownsUnit = await _unitOfWork.Units.ExistsAsync(
            u => u.Id == unitId && u.OwnerId == ownerId && u.DeletedAt == null,
            cancellationToken);
        if (!ownsUnit)
            throw new NotFoundException($"Unit {unitId} was not found for this owner.");

        return await GetByUnitIdAsync(unitId, cancellationToken);
    }

    public async Task<DateBlock> CreateAsync(
        Guid unitId, 
        DateOnly startDate, 
        DateOnly endDate, 
        string? reason, 
        string? notes, 
        CancellationToken cancellationToken = default)
    {
        var unitExists = await _unitOfWork.Units.ExistsAsync(u => u.Id == unitId, cancellationToken);
        if (!unitExists)
            throw new NotFoundException($"Unit {unitId} not found");

        if (startDate > endDate)
            throw new BusinessValidationException("Start date cannot be after end date");

        var hasOverlap = await _unitOfWork.DateBlocks.Query()
            .Where(db => db.UnitId == unitId)
            .Where(db => db.DeletedAt == null)
            .AnyAsync(db => startDate <= db.EndDate && endDate >= db.StartDate, cancellationToken);

        if (hasOverlap)
            throw new ConflictException("The specified date range overlaps with an existing date block for this unit.");

        await EnsureNoActiveBookingOverlapAsync(unitId, startDate, endDate, cancellationToken);

        var block = new DateBlock
        {
            UnitId = unitId,
            StartDate = startDate,
            EndDate = endDate,
            Reason = reason?.Trim(),
            Notes = notes?.Trim(),
            Status = DateBlockStatus.Approved,
            RequiresAdminSignoff = false
        };

        await _unitOfWork.DateBlocks.AddAsync(block, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return block;
    }

    public async Task<DateBlock> CreateOwnerBlockAsync(
        Guid ownerId,
        Guid unitId,
        DateOnly startDate,
        DateOnly endDate,
        string? reason,
        string? notes,
        CancellationToken cancellationToken = default)
    {
        var ownsUnit = await _unitOfWork.Units.ExistsAsync(
            u => u.Id == unitId && u.OwnerId == ownerId && u.DeletedAt == null,
            cancellationToken);
        if (!ownsUnit)
            throw new NotFoundException($"Unit {unitId} was not found for this owner.");

        return await CreateAsync(unitId, startDate, endDate, reason, notes, cancellationToken);
    }

    public async Task<DateBlock> UpdateAsync(
        Guid id, 
        DateOnly startDate, 
        DateOnly endDate, 
        string? reason, 
        string? notes, 
        CancellationToken cancellationToken = default)
    {
        var block = await _unitOfWork.DateBlocks.GetByIdAsync(id, cancellationToken);
        if (block == null)
            throw new NotFoundException($"Date block {id} not found");

        if (startDate > endDate)
            throw new BusinessValidationException("Start date cannot be after end date");

        var hasOverlap = await _unitOfWork.DateBlocks.Query()
            .Where(db => db.UnitId == block.UnitId && db.Id != id)
            .Where(db => db.DeletedAt == null)
            .AnyAsync(db => startDate <= db.EndDate && endDate >= db.StartDate, cancellationToken);

        if (hasOverlap)
            throw new ConflictException("The specified date range overlaps with an existing date block for this unit.");

        await EnsureNoActiveBookingOverlapAsync(block.UnitId, startDate, endDate, cancellationToken);

        block.StartDate = startDate;
        block.EndDate = endDate;
        block.Reason = reason?.Trim();
        block.Notes = notes?.Trim();

        _unitOfWork.DateBlocks.Update(block);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return block;
    }

    public async Task DeleteAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var block = await _unitOfWork.DateBlocks.GetByIdAsync(id, cancellationToken);
        if (block == null)
            throw new NotFoundException($"Date block {id} not found");

        _unitOfWork.DateBlocks.Delete(block);
        await _unitOfWork.SaveChangesAsync(cancellationToken);
    }

    private async Task EnsureNoActiveBookingOverlapAsync(
        Guid unitId,
        DateOnly startDate,
        DateOnly endDate,
        CancellationToken cancellationToken)
    {
        var holdingStatuses = BookingStatusTransitions.HoldingStatuses;
        var blockEndExclusive = endDate.AddDays(1);

        var hasBookingOverlap = await _unitOfWork.Bookings.Query()
            .Where(b => b.UnitId == unitId)
            .Where(b => holdingStatuses.Contains(b.BookingStatus))
            .AnyAsync(b => startDate < b.CheckOutDate && blockEndExclusive > b.CheckInDate, cancellationToken);

        if (hasBookingOverlap)
            throw new ConflictException("The specified date range overlaps with an active booking. Contact management before blocking these dates.");
    }
}
