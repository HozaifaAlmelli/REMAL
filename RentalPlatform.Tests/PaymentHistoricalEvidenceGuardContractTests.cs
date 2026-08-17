using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging.Abstractions;
using RentalPlatform.API.Middleware;
using RentalPlatform.Business.Exceptions;
using RentalPlatform.Tests.Infrastructure;
using Xunit;

namespace RentalPlatform.Tests;

[Trait(TestCategories.Name, TestCategories.Fast)]
public sealed class PaymentHistoricalEvidenceGuardContractTests
{
    [Fact]
    public async Task OrdinaryOverpaymentKeepsTheExistingConflictEnvelope()
    {
        const string message =
            "This payment of 0.01 exceeds the remaining balance for booking " +
            "00000000-0000-0000-0000-000000000001. Amount owed: 10000.00, " +
            "already recorded (paid + pending): 10000.00, remaining: 0.00. " +
            "Overpayments are not allowed.";
        var middleware = new ExceptionHandlingMiddleware(
            _ => throw new ConflictException(message),
            NullLogger<ExceptionHandlingMiddleware>.Instance);
        var context = new DefaultHttpContext();
        context.Response.Body = new MemoryStream();

        await middleware.InvokeAsync(context);

        Assert.Equal(StatusCodes.Status409Conflict, context.Response.StatusCode);
        context.Response.Body.Position = 0;
        using var body = await JsonDocument.ParseAsync(context.Response.Body);
        Assert.False(body.RootElement.GetProperty("success").GetBoolean());
        Assert.Equal(message, body.RootElement.GetProperty("message").GetString());
        Assert.False(body.RootElement.TryGetProperty("code", out _));
    }
}
