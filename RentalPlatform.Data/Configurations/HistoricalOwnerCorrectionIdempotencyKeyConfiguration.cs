using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RentalPlatform.Data.Entities;

namespace RentalPlatform.Data.Configurations;

public sealed class HistoricalOwnerCorrectionIdempotencyKeyConfiguration
    : IEntityTypeConfiguration<HistoricalOwnerCorrectionIdempotencyKey>
{
    public void Configure(EntityTypeBuilder<HistoricalOwnerCorrectionIdempotencyKey> builder)
    {
        builder.ToTable("historical_owner_correction_idempotency_keys");
        builder.HasKey(item => new { item.ActorAdminUserId, item.Endpoint, item.Key });
        builder.Property(item => item.ActorAdminUserId).HasColumnName("actor_admin_user_id");
        builder.Property(item => item.Endpoint).HasColumnName("endpoint").HasMaxLength(200).IsRequired();
        builder.Property(item => item.Key).HasColumnName("key").IsRequired();
        builder.Property(item => item.RequestHash).HasColumnName("request_hash").HasMaxLength(64).IsRequired();
        builder.Property(item => item.CorrectionId).HasColumnName("correction_id");
        builder.Property(item => item.ResponseStatus).HasColumnName("response_status");
        builder.Property(item => item.ResponseWarningCodes)
            .HasColumnName("response_warning_codes")
            .HasColumnType("text[]")
            .HasDefaultValueSql("ARRAY[]::text[]")
            .IsRequired();
        builder.Property(item => item.CreatedAt).HasColumnName("created_at").IsRequired();
        builder.Property(item => item.CompletedAt).HasColumnName("completed_at");

        builder.HasOne(item => item.ActorAdminUser)
            .WithMany()
            .HasForeignKey(item => item.ActorAdminUserId)
            .OnDelete(DeleteBehavior.Restrict)
            .HasConstraintName("fk_historical_owner_correction_idempotency_actor");
        builder.HasOne(item => item.Correction)
            .WithMany()
            .HasForeignKey(item => item.CorrectionId)
            .OnDelete(DeleteBehavior.Restrict)
            .HasConstraintName("fk_historical_owner_correction_idempotency_correction");

        builder.HasIndex(item => item.CorrectionId)
            .IsUnique()
            .HasFilter("correction_id IS NOT NULL")
            .HasDatabaseName("ux_historical_owner_correction_idempotency_correction_id");

        builder.ToTable(table =>
        {
            table.HasCheckConstraint(
                "ck_historical_owner_correction_idempotency_hash",
                "request_hash ~ '^[0-9a-f]{64}$'");
            table.HasCheckConstraint(
                "ck_historical_owner_correction_idempotency_completion",
                "(correction_id IS NULL AND response_status IS NULL AND completed_at IS NULL " +
                "AND cardinality(response_warning_codes) = 0) OR " +
                "(correction_id IS NOT NULL AND response_status = 200 AND completed_at IS NOT NULL)");
            table.HasCheckConstraint(
                "ck_historical_owner_correction_idempotency_warnings",
                "array_position(response_warning_codes, NULL) IS NULL AND " +
                "response_warning_codes <@ ARRAY['TARGET_OWNER_INACTIVE']::text[] AND " +
                "cardinality(response_warning_codes) <= 1");
        });
    }
}
