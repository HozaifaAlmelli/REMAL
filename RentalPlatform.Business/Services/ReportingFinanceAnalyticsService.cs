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
using RentalPlatform.Shared.Enums;
using RentalPlatform.Data.ReadModels;

namespace RentalPlatform.Business.Services;

/// <summary>
/// Read-only finance analytics service backed by the reporting_finance_daily_summary view.
/// Cancelled invoices and non-paid payments are excluded by the underlying view.
/// No write operations, no raw SQL, no refund/tax/reconciliation/per-owner/per-unit drilldowns.
/// Scope frozen per docs/decisions/0014_reports_analytics_business_scope.md.
/// </summary>
public class ReportingFinanceAnalyticsService : IReportingFinanceAnalyticsService
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly ILogger<ReportingFinanceAnalyticsService> _logger;

    public ReportingFinanceAnalyticsService(IUnitOfWork unitOfWork, ILogger<ReportingFinanceAnalyticsService> logger)
    {
        _unitOfWork = unitOfWork;
        _logger = logger;
    }

    public async Task<IReadOnlyList<ReportingFinanceDailySummary>> GetDailySummaryAsync(
        DateOnly? dateFrom = null,
        DateOnly? dateTo = null,
        CancellationToken cancellationToken = default,
        bool includeHistorical = true,
        bool historicalOnly = false)
    {
        ValidateDateRange(dateFrom, dateTo, includeHistorical, historicalOnly);

        var rows = await BuildQuery(dateFrom, dateTo)
            .OrderBy(r => r.MetricDate)
            .ToListAsync(cancellationToken);

        return ApplyHistoricalFilter(rows, includeHistorical, historicalOnly);
    }

    public async Task<FinanceAnalyticsSummaryResult> GetSummaryAsync(
        DateOnly? dateFrom = null,
        DateOnly? dateTo = null,
        CancellationToken cancellationToken = default,
        bool includeHistorical = true,
        bool historicalOnly = false)
    {
        ValidateDateRange(dateFrom, dateTo, includeHistorical, historicalOnly);

        // FIXED: Don't filter by booking date - count ALL paid payments in the system
        // The finance summary should show total paid regardless of when booking was created
        
        var bookingsQuery = _unitOfWork.Bookings.Query();

        if (dateFrom.HasValue)
        {
            var dateFromDateTime = dateFrom.Value.ToDateTime(TimeOnly.MinValue);
            bookingsQuery = bookingsQuery.Where(b => b.CreatedAt >= dateFromDateTime);
        }

        if (dateTo.HasValue)
        {
            var dateToDateTime = dateTo.Value.ToDateTime(TimeOnly.MaxValue);
            bookingsQuery = bookingsQuery.Where(b => b.CreatedAt <= dateToDateTime);
        }

        if (historicalOnly)
            bookingsQuery = bookingsQuery.Where(b => b.IsHistorical);
        else if (!includeHistorical)
            bookingsQuery = bookingsQuery.Where(b => !b.IsHistorical);

        var bookingRows = await bookingsQuery
            .Select(b => new { b.Id, b.IsHistorical, b.AgreedAmount })
            .ToListAsync(cancellationToken);
        var bookingIds = bookingRows.Select(b => b.Id).ToList();
        var historicalBookingIds = bookingRows.Where(b => b.IsHistorical).Select(b => b.Id).ToHashSet();

        var activeInvoicesQuery = _unitOfWork.Invoices.Query()
            .Where(i => bookingIds.Contains(i.BookingId))
            .Where(i => i.InvoiceStatus != "cancelled" && i.InvoiceStatus != "superseded");

        // Platform paid revenue excludes immutable evidence of money received outside KAZA.
        var paidPaymentsQuery = _unitOfWork.Payments.Query()
            .Where(p => bookingIds.Contains(p.BookingId))
            .Where(p => p.PaymentStatus == "paid" && !p.IsHistoricalRecord);

        var historicalEvidenceQuery = _unitOfWork.Payments.Query()
            .Where(p => p.PaymentStatus == "paid"
                && p.IsHistoricalRecord
                && p.InvoiceId == null);

        if (!includeHistorical)
            historicalEvidenceQuery = historicalEvidenceQuery.Where(_ => false);

        // Get ALL payouts
        var payoutsQuery = _unitOfWork.OwnerPayouts.Query()
            .Where(p => bookingIds.Contains(p.BookingId));

        // Apply date filters if provided (filter by booking creation date)
        if (dateFrom.HasValue || dateTo.HasValue)
        {
            if (dateFrom.HasValue)
            {
                var dateFromDateTime = dateFrom.Value.ToDateTime(TimeOnly.MinValue);
                historicalEvidenceQuery = historicalEvidenceQuery
                    .Where(p => p.PaidAt >= dateFromDateTime);
            }
            
            if (dateTo.HasValue)
            {
                var dateToDateTime = dateTo.Value.ToDateTime(TimeOnly.MaxValue);
                historicalEvidenceQuery = historicalEvidenceQuery
                    .Where(p => p.PaidAt <= dateToDateTime);
            }
        }

        var activeInvoices = await activeInvoicesQuery.ToListAsync(cancellationToken);
        var paidPayments = await paidPaymentsQuery.ToListAsync(cancellationToken);
        var historicalEvidenceCount = await historicalEvidenceQuery.CountAsync(cancellationToken);
        var historicalEvidenceAmount = await historicalEvidenceQuery
            .SumAsync(p => p.Amount, cancellationToken);
        var payouts = await payoutsQuery.ToListAsync(cancellationToken);

        // Debug logging
        _logger.LogDebug("[FinanceAnalytics] Date range: {DateFrom} to {DateTo}", dateFrom, dateTo);
        _logger.LogDebug("[FinanceAnalytics] Active invoices: {Count}", activeInvoices.Count);
        _logger.LogDebug("[FinanceAnalytics] Paid payments: {Count}", paidPayments.Count);
        _logger.LogDebug("[FinanceAnalytics] Total paid amount: {Total}", paidPayments.Sum(p => p.Amount));

        foreach (var payment in paidPayments)
        {
            _logger.LogDebug("[FinanceAnalytics] Payment: {Id}, Amount: {Amount}, BookingId: {BookingId}, InvoiceId: {InvoiceId}, Status: {Status}",
                payment.Id, payment.Amount, payment.BookingId, payment.InvoiceId, payment.PaymentStatus);
        }

        var totalInvoiced = activeInvoices.Sum(i => i.TotalAmount);
        var totalPaid = paidPayments.Sum(p => p.Amount);
        var totalRemaining = totalInvoiced - totalPaid;
        var historicalInvoices = activeInvoices
            .Where(i => historicalBookingIds.Contains(i.BookingId))
            .ToList();
        var historicalInvoiceLinkedPayments = paidPayments
            .Where(p => historicalBookingIds.Contains(p.BookingId) && p.InvoiceId.HasValue)
            .ToList();
        var ordinaryOrphanPayments = paidPayments.Where(p => !p.InvoiceId.HasValue).ToList();
        var historicalBookingOrdinaryOrphanPayments = ordinaryOrphanPayments
            .Where(p => historicalBookingIds.Contains(p.BookingId))
            .ToList();
        var historicalInvoiced = historicalInvoices.Sum(i => i.TotalAmount);
        var historicalInvoiceLinkedPaid = historicalInvoiceLinkedPayments.Sum(p => p.Amount);

        _logger.LogDebug("[FinanceAnalytics] RESULT - Invoiced: {Invoiced}, Paid: {Paid}, Remaining: {Remaining}", totalInvoiced, totalPaid, totalRemaining);

        // Debug payout calculations
        _logger.LogDebug("[FinanceAnalytics] Total payouts: {Count}", payouts.Count);
        foreach (var payout in payouts)
        {
            _logger.LogDebug("[FinanceAnalytics] Payout: {Id}, BookingId: {BookingId}, Status: '{Status}', Amount: {Amount}",
                payout.Id, payout.BookingId, payout.PayoutStatus, payout.PayoutAmount);
        }

        var pendingPayouts = payouts.Where(p => p.PayoutStatus == OwnerPayoutStatus.Pending).ToList();
        var scheduledPayouts = payouts.Where(p => p.PayoutStatus == OwnerPayoutStatus.Scheduled).ToList();
        var paidPayouts = payouts.Where(p => p.PayoutStatus == OwnerPayoutStatus.Paid).ToList();

        _logger.LogDebug("[FinanceAnalytics] Pending payouts: {Count}, Total: {Total}", pendingPayouts.Count, pendingPayouts.Sum(p => p.PayoutAmount));
        _logger.LogDebug("[FinanceAnalytics] Scheduled payouts: {Count}, Total: {Total}", scheduledPayouts.Count, scheduledPayouts.Sum(p => p.PayoutAmount));
        _logger.LogDebug("[FinanceAnalytics] Paid payouts: {Count}, Total: {Total}", paidPayouts.Count, paidPayouts.Sum(p => p.PayoutAmount));

        return new FinanceAnalyticsSummaryResult
        {
            DateFrom                        = dateFrom,
            DateTo                          = dateTo,
            TotalBookingsWithInvoiceCount   = activeInvoices.Select(i => i.BookingId).Distinct().Count(),
            TotalInvoicedAmount             = totalInvoiced,
            TotalPaidAmount                 = totalPaid,
            TotalRemainingAmount            = totalRemaining,
            HistoricalPaymentEvidenceCount  = historicalEvidenceCount,
            HistoricalPaymentEvidenceAmount = historicalEvidenceAmount,
            TotalPendingPayoutAmount        = pendingPayouts.Sum(p => p.PayoutAmount),
            TotalScheduledPayoutAmount      = scheduledPayouts.Sum(p => p.PayoutAmount),
            TotalPaidPayoutAmount           = paidPayouts.Sum(p => p.PayoutAmount),
            HistoricalBookingsWithInvoiceCount = historicalInvoices.Select(i => i.BookingId).Distinct().Count(),
            HistoricalInvoicedAmount        = historicalInvoiced,
            HistoricalInvoiceLinkedPaidAmount = historicalInvoiceLinkedPaid,
            HistoricalRemainingAmount       = historicalInvoiced - historicalInvoiceLinkedPaid,
            OrdinaryOrphanPaymentCount      = ordinaryOrphanPayments.Count,
            OrdinaryOrphanPaymentAmount     = ordinaryOrphanPayments.Sum(p => p.Amount),
            HistoricalBookingOrdinaryOrphanPaymentCount = historicalBookingOrdinaryOrphanPayments.Count,
            HistoricalBookingOrdinaryOrphanPaymentAmount = historicalBookingOrdinaryOrphanPayments.Sum(p => p.Amount),
            HistoricalAgreedAmount          = bookingRows.Where(b => b.IsHistorical).Sum(b => b.AgreedAmount ?? 0m),
        };
    }

    public async Task<IReadOnlyList<ReportingFinanceStayDailySummary>> GetStayDailySummaryAsync(
        DateOnly dateFrom,
        DateOnly dateTo,
        bool includeHistorical = true,
        bool historicalOnly = false,
        CancellationToken cancellationToken = default)
    {
        ValidateRequiredDateRange(dateFrom, dateTo, includeHistorical, historicalOnly);
        var started = Stopwatch.GetTimestamp();

        var rows = await _unitOfWork.ReportingFinanceStayDailySummaries
            .Where(row => row.MetricDate >= dateFrom && row.MetricDate <= dateTo)
            .OrderBy(row => row.MetricDate)
            .ThenBy(row => row.BookingSource)
            .ToListAsync(cancellationToken);

        var projected = ApplyStayHistoricalFilter(rows, includeHistorical, historicalOnly);

        _logger.LogInformation(
            "reporting.historical.query Route={Route} IncludeHistorical={IncludeHistorical} HistoricalOnly={HistoricalOnly} RowCount={RowCount} ElapsedMs={ElapsedMs}",
            "finance/stay-daily",
            includeHistorical,
            historicalOnly,
            projected.Count,
            Stopwatch.GetElapsedTime(started).TotalMilliseconds);

        return projected;
    }

    // -----------------------------------------------------------------------
    // Private helpers
    // -----------------------------------------------------------------------

    private static void ValidateDateRange(
        DateOnly? dateFrom,
        DateOnly? dateTo,
        bool includeHistorical,
        bool historicalOnly)
    {
        if (dateFrom.HasValue && dateTo.HasValue && dateFrom.Value > dateTo.Value)
            throw new BusinessValidationException(
                $"dateFrom ({dateFrom.Value}) must not be later than dateTo ({dateTo.Value}).");

        if (dateFrom.HasValue && dateTo.HasValue)
            ValidateRequiredDateRange(dateFrom.Value, dateTo.Value, includeHistorical, historicalOnly);
        else
            ValidateHistoricalFilter(includeHistorical, historicalOnly);
    }

    private static void ValidateRequiredDateRange(
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

    private static void ValidateHistoricalFilter(bool includeHistorical, bool historicalOnly)
    {
        if (historicalOnly && !includeHistorical)
            throw new BusinessValidationException(
                "historicalOnly=true cannot be combined with includeHistorical=false.");
    }

    private static bool IsWithinInclusive24Months(DateOnly from, DateOnly to)
    {
        if (from > DateOnly.MaxValue.AddMonths(-24).AddDays(1))
            return true;

        return to <= from.AddMonths(24).AddDays(-1);
    }

    private static IReadOnlyList<ReportingFinanceDailySummary> ApplyHistoricalFilter(
        IReadOnlyList<ReportingFinanceDailySummary> rows,
        bool includeHistorical,
        bool historicalOnly)
    {
        if (includeHistorical && !historicalOnly)
            return rows;

        return rows
            .Select(row => historicalOnly
                ? new ReportingFinanceDailySummary
                {
                    MetricDate = row.MetricDate,
                    BookingsWithInvoiceCount = row.HistoricalBookingsWithInvoiceCount,
                    TotalInvoicedAmount = row.HistoricalInvoicedAmount,
                    TotalPaidAmount = row.HistoricalInvoiceLinkedPaidAmount,
                    TotalRemainingAmount = row.HistoricalRemainingAmount,
                    HistoricalBookingsWithInvoiceCount = row.HistoricalBookingsWithInvoiceCount,
                    HistoricalInvoicedAmount = row.HistoricalInvoicedAmount,
                    HistoricalInvoiceLinkedPaidAmount = row.HistoricalInvoiceLinkedPaidAmount,
                    HistoricalRemainingAmount = row.HistoricalRemainingAmount,
                    OrdinaryOrphanPaymentCount = row.HistoricalBookingOrdinaryOrphanPaymentCount,
                    OrdinaryOrphanPaymentAmount = row.HistoricalBookingOrdinaryOrphanPaymentAmount,
                    HistoricalBookingOrdinaryOrphanPaymentCount = row.HistoricalBookingOrdinaryOrphanPaymentCount,
                    HistoricalBookingOrdinaryOrphanPaymentAmount = row.HistoricalBookingOrdinaryOrphanPaymentAmount,
                    HistoricalPaymentEvidenceCount = row.HistoricalPaymentEvidenceCount,
                    HistoricalPaymentEvidenceAmount = row.HistoricalPaymentEvidenceAmount,
                    HistoricalAgreedAmount = row.HistoricalAgreedAmount,
                }
                : new ReportingFinanceDailySummary
                {
                    MetricDate = row.MetricDate,
                    BookingsWithInvoiceCount = row.BookingsWithInvoiceCount - row.HistoricalBookingsWithInvoiceCount,
                    TotalInvoicedAmount = row.TotalInvoicedAmount - row.HistoricalInvoicedAmount,
                    TotalPaidAmount = row.TotalPaidAmount - row.HistoricalInvoiceLinkedPaidAmount,
                    TotalRemainingAmount = row.TotalRemainingAmount - row.HistoricalRemainingAmount,
                    TotalPendingPayoutAmount = row.TotalPendingPayoutAmount,
                    TotalScheduledPayoutAmount = row.TotalScheduledPayoutAmount,
                    TotalPaidPayoutAmount = row.TotalPaidPayoutAmount,
                    OrdinaryOrphanPaymentCount = row.OrdinaryOrphanPaymentCount - row.HistoricalBookingOrdinaryOrphanPaymentCount,
                    OrdinaryOrphanPaymentAmount = row.OrdinaryOrphanPaymentAmount - row.HistoricalBookingOrdinaryOrphanPaymentAmount,
                })
            .Where(row =>
                row.BookingsWithInvoiceCount > 0
                || row.TotalInvoicedAmount != 0
                || row.TotalPaidAmount != 0
                || row.TotalRemainingAmount != 0
                || row.TotalPendingPayoutAmount != 0
                || row.TotalScheduledPayoutAmount != 0
                || row.TotalPaidPayoutAmount != 0
                || row.OrdinaryOrphanPaymentCount > 0
                || row.HistoricalPaymentEvidenceCount > 0
                || row.HistoricalAgreedAmount != 0)
            .ToList();
    }

    private static IReadOnlyList<ReportingFinanceStayDailySummary> ApplyStayHistoricalFilter(
        IReadOnlyList<ReportingFinanceStayDailySummary> rows,
        bool includeHistorical,
        bool historicalOnly)
    {
        if (includeHistorical && !historicalOnly)
            return rows;

        return rows
            .Select(row => historicalOnly
                ? new ReportingFinanceStayDailySummary
                {
                    MetricDate = row.MetricDate,
                    BookingSource = row.BookingSource,
                    BookingsWithInvoiceCount = row.HistoricalBookingsWithInvoiceCount,
                    TotalInvoicedAmount = row.HistoricalInvoicedAmount,
                    TotalFinalAmount = row.HistoricalAgreedAmount,
                    HistoricalBookingsCount = row.HistoricalBookingsCount,
                    HistoricalAgreedAmount = row.HistoricalAgreedAmount,
                    HistoricalInvoicedAmount = row.HistoricalInvoicedAmount,
                    HistoricalBookingsWithInvoiceCount = row.HistoricalBookingsWithInvoiceCount,
                }
                : new ReportingFinanceStayDailySummary
                {
                    MetricDate = row.MetricDate,
                    BookingSource = row.BookingSource,
                    BookingsWithInvoiceCount = row.BookingsWithInvoiceCount - row.HistoricalBookingsWithInvoiceCount,
                    TotalInvoicedAmount = row.TotalInvoicedAmount - row.HistoricalInvoicedAmount,
                    TotalFinalAmount = row.TotalFinalAmount - row.HistoricalAgreedAmount,
                })
            .Where(row =>
                row.BookingsWithInvoiceCount > 0
                || row.TotalInvoicedAmount != 0
                || row.TotalFinalAmount != 0
                || row.HistoricalBookingsCount > 0)
            .ToList();
    }

    private IQueryable<ReportingFinanceDailySummary> BuildQuery(DateOnly? dateFrom, DateOnly? dateTo)
    {
        var query = _unitOfWork.ReportingFinanceDailySummaries.AsQueryable();

        if (dateFrom.HasValue)
            query = query.Where(r => r.MetricDate >= dateFrom.Value);

        if (dateTo.HasValue)
            query = query.Where(r => r.MetricDate <= dateTo.Value);

        return query;
    }
}
