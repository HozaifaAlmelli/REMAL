using Microsoft.EntityFrameworkCore;
using RentalPlatform.Business.Exceptions;
using RentalPlatform.Business.Interfaces;
using RentalPlatform.Data;
using RentalPlatform.Data.Entities;
using RentalPlatform.Shared.Constants;
using RentalPlatform.Shared.Enums;

namespace RentalPlatform.API.Services;

public class AutoCompleteBookingsJob : BackgroundService
{
    private const string InAppChannel = "in_app";
    private const string OutstandingBalanceTemplateCode = "BOOKING_COMPLETED_WITH_BALANCE";
    private const string SweepLockKey = "job:auto-complete-bookings";
    private const string FinanceManagePermission = "finance:manage";
    private static readonly TimeSpan RunAtUtcTime = TimeSpan.FromHours(2);
    private static readonly TimeZoneInfo CairoTimeZone = ResolveCairoTimeZone();

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<AutoCompleteBookingsJob> _logger;

    public AutoCompleteBookingsJob(
        IServiceScopeFactory scopeFactory,
        ILogger<AutoCompleteBookingsJob> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            var delay = GetDelayUntilNextRun(DateTime.UtcNow);

            try
            {
                await Task.Delay(delay, stoppingToken);
                await RunSweepAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                return;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Automatic booking completion sweep failed.");
            }
        }
    }

    private static TimeSpan GetDelayUntilNextRun(DateTime utcNow)
    {
        var nextRun = utcNow.Date.Add(RunAtUtcTime);
        if (nextRun <= utcNow)
            nextRun = nextRun.AddDays(1);

        return nextRun - utcNow;
    }

    private async Task RunSweepAsync(CancellationToken cancellationToken)
    {
        using var scope = _scopeFactory.CreateScope();
        var unitOfWork = scope.ServiceProvider.GetRequiredService<IUnitOfWork>();
        var notificationService = scope.ServiceProvider.GetRequiredService<INotificationService>();

        var now = DateTime.UtcNow;
        var cairoNow = TimeZoneInfo.ConvertTimeFromUtc(now, CairoTimeZone);
        var completedAfterCheckoutCutoff = DateOnly.FromDateTime(cairoNow).AddDays(-1);

        await using var transaction = await unitOfWork.BeginTransactionAsync(cancellationToken);
        var ownsSweep = await unitOfWork.TryAcquireTransactionAdvisoryLockAsync(
            SweepLockKey,
            cancellationToken);
        if (!ownsSweep)
        {
            _logger.LogInformation(
                "Skipped automatic booking completion because another replica owns the sweep lock.");
            return;
        }

        var bookings = await unitOfWork.Bookings.Query()
            .Include(b => b.Client)
            .Include(b => b.Unit)
            .Where(b => b.BookingStatus == BookingStatus.CheckIn)
            .Where(b => b.CheckOutDate <= completedAfterCheckoutCutoff)
            .ToListAsync(cancellationToken);

        foreach (var booking in bookings)
        {
            var oldStatus = booking.BookingStatus;
            booking.BookingStatus = BookingStatus.Completed;
            booking.UpdatedAt = now;

            await unitOfWork.BookingStatusHistories.AddAsync(
                new BookingStatusHistory
                {
                    Id = Guid.NewGuid(),
                    BookingId = booking.Id,
                    OldStatus = oldStatus.ToString().ToLower(),
                    NewStatus = BookingStatus.Completed.ToString().ToLower(),
                    ChangedByAdminUserId = null,
                    Notes = BookingHistoryEvents.AutomaticCompletion,
                    ChangedAt = now
                },
                cancellationToken);
        }

        if (bookings.Count == 0)
        {
            await transaction.CommitAsync(cancellationToken);
            return;
        }

        await unitOfWork.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        foreach (var booking in bookings)
        {
            await NotifyAdminsIfOutstandingBalanceAsync(
                unitOfWork,
                notificationService,
                booking,
                cancellationToken);
        }

        _logger.LogInformation(
            "Automatically completed {BookingCount} past-due booking(s).",
            bookings.Count);
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

    private async Task NotifyAdminsIfOutstandingBalanceAsync(
        IUnitOfWork unitOfWork,
        INotificationService notificationService,
        Booking booking,
        CancellationToken cancellationToken)
    {
        var activeInvoice = await unitOfWork.Invoices.Query()
            .Where(i => i.BookingId == booking.Id)
            .Where(i => i.InvoiceStatus != "cancelled" && i.InvoiceStatus != "superseded")
            .FirstOrDefaultAsync(cancellationToken);

        var paidAmount = await unitOfWork.Payments.Query()
            .Where(p => p.BookingId == booking.Id && p.PaymentStatus == "paid")
            .SumAsync(p => p.Amount, cancellationToken);

        var balanceBasis = activeInvoice?.TotalAmount ?? booking.FinalAmount;
        var outstandingAmount = balanceBasis - paidAmount;

        if (outstandingAmount <= 0)
            return;

        var adminQuery = unitOfWork.AdminUsers.Query()
            .Where(a => a.IsActive)
            .Where(a =>
                (booking.AssignedAdminUserId.HasValue && a.Id == booking.AssignedAdminUserId.Value) ||
                (a.RoleTemplate != null &&
                 a.RoleTemplate.IsActive &&
                 !a.PermissionOverrides.Any(entry =>
                     entry.PermissionKey == FinanceManagePermission &&
                     entry.ModifierType == "deny") &&
                 (a.RoleTemplate.Permissions.Any(permission =>
                      permission.PermissionKey == FinanceManagePermission) ||
                  a.PermissionOverrides.Any(entry =>
                      entry.PermissionKey == FinanceManagePermission &&
                      entry.ModifierType == "grant"))));

        var admins = await adminQuery.ToListAsync(cancellationToken);
        if (admins.Count == 0)
        {
            _logger.LogWarning(
                "Booking {BookingId} was auto-completed with outstanding balance {OutstandingAmount}, but no active admin recipients were found.",
                booking.Id,
                outstandingAmount);
            return;
        }

        var variables = new Dictionary<string, string>
        {
            ["booking_id"] = booking.Id.ToString(),
            ["booking_short_id"] = booking.Id.ToString()[..8].ToUpperInvariant(),
            ["client_name"] = booking.Client?.Name ?? "Client",
            ["unit_name"] = booking.Unit?.Name ?? "Unit",
            ["check_out_date"] = booking.CheckOutDate.ToString("yyyy-MM-dd"),
            ["outstanding_amount"] = outstandingAmount.ToString("N2")
        };

        foreach (var admin in admins.GroupBy(a => a.Id).Select(g => g.First()))
        {
            try
            {
                await notificationService.CreateForAdminAsync(
                    OutstandingBalanceTemplateCode,
                    InAppChannel,
                    admin.Id,
                    variables,
                    scheduledAt: null,
                    cancellationToken);
            }
            catch (Exception ex) when (ex is NotFoundException or BusinessValidationException or ConflictException)
            {
                _logger.LogWarning(
                    ex,
                    "Could not create outstanding-balance notification for admin {AdminUserId} after auto-completing booking {BookingId}.",
                    admin.Id,
                    booking.Id);
            }
        }
    }
}
