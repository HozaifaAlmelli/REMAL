using Microsoft.EntityFrameworkCore;
using RentalPlatform.Business.Exceptions;
using RentalPlatform.Business.Interfaces;
using RentalPlatform.Business.Models;
using RentalPlatform.Data;
using RentalPlatform.Shared.Constants;
using RentalPlatform.Shared.Enums;

namespace RentalPlatform.Business.Services;

public sealed class HistoricalConflictService : IHistoricalConflictService
{
    private readonly IUnitOfWork _unitOfWork;

    public HistoricalConflictService(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task ValidateAsync(
        HistoricalConflictRequest request,
        CancellationToken cancellationToken = default)
    {
        if (!_unitOfWork.HasActiveTransaction)
            throw new InvalidOperationException("Historical conflict evaluation requires an active transaction.");

        var result = await LoadCandidatesAsync(request, cancellationToken);

        var exact = result.HardConflicts.FirstOrDefault(candidate =>
            candidate.ClientId == request.ClientId &&
            candidate.CheckInDate == request.CheckInDate &&
            candidate.CheckOutDate == request.CheckOutDate);
        if (exact is not null)
        {
            throw DuplicateConflict(
                "An identical historical booking is already recorded.",
                new Dictionary<string, object?>
                {
                    ["duplicateOf"] = exact.BookingId,
                    ["matchReason"] = "exact"
                });
        }

        var normalizedExternalReference = NormalizeOptional(request.ExternalReference);
        if (normalizedExternalReference is not null)
        {
            var externalDuplicate = await _unitOfWork.Bookings.Query()
                .AsNoTracking()
                .Where(booking => booking.ExternalReference == normalizedExternalReference)
                .Select(booking => (Guid?)booking.Id)
                .FirstOrDefaultAsync(cancellationToken);
            if (externalDuplicate.HasValue)
            {
                throw new ConflictException(
                    "The external reference is already assigned to another booking.",
                    HistoricalErrorCodes.ExternalReferenceAlreadyExists,
                    new Dictionary<string, object?>
                    {
                        ["duplicateOf"] = externalDuplicate.Value,
                        ["matchReason"] = "external_reference"
                    });
            }
        }

        var hardConflicts = result.HardConflicts
            .Where(candidate => !IdentityMatches(
                candidate.ClientId,
                candidate.NormalizedPhone,
                request.ClientId,
                request.NormalizedPhone))
            .OrderBy(candidate => candidate.CheckInDate)
            .ThenBy(candidate => candidate.BookingId)
            .ToArray();
        if (hardConflicts.Length > 0)
        {
            throw new ConflictException(
                "The requested stay overlaps an existing booking.",
                HistoricalErrorCodes.HistoricalOverlapConflict,
                new Dictionary<string, object?>
                {
                    ["conflicts"] = hardConflicts.Select(ToSafeBookingMetadata).ToArray()
                });
        }

        var probable = result.HardConflicts
            .Concat(result.SoftHolds)
            .Where(candidate =>
                IdentityMatches(
                    candidate.ClientId,
                    candidate.NormalizedPhone,
                    request.ClientId,
                    request.NormalizedPhone))
            .OrderBy(candidate => candidate.CheckInDate)
            .ThenBy(candidate => candidate.BookingId)
            .ToArray();

        ValidateAcknowledgementSet(
            request.AcknowledgedDuplicateOf,
            probable.Select(candidate => candidate.BookingId),
            "AcknowledgedDuplicateOf");

        if (probable.Length > 0 && request.AcknowledgedDuplicateOf.Count == 0)
        {
            throw DuplicateConflict(
                "A probable duplicate must be acknowledged before recording this booking.",
                new Dictionary<string, object?>
                {
                    ["candidates"] = probable.Select(ToSafeBookingMetadata).ToArray(),
                    ["requiresAcknowledgement"] = true,
                    ["matchReason"] = "probable"
                });
        }

        ValidateAcknowledgementSet(
            request.AcknowledgedDateBlockIds,
            result.ApprovedDateBlocks.Select(block => block.DateBlockId),
            "AcknowledgedDateBlockIds");

        if (result.ApprovedDateBlocks.Count > 0 && request.AcknowledgedDateBlockIds.Count == 0)
        {
            throw new ConflictException(
                "Approved date blocks must be acknowledged before recording this booking.",
                HistoricalErrorCodes.HistoricalOverlapConflict,
                new Dictionary<string, object?>
                {
                    ["dateBlocks"] = result.ApprovedDateBlocks
                        .Select(block => new
                        {
                            dateBlockId = block.DateBlockId,
                            startDate = block.StartDate,
                            endDate = block.EndDate,
                            reason = block.Reason
                        })
                        .ToArray(),
                    ["requiresAcknowledgement"] = true
                });
        }
    }

    private async Task<HistoricalConflictResult> LoadCandidatesAsync(
        HistoricalConflictRequest request,
        CancellationToken cancellationToken)
    {
        var hardStatuses = BookingStatusTransitions.HistoricalConflictStatuses;
        var softStatuses = BookingStatusTransitions.SoftHoldStatuses;
        var candidates = await _unitOfWork.Bookings.Query()
            .AsNoTracking()
            .Where(booking => booking.UnitId == request.UnitId)
            .Where(booking => hardStatuses.Contains(booking.BookingStatus) || softStatuses.Contains(booking.BookingStatus))
            .Where(booking => booking.CheckInDate < request.CheckOutDate && booking.CheckOutDate > request.CheckInDate)
            .Select(booking => new
            {
                booking.Id,
                booking.BookingStatus,
                booking.CheckInDate,
                booking.CheckOutDate,
                booking.ClientId
            })
            .ToListAsync(cancellationToken);

        var clientIds = candidates.Select(candidate => candidate.ClientId).Distinct().ToArray();
        var phones = await _unitOfWork.Clients.Query()
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(client => clientIds.Contains(client.Id))
            .Select(client => new { client.Id, client.Phone })
            .ToDictionaryAsync(client => client.Id, client => NormalizePhone(client.Phone), cancellationToken);

        var mapped = candidates.Select(candidate => new HistoricalConflictBooking(
                candidate.Id,
                candidate.BookingStatus,
                candidate.CheckInDate,
                candidate.CheckOutDate,
                candidate.ClientId,
                phones.GetValueOrDefault(candidate.ClientId, string.Empty)))
            .ToArray();

        var dateBlocks = await _unitOfWork.DateBlocks.Query()
            .AsNoTracking()
            .Where(block => block.UnitId == request.UnitId)
            .Where(block => block.DeletedAt == null && block.Status == DateBlockStatus.Approved)
            .Where(block => block.StartDate < request.CheckOutDate && block.EndDate >= request.CheckInDate)
            .OrderBy(block => block.StartDate)
            .ThenBy(block => block.Id)
            .Select(block => new HistoricalConflictDateBlock(
                block.Id,
                block.StartDate,
                block.EndDate,
                block.Reason))
            .ToListAsync(cancellationToken);

        return new HistoricalConflictResult(
            mapped.Where(candidate => hardStatuses.Contains(candidate.Status)).ToArray(),
            mapped.Where(candidate => softStatuses.Contains(candidate.Status)).ToArray(),
            dateBlocks);
    }

    private static void ValidateAcknowledgementSet(
        IReadOnlyList<Guid> supplied,
        IEnumerable<Guid> authoritative,
        string fieldName)
    {
        var expected = authoritative.ToHashSet();
        var suppliedSet = supplied.ToHashSet();
        if (supplied.Any(id => id == Guid.Empty) || suppliedSet.Count != supplied.Count)
            throw InvalidAcknowledgement(fieldName);

        if (supplied.Count > 0 && !suppliedSet.SetEquals(expected))
            throw InvalidAcknowledgement(fieldName);
    }

    private static BusinessValidationException InvalidAcknowledgement(string fieldName) =>
        new(
            $"{fieldName} must exactly match the current server-computed acknowledgement IDs.",
            HistoricalErrorCodes.ValidationError);

    private static ConflictException DuplicateConflict(
        string message,
        IReadOnlyDictionary<string, object?> metadata) =>
        new(message, HistoricalErrorCodes.HistoricalDuplicateBooking, metadata);

    private static object ToSafeBookingMetadata(HistoricalConflictBooking booking) => new
    {
        bookingId = booking.BookingId,
        status = booking.Status.ToString(),
        checkInDate = booking.CheckInDate,
        checkOutDate = booking.CheckOutDate
    };

    public static bool Overlaps(
        DateOnly firstCheckIn,
        DateOnly firstCheckOut,
        DateOnly secondCheckIn,
        DateOnly secondCheckOut) =>
        firstCheckIn < secondCheckOut && firstCheckOut > secondCheckIn;

    public static bool IdentityMatches(
        Guid candidateClientId,
        string candidateNormalizedPhone,
        Guid requestedClientId,
        string requestedNormalizedPhone) =>
        (candidateClientId != Guid.Empty && candidateClientId == requestedClientId) ||
        (!string.IsNullOrEmpty(candidateNormalizedPhone) &&
         string.Equals(candidateNormalizedPhone, requestedNormalizedPhone, StringComparison.Ordinal));

    internal static string NormalizePhone(string phone) => phone.Trim().TrimStart('+');

    private static string? NormalizeOptional(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
