using System.Diagnostics.Metrics;

namespace RentalPlatform.Business.Services;

/// <summary>
/// REQ-16 / HB-08B rejection counter for the ordinary booking flow.
/// Tag values are a fixed vocabulary only — never guest, client or free-text data.
/// </summary>
internal static class BookingCreationTelemetry
{
    private static readonly Meter Meter = new("Kaza.Bookings", "1.0.0");

    private static readonly Counter<long> Rejected =
        Meter.CreateCounter<long>("booking_create_rejected_total");

    public static void RecordRejected(string reason, string operation)
    {
        Rejected.Add(
            1,
            new KeyValuePair<string, object?>("reason", reason),
            new KeyValuePair<string, object?>("operation", operation));
    }
}
