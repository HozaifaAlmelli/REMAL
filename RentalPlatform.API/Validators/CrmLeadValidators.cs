using FluentValidation;
using RentalPlatform.API.DTOs.Requests.CrmLeads;
using System;
using System.Linq;

namespace RentalPlatform.API.Validators;

public class PublicCreateCrmLeadRequestValidator : AbstractValidator<PublicCreateCrmLeadRequest>
{
    private static readonly string[] AllowedSources = { "direct", "admin", "phone", "whatsapp", "website" };

    public PublicCreateCrmLeadRequestValidator()
    {
        RuleFor(x => x.ContactName)
            .NotEmpty()
            .MaximumLength(150)
            .Must(x => !string.IsNullOrWhiteSpace(x?.Trim()))
            .WithMessage("ContactName is required.");

        RuleFor(x => x.ContactPhone)
            .NotEmpty()
            .MaximumLength(30)
            .Matches(@"^\+?\d{10,15}$")
            .WithMessage("Invalid phone configuration. Provide 10-15 digits with an optional leading '+' format.");

        RuleFor(x => x.Source)
            .NotEmpty()
            .Must(x => !string.IsNullOrWhiteSpace(x) && AllowedSources.Contains(x.Trim().ToLower()))
            .WithMessage($"Source must be one of: {string.Join(", ", AllowedSources)}.");

        RuleFor(x => x.DesiredCheckOutDate)
            .GreaterThan(x => x.DesiredCheckInDate)
            .When(x => x.DesiredCheckInDate.HasValue && x.DesiredCheckOutDate.HasValue)
            .WithMessage("DesiredCheckOutDate must be after DesiredCheckInDate.");

        RuleFor(x => x.GuestCount)
            .GreaterThan(0)
            .When(x => x.GuestCount.HasValue)
            .WithMessage("GuestCount must be greater than 0.");
    }
}

public class InternalCreateCrmLeadRequestValidator : AbstractValidator<InternalCreateCrmLeadRequest>
{
    private static readonly string[] AllowedSources = { "direct", "admin", "phone", "whatsapp", "website" };

    public InternalCreateCrmLeadRequestValidator()
    {
        RuleFor(x => x.ContactName)
            .NotEmpty()
            .MaximumLength(150)
            .Must(x => !string.IsNullOrWhiteSpace(x?.Trim()))
            .WithMessage("ContactName is required.");

        RuleFor(x => x.ContactPhone)
            .NotEmpty()
            .MaximumLength(30)
            .Matches(@"^\+?\d{10,15}$")
            .WithMessage("Invalid phone configuration. Provide 10-15 digits with an optional leading '+' format.");

        RuleFor(x => x.Source)
            .NotEmpty()
            .Must(x => !string.IsNullOrWhiteSpace(x) && AllowedSources.Contains(x.Trim().ToLower()))
            .WithMessage($"Source must be one of: {string.Join(", ", AllowedSources)}.");

        RuleFor(x => x.DesiredCheckOutDate)
            .GreaterThan(x => x.DesiredCheckInDate)
            .When(x => x.DesiredCheckInDate.HasValue && x.DesiredCheckOutDate.HasValue)
            .WithMessage("DesiredCheckOutDate must be after DesiredCheckInDate.");

        RuleFor(x => x.GuestCount)
            .GreaterThan(0)
            .When(x => x.GuestCount.HasValue)
            .WithMessage("GuestCount must be greater than 0.");
    }
}

public class UpdateCrmLeadRequestValidator : AbstractValidator<UpdateCrmLeadRequest>
{
    private static readonly string[] AllowedSources = { "direct", "admin", "phone", "whatsapp", "website" };

    public UpdateCrmLeadRequestValidator()
    {
        RuleFor(x => x.ContactName)
            .NotEmpty()
            .MaximumLength(150)
            .Must(x => !string.IsNullOrWhiteSpace(x?.Trim()))
            .WithMessage("ContactName is required.");

        RuleFor(x => x.ContactPhone)
            .NotEmpty()
            .MaximumLength(30)
            .Matches(@"^\+?\d{10,15}$")
            .WithMessage("Invalid phone configuration. Provide 10-15 digits with an optional leading '+' format.");

        RuleFor(x => x.Source)
            .NotEmpty()
            .Must(x => !string.IsNullOrWhiteSpace(x) && AllowedSources.Contains(x.Trim().ToLower()))
            .WithMessage($"Source must be one of: {string.Join(", ", AllowedSources)}.");

        RuleFor(x => x.DesiredCheckOutDate)
            .GreaterThan(x => x.DesiredCheckInDate)
            .When(x => x.DesiredCheckInDate.HasValue && x.DesiredCheckOutDate.HasValue)
            .WithMessage("DesiredCheckOutDate must be after DesiredCheckInDate.");

        RuleFor(x => x.GuestCount)
            .GreaterThan(0)
            .When(x => x.GuestCount.HasValue)
            .WithMessage("GuestCount must be greater than 0.");
    }
}

public class UpdateCrmLeadStatusRequestValidator : AbstractValidator<UpdateCrmLeadStatusRequest>
{
    private static readonly string[] AllowedStatuses = Enum.GetNames<RentalPlatform.Shared.Enums.LeadStatus>();

    public UpdateCrmLeadStatusRequestValidator()
    {
        RuleFor(x => x.LeadStatus)
            .NotEmpty()
            .Must(x => !string.IsNullOrWhiteSpace(x) && AllowedStatuses.Any(s => s.Equals(x.Trim(), StringComparison.OrdinalIgnoreCase)))
            .WithMessage($"LeadStatus must be one of: {string.Join(", ", AllowedStatuses)}.");
    }
}

public class ConvertLeadToBookingRequestValidator : AbstractValidator<ConvertLeadToBookingRequest>
{
    public ConvertLeadToBookingRequestValidator()
    {
        RuleFor(x => x.ClientId).NotEmpty();
        RuleFor(x => x.UnitId).NotEmpty();
        
        RuleFor(x => x.CheckInDate)
            .NotEmpty();

        RuleFor(x => x.CheckOutDate)
            .NotEmpty()
            .GreaterThan(x => x.CheckInDate)
            .WithMessage("CheckOutDate must be after CheckInDate.");

        RuleFor(x => x.GuestCount)
            .GreaterThan(0)
            .WithMessage("GuestCount must be greater than 0.");
    }
}
