using FluentValidation;
using RentalPlatform.API.DTOs.Requests.Bookings;
using System;
using System.Linq;

namespace RentalPlatform.API.Validators;

public class CreateBookingRequestValidator : AbstractValidator<CreateBookingRequest>
{
    private static readonly string[] AllowedSources = { "direct", "admin", "phone", "whatsapp", "website" };

    public CreateBookingRequestValidator()
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

        RuleFor(x => x.Source)
            .NotEmpty()
            .Must(x => !string.IsNullOrWhiteSpace(x) && AllowedSources.Contains(x.Trim().ToLower()))
            .WithMessage($"Source must be one of: {string.Join(", ", AllowedSources)}.");
    }
}

public class CreateClientBookingRequestValidator : AbstractValidator<CreateClientBookingRequest>
{
    public CreateClientBookingRequestValidator()
    {
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

public class CreateGuestBookingRequestValidator : AbstractValidator<CreateGuestBookingRequest>
{
    public CreateGuestBookingRequestValidator()
    {
        RuleFor(x => x.FirstName)
            .NotEmpty()
            .MaximumLength(80)
            .WithMessage("First name is required and must be 80 characters or fewer.");

        RuleFor(x => x.LastName)
            .NotEmpty()
            .MaximumLength(80)
            .WithMessage("Last name is required and must be 80 characters or fewer.");

        RuleFor(x => x.Phone)
            .NotEmpty()
            .Must(BeValidPhone)
            .WithMessage("Phone must contain 10 to 15 digits and may start with +.");

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

    private static bool BeValidPhone(string? phone)
    {
        if (string.IsNullOrWhiteSpace(phone))
            return false;

        var normalized = phone
            .Trim()
            .Replace(" ", string.Empty)
            .Replace("-", string.Empty)
            .Replace("(", string.Empty)
            .Replace(")", string.Empty);

        return System.Text.RegularExpressions.Regex.IsMatch(normalized, @"^\+?\d{10,15}$");
    }
}

public class UpdatePendingBookingRequestValidator : AbstractValidator<UpdatePendingBookingRequest>
{
    private static readonly string[] AllowedSources = { "direct", "admin", "phone", "whatsapp", "website" };

    public UpdatePendingBookingRequestValidator()
    {
        RuleFor(x => x.CheckInDate)
            .NotEmpty();

        RuleFor(x => x.CheckOutDate)
            .NotEmpty()
            .GreaterThan(x => x.CheckInDate)
            .WithMessage("CheckOutDate must be after CheckInDate.");

        RuleFor(x => x.GuestCount)
            .GreaterThan(0)
            .WithMessage("GuestCount must be greater than 0.");

        RuleFor(x => x.Source)
            .NotEmpty()
            .Must(x => !string.IsNullOrWhiteSpace(x) && AllowedSources.Contains(x.Trim().ToLower()))
            .WithMessage($"Source must be one of: {string.Join(", ", AllowedSources)}.");
    }
}
