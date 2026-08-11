using System.Reflection;
using FluentValidation.TestHelper;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;
using RentalPlatform.API.Authorization;
using RentalPlatform.API.Controllers;
using RentalPlatform.API.DTOs.Requests.ReportsAnalytics;
using RentalPlatform.API.DTOs.Responses.ReportsAnalytics;
using RentalPlatform.API.Validators.ReportsAnalytics;
using RentalPlatform.Data;
using RentalPlatform.Data.ReadModels;
using RentalPlatform.Shared.Constants;
using RentalPlatform.Tests.Infrastructure;
using Xunit;

namespace RentalPlatform.Tests;

[Trait(TestCategories.Name, TestCategories.Fast)]
public sealed class HistoricalReportingContractTests
{
    [Theory]
    [InlineData(typeof(ReportingBookingAnalyticsController), nameof(ReportingBookingAnalyticsController.GetStayDailySummary), "api/internal/reports/bookings/stay-daily")]
    [InlineData(typeof(ReportingFinanceAnalyticsController), nameof(ReportingFinanceAnalyticsController.GetStayDailySummary), "api/internal/reports/finance/stay-daily")]
    [InlineData(typeof(ReportingBookingAnalyticsController), nameof(ReportingBookingAnalyticsController.GetHistoricalReconciliation), "api/internal/reports/bookings/historical-reconciliation")]
    public void CanonicalRoutesUseAnalyticsRead(
        Type controllerType,
        string methodName,
        string route)
    {
        var action = controllerType.GetMethod(methodName, BindingFlags.Instance | BindingFlags.Public);
        Assert.NotNull(action);
        Assert.Equal(route, action!.GetCustomAttribute<HttpGetAttribute>()?.Template);
        Assert.Equal(
            PermissionKeys.AnalyticsRead,
            controllerType.GetCustomAttribute<AuthorizeAttribute>()?.Policy);
    }

    [Fact]
    public void ReportingDtosExposeTheRatifiedPiiFreeDictionary()
    {
        AssertProperties<BookingAnalyticsStayDailySummaryResponse>(
            "MetricDate", "BookingSource", "BookingsCount", "ProspectingBookingsCount",
            "ConfirmedBookingsCount", "CancelledBookingsCount", "CompletedBookingsCount",
            "TotalFinalAmount", "HistoricalBookingsCount",
            "HistoricalProspectingBookingsCount", "HistoricalConfirmedBookingsCount",
            "HistoricalCancelledBookingsCount", "HistoricalCompletedBookingsCount",
            "HistoricalFinalAmount", "HistoricalAgreedAmount");
        AssertProperties<FinanceAnalyticsStayDailySummaryResponse>(
            "MetricDate", "BookingSource", "BookingsWithInvoiceCount",
            "TotalInvoicedAmount", "TotalFinalAmount", "HistoricalBookingsCount",
            "HistoricalAgreedAmount", "HistoricalInvoicedAmount",
            "HistoricalBookingsWithInvoiceCount");
        AssertProperties<FinanceAnalyticsDailySummaryResponse>(
            "OrdinaryOrphanPaymentCount", "OrdinaryOrphanPaymentAmount",
            "HistoricalBookingOrdinaryOrphanPaymentCount",
            "HistoricalBookingOrdinaryOrphanPaymentAmount",
            "HistoricalPaymentEvidenceCount", "HistoricalPaymentEvidenceAmount");
        AssertProperties<FinanceAnalyticsSummaryResponse>(
            "OrdinaryOrphanPaymentCount", "OrdinaryOrphanPaymentAmount",
            "HistoricalBookingOrdinaryOrphanPaymentCount",
            "HistoricalBookingOrdinaryOrphanPaymentAmount",
            "HistoricalPaymentEvidenceCount", "HistoricalPaymentEvidenceAmount");
        AssertProperties<HistoricalEntryReconciliationResponse>(
            "BookingId", "RecordedAt", "ActualBookedAt", "EntryLagDays", "StayStart",
            "StayEnd", "StayNights", "BookingSource", "OriginalSource",
            "HistoricalEntryReason", "BookingStatus", "UnitId", "OwnerId",
            "AgreedAmount", "ActiveInvoiceAmount", "OrdinaryInvoiceLinkedPaidAmount",
            "OrdinaryUnlinkedPaidCount", "OrdinaryUnlinkedPaidAmount",
            "HistoricalPaymentEvidenceCount", "HistoricalPaymentEvidenceAmount",
            "FirstEvidencePaidDate", "LastEvidencePaidDate",
            "OwnerAttributionCorrectionCount", "LastOwnerAttributionCorrectedAt");

        Assert.DoesNotContain(
            typeof(FinanceAnalyticsStayDailySummaryResponse).GetProperties(),
            property => property.Name.Contains("Paid", StringComparison.Ordinal)
                || property.Name.Contains("Remaining", StringComparison.Ordinal)
                || property.Name.Contains("Evidence", StringComparison.Ordinal)
                || property.Name.Contains("Orphan", StringComparison.Ordinal));

        var forbidden = new[]
        {
            "ClientName", "Phone", "Email", "Notes", "ReferenceNumber", "OwnerBankingData"
        };
        Assert.All(
            new[]
            {
                typeof(BookingAnalyticsStayDailySummaryResponse),
                typeof(FinanceAnalyticsStayDailySummaryResponse),
                typeof(HistoricalEntryReconciliationResponse)
            },
            type => Assert.All(forbidden, name => Assert.Null(type.GetProperty(name))));
    }

    [Fact]
    public void ExistingRecordedRoutesDoNotAcquireHistoricalFilterParameters()
    {
        Assert.Null(typeof(GetBookingAnalyticsRequest).GetProperty("IncludeHistorical"));
        Assert.Null(typeof(GetBookingAnalyticsRequest).GetProperty("HistoricalOnly"));
        Assert.Null(typeof(GetFinanceAnalyticsRequest).GetProperty("IncludeHistorical"));
        Assert.Null(typeof(GetFinanceAnalyticsRequest).GetProperty("HistoricalOnly"));
    }

    [Fact]
    public void HistoricalReportingUsesOnlyTheRatifiedBoundedEventNames()
    {
        var root = FindRepositoryRoot();
        var serviceSources = File.ReadAllText(Path.Combine(
                root, "RentalPlatform.Business", "Services", "ReportingBookingAnalyticsService.cs"))
            + File.ReadAllText(Path.Combine(
                root, "RentalPlatform.Business", "Services", "ReportingFinanceAnalyticsService.cs"));
        var filterSource = File.ReadAllText(Path.Combine(
            root, "RentalPlatform.API", "Filters", "ValidationActionFilter.cs"));

        Assert.Contains("reporting.historical.query", serviceSources);
        Assert.Contains("reporting.historical.range_rejected", filterSource);
        Assert.DoesNotContain("ClientName", serviceSources + filterSource, StringComparison.Ordinal);
        Assert.DoesNotContain("ExternalReference", serviceSources + filterSource, StringComparison.Ordinal);
        Assert.DoesNotContain("ReferenceNumber", serviceSources + filterSource, StringComparison.Ordinal);
    }

    [Theory]
    [InlineData(false, true)]
    public void ContradictoryHistoricalFiltersUseStableValidationCode(
        bool includeHistorical,
        bool historicalOnly)
    {
        var validator = new GetHistoricalReportingDailyRequestValidator();
        var result = validator.TestValidate(new GetHistoricalReportingDailyRequest
        {
            DateFrom = new DateOnly(2025, 1, 1),
            DateTo = new DateOnly(2025, 1, 31),
            IncludeHistorical = includeHistorical,
            HistoricalOnly = historicalOnly
        });

        var failure = Assert.Single(result.Errors);
        Assert.Equal(HistoricalErrorCodes.ValidationError, failure.ErrorCode);
    }

    [Fact]
    public void StayRangeUsesTheExactInclusiveLeapDayBoundary()
    {
        var validator = new GetHistoricalReportingDailyRequestValidator();
        var accepted = validator.TestValidate(new GetHistoricalReportingDailyRequest
        {
            DateFrom = new DateOnly(2024, 2, 29),
            DateTo = new DateOnly(2026, 2, 27)
        });
        var rejected = validator.TestValidate(new GetHistoricalReportingDailyRequest
        {
            DateFrom = new DateOnly(2024, 2, 29),
            DateTo = new DateOnly(2026, 2, 28)
        });

        Assert.True(accepted.IsValid);
        Assert.False(rejected.IsValid);
        Assert.All(
            rejected.Errors,
            failure => Assert.Equal(HistoricalErrorCodes.ValidationError, failure.ErrorCode));
    }

    [Theory]
    [InlineData("2025-01", "2026-12", true)]
    [InlineData("2025-01", "2027-01", false)]
    [InlineData("2025-13", "2026-01", false)]
    [InlineData("2026-02", "2026-01", false)]
    public void ReconciliationMonthRangeIsExactAndBounded(
        string from,
        string to,
        bool valid)
    {
        var validator = new GetHistoricalReconciliationRequestValidator();
        var result = validator.TestValidate(new GetHistoricalReconciliationRequest
        {
            StayMonthFrom = from,
            StayMonthTo = to
        });

        Assert.Equal(valid, result.IsValid);
        Assert.All(
            result.Errors,
            failure => Assert.Equal(HistoricalErrorCodes.ValidationError, failure.ErrorCode));
    }

    [Theory]
    [InlineData(true, null)]
    [InlineData(false, null)]
    [InlineData(null, true)]
    [InlineData(null, false)]
    [InlineData(true, false)]
    public void ReconciliationRejectsUnsupportedHistoricalFilters(
        bool? includeHistorical,
        bool? historicalOnly)
    {
        var validator = new GetHistoricalReconciliationRequestValidator();
        var result = validator.TestValidate(new GetHistoricalReconciliationRequest
        {
            StayMonthFrom = "2025-01",
            StayMonthTo = "2025-12",
            IncludeHistorical = includeHistorical,
            HistoricalOnly = historicalOnly
        });

        Assert.False(result.IsValid);
        Assert.All(
            result.Errors,
            failure => Assert.Equal(HistoricalErrorCodes.ValidationError, failure.ErrorCode));
    }

    [Fact]
    public void EfMappingsAreKeylessNamedViewsWithExplicitColumns()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql("Host=127.0.0.1;Port=1;Database=kaza_test_model;Username=test;Password=test")
            .Options;
        using var context = new AppDbContext(options);

        AssertView<ReportingBookingStayDailySummary>(
            context, "reporting_booking_stay_daily_summary", "booking_source");
        AssertView<ReportingFinanceStayDailySummary>(
            context, "reporting_finance_stay_daily_summary", "historical_bookings_with_invoice_count");
        AssertView<ReportingHistoricalEntryReconciliation>(
            context, "reporting_historical_entry_reconciliation", "booking_id");
    }

    [Fact]
    public void Migration0063IsRegisteredOnceAndPreservesTheEightColumnPrefixes()
    {
        var root = FindRepositoryRoot();
        var productionManifest = File.ReadAllText(Path.Combine(root, "infra", "db", "init.prod.sql"));
        var developmentBootstrap = File.ReadAllText(Path.Combine(root, "db", "init.sql"));
        var migration = File.ReadAllText(Path.Combine(
            root,
            "db",
            "migrations",
            "0063_add_historical_reporting_read_models.sql"));

        Assert.Equal(
            1,
            Count(productionManifest, "migrations/0063_add_historical_reporting_read_models.sql"));
        Assert.Equal(1, Count(productionManifest, "'0063'"));
        Assert.Equal(
            1,
            Count(developmentBootstrap, "migrations/0063_add_historical_reporting_read_models.sql"));
        Assert.Contains("CREATE OR REPLACE VIEW reporting_booking_daily_summary", migration);
        Assert.Contains("CREATE OR REPLACE VIEW reporting_finance_daily_summary", migration);
        Assert.DoesNotContain("DROP VIEW reporting_booking_daily_summary", migration);
        Assert.DoesNotContain("DROP VIEW reporting_finance_daily_summary", migration);
        Assert.DoesNotMatch(@"(?i)\b(DROP|DELETE|TRUNCATE)\b", migration);
        Assert.DoesNotMatch(@"(?i)\b(CREATE|ALTER)\s+TABLE\b", migration);
        Assert.DoesNotMatch(@"(?i)\bCREATE\s+(UNIQUE\s+)?INDEX\b", migration);
        Assert.DoesNotMatch(@"(?i)\bCREATE\s+TRIGGER\b", migration);
    }

    private static void AssertView<T>(AppDbContext context, string viewName, string columnName)
        where T : class
    {
        var entity = context.Model.FindEntityType(typeof(T));
        Assert.NotNull(entity);
        Assert.Null(entity!.FindPrimaryKey());
        Assert.Equal(viewName, entity.GetViewName());
        Assert.Contains(
            entity.GetProperties(),
            property => property.GetColumnName(StoreObjectIdentifier.View(viewName, null)) == columnName);
    }

    private static void AssertProperties<T>(params string[] propertyNames)
    {
        var properties = typeof(T).GetProperties().Select(property => property.Name).ToHashSet();
        Assert.All(propertyNames, name => Assert.Contains(name, properties));
    }

    private static int Count(string source, string value) =>
        source.Split(value, StringSplitOptions.None).Length - 1;

    private static string FindRepositoryRoot()
    {
        for (var directory = new DirectoryInfo(AppContext.BaseDirectory);
             directory is not null;
             directory = directory.Parent)
        {
            if (File.Exists(Path.Combine(directory.FullName, "RentalPlatform.slnx")))
                return directory.FullName;
        }

        throw new DirectoryNotFoundException("Could not locate RentalPlatform.slnx.");
    }
}
