using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore.Storage;
using RentalPlatform.Data.Entities;
using RentalPlatform.Data.ReadModels;
using RentalPlatform.Data.Repositories;

namespace RentalPlatform.Data;

public interface IUnitOfWork
{
    IRepository<Amenity> Amenities { get; }
    IRepository<Project> Projects { get; }
    IRepository<AdminUser> AdminUsers { get; }
    IRepository<RbacRoleTemplate> RbacRoleTemplates { get; }
    IRepository<RbacRoleTemplatePermission> RbacRoleTemplatePermissions { get; }
    IRepository<RbacAdminUserPermissionOverride> RbacAdminUserPermissionOverrides { get; }
    IRepository<Client> Clients { get; }
    IRepository<Owner> Owners { get; }
    IRepository<Unit> Units { get; }
    IRepository<UnitImage> UnitImages { get; }
    IRepository<UnitAmenity> UnitAmenities { get; }
    IRepository<SeasonalPricing> SeasonalPricings { get; }
    IRepository<DateBlock> DateBlocks { get; }
    IRepository<Booking> Bookings { get; }
    IRepository<BookingStatusHistory> BookingStatusHistories { get; }
    IRepository<BookingOriginalSource> BookingOriginalSources { get; }
    IRepository<IdempotencyKey> IdempotencyKeys { get; }
    IRepository<HistoricalPaymentIdempotencyKey> HistoricalPaymentIdempotencyKeys { get; }
    IRepository<HistoricalOwnerAttributionCorrection> HistoricalOwnerAttributionCorrections { get; }
    IRepository<HistoricalOwnerCorrectionIdempotencyKey> HistoricalOwnerCorrectionIdempotencyKeys { get; }
    IRepository<CrmLead> CrmLeads { get; }
    IRepository<CrmNote> CrmNotes { get; }
    IRepository<CrmAssignment> CrmAssignments { get; }
    IRepository<Payment> Payments { get; }
    IRepository<Invoice> Invoices { get; }
    IRepository<InvoiceItem> InvoiceItems { get; }
    IRepository<OwnerPayout> OwnerPayouts { get; }
    IRepository<RentableCapacityLedger> RentableCapacityLedgers { get; }
    IRepository<UnitRentabilityPeriod> UnitRentabilityPeriods { get; }

    // Reviews & Ratings
    IRepository<Review> Reviews { get; }
    IRepository<ReviewStatusHistory> ReviewStatusHistories { get; }
    IRepository<UnitReviewSummary> UnitReviewSummaries { get; }
    IRepository<ReviewReply> ReviewReplies { get; }

    // Notifications & Alerts
    IRepository<NotificationTemplate> NotificationTemplates { get; }
    IRepository<Notification> Notifications { get; }
    IRepository<NotificationDeliveryLog> NotificationDeliveryLogs { get; }
    IRepository<NotificationPreference> NotificationPreferences { get; }

    // Owner Portal read-model views — IQueryable only, no write path
    IQueryable<OwnerPortalUnitOverview> OwnerPortalUnitsOverview { get; }
    IQueryable<OwnerPortalBookingOverview> OwnerPortalBookingsOverview { get; }
    IQueryable<OwnerPortalFinanceOverview> OwnerPortalFinanceOverview { get; }

    // Reports & Analytics read-model views — IQueryable only, no write path
    IQueryable<ReportingBookingDailySummary> ReportingBookingDailySummaries { get; }
    IQueryable<ReportingFinanceDailySummary> ReportingFinanceDailySummaries { get; }
    IQueryable<ReportingBookingStayDailySummary> ReportingBookingStayDailySummaries { get; }
    IQueryable<ReportingFinanceStayDailySummary> ReportingFinanceStayDailySummaries { get; }
    IQueryable<ReportingHistoricalEntryReconciliation> ReportingHistoricalEntryReconciliations { get; }
    IQueryable<ReportingReviewsDailySummary> ReportingReviewsDailySummaries { get; }
    IQueryable<ReportingNotificationsDailySummary> ReportingNotificationsDailySummaries { get; }

    int SaveChanges();
    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Begins an explicit database transaction. All subsequent SaveChangesAsync calls
    /// participate in the transaction; call CommitAsync/RollbackAsync on the returned
    /// IDbContextTransaction to finalise or abort.
    /// </summary>
    Task<IDbContextTransaction> BeginTransactionAsync(CancellationToken cancellationToken = default);

    bool HasActiveTransaction { get; }

    Task AcquireTransactionAdvisoryLockAsync(
        string resourceKey,
        CancellationToken cancellationToken = default);

    Task AcquireSharedTransactionAdvisoryLockAsync(
        string resourceKey,
        CancellationToken cancellationToken = default);

    Task<bool> TryAcquireTransactionAdvisoryLockAsync(
        string resourceKey,
        CancellationToken cancellationToken = default);

    Task ReloadAsync<TEntity>(TEntity entity, CancellationToken cancellationToken = default)
        where TEntity : class;
}
