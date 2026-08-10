using System.Net;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text.Encodings.Web;
using System.Text.Json;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using RentalPlatform.API.Authorization;
using RentalPlatform.API.Controllers;
using RentalPlatform.Business.Interfaces;
using RentalPlatform.Business.Exceptions;
using RentalPlatform.Business.Models;
using RentalPlatform.Shared.Constants;
using Xunit;

namespace RentalPlatform.Tests;

[Trait(TestCategories.Name, TestCategories.Fast)]
public sealed class RbacHistoricalPermissionContractTests
{
    private static readonly Guid ActorId =
        Guid.Parse("20000000-0000-0000-0000-000000000001");
    private static readonly Guid RoleId =
        Guid.Parse("20000000-0000-0000-0000-000000000002");

    [Fact]
    public void HistoricalPermissionDescriptorsKeepIndependentOperatorDependencies()
    {
        var booking = Assert.Single(
            PermissionKeys.Descriptors,
            descriptor => descriptor.Key == PermissionKeys.BookingsRecordHistorical);
        Assert.Equal("Record historical bookings", booking.Label);
        Assert.Contains("View units", booking.Description);
        Assert.Contains("View clients", booking.Description);
        Assert.Contains("new-client entry", booking.Description);
        Assert.Contains("View bookings", booking.Description);
        Assert.Contains("Record historical payments", booking.Description);
        Assert.Contains("granted independently", booking.Description);
        Assert.NotEqual(PermissionKeys.BookingsWrite, PermissionKeys.BookingsRecordHistorical);
    }

    [Theory]
    [InlineData(null, HttpStatusCode.Forbidden, 0)]
    [InlineData(PermissionKeys.BookingsRead, HttpStatusCode.Forbidden, 0)]
    [InlineData(PermissionKeys.SettingsAdmin, HttpStatusCode.OK, 1)]
    public async Task RoleMutationStillRequiresSettingsAdmin(
        string? permission,
        HttpStatusCode expectedStatus,
        int expectedCalls)
    {
        await using var application = await TestApplication.StartAsync();
        using var request = new HttpRequestMessage(
            HttpMethod.Put,
            $"/api/internal/security/roles/{RoleId}")
        {
            Content = JsonContent.Create(new
            {
                name = "Sales",
                description = "Sanitized role",
                permissionKeys = Array.Empty<string>()
            })
        };
        if (permission is not null)
            request.Headers.Add(TestAuthenticationHandler.PermissionsHeader, permission);

        using var response = await application.Client.SendAsync(request);

        Assert.Equal(expectedStatus, response.StatusCode);
        Assert.Equal(expectedCalls, application.Service.UpdateCalls);
    }

    [Fact]
    public void SecurityControllerUsesPolicyAuthorizationWithoutRoleNameChecks()
    {
        var authorize = Assert.Single(
            typeof(SecurityController).GetCustomAttributes(typeof(AuthorizeAttribute), true)
                .Cast<AuthorizeAttribute>());
        Assert.Equal(PermissionKeys.SettingsAdmin, authorize.Policy);
    }

    [Theory]
    [InlineData(RbacErrorCodes.HistoricalSuperAdminBaselineRequired)]
    [InlineData(RbacErrorCodes.OwnerCorrectionSuperAdminOnly)]
    public async Task InvariantViolationsUseCodedValidationTransport(string code)
    {
        var context = new DefaultHttpContext();
        context.Response.Body = new MemoryStream();
        var middleware = new RentalPlatform.API.Middleware.ExceptionHandlingMiddleware(
            _ => throw new BusinessValidationException("Protected RBAC invariant.", code),
            NullLogger<RentalPlatform.API.Middleware.ExceptionHandlingMiddleware>.Instance);

        await middleware.InvokeAsync(context);

        Assert.Equal(StatusCodes.Status400BadRequest, context.Response.StatusCode);
        context.Response.Body.Position = 0;
        using var document = await JsonDocument.ParseAsync(context.Response.Body);
        Assert.Equal(code, document.RootElement.GetProperty("code").GetString());
        Assert.Equal(
            "Protected RBAC invariant.",
            document.RootElement.GetProperty("errors")[0].GetString());
    }

    private sealed class TestApplication(
        WebApplication app,
        HttpClient client,
        StubRbacAdminService service) : IAsyncDisposable
    {
        public HttpClient Client { get; } = client;
        public StubRbacAdminService Service { get; } = service;

        public static async Task<TestApplication> StartAsync()
        {
            var builder = WebApplication.CreateBuilder(new WebApplicationOptions
            {
                EnvironmentName = "Development"
            });
            builder.WebHost.UseTestServer();
            builder.Services.AddControllers()
                .AddApplicationPart(typeof(SecurityController).Assembly);
            var service = new StubRbacAdminService();
            builder.Services.AddSingleton<IRbacAdminService>(service);
            builder.Services.AddAuthentication(TestAuthenticationHandler.SchemeName)
                .AddScheme<AuthenticationSchemeOptions, TestAuthenticationHandler>(
                    TestAuthenticationHandler.SchemeName,
                    _ => { });
            builder.Services.AddAuthorization(options =>
            {
                options.AddPolicy(PermissionKeys.SettingsAdmin, policy => policy
                    .AddAuthenticationSchemes(TestAuthenticationHandler.SchemeName)
                    .RequireAuthenticatedUser()
                    .RequireClaim("subjectType", "admin")
                    .RequireClaim("perm", PermissionKeys.SettingsAdmin));
            });

            var app = builder.Build();
            app.UseAuthentication();
            app.UseAuthorization();
            app.MapControllers();
            await app.StartAsync();
            return new TestApplication(app, app.GetTestClient(), service);
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
        public const string SchemeName = "RBAC-Test";
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
            return Task.FromResult(AuthenticateResult.Success(
                new AuthenticationTicket(
                    new ClaimsPrincipal(new ClaimsIdentity(claims, SchemeName)),
                    SchemeName)));
        }
    }

    private sealed class StubRbacAdminService : IRbacAdminService
    {
        public int UpdateCalls { get; private set; }

        public Task<RbacRoleTemplateModel> UpdateRoleTemplateAsync(
            Guid callerId,
            Guid roleTemplateId,
            string name,
            string? description,
            IReadOnlyCollection<string> permissionKeys,
            CancellationToken cancellationToken = default)
        {
            UpdateCalls++;
            return Task.FromResult(new RbacRoleTemplateModel(
                roleTemplateId,
                name,
                description,
                false,
                true,
                permissionKeys,
                0,
                DateTime.UtcNow,
                DateTime.UtcNow));
        }

        public Task<IReadOnlyList<RbacRoleTemplateModel>> GetRoleTemplatesAsync(CancellationToken cancellationToken = default) => throw new NotSupportedException();
        public Task<RbacRoleTemplateModel> CreateRoleTemplateAsync(string name, string? description, IReadOnlyCollection<string> permissionKeys, CancellationToken cancellationToken = default) => throw new NotSupportedException();
        public Task DeleteRoleTemplateAsync(Guid roleTemplateId, CancellationToken cancellationToken = default) => throw new NotSupportedException();
        public Task<RbacUserOverridesModel> GetUserOverridesAsync(Guid adminUserId, CancellationToken cancellationToken = default) => throw new NotSupportedException();
        public Task<RbacUserOverridesModel> ReplaceUserOverridesAsync(Guid callerId, Guid adminUserId, IReadOnlyCollection<string> grants, IReadOnlyCollection<string> denies, CancellationToken cancellationToken = default) => throw new NotSupportedException();
    }
}
