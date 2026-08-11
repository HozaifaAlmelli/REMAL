namespace RentalPlatform.Data.ReadModels;

/// <summary>
/// Keyless stay-start contracted/invoiced finance reporting row.
/// </summary>
public sealed class ReportingFinanceStayDailySummary
{
    public DateOnly MetricDate { get; init; }
    public string BookingSource { get; init; } = string.Empty;
    public int BookingsWithInvoiceCount { get; init; }
    public decimal TotalInvoicedAmount { get; init; }
    public decimal TotalFinalAmount { get; init; }
    public int HistoricalBookingsCount { get; init; }
    public decimal HistoricalAgreedAmount { get; init; }
    public decimal HistoricalInvoicedAmount { get; init; }
    public int HistoricalBookingsWithInvoiceCount { get; init; }
}
