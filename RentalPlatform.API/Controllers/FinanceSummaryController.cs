using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RentalPlatform.API.DTOs.Responses.Finance;
using RentalPlatform.API.DTOs.Requests.ReportsAnalytics;
using RentalPlatform.API.DTOs.Responses.ReportsAnalytics;
using RentalPlatform.API.Models;
using RentalPlatform.API.Authorization;
using RentalPlatform.Business.Interfaces;
using System;
using System.Threading.Tasks;

namespace RentalPlatform.API.Controllers;

[ApiController]
public class FinanceSummaryController : ControllerBase
{
    private readonly IFinanceSummaryService _financeSummaryService;
    private readonly IReportingFinanceAnalyticsService _reportingFinanceService;

    public FinanceSummaryController(
        IFinanceSummaryService financeSummaryService,
        IReportingFinanceAnalyticsService reportingFinanceService)
    {
        _financeSummaryService = financeSummaryService;
        _reportingFinanceService = reportingFinanceService;
    }

    [HttpGet("api/internal/finance/overview")]
    [Authorize(Policy = PermissionKeys.FinanceOverview)]
    public async Task<ActionResult<ApiResponse<FinanceAnalyticsSummaryResponse>>> GetFinanceOverview(
        [FromQuery] GetFinanceAnalyticsRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _reportingFinanceService.GetSummaryAsync(
            request.DateFrom,
            request.DateTo,
            cancellationToken);

        return Ok(ApiResponse<FinanceAnalyticsSummaryResponse>.CreateSuccess(
            new FinanceAnalyticsSummaryResponse
            {
                DateFrom = result.DateFrom,
                DateTo = result.DateTo,
                TotalBookingsWithInvoiceCount = result.TotalBookingsWithInvoiceCount,
                TotalInvoicedAmount = result.TotalInvoicedAmount,
                TotalPaidAmount = result.TotalPaidAmount,
                TotalRemainingAmount = result.TotalRemainingAmount,
                HistoricalPaymentEvidenceCount = result.HistoricalPaymentEvidenceCount,
                HistoricalPaymentEvidenceAmount = result.HistoricalPaymentEvidenceAmount,
                TotalPendingPayoutAmount = result.TotalPendingPayoutAmount,
                TotalScheduledPayoutAmount = result.TotalScheduledPayoutAmount,
                TotalPaidPayoutAmount = result.TotalPaidPayoutAmount
            }));
    }

    // GET /api/internal/invoices/{invoiceId}/balance
    [HttpGet("api/internal/invoices/{invoiceId}/balance")]
    [Authorize(Policy = PermissionKeys.FinanceOverview)]
    public async Task<ActionResult<ApiResponse<InvoiceBalanceResponse>>> GetInvoiceBalance(Guid invoiceId)
    {
        var summary = await _financeSummaryService.GetInvoiceBalanceAsync(invoiceId);

        return Ok(ApiResponse<InvoiceBalanceResponse>.CreateSuccess(new InvoiceBalanceResponse
        {
            InvoiceId = summary.InvoiceId,
            TotalAmount = summary.TotalAmount,
            PaidAmount = summary.PaidAmount,
            RemainingAmount = summary.RemainingAmount,
            IsFullyPaid = summary.IsFullyPaid,
            HistoricalPaymentEvidenceCount = summary.HistoricalPaymentEvidenceCount,
            HistoricalPaymentEvidenceAmount = summary.HistoricalPaymentEvidenceAmount
        }));
    }

    // GET /api/internal/bookings/{bookingId}/finance-snapshot
    [HttpGet("api/internal/bookings/{bookingId}/finance-snapshot")]
    [Authorize(Policy = PermissionKeys.FinanceOverview)]
    public async Task<ActionResult<ApiResponse<BookingFinanceSnapshotResponse>>> GetBookingFinanceSnapshot(Guid bookingId)
    {
        var summary = await _financeSummaryService.GetBookingFinanceSnapshotAsync(bookingId);

        return Ok(ApiResponse<BookingFinanceSnapshotResponse>.CreateSuccess(new BookingFinanceSnapshotResponse
        {
            BookingId = summary.BookingId,
            InvoiceId = summary.InvoiceId,
            InvoiceStatus = summary.InvoiceStatus,
            InvoicedAmount = summary.InvoicedAmount,
            PaidAmount = summary.PaidAmount,
            RemainingAmount = summary.RemainingAmount,
            HistoricalPaymentEvidenceCount = summary.HistoricalPaymentEvidenceCount,
            HistoricalPaymentEvidenceAmount = summary.HistoricalPaymentEvidenceAmount,
            OwnerPayoutStatus = summary.OwnerPayoutStatus
        }));
    }

    // GET /api/internal/owners/{ownerId}/payout-summary
    [HttpGet("api/internal/owners/{ownerId}/payout-summary")]
    [Authorize(Policy = PermissionKeys.FinanceOverview)]
    public async Task<ActionResult<ApiResponse<OwnerPayoutSummaryResponse>>> GetOwnerPayoutSummary(Guid ownerId)
    {
        var summary = await _financeSummaryService.GetOwnerPayoutSummaryAsync(ownerId);

        return Ok(ApiResponse<OwnerPayoutSummaryResponse>.CreateSuccess(new OwnerPayoutSummaryResponse
        {
            OwnerId = summary.OwnerId,
            TotalPending = summary.TotalPending,
            TotalScheduled = summary.TotalScheduled,
            TotalPaid = summary.TotalPaid
        }));
    }
}
