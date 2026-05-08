using System;
using System.Threading;
using System.Threading.Tasks;
using RentalPlatform.Data.Entities;
using RentalPlatform.Shared.Enums;

namespace RentalPlatform.Business.Interfaces;

public interface IBookingLifecycleService
{
    Task<Booking> TransitionAsync(Guid bookingId, BookingStatus targetStatus, Guid changedByAdminUserId, string? notes, CancellationToken cancellationToken = default);
    Task<Booking> ConfirmAsync(Guid bookingId, Guid changedByAdminUserId, string? notes, CancellationToken cancellationToken = default);
    Task<Booking> CheckInAsync(Guid bookingId, Guid changedByAdminUserId, string? notes, CancellationToken cancellationToken = default);
    Task<Booking> LeftEarlyAsync(Guid bookingId, Guid changedByAdminUserId, string? notes, CancellationToken cancellationToken = default);
    Task<Booking> CancelAsync(Guid bookingId, Guid changedByAdminUserId, string? notes, CancellationToken cancellationToken = default);
    Task<Booking> CompleteAsync(Guid bookingId, Guid changedByAdminUserId, string? notes, CancellationToken cancellationToken = default);
}
