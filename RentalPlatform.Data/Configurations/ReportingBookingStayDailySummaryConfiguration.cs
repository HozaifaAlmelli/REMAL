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

        builder.Property(x => x.StayStartDate).HasColumnName("stay_start_date").IsRequired();
        builder.Property(x => x.BookingSource).HasColumnName("booking_source").HasMaxLength(50).IsRequired();
        builder.Property(x => x.StayBookingsCount).HasColumnName("stay_bookings_count").IsRequired();
        builder.Property(x => x.ProspectingBookingsCount).HasColumnName("prospecting_bookings_count").IsRequired();
        builder.Property(x => x.ConfirmedBookingsCount).HasColumnName("confirmed_bookings_count").IsRequired();
        builder.Property(x => x.CancelledBookingsCount).HasColumnName("cancelled_bookings_count").IsRequired();
        builder.Property(x => x.CompletedBookingsCount).HasColumnName("completed_bookings_count").IsRequired();
        builder.Property(x => x.TotalFinalAmount).HasColumnName("total_final_amount").HasPrecision(14, 2).IsRequired();
        builder.Property(x => x.HistoricalBookingsCount).HasColumnName("historical_bookings_count").IsRequired();
        builder.Property(x => x.HistoricalAgreedAmount).HasColumnName("historical_agreed_amount").HasPrecision(14, 2).IsRequired();
        builder.Property(x => x.HistoricalLegacySystemBookingsCount).HasColumnName("historical_legacy_system_bookings_count").IsRequired();
        builder.Property(x => x.HistoricalExternalPlatformBookingsCount).HasColumnName("historical_external_platform_bookings_count").IsRequired();
        builder.Property(x => x.HistoricalOfflineRecordBookingsCount).HasColumnName("historical_offline_record_bookings_count").IsRequired();
        builder.Property(x => x.HistoricalOtherSourceBookingsCount).HasColumnName("historical_other_source_bookings_count").IsRequired();
    }
}
