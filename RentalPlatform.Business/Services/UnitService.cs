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
using RentalPlatform.Data.Entities;
using RentalPlatform.Shared.Constants;
using RentalPlatform.Shared.Models;

namespace RentalPlatform.Business.Services;

public class UnitService : IUnitService
{
    private readonly IUnitOfWork _unitOfWork;
    private static readonly string[] AllowedUnitTypes = { "apartment", "villa", "chalet", "studio" };
    private const int MaxPublicPageSize = 100;

    public UnitService(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<PagedResult<Unit>> GetPublicCatalogAsync(PublicUnitCatalogFilter filter, CancellationToken cancellationToken = default)
    {
        var page = Math.Max(filter.Page, 1);
        var pageSize = Math.Clamp(filter.PageSize, 1, MaxPublicPageSize);

        IQueryable<Unit> query = _unitOfWork.Units.Query()
            .AsNoTracking()
            .Include(u => u.UnitImages)
            .Include(u => u.UnitAmenities)
            .Where(u => u.IsActive);

        if (filter.AreaId.HasValue)
        {
            query = query.Where(u => u.AreaId == filter.AreaId.Value);
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
            .Include(u => u.Area)
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
        Guid? areaId = null,
        string? unitType = null,
        bool? isActive = null,
        string? search = null,
        DateOnly? availableFrom = null,
        DateOnly? availableTo = null,
        CancellationToken cancellationToken = default)
    {
        page = Math.Max(page, 1);
        pageSize = Math.Clamp(pageSize, 1, MaxPublicPageSize);

        IQueryable<Unit> query = _unitOfWork.Units.Query()
            .AsNoTracking()
            .Include(u => u.Area)
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

        if (areaId.HasValue)
        {
            query = query.Where(u => u.AreaId == areaId.Value);
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
                (u.Area != null && u.Area.Name.ToLower().Contains(normalizedSearch)) ||
                (u.Owner != null && u.Owner.Name.ToLower().Contains(normalizedSearch)));
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
            .Include(u => u.Area)
            .Include(u => u.Owner)
            .Include(u => u.UnitImages)
            .FirstOrDefaultAsync(u => u.Id == id, cancellationToken);
    }

    public async Task<Unit> CreateAsync(
        Guid ownerId, 
        Guid areaId, 
        string name, 
        string? description, 
        string? address, 
        string unitType, 
        int bedrooms, 
        int bathrooms, 
        int maxGuests, 
        decimal basePricePerNight, 
        bool isActive = true, 
        CancellationToken cancellationToken = default)
    {
        ValidateUnitData(name, unitType, bedrooms, bathrooms, maxGuests, basePricePerNight);

        var ownerExists = await _unitOfWork.Owners.ExistsAsync(o => o.Id == ownerId, cancellationToken);
        if (!ownerExists)
            throw new NotFoundException($"Owner with ID {ownerId} not found");

        var areaExists = await _unitOfWork.Areas.ExistsAsync(a => a.Id == areaId, cancellationToken);
        if (!areaExists)
            throw new NotFoundException($"Area with ID {areaId} not found");

        var unit = new Unit
        {
            OwnerId = ownerId,
            AreaId = areaId,
            Name = name.Trim(),
            Description = description?.Trim(),
            Address = address?.Trim(),
            UnitType = unitType.Trim().ToLower(),
            Bedrooms = bedrooms,
            Bathrooms = bathrooms,
            MaxGuests = maxGuests,
            BasePricePerNight = basePricePerNight,
            IsActive = isActive
        };

        await _unitOfWork.Units.AddAsync(unit, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return unit;
    }

    public async Task<Unit> UpdateAsync(
        Guid id, 
        Guid ownerId, 
        Guid areaId, 
        string name, 
        string? description, 
        string? address, 
        string unitType, 
        int bedrooms, 
        int bathrooms, 
        int maxGuests, 
        decimal basePricePerNight, 
        bool isActive, 
        CancellationToken cancellationToken = default)
    {
        var unit = await _unitOfWork.Units.GetByIdAsync(id, cancellationToken);
        if (unit == null)
            throw new NotFoundException($"Unit with ID {id} not found");

        ValidateUnitData(name, unitType, bedrooms, bathrooms, maxGuests, basePricePerNight);

        if (unit.OwnerId != ownerId)
        {
            var ownerExists = await _unitOfWork.Owners.ExistsAsync(o => o.Id == ownerId, cancellationToken);
            if (!ownerExists)
                throw new NotFoundException($"Owner with ID {ownerId} not found");
        }

        if (unit.AreaId != areaId)
        {
            var areaExists = await _unitOfWork.Areas.ExistsAsync(a => a.Id == areaId, cancellationToken);
            if (!areaExists)
                throw new NotFoundException($"Area with ID {areaId} not found");
        }

        unit.OwnerId = ownerId;
        unit.AreaId = areaId;
        unit.Name = name.Trim();
        unit.Description = description?.Trim();
        unit.Address = address?.Trim();
        unit.UnitType = unitType.Trim().ToLower();
        unit.Bedrooms = bedrooms;
        unit.Bathrooms = bathrooms;
        unit.MaxGuests = maxGuests;
        unit.BasePricePerNight = basePricePerNight;
        unit.IsActive = isActive;

        _unitOfWork.Units.Update(unit);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return unit;
    }

    public async Task SoftDeleteAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var unit = await _unitOfWork.Units.GetByIdAsync(id, cancellationToken);
        if (unit == null)
            throw new NotFoundException($"Unit with ID {id} not found");

        _unitOfWork.Units.Delete(unit);
        await _unitOfWork.SaveChangesAsync(cancellationToken);
    }

    public async Task SetActiveAsync(Guid id, bool isActive, CancellationToken cancellationToken = default)
    {
        var unit = await _unitOfWork.Units.GetByIdAsync(id, cancellationToken);
        if (unit == null)
            throw new NotFoundException($"Unit with ID {id} not found");

        unit.IsActive = isActive;
        _unitOfWork.Units.Update(unit);
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
