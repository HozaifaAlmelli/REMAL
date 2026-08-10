using System;

namespace RentalPlatform.API.DTOs.Responses.Finance;

public record InvoiceBalanceResponse
{
    public Guid InvoiceId { get; init; }
    public decimal TotalAmount { get; init; }
    public decimal PaidAmount { get; init; }
    public decimal RemainingAmount { get; init; }
    public bool IsFullyPaid { get; init; }
    public int HistoricalPaymentEvidenceCount { get; init; }
    public decimal HistoricalPaymentEvidenceAmount { get; init; }
}

public record BookingFinanceSnapshotResponse
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

public record OwnerPayoutSummaryResponse
{
    public Guid OwnerId { get; init; }
    public decimal TotalPending { get; init; }
    public decimal TotalScheduled { get; init; }
    public decimal TotalPaid { get; init; }
}
