using System.Reflection;
using RentalPlatform.Business.Interfaces;
using RentalPlatform.Business.Services;
using RentalPlatform.Data.Entities;
using Xunit;

namespace RentalPlatform.Tests;

[Trait(TestCategories.Name, TestCategories.Fast)]
public sealed class HistoricalNotificationIsolationTests
{
    [Fact]
    public void PersistedHistoricalIdentityControlsAutomaticSideEffectEligibility()
    {
        var ordinary = new Booking { IsHistorical = false };
        var historical = new Booking { IsHistorical = true };
        var predicate = HistoricalBookingAutomationPolicy.AutomaticSideEffectsEligible.Compile();

        Assert.True(HistoricalBookingAutomationPolicy.AllowsAutomaticSideEffects(ordinary));
        Assert.True(predicate(ordinary));
        Assert.False(HistoricalBookingAutomationPolicy.AllowsAutomaticSideEffects(historical));
        Assert.False(predicate(historical));
    }

    [Fact]
    public void HistoricalCommandsHaveNoAutomaticSideEffectWriterDependencies()
    {
        var forbidden = new[]
        {
            typeof(INotificationService),
            typeof(INotificationDispatchService),
            typeof(IInvoiceService),
            typeof(IOwnerPayoutService)
        };
        var commandServices = new[]
        {
            typeof(HistoricalBookingService),
            typeof(HistoricalPaymentService),
            typeof(HistoricalOwnerAttributionService)
        };

        foreach (var service in commandServices)
        {
            var dependencies = service.GetConstructors(BindingFlags.Public | BindingFlags.Instance)
                .SelectMany(constructor => constructor.GetParameters())
                .Select(parameter => parameter.ParameterType)
                .ToArray();
            Assert.Empty(dependencies.Intersect(forbidden));
        }
    }

    [Fact]
    public async Task EveryAutomaticBookingSideEffectCallSiteUsesTheHistoricalPolicy()
    {
        var root = RepositoryRoot();
        var lifecycle = await File.ReadAllTextAsync(Path.Combine(
            root, "RentalPlatform.Business", "Services", "BookingLifecycleService.cs"));
        var sweep = await File.ReadAllTextAsync(Path.Combine(
            root, "RentalPlatform.API", "Services", "AutoCompleteBookingsJob.cs"));

        Assert.Equal(
            2,
            lifecycle.Split(
                "HistoricalBookingAutomationPolicy.AllowsAutomaticSideEffects(booking)",
                StringSplitOptions.None).Length - 1);
        Assert.Contains(
            "HistoricalBookingAutomationPolicy.AutomaticSideEffectsEligible",
            sweep,
            StringComparison.Ordinal);
        Assert.Contains(
            "HistoricalBookingAutomationPolicy.AllowsAutomaticSideEffects(booking)",
            sweep,
            StringComparison.Ordinal);
    }

    [Fact]
    public async Task HistoricalPortalClientHasNoNotificationOrIntegrationWriteSurface()
    {
        var root = RepositoryRoot();
        var client = await File.ReadAllTextAsync(Path.Combine(
            root,
            "rental-platform",
            "lib",
            "api",
            "services",
            "historical-bookings.service.ts"));
        var wizard = await File.ReadAllTextAsync(Path.Combine(
            root,
            "rental-platform",
            "components",
            "admin",
            "bookings",
            "historical",
            "HistoricalBookingWizard.tsx"));
        var inspected = string.Concat(client, wizard).ToLowerInvariant();

        foreach (var forbidden in new[]
        {
            "/notifications",
            "/invoices",
            "/payouts",
            "/crm",
            "/webhooks",
            "/accounting",
            "analytics.track"
        })
        {
            Assert.DoesNotContain(forbidden, inspected, StringComparison.Ordinal);
        }
    }

    private static string RepositoryRoot() =>
        Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", ".."));
}
