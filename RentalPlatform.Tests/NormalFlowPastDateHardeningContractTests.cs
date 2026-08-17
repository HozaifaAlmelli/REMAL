using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using RentalPlatform.API.DTOs.Requests.Bookings;
using RentalPlatform.Business.Interfaces;
using RentalPlatform.Business.Services;
using RentalPlatform.Business.Time;
using RentalPlatform.Shared.Constants;
using Xunit;

namespace RentalPlatform.Tests;

/// <summary>
/// REQ-16 / HB-08B contract assertions that need no database:
/// the error code, the fixed rejection wording, the absence of any bypass surface
/// (<c>NAC-HB01-01</c>, <c>NAC-HB08-15</c>) and the single Cairo business-date definition
/// (<c>AC-HB01-04</c>, <c>AC-HB01-05</c>).
/// </summary>
[Trait(TestCategories.Name, TestCategories.Fast)]
public sealed class NormalFlowPastDateHardeningContractTests
{
    private static readonly string[] BypassWords =
    {
        "bypass", "skip", "ignore", "force", "override", "historical", "past", "backdate", "allowpast"
    };

    [Fact]
    public void StayDatesInPastIsPartOfTheRatifiedPublicErrorContract()
    {
        Assert.Equal("STAY_DATES_IN_PAST", HistoricalErrorCodes.StayDatesInPast);
        Assert.Contains(HistoricalErrorCodes.StayDatesInPast, HistoricalErrorCodes.All);
    }

    // AC-HB01-09 — the wording is fixed so the API, the portal and the operator documentation
    // cannot diverge, and it names the Historical Booking flow as the correct route.
    [Fact]
    public void TheRejectionMessageNamesTheHistoricalBookingFlow()
    {
        Assert.Equal(
            "Check-in date cannot be earlier than the current business date in Cairo. "
            + "A stay that has already happened must be recorded through the Historical Booking flow.",
            BookingService.StayDatesInPastMessage);
    }

    // NAC-HB08-15 / NAC-HB01-01 — no creation or update entry point accepts anything a caller
    // could use to switch the past-date rule off.
    [Fact]
    public void NoOrdinaryBookingEntryPointExposesAPastDateBypass()
    {
        var methods = new[]
        {
            nameof(IBookingService.CreateAsync),
            nameof(IBookingService.CreateQuickAsync),
            nameof(IBookingService.UpdatePendingAsync)
        };

        foreach (var name in methods)
        {
            var method = typeof(IBookingService).GetMethod(name);
            Assert.NotNull(method);
            foreach (var parameter in method!.GetParameters())
            {
                if (parameter.ParameterType != typeof(bool) && parameter.ParameterType != typeof(bool?))
                    continue;

                Assert.DoesNotContain(BypassWords, word => Contains(parameter.Name, word));
            }
        }
    }

    // The ordinary request contracts carry no field that reaches the rule at all. The historical
    // route stays a separate command behind its own permission (HB-01 §11.2.5).
    [Fact]
    public void OrdinaryBookingRequestContractsCarryNoRuleInfluencingField()
    {
        var ordinaryRequests = new[]
        {
            typeof(CreateBookingRequest),
            typeof(UpdatePendingBookingRequest),
            typeof(CreateClientBookingRequest),
            typeof(CreateGuestBookingRequest)
        };

        foreach (var request in ordinaryRequests)
        {
            foreach (var property in request.GetProperties(BindingFlags.Public | BindingFlags.Instance))
            {
                Assert.DoesNotContain(BypassWords, word => Contains(property.Name, word));
            }
        }
    }

    // AC-HB01-04 / AC-HB01-05 — the extracted resolver is behaviour-identical to the expression
    // AutoCompleteBookingsJob used to compute inline, including across both 2026 Egypt DST
    // transitions. The completed-stay boundary and the past-date rule therefore cannot drift.
    [Theory]
    [InlineData("2026-01-15T00:00:00Z")]
    [InlineData("2026-04-23T21:59:59Z")]
    [InlineData("2026-04-23T22:00:00Z")]
    [InlineData("2026-07-31T20:59:59Z")]
    [InlineData("2026-07-31T21:00:00Z")]
    [InlineData("2026-10-29T20:59:59Z")]
    [InlineData("2026-10-29T22:00:01Z")]
    [InlineData("2026-12-31T21:59:59Z")]
    [InlineData("2026-12-31T22:00:00Z")]
    public void TheSharedResolverMatchesTheLegacyInlineCairoExpression(string utcInstant)
    {
        var instant = DateTimeOffset.Parse(utcInstant, null, System.Globalization.DateTimeStyles.RoundtripKind);

        // The expression AutoCompleteBookingsJob carried before the refactor.
        var legacy = DateOnly.FromDateTime(
            TimeZoneInfo.ConvertTimeFromUtc(instant.UtcDateTime, LegacyCairoTimeZone()));

        var shared = new CairoBusinessClock(new FixedTimeProvider(instant)).CairoToday();

        Assert.Equal(legacy, shared);
    }

    private static bool Contains(string? value, string word) =>
        value is not null && value.Contains(word, StringComparison.OrdinalIgnoreCase);

    private static TimeZoneInfo LegacyCairoTimeZone()
    {
        try
        {
            return TimeZoneInfo.FindSystemTimeZoneById("Africa/Cairo");
        }
        catch (TimeZoneNotFoundException)
        {
            return TimeZoneInfo.FindSystemTimeZoneById("Egypt Standard Time");
        }
    }

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
