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

        return Ok(ApiResponse<IReadOnlyList<BookingAnalyticsStayDailySummaryResponse>>.CreateSuccess(
            rows.Select(MapToStayDailyResponse).ToList()));
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

        return Ok(ApiResponse<IReadOnlyList<HistoricalEntryReconciliationResponse>>.CreateSuccess(
            rows.Select(MapToReconciliationResponse).ToList()));
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
            HistoricalFinalAmount       = result.HistoricalFinalAmount,
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
            MetricDate = row.MetricDate,
            BookingSource = row.BookingSource,
            BookingsCount = row.BookingsCount,
            ProspectingBookingsCount = row.ProspectingBookingsCount,
            ConfirmedBookingsCount = row.ConfirmedBookingsCount,
            CancelledBookingsCount = row.CancelledBookingsCount,
            CompletedBookingsCount = row.CompletedBookingsCount,
            TotalFinalAmount = row.TotalFinalAmount,
            HistoricalBookingsCount = row.HistoricalBookingsCount,
            HistoricalProspectingBookingsCount = row.HistoricalProspectingBookingsCount,
            HistoricalConfirmedBookingsCount = row.HistoricalConfirmedBookingsCount,
            HistoricalCancelledBookingsCount = row.HistoricalCancelledBookingsCount,
            HistoricalCompletedBookingsCount = row.HistoricalCompletedBookingsCount,
            HistoricalFinalAmount = row.HistoricalFinalAmount,
            HistoricalAgreedAmount = row.HistoricalAgreedAmount,
        };

    private static HistoricalEntryReconciliationResponse MapToReconciliationResponse(
        RentalPlatform.Data.ReadModels.ReportingHistoricalEntryReconciliation row) =>
        new()
        {
            BookingId = row.BookingId,
            RecordedAt = row.RecordedAt,
            ActualBookedAt = row.ActualBookedAt,
            EntryLagDays = row.EntryLagDays,
            StayStart = row.StayStart,
            StayEnd = row.StayEnd,
            StayNights = row.StayNights,
            BookingSource = row.BookingSource,
            OriginalSource = row.OriginalSource,
            HistoricalEntryReason = row.HistoricalEntryReason,
            BookingStatus = row.BookingStatus,
            UnitId = row.UnitId,
            OwnerId = row.OwnerId,
            AgreedAmount = row.AgreedAmount,
            ActiveInvoiceAmount = row.ActiveInvoiceAmount,
            OrdinaryInvoiceLinkedPaidAmount = row.OrdinaryInvoiceLinkedPaidAmount,
            OrdinaryUnlinkedPaidCount = row.OrdinaryUnlinkedPaidCount,
            OrdinaryUnlinkedPaidAmount = row.OrdinaryUnlinkedPaidAmount,
            HistoricalPaymentEvidenceCount = row.HistoricalPaymentEvidenceCount,
            HistoricalPaymentEvidenceAmount = row.HistoricalPaymentEvidenceAmount,
            FirstEvidencePaidDate = row.FirstEvidencePaidDate,
            LastEvidencePaidDate = row.LastEvidencePaidDate,
            OwnerAttributionCorrectionCount = row.OwnerAttributionCorrectionCount,
            LastOwnerAttributionCorrectedAt = row.LastOwnerAttributionCorrectedAt,
        };

    private static DateOnly ParseMonth(string value) =>
        DateOnly.ParseExact(
            $"{value}-01",
            "yyyy-MM-dd",
            CultureInfo.InvariantCulture);
}
