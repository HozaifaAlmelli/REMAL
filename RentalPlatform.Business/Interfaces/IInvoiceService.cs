using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using RentalPlatform.Data.Entities;
using RentalPlatform.Shared.Models;

namespace RentalPlatform.Business.Interfaces;

public interface IInvoiceService
{
    Task<PagedResult<Invoice>> GetAllAsync(
        string? invoiceStatus = null,
        Guid? bookingId = null,
        int page = 1,
        int pageSize = 20,
        CancellationToken cancellationToken = default);

    Task<Invoice?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);

    Task<Invoice> CreateDraftFromBookingAsync(
        Guid bookingId,
        string invoiceNumber,
        string? notes,
        CancellationToken cancellationToken = default);

    Task<Invoice> AddManualAdjustmentAsync(
        Guid invoiceId,
        string description,
        int quantity,
        decimal unitAmount,
        CancellationToken cancellationToken = default);

    Task<Invoice> IssueAsync(Guid id, CancellationToken cancellationToken = default);
    Task<Invoice> CancelAsync(Guid id, string? notes, CancellationToken cancellationToken = default);
    Task<Invoice> ReissueAsync(
        Guid id,
        string newInvoiceNumber,
        string? notes,
        CancellationToken cancellationToken = default);
    Task<int> LinkOrphanedPaymentsAsync(CancellationToken cancellationToken = default);
}
