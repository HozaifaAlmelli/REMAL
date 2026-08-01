namespace RentalPlatform.Shared.Constants;

public static class BookingHistoryEvents
{
    public const string BookingCreated = "Booking created";

    public const string HistoricalBookingRecorded =
        "Historical booking recorded after the stay had already completed.";

    public const string AutomaticCompletion =
        "Automatically completed on the first scheduled sweep after the checkout day ended in Cairo.";

    public const string HistoricalPaymentRecorded = "HistoricalPaymentRecorded";

    public static string HistoricalPaymentRecordedFor(Guid paymentId) =>
        $"{HistoricalPaymentRecorded}:{paymentId:D}";
}
