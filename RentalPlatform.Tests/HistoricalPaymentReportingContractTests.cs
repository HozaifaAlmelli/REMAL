using Microsoft.AspNetCore.Mvc;
using RentalPlatform.API.Controllers;
using RentalPlatform.API.DTOs.Requests.ReportsAnalytics;
using RentalPlatform.API.DTOs.Responses.Finance;
using RentalPlatform.API.DTOs.Responses.ReportsAnalytics;
using RentalPlatform.API.Models;
using RentalPlatform.Business.Interfaces;
using RentalPlatform.Business.Models;
using RentalPlatform.Data.ReadModels;
using Xunit;

namespace RentalPlatform.Tests;

[Trait(TestCategories.Name, TestCategories.Fast)]
public sealed class HistoricalPaymentReportingContractTests
{
    [Theory]
    [InlineData(typeof(InvoiceBalanceResult))]
    [InlineData(typeof(BookingFinanceSnapshotResult))]
    [InlineData(typeof(FinanceAnalyticsSummaryResult))]
    [InlineData(typeof(InvoiceBalanceResponse))]
    [InlineData(typeof(BookingFinanceSnapshotResponse))]
    [InlineData(typeof(FinanceAnalyticsSummaryResponse))]
    public void SettlementResponsesExposeDedicatedEvidenceAggregates(Type responseType)
    {
        Assert.NotNull(responseType.GetProperty("HistoricalPaymentEvidenceCount"));
        Assert.NotNull(responseType.GetProperty("HistoricalPaymentEvidenceAmount"));
    }

    [Fact]
    public void ExistingSettlementFieldsRemainAppendOnlyCompatible()
    {
        AssertProperties<InvoiceBalanceResponse>(
            "InvoiceId", "TotalAmount", "PaidAmount", "RemainingAmount", "IsFullyPaid");
        AssertProperties<BookingFinanceSnapshotResponse>(
            "BookingId", "InvoiceId", "InvoiceStatus", "InvoicedAmount", "PaidAmount",
            "RemainingAmount", "OwnerPayoutStatus");
        AssertProperties<FinanceAnalyticsSummaryResponse>(
            "DateFrom", "DateTo", "TotalBookingsWithInvoiceCount", "TotalInvoicedAmount",
            "TotalPaidAmount", "TotalRemainingAmount", "TotalPendingPayoutAmount",
            "TotalScheduledPayoutAmount", "TotalPaidPayoutAmount");
    }

    [Fact]
    public void RecordedDailyResponseNamesEvidenceByItsRecordedAxisContext()
    {
        Assert.NotNull(typeof(FinanceAnalyticsDailySummaryResponse)
            .GetProperty("HistoricalEvidenceRecordedCount"));
        Assert.NotNull(typeof(FinanceAnalyticsDailySummaryResponse)
            .GetProperty("HistoricalEvidenceRecordedAmount"));
        Assert.Null(typeof(FinanceAnalyticsDailySummaryResponse)
            .GetProperty("HistoricalPaymentEvidenceCount"));
    }

    [Fact]
    public async Task ExistingControllersMapDedicatedEvidenceAggregates()
    {
        var invoiceId = Guid.NewGuid();
        var bookingId = Guid.NewGuid();
        var reporting = new ReportingStub(new FinanceAnalyticsSummaryResult
        {
            HistoricalPaymentEvidenceCount = 2,
            HistoricalPaymentEvidenceAmount = 700m
        });
        var finance = new FinanceStub(
            new InvoiceBalanceResult
            {
                InvoiceId = invoiceId,
                HistoricalPaymentEvidenceCount = 3,
                HistoricalPaymentEvidenceAmount = 800m
            },
            new BookingFinanceSnapshotResult
            {
                BookingId = bookingId,
                HistoricalPaymentEvidenceCount = 4,
                HistoricalPaymentEvidenceAmount = 900m
            });
        var financeController = new FinanceSummaryController(finance, reporting);

        var overview = Assert.IsType<OkObjectResult>((await financeController.GetFinanceOverview(
            new GetFinanceAnalyticsRequest(), default)).Result);
        var overviewData = Assert.IsType<ApiResponse<FinanceAnalyticsSummaryResponse>>(overview.Value).Data!;
        Assert.Equal(2, overviewData.HistoricalPaymentEvidenceCount);
        Assert.Equal(700m, overviewData.HistoricalPaymentEvidenceAmount);

        var invoice = Assert.IsType<OkObjectResult>((await financeController
            .GetInvoiceBalance(invoiceId)).Result);
        var invoiceData = Assert.IsType<ApiResponse<InvoiceBalanceResponse>>(invoice.Value).Data!;
        Assert.Equal(3, invoiceData.HistoricalPaymentEvidenceCount);
        Assert.Equal(800m, invoiceData.HistoricalPaymentEvidenceAmount);

        var booking = Assert.IsType<OkObjectResult>((await financeController
            .GetBookingFinanceSnapshot(bookingId)).Result);
        var bookingData = Assert.IsType<ApiResponse<BookingFinanceSnapshotResponse>>(booking.Value).Data!;
        Assert.Equal(4, bookingData.HistoricalPaymentEvidenceCount);
        Assert.Equal(900m, bookingData.HistoricalPaymentEvidenceAmount);

        var reportsController = new ReportingFinanceAnalyticsController(reporting);
        var report = Assert.IsType<OkObjectResult>((await reportsController.GetSummary(
            new GetFinanceAnalyticsRequest(), default)).Result);
        var reportData = Assert.IsType<ApiResponse<FinanceAnalyticsSummaryResponse>>(report.Value).Data!;
        Assert.Equal(2, reportData.HistoricalPaymentEvidenceCount);
        Assert.Equal(700m, reportData.HistoricalPaymentEvidenceAmount);
    }

    private static void AssertProperties<T>(params string[] names)
    {
        var properties = typeof(T).GetProperties().Select(property => property.Name).ToHashSet();
        Assert.All(names, name => Assert.Contains(name, properties));
    }

    private sealed class ReportingStub(FinanceAnalyticsSummaryResult summary)
        : IReportingFinanceAnalyticsService
    {
        public Task<IReadOnlyList<ReportingFinanceDailySummary>> GetDailySummaryAsync(
            DateOnly? dateFrom = null,
            DateOnly? dateTo = null,
            CancellationToken cancellationToken = default) =>
            Task.FromResult<IReadOnlyList<ReportingFinanceDailySummary>>([]);

        public Task<FinanceAnalyticsSummaryResult> GetSummaryAsync(
            DateOnly? dateFrom = null,
            DateOnly? dateTo = null,
            CancellationToken cancellationToken = default) => Task.FromResult(summary);

        public Task<IReadOnlyList<ReportingFinanceStayDailySummary>> GetStayDailySummaryAsync(
            DateOnly dateFrom,
            DateOnly dateTo,
            bool includeHistorical = true,
            bool historicalOnly = false,
            CancellationToken cancellationToken = default) =>
            Task.FromResult<IReadOnlyList<ReportingFinanceStayDailySummary>>([]);
    }

    private sealed class FinanceStub(
        InvoiceBalanceResult invoice,
        BookingFinanceSnapshotResult booking) : IFinanceSummaryService
    {
        public Task<InvoiceBalanceResult> GetInvoiceBalanceAsync(
            Guid invoiceId,
            CancellationToken cancellationToken = default) => Task.FromResult(invoice);

        public Task<BookingFinanceSnapshotResult> GetBookingFinanceSnapshotAsync(
            Guid bookingId,
            CancellationToken cancellationToken = default) => Task.FromResult(booking);

        public Task<OwnerPayoutSummaryResult> GetOwnerPayoutSummaryAsync(
            Guid ownerId,
            CancellationToken cancellationToken = default) =>
            Task.FromResult(new OwnerPayoutSummaryResult { OwnerId = ownerId });
    }
}
