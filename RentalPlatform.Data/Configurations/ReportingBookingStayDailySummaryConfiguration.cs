using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RentalPlatform.Data.ReadModels;

namespace RentalPlatform.Data.Configurations;

public sealed class ReportingBookingStayDailySummaryConfiguration
    : IEntityTypeConfiguration<ReportingBookingStayDailySummary>
{
    public void Configure(EntityTypeBuilder<ReportingBookingStayDailySummary> builder)
    {
        builder.ToView("reporting_booking_stay_daily_summary");
        builder.HasNoKey();

        builder.Property(x => x.MetricDate).HasColumnName("metric_date").IsRequired();
        builder.Property(x => x.BookingSource).HasColumnName("booking_source").HasMaxLength(50).IsRequired();
        builder.Property(x => x.BookingsCount).HasColumnName("bookings_count").IsRequired();
        builder.Property(x => x.ProspectingBookingsCount).HasColumnName("prospecting_bookings_count").IsRequired();
        builder.Property(x => x.ConfirmedBookingsCount).HasColumnName("confirmed_bookings_count").IsRequired();
        builder.Property(x => x.CancelledBookingsCount).HasColumnName("cancelled_bookings_count").IsRequired();
        builder.Property(x => x.CompletedBookingsCount).HasColumnName("completed_bookings_count").IsRequired();
        builder.Property(x => x.TotalFinalAmount).HasColumnName("total_final_amount").HasPrecision(14, 2).IsRequired();
        builder.Property(x => x.HistoricalBookingsCount).HasColumnName("historical_bookings_count").IsRequired();
        builder.Property(x => x.HistoricalProspectingBookingsCount).HasColumnName("historical_prospecting_bookings_count").IsRequired();
        builder.Property(x => x.HistoricalConfirmedBookingsCount).HasColumnName("historical_confirmed_bookings_count").IsRequired();
        builder.Property(x => x.HistoricalCancelledBookingsCount).HasColumnName("historical_cancelled_bookings_count").IsRequired();
        builder.Property(x => x.HistoricalCompletedBookingsCount).HasColumnName("historical_completed_bookings_count").IsRequired();
        builder.Property(x => x.HistoricalFinalAmount).HasColumnName("historical_final_amount").HasPrecision(14, 2).IsRequired();
        builder.Property(x => x.HistoricalAgreedAmount).HasColumnName("historical_agreed_amount").HasPrecision(14, 2).IsRequired();
    }
}
