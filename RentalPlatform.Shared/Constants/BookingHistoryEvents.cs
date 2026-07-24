namespace RentalPlatform.Shared.Constants;

public static class BookingHistoryEvents
{
    public const string BookingCreated = "Booking created";

    public const string AutomaticCompletion =
        "Automatically completed on the first scheduled sweep after the checkout day ended in Cairo.";
}
