namespace RentalPlatform.Data.ReadModels;

/// <summary>
/// Keyless stay-start booking reporting row. Each booking contributes once on
/// check_in_date and booking source, with historical component measures.
/// </summary>
public sealed class ReportingBookingStayDailySummary
{
    public DateOnly StayStartDate { get; init; }
    public string BookingSource { get; init; } = string.Empty;
    public int StayBookingsCount { get; init; }
    public int ProspectingBookingsCount { get; init; }
    public int ConfirmedBookingsCount { get; init; }
    public int CancelledBookingsCount { get; init; }
    public int CompletedBookingsCount { get; init; }
    public decimal TotalFinalAmount { get; init; }
    public int HistoricalBookingsCount { get; init; }
    public decimal HistoricalAgreedAmount { get; init; }
    public int HistoricalLegacySystemBookingsCount { get; init; }
    public int HistoricalExternalPlatformBookingsCount { get; init; }
    public int HistoricalOfflineRecordBookingsCount { get; init; }
    public int HistoricalOtherSourceBookingsCount { get; init; }
}
