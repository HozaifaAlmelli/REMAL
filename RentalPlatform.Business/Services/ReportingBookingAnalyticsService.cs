using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using RentalPlatform.Business.Exceptions;
using RentalPlatform.Business.Interfaces;
using RentalPlatform.Business.Models;
using RentalPlatform.Data;
using RentalPlatform.Data.ReadModels;

namespace RentalPlatform.Business.Services;

/// <summary>
/// Read-only booking analytics service backed by the reporting_booking_daily_summary view.
/// No write operations, no raw SQL, no owner/unit/admin/CRM drilldowns.
/// Scope frozen per docs/decisions/0014_reports_analytics_business_scope.md.
/// </summary>
public class ReportingBookingAnalyticsService : IReportingBookingAnalyticsService
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly ILogger<ReportingBookingAnalyticsService> _logger;

    public ReportingBookingAnalyticsService(
        IUnitOfWork unitOfWork,
        ILogger<ReportingBookingAnalyticsService> logger)
    {
        _unitOfWork = unitOfWork;
        _logger = logger;
    }

    public async Task<IReadOnlyList<ReportingBookingDailySummary>> GetDailySummaryAsync(
        DateOnly? dateFrom = null,
        DateOnly? dateTo = null,
        string? bookingSource = null,
        CancellationToken cancellationToken = default,
        bool includeHistorical = true,
        bool historicalOnly = false)
    {
        ValidateFilters(dateFrom, dateTo, bookingSource, includeHistorical, historicalOnly);

        var query = BuildQuery(dateFrom, dateTo, bookingSource);

        var rows = await query
            .OrderBy(r => r.MetricDate)
            .ThenBy(r => r.BookingSource)
            .ToListAsync(cancellationToken);

        return ApplyHistoricalFilter(rows, includeHistorical, historicalOnly);
    }

    public async Task<BookingAnalyticsSummaryResult> GetSummaryAsync(
        DateOnly? dateFrom = null,
        DateOnly? dateTo = null,
        string? bookingSource = null,
        CancellationToken cancellationToken = default,
        bool includeHistorical = true,
        bool historicalOnly = false)
    {
        ValidateFilters(dateFrom, dateTo, bookingSource, includeHistorical, historicalOnly);

        var rows = ApplyHistoricalFilter(
            await BuildQuery(dateFrom, dateTo, bookingSource).ToListAsync(cancellationToken),
            includeHistorical,
            historicalOnly);

        return new BookingAnalyticsSummaryResult
        {
            DateFrom                     = dateFrom,
            DateTo                       = dateTo,
            BookingSource                = string.IsNullOrWhiteSpace(bookingSource) ? null : bookingSource.Trim(),
            TotalBookingsCreatedCount    = rows.Sum(r => r.BookingsCreatedCount),
            TotalProspectingBookingsCount = rows.Sum(r => r.ProspectingBookingsCount),
            TotalConfirmedBookingsCount  = rows.Sum(r => r.ConfirmedBookingsCount),
            TotalCancelledBookingsCount  = rows.Sum(r => r.CancelledBookingsCount),
            TotalCompletedBookingsCount  = rows.Sum(r => r.CompletedBookingsCount),
            TotalFinalAmount             = rows.Sum(r => r.TotalFinalAmount),
            HistoricalBookingsCount      = rows.Sum(r => r.HistoricalBookingsCount),
            HistoricalFinalAmount        = rows.Sum(r => r.HistoricalFinalAmount),
            HistoricalAgreedAmount       = rows.Sum(r => r.HistoricalAgreedAmount),
            HistoricalLegacySystemBookingsCount = rows.Sum(r => r.HistoricalLegacySystemBookingsCount),
            HistoricalExternalPlatformBookingsCount = rows.Sum(r => r.HistoricalExternalPlatformBookingsCount),
            HistoricalOfflineRecordBookingsCount = rows.Sum(r => r.HistoricalOfflineRecordBookingsCount),
            HistoricalOtherSourceBookingsCount = rows.Sum(r => r.HistoricalOtherSourceBookingsCount),
        };
    }

    public async Task<IReadOnlyList<ReportingBookingStayDailySummary>> GetStayDailySummaryAsync(
        DateOnly dateFrom,
        DateOnly dateTo,
        bool includeHistorical = true,
        bool historicalOnly = false,
        CancellationToken cancellationToken = default)
    {
        ValidateHistoricalRange(dateFrom, dateTo, includeHistorical, historicalOnly);
        var started = Stopwatch.GetTimestamp();

        var rows = await _unitOfWork.ReportingBookingStayDailySummaries
            .Where(row => row.MetricDate >= dateFrom && row.MetricDate <= dateTo)
            .OrderBy(row => row.MetricDate)
            .ThenBy(row => row.BookingSource)
            .ToListAsync(cancellationToken);

        var projected = ApplyStayHistoricalFilter(rows, includeHistorical, historicalOnly);

        _logger.LogInformation(
            "reporting.historical.query Route={Route} IncludeHistorical={IncludeHistorical} HistoricalOnly={HistoricalOnly} RowCount={RowCount} ElapsedMs={ElapsedMs}",
            "bookings/stay-daily",
            includeHistorical,
            historicalOnly,
            projected.Count,
            Stopwatch.GetElapsedTime(started).TotalMilliseconds);

        return projected;
    }

    public async Task<IReadOnlyList<ReportingHistoricalEntryReconciliation>> GetHistoricalReconciliationAsync(
        DateOnly stayMonthFrom,
        DateOnly stayMonthTo,
        CancellationToken cancellationToken = default)
    {
        ValidateMonthRange(stayMonthFrom, stayMonthTo);
        var started = Stopwatch.GetTimestamp();
        var exclusiveEnd = stayMonthTo == new DateOnly(9999, 12, 1)
            ? DateOnly.MaxValue
            : stayMonthTo.AddMonths(1);

        var rows = await _unitOfWork.ReportingHistoricalEntryReconciliations
            .Where(row => row.StayStart >= stayMonthFrom && row.StayStart < exclusiveEnd)
            .OrderBy(row => row.StayStart)
            .ThenBy(row => row.BookingId)
            .ToListAsync(cancellationToken);

        _logger.LogInformation(
            "reporting.historical.query Route={Route} RowCount={RowCount} ElapsedMs={ElapsedMs}",
            "bookings/historical-reconciliation",
            rows.Count,
            Stopwatch.GetElapsedTime(started).TotalMilliseconds);

        return rows;
    }

    // -----------------------------------------------------------------------
    // Private helpers
    // -----------------------------------------------------------------------

    private static void ValidateFilters(
        DateOnly? dateFrom,
        DateOnly? dateTo,
        string? bookingSource,
        bool includeHistorical,
        bool historicalOnly)
    {
        if (dateFrom.HasValue && dateTo.HasValue && dateFrom.Value > dateTo.Value)
            throw new BusinessValidationException(
                $"dateFrom ({dateFrom.Value}) must not be later than dateTo ({dateTo.Value}).");

        if (bookingSource is not null && string.IsNullOrWhiteSpace(bookingSource))
            throw new BusinessValidationException(
                "bookingSource must not be blank when provided.");

        if (dateFrom.HasValue && dateTo.HasValue)
            ValidateHistoricalRange(dateFrom.Value, dateTo.Value, includeHistorical, historicalOnly);
        else
            ValidateHistoricalFilter(includeHistorical, historicalOnly);
    }

    private static void ValidateHistoricalRange(
        DateOnly dateFrom,
        DateOnly dateTo,
        bool includeHistorical,
        bool historicalOnly)
    {
        if (dateFrom > dateTo)
            throw new BusinessValidationException("dateFrom must be on or before dateTo.");

        if (!IsWithinInclusive24Months(dateFrom, dateTo))
            throw new BusinessValidationException("Date range must not exceed 24 inclusive months.");

        ValidateHistoricalFilter(includeHistorical, historicalOnly);
    }

    private static void ValidateMonthRange(DateOnly stayMonthFrom, DateOnly stayMonthTo)
    {
        if (stayMonthFrom.Day != 1 || stayMonthTo.Day != 1)
            throw new BusinessValidationException("Stay month values must identify the first day of a month.");

        if (stayMonthFrom > stayMonthTo)
            throw new BusinessValidationException("stayMonthFrom must be on or before stayMonthTo.");

        if ((((stayMonthTo.Year - stayMonthFrom.Year) * 12)
             + stayMonthTo.Month - stayMonthFrom.Month) > 23)
            throw new BusinessValidationException("Stay month range must not exceed 24 inclusive months.");
    }

    private static bool IsWithinInclusive24Months(DateOnly from, DateOnly to)
    {
        if (from > DateOnly.MaxValue.AddMonths(-24).AddDays(1))
            return true;

        return to <= from.AddMonths(24).AddDays(-1);
    }

    private static void ValidateHistoricalFilter(bool includeHistorical, bool historicalOnly)
    {
        if (historicalOnly && !includeHistorical)
            throw new BusinessValidationException(
                "historicalOnly=true cannot be combined with includeHistorical=false.");
    }

    private static IReadOnlyList<ReportingBookingDailySummary> ApplyHistoricalFilter(
        IReadOnlyList<ReportingBookingDailySummary> rows,
        bool includeHistorical,
        bool historicalOnly)
    {
        if (includeHistorical && !historicalOnly)
            return rows;

        return rows
            .Select(row => historicalOnly
                ? new ReportingBookingDailySummary
                {
                    MetricDate = row.MetricDate,
                    BookingSource = row.BookingSource,
                    BookingsCreatedCount = row.HistoricalBookingsCount,
                    ProspectingBookingsCount = row.HistoricalProspectingBookingsCount,
                    ConfirmedBookingsCount = row.HistoricalConfirmedBookingsCount,
                    CancelledBookingsCount = row.HistoricalCancelledBookingsCount,
                    CompletedBookingsCount = row.HistoricalCompletedBookingsCount,
                    TotalFinalAmount = row.HistoricalFinalAmount,
                    HistoricalBookingsCount = row.HistoricalBookingsCount,
                    HistoricalProspectingBookingsCount = row.HistoricalProspectingBookingsCount,
                    HistoricalConfirmedBookingsCount = row.HistoricalConfirmedBookingsCount,
                    HistoricalCancelledBookingsCount = row.HistoricalCancelledBookingsCount,
                    HistoricalCompletedBookingsCount = row.HistoricalCompletedBookingsCount,
                    HistoricalFinalAmount = row.HistoricalFinalAmount,
                    HistoricalAgreedAmount = row.HistoricalAgreedAmount,
                    HistoricalLegacySystemBookingsCount = row.HistoricalLegacySystemBookingsCount,
                    HistoricalExternalPlatformBookingsCount = row.HistoricalExternalPlatformBookingsCount,
                    HistoricalOfflineRecordBookingsCount = row.HistoricalOfflineRecordBookingsCount,
                    HistoricalOtherSourceBookingsCount = row.HistoricalOtherSourceBookingsCount,
                }
                : new ReportingBookingDailySummary
                {
                    MetricDate = row.MetricDate,
                    BookingSource = row.BookingSource,
                    BookingsCreatedCount = row.BookingsCreatedCount - row.HistoricalBookingsCount,
                    ProspectingBookingsCount = row.ProspectingBookingsCount - row.HistoricalProspectingBookingsCount,
                    ConfirmedBookingsCount = row.ConfirmedBookingsCount - row.HistoricalConfirmedBookingsCount,
                    CancelledBookingsCount = row.CancelledBookingsCount - row.HistoricalCancelledBookingsCount,
                    CompletedBookingsCount = row.CompletedBookingsCount - row.HistoricalCompletedBookingsCount,
                    TotalFinalAmount = row.TotalFinalAmount - row.HistoricalFinalAmount,
                })
            .Where(row => row.BookingsCreatedCount > 0)
            .ToList();
    }

    private static IReadOnlyList<ReportingBookingStayDailySummary> ApplyStayHistoricalFilter(
        IReadOnlyList<ReportingBookingStayDailySummary> rows,
        bool includeHistorical,
        bool historicalOnly)
    {
        if (includeHistorical && !historicalOnly)
            return rows;

        return rows
            .Select(row => historicalOnly
                ? new ReportingBookingStayDailySummary
                {
                    MetricDate = row.MetricDate,
                    BookingSource = row.BookingSource,
                    BookingsCount = row.HistoricalBookingsCount,
                    ProspectingBookingsCount = row.HistoricalProspectingBookingsCount,
                    ConfirmedBookingsCount = row.HistoricalConfirmedBookingsCount,
                    CancelledBookingsCount = row.HistoricalCancelledBookingsCount,
                    CompletedBookingsCount = row.HistoricalCompletedBookingsCount,
                    TotalFinalAmount = row.HistoricalFinalAmount,
                    HistoricalBookingsCount = row.HistoricalBookingsCount,
                    HistoricalProspectingBookingsCount = row.HistoricalProspectingBookingsCount,
                    HistoricalConfirmedBookingsCount = row.HistoricalConfirmedBookingsCount,
                    HistoricalCancelledBookingsCount = row.HistoricalCancelledBookingsCount,
                    HistoricalCompletedBookingsCount = row.HistoricalCompletedBookingsCount,
                    HistoricalFinalAmount = row.HistoricalFinalAmount,
                    HistoricalAgreedAmount = row.HistoricalAgreedAmount,
                }
                : new ReportingBookingStayDailySummary
                {
                    MetricDate = row.MetricDate,
                    BookingSource = row.BookingSource,
                    BookingsCount = row.BookingsCount - row.HistoricalBookingsCount,
                    ProspectingBookingsCount = row.ProspectingBookingsCount - row.HistoricalProspectingBookingsCount,
                    ConfirmedBookingsCount = row.ConfirmedBookingsCount - row.HistoricalConfirmedBookingsCount,
                    CancelledBookingsCount = row.CancelledBookingsCount - row.HistoricalCancelledBookingsCount,
                    CompletedBookingsCount = row.CompletedBookingsCount - row.HistoricalCompletedBookingsCount,
                    TotalFinalAmount = row.TotalFinalAmount - row.HistoricalFinalAmount,
                })
            .Where(row => row.BookingsCount > 0)
            .ToList();
    }

    private IQueryable<ReportingBookingDailySummary> BuildQuery(
        DateOnly? dateFrom,
        DateOnly? dateTo,
        string? bookingSource)
    {
        var query = _unitOfWork.ReportingBookingDailySummaries.AsQueryable();

        if (dateFrom.HasValue)
            query = query.Where(r => r.MetricDate >= dateFrom.Value);

        if (dateTo.HasValue)
            query = query.Where(r => r.MetricDate <= dateTo.Value);

        if (!string.IsNullOrWhiteSpace(bookingSource))
            query = query.Where(r => r.BookingSource == bookingSource.Trim());

        return query;
    }
}
