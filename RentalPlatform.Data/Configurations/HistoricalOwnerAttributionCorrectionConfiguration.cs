using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RentalPlatform.Data.Entities;

namespace RentalPlatform.Data.Configurations;

public sealed class HistoricalOwnerAttributionCorrectionConfiguration
    : IEntityTypeConfiguration<HistoricalOwnerAttributionCorrection>
{
    public void Configure(EntityTypeBuilder<HistoricalOwnerAttributionCorrection> builder)
    {
        builder.ToTable("historical_owner_attribution_corrections");
        builder.HasKey(item => item.Id);
        builder.Property(item => item.Id).HasColumnName("id").ValueGeneratedNever();
        builder.Property(item => item.BookingId).HasColumnName("booking_id").IsRequired();
        builder.Property(item => item.PreviousOwnerId).HasColumnName("previous_owner_id").IsRequired();
        builder.Property(item => item.TargetOwnerId).HasColumnName("target_owner_id").IsRequired();
        builder.Property(item => item.CorrectedByAdminUserId)
            .HasColumnName("corrected_by_admin_user_id")
            .IsRequired();
        builder.Property(item => item.Reason).HasColumnName("reason").HasMaxLength(50).IsRequired();
        builder.Property(item => item.Note).HasColumnName("note").HasMaxLength(500);
        builder.Property(item => item.CorrectedAt).HasColumnName("corrected_at").IsRequired();

        builder.HasOne(item => item.Booking)
            .WithMany()
            .HasForeignKey(item => item.BookingId)
            .OnDelete(DeleteBehavior.Restrict)
            .HasConstraintName("fk_historical_owner_corrections_booking");
        builder.HasOne(item => item.PreviousOwner)
            .WithMany()
            .HasForeignKey(item => item.PreviousOwnerId)
            .OnDelete(DeleteBehavior.Restrict)
            .HasConstraintName("fk_historical_owner_corrections_previous_owner");
        builder.HasOne(item => item.TargetOwner)
            .WithMany()
            .HasForeignKey(item => item.TargetOwnerId)
            .OnDelete(DeleteBehavior.Restrict)
            .HasConstraintName("fk_historical_owner_corrections_target_owner");
        builder.HasOne(item => item.CorrectedByAdminUser)
            .WithMany()
            .HasForeignKey(item => item.CorrectedByAdminUserId)
            .OnDelete(DeleteBehavior.Restrict)
            .HasConstraintName("fk_historical_owner_corrections_actor");

        builder.HasIndex(item => new { item.BookingId, item.CorrectedAt, item.Id })
            .HasDatabaseName("ix_historical_owner_corrections_booking_chain");
        builder.HasIndex(item => item.PreviousOwnerId)
            .HasDatabaseName("ix_historical_owner_corrections_previous_owner_id");
        builder.HasIndex(item => item.TargetOwnerId)
            .HasDatabaseName("ix_historical_owner_corrections_target_owner_id");
        builder.HasIndex(item => item.CorrectedByAdminUserId)
            .HasDatabaseName("ix_historical_owner_corrections_actor_id");

        builder.ToTable(table =>
        {
            table.HasCheckConstraint(
                "ck_historical_owner_correction_owner_change",
                "previous_owner_id <> target_owner_id");
            table.HasCheckConstraint(
                "ck_historical_owner_correction_reason",
                "reason IN ('ownership_changed_after_stay', 'booking_belonged_to_previous_owner_agreement', 'accounting_reconciliation', 'other')");
            table.HasCheckConstraint(
                "ck_historical_owner_correction_note",
                "note IS NULL OR (length(btrim(note)) BETWEEN 1 AND 500 AND note = btrim(note))");
            table.HasCheckConstraint(
                "ck_historical_owner_correction_other_note",
                "reason <> 'other' OR note IS NOT NULL");
        });
    }
}
