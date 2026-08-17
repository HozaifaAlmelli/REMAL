namespace RentalPlatform.Shared.Constants;

public static class HistoricalOwnerCorrectionReasons
{
    public const string OwnershipChangedAfterStay = "ownership_changed_after_stay";
    public const string BookingBelongedToPreviousOwnerAgreement =
        "booking_belonged_to_previous_owner_agreement";
    public const string AccountingReconciliation = "accounting_reconciliation";
    public const string Other = "other";

    public static readonly IReadOnlySet<string> All = new HashSet<string>(StringComparer.Ordinal)
    {
        OwnershipChangedAfterStay,
        BookingBelongedToPreviousOwnerAgreement,
        AccountingReconciliation,
        Other
    };
}

public static class HistoricalOwnerAttributionWarnings
{
    public const string CurrentOwnerInactive = "CURRENT_OWNER_INACTIVE";
    public const string TargetOwnerInactive = "TARGET_OWNER_INACTIVE";
    public const string PayoutReviewRequired = "PAYOUT_REVIEW_REQUIRED";
}
