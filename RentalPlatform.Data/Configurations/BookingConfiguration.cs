using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RentalPlatform.Data.Entities;
using RentalPlatform.Shared.Enums;

namespace RentalPlatform.Data.Configurations;

public class BookingConfiguration : IEntityTypeConfiguration<Booking>
{
    public void Configure(EntityTypeBuilder<Booking> builder)
    {
        builder.ToTable("bookings");

        builder.HasKey(b => b.Id);
        builder.Property(b => b.Id)
            .HasColumnName("id")
            .ValueGeneratedOnAdd();

        builder.Property(b => b.ClientId)
            .HasColumnName("client_id")
            .IsRequired();

        builder.Property(b => b.UnitId)
            .HasColumnName("unit_id")
            .IsRequired();

        builder.Property(b => b.OwnerId)
            .HasColumnName("owner_id")
            .IsRequired();

        builder.Property(b => b.AssignedAdminUserId)
            .HasColumnName("assigned_admin_user_id");

        builder.Property(b => b.BookingStatus)
            .HasColumnName("booking_status")
            .HasMaxLength(50)
            .IsRequired()
            .HasConversion(
                v => v.ToString().ToLower(), // Store as lowercase to match DB CHECK constraint
                v => Enum.Parse<BookingStatus>(v, true)); // true = ignoreCase

        builder.Property(b => b.CheckInDate)
            .HasColumnName("check_in_date")
            .IsRequired();

        builder.Property(b => b.CheckOutDate)
            .HasColumnName("check_out_date")
            .IsRequired();

        builder.Property(b => b.GuestCount)
            .HasColumnName("guest_count")
            .IsRequired();

        builder.Property(b => b.BaseAmount)
            .HasColumnName("base_amount")
            .HasColumnType("decimal(12,2)")
            .IsRequired();

        builder.Property(b => b.FinalAmount)
            .HasColumnName("final_amount")
            .HasColumnType("decimal(12,2)")
            .IsRequired();

        builder.Property(b => b.Source)
            .HasColumnName("source")
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(b => b.InternalNotes)
            .HasColumnName("internal_notes");

        builder.Property(b => b.IsHistorical)
            .HasColumnName("is_historical")
            .HasDefaultValue(false)
            .IsRequired();

        builder.Property(b => b.ActualBookedAt)
            .HasColumnName("actual_booked_at");

        builder.Property(b => b.HistoricalEntryReason)
            .HasColumnName("historical_entry_reason")
            .HasMaxLength(50);

        builder.Property(b => b.OriginalSource)
            .HasColumnName("original_source")
            .HasMaxLength(50);

        builder.Property(b => b.ExternalReference)
            .HasColumnName("external_reference")
            .HasMaxLength(100);

        builder.Property(b => b.CreatedAt)
            .HasColumnName("created_at")
            .IsRequired();

        builder.Property(b => b.UpdatedAt)
            .HasColumnName("updated_at")
            .IsRequired();

        // PostgreSQL's built-in xmin column provides optimistic concurrency
        // without adding application schema.
        builder.Property<uint>("xmin")
            .IsRowVersion();

        // Relationships
        builder.HasOne(b => b.Client)
            .WithMany() // Assuming Client entity doesn't have a Bookings collection yet, or it does but it's not defined here. 
            .HasForeignKey(b => b.ClientId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(b => b.Unit)
            .WithMany()
            .HasForeignKey(b => b.UnitId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(b => b.Owner)
            .WithMany()
            .HasForeignKey(b => b.OwnerId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(b => b.AssignedAdminUser)
            .WithMany()
            .HasForeignKey(b => b.AssignedAdminUserId)
            .OnDelete(DeleteBehavior.SetNull);

    }
}
