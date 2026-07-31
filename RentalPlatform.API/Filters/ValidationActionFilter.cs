using Microsoft.AspNetCore.Mvc.Filters;
using System.Threading.Tasks;
using Microsoft.Extensions.DependencyInjection;
using System.Linq;
using FluentValidation;
using RentalPlatform.Business.Exceptions;
using RentalPlatform.Shared.Constants;

namespace RentalPlatform.API.Filters;

public class ValidationActionFilter : IAsyncActionFilter
{
    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        foreach (var argument in context.ActionArguments.Values.Where(v => v != null))
        {
            var argumentType = argument!.GetType();
            
            // Check if a validator exists for this type
            var validatorType = typeof(IValidator<>).MakeGenericType(argumentType);
            var validator = context.HttpContext.RequestServices.GetService(validatorType) as IValidator;

            if (validator != null)
            {
                var validationContext = new ValidationContext<object>(argument);
                var validationResult = await validator.ValidateAsync(validationContext);

                if (!validationResult.IsValid)
                {
                    var errors = validationResult.Errors.Select(e => e.ErrorMessage).ToList();
                    var errorMessage = string.Join(" | ", errors);
                    
                    // Throw our standard business validation exception to be caught by the middleware
                    var historicalCodes = validationResult.Errors
                        .Select(error => error.ErrorCode)
                        .Where(HistoricalErrorCodes.All.Contains)
                        .ToArray();
                    var code = historicalCodes.Contains(HistoricalErrorCodes.ClientReferenceInvalid)
                        ? HistoricalErrorCodes.ClientReferenceInvalid
                        : historicalCodes.FirstOrDefault();

                    throw code is null
                        ? new BusinessValidationException(errorMessage)
                        : new BusinessValidationException(errorMessage, code);
                }
            }
        }

        await next();
    }
}
