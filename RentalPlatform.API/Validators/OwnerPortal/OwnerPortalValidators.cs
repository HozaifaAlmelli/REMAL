using FluentValidation;
using RentalPlatform.API.DTOs.Requests.OwnerPortal;

namespace RentalPlatform.API.Validators.OwnerPortal;

public class GetOwnerPortalUnitsRequestValidator : AbstractValidator<GetOwnerPortalUnitsRequest>
{
    public GetOwnerPortalUnitsRequestValidator()
    {
        RuleFor(x => x.Page)
            .GreaterThanOrEqualTo(1)
            .WithMessage("Page must be 1 or greater.");

        RuleFor(x => x.PageSize)
            .GreaterThanOrEqualTo(1)
            .WithMessage("PageSize must be 1 or greater.")
            .LessThanOrEqualTo(100)
            .WithMessage("PageSize must not exceed 100.");
    }
}

public class GetOwnerPortalBookingsRequestValidator : AbstractValidator<GetOwnerPortalBookingsRequest>
{
    private static readonly string[] ValidBookingStatuses =
        ["prospecting", "relevant", "noanswer", "notrelevant", "booked", "confirmed", "checkin", "completed", "cancelled", "leftearly"];

    public GetOwnerPortalBookingsRequestValidator()
    {
        RuleFor(x => x.Page)
            .GreaterThanOrEqualTo(1)
            .WithMessage("Page must be 1 or greater.");

        RuleFor(x => x.PageSize)
            .GreaterThanOrEqualTo(1)
            .WithMessage("PageSize must be 1 or greater.")
            .LessThanOrEqualTo(100)
            .WithMessage("PageSize must not exceed 100.");

        RuleFor(x => x.BookingStatus)
            .Must(s => s is null || ValidBookingStatuses.Contains(s))
            .WithMessage($"BookingStatus must be one of: {string.Join(", ", ValidBookingStatuses)}.");

        RuleFor(x => x)
            .Must(x => x.CheckInFrom is null || x.CheckInTo is null || x.CheckInFrom <= x.CheckInTo)
            .WithMessage("CheckInFrom must be on or before CheckInTo.")
            .When(x => x.CheckInFrom.HasValue && x.CheckInTo.HasValue);
    }
}

public class GetOwnerPortalFinanceRequestValidator : AbstractValidator<GetOwnerPortalFinanceRequest>
{
    private static readonly string[] ValidInvoiceStatuses =
        ["draft", "issued", "paid", "cancelled"];

    private static readonly string[] ValidPayoutStatuses =
        ["pending", "scheduled", "paid", "cancelled"];

    public GetOwnerPortalFinanceRequestValidator()
    {
        RuleFor(x => x.Page)
            .GreaterThanOrEqualTo(1)
            .WithMessage("Page must be 1 or greater.");

        RuleFor(x => x.PageSize)
            .GreaterThanOrEqualTo(1)
            .WithMessage("PageSize must be 1 or greater.")
            .LessThanOrEqualTo(100)
            .WithMessage("PageSize must not exceed 100.");

        RuleFor(x => x.InvoiceStatus)
            .Must(s => s is null || ValidInvoiceStatuses.Contains(s))
            .WithMessage($"InvoiceStatus must be one of: {string.Join(", ", ValidInvoiceStatuses)}.");

        RuleFor(x => x.PayoutStatus)
            .Must(s => s is null || ValidPayoutStatuses.Contains(s))
            .WithMessage($"PayoutStatus must be one of: {string.Join(", ", ValidPayoutStatuses)}.");
    }
}
