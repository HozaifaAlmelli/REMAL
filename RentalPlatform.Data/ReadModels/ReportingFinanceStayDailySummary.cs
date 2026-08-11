namespace RentalPlatform.Data.ReadModels;

/// <summary>
/// Keyless stay-start contracted/invoiced finance reporting row.
/// </summary>
public sealed class ReportingFinanceStayDailySummary
{
    public DateOnly StayStartDate { get; init; }
    public int StayBookingsCount { get; init; }
    public int BookingsWithInvoiceCount { get; init; }
    public decimal TotalInvoicedAmount { get; init; }
    public decimal TotalFinalAmount { get; init; }
    public int HistoricalBookingsCount { get; init; }
    public decimal HistoricalAgreedAmount { get; init; }
    public int HistoricalBookingsWithInvoiceCount { get; init; }
    public decimal HistoricalInvoicedAmount { get; init; }
}
