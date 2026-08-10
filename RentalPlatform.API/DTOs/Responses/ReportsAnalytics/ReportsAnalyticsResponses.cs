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
