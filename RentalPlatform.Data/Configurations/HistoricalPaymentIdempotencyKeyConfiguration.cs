using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RentalPlatform.Data.Entities;

namespace RentalPlatform.Data.Configurations;

public sealed class HistoricalPaymentIdempotencyKeyConfiguration
    : IEntityTypeConfiguration<HistoricalPaymentIdempotencyKey>
{
    public void Configure(EntityTypeBuilder<HistoricalPaymentIdempotencyKey> builder)
    {
        builder.ToTable("historical_payment_idempotency_keys");
        builder.HasKey(item => new { item.ActorAdminUserId, item.Endpoint, item.Key });
        builder.Property(item => item.ActorAdminUserId).HasColumnName("actor_admin_user_id");
        builder.Property(item => item.Endpoint).HasColumnName("endpoint").HasMaxLength(200).IsRequired();
        builder.Property(item => item.Key).HasColumnName("key").IsRequired();
        builder.Property(item => item.RequestHash).HasColumnName("request_hash").HasMaxLength(64).IsRequired();
        builder.Property(item => item.PaymentId).HasColumnName("payment_id");
        builder.Property(item => item.ResponseStatus).HasColumnName("response_status");
        builder.Property(item => item.CreatedAt).HasColumnName("created_at").IsRequired();
        builder.Property(item => item.CompletedAt).HasColumnName("completed_at");

        builder.HasOne(item => item.ActorAdminUser)
            .WithMany()
            .HasForeignKey(item => item.ActorAdminUserId)
            .OnDelete(DeleteBehavior.Restrict)
            .HasConstraintName("fk_historical_payment_idempotency_actor");

        builder.HasOne(item => item.Payment)
            .WithMany()
            .HasForeignKey(item => item.PaymentId)
            .OnDelete(DeleteBehavior.Restrict)
            .HasConstraintName("fk_historical_payment_idempotency_payment");
    }
}
