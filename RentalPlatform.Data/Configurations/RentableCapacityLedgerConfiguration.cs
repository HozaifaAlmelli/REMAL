using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RentalPlatform.Data.Entities;

namespace RentalPlatform.Data.Configurations;

public sealed class RentableCapacityLedgerConfiguration : IEntityTypeConfiguration<RentableCapacityLedger>
{
    public void Configure(EntityTypeBuilder<RentableCapacityLedger> builder)
    {
        builder.ToTable("rentable_capacity_ledger");
        builder.HasKey(x => x.Id);

        builder.Property(x => x.Id).HasColumnName("id").ValueGeneratedNever();
        builder.Property(x => x.Scope).HasColumnName("scope").HasMaxLength(20).IsRequired();
        builder.Property(x => x.PublicationStatus).HasColumnName("publication_status").HasMaxLength(20).IsRequired();
        builder.Property(x => x.CoverageStartDate).HasColumnName("coverage_start_date");
        builder.Property(x => x.PublishedAt).HasColumnName("published_at");
        builder.Property(x => x.PublishedByAdminUserId).HasColumnName("published_by_admin_user_id");
        builder.Property(x => x.CreatedAt).HasColumnName("created_at").IsRequired();
        builder.Property(x => x.UpdatedAt).HasColumnName("updated_at").IsRequired();
    }
}
