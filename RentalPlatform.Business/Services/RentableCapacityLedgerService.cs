using Microsoft.EntityFrameworkCore;
using RentalPlatform.Business.Exceptions;
using RentalPlatform.Business.Interfaces;
using RentalPlatform.Business.Models;
using RentalPlatform.Business.Time;
using RentalPlatform.Data;
using RentalPlatform.Data.Entities;
using RentalPlatform.Shared.Enums;

namespace RentalPlatform.Business.Services;

public sealed class RentableCapacityLedgerService : IRentableCapacityLedgerService
{
    public const string PublicationLockKey = "rentable-capacity:publication";

    private readonly IUnitOfWork _unitOfWork;
    private readonly IBusinessClock _clock;

    public RentableCapacityLedgerService(IUnitOfWork unitOfWork, IBusinessClock clock)
    {
        _unitOfWork = unitOfWork;
        _clock = clock;
    }

    public DateOnly CurrentCairoDate => _clock.CairoToday();

    public async Task EnterUnitMutationBoundaryAsync(
        Guid unitId,
        CancellationToken cancellationToken = default)
    {
        await _unitOfWork.AcquireSharedTransactionAdvisoryLockAsync(
            PublicationLockKey,
            cancellationToken);
        await _unitOfWork.AcquireTransactionAdvisoryLockAsync(
            $"booking-unit:{unitId:N}",
            cancellationToken);
    }

    public async Task RebuildCurrentAndFutureAsync(
        Unit unit,
        bool unitIsDeleted,
        bool isNewUnit,
        RentabilitySourceChange sourceChange,
        CancellationToken cancellationToken = default)
    {
        var ledger = await _unitOfWork.RentableCapacityLedgers.Query()
            .AsNoTracking()
            .SingleOrDefaultAsync(entry => entry.Scope == "global", cancellationToken);
        if (ledger is null || ledger.PublicationStatus == "uninitialized")
            return;

        if (ledger.PublicationStatus != "published" || ledger.CoverageStartDate is null)
        {
            throw new ConflictException(
                "Rentable-capacity history is not in a valid published state.");
        }

        var effectiveDate = MaxDate(CurrentCairoDate, ledger.CoverageStartDate.Value);
        var activePeriods = await _unitOfWork.UnitRentabilityPeriods.Query()
            .Where(period => period.UnitId == unit.Id && period.SupersededAt == null)
            .OrderBy(period => period.EffectiveFromDate)
            .ToListAsync(cancellationToken);

        if (!isNewUnit && activePeriods.Count == 0)
        {
            throw new ConflictException(
                "Rentable-capacity history is incomplete for this unit; the mutation was not applied.");
        }

        var blocks = await LoadAuthoritativeBlocksAsync(
            unit.Id,
            sourceChange.DateBlockChange,
            cancellationToken);
        var desired = ResolvePeriods(
            effectiveDate,
            unit.IsActive,
            unitIsDeleted,
            blocks);
        var currentFuture = ClipCurrentFuture(activePeriods, effectiveDate);

        if (Equivalent(currentFuture, desired))
            return;

        var revisionId = Guid.NewGuid();
        var recordedAt = DateTime.UtcNow;
        foreach (var period in activePeriods.Where(period =>
                     period.EffectiveToDate is null || period.EffectiveToDate > effectiveDate))
        {
            period.SupersededAt = recordedAt;
            period.SupersededByRevisionId = revisionId;
            _unitOfWork.UnitRentabilityPeriods.Update(period);

            if (period.EffectiveFromDate < effectiveDate)
            {
                await _unitOfWork.UnitRentabilityPeriods.AddAsync(
                    CloneClosedPrefix(period, effectiveDate),
                    cancellationToken);
            }
        }

        foreach (var period in desired)
        {
            await _unitOfWork.UnitRentabilityPeriods.AddAsync(
                new UnitRentabilityPeriod
                {
                    Id = Guid.NewGuid(),
                    UnitId = unit.Id,
                    Unit = unit,
                    EffectiveFromDate = period.From,
                    EffectiveToDate = period.To,
                    IsRentable = period.IsRentable,
                    ResolvedReason = period.Reason,
                    RevisionId = revisionId,
                    ChangeSourceType = sourceChange.SourceType,
                    ChangeSourceId = sourceChange.SourceId,
                    ActorType = sourceChange.ActorType,
                    ActorId = sourceChange.ActorId,
                    RecordedAt = recordedAt
                },
                cancellationToken);
        }
    }

    private async Task<IReadOnlyList<BlockTruth>> LoadAuthoritativeBlocksAsync(
        Guid unitId,
        DateBlockProjectionChange? change,
        CancellationToken cancellationToken)
    {
        var blocks = await _unitOfWork.DateBlocks.Query()
            .AsNoTracking()
            .Where(block => block.UnitId == unitId)
            .Where(block => block.DeletedAt == null)
            .Where(block => block.Status == DateBlockStatus.PendingApproval ||
                            block.Status == DateBlockStatus.Approved)
            .Select(block => new BlockTruth(block.Id, block.StartDate, block.EndDate))
            .ToListAsync(cancellationToken);

        if (change is null)
            return blocks;

        blocks.RemoveAll(block => block.Id == change.DateBlockId);
        if (change.Kind == DateBlockProjectionChangeKind.Upsert &&
            !change.IsDeleted &&
            change.Status is DateBlockStatus.PendingApproval or DateBlockStatus.Approved)
        {
            blocks.Add(new BlockTruth(
                change.DateBlockId,
                change.StartDate,
                change.EndDate));
        }

        return blocks;
    }

    private static IReadOnlyList<ResolvedPeriod> ResolvePeriods(
        DateOnly effectiveDate,
        bool unitIsActive,
        bool unitIsDeleted,
        IReadOnlyList<BlockTruth> blocks)
    {
        if (unitIsDeleted)
            return new[] { new ResolvedPeriod(effectiveDate, null, false, "unit_deleted") };
        if (!unitIsActive)
            return new[] { new ResolvedPeriod(effectiveDate, null, false, "unit_inactive") };

        var relevantBlocks = blocks
            .Where(block => block.EndDate >= effectiveDate)
            .ToArray();
        var boundaries = new SortedSet<DateOnly> { effectiveDate };
        foreach (var block in relevantBlocks)
        {
            boundaries.Add(MaxDate(effectiveDate, block.StartDate));
            if (block.EndDate != DateOnly.MaxValue)
                boundaries.Add(block.EndDate.AddDays(1));
        }

        var dates = boundaries.ToArray();
        var raw = new List<ResolvedPeriod>(dates.Length);
        for (var index = 0; index < dates.Length; index++)
        {
            var from = dates[index];
            var to = index + 1 < dates.Length ? dates[index + 1] : (DateOnly?)null;
            var blocked = relevantBlocks.Any(block =>
                block.StartDate <= from && block.EndDate >= from);
            raw.Add(new ResolvedPeriod(
                from,
                to,
                !blocked,
                blocked ? "date_block" : "rentable"));
        }

        return MergeAdjacent(raw);
    }

    private static IReadOnlyList<ResolvedPeriod> ClipCurrentFuture(
        IReadOnlyList<UnitRentabilityPeriod> periods,
        DateOnly effectiveDate)
    {
        return periods
            .Where(period => period.EffectiveToDate is null || period.EffectiveToDate > effectiveDate)
            .Select(period => new ResolvedPeriod(
                MaxDate(period.EffectiveFromDate, effectiveDate),
                period.EffectiveToDate,
                period.IsRentable,
                period.ResolvedReason))
            .ToArray();
    }

    private static IReadOnlyList<ResolvedPeriod> MergeAdjacent(
        IReadOnlyList<ResolvedPeriod> periods)
    {
        var merged = new List<ResolvedPeriod>();
        foreach (var period in periods)
        {
            if (merged.Count > 0)
            {
                var previous = merged[^1];
                if (previous.To == period.From &&
                    previous.IsRentable == period.IsRentable &&
                    previous.Reason == period.Reason)
                {
                    merged[^1] = previous with { To = period.To };
                    continue;
                }
            }

            merged.Add(period);
        }

        return merged;
    }

    private static UnitRentabilityPeriod CloneClosedPrefix(
        UnitRentabilityPeriod source,
        DateOnly effectiveToDate) => new()
    {
        Id = Guid.NewGuid(),
        UnitId = source.UnitId,
        EffectiveFromDate = source.EffectiveFromDate,
        EffectiveToDate = effectiveToDate,
        IsRentable = source.IsRentable,
        ResolvedReason = source.ResolvedReason,
        RevisionId = source.RevisionId,
        ChangeSourceType = source.ChangeSourceType,
        ChangeSourceId = source.ChangeSourceId,
        ActorType = source.ActorType,
        ActorId = source.ActorId,
        RecordedAt = source.RecordedAt
    };

    private static bool Equivalent(
        IReadOnlyList<ResolvedPeriod> left,
        IReadOnlyList<ResolvedPeriod> right) =>
        left.Count == right.Count && left.SequenceEqual(right);

    private static DateOnly MaxDate(DateOnly left, DateOnly right) =>
        left > right ? left : right;

    private sealed record BlockTruth(Guid Id, DateOnly StartDate, DateOnly EndDate);

    private sealed record ResolvedPeriod(
        DateOnly From,
        DateOnly? To,
        bool IsRentable,
        string Reason);
}
