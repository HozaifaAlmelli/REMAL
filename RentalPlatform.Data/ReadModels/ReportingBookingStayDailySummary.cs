namespace RentalPlatform.Data.ReadModels;

/// <summary>
/// Keyless stay-start booking reporting row. Each booking contributes once on
/// check_in_date and booking source, with historical component measures.
/// </summary>
public sealed class ReportingBookingStayDailySummary
{
    public DateOnly MetricDate { get; init; }
    public string BookingSource { get; init; } = string.Empty;
    public int BookingsCount { get; init; }
    public int ProspectingBookingsCount { get; init; }
    public int ConfirmedBookingsCount { get; init; }
    public int CancelledBookingsCount { get; init; }
    public int CompletedBookingsCount { get; init; }
    public decimal TotalFinalAmount { get; init; }
    public int HistoricalBookingsCount { get; init; }
    public int HistoricalProspectingBookingsCount { get; init; }
    public int HistoricalConfirmedBookingsCount { get; init; }
    public int HistoricalCancelledBookingsCount { get; init; }
    public int HistoricalCompletedBookingsCount { get; init; }
    public decimal HistoricalFinalAmount { get; init; }
    public decimal HistoricalAgreedAmount { get; init; }
}
