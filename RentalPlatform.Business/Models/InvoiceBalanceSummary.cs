using System;

namespace RentalPlatform.Business.Models;

public record InvoiceBalanceResult
{
    public Guid InvoiceId { get; init; }
    public decimal TotalAmount { get; init; }
    public decimal PaidAmount { get; init; }
    public decimal RemainingAmount { get; init; }
    public bool IsFullyPaid { get; init; }
    public int HistoricalPaymentEvidenceCount { get; init; }
    public decimal HistoricalPaymentEvidenceAmount { get; init; }
}
