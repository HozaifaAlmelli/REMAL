using FluentValidation.TestHelper;
using Microsoft.EntityFrameworkCore;
using RentalPlatform.API.DTOs.Requests.Units;
using RentalPlatform.API.Validators;
using RentalPlatform.Business.Models;
using RentalPlatform.Business.Services;
using RentalPlatform.Data;
using RentalPlatform.Data.Entities;
using Xunit;

namespace RentalPlatform.Tests;

public sealed class PublicUnitCatalogTests
{
    [Fact]
    public async Task PublicCatalog_ExcludesHiddenAndInactiveUnitsFromItemsAndCount()
    {
        await using var fixture = await CatalogFixture.CreateAsync();

        var search = await fixture.Service.GetPublicCatalogAsync(Filter(pageSize: 100));
        var homepage = await fixture.Service.GetPublicCatalogAsync(Filter(pageSize: 6));
        var internalCatalog = await fixture.Service.GetInternalCatalogAsync(
            page: 1,
            pageSize: 100,
            includeInactive: true);

        Assert.Equal(3, search.Total);
        Assert.Equal(3, search.Items.Count);
        Assert.DoesNotContain(search.Items, unit => !unit.IsVisibleInPortfolio || !unit.IsActive);
        Assert.DoesNotContain(search.Items, unit => unit.Id == fixture.HiddenUnitId);
        Assert.DoesNotContain(search.Items, unit => unit.Id == fixture.InactiveUnitId);
        Assert.DoesNotContain(search.Items, unit => unit.Id == fixture.InactiveProjectUnitId);
        Assert.All(homepage.Items, featured =>
            Assert.Contains(search.Items, result => result.Id == featured.Id));
        Assert.Contains(internalCatalog.Items, unit => unit.Id == fixture.HiddenUnitId);
        Assert.Contains(internalCatalog.Items, unit => unit.Id == fixture.InactiveProjectUnitId);
    }

    [Fact]
    public async Task PublicCatalog_CombinesSupportedFiltersWithAndSemantics()
    {
        await using var fixture = await CatalogFixture.CreateAsync();

        var result = await fixture.Service.GetPublicCatalogAsync(new PublicUnitCatalogFilter(
            Page: 1,
            PageSize: 100,
            ProjectId: fixture.FirstProjectId,
            UnitType: "villa",
            MinGuests: 4,
            MinPrice: 4_000m,
            MaxPrice: 6_000m,
            Search: "sea view",
            SortBy: "price_asc",
            AmenityIds: new[] { fixture.PoolAmenityId }));

        var unit = Assert.Single(result.Items);
        Assert.Equal(fixture.VisibleMatchingUnitId, unit.Id);
        Assert.Equal(1, result.Total);
    }

    [Fact]
    public async Task PortfolioVisibilityToggle_RemovesAndRestoresOnlyPublicAccess()
    {
        await using var fixture = await CatalogFixture.CreateAsync();

        await fixture.Service.SetPortfolioVisibilityAsync(fixture.VisibleMatchingUnitId, false);
        var hiddenPublicCatalog = await fixture.Service.GetPublicCatalogAsync(Filter(pageSize: 100));
        var hiddenInternalCatalog = await fixture.Service.GetInternalCatalogAsync(
            page: 1,
            pageSize: 100,
            includeInactive: true);

        Assert.DoesNotContain(hiddenPublicCatalog.Items, unit => unit.Id == fixture.VisibleMatchingUnitId);
        Assert.Contains(hiddenInternalCatalog.Items, unit => unit.Id == fixture.VisibleMatchingUnitId);

        await fixture.Service.SetPortfolioVisibilityAsync(fixture.VisibleMatchingUnitId, true);
        var restoredPublicCatalog = await fixture.Service.GetPublicCatalogAsync(Filter(pageSize: 100));

        Assert.Contains(restoredPublicCatalog.Items, unit => unit.Id == fixture.VisibleMatchingUnitId);
    }

    [Fact]
    public void PublicCatalogValidator_RejectsInvalidRangesAndValues()
    {
        var validator = new PublicUnitCatalogRequestValidator();
        var result = validator.TestValidate(new PublicUnitCatalogRequest
        {
            MinGuests = 0,
            MinPrice = 5_000,
            MaxPrice = 1_000,
            UnitType = "castle",
            SortBy = "random"
        });

        result.ShouldHaveValidationErrorFor(request => request.MinGuests);
        result.ShouldHaveValidationErrorFor(request => request.UnitType);
        result.ShouldHaveValidationErrorFor(request => request.SortBy);
        Assert.Contains(result.Errors, error => error.ErrorMessage.Contains("MinPrice"));
    }

    private static PublicUnitCatalogFilter Filter(int pageSize) => new(
        Page: 1,
        PageSize: pageSize,
        ProjectId: null,
        UnitType: null,
        MinGuests: null,
        MinPrice: null,
        MaxPrice: null,
        Search: null,
        SortBy: "newest",
        AmenityIds: Array.Empty<Guid>());

    private sealed class CatalogFixture : IAsyncDisposable
    {
        private readonly AppDbContext _context;

        private CatalogFixture(AppDbContext context, UnitService service)
        {
            _context = context;
            Service = service;
        }

        public UnitService Service { get; }
        public Guid FirstProjectId { get; private init; }
        public Guid PoolAmenityId { get; private init; }
        public Guid VisibleMatchingUnitId { get; private init; }
        public Guid HiddenUnitId { get; private init; }
        public Guid InactiveUnitId { get; private init; }
        public Guid InactiveProjectUnitId { get; private init; }

        public static async Task<CatalogFixture> CreateAsync()
        {
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase($"public-catalog-{Guid.NewGuid():N}")
                .Options;
            var context = new AppDbContext(options);

            var owner = new Owner
            {
                Id = Guid.NewGuid(),
                Name = "Catalog Test Owner",
                Phone = "+201000000001",
                EmergencyPhone = "+201000000002",
                CommissionRate = 0.10m,
                Status = "active",
                PasswordHash = "not-used"
            };
            var firstProject = new Project
            {
                Id = Guid.NewGuid(),
                Name = "Abraj Al Alamein",
                IsActive = true
            };
            var secondProject = new Project
            {
                Id = Guid.NewGuid(),
                Name = "Mazarine",
                IsActive = true
            };
            var inactiveProject = new Project
            {
                Id = Guid.NewGuid(),
                Name = "Inactive Project",
                IsActive = false
            };
            var pool = new Amenity { Id = Guid.NewGuid(), Name = "Pool", IsActive = true };
            var wifi = new Amenity { Id = Guid.NewGuid(), Name = "Wi-Fi", IsActive = true };

            var matching = CreateUnit(owner.Id, firstProject.Id, "Sea View Villa", "villa", 6, 5_000m);
            var visibleApartment = CreateUnit(owner.Id, firstProject.Id, "Family Apartment", "apartment", 3, 2_500m);
            var visibleOtherProject = CreateUnit(owner.Id, secondProject.Id, "Large Mazarine Villa", "villa", 8, 7_000m);
            var hidden = CreateUnit(owner.Id, firstProject.Id, "Hidden Sea View Villa", "villa", 6, 5_000m);
            hidden.IsVisibleInPortfolio = false;
            var inactive = CreateUnit(owner.Id, firstProject.Id, "Inactive Sea View Villa", "villa", 6, 5_000m);
            inactive.IsActive = false;
            var inactiveProjectUnit = CreateUnit(owner.Id, inactiveProject.Id, "Unit In Inactive Project", "villa", 6, 5_000m);

            context.AddRange(owner, firstProject, secondProject, inactiveProject, pool, wifi);
            context.AddRange(matching, visibleApartment, visibleOtherProject, hidden, inactive, inactiveProjectUnit);
            context.AddRange(
                new UnitAmenity { UnitId = matching.Id, AmenityId = pool.Id },
                new UnitAmenity { UnitId = matching.Id, AmenityId = wifi.Id },
                new UnitAmenity { UnitId = visibleApartment.Id, AmenityId = wifi.Id },
                new UnitAmenity { UnitId = visibleOtherProject.Id, AmenityId = pool.Id });
            await context.SaveChangesAsync();

            return new CatalogFixture(context, new UnitService(new UnitOfWork(context)))
            {
                FirstProjectId = firstProject.Id,
                PoolAmenityId = pool.Id,
                VisibleMatchingUnitId = matching.Id,
                HiddenUnitId = hidden.Id,
                InactiveUnitId = inactive.Id,
                InactiveProjectUnitId = inactiveProjectUnit.Id
            };
        }

        public async ValueTask DisposeAsync()
        {
            await _context.DisposeAsync();
        }

        private static Unit CreateUnit(
            Guid ownerId,
            Guid projectId,
            string name,
            string unitType,
            int maxGuests,
            decimal price) => new()
        {
            Id = Guid.NewGuid(),
            OwnerId = ownerId,
            ProjectId = projectId,
            Name = name,
            Description = $"{name} with private terrace",
            UnitType = unitType,
            Bedrooms = 2,
            Bathrooms = 2,
            MaxGuests = maxGuests,
            BasePricePerNight = price,
            IsActive = true,
            IsVisibleInPortfolio = true
        };
    }
}
