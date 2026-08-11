using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RentalPlatform.Data.ReadModels;

namespace RentalPlatform.Data.Configurations;

public sealed class ReportingFinanceStayDailySummaryConfiguration
    : IEntityTypeConfiguration<ReportingFinanceStayDailySummary>
{
    public void Configure(EntityTypeBuilder<ReportingFinanceStayDailySummary> builder)
    {
        builder.ToView("reporting_finance_stay_daily_summary");
        builder.HasNoKey();

        builder.Property(x => x.MetricDate).HasColumnName("metric_date").IsRequired();
        builder.Property(x => x.BookingSource).HasColumnName("booking_source").HasMaxLength(50).IsRequired();
        builder.Property(x => x.BookingsWithInvoiceCount).HasColumnName("bookings_with_invoice_count").IsRequired();
        builder.Property(x => x.TotalInvoicedAmount).HasColumnName("total_invoiced_amount").HasPrecision(14, 2).IsRequired();
        builder.Property(x => x.TotalFinalAmount).HasColumnName("total_final_amount").HasPrecision(14, 2).IsRequired();
        builder.Property(x => x.HistoricalBookingsCount).HasColumnName("historical_bookings_count").IsRequired();
        builder.Property(x => x.HistoricalAgreedAmount).HasColumnName("historical_agreed_amount").HasPrecision(14, 2).IsRequired();
        builder.Property(x => x.HistoricalInvoicedAmount).HasColumnName("historical_invoiced_amount").HasPrecision(14, 2).IsRequired();
        builder.Property(x => x.HistoricalBookingsWithInvoiceCount).HasColumnName("historical_bookings_with_invoice_count").IsRequired();
    }
}
