using System;
using System.Collections.Generic;
using System.Diagnostics.Metrics;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using RentalPlatform.Business.Exceptions;
using RentalPlatform.Business.Interfaces;
using RentalPlatform.Business.Models;
using RentalPlatform.Business.Services;
using RentalPlatform.Business.Time;
using RentalPlatform.Data;
using RentalPlatform.Data.Entities;
using RentalPlatform.Shared.Constants;
using RentalPlatform.Shared.Enums;
using RentalPlatform.Tests.Infrastructure;
using Xunit;

namespace RentalPlatform.Tests;

/// <summary>
/// REQ-16 / HB-08B — normal-flow past-date hardening.
/// Contract: HB-01 §11.2 (D-02, D-03), HB-08 <c>AC-HB08-23</c> … <c>AC-HB08-26</c>,
/// <c>NAC-HB08-14</c>, <c>NAC-HB08-15</c>, scenarios <c>SC-REG-01</c>, <c>SC-REG-02</c>,
/// <c>SC-REG-03</c>, error contract <c>STAY_DATES_IN_PAST</c>.
///
/// Every clock here is fixed, so the boundary assertions never depend on the wall clock of the
/// machine running the suite.
/// </summary>
[Collection(PostgreSqlTestCollection.Name)]
[Trait(TestCategories.Name, TestCategories.PostgreSql)]
public sealed class NormalFlowPastDateHardeningPostgreSqlTests
{
    private static readonly DateOnly CairoToday = new(2026, 8, 16);
    private static readonly DateOnly Yesterday = CairoToday.AddDays(-1);
    private static readonly DateOnly LongPastCheckIn = new(2026, 6, 1);
    private static readonly DateOnly LongPastCheckOut = new(2026, 6, 4);

    private readonly PostgreSqlFixture _fixture;

    public NormalFlowPastDateHardeningPostgreSqlTests(PostgreSqlFixture fixture)
    {
        _fixture = fixture;
    }

    // SC-REG-02 / AC-HB08-23 — the admin creation path.
    [Fact]
    public async Task NormalCreateRejectsAPastStayWithStayDatesInPastAndWritesNothing()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        await using var context = database.CreateDbContext();
        var data = await SeedAsync(context);
        var service = CreateBookingService(context);

        var error = await Assert.ThrowsAsync<BusinessValidationException>(() => service.CreateAsync(
            data.Client.Id,
            data.Unit.Id,
            LongPastCheckIn,
            LongPastCheckOut,
            2,
            "admin",
            null,
            data.Admin.Id,
            "Sanitized past-dated normal create."));

        Assert.Equal(HistoricalErrorCodes.StayDatesInPast, error.Code);
        Assert.Equal(BookingService.StayDatesInPastMessage, error.Message);
        Assert.Contains("Historical Booking flow", error.Message);

        context.ChangeTracker.Clear();
        Assert.Equal(0, await context.Bookings.CountAsync());
        Assert.Equal(0, await context.BookingStatusHistories.CountAsync());
        Assert.Equal(0, await context.Invoices.CountAsync());
        Assert.Equal(0, await context.Payments.CountAsync());
        Assert.Equal(0, await context.Notifications.CountAsync());
    }

    // SC-REG-02 — quick-create path.
    [Fact]
    public async Task QuickCreateRejectsAPastStayWithStayDatesInPast()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        await using var context = database.CreateDbContext();
        var data = await SeedAsync(context);
        var service = CreateBookingService(context);

        var error = await Assert.ThrowsAsync<BusinessValidationException>(() => service.CreateQuickAsync(
            data.Client.Id,
            data.Unit.Id,
            LongPastCheckIn,
            LongPastCheckOut,
            2,
            "admin",
            null,
            data.Admin.Id,
            "Sanitized past-dated quick create."));

        Assert.Equal(HistoricalErrorCodes.StayDatesInPast, error.Code);
        context.ChangeTracker.Clear();
        Assert.Equal(0, await context.Bookings.CountAsync());
    }

    // SC-REG-02 — storefront guest checkout path.
    [Fact]
    public async Task GuestCheckoutRejectsAPastStayAndCreatesNoClient()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        await using var context = database.CreateDbContext();
        var data = await SeedAsync(context);
        var unitOfWork = new UnitOfWork(context);
        var guestService = new GuestBookingService(
            unitOfWork,
            new ClientService(unitOfWork, NullLogger<ClientService>.Instance),
            CreateBookingService(context, unitOfWork));

        var guestPhone = TestPhone("25");
        var error = await Assert.ThrowsAsync<BusinessValidationException>(() => guestService.CreateAsync(
            "Sanitized",
            "Guest",
            guestPhone,
            data.Unit.Id,
            LongPastCheckIn,
            LongPastCheckOut,
            2));

        Assert.Equal(HistoricalErrorCodes.StayDatesInPast, error.Code);
        context.ChangeTracker.Clear();
        Assert.Equal(0, await context.Bookings.CountAsync());
        Assert.False(await context.Clients.IgnoreQueryFilters().AnyAsync(
            client => client.Phone.Contains(guestPhone.TrimStart('+'))));
    }

    // SC-REG-02 — CRM conversion path.
    [Fact]
    public async Task CrmConversionRejectsAPastStayAndLeavesTheLeadUnconverted()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        await using var context = database.CreateDbContext();
        var data = await SeedAsync(context);
        var unitOfWork = new UnitOfWork(context);
        var availability = new UnitAvailabilityService(unitOfWork);
        var lead = new CrmLead
        {
            Id = Guid.NewGuid(),
            ClientId = data.Client.Id,
            TargetUnitId = data.Unit.Id,
            ContactName = "Sanitized Lead",
            ContactPhone = TestPhone("26"),
            DesiredCheckInDate = LongPastCheckIn,
            DesiredCheckOutDate = LongPastCheckOut,
            GuestCount = 2,
            LeadStatus = LeadStatus.Booked,
            Source = "phone"
        };
        context.Add(lead);
        await context.SaveChangesAsync();

        var crmService = new CrmLeadService(
            unitOfWork,
            CreateBookingService(context, unitOfWork),
            availability);

        var error = await Assert.ThrowsAsync<BusinessValidationException>(() =>
            crmService.ConvertToBookingAsync(
                lead.Id,
                data.Client.Id,
                data.Unit.Id,
                LongPastCheckIn,
                LongPastCheckOut,
                2,
                data.Admin.Id,
                "Sanitized past-dated conversion."));

        Assert.Equal(HistoricalErrorCodes.StayDatesInPast, error.Code);
        context.ChangeTracker.Clear();
        Assert.Equal(0, await context.Bookings.CountAsync());
        Assert.Equal(
            LeadStatus.Booked,
            (await context.CrmLeads.AsNoTracking().SingleAsync(item => item.Id == lead.Id)).LeadStatus);
    }

    // D-02 boundary and SC-REG-01: yesterday is refused, Cairo today is legal, the future is unchanged.
    [Fact]
    public async Task CairoTodayIsLegalYesterdayIsRefusedAndTheFutureIsUnchanged()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        await using var context = database.CreateDbContext();
        var data = await SeedAsync(context);
        var service = CreateBookingService(context);

        var refused = await Assert.ThrowsAsync<BusinessValidationException>(() => service.CreateAsync(
            data.Client.Id,
            data.Unit.Id,
            Yesterday,
            CairoToday.AddDays(2),
            2,
            "admin",
            null,
            data.Admin.Id,
            "Sanitized one-day-past create."));
        Assert.Equal(HistoricalErrorCodes.StayDatesInPast, refused.Code);

        var sameDay = await service.CreateAsync(
            data.Client.Id,
            data.Unit.Id,
            CairoToday,
            CairoToday.AddDays(2),
            2,
            "admin",
            null,
            data.Admin.Id,
            "Sanitized same-day create.");
        Assert.Equal(CairoToday, sameDay.CheckInDate);
        Assert.Equal(BookingStatus.Prospecting, sameDay.BookingStatus);
        Assert.False(sameDay.IsHistorical);

        var future = await service.CreateAsync(
            data.Client.Id,
            data.Unit.Id,
            CairoToday.AddDays(30),
            CairoToday.AddDays(33),
            2,
            "admin",
            null,
            data.Admin.Id,
            "Sanitized future create.");
        Assert.Equal(BookingStatus.Prospecting, future.BookingStatus);

        context.ChangeTracker.Clear();
        var history = await context.BookingStatusHistories.AsNoTracking()
            .Where(item => item.BookingId == future.Id)
            .ToListAsync();
        Assert.Equal(BookingHistoryEvents.BookingCreated, Assert.Single(history).Notes);
        Assert.Equal(2, await context.Bookings.CountAsync());
    }

    // The rule follows the Cairo date, not the UTC date. At 2026-07-31T21:00Z Cairo has already
    // rolled over to 2026-08-01, so a 2026-08-01 check-in is legal at that instant and a
    // 2026-07-31 check-in is not — while one second earlier the verdicts are reversed.
    [Fact]
    public async Task TheBoundaryFollowsCairoMidnightNotUtcMidnight()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        await using var context = database.CreateDbContext();
        var data = await SeedAsync(context);
        var unitOfWork = new UnitOfWork(context);

        var beforeCairoMidnight = CreateBookingService(
            context,
            unitOfWork,
            new CairoBusinessClock(new FixedTimeProvider(
                new DateTimeOffset(2026, 7, 31, 20, 59, 59, TimeSpan.Zero))));
        var afterCairoMidnight = CreateBookingService(
            context,
            unitOfWork,
            new CairoBusinessClock(new FixedTimeProvider(
                new DateTimeOffset(2026, 7, 31, 21, 0, 0, TimeSpan.Zero))));

        var stillYesterdayInCairo = await beforeCairoMidnight.CreateAsync(
            data.Client.Id,
            data.Unit.Id,
            new DateOnly(2026, 7, 31),
            new DateOnly(2026, 8, 3),
            2,
            "admin",
            null,
            data.Admin.Id,
            "Sanitized pre-midnight create.");
        Assert.Equal(new DateOnly(2026, 7, 31), stillYesterdayInCairo.CheckInDate);

        var afterRollover = await Assert.ThrowsAsync<BusinessValidationException>(() =>
            afterCairoMidnight.CreateAsync(
                data.Client.Id,
                data.Unit.Id,
                new DateOnly(2026, 7, 31),
                new DateOnly(2026, 8, 5),
                2,
                "admin",
                null,
                data.Admin.Id,
                "Sanitized post-midnight create."));
        Assert.Equal(HistoricalErrorCodes.StayDatesInPast, afterRollover.Code);
    }

    // AC-HB08-24 / NAC-HB08-16 — the Historical Booking flow is untouched and remains the
    // explicit authorized path for a stay that already happened.
    [Fact]
    public async Task HistoricalBookingStillRecordsACompletedPastStay()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        await using var context = database.CreateDbContext();
        var data = await SeedAsync(context);
        var unitOfWork = new UnitOfWork(context);
        var clock = new FixedBusinessClock(CairoToday);
        var historicalService = new HistoricalBookingService(
            unitOfWork,
            CreateBookingService(context, unitOfWork, clock),
            new ClientService(unitOfWork, NullLogger<ClientService>.Instance),
            clock,
            new HistoricalIdempotencyStore(unitOfWork),
            new HistoricalConflictService(unitOfWork),
            NullLogger<HistoricalBookingService>.Instance);

        var result = await historicalService.RecordAsync(new RecordHistoricalBookingCommand(
            data.Unit.Id,
            data.Client.Id,
            null,
            LongPastCheckIn,
            LongPastCheckOut,
            2,
            LongPastCheckIn.AddDays(-5),
            HistoricalEntryReasons.OfflineBookingRecordedAfterStay,
            null,
            "offline_record",
            $"sanitized-hardening-{Guid.NewGuid():N}",
            1_500m,
            null,
            "Sanitized historical past stay under hardening.",
            data.Admin.Id,
            Guid.NewGuid(),
            "sanitized-hardening-test"));

        Assert.True(result.Booking.IsHistorical);
        Assert.Equal(BookingStatus.Completed, result.Booking.BookingStatus);
        Assert.Equal(LongPastCheckIn, result.Booking.CheckInDate);

        context.ChangeTracker.Clear();
        var history = await context.BookingStatusHistories.AsNoTracking()
            .Where(item => item.BookingId == result.Booking.Id)
            .ToListAsync();
        Assert.Equal(BookingHistoryEvents.HistoricalBookingRecorded, Assert.Single(history).Notes);
    }

    // SC-REG-03 / D-03 — a date-changing update cannot move a booking into the past.
    [Fact]
    public async Task UpdatePendingCannotMoveStayDatesIntoThePast()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        await using var context = database.CreateDbContext();
        var data = await SeedAsync(context);
        var service = CreateBookingService(context);

        var booking = await service.CreateAsync(
            data.Client.Id,
            data.Unit.Id,
            CairoToday.AddDays(10),
            CairoToday.AddDays(13),
            2,
            "admin",
            null,
            data.Admin.Id,
            "Sanitized future booking for the update guard.");
        Assert.Equal(BookingStatus.Prospecting, booking.BookingStatus);

        var error = await Assert.ThrowsAsync<BusinessValidationException>(() =>
            service.UpdatePendingAsync(
                booking.Id,
                LongPastCheckIn,
                LongPastCheckOut,
                2,
                "admin",
                null,
                "Sanitized backdating attempt."));
        Assert.Equal(HistoricalErrorCodes.StayDatesInPast, error.Code);

        context.ChangeTracker.Clear();
        var stored = await context.Bookings.AsNoTracking().SingleAsync(item => item.Id == booking.Id);
        Assert.Equal(CairoToday.AddDays(10), stored.CheckInDate);
        Assert.Equal(CairoToday.AddDays(13), stored.CheckOutDate);

        // An update that keeps the dates in the future still works.
        var moved = await service.UpdatePendingAsync(
            booking.Id,
            CairoToday.AddDays(20),
            CairoToday.AddDays(23),
            2,
            "admin",
            null,
            "Sanitized forward move.");
        Assert.Equal(CairoToday.AddDays(20), moved.CheckInDate);
    }

    // AC-HB01-08 — the rejection is observable: booking_create_rejected_total carries the
    // ratified reason and a fixed-vocabulary operation tag, and never any guest data.
    [Fact]
    public async Task RejectionIncrementsTheCreateRejectedCounterWithTheRatifiedReason()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        await using var context = database.CreateDbContext();
        var data = await SeedAsync(context);
        var service = CreateBookingService(context);

        var measurements = new List<(long Value, string Reason, string Operation)>();
        using var listener = new MeterListener();
        listener.InstrumentPublished = (instrument, activeListener) =>
        {
            if (instrument.Meter.Name == "Kaza.Bookings"
                && instrument.Name == "booking_create_rejected_total")
            {
                activeListener.EnableMeasurementEvents(instrument);
            }
        };
        listener.SetMeasurementEventCallback<long>((_, value, tags, _) =>
        {
            var reason = string.Empty;
            var operation = string.Empty;
            foreach (var tag in tags)
            {
                if (tag.Key == "reason") reason = tag.Value?.ToString() ?? string.Empty;
                if (tag.Key == "operation") operation = tag.Value?.ToString() ?? string.Empty;
            }

            measurements.Add((value, reason, operation));
        });
        listener.Start();

        await Assert.ThrowsAsync<BusinessValidationException>(() => service.CreateAsync(
            data.Client.Id,
            data.Unit.Id,
            LongPastCheckIn,
            LongPastCheckOut,
            2,
            "admin",
            null,
            data.Admin.Id,
            "Sanitized metric probe."));

        var recorded = Assert.Single(measurements);
        Assert.Equal(1, recorded.Value);
        Assert.Equal(HistoricalErrorCodes.StayDatesInPast, recorded.Reason);
        Assert.Equal("create", recorded.Operation);
    }

    private static IBookingService CreateBookingService(AppDbContext context)
    {
        var unitOfWork = new UnitOfWork(context);
        return CreateBookingService(context, unitOfWork);
    }

    private static IBookingService CreateBookingService(
        AppDbContext context,
        IUnitOfWork unitOfWork,
        IBusinessClock? clock = null)
    {
        _ = context;
        return new BookingService(
            unitOfWork,
            new UnitAvailabilityService(unitOfWork),
            clock ?? new FixedBusinessClock(CairoToday),
            NullLogger<BookingService>.Instance);
    }

    private static async Task<SeededData> SeedAsync(AppDbContext context)
    {
        var suffix = Guid.NewGuid().ToString("N");
        var owner = new Owner
        {
            Id = Guid.NewGuid(),
            Name = "Sanitized HB08B Owner",
            Phone = TestPhone("20"),
            EmergencyPhone = TestPhone("21"),
            CommissionRate = 10m,
            Status = "active",
            PasswordHash = "test-only-hash"
        };
        var project = new Project
        {
            Id = Guid.NewGuid(),
            Name = $"Sanitized HB08B Project {suffix}",
            IsActive = true
        };
        var client = new Client
        {
            Id = Guid.NewGuid(),
            Name = "Sanitized HB08B Client",
            Phone = TestPhone("22"),
            PasswordHash = "test-only-hash",
            IsActive = true
        };
        var admin = new AdminUser
        {
            Id = Guid.NewGuid(),
            Name = "Sanitized HB08B Admin",
            Email = $"hb08b-{suffix}@example.test",
            PasswordHash = "test-only-hash",
            RoleTemplateId = Guid.Parse("10000000-0000-0000-0000-000000000001"),
            IsActive = true
        };
        var unit = new Unit
        {
            Id = Guid.NewGuid(),
            OwnerId = owner.Id,
            ProjectId = project.Id,
            Name = $"Sanitized HB08B Unit {suffix}",
            UnitType = "apartment",
            Bedrooms = 2,
            Bathrooms = 1,
            MaxGuests = 4,
            BasePricePerNight = 1_000m,
            IsActive = true,
            IsVisibleInPortfolio = true
        };

        context.AddRange(owner, project, client, admin, unit);
        await context.SaveChangesAsync();
        return new SeededData(owner, client, admin, unit);
    }

    private static string TestPhone(string prefix)
    {
        var value = BitConverter.ToUInt32(Guid.NewGuid().ToByteArray(), 0) % 10_000_000_000L;
        return $"+{prefix}{value:D10}";
    }

    private sealed record SeededData(Owner Owner, Client Client, AdminUser Admin, Unit Unit);

    private sealed class FixedTimeProvider : TimeProvider
    {
        private readonly DateTimeOffset _utcNow;

        public FixedTimeProvider(DateTimeOffset utcNow)
        {
            _utcNow = utcNow;
        }

        public override DateTimeOffset GetUtcNow() => _utcNow;
    }
}
