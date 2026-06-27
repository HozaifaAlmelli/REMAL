using System;
using System.Collections.Generic;
using RentalPlatform.Shared.Enums;

namespace RentalPlatform.Shared.Constants;

public static class BookingStatusTransitions
{
    private static readonly Dictionary<BookingStatus, BookingStatus[]> AllowedTransitions = new()
    {
        { BookingStatus.Prospecting,  new[] { BookingStatus.Relevant, BookingStatus.NoAnswer, BookingStatus.NotRelevant } },
        { BookingStatus.Relevant,     new[] { BookingStatus.Booked, BookingStatus.NoAnswer, BookingStatus.NotRelevant } },
        { BookingStatus.NoAnswer,     new[] { BookingStatus.Relevant, BookingStatus.NotRelevant } },
        { BookingStatus.Booked,       new[] { BookingStatus.Confirmed, BookingStatus.NotRelevant } },
        { BookingStatus.Confirmed,    new[] { BookingStatus.CheckIn, BookingStatus.Cancelled } },
        { BookingStatus.CheckIn,      new[] { BookingStatus.Completed, BookingStatus.LeftEarly } },
        { BookingStatus.NotRelevant,  Array.Empty<BookingStatus>() },
        { BookingStatus.Completed,    Array.Empty<BookingStatus>() },
        { BookingStatus.Cancelled,    Array.Empty<BookingStatus>() },
        { BookingStatus.LeftEarly,    Array.Empty<BookingStatus>() },
    };

    public static bool IsValidTransition(BookingStatus from, BookingStatus to)
    {
        if (from == to) return false;
        return AllowedTransitions.TryGetValue(from, out var targets) && Array.IndexOf(targets, to) >= 0;
    }

    public static BookingStatus[] GetAllowedTargets(BookingStatus from)
    {
        return AllowedTransitions.TryGetValue(from, out var targets) ? targets : Array.Empty<BookingStatus>();
    }

    public static bool IsTerminal(BookingStatus status)
    {
        return AllowedTransitions.TryGetValue(status, out var targets) && targets.Length == 0;
    }

    public static readonly BookingStatus[] HoldingStatuses = { BookingStatus.Booked, BookingStatus.Confirmed, BookingStatus.CheckIn };

    // Booking statuses for which financial documents (invoices) and payments may be created.
    // A financial relationship only exists once a booking is real: it excludes pre-booking
    // CRM leads (Prospecting/Relevant/NoAnswer) and dead records (NotRelevant/Cancelled).
    // Completed/LeftEarly stay eligible so post-stay balances can still be settled.
    public static readonly BookingStatus[] FinanceEligibleStatuses =
    {
        BookingStatus.Booked,
        BookingStatus.Confirmed,
        BookingStatus.CheckIn,
        BookingStatus.Completed,
        BookingStatus.LeftEarly,
    };

    public static bool IsFinanceEligible(BookingStatus status)
    {
        return Array.IndexOf(FinanceEligibleStatuses, status) >= 0;
    }
}
