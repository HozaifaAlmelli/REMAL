using FluentValidation;
using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using RentalPlatform.API.Middleware;
using RentalPlatform.API.Services;
using RentalPlatform.Business.Interfaces;
using RentalPlatform.Business.Services;
using RentalPlatform.Data;
using RentalPlatform.Data.Repositories;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.FileProviders;
using System.Text.Json;
using System.Text.Json.Serialization;

AppContext.SetSwitch("Npgsql.EnableLegacyTimestampBehavior", true);

var builder = WebApplication.CreateBuilder(args);

// API Conventions Note (per instructions):
// - Controllers must return DTOs only
// - Controllers must not return entities directly

// Add services to the container.
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new Microsoft.OpenApi.Models.OpenApiInfo
    {
        Title = "Kaza Booking Platform API - Domain 1 & 2",
        Version = "v1",
        Description = "Master Data (Amenities, Projects, Clients, Owners, AdminUsers) + Inventory (Units, Images, Seasonal Pricing, Date Blocks, Availability)"
    });

    // Add JWT Bearer authentication to Swagger
    options.AddSecurityDefinition("Bearer", new Microsoft.OpenApi.Models.OpenApiSecurityScheme
    {
        In = Microsoft.OpenApi.Models.ParameterLocation.Header,
        Description = "JWT Authorization header using the Bearer scheme. Example: \"Authorization: Bearer {token}\"",
        Name = "Authorization",
        Type = Microsoft.OpenApi.Models.SecuritySchemeType.Http,
        Scheme = "Bearer",
        BearerFormat = "JWT"
    });

    options.AddSecurityRequirement(new Microsoft.OpenApi.Models.OpenApiSecurityRequirement
    {
        {
            new Microsoft.OpenApi.Models.OpenApiSecurityScheme
            {
                Reference = new Microsoft.OpenApi.Models.OpenApiReference
                {
                    Type = Microsoft.OpenApi.Models.ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            new string[] {}
        }
    });

    options.MapType<DateOnly>(() => new Microsoft.OpenApi.Models.OpenApiSchema 
    { 
        Type = "string", 
        Format = "date",
        Example = new Microsoft.OpenApi.Any.OpenApiString(DateTime.Today.ToString("yyyy-MM-dd"))
    });
});

builder.Services.AddControllers(options =>
    {
        options.Filters.Add<RentalPlatform.API.Filters.ValidationActionFilter>();
    })
    .ConfigureApiBehaviorOptions(options =>
    {
        options.InvalidModelStateResponseFactory = context =>
        {
            var errors = context.ModelState.Values
                .SelectMany(v => v.Errors)
                .Select(e => e.ErrorMessage)
                .Where(e => !string.IsNullOrEmpty(e))
                .ToArray();

            var response = RentalPlatform.API.Models.ApiResponse.CreateFailure("Validation failed", errors);
            return new Microsoft.AspNetCore.Mvc.BadRequestObjectResult(response);
        };
    })
    .AddJsonOptions(options =>
    {
        // Serialize enums as strings using their exact names (PascalCase: New, Contacted, etc.)
        // This matches the frontend TypeScript constants
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter(namingPolicy: null, allowIntegerValues: false));
        // Force DateTime serialization to include Z suffix
        options.JsonSerializerOptions.Converters.Add(new RentalPlatform.API.Converters.DateTimeUtcJsonConverter());
        options.JsonSerializerOptions.Converters.Add(new RentalPlatform.API.Converters.NullableDateTimeUtcJsonConverter());
        // Keep property names in camelCase (id, contactName, leadStatus, etc.)
        options.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
    });

// Register FluentValidation explicitly from API assembly as required
builder.Services.AddValidatorsFromAssembly(typeof(Program).Assembly);

// Optional: Register validators from Business assembly if DTOs/validators end up there
builder.Services.AddValidatorsFromAssembly(typeof(IAmenityService).Assembly);

// DbContext
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection") 
        ?? "Host=localhost;Database=RentalPlatform;Username=postgres;Password=postgres"));

// JWT Options binding
builder.Services.Configure<RentalPlatform.API.Options.JwtOptions>(
    builder.Configuration.GetSection(RentalPlatform.API.Options.JwtOptions.SectionName));

var jwtOptions = builder.Configuration.GetSection(RentalPlatform.API.Options.JwtOptions.SectionName)
    .Get<RentalPlatform.API.Options.JwtOptions>() ?? new RentalPlatform.API.Options.JwtOptions();

// Authentication
builder.Services.AddAuthentication(options =>
    {
        options.DefaultAuthenticateScheme = Microsoft.AspNetCore.Authentication.JwtBearer.JwtBearerDefaults.AuthenticationScheme;
        options.DefaultChallengeScheme = Microsoft.AspNetCore.Authentication.JwtBearer.JwtBearerDefaults.AuthenticationScheme;
    })
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new Microsoft.IdentityModel.Tokens.TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtOptions.Issuer,
            ValidAudience = jwtOptions.Audience,
            IssuerSigningKey = new Microsoft.IdentityModel.Tokens.SymmetricSecurityKey(
                System.Text.Encoding.ASCII.GetBytes(jwtOptions.Secret)),
            ClockSkew = TimeSpan.Zero
        };

        // Refresh tokens are signed with the same key/issuer/audience, so without
        // this check a (possibly demoted or deactivated) user could present their
        // 7-day refresh token as a bearer token and skip the DB re-validation in
        // POST /api/auth/refresh. Only access tokens may authenticate API calls.
        options.Events = new Microsoft.AspNetCore.Authentication.JwtBearer.JwtBearerEvents
        {
            OnTokenValidated = async context =>
            {
                var tokenType = context.Principal?.FindFirst("tokenType")?.Value;
                if (tokenType != "access_token")
                {
                    context.Fail("Invalid token type.");
                    return;
                }

                var subjectType = context.Principal?.FindFirst("subjectType")?.Value;
                var subjectId = context.Principal?.FindFirst(
                    System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
                if (!Guid.TryParse(subjectId, out var parsedSubjectId))
                {
                    context.Fail("Invalid subject identifier.");
                    return;
                }

                var dbContext = context.HttpContext.RequestServices
                    .GetRequiredService<AppDbContext>();

                if (string.Equals(subjectType, "client", StringComparison.Ordinal))
                {
                    var stamp = context.Principal?.FindFirst(
                        JwtTokenService.ClientUpdatedAtClaim)?.Value;
                    if (!long.TryParse(stamp, out var tokenUpdatedAtTicks))
                    {
                        context.Fail("Invalid client security stamp.");
                        return;
                    }

                    var currentUpdatedAt = await dbContext.Clients
                        .AsNoTracking()
                        .Where(c => c.Id == parsedSubjectId && c.IsActive && c.DeletedAt == null)
                        .Select(c => (DateTime?)c.UpdatedAt)
                        .SingleOrDefaultAsync(context.HttpContext.RequestAborted);

                    if (!currentUpdatedAt.HasValue ||
                        currentUpdatedAt.Value.Ticks != tokenUpdatedAtTicks)
                    {
                        context.Fail("Client session has been revoked.");
                    }
                }
                else if (string.Equals(subjectType, "admin", StringComparison.Ordinal))
                {
                    var stamp = context.Principal?.FindFirst(
                        JwtTokenService.AdminUpdatedAtClaim)?.Value;
                    if (!long.TryParse(stamp, out var tokenUpdatedAtTicks))
                    {
                        context.Fail("Invalid admin security stamp.");
                        return;
                    }

                    var currentUpdatedAt = await dbContext.AdminUsers
                        .AsNoTracking()
                        .Where(admin => admin.Id == parsedSubjectId && admin.IsActive)
                        .Select(admin => (DateTime?)admin.UpdatedAt)
                        .SingleOrDefaultAsync(context.HttpContext.RequestAborted);

                    if (!currentUpdatedAt.HasValue ||
                        currentUpdatedAt.Value.Ticks != tokenUpdatedAtTicks)
                    {
                        context.Fail("Admin session has been revoked.");
                    }
                }
            }
        };
    });

// Authorization policies
builder.Services.AddAuthorization(options =>
{
    foreach (var permissionKey in RentalPlatform.API.Authorization.PermissionKeys.All)
    {
        options.AddPolicy(permissionKey, policy =>
            policy.RequireClaim("subjectType", "admin")
                  .RequireClaim("perm", permissionKey));
    }

    options.AddPolicy(RentalPlatform.API.Authorization.PermissionCatalog.AdminAuthenticated, policy =>
        policy.RequireClaim("subjectType", "admin"));

    options.AddPolicy(RentalPlatform.API.Authorization.PermissionCatalog.OwnerOnly, policy =>
        policy.RequireClaim("subjectType", "owner"));

    options.AddPolicy(RentalPlatform.API.Authorization.PermissionCatalog.ClientOnly, policy =>
        policy.RequireClaim("subjectType", "client"));
});

// CORS
var corsOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
    ?? Array.Empty<string>();

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.WithOrigins(corsOrigins)
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

// Configure Routing
builder.Services.Configure<Microsoft.AspNetCore.Routing.RouteOptions>(options =>
{
    options.LowercaseUrls = true;
    options.LowercaseQueryStrings = true;
});

// Unit Of Work
builder.Services.AddScoped<IUnitOfWork, UnitOfWork>();
builder.Services.AddSingleton<IRbacPermissionRegistry, RentalPlatform.API.Authorization.RbacPermissionRegistry>();

// Services
builder.Services.AddScoped<ITokenService, JwtTokenService>();
builder.Services.AddScoped<IAmenityService, AmenityService>();
builder.Services.AddScoped<IProjectService, ProjectService>();
builder.Services.AddScoped<IOwnerService, OwnerService>();
builder.Services.AddScoped<IClientService, ClientService>();
builder.Services.AddScoped<IAdminUserService, AdminUserService>();
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IPermissionResolver, PermissionResolver>();
builder.Services.AddScoped<IRbacAdminService, RbacAdminService>();
builder.Services.AddScoped<IUnitService, UnitService>();
builder.Services.AddScoped<IUnitImageService, UnitImageService>();
builder.Services.AddScoped<IUnitAmenityService, UnitAmenityService>();
builder.Services.AddScoped<ISeasonalPricingService, SeasonalPricingService>();
builder.Services.AddScoped<IDateBlockService, DateBlockService>();
builder.Services.AddScoped<IDateBlockApprovalService, DateBlockApprovalService>();
builder.Services.AddScoped<IUnitAvailabilityService, UnitAvailabilityService>();
builder.Services.AddScoped<IBookingService, BookingService>();
builder.Services.AddScoped<IGuestBookingService, GuestBookingService>();
builder.Services.AddScoped<IBookingLifecycleService, BookingLifecycleService>();
builder.Services.AddScoped<ICrmLeadService, CrmLeadService>();
builder.Services.AddScoped<ICrmNoteService, CrmNoteService>();
builder.Services.AddScoped<ICrmAssignmentService, CrmAssignmentService>();
builder.Services.AddScoped<IPaymentService, PaymentService>();
builder.Services.AddScoped<IInvoiceService, InvoiceService>();
builder.Services.AddScoped<IOwnerPayoutService, OwnerPayoutService>();
builder.Services.AddScoped<IFinanceSummaryService, FinanceSummaryService>();
builder.Services.AddScoped<IOwnerPortalUnitService, OwnerPortalUnitService>();
builder.Services.AddScoped<IOwnerPortalBookingService, OwnerPortalBookingService>();
builder.Services.AddScoped<IOwnerPortalFinanceService, OwnerPortalFinanceService>();
builder.Services.AddScoped<IOwnerPortalDashboardService, OwnerPortalDashboardService>();
builder.Services.AddScoped<IReviewService, ReviewService>();
builder.Services.AddScoped<IReviewModerationService, ReviewModerationService>();
builder.Services.AddScoped<IReviewReplyService, ReviewReplyService>();
builder.Services.AddScoped<IReviewSummaryService, ReviewSummaryService>();
builder.Services.AddScoped<INotificationService, NotificationService>();
builder.Services.AddScoped<INotificationDispatchService, NotificationDispatchService>();
builder.Services.AddScoped<INotificationPreferenceService, NotificationPreferenceService>();
builder.Services.AddScoped<INotificationInboxService, NotificationInboxService>();

// Reports & Analytics services
builder.Services.AddScoped<IReportingBookingAnalyticsService, ReportingBookingAnalyticsService>();
builder.Services.AddScoped<IReportingFinanceAnalyticsService, ReportingFinanceAnalyticsService>();
builder.Services.AddScoped<IReportingReviewsAnalyticsService, ReportingReviewsAnalyticsService>();
builder.Services.AddScoped<IReportingNotificationsAnalyticsService, ReportingNotificationsAnalyticsService>();
builder.Services.AddHostedService<AutoCompleteBookingsJob>();

var app = builder.Build();

// Configure the HTTP request pipeline.
app.UseMiddleware<ExceptionHandlingMiddleware>();

app.UseSwagger();
app.UseSwaggerUI(options =>
{
    options.SwaggerEndpoint("/swagger/v1/swagger.json", "Kaza Booking API v1");
    options.RoutePrefix = "swagger";
});

// CORS must come before HttpsRedirection so preflight responses include the
// Access-Control-Allow-Origin header before any redirect occurs.
app.UseCors();

// Only redirect to HTTPS in non-Development environments.
// In Development the Docker container exposes HTTP on port 5000 only;
// enabling this causes the browser to follow a redirect that returns no CORS header.
if (!app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}

var uploadsPath = Path.Combine(app.Environment.ContentRootPath, "uploads");
Directory.CreateDirectory(uploadsPath);
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(uploadsPath),
    RequestPath = "/uploads"
});

app.UseAuthentication();
app.UseAuthorization();

app.MapGet("/", () => Results.Ok(new { service = "kaza-booking-api", status = "ok" }));
app.MapGet("/health", () => Results.Ok(new { status = "healthy", service = "kaza-booking-api" }));

app.MapControllers();

app.Run();

// Make the implicit Program class public so test projects can access it
public partial class Program { }
