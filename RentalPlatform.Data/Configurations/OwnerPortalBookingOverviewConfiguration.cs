using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RentalPlatform.Data.ReadModels;

namespace RentalPlatform.Data.Configurations;

/// <summary>
/// Fluent API configuration for OwnerPortalBookingOverview.
/// Maps to the owner_portal_bookings_overview SQL view.
/// Keyless and read-only — no table, no key, no write path.
/// Column names match the frozen DB view contract exactly (DB-OP-03).
/// </summary>
public sealed class OwnerPortalBookingOverviewConfiguration
    : IEntityTypeConfiguration<OwnerPortalBookingOverview>
{
    public void Configure(EntityTypeBuilder<OwnerPortalBookingOverview> builder)
    {
        builder.ToView("owner_portal_bookings_overview");
        builder.HasNoKey();

        builder.Property(x => x.OwnerId).HasColumnName("owner_id").IsRequired();
        builder.Property(x => x.BookingId).HasColumnName("booking_id").IsRequired();
        builder.Property(x => x.UnitId).HasColumnName("unit_id").IsRequired();
        builder.Property(x => x.ClientId).HasColumnName("client_id").IsRequired();
        builder.Property(x => x.AssignedAdminUserId).HasColumnName("assigned_admin_user_id");
        builder.Property(x => x.BookingStatus).HasColumnName("booking_status").HasMaxLength(50).IsRequired();
        builder.Property(x => x.CheckInDate).HasColumnName("check_in_date").IsRequired();
        builder.Property(x => x.CheckOutDate).HasColumnName("check_out_date").IsRequired();
        builder.Property(x => x.GuestCount).HasColumnName("guest_count").IsRequired();
        builder.Property(x => x.FinalAmount).HasColumnName("final_amount").HasColumnType("decimal(12,2)").IsRequired();
        builder.Property(x => x.Source).HasColumnName("source").HasMaxLength(50).IsRequired();
        builder.Property(x => x.CreatedAt).HasColumnName("created_at").IsRequired();
        builder.Property(x => x.UpdatedAt).HasColumnName("updated_at").IsRequired();
        builder.Ignore(x => x.IsHistorical);
    }
}
