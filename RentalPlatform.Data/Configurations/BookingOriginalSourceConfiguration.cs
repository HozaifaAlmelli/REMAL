using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RentalPlatform.Data.Entities;

namespace RentalPlatform.Data.Configurations;

public sealed class BookingOriginalSourceConfiguration : IEntityTypeConfiguration<BookingOriginalSource>
{
    public void Configure(EntityTypeBuilder<BookingOriginalSource> builder)
    {
        builder.ToTable("booking_original_sources");
        builder.HasKey(source => source.Code);
        builder.Property(source => source.Code).HasColumnName("code").HasMaxLength(50);
        builder.Property(source => source.Label).HasColumnName("label").HasMaxLength(100).IsRequired();
        builder.Property(source => source.IsActive).HasColumnName("is_active").IsRequired();
        builder.Property(source => source.CreatedAt).HasColumnName("created_at").IsRequired();
        builder.Property(source => source.UpdatedAt).HasColumnName("updated_at").IsRequired();
    }
}
