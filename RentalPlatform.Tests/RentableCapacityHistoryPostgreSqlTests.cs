using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Npgsql;
using RentalPlatform.Business.Exceptions;
using RentalPlatform.Business.Interfaces;
using RentalPlatform.Business.Models;
using RentalPlatform.Business.Services;
using RentalPlatform.Business.Time;
using RentalPlatform.Data;
using RentalPlatform.Data.Entities;
using RentalPlatform.RentableCapacityLedger;
using RentalPlatform.Shared.Enums;
using RentalPlatform.Shared.Models;
using RentalPlatform.Tests.Infrastructure;
using Xunit;

namespace RentalPlatform.Tests;

[Collection(PostgreSqlTestCollection.Name)]
[Trait(TestCategories.Name, TestCategories.PostgreSql)]
public sealed class RentableCapacityHistoryPostgreSqlTests
{
    private static readonly DateOnly Epoch = new(2026, 8, 14);
    private readonly PostgreSqlFixture _fixture;

    public RentableCapacityHistoryPostgreSqlTests(PostgreSqlFixture fixture)
    {
        _fixture = fixture;
    }

    [Fact]
    public async Task MigrationCreatesUnpublishedEmptyLedgerWithDatabaseOverlapProtection()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        await using var connection = await database.OpenConnectionAsync();

        Assert.Equal("uninitialized", await ScalarAsync<string>(connection,
            "SELECT publication_status FROM rentable_capacity_ledger WHERE scope = 'global'"));
        Assert.Equal(0L, await ScalarAsync<long>(connection,
            "SELECT COUNT(*) FROM unit_rentability_periods"));
        Assert.Equal(1L, await ScalarAsync<long>(connection,
            "SELECT COUNT(*) FROM pg_extension WHERE extname = 'btree_gist'"));
    }

    [Fact]
    public async Task MigrationRollbackReappliesOnlyBeforeSeedOrPublication()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        await using var connection = await database.OpenConnectionAsync();
        var root = RepositoryRoot();
        var migration = await File.ReadAllTextAsync(Path.Combine(
            root, "db", "migrations", "0064_add_rentable_capacity_history.sql"));
        var verifier = await File.ReadAllTextAsync(Path.Combine(
            root, "db", "migrations", "0064_add_rentable_capacity_history_verify.sql"));
        var rollback = await File.ReadAllTextAsync(Path.Combine(
            root, "db", "migrations", "0064_add_rentable_capacity_history_rollback.sql"));

        await PostgreSqlFixture.ExecuteMigrationSqlAsync(connection, rollback);
        Assert.True(await ScalarAsync<bool>(connection, "SELECT to_regclass('rentable_capacity_ledger') IS NULL"));
        Assert.Equal(1L, await ScalarAsync<long>(connection,
            "SELECT COUNT(*) FROM pg_extension WHERE extname = 'btree_gist'"));

        await PostgreSqlFixture.ExecuteMigrationSqlAsync(connection, migration);
        await PostgreSqlFixture.ExecuteMigrationSqlAsync(connection, verifier);
        Assert.Equal("uninitialized", await ScalarAsync<string>(connection,
            "SELECT publication_status FROM rentable_capacity_ledger WHERE scope = 'global'"));
    }

    private static string RepositoryRoot()
    {
        foreach (var start in new[] { Directory.GetCurrentDirectory(), AppContext.BaseDirectory })
        {
            for (var directory = new DirectoryInfo(start); directory is not null; directory = directory.Parent)
            {
                if (File.Exists(Path.Combine(directory.FullName, "RentalPlatform.slnx"))
                    && File.Exists(Path.Combine(directory.FullName, "db", "init.sql")))
                {
                    return directory.FullName;
                }
            }
        }

        throw new DirectoryNotFoundException(
            "Could not locate the repository root containing RentalPlatform.slnx and db/init.sql.");
    }

    [Fact]
    public async Task OpeningSeedResolvesActiveInactiveAndBlockedUnitsWithoutPreEpochClaims()
    {
        await using var scope = await TestScope.CreateAsync(_fixture, Epoch);
        var active = await scope.CreateUnitAsync(true, "Active opening unit");
        var inactive = await scope.CreateUnitAsync(false, "Inactive opening unit");
        var blocked = await scope.CreateUnitAsync(true, "Blocked opening unit");
        await scope.CreateBlockAsync(blocked.Id, Epoch.AddDays(-5), Epoch.AddDays(2));

        Assert.Equal(0, await scope.PublishAsync());

        await using var context = scope.Database.CreateDbContext();
        var activePeriods = await CurrentPeriods(context, active.Id);
        var inactivePeriods = await CurrentPeriods(context, inactive.Id);
        var blockedPeriods = await CurrentPeriods(context, blocked.Id);

        Assert.Collection(activePeriods, period => AssertPeriod(period, Epoch, null, true, "rentable"));
        Assert.Collection(inactivePeriods, period => AssertPeriod(period, Epoch, null, false, "unit_inactive"));
        Assert.Collection(
            blockedPeriods,
            period => AssertPeriod(period, Epoch, Epoch.AddDays(3), false, "date_block"),
            period => AssertPeriod(period, Epoch.AddDays(3), null, true, "rentable"));
        Assert.DoesNotContain(
            await context.UnitRentabilityPeriods.AsNoTracking().ToListAsync(),
            period => period.EffectiveFromDate < Epoch);
        Assert.Equal(0, await scope.VerifyAsync());
        Assert.Equal(RentableCapacityLedgerGate.InconsistencyExitCode, await scope.PublishAsync());
    }

    [Fact]
    public async Task UnitLifecycleProducesContinuousCurrentProjectionFromCairoEffectiveDates()
    {
        await using var scope = await TestScope.CreatePublishedAsync(_fixture, Epoch);
        var unit = scope.Units.Single();

        scope.Clock.Today = Epoch.AddDays(1);
        await scope.WithUnitService(service => service.SetActiveAsync(unit.Id, false));
        scope.Clock.Today = Epoch.AddDays(2);
        await scope.WithUnitService(service => service.SetActiveAsync(unit.Id, true));
        scope.Clock.Today = Epoch.AddDays(3);
        await scope.WithUnitService(service => service.SoftDeleteAsync(unit.Id));

        await using var context = scope.Database.CreateDbContext();
        Assert.Collection(
            await CurrentPeriods(context, unit.Id),
            period => AssertPeriod(period, Epoch, Epoch.AddDays(1), true, "rentable"),
            period => AssertPeriod(period, Epoch.AddDays(1), Epoch.AddDays(2), false, "unit_inactive"),
            period => AssertPeriod(period, Epoch.AddDays(2), Epoch.AddDays(3), true, "rentable"),
            period => AssertPeriod(period, Epoch.AddDays(3), null, false, "unit_deleted"));
        Assert.Equal(0, await scope.VerifyAsync());
    }

    [Fact]
    public async Task UnitCreatedAfterEpochBeginsManagedCapacityOnItsCairoEntryDate()
    {
        await using var scope = await TestScope.CreatePublishedAsync(_fixture, Epoch);
        scope.Clock.Today = Epoch.AddDays(4);
        var unit = await scope.CreateUnitAsync(false, "Post epoch inactive unit");
        await scope.ExecuteAsync(
            "UPDATE units SET created_at = TIMESTAMP '2026-08-18 00:00:00' WHERE id = @unit_id",
            new NpgsqlParameter("unit_id", unit.Id));

        await using var context = scope.Database.CreateDbContext();
        Assert.Collection(
            await CurrentPeriods(context, unit.Id),
            period => AssertPeriod(
                period,
                Epoch.AddDays(4),
                null,
                false,
                "unit_inactive"));
        Assert.Equal(0, await scope.VerifyAsync());
    }

    [Fact]
    public async Task RemovingOneOfTwoOverlappingBlocksDoesNotReopenNightsBlockedByTheOther()
    {
        await using var scope = await TestScope.CreateAsync(_fixture, Epoch);
        var unit = await scope.CreateUnitAsync(true, "Overlapping block unit");
        var first = await scope.InsertBlockDirectAsync(
            unit.Id,
            Epoch.AddDays(1),
            Epoch.AddDays(5),
            DateBlockStatus.Approved);
        await scope.InsertBlockDirectAsync(
            unit.Id,
            Epoch.AddDays(3),
            Epoch.AddDays(7),
            DateBlockStatus.PendingApproval);
        Assert.Equal(0, await scope.PublishAsync());

        scope.Clock.Today = Epoch.AddDays(2);
        await scope.WithDateBlockService(service => service.DeleteAsync(first));

        await using var context = scope.Database.CreateDbContext();
        Assert.False((await PeriodForDate(context, unit.Id, Epoch.AddDays(3))).IsRentable);
        Assert.False((await PeriodForDate(context, unit.Id, Epoch.AddDays(7))).IsRentable);
        Assert.True((await PeriodForDate(context, unit.Id, Epoch.AddDays(8))).IsRentable);
        Assert.Equal(0, await scope.VerifyAsync());
    }

    [Fact]
    public async Task RetroactiveBlockEditPreservesClosedNightsAndRebuildsOnlyCurrentFutureTruth()
    {
        await using var scope = await TestScope.CreateAsync(_fixture, Epoch);
        var unit = await scope.CreateUnitAsync(true, "Closed history unit");
        var block = await scope.InsertBlockDirectAsync(
            unit.Id,
            Epoch.AddDays(-3),
            Epoch.AddDays(1),
            DateBlockStatus.Approved);
        Assert.Equal(0, await scope.PublishAsync());

        scope.Clock.Today = Epoch.AddDays(2);
        await scope.WithDateBlockService(service => service.UpdateAsync(
            block,
            Epoch.AddDays(-10),
            Epoch.AddDays(-5),
            "past correction",
            null));

        await using var context = scope.Database.CreateDbContext();
        Assert.False((await PeriodForDate(context, unit.Id, Epoch)).IsRentable);
        Assert.False((await PeriodForDate(context, unit.Id, Epoch.AddDays(1))).IsRentable);
        Assert.True((await PeriodForDate(context, unit.Id, Epoch.AddDays(2))).IsRentable);
        Assert.Equal(0, await scope.VerifyAsync());
    }

    [Fact]
    public async Task SourceAndLedgerRollbackTogetherWhenPeriodWriteFails()
    {
        await using var scope = await TestScope.CreatePublishedAsync(_fixture, Epoch);
        var unit = scope.Units.Single();
        scope.Clock.Today = Epoch.AddDays(1);
        await scope.ExecuteAsync(
            """
            CREATE FUNCTION reject_capacity_period() RETURNS trigger LANGUAGE plpgsql AS $$
            BEGIN
                RAISE EXCEPTION 'forced ledger failure';
            END $$;
            CREATE TRIGGER reject_capacity_period
            BEFORE INSERT ON unit_rentability_periods
            FOR EACH ROW EXECUTE FUNCTION reject_capacity_period();
            """);

        await Assert.ThrowsAnyAsync<Exception>(() =>
            scope.WithUnitService(service => service.SetActiveAsync(unit.Id, false)));

        await using var context = scope.Database.CreateDbContext();
        Assert.True((await context.Units.AsNoTracking().SingleAsync(entry => entry.Id == unit.Id)).IsActive);
        Assert.Collection(
            await CurrentPeriods(context, unit.Id),
            period => AssertPeriod(period, Epoch, null, true, "rentable"));
    }

    [Fact]
    public async Task CallerOwnedTransactionIsNotCommittedByCapacityWriter()
    {
        await using var scope = await TestScope.CreatePublishedAsync(_fixture, Epoch);
        var unit = scope.Units.Single();
        scope.Clock.Today = Epoch.AddDays(1);

        await using (var context = scope.Database.CreateDbContext())
        {
            var unitOfWork = new UnitOfWork(context);
            var ledger = new RentableCapacityLedgerService(unitOfWork, scope.Clock);
            var service = new UnitService(unitOfWork, ledger);
            await using var transaction = await unitOfWork.BeginTransactionAsync();
            await service.SetActiveAsync(unit.Id, false);
            Assert.True(unitOfWork.HasActiveTransaction);
            await transaction.RollbackAsync();
        }

        await using var verification = scope.Database.CreateDbContext();
        Assert.True((await verification.Units.AsNoTracking().SingleAsync(entry => entry.Id == unit.Id)).IsActive);
        Assert.Collection(
            await CurrentPeriods(verification, unit.Id),
            period => AssertPeriod(period, Epoch, null, true, "rentable"));
    }

    [Fact]
    public async Task DatabaseRejectsOverlappingCurrentIntervals()
    {
        await using var scope = await TestScope.CreatePublishedAsync(_fixture, Epoch);
        var unit = scope.Units.Single();
        await using var context = scope.Database.CreateDbContext();
        context.UnitRentabilityPeriods.Add(new UnitRentabilityPeriod
        {
            Id = Guid.NewGuid(),
            UnitId = unit.Id,
            EffectiveFromDate = Epoch.AddDays(1),
            EffectiveToDate = Epoch.AddDays(2),
            IsRentable = false,
            ResolvedReason = "date_block",
            RevisionId = Guid.NewGuid(),
            ChangeSourceType = "date_block_create",
            RecordedAt = DateTime.UtcNow
        });

        var exception = await Assert.ThrowsAsync<DbUpdateException>(() => context.SaveChangesAsync());
        Assert.Equal("23P01", Assert.IsType<PostgresException>(exception.InnerException).SqlState);
    }

    [Fact]
    public async Task VerifierFailsClosedForGapAndMissingOpeningPeriod()
    {
        await using var scope = await TestScope.CreatePublishedAsync(_fixture, Epoch);
        var unit = scope.Units.Single();
        await scope.ExecuteAsync(
            "DELETE FROM unit_rentability_periods WHERE unit_id = @unit_id AND superseded_at IS NULL",
            new NpgsqlParameter("unit_id", unit.Id));

        var output = new StringWriter();
        var error = new StringWriter();
        var exit = await RentableCapacityLedgerGate.RunAsync(
            scope.Database.ConnectionString,
            output,
            error);

        Assert.Equal(RentableCapacityLedgerGate.InconsistencyExitCode, exit);
        Assert.Contains("missing_opening_period", output.ToString());
        Assert.Contains("missing_open_period", output.ToString());
    }

    [Fact]
    public async Task VerifierDetectsMalformedCurrentVersionTruthAndRunsReadOnly()
    {
        await using var scope = await TestScope.CreatePublishedAsync(_fixture, Epoch);
        var cleanOutput = new StringWriter();
        Assert.Equal(0, await RentableCapacityLedgerGate.RunAsync(
            scope.Database.ConnectionString,
            cleanOutput,
            TextWriter.Null));
        Assert.Contains("\"readOnly\":true", cleanOutput.ToString());

        var unit = scope.Units.Single();
        await scope.ExecuteAsync(
            """
            ALTER TABLE unit_rentability_periods
                DROP CONSTRAINT ex_unit_rentability_periods_current_overlap;
            ALTER TABLE unit_rentability_periods
                DROP CONSTRAINT ck_unit_rentability_periods_bounds;
            ALTER TABLE unit_rentability_periods
                DROP CONSTRAINT ck_unit_rentability_periods_supersession;
            DROP INDEX uq_unit_rentability_periods_current_open;

            INSERT INTO unit_rentability_periods (
                id, unit_id, effective_from_date, effective_to_date, is_rentable,
                resolved_reason, revision_id, change_source_type, recorded_at,
                superseded_at, superseded_by_revision_id
            ) VALUES
                (gen_random_uuid(), @unit_id, @epoch - 1, @epoch + 2, TRUE,
                 'rentable', gen_random_uuid(), 'unit_update', NOW() AT TIME ZONE 'UTC', NULL, NULL),
                (gen_random_uuid(), @unit_id, @epoch + 4, @epoch + 3, FALSE,
                 'unit_inactive', gen_random_uuid(), 'unit_status', NOW() AT TIME ZONE 'UTC', NULL, NULL),
                (gen_random_uuid(), @unit_id, @epoch + 5, NULL, TRUE,
                 'rentable', gen_random_uuid(), 'unit_update', NOW() AT TIME ZONE 'UTC', NULL, NULL),
                (gen_random_uuid(), @unit_id, @epoch + 6, @epoch + 7, TRUE,
                 'rentable', gen_random_uuid(), 'unit_update', NOW() AT TIME ZONE 'UTC',
                 NOW() AT TIME ZONE 'UTC', NULL);
            """,
            new NpgsqlParameter("unit_id", unit.Id),
            new NpgsqlParameter("epoch", Epoch));

        var output = new StringWriter();
        Assert.Equal(RentableCapacityLedgerGate.InconsistencyExitCode,
            await RentableCapacityLedgerGate.RunAsync(
                scope.Database.ConnectionString,
                output,
                TextWriter.Null));
        var evidence = output.ToString();
        Assert.Contains("pre_epoch_claim", evidence);
        Assert.Contains("overlap", evidence);
        Assert.Contains("invalid_bounds", evidence);
        Assert.Contains("multiple_open_periods", evidence);
        Assert.Contains("malformed_supersession", evidence);
    }

    [Fact]
    public async Task OpeningPublicationRollsBackWhenSeedVerificationFails()
    {
        await using var scope = await TestScope.CreateAsync(_fixture, Epoch);
        await scope.CreateUnitAsync(true, "Sabotaged seed unit");
        await scope.ExecuteAsync(
            """
            CREATE FUNCTION sabotage_capacity_publication() RETURNS trigger LANGUAGE plpgsql AS $$
            BEGIN
                DELETE FROM unit_rentability_periods
                WHERE id = (SELECT id FROM unit_rentability_periods LIMIT 1);
                RETURN NEW;
            END $$;
            CREATE TRIGGER sabotage_capacity_publication
            BEFORE UPDATE ON rentable_capacity_ledger
            FOR EACH ROW EXECUTE FUNCTION sabotage_capacity_publication();
            """);

        Assert.Equal(RentableCapacityLedgerGate.InconsistencyExitCode, await scope.PublishAsync());
        await using var connection = await scope.Database.OpenConnectionAsync();
        Assert.Equal("uninitialized", await ScalarAsync<string>(connection,
            "SELECT publication_status FROM rentable_capacity_ledger WHERE scope = 'global'"));
        Assert.Equal(0L, await ScalarAsync<long>(connection,
            "SELECT COUNT(*) FROM unit_rentability_periods"));
    }

    [Fact]
    public async Task DifferentUnitsDoNotSerializeBehindAnotherUnitsBookingLock()
    {
        await using var scope = await TestScope.CreateAsync(_fixture, Epoch);
        var first = await scope.CreateUnitAsync(true, "Locked unit");
        var second = await scope.CreateUnitAsync(true, "Independent unit");
        Assert.Equal(0, await scope.PublishAsync());
        scope.Clock.Today = Epoch.AddDays(1);

        await using var connection = await scope.Database.OpenConnectionAsync();
        await using var transaction = await connection.BeginTransactionAsync();
        await using (var command = new NpgsqlCommand(
            "SELECT pg_advisory_xact_lock(hashtextextended(@key, 0))",
            connection,
            transaction))
        {
            command.Parameters.AddWithValue("key", $"booking-unit:{first.Id:N}");
            await command.ExecuteNonQueryAsync();
        }

        var independentMutation = scope.WithUnitService(service =>
            service.SetActiveAsync(second.Id, false));
        await independentMutation.WaitAsync(TimeSpan.FromSeconds(5));
        await transaction.RollbackAsync();

        await using var context = scope.Database.CreateDbContext();
        Assert.False((await context.Units.AsNoTracking().SingleAsync(unit => unit.Id == second.Id)).IsActive);
    }

    [Fact]
    public async Task PendingToApprovedDoesNotCreateFalseRentabilityTransitionAndRejectionReleasesFutureCapacity()
    {
        await using var scope = await TestScope.CreateAsync(_fixture, Epoch);
        var unit = await scope.CreateUnitAsync(true, "Approval lifecycle unit");
        var blockId = await scope.InsertBlockDirectAsync(
            unit.Id,
            Epoch.AddDays(1),
            Epoch.AddDays(5),
            DateBlockStatus.PendingApproval);
        Assert.Equal(0, await scope.PublishAsync());

        var periodCountBefore = await scope.CountPeriodsAsync(unit.Id);
        scope.Clock.Today = Epoch.AddDays(1);
        await scope.WithApprovalService(service => service.ResolveAsync(
            blockId,
            "approved",
            scope.AdminId,
            null));
        Assert.Equal(periodCountBefore, await scope.CountPeriodsAsync(unit.Id));

        var rejectedBlockId = await scope.InsertBlockDirectAsync(
            unit.Id,
            Epoch.AddDays(7),
            Epoch.AddDays(9),
            DateBlockStatus.PendingApproval);
        await scope.RebuildForSyntheticBlockAsync(unit.Id, rejectedBlockId, "date_block_request");
        scope.Clock.Today = Epoch.AddDays(2);
        await scope.WithApprovalService(service => service.ResolveAsync(
            rejectedBlockId,
            "rejected",
            scope.AdminId,
            null));

        await using var context = scope.Database.CreateDbContext();
        Assert.True((await PeriodForDate(context, unit.Id, Epoch.AddDays(7))).IsRentable);
        Assert.Equal(0, await scope.VerifyAsync());
    }

    [Fact]
    public async Task OwnerWithdrawalReleasesOnlyCurrentAndFutureCapacity()
    {
        await using var scope = await TestScope.CreateAsync(_fixture, Epoch);
        var unit = await scope.CreateUnitAsync(true, "Withdrawal unit");
        var blockId = await scope.InsertBlockDirectAsync(
            unit.Id,
            Epoch,
            Epoch.AddDays(6),
            DateBlockStatus.Approved);
        Assert.Equal(0, await scope.PublishAsync());

        scope.Clock.Today = Epoch.AddDays(3);
        await scope.WithApprovalService(service => service.WithdrawOwnerBlockAsync(
            scope.OwnerId,
            unit.Id,
            blockId));

        await using var context = scope.Database.CreateDbContext();
        Assert.False((await PeriodForDate(context, unit.Id, Epoch.AddDays(2))).IsRentable);
        Assert.True((await PeriodForDate(context, unit.Id, Epoch.AddDays(3))).IsRentable);
        Assert.Equal(0, await scope.VerifyAsync());
    }

    [Fact]
    public async Task SameUnitConcurrentOverlappingBlocksHaveOneValidSerialWinner()
    {
        await using var scope = await TestScope.CreatePublishedAsync(_fixture, Epoch);
        var unit = scope.Units.Single();
        var start = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);

        async Task<Exception?> AttemptAsync(string reason)
        {
            await start.Task;
            try
            {
                await scope.WithDateBlockService(service => service.CreateAsync(
                    unit.Id,
                    Epoch.AddDays(2),
                    Epoch.AddDays(4),
                    reason,
                    null));
                return null;
            }
            catch (Exception exception)
            {
                return exception;
            }
        }

        var first = AttemptAsync("first");
        var second = AttemptAsync("second");
        start.SetResult();
        var results = await Task.WhenAll(first, second);

        Assert.Single(results, result => result is null);
        Assert.Single(results, result => result is ConflictException);
        await using var context = scope.Database.CreateDbContext();
        Assert.Equal(1, await context.DateBlocks.AsNoTracking().CountAsync(block => block.UnitId == unit.Id));
        Assert.False((await PeriodForDate(context, unit.Id, Epoch.AddDays(3))).IsRentable);
        Assert.Equal(0, await scope.VerifyAsync());
    }

    [Fact]
    public async Task ConcurrentBlockAndRelevantToBookedTransitionResolveToOneValidSerialOutcome()
    {
        await using var scope = await TestScope.CreatePublishedAsync(_fixture, Epoch);
        var unit = scope.Units.Single();
        var bookingId = await scope.CreateRelevantBookingAsync(
            unit.Id,
            Epoch.AddDays(2),
            Epoch.AddDays(5));

        await using var gateConnection = await scope.Database.OpenConnectionAsync();
        await using var gateTransaction = await gateConnection.BeginTransactionAsync();
        await using (var command = new NpgsqlCommand(
            "SELECT pg_advisory_xact_lock(hashtextextended(@key, 0))",
            gateConnection,
            gateTransaction))
        {
            command.Parameters.AddWithValue("key", $"booking-unit:{unit.Id:N}");
            await command.ExecuteNonQueryAsync();
        }

        var blockTask = CaptureAsync(() => scope.WithDateBlockService(service => service.CreateAsync(
            unit.Id,
            Epoch.AddDays(2),
            Epoch.AddDays(4),
            "concurrent maintenance",
            null)));
        var bookingTask = CaptureAsync(() => scope.WithBookingLifecycleService(service =>
            service.TransitionAsync(
                bookingId,
                BookingStatus.Booked,
                scope.AdminId,
                null)));

        await WaitForAdvisoryWaitersAsync(gateConnection, gateTransaction, 2);
        await gateTransaction.CommitAsync();
        var outcomes = await Task.WhenAll(blockTask, bookingTask);

        Assert.Single(outcomes, outcome => outcome is null);
        Assert.Single(outcomes, outcome => outcome is ConflictException);

        await using var context = scope.Database.CreateDbContext();
        var bookingStatus = await context.Bookings.AsNoTracking()
            .Where(booking => booking.Id == bookingId)
            .Select(booking => booking.BookingStatus)
            .SingleAsync();
        var blockExists = await context.DateBlocks.AsNoTracking()
            .AnyAsync(block => block.UnitId == unit.Id);
        Assert.True(
            (bookingStatus == BookingStatus.Booked && !blockExists) ||
            (bookingStatus == BookingStatus.Relevant && blockExists));
        Assert.Equal(0, await scope.VerifyAsync());
    }

    private static async Task<Exception?> CaptureAsync(Func<Task> action)
    {
        try
        {
            await action();
            return null;
        }
        catch (Exception exception)
        {
            return exception;
        }
    }

    private static async Task WaitForAdvisoryWaitersAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        int expected)
    {
        for (var attempt = 0; attempt < 100; attempt++)
        {
            await using var command = new NpgsqlCommand(
                """
                SELECT COUNT(*)
                FROM pg_locks
                WHERE locktype = 'advisory' AND NOT granted
                """,
                connection,
                transaction);
            if (Convert.ToInt32(await command.ExecuteScalarAsync()) >= expected)
                return;
            await Task.Delay(25);
        }

        throw new TimeoutException("The expected booking-unit advisory-lock waiters did not arrive.");
    }

    private static async Task<List<UnitRentabilityPeriod>> CurrentPeriods(
        AppDbContext context,
        Guid unitId) =>
        await context.UnitRentabilityPeriods
            .AsNoTracking()
            .Where(period => period.UnitId == unitId && period.SupersededAt == null)
            .OrderBy(period => period.EffectiveFromDate)
            .ToListAsync();

    private static async Task<UnitRentabilityPeriod> PeriodForDate(
        AppDbContext context,
        Guid unitId,
        DateOnly date) =>
        await context.UnitRentabilityPeriods.AsNoTracking().SingleAsync(period =>
            period.UnitId == unitId &&
            period.SupersededAt == null &&
            period.EffectiveFromDate <= date &&
            (period.EffectiveToDate == null || period.EffectiveToDate > date));

    private static void AssertPeriod(
        UnitRentabilityPeriod period,
        DateOnly from,
        DateOnly? to,
        bool rentable,
        string reason)
    {
        Assert.Equal(from, period.EffectiveFromDate);
        Assert.Equal(to, period.EffectiveToDate);
        Assert.Equal(rentable, period.IsRentable);
        Assert.Equal(reason, period.ResolvedReason);
    }

    private static async Task<T> ScalarAsync<T>(NpgsqlConnection connection, string sql)
    {
        await using var command = new NpgsqlCommand(sql, connection);
        return (T)(await command.ExecuteScalarAsync())!;
    }

    private sealed class MutableBusinessClock : IBusinessClock
    {
        public MutableBusinessClock(DateOnly today) => Today = today;
        public DateOnly Today { get; set; }
        public DateOnly CairoToday() => Today;
    }

    private sealed class TestScope : IAsyncDisposable
    {
        private TestScope(PostgreSqlTestDatabase database, MutableBusinessClock clock)
        {
            Database = database;
            Clock = clock;
        }

        public PostgreSqlTestDatabase Database { get; }
        public MutableBusinessClock Clock { get; }
        public Guid OwnerId { get; private set; }
        public Guid ProjectId { get; private set; }
        public Guid AdminId { get; private set; }
        public Guid ClientId { get; private set; }
        public List<Unit> Units { get; } = new();

        public static async Task<TestScope> CreateAsync(PostgreSqlFixture fixture, DateOnly epoch)
        {
            var scope = new TestScope(
                await fixture.CreateTestDatabaseAsync(),
                new MutableBusinessClock(epoch));
            await scope.SeedReferencesAsync();
            return scope;
        }

        public static async Task<TestScope> CreatePublishedAsync(
            PostgreSqlFixture fixture,
            DateOnly epoch)
        {
            var scope = await CreateAsync(fixture, epoch);
            await scope.CreateUnitAsync(true, "Published unit");
            Assert.Equal(0, await scope.PublishAsync());
            return scope;
        }

        public async Task<Unit> CreateUnitAsync(bool isActive, string name)
        {
            Unit created = null!;
            await WithUnitService(async service =>
            {
                created = await service.CreateAsync(
                    OwnerId,
                    ProjectId,
                    name,
                    null,
                    null,
                    "apartment",
                    1,
                    1,
                    2,
                    1_000m,
                    isActive,
                    true);
            });
            Units.Add(created);
            return created;
        }

        public async Task<DateBlock> CreateBlockAsync(Guid unitId, DateOnly start, DateOnly end)
        {
            DateBlock result = null!;
            await WithDateBlockService(async service =>
            {
                result = await service.CreateAsync(unitId, start, end, "maintenance", null);
            });
            return result;
        }

        public async Task<Guid> InsertBlockDirectAsync(
            Guid unitId,
            DateOnly start,
            DateOnly end,
            DateBlockStatus status)
        {
            await using var context = Database.CreateDbContext();
            var block = new DateBlock
            {
                Id = Guid.NewGuid(),
                UnitId = unitId,
                StartDate = start,
                EndDate = end,
                Status = status,
                RequiresAdminSignoff = status == DateBlockStatus.PendingApproval,
                Reason = "synthetic overlap"
            };
            context.DateBlocks.Add(block);
            await context.SaveChangesAsync();
            return block.Id;
        }

        public async Task WithUnitService(Func<UnitService, Task> action)
        {
            await using var context = Database.CreateDbContext();
            var unitOfWork = new UnitOfWork(context);
            var ledger = new RentableCapacityLedgerService(unitOfWork, Clock);
            await action(new UnitService(unitOfWork, ledger));
        }

        public async Task WithDateBlockService(Func<DateBlockService, Task> action)
        {
            await using var context = Database.CreateDbContext();
            var unitOfWork = new UnitOfWork(context);
            var ledger = new RentableCapacityLedgerService(unitOfWork, Clock);
            await action(new DateBlockService(unitOfWork, ledger));
        }

        public async Task WithApprovalService(Func<DateBlockApprovalService, Task> action)
        {
            await using var context = Database.CreateDbContext();
            var unitOfWork = new UnitOfWork(context);
            var ledger = new RentableCapacityLedgerService(unitOfWork, Clock);
            await action(new DateBlockApprovalService(
                unitOfWork,
                new StubNotificationService(),
                new StubBookingLifecycleService(),
                new StubCrmLeadService(),
                NullLogger<DateBlockApprovalService>.Instance,
                ledger));
        }

        public async Task WithBookingLifecycleService(Func<BookingLifecycleService, Task> action)
        {
            await using var context = Database.CreateDbContext();
            var unitOfWork = new UnitOfWork(context);
            await action(new BookingLifecycleService(
                unitOfWork,
                new UnitAvailabilityService(unitOfWork),
                new StubInvoiceService(),
                new StubNotificationService(),
                NullLogger<BookingLifecycleService>.Instance));
        }

        public async Task<Guid> CreateRelevantBookingAsync(
            Guid unitId,
            DateOnly checkIn,
            DateOnly checkOut)
        {
            await using var context = Database.CreateDbContext();
            var booking = new Booking
            {
                Id = Guid.NewGuid(),
                ClientId = ClientId,
                UnitId = unitId,
                OwnerId = OwnerId,
                AssignedAdminUserId = AdminId,
                BookingStatus = BookingStatus.Relevant,
                CheckInDate = checkIn,
                CheckOutDate = checkOut,
                GuestCount = 1,
                BaseAmount = 3_000m,
                FinalAmount = 3_000m,
                Source = "admin"
            };
            context.Bookings.Add(booking);
            await context.SaveChangesAsync();
            return booking.Id;
        }

        public async Task RebuildForSyntheticBlockAsync(
            Guid unitId,
            Guid blockId,
            string sourceType)
        {
            await using var context = Database.CreateDbContext();
            var unitOfWork = new UnitOfWork(context);
            var ledger = new RentableCapacityLedgerService(unitOfWork, Clock);
            await using var transaction = await unitOfWork.BeginTransactionAsync();
            await ledger.EnterUnitMutationBoundaryAsync(unitId);
            var unit = await context.Units.SingleAsync(entry => entry.Id == unitId);
            var block = await context.DateBlocks.SingleAsync(entry => entry.Id == blockId);
            await ledger.RebuildCurrentAndFutureAsync(
                unit,
                false,
                false,
                new RentabilitySourceChange(
                    sourceType,
                    blockId,
                    DateBlockChange: new DateBlockProjectionChange(
                        block.Id,
                        DateBlockProjectionChangeKind.Upsert,
                        block.StartDate,
                        block.EndDate,
                        block.Status,
                        false)));
            await unitOfWork.SaveChangesAsync();
            await transaction.CommitAsync();
        }

        public async Task<int> CountPeriodsAsync(Guid unitId)
        {
            await using var context = Database.CreateDbContext();
            return await context.UnitRentabilityPeriods.AsNoTracking()
                .CountAsync(period => period.UnitId == unitId);
        }

        public async Task<int> PublishAsync()
        {
            return await RentableCapacityLedgerInitializer.RunAsync(
                Database.ConnectionString,
                Epoch,
                Epoch,
                TextWriter.Null,
                TextWriter.Null);
        }

        public async Task<int> VerifyAsync()
        {
            return await RentableCapacityLedgerGate.RunAsync(
                Database.ConnectionString,
                TextWriter.Null,
                TextWriter.Null);
        }

        public async Task ExecuteAsync(string sql, params NpgsqlParameter[] parameters)
        {
            await using var connection = await Database.OpenConnectionAsync();
            await using var command = new NpgsqlCommand(sql, connection);
            command.Parameters.AddRange(parameters);
            await command.ExecuteNonQueryAsync();
        }

        private async Task SeedReferencesAsync()
        {
            await using var context = Database.CreateDbContext();
            var suffix = Guid.NewGuid().ToString("N")[..10];
            var owner = new Owner
            {
                Id = Guid.NewGuid(),
                Name = $"AN OPS Owner {suffix}",
                Phone = $"+2010{suffix[..8]}",
                EmergencyPhone = $"+2011{suffix[..8]}",
                CommissionRate = 10m,
                Status = "active",
                PasswordHash = "test-only"
            };
            var project = new Project
            {
                Id = Guid.NewGuid(),
                Name = $"AN OPS Project {suffix}",
                IsActive = true
            };
            var role = await context.RbacRoleTemplates.FirstAsync();
            var admin = new AdminUser
            {
                Id = Guid.NewGuid(),
                Name = $"AN OPS Admin {suffix}",
                Email = $"anops-{suffix}@example.test",
                PasswordHash = "test-only",
                RoleTemplateId = role.Id,
                IsActive = true
            };
            var client = new Client
            {
                Id = Guid.NewGuid(),
                Name = $"AN OPS Client {suffix}",
                Phone = $"+2012{suffix[..8]}",
                PasswordHash = "test-only",
                IsActive = true
            };
            context.AddRange(owner, project, admin, client);
            await context.SaveChangesAsync();
            OwnerId = owner.Id;
            ProjectId = project.Id;
            AdminId = admin.Id;
            ClientId = client.Id;
        }

        public ValueTask DisposeAsync() => Database.DisposeAsync();
    }

    private sealed class StubNotificationService : INotificationService
    {
        public Task<IReadOnlyList<Notification>> GetAllAsync(string? notificationStatus = null, string? channel = null, Guid? templateId = null, CancellationToken cancellationToken = default) =>
            Task.FromResult<IReadOnlyList<Notification>>(Array.Empty<Notification>());
        public Task<Notification?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) => Task.FromResult<Notification?>(null);
        public Task<Notification> CreateForAdminAsync(string templateCode, string channel, Guid adminUserId, IReadOnlyDictionary<string, string>? variables = null, DateTime? scheduledAt = null, CancellationToken cancellationToken = default) => Task.FromResult(new Notification());
        public Task<Notification> CreateForClientAsync(string templateCode, string channel, Guid clientId, IReadOnlyDictionary<string, string>? variables = null, DateTime? scheduledAt = null, CancellationToken cancellationToken = default) => Task.FromResult(new Notification());
        public Task<Notification> CreateForOwnerAsync(string templateCode, string channel, Guid ownerId, IReadOnlyDictionary<string, string>? variables = null, DateTime? scheduledAt = null, CancellationToken cancellationToken = default) => Task.FromResult(new Notification());
    }

    private sealed class StubBookingLifecycleService : IBookingLifecycleService
    {
        public Task<Booking> TransitionAsync(Guid bookingId, BookingStatus targetStatus, Guid changedByAdminUserId, string? notes, CancellationToken cancellationToken = default) => throw new NotSupportedException();
        public Task<Booking> ConfirmAsync(Guid bookingId, Guid changedByAdminUserId, string? notes, CancellationToken cancellationToken = default) => throw new NotSupportedException();
        public Task<Booking> CheckInAsync(Guid bookingId, Guid changedByAdminUserId, string? notes, CancellationToken cancellationToken = default) => throw new NotSupportedException();
        public Task<Booking> LeftEarlyAsync(Guid bookingId, Guid changedByAdminUserId, string? notes, CancellationToken cancellationToken = default) => throw new NotSupportedException();
        public Task<Booking> CancelAsync(Guid bookingId, Guid changedByAdminUserId, string? notes, CancellationToken cancellationToken = default) => throw new NotSupportedException();
        public Task<Booking> CompleteAsync(Guid bookingId, Guid changedByAdminUserId, string? notes, CancellationToken cancellationToken = default) => throw new NotSupportedException();
    }

    private sealed class StubCrmLeadService : ICrmLeadService
    {
        public Task<IReadOnlyList<CrmLead>> GetAllAsync(string? leadStatus = null, Guid? assignedAdminUserId = null, CancellationToken cancellationToken = default) => Task.FromResult<IReadOnlyList<CrmLead>>(Array.Empty<CrmLead>());
        public Task<int> GetOpenCountAsync(CancellationToken cancellationToken = default) => Task.FromResult(0);
        public Task<IReadOnlyList<CrmLead>> GetByClientIdAsync(Guid clientId, CancellationToken cancellationToken = default) => Task.FromResult<IReadOnlyList<CrmLead>>(Array.Empty<CrmLead>());
        public Task<CrmLead?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) => Task.FromResult<CrmLead?>(null);
        public Task<CrmLead> CreateAsync(Guid? clientId, Guid? targetUnitId, Guid? assignedAdminUserId, string contactName, string contactPhone, string? contactEmail, DateOnly? desiredCheckInDate, DateOnly? desiredCheckOutDate, int? guestCount, string source, string? notes, bool requirePortfolioVisibility = false, CancellationToken cancellationToken = default) => throw new NotSupportedException();
        public Task<CrmLead> CreateRecommendationRequestAsync(string contactName, string contactPhone, string? contactEmail, DateOnly? desiredCheckInDate, DateOnly? desiredCheckOutDate, int? guestCount, string? notes, CancellationToken cancellationToken = default) => throw new NotSupportedException();
        public Task<CrmLead> UpdateAsync(Guid id, Guid? clientId, Guid? targetUnitId, Guid? assignedAdminUserId, string contactName, string contactPhone, string? contactEmail, DateOnly? desiredCheckInDate, DateOnly? desiredCheckOutDate, int? guestCount, string source, string? notes, CancellationToken cancellationToken = default) => throw new NotSupportedException();
        public Task<CrmLead> SetStatusAsync(Guid id, string leadStatus, CancellationToken cancellationToken = default) => throw new NotSupportedException();
        public Task<Booking> ConvertToBookingAsync(Guid leadId, Guid clientId, Guid unitId, DateOnly checkInDate, DateOnly checkOutDate, int guestCount, Guid convertedByAdminUserId, string? internalNotes, CancellationToken cancellationToken = default) => throw new NotSupportedException();
    }

    private sealed class StubInvoiceService : IInvoiceService
    {
        public Task<PagedResult<Invoice>> GetAllAsync(string? invoiceStatus = null, Guid? bookingId = null, int page = 1, int pageSize = 20, CancellationToken cancellationToken = default) => throw new NotSupportedException();
        public Task<Invoice?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) => Task.FromResult<Invoice?>(null);
        public Task<Invoice> CreateDraftFromBookingAsync(Guid bookingId, string? invoiceNumber, string? notes, CancellationToken cancellationToken = default) => throw new NotSupportedException();
        public Task<Invoice> AddManualAdjustmentAsync(Guid invoiceId, string description, int quantity, decimal unitAmount, CancellationToken cancellationToken = default) => throw new NotSupportedException();
        public Task<Invoice> IssueAsync(Guid id, CancellationToken cancellationToken = default) => throw new NotSupportedException();
        public Task<Invoice> CancelAsync(Guid id, string? notes, CancellationToken cancellationToken = default) => throw new NotSupportedException();
        public Task<Invoice> ReissueAsync(Guid id, string? newInvoiceNumber, string? notes, CancellationToken cancellationToken = default) => throw new NotSupportedException();
        public Task<int> LinkOrphanedPaymentsAsync(CancellationToken cancellationToken = default) => Task.FromResult(0);
    }
}
