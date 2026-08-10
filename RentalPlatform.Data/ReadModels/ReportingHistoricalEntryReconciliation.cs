namespace RentalPlatform.Data.ReadModels;

/// <summary>
/// Keyless, aggregate and PII-free historical entry reconciliation row.
/// </summary>
public sealed class ReportingHistoricalEntryReconciliation
{
    public DateOnly StayMonth { get; init; }
    public DateOnly RecordedMonth { get; init; }
    public DateOnly ActualBookedMonth { get; init; }
    public string OriginalSource { get; init; } = string.Empty;
    public int HistoricalBookingsCount { get; init; }
    public decimal HistoricalAgreedAmount { get; init; }
    public decimal EntryLagDaysP50 { get; init; }
    public int EntryLagDaysMax { get; init; }
    public int InvoiceCount { get; init; }
    public decimal InvoicedAmount { get; init; }
    public decimal InvoiceLinkedPaidAmount { get; init; }
    public int HistoricalPaymentEvidenceCount { get; init; }
    public decimal HistoricalPaymentEvidenceAmount { get; init; }
    public DateOnly? HistoricalPaymentEvidenceFirstPaidDate { get; init; }
    public DateOnly? HistoricalPaymentEvidenceLastPaidDate { get; init; }
}
