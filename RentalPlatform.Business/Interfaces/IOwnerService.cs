using RentalPlatform.Data.Entities;

namespace RentalPlatform.Business.Interfaces;

public interface IOwnerService
{
    Task<IReadOnlyList<Owner>> GetAllAsync(bool includeInactive = true, string? search = null, CancellationToken cancellationToken = default);
    Task<Owner?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<Owner> CreateAsync(string name, string phone, string emergencyPhone, string? email, string? detailedAddress, decimal commissionRate, string? notes, string status, string plainTextPassword, CancellationToken cancellationToken = default);
    Task<Owner> UpdateAsync(Guid id, string name, string phone, string emergencyPhone, string? email, string? detailedAddress, decimal commissionRate, string? notes, string status, CancellationToken cancellationToken = default);
    Task SoftDeleteAsync(Guid id, CancellationToken cancellationToken = default);
}
