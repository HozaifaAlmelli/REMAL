using FluentValidation;
using RentalPlatform.API.DTOs.Requests.Bookings;
using RentalPlatform.Business.Services;
using RentalPlatform.Shared.Constants;

namespace RentalPlatform.API.Validators;

public sealed class CorrectHistoricalOwnerAttributionRequestValidator
    : AbstractValidator<CorrectHistoricalOwnerAttributionRequest>
{
    public CorrectHistoricalOwnerAttributionRequestValidator()
    {
        RuleFor(request => request.ExpectedCurrentOwnerId)
            .NotEmpty()
            .WithMessage("ExpectedCurrentOwnerId is required.");
        RuleFor(request => request.TargetOwnerId)
            .NotEmpty()
            .WithMessage("TargetOwnerId is required.");
        RuleFor(request => request.Reason)
            .Must(reason =>
            {
                var normalized = HistoricalOwnerCorrectionRequestHasher.Normalize(reason)?.ToLowerInvariant();
                return normalized is not null && HistoricalOwnerCorrectionReasons.All.Contains(normalized);
            })
            .WithMessage("Reason must use the canonical owner-correction vocabulary.");
        RuleFor(request => request.Note)
            .Must(note =>
            {
                var normalized = HistoricalOwnerCorrectionRequestHasher.Normalize(note);
                return normalized is null || normalized.Length <= 500;
            })
            .WithMessage("Note cannot exceed 500 characters after normalization.");
        RuleFor(request => request.Note)
            .Must(note => HistoricalOwnerCorrectionRequestHasher.Normalize(note) is not null)
            .When(request =>
                string.Equals(
                    HistoricalOwnerCorrectionRequestHasher.Normalize(request.Reason),
                    HistoricalOwnerCorrectionReasons.Other,
                    StringComparison.OrdinalIgnoreCase))
            .WithMessage("Note is required when reason is 'other'.");
    }
}
