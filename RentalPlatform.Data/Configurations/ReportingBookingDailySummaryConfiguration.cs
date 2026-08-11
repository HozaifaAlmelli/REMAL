using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RentalPlatform.Data.ReadModels;

namespace RentalPlatform.Data.Configurations;

/// <summary>
/// Fluent API configuration for ReportingBookingDailySummary.
/// Maps to the reporting_booking_daily_summary SQL view.
/// Keyless and read-only — no table, no key, no write path.
/// Column names match the frozen DB view contract exactly (DB-RA-02).
/// </summary>
public sealed class ReportingBookingDailySummaryConfiguration
    : IEntityTypeConfiguration<ReportingBookingDailySummary>
{
    public void Configure(EntityTypeBuilder<ReportingBookingDailySummary> builder)
    {
        builder.ToView("reporting_booking_daily_summary");
        builder.HasNoKey();

        builder.Property(x => x.MetricDate)
            .HasColumnName("metric_date")
            .IsRequired();

        builder.Property(x => x.BookingSource)
            .HasColumnName("booking_source")
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(x => x.BookingsCreatedCount)
            .HasColumnName("bookings_created_count")
            .IsRequired();

        builder.Property(x => x.ProspectingBookingsCount)
            .HasColumnName("prospecting_bookings_count")
            .IsRequired();

        builder.Property(x => x.ConfirmedBookingsCount)
            .HasColumnName("confirmed_bookings_count")
            .IsRequired();

        builder.Property(x => x.CancelledBookingsCount)
            .HasColumnName("cancelled_bookings_count")
            .IsRequired();

        builder.Property(x => x.CompletedBookingsCount)
            .HasColumnName("completed_bookings_count")
            .IsRequired();

        builder.Property(x => x.TotalFinalAmount)
            .HasColumnName("total_final_amount")
            .HasPrecision(14, 2)
            .IsRequired();

        builder.Property(x => x.HistoricalBookingsCount)
            .HasColumnName("historical_bookings_count")
            .IsRequired();

        builder.Property(x => x.HistoricalProspectingBookingsCount)
            .HasColumnName("historical_prospecting_bookings_count")
            .IsRequired();

        builder.Property(x => x.HistoricalConfirmedBookingsCount)
            .HasColumnName("historical_confirmed_bookings_count")
            .IsRequired();

        builder.Property(x => x.HistoricalCancelledBookingsCount)
            .HasColumnName("historical_cancelled_bookings_count")
            .IsRequired();

        builder.Property(x => x.HistoricalCompletedBookingsCount)
            .HasColumnName("historical_completed_bookings_count")
            .IsRequired();

        builder.Property(x => x.HistoricalFinalAmount)
            .HasColumnName("historical_final_amount")
            .HasPrecision(14, 2)
            .IsRequired();

        builder.Property(x => x.HistoricalAgreedAmount)
            .HasColumnName("historical_agreed_amount")
            .HasPrecision(14, 2)
            .IsRequired();
        builder.Property(x => x.HistoricalLegacySystemBookingsCount)
            .HasColumnName("historical_legacy_system_bookings_count").IsRequired();
        builder.Property(x => x.HistoricalExternalPlatformBookingsCount)
            .HasColumnName("historical_external_platform_bookings_count").IsRequired();
        builder.Property(x => x.HistoricalOfflineRecordBookingsCount)
            .HasColumnName("historical_offline_record_bookings_count").IsRequired();
        builder.Property(x => x.HistoricalOtherSourceBookingsCount)
            .HasColumnName("historical_other_source_bookings_count").IsRequired();
    }
}
