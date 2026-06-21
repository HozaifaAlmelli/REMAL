using FluentValidation;
using RentalPlatform.API.DTOs.Requests.Owners;
using System.Linq;

namespace RentalPlatform.API.Validators;

public class CreateOwnerRequestValidator : AbstractValidator<CreateOwnerRequest>
{
    private static readonly string[] AllowedStatuses = new[] { "active", "inactive" };

    public CreateOwnerRequestValidator()
    {
        RuleFor(x => x.Name).NotEmpty().WithMessage("Name is required.");
        RuleFor(x => x.Phone)
            .NotEmpty().WithMessage("Phone is required.")
            .Matches(@"^\+?\d{10,15}$").WithMessage("Invalid phone configuration. Provide 10-15 digits with an optional leading '+' format.");
        RuleFor(x => x.EmergencyPhone)
            .NotEmpty().WithMessage("Emergency phone is required.")
            .Matches(@"^\+?\d{10,15}$").WithMessage("Invalid emergency phone configuration. Provide 10-15 digits with an optional leading '+' format.");
        RuleFor(x => x.Email).EmailAddress().When(x => !string.IsNullOrEmpty(x.Email)).WithMessage("Invalid email format.");
        RuleFor(x => x.DetailedAddress).MaximumLength(1000).WithMessage("Detailed address must be 1000 characters or fewer.");
        RuleFor(x => x.CommissionRate).InclusiveBetween(0, 100).WithMessage("CommissionRate must be between 0 and 100.");
        RuleFor(x => x.Status).Must(x => AllowedStatuses.Contains(x.ToLower())).WithMessage("Status must be 'active' or 'inactive'.");
        RuleFor(x => x.Password).NotEmpty().WithMessage("Password is required.");
    }
}

public class UpdateOwnerRequestValidator : AbstractValidator<UpdateOwnerRequest>
{
    private static readonly string[] AllowedStatuses = new[] { "active", "inactive" };

    public UpdateOwnerRequestValidator()
    {
        RuleFor(x => x.Name).NotEmpty().WithMessage("Name is required.");
        RuleFor(x => x.Phone)
            .NotEmpty().WithMessage("Phone is required.")
            .Matches(@"^\+?\d{10,15}$").WithMessage("Invalid phone configuration. Provide 10-15 digits with an optional leading '+' format.");
        RuleFor(x => x.EmergencyPhone)
            .NotEmpty().WithMessage("Emergency phone is required.")
            .Matches(@"^\+?\d{10,15}$").WithMessage("Invalid emergency phone configuration. Provide 10-15 digits with an optional leading '+' format.");
        RuleFor(x => x.Email).EmailAddress().When(x => !string.IsNullOrEmpty(x.Email)).WithMessage("Invalid email format.");
        RuleFor(x => x.DetailedAddress).MaximumLength(1000).WithMessage("Detailed address must be 1000 characters or fewer.");
        RuleFor(x => x.CommissionRate).InclusiveBetween(0, 100).WithMessage("CommissionRate must be between 0 and 100.");
        RuleFor(x => x.Status).Must(x => AllowedStatuses.Contains(x.ToLower())).WithMessage("Status must be 'active' or 'inactive'.");
    }
}

public class UpdateOwnerStatusRequestValidator : AbstractValidator<UpdateOwnerStatusRequest>
{
    private static readonly string[] AllowedStatuses = new[] { "active", "inactive" };

    public UpdateOwnerStatusRequestValidator()
    {
        RuleFor(x => x.Status).Must(x => AllowedStatuses.Contains(x.ToLower())).WithMessage("Status must be 'active' or 'inactive'.");
    }
}
