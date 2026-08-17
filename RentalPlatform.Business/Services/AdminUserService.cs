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
using RentalPlatform.Shared.Enums;
using RentalPlatform.Shared.Constants;
using BCrypt.Net;

namespace RentalPlatform.Business.Services;

public class AdminUserService : IAdminUserService
{
    private readonly IUnitOfWork _unitOfWork;

    public AdminUserService(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<IReadOnlyList<AdminUser>> GetAllAsync(bool includeInactive = true, CancellationToken cancellationToken = default)
    {
        IQueryable<AdminUser> query = _unitOfWork.AdminUsers.Query()
            .Include(admin => admin.RoleTemplate);

        if (!includeInactive)
        {
            query = query.Where(a => a.IsActive);
        }

        return await query.ToListAsync(cancellationToken);
    }

    public async Task<AdminUser?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        return await _unitOfWork.AdminUsers.Query()
            .Include(admin => admin.RoleTemplate)
            .SingleOrDefaultAsync(admin => admin.Id == id, cancellationToken);
    }

    public async Task<AdminUser> CreateAsync(string name, string email, string plainTextPassword, Guid roleTemplateId, CancellationToken cancellationToken = default)
    {
        var trimmedName = name?.Trim();
        var trimmedEmail = email?.Trim();

        if (string.IsNullOrWhiteSpace(trimmedName)) throw new BusinessValidationException("Name is required.");
        if (string.IsNullOrWhiteSpace(trimmedEmail)) throw new BusinessValidationException("Email is required.");
        if (string.IsNullOrWhiteSpace(plainTextPassword)) throw new BusinessValidationException("Password is required.");

        var roleTemplate = await GetActiveRoleTemplateAsync(roleTemplateId, cancellationToken);

        var duplicateEmail = await _unitOfWork.AdminUsers.ExistsAsync(a => a.Email.ToLower() == trimmedEmail.ToLower(), cancellationToken);
        if (duplicateEmail) throw new ConflictException($"Admin user with email '{trimmedEmail}' already exists.");

        var adminUser = new AdminUser
        {
            Id = Guid.NewGuid(),
            Name = trimmedName,
            Email = trimmedEmail,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(plainTextPassword, 12),
            Role = LegacyRoleForTemplate(roleTemplate.Name),
            RoleTemplateId = roleTemplate.Id,
            RoleTemplate = roleTemplate,
            IsActive = true
        };

        await _unitOfWork.AdminUsers.AddAsync(adminUser, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return adminUser;
    }

    public async Task<AdminUser> UpdateRoleAsync(Guid id, Guid roleTemplateId, CancellationToken cancellationToken = default)
    {
        var roleTemplate = await GetActiveRoleTemplateAsync(roleTemplateId, cancellationToken);

        var adminUser = await _unitOfWork.AdminUsers.GetByIdAsync(id, cancellationToken)
            ?? throw new NotFoundException($"Admin user with ID {id} not found.");

        await ValidateOwnerCorrectionOverrideForRoleChangeAsync(
            adminUser.Id,
            roleTemplate.Id,
            cancellationToken);

        adminUser.RoleTemplateId = roleTemplate.Id;
        adminUser.Role = LegacyRoleForTemplate(roleTemplate.Name);
        adminUser.RoleTemplate = roleTemplate;

        _unitOfWork.AdminUsers.Update(adminUser);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return adminUser;
    }

    public async Task SetActiveAsync(Guid id, bool isActive, CancellationToken cancellationToken = default)
    {
        var adminUser = await _unitOfWork.AdminUsers.GetByIdAsync(id, cancellationToken)
            ?? throw new NotFoundException($"Admin user with ID {id} not found.");

        adminUser.IsActive = isActive;

        _unitOfWork.AdminUsers.Update(adminUser);
        await _unitOfWork.SaveChangesAsync(cancellationToken);
    }

    private async Task<RbacRoleTemplate> GetActiveRoleTemplateAsync(
        Guid roleTemplateId,
        CancellationToken cancellationToken)
    {
        if (roleTemplateId == Guid.Empty)
            throw new BusinessValidationException("Role template is required.");

        return await _unitOfWork.RbacRoleTemplates.FirstOrDefaultAsync(
            role => role.Id == roleTemplateId && role.IsActive,
            cancellationToken)
            ?? throw new BusinessValidationException("The selected role template is unavailable.");
    }

    private static AdminRole? LegacyRoleForTemplate(string roleTemplateName)
    {
        return Enum.TryParse<AdminRole>(roleTemplateName, ignoreCase: false, out var legacyRole)
            ? legacyRole
            : null;
    }

    private async Task ValidateOwnerCorrectionOverrideForRoleChangeAsync(
        Guid adminUserId,
        Guid targetRoleTemplateId,
        CancellationToken cancellationToken)
    {
        var correctionOverride = await _unitOfWork.RbacAdminUserPermissionOverrides.Query()
            .AsNoTracking()
            .Where(entry =>
                entry.AdminUserId == adminUserId &&
                entry.PermissionKey == RbacPermissionKeys.BookingsCorrectOwnerAttribution)
            .Select(entry => entry.ModifierType)
            .SingleOrDefaultAsync(cancellationToken);

        var invalid =
            targetRoleTemplateId == RbacSystemRoleTemplates.SuperAdminId
                ? correctionOverride == "deny"
                : correctionOverride == "grant";
        if (invalid)
        {
            throw new BusinessValidationException(
                "Clear the historical owner-correction override before changing this role.",
                RbacErrorCodes.OwnerCorrectionSuperAdminOnly);
        }
    }
}
