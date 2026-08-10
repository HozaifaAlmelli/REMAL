using FluentValidation;
using RentalPlatform.API.DTOs.Requests.ReportsAnalytics;
using RentalPlatform.Shared.Constants;
using System.Globalization;

namespace RentalPlatform.API.Validators.ReportsAnalytics;

public class GetBookingAnalyticsRequestValidator : AbstractValidator<GetBookingAnalyticsRequest>
{
    public GetBookingAnalyticsRequestValidator()
    {
        RuleFor(x => x.Page)
            .GreaterThanOrEqualTo(1)
            .WithMessage("Page must be 1 or greater.");

        RuleFor(x => x.PageSize)
            .GreaterThanOrEqualTo(1)
            .WithMessage("PageSize must be 1 or greater.")
            .LessThanOrEqualTo(100)
            .WithMessage("PageSize must not exceed 100.");

        RuleFor(x => x)
            .Must(x => x.DateFrom is null || x.DateTo is null || x.DateFrom <= x.DateTo)
            .WithMessage("DateFrom must be on or before DateTo.")
            .When(x => x.DateFrom.HasValue && x.DateTo.HasValue);

        RuleFor(x => x.BookingSource)
            .Must(s => s is null || !string.IsNullOrWhiteSpace(s))
            .WithMessage("BookingSource must not be blank when provided.");

        HistoricalReportingValidationRules.Add(this);

        RuleFor(x => x)
            .Must(x => !x.DateFrom.HasValue || !x.DateTo.HasValue
                || HistoricalReportingValidationRules.IsWithinInclusive24Months(x.DateFrom.Value, x.DateTo.Value))
            .WithMessage("Date range must not exceed 24 inclusive months.")
            .WithErrorCode(HistoricalErrorCodes.ValidationError);
    }
}

public class GetFinanceAnalyticsRequestValidator : AbstractValidator<GetFinanceAnalyticsRequest>
{
    public GetFinanceAnalyticsRequestValidator()
    {
        RuleFor(x => x.Page)
            .GreaterThanOrEqualTo(1)
            .WithMessage("Page must be 1 or greater.");

        RuleFor(x => x.PageSize)
            .GreaterThanOrEqualTo(1)
            .WithMessage("PageSize must be 1 or greater.")
            .LessThanOrEqualTo(100)
            .WithMessage("PageSize must not exceed 100.");

        RuleFor(x => x)
            .Must(x => x.DateFrom is null || x.DateTo is null || x.DateFrom <= x.DateTo)
            .WithMessage("DateFrom must be on or before DateTo.")
            .When(x => x.DateFrom.HasValue && x.DateTo.HasValue);

        HistoricalReportingValidationRules.Add(this);

        RuleFor(x => x)
            .Must(x => !x.DateFrom.HasValue || !x.DateTo.HasValue
                || HistoricalReportingValidationRules.IsWithinInclusive24Months(x.DateFrom.Value, x.DateTo.Value))
            .WithMessage("Date range must not exceed 24 inclusive months.")
            .WithErrorCode(HistoricalErrorCodes.ValidationError);
    }
}

public sealed class GetHistoricalReportingDailyRequestValidator
    : AbstractValidator<GetHistoricalReportingDailyRequest>
{
    public GetHistoricalReportingDailyRequestValidator()
    {
        RuleFor(x => x.DateFrom)
            .NotEmpty()
            .WithMessage("DateFrom is required.")
            .WithErrorCode(HistoricalErrorCodes.ValidationError);

        RuleFor(x => x.DateTo)
            .NotEmpty()
            .WithMessage("DateTo is required.")
            .WithErrorCode(HistoricalErrorCodes.ValidationError);

        RuleFor(x => x)
            .Must(x => x.DateFrom == default || x.DateTo == default || x.DateFrom <= x.DateTo)
            .WithMessage("DateFrom must be on or before DateTo.")
            .WithErrorCode(HistoricalErrorCodes.ValidationError);

        RuleFor(x => x)
            .Must(x => x.DateFrom == default || x.DateTo == default
                || HistoricalReportingValidationRules.IsWithinInclusive24Months(x.DateFrom, x.DateTo))
            .WithMessage("Date range must not exceed 24 inclusive months.")
            .WithErrorCode(HistoricalErrorCodes.ValidationError);

        HistoricalReportingValidationRules.Add(this);
    }
}

internal static class HistoricalReportingValidationRules
{
    public static bool IsWithinInclusive24Months(DateOnly from, DateOnly to)
    {
        var monthDifference = ((to.Year - from.Year) * 12) + to.Month - from.Month;
        return monthDifference < 24 || (monthDifference == 24 && to.Day < from.Day);
    }

    public static void Add(AbstractValidator<GetBookingAnalyticsRequest> validator) =>
        validator.RuleFor(x => x)
            .Must(x => !x.HistoricalOnly || x.IncludeHistorical)
            .WithMessage("HistoricalOnly=true cannot be combined with IncludeHistorical=false.")
            .WithErrorCode(HistoricalErrorCodes.ValidationError);

    public static void Add(AbstractValidator<GetFinanceAnalyticsRequest> validator) =>
        validator.RuleFor(x => x)
            .Must(x => !x.HistoricalOnly || x.IncludeHistorical)
            .WithMessage("HistoricalOnly=true cannot be combined with IncludeHistorical=false.")
            .WithErrorCode(HistoricalErrorCodes.ValidationError);

    public static void Add(AbstractValidator<GetHistoricalReportingDailyRequest> validator) =>
        validator.RuleFor(x => x)
            .Must(x => !x.HistoricalOnly || x.IncludeHistorical)
            .WithMessage("HistoricalOnly=true cannot be combined with IncludeHistorical=false.")
            .WithErrorCode(HistoricalErrorCodes.ValidationError);
}

public sealed class GetHistoricalReconciliationRequestValidator
    : AbstractValidator<GetHistoricalReconciliationRequest>
{
    public GetHistoricalReconciliationRequestValidator()
    {
        RuleFor(x => x.StayMonthFrom)
            .Must(IsMonth)
            .WithMessage("StayMonthFrom must use YYYY-MM format.")
            .WithErrorCode(HistoricalErrorCodes.ValidationError);

        RuleFor(x => x.StayMonthTo)
            .Must(IsMonth)
            .WithMessage("StayMonthTo must use YYYY-MM format.")
            .WithErrorCode(HistoricalErrorCodes.ValidationError);

        RuleFor(x => x)
            .Must(x => !TryMonth(x.StayMonthFrom, out var from)
                || !TryMonth(x.StayMonthTo, out var to)
                || (from <= to && (((to.Year - from.Year) * 12) + to.Month - from.Month) <= 23))
            .WithMessage("Stay month range must be ordered and not exceed 24 inclusive months.")
            .WithErrorCode(HistoricalErrorCodes.ValidationError);
    }

    private static bool IsMonth(string value) => TryMonth(value, out _);

    private static bool TryMonth(string value, out DateOnly month) =>
        DateOnly.TryParseExact(
            $"{value}-01",
            "yyyy-MM-dd",
            CultureInfo.InvariantCulture,
            DateTimeStyles.None,
            out month);
}

public class GetReviewsAnalyticsRequestValidator : AbstractValidator<GetReviewsAnalyticsRequest>
{
    public GetReviewsAnalyticsRequestValidator()
    {
        RuleFor(x => x.Page)
            .GreaterThanOrEqualTo(1)
            .WithMessage("Page must be 1 or greater.");

        RuleFor(x => x.PageSize)
            .GreaterThanOrEqualTo(1)
            .WithMessage("PageSize must be 1 or greater.")
            .LessThanOrEqualTo(100)
            .WithMessage("PageSize must not exceed 100.");

        RuleFor(x => x)
            .Must(x => x.DateFrom is null || x.DateTo is null || x.DateFrom <= x.DateTo)
            .WithMessage("DateFrom must be on or before DateTo.")
            .When(x => x.DateFrom.HasValue && x.DateTo.HasValue);
    }
}

public class GetNotificationsAnalyticsRequestValidator : AbstractValidator<GetNotificationsAnalyticsRequest>
{
    private static readonly string[] AllowedChannels =
        ["in_app", "email", "sms", "whatsapp"];

    public GetNotificationsAnalyticsRequestValidator()
    {
        RuleFor(x => x.Page)
            .GreaterThanOrEqualTo(1)
            .WithMessage("Page must be 1 or greater.");

        RuleFor(x => x.PageSize)
            .GreaterThanOrEqualTo(1)
            .WithMessage("PageSize must be 1 or greater.")
            .LessThanOrEqualTo(100)
            .WithMessage("PageSize must not exceed 100.");

        RuleFor(x => x)
            .Must(x => x.DateFrom is null || x.DateTo is null || x.DateFrom <= x.DateTo)
            .WithMessage("DateFrom must be on or before DateTo.")
            .When(x => x.DateFrom.HasValue && x.DateTo.HasValue);

        RuleFor(x => x.Channel)
            .Must(c => c is null || !string.IsNullOrWhiteSpace(c))
            .WithMessage("Channel must not be blank when provided.");

        RuleFor(x => x.Channel)
            .Must(c => c is null || AllowedChannels.Contains(c.Trim().ToLowerInvariant()))
            .WithMessage($"Channel must be one of: {string.Join(", ", AllowedChannels)}.")
            .When(x => x.Channel is not null && !string.IsNullOrWhiteSpace(x.Channel));
    }
}
