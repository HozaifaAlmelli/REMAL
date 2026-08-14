using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using RentalPlatform.Business.Exceptions;
using RentalPlatform.Business.Interfaces;
using RentalPlatform.Business.Models;
using RentalPlatform.Data;
using RentalPlatform.Data.Entities;
using RentalPlatform.Shared.Constants;
using RentalPlatform.Shared.Enums;

namespace RentalPlatform.Business.Services;

public class DateBlockService : IDateBlockService
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IRentableCapacityLedgerService _rentableCapacityLedger;

    public DateBlockService(
        IUnitOfWork unitOfWork,
        IRentableCapacityLedgerService rentableCapacityLedger)
    {
        _unitOfWork = unitOfWork;
        _rentableCapacityLedger = rentableCapacityLedger;
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
        return await CreateCoreAsync(
            expectedOwnerId: null,
            unitId,
            startDate,
            endDate,
            reason,
            notes,
            cancellationToken);
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
        return await CreateCoreAsync(
            ownerId,
            unitId,
            startDate,
            endDate,
            reason,
            notes,
            cancellationToken);
    }

    public async Task<DateBlock> UpdateAsync(
        Guid id, 
        DateOnly startDate, 
        DateOnly endDate, 
        string? reason, 
        string? notes, 
        CancellationToken cancellationToken = default)
    {
        if (startDate > endDate)
            throw new BusinessValidationException("Start date cannot be after end date");

        var unitId = await FindBlockUnitIdAsync(id, cancellationToken);
        return await ExecuteUnitMutationAsync(unitId, async () =>
        {
            var block = await _unitOfWork.DateBlocks.GetByIdAsync(id, cancellationToken)
                ?? throw new NotFoundException($"Date block {id} not found");
            await _unitOfWork.ReloadAsync(block, cancellationToken);

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

            var unit = await GetAuthoritativeUnitAsync(block.UnitId, cancellationToken);
            await _rentableCapacityLedger.RebuildCurrentAndFutureAsync(
                unit,
                unitIsDeleted: false,
                isNewUnit: false,
                new RentabilitySourceChange(
                    "date_block_update",
                    block.Id,
                    DateBlockChange: ToUpsert(block)),
                cancellationToken);
            return block;
        }, cancellationToken);
    }

    public async Task DeleteAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var unitId = await FindBlockUnitIdAsync(id, cancellationToken);
        await ExecuteUnitMutationAsync(unitId, async () =>
        {
            var block = await _unitOfWork.DateBlocks.GetByIdAsync(id, cancellationToken)
                ?? throw new NotFoundException($"Date block {id} not found");
            await _unitOfWork.ReloadAsync(block, cancellationToken);

            _unitOfWork.DateBlocks.Delete(block);
            var unit = await GetAuthoritativeUnitAsync(block.UnitId, cancellationToken);
            await _rentableCapacityLedger.RebuildCurrentAndFutureAsync(
                unit,
                unitIsDeleted: false,
                isNewUnit: false,
                new RentabilitySourceChange(
                    "date_block_delete",
                    block.Id,
                    DateBlockChange: ToRemove(block)),
                cancellationToken);
            return true;
        }, cancellationToken);
    }

    private async Task<DateBlock> CreateCoreAsync(
        Guid? expectedOwnerId,
        Guid unitId,
        DateOnly startDate,
        DateOnly endDate,
        string? reason,
        string? notes,
        CancellationToken cancellationToken)
    {
        if (startDate > endDate)
            throw new BusinessValidationException("Start date cannot be after end date");

        return await ExecuteUnitMutationAsync(unitId, async () =>
        {
            var unit = await GetAuthoritativeUnitAsync(unitId, cancellationToken);
            if (expectedOwnerId.HasValue && unit.OwnerId != expectedOwnerId.Value)
                throw new NotFoundException($"Unit {unitId} was not found for this owner.");

            var hasOverlap = await _unitOfWork.DateBlocks.Query()
                .Where(db => db.UnitId == unitId)
                .Where(db => db.DeletedAt == null)
                .AnyAsync(db => startDate <= db.EndDate && endDate >= db.StartDate, cancellationToken);
            if (hasOverlap)
                throw new ConflictException("The specified date range overlaps with an existing date block for this unit.");

            await EnsureNoActiveBookingOverlapAsync(unitId, startDate, endDate, cancellationToken);

            var block = new DateBlock
            {
                Id = Guid.NewGuid(),
                UnitId = unitId,
                StartDate = startDate,
                EndDate = endDate,
                Reason = reason?.Trim(),
                Notes = notes?.Trim(),
                Status = DateBlockStatus.Approved,
                RequiresAdminSignoff = false
            };

            await _unitOfWork.DateBlocks.AddAsync(block, cancellationToken);
            await _rentableCapacityLedger.RebuildCurrentAndFutureAsync(
                unit,
                unitIsDeleted: false,
                isNewUnit: false,
                new RentabilitySourceChange(
                    "date_block_create",
                    block.Id,
                    DateBlockChange: ToUpsert(block)),
                cancellationToken);
            return block;
        }, cancellationToken);
    }

    private async Task<T> ExecuteUnitMutationAsync<T>(
        Guid unitId,
        Func<Task<T>> mutation,
        CancellationToken cancellationToken)
    {
        IDbContextTransaction? ownedTransaction = null;
        try
        {
            if (!_unitOfWork.HasActiveTransaction)
                ownedTransaction = await _unitOfWork.BeginTransactionAsync(cancellationToken);

            await _rentableCapacityLedger.EnterUnitMutationBoundaryAsync(unitId, cancellationToken);
            var result = await mutation();
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            if (ownedTransaction is not null)
                await ownedTransaction.CommitAsync(cancellationToken);
            return result;
        }
        catch
        {
            if (ownedTransaction is not null)
                await ownedTransaction.RollbackAsync(cancellationToken);
            throw;
        }
        finally
        {
            if (ownedTransaction is not null)
                await ownedTransaction.DisposeAsync();
        }
    }

    private async Task<Guid> FindBlockUnitIdAsync(Guid blockId, CancellationToken cancellationToken)
    {
        var unitId = await _unitOfWork.DateBlocks.Query()
            .AsNoTracking()
            .Where(block => block.Id == blockId)
            .Select(block => (Guid?)block.UnitId)
            .SingleOrDefaultAsync(cancellationToken);
        return unitId ?? throw new NotFoundException($"Date block {blockId} not found");
    }

    private async Task<Unit> GetAuthoritativeUnitAsync(
        Guid unitId,
        CancellationToken cancellationToken) =>
        await _unitOfWork.Units.Query()
            .FirstOrDefaultAsync(unit => unit.Id == unitId && unit.DeletedAt == null, cancellationToken)
        ?? throw new NotFoundException($"Unit {unitId} not found");

    private static DateBlockProjectionChange ToUpsert(DateBlock block) => new(
        block.Id,
        DateBlockProjectionChangeKind.Upsert,
        block.StartDate,
        block.EndDate,
        block.Status,
        block.DeletedAt is not null);

    private static DateBlockProjectionChange ToRemove(DateBlock block) => new(
        block.Id,
        DateBlockProjectionChangeKind.Remove,
        block.StartDate,
        block.EndDate,
        block.Status,
        IsDeleted: true);

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
