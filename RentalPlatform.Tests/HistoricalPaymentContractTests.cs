using System.Reflection;
using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using RentalPlatform.API.Authorization;
using RentalPlatform.API.Controllers;
using RentalPlatform.API.DTOs.Requests.Payments;
using RentalPlatform.API.Filters;
using RentalPlatform.Business.Exceptions;
using RentalPlatform.Business.Interfaces;
using RentalPlatform.Business.Models;
using RentalPlatform.Business.Services;
using RentalPlatform.Data.Entities;
using RentalPlatform.Shared.Constants;
using Xunit;

namespace RentalPlatform.Tests;

[Trait(TestCategories.Name, TestCategories.Fast)]
public sealed class HistoricalPaymentContractTests
{
    [Fact]
    public void RequestIsStrictAndContainsOnlyApprovedFields()
    {
        Assert.Equal(
            new[] { "Amount", "PaidAt", "PaymentMethod", "Reason", "ReferenceNumber" },
            typeof(RecordHistoricalPaymentRequest).GetProperties()
                .Select(property => property.Name)
                .OrderBy(name => name));

        Assert.Throws<JsonException>(() => JsonSerializer.Deserialize<RecordHistoricalPaymentRequest>(
            """{"amount":10,"paymentMethod":"cash","paidAt":"2026-07-15T10:30:00+03:00","reason":"verified","actorId":"00000000-0000-0000-0000-000000000001"}""",
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true }));
    }

    [Fact]
    public void CanonicalHashIgnoresSemanticFormattingButIncludesBookingAndPayload()
    {
        var bookingId = Guid.NewGuid();
        var actorId = Guid.NewGuid();
        var key = Guid.NewGuid();
        var first = new RecordHistoricalPaymentCommand(
            bookingId, 1000m, " CASH ",
            new DateTimeOffset(2026, 7, 15, 10, 30, 0, TimeSpan.FromHours(3)),
            " Legacy-123 ", "Recorded   from verified receipt", actorId, key);
        var equivalent = first with
        {
            Amount = 1000.00m,
            PaymentMethod = "cash",
            PaidAt = first.PaidAt.ToUniversalTime(),
            ReferenceNumber = "legacy-123",
            Reason = "Recorded from verified receipt"
        };

        Assert.Equal(
            HistoricalPaymentRequestHasher.Compute(first),
            HistoricalPaymentRequestHasher.Compute(equivalent));
        Assert.NotEqual(
            HistoricalPaymentRequestHasher.Compute(first),
            HistoricalPaymentRequestHasher.Compute(first with { BookingId = Guid.NewGuid() }));
        Assert.NotEqual(
            HistoricalPaymentRequestHasher.Compute(first),
            HistoricalPaymentRequestHasher.Compute(first with { Amount = 999m }));
    }

    [Fact]
    public void EndpointAndPermissionAreCanonicalAndDedicated()
    {
        var method = typeof(HistoricalPaymentsController).GetMethod("Record")!;
        var route = method.GetCustomAttribute<HttpPostAttribute>();
        var authorize = method.GetCustomAttribute<AuthorizeAttribute>();

        Assert.Equal("{bookingId:guid}/historical-payments", route!.Template);
        Assert.Equal(PermissionKeys.PaymentsRecordHistorical, authorize!.Policy);
        Assert.Contains(PermissionKeys.PaymentsRecordHistorical, PermissionKeys.All);
        Assert.Contains(
            PermissionKeys.Descriptors,
            descriptor => descriptor.Key == PermissionKeys.PaymentsRecordHistorical);
        Assert.NotEqual(PermissionKeys.FinanceManage, authorize.Policy);
        Assert.NotEqual(PermissionKeys.BookingsRecordHistorical, authorize.Policy);
    }

    [Fact]
    public void AllHistoricalPaymentCodesAreRegisteredExactlyOnce()
    {
        var expected = new[]
        {
            HistoricalErrorCodes.HistoricalPaymentIdempotencyKeyRequired,
            HistoricalErrorCodes.HistoricalPaymentIdempotencyKeyReused,
            HistoricalErrorCodes.HistoricalPaymentRequestInProgress,
            HistoricalErrorCodes.HistoricalPaymentBookingNotFound,
            HistoricalErrorCodes.HistoricalPaymentBookingRequired,
            HistoricalErrorCodes.HistoricalPaymentSnapshotRequired,
            HistoricalErrorCodes.HistoricalPaymentAmountInvalid,
            HistoricalErrorCodes.HistoricalPaymentMethodInvalid,
            HistoricalErrorCodes.HistoricalPaymentReasonRequired,
            HistoricalErrorCodes.HistoricalPaymentExceedsAgreedAmount,
            HistoricalErrorCodes.HistoricalPaymentReferenceAlreadyExists,
            HistoricalErrorCodes.HistoricalPaymentImmutable,
            HistoricalErrorCodes.HistoricalPaymentLiveCollectionForbidden
        };

        Assert.Equal(13, expected.Distinct(StringComparer.Ordinal).Count());
        Assert.All(expected, code => Assert.Contains(code, HistoricalErrorCodes.All));
    }

    [Theory]
    [InlineData("amount")]
    [InlineData("key")]
    [InlineData("method")]
    [InlineData("reason")]
    public async Task InvalidCommandFieldsReturnTheirStableCodes(string field)
    {
        var service = new HistoricalPaymentService(null!, new FixedTimeProvider());
        var command = ValidCommand() with
        {
            Amount = field == "amount" ? 0m : 10m,
            IdempotencyKey = field == "key" ? Guid.Empty : Guid.NewGuid(),
            PaymentMethod = field == "method" ? "wire" : "cash",
            Reason = field == "reason" ? "   " : "Verified receipt"
        };

        var error = await Assert.ThrowsAsync<BusinessValidationException>(() => service.RecordAsync(command));
        Assert.Equal(field switch
        {
            "amount" => HistoricalErrorCodes.HistoricalPaymentAmountInvalid,
            "key" => HistoricalErrorCodes.HistoricalPaymentIdempotencyKeyRequired,
            "method" => HistoricalErrorCodes.HistoricalPaymentMethodInvalid,
            _ => HistoricalErrorCodes.HistoricalPaymentReasonRequired
        }, error.Code);
    }

    [Fact]
    public async Task InitialAndReplayControllerBodiesAreSerializedIdentically()
    {
        var payment = new Payment
        {
            Id = Guid.NewGuid(), BookingId = Guid.NewGuid(), Amount = 25m,
            PaymentMethod = "cash", PaidAt = new DateTime(2026, 7, 15, 7, 30, 0, DateTimeKind.Utc),
            ReferenceNumber = "LEGACY-25", RecordedReason = "Verified receipt",
            IsHistoricalRecord = true, CreatedByAdminUserId = Guid.NewGuid(),
            CreatedAt = new DateTime(2026, 8, 1, 19, 0, 0, DateTimeKind.Utc)
        };
        var historyId = Guid.NewGuid();
        var service = new SequenceService(
            new HistoricalPaymentResult(payment, historyId, false),
            new HistoricalPaymentResult(payment, historyId, true));
        var controller = new HistoricalPaymentsController(service);
        var context = new DefaultHttpContext();
        context.User = new ClaimsPrincipal(new ClaimsIdentity(
            [new Claim(ClaimTypes.NameIdentifier, payment.CreatedByAdminUserId.Value.ToString())], "test"));
        context.Items[RequireHistoricalPaymentIdempotencyKeyAttribute.ContextItemKey] = Guid.NewGuid();
        controller.ControllerContext = new ControllerContext { HttpContext = context };
        var request = new RecordHistoricalPaymentRequest
        {
            Amount = payment.Amount, PaymentMethod = payment.PaymentMethod,
            PaidAt = new DateTimeOffset(payment.PaidAt.Value), ReferenceNumber = payment.ReferenceNumber,
            Reason = payment.RecordedReason
        };

        var initial = Assert.IsType<OkObjectResult>((await controller.Record(payment.BookingId, request, default)).Result);
        var replay = Assert.IsType<OkObjectResult>((await controller.Record(payment.BookingId, request, default)).Result);

        Assert.Equal(JsonSerializer.Serialize(initial.Value), JsonSerializer.Serialize(replay.Value));
    }

    private static RecordHistoricalPaymentCommand ValidCommand() => new(
        Guid.NewGuid(), 10m, "cash",
        new DateTimeOffset(2026, 7, 15, 7, 30, 0, TimeSpan.Zero),
        null, "Verified receipt", Guid.NewGuid(), Guid.NewGuid());

    private sealed class FixedTimeProvider : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() =>
            new(2026, 8, 1, 19, 0, 0, TimeSpan.Zero);
    }

    private sealed class SequenceService(params HistoricalPaymentResult[] results) : IHistoricalPaymentService
    {
        private int _index;

        public Task<HistoricalPaymentResult> RecordAsync(
            RecordHistoricalPaymentCommand command,
            CancellationToken cancellationToken = default) =>
            Task.FromResult(results[_index++]);
    }
}
