namespace RentalPlatform.Data.ReadModels;

/// <summary>
/// Keyless stay-start booking reporting row. Each booking contributes once on
/// check_in_date; historical provenance is supplied by original_source.
/// </summary>
public sealed class ReportingBookingStayDailySummary
{
    public DateOnly MetricDate { get; init; }
    public bool IsHistorical { get; init; }
    public string ReportingSource { get; init; } = string.Empty;
    public int BookingsCount { get; init; }
    public int ProspectingBookingsCount { get; init; }
    public int ConfirmedBookingsCount { get; init; }
    public int CancelledBookingsCount { get; init; }
    public int CompletedBookingsCount { get; init; }
    public decimal TotalFinalAmount { get; init; }
    public int HistoricalBookingsCount { get; init; }
    public decimal HistoricalAgreedAmount { get; init; }
}
