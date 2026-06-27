using RentalPlatform.Business.Models;
using RentalPlatform.Data.Entities;

namespace RentalPlatform.Business.Interfaces;

public interface IDateBlockApprovalService
{
    Task<DateBlock> RequestOwnerBlockAsync(
        Guid ownerId,
        Guid unitId,
        DateOnly startDate,
        DateOnly endDate,
        string? reason,
        string? notes,
        CancellationToken cancellationToken = default);

    Task<DateBlockPreflightResult> EvaluateAsync(
        Guid ownerId,
        Guid unitId,
        DateOnly startDate,
        DateOnly endDate,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<DateBlockApprovalListItem>> GetPendingAsync(
        CancellationToken cancellationToken = default);

    Task<DateBlockResolutionResult> ResolveAsync(
        Guid blockId,
        string decision,
        Guid resolvingAdminId,
        string? notes,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Re-opens dates an owner previously closed by soft-deleting one of their own
    /// blocks. Works for both approved blocks and still-pending approval requests
    /// (a pending request is effectively withdrawn). Owner-driven only — no admin
    /// sign-off is required because freeing dates is never a conflict.
    /// </summary>
    Task<DateBlock> WithdrawOwnerBlockAsync(
        Guid ownerId,
        Guid unitId,
        Guid blockId,
        CancellationToken cancellationToken = default);
}
