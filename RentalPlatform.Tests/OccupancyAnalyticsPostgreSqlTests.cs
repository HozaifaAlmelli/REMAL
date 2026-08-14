using Microsoft.EntityFrameworkCore;
using Npgsql;
using NpgsqlTypes;
using RentalPlatform.Business.Exceptions;
using RentalPlatform.Business.Models;
using RentalPlatform.Business.Services;
using RentalPlatform.Business.Time;
using RentalPlatform.Data.Entities;
using RentalPlatform.Shared.Constants;
using RentalPlatform.Shared.Enums;
using RentalPlatform.Tests.Infrastructure;
using Xunit;

namespace RentalPlatform.Tests;

[Collection(PostgreSqlTestCollection.Name)]
[Trait(TestCategories.Name, TestCategories.PostgreSql)]
public sealed class OccupancyAnalyticsPostgreSqlTests
{
    private static readonly DateOnly Epoch = new(2026, 8, 1);
    private static readonly DateOnly Today = new(2026, 8, 14);
    private readonly PostgreSqlFixture _fixture;

    public OccupancyAnalyticsPostgreSqlTests(PostgreSqlFixture fixture)
    {
        _fixture = fixture;
    }

    [Theory]
    [InlineData(1, 1, 10, 10)]
    [InlineData(5, 5, 10, 50)]
    public async Task StayLengthDrivesOccupiedUnitNights(
        int stayNights,
        long expectedOccupied,
        long expectedAvailable,
        decimal expectedRate)
    {
        await using var scope = await TestScope.CreateAsync(_fixture);
        var unit = await scope.AddUnitAsync(Epoch);
        await scope.AddPeriodAsync(unit.Id, Epoch, null, true);
        await scope.AddBookingAsync(unit.Id, BookingStatus.Confirmed, Epoch, Epoch.AddDays(stayNights));
        await scope.PublishAsync();

        var result = await scope.QueryAsync(Epoch, Epoch.AddDays(10));

        AssertAvailable(result, expectedOccupied, expectedAvailable, expectedRate);
    }

    [Fact]
    public async Task MultipleUnitsUsePhysicalUnitNightDenominator()
    {
        await using var scope = await TestScope.CreateAsync(_fixture);
        var first = await scope.AddUnitAsync(Epoch);
        var second = await scope.AddUnitAsync(Epoch);
        await scope.AddPeriodAsync(first.Id, Epoch, null, true);
        await scope.AddPeriodAsync(second.Id, Epoch, null, true);
        await scope.AddBookingAsync(first.Id, BookingStatus.Booked, Epoch, Epoch.AddDays(5));
        await scope.PublishAsync();

        AssertAvailable(await scope.QueryAsync(Epoch, Epoch.AddDays(10)), 5, 20, 25m);
    }

    [Fact]
    public async Task NonOverlappingStaysCanFillEveryPhysicalNight()
    {
        await using var scope = await TestScope.CreateAsync(_fixture);
        var unit = await scope.AddUnitAsync(Epoch);
        await scope.AddPeriodAsync(unit.Id, Epoch, null, true);
        await scope.AddBookingAsync(unit.Id, BookingStatus.Completed, Epoch, Epoch.AddDays(5));
        await scope.AddBookingAsync(unit.Id, BookingStatus.LeftEarly, Epoch.AddDays(5), Epoch.AddDays(10));
        await scope.PublishAsync();

        AssertAvailable(await scope.QueryAsync(Epoch, Epoch.AddDays(10)), 10, 10, 100m);
    }

    [Fact]
    public async Task StayOverlapIsClippedAndCheckoutNightIsExcluded()
    {
        await using var scope = await TestScope.CreateAsync(_fixture);
        var unit = await scope.AddUnitAsync(Epoch);
        await scope.AddPeriodAsync(unit.Id, Epoch, null, true);
        await scope.AddBookingAsync(
            unit.Id,
            BookingStatus.CheckIn,
            Epoch.AddDays(-2),
            Epoch.AddDays(3));
        await scope.PublishAsync();

        var result = await scope.QueryAsync(Epoch, Epoch.AddDays(2));

        AssertAvailable(result, 2, 2, 100m);
    }

    [Theory]
    [InlineData(BookingStatus.Booked, 1)]
    [InlineData(BookingStatus.Confirmed, 1)]
    [InlineData(BookingStatus.CheckIn, 1)]
    [InlineData(BookingStatus.Completed, 1)]
    [InlineData(BookingStatus.LeftEarly, 1)]
    [InlineData(BookingStatus.Prospecting, 0)]
    [InlineData(BookingStatus.Relevant, 0)]
    [InlineData(BookingStatus.NoAnswer, 0)]
    [InlineData(BookingStatus.NotRelevant, 0)]
    [InlineData(BookingStatus.Cancelled, 0)]
    public async Task BookingStatusPopulationIsExact(BookingStatus status, long expectedOccupied)
    {
        await using var scope = await TestScope.CreateAsync(_fixture);
        var unit = await scope.AddUnitAsync(Epoch);
        await scope.AddPeriodAsync(unit.Id, Epoch, null, true);
        await scope.AddBookingAsync(unit.Id, status, Epoch, Epoch.AddDays(1));
        await scope.PublishAsync();

        var result = await scope.QueryAsync(Epoch, Epoch.AddDays(1));

        AssertAvailable(result, expectedOccupied, 1, expectedOccupied * 100m);
    }

    [Fact]
    public async Task HistoricalAndOrdinaryBookingsUseIdenticalStayDates()
    {
        await using var scope = await TestScope.CreateAsync(_fixture);
        var ordinaryUnit = await scope.AddUnitAsync(Epoch);
        var historicalUnit = await scope.AddUnitAsync(Epoch);
        await scope.AddPeriodAsync(ordinaryUnit.Id, Epoch, null, true);
        await scope.AddPeriodAsync(historicalUnit.Id, Epoch, null, true);
        await scope.AddBookingAsync(
            ordinaryUnit.Id,
            BookingStatus.Completed,
            Epoch,
            Epoch.AddDays(2));
        await scope.AddBookingAsync(
            historicalUnit.Id,
            BookingStatus.Completed,
            Epoch,
            Epoch.AddDays(2),
            isHistorical: true,
            actualBookedAt: Epoch.AddDays(-100));
        await scope.PublishAsync();

        AssertAvailable(await scope.QueryAsync(Epoch, Epoch.AddDays(2)), 4, 4, 100m);
    }

    [Fact]
    public async Task OverlappingLegacyBookingsCountOnePhysicalPair()
    {
        await using var scope = await TestScope.CreateAsync(_fixture);
        var unit = await scope.AddUnitAsync(Epoch);
        await scope.AddPeriodAsync(unit.Id, Epoch, null, true);
        await scope.AddBookingAsync(unit.Id, BookingStatus.Completed, Epoch, Epoch.AddDays(2));
        await scope.AddBookingAsync(unit.Id, BookingStatus.Confirmed, Epoch, Epoch.AddDays(2));
        await scope.PublishAsync();

        AssertAvailable(await scope.QueryAsync(Epoch, Epoch.AddDays(2)), 2, 2, 100m);
    }

    [Fact]
    public async Task RetiredCurrentUnitPreservesHistoricalRentableCapacity()
    {
        await using var scope = await TestScope.CreateAsync(_fixture);
        var unit = await scope.AddUnitAsync(Epoch, isActive: false);
        await scope.AddPeriodAsync(unit.Id, Epoch, Epoch.AddDays(10), true);
        await scope.AddPeriodAsync(unit.Id, Epoch.AddDays(10), null, false);
        await scope.AddBookingAsync(unit.Id, BookingStatus.Completed, Epoch, Epoch.AddDays(5));
        await scope.PublishAsync();

        AssertAvailable(await scope.QueryAsync(Epoch, Epoch.AddDays(10)), 5, 10, 50m);
    }

    [Fact]
    public async Task ResolvedUnrentablePeriodsReduceAvailableCapacity()
    {
        await using var scope = await TestScope.CreateAsync(_fixture);
        var unit = await scope.AddUnitAsync(Epoch);
        await scope.AddPeriodAsync(unit.Id, Epoch, Epoch.AddDays(3), true);
        await scope.AddPeriodAsync(unit.Id, Epoch.AddDays(3), Epoch.AddDays(5), false);
        await scope.AddPeriodAsync(unit.Id, Epoch.AddDays(5), null, true);
        await scope.PublishAsync();

        AssertAvailable(await scope.QueryAsync(Epoch, Epoch.AddDays(10)), 0, 8, 0m);
    }

    [Fact]
    public async Task UnpublishedLedgerReturnsOccupiedTruthWithoutDenominator()
    {
        await using var scope = await TestScope.CreateAsync(_fixture);
        var unit = await scope.AddUnitAsync(Epoch);
        await scope.AddBookingAsync(unit.Id, BookingStatus.Completed, Epoch, Epoch.AddDays(2));

        AssertCoverageIncomplete(await scope.QueryAsync(Epoch, Epoch.AddDays(2)), 2, null);
    }

    [Fact]
    public async Task PreEpochAndCrossEpochRangesRemainUnavailableWithoutClipping()
    {
        await using var scope = await TestScope.CreateAsync(_fixture);
        var unit = await scope.AddUnitAsync(Epoch);
        await scope.AddPeriodAsync(unit.Id, Epoch, null, true);
        await scope.AddBookingAsync(
            unit.Id,
            BookingStatus.Completed,
            Epoch.AddDays(-2),
            Epoch.AddDays(2));
        await scope.PublishAsync();

        AssertCoverageIncomplete(
            await scope.QueryAsync(Epoch.AddDays(-2), Epoch),
            2,
            Epoch);
        AssertCoverageIncomplete(
            await scope.QueryAsync(Epoch.AddDays(-1), Epoch.AddDays(2)),
            3,
            Epoch);
    }

    [Fact]
    public async Task RangeBeginningExactlyAtEpochIsCalculable()
    {
        await using var scope = await TestScope.CreateAsync(_fixture);
        var unit = await scope.AddUnitAsync(Epoch);
        await scope.AddPeriodAsync(unit.Id, Epoch, null, true);
        await scope.PublishAsync();

        AssertAvailable(await scope.QueryAsync(Epoch, Epoch.AddDays(1)), 0, 1, 0m);
    }

    [Fact]
    public async Task PostEpochUnitEntryDoesNotCreateAFalseCoverageGap()
    {
        await using var scope = await TestScope.CreateAsync(_fixture);
        var openingUnit = await scope.AddUnitAsync(Epoch);
        var laterUnit = await scope.AddUnitAsync(Epoch.AddDays(5));
        await scope.AddPeriodAsync(openingUnit.Id, Epoch, null, true);
        await scope.AddPeriodAsync(laterUnit.Id, Epoch.AddDays(5), null, true);
        await scope.PublishAsync();

        AssertAvailable(await scope.QueryAsync(Epoch, Epoch.AddDays(10)), 0, 15, 0m);
    }

    [Fact]
    public async Task MissingRelevantLedgerCoverageFailsClosed()
    {
        await using var scope = await TestScope.CreateAsync(_fixture);
        var unit = await scope.AddUnitAsync(Epoch);
        await scope.AddPeriodAsync(unit.Id, Epoch, Epoch.AddDays(3), true);
        await scope.AddPeriodAsync(unit.Id, Epoch.AddDays(4), null, true);
        await scope.PublishAsync();

        AssertCoverageIncomplete(await scope.QueryAsync(Epoch, Epoch.AddDays(5)), 0, Epoch);
    }

    [Fact]
    public async Task KnownZeroCapacityReturnsNAInsteadOfZeroPercent()
    {
        await using var scope = await TestScope.CreateAsync(_fixture);
        var unit = await scope.AddUnitAsync(Epoch, isActive: false);
        await scope.AddPeriodAsync(unit.Id, Epoch, null, false);
        await scope.PublishAsync();

        var result = await scope.QueryAsync(Epoch, Epoch.AddDays(2));

        Assert.True(result.AvailabilityCoverageComplete);
        Assert.Equal(0, result.AvailableUnitNights);
        Assert.Null(result.OccupancyRate);
        Assert.Equal(OccupancyUnavailableReasons.ZeroCapacity, result.UnavailableReason);
    }

    [Fact]
    public async Task OccupiedPairOutsideRentableTruthReturnsIntegrityConflictWithoutClamping()
    {
        await using var scope = await TestScope.CreateAsync(_fixture);
        var unit = await scope.AddUnitAsync(Epoch, isActive: false);
        await scope.AddPeriodAsync(unit.Id, Epoch, null, false);
        await scope.AddBookingAsync(unit.Id, BookingStatus.Completed, Epoch, Epoch.AddDays(1));
        await scope.PublishAsync();

        var result = await scope.QueryAsync(Epoch, Epoch.AddDays(1));

        Assert.True(result.AvailabilityCoverageComplete);
        Assert.Equal(1, result.OccupiedUnitNights);
        Assert.Equal(0, result.AvailableUnitNights);
        Assert.Null(result.OccupancyRate);
        Assert.Equal(OccupancyUnavailableReasons.IntegrityConflict, result.UnavailableReason);
    }

    [Fact]
    public async Task FutureNightIsRejectedButCairoTodayNightIsSupported()
    {
        await using var scope = await TestScope.CreateAsync(_fixture);
        var unit = await scope.AddUnitAsync(Epoch);
        await scope.AddPeriodAsync(unit.Id, Epoch, null, true);
        await scope.PublishAsync();

        AssertAvailable(await scope.QueryAsync(Today, Today.AddDays(1)), 0, 1, 0m);
        var exception = await Assert.ThrowsAsync<BusinessValidationException>(
            () => scope.QueryAsync(Today, Today.AddDays(2)));
        Assert.Equal(OccupancyErrorCodes.FutureRangeNotSupported, exception.Code);
    }

    [Fact]
    public async Task RangeIsHalfOpenOrderedAndBoundedToTwentyFourMonths()
    {
        await using var scope = await TestScope.CreateAsync(_fixture, new DateOnly(2030, 2, 27));

        var invalidOrder = await Assert.ThrowsAsync<BusinessValidationException>(
            () => scope.QueryAsync(Epoch, Epoch));
        Assert.Equal(HistoricalErrorCodes.ValidationError, invalidOrder.Code);

        var exactMaximum = await scope.QueryAsync(
            new DateOnly(2028, 2, 29),
            new DateOnly(2030, 2, 28));
        Assert.Equal(OccupancyUnavailableReasons.CoverageIncomplete, exactMaximum.UnavailableReason);

        await Assert.ThrowsAsync<BusinessValidationException>(
            () => scope.QueryAsync(
                new DateOnly(2028, 2, 29),
                new DateOnly(2030, 3, 1)));
    }

    [Fact]
    public async Task AggregateQueryIsSetBasedForNonTrivialPopulation()
    {
        await using var scope = await TestScope.CreateAsync(_fixture);
        for (var index = 0; index < 40; index++)
        {
            var unit = await scope.AddUnitAsync(Epoch, name: $"Scale {index}");
            await scope.AddPeriodAsync(unit.Id, Epoch, null, true);
            await scope.AddBookingAsync(
                unit.Id,
                BookingStatus.Completed,
                Epoch,
                Epoch.AddDays(10));
        }
        await scope.PublishAsync();

        var result = await scope.QueryAsync(Epoch, Epoch.AddDays(10));
        var plan = await scope.ExplainAsync(Epoch, Epoch.AddDays(10));

        AssertAvailable(result, 400, 400, 100m);
        Assert.Contains("generate_series", plan, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("unit_rentability_periods AS period\n            CROSS JOIN LATERAL generate_series", OccupancyAnalyticsService.AggregateSql);
    }

    private static void AssertAvailable(
        OccupancyAnalyticsResult result,
        long occupied,
        long available,
        decimal rate)
    {
        Assert.True(result.AvailabilityCoverageComplete);
        Assert.Equal(occupied, result.OccupiedUnitNights);
        Assert.Equal(available, result.AvailableUnitNights);
        Assert.Equal(rate, result.OccupancyRate);
        Assert.Null(result.UnavailableReason);
    }

    private static void AssertCoverageIncomplete(
        OccupancyAnalyticsResult result,
        long occupied,
        DateOnly? coverageStart)
    {
        Assert.False(result.AvailabilityCoverageComplete);
        Assert.Equal(occupied, result.OccupiedUnitNights);
        Assert.Null(result.AvailableUnitNights);
        Assert.Null(result.OccupancyRate);
        Assert.Equal(coverageStart, result.CoverageStartDate);
        Assert.Equal(OccupancyUnavailableReasons.CoverageIncomplete, result.UnavailableReason);
    }

    private sealed class TestScope : IAsyncDisposable
    {
        private readonly TestClock _clock;

        private TestScope(
            PostgreSqlTestDatabase database,
            Guid ownerId,
            Guid projectId,
            Guid clientId,
            DateOnly today)
        {
            Database = database;
            OwnerId = ownerId;
            ProjectId = projectId;
            ClientId = clientId;
            _clock = new TestClock(today);
        }

        public PostgreSqlTestDatabase Database { get; }
        public Guid OwnerId { get; }
        public Guid ProjectId { get; }
        public Guid ClientId { get; }

        public static async Task<TestScope> CreateAsync(
            PostgreSqlFixture fixture,
            DateOnly? today = null)
        {
            var database = await fixture.CreateTestDatabaseAsync();
            await using (var connection = await database.OpenConnectionAsync())
            await using (var command = new NpgsqlCommand(
                "UPDATE units SET created_at = TIMESTAMP '9999-12-31 00:00:00'",
                connection))
            {
                await command.ExecuteNonQueryAsync();
            }

            await using var context = database.CreateDbContext();
            var suffix = Guid.NewGuid().ToString("N")[..10];
            var owner = new Owner
            {
                Id = Guid.NewGuid(),
                Name = $"Occupancy Owner {suffix}",
                Phone = $"+2010{suffix[..8]}",
                EmergencyPhone = $"+2011{suffix[..8]}",
                CommissionRate = 10m,
                Status = "active",
                PasswordHash = "test-only",
            };
            var project = new Project
            {
                Id = Guid.NewGuid(),
                Name = $"Occupancy Project {suffix}",
                IsActive = true,
            };
            var client = new Client
            {
                Id = Guid.NewGuid(),
                Name = $"Occupancy Client {suffix}",
                Phone = $"+2012{suffix[..8]}",
                PasswordHash = "test-only",
                IsActive = true,
            };
            context.AddRange(owner, project, client);
            await context.SaveChangesAsync();
            return new TestScope(database, owner.Id, project.Id, client.Id, today ?? Today);
        }

        public async Task<Unit> AddUnitAsync(
            DateOnly entryDate,
            bool isActive = true,
            string? name = null)
        {
            await using var context = Database.CreateDbContext();
            var unit = new Unit
            {
                Id = Guid.NewGuid(),
                OwnerId = OwnerId,
                ProjectId = ProjectId,
                Name = name ?? $"Occupancy Unit {Guid.NewGuid():N}",
                UnitType = "apartment",
                Bedrooms = 1,
                Bathrooms = 1,
                MaxGuests = 2,
                BasePricePerNight = 100m,
                IsActive = isActive,
            };
            context.Units.Add(unit);
            await context.SaveChangesAsync();
            await context.Database.ExecuteSqlInterpolatedAsync(
                $"UPDATE units SET created_at = {entryDate.ToDateTime(new TimeOnly(1, 0))} WHERE id = {unit.Id}");
            return unit;
        }

        public async Task AddPeriodAsync(
            Guid unitId,
            DateOnly from,
            DateOnly? toExclusive,
            bool isRentable)
        {
            await using var context = Database.CreateDbContext();
            context.UnitRentabilityPeriods.Add(new UnitRentabilityPeriod
            {
                Id = Guid.NewGuid(),
                UnitId = unitId,
                EffectiveFromDate = from,
                EffectiveToDate = toExclusive,
                IsRentable = isRentable,
                ResolvedReason = isRentable ? "rentable" : "unit_inactive",
                RevisionId = Guid.NewGuid(),
                ChangeSourceType = "opening_seed",
                RecordedAt = DateTime.UtcNow,
            });
            await context.SaveChangesAsync();
        }

        public async Task AddBookingAsync(
            Guid unitId,
            BookingStatus status,
            DateOnly checkIn,
            DateOnly checkOut,
            bool isHistorical = false,
            DateOnly? actualBookedAt = null)
        {
            await using var context = Database.CreateDbContext();
            context.Bookings.Add(new Booking
            {
                Id = Guid.NewGuid(),
                ClientId = ClientId,
                UnitId = unitId,
                OwnerId = OwnerId,
                BookingStatus = status,
                CheckInDate = checkIn,
                CheckOutDate = checkOut,
                GuestCount = 1,
                BaseAmount = 100m,
                FinalAmount = 100m,
                AgreedAmount = isHistorical ? 100m : null,
                Source = "admin",
                IsHistorical = isHistorical,
                ActualBookedAt = actualBookedAt,
                HistoricalEntryReason = isHistorical
                    ? HistoricalEntryReasons.OfflineBookingRecordedAfterStay
                    : null,
                OriginalSource = isHistorical ? "legacy_system" : null,
            });
            await context.SaveChangesAsync();
        }

        public async Task PublishAsync()
        {
            await using var connection = await Database.OpenConnectionAsync();
            await using var command = new NpgsqlCommand(
                """
                UPDATE rentable_capacity_ledger
                SET publication_status = 'published',
                    coverage_start_date = @epoch,
                    published_at = @published_at,
                    updated_at = @published_at
                WHERE scope = 'global'
                """,
                connection);
            command.Parameters.AddWithValue("epoch", NpgsqlDbType.Date, Epoch);
            command.Parameters.AddWithValue(
                "published_at",
                NpgsqlDbType.Timestamp,
                Epoch.ToDateTime(new TimeOnly(12, 0)));
            await command.ExecuteNonQueryAsync();
        }

        public async Task<OccupancyAnalyticsResult> QueryAsync(DateOnly from, DateOnly toExclusive)
        {
            await using var context = Database.CreateDbContext();
            return await new OccupancyAnalyticsService(context, _clock)
                .GetAsync(from, toExclusive);
        }

        public async Task<string> ExplainAsync(DateOnly from, DateOnly toExclusive)
        {
            await using var connection = await Database.OpenConnectionAsync();
            await using var command = new NpgsqlCommand(
                "EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) " + OccupancyAnalyticsService.AggregateSql,
                connection);
            command.Parameters.AddWithValue("from", NpgsqlDbType.Date, from);
            command.Parameters.AddWithValue("to_exclusive", NpgsqlDbType.Date, toExclusive);
            await using var reader = await command.ExecuteReaderAsync();
            var lines = new List<string>();
            while (await reader.ReadAsync())
            {
                lines.Add(reader.GetString(0));
            }

            return string.Join(Environment.NewLine, lines);
        }

        public ValueTask DisposeAsync() => Database.DisposeAsync();
    }

    private sealed class TestClock(DateOnly today) : IBusinessClock
    {
        public DateOnly CairoToday() => today;
    }
}
