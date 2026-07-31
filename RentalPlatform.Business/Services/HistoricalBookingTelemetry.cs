using System.Diagnostics.Metrics;

namespace RentalPlatform.Business.Services;

internal static class HistoricalBookingTelemetry
{
    private static readonly Meter Meter = new("Kaza.Bookings.Historical", "1.0.0");
    private static readonly Counter<long> Created =
        Meter.CreateCounter<long>("historical_booking_created_total");
    private static readonly Counter<long> Rejected =
        Meter.CreateCounter<long>("historical_booking_rejected_total");
    private static readonly Histogram<double> Duration =
        Meter.CreateHistogram<double>("historical_booking_command_duration_seconds");

    public static void RecordSucceeded(double durationSeconds, bool isReplay)
    {
        if (!isReplay)
            Created.Add(1);

        Duration.Record(
            durationSeconds,
            new KeyValuePair<string, object?>("outcome", isReplay ? "replayed" : "created"));
    }

    public static void RecordRejected(string reason, double durationSeconds)
    {
        Rejected.Add(1, new KeyValuePair<string, object?>("reason", reason));
        Duration.Record(durationSeconds, new KeyValuePair<string, object?>("outcome", "rejected"));
    }
}
