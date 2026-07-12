using FluentValidation;
using RentalPlatform.API.DTOs.Requests.Units;
using System.Linq;

namespace RentalPlatform.API.Validators;

public class PublicUnitCatalogRequestValidator : AbstractValidator<PublicUnitCatalogRequest>
{
    private static readonly string[] AllowedUnitTypes = { "apartment", "villa", "chalet", "studio" };
    private static readonly string[] AllowedSortValues =
    {
        "newest", "newest_arrivals", "latest", "price_asc", "price_desc",
        "cheapest", "expensive", "highest_price"
    };

    public PublicUnitCatalogRequestValidator()
    {
        RuleFor(x => x.MinGuests)
            .GreaterThan(0)
            .When(x => x.MinGuests.HasValue)
            .WithMessage("MinGuests must be greater than 0.");

        RuleFor(x => x.MinPrice)
            .GreaterThanOrEqualTo(0)
            .When(x => x.MinPrice.HasValue)
            .WithMessage("MinPrice must be greater than or equal to 0.");

        RuleFor(x => x.MaxPrice)
            .GreaterThanOrEqualTo(0)
            .When(x => x.MaxPrice.HasValue)
            .WithMessage("MaxPrice must be greater than or equal to 0.");

        RuleFor(x => x)
            .Must(x => !x.MinPrice.HasValue || !x.MaxPrice.HasValue || x.MinPrice <= x.MaxPrice)
            .WithMessage("MinPrice must be less than or equal to MaxPrice.");

        RuleFor(x => x.UnitType)
            .Must(value => string.IsNullOrWhiteSpace(value) || AllowedUnitTypes.Contains(value.Trim().ToLowerInvariant()))
            .WithMessage($"UnitType must be one of: {string.Join(", ", AllowedUnitTypes)}.");

        RuleFor(x => x.SortBy)
            .Must(value => string.IsNullOrWhiteSpace(value) ||
                           AllowedSortValues.Contains(value.Trim().ToLowerInvariant().Replace('-', '_')))
            .WithMessage("SortBy is not supported.");

        RuleFor(x => x.Search)
            .MaximumLength(200)
            .When(x => x.Search != null);
    }
}

public class CreateUnitRequestValidator : AbstractValidator<CreateUnitRequest>
{
    private static readonly string[] AllowedUnitTypes = { "apartment", "villa", "chalet", "studio" };

    public CreateUnitRequestValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty()
            .Must(x => !string.IsNullOrWhiteSpace(x))
            .WithMessage("Name is required and cannot be empty or whitespace.");

        RuleFor(x => x.UnitType)
            .NotEmpty()
            .Must(x => !string.IsNullOrWhiteSpace(x) && AllowedUnitTypes.Contains(x.Trim().ToLower()))
            .WithMessage($"UnitType must be one of: {string.Join(", ", AllowedUnitTypes)}.");

        RuleFor(x => x.Bedrooms)
            .GreaterThanOrEqualTo(0)
            .WithMessage("Bedrooms must be greater than or equal to 0.");

        RuleFor(x => x.Bathrooms)
            .GreaterThanOrEqualTo(0)
            .WithMessage("Bathrooms must be greater than or equal to 0.");

        RuleFor(x => x.MaxGuests)
            .GreaterThan(0)
            .WithMessage("MaxGuests must be greater than 0.");

        RuleFor(x => x.BasePricePerNight)
            .GreaterThanOrEqualTo(0)
            .WithMessage("BasePricePerNight must be greater than or equal to 0.");
    }
}

public class UpdateUnitRequestValidator : AbstractValidator<UpdateUnitRequest>
{
    private static readonly string[] AllowedUnitTypes = { "apartment", "villa", "chalet", "studio" };

    public UpdateUnitRequestValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty()
            .Must(x => !string.IsNullOrWhiteSpace(x))
            .WithMessage("Name is required and cannot be empty or whitespace.");

        RuleFor(x => x.UnitType)
            .NotEmpty()
            .Must(x => !string.IsNullOrWhiteSpace(x) && AllowedUnitTypes.Contains(x.Trim().ToLower()))
            .WithMessage($"UnitType must be one of: {string.Join(", ", AllowedUnitTypes)}.");

        RuleFor(x => x.Bedrooms)
            .GreaterThanOrEqualTo(0)
            .WithMessage("Bedrooms must be greater than or equal to 0.");

        RuleFor(x => x.Bathrooms)
            .GreaterThanOrEqualTo(0)
            .WithMessage("Bathrooms must be greater than or equal to 0.");

        RuleFor(x => x.MaxGuests)
            .GreaterThan(0)
            .WithMessage("MaxGuests must be greater than 0.");

        RuleFor(x => x.BasePricePerNight)
            .GreaterThanOrEqualTo(0)
            .WithMessage("BasePricePerNight must be greater than or equal to 0.");
    }
}

public class UpdateUnitStatusRequestValidator : AbstractValidator<UpdateUnitStatusRequest>
{
    public UpdateUnitStatusRequestValidator()
    {
        // No explicit rules for IsActive, as boolean is self-validating
    }
}

public class UpdateUnitPortfolioVisibilityRequestValidator : AbstractValidator<UpdateUnitPortfolioVisibilityRequest>
{
    public UpdateUnitPortfolioVisibilityRequestValidator()
    {
        // No explicit rules for IsVisibleInPortfolio, as boolean is self-validating.
    }
}
