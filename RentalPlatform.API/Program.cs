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
        Title = "REMAL Platform API - Domain 1 & 2",
        Version = "v1",
        Description = "Master Data (Amenities, Areas, Clients, Owners, AdminUsers) + Inventory (Units, Images, Seasonal Pricing, Date Blocks, Availability)"
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
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
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
    });

// Authorization Policies
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("AdminAuthenticated", policy => 
        policy.RequireClaim("subjectType", "admin"));

    options.AddPolicy("SuperAdminOnly", policy => 
        policy.RequireClaim("subjectType", "admin")
              .RequireRole(RentalPlatform.Shared.Enums.AdminRole.SuperAdmin.ToString()));

    options.AddPolicy("SalesOrSuperAdmin", policy => 
        policy.RequireClaim("subjectType", "admin")
              .RequireRole(RentalPlatform.Shared.Enums.AdminRole.Sales.ToString(), 
                           RentalPlatform.Shared.Enums.AdminRole.SuperAdmin.ToString()));

    options.AddPolicy("FinanceOrSuperAdmin", policy => 
        policy.RequireClaim("subjectType", "admin")
              .RequireRole(RentalPlatform.Shared.Enums.AdminRole.Finance.ToString(), 
                           RentalPlatform.Shared.Enums.AdminRole.SuperAdmin.ToString()));

    options.AddPolicy("InternalAdminReadOwners", policy => 
        policy.RequireClaim("subjectType", "admin")
              .RequireRole(RentalPlatform.Shared.Enums.AdminRole.SuperAdmin.ToString(), 
                           RentalPlatform.Shared.Enums.AdminRole.Sales.ToString(), 
                           RentalPlatform.Shared.Enums.AdminRole.Finance.ToString()));

    options.AddPolicy("InternalAdminRead", policy => 
        policy.RequireClaim("subjectType", "admin")
              .RequireRole(RentalPlatform.Shared.Enums.AdminRole.SuperAdmin.ToString(), 
                           RentalPlatform.Shared.Enums.AdminRole.Sales.ToString(), 
                           RentalPlatform.Shared.Enums.AdminRole.Finance.ToString()));

    options.AddPolicy("InternalAnalyticsRead", policy =>
        policy.RequireClaim("subjectType", "admin")
              .RequireRole(RentalPlatform.Shared.Enums.AdminRole.SuperAdmin.ToString(),
                           RentalPlatform.Shared.Enums.AdminRole.Sales.ToString(),
                           RentalPlatform.Shared.Enums.AdminRole.Finance.ToString(),
                           RentalPlatform.Shared.Enums.AdminRole.Tech.ToString()));

    options.AddPolicy("OwnerOnly", policy =>
        policy.RequireClaim("subjectType", "owner"));

    options.AddPolicy("ClientOnly", policy =>
        policy.RequireClaim("subjectType", "client"));
});

// CORS
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.WithOrigins(
                "http://localhost:3000",
                "http://localhost:3001",
                "http://127.0.0.1:3000",
                "http://127.0.0.1:3001")
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

// Services
builder.Services.AddScoped<ITokenService, JwtTokenService>();
builder.Services.AddScoped<IAmenityService, AmenityService>();
builder.Services.AddScoped<IAreaService, AreaService>();
builder.Services.AddScoped<IOwnerService, OwnerService>();
builder.Services.AddScoped<IClientService, ClientService>();
builder.Services.AddScoped<IAdminUserService, AdminUserService>();
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IUnitService, UnitService>();
builder.Services.AddScoped<IUnitImageService, UnitImageService>();
builder.Services.AddScoped<IUnitAmenityService, UnitAmenityService>();
builder.Services.AddScoped<ISeasonalPricingService, SeasonalPricingService>();
builder.Services.AddScoped<IDateBlockService, DateBlockService>();
builder.Services.AddScoped<IUnitAvailabilityService, UnitAvailabilityService>();
builder.Services.AddScoped<IBookingService, BookingService>();
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

var app = builder.Build();

// Configure the HTTP request pipeline.
app.UseMiddleware<ExceptionHandlingMiddleware>();

app.UseSwagger();
app.UseSwaggerUI(options =>
{
    options.SwaggerEndpoint("/swagger/v1/swagger.json", "REMAL API v1");
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

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();

// Make the implicit Program class public so test projects can access it
public partial class Program { }
