using Microsoft.AspNetCore.Mvc;
using RentalPlatform.Shared.Constants;

namespace RentalPlatform.API.Models;

public static class ApiValidationResponseFactory
{
    public static IActionResult Create(ActionContext context)
    {
        var errors = context.ModelState.Values
            .SelectMany(value => value.Errors)
            .Select(error => error.ErrorMessage)
            .Where(message => !string.IsNullOrEmpty(message))
            .ToArray();

        var response = ApiResponse.CreateFailure(
            "Validation failed",
            errors,
            HistoricalErrorCodes.ValidationError);
        return new BadRequestObjectResult(response);
    }
}
