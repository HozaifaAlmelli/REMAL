using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RentalPlatform.Data.ReadModels;

namespace RentalPlatform.Data.Configurations;

/// <summary>
/// Fluent API configuration for ReportingFinanceDailySummary.
/// Maps to the reporting_finance_daily_summary SQL view.
/// Keyless and read-only — no table, no key, no write path.
/// Column names match the frozen DB view contract exactly (DB-RA-03).
/// </summary>
public sealed class ReportingFinanceDailySummaryConfiguration
    : IEntityTypeConfiguration<ReportingFinanceDailySummary>
{
    public void Configure(EntityTypeBuilder<ReportingFinanceDailySummary> builder)
    {
        builder.ToView("reporting_finance_daily_summary");
        builder.HasNoKey();

        builder.Property(x => x.MetricDate)
            .HasColumnName("metric_date")
            .IsRequired();

        builder.Property(x => x.BookingsWithInvoiceCount)
            .HasColumnName("bookings_with_invoice_count")
            .IsRequired();

        builder.Property(x => x.TotalInvoicedAmount)
            .HasColumnName("total_invoiced_amount")
            .HasPrecision(14, 2)
            .IsRequired();

        builder.Property(x => x.TotalPaidAmount)
            .HasColumnName("total_paid_amount")
            .HasPrecision(14, 2)
            .IsRequired();

        builder.Property(x => x.TotalRemainingAmount)
            .HasColumnName("total_remaining_amount")
            .HasPrecision(14, 2)
            .IsRequired();

        builder.Property(x => x.TotalPendingPayoutAmount)
            .HasColumnName("total_pending_payout_amount")
            .HasPrecision(14, 2)
            .IsRequired();

        builder.Property(x => x.TotalScheduledPayoutAmount)
            .HasColumnName("total_scheduled_payout_amount")
            .HasPrecision(14, 2)
            .IsRequired();

        builder.Property(x => x.TotalPaidPayoutAmount)
            .HasColumnName("total_paid_payout_amount")
            .HasPrecision(14, 2)
            .IsRequired();

        builder.Property(x => x.HistoricalBookingsWithInvoiceCount)
            .HasColumnName("historical_bookings_with_invoice_count")
            .IsRequired();

        builder.Property(x => x.HistoricalInvoicedAmount)
            .HasColumnName("historical_invoiced_amount")
            .HasPrecision(14, 2)
            .IsRequired();

        builder.Property(x => x.HistoricalInvoiceLinkedPaidAmount)
            .HasColumnName("historical_invoice_linked_paid_amount")
            .HasPrecision(14, 2)
            .IsRequired();

        builder.Property(x => x.HistoricalRemainingAmount)
            .HasColumnName("historical_remaining_amount")
            .HasPrecision(14, 2)
            .IsRequired();

        builder.Property(x => x.OrdinaryOrphanPaymentCount)
            .HasColumnName("ordinary_orphan_payment_count")
            .IsRequired();

        builder.Property(x => x.OrdinaryOrphanPaymentAmount)
            .HasColumnName("ordinary_orphan_payment_amount")
            .HasPrecision(14, 2)
            .IsRequired();

        builder.Property(x => x.HistoricalBookingOrdinaryOrphanPaymentCount)
            .HasColumnName("historical_booking_ordinary_orphan_payment_count")
            .IsRequired();

        builder.Property(x => x.HistoricalBookingOrdinaryOrphanPaymentAmount)
            .HasColumnName("historical_booking_ordinary_orphan_payment_amount")
            .HasPrecision(14, 2)
            .IsRequired();

        builder.Property(x => x.HistoricalPaymentEvidenceCount)
            .HasColumnName("historical_payment_evidence_count")
            .IsRequired();

        builder.Property(x => x.HistoricalPaymentEvidenceAmount)
            .HasColumnName("historical_payment_evidence_amount")
            .HasPrecision(14, 2)
            .IsRequired();

        builder.Property(x => x.HistoricalAgreedAmount)
            .HasColumnName("historical_agreed_amount")
            .HasPrecision(14, 2)
            .IsRequired();
    }
}
