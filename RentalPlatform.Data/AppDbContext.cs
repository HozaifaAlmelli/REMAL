using System;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using RentalPlatform.Data.Entities;
using RentalPlatform.Data.ReadModels;

namespace RentalPlatform.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }

    public DbSet<Amenity> Amenities { get; set; } = null!;
    public DbSet<Project> Projects { get; set; } = null!;
    public DbSet<AdminUser> AdminUsers { get; set; } = null!;
    public DbSet<RbacRoleTemplate> RbacRoleTemplates { get; set; } = null!;
    public DbSet<RbacRoleTemplatePermission> RbacRoleTemplatePermissions { get; set; } = null!;
    public DbSet<RbacAdminUserPermissionOverride> RbacAdminUserPermissionOverrides { get; set; } = null!;
    public DbSet<Client> Clients { get; set; } = null!;
    public DbSet<Owner> Owners { get; set; } = null!;
    public DbSet<Unit> Units { get; set; } = null!;
    public DbSet<UnitImage> UnitImages { get; set; } = null!;
    public DbSet<UnitAmenity> UnitAmenities { get; set; } = null!;
    public DbSet<SeasonalPricing> SeasonalPricings { get; set; } = null!;
    public DbSet<DateBlock> DateBlocks { get; set; } = null!;
    public DbSet<Booking> Bookings { get; set; } = null!;
    public DbSet<BookingStatusHistory> BookingStatusHistories { get; set; } = null!;
    public DbSet<BookingOriginalSource> BookingOriginalSources { get; set; } = null!;
    public DbSet<IdempotencyKey> IdempotencyKeys { get; set; } = null!;
    public DbSet<CrmLead> CrmLeads { get; set; } = null!;
    public DbSet<CrmNote> CrmNotes { get; set; } = null!;
    public DbSet<CrmAssignment> CrmAssignments { get; set; } = null!;
    public DbSet<Payment> Payments { get; set; } = null!;
    public DbSet<Invoice> Invoices { get; set; } = null!;
    public DbSet<InvoiceItem> InvoiceItems { get; set; } = null!;
    public DbSet<OwnerPayout> OwnerPayouts { get; set; } = null!;

    // Reviews & Ratings
    public DbSet<Review> Reviews { get; set; } = null!;
    public DbSet<ReviewStatusHistory> ReviewStatusHistories { get; set; } = null!;
    public DbSet<UnitReviewSummary> UnitReviewSummaries { get; set; } = null!;
    public DbSet<ReviewReply> ReviewReplies { get; set; } = null!;

    // Notifications & Alerts
    public DbSet<NotificationTemplate> NotificationTemplates { get; set; } = null!;
    public DbSet<Notification> Notifications { get; set; } = null!;
    public DbSet<NotificationDeliveryLog> NotificationDeliveryLogs { get; set; } = null!;
    public DbSet<NotificationPreference> NotificationPreferences { get; set; } = null!;

    // Owner Portal read-model views (keyless, read-only)
    public DbSet<OwnerPortalUnitOverview> OwnerPortalUnitsOverview { get; set; } = null!;
    public DbSet<OwnerPortalBookingOverview> OwnerPortalBookingsOverview { get; set; } = null!;
    public DbSet<OwnerPortalFinanceOverview> OwnerPortalFinanceOverview { get; set; } = null!;

    // Reports & Analytics read-model views (keyless, read-only)
    public DbSet<ReportingBookingDailySummary> ReportingBookingDailySummaries { get; set; } = null!;
    public DbSet<ReportingFinanceDailySummary> ReportingFinanceDailySummaries { get; set; } = null!;
    public DbSet<ReportingReviewsDailySummary> ReportingReviewsDailySummaries { get; set; } = null!;
    public DbSet<ReportingNotificationsDailySummary> ReportingNotificationsDailySummaries { get; set; } = null!;


    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
    }

    public override int SaveChanges()
    {
        ApplyTimestampsAndSoftDelete();
        return base.SaveChanges();
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        ApplyTimestampsAndSoftDelete();
        return base.SaveChangesAsync(cancellationToken);
    }

    private void ApplyTimestampsAndSoftDelete()
    {
        var entries = ChangeTracker.Entries();

        foreach (var entry in entries)
        {
            if (entry.State == EntityState.Added)
            {
                if (entry.Metadata.FindProperty("CreatedAt") != null)
                {
                    entry.Property("CreatedAt").CurrentValue = DateTime.UtcNow;
                }
                
                if (entry.Metadata.FindProperty("UpdatedAt") != null)
                {
                    entry.Property("UpdatedAt").CurrentValue = DateTime.UtcNow;
                }
            }
            else if (entry.State == EntityState.Modified)
            {
                if (entry.Metadata.FindProperty("UpdatedAt") != null)
                {
                    entry.Property("UpdatedAt").CurrentValue = DateTime.UtcNow;
                }
            }
            else if (entry.State == EntityState.Deleted)
            {
                if (entry.Entity is Client || entry.Entity is Owner || entry.Entity is Unit)
                {
                    entry.State = EntityState.Modified;
                    
                    if (entry.Metadata.FindProperty("DeletedAt") != null)
                    {
                        entry.Property("DeletedAt").CurrentValue = DateTime.UtcNow;
                    }

                    if (entry.Metadata.FindProperty("UpdatedAt") != null)
                    {
                        entry.Property("UpdatedAt").CurrentValue = DateTime.UtcNow;
                    }
                }
            }
        }
    }
}
