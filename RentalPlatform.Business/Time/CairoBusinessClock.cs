namespace RentalPlatform.Business.Time;

public sealed class CairoBusinessClock : IBusinessClock
{
    private static readonly TimeZoneInfo CairoTimeZone = ResolveCairoTimeZone();
    private readonly TimeProvider _timeProvider;

    public CairoBusinessClock(TimeProvider timeProvider)
    {
        _timeProvider = timeProvider;
    }

    public DateOnly CairoToday()
    {
        var utcNow = _timeProvider.GetUtcNow().UtcDateTime;
        var cairoNow = TimeZoneInfo.ConvertTimeFromUtc(utcNow, CairoTimeZone);
        return DateOnly.FromDateTime(cairoNow);
    }

    private static TimeZoneInfo ResolveCairoTimeZone()
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
}
