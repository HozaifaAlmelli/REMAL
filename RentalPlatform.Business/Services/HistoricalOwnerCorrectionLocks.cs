namespace RentalPlatform.Business.Services;

public static class HistoricalOwnerCorrectionLocks
{
    public static string ForBooking(Guid bookingId) =>
        $"historical-owner-correction:{bookingId:N}";
}
