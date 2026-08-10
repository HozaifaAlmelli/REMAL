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

        builder.Property(x => x.StayMonth).HasColumnName("stay_month").IsRequired();
        builder.Property(x => x.RecordedMonth).HasColumnName("recorded_month").IsRequired();
        builder.Property(x => x.ActualBookedMonth).HasColumnName("actual_booked_month").IsRequired();
        builder.Property(x => x.OriginalSource).HasColumnName("original_source").HasMaxLength(50).IsRequired();
        builder.Property(x => x.HistoricalBookingsCount).HasColumnName("historical_bookings_count").IsRequired();
        builder.Property(x => x.HistoricalAgreedAmount).HasColumnName("historical_agreed_amount").HasPrecision(14, 2).IsRequired();
        builder.Property(x => x.EntryLagDaysP50).HasColumnName("entry_lag_days_p50").HasPrecision(10, 2).IsRequired();
        builder.Property(x => x.EntryLagDaysMax).HasColumnName("entry_lag_days_max").IsRequired();
        builder.Property(x => x.InvoiceCount).HasColumnName("invoice_count").IsRequired();
        builder.Property(x => x.InvoicedAmount).HasColumnName("invoiced_amount").HasPrecision(14, 2).IsRequired();
        builder.Property(x => x.InvoiceLinkedPaidAmount).HasColumnName("invoice_linked_paid_amount").HasPrecision(14, 2).IsRequired();
        builder.Property(x => x.HistoricalPaymentEvidenceCount).HasColumnName("historical_payment_evidence_count").IsRequired();
        builder.Property(x => x.HistoricalPaymentEvidenceAmount).HasColumnName("historical_payment_evidence_amount").HasPrecision(14, 2).IsRequired();
        builder.Property(x => x.HistoricalPaymentEvidenceFirstPaidDate).HasColumnName("historical_payment_evidence_first_paid_date");
        builder.Property(x => x.HistoricalPaymentEvidenceLastPaidDate).HasColumnName("historical_payment_evidence_last_paid_date");
    }
}
