namespace RentalPlatform.Data.ReadModels;

/// <summary>
/// Keyless stay-start finance reporting row. Historical evidence is excluded
/// because its independent business date is payments.paid_at.
/// </summary>
public sealed class ReportingFinanceStayDailySummary
{
    public DateOnly MetricDate { get; init; }
    public bool IsHistorical { get; init; }
    public string ReportingSource { get; init; } = string.Empty;
    public int BookingsCount { get; init; }
    public int BookingsWithInvoiceCount { get; init; }
    public decimal TotalInvoicedAmount { get; init; }
    public decimal InvoiceLinkedPaidAmount { get; init; }
    public decimal TotalRemainingAmount { get; init; }
    public int OrdinaryOrphanPaymentCount { get; init; }
    public decimal OrdinaryOrphanPaymentAmount { get; init; }
    public int HistoricalBookingsCount { get; init; }
    public decimal HistoricalAgreedAmount { get; init; }
}
