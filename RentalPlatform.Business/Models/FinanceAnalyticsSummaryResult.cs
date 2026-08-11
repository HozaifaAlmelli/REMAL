using System;

namespace RentalPlatform.Business.Models;

/// <summary>
/// Aggregated finance analytics summary over a date range.
/// Produced by IReportingFinanceAnalyticsService.GetSummaryAsync.
/// Cancelled invoices and non-paid payments are excluded by the underlying view.
/// Read-only result model — no write-side semantics.
/// Scope frozen per docs/decisions/0014_reports_analytics_business_scope.md.
/// </summary>
public record FinanceAnalyticsSummaryResult
{
    public DateOnly? DateFrom { get; init; }
    public DateOnly? DateTo { get; init; }
    public int TotalBookingsWithInvoiceCount { get; init; }
    public decimal TotalInvoicedAmount { get; init; }
    public decimal TotalPaidAmount { get; init; }
    public decimal TotalRemainingAmount { get; init; }
    public int HistoricalPaymentEvidenceCount { get; init; }
    public decimal HistoricalPaymentEvidenceAmount { get; init; }
    public decimal TotalPendingPayoutAmount { get; init; }
    public decimal TotalScheduledPayoutAmount { get; init; }
    public decimal TotalPaidPayoutAmount { get; init; }
    public int HistoricalBookingsCount { get; init; }
    public decimal HistoricalAgreedAmount { get; init; }
    public int HistoricalBookingsWithInvoiceCount { get; init; }
    public decimal HistoricalInvoicedAmount { get; init; }
    public int OrdinaryUnlinkedPaidCount { get; init; }
    public decimal OrdinaryUnlinkedPaidAmount { get; init; }
}
