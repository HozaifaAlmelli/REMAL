using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RentalPlatform.API.DTOs.Requests.ReportsAnalytics;
using RentalPlatform.API.DTOs.Responses.ReportsAnalytics;
using RentalPlatform.API.Models;
using RentalPlatform.API.Authorization;
using RentalPlatform.Business.Interfaces;

namespace RentalPlatform.API.Controllers;

[ApiController]
[Authorize(Policy = PermissionKeys.AnalyticsRead)]
public class ReportingFinanceAnalyticsController : ControllerBase
{
    private readonly IReportingFinanceAnalyticsService _service;

    public ReportingFinanceAnalyticsController(IReportingFinanceAnalyticsService service)
    {
        _service = service;
    }

    // GET /api/internal/reports/finance/daily
    [HttpGet("api/internal/reports/finance/daily")]
    public async Task<ActionResult<ApiResponse<IReadOnlyList<FinanceAnalyticsDailySummaryResponse>>>> GetDailySummary(
        [FromQuery] GetFinanceAnalyticsRequest request,
        CancellationToken cancellationToken)
    {
        var rows = await _service.GetDailySummaryAsync(
            request.DateFrom,
            request.DateTo,
            cancellationToken);

        var totalCount = rows.Count;
        var paged = rows
            .Skip((request.Page - 1) * request.PageSize)
            .Take(request.PageSize)
            .Select(MapToDailyResponse)
            .ToList();

        var totalPages = (int)Math.Ceiling(totalCount / (double)request.PageSize);
        if (totalPages == 0) totalPages = 1;

        var pagination = new PaginationMeta(totalCount, request.Page, request.PageSize, totalPages);
        return Ok(ApiResponse<IReadOnlyList<FinanceAnalyticsDailySummaryResponse>>.CreateSuccess(paged, pagination: pagination));
    }

    // GET /api/internal/reports/finance/summary
    [HttpGet("api/internal/reports/finance/summary")]
    public async Task<ActionResult<ApiResponse<FinanceAnalyticsSummaryResponse>>> GetSummary(
        [FromQuery] GetFinanceAnalyticsRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _service.GetSummaryAsync(
            request.DateFrom,
            request.DateTo,
            cancellationToken);

        return Ok(ApiResponse<FinanceAnalyticsSummaryResponse>.CreateSuccess(MapToSummaryResponse(result)));
    }

    // GET /api/internal/reports/finance/stay-daily
    [HttpGet("api/internal/reports/finance/stay-daily")]
    public async Task<ActionResult<ApiResponse<IReadOnlyList<FinanceAnalyticsStayDailySummaryResponse>>>> GetStayDailySummary(
        [FromQuery] GetHistoricalReportingDailyRequest request,
        CancellationToken cancellationToken)
    {
        var rows = await _service.GetStayDailySummaryAsync(
            request.DateFrom,
            request.DateTo,
            request.IncludeHistorical,
            request.HistoricalOnly,
            cancellationToken);

        var totalCount = rows.Count;
        var paged = rows
            .Skip((request.Page - 1) * request.PageSize)
            .Take(request.PageSize)
            .Select(MapToStayDailyResponse)
            .ToList();
        var totalPages = Math.Max(1, (int)Math.Ceiling(totalCount / (double)request.PageSize));
        var pagination = new PaginationMeta(totalCount, request.Page, request.PageSize, totalPages);

        return Ok(ApiResponse<IReadOnlyList<FinanceAnalyticsStayDailySummaryResponse>>.CreateSuccess(
            paged,
            pagination: pagination));
    }

    // -----------------------------------------------------------------------
    // Private mappers — no read-model properties exposed directly
    // -----------------------------------------------------------------------

    private static FinanceAnalyticsDailySummaryResponse MapToDailyResponse(
        RentalPlatform.Data.ReadModels.ReportingFinanceDailySummary row) =>
        new()
        {
            MetricDate                  = row.MetricDate,
            BookingsWithInvoiceCount    = row.BookingsWithInvoiceCount,
            TotalInvoicedAmount         = row.TotalInvoicedAmount,
            TotalPaidAmount             = row.TotalPaidAmount,
            TotalRemainingAmount        = row.TotalRemainingAmount,
            TotalPendingPayoutAmount    = row.TotalPendingPayoutAmount,
            TotalScheduledPayoutAmount  = row.TotalScheduledPayoutAmount,
            TotalPaidPayoutAmount       = row.TotalPaidPayoutAmount,
            HistoricalBookingsCount = row.HistoricalBookingsCount,
            HistoricalAgreedAmount = row.HistoricalAgreedAmount,
            HistoricalBookingsWithInvoiceCount = row.HistoricalBookingsWithInvoiceCount,
            HistoricalInvoicedAmount = row.HistoricalInvoicedAmount,
            OrdinaryUnlinkedPaidCount = row.OrdinaryUnlinkedPaidCount,
            OrdinaryUnlinkedPaidAmount = row.OrdinaryUnlinkedPaidAmount,
            HistoricalEvidenceRecordedCount = row.HistoricalEvidenceRecordedCount,
            HistoricalEvidenceRecordedAmount = row.HistoricalEvidenceRecordedAmount,
        };

    private static FinanceAnalyticsSummaryResponse MapToSummaryResponse(
        RentalPlatform.Business.Models.FinanceAnalyticsSummaryResult result) =>
        new()
        {
            DateFrom                        = result.DateFrom,
            DateTo                          = result.DateTo,
            TotalBookingsWithInvoiceCount   = result.TotalBookingsWithInvoiceCount,
            TotalInvoicedAmount             = result.TotalInvoicedAmount,
            TotalPaidAmount                 = result.TotalPaidAmount,
            TotalRemainingAmount            = result.TotalRemainingAmount,
            HistoricalPaymentEvidenceCount  = result.HistoricalPaymentEvidenceCount,
            HistoricalPaymentEvidenceAmount = result.HistoricalPaymentEvidenceAmount,
            TotalPendingPayoutAmount        = result.TotalPendingPayoutAmount,
            TotalScheduledPayoutAmount      = result.TotalScheduledPayoutAmount,
            TotalPaidPayoutAmount           = result.TotalPaidPayoutAmount,
            HistoricalBookingsCount = result.HistoricalBookingsCount,
            HistoricalAgreedAmount = result.HistoricalAgreedAmount,
            HistoricalBookingsWithInvoiceCount = result.HistoricalBookingsWithInvoiceCount,
            HistoricalInvoicedAmount = result.HistoricalInvoicedAmount,
            OrdinaryUnlinkedPaidCount = result.OrdinaryUnlinkedPaidCount,
            OrdinaryUnlinkedPaidAmount = result.OrdinaryUnlinkedPaidAmount,
        };

    private static FinanceAnalyticsStayDailySummaryResponse MapToStayDailyResponse(
        RentalPlatform.Data.ReadModels.ReportingFinanceStayDailySummary row) =>
        new()
        {
            StayStartDate = row.StayStartDate,
            StayBookingsCount = row.StayBookingsCount,
            BookingsWithInvoiceCount = row.BookingsWithInvoiceCount,
            TotalInvoicedAmount = row.TotalInvoicedAmount,
            TotalFinalAmount = row.TotalFinalAmount,
            HistoricalBookingsCount = row.HistoricalBookingsCount,
            HistoricalAgreedAmount = row.HistoricalAgreedAmount,
            HistoricalBookingsWithInvoiceCount = row.HistoricalBookingsWithInvoiceCount,
            HistoricalInvoicedAmount = row.HistoricalInvoicedAmount,
        };
}
