using System;

namespace RentalPlatform.Business.Models;

/// <summary>
/// Aggregated booking analytics summary over a date-range and optional source filter.
/// Produced by IReportingBookingAnalyticsService.GetSummaryAsync.
/// Read-only result model — no write-side semantics.
/// Scope frozen per docs/decisions/0014_reports_analytics_business_scope.md.
/// </summary>
public record BookingAnalyticsSummaryResult
{
    public DateOnly? DateFrom { get; init; }
    public DateOnly? DateTo { get; init; }
    public string? BookingSource { get; init; }
    public int TotalBookingsCreatedCount { get; init; }
    public int TotalProspectingBookingsCount { get; init; }
    public int TotalConfirmedBookingsCount { get; init; }
    public int TotalCancelledBookingsCount { get; init; }
    public int TotalCompletedBookingsCount { get; init; }
    public decimal TotalFinalAmount { get; init; }
    public int HistoricalBookingsCount { get; init; }
    public decimal HistoricalFinalAmount { get; init; }
    public decimal HistoricalAgreedAmount { get; init; }
    public int HistoricalLegacySystemBookingsCount { get; init; }
    public int HistoricalExternalPlatformBookingsCount { get; init; }
    public int HistoricalOfflineRecordBookingsCount { get; init; }
    public int HistoricalOtherSourceBookingsCount { get; init; }
}
