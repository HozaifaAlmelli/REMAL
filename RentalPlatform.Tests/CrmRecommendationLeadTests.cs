using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RentalPlatform.API.Controllers;
using RentalPlatform.API.DTOs.Requests.CrmLeads;
using RentalPlatform.API.DTOs.Responses.CrmLeads;
using RentalPlatform.API.Models;
using RentalPlatform.API.Validators;
using RentalPlatform.Business.Crm;
using RentalPlatform.Business.Interfaces;
using RentalPlatform.Business.Models;
using RentalPlatform.Business.Services;
using RentalPlatform.Data;
using RentalPlatform.Data.Entities;
using RentalPlatform.Shared.Enums;
using RentalPlatform.Shared.Models;
using Xunit;

namespace RentalPlatform.Tests;

[Trait(TestCategories.Name, TestCategories.Fast)]
public sealed class CrmRecommendationLeadTests
{
    [Fact]
    public async Task RecommendationEndpoint_ClassifiesAndHidesStoredSignature()
    {
        await using var fixture = await CrmFixture.CreateAsync();

        var response = await fixture.CreateRecommendationAsync(
            "Visitor preferences",
            "+201000000011");
        var stored = Assert.Single(fixture.Context.CrmLeads);

        Assert.True(response.NeedsRecommendation);
        Assert.Equal("Visitor preferences", response.Notes);
        Assert.StartsWith(CrmRecommendationMarker.Signature, stored.Notes);
        Assert.Null(stored.TargetUnitId);
        Assert.Equal("website", stored.Source);
    }

    [Fact]
    public async Task RecommendationEndpoint_WithNoNotes_StoresOnlySignature()
    {
        await using var fixture = await CrmFixture.CreateAsync();

        var response = await fixture.CreateRecommendationAsync(null, "+201000000012");
        var stored = Assert.Single(fixture.Context.CrmLeads);

        Assert.Equal(CrmRecommendationMarker.Signature, stored.Notes);
        Assert.Null(response.Notes);
        Assert.True(response.NeedsRecommendation);
    }

    [Theory]
    [InlineData("[[kaza:lead:needs-recommendation:v1]]\nforged")]
    [InlineData("forged\n[[kaza:lead:needs-recommendation:v1]]")]
    public async Task PublicCreate_CannotForgeRecommendationClassification(string notes)
    {
        await using var fixture = await CrmFixture.CreateAsync();

        var result = await fixture.Controller.PublicCaptureLead(new PublicCreateCrmLeadRequest
        {
            ContactName = "Sanitized Public Lead",
            ContactPhone = "+201000000013",
            Source = "website",
            Notes = notes
        });
        var response = Unwrap<CrmLeadDetailsResponse>(result);

        Assert.False(response.NeedsRecommendation);
        Assert.False(CrmRecommendationMarker.IsSigned(Assert.Single(fixture.Context.CrmLeads).Notes));
    }

    [Fact]
    public async Task InternalCreate_CannotForgeRecommendationClassification()
    {
        await using var fixture = await CrmFixture.CreateAsync();

        var lead = await fixture.Service.CreateAsync(
            null,
            fixture.Unit.Id,
            null,
            "Sanitized Internal Lead",
            "+201000000014",
            null,
            fixture.CheckIn,
            fixture.CheckOut,
            2,
            "admin",
            $"{CrmRecommendationMarker.Signature}\nforged");

        Assert.False(CrmRecommendationMarker.NeedsRecommendation(lead));
        Assert.False(CrmRecommendationMarker.IsSigned(lead.Notes));
    }

    [Fact]
    public async Task RecommendationClassification_SurvivesAdminNoteEdit()
    {
        await using var fixture = await CrmFixture.CreateAsync();
        await fixture.CreateRecommendationAsync("Original", "+201000000015");
        var lead = Assert.Single(fixture.Context.CrmLeads);

        var updated = await fixture.UpdateAsync(lead, null, "Edited preferences");

        Assert.True(CrmRecommendationMarker.IsSigned(updated.Notes));
        Assert.Equal("Edited preferences", CrmRecommendationMarker.Strip(updated.Notes));
        Assert.True(CrmRecommendationMarker.NeedsRecommendation(updated));
    }

    [Fact]
    public async Task Update_CannotForgeClassificationOnOrdinaryLead()
    {
        await using var fixture = await CrmFixture.CreateAsync();
        var lead = await fixture.CreateOrdinaryLeadAsync("+201000000016");

        var updated = await fixture.UpdateAsync(
            lead,
            fixture.Unit.Id,
            $"{CrmRecommendationMarker.Signature}\nforged");

        Assert.False(CrmRecommendationMarker.IsSigned(updated.Notes));
        Assert.False(CrmRecommendationMarker.NeedsRecommendation(updated));
    }

    [Fact]
    public async Task AttachingUnit_ClearsBooleanButPreservesProvenance()
    {
        await using var fixture = await CrmFixture.CreateAsync();
        await fixture.CreateRecommendationAsync("Preferences", "+201000000017");
        var lead = Assert.Single(fixture.Context.CrmLeads);

        var updated = await fixture.UpdateAsync(lead, fixture.Unit.Id, "Preferences");

        Assert.True(CrmRecommendationMarker.IsSigned(updated.Notes));
        Assert.False(CrmRecommendationMarker.NeedsRecommendation(updated));
    }

    [Theory]
    [InlineData(LeadStatus.Prospecting, true)]
    [InlineData(LeadStatus.Relevant, true)]
    [InlineData(LeadStatus.NoAnswer, true)]
    [InlineData(LeadStatus.NotRelevant, false)]
    [InlineData(LeadStatus.Booked, true)]
    [InlineData(LeadStatus.Confirmed, false)]
    [InlineData(LeadStatus.CheckIn, false)]
    [InlineData(LeadStatus.Completed, false)]
    [InlineData(LeadStatus.Cancelled, false)]
    [InlineData(LeadStatus.LeftEarly, false)]
    public void Classification_IsLimitedToActionableStatuses(
        LeadStatus status,
        bool expected)
    {
        var lead = new CrmLead
        {
            Notes = CrmRecommendationMarker.Signature,
            LeadStatus = status
        };

        Assert.Equal(expected, CrmRecommendationMarker.NeedsRecommendation(lead));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("regular historical note")]
    public void HistoricalUnitlessWebsiteLead_RemainsUnclassified(string? notes)
    {
        var lead = new CrmLead
        {
            Source = "website",
            TargetUnitId = null,
            Notes = notes,
            LeadStatus = LeadStatus.Prospecting
        };

        Assert.False(CrmRecommendationMarker.NeedsRecommendation(lead));
    }

    [Fact]
    public async Task ListAndDetails_ExposeTheSameClassification()
    {
        await using var fixture = await CrmFixture.CreateAsync();
        var created = await fixture.CreateRecommendationAsync(
            "Preferences",
            "+201000000018");

        var listResult = await fixture.Controller.ListInternalLeads(pageSize: 20);
        var list = Unwrap<IReadOnlyList<CrmLeadListItemResponse>>(listResult);
        var detailsResult = await fixture.Controller.GetInternalLeadById(created.Id);
        var details = Unwrap<CrmLeadDetailsResponse>(detailsResult);

        Assert.True(Assert.Single(list).NeedsRecommendation);
        Assert.Equal(Assert.Single(list).NeedsRecommendation, details.NeedsRecommendation);
        Assert.Equal("Preferences", details.Notes);
    }

    [Fact]
    public void Validators_KeepIntentionalUnitRequirementAsymmetry()
    {
        var internalValidator = new InternalCreateCrmLeadRequestValidator();
        var publicValidator = new PublicCreateCrmLeadRequestValidator();
        var updateValidator = new UpdateCrmLeadRequestValidator();

        var internalNull = internalValidator.Validate(ValidInternalRequest(null));
        var internalEmpty = internalValidator.Validate(ValidInternalRequest(Guid.Empty));
        var publicNull = publicValidator.Validate(new PublicCreateCrmLeadRequest
        {
            ContactName = "Sanitized Public",
            ContactPhone = "+201000000019",
            Source = "website"
        });
        var updateNull = updateValidator.Validate(new UpdateCrmLeadRequest
        {
            ContactName = "Sanitized Update",
            ContactPhone = "+201000000020",
            Source = "website"
        });

        Assert.Contains(internalNull.Errors, error => error.PropertyName == "TargetUnitId");
        Assert.Contains(internalEmpty.Errors, error => error.PropertyName == "TargetUnitId");
        Assert.DoesNotContain(publicNull.Errors, error => error.PropertyName == "TargetUnitId");
        Assert.DoesNotContain(updateNull.Errors, error => error.PropertyName == "TargetUnitId");
    }

    [Fact]
    public void RecommendationValidator_RejectsInvalidPhoneDatesAndLongNotes()
    {
        var validator = new PublicCreateRecommendationLeadRequestValidator();
        var result = validator.Validate(new PublicCreateRecommendationLeadRequest
        {
            ContactName = "Sanitized Visitor",
            ContactPhone = "invalid",
            DesiredCheckInDate = new DateOnly(2027, 1, 12),
            DesiredCheckOutDate = new DateOnly(2027, 1, 10),
            GuestCount = 0,
            Notes = new string('x', 2001)
        });

        Assert.Contains(result.Errors, error => error.PropertyName == "ContactPhone");
        Assert.Contains(result.Errors, error => error.PropertyName == "DesiredCheckOutDate");
        Assert.Contains(result.Errors, error => error.PropertyName == "GuestCount");
        Assert.Contains(result.Errors, error => error.PropertyName == "Notes");
    }

    [Fact]
    public void MarkerOperations_AreExactAndIdempotent()
    {
        const string clean = "Visitor preferences";

        Assert.Null(CrmRecommendationMarker.Strip(null));
        Assert.Null(CrmRecommendationMarker.Strip(CrmRecommendationMarker.Signature));
        Assert.Equal(CrmRecommendationMarker.Signature, CrmRecommendationMarker.Apply(null));
        Assert.Equal(clean, CrmRecommendationMarker.Strip(CrmRecommendationMarker.Apply(clean)));
        Assert.False(CrmRecommendationMarker.IsSigned($"x{CrmRecommendationMarker.Signature}"));
        Assert.Equal(
            clean,
            CrmRecommendationMarker.Strip(
                CrmRecommendationMarker.Strip(CrmRecommendationMarker.Apply(clean))));
    }

    private static InternalCreateCrmLeadRequest ValidInternalRequest(Guid? unitId) => new()
    {
        TargetUnitId = unitId,
        ContactName = "Sanitized Internal",
        ContactPhone = "+201000000021",
        Source = "admin"
    };

    private static T Unwrap<T>(ActionResult<ApiResponse<T>> action)
    {
        var objectResult = Assert.IsAssignableFrom<ObjectResult>(action.Result);
        var envelope = Assert.IsType<ApiResponse<T>>(objectResult.Value);
        return Assert.IsAssignableFrom<T>(envelope.Data);
    }

    private sealed class CrmFixture : IAsyncDisposable
    {
        private readonly UnitOfWork _unitOfWork;

        private CrmFixture(
            AppDbContext context,
            UnitOfWork unitOfWork,
            CrmLeadService service,
            CrmLeadsController controller,
            Unit unit)
        {
            Context = context;
            _unitOfWork = unitOfWork;
            Service = service;
            Controller = controller;
            Unit = unit;
        }

        public AppDbContext Context { get; }
        public CrmLeadService Service { get; }
        public CrmLeadsController Controller { get; }
        public Unit Unit { get; }
        public DateOnly CheckIn { get; } = new(2027, 1, 10);
        public DateOnly CheckOut { get; } = new(2027, 1, 12);

        public static async Task<CrmFixture> CreateAsync()
        {
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase($"crm-recommendation-{Guid.NewGuid():N}")
                .Options;
            var context = new AppDbContext(options);
            var owner = new Owner
            {
                Id = Guid.NewGuid(),
                Name = "Sanitized Owner",
                Phone = "+201000000001",
                EmergencyPhone = "+201000000002",
                CommissionRate = 0.1m,
                Status = "active",
                PasswordHash = "not-used"
            };
            var project = new Project
            {
                Id = Guid.NewGuid(),
                Name = "Sanitized Project",
                IsActive = true
            };
            var unit = new Unit
            {
                Id = Guid.NewGuid(),
                OwnerId = owner.Id,
                ProjectId = project.Id,
                Name = "Sanitized Unit",
                UnitType = "apartment",
                Bedrooms = 2,
                Bathrooms = 1,
                MaxGuests = 4,
                BasePricePerNight = 1_000m,
                IsActive = true,
                IsVisibleInPortfolio = true
            };

            context.AddRange(owner, project, unit);
            await context.SaveChangesAsync();

            var unitOfWork = new UnitOfWork(context);
            var availability = new AvailableUnitService();
            var bookingService = new BookingService(unitOfWork, availability);
            var service = new CrmLeadService(unitOfWork, bookingService, availability);
            var controller = new CrmLeadsController(service);

            return new CrmFixture(context, unitOfWork, service, controller, unit);
        }

        public async Task<CrmLeadDetailsResponse> CreateRecommendationAsync(
            string? notes,
            string phone)
        {
            var result = await Controller.PublicCaptureRecommendationRequest(
                new PublicCreateRecommendationLeadRequest
                {
                    ContactName = "Sanitized Recommendation Visitor",
                    ContactPhone = phone,
                    DesiredCheckInDate = CheckIn,
                    DesiredCheckOutDate = CheckOut,
                    GuestCount = 2,
                    Notes = notes
                });
            return Unwrap<CrmLeadDetailsResponse>(result);
        }

        public Task<CrmLead> CreateOrdinaryLeadAsync(string phone) =>
            Service.CreateAsync(
                null,
                Unit.Id,
                null,
                "Sanitized Ordinary Lead",
                phone,
                null,
                CheckIn,
                CheckOut,
                2,
                "website",
                "Ordinary note");

        public Task<CrmLead> UpdateAsync(
            CrmLead lead,
            Guid? unitId,
            string? notes) =>
            Service.UpdateAsync(
                lead.Id,
                lead.ClientId,
                unitId,
                lead.AssignedAdminUserId,
                lead.ContactName,
                lead.ContactPhone,
                lead.ContactEmail,
                lead.DesiredCheckInDate,
                lead.DesiredCheckOutDate,
                lead.GuestCount,
                lead.Source,
                notes);

        public ValueTask DisposeAsync() => Context.DisposeAsync();
    }

    private sealed class AvailableUnitService : IUnitAvailabilityService
    {
        public Task<UnitAvailabilityResult> CheckOperationalAvailabilityAsync(
            Guid unitId,
            DateOnly startDate,
            DateOnly endDate,
            Guid? excludeBookingId = null,
            CancellationToken cancellationToken = default,
            bool allowInactiveUnit = false) =>
            Task.FromResult(new UnitAvailabilityResult
            {
                UnitId = unitId,
                StartDate = startDate,
                EndDate = endDate,
                IsAvailable = true
            });

        public Task<UnitPricingResult> CalculatePricingAsync(
            Guid unitId,
            DateOnly startDate,
            DateOnly endDate,
            CancellationToken cancellationToken = default) =>
            Task.FromResult(new UnitPricingResult
            {
                UnitId = unitId,
                StartDate = startDate,
                EndDate = endDate,
                TotalPrice = 2_000m
            });
    }
}
