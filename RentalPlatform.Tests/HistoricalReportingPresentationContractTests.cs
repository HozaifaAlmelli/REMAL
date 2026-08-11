using System.Reflection;
using RentalPlatform.API.DTOs.Responses.Bookings;
using RentalPlatform.API.DTOs.Responses.OwnerPortal;
using RentalPlatform.API.DTOs.Responses.Payments;
using RentalPlatform.Tests.Infrastructure;
using Xunit;

namespace RentalPlatform.Tests;

[Trait(TestCategories.Name, TestCategories.Fast)]
public sealed class HistoricalReportingPresentationContractTests
{
    [Fact]
    public void BookingReadResponsesExposeCanonicalHistoricalMetadata()
    {
        AssertProperty<bool>(typeof(BookingListItemResponse), "IsHistorical");
        AssertProperty<bool>(typeof(BookingDetailsResponse), "IsHistorical");
        AssertProperty<DateOnly?>(typeof(BookingDetailsResponse), "ActualBookedAt");
        AssertProperty<string>(typeof(BookingDetailsResponse), "OriginalSource");
        AssertProperty<string>(typeof(BookingDetailsResponse), "HistoricalEntryReason");
        AssertProperty<decimal?>(typeof(BookingDetailsResponse), "AgreedAmount");
    }

    [Fact]
    public void PaymentAndOwnerReadsExposeHistoricalClassificationWithoutWriteFields()
    {
        AssertProperty<bool>(typeof(PaymentResponse), "IsHistoricalRecord");
        AssertProperty<bool>(typeof(OwnerPortalBookingResponse), "IsHistorical");

        var ownerProperties = typeof(OwnerPortalBookingResponse)
            .GetProperties(BindingFlags.Public | BindingFlags.Instance)
            .Select(property => property.Name)
            .ToHashSet(StringComparer.Ordinal);
        Assert.DoesNotContain("OriginalSource", ownerProperties);
        Assert.DoesNotContain("HistoricalEntryReason", ownerProperties);
        Assert.DoesNotContain("AgreedAmount", ownerProperties);
        Assert.DoesNotContain("HistoricalPaymentEvidenceAmount", ownerProperties);
    }

    private static void AssertProperty<T>(Type type, string name)
    {
        var property = type.GetProperty(name, BindingFlags.Public | BindingFlags.Instance);
        Assert.NotNull(property);
        Assert.Equal(typeof(T), property.PropertyType);
    }
}
