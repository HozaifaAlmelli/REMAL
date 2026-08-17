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
using RentalPlatform.Shared.Models;

namespace RentalPlatform.Business.Services;

public class UnitService : IUnitService
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IRentableCapacityLedgerService _rentableCapacityLedger;
    private static readonly string[] AllowedUnitTypes = { "apartment", "villa", "chalet", "studio" };
    private const int MaxPublicPageSize = 100;

    public UnitService(
        IUnitOfWork unitOfWork,
        IRentableCapacityLedgerService rentableCapacityLedger)
    {
        _unitOfWork = unitOfWork;
        _rentableCapacityLedger = rentableCapacityLedger;
    }

    public async Task<PagedResult<Unit>> GetPublicCatalogAsync(PublicUnitCatalogFilter filter, CancellationToken cancellationToken = default)
    {
        var page = Math.Max(filter.Page, 1);
        var pageSize = Math.Clamp(filter.PageSize, 1, MaxPublicPageSize);

        IQueryable<Unit> query = _unitOfWork.Units.Query()
            .AsNoTracking()
            .Include(u => u.Project)
            .Include(u => u.Owner)
            .Include(u => u.UnitImages)
            .Include(u => u.UnitAmenities)
            .Where(PublicUnitVisibility.Predicate);

        if (filter.ProjectId.HasValue)
        {
            query = query.Where(u => u.ProjectId == filter.ProjectId.Value);
        }

        if (!string.IsNullOrWhiteSpace(filter.UnitType))
        {
            var normalizedType = filter.UnitType.Trim().ToLower();
            if (!AllowedUnitTypes.Contains(normalizedType))
                throw new BusinessValidationException($"Invalid unit type '{filter.UnitType}'. Allowed values: {string.Join(", ", AllowedUnitTypes)}");

            query = query.Where(u => u.UnitType == normalizedType);
        }

        if (filter.MinGuests.HasValue)
        {
            query = query.Where(u => u.MaxGuests >= filter.MinGuests.Value);
        }

        if (filter.MinPrice.HasValue)
        {
            query = query.Where(u => u.BasePricePerNight >= filter.MinPrice.Value);
        }

        if (filter.MaxPrice.HasValue)
        {
            query = query.Where(u => u.BasePricePerNight <= filter.MaxPrice.Value);
        }

        if (!string.IsNullOrWhiteSpace(filter.Search))
        {
            var search = filter.Search.Trim().ToLower();
            query = query.Where(u =>
                u.Name.ToLower().Contains(search) ||
                (u.Address != null && u.Address.ToLower().Contains(search)) ||
                (u.Description != null && u.Description.ToLower().Contains(search)));
        }

        var amenityIds = filter.AmenityIds.Distinct().ToArray();
        foreach (var amenityId in amenityIds)
        {
            query = query.Where(u => u.UnitAmenities.Any(ua => ua.AmenityId == amenityId));
        }

        var total = await query.CountAsync(cancellationToken);
        var items = await ApplyPublicCatalogSort(query, filter.SortBy)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .AsSplitQuery()
            .ToListAsync(cancellationToken);

        return new PagedResult<Unit>(items, total);
    }

    public async Task<IReadOnlyList<Unit>> GetAllAsync(bool includeInactive = true, Guid? ownerId = null, CancellationToken cancellationToken = default)
    {
        IQueryable<Unit> query = _unitOfWork.Units.Query()
            .Include(u => u.Project)
            .Include(u => u.Owner);
        
        if (!includeInactive)
        {
            query = query.Where(u => u.IsActive);
        }

        if (ownerId.HasValue)
        {
            query = query.Where(u => u.OwnerId == ownerId.Value);
        }

        return await query.ToListAsync(cancellationToken);
    }

    public async Task<PagedResult<Unit>> GetInternalCatalogAsync(
        int page = 1,
        int pageSize = 20,
        bool includeInactive = true,
        Guid? ownerId = null,
        Guid? projectId = null,
        string? unitType = null,
        bool? isActive = null,
        string? search = null,
        DateOnly? availableFrom = null,
        DateOnly? availableTo = null,
        Guid? amenityId = null,
        CancellationToken cancellationToken = default)
    {
        page = Math.Max(page, 1);
        pageSize = Math.Clamp(pageSize, 1, MaxPublicPageSize);

        IQueryable<Unit> query = _unitOfWork.Units.Query()
            .AsNoTracking()
            .Include(u => u.Project)
            .Include(u => u.Owner)
            .Include(u => u.UnitImages);

        if (isActive.HasValue)
        {
            query = query.Where(u => u.IsActive == isActive.Value);
        }
        else if (!includeInactive)
        {
            query = query.Where(u => u.IsActive);
        }

        if (ownerId.HasValue)
        {
            query = query.Where(u => u.OwnerId == ownerId.Value);
        }

        if (projectId.HasValue)
        {
            query = query.Where(u => u.ProjectId == projectId.Value);
        }

        if (!string.IsNullOrWhiteSpace(unitType))
        {
            var normalizedType = unitType.Trim().ToLower();
            if (!AllowedUnitTypes.Contains(normalizedType))
                throw new BusinessValidationException($"Invalid unit type '{unitType}'. Allowed values: {string.Join(", ", AllowedUnitTypes)}");

            query = query.Where(u => u.UnitType == normalizedType);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var normalizedSearch = search.Trim().ToLower();
            query = query.Where(u =>
                u.Name.ToLower().Contains(normalizedSearch) ||
                (u.Address != null && u.Address.ToLower().Contains(normalizedSearch)) ||
                (u.Description != null && u.Description.ToLower().Contains(normalizedSearch)) ||
                (u.Project != null && u.Project.Name.ToLower().Contains(normalizedSearch)) ||
                (u.Owner != null && u.Owner.Name.ToLower().Contains(normalizedSearch)) ||
                u.UnitAmenities.Any(ua => ua.Amenity.Name.ToLower().Contains(normalizedSearch)));
        }

        if (amenityId.HasValue)
        {
            query = query.Where(u =>
                u.UnitAmenities.Any(ua => ua.AmenityId == amenityId.Value));
        }

        // Availability filter: exclude units with an overlapping holding booking or
        // maintenance block. Predicate semantics mirror UnitAvailabilityService
        // (bookings = half-open [checkIn, checkOut); blocks = inclusive [start, end]).
        if (availableFrom.HasValue && availableTo.HasValue)
        {
            if (availableFrom.Value >= availableTo.Value)
                throw new BusinessValidationException("availableTo must be after availableFrom.");

            var holding = BookingStatusTransitions.HoldingStatuses;

            var bookedUnitIds = await _unitOfWork.Bookings.Query()
                .Where(b => holding.Contains(b.BookingStatus)
                         && availableFrom.Value < b.CheckOutDate
                         && availableTo.Value > b.CheckInDate)
                .Select(b => b.UnitId)
                .Distinct()
                .ToListAsync(cancellationToken);

            var blockedUnitIds = await _unitOfWork.DateBlocks.Query()
                .Where(db => availableFrom.Value <= db.EndDate
                          && availableTo.Value >= db.StartDate)
                .Select(db => db.UnitId)
                .Distinct()
                .ToListAsync(cancellationToken);

            var unavailable = bookedUnitIds.Concat(blockedUnitIds).Distinct().ToList();
            if (unavailable.Count > 0)
                query = query.Where(u => !unavailable.Contains(u.Id));
        }

        var total = await query.CountAsync(cancellationToken);
        var items = await query
            .OrderByDescending(u => u.CreatedAt)
            .ThenBy(u => u.Id)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .AsSplitQuery()
            .ToListAsync(cancellationToken);

        return new PagedResult<Unit>(items, total);
    }

    private static IOrderedQueryable<Unit> ApplyPublicCatalogSort(IQueryable<Unit> query, string? sortBy)
    {
        return NormalizePublicSort(sortBy) switch
        {
            "price_asc" => query
                .OrderBy(u => u.BasePricePerNight)
                .ThenByDescending(u => u.CreatedAt)
                .ThenBy(u => u.Id),
            "price_desc" => query
                .OrderByDescending(u => u.BasePricePerNight)
                .ThenByDescending(u => u.CreatedAt)
                .ThenBy(u => u.Id),
            _ => query
                .OrderByDescending(u => u.CreatedAt)
                .ThenBy(u => u.Id),
        };
    }

    private static string NormalizePublicSort(string? sortBy)
    {
        var key = sortBy?.Trim().ToLower().Replace('-', '_');

        return key switch
        {
            "price_asc" or "cheapest" => "price_asc",
            "price_desc" or "expensive" or "highest_price" => "price_desc",
            "newest" or "newest_arrivals" or "latest" => "newest",
            _ => "newest",
        };
    }

    public async Task<Unit?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        return await _unitOfWork.Units.Query()
            .Include(u => u.Project)
            .Include(u => u.Owner)
            .Include(u => u.UnitImages)
            .FirstOrDefaultAsync(u => u.Id == id, cancellationToken);
    }

    public async Task<Unit> CreateAsync(
        Guid ownerId, 
        Guid projectId,
        string name, 
        string? description, 
        string? address, 
        string unitType, 
        int bedrooms, 
        int bathrooms, 
        int maxGuests, 
        decimal basePricePerNight, 
        bool isActive = true,
        bool isVisibleInPortfolio = true,
        CancellationToken cancellationToken = default)
    {
        ValidateUnitData(name, unitType, bedrooms, bathrooms, maxGuests, basePricePerNight);

        var unit = new Unit
        {
            Id = Guid.NewGuid(),
            OwnerId = ownerId,
            ProjectId = projectId,
            Name = name.Trim(),
            Description = description?.Trim(),
            Address = address?.Trim(),
            UnitType = unitType.Trim().ToLower(),
            Bedrooms = bedrooms,
            Bathrooms = bathrooms,
            MaxGuests = maxGuests,
            BasePricePerNight = basePricePerNight,
            IsActive = isActive,
            IsVisibleInPortfolio = isVisibleInPortfolio
        };

        IDbContextTransaction? ownedTransaction = null;
        try
        {
            if (!_unitOfWork.HasActiveTransaction)
                ownedTransaction = await _unitOfWork.BeginTransactionAsync(cancellationToken);

            await _rentableCapacityLedger.EnterUnitMutationBoundaryAsync(unit.Id, cancellationToken);

            var ownerExists = await _unitOfWork.Owners.ExistsAsync(o => o.Id == ownerId, cancellationToken);
            if (!ownerExists)
                throw new NotFoundException($"Owner with ID {ownerId} not found");

            var projectExists = await _unitOfWork.Projects.ExistsAsync(a => a.Id == projectId, cancellationToken);
            if (!projectExists)
                throw new NotFoundException($"Project with ID {projectId} not found");

            await _unitOfWork.Units.AddAsync(unit, cancellationToken);
            await _rentableCapacityLedger.RebuildCurrentAndFutureAsync(
                unit,
                unitIsDeleted: false,
                isNewUnit: true,
                new RentabilitySourceChange("unit_create", unit.Id),
                cancellationToken);
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            if (ownedTransaction is not null)
                await ownedTransaction.CommitAsync(cancellationToken);
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

        return unit;
    }

    public async Task<Unit> UpdateAsync(
        Guid id, 
        Guid ownerId, 
        Guid projectId,
        string name, 
        string? description, 
        string? address, 
        string unitType, 
        int bedrooms, 
        int bathrooms, 
        int maxGuests, 
        decimal basePricePerNight, 
        bool isActive,
        bool isVisibleInPortfolio,
        CancellationToken cancellationToken = default)
    {
        ValidateUnitData(name, unitType, bedrooms, bathrooms, maxGuests, basePricePerNight);

        Unit unit;
        IDbContextTransaction? ownedTransaction = null;
        try
        {
            if (!_unitOfWork.HasActiveTransaction)
                ownedTransaction = await _unitOfWork.BeginTransactionAsync(cancellationToken);

            await _rentableCapacityLedger.EnterUnitMutationBoundaryAsync(id, cancellationToken);
            unit = await _unitOfWork.Units.GetByIdAsync(id, cancellationToken)
                ?? throw new NotFoundException($"Unit with ID {id} not found");
            await _unitOfWork.ReloadAsync(unit, cancellationToken);

            if (unit.OwnerId != ownerId &&
                !await _unitOfWork.Owners.ExistsAsync(o => o.Id == ownerId, cancellationToken))
                throw new NotFoundException($"Owner with ID {ownerId} not found");

            if (unit.ProjectId != projectId &&
                !await _unitOfWork.Projects.ExistsAsync(a => a.Id == projectId, cancellationToken))
                throw new NotFoundException($"Project with ID {projectId} not found");

            unit.OwnerId = ownerId;
            unit.ProjectId = projectId;
            unit.Name = name.Trim();
            unit.Description = description?.Trim();
            unit.Address = address?.Trim();
            unit.UnitType = unitType.Trim().ToLower();
            unit.Bedrooms = bedrooms;
            unit.Bathrooms = bathrooms;
            unit.MaxGuests = maxGuests;
            unit.BasePricePerNight = basePricePerNight;
            unit.IsActive = isActive;
            unit.IsVisibleInPortfolio = isVisibleInPortfolio;

            _unitOfWork.Units.Update(unit);
            await _rentableCapacityLedger.RebuildCurrentAndFutureAsync(
                unit,
                unitIsDeleted: false,
                isNewUnit: false,
                new RentabilitySourceChange("unit_update", unit.Id),
                cancellationToken);
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            if (ownedTransaction is not null)
                await ownedTransaction.CommitAsync(cancellationToken);
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

        return unit;
    }

    public async Task SoftDeleteAsync(Guid id, CancellationToken cancellationToken = default)
    {
        IDbContextTransaction? ownedTransaction = null;
        try
        {
            if (!_unitOfWork.HasActiveTransaction)
                ownedTransaction = await _unitOfWork.BeginTransactionAsync(cancellationToken);

            await _rentableCapacityLedger.EnterUnitMutationBoundaryAsync(id, cancellationToken);
            var unit = await _unitOfWork.Units.GetByIdAsync(id, cancellationToken)
                ?? throw new NotFoundException($"Unit with ID {id} not found");
            await _unitOfWork.ReloadAsync(unit, cancellationToken);

            _unitOfWork.Units.Delete(unit);
            await _rentableCapacityLedger.RebuildCurrentAndFutureAsync(
                unit,
                unitIsDeleted: true,
                isNewUnit: false,
                new RentabilitySourceChange("unit_delete", unit.Id),
                cancellationToken);
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            if (ownedTransaction is not null)
                await ownedTransaction.CommitAsync(cancellationToken);
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

    public async Task SetActiveAsync(Guid id, bool isActive, CancellationToken cancellationToken = default)
    {
        IDbContextTransaction? ownedTransaction = null;
        try
        {
            if (!_unitOfWork.HasActiveTransaction)
                ownedTransaction = await _unitOfWork.BeginTransactionAsync(cancellationToken);

            await _rentableCapacityLedger.EnterUnitMutationBoundaryAsync(id, cancellationToken);
            var unit = await _unitOfWork.Units.GetByIdAsync(id, cancellationToken)
                ?? throw new NotFoundException($"Unit with ID {id} not found");
            await _unitOfWork.ReloadAsync(unit, cancellationToken);

            unit.IsActive = isActive;
            _unitOfWork.Units.Update(unit);
            await _rentableCapacityLedger.RebuildCurrentAndFutureAsync(
                unit,
                unitIsDeleted: false,
                isNewUnit: false,
                new RentabilitySourceChange("unit_status", unit.Id),
                cancellationToken);
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            if (ownedTransaction is not null)
                await ownedTransaction.CommitAsync(cancellationToken);
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

    public async Task SetPortfolioVisibilityAsync(Guid id, bool isVisibleInPortfolio, CancellationToken cancellationToken = default)
    {
        var unit = await _unitOfWork.Units.GetByIdAsync(id, cancellationToken);
        if (unit == null)
            throw new NotFoundException($"Unit with ID {id} not found");

        // Portfolio visibility is not a physical-capacity input. Keep this targeted
        // tracked-property update outside the rentability ledger boundary.
        unit.IsVisibleInPortfolio = isVisibleInPortfolio;
        await _unitOfWork.SaveChangesAsync(cancellationToken);
    }

    private void ValidateUnitData(string name, string unitType, int bedrooms, int bathrooms, int maxGuests, decimal basePricePerNight)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new BusinessValidationException("Unit name is required");

        if (string.IsNullOrWhiteSpace(unitType))
            throw new BusinessValidationException("Unit type is required");

        var normalizedType = unitType.Trim().ToLower();
        if (!AllowedUnitTypes.Contains(normalizedType))
            throw new BusinessValidationException($"Invalid unit type '{unitType}'. Allowed values: {string.Join(", ", AllowedUnitTypes)}");

        if (bedrooms < 0)
            throw new BusinessValidationException("Bedrooms cannot be negative");

        if (bathrooms < 0)
            throw new BusinessValidationException("Bathrooms cannot be negative");

        if (maxGuests <= 0)
            throw new BusinessValidationException("MaxGuests must be greater than zero");

        if (basePricePerNight < 0)
            throw new BusinessValidationException("BasePricePerNight cannot be negative");
    }
}
