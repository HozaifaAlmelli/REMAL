using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RentalPlatform.Data.Entities;

namespace RentalPlatform.Data.Configurations;

public sealed class IdempotencyKeyConfiguration : IEntityTypeConfiguration<IdempotencyKey>
{
    public void Configure(EntityTypeBuilder<IdempotencyKey> builder)
    {
        builder.ToTable("idempotency_keys");
        builder.HasKey(item => new { item.ActorAdminUserId, item.Endpoint, item.Key });
        builder.Property(item => item.ActorAdminUserId).HasColumnName("actor_admin_user_id");
        builder.Property(item => item.Endpoint).HasColumnName("endpoint").IsRequired();
        builder.Property(item => item.Key).HasColumnName("key").IsRequired();
        builder.Property(item => item.RequestHash).HasColumnName("request_hash").IsRequired();
        builder.Property(item => item.ResponseStatus).HasColumnName("response_status");
        builder.Property(item => item.BookingId).HasColumnName("booking_id");
        builder.Property(item => item.CreatedAt).HasColumnName("created_at").IsRequired();
        builder.Property(item => item.CompletedAt).HasColumnName("completed_at");

        builder.HasOne(item => item.ActorAdminUser)
            .WithMany()
            .HasForeignKey(item => item.ActorAdminUserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(item => item.Booking)
            .WithMany()
            .HasForeignKey(item => item.BookingId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
