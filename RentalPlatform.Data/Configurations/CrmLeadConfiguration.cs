using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RentalPlatform.Data.Entities;
using RentalPlatform.Shared.Enums;

namespace RentalPlatform.Data.Configurations;

public class CrmLeadConfiguration : IEntityTypeConfiguration<CrmLead>
{
    public void Configure(EntityTypeBuilder<CrmLead> builder)
    {
        builder.ToTable("crm_leads");

        builder.HasKey(e => e.Id);
        
        builder.Property(e => e.Id)
            .HasColumnName("id")
            .ValueGeneratedOnAdd();

        builder.Property(e => e.ClientId)
            .HasColumnName("client_id");

        builder.Property(e => e.TargetUnitId)
            .HasColumnName("target_unit_id");

        builder.Property(e => e.AssignedAdminUserId)
            .HasColumnName("assigned_admin_user_id");

        builder.Property(e => e.ContactName)
            .HasColumnName("contact_name")
            .HasMaxLength(150)
            .IsRequired();

        builder.Property(e => e.ContactPhone)
            .HasColumnName("contact_phone")
            .HasMaxLength(30)
            .IsRequired();

        builder.Property(e => e.ContactEmail)
            .HasColumnName("contact_email")
            .HasMaxLength(255);

        builder.Property(e => e.DesiredCheckInDate)
            .HasColumnName("desired_check_in_date");

        builder.Property(e => e.DesiredCheckOutDate)
            .HasColumnName("desired_check_out_date");

        builder.Property(e => e.GuestCount)
            .HasColumnName("guest_count");

        builder.Property(e => e.LeadStatus)
            .HasColumnName("lead_status")
            .HasMaxLength(50)
            .IsRequired()
            .HasConversion(
                v => v.ToString().ToLower(),
                v => Enum.Parse<LeadStatus>(v, ignoreCase: true));

        builder.Property(e => e.Source)
            .HasColumnName("source")
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(e => e.Notes)
            .HasColumnName("notes");

        builder.Property(e => e.CreatedAt)
            .HasColumnName("created_at")
            .IsRequired();

        builder.Property(e => e.UpdatedAt)
            .HasColumnName("updated_at")
            .IsRequired();

        // Relationships
        builder.HasOne(e => e.Client)
            .WithMany()
            .HasForeignKey(e => e.ClientId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(e => e.TargetUnit)
            .WithMany()
            .HasForeignKey(e => e.TargetUnitId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(e => e.AssignedAdminUser)
            .WithMany()
            .HasForeignKey(e => e.AssignedAdminUserId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
