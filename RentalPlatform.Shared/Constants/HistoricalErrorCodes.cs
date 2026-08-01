namespace RentalPlatform.Shared.Constants;

public static class HistoricalErrorCodes
{
    public const string ValidationError = "VALIDATION_ERROR";
    public const string ClientReferenceInvalid = "CLIENT_REFERENCE_INVALID";
    public const string ClientNotFound = "CLIENT_NOT_FOUND";
    public const string ClientPhoneAlreadyExists = "CLIENT_PHONE_ALREADY_EXISTS";
    public const string ClientPhoneRequiresReview = "CLIENT_PHONE_REQUIRES_REVIEW";
    public const string UnitNotFound = "UNIT_NOT_FOUND";
    public const string UnitDeletedUnsupported = "UNIT_DELETED_UNSUPPORTED";
    public const string AdminUserNotFound = "ADMIN_USER_NOT_FOUND";
    public const string HistoricalCheckoutNotCompleted = "HISTORICAL_CHECKOUT_NOT_COMPLETED";
    public const string OriginalSourceInvalid = "ORIGINAL_SOURCE_INVALID";
    public const string IdempotencyKeyRequired = "IDEMPOTENCY_KEY_REQUIRED";
    public const string IdempotencyKeyReused = "IDEMPOTENCY_KEY_REUSED";
    public const string IdempotencyRequestInProgress = "IDEMPOTENCY_REQUEST_IN_PROGRESS";
    public const string OwnerAttributionRequiresReview = "OWNER_ATTRIBUTION_REQUIRES_REVIEW";
    public const string ExternalReferenceAlreadyExists = "EXTERNAL_REFERENCE_ALREADY_EXISTS";
    public const string HistoricalOverlapConflict = "HISTORICAL_OVERLAP_CONFLICT";
    public const string HistoricalDuplicateBooking = "HISTORICAL_DUPLICATE_BOOKING";
    public const string HistoricalFinancialSnapshotImmutable =
        "HISTORICAL_FINANCIAL_SNAPSHOT_IMMUTABLE";
    public const string HistoricalPaymentIdempotencyKeyRequired = "HISTORICAL_PAYMENT_IDEMPOTENCY_KEY_REQUIRED";
    public const string HistoricalPaymentIdempotencyKeyReused = "HISTORICAL_PAYMENT_IDEMPOTENCY_KEY_REUSED";
    public const string HistoricalPaymentRequestInProgress = "HISTORICAL_PAYMENT_REQUEST_IN_PROGRESS";
    public const string HistoricalPaymentBookingNotFound = "HISTORICAL_PAYMENT_BOOKING_NOT_FOUND";
    public const string HistoricalPaymentBookingRequired = "HISTORICAL_PAYMENT_BOOKING_REQUIRED";
    public const string HistoricalPaymentSnapshotRequired = "HISTORICAL_PAYMENT_SNAPSHOT_REQUIRED";
    public const string HistoricalPaymentAmountInvalid = "HISTORICAL_PAYMENT_AMOUNT_INVALID";
    public const string HistoricalPaymentMethodInvalid = "HISTORICAL_PAYMENT_METHOD_INVALID";
    public const string HistoricalPaymentReasonRequired = "HISTORICAL_PAYMENT_REASON_REQUIRED";
    public const string HistoricalPaymentExceedsAgreedAmount = "HISTORICAL_PAYMENT_EXCEEDS_AGREED_AMOUNT";
    public const string HistoricalPaymentReferenceAlreadyExists = "HISTORICAL_PAYMENT_REFERENCE_ALREADY_EXISTS";
    public const string HistoricalPaymentImmutable = "HISTORICAL_PAYMENT_IMMUTABLE";
    public const string HistoricalPaymentLiveCollectionForbidden = "HISTORICAL_PAYMENT_LIVE_COLLECTION_FORBIDDEN";

    public static readonly IReadOnlySet<string> All = new HashSet<string>(StringComparer.Ordinal)
    {
        ValidationError,
        ClientReferenceInvalid,
        ClientNotFound,
        ClientPhoneAlreadyExists,
        ClientPhoneRequiresReview,
        UnitNotFound,
        UnitDeletedUnsupported,
        AdminUserNotFound,
        HistoricalCheckoutNotCompleted,
        OriginalSourceInvalid,
        IdempotencyKeyRequired,
        IdempotencyKeyReused,
        IdempotencyRequestInProgress,
        OwnerAttributionRequiresReview,
        ExternalReferenceAlreadyExists,
        HistoricalOverlapConflict,
        HistoricalDuplicateBooking,
        HistoricalFinancialSnapshotImmutable,
        HistoricalPaymentIdempotencyKeyRequired,
        HistoricalPaymentIdempotencyKeyReused,
        HistoricalPaymentRequestInProgress,
        HistoricalPaymentBookingNotFound,
        HistoricalPaymentBookingRequired,
        HistoricalPaymentSnapshotRequired,
        HistoricalPaymentAmountInvalid,
        HistoricalPaymentMethodInvalid,
        HistoricalPaymentReasonRequired,
        HistoricalPaymentExceedsAgreedAmount,
        HistoricalPaymentReferenceAlreadyExists,
        HistoricalPaymentImmutable,
        HistoricalPaymentLiveCollectionForbidden
    };
}
