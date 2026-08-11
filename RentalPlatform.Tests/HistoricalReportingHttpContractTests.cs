using System.Net;
using System.Security.Claims;
using System.Text.Encodings.Web;
using System.Text.Json;
using FluentValidation;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using RentalPlatform.API.Authorization;
using RentalPlatform.API.Controllers;
using RentalPlatform.API.DTOs.Requests.ReportsAnalytics;
using RentalPlatform.API.Filters;
using RentalPlatform.API.Models;
using RentalPlatform.API.Validators.ReportsAnalytics;
using RentalPlatform.Business.Interfaces;
using RentalPlatform.Business.Models;
using RentalPlatform.Data.ReadModels;
using RentalPlatform.Shared.Constants;
using Xunit;

namespace RentalPlatform.Tests;

[Trait(TestCategories.Name, TestCategories.Fast)]
public sealed class HistoricalReportingHttpContractTests
{
    [Theory]
    [InlineData("/api/internal/reports/bookings/stay-daily?dateFrom=2025-01-01&dateTo=2025-01-31")]
    [InlineData("/api/internal/reports/finance/stay-daily?dateFrom=2025-01-01&dateTo=2025-01-31")]
    [InlineData("/api/internal/reports/bookings/historical-reconciliation?stayMonthFrom=2025-01&stayMonthTo=2025-12")]
    public async Task CanonicalRoutesRequireAnalyticsRead(string path)
    {
        await using var application = await TestApplication.StartAsync();

        using var denied = Request(path, PermissionKeys.BookingsRecordHistorical);
        using var allowed = Request(path, PermissionKeys.AnalyticsRead);

        Assert.Equal(HttpStatusCode.Forbidden, (await application.Client.SendAsync(denied)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await application.Client.SendAsync(allowed)).StatusCode);
    }

    [Theory]
    [InlineData("/api/internal/reports/bookings/stay-daily?dateFrom=2025-01-01&dateTo=2025-01-31&includeHistorical=false&historicalOnly=true")]
    [InlineData("/api/internal/reports/finance/stay-daily?dateFrom=2025-01-01&dateTo=2025-01-31&includeHistorical=false&historicalOnly=true")]
    [InlineData("/api/internal/reports/bookings/stay-daily?dateFrom=2025-01-01&dateTo=2027-01-01")]
    [InlineData("/api/internal/reports/bookings/historical-reconciliation?stayMonthFrom=2025-13&stayMonthTo=2025-12")]
    public async Task InvalidRangesAndFiltersUseValidationError(string path)
    {
        await using var application = await TestApplication.StartAsync();
        using var request = Request(path, PermissionKeys.AnalyticsRead);

        using var response = await application.Client.SendAsync(request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal(
            HistoricalErrorCodes.ValidationError,
            document.RootElement.GetProperty("code").GetString());
    }

    [Theory]
    [InlineData("includeHistorical=false")]
    [InlineData("includeHistorical=true")]
    [InlineData("historicalOnly=false")]
    [InlineData("historicalOnly=true")]
    [InlineData("includeHistorical=true&historicalOnly=true")]
    public async Task ReconciliationFailsClosedForUnsupportedHistoricalFilters(string query)
    {
        await using var application = await TestApplication.StartAsync();
        using var request = Request(
            $"/api/internal/reports/bookings/historical-reconciliation?stayMonthFrom=2025-01&stayMonthTo=2025-12&{query}",
            PermissionKeys.AnalyticsRead);

        using var response = await application.Client.SendAsync(request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal(
            HistoricalErrorCodes.ValidationError,
            document.RootElement.GetProperty("code").GetString());
    }

    private static HttpRequestMessage Request(string path, string permission)
    {
        var request = new HttpRequestMessage(HttpMethod.Get, path);
        request.Headers.Add(TestAuthenticationHandler.PermissionsHeader, permission);
        return request;
    }

    private sealed class TestApplication(WebApplication app, HttpClient client) : IAsyncDisposable
    {
        public HttpClient Client { get; } = client;

        public static async Task<TestApplication> StartAsync()
        {
            var builder = WebApplication.CreateBuilder(new WebApplicationOptions
            {
                EnvironmentName = "Development"
            });
            builder.WebHost.UseTestServer();
            builder.Services.AddControllers(options => options.Filters.Add<ValidationActionFilter>())
                .ConfigureApiBehaviorOptions(options =>
                    options.InvalidModelStateResponseFactory = ApiValidationResponseFactory.Create)
                .AddApplicationPart(typeof(ReportingBookingAnalyticsController).Assembly);
            builder.Services.AddSingleton<IValidator<GetHistoricalReportingDailyRequest>, GetHistoricalReportingDailyRequestValidator>();
            builder.Services.AddSingleton<IValidator<GetHistoricalReconciliationRequest>, GetHistoricalReconciliationRequestValidator>();
            builder.Services.AddSingleton<IValidator<GetBookingAnalyticsRequest>, GetBookingAnalyticsRequestValidator>();
            builder.Services.AddSingleton<IValidator<GetFinanceAnalyticsRequest>, GetFinanceAnalyticsRequestValidator>();
            builder.Services.AddSingleton<IReportingBookingAnalyticsService, BookingStub>();
            builder.Services.AddSingleton<IReportingFinanceAnalyticsService, FinanceStub>();
            builder.Services.AddAuthentication(TestAuthenticationHandler.SchemeName)
                .AddScheme<AuthenticationSchemeOptions, TestAuthenticationHandler>(
                    TestAuthenticationHandler.SchemeName,
                    _ => { });
            builder.Services.AddAuthorization(options =>
            {
                foreach (var key in PermissionKeys.All)
                {
                    options.AddPolicy(key, policy => policy
                        .AddAuthenticationSchemes(TestAuthenticationHandler.SchemeName)
                        .RequireAuthenticatedUser()
                        .RequireClaim("subjectType", "admin")
                        .RequireClaim("perm", key));
                }
            });

            var app = builder.Build();
            app.UseMiddleware<RentalPlatform.API.Middleware.ExceptionHandlingMiddleware>();
            app.UseAuthentication();
            app.UseAuthorization();
            app.MapControllers();
            await app.StartAsync();
            return new TestApplication(app, app.GetTestClient());
        }

        public async ValueTask DisposeAsync()
        {
            Client.Dispose();
            await app.StopAsync();
            await app.DisposeAsync();
        }
    }

    private sealed class TestAuthenticationHandler(
        IOptionsMonitor<AuthenticationSchemeOptions> options,
        ILoggerFactory logger,
        UrlEncoder encoder)
        : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
    {
        public const string SchemeName = "HB08A2-Test";
        public const string PermissionsHeader = "X-Test-Permissions";

        protected override Task<AuthenticateResult> HandleAuthenticateAsync()
        {
            var claims = new List<Claim>
            {
                new(ClaimTypes.NameIdentifier, Guid.NewGuid().ToString()),
                new("subjectType", "admin")
            };
            foreach (var permission in Request.Headers[PermissionsHeader].ToString()
                         .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
            {
                claims.Add(new Claim("perm", permission));
            }

            var identity = new ClaimsIdentity(claims, SchemeName);
            return Task.FromResult(AuthenticateResult.Success(
                new AuthenticationTicket(new ClaimsPrincipal(identity), SchemeName)));
        }
    }

    private sealed class BookingStub : IReportingBookingAnalyticsService
    {
        public Task<IReadOnlyList<ReportingBookingDailySummary>> GetDailySummaryAsync(
            DateOnly? dateFrom = null,
            DateOnly? dateTo = null,
            string? bookingSource = null,
            CancellationToken cancellationToken = default,
            bool includeHistorical = true,
            bool historicalOnly = false) =>
            Task.FromResult<IReadOnlyList<ReportingBookingDailySummary>>([]);

        public Task<BookingAnalyticsSummaryResult> GetSummaryAsync(
            DateOnly? dateFrom = null,
            DateOnly? dateTo = null,
            string? bookingSource = null,
            CancellationToken cancellationToken = default,
            bool includeHistorical = true,
            bool historicalOnly = false) =>
            Task.FromResult(new BookingAnalyticsSummaryResult());

        public Task<IReadOnlyList<ReportingBookingStayDailySummary>> GetStayDailySummaryAsync(
            DateOnly dateFrom,
            DateOnly dateTo,
            bool includeHistorical = true,
            bool historicalOnly = false,
            CancellationToken cancellationToken = default) =>
            Task.FromResult<IReadOnlyList<ReportingBookingStayDailySummary>>([]);

        public Task<IReadOnlyList<ReportingHistoricalEntryReconciliation>> GetHistoricalReconciliationAsync(
            DateOnly stayMonthFrom,
            DateOnly stayMonthTo,
            CancellationToken cancellationToken = default) =>
            Task.FromResult<IReadOnlyList<ReportingHistoricalEntryReconciliation>>([]);
    }

    private sealed class FinanceStub : IReportingFinanceAnalyticsService
    {
        public Task<IReadOnlyList<ReportingFinanceDailySummary>> GetDailySummaryAsync(
            DateOnly? dateFrom = null,
            DateOnly? dateTo = null,
            CancellationToken cancellationToken = default,
            bool includeHistorical = true,
            bool historicalOnly = false) =>
            Task.FromResult<IReadOnlyList<ReportingFinanceDailySummary>>([]);

        public Task<FinanceAnalyticsSummaryResult> GetSummaryAsync(
            DateOnly? dateFrom = null,
            DateOnly? dateTo = null,
            CancellationToken cancellationToken = default,
            bool includeHistorical = true,
            bool historicalOnly = false) =>
            Task.FromResult(new FinanceAnalyticsSummaryResult());

        public Task<IReadOnlyList<ReportingFinanceStayDailySummary>> GetStayDailySummaryAsync(
            DateOnly dateFrom,
            DateOnly dateTo,
            bool includeHistorical = true,
            bool historicalOnly = false,
            CancellationToken cancellationToken = default) =>
            Task.FromResult<IReadOnlyList<ReportingFinanceStayDailySummary>>([]);
    }
}
