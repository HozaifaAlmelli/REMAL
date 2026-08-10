using Microsoft.EntityFrameworkCore;
using RentalPlatform.Business.Interfaces;
using RentalPlatform.Data;
using RentalPlatform.Shared.Constants;

namespace RentalPlatform.Business.Services;

public sealed class PermissionResolver : IPermissionResolver
{
    private const string Grant = "grant";
    private const string Deny = "deny";
    private readonly IUnitOfWork _unitOfWork;

    public PermissionResolver(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<IReadOnlyCollection<string>> ResolveAsync(
        Guid adminUserId,
        CancellationToken cancellationToken = default)
    {
        var roleTemplateId = await _unitOfWork.AdminUsers.Query()
            .AsNoTracking()
            .Where(admin => admin.Id == adminUserId && admin.IsActive)
            .Where(admin => admin.RoleTemplate != null && admin.RoleTemplate.IsActive)
            .Select(admin => (Guid?)admin.RoleTemplateId)
            .SingleOrDefaultAsync(cancellationToken);

        if (!roleTemplateId.HasValue)
            return Array.Empty<string>();

        var inherited = await _unitOfWork.RbacRoleTemplatePermissions.Query()
            .AsNoTracking()
            .Where(permission => permission.RoleTemplateId == roleTemplateId.Value)
            .Select(permission => permission.PermissionKey)
            .ToListAsync(cancellationToken);

        var overrides = await _unitOfWork.RbacAdminUserPermissionOverrides.Query()
            .AsNoTracking()
            .Where(overrideEntry => overrideEntry.AdminUserId == adminUserId)
            .Select(overrideEntry => new
            {
                overrideEntry.PermissionKey,
                overrideEntry.ModifierType
            })
            .ToListAsync(cancellationToken);

        var effective = inherited.ToHashSet(StringComparer.Ordinal);
        effective.UnionWith(overrides
            .Where(entry => entry.ModifierType == Grant)
            .Select(entry => entry.PermissionKey));
        effective.ExceptWith(overrides
            .Where(entry => entry.ModifierType == Deny)
            .Select(entry => entry.PermissionKey));

        if (roleTemplateId.Value == RbacSystemRoleTemplates.SuperAdminId)
            effective.Add(RbacPermissionKeys.BookingsCorrectOwnerAttribution);
        else
            effective.Remove(RbacPermissionKeys.BookingsCorrectOwnerAttribution);

        return effective.OrderBy(key => key, StringComparer.Ordinal).ToArray();
    }
}
