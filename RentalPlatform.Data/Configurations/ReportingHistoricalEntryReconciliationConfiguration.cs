using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RentalPlatform.Data.ReadModels;

namespace RentalPlatform.Data.Configurations;

public sealed class ReportingHistoricalEntryReconciliationConfiguration
    : IEntityTypeConfiguration<ReportingHistoricalEntryReconciliation>
{
    public void Configure(EntityTypeBuilder<ReportingHistoricalEntryReconciliation> builder)
    {
        builder.ToView("reporting_historical_entry_reconciliation");
        builder.HasNoKey();

        builder.Property(x => x.BookingId).HasColumnName("booking_id").IsRequired();
        builder.Property(x => x.RecordedAt).HasColumnName("recorded_at").IsRequired();
        builder.Property(x => x.ActualBookedAt).HasColumnName("actual_booked_at").IsRequired();
        builder.Property(x => x.EntryLagDays).HasColumnName("entry_lag_days").IsRequired();
        builder.Property(x => x.StayStart).HasColumnName("stay_start").IsRequired();
        builder.Property(x => x.StayEnd).HasColumnName("stay_end").IsRequired();
        builder.Property(x => x.StayNights).HasColumnName("stay_nights").IsRequired();
        builder.Property(x => x.BookingSource).HasColumnName("booking_source").HasMaxLength(50).IsRequired();
        builder.Property(x => x.OriginalSource).HasColumnName("original_source").HasMaxLength(50).IsRequired();
        builder.Property(x => x.HistoricalEntryReason).HasColumnName("historical_entry_reason").HasMaxLength(50).IsRequired();
        builder.Property(x => x.BookingStatus).HasColumnName("booking_status").HasMaxLength(50).IsRequired();
        builder.Property(x => x.UnitId).HasColumnName("unit_id").IsRequired();
        builder.Property(x => x.OwnerId).HasColumnName("owner_id").IsRequired();
        builder.Property(x => x.AgreedAmount).HasColumnName("agreed_amount").HasPrecision(14, 2).IsRequired();
        builder.Property(x => x.ActiveInvoiceAmount).HasColumnName("active_invoice_amount").HasPrecision(14, 2).IsRequired();
        builder.Property(x => x.OrdinaryInvoiceLinkedPaidAmount).HasColumnName("ordinary_invoice_linked_paid_amount").HasPrecision(14, 2).IsRequired();
        builder.Property(x => x.OrdinaryUnlinkedPaidCount).HasColumnName("ordinary_unlinked_paid_count").IsRequired();
        builder.Property(x => x.OrdinaryUnlinkedPaidAmount).HasColumnName("ordinary_unlinked_paid_amount").HasPrecision(14, 2).IsRequired();
        builder.Property(x => x.HistoricalPaymentEvidenceCount).HasColumnName("historical_payment_evidence_count").IsRequired();
        builder.Property(x => x.HistoricalPaymentEvidenceAmount).HasColumnName("historical_payment_evidence_amount").HasPrecision(14, 2).IsRequired();
        builder.Property(x => x.FirstEvidencePaidDate).HasColumnName("first_evidence_paid_date");
        builder.Property(x => x.LastEvidencePaidDate).HasColumnName("last_evidence_paid_date");
        builder.Property(x => x.OwnerAttributionCorrectionCount).HasColumnName("owner_attribution_correction_count").IsRequired();
        builder.Property(x => x.LastOwnerAttributionCorrectedAt).HasColumnName("last_owner_attribution_corrected_at");
    }
}
