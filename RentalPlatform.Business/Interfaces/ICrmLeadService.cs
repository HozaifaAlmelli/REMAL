using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using RentalPlatform.Data.Entities;

namespace RentalPlatform.Business.Interfaces;

public interface ICrmLeadService
{
    Task<IReadOnlyList<CrmLead>> GetAllAsync(string? leadStatus = null, Guid? assignedAdminUserId = null, CancellationToken cancellationToken = default);
    Task<int> GetOpenCountAsync(CancellationToken cancellationToken = default);
    Task<IReadOnlyList<CrmLead>> GetByClientIdAsync(Guid clientId, CancellationToken cancellationToken = default);
    Task<CrmLead?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<CrmLead> CreateAsync(Guid? clientId, Guid? targetUnitId, Guid? assignedAdminUserId, string contactName, string contactPhone, string? contactEmail, DateOnly? desiredCheckInDate, DateOnly? desiredCheckOutDate, int? guestCount, string source, string? notes, bool requirePortfolioVisibility = false, CancellationToken cancellationToken = default);
    Task<CrmLead> UpdateAsync(Guid id, Guid? clientId, Guid? targetUnitId, Guid? assignedAdminUserId, string contactName, string contactPhone, string? contactEmail, DateOnly? desiredCheckInDate, DateOnly? desiredCheckOutDate, int? guestCount, string source, string? notes, CancellationToken cancellationToken = default);
    Task<CrmLead> SetStatusAsync(Guid id, string leadStatus, CancellationToken cancellationToken = default);
    Task<Booking> ConvertToBookingAsync(Guid leadId, Guid clientId, Guid unitId, DateOnly checkInDate, DateOnly checkOutDate, int guestCount, Guid convertedByAdminUserId, string? internalNotes, CancellationToken cancellationToken = default);
}
