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
using RentalPlatform.Business.Exceptions;
using RentalPlatform.Business.Interfaces;
using RentalPlatform.Business.Models;
using RentalPlatform.Shared.Constants;
using Xunit;

namespace RentalPlatform.Tests;

[Trait(TestCategories.Name, TestCategories.Fast)]
public sealed class OccupancyAnalyticsHttpContractTests
{
    private const string CleanPath =
        "/api/internal/reports/occupancy?from=2026-08-01&toExclusive=2026-08-11";

    [Fact]
    public async Task OccupancyRequiresAnalyticsReadWithoutUnitsRead()
    {
        await using var application = await TestApplication.StartAsync();

        Assert.Equal(
            HttpStatusCode.Forbidden,
            (await application.Client.SendAsync(Request(CleanPath, PermissionKeys.UnitsRead))).StatusCode);
        Assert.Equal(
            HttpStatusCode.OK,
            (await application.Client.SendAsync(Request(CleanPath, PermissionKeys.AnalyticsRead))).StatusCode);
    }

    [Fact]
    public async Task CleanAggregateUsesThePiiFreeDedicatedEnvelope()
    {
        await using var application = await TestApplication.StartAsync();
        using var response = await application.Client.SendAsync(
            Request(CleanPath, PermissionKeys.AnalyticsRead));

        response.EnsureSuccessStatusCode();
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var data = document.RootElement.GetProperty("data");
        Assert.Equal("2026-08-01", data.GetProperty("from").GetString());
        Assert.Equal("2026-08-11", data.GetProperty("toExclusive").GetString());
        Assert.Equal(5, data.GetProperty("occupiedUnitNights").GetInt64());
        Assert.Equal(10, data.GetProperty("availableUnitNights").GetInt64());
        Assert.Equal(50m, data.GetProperty("occupancyRate").GetDecimal());
        Assert.True(data.GetProperty("availabilityCoverageComplete").GetBoolean());
        Assert.Equal("2026-08-01", data.GetProperty("coverageStartDate").GetString());
        Assert.Equal(JsonValueKind.Null, data.GetProperty("unavailableReason").ValueKind);
        Assert.DoesNotContain("unitId", data.EnumerateObject().Select(property => property.Name));
        Assert.DoesNotContain("bookingId", data.EnumerateObject().Select(property => property.Name));
    }

    [Theory]
    [InlineData("2026-08-02", "coverage_incomplete", false)]
    [InlineData("2026-08-03", "zero_capacity", true)]
    [InlineData("2026-08-04", "integrity_conflict", true)]
    public async Task UnavailableResultsRetainExplicitReason(
        string from,
        string reason,
        bool coverageComplete)
    {
        await using var application = await TestApplication.StartAsync();
        using var response = await application.Client.SendAsync(Request(
            $"/api/internal/reports/occupancy?from={from}&toExclusive=2026-08-11",
            PermissionKeys.AnalyticsRead));

        response.EnsureSuccessStatusCode();
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var data = document.RootElement.GetProperty("data");
        Assert.Equal(reason, data.GetProperty("unavailableReason").GetString());
        Assert.Equal(coverageComplete, data.GetProperty("availabilityCoverageComplete").GetBoolean());
        Assert.Equal(JsonValueKind.Null, data.GetProperty("occupancyRate").ValueKind);
    }

    [Theory]
    [InlineData("/api/internal/reports/occupancy?from=2026-08-01&toExclusive=2026-08-01")]
    [InlineData("/api/internal/reports/occupancy?from=2026-08-01&toExclusive=2028-08-02")]
    [InlineData("/api/internal/reports/occupancy?toExclusive=2026-08-01")]
    public async Task InvalidRangesUseExistingValidationContract(string path)
    {
        await using var application = await TestApplication.StartAsync();
        using var response = await application.Client.SendAsync(
            Request(path, PermissionKeys.AnalyticsRead));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal(HistoricalErrorCodes.ValidationError, document.RootElement.GetProperty("code").GetString());
    }

    [Fact]
    public async Task FutureRangeUsesStableErrorCode()
    {
        await using var application = await TestApplication.StartAsync();
        using var response = await application.Client.SendAsync(Request(
            "/api/internal/reports/occupancy?from=2026-08-14&toExclusive=2026-08-16",
            PermissionKeys.AnalyticsRead));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal(
            OccupancyErrorCodes.FutureRangeNotSupported,
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
                EnvironmentName = "Development",
            });
            builder.WebHost.UseTestServer();
            builder.Services.AddControllers(options => options.Filters.Add<ValidationActionFilter>())
                .ConfigureApiBehaviorOptions(options =>
                    options.InvalidModelStateResponseFactory = ApiValidationResponseFactory.Create)
                .AddApplicationPart(typeof(ReportingOccupancyAnalyticsController).Assembly);
            builder.Services.AddSingleton<IValidator<GetOccupancyAnalyticsRequest>, GetOccupancyAnalyticsRequestValidator>();
            builder.Services.AddSingleton<IOccupancyAnalyticsService, OccupancyStub>();
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
        public const string SchemeName = "AN-OPS-01B2-Test";
        public const string PermissionsHeader = "X-Test-Permissions";

        protected override Task<AuthenticateResult> HandleAuthenticateAsync()
        {
            var claims = new List<Claim>
            {
                new(ClaimTypes.NameIdentifier, Guid.NewGuid().ToString()),
                new("subjectType", "admin"),
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

    private sealed class OccupancyStub : IOccupancyAnalyticsService
    {
        public Task<OccupancyAnalyticsResult> GetAsync(
            DateOnly from,
            DateOnly toExclusive,
            CancellationToken cancellationToken = default)
        {
            if (toExclusive > new DateOnly(2026, 8, 15))
            {
                throw new BusinessValidationException(
                    "Occupancy ranges cannot include future nights.",
                    OccupancyErrorCodes.FutureRangeNotSupported);
            }

            var reason = from.Day switch
            {
                2 => OccupancyUnavailableReasons.CoverageIncomplete,
                3 => OccupancyUnavailableReasons.ZeroCapacity,
                4 => OccupancyUnavailableReasons.IntegrityConflict,
                _ => null,
            };
            var coverageComplete = reason != OccupancyUnavailableReasons.CoverageIncomplete;
            return Task.FromResult(new OccupancyAnalyticsResult
            {
                From = from,
                ToExclusive = toExclusive,
                OccupiedUnitNights = 5,
                AvailableUnitNights = reason == OccupancyUnavailableReasons.CoverageIncomplete ? null : 10,
                OccupancyRate = reason is null ? 50m : null,
                AvailabilityCoverageComplete = coverageComplete,
                CoverageStartDate = new DateOnly(2026, 8, 1),
                UnavailableReason = reason,
            });
        }
    }
}
