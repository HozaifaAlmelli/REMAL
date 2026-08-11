using System;
using System.Collections.Generic;
using System.Linq;
using System.Globalization;
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
public class ReportingBookingAnalyticsController : ControllerBase
{
    private readonly IReportingBookingAnalyticsService _service;

    public ReportingBookingAnalyticsController(IReportingBookingAnalyticsService service)
    {
        _service = service;
    }

    // GET /api/internal/reports/bookings/daily
    [HttpGet("api/internal/reports/bookings/daily")]
    public async Task<ActionResult<ApiResponse<IReadOnlyList<BookingAnalyticsDailySummaryResponse>>>> GetDailySummary(
        [FromQuery] GetBookingAnalyticsRequest request,
        CancellationToken cancellationToken)
    {
        var rows = await _service.GetDailySummaryAsync(
            request.DateFrom,
            request.DateTo,
            request.BookingSource,
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
        return Ok(ApiResponse<IReadOnlyList<BookingAnalyticsDailySummaryResponse>>.CreateSuccess(paged, pagination: pagination));
    }

    // GET /api/internal/reports/bookings/summary
    [HttpGet("api/internal/reports/bookings/summary")]
    public async Task<ActionResult<ApiResponse<BookingAnalyticsSummaryResponse>>> GetSummary(
        [FromQuery] GetBookingAnalyticsRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _service.GetSummaryAsync(
            request.DateFrom,
            request.DateTo,
            request.BookingSource,
            cancellationToken);

        return Ok(ApiResponse<BookingAnalyticsSummaryResponse>.CreateSuccess(MapToSummaryResponse(result)));
    }

    // GET /api/internal/reports/bookings/stay-daily
    [HttpGet("api/internal/reports/bookings/stay-daily")]
    public async Task<ActionResult<ApiResponse<IReadOnlyList<BookingAnalyticsStayDailySummaryResponse>>>> GetStayDailySummary(
        [FromQuery] GetHistoricalReportingDailyRequest request,
        CancellationToken cancellationToken)
    {
        var rows = await _service.GetStayDailySummaryAsync(
            request.DateFrom,
            request.DateTo,
            request.IncludeHistorical,
            request.HistoricalOnly,
            cancellationToken);

        var pagination = CreatePagination(rows.Count, request.Page, request.PageSize);
        var paged = rows
            .Skip((request.Page - 1) * request.PageSize)
            .Take(request.PageSize)
            .Select(MapToStayDailyResponse)
            .ToList();

        return Ok(ApiResponse<IReadOnlyList<BookingAnalyticsStayDailySummaryResponse>>.CreateSuccess(
            paged,
            pagination: pagination));
    }

    // GET /api/internal/reports/bookings/historical-reconciliation
    [HttpGet("api/internal/reports/bookings/historical-reconciliation")]
    public async Task<ActionResult<ApiResponse<IReadOnlyList<HistoricalEntryReconciliationResponse>>>> GetHistoricalReconciliation(
        [FromQuery] GetHistoricalReconciliationRequest request,
        CancellationToken cancellationToken)
    {
        var stayMonthFrom = ParseMonth(request.StayMonthFrom);
        var stayMonthTo = ParseMonth(request.StayMonthTo);
        var rows = await _service.GetHistoricalReconciliationAsync(
            stayMonthFrom,
            stayMonthTo,
            cancellationToken);

        var pagination = CreatePagination(rows.Count, request.Page, request.PageSize);
        var paged = rows
            .Skip((request.Page - 1) * request.PageSize)
            .Take(request.PageSize)
            .Select(MapToReconciliationResponse)
            .ToList();

        return Ok(ApiResponse<IReadOnlyList<HistoricalEntryReconciliationResponse>>.CreateSuccess(
            paged,
            pagination: pagination));
    }

    // -----------------------------------------------------------------------
    // Private mappers — no read-model properties exposed directly
    // -----------------------------------------------------------------------

    private static BookingAnalyticsDailySummaryResponse MapToDailyResponse(
        RentalPlatform.Data.ReadModels.ReportingBookingDailySummary row) =>
        new()
        {
            MetricDate               = row.MetricDate,
            BookingSource            = row.BookingSource,
            BookingsCreatedCount     = row.BookingsCreatedCount,
            ProspectingBookingsCount = row.ProspectingBookingsCount,
            ConfirmedBookingsCount   = row.ConfirmedBookingsCount,
            CancelledBookingsCount   = row.CancelledBookingsCount,
            CompletedBookingsCount   = row.CompletedBookingsCount,
            TotalFinalAmount         = row.TotalFinalAmount,
            HistoricalBookingsCount = row.HistoricalBookingsCount,
            HistoricalAgreedAmount = row.HistoricalAgreedAmount,
            HistoricalLegacySystemBookingsCount = row.HistoricalLegacySystemBookingsCount,
            HistoricalExternalPlatformBookingsCount = row.HistoricalExternalPlatformBookingsCount,
            HistoricalOfflineRecordBookingsCount = row.HistoricalOfflineRecordBookingsCount,
            HistoricalOtherSourceBookingsCount = row.HistoricalOtherSourceBookingsCount,
        };

    private static BookingAnalyticsSummaryResponse MapToSummaryResponse(
        RentalPlatform.Business.Models.BookingAnalyticsSummaryResult result) =>
        new()
        {
            DateFrom                    = result.DateFrom,
            DateTo                      = result.DateTo,
            BookingSource               = result.BookingSource,
            TotalBookingsCreatedCount   = result.TotalBookingsCreatedCount,
            TotalProspectingBookingsCount = result.TotalProspectingBookingsCount,
            TotalConfirmedBookingsCount = result.TotalConfirmedBookingsCount,
            TotalCancelledBookingsCount = result.TotalCancelledBookingsCount,
            TotalCompletedBookingsCount = result.TotalCompletedBookingsCount,
            TotalFinalAmount            = result.TotalFinalAmount,
            HistoricalBookingsCount     = result.HistoricalBookingsCount,
            HistoricalAgreedAmount      = result.HistoricalAgreedAmount,
            HistoricalLegacySystemBookingsCount = result.HistoricalLegacySystemBookingsCount,
            HistoricalExternalPlatformBookingsCount = result.HistoricalExternalPlatformBookingsCount,
            HistoricalOfflineRecordBookingsCount = result.HistoricalOfflineRecordBookingsCount,
            HistoricalOtherSourceBookingsCount = result.HistoricalOtherSourceBookingsCount,
        };

    private static BookingAnalyticsStayDailySummaryResponse MapToStayDailyResponse(
        RentalPlatform.Data.ReadModels.ReportingBookingStayDailySummary row) =>
        new()
        {
            StayStartDate = row.StayStartDate,
            BookingSource = row.BookingSource,
            StayBookingsCount = row.StayBookingsCount,
            ProspectingBookingsCount = row.ProspectingBookingsCount,
            ConfirmedBookingsCount = row.ConfirmedBookingsCount,
            CancelledBookingsCount = row.CancelledBookingsCount,
            CompletedBookingsCount = row.CompletedBookingsCount,
            TotalFinalAmount = row.TotalFinalAmount,
            HistoricalBookingsCount = row.HistoricalBookingsCount,
            HistoricalAgreedAmount = row.HistoricalAgreedAmount,
            HistoricalLegacySystemBookingsCount = row.HistoricalLegacySystemBookingsCount,
            HistoricalExternalPlatformBookingsCount = row.HistoricalExternalPlatformBookingsCount,
            HistoricalOfflineRecordBookingsCount = row.HistoricalOfflineRecordBookingsCount,
            HistoricalOtherSourceBookingsCount = row.HistoricalOtherSourceBookingsCount,
        };

    private static HistoricalEntryReconciliationResponse MapToReconciliationResponse(
        RentalPlatform.Data.ReadModels.ReportingHistoricalEntryReconciliation row) =>
        new()
        {
            BookingId = row.BookingId,
            RecordedDate = row.RecordedDate,
            RecordedAt = row.RecordedAt,
            ActualBookedAt = row.ActualBookedAt,
            EntryLagDays = row.EntryLagDays,
            StayStartDate = row.StayStartDate,
            StayEndDate = row.StayEndDate,
            StayNights = row.StayNights,
            BookingSource = row.BookingSource,
            OriginalSource = row.OriginalSource,
            HistoricalEntryReason = row.HistoricalEntryReason,
            BookingStatus = row.BookingStatus,
            UnitId = row.UnitId,
            OwnerId = row.OwnerId,
            AgreedAmount = row.AgreedAmount,
            InvoicedAmount = row.InvoicedAmount,
            InvoiceLinkedPaidAmount = row.InvoiceLinkedPaidAmount,
            OrdinaryUnlinkedPaidCount = row.OrdinaryUnlinkedPaidCount,
            OrdinaryUnlinkedPaidAmount = row.OrdinaryUnlinkedPaidAmount,
            HistoricalPaymentEvidenceCount = row.HistoricalPaymentEvidenceCount,
            HistoricalPaymentEvidenceAmount = row.HistoricalPaymentEvidenceAmount,
            FirstEvidencePaidDate = row.FirstEvidencePaidDate,
            LastEvidencePaidDate = row.LastEvidencePaidDate,
            OwnerAttributionCorrectionCount = row.OwnerAttributionCorrectionCount,
            LastOwnerAttributionCorrectedAt = row.LastOwnerAttributionCorrectedAt,
        };

    private static PaginationMeta CreatePagination(int totalCount, int page, int pageSize)
    {
        var totalPages = Math.Max(1, (int)Math.Ceiling(totalCount / (double)pageSize));
        return new PaginationMeta(totalCount, page, pageSize, totalPages);
    }

    private static DateOnly ParseMonth(string value) =>
        DateOnly.ParseExact(
            $"{value}-01",
            "yyyy-MM-dd",
            CultureInfo.InvariantCulture);
}
