using System;

namespace RentalPlatform.Business.Models;

public record BookingFinanceSnapshotResult
{
    public Guid BookingId { get; init; }
    public Guid? InvoiceId { get; init; }
    public string? InvoiceStatus { get; init; }
    public decimal InvoicedAmount { get; init; }
    public decimal PaidAmount { get; init; }
    public decimal RemainingAmount { get; init; }
    public int HistoricalPaymentEvidenceCount { get; init; }
    public decimal HistoricalPaymentEvidenceAmount { get; init; }
    public string? OwnerPayoutStatus { get; init; }
}
