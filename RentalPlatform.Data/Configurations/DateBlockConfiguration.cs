using System;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RentalPlatform.Data.Entities;
using RentalPlatform.Shared.Enums;

namespace RentalPlatform.Data.Configurations;

public class DateBlockConfiguration : IEntityTypeConfiguration<DateBlock>
{
    public void Configure(EntityTypeBuilder<DateBlock> builder)
    {
        builder.ToTable("date_blocks");

        builder.HasKey(x => x.Id);

        builder.Property(x => x.Id)
            .HasColumnName("id")
            .ValueGeneratedOnAdd();
        
        builder.Property(x => x.UnitId)
            .HasColumnName("unit_id")
            .IsRequired();
            
        builder.Property(x => x.StartDate)
            .HasColumnName("start_date")
            .IsRequired();

        builder.Property(x => x.EndDate)
            .HasColumnName("end_date")
            .IsRequired();

        builder.Property(x => x.Reason)
            .HasColumnName("reason")
            .HasMaxLength(100);

        builder.Property(x => x.Notes)
            .HasColumnName("notes");

        builder.Property(x => x.Status)
            .HasColumnName("status")
            .HasMaxLength(20)
            .IsRequired()
            .HasConversion(
                v => v == DateBlockStatus.PendingApproval
                    ? "pending_approval"
                    : v.ToString().ToLowerInvariant(),
                v => v == "pending_approval"
                    ? DateBlockStatus.PendingApproval
                    : (DateBlockStatus)Enum.Parse(typeof(DateBlockStatus), v, true));

        builder.Property(x => x.RequiresAdminSignoff)
            .HasColumnName("requires_admin_signoff")
            .IsRequired();

        builder.Property(x => x.ConflictingLeadId)
            .HasColumnName("conflicting_lead_id");

        builder.Property(x => x.ConflictingBookingId)
            .HasColumnName("conflicting_booking_id");

        builder.Property(x => x.ResolvedByAdminUserId)
            .HasColumnName("resolved_by_admin_user_id");

        builder.Property(x => x.ResolvedAt)
            .HasColumnName("resolved_at");

        builder.Property(x => x.DeletedAt)
            .HasColumnName("deleted_at");

        builder.Property(x => x.CreatedAt)
            .HasColumnName("created_at")
            .IsRequired();

        builder.Property(x => x.UpdatedAt)
            .HasColumnName("updated_at")
            .IsRequired();

        builder.HasOne(x => x.Unit)
            .WithMany(u => u.DateBlocks)
            .HasForeignKey(x => x.UnitId)
            .OnDelete(DeleteBehavior.Cascade)
            .HasConstraintName("fk_date_blocks_unit_id");

        builder.HasOne(x => x.ConflictingLead)
            .WithMany()
            .HasForeignKey(x => x.ConflictingLeadId)
            .OnDelete(DeleteBehavior.SetNull)
            .HasConstraintName("fk_date_blocks_conflicting_lead_id");

        builder.HasOne(x => x.ConflictingBooking)
            .WithMany()
            .HasForeignKey(x => x.ConflictingBookingId)
            .OnDelete(DeleteBehavior.SetNull)
            .HasConstraintName("fk_date_blocks_conflicting_booking_id");

        builder.HasOne(x => x.ResolvedByAdminUser)
            .WithMany()
            .HasForeignKey(x => x.ResolvedByAdminUserId)
            .OnDelete(DeleteBehavior.SetNull)
            .HasConstraintName("fk_date_blocks_resolved_by_admin_user_id");
    }
}
