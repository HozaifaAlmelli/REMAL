using System.Diagnostics;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Npgsql;
using RentalPlatform.Business.Exceptions;
using RentalPlatform.Business.Interfaces;
using RentalPlatform.Business.Models;
using RentalPlatform.Business.Security;
using RentalPlatform.Business.Time;
using RentalPlatform.Data;
using RentalPlatform.Data.Entities;
using RentalPlatform.Shared.Constants;
using RentalPlatform.Shared.Enums;

namespace RentalPlatform.Business.Services;

public sealed class HistoricalBookingService : IHistoricalBookingService
{
    public const string Endpoint = "/api/internal/bookings/historical";

    private readonly IUnitOfWork _unitOfWork;
    private readonly IBookingService _bookingService;
    private readonly IClientService _clientService;
    private readonly IBusinessClock _clock;
    private readonly IHistoricalIdempotencyStore _idempotencyStore;
    private readonly IHistoricalConflictService _conflictService;
    private readonly ILogger<HistoricalBookingService> _logger;

    public HistoricalBookingService(
        IUnitOfWork unitOfWork,
        IBookingService bookingService,
        IClientService clientService,
        IBusinessClock clock,
        IHistoricalIdempotencyStore idempotencyStore,
        IHistoricalConflictService conflictService,
        ILogger<HistoricalBookingService> logger)
    {
        _unitOfWork = unitOfWork;
        _bookingService = bookingService;
        _clientService = clientService;
        _clock = clock;
        _idempotencyStore = idempotencyStore;
        _conflictService = conflictService;
        _logger = logger;
    }

    public async Task<HistoricalBookingResult> RecordAsync(
        RecordHistoricalBookingCommand command,
        CancellationToken cancellationToken = default)
    {
        var startedAt = Stopwatch.GetTimestamp();
        var cairoToday = _clock.CairoToday();

        try
        {
            Validate(command, cairoToday);

            HistoricalBookingResult result;
            if (_unitOfWork.HasActiveTransaction)
            {
                result = await RecordInCurrentTransactionAsync(command, cancellationToken);
            }
            else
            {
                await using var transaction = await _unitOfWork.BeginTransactionAsync(cancellationToken);
                try
                {
                    result = await RecordInCurrentTransactionAsync(command, cancellationToken);
                    await transaction.CommitAsync(cancellationToken);
                }
                catch (DbUpdateException exception)
                {
                    await transaction.RollbackAsync(cancellationToken);
                    throw await TranslateDatabaseConflictAsync(
                        command,
                        exception,
                        cancellationToken);
                }
                catch
                {
                    await transaction.RollbackAsync(cancellationToken);
                    throw;
                }
            }

            var duration = Stopwatch.GetElapsedTime(startedAt).TotalSeconds;
            HistoricalBookingTelemetry.RecordSucceeded(duration, result.IsReplay);
            _logger.LogInformation(
                "booking.historical.recorded BookingId={BookingId} UnitId={UnitId} ActorAdminUserId={ActorAdminUserId} RecordedAt={RecordedAt} CheckInDate={CheckInDate} CheckOutDate={CheckOutDate} ActualBookedAt={ActualBookedAt} HistoricalEntryReason={HistoricalEntryReason} OriginalSource={OriginalSource} OwnerId={OwnerId} OverrideApplied={OverrideApplied} AcknowledgedDuplicateIds={AcknowledgedDuplicateIds} AcknowledgedDateBlockIds={AcknowledgedDateBlockIds} CorrelationId={CorrelationId} IsReplay={IsReplay}",
                result.Booking.Id,
                result.Booking.UnitId,
                result.RecordedByAdminUserId,
                result.Booking.CreatedAt,
                result.Booking.CheckInDate,
                result.Booking.CheckOutDate,
                result.Booking.ActualBookedAt,
                result.Booking.HistoricalEntryReason,
                result.Booking.OriginalSource,
                result.Booking.OwnerId,
                false,
                string.Join(',', command.AcknowledgedDuplicateOf ?? Array.Empty<Guid>()),
                string.Join(',', command.AcknowledgedDateBlockIds ?? Array.Empty<Guid>()),
                command.CorrelationId,
                result.IsReplay);
            return result;
        }
        catch (Exception exception)
        {
            var reason = MapRejectionReason((exception as IBusinessErrorCode)?.Code);
            var duration = Stopwatch.GetElapsedTime(startedAt).TotalSeconds;
            var match = (exception as IBusinessErrorMetadata)?.Metadata?
                .GetValueOrDefault("matchReason") as string;
            HistoricalBookingTelemetry.RecordRejected(reason, duration, match);
            _logger.LogInformation(
                "Historical booking rejected Reason={Reason} UnitId={UnitId} ActorAdminUserId={ActorAdminUserId} CheckInDate={CheckInDate} CheckOutDate={CheckOutDate} CorrelationId={CorrelationId}",
                reason,
                command.UnitId,
                command.ActorAdminUserId,
                command.CheckInDate,
                command.CheckOutDate,
                command.CorrelationId);
            throw;
        }
    }

    private async Task<HistoricalBookingResult> RecordInCurrentTransactionAsync(
        RecordHistoricalBookingCommand command,
        CancellationToken cancellationToken)
    {
        await _unitOfWork.AcquireTransactionAdvisoryLockAsync(
            $"booking-unit:{command.UnitId:N}",
            cancellationToken);

        var requestHash = HistoricalRequestHasher.Compute(command);
        var claim = await _idempotencyStore.ClaimAsync(
            command.ActorAdminUserId,
            Endpoint,
            command.IdempotencyKey,
            requestHash,
            cancellationToken);

        if (claim.IsReplay)
        {
            return await LoadResultAsync(
                command,
                claim.BookingId!.Value,
                isReplay: true,
                cancellationToken);
        }

        var unit = await _unitOfWork.Units.Query()
            .IgnoreQueryFilters()
            .SingleOrDefaultAsync(candidate => candidate.Id == command.UnitId, cancellationToken)
            ?? throw new NotFoundException(
                $"Unit with ID {command.UnitId} was not found.",
                HistoricalErrorCodes.UnitNotFound);
        if (unit.DeletedAt is not null)
        {
            throw new BusinessValidationException(
                "Soft-deleted units cannot be used for historical booking creation.",
                HistoricalErrorCodes.UnitDeletedUnsupported);
        }
        if (command.GuestCount > unit.MaxGuests)
        {
            throw new BusinessValidationException(
                $"Guest count ({command.GuestCount}) exceeds unit maximum capacity ({unit.MaxGuests}).",
                HistoricalErrorCodes.ValidationError);
        }

        var ownerExists = unit.OwnerId != Guid.Empty && await _unitOfWork.Owners.Query()
            .AnyAsync(owner =>
                owner.Id == unit.OwnerId &&
                owner.Status == "active" &&
                owner.DeletedAt == null,
                cancellationToken);
        if (!ownerExists)
        {
            throw new ConflictException(
                "The unit owner cannot be determined safely and requires review.",
                HistoricalErrorCodes.OwnerAttributionRequiresReview);
        }

        var originalSourceCode = command.OriginalSource.Trim().ToLowerInvariant();
        var source = await _unitOfWork.BookingOriginalSources.Query()
            .AsNoTracking()
            .SingleOrDefaultAsync(candidate =>
                candidate.Code == originalSourceCode &&
                candidate.IsActive,
                cancellationToken);
        if (source is null)
        {
            throw new BusinessValidationException(
                "OriginalSource must identify an active historical booking source.",
                HistoricalErrorCodes.OriginalSourceInvalid);
        }

        if (command.AssignedAdminUserId.HasValue)
        {
            var adminExists = await _unitOfWork.AdminUsers.Query()
                .AnyAsync(admin =>
                    admin.Id == command.AssignedAdminUserId.Value && admin.IsActive,
                    cancellationToken);
            if (!adminExists)
            {
                throw new NotFoundException(
                    $"Active admin user with ID {command.AssignedAdminUserId.Value} was not found.",
                    HistoricalErrorCodes.AdminUserNotFound);
            }
        }

        var externalReference = NormalizeOptional(command.ExternalReference);
        var clientIdentity = await ResolveClientIdentityAsync(command, cancellationToken);
        await _conflictService.ValidateAsync(
            new HistoricalConflictRequest(
                command.UnitId,
                command.CheckInDate,
                command.CheckOutDate,
                clientIdentity.ClientId,
                clientIdentity.NormalizedPhone,
                externalReference,
                command.AcknowledgedDuplicateOf ?? Array.Empty<Guid>(),
                command.AcknowledgedDateBlockIds ?? Array.Empty<Guid>()),
            cancellationToken);

        var clientId = clientIdentity.RequiresCreation
            ? await CreateClientAsync(command.NewClient!, cancellationToken)
            : clientIdentity.ClientId;

        var booking = await _bookingService.CreateAsync(
            clientId,
            command.UnitId,
            command.CheckInDate,
            command.CheckOutDate,
            command.GuestCount,
            source: "admin",
            command.AssignedAdminUserId,
            command.ActorAdminUserId,
            command.InternalNotes,
            BookingStatus.Completed,
            requirePortfolioVisibility: false,
            rejectSoftHoldOverlaps: false,
            cancellationToken,
            new BookingCreationOptions(
                AllowInactiveUnit: true,
                ClientNotFoundErrorCode: HistoricalErrorCodes.ClientNotFound,
                UnitNotFoundErrorCode: HistoricalErrorCodes.UnitNotFound,
                AdminUserNotFoundErrorCode: HistoricalErrorCodes.AdminUserNotFound,
                GuestCapacityErrorCode: HistoricalErrorCodes.ValidationError,
                OperationalConflictErrorCode: HistoricalErrorCodes.HistoricalOverlapConflict,
                ConfirmedOverlapErrorCode: HistoricalErrorCodes.HistoricalOverlapConflict,
                AvailabilityPolicy: BookingAvailabilityPolicy.HistoricalAuthoritative));

        booking.IsHistorical = true;
        booking.ActualBookedAt = command.ActualBookedAt;
        booking.HistoricalEntryReason = command.HistoricalEntryReason.Trim().ToLowerInvariant();
        booking.OriginalSource = source.Code;
        booking.ExternalReference = externalReference;
        booking.BaseAmount = command.AgreedAmount;
        booking.FinalAmount = command.AgreedAmount;
        booking.AgreedAmount = command.AgreedAmount;
        _unitOfWork.Bookings.Update(booking);

        var history = await _unitOfWork.BookingStatusHistories.Query()
            .SingleAsync(item => item.BookingId == booking.Id, cancellationToken);
        history.Notes = BookingHistoryEvents.HistoricalBookingRecorded;
        _unitOfWork.BookingStatusHistories.Update(history);

        _idempotencyStore.Complete(
            command.ActorAdminUserId,
            Endpoint,
            command.IdempotencyKey,
            booking.Id);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return await LoadResultAsync(command, booking.Id, isReplay: false, cancellationToken);
    }

    private async Task<PendingClientIdentity> ResolveClientIdentityAsync(
        RecordHistoricalBookingCommand command,
        CancellationToken cancellationToken)
    {
        if (command.ClientId.HasValue)
        {
            var client = await _unitOfWork.Clients.Query()
                .AsNoTracking()
                .SingleOrDefaultAsync(client =>
                    client.Id == command.ClientId.Value &&
                    client.IsActive &&
                    client.DeletedAt == null,
                    cancellationToken);
            if (client is null)
            {
                throw new NotFoundException(
                    $"Active client with ID {command.ClientId.Value} was not found.",
                    HistoricalErrorCodes.ClientNotFound);
            }

            return new PendingClientIdentity(
                client.Id,
                HistoricalConflictService.NormalizePhone(client.Phone),
                RequiresCreation: false);
        }

        var newClient = command.NewClient!;
        var existingClient = await _clientService.FindByPhoneIdentityAsync(
            newClient.Phone,
            cancellationToken);
        if (existingClient is not null)
        {
            throw BuildClientPhoneConflict(existingClient);
        }


        var normalizedEmail = NormalizeOptional(newClient.Email)?.ToLowerInvariant();
        if (normalizedEmail is not null && await _unitOfWork.Clients.Query()
                .IgnoreQueryFilters()
                .AsNoTracking()
                .AnyAsync(
                    client => client.Email != null && client.Email.ToLower() == normalizedEmail,
                    cancellationToken))
        {
            throw new BusinessValidationException(
                "NewClient.Email is already associated with an existing client. Retry with ClientId.",
                HistoricalErrorCodes.ValidationError);
        }

        return new PendingClientIdentity(
            Guid.Empty,
            HistoricalConflictService.NormalizePhone(newClient.Phone),
            RequiresCreation: true);
    }

    private async Task<Guid> CreateClientAsync(
        NewHistoricalClient newClient,
        CancellationToken cancellationToken)
    {
        Client createdClient;
        try
        {
            createdClient = await _clientService.CreateAsync(
                newClient.Name,
                newClient.Phone,
                newClient.Email,
                TemporaryPasswordGenerator.Generate(),
                cancellationToken);
        }
        catch (ConflictException)
        {
            var phoneConflict = await _clientService.FindByPhoneIdentityAsync(
                newClient.Phone,
                cancellationToken);
            if (phoneConflict is not null)
                throw BuildClientPhoneConflict(phoneConflict);

            throw new BusinessValidationException(
                "The new client conflicts with an existing client record.",
                HistoricalErrorCodes.ValidationError);
        }
        catch (BusinessValidationException exception) when (exception.Code is null)
        {
            throw new BusinessValidationException(exception.Message, HistoricalErrorCodes.ValidationError);
        }
        return createdClient.Id;
    }

    private async Task<HistoricalBookingResult> LoadResultAsync(
        RecordHistoricalBookingCommand command,
        Guid bookingId,
        bool isReplay,
        CancellationToken cancellationToken)
    {
        var booking = await _unitOfWork.Bookings.Query()
            .AsNoTracking()
            .Include(item => item.Unit)
            .Include(item => item.AssignedAdminUser)
                .ThenInclude(admin => admin!.RoleTemplate)
            .SingleOrDefaultAsync(item => item.Id == bookingId, cancellationToken)
            ?? throw new ConflictException(
                "The completed idempotency record no longer resolves to its booking.",
                HistoricalErrorCodes.IdempotencyRequestInProgress);
        var source = await _unitOfWork.BookingOriginalSources.Query()
            .AsNoTracking()
            .SingleAsync(item => item.Code == booking.OriginalSource, cancellationToken);
        var history = await _unitOfWork.BookingStatusHistories.Query()
            .AsNoTracking()
            .SingleAsync(item =>
                item.BookingId == booking.Id &&
                item.Notes == BookingHistoryEvents.HistoricalBookingRecorded,
                cancellationToken);

        return new HistoricalBookingResult(
            booking,
            source.Label,
            NormalizeOptional(command.HistoricalEntryNote),
            command.ActorAdminUserId,
            command.IdempotencyKey,
            history.Id,
            IsReplay: isReplay);
    }

    private static void Validate(RecordHistoricalBookingCommand command, DateOnly cairoToday)
    {
        if (command.ActorAdminUserId == Guid.Empty)
            throw new UnauthorizedBusinessException("Authenticated admin identity is required.");

        if (command.IdempotencyKey == Guid.Empty)
        {
            throw new BusinessValidationException(
                "Idempotency-Key must be a valid UUID.",
                HistoricalErrorCodes.IdempotencyKeyRequired);
        }

        if (command.UnitId == Guid.Empty ||
            command.CheckInDate == default ||
            command.CheckOutDate == default ||
            command.ActualBookedAt == default ||
            command.GuestCount <= 0 ||
            command.AgreedAmount < 0 ||
            decimal.Round(command.AgreedAmount, 2) != command.AgreedAmount ||
            command.AgreedAmount > 9_999_999_999.99m)
        {
            throw new BusinessValidationException(
                "The historical booking request contains invalid required values.",
                HistoricalErrorCodes.ValidationError);
        }

        if (command.ClientId.HasValue == (command.NewClient is not null))
        {
            throw new BusinessValidationException(
                "Provide exactly one of ClientId or NewClient.",
                HistoricalErrorCodes.ClientReferenceInvalid);
        }

        if (command.CheckOutDate <= command.CheckInDate)
        {
            throw new BusinessValidationException(
                "CheckOutDate must be after CheckInDate.",
                HistoricalErrorCodes.ValidationError);
        }

        if (command.CheckOutDate > cairoToday.AddDays(-1))
        {
            throw new BusinessValidationException(
                "The stay has not completed under the Cairo business-date boundary. Use the normal booking flow for current or future stays.",
                HistoricalErrorCodes.HistoricalCheckoutNotCompleted);
        }

        if (command.ActualBookedAt > cairoToday || command.ActualBookedAt > command.CheckInDate)
        {
            throw new BusinessValidationException(
                $"ActualBookedAt ({command.ActualBookedAt:yyyy-MM-dd}) must not be in the future or after CheckInDate ({command.CheckInDate:yyyy-MM-dd}).",
                HistoricalErrorCodes.ValidationError);
        }

        var reason = command.HistoricalEntryReason?.Trim().ToLowerInvariant();
        if (reason is null || !HistoricalEntryReasons.All.Contains(reason))
        {
            throw new BusinessValidationException(
                "HistoricalEntryReason is invalid.",
                HistoricalErrorCodes.ValidationError);
        }

        var note = NormalizeOptional(command.HistoricalEntryNote);
        if (note?.Length > 1000 ||
            (reason == HistoricalEntryReasons.Other && (note is null || note.Length < 10)))
        {
            throw new BusinessValidationException(
                "HistoricalEntryNote must contain at least 10 characters for reason 'other' and cannot exceed 1000 characters.",
                HistoricalErrorCodes.ValidationError);
        }

        if (string.IsNullOrWhiteSpace(command.OriginalSource) ||
            NormalizeOptional(command.ExternalReference)?.Length > 100)
        {
            throw new BusinessValidationException(
                "OriginalSource is required and ExternalReference cannot exceed 100 characters.",
                HistoricalErrorCodes.ValidationError);
        }
    }

    private async Task<Exception> TranslateDatabaseConflictAsync(
        RecordHistoricalBookingCommand command,
        DbUpdateException exception,
        CancellationToken cancellationToken)
    {
        var postgresException = FindPostgresException(exception);
        if (postgresException?.ConstraintName == "pk_idempotency_keys")
        {
            return new ConflictException(
                "The idempotency key has already been used for a different request.",
                HistoricalErrorCodes.IdempotencyKeyReused);
        }

        if (postgresException?.ConstraintName == "ux_bookings_external_reference")
        {
            var existingBookingId = await _unitOfWork.Bookings.Query()
                .AsNoTracking()
                .Where(item => item.ExternalReference == NormalizeOptional(command.ExternalReference))
                .Select(item => (Guid?)item.Id)
                .FirstOrDefaultAsync(cancellationToken);
            return new ConflictException(
                "The external reference is already assigned to another booking.",
                HistoricalErrorCodes.ExternalReferenceAlreadyExists,
                new Dictionary<string, object?>
                {
                    ["duplicateOf"] = existingBookingId,
                    ["matchReason"] = "external_reference"
                });
        }

        if (command.NewClient is not null && postgresException?.ConstraintName == "ux_clients_phone")
        {
            var existing = await _clientService.FindByPhoneIdentityAsync(
                command.NewClient.Phone,
                cancellationToken);
            return existing is null ? exception : BuildClientPhoneConflict(existing);
        }

        if (postgresException?.ConstraintName == "ux_clients_email_not_null")
        {
            return new BusinessValidationException(
                "NewClient.Email is already associated with an existing client. Retry with ClientId.",
                HistoricalErrorCodes.ValidationError);
        }

        return exception;
    }

    private static PostgresException? FindPostgresException(Exception exception)
    {
        for (Exception? current = exception; current is not null; current = current.InnerException)
        {
            if (current is PostgresException postgresException)
                return postgresException;
        }

        return null;
    }

    private static ConflictException BuildClientPhoneConflict(Client existingClient)
    {
        var metadata = new Dictionary<string, object?>
        {
            ["existingClientId"] = existingClient.Id
        };
        if (existingClient.IsActive && existingClient.DeletedAt is null)
        {
            return new ConflictException(
                "A selectable client already exists for this phone. Retry with the existing client ID.",
                HistoricalErrorCodes.ClientPhoneAlreadyExists,
                metadata);
        }

        return new ConflictException(
            "This phone belongs to an inactive or deleted client. Administrative review or reactivation is required before continuing.",
            HistoricalErrorCodes.ClientPhoneRequiresReview,
            metadata);
    }

    private static string MapRejectionReason(string? code) => code switch
    {
        HistoricalErrorCodes.HistoricalCheckoutNotCompleted => "not_complete",
        HistoricalErrorCodes.OwnerAttributionRequiresReview => "owner_attribution",
        HistoricalErrorCodes.HistoricalOverlapConflict => "overlap",
        HistoricalErrorCodes.HistoricalDuplicateBooking => "duplicate",
        HistoricalErrorCodes.ValidationError or
        HistoricalErrorCodes.ClientReferenceInvalid or
        HistoricalErrorCodes.OriginalSourceInvalid or
        HistoricalErrorCodes.IdempotencyKeyRequired => "validation",
        _ => "validation"
    };

    private static string? NormalizeOptional(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private sealed record PendingClientIdentity(
        Guid ClientId,
        string NormalizedPhone,
        bool RequiresCreation);
}
