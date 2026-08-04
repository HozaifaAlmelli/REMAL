using System.Linq.Expressions;
using RentalPlatform.Data.Entities;

namespace RentalPlatform.Business.Services;

public static class HistoricalBookingAutomationPolicy
{
    public static Expression<Func<Booking, bool>> AutomaticSideEffectsEligible =>
        booking => !booking.IsHistorical;

    public static bool AllowsAutomaticSideEffects(Booking booking) =>
        !booking.IsHistorical;
}
