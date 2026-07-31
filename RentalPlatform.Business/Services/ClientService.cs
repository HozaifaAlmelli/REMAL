using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using RentalPlatform.Business.Exceptions;
using RentalPlatform.Business.Interfaces;
using RentalPlatform.Data;
using RentalPlatform.Data.Entities;
using BCrypt.Net;
using System.Text.RegularExpressions;

namespace RentalPlatform.Business.Services;

public class ClientService : IClientService
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly ILogger<ClientService> _logger;
    // Accept 10–15 digits with an optional leading '+'. A leading 0 is allowed so
    // local formats (e.g. Egyptian "01062327721") work alongside E.164 ("+201062327721").
    private static readonly Regex PhoneRegex = new(@"^\+?\d{10,15}$", RegexOptions.Compiled);

    public ClientService(IUnitOfWork unitOfWork, ILogger<ClientService> logger)
    {
        _unitOfWork = unitOfWork;
        _logger = logger;
    }

    public async Task<IReadOnlyList<Client>> GetAllAsync(bool includeInactive = false, string? search = null, CancellationToken cancellationToken = default)
    {
        var query = _unitOfWork.Clients.Query();

        if (!includeInactive)
        {
            query = query.Where(c => c.IsActive);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var normalizedSearch = search.Trim().ToLower();
            var normalizedPhoneSearch = normalizedSearch.Replace("+", string.Empty);
            query = query.Where(c =>
                c.Name.ToLower().Contains(normalizedSearch) ||
                c.Phone.Replace("+", string.Empty).Contains(normalizedPhoneSearch) ||
                (c.Email != null && c.Email.ToLower().Contains(normalizedSearch)));
        }

        return await query
            .OrderByDescending(c => c.CreatedAt)
            .ToListAsync(cancellationToken);
    }

    public async Task<Client?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        return await _unitOfWork.Clients.GetByIdAsync(id, cancellationToken);
    }

    public async Task<Client?> FindByPhoneIdentityAsync(
        string phone,
        CancellationToken cancellationToken = default)
    {
        var trimmedPhone = phone?.Trim();
        if (string.IsNullOrWhiteSpace(trimmedPhone))
            throw new BusinessValidationException("Phone is required.");

        ValidatePhone(trimmedPhone);
        var normalizedPhone = NormalizePhoneIdentity(trimmedPhone);
        return await _unitOfWork.Clients.Query()
            .IgnoreQueryFilters()
            .AsNoTracking()
            .FirstOrDefaultAsync(
                client => client.Phone.Replace("+", string.Empty) == normalizedPhone,
                cancellationToken);
    }

    public async Task<Client> CreateAsync(string name, string phone, string? email, string plainTextPassword, CancellationToken cancellationToken = default)
    {
        var trimmedName = name?.Trim();
        var trimmedPhone = phone?.Trim();
        var trimmedEmail = email?.Trim();

        if (string.IsNullOrWhiteSpace(trimmedName)) throw new BusinessValidationException("Name is required.");
        if (string.IsNullOrWhiteSpace(trimmedPhone)) throw new BusinessValidationException("Phone is required.");
        if (string.IsNullOrWhiteSpace(plainTextPassword)) throw new BusinessValidationException("Password is required.");
        ValidatePhone(trimmedPhone);
        ValidatePassword(plainTextPassword);

        var normalizedPhone = NormalizePhoneIdentity(trimmedPhone);
        var duplicatePhone = await _unitOfWork.Clients.ExistsAsync(
            c => c.Phone.Replace("+", string.Empty) == normalizedPhone,
            cancellationToken);
        if (duplicatePhone) throw new ConflictException($"Client with phone '{trimmedPhone}' already exists.");

        if (!string.IsNullOrWhiteSpace(trimmedEmail))
        {
            var duplicateEmail = await _unitOfWork.Clients.ExistsAsync(c => c.Email != null && c.Email.ToLower() == trimmedEmail.ToLower(), cancellationToken);
            if (duplicateEmail) throw new ConflictException($"Client with email '{trimmedEmail}' already exists.");
        }

        var client = new Client
        {
            Id = Guid.NewGuid(),
            Name = trimmedName,
            Phone = trimmedPhone,
            Email = string.IsNullOrWhiteSpace(trimmedEmail) ? null : trimmedEmail,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(plainTextPassword, 12),
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await _unitOfWork.Clients.AddAsync(client, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return client;
    }

    public async Task<Client> UpdateAsync(Guid id, string name, string phone, string? email, bool isActive, CancellationToken cancellationToken = default)
    {
        var trimmedName = name?.Trim();
        var trimmedPhone = phone?.Trim();
        var trimmedEmail = email?.Trim();

        if (string.IsNullOrWhiteSpace(trimmedName)) throw new BusinessValidationException("Name is required.");
        if (string.IsNullOrWhiteSpace(trimmedPhone)) throw new BusinessValidationException("Phone is required.");
        ValidatePhone(trimmedPhone);

        var client = await _unitOfWork.Clients.GetByIdAsync(id, cancellationToken)
            ?? throw new NotFoundException($"Client with ID {id} not found.");

        var normalizedPhone = NormalizePhoneIdentity(trimmedPhone);
        var duplicatePhone = await _unitOfWork.Clients.ExistsAsync(
            c => c.Phone.Replace("+", string.Empty) == normalizedPhone && c.Id != id,
            cancellationToken);
        if (duplicatePhone) throw new ConflictException($"Client with phone '{trimmedPhone}' already exists.");

        if (!string.IsNullOrWhiteSpace(trimmedEmail))
        {
            var duplicateEmail = await _unitOfWork.Clients.ExistsAsync(c => c.Email != null && c.Email.ToLower() == trimmedEmail.ToLower() && c.Id != id, cancellationToken);
            if (duplicateEmail) throw new ConflictException($"Client with email '{trimmedEmail}' already exists.");
        }

        client.Name = trimmedName;
        client.Phone = trimmedPhone;
        client.Email = string.IsNullOrWhiteSpace(trimmedEmail) ? null : trimmedEmail;
        client.IsActive = isActive;
        client.UpdatedAt = DateTime.UtcNow;

        _unitOfWork.Clients.Update(client);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return client;
    }

    public async Task<Client> UpdateStatusAsync(Guid id, bool isActive, CancellationToken cancellationToken = default)
    {
        var client = await _unitOfWork.Clients.GetByIdAsync(id, cancellationToken)
            ?? throw new NotFoundException($"Client with ID {id} not found.");

        client.IsActive = isActive;
        client.UpdatedAt = DateTime.UtcNow;

        _unitOfWork.Clients.Update(client);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return client;
    }

    public async Task<Client> ResetPasswordAsync(
        Guid id,
        string plainTextPassword,
        Guid changedByAdminUserId,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(plainTextPassword))
            throw new BusinessValidationException("Password is required.");

        ValidatePassword(plainTextPassword);

        var client = await _unitOfWork.Clients.GetByIdAsync(id, cancellationToken)
            ?? throw new NotFoundException($"Client with ID {id} not found.");

        client.PasswordHash = BCrypt.Net.BCrypt.HashPassword(plainTextPassword, 12);
        client.UpdatedAt = DateTime.UtcNow;

        _unitOfWork.Clients.Update(client);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        _logger.LogWarning(
            "SecurityAudit ClientPasswordReset ActorAdminUserId={ActorAdminUserId} TargetClientId={TargetClientId} OccurredAtUtc={OccurredAtUtc}",
            changedByAdminUserId,
            client.Id,
            client.UpdatedAt);

        return client;
    }

    public async Task SoftDeleteAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var client = await _unitOfWork.Clients.GetByIdAsync(id, cancellationToken)
            ?? throw new NotFoundException($"Client with ID {id} not found.");

        _unitOfWork.Clients.Delete(client);
        await _unitOfWork.SaveChangesAsync(cancellationToken);
    }

    private static void ValidatePhone(string phone)
    {
        if (!PhoneRegex.IsMatch(phone))
            throw new BusinessValidationException(
                "Phone must be a valid international number with 10 to 15 digits and an optional leading plus sign.");
    }

    private static string NormalizePhoneIdentity(string phone) => phone.TrimStart('+');

    private static void ValidatePassword(string password)
    {
        if (password.Length < 8)
            throw new BusinessValidationException("Password must be at least 8 characters.");
    }
}
