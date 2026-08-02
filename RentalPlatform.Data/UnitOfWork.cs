using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using RentalPlatform.Data.Entities;
using RentalPlatform.Data.ReadModels;
using RentalPlatform.Data.Repositories;

namespace RentalPlatform.Data;

public class UnitOfWork : IUnitOfWork
{
    private readonly AppDbContext _context;

    public IRepository<Amenity> Amenities { get; }
    public IRepository<Project> Projects { get; }
    public IRepository<AdminUser> AdminUsers { get; }
    public IRepository<RbacRoleTemplate> RbacRoleTemplates { get; }
    public IRepository<RbacRoleTemplatePermission> RbacRoleTemplatePermissions { get; }
    public IRepository<RbacAdminUserPermissionOverride> RbacAdminUserPermissionOverrides { get; }
    public IRepository<Client> Clients { get; }
    public IRepository<Owner> Owners { get; }
    public IRepository<Unit> Units { get; }
    public IRepository<UnitImage> UnitImages { get; }
    public IRepository<UnitAmenity> UnitAmenities { get; }
    public IRepository<SeasonalPricing> SeasonalPricings { get; }
    public IRepository<DateBlock> DateBlocks { get; }
    public IRepository<Booking> Bookings { get; }
    public IRepository<BookingStatusHistory> BookingStatusHistories { get; }
    public IRepository<BookingOriginalSource> BookingOriginalSources { get; }
    public IRepository<IdempotencyKey> IdempotencyKeys { get; }
    public IRepository<HistoricalPaymentIdempotencyKey> HistoricalPaymentIdempotencyKeys { get; }
    public IRepository<HistoricalOwnerAttributionCorrection> HistoricalOwnerAttributionCorrections { get; }
    public IRepository<HistoricalOwnerCorrectionIdempotencyKey> HistoricalOwnerCorrectionIdempotencyKeys { get; }
    public IRepository<CrmLead> CrmLeads { get; }
    public IRepository<CrmNote> CrmNotes { get; }
    public IRepository<CrmAssignment> CrmAssignments { get; }
    public IRepository<Payment> Payments { get; }
    public IRepository<Invoice> Invoices { get; }
    public IRepository<InvoiceItem> InvoiceItems { get; }
    public IRepository<OwnerPayout> OwnerPayouts { get; }

    // Reviews & Ratings
    public IRepository<Review> Reviews { get; }
    public IRepository<ReviewStatusHistory> ReviewStatusHistories { get; }
    public IRepository<UnitReviewSummary> UnitReviewSummaries { get; }
    public IRepository<ReviewReply> ReviewReplies { get; }

    // Notifications & Alerts
    public IRepository<NotificationTemplate> NotificationTemplates { get; }
    public IRepository<Notification> Notifications { get; }
    public IRepository<NotificationDeliveryLog> NotificationDeliveryLogs { get; }
    public IRepository<NotificationPreference> NotificationPreferences { get; }

    // Owner Portal read-model views — AsNoTracking, no write path
    public IQueryable<OwnerPortalUnitOverview> OwnerPortalUnitsOverview
        => _context.OwnerPortalUnitsOverview.AsNoTracking();
    public IQueryable<OwnerPortalBookingOverview> OwnerPortalBookingsOverview
        => _context.OwnerPortalBookingsOverview.AsNoTracking();
    public IQueryable<OwnerPortalFinanceOverview> OwnerPortalFinanceOverview
        => _context.OwnerPortalFinanceOverview.AsNoTracking();

    // Reports & Analytics read-model views — AsNoTracking, no write path
    public IQueryable<ReportingBookingDailySummary> ReportingBookingDailySummaries
        => _context.ReportingBookingDailySummaries.AsNoTracking();
    public IQueryable<ReportingFinanceDailySummary> ReportingFinanceDailySummaries
        => _context.ReportingFinanceDailySummaries.AsNoTracking();
    public IQueryable<ReportingReviewsDailySummary> ReportingReviewsDailySummaries
        => _context.ReportingReviewsDailySummaries.AsNoTracking();
    public IQueryable<ReportingNotificationsDailySummary> ReportingNotificationsDailySummaries
        => _context.ReportingNotificationsDailySummaries.AsNoTracking();

    public UnitOfWork(AppDbContext context)
    {
        _context = context;
        Amenities = new Repository<Amenity>(_context);
        Projects = new Repository<Project>(_context);
        AdminUsers = new Repository<AdminUser>(_context);
        RbacRoleTemplates = new Repository<RbacRoleTemplate>(_context);
        RbacRoleTemplatePermissions = new Repository<RbacRoleTemplatePermission>(_context);
        RbacAdminUserPermissionOverrides = new Repository<RbacAdminUserPermissionOverride>(_context);
        Clients = new Repository<Client>(_context);
        Owners = new Repository<Owner>(_context);
        Units = new Repository<Unit>(_context);
        UnitImages = new Repository<UnitImage>(_context);
        UnitAmenities = new Repository<UnitAmenity>(_context);
        SeasonalPricings = new Repository<SeasonalPricing>(_context);
        DateBlocks = new Repository<DateBlock>(_context);
        Bookings = new Repository<Booking>(_context);
        BookingStatusHistories = new Repository<BookingStatusHistory>(_context);
        BookingOriginalSources = new Repository<BookingOriginalSource>(_context);
        IdempotencyKeys = new Repository<IdempotencyKey>(_context);
        HistoricalPaymentIdempotencyKeys = new Repository<HistoricalPaymentIdempotencyKey>(_context);
        HistoricalOwnerAttributionCorrections = new Repository<HistoricalOwnerAttributionCorrection>(_context);
        HistoricalOwnerCorrectionIdempotencyKeys = new Repository<HistoricalOwnerCorrectionIdempotencyKey>(_context);
        CrmLeads = new Repository<CrmLead>(_context);
        CrmNotes = new Repository<CrmNote>(_context);
        CrmAssignments = new Repository<CrmAssignment>(_context);
        Payments = new Repository<Payment>(_context);
        Invoices = new Repository<Invoice>(_context);
        InvoiceItems = new Repository<InvoiceItem>(_context);
        OwnerPayouts = new Repository<OwnerPayout>(_context);
        Reviews = new Repository<Review>(_context);
        ReviewStatusHistories = new Repository<ReviewStatusHistory>(_context);
        UnitReviewSummaries = new Repository<UnitReviewSummary>(_context);
        ReviewReplies = new Repository<ReviewReply>(_context);
        NotificationTemplates = new Repository<NotificationTemplate>(_context);
        Notifications = new Repository<Notification>(_context);
        NotificationDeliveryLogs = new Repository<NotificationDeliveryLog>(_context);
        NotificationPreferences = new Repository<NotificationPreference>(_context);
    }

    public int SaveChanges()
    {
        return _context.SaveChanges();
    }

    public async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        return await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task<IDbContextTransaction> BeginTransactionAsync(CancellationToken cancellationToken = default)
    {
        return await _context.Database.BeginTransactionAsync(cancellationToken);
    }

    public bool HasActiveTransaction => _context.Database.CurrentTransaction != null;

    public async Task AcquireTransactionAdvisoryLockAsync(
        string resourceKey,
        CancellationToken cancellationToken = default)
    {
        EnsureActiveTransaction();
        await _context.Database.ExecuteSqlInterpolatedAsync(
            $"SELECT pg_advisory_xact_lock(hashtextextended({resourceKey}, 0))",
            cancellationToken);
    }

    public async Task<bool> TryAcquireTransactionAdvisoryLockAsync(
        string resourceKey,
        CancellationToken cancellationToken = default)
    {
        EnsureActiveTransaction();
        return await _context.Database
            .SqlQuery<bool>(
                $"SELECT pg_try_advisory_xact_lock(hashtextextended({resourceKey}, 0)) AS \"Value\"")
            .SingleAsync(cancellationToken);
    }

    public Task ReloadAsync<TEntity>(TEntity entity, CancellationToken cancellationToken = default)
        where TEntity : class
    {
        return _context.Entry(entity).ReloadAsync(cancellationToken);
    }

    private void EnsureActiveTransaction()
    {
        if (!HasActiveTransaction)
            throw new InvalidOperationException(
                "A transaction-scoped advisory lock requires an active database transaction.");
    }
}
