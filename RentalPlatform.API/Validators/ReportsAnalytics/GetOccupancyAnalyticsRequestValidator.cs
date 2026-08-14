using FluentValidation;
using RentalPlatform.API.DTOs.Requests.ReportsAnalytics;
using RentalPlatform.Shared.Constants;

namespace RentalPlatform.API.Validators.ReportsAnalytics;

public sealed class GetOccupancyAnalyticsRequestValidator : AbstractValidator<GetOccupancyAnalyticsRequest>
{
    public GetOccupancyAnalyticsRequestValidator()
    {
        RuleFor(request => request.From)
            .NotEqual(default(DateOnly))
            .WithMessage("from is required.")
            .WithErrorCode(HistoricalErrorCodes.ValidationError);

        RuleFor(request => request.ToExclusive)
            .NotEqual(default(DateOnly))
            .WithMessage("toExclusive is required.")
            .WithErrorCode(HistoricalErrorCodes.ValidationError);

        RuleFor(request => request)
            .Must(request => request.ToExclusive > request.From)
            .When(request => request.From != default && request.ToExclusive != default)
            .WithMessage("toExclusive must be later than from.")
            .WithErrorCode(HistoricalErrorCodes.ValidationError);

        RuleFor(request => request)
            .Must(request => request.From > DateOnly.MaxValue.AddMonths(-24)
                || request.ToExclusive <= request.From.AddMonths(24))
            .When(request => request.From != default && request.ToExclusive > request.From)
            .WithMessage("Occupancy range must not exceed 24 months.")
            .WithErrorCode(HistoricalErrorCodes.ValidationError);
    }
}
