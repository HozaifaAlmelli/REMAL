using System;

namespace RentalPlatform.API.DTOs.Responses.ReportsAnalytics;

// ---------------------------------------------------------------------------
// Booking analytics
// ---------------------------------------------------------------------------

public record BookingAnalyticsDailySummaryResponse
{
    public DateOnly MetricDate { get; init; }
    public string BookingSource { get; init; } = string.Empty;
    public int BookingsCreatedCount { get; init; }
    public int ProspectingBookingsCount { get; init; }
    public int ConfirmedBookingsCount { get; init; }
    public int CancelledBookingsCount { get; init; }
    public int CompletedBookingsCount { get; init; }
    public decimal TotalFinalAmount { get; init; }
    public int HistoricalBookingsCount { get; init; }
    public int HistoricalProspectingBookingsCount { get; init; }
    public int HistoricalConfirmedBookingsCount { get; init; }
    public int HistoricalCancelledBookingsCount { get; init; }
    public int HistoricalCompletedBookingsCount { get; init; }
    public decimal HistoricalFinalAmount { get; init; }
    public decimal HistoricalAgreedAmount { get; init; }
    public int HistoricalLegacySystemBookingsCount { get; init; }
    public int HistoricalExternalPlatformBookingsCount { get; init; }
    public int HistoricalOfflineRecordBookingsCount { get; init; }
    public int HistoricalOtherSourceBookingsCount { get; init; }
}

public record BookingAnalyticsSummaryResponse
{
    public DateOnly? DateFrom { get; init; }
    public DateOnly? DateTo { get; init; }
    public string? BookingSource { get; init; }
    public int TotalBookingsCreatedCount { get; init; }
    public int TotalProspectingBookingsCount { get; init; }
    public int TotalConfirmedBookingsCount { get; init; }
    public int TotalCancelledBookingsCount { get; init; }
    public int TotalCompletedBookingsCount { get; init; }
    public decimal TotalFinalAmount { get; init; }
    public int HistoricalBookingsCount { get; init; }
    public decimal HistoricalFinalAmount { get; init; }
    public decimal HistoricalAgreedAmount { get; init; }
    public int HistoricalLegacySystemBookingsCount { get; init; }
    public int HistoricalExternalPlatformBookingsCount { get; init; }
    public int HistoricalOfflineRecordBookingsCount { get; init; }
    public int HistoricalOtherSourceBookingsCount { get; init; }
}

public record BookingAnalyticsStayDailySummaryResponse
{
    public DateOnly MetricDate { get; init; }
    public string BookingSource { get; init; } = string.Empty;
    public int BookingsCount { get; init; }
    public int ProspectingBookingsCount { get; init; }
    public int ConfirmedBookingsCount { get; init; }
    public int CancelledBookingsCount { get; init; }
    public int CompletedBookingsCount { get; init; }
    public decimal TotalFinalAmount { get; init; }
    public int HistoricalBookingsCount { get; init; }
    public int HistoricalProspectingBookingsCount { get; init; }
    public int HistoricalConfirmedBookingsCount { get; init; }
    public int HistoricalCancelledBookingsCount { get; init; }
    public int HistoricalCompletedBookingsCount { get; init; }
    public decimal HistoricalFinalAmount { get; init; }
    public decimal HistoricalAgreedAmount { get; init; }
}

public record HistoricalEntryReconciliationResponse
{
    public Guid BookingId { get; init; }
    public DateTime RecordedAt { get; init; }
    public DateOnly ActualBookedAt { get; init; }
    public int EntryLagDays { get; init; }
    public DateOnly StayStart { get; init; }
    public DateOnly StayEnd { get; init; }
    public int StayNights { get; init; }
    public string BookingSource { get; init; } = string.Empty;
    public string OriginalSource { get; init; } = string.Empty;
    public string HistoricalEntryReason { get; init; } = string.Empty;
    public string BookingStatus { get; init; } = string.Empty;
    public Guid UnitId { get; init; }
    public Guid OwnerId { get; init; }
    public decimal AgreedAmount { get; init; }
    public decimal ActiveInvoiceAmount { get; init; }
    public decimal OrdinaryInvoiceLinkedPaidAmount { get; init; }
    public int OrdinaryUnlinkedPaidCount { get; init; }
    public decimal OrdinaryUnlinkedPaidAmount { get; init; }
    public int HistoricalPaymentEvidenceCount { get; init; }
    public decimal HistoricalPaymentEvidenceAmount { get; init; }
    public DateOnly? FirstEvidencePaidDate { get; init; }
    public DateOnly? LastEvidencePaidDate { get; init; }
    public int OwnerAttributionCorrectionCount { get; init; }
    public DateTime? LastOwnerAttributionCorrectedAt { get; init; }
}

// ---------------------------------------------------------------------------
// Finance analytics
// ---------------------------------------------------------------------------

public record FinanceAnalyticsDailySummaryResponse
{
    public DateOnly MetricDate { get; init; }
    public int BookingsWithInvoiceCount { get; init; }
    public decimal TotalInvoicedAmount { get; init; }
    public decimal TotalPaidAmount { get; init; }
    public decimal TotalRemainingAmount { get; init; }
    public decimal TotalPendingPayoutAmount { get; init; }
    public decimal TotalScheduledPayoutAmount { get; init; }
    public decimal TotalPaidPayoutAmount { get; init; }
    public int HistoricalBookingsWithInvoiceCount { get; init; }
    public decimal HistoricalInvoicedAmount { get; init; }
    public decimal HistoricalInvoiceLinkedPaidAmount { get; init; }
    public decimal HistoricalRemainingAmount { get; init; }
    public int OrdinaryOrphanPaymentCount { get; init; }
    public decimal OrdinaryOrphanPaymentAmount { get; init; }
    public int HistoricalBookingOrdinaryOrphanPaymentCount { get; init; }
    public decimal HistoricalBookingOrdinaryOrphanPaymentAmount { get; init; }
    public int HistoricalPaymentEvidenceCount { get; init; }
    public decimal HistoricalPaymentEvidenceAmount { get; init; }
    public decimal HistoricalAgreedAmount { get; init; }
}

public record FinanceAnalyticsSummaryResponse
{
    public DateOnly? DateFrom { get; init; }
    public DateOnly? DateTo { get; init; }
    public int TotalBookingsWithInvoiceCount { get; init; }
    public decimal TotalInvoicedAmount { get; init; }
    public decimal TotalPaidAmount { get; init; }
    public decimal TotalRemainingAmount { get; init; }
    public int HistoricalPaymentEvidenceCount { get; init; }
    public decimal HistoricalPaymentEvidenceAmount { get; init; }
    public decimal TotalPendingPayoutAmount { get; init; }
    public decimal TotalScheduledPayoutAmount { get; init; }
    public decimal TotalPaidPayoutAmount { get; init; }
    public int HistoricalBookingsWithInvoiceCount { get; init; }
    public decimal HistoricalInvoicedAmount { get; init; }
    public decimal HistoricalInvoiceLinkedPaidAmount { get; init; }
    public decimal HistoricalRemainingAmount { get; init; }
    public int OrdinaryOrphanPaymentCount { get; init; }
    public decimal OrdinaryOrphanPaymentAmount { get; init; }
    public int HistoricalBookingOrdinaryOrphanPaymentCount { get; init; }
    public decimal HistoricalBookingOrdinaryOrphanPaymentAmount { get; init; }
    public decimal HistoricalAgreedAmount { get; init; }
}

public record FinanceAnalyticsStayDailySummaryResponse
{
    public DateOnly MetricDate { get; init; }
    public string BookingSource { get; init; } = string.Empty;
    public int BookingsWithInvoiceCount { get; init; }
    public decimal TotalInvoicedAmount { get; init; }
    public decimal TotalFinalAmount { get; init; }
    public int HistoricalBookingsCount { get; init; }
    public decimal HistoricalAgreedAmount { get; init; }
    public decimal HistoricalInvoicedAmount { get; init; }
    public int HistoricalBookingsWithInvoiceCount { get; init; }
}

// ---------------------------------------------------------------------------
// Reviews analytics
// ---------------------------------------------------------------------------

public record ReviewsAnalyticsDailySummaryResponse
{
    public DateOnly MetricDate { get; init; }
    public int PublishedReviewsCount { get; init; }
    public decimal AverageRating { get; init; }
    public int ReviewsWithOwnerReplyCount { get; init; }
    public int ReviewsWithVisibleOwnerReplyCount { get; init; }
}

public record ReviewsAnalyticsSummaryResponse
{
    public DateOnly? DateFrom { get; init; }
    public DateOnly? DateTo { get; init; }
    public int TotalPublishedReviewsCount { get; init; }
    public decimal AverageRating { get; init; }
    public int TotalReviewsWithOwnerReplyCount { get; init; }
    public int TotalReviewsWithVisibleOwnerReplyCount { get; init; }
}

// ---------------------------------------------------------------------------
// Notifications analytics
// ---------------------------------------------------------------------------

public record NotificationsAnalyticsDailySummaryResponse
{
    public DateOnly MetricDate { get; init; }
    public string Channel { get; init; } = string.Empty;
    public int NotificationsCreatedCount { get; init; }
    public int PendingNotificationsCount { get; init; }
    public int QueuedNotificationsCount { get; init; }
    public int SentNotificationsCount { get; init; }
    public int DeliveredNotificationsCount { get; init; }
    public int FailedNotificationsCount { get; init; }
    public int CancelledNotificationsCount { get; init; }
    public int ReadNotificationsCount { get; init; }
}

public record NotificationsAnalyticsSummaryResponse
{
    public DateOnly? DateFrom { get; init; }
    public DateOnly? DateTo { get; init; }
    public string? Channel { get; init; }
    public int TotalNotificationsCreatedCount { get; init; }
    public int TotalPendingNotificationsCount { get; init; }
    public int TotalQueuedNotificationsCount { get; init; }
    public int TotalSentNotificationsCount { get; init; }
    public int TotalDeliveredNotificationsCount { get; init; }
    public int TotalFailedNotificationsCount { get; init; }
    public int TotalCancelledNotificationsCount { get; init; }
    public int TotalReadNotificationsCount { get; init; }
}
