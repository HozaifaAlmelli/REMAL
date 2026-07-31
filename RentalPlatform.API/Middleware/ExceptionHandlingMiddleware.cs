using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using System;
using System.Linq;
using System.Net;
using System.Text.Json;
using System.Threading.Tasks;
using RentalPlatform.API.Models;
using RentalPlatform.Business.Exceptions;

namespace RentalPlatform.API.Middleware;

public class ExceptionHandlingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionHandlingMiddleware> _logger;

    public ExceptionHandlingMiddleware(RequestDelegate next, ILogger<ExceptionHandlingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "An unhandled exception has occurred.");
            await HandleExceptionAsync(context, ex);
        }
    }

    private static Task HandleExceptionAsync(HttpContext context, Exception exception)
    {
        context.Response.ContentType = "application/json";
        
        int statusCode;
        string message;
        string[]? errors = null;

        switch (exception)
        {
            case BusinessValidationException validationEx:
                statusCode = (int)HttpStatusCode.BadRequest; // 400
                message = "Validation failed";
                errors = new[] { validationEx.Message };
                break;

            case ConflictException conflictEx:
                statusCode = (int)HttpStatusCode.Conflict; // 409
                message = conflictEx.Message;
                break;

            case NotFoundException notFoundEx:
                statusCode = (int)HttpStatusCode.NotFound; // 404
                message = notFoundEx.Message;
                break;

            case UnauthorizedBusinessException unauthorizedEx:
                statusCode = (int)HttpStatusCode.Unauthorized; // 401
                message = unauthorizedEx.Message;
                break;

            default:
                statusCode = (int)HttpStatusCode.InternalServerError; // 500
                message = "An unexpected error occurred. Please try again later.";
                break;
        }

        context.Response.StatusCode = statusCode;

        var code = (exception as IBusinessErrorCode)?.Code;
        var metadata = (exception as IBusinessErrorMetadata)?.Metadata;
        var response = ApiResponse.CreateFailure(message, errors, code, metadata);
        
        var options = new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };
        return context.Response.WriteAsync(JsonSerializer.Serialize(response, options));
    }
}
