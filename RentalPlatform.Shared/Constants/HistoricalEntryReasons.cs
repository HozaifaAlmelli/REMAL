namespace RentalPlatform.Shared.Constants;

public static class HistoricalEntryReasons
{
    public const string OfflineBookingRecordedAfterStay = "offline_booking_recorded_after_stay";
    public const string ExternalPlatformImport = "external_platform_import";
    public const string LateOperationalEntry = "late_operational_entry";
    public const string AccountingReconciliation = "accounting_reconciliation";
    public const string Other = "other";

    public static readonly IReadOnlySet<string> All = new HashSet<string>(StringComparer.Ordinal)
    {
        OfflineBookingRecordedAfterStay,
        ExternalPlatformImport,
        LateOperationalEntry,
        AccountingReconciliation,
        Other
    };
}
