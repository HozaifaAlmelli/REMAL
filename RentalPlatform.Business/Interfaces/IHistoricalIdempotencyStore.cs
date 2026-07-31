namespace RentalPlatform.Business.Interfaces;

public sealed record HistoricalIdempotencyClaim(bool IsReplay, Guid? BookingId);

public interface IHistoricalIdempotencyStore
{
    Task<HistoricalIdempotencyClaim> ClaimAsync(
        Guid actorAdminUserId,
        string endpoint,
        Guid key,
        string requestHash,
        CancellationToken cancellationToken = default);

    void Complete(
        Guid actorAdminUserId,
        string endpoint,
        Guid key,
        Guid bookingId);
}
