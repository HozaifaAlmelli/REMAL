namespace RentalPlatform.Data.ReadModels;

/// <summary>
/// Keyless read model for the reporting_booking_daily_summary SQL view.
/// Exposes daily booking creation counts and current-status distribution
/// grouped by booking creation date and booking source.
/// Read-only — no write-side semantics, no key, no soft-delete.
/// Scope frozen per DB-RA-01 / DA-RA-01.
/// </summary>
public sealed class ReportingBookingDailySummary
{
    public DateOnly MetricDate { get; init; }
    public string BookingSource { get; init; } = string.Empty;
    public int BookingsCreatedCount { get; init; }
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
