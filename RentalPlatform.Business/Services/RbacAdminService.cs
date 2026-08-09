using Microsoft.EntityFrameworkCore;
using RentalPlatform.Business.Exceptions;
using RentalPlatform.Business.Interfaces;
using RentalPlatform.Business.Models;
using RentalPlatform.Data;
using RentalPlatform.Data.Entities;
using RentalPlatform.Shared.Constants;

namespace RentalPlatform.Business.Services;

public sealed class RbacAdminService : IRbacAdminService
{
    private const string Grant = "grant";
    private const string Deny = "deny";
    private const string SettingsAdminPermission = "settings:admin";
    private static readonly string[] MandatorySuperAdminHistoricalPermissions =
    {
        RbacPermissionKeys.BookingsRecordHistorical,
        RbacPermissionKeys.PaymentsRecordHistorical,
        RbacPermissionKeys.BookingsCorrectOwnerAttribution
    };

    private readonly IUnitOfWork _unitOfWork;
    private readonly IPermissionResolver _permissionResolver;
    private readonly IRbacPermissionRegistry _permissionRegistry;

    public RbacAdminService(
        IUnitOfWork unitOfWork,
        IPermissionResolver permissionResolver,
        IRbacPermissionRegistry permissionRegistry)
    {
        _unitOfWork = unitOfWork;
        _permissionResolver = permissionResolver;
        _permissionRegistry = permissionRegistry;
    }

    public async Task<IReadOnlyList<RbacRoleTemplateModel>> GetRoleTemplatesAsync(
        CancellationToken cancellationToken = default)
    {
        return await _unitOfWork.RbacRoleTemplates.Query()
            .AsNoTracking()
            .OrderByDescending(role => role.IsSystem)
            .ThenBy(role => role.Name)
            .Select(role => new RbacRoleTemplateModel(
                role.Id,
                role.Name,
                role.Description,
                role.IsSystem,
                role.IsActive,
                role.Permissions.Select(permission => permission.PermissionKey).OrderBy(key => key).ToArray(),
                role.AdminUsers.Count,
                role.CreatedAt,
                role.UpdatedAt))
            .ToListAsync(cancellationToken);
    }

    public async Task<RbacRoleTemplateModel> CreateRoleTemplateAsync(
        string name,
        string? description,
        IReadOnlyCollection<string> permissionKeys,
        CancellationToken cancellationToken = default)
    {
        var normalizedName = ValidateName(name);
        var normalizedDescription = NormalizeDescription(description);
        var normalizedPermissions = ValidatePermissionKeys(permissionKeys);
        ValidateHistoricalRolePermissions(Guid.Empty, normalizedPermissions);

        var duplicate = await _unitOfWork.RbacRoleTemplates.Query()
            .AnyAsync(role => role.Name.ToLower() == normalizedName.ToLower(), cancellationToken);
        if (duplicate)
            throw new ConflictException($"A role named '{normalizedName}' already exists.");

        await using var transaction = await _unitOfWork.BeginTransactionAsync(cancellationToken);
        var role = new RbacRoleTemplate
        {
            Id = Guid.NewGuid(),
            Name = normalizedName,
            Description = normalizedDescription,
            IsSystem = false,
            IsActive = true
        };

        await _unitOfWork.RbacRoleTemplates.AddAsync(role, cancellationToken);
        foreach (var key in normalizedPermissions)
        {
            await _unitOfWork.RbacRoleTemplatePermissions.AddAsync(
                new RbacRoleTemplatePermission
                {
                    RoleTemplateId = role.Id,
                    PermissionKey = key
                },
                cancellationToken);
        }

        await _unitOfWork.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return await GetRoleTemplateAsync(role.Id, cancellationToken);
    }

    public async Task<RbacRoleTemplateModel> UpdateRoleTemplateAsync(
        Guid callerId,
        Guid roleTemplateId,
        string name,
        string? description,
        IReadOnlyCollection<string> permissionKeys,
        CancellationToken cancellationToken = default)
    {
        var normalizedName = ValidateName(name);
        var normalizedDescription = NormalizeDescription(description);
        var normalizedPermissions = ValidatePermissionKeys(permissionKeys);

        var role = await _unitOfWork.RbacRoleTemplates.Query()
            .Include(entry => entry.Permissions)
            .SingleOrDefaultAsync(entry => entry.Id == roleTemplateId, cancellationToken)
            ?? throw new NotFoundException("Role template not found.");

        if (role.IsSystem && !string.Equals(role.Name, normalizedName, StringComparison.Ordinal))
            throw new BusinessValidationException("System role names cannot be changed.");

        ValidateHistoricalRolePermissions(role.Id, normalizedPermissions);

        var duplicate = await _unitOfWork.RbacRoleTemplates.Query()
            .AnyAsync(
                entry => entry.Id != roleTemplateId &&
                         entry.Name.ToLower() == normalizedName.ToLower(),
                cancellationToken);
        if (duplicate)
            throw new ConflictException($"A role named '{normalizedName}' already exists.");

        await EnsureCallerRetainsSettingsAccessAsync(
            callerId,
            roleTemplateId,
            normalizedPermissions,
            cancellationToken);

        await using var transaction = await _unitOfWork.BeginTransactionAsync(cancellationToken);
        role.Name = normalizedName;
        role.Description = normalizedDescription;

        foreach (var existing in role.Permissions.ToArray())
        {
            if (!normalizedPermissions.Contains(existing.PermissionKey, StringComparer.Ordinal))
                _unitOfWork.RbacRoleTemplatePermissions.Delete(existing);
        }

        var existingKeys = role.Permissions
            .Select(permission => permission.PermissionKey)
            .ToHashSet(StringComparer.Ordinal);
        foreach (var key in normalizedPermissions.Where(key => !existingKeys.Contains(key)))
        {
            await _unitOfWork.RbacRoleTemplatePermissions.AddAsync(
                new RbacRoleTemplatePermission
                {
                    RoleTemplateId = role.Id,
                    PermissionKey = key
                },
                cancellationToken);
        }

        _unitOfWork.RbacRoleTemplates.Update(role);
        await _unitOfWork.SaveChangesAsync(cancellationToken);
        await BumpRoleMembersAsync(role.Id, cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        return await GetRoleTemplateAsync(role.Id, cancellationToken);
    }

    public async Task DeleteRoleTemplateAsync(
        Guid roleTemplateId,
        CancellationToken cancellationToken = default)
    {
        var role = await _unitOfWork.RbacRoleTemplates.GetByIdAsync(
            roleTemplateId,
            cancellationToken)
            ?? throw new NotFoundException("Role template not found.");

        if (role.IsSystem)
            throw new BusinessValidationException("System role templates cannot be deleted.");

        if (await _unitOfWork.AdminUsers.ExistsAsync(
                admin => admin.RoleTemplateId == roleTemplateId,
                cancellationToken))
        {
            throw new ConflictException("Reassign users before deleting this role.");
        }

        _unitOfWork.RbacRoleTemplates.Delete(role);
        try
        {
            await _unitOfWork.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException exception)
        {
            throw new ConflictException(
                "Reassign users before deleting this role.",
                exception);
        }
    }

    public async Task<RbacUserOverridesModel> GetUserOverridesAsync(
        Guid adminUserId,
        CancellationToken cancellationToken = default)
    {
        var admin = await _unitOfWork.AdminUsers.Query()
            .AsNoTracking()
            .SingleOrDefaultAsync(entry => entry.Id == adminUserId, cancellationToken)
            ?? throw new NotFoundException("Admin user not found.");

        var inherited = await _unitOfWork.RbacRoleTemplatePermissions.Query()
            .AsNoTracking()
            .Where(permission => permission.RoleTemplateId == admin.RoleTemplateId)
            .Select(permission => permission.PermissionKey)
            .OrderBy(key => key)
            .ToArrayAsync(cancellationToken);

        var overrides = await _unitOfWork.RbacAdminUserPermissionOverrides.Query()
            .AsNoTracking()
            .Where(entry => entry.AdminUserId == adminUserId)
            .OrderBy(entry => entry.PermissionKey)
            .Select(entry => new { entry.PermissionKey, entry.ModifierType })
            .ToArrayAsync(cancellationToken);

        var grants = overrides
            .Where(entry => entry.ModifierType == Grant)
            .Select(entry => entry.PermissionKey)
            .ToArray();
        var denies = overrides
            .Where(entry => entry.ModifierType == Deny)
            .Select(entry => entry.PermissionKey)
            .ToArray();
        var effective = await _permissionResolver.ResolveAsync(adminUserId, cancellationToken);

        return new RbacUserOverridesModel(adminUserId, effective, inherited, grants, denies);
    }

    public async Task<RbacUserOverridesModel> ReplaceUserOverridesAsync(
        Guid callerId,
        Guid adminUserId,
        IReadOnlyCollection<string> grants,
        IReadOnlyCollection<string> denies,
        CancellationToken cancellationToken = default)
    {
        if (callerId == adminUserId)
            throw new BusinessValidationException("You cannot edit your own permission overrides.");

        var normalizedGrants = ValidatePermissionKeys(grants);
        var normalizedDenies = ValidatePermissionKeys(denies);
        var overlap = normalizedGrants.Intersect(normalizedDenies, StringComparer.Ordinal).ToArray();
        if (overlap.Length > 0)
            throw new BusinessValidationException("A permission cannot be both granted and denied.");

        var targetAdmin = await _unitOfWork.AdminUsers.Query()
            .AsNoTracking()
            .SingleOrDefaultAsync(admin => admin.Id == adminUserId, cancellationToken)
            ?? throw new NotFoundException("Admin user not found.");

        ValidateHistoricalUserOverrides(
            targetAdmin.RoleTemplateId,
            normalizedGrants,
            normalizedDenies);

        await using var transaction = await _unitOfWork.BeginTransactionAsync(cancellationToken);
        await _unitOfWork.RbacAdminUserPermissionOverrides.Query()
            .Where(entry => entry.AdminUserId == adminUserId)
            .ExecuteDeleteAsync(cancellationToken);

        foreach (var key in normalizedGrants)
            await AddOverrideAsync(adminUserId, key, Grant, cancellationToken);
        foreach (var key in normalizedDenies)
            await AddOverrideAsync(adminUserId, key, Deny, cancellationToken);

        await _unitOfWork.SaveChangesAsync(cancellationToken);
        await _unitOfWork.AdminUsers.Query()
            .Where(admin => admin.Id == adminUserId)
            .ExecuteUpdateAsync(
                setters => setters.SetProperty(admin => admin.UpdatedAt, DateTime.UtcNow),
                cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        return await GetUserOverridesAsync(adminUserId, cancellationToken);
    }

    private async Task<RbacRoleTemplateModel> GetRoleTemplateAsync(
        Guid roleTemplateId,
        CancellationToken cancellationToken)
    {
        return await _unitOfWork.RbacRoleTemplates.Query()
            .AsNoTracking()
            .Where(role => role.Id == roleTemplateId)
            .Select(role => new RbacRoleTemplateModel(
                role.Id,
                role.Name,
                role.Description,
                role.IsSystem,
                role.IsActive,
                role.Permissions.Select(permission => permission.PermissionKey).OrderBy(key => key).ToArray(),
                role.AdminUsers.Count,
                role.CreatedAt,
                role.UpdatedAt))
            .SingleAsync(cancellationToken);
    }

    private async Task EnsureCallerRetainsSettingsAccessAsync(
        Guid callerId,
        Guid editedRoleTemplateId,
        IReadOnlyCollection<string> proposedPermissions,
        CancellationToken cancellationToken)
    {
        var caller = await _unitOfWork.AdminUsers.Query()
            .AsNoTracking()
            .SingleOrDefaultAsync(admin => admin.Id == callerId, cancellationToken)
            ?? throw new BusinessValidationException("Could not resolve the caller's account.");

        if (caller.RoleTemplateId != editedRoleTemplateId ||
            proposedPermissions.Contains(SettingsAdminPermission, StringComparer.Ordinal))
        {
            return;
        }

        var explicitGrant = await _unitOfWork.RbacAdminUserPermissionOverrides.Query()
            .AsNoTracking()
            .AnyAsync(
                entry => entry.AdminUserId == callerId &&
                         entry.PermissionKey == SettingsAdminPermission &&
                         entry.ModifierType == Grant,
                cancellationToken);
        if (!explicitGrant)
        {
            throw new BusinessValidationException(
                "You cannot remove access management from your own effective permissions.");
        }
    }

    private async Task BumpRoleMembersAsync(Guid roleTemplateId, CancellationToken cancellationToken)
    {
        await _unitOfWork.AdminUsers.Query()
            .Where(admin => admin.RoleTemplateId == roleTemplateId)
            .ExecuteUpdateAsync(
                setters => setters.SetProperty(admin => admin.UpdatedAt, DateTime.UtcNow),
                cancellationToken);
    }

    private Task AddOverrideAsync(
        Guid adminUserId,
        string permissionKey,
        string modifierType,
        CancellationToken cancellationToken)
    {
        return _unitOfWork.RbacAdminUserPermissionOverrides.AddAsync(
            new RbacAdminUserPermissionOverride
            {
                AdminUserId = adminUserId,
                PermissionKey = permissionKey,
                ModifierType = modifierType
            },
            cancellationToken);
    }

    private HashSet<string> ValidatePermissionKeys(IEnumerable<string>? permissionKeys)
    {
        if (permissionKeys == null)
            throw new BusinessValidationException("Permission keys are required.");

        var normalized = permissionKeys
            .Where(key => !string.IsNullOrWhiteSpace(key))
            .Select(key => key.Trim())
            .ToHashSet(StringComparer.Ordinal);
        var unknown = normalized.Where(key => !_permissionRegistry.AllKeys.Contains(key)).ToArray();
        if (unknown.Length > 0)
        {
            throw new BusinessValidationException(
                $"Unknown permission keys: {string.Join(", ", unknown)}.");
        }

        return normalized;
    }

    private static void ValidateHistoricalRolePermissions(
        Guid roleTemplateId,
        IReadOnlySet<string> proposedPermissions)
    {
        if (roleTemplateId == RbacSystemRoleTemplates.SuperAdminId)
        {
            var missing = MandatorySuperAdminHistoricalPermissions
                .Where(permission => !proposedPermissions.Contains(permission))
                .ToArray();
            if (missing.Length > 0)
            {
                throw new BusinessValidationException(
                    "The SuperAdmin historical-booking baseline permissions are mandatory.",
                    RbacErrorCodes.HistoricalSuperAdminBaselineRequired);
            }

            return;
        }

        if (proposedPermissions.Contains(RbacPermissionKeys.BookingsCorrectOwnerAttribution))
        {
            throw new BusinessValidationException(
                "Historical owner-attribution correction is restricted to SuperAdmin.",
                RbacErrorCodes.OwnerCorrectionSuperAdminOnly);
        }
    }

    private static void ValidateHistoricalUserOverrides(
        Guid roleTemplateId,
        IReadOnlySet<string> grants,
        IReadOnlySet<string> denies)
    {
        var isSuperAdmin = roleTemplateId == RbacSystemRoleTemplates.SuperAdminId;
        if ((!isSuperAdmin && grants.Contains(RbacPermissionKeys.BookingsCorrectOwnerAttribution)) ||
            (isSuperAdmin && denies.Contains(RbacPermissionKeys.BookingsCorrectOwnerAttribution)))
        {
            throw new BusinessValidationException(
                "Historical owner-attribution correction cannot be changed with a user override.",
                RbacErrorCodes.OwnerCorrectionSuperAdminOnly);
        }
    }

    private static string ValidateName(string name)
    {
        var normalized = name?.Trim();
        if (string.IsNullOrWhiteSpace(normalized))
            throw new BusinessValidationException("Role name is required.");
        if (normalized.Length > 100)
            throw new BusinessValidationException("Role name cannot exceed 100 characters.");
        return normalized;
    }

    private static string? NormalizeDescription(string? description)
    {
        var normalized = description?.Trim();
        return string.IsNullOrWhiteSpace(normalized) ? null : normalized;
    }
}
