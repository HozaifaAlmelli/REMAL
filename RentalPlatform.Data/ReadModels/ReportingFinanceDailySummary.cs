namespace RentalPlatform.Data.ReadModels;

/// <summary>
/// Keyless read model for the reporting_finance_daily_summary SQL view.
/// Exposes daily finance aggregates — invoiced/paid/remaining totals and
/// payout bucket sums — grouped by booking creation date.
/// Cancelled invoices and non-paid payments are excluded by the view.
/// Read-only — no write-side semantics, no key, no soft-delete.
/// Scope frozen per DB-RA-01 / DA-RA-01.
/// </summary>
public sealed class ReportingFinanceDailySummary
{
    public DateOnly MetricDate { get; init; }
    public int BookingsWithInvoiceCount { get; init; }
    public decimal TotalInvoicedAmount { get; init; }
    public decimal TotalPaidAmount { get; init; }
    public decimal TotalRemainingAmount { get; init; }
    public decimal TotalPendingPayoutAmount { get; init; }
    public decimal TotalScheduledPayoutAmount { get; init; }
    public decimal TotalPaidPayoutAmount { get; init; }
    public int HistoricalBookingsCount { get; init; }
    public decimal HistoricalAgreedAmount { get; init; }
    public int HistoricalBookingsWithInvoiceCount { get; init; }
    public decimal HistoricalInvoicedAmount { get; init; }
    public int OrdinaryUnlinkedPaidCount { get; init; }
    public decimal OrdinaryUnlinkedPaidAmount { get; init; }
    public int HistoricalEvidenceRecordedCount { get; init; }
    public decimal HistoricalEvidenceRecordedAmount { get; init; }
}
