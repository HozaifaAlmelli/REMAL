using Microsoft.AspNetCore.Mvc.Filters;
using RentalPlatform.Business.Exceptions;
using RentalPlatform.Shared.Constants;

namespace RentalPlatform.API.Filters;

[AttributeUsage(AttributeTargets.Method)]
public sealed class RequireHistoricalIdempotencyKeyAttribute : Attribute, IAsyncResourceFilter
{
    public const string ContextItemKey = "HistoricalBooking.IdempotencyKey";

    public async Task OnResourceExecutionAsync(
        ResourceExecutingContext context,
        ResourceExecutionDelegate next)
    {
        var header = context.HttpContext.Request.Headers["Idempotency-Key"].ToString();
        if (!Guid.TryParse(header, out var key) || key == Guid.Empty)
        {
            throw new BusinessValidationException(
                "Idempotency-Key must be supplied as a valid UUID.",
                HistoricalErrorCodes.IdempotencyKeyRequired);
        }

        context.HttpContext.Items[ContextItemKey] = key;
        await next();
    }
}
