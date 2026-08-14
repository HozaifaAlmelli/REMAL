using System.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Npgsql;
using NpgsqlTypes;
using RentalPlatform.Business.Exceptions;
using RentalPlatform.Business.Interfaces;
using RentalPlatform.Business.Models;
using RentalPlatform.Business.Time;
using RentalPlatform.Data;
using RentalPlatform.Shared.Constants;

namespace RentalPlatform.Business.Services;

public sealed class OccupancyAnalyticsService : IOccupancyAnalyticsService
{
    public const string AggregateSql =
        """
        WITH bounds AS (
            SELECT @from::DATE AS from_date, @to_exclusive::DATE AS to_exclusive
        ),
        ledger AS (
            SELECT
                COUNT(*) FILTER (WHERE scope = 'global')::INTEGER AS ledger_row_count,
                MAX(publication_status) FILTER (WHERE scope = 'global') AS publication_status,
                MAX(coverage_start_date) FILTER (WHERE scope = 'global') AS coverage_start_date,
                MAX(published_at) FILTER (WHERE scope = 'global') AS published_at
            FROM rentable_capacity_ledger
        ),
        current_periods AS (
            SELECT
                period.unit_id,
                period.effective_from_date,
                period.effective_to_date,
                period.is_rentable
            FROM unit_rentability_periods AS period
            WHERE period.superseded_at IS NULL
        ),
        expected_units AS (
            SELECT
                unit.id AS unit_id,
                CASE
                    WHEN unit.created_at <= ledger.published_at
                        THEN ledger.coverage_start_date
                    ELSE (unit.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Africa/Cairo')::DATE
                END AS entry_date
            FROM units AS unit
            CROSS JOIN ledger
            WHERE ledger.ledger_row_count = 1
              AND ledger.publication_status = 'published'
              AND ledger.coverage_start_date IS NOT NULL
              AND ledger.published_at IS NOT NULL
        ),
        expected_coverage AS (
            SELECT COALESCE(SUM(
                bounds.to_exclusive - GREATEST(bounds.from_date, expected.entry_date)
            ) FILTER (WHERE expected.entry_date < bounds.to_exclusive), 0)::BIGINT AS unit_nights
            FROM expected_units AS expected
            CROSS JOIN bounds
        ),
        actual_coverage AS (
            SELECT COALESCE(SUM(
                LEAST(COALESCE(period.effective_to_date, bounds.to_exclusive), bounds.to_exclusive)
                - GREATEST(period.effective_from_date, bounds.from_date)
            ), 0)::BIGINT AS unit_nights
            FROM current_periods AS period
            CROSS JOIN bounds
            WHERE period.effective_from_date < bounds.to_exclusive
              AND COALESCE(period.effective_to_date, bounds.to_exclusive) > bounds.from_date
        ),
        available_capacity AS (
            SELECT COALESCE(SUM(
                LEAST(COALESCE(period.effective_to_date, bounds.to_exclusive), bounds.to_exclusive)
                - GREATEST(period.effective_from_date, bounds.from_date)
            ), 0)::BIGINT AS unit_nights
            FROM current_periods AS period
            CROSS JOIN bounds
            WHERE period.is_rentable
              AND period.effective_from_date < bounds.to_exclusive
              AND COALESCE(period.effective_to_date, bounds.to_exclusive) > bounds.from_date
        ),
        occupied_pairs AS (
            SELECT DISTINCT
                booking.unit_id,
                occupied.night::DATE AS night
            FROM bookings AS booking
            CROSS JOIN bounds
            CROSS JOIN LATERAL generate_series(
                GREATEST(booking.check_in_date, bounds.from_date)::TIMESTAMP,
                (LEAST(booking.check_out_date, bounds.to_exclusive) - 1)::TIMESTAMP,
                INTERVAL '1 day'
            ) AS occupied(night)
            WHERE booking.booking_status IN ('booked', 'confirmed', 'checkin', 'completed', 'leftearly')
              AND booking.check_in_date < bounds.to_exclusive
              AND booking.check_out_date > bounds.from_date
        ),
        occupied_summary AS (
            SELECT COUNT(*)::BIGINT AS unit_nights
            FROM occupied_pairs
        ),
        integrity_conflicts AS (
            SELECT COUNT(*)::BIGINT AS unit_nights
            FROM occupied_pairs AS occupied
            WHERE NOT EXISTS (
                SELECT 1
                FROM current_periods AS period
                WHERE period.unit_id = occupied.unit_id
                  AND period.is_rentable
                  AND period.effective_from_date <= occupied.night
                  AND (period.effective_to_date IS NULL OR occupied.night < period.effective_to_date)
            )
        )
        SELECT
            ledger.ledger_row_count,
            ledger.publication_status,
            ledger.coverage_start_date,
            occupied_summary.unit_nights AS occupied_unit_nights,
            available_capacity.unit_nights AS available_unit_nights,
            expected_coverage.unit_nights AS expected_coverage_unit_nights,
            actual_coverage.unit_nights AS actual_coverage_unit_nights,
            integrity_conflicts.unit_nights AS conflicting_occupied_unit_nights
        FROM ledger
        CROSS JOIN occupied_summary
        CROSS JOIN available_capacity
        CROSS JOIN expected_coverage
        CROSS JOIN actual_coverage
        CROSS JOIN integrity_conflicts
        """;

    private readonly AppDbContext _context;
    private readonly IBusinessClock _clock;

    public OccupancyAnalyticsService(AppDbContext context, IBusinessClock clock)
    {
        _context = context;
        _clock = clock;
    }

    public async Task<OccupancyAnalyticsResult> GetAsync(
        DateOnly from,
        DateOnly toExclusive,
        CancellationToken cancellationToken = default)
    {
        ValidateRange(from, toExclusive);
        var raw = await ReadAggregateAsync(from, toExclusive, cancellationToken);

        var coverageComplete = raw.LedgerRowCount == 1
            && raw.PublicationStatus == "published"
            && raw.CoverageStartDate.HasValue
            && from >= raw.CoverageStartDate.Value
            && raw.ExpectedCoverageUnitNights == raw.ActualCoverageUnitNights;

        if (!coverageComplete)
        {
            return Unavailable(
                from,
                toExclusive,
                raw.OccupiedUnitNights,
                raw.CoverageStartDate,
                OccupancyUnavailableReasons.CoverageIncomplete,
                coverageComplete: false);
        }

        if (raw.ConflictingOccupiedUnitNights > 0)
        {
            return Unavailable(
                from,
                toExclusive,
                raw.OccupiedUnitNights,
                raw.CoverageStartDate,
                OccupancyUnavailableReasons.IntegrityConflict,
                coverageComplete: true,
                availableUnitNights: raw.AvailableUnitNights);
        }

        if (raw.AvailableUnitNights == 0)
        {
            return Unavailable(
                from,
                toExclusive,
                raw.OccupiedUnitNights,
                raw.CoverageStartDate,
                OccupancyUnavailableReasons.ZeroCapacity,
                coverageComplete: true,
                availableUnitNights: 0);
        }

        return new OccupancyAnalyticsResult
        {
            From = from,
            ToExclusive = toExclusive,
            OccupiedUnitNights = raw.OccupiedUnitNights,
            AvailableUnitNights = raw.AvailableUnitNights,
            OccupancyRate = raw.OccupiedUnitNights * 100m / raw.AvailableUnitNights,
            AvailabilityCoverageComplete = true,
            CoverageStartDate = raw.CoverageStartDate,
        };
    }

    private void ValidateRange(DateOnly from, DateOnly toExclusive)
    {
        if (toExclusive <= from)
        {
            throw new BusinessValidationException(
                "toExclusive must be later than from.",
                HistoricalErrorCodes.ValidationError);
        }

        if (from <= DateOnly.MaxValue.AddMonths(-24)
            && toExclusive > from.AddMonths(24))
        {
            throw new BusinessValidationException(
                "Occupancy range must not exceed 24 months.",
                HistoricalErrorCodes.ValidationError);
        }

        var firstUnsupportedDate = _clock.CairoToday().AddDays(1);
        if (toExclusive > firstUnsupportedDate)
        {
            throw new BusinessValidationException(
                "Occupancy ranges cannot include future nights.",
                OccupancyErrorCodes.FutureRangeNotSupported);
        }
    }

    private async Task<RawAggregate> ReadAggregateAsync(
        DateOnly from,
        DateOnly toExclusive,
        CancellationToken cancellationToken)
    {
        var connection = (NpgsqlConnection)_context.Database.GetDbConnection();
        var shouldClose = connection.State == ConnectionState.Closed;
        if (shouldClose)
        {
            await connection.OpenAsync(cancellationToken);
        }

        try
        {
            await using var command = new NpgsqlCommand(AggregateSql, connection)
            {
                Transaction = _context.Database.CurrentTransaction?.GetDbTransaction() as NpgsqlTransaction,
                CommandTimeout = 30,
            };
            command.Parameters.Add(new NpgsqlParameter<DateOnly>("from", NpgsqlDbType.Date) { TypedValue = from });
            command.Parameters.Add(new NpgsqlParameter<DateOnly>("to_exclusive", NpgsqlDbType.Date) { TypedValue = toExclusive });

            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            if (!await reader.ReadAsync(cancellationToken))
            {
                throw new InvalidOperationException("Occupancy aggregate query returned no row.");
            }

            return new RawAggregate(
                reader.GetInt32(0),
                reader.IsDBNull(1) ? null : reader.GetString(1),
                reader.IsDBNull(2) ? null : reader.GetFieldValue<DateOnly>(2),
                reader.GetInt64(3),
                reader.GetInt64(4),
                reader.GetInt64(5),
                reader.GetInt64(6),
                reader.GetInt64(7));
        }
        finally
        {
            if (shouldClose)
            {
                await connection.CloseAsync();
            }
        }
    }

    private static OccupancyAnalyticsResult Unavailable(
        DateOnly from,
        DateOnly toExclusive,
        long occupiedUnitNights,
        DateOnly? coverageStartDate,
        string reason,
        bool coverageComplete,
        long? availableUnitNights = null) =>
        new()
        {
            From = from,
            ToExclusive = toExclusive,
            OccupiedUnitNights = occupiedUnitNights,
            AvailableUnitNights = availableUnitNights,
            OccupancyRate = null,
            AvailabilityCoverageComplete = coverageComplete,
            CoverageStartDate = coverageStartDate,
            UnavailableReason = reason,
        };

    private sealed record RawAggregate(
        int LedgerRowCount,
        string? PublicationStatus,
        DateOnly? CoverageStartDate,
        long OccupiedUnitNights,
        long AvailableUnitNights,
        long ExpectedCoverageUnitNights,
        long ActualCoverageUnitNights,
        long ConflictingOccupiedUnitNights);
}
