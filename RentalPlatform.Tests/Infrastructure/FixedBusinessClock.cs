using System;
using RentalPlatform.Business.Time;

namespace RentalPlatform.Tests.Infrastructure;

/// <summary>
/// Deterministic Cairo business clock for tests. REQ-16 / HB-08B boundary assertions must never
/// depend on the wall clock of the machine running the suite.
/// </summary>
public sealed class FixedBusinessClock : IBusinessClock
{
    private DateOnly _today;

    public FixedBusinessClock(DateOnly today)
    {
        _today = today;
    }

    public DateOnly CairoToday() => _today;

    public void SetToday(DateOnly today) => _today = today;
}
