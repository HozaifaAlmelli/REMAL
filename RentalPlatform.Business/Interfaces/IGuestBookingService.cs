using RentalPlatform.Business.Models;

namespace RentalPlatform.Business.Interfaces;

public interface IGuestBookingService
{
    Task<GuestBookingResult> CreateAsync(
        string firstName,
        string lastName,
        string phone,
        Guid unitId,
        DateOnly checkInDate,
        DateOnly checkOutDate,
        int guestCount,
        CancellationToken cancellationToken = default);
}
