using Microsoft.EntityFrameworkCore;
using RentalPlatform.Business.Exceptions;
using RentalPlatform.Business.Interfaces;
using RentalPlatform.Business.Models;
using RentalPlatform.Business.Security;
using RentalPlatform.Data;

namespace RentalPlatform.Business.Services;

public sealed class GuestBookingService : IGuestBookingService
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IClientService _clientService;
    private readonly IBookingService _bookingService;

    public GuestBookingService(
        IUnitOfWork unitOfWork,
        IClientService clientService,
        IBookingService bookingService)
    {
        _unitOfWork = unitOfWork;
        _clientService = clientService;
        _bookingService = bookingService;
    }

    public async Task<GuestBookingResult> CreateAsync(
        string firstName,
        string lastName,
        string phone,
        Guid unitId,
        DateOnly checkInDate,
        DateOnly checkOutDate,
        int guestCount,
        CancellationToken cancellationToken = default)
    {
        var fullName = BuildFullName(firstName, lastName);
        var normalizedPhone = NormalizePhoneIdentity(phone);

        await using var transaction = await _unitOfWork.BeginTransactionAsync(cancellationToken);
        try
        {
            var existingClient = await _unitOfWork.Clients.Query()
                .IgnoreQueryFilters()
                .AsNoTracking()
                .Where(client => client.Phone.Replace("+", string.Empty) == normalizedPhone)
                .AnyAsync(cancellationToken);

            if (existingClient)
            {
                throw new ConflictException(
                    "An account already exists for this phone. Please sign in to confirm this booking.");
            }

            var client = await _clientService.CreateAsync(
                fullName,
                normalizedPhone,
                email: null,
                TemporaryPasswordGenerator.Generate(),
                cancellationToken);

            var booking = await _bookingService.CreateQuickAsync(
                client.Id,
                unitId,
                checkInDate,
                checkOutDate,
                guestCount,
                source: "website",
                assignedAdminUserId: null,
                internalNotes: "Created through storefront guest checkout.",
                requirePortfolioVisibility: true,
                rejectSoftHoldOverlaps: true,
                cancellationToken);

            await _unitOfWork.ReloadAsync(client, cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            return new GuestBookingResult(client, booking);
        }
        catch
        {
            await transaction.RollbackAsync(cancellationToken);
            throw;
        }
    }

    private static string BuildFullName(string firstName, string lastName)
    {
        var trimmedFirstName = firstName.Trim();
        var trimmedLastName = lastName.Trim();

        if (string.IsNullOrWhiteSpace(trimmedFirstName) ||
            string.IsNullOrWhiteSpace(trimmedLastName))
        {
            throw new BusinessValidationException("First name and last name are required.");
        }

        return $"{trimmedFirstName} {trimmedLastName}";
    }

    private static string NormalizePhoneIdentity(string phone)
    {
        return phone
            .Trim()
            .Replace(" ", string.Empty)
            .Replace("-", string.Empty)
            .Replace("(", string.Empty)
            .Replace(")", string.Empty)
            .TrimStart('+');
    }
}
