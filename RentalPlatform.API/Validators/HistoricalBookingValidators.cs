using FluentValidation;
using RentalPlatform.API.DTOs.Requests.Bookings;
using RentalPlatform.Shared.Constants;

namespace RentalPlatform.API.Validators;

public sealed class RecordHistoricalBookingRequestValidator
    : AbstractValidator<RecordHistoricalBookingRequest>
{
    public RecordHistoricalBookingRequestValidator()
    {
        RuleFor(request => request.UnitId)
            .NotEmpty()
            .WithErrorCode(HistoricalErrorCodes.ValidationError);

        RuleFor(request => request)
            .Must(request => request.ClientId.HasValue != (request.NewClient is not null))
            .WithMessage("Provide exactly one of ClientId or NewClient.")
            .WithErrorCode(HistoricalErrorCodes.ClientReferenceInvalid);

        When(request => request.NewClient is not null, () =>
        {
            RuleFor(request => request.NewClient!)
                .SetValidator(new NewHistoricalClientRequestValidator());
        });

        RuleFor(request => request.CheckInDate)
            .NotEmpty()
            .WithErrorCode(HistoricalErrorCodes.ValidationError);
        RuleFor(request => request.CheckOutDate)
            .NotEmpty()
            .WithErrorCode(HistoricalErrorCodes.ValidationError)
            .GreaterThan(request => request.CheckInDate)
            .WithMessage("CheckOutDate must be after CheckInDate.")
            .WithErrorCode(HistoricalErrorCodes.ValidationError);
        RuleFor(request => request.GuestCount)
            .GreaterThan(0)
            .WithErrorCode(HistoricalErrorCodes.ValidationError);
        RuleFor(request => request.ActualBookedAt)
            .NotEmpty()
            .WithErrorCode(HistoricalErrorCodes.ValidationError);
        RuleFor(request => request.HistoricalEntryReason)
            .NotEmpty()
            .WithErrorCode(HistoricalErrorCodes.ValidationError)
            .Must(reason => HistoricalEntryReasons.All.Contains(reason.Trim().ToLower()))
            .WithMessage("HistoricalEntryReason is invalid.")
            .WithErrorCode(HistoricalErrorCodes.ValidationError);
        RuleFor(request => request.HistoricalEntryNote)
            .MaximumLength(1000)
            .WithErrorCode(HistoricalErrorCodes.ValidationError);
        RuleFor(request => request.HistoricalEntryNote)
            .Must(note => !string.IsNullOrWhiteSpace(note) && note.Trim().Length >= 10)
            .When(request => string.Equals(
                request.HistoricalEntryReason?.Trim(),
                HistoricalEntryReasons.Other,
                StringComparison.OrdinalIgnoreCase))
            .WithMessage("HistoricalEntryNote must contain at least 10 characters when reason is 'other'.")
            .WithErrorCode(HistoricalErrorCodes.ValidationError);
        RuleFor(request => request.OriginalSource)
            .NotEmpty()
            .WithErrorCode(HistoricalErrorCodes.ValidationError)
            .MaximumLength(50)
            .WithErrorCode(HistoricalErrorCodes.ValidationError);
        RuleFor(request => request.ExternalReference)
            .MaximumLength(100)
            .WithErrorCode(HistoricalErrorCodes.ValidationError);
        RuleFor(request => request.AgreedAmount)
            .GreaterThanOrEqualTo(0)
            .WithErrorCode(HistoricalErrorCodes.ValidationError)
            .LessThanOrEqualTo(9_999_999_999.99m)
            .WithErrorCode(HistoricalErrorCodes.ValidationError)
            .Must(amount => decimal.Round(amount, 2) == amount)
            .WithMessage("AgreedAmount must be a non-negative decimal with no more than two decimal places.")
            .WithErrorCode(HistoricalErrorCodes.ValidationError);
    }
}

public sealed class NewHistoricalClientRequestValidator
    : AbstractValidator<NewHistoricalClientRequest>
{
    public NewHistoricalClientRequestValidator()
    {
        RuleFor(client => client.Name)
            .NotEmpty()
            .WithErrorCode(HistoricalErrorCodes.ValidationError)
            .MaximumLength(150)
            .WithErrorCode(HistoricalErrorCodes.ValidationError);
        RuleFor(client => client.Phone)
            .NotEmpty()
            .WithErrorCode(HistoricalErrorCodes.ValidationError)
            .Matches(@"^\+?\d{10,15}$")
            .WithErrorCode(HistoricalErrorCodes.ValidationError);
        RuleFor(client => client.Email)
            .EmailAddress()
            .WithErrorCode(HistoricalErrorCodes.ValidationError)
            .MaximumLength(255)
            .When(client => !string.IsNullOrWhiteSpace(client.Email))
            .WithErrorCode(HistoricalErrorCodes.ValidationError);
    }
}
