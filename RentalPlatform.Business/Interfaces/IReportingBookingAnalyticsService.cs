using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using RentalPlatform.Business.Models;
using RentalPlatform.Data.ReadModels;

namespace RentalPlatform.Business.Interfaces;

/// <summary>
/// Business contract for daily booking analytics queries.
/// Reads from the reporting_booking_daily_summary view.
/// Read-only — no write, insert, update, or delete operations.
/// Scope frozen per DB-RA-01 / docs/decisions/0014_reports_analytics_business_scope.md.
/// </summary>
public interface IReportingBookingAnalyticsService
{
    /// <summary>
    /// Returns the daily booking summary rows matching the supplied filters.
    /// All parameters are optional. MetricDate is filtered inclusive on both ends.
    /// bookingSource is an exact match filter when supplied.
    /// </summary>
    Task<IReadOnlyList<ReportingBookingDailySummary>> GetDailySummaryAsync(
        DateOnly? dateFrom = null,
        DateOnly? dateTo = null,
        string? bookingSource = null,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Returns an aggregated booking analytics summary over all daily rows
    /// matching the supplied filters.
    /// </summary>
    Task<BookingAnalyticsSummaryResult> GetSummaryAsync(
        DateOnly? dateFrom = null,
        DateOnly? dateTo = null,
        string? bookingSource = null,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<ReportingBookingStayDailySummary>> GetStayDailySummaryAsync(
        DateOnly dateFrom,
        DateOnly dateTo,
        bool includeHistorical = true,
        bool historicalOnly = false,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<ReportingHistoricalEntryReconciliation>> GetHistoricalReconciliationAsync(
        DateOnly stayMonthFrom,
        DateOnly stayMonthTo,
        CancellationToken cancellationToken = default);
}
