using Microsoft.EntityFrameworkCore;
using RentalPlatform.Business.Exceptions;
using RentalPlatform.Business.Interfaces;
using RentalPlatform.Data;
using RentalPlatform.Data.Entities;
using RentalPlatform.Shared.Constants;

namespace RentalPlatform.Business.Services;

public sealed class HistoricalIdempotencyStore : IHistoricalIdempotencyStore
{
    private readonly IUnitOfWork _unitOfWork;
    private IdempotencyKey? _claimed;

    public HistoricalIdempotencyStore(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<HistoricalIdempotencyClaim> ClaimAsync(
        Guid actorAdminUserId,
        string endpoint,
        Guid key,
        string requestHash,
        CancellationToken cancellationToken = default)
    {
        var existing = await _unitOfWork.IdempotencyKeys.Query()
            .SingleOrDefaultAsync(item =>
                item.ActorAdminUserId == actorAdminUserId &&
                item.Endpoint == endpoint &&
                item.Key == key.ToString("D"), cancellationToken);

        if (existing is not null)
        {
            if (!string.Equals(existing.RequestHash, requestHash, StringComparison.Ordinal))
            {
                throw new ConflictException(
                    "The idempotency key has already been used for a different request.",
                    HistoricalErrorCodes.IdempotencyKeyReused);
            }

            if (existing.ResponseStatus == 200 &&
                existing.BookingId.HasValue &&
                existing.CompletedAt.HasValue)
            {
                return new HistoricalIdempotencyClaim(true, existing.BookingId.Value);
            }

            throw new ConflictException(
                "The idempotency request is incomplete and requires operator review.",
                HistoricalErrorCodes.IdempotencyRequestInProgress);
        }

        _claimed = new IdempotencyKey
        {
            ActorAdminUserId = actorAdminUserId,
            Endpoint = endpoint,
            Key = key.ToString("D"),
            RequestHash = requestHash,
            CreatedAt = DateTime.UtcNow
        };
        await _unitOfWork.IdempotencyKeys.AddAsync(_claimed, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);
        return new HistoricalIdempotencyClaim(false, null);
    }

    public void Complete(
        Guid actorAdminUserId,
        string endpoint,
        Guid key,
        Guid bookingId)
    {
        var tracked = _claimed;
        if (tracked is null ||
            tracked.ActorAdminUserId != actorAdminUserId ||
            !string.Equals(tracked.Endpoint, endpoint, StringComparison.Ordinal) ||
            !string.Equals(tracked.Key, key.ToString("D"), StringComparison.Ordinal))
        {
            throw new InvalidOperationException("The idempotency claim is not tracked by this request scope.");
        }

        tracked.BookingId = bookingId;
        tracked.ResponseStatus = 200;
        tracked.CompletedAt = DateTime.UtcNow;
        _unitOfWork.IdempotencyKeys.Update(tracked);
    }
}
