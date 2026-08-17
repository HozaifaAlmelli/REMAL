using RentalPlatform.Data.Entities;

namespace RentalPlatform.Business.Interfaces;

public interface IClientService
{
    Task<IReadOnlyList<Client>> GetAllAsync(bool includeInactive = false, string? search = null, CancellationToken cancellationToken = default);
    Task<Client?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<Client?> FindByPhoneIdentityAsync(string phone, CancellationToken cancellationToken = default);
    Task<Client> CreateAsync(string name, string phone, string? email, string plainTextPassword, CancellationToken cancellationToken = default);
    Task<Client> UpdateAsync(Guid id, string name, string phone, string? email, bool isActive, CancellationToken cancellationToken = default);
    Task<Client> UpdateStatusAsync(Guid id, bool isActive, CancellationToken cancellationToken = default);
    Task<Client> ResetPasswordAsync(Guid id, string plainTextPassword, Guid changedByAdminUserId, CancellationToken cancellationToken = default);
    Task SoftDeleteAsync(Guid id, CancellationToken cancellationToken = default);
}
