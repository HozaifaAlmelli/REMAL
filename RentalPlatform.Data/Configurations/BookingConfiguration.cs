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
                v => v.ToString().ToLower(),
                v => Enum.Parse<BookingStatus>(v, ignoreCase: true));

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

        builder.Property(b => b.CreatedAt)
            .HasColumnName("created_at")
            .IsRequired();

        builder.Property(b => b.UpdatedAt)
            .HasColumnName("updated_at")
            .IsRequired();

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
