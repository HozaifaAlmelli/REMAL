using System.Net;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text;
using System.Text.Encodings.Web;
using System.Text.Json;
using FluentValidation;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using RentalPlatform.API.Authorization;
using RentalPlatform.API.Controllers;
using RentalPlatform.API.Filters;
using RentalPlatform.API.Models;
using RentalPlatform.API.Validators;
using RentalPlatform.Business.Interfaces;
using RentalPlatform.Business.Models;
using RentalPlatform.Data.Entities;
using RentalPlatform.Shared.Constants;
using Xunit;

namespace RentalPlatform.Tests;

[Trait(TestCategories.Name, TestCategories.Fast)]
public sealed class HistoricalOwnerAttributionHttpContractTests
{
    private static readonly Guid BookingId = Guid.Parse("10000000-0000-0000-0000-000000000101");
    private static readonly Guid CurrentOwnerId = Guid.Parse("10000000-0000-0000-0000-000000000102");
    private static readonly Guid TargetOwnerId = Guid.Parse("10000000-0000-0000-0000-000000000103");
    private static readonly Guid ActorId = Guid.Parse("10000000-0000-0000-0000-000000000104");

    [Theory]
    [InlineData("{", "malformed JSON")]
    [InlineData("{\"expectedCurrentOwnerId\":123,\"targetOwnerId\":\"10000000-0000-0000-0000-000000000103\",\"reason\":\"accounting_reconciliation\"}", "type mismatch")]
    [InlineData("{\"expectedCurrentOwnerId\":\"10000000-0000-0000-0000-000000000102\",\"targetOwnerId\":\"10000000-0000-0000-0000-000000000103\",\"reason\":\"accounting_reconciliation\",\"force\":true}", "unknown member")]
    public async Task JsonAndModelBindingFailuresUseStableValidationCode(string json, string description)
    {
        await using var application = await TestApplication.StartAsync();
        using var request = CorrectionRequest(json, Guid.NewGuid(), PermissionKeys.BookingsCorrectOwnerAttribution);

        using var response = await application.Client.SendAsync(request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.True(
            HistoricalErrorCodes.ValidationError == await ReadCodeAsync(response),
            $"Expected stable validation code for {description}.");
    }

    [Fact]
    public async Task FluentValidationFailureUsesStableValidationCode()
    {
        await using var application = await TestApplication.StartAsync();
        var json = JsonSerializer.Serialize(new
        {
            expectedCurrentOwnerId = Guid.Empty,
            targetOwnerId = Guid.Empty,
            reason = "invented",
            note = new string('x', 501)
        });
        using var request = CorrectionRequest(json, Guid.NewGuid(), PermissionKeys.BookingsCorrectOwnerAttribution);

        using var response = await application.Client.SendAsync(request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(HistoricalErrorCodes.ValidationError, await ReadCodeAsync(response));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("not-a-guid")]
    [InlineData("00000000-0000-0000-0000-000000000000")]
    public async Task RealResourceFilterRejectsMissingMalformedAndNilKeys(string? key)
    {
        await using var application = await TestApplication.StartAsync();
        using var request = CorrectionRequest(ValidJson(), key, PermissionKeys.BookingsCorrectOwnerAttribution);

        using var response = await application.Client.SendAsync(request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(HistoricalErrorCodes.OwnerCorrectionIdempotencyKeyRequired, await ReadCodeAsync(response));
    }

    [Theory]
    [InlineData(PermissionKeys.BookingsRead, HttpStatusCode.Forbidden)]
    [InlineData(PermissionKeys.BookingsWrite, HttpStatusCode.Forbidden)]
    [InlineData(PermissionKeys.FinanceManage, HttpStatusCode.Forbidden)]
    [InlineData(PermissionKeys.BookingsCorrectOwnerAttribution, HttpStatusCode.OK)]
    public async Task CorrectionRequiresOnlyDedicatedPermission(string permission, HttpStatusCode expected)
    {
        await using var application = await TestApplication.StartAsync();
        using var request = CorrectionRequest(ValidJson(), Guid.NewGuid(), permission);

        using var response = await application.Client.SendAsync(request);

        Assert.Equal(expected, response.StatusCode);
    }

    [Fact]
    public async Task ReviewAcceptsBookingsReadAndCorrectionPermissionDoesNotSubstitute()
    {
        await using var application = await TestApplication.StartAsync();
        using var allowed = new HttpRequestMessage(
            HttpMethod.Get,
            $"/api/internal/bookings/{BookingId:D}/owner-attribution-review");
        allowed.Headers.Add(TestAuthenticationHandler.PermissionsHeader, PermissionKeys.BookingsRead);
        using var denied = new HttpRequestMessage(
            HttpMethod.Get,
            $"/api/internal/bookings/{BookingId:D}/owner-attribution-review");
        denied.Headers.Add(
            TestAuthenticationHandler.PermissionsHeader,
            PermissionKeys.BookingsCorrectOwnerAttribution);

        Assert.Equal(HttpStatusCode.OK, (await application.Client.SendAsync(allowed)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await application.Client.SendAsync(denied)).StatusCode);
        Assert.NotEqual(PermissionKeys.BookingsRead, PermissionKeys.BookingsCorrectOwnerAttribution);
    }

    private static HttpRequestMessage CorrectionRequest(string json, object? key, string permission)
    {
        var request = new HttpRequestMessage(
            HttpMethod.Post,
            $"/api/internal/bookings/{BookingId:D}/owner-attribution-corrections")
        {
            Content = new StringContent(json, Encoding.UTF8, "application/json")
        };
        request.Headers.Add(TestAuthenticationHandler.PermissionsHeader, permission);
        if (key is not null)
            request.Headers.Add("Idempotency-Key", key.ToString());
        return request;
    }

    private static string ValidJson() => JsonSerializer.Serialize(new
    {
        expectedCurrentOwnerId = CurrentOwnerId,
        targetOwnerId = TargetOwnerId,
        reason = HistoricalOwnerCorrectionReasons.AccountingReconciliation,
        note = (string?)null
    });

    private static async Task<string?> ReadCodeAsync(HttpResponseMessage response)
    {
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        return document.RootElement.TryGetProperty("code", out var code) ? code.GetString() : null;
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
                .AddApplicationPart(typeof(HistoricalOwnerAttributionsController).Assembly);
            builder.Services.AddSingleton<IValidator<RentalPlatform.API.DTOs.Requests.Bookings.CorrectHistoricalOwnerAttributionRequest>, CorrectHistoricalOwnerAttributionRequestValidator>();
            builder.Services.AddSingleton<IHistoricalOwnerAttributionService, StubService>();
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
        public const string SchemeName = "HB05-Test";
        public const string PermissionsHeader = "X-Test-Permissions";

        protected override Task<AuthenticateResult> HandleAuthenticateAsync()
        {
            var claims = new List<Claim>
            {
                new(ClaimTypes.NameIdentifier, ActorId.ToString()),
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

    private sealed class StubService : IHistoricalOwnerAttributionService
    {
        public Task<HistoricalOwnerAttributionReviewResult> ReviewAsync(
            Guid bookingId,
            CancellationToken cancellationToken = default) =>
            Task.FromResult(new HistoricalOwnerAttributionReviewResult(
                bookingId,
                CurrentOwnerId,
                true,
                false,
                []));

        public Task<HistoricalOwnerCorrectionResult> CorrectAsync(
            CorrectHistoricalOwnerAttributionCommand command,
            CancellationToken cancellationToken = default)
        {
            var correction = new HistoricalOwnerAttributionCorrection
            {
                Id = Guid.Parse("10000000-0000-0000-0000-000000000105"),
                BookingId = command.BookingId,
                PreviousOwnerId = command.ExpectedCurrentOwnerId,
                TargetOwnerId = command.TargetOwnerId,
                CorrectedByAdminUserId = command.ActorAdminUserId,
                Reason = command.Reason,
                Note = command.Note,
                CorrectedAt = new DateTime(2026, 8, 2, 10, 0, 0, DateTimeKind.Utc)
            };
            return Task.FromResult(new HistoricalOwnerCorrectionResult(
                correction,
                Guid.Parse("10000000-0000-0000-0000-000000000106"),
                []));
        }
    }
}
