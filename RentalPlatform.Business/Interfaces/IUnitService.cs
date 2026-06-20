using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using RentalPlatform.Data.Entities;
using RentalPlatform.Business.Models;
using RentalPlatform.Shared.Models;

namespace RentalPlatform.Business.Interfaces;

public interface IUnitService
{
    Task<PagedResult<Unit>> GetPublicCatalogAsync(PublicUnitCatalogFilter filter, CancellationToken cancellationToken = default);
    Task<PagedResult<Unit>> GetInternalCatalogAsync(
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
        CancellationToken cancellationToken = default);
    Task<IReadOnlyList<Unit>> GetAllAsync(bool includeInactive = true, Guid? ownerId = null, CancellationToken cancellationToken = default);
    Task<Unit?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<Unit> CreateAsync(Guid ownerId, Guid areaId, string name, string? description, string? address, string unitType, int bedrooms, int bathrooms, int maxGuests, decimal basePricePerNight, bool isActive = true, CancellationToken cancellationToken = default);
    Task<Unit> UpdateAsync(Guid id, Guid ownerId, Guid areaId, string name, string? description, string? address, string unitType, int bedrooms, int bathrooms, int maxGuests, decimal basePricePerNight, bool isActive, CancellationToken cancellationToken = default);
    Task SoftDeleteAsync(Guid id, CancellationToken cancellationToken = default);
    Task SetActiveAsync(Guid id, bool isActive, CancellationToken cancellationToken = default);
}
