using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RentalPlatform.Data.Entities;

namespace RentalPlatform.Data.Configurations;

public class OwnerPayoutConfiguration : IEntityTypeConfiguration<OwnerPayout>
{
    public void Configure(EntityTypeBuilder<OwnerPayout> builder)
    {
        builder.ToTable("owner_payouts");

        builder.HasKey(op => op.Id);
        builder.Property(op => op.Id)
            .HasColumnName("id")
            .ValueGeneratedOnAdd();

        builder.Property(op => op.BookingId)
            .HasColumnName("booking_id")
            .IsRequired();

        builder.HasIndex(op => op.BookingId)
            .IsUnique();

        builder.Property(op => op.OwnerId)
            .HasColumnName("owner_id")
            .IsRequired();

        builder.Property(op => op.PayoutStatus)
            .HasColumnName("payout_status")
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(op => op.GrossBookingAmount)
            .HasColumnName("gross_booking_amount")
            .HasColumnType("decimal(12,2)")
            .IsRequired();

        builder.Property(op => op.CommissionRate)
            .HasColumnName("commission_rate")
            .HasColumnType("decimal(5,2)")
            .IsRequired();

        builder.Property(op => op.CommissionAmount)
            .HasColumnName("commission_amount")
            .HasColumnType("decimal(12,2)")
            .IsRequired();

        builder.Property(op => op.PayoutAmount)
            .HasColumnName("payout_amount")
            .HasColumnType("decimal(12,2)")
            .IsRequired();

        builder.Property(op => op.ScheduledAt)
            .HasColumnName("scheduled_at");

        builder.Property(op => op.PaidAt)
            .HasColumnName("paid_at");

        builder.Property(op => op.ProofOfPaymentUrl)
            .HasColumnName("proof_of_payment_url");

        builder.Property(op => op.Notes)
            .HasColumnName("notes");

        builder.Property(op => op.CreatedAt)
            .HasColumnName("created_at")
            .IsRequired();

        builder.Property(op => op.UpdatedAt)
            .HasColumnName("updated_at")
            .IsRequired();

        // Relationships
        builder.HasOne(op => op.Booking)
            .WithMany()
            .HasForeignKey(op => op.BookingId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(op => op.Owner)
            .WithMany()
            .HasForeignKey(op => op.OwnerId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
