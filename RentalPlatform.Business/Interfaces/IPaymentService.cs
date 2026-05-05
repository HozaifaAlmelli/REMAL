using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using RentalPlatform.Data.Entities;

namespace RentalPlatform.Business.Interfaces;

public interface IPaymentService
{
    Task<IReadOnlyList<Payment>> GetAllAsync(
        string? paymentStatus = null,
        Guid? bookingId = null,
        Guid? invoiceId = null,
        CancellationToken cancellationToken = default);

    Task<Payment?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);

    Task<Payment> CreateAsync(
        Guid bookingId,
        Guid? invoiceId,
        string paymentMethod,
        decimal amount,
        string? referenceNumber,
        string? notes,
        CancellationToken cancellationToken = default);

    Task<Payment> MarkPaidAsync(Guid id, string? referenceNumber, string? notes, CancellationToken cancellationToken = default);
    Task<Payment> MarkFailedAsync(Guid id, string? notes, CancellationToken cancellationToken = default);
    Task<Payment> CancelAsync(Guid id, string? notes, CancellationToken cancellationToken = default);
    Task<int> LinkPaidPaymentsToInvoicesAsync(CancellationToken cancellationToken = default);
}
