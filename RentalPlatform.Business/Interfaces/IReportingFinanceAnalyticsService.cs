using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using RentalPlatform.Business.Models;
using RentalPlatform.Data.ReadModels;

namespace RentalPlatform.Business.Interfaces;

/// <summary>
/// Business contract for daily finance analytics queries.
/// Reads from the reporting_finance_daily_summary view.
/// Cancelled invoices and non-paid payments are excluded by the underlying view.
/// Read-only — no write, insert, update, or delete operations.
/// Scope frozen per DB-RA-01 / docs/decisions/0014_reports_analytics_business_scope.md.
/// </summary>
public interface IReportingFinanceAnalyticsService
{
    /// <summary>
    /// Returns the daily finance summary rows matching the supplied date range.
    /// All parameters are optional. MetricDate is filtered inclusive on both ends.
    /// </summary>
    Task<IReadOnlyList<ReportingFinanceDailySummary>> GetDailySummaryAsync(
        DateOnly? dateFrom = null,
        DateOnly? dateTo = null,
        CancellationToken cancellationToken = default,
        bool includeHistorical = true,
        bool historicalOnly = false);

    /// <summary>
    /// Returns an aggregated finance analytics summary over all daily rows
    /// matching the supplied date range.
    /// </summary>
    Task<FinanceAnalyticsSummaryResult> GetSummaryAsync(
        DateOnly? dateFrom = null,
        DateOnly? dateTo = null,
        CancellationToken cancellationToken = default,
        bool includeHistorical = true,
        bool historicalOnly = false);

    Task<IReadOnlyList<ReportingFinanceStayDailySummary>> GetStayDailySummaryAsync(
        DateOnly dateFrom,
        DateOnly dateTo,
        bool includeHistorical = true,
        bool historicalOnly = false,
        CancellationToken cancellationToken = default);
}
