using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using RentalPlatform.Data.Entities;
using RentalPlatform.Shared.Models;

namespace RentalPlatform.Business.Interfaces;

public interface IBookingService
{
    Task<PagedResult<Booking>> GetAllAsync(string? bookingStatus = null, Guid? assignedAdminUserId = null, Guid? clientId = null, Guid? ownerId = null, string? search = null, int page = 1, int pageSize = 20, CancellationToken cancellationToken = default);
    Task<Booking?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<Booking> CreateAsync(Guid clientId, Guid unitId, DateOnly checkInDate, DateOnly checkOutDate, int guestCount, string source, Guid? assignedAdminUserId, string? internalNotes, CancellationToken cancellationToken = default);
    Task<Booking> UpdatePendingAsync(Guid id, DateOnly checkInDate, DateOnly checkOutDate, int guestCount, string source, Guid? assignedAdminUserId, string? internalNotes, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<BookingStatusHistory>> GetStatusHistoryAsync(Guid bookingId, CancellationToken cancellationToken = default);
}
