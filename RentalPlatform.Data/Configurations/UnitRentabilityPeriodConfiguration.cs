using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RentalPlatform.Data.Entities;

namespace RentalPlatform.Data.Configurations;

public sealed class UnitRentabilityPeriodConfiguration : IEntityTypeConfiguration<UnitRentabilityPeriod>
{
    public void Configure(EntityTypeBuilder<UnitRentabilityPeriod> builder)
    {
        builder.ToTable("unit_rentability_periods");
        builder.HasKey(x => x.Id);

        builder.Property(x => x.Id).HasColumnName("id").ValueGeneratedNever();
        builder.Property(x => x.UnitId).HasColumnName("unit_id").IsRequired();
        builder.Property(x => x.EffectiveFromDate).HasColumnName("effective_from_date").IsRequired();
        builder.Property(x => x.EffectiveToDate).HasColumnName("effective_to_date");
        builder.Property(x => x.IsRentable).HasColumnName("is_rentable").IsRequired();
        builder.Property(x => x.ResolvedReason).HasColumnName("resolved_reason").HasMaxLength(40).IsRequired();
        builder.Property(x => x.RevisionId).HasColumnName("revision_id").IsRequired();
        builder.Property(x => x.ChangeSourceType).HasColumnName("change_source_type").HasMaxLength(50).IsRequired();
        builder.Property(x => x.ChangeSourceId).HasColumnName("change_source_id");
        builder.Property(x => x.ActorType).HasColumnName("actor_type").HasMaxLength(30);
        builder.Property(x => x.ActorId).HasColumnName("actor_id");
        builder.Property(x => x.RecordedAt).HasColumnName("recorded_at").IsRequired();
        builder.Property(x => x.SupersededAt).HasColumnName("superseded_at");
        builder.Property(x => x.SupersededByRevisionId).HasColumnName("superseded_by_revision_id");

        builder.HasOne(x => x.Unit)
            .WithMany()
            .HasForeignKey(x => x.UnitId)
            .OnDelete(DeleteBehavior.Restrict)
            .HasConstraintName("fk_unit_rentability_periods_unit_id");
    }
}
