using Microsoft.EntityFrameworkCore;
using Npgsql;
using RentalPlatform.Business.Exceptions;
using RentalPlatform.Business.Interfaces;
using RentalPlatform.Business.Models;
using RentalPlatform.Data;
using RentalPlatform.Data.Entities;
using RentalPlatform.Shared.Constants;

namespace RentalPlatform.Business.Services;

public sealed class HistoricalPaymentService : IHistoricalPaymentService
{
    public const string Endpoint = "/api/internal/bookings/{bookingId}/historical-payments";
    private static readonly IReadOnlySet<string> AllowedMethods =
        new HashSet<string>(new[] { "cash", "bank_transfer", "card", "wallet" }, StringComparer.Ordinal);

    private readonly IUnitOfWork _unitOfWork;
    private readonly TimeProvider _timeProvider;

    public HistoricalPaymentService(IUnitOfWork unitOfWork, TimeProvider timeProvider)
    {
        _unitOfWork = unitOfWork;
        _timeProvider = timeProvider;
    }

    public async Task<HistoricalPaymentResult> RecordAsync(
        RecordHistoricalPaymentCommand command,
        CancellationToken cancellationToken = default)
    {
        var normalized = NormalizeAndValidate(command);
        if (_unitOfWork.HasActiveTransaction)
            return await RecordInTransactionAsync(normalized, cancellationToken);

        await using var transaction = await _unitOfWork.BeginTransactionAsync(cancellationToken);
        try
        {
            var result = await RecordInTransactionAsync(normalized, cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            return result;
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

    private async Task<HistoricalPaymentResult> RecordInTransactionAsync(
        RecordHistoricalPaymentCommand command,
        CancellationToken cancellationToken)
    {
        await _unitOfWork.AcquireTransactionAdvisoryLockAsync(
            $"historical-payment:{command.BookingId:N}", cancellationToken);

        var hash = HistoricalPaymentRequestHasher.Compute(command);
        var claim = await _unitOfWork.HistoricalPaymentIdempotencyKeys.Query()
            .SingleOrDefaultAsync(item =>
                item.ActorAdminUserId == command.ActorAdminUserId &&
                item.Endpoint == Endpoint &&
                item.Key == command.IdempotencyKey,
                cancellationToken);
        if (claim is not null)
        {
            if (!string.Equals(claim.RequestHash, hash, StringComparison.Ordinal))
            {
                throw new ConflictException(
                    "The idempotency key has already been used for a different historical payment command.",
                    HistoricalErrorCodes.HistoricalPaymentIdempotencyKeyReused);
            }

            if (claim.ResponseStatus == 200 && claim.PaymentId.HasValue && claim.CompletedAt.HasValue)
                return await LoadResultAsync(claim.PaymentId.Value, true, cancellationToken);

            throw new ConflictException(
                "The historical payment request is incomplete and requires operator review.",
                HistoricalErrorCodes.HistoricalPaymentRequestInProgress);
        }

        var idempotency = new HistoricalPaymentIdempotencyKey
        {
            ActorAdminUserId = command.ActorAdminUserId,
            Endpoint = Endpoint,
            Key = command.IdempotencyKey,
            RequestHash = hash,
            CreatedAt = _timeProvider.GetUtcNow().UtcDateTime
        };
        await _unitOfWork.HistoricalPaymentIdempotencyKeys.AddAsync(idempotency, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        var actorIsActive = await _unitOfWork.AdminUsers.Query()
            .AsNoTracking()
            .AnyAsync(admin => admin.Id == command.ActorAdminUserId && admin.IsActive, cancellationToken);
        if (!actorIsActive)
            throw new UnauthorizedBusinessException("The authenticated admin user is not active.");

        var booking = await _unitOfWork.Bookings.Query()
            .AsNoTracking()
            .SingleOrDefaultAsync(item => item.Id == command.BookingId, cancellationToken)
            ?? throw new NotFoundException(
                "The target booking was not found.",
                HistoricalErrorCodes.HistoricalPaymentBookingNotFound);

        if (!booking.IsHistorical)
        {
            throw new ConflictException(
                "Historical payment evidence can only be recorded against a historical booking.",
                HistoricalErrorCodes.HistoricalPaymentBookingRequired);
        }

        if (!booking.AgreedAmount.HasValue || booking.AgreedAmount < 0 ||
            booking.BaseAmount != booking.AgreedAmount || booking.FinalAmount != booking.AgreedAmount)
        {
            throw new ConflictException(
                "The historical booking does not have a coherent agreed financial snapshot.",
                HistoricalErrorCodes.HistoricalPaymentSnapshotRequired);
        }

        var recordedTotal = await _unitOfWork.Payments.Query()
            .AsNoTracking()
            .Where(payment => payment.BookingId == booking.Id && payment.IsHistoricalRecord)
            .SumAsync(payment => payment.Amount, cancellationToken);
        if (recordedTotal + command.Amount > booking.AgreedAmount.Value)
        {
            throw new ConflictException(
                "The historical payment would exceed the booking's agreed amount.",
                HistoricalErrorCodes.HistoricalPaymentExceedsAgreedAmount);
        }

        if (command.ReferenceNumber is not null)
        {
            var normalizedReference = command.ReferenceNumber.ToLowerInvariant();
            var duplicateReference = await _unitOfWork.Payments.Query()
                .AsNoTracking()
                .AnyAsync(payment =>
                    payment.BookingId == booking.Id &&
                    payment.IsHistoricalRecord &&
                    payment.ReferenceNumber != null &&
                    payment.ReferenceNumber.Trim().ToLower() == normalizedReference,
                    cancellationToken);
            if (duplicateReference)
            {
                throw new ConflictException(
                    "The reference number is already used by a historical payment for this booking.",
                    HistoricalErrorCodes.HistoricalPaymentReferenceAlreadyExists);
            }
        }

        var now = _timeProvider.GetUtcNow().UtcDateTime;
        var payment = new Payment
        {
            Id = Guid.NewGuid(),
            BookingId = booking.Id,
            InvoiceId = null,
            PaymentStatus = "paid",
            PaymentMethod = command.PaymentMethod,
            Amount = command.Amount,
            ReferenceNumber = command.ReferenceNumber,
            Notes = null,
            PaidAt = command.PaidAt.UtcDateTime,
            IsHistoricalRecord = true,
            CreatedByAdminUserId = command.ActorAdminUserId,
            RecordedReason = command.Reason,
            CreatedAt = now,
            UpdatedAt = now
        };
        await _unitOfWork.Payments.AddAsync(payment, cancellationToken);

        var history = new BookingStatusHistory
        {
            Id = Guid.NewGuid(),
            BookingId = booking.Id,
            OldStatus = booking.BookingStatus.ToString().ToLowerInvariant(),
            NewStatus = booking.BookingStatus.ToString().ToLowerInvariant(),
            ChangedByAdminUserId = command.ActorAdminUserId,
            Notes = BookingHistoryEvents.HistoricalPaymentRecordedFor(payment.Id),
            ChangedAt = now
        };
        await _unitOfWork.BookingStatusHistories.AddAsync(history, cancellationToken);

        idempotency.PaymentId = payment.Id;
        idempotency.ResponseStatus = 200;
        idempotency.CompletedAt = now;
        _unitOfWork.HistoricalPaymentIdempotencyKeys.Update(idempotency);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return await LoadResultAsync(payment.Id, false, cancellationToken);
    }

    private async Task<HistoricalPaymentResult> LoadResultAsync(
        Guid paymentId,
        bool isReplay,
        CancellationToken cancellationToken)
    {
        var payment = await _unitOfWork.Payments.Query()
            .AsNoTracking()
            .SingleOrDefaultAsync(item => item.Id == paymentId && item.IsHistoricalRecord, cancellationToken)
            ?? throw new ConflictException(
                "The completed idempotency record no longer resolves to historical payment evidence.",
                HistoricalErrorCodes.HistoricalPaymentRequestInProgress);
        var note = BookingHistoryEvents.HistoricalPaymentRecordedFor(payment.Id);
        var historyId = await _unitOfWork.BookingStatusHistories.Query()
            .AsNoTracking()
            .Where(item => item.BookingId == payment.BookingId && item.Notes == note)
            .Select(item => item.Id)
            .SingleAsync(cancellationToken);
        return new HistoricalPaymentResult(payment, historyId, isReplay);
    }

    private RecordHistoricalPaymentCommand NormalizeAndValidate(RecordHistoricalPaymentCommand command)
    {
        if (command.ActorAdminUserId == Guid.Empty)
            throw new UnauthorizedBusinessException("Authenticated admin identity is required.");
        if (command.IdempotencyKey == Guid.Empty)
        {
            throw new BusinessValidationException(
                "Idempotency-Key must be supplied as a valid UUID.",
                HistoricalErrorCodes.HistoricalPaymentIdempotencyKeyRequired);
        }
        if (command.Amount <= 0 || decimal.Round(command.Amount, 2) != command.Amount ||
            command.Amount > 9_999_999_999.99m)
        {
            throw new BusinessValidationException(
                "Amount must be a positive decimal with at most two fractional digits.",
                HistoricalErrorCodes.HistoricalPaymentAmountInvalid);
        }

        var method = HistoricalPaymentRequestHasher.Normalize(command.PaymentMethod)?.ToLowerInvariant();
        if (method is null || !AllowedMethods.Contains(method))
        {
            throw new BusinessValidationException(
                "PaymentMethod is not in the canonical payment-method vocabulary.",
                HistoricalErrorCodes.HistoricalPaymentMethodInvalid);
        }

        var reason = HistoricalPaymentRequestHasher.Normalize(command.Reason);
        if (reason is null || reason.Length > 500)
        {
            throw new BusinessValidationException(
                "Reason is required and cannot exceed 500 characters.",
                HistoricalErrorCodes.HistoricalPaymentReasonRequired);
        }

        var reference = HistoricalPaymentRequestHasher.Normalize(command.ReferenceNumber);
        if (reference?.Length > 100)
        {
            throw new BusinessValidationException(
                "ReferenceNumber cannot exceed 100 characters.",
                HistoricalErrorCodes.ValidationError);
        }
        if (command.BookingId == Guid.Empty || command.PaidAt == default ||
            command.PaidAt > _timeProvider.GetUtcNow())
        {
            throw new BusinessValidationException(
                "BookingId and a non-future PaidAt timestamp are required.",
                HistoricalErrorCodes.ValidationError);
        }

        return command with
        {
            PaymentMethod = method,
            ReferenceNumber = reference,
            Reason = reason,
            PaidAt = command.PaidAt.ToUniversalTime()
        };
    }

    private static Exception TranslateDatabaseConflict(DbUpdateException exception)
    {
        var postgres = FindPostgresException(exception);
        return postgres?.ConstraintName switch
        {
            "ux_payments_historical_reference" => new ConflictException(
                "The reference number is already used by a historical payment for this booking.",
                HistoricalErrorCodes.HistoricalPaymentReferenceAlreadyExists),
            "pk_historical_payment_idempotency_keys" => new ConflictException(
                "The idempotency key has already been used for a different historical payment command.",
                HistoricalErrorCodes.HistoricalPaymentIdempotencyKeyReused),
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
