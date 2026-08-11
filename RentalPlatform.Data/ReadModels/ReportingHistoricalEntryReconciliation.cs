namespace RentalPlatform.Data.ReadModels;

/// <summary>
/// Keyless, PII-free reconciliation row at one row per historical booking.
/// </summary>
public sealed class ReportingHistoricalEntryReconciliation
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
