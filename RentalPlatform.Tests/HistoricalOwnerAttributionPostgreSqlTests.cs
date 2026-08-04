using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using RentalPlatform.API.DTOs.Responses.Bookings;
using RentalPlatform.API.Models;
using RentalPlatform.Business.Exceptions;
using RentalPlatform.Business.Models;
using RentalPlatform.Business.Services;
using RentalPlatform.Data;
using RentalPlatform.Data.Entities;
using RentalPlatform.Data.Exceptions;
using RentalPlatform.Shared.Constants;
using RentalPlatform.Shared.Enums;
using RentalPlatform.Tests.Infrastructure;
using Xunit;

namespace RentalPlatform.Tests;

[Collection(PostgreSqlTestCollection.Name)]
[Trait(TestCategories.Name, TestCategories.PostgreSql)]
public sealed class HistoricalOwnerAttributionPostgreSqlTests
{
    private static readonly DateTimeOffset Now =
        new(2026, 8, 2, 9, 30, 0, TimeSpan.Zero);
    private readonly PostgreSqlFixture _fixture;

    public HistoricalOwnerAttributionPostgreSqlTests(PostgreSqlFixture fixture)
    {
        _fixture = fixture;
    }

    [Fact]
    public async Task ReviewCorrectionReplayAndSuccessiveChainPreserveTruthAndSideEffects()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        SeededData seed;
        HistoricalOwnerCorrectionResult first;
        HistoricalOwnerCorrectionResult replay;
        await using (var context = database.CreateDbContext())
        {
            seed = await SeedAsync(context);
            seed.TargetB.Status = "inactive";
            await context.SaveChangesAsync();

            var service = Service(context);
            var review = await service.ReviewAsync(seed.Booking.Id);
            Assert.Equal(seed.OwnerA.Id, review.CurrentOwnerId);
            Assert.True(review.CanCorrect);
            Assert.False(review.PayoutReviewRequired);
            Assert.Empty(review.Warnings);

            var key = Guid.NewGuid();
            var command = Command(
                seed.Booking.Id, seed.OwnerA.Id, seed.TargetB.Id, seed.AdminA.Id, key,
                HistoricalOwnerCorrectionReasons.AccountingReconciliation, " Owner reviewed ");
            first = await service.CorrectAsync(command);
            replay = await service.CorrectAsync(command with
            {
                Reason = " ACCOUNTING_RECONCILIATION ",
                Note = "Owner   reviewed"
            });

            Assert.Equal(first.Correction.Id, replay.Correction.Id);
            Assert.Equal(first.HistoryEventId, replay.HistoryEventId);
            Assert.Equal(first.Correction.CorrectedAt, replay.Correction.CorrectedAt);
            Assert.Contains(HistoricalOwnerAttributionWarnings.TargetOwnerInactive, first.Warnings);
            Assert.Equal(first.Warnings, replay.Warnings);
            var initialBody = SerializeCorrectionResponse(first);
            seed.TargetB.Status = "active";
            await context.SaveChangesAsync();
            context.ChangeTracker.Clear();
            var replayAfterActivation = await service.CorrectAsync(command);
            Assert.Equal(initialBody, SerializeCorrectionResponse(replayAfterActivation));
            Assert.Contains(
                HistoricalOwnerAttributionWarnings.TargetOwnerInactive,
                replayAfterActivation.Warnings);
            var inactiveCurrentReview = await service.ReviewAsync(seed.Booking.Id);
            Assert.DoesNotContain(
                HistoricalOwnerAttributionWarnings.CurrentOwnerInactive,
                inactiveCurrentReview.Warnings);

            var reused = await Assert.ThrowsAsync<ConflictException>(() =>
                service.CorrectAsync(command with
                {
                    TargetOwnerId = seed.TargetC.Id,
                    Reason = HistoricalOwnerCorrectionReasons.OwnershipChangedAfterStay
                }));
            Assert.Equal(HistoricalErrorCodes.OwnerCorrectionIdempotencyKeyReused, reused.Code);

            var sameOwner = await Assert.ThrowsAsync<ConflictException>(() =>
                service.CorrectAsync(Command(
                    seed.Booking.Id, seed.TargetB.Id, seed.TargetB.Id,
                    seed.AdminA.Id, Guid.NewGuid())));
            Assert.Equal(HistoricalErrorCodes.OwnerCorrectionSameOwner, sameOwner.Code);

            var second = await service.CorrectAsync(Command(
                seed.Booking.Id, seed.TargetB.Id, seed.TargetC.Id,
                seed.AdminA.Id, Guid.NewGuid(),
                HistoricalOwnerCorrectionReasons.OwnershipChangedAfterStay));
            Assert.Equal(seed.TargetB.Id, second.Correction.PreviousOwnerId);
            Assert.Equal(seed.TargetC.Id, second.Correction.TargetOwnerId);

            var stale = await Assert.ThrowsAsync<ConflictException>(() =>
                service.CorrectAsync(Command(
                    seed.Booking.Id, seed.OwnerA.Id, seed.TargetB.Id,
                    seed.AdminA.Id, Guid.NewGuid())));
            Assert.Equal(HistoricalErrorCodes.OwnerCorrectionStaleAttribution, stale.Code);

            var differentBooking = await AddHistoricalBookingAsync(context, seed, seed.OwnerA.Id);
            var differentBookingReuse = await Assert.ThrowsAsync<ConflictException>(() =>
                service.CorrectAsync(command with
                {
                    BookingId = differentBooking.Id,
                    ExpectedCurrentOwnerId = seed.OwnerA.Id
                }));
            Assert.Equal(
                HistoricalErrorCodes.OwnerCorrectionIdempotencyKeyReused,
                differentBookingReuse.Code);
        }

        await using var verification = database.CreateDbContext();
        Assert.Equal(seed.TargetC.Id, await verification.Bookings.AsNoTracking()
            .Where(item => item.Id == seed.Booking.Id)
            .Select(item => item.OwnerId)
            .SingleAsync());
        var chain = await verification.HistoricalOwnerAttributionCorrections.AsNoTracking()
            .Where(item => item.BookingId == seed.Booking.Id)
            .OrderBy(item => item.CorrectedAt).ThenBy(item => item.Id)
            .ToListAsync();
        Assert.Equal(2, chain.Count);
        Assert.Equal((seed.OwnerA.Id, seed.TargetB.Id),
            (chain[0].PreviousOwnerId, chain[0].TargetOwnerId));
        Assert.Equal((seed.TargetB.Id, seed.TargetC.Id),
            (chain[1].PreviousOwnerId, chain[1].TargetOwnerId));
        Assert.Equal(2, await OwnerCorrectionHistoryCount(verification, seed.Booking.Id));
        Assert.Equal(2, await verification.HistoricalOwnerCorrectionIdempotencyKeys.CountAsync());
        await AssertNoFinancialOrRelationshipSideEffectsAsync(verification, seed);
    }

    [Fact]
    public async Task ReplayWarningSnapshotDoesNotDriftWhenTargetBecomesInactive()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        await using var context = database.CreateDbContext();
        var seed = await SeedAsync(context);
        var service = Service(context);
        var command = Command(
            seed.Booking.Id,
            seed.OwnerA.Id,
            seed.TargetB.Id,
            seed.AdminA.Id,
            Guid.NewGuid());

        var initial = await service.CorrectAsync(command);
        Assert.Empty(initial.Warnings);
        var initialBody = SerializeCorrectionResponse(initial);

        seed.TargetB.Status = "inactive";
        await context.SaveChangesAsync();
        context.ChangeTracker.Clear();

        var replay = await service.CorrectAsync(command);
        Assert.Empty(replay.Warnings);
        Assert.Equal(initialBody, SerializeCorrectionResponse(replay));
        Assert.Equal(1, await context.HistoricalOwnerAttributionCorrections
            .CountAsync(item => item.BookingId == seed.Booking.Id));
        Assert.Equal(1, await OwnerCorrectionHistoryCount(context, seed.Booking.Id));
        Assert.Equal(1, await context.HistoricalOwnerCorrectionIdempotencyKeys
            .CountAsync(item => item.CorrectionId == initial.Correction.Id));
    }

    [Fact]
    public async Task TargetEligibilityAndEveryRepositoryPayoutStateAreEnforcedWithoutMutation()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        await using var context = database.CreateDbContext();
        var seed = await SeedAsync(context);
        var service = Service(context);

        var bookingMissing = await Assert.ThrowsAsync<NotFoundException>(() => service.CorrectAsync(
            Command(Guid.NewGuid(), seed.OwnerA.Id, seed.TargetB.Id, seed.AdminA.Id, Guid.NewGuid())));
        Assert.Equal(HistoricalErrorCodes.OwnerCorrectionBookingNotFound, bookingMissing.Code);

        var missing = await Assert.ThrowsAsync<NotFoundException>(() => service.CorrectAsync(
            Command(seed.Booking.Id, seed.OwnerA.Id, Guid.NewGuid(), seed.AdminA.Id, Guid.NewGuid())));
        Assert.Equal(HistoricalErrorCodes.OwnerCorrectionTargetNotFound, missing.Code);

        seed.DeletedTarget.DeletedAt = Now.UtcDateTime;
        await context.SaveChangesAsync();
        var deleted = await Assert.ThrowsAsync<ConflictException>(() => service.CorrectAsync(
            Command(seed.Booking.Id, seed.OwnerA.Id, seed.DeletedTarget.Id, seed.AdminA.Id, Guid.NewGuid())));
        Assert.Equal(HistoricalErrorCodes.OwnerCorrectionTargetInvalid, deleted.Code);

        var nonhistorical = await AddNormalBookingAsync(context, seed);
        var bookingRequired = await Assert.ThrowsAsync<ConflictException>(() => service.CorrectAsync(
            Command(nonhistorical.Id, seed.OwnerA.Id, seed.TargetB.Id, seed.AdminA.Id, Guid.NewGuid())));
        Assert.Equal(HistoricalErrorCodes.OwnerCorrectionBookingRequired, bookingRequired.Code);

        foreach (var status in Enum.GetValues<OwnerPayoutStatus>())
        {
            var booking = await AddHistoricalBookingAsync(context, seed, seed.OwnerA.Id);
            var payout = Payout(booking, seed.OwnerA.Id, status);
            context.OwnerPayouts.Add(payout);
            await context.SaveChangesAsync();
            context.ChangeTracker.Clear();
            var before = PayoutValues(await context.OwnerPayouts.AsNoTracking()
                .SingleAsync(item => item.Id == payout.Id));

            var review = await service.ReviewAsync(booking.Id);
            Assert.False(review.CanCorrect);
            Assert.True(review.PayoutReviewRequired);
            Assert.Contains(HistoricalOwnerAttributionWarnings.PayoutReviewRequired, review.Warnings);

            var blocked = await Assert.ThrowsAsync<ConflictException>(() => service.CorrectAsync(
                Command(booking.Id, seed.OwnerA.Id, seed.TargetB.Id, seed.AdminA.Id, Guid.NewGuid())));
            Assert.Equal(HistoricalErrorCodes.OwnerCorrectionPayoutReviewRequired, blocked.Code);

            context.ChangeTracker.Clear();
            var persisted = await context.OwnerPayouts.AsNoTracking().SingleAsync(item => item.Id == payout.Id);
            Assert.Equal(before, PayoutValues(persisted));
            Assert.False(await context.HistoricalOwnerAttributionCorrections
                .AnyAsync(item => item.BookingId == booking.Id));
            Assert.Equal(0, await OwnerCorrectionHistoryCount(context, booking.Id));
        }
    }

    [Fact]
    public async Task ActiveActorCurrentTruthAndActorScopedInProgressClaimsAreEnforced()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        await using var context = database.CreateDbContext();
        var seed = await SeedAsync(context);
        var service = Service(context);

        seed.AdminA.IsActive = false;
        await context.SaveChangesAsync();
        var inactiveActor = await Assert.ThrowsAsync<UnauthorizedBusinessException>(() =>
            service.CorrectAsync(Command(
                seed.Booking.Id, seed.OwnerA.Id, seed.TargetB.Id,
                seed.AdminA.Id, Guid.NewGuid())));
        Assert.Null(inactiveActor.Code);
        Assert.False(await context.HistoricalOwnerCorrectionIdempotencyKeys.AnyAsync());

        seed.AdminA.IsActive = true;
        await context.SaveChangesAsync();
        var sharedKey = Guid.NewGuid();
        var actorACommand = Command(
            seed.Booking.Id, seed.OwnerA.Id, seed.TargetB.Id, seed.AdminA.Id, sharedKey);
        context.HistoricalOwnerCorrectionIdempotencyKeys.Add(new()
        {
            ActorAdminUserId = seed.AdminA.Id,
            Endpoint = HistoricalOwnerAttributionService.CorrectionEndpoint,
            Key = sharedKey,
            RequestHash = HistoricalOwnerCorrectionRequestHasher.Compute(actorACommand),
            CreatedAt = Now.UtcDateTime
        });
        await context.SaveChangesAsync();

        var inProgress = await Assert.ThrowsAsync<ConflictException>(() =>
            service.CorrectAsync(actorACommand));
        Assert.Equal(HistoricalErrorCodes.OwnerCorrectionRequestInProgress, inProgress.Code);

        var actorBResult = await service.CorrectAsync(actorACommand with
        {
            ActorAdminUserId = seed.AdminB.Id
        });
        Assert.Equal(seed.AdminB.Id, actorBResult.Correction.CorrectedByAdminUserId);
        Assert.Equal(2, await context.HistoricalOwnerCorrectionIdempotencyKeys
            .CountAsync(item => item.Key == sharedKey));

        context.ChangeTracker.Clear();
        var secondSeed = await SeedAsync(context);
        secondSeed.OwnerA.DeletedAt = Now.UtcDateTime;
        await context.SaveChangesAsync();
        var uncertain = await Assert.ThrowsAsync<ConflictException>(() =>
            Service(context).ReviewAsync(secondSeed.Booking.Id));
        Assert.Equal(HistoricalErrorCodes.OwnerAttributionRequiresReview, uncertain.Code);

        var correctionUncertain = await Assert.ThrowsAsync<ConflictException>(() =>
            Service(context).CorrectAsync(Command(
                secondSeed.Booking.Id,
                secondSeed.OwnerA.Id,
                secondSeed.TargetB.Id,
                secondSeed.AdminA.Id,
                Guid.NewGuid())));
        Assert.Equal(
            HistoricalErrorCodes.OwnerCorrectionCurrentAttributionRequiresReview,
            correctionUncertain.Code);
    }

    [Fact]
    [Trait(TestCategories.Name, TestCategories.Concurrency)]
    public async Task ConcurrentSameAndConflictingCorrectionsAreSerializedAcrossIndependentConnections()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();

        for (var iteration = 0; iteration < 5; iteration++)
        {
            SeededData seed;
            await using (var setup = database.CreateDbContext())
                seed = await SeedAsync(setup);

            var sharedKey = Guid.NewGuid();
            var sharedCommand = Command(
                seed.Booking.Id, seed.OwnerA.Id, seed.TargetB.Id, seed.AdminA.Id, sharedKey);
            var sameOutcomes = await RunConcurrently(
                database,
                sharedCommand,
                sharedCommand);
            Assert.All(sameOutcomes, outcome => Assert.NotNull(outcome.Result));
            Assert.Equal(
                sameOutcomes[0].Result!.Correction.Id,
                sameOutcomes[1].Result!.Correction.Id);

            await using (var sameVerification = database.CreateDbContext())
            {
                Assert.Equal(1, await sameVerification.HistoricalOwnerAttributionCorrections
                    .CountAsync(item => item.BookingId == seed.Booking.Id));
                Assert.Equal(1, await OwnerCorrectionHistoryCount(sameVerification, seed.Booking.Id));
            Assert.Equal(1, await sameVerification.HistoricalOwnerCorrectionIdempotencyKeys
                    .CountAsync(item => item.CorrectionId == sameOutcomes[0].Result!.Correction.Id));
            }

            await using (var setup = database.CreateDbContext())
                seed = await SeedAsync(setup);
            var conflicting = await RunConcurrently(
                database,
                Command(seed.Booking.Id, seed.OwnerA.Id, seed.TargetB.Id, seed.AdminA.Id, Guid.NewGuid()),
                Command(seed.Booking.Id, seed.OwnerA.Id, seed.TargetC.Id, seed.AdminB.Id, Guid.NewGuid()));
            Assert.Single(conflicting, outcome => outcome.Result is not null);
            var loser = Assert.Single(conflicting, outcome => outcome.Error is not null);
            Assert.Equal(HistoricalErrorCodes.OwnerCorrectionStaleAttribution, loser.Error!.Code);

            await using var verification = database.CreateDbContext();
            Assert.Equal(1, await verification.HistoricalOwnerAttributionCorrections
                .CountAsync(item => item.BookingId == seed.Booking.Id));
            Assert.Equal(1, await OwnerCorrectionHistoryCount(verification, seed.Booking.Id));
            Assert.Equal(1, await verification.HistoricalOwnerCorrectionIdempotencyKeys
                .CountAsync(item => item.Correction != null && item.Correction.BookingId == seed.Booking.Id));
        }
    }

    [Fact]
    [Trait(TestCategories.Name, TestCategories.Concurrency)]
    public async Task PayoutWriterWaitsForOwnerCorrectionAdvisoryLock()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        SeededData seed;
        await using (var setup = database.CreateDbContext())
            seed = await SeedAsync(setup);

        await using var lockConnection = await database.OpenConnectionAsync();
        await using var lockTransaction = await lockConnection.BeginTransactionAsync();
        await using (var lockCommand = new NpgsqlCommand(
            "SELECT pg_advisory_xact_lock(hashtextextended(@key, 0))",
            lockConnection,
            lockTransaction))
        {
            lockCommand.Parameters.AddWithValue(
                "key",
                HistoricalOwnerCorrectionLocks.ForBooking(seed.Booking.Id));
            await lockCommand.ExecuteNonQueryAsync();
        }

        const string applicationName = "HB05 payout lock probe";
        var connectionString = new NpgsqlConnectionStringBuilder(database.ConnectionString)
        {
            ApplicationName = applicationName
        }.ConnectionString;
        var payoutTask = Task.Run(async () =>
        {
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseNpgsql(connectionString)
                .Options;
            await using var payoutContext = new AppDbContext(options);
            return await new OwnerPayoutService(new UnitOfWork(payoutContext))
                .CreateOrUpdateFromBookingAsync(
                    seed.Booking.Id,
                    10m,
                    null,
                    "HB05 lock compatibility");
        });

        await AssertEventuallyAsync(async () =>
        {
            await using var inspection = await database.OpenConnectionAsync();
            await using var command = new NpgsqlCommand(
                """
                SELECT EXISTS (
                    SELECT 1
                    FROM pg_locks lock
                    JOIN pg_stat_activity activity ON activity.pid = lock.pid
                    WHERE activity.application_name = @application_name
                      AND lock.locktype = 'advisory'
                      AND NOT lock.granted)
                """,
                inspection);
            command.Parameters.AddWithValue("application_name", applicationName);
            return Convert.ToBoolean(await command.ExecuteScalarAsync());
        });
        Assert.False(payoutTask.IsCompleted);

        await lockTransaction.CommitAsync();
        var payout = await payoutTask.WaitAsync(TimeSpan.FromSeconds(10));
        Assert.Equal(seed.Booking.Id, payout.BookingId);
        await using var verification = database.CreateDbContext();
        Assert.Equal(1, await verification.OwnerPayouts
            .CountAsync(item => item.BookingId == seed.Booking.Id));
    }

    [Fact]
    [Trait(TestCategories.Name, TestCategories.Concurrency)]
    public async Task CorrectionNeverCrossesAnAuthoritativePayoutRace()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();

        for (var iteration = 0; iteration < 5; iteration++)
        {
            SeededData seed;
            await using (var setup = database.CreateDbContext())
                seed = await SeedAsync(setup);

            var gate = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
            var payoutTask = Task.Run(async () =>
            {
                await using var payoutContext = database.CreateDbContext();
                await gate.Task;
                return await new OwnerPayoutService(new UnitOfWork(payoutContext))
                    .CreateOrUpdateFromBookingAsync(
                        seed.Booking.Id,
                        10m,
                        null,
                        "HB05 lock compatibility");
            });

            var correctionTask = Task.Run(async () =>
            {
                await using var correctionContext = database.CreateDbContext();
                await gate.Task;
                try
                {
                    return new Outcome(await Service(correctionContext).CorrectAsync(Command(
                        seed.Booking.Id, seed.OwnerA.Id, seed.TargetB.Id,
                        seed.AdminA.Id, Guid.NewGuid())), null);
                }
                catch (ConflictException error)
                {
                    return new Outcome(null, error);
                }
            });

            gate.SetResult();

            var payout = await payoutTask.WaitAsync(TimeSpan.FromSeconds(10));
            var outcome = await correctionTask.WaitAsync(TimeSpan.FromSeconds(10));

            await using var verification = database.CreateDbContext();
            var persistedOwnerId = await verification.Bookings.AsNoTracking()
                .Where(item => item.Id == seed.Booking.Id)
                .Select(item => item.OwnerId)
                .SingleAsync();
            Assert.Equal(1, await verification.OwnerPayouts.CountAsync(item => item.BookingId == seed.Booking.Id));
            if (outcome.Result is null)
            {
                Assert.Equal(HistoricalErrorCodes.OwnerCorrectionPayoutReviewRequired, outcome.Error!.Code);
                Assert.Equal(seed.OwnerA.Id, persistedOwnerId);
                Assert.Equal(seed.OwnerA.Id, payout.OwnerId);
                Assert.False(await verification.HistoricalOwnerAttributionCorrections
                    .AnyAsync(item => item.BookingId == seed.Booking.Id));
                Assert.False(await verification.HistoricalOwnerCorrectionIdempotencyKeys
                    .AnyAsync(item => item.Correction != null && item.Correction.BookingId == seed.Booking.Id));
            }
            else
            {
                Assert.Null(outcome.Error);
                Assert.Equal(seed.TargetB.Id, persistedOwnerId);
                Assert.Equal(seed.TargetB.Id, payout.OwnerId);
                Assert.Equal(1, await verification.HistoricalOwnerAttributionCorrections
                    .CountAsync(item => item.BookingId == seed.Booking.Id));
            }
        }
    }

    [Fact]
    public async Task CorrectionAuditRejectsApplicationAndDatabaseUpdateDeleteAndTruncate()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        Guid correctionId;
        await using (var context = database.CreateDbContext())
        {
            var seed = await SeedAsync(context);
            var result = await Service(context).CorrectAsync(Command(
                seed.Booking.Id, seed.OwnerA.Id, seed.TargetB.Id,
                seed.AdminA.Id, Guid.NewGuid()));
            correctionId = result.Correction.Id;

            result.Correction.Note = "mutated";
            context.ChangeTracker.Clear();
            context.HistoricalOwnerAttributionCorrections.Update(result.Correction);
            var applicationGuard = await Assert.ThrowsAsync<HistoricalOwnerCorrectionAuditImmutableException>(
                () => context.SaveChangesAsync());
            Assert.Equal(HistoricalErrorCodes.OwnerCorrectionAuditImmutable, applicationGuard.Code);

            context.ChangeTracker.Clear();
            var toDelete = await context.HistoricalOwnerAttributionCorrections
                .SingleAsync(item => item.Id == correctionId);
            context.HistoricalOwnerAttributionCorrections.Remove(toDelete);
            var applicationDeleteGuard =
                await Assert.ThrowsAsync<HistoricalOwnerCorrectionAuditImmutableException>(
                    () => context.SaveChangesAsync());
            Assert.Equal(
                HistoricalErrorCodes.OwnerCorrectionAuditImmutable,
                applicationDeleteGuard.Code);
        }

        await using var connection = await database.OpenConnectionAsync();
        foreach (var sql in new[]
        {
            "UPDATE historical_owner_attribution_corrections SET note = 'mutated' WHERE id = @id",
            "DELETE FROM historical_owner_attribution_corrections WHERE id = @id"
        })
        {
            await using var command = new NpgsqlCommand(sql, connection);
            command.Parameters.AddWithValue("id", correctionId);
            var databaseGuard = await Assert.ThrowsAsync<PostgresException>(() => command.ExecuteNonQueryAsync());
            Assert.Equal("ck_historical_owner_corrections_immutable", databaseGuard.ConstraintName);
        }

        await ExecuteAsync(
            connection,
            $"DELETE FROM historical_owner_correction_idempotency_keys WHERE correction_id = '{correctionId}'");
        await using (var truncate = new NpgsqlCommand(
            "TRUNCATE TABLE historical_owner_correction_idempotency_keys, " +
            "historical_owner_attribution_corrections",
            connection))
        {
            var truncateGuard = await Assert.ThrowsAsync<PostgresException>(
                () => truncate.ExecuteNonQueryAsync());
            Assert.Equal("ck_historical_owner_corrections_immutable", truncateGuard.ConstraintName);
        }
        Assert.Equal(1L, Convert.ToInt64(await ScalarAsync(connection,
            "SELECT count(*) FROM historical_owner_attribution_corrections")));
    }

    [Fact]
    public async Task Migration0062PreflightVerifierRetryAndRollbackGuardsAreExecutable()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        var migration = await MigrationSql("0062_add_historical_owner_attribution_corrections.sql");
        var verifier = await MigrationSql("0062_add_historical_owner_attribution_corrections_verify.sql");
        var rollback = await MigrationSql("0062_add_historical_owner_attribution_corrections_rollback.sql");

        await using (var connection = await database.OpenConnectionAsync())
        {
            await ExecuteAsync(connection, verifier);
            await ExecuteAsync(connection, """
                CREATE TABLE IF NOT EXISTS schema_migrations (
                    migration_number VARCHAR(20) PRIMARY KEY,
                    migration_name VARCHAR(255) NOT NULL,
                    applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
                );
                INSERT INTO schema_migrations (migration_number, migration_name)
                VALUES ('0062', '0062_add_historical_owner_attribution_corrections.sql')
                ON CONFLICT (migration_number) DO NOTHING;
                """);
            await ExecuteAsync(connection, rollback);
            Assert.False(Convert.ToBoolean(await ScalarAsync(connection,
                "SELECT to_regclass('public.historical_owner_attribution_corrections') IS NOT NULL")));
            Assert.Equal(0L, Convert.ToInt64(await ScalarAsync(connection,
                "SELECT count(*) FROM schema_migrations WHERE migration_number = '0062'")));
        }

        SeededData seed;
        await using (var context = database.CreateDbContext())
            seed = await SeedAsync(context);
        await using (var connection = await database.OpenConnectionAsync())
        {
            await ExecuteAsync(connection,
                $"UPDATE admin_users SET updated_at = TIMESTAMPTZ '2000-01-01 00:00:00+00' WHERE id = '{seed.AdminA.Id}'");
            await ExecuteAsync(connection, "ALTER TABLE bookings DROP CONSTRAINT ck_bookings_historical_fields_coherent");
            await ExecuteAsync(connection,
                $"UPDATE bookings SET actual_booked_at = NULL WHERE id = '{seed.Booking.Id}'");
            var refused = await Assert.ThrowsAsync<PostgresException>(() => ExecuteAsync(connection, migration));
            Assert.Contains("Migration 0062 refused", refused.MessageText, StringComparison.Ordinal);
            await ExecuteAsync(connection, "ROLLBACK");
            Assert.False(Convert.ToBoolean(await ScalarAsync(connection,
                "SELECT to_regclass('public.historical_owner_attribution_corrections') IS NOT NULL")));
            await ExecuteAsync(connection,
                $"UPDATE bookings SET actual_booked_at = DATE '2026-07-01' WHERE id = '{seed.Booking.Id}'");
            await ExecuteAsync(connection, migration);
            await ExecuteAsync(connection, verifier);
            Assert.Equal(1L, Convert.ToInt64(await ScalarAsync(connection, """
                SELECT count(*)
                FROM rbac_role_template_permissions
                WHERE permission_key = 'bookings:correct_owner_attribution'
                  AND role_template_id = '10000000-0000-0000-0000-000000000001'
                """)));
            Assert.Equal(1L, Convert.ToInt64(await ScalarAsync(connection, """
                SELECT count(*)
                FROM rbac_role_template_permissions
                WHERE permission_key = 'bookings:correct_owner_attribution'
                """)));
            Assert.True(Convert.ToDateTime(await ScalarAsync(connection,
                $"SELECT updated_at FROM admin_users WHERE id = '{seed.AdminA.Id}'")) >
                new DateTime(2000, 1, 1));
            Assert.Equal(seed.OwnerA.Id, (Guid)(await ScalarAsync(connection,
                $"SELECT owner_id FROM bookings WHERE id = '{seed.Booking.Id}'"))!);
            Assert.Equal(0L, Convert.ToInt64(await ScalarAsync(connection,
                "SELECT count(*) FROM historical_owner_attribution_corrections")));

            await AssertVerifierRejectsAsync(connection, verifier,
                "DELETE FROM rbac_role_template_permissions WHERE permission_key = 'bookings:correct_owner_attribution'",
                """
                INSERT INTO rbac_role_template_permissions (role_template_id, permission_key, created_at)
                VALUES ('10000000-0000-0000-0000-000000000001',
                        'bookings:correct_owner_attribution', CURRENT_TIMESTAMP)
                """);
            await AssertVerifierRejectsAsync(connection, verifier,
                "UPDATE rbac_role_template_permissions SET permission_key = 'bookings:correct_owner_attributon' WHERE permission_key = 'bookings:correct_owner_attribution'",
                "UPDATE rbac_role_template_permissions SET permission_key = 'bookings:correct_owner_attribution' WHERE permission_key = 'bookings:correct_owner_attributon'");

            var otherRoleId = (Guid)(await ScalarAsync(connection, """
                SELECT id FROM rbac_role_templates
                WHERE id <> '10000000-0000-0000-0000-000000000001'
                ORDER BY id LIMIT 1
                """))!;
            await AssertVerifierRejectsAsync(connection, verifier,
                $"INSERT INTO rbac_role_template_permissions (role_template_id, permission_key, created_at) VALUES ('{otherRoleId}', 'bookings:correct_owner_attribution', CURRENT_TIMESTAMP)",
                $"DELETE FROM rbac_role_template_permissions WHERE role_template_id = '{otherRoleId}' AND permission_key = 'bookings:correct_owner_attribution'");

            await AssertVerifierRejectsAsync(connection, verifier,
                """
                ALTER TABLE historical_owner_correction_idempotency_keys
                    DROP CONSTRAINT pk_historical_owner_correction_idempotency_keys,
                    ADD CONSTRAINT pk_historical_owner_correction_idempotency_keys
                    PRIMARY KEY (key, endpoint, actor_admin_user_id)
                """,
                """
                ALTER TABLE historical_owner_correction_idempotency_keys
                    DROP CONSTRAINT pk_historical_owner_correction_idempotency_keys,
                    ADD CONSTRAINT pk_historical_owner_correction_idempotency_keys
                    PRIMARY KEY (actor_admin_user_id, endpoint, key)
                """);

            await AssertVerifierRejectsAsync(connection, verifier,
                """
                ALTER TABLE historical_owner_correction_idempotency_keys
                    DROP CONSTRAINT ck_historical_owner_correction_idempotency_warnings,
                    ADD CONSTRAINT ck_historical_owner_correction_idempotency_warnings CHECK (TRUE)
                """,
                """
                ALTER TABLE historical_owner_correction_idempotency_keys
                    DROP CONSTRAINT ck_historical_owner_correction_idempotency_warnings,
                    ADD CONSTRAINT ck_historical_owner_correction_idempotency_warnings CHECK (
                        array_position(response_warning_codes, NULL) IS NULL
                        AND response_warning_codes <@ ARRAY['TARGET_OWNER_INACTIVE']::TEXT[]
                        AND cardinality(response_warning_codes) <= 1)
                """);

            await AssertVerifierRejectsAsync(connection, verifier,
                "ALTER TABLE historical_owner_attribution_corrections DISABLE TRIGGER trg_historical_owner_corrections_immutable",
                "ALTER TABLE historical_owner_attribution_corrections ENABLE TRIGGER trg_historical_owner_corrections_immutable");
            await AssertVerifierRejectsAsync(connection, verifier,
                "ALTER TABLE historical_owner_attribution_corrections DISABLE TRIGGER trg_historical_owner_corrections_immutable_truncate",
                "ALTER TABLE historical_owner_attribution_corrections ENABLE TRIGGER trg_historical_owner_corrections_immutable_truncate");
            await AssertVerifierRejectsAsync(connection, verifier,
                """
                CREATE OR REPLACE FUNCTION reject_historical_owner_correction_mutation()
                RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NULL; END; $$
                """,
                """
                CREATE OR REPLACE FUNCTION reject_historical_owner_correction_mutation()
                RETURNS trigger LANGUAGE plpgsql AS $$
                BEGIN
                    RAISE EXCEPTION USING
                        ERRCODE = '23514',
                        CONSTRAINT = 'ck_historical_owner_corrections_immutable',
                        MESSAGE = 'Historical owner-attribution correction audit is immutable';
                END;
                $$
                """);
        }

        await using (var context = database.CreateDbContext())
            await Service(context).CorrectAsync(Command(
                seed.Booking.Id, seed.OwnerA.Id, seed.TargetB.Id,
                seed.AdminA.Id, Guid.NewGuid()));
        await using (var connection = await database.OpenConnectionAsync())
        {
            var guarded = await Assert.ThrowsAsync<PostgresException>(() => ExecuteAsync(connection, rollback));
            Assert.Contains("rollback refused", guarded.MessageText, StringComparison.OrdinalIgnoreCase);
            await ExecuteAsync(connection, "ROLLBACK");
            await ExecuteAsync(connection, verifier);
        }
    }

    [Fact]
    public async Task RollbackRefusesIdempotencyAuditAndCleanReapplyRestoresOwnedObjects()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        var migration = await MigrationSql("0062_add_historical_owner_attribution_corrections.sql");
        var verifier = await MigrationSql("0062_add_historical_owner_attribution_corrections_verify.sql");
        var rollback = await MigrationSql("0062_add_historical_owner_attribution_corrections_rollback.sql");

        SeededData seed;
        await using (var context = database.CreateDbContext())
        {
            seed = await SeedAsync(context);
            context.HistoricalOwnerCorrectionIdempotencyKeys.Add(new()
            {
                ActorAdminUserId = seed.AdminA.Id,
                Endpoint = HistoricalOwnerAttributionService.CorrectionEndpoint,
                Key = Guid.NewGuid(),
                RequestHash = new string('a', 64),
                CreatedAt = Now.UtcDateTime
            });
            await context.SaveChangesAsync();
        }

        await using var connection = await database.OpenConnectionAsync();
        var refused = await Assert.ThrowsAsync<PostgresException>(() => ExecuteAsync(connection, rollback));
        Assert.Contains("rollback refused", refused.MessageText, StringComparison.OrdinalIgnoreCase);
        await ExecuteAsync(connection, "ROLLBACK");
        await ExecuteAsync(connection, verifier);

        await ExecuteAsync(connection, "DELETE FROM historical_owner_correction_idempotency_keys");
        await ExecuteAsync(connection, """
            CREATE TABLE IF NOT EXISTS schema_migrations (
                migration_number VARCHAR(20) PRIMARY KEY,
                migration_name VARCHAR(255) NOT NULL,
                applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            INSERT INTO schema_migrations (migration_number, migration_name)
            VALUES ('0062', '0062_add_historical_owner_attribution_corrections.sql')
            ON CONFLICT (migration_number) DO NOTHING;
            """);
        await ExecuteAsync(connection, rollback);
        Assert.Equal(0L, Convert.ToInt64(await ScalarAsync(connection,
            "SELECT count(*) FROM schema_migrations WHERE migration_number = '0062'")));
        await ExecuteAsync(connection, migration);
        await ExecuteAsync(connection, verifier);
        Assert.True(Convert.ToBoolean(await ScalarAsync(connection,
            "SELECT to_regclass('public.historical_owner_attribution_corrections') IS NOT NULL")));
        Assert.True(Convert.ToBoolean(await ScalarAsync(connection, """
            SELECT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'historical_owner_correction_idempotency_keys'
                  AND column_name = 'response_warning_codes')
            """)));
    }

    [Fact]
    public async Task IdempotencyWarningSnapshotRejectsUnknownDuplicateNullAndIncompleteValues()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        SeededData seed;
        await using (var context = database.CreateDbContext())
            seed = await SeedAsync(context);
        await using var connection = await database.OpenConnectionAsync();

        foreach (var warnings in new[]
        {
            "ARRAY['UNKNOWN_WARNING']::TEXT[]",
            "ARRAY['TARGET_OWNER_INACTIVE', 'TARGET_OWNER_INACTIVE']::TEXT[]",
            "ARRAY['TARGET_OWNER_INACTIVE', NULL]::TEXT[]",
            "ARRAY['TARGET_OWNER_INACTIVE']::TEXT[]"
        })
        {
            var key = Guid.NewGuid();
            var insert = $"""
                INSERT INTO historical_owner_correction_idempotency_keys (
                    actor_admin_user_id, endpoint, key, request_hash,
                    response_warning_codes, created_at)
                VALUES (
                    '{seed.AdminA.Id}',
                    '{HistoricalOwnerAttributionService.CorrectionEndpoint}',
                    '{key}', '{new string('a', 64)}', {warnings}, CURRENT_TIMESTAMP)
                """;
            var rejected = await Assert.ThrowsAsync<PostgresException>(
                () => ExecuteAsync(connection, insert));
            Assert.Contains(
                rejected.ConstraintName,
                new[]
                {
                    "ck_historical_owner_correction_idempotency_warnings",
                    "ck_historical_owner_correction_idempotency_completion"
                });
        }

        Assert.Equal(0L, Convert.ToInt64(await ScalarAsync(connection,
            "SELECT count(*) FROM historical_owner_correction_idempotency_keys")));
    }

    private static HistoricalOwnerAttributionService Service(AppDbContext context) =>
        new(new UnitOfWork(context), new FixedTimeProvider());

    private static string SerializeCorrectionResponse(HistoricalOwnerCorrectionResult result) =>
        JsonSerializer.Serialize(ApiResponse<HistoricalOwnerAttributionCorrectionResponse>.CreateSuccess(new()
        {
            CorrectionId = result.Correction.Id,
            BookingId = result.Correction.BookingId,
            PreviousOwnerId = result.Correction.PreviousOwnerId,
            TargetOwnerId = result.Correction.TargetOwnerId,
            CorrectedByAdminUserId = result.Correction.CorrectedByAdminUserId,
            Reason = result.Correction.Reason,
            Note = result.Correction.Note,
            CorrectedAt = result.Correction.CorrectedAt,
            HistoryEventId = result.HistoryEventId,
            Warnings = result.Warnings
        }), new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });

    private static async Task AssertEventuallyAsync(Func<Task<bool>> condition)
    {
        var deadline = DateTime.UtcNow.AddSeconds(10);
        while (DateTime.UtcNow < deadline)
        {
            if (await condition())
                return;
            await Task.Delay(25);
        }
        throw new Xunit.Sdk.XunitException("Expected PostgreSQL lock state was not observed.");
    }

    private static CorrectHistoricalOwnerAttributionCommand Command(
        Guid bookingId,
        Guid expectedOwnerId,
        Guid targetOwnerId,
        Guid actorId,
        Guid key,
        string reason = HistoricalOwnerCorrectionReasons.AccountingReconciliation,
        string? note = null) =>
        new(bookingId, expectedOwnerId, targetOwnerId, reason, note, actorId, key);

    private static async Task<Outcome[]> RunConcurrently(
        PostgreSqlTestDatabase database,
        CorrectHistoricalOwnerAttributionCommand first,
        CorrectHistoricalOwnerAttributionCommand second)
    {
        var gate = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        async Task<Outcome> Run(CorrectHistoricalOwnerAttributionCommand command)
        {
            await using var context = database.CreateDbContext();
            await gate.Task;
            try
            {
                return new Outcome(await Service(context).CorrectAsync(command), null);
            }
            catch (ConflictException error)
            {
                return new Outcome(null, error);
            }
        }

        var tasks = new[] { Task.Run(() => Run(first)), Task.Run(() => Run(second)) };
        gate.SetResult();
        return await Task.WhenAll(tasks);
    }

    private static async Task<SeededData> SeedAsync(AppDbContext context)
    {
        var suffix = Guid.NewGuid().ToString("N");
        var ownerA = Owner("A", "active");
        var targetB = Owner("B", "active");
        var targetC = Owner("C", "active");
        var deletedTarget = Owner("D", "active");
        var project = new Project
        {
            Id = Guid.NewGuid(), Name = $"HB05 project {suffix}", IsActive = true
        };
        var client = new Client
        {
            Id = Guid.NewGuid(), Name = "HB05 client", Phone = TestPhone("25"),
            PasswordHash = "test-only-hash", IsActive = true
        };
        var adminA = Admin($"hb05-a-{suffix}@example.test");
        var adminB = Admin($"hb05-b-{suffix}@example.test");
        var unit = new Unit
        {
            Id = Guid.NewGuid(), OwnerId = ownerA.Id, ProjectId = project.Id,
            Name = $"HB05 unit {suffix}", UnitType = "apartment",
            Bedrooms = 2, Bathrooms = 1, MaxGuests = 4, BasePricePerNight = 100m,
            IsActive = true, IsVisibleInPortfolio = true
        };
        context.AddRange(ownerA, targetB, targetC, deletedTarget, project, client, adminA, adminB, unit);
        await context.SaveChangesAsync();
        var seed = new SeededData(
            ownerA, targetB, targetC, deletedTarget, client, adminA, adminB, unit, null!);
        var booking = await AddHistoricalBookingAsync(context, seed, ownerA.Id);
        return seed with { Booking = booking };
    }

    private static Owner Owner(string label, string status) => new()
    {
        Id = Guid.NewGuid(), Name = $"HB05 owner {label}",
        Phone = TestPhone("20"), EmergencyPhone = TestPhone("21"),
        CommissionRate = 10m, Status = status, PasswordHash = "test-only-hash"
    };

    private static AdminUser Admin(string email) => new()
    {
        Id = Guid.NewGuid(), Name = "HB05 admin", Email = email,
        PasswordHash = "test-only-hash",
        RoleTemplateId = Guid.Parse("10000000-0000-0000-0000-000000000001"),
        IsActive = true
    };

    private static async Task<Booking> AddHistoricalBookingAsync(
        AppDbContext context,
        SeededData seed,
        Guid ownerId)
    {
        var booking = new Booking
        {
            Id = Guid.NewGuid(), ClientId = seed.Client.Id, UnitId = seed.Unit.Id,
            OwnerId = ownerId, BookingStatus = BookingStatus.Completed,
            CheckInDate = new DateOnly(2026, 7, 10), CheckOutDate = new DateOnly(2026, 7, 12),
            GuestCount = 2, BaseAmount = 100m, FinalAmount = 100m, AgreedAmount = 100m,
            Source = "admin", IsHistorical = true, ActualBookedAt = new DateOnly(2026, 7, 1),
            HistoricalEntryReason = HistoricalEntryReasons.AccountingReconciliation,
            OriginalSource = "legacy_system"
        };
        context.Bookings.Add(booking);
        await context.SaveChangesAsync();
        return booking;
    }

    private static async Task<Booking> AddNormalBookingAsync(AppDbContext context, SeededData seed)
    {
        var booking = new Booking
        {
            Id = Guid.NewGuid(), ClientId = seed.Client.Id, UnitId = seed.Unit.Id,
            OwnerId = seed.OwnerA.Id, BookingStatus = BookingStatus.Booked,
            CheckInDate = new DateOnly(2026, 10, 10), CheckOutDate = new DateOnly(2026, 10, 12),
            GuestCount = 2, BaseAmount = 100m, FinalAmount = 100m,
            Source = "admin", IsHistorical = false
        };
        context.Bookings.Add(booking);
        await context.SaveChangesAsync();
        return booking;
    }

    private static OwnerPayout Payout(Booking booking, Guid ownerId, OwnerPayoutStatus status) => new()
    {
        Id = Guid.NewGuid(), BookingId = booking.Id, OwnerId = ownerId,
        PayoutStatus = status, GrossBookingAmount = booking.FinalAmount,
        CommissionRate = 10m, CommissionAmount = 10m, PayoutAmount = 90m,
        ScheduledAt = status is OwnerPayoutStatus.Scheduled or OwnerPayoutStatus.Paid ? Now.UtcDateTime : null,
        PaidAt = status == OwnerPayoutStatus.Paid ? Now.UtcDateTime : null,
        Notes = "test state"
    };

    private static object?[] PayoutValues(OwnerPayout payout) =>
    [
        payout.Id, payout.BookingId, payout.OwnerId, payout.PayoutStatus,
        payout.GrossBookingAmount, payout.CommissionRate, payout.CommissionAmount,
        payout.PayoutAmount, payout.ScheduledAt, payout.PaidAt,
        payout.ProofOfPaymentUrl, payout.Notes, payout.CreatedAt, payout.UpdatedAt
    ];

    private static async Task AssertNoFinancialOrRelationshipSideEffectsAsync(
        AppDbContext context,
        SeededData seed)
    {
        var booking = await context.Bookings.AsNoTracking().SingleAsync(item => item.Id == seed.Booking.Id);
        Assert.Equal(100m, booking.AgreedAmount);
        Assert.Equal(100m, booking.BaseAmount);
        Assert.Equal(100m, booking.FinalAmount);
        Assert.Equal(BookingStatus.Completed, booking.BookingStatus);
        Assert.Equal(seed.Booking.CheckInDate, booking.CheckInDate);
        Assert.Equal(seed.Booking.CheckOutDate, booking.CheckOutDate);
        Assert.Equal("admin", booking.Source);
        Assert.Equal(seed.OwnerA.Id, await context.Units.AsNoTracking()
            .Where(item => item.Id == seed.Unit.Id).Select(item => item.OwnerId).SingleAsync());
        Assert.Equal(0, await context.Payments.CountAsync(item => item.BookingId == seed.Booking.Id));
        Assert.Equal(0, await context.Invoices.CountAsync(item => item.BookingId == seed.Booking.Id));
        Assert.Equal(0, await context.OwnerPayouts.CountAsync(item => item.BookingId == seed.Booking.Id));
        Assert.Equal(0, await context.Notifications.CountAsync());
        Assert.Equal(0, await context.NotificationDeliveryLogs.CountAsync());
        Assert.Equal(0, await context.CrmLeads.CountAsync());
        Assert.Equal(0, await context.CrmNotes.CountAsync());
        Assert.Equal(0, await context.CrmAssignments.CountAsync());
    }

    private static Task<int> OwnerCorrectionHistoryCount(AppDbContext context, Guid bookingId) =>
        context.BookingStatusHistories.CountAsync(item =>
            item.BookingId == bookingId &&
            item.Notes != null &&
            item.Notes.StartsWith(BookingHistoryEvents.HistoricalOwnerAttributionCorrected));

    private static string TestPhone(string prefix)
    {
        var value = BitConverter.ToUInt32(Guid.NewGuid().ToByteArray(), 0) % 10_000_000_000L;
        return $"+{prefix}{value:D10}";
    }

    private static async Task<string> MigrationSql(string fileName) =>
        await File.ReadAllTextAsync(Path.Combine(RepositoryRoot(), "db", "migrations", fileName));

    private static async Task ExecuteAsync(NpgsqlConnection connection, string sql)
    {
        await using var command = new NpgsqlCommand(sql, connection) { CommandTimeout = 120 };
        await command.ExecuteNonQueryAsync();
    }

    private static async Task<object?> ScalarAsync(NpgsqlConnection connection, string sql)
    {
        await using var command = new NpgsqlCommand(sql, connection) { CommandTimeout = 120 };
        return await command.ExecuteScalarAsync();
    }

    private static async Task AssertVerifierRejectsAsync(
        NpgsqlConnection connection,
        string verifier,
        string damageSql,
        string repairSql)
    {
        await ExecuteAsync(connection, damageSql);
        await Assert.ThrowsAsync<PostgresException>(() => ExecuteAsync(connection, verifier));
        await ExecuteAsync(connection, repairSql);
        await ExecuteAsync(connection, verifier);
    }

    private static string RepositoryRoot()
    {
        for (var directory = new DirectoryInfo(Directory.GetCurrentDirectory());
             directory is not null;
             directory = directory.Parent)
        {
            if (File.Exists(Path.Combine(directory.FullName, "RentalPlatform.slnx")))
                return directory.FullName;
        }
        throw new DirectoryNotFoundException("Repository root not found.");
    }

    private sealed record SeededData(
        Owner OwnerA,
        Owner TargetB,
        Owner TargetC,
        Owner DeletedTarget,
        Client Client,
        AdminUser AdminA,
        AdminUser AdminB,
        Unit Unit,
        Booking Booking);

    private sealed record Outcome(HistoricalOwnerCorrectionResult? Result, ConflictException? Error);

    private sealed class FixedTimeProvider : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => Now;
    }
}
