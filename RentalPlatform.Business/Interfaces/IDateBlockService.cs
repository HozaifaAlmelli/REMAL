using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using RentalPlatform.Data.Entities;

namespace RentalPlatform.Business.Interfaces;

public interface IDateBlockService
{
    Task<IReadOnlyList<DateBlock>> GetByUnitIdAsync(Guid unitId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<DateBlock>> GetOwnerBlocksByUnitIdAsync(Guid ownerId, Guid unitId, CancellationToken cancellationToken = default);
    Task<DateBlock> CreateAsync(Guid unitId, DateOnly startDate, DateOnly endDate, string? reason, string? notes, CancellationToken cancellationToken = default);
    Task<DateBlock> CreateOwnerBlockAsync(Guid ownerId, Guid unitId, DateOnly startDate, DateOnly endDate, string? reason, string? notes, CancellationToken cancellationToken = default);
    Task<DateBlock> UpdateAsync(Guid id, DateOnly startDate, DateOnly endDate, string? reason, string? notes, CancellationToken cancellationToken = default);
    Task DeleteAsync(Guid id, CancellationToken cancellationToken = default);
}
