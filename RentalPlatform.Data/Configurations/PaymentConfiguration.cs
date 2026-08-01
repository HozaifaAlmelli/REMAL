using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RentalPlatform.Data.Entities;

namespace RentalPlatform.Data.Configurations;

public class PaymentConfiguration : IEntityTypeConfiguration<Payment>
{
    public void Configure(EntityTypeBuilder<Payment> builder)
    {
        builder.ToTable("payments");

        builder.HasKey(p => p.Id);
        builder.Property(p => p.Id)
            .HasColumnName("id")
            .ValueGeneratedOnAdd();

        builder.Property(p => p.BookingId)
            .HasColumnName("booking_id")
            .IsRequired();

        builder.Property(p => p.InvoiceId)
            .HasColumnName("invoice_id");

        builder.Property(p => p.PaymentStatus)
            .HasColumnName("payment_status")
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(p => p.PaymentMethod)
            .HasColumnName("payment_method")
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(p => p.Amount)
            .HasColumnName("amount")
            .HasColumnType("decimal(12,2)")
            .IsRequired();

        builder.Property(p => p.IsHistoricalRecord)
            .HasColumnName("is_historical_record")
            .HasDefaultValue(false)
            .IsRequired();

        builder.Property(p => p.CreatedByAdminUserId)
            .HasColumnName("created_by_admin_user_id");

        builder.Property(p => p.RecordedReason)
            .HasColumnName("recorded_reason")
            .HasMaxLength(500);

        builder.Property(p => p.ReferenceNumber)
            .HasColumnName("reference_number")
            .HasMaxLength(100);

        builder.Property(p => p.Notes)
            .HasColumnName("notes");

        builder.Property(p => p.PaidAt)
            .HasColumnName("paid_at");

        builder.Property(p => p.CreatedAt)
            .HasColumnName("created_at")
            .IsRequired();

        builder.Property(p => p.UpdatedAt)
            .HasColumnName("updated_at")
            .IsRequired();

        // Relationships
        builder.HasOne(p => p.Booking)
            .WithMany()
            .HasForeignKey(p => p.BookingId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(p => p.Invoice)
            .WithMany(i => i.Payments)
            .HasForeignKey(p => p.InvoiceId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(p => p.CreatedByAdminUser)
            .WithMany()
            .HasForeignKey(p => p.CreatedByAdminUserId)
            .OnDelete(DeleteBehavior.Restrict)
            .HasConstraintName("fk_payments_created_by_admin_user_id");
    }
}
