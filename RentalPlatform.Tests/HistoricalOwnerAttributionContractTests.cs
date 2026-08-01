using System.Reflection;
using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using RentalPlatform.API.Authorization;
using RentalPlatform.API.Controllers;
using RentalPlatform.API.DTOs.Requests.Bookings;
using RentalPlatform.API.Filters;
using RentalPlatform.API.Validators;
using RentalPlatform.Business.Exceptions;
using RentalPlatform.Business.Interfaces;
using RentalPlatform.Business.Models;
using RentalPlatform.Business.Services;
using RentalPlatform.Data.Entities;
using RentalPlatform.Shared.Constants;
using Xunit;

namespace RentalPlatform.Tests;

[Trait(TestCategories.Name, TestCategories.Fast)]
public sealed class HistoricalOwnerAttributionContractTests
{
    [Fact]
    public void RoutesAndPermissionsAreCanonicalAndDedicated()
    {
        var review = typeof(HistoricalOwnerAttributionsController).GetMethod("Review")!;
        var correction = typeof(HistoricalOwnerAttributionsController).GetMethod("Correct")!;

        Assert.Equal(
            "{bookingId:guid}/owner-attribution-review",
            review.GetCustomAttribute<HttpGetAttribute>()!.Template);
        Assert.Equal(
            PermissionKeys.BookingsRead,
            review.GetCustomAttribute<AuthorizeAttribute>()!.Policy);
        Assert.Equal(
            "{bookingId:guid}/owner-attribution-corrections",
            correction.GetCustomAttribute<HttpPostAttribute>()!.Template);
        Assert.Equal(
            PermissionKeys.BookingsCorrectOwnerAttribution,
            correction.GetCustomAttribute<AuthorizeAttribute>()!.Policy);
        Assert.NotEqual(PermissionKeys.BookingsWrite, PermissionKeys.BookingsCorrectOwnerAttribution);
        Assert.NotEqual(PermissionKeys.FinanceManage, PermissionKeys.BookingsCorrectOwnerAttribution);
        Assert.Contains(
            PermissionKeys.Descriptors,
            descriptor => descriptor.Key == PermissionKeys.BookingsCorrectOwnerAttribution);
    }

    [Fact]
    public void RequestIsStrictAndContainsOnlyRatifiedFields()
    {
        Assert.Equal(
            new[] { "ExpectedCurrentOwnerId", "Note", "Reason", "TargetOwnerId" },
            typeof(CorrectHistoricalOwnerAttributionRequest).GetProperties()
                .Select(property => property.Name)
                .OrderBy(name => name));

        Assert.Throws<JsonException>(() =>
            JsonSerializer.Deserialize<CorrectHistoricalOwnerAttributionRequest>(
                """{"expectedCurrentOwnerId":"00000000-0000-0000-0000-000000000001","targetOwnerId":"00000000-0000-0000-0000-000000000002","reason":"accounting_reconciliation","actorId":"00000000-0000-0000-0000-000000000003"}""",
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true }));
    }

    [Theory]
    [InlineData("ownership_changed_after_stay", null, true)]
    [InlineData("booking_belonged_to_previous_owner_agreement", " verified ", true)]
    [InlineData("accounting_reconciliation", null, true)]
    [InlineData("other", "Owner-reviewed evidence", true)]
    [InlineData("other", "   ", false)]
    [InlineData("invented", null, false)]
    public void ValidatorEnforcesCanonicalReasonAndNote(
        string reason,
        string? note,
        bool expectedValid)
    {
        var request = new CorrectHistoricalOwnerAttributionRequest
        {
            ExpectedCurrentOwnerId = Guid.NewGuid(),
            TargetOwnerId = Guid.NewGuid(),
            Reason = reason,
            Note = note
        };

        Assert.Equal(expectedValid, new CorrectHistoricalOwnerAttributionRequestValidator()
            .Validate(request).IsValid);
    }

    [Fact]
    public void CanonicalHashNormalizesReasonAndNoteAndIncludesAttributionPrecondition()
    {
        var command = new CorrectHistoricalOwnerAttributionCommand(
            Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(),
            " ACCOUNTING_RECONCILIATION ", " Owner   reviewed ",
            Guid.NewGuid(), Guid.NewGuid());
        var equivalent = command with
        {
            Reason = "accounting_reconciliation",
            Note = "Owner reviewed"
        };

        Assert.Equal(
            HistoricalOwnerCorrectionRequestHasher.Compute(command),
            HistoricalOwnerCorrectionRequestHasher.Compute(equivalent));
        Assert.NotEqual(
            HistoricalOwnerCorrectionRequestHasher.Compute(command),
            HistoricalOwnerCorrectionRequestHasher.Compute(
                equivalent with { ExpectedCurrentOwnerId = Guid.NewGuid() }));
        Assert.NotEqual(
            HistoricalOwnerCorrectionRequestHasher.Compute(command),
            HistoricalOwnerCorrectionRequestHasher.Compute(
                equivalent with { TargetOwnerId = Guid.NewGuid() }));
    }

    [Fact]
    public void AllTwelveOwnerCorrectionCodesAreRegisteredExactlyOnce()
    {
        var expected = new[]
        {
            HistoricalErrorCodes.OwnerCorrectionIdempotencyKeyRequired,
            HistoricalErrorCodes.OwnerCorrectionBookingNotFound,
            HistoricalErrorCodes.OwnerCorrectionBookingRequired,
            HistoricalErrorCodes.OwnerCorrectionTargetNotFound,
            HistoricalErrorCodes.OwnerCorrectionTargetInvalid,
            HistoricalErrorCodes.OwnerCorrectionSameOwner,
            HistoricalErrorCodes.OwnerCorrectionStaleAttribution,
            HistoricalErrorCodes.OwnerCorrectionPayoutReviewRequired,
            HistoricalErrorCodes.OwnerCorrectionIdempotencyKeyReused,
            HistoricalErrorCodes.OwnerCorrectionRequestInProgress,
            HistoricalErrorCodes.OwnerCorrectionConflict,
            HistoricalErrorCodes.OwnerCorrectionAuditImmutable
        };

        Assert.Equal(12, expected.Distinct(StringComparer.Ordinal).Count());
        Assert.All(expected, code => Assert.Contains(code, HistoricalErrorCodes.All));
    }

    [Fact]
    public async Task MissingIdempotencyKeyFailsBeforeDatabaseAccess()
    {
        var service = new HistoricalOwnerAttributionService(null!, TimeProvider.System);
        var command = new CorrectHistoricalOwnerAttributionCommand(
            Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(),
            HistoricalOwnerCorrectionReasons.AccountingReconciliation,
            null, Guid.NewGuid(), Guid.Empty);

        var error = await Assert.ThrowsAsync<BusinessValidationException>(
            () => service.CorrectAsync(command));
        Assert.Equal(HistoricalErrorCodes.OwnerCorrectionIdempotencyKeyRequired, error.Code);
    }

    [Fact]
    public async Task InitialAndReplayControllerBodiesAreSerializedIdentically()
    {
        var correction = new HistoricalOwnerAttributionCorrection
        {
            Id = Guid.NewGuid(),
            BookingId = Guid.NewGuid(),
            PreviousOwnerId = Guid.NewGuid(),
            TargetOwnerId = Guid.NewGuid(),
            CorrectedByAdminUserId = Guid.NewGuid(),
            Reason = HistoricalOwnerCorrectionReasons.AccountingReconciliation,
            Note = "Verified",
            CorrectedAt = new DateTime(2026, 8, 2, 8, 0, 0, DateTimeKind.Utc)
        };
        var historyId = Guid.NewGuid();
        var service = new SequenceService(
            new HistoricalOwnerCorrectionResult(correction, historyId, [], false),
            new HistoricalOwnerCorrectionResult(correction, historyId, [], true));
        var controller = new HistoricalOwnerAttributionsController(service);
        var context = new DefaultHttpContext();
        context.User = new ClaimsPrincipal(new ClaimsIdentity(
            [new Claim(ClaimTypes.NameIdentifier, correction.CorrectedByAdminUserId.ToString())],
            "test"));
        context.Items[RequireHistoricalOwnerCorrectionIdempotencyKeyAttribute.ContextItemKey] = Guid.NewGuid();
        controller.ControllerContext = new ControllerContext { HttpContext = context };
        var request = new CorrectHistoricalOwnerAttributionRequest
        {
            ExpectedCurrentOwnerId = correction.PreviousOwnerId,
            TargetOwnerId = correction.TargetOwnerId,
            Reason = correction.Reason,
            Note = correction.Note
        };

        var initial = Assert.IsType<OkObjectResult>(
            (await controller.Correct(correction.BookingId, request, default)).Result);
        var replay = Assert.IsType<OkObjectResult>(
            (await controller.Correct(correction.BookingId, request, default)).Result);

        Assert.Equal(JsonSerializer.Serialize(initial.Value), JsonSerializer.Serialize(replay.Value));
    }

    private sealed class SequenceService(params HistoricalOwnerCorrectionResult[] results)
        : IHistoricalOwnerAttributionService
    {
        private int _index;

        public Task<HistoricalOwnerAttributionReviewResult> ReviewAsync(
            Guid bookingId,
            CancellationToken cancellationToken = default) =>
            throw new NotSupportedException();

        public Task<HistoricalOwnerCorrectionResult> CorrectAsync(
            CorrectHistoricalOwnerAttributionCommand command,
            CancellationToken cancellationToken = default) =>
            Task.FromResult(results[_index++]);
    }
}
