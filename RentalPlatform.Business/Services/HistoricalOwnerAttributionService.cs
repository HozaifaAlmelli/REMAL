using Microsoft.EntityFrameworkCore;
using Npgsql;
using RentalPlatform.Business.Exceptions;
using RentalPlatform.Business.Interfaces;
using RentalPlatform.Business.Models;
using RentalPlatform.Data;
using RentalPlatform.Data.Entities;
using RentalPlatform.Shared.Constants;

namespace RentalPlatform.Business.Services;

public sealed class HistoricalOwnerAttributionService : IHistoricalOwnerAttributionService
{
    public const string CorrectionEndpoint =
        "/api/internal/bookings/{bookingId}/owner-attribution-corrections";

    private readonly IUnitOfWork _unitOfWork;
    private readonly TimeProvider _timeProvider;

    public HistoricalOwnerAttributionService(IUnitOfWork unitOfWork, TimeProvider timeProvider)
    {
        _unitOfWork = unitOfWork;
        _timeProvider = timeProvider;
    }

    public async Task<HistoricalOwnerAttributionReviewResult> ReviewAsync(
        Guid bookingId,
        CancellationToken cancellationToken = default)
    {
        if (bookingId == Guid.Empty)
            throw new BusinessValidationException("Booking ID is required.", HistoricalErrorCodes.ValidationError);

        var booking = await LoadEligibleBookingAsync(bookingId, false, cancellationToken);
        var currentOwner = await LoadCurrentOwnerAsync(booking.OwnerId, cancellationToken);
        var payoutReviewRequired = await _unitOfWork.OwnerPayouts.Query()
            .AsNoTracking()
            .AnyAsync(payout => payout.BookingId == booking.Id, cancellationToken);

        var warnings = new List<string>();
        if (IsInactive(currentOwner))
            warnings.Add(HistoricalOwnerAttributionWarnings.CurrentOwnerInactive);
        if (payoutReviewRequired)
            warnings.Add(HistoricalOwnerAttributionWarnings.PayoutReviewRequired);

        return new HistoricalOwnerAttributionReviewResult(
            booking.Id,
            booking.OwnerId,
            !payoutReviewRequired,
            payoutReviewRequired,
            warnings);
    }

    public async Task<HistoricalOwnerCorrectionResult> CorrectAsync(
        CorrectHistoricalOwnerAttributionCommand command,
        CancellationToken cancellationToken = default)
    {
        var normalized = NormalizeAndValidate(command);
        if (_unitOfWork.HasActiveTransaction)
            return await CorrectInTransactionAsync(normalized, cancellationToken);

        await using var transaction = await _unitOfWork.BeginTransactionAsync(cancellationToken);
        try
        {
            var result = await CorrectInTransactionAsync(normalized, cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            return result;
        }
        catch (DbUpdateConcurrencyException)
        {
            await transaction.RollbackAsync(cancellationToken);
            throw new ConflictException(
                "The owner attribution changed concurrently; review the booking and retry.",
                HistoricalErrorCodes.OwnerCorrectionConflict,
                null);
        }
        catch (DbUpdateException exception)
        {
            await transaction.RollbackAsync(cancellationToken);
            throw TranslateDatabaseConflict(exception);
        }
        catch
        {
            await transaction.RollbackAsync(cancellationToken);
            throw;
        }
    }

    private async Task<HistoricalOwnerCorrectionResult> CorrectInTransactionAsync(
        CorrectHistoricalOwnerAttributionCommand command,
        CancellationToken cancellationToken)
    {
        await _unitOfWork.AcquireTransactionAdvisoryLockAsync(
            HistoricalOwnerCorrectionLocks.ForBooking(command.BookingId),
            cancellationToken);

        var hash = HistoricalOwnerCorrectionRequestHasher.Compute(command);
        var claim = await _unitOfWork.HistoricalOwnerCorrectionIdempotencyKeys.Query()
            .SingleOrDefaultAsync(item =>
                item.ActorAdminUserId == command.ActorAdminUserId &&
                item.Endpoint == CorrectionEndpoint &&
                item.Key == command.IdempotencyKey,
                cancellationToken);
        if (claim is not null)
        {
            if (!string.Equals(claim.RequestHash, hash, StringComparison.Ordinal))
            {
                throw new ConflictException(
                    "The idempotency key has already been used for a different owner correction.",
                    HistoricalErrorCodes.OwnerCorrectionIdempotencyKeyReused);
            }

            if (claim.ResponseStatus == 200 && claim.CorrectionId.HasValue && claim.CompletedAt.HasValue)
                return await LoadResultAsync(claim.CorrectionId.Value, true, cancellationToken);

            throw new ConflictException(
                "The owner-correction request is incomplete and requires operator review.",
                HistoricalErrorCodes.OwnerCorrectionRequestInProgress);
        }

        var now = _timeProvider.GetUtcNow().UtcDateTime;
        var idempotency = new HistoricalOwnerCorrectionIdempotencyKey
        {
            ActorAdminUserId = command.ActorAdminUserId,
            Endpoint = CorrectionEndpoint,
            Key = command.IdempotencyKey,
            RequestHash = hash,
            CreatedAt = now
        };
        await _unitOfWork.HistoricalOwnerCorrectionIdempotencyKeys.AddAsync(
            idempotency,
            cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        var actorIsActive = await _unitOfWork.AdminUsers.Query()
            .AsNoTracking()
            .AnyAsync(admin => admin.Id == command.ActorAdminUserId && admin.IsActive, cancellationToken);
        if (!actorIsActive)
            throw new UnauthorizedBusinessException("The authenticated admin user is not active.");

        var booking = await LoadEligibleBookingAsync(command.BookingId, true, cancellationToken);
        await LoadCurrentOwnerAsync(booking.OwnerId, cancellationToken);

        if (booking.OwnerId != command.ExpectedCurrentOwnerId)
        {
            throw new ConflictException(
                "The booking owner attribution changed after review.",
                HistoricalErrorCodes.OwnerCorrectionStaleAttribution);
        }
        if (booking.OwnerId == command.TargetOwnerId)
        {
            throw new ConflictException(
                "The target owner already holds the booking attribution.",
                HistoricalErrorCodes.OwnerCorrectionSameOwner);
        }

        var targetOwner = await _unitOfWork.Owners.Query()
            .IgnoreQueryFilters()
            .AsNoTracking()
            .SingleOrDefaultAsync(owner => owner.Id == command.TargetOwnerId, cancellationToken);
        if (targetOwner is null)
        {
            throw new NotFoundException(
                "The target owner was not found.",
                HistoricalErrorCodes.OwnerCorrectionTargetNotFound);
        }
        if (targetOwner.DeletedAt is not null || !IsSupportedStatus(targetOwner.Status))
        {
            throw new ConflictException(
                "The target owner is not eligible for historical attribution.",
                HistoricalErrorCodes.OwnerCorrectionTargetInvalid);
        }

        var payoutExists = await _unitOfWork.OwnerPayouts.Query()
            .AsNoTracking()
            .AnyAsync(payout => payout.BookingId == booking.Id, cancellationToken);
        if (payoutExists)
        {
            throw new ConflictException(
                "Owner attribution cannot be corrected while any payout record exists for the booking.",
                HistoricalErrorCodes.OwnerCorrectionPayoutReviewRequired);
        }

        var latestCorrectionAt = await _unitOfWork.HistoricalOwnerAttributionCorrections.Query()
            .AsNoTracking()
            .Where(item => item.BookingId == booking.Id)
            .Select(item => (DateTime?)item.CorrectedAt)
            .MaxAsync(cancellationToken);
        var correctedAt = latestCorrectionAt.HasValue && latestCorrectionAt.Value >= now
            ? latestCorrectionAt.Value.AddTicks(10)
            : now;

        var correction = new HistoricalOwnerAttributionCorrection
        {
            Id = Guid.NewGuid(),
            BookingId = booking.Id,
            PreviousOwnerId = booking.OwnerId,
            TargetOwnerId = targetOwner.Id,
            CorrectedByAdminUserId = command.ActorAdminUserId,
            Reason = command.Reason,
            Note = command.Note,
            CorrectedAt = correctedAt
        };
        await _unitOfWork.HistoricalOwnerAttributionCorrections.AddAsync(correction, cancellationToken);

        booking.OwnerId = targetOwner.Id;

        var history = new BookingStatusHistory
        {
            Id = Guid.NewGuid(),
            BookingId = booking.Id,
            OldStatus = booking.BookingStatus.ToString().ToLowerInvariant(),
            NewStatus = booking.BookingStatus.ToString().ToLowerInvariant(),
            ChangedByAdminUserId = command.ActorAdminUserId,
            Notes = BookingHistoryEvents.HistoricalOwnerAttributionCorrectedFor(correction.Id),
            ChangedAt = correctedAt
        };
        await _unitOfWork.BookingStatusHistories.AddAsync(history, cancellationToken);

        idempotency.CorrectionId = correction.Id;
        idempotency.ResponseStatus = 200;
        idempotency.CompletedAt = correctedAt;
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return await LoadResultAsync(correction.Id, false, cancellationToken);
    }

    private async Task<Booking> LoadEligibleBookingAsync(
        Guid bookingId,
        bool tracked,
        CancellationToken cancellationToken)
    {
        var query = _unitOfWork.Bookings.Query();
        if (!tracked)
            query = query.AsNoTracking();
        var booking = await query.SingleOrDefaultAsync(item => item.Id == bookingId, cancellationToken)
            ?? throw new NotFoundException(
                "The target booking was not found.",
                HistoricalErrorCodes.OwnerCorrectionBookingNotFound);
        if (!booking.IsHistorical)
        {
            throw new ConflictException(
                "Owner attribution correction is available only for historical bookings.",
                HistoricalErrorCodes.OwnerCorrectionBookingRequired);
        }
        return booking;
    }

    private async Task<Owner> LoadCurrentOwnerAsync(
        Guid ownerId,
        CancellationToken cancellationToken)
    {
        var owner = await _unitOfWork.Owners.Query()
            .IgnoreQueryFilters()
            .AsNoTracking()
            .SingleOrDefaultAsync(item => item.Id == ownerId, cancellationToken);
        if (owner is null || owner.DeletedAt is not null || !IsSupportedStatus(owner.Status))
        {
            throw new ConflictException(
                "The persisted historical owner attribution requires administrative review.",
                HistoricalErrorCodes.OwnerAttributionRequiresReview);
        }
        return owner;
    }

    private async Task<HistoricalOwnerCorrectionResult> LoadResultAsync(
        Guid correctionId,
        bool isReplay,
        CancellationToken cancellationToken)
    {
        var correction = await _unitOfWork.HistoricalOwnerAttributionCorrections.Query()
            .AsNoTracking()
            .SingleOrDefaultAsync(item => item.Id == correctionId, cancellationToken)
            ?? throw new ConflictException(
                "The completed idempotency record no longer resolves to owner-correction audit.",
                HistoricalErrorCodes.OwnerCorrectionRequestInProgress);
        var note = BookingHistoryEvents.HistoricalOwnerAttributionCorrectedFor(correction.Id);
        var historyId = await _unitOfWork.BookingStatusHistories.Query()
            .AsNoTracking()
            .Where(item => item.BookingId == correction.BookingId && item.Notes == note)
            .Select(item => item.Id)
            .SingleAsync(cancellationToken);
        var targetInactive = await _unitOfWork.Owners.Query()
            .IgnoreQueryFilters()
            .AsNoTracking()
            .AnyAsync(owner =>
                owner.Id == correction.TargetOwnerId &&
                owner.DeletedAt == null &&
                owner.Status == "inactive",
                cancellationToken);
        var warnings = targetInactive
            ? new[] { HistoricalOwnerAttributionWarnings.TargetOwnerInactive }
            : Array.Empty<string>();
        return new HistoricalOwnerCorrectionResult(correction, historyId, warnings, isReplay);
    }

    private static CorrectHistoricalOwnerAttributionCommand NormalizeAndValidate(
        CorrectHistoricalOwnerAttributionCommand command)
    {
        if (command.ActorAdminUserId == Guid.Empty)
            throw new UnauthorizedBusinessException("Authenticated admin identity is required.");
        if (command.IdempotencyKey == Guid.Empty)
        {
            throw new BusinessValidationException(
                "Idempotency-Key must be supplied as a valid UUID.",
                HistoricalErrorCodes.OwnerCorrectionIdempotencyKeyRequired);
        }
        if (command.BookingId == Guid.Empty || command.ExpectedCurrentOwnerId == Guid.Empty ||
            command.TargetOwnerId == Guid.Empty)
        {
            throw new BusinessValidationException(
                "Booking, expected current owner, and target owner IDs are required.",
                HistoricalErrorCodes.ValidationError);
        }

        var reason = HistoricalOwnerCorrectionRequestHasher.Normalize(command.Reason)?.ToLowerInvariant();
        var note = HistoricalOwnerCorrectionRequestHasher.Normalize(command.Note);
        if (reason is null || !HistoricalOwnerCorrectionReasons.All.Contains(reason) ||
            note?.Length > 500 ||
            (reason == HistoricalOwnerCorrectionReasons.Other && note is null))
        {
            throw new BusinessValidationException(
                "Reason must be canonical; note is required for 'other' and cannot exceed 500 characters.",
                HistoricalErrorCodes.ValidationError);
        }

        return command with { Reason = reason, Note = note };
    }

    private static bool IsSupportedStatus(string status) =>
        status is "active" or "inactive";

    private static bool IsInactive(Owner owner) => owner.Status == "inactive";

    private static Exception TranslateDatabaseConflict(DbUpdateException exception)
    {
        var postgres = FindPostgresException(exception);
        return postgres?.ConstraintName switch
        {
            "pk_historical_owner_correction_idempotency_keys" => new ConflictException(
                "The idempotency key has already been used for a different owner correction.",
                HistoricalErrorCodes.OwnerCorrectionIdempotencyKeyReused),
            "ck_historical_owner_correction_owner_change" => new ConflictException(
                "The target owner already holds the booking attribution.",
                HistoricalErrorCodes.OwnerCorrectionSameOwner),
            "fk_historical_owner_corrections_target_owner" => new NotFoundException(
                "The target owner was not found.",
                HistoricalErrorCodes.OwnerCorrectionTargetNotFound),
            _ => exception
        };
    }

    private static PostgresException? FindPostgresException(Exception exception)
    {
        for (Exception? current = exception; current is not null; current = current.InnerException)
        {
            if (current is PostgresException postgres)
                return postgres;
        }
        return null;
    }
}
