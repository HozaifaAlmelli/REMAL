import type {
  HistoricalEntryReason,
  HistoricalOriginalSource,
  HistoricalPaymentMethod,
} from "@/lib/types/historical-booking.types";

export const HISTORICAL_BOOKING_PERMISSIONS = {
  create: "bookings:record_historical",
  reviewOwner: "bookings:read",
  recordPayment: "payments:record_historical",
} as const;

export const HISTORICAL_ENTRY_REASONS: ReadonlyArray<{
  value: HistoricalEntryReason;
  label: string;
}> = [
  {
    value: "offline_booking_recorded_after_stay",
    label: "Offline booking recorded after stay",
  },
  { value: "external_platform_import", label: "External platform import" },
  { value: "late_operational_entry", label: "Late operational entry" },
  { value: "accounting_reconciliation", label: "Accounting reconciliation" },
  { value: "other", label: "Other" },
];

export const HISTORICAL_ORIGINAL_SOURCES: ReadonlyArray<{
  value: HistoricalOriginalSource;
  label: string;
}> = [
  { value: "legacy_system", label: "Legacy system" },
  { value: "external_platform", label: "External platform" },
  { value: "offline_record", label: "Offline record" },
  { value: "other", label: "Other" },
];

export const HISTORICAL_PAYMENT_METHODS: ReadonlyArray<{
  value: HistoricalPaymentMethod;
  label: string;
}> = [
  { value: "cash", label: "Cash" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "card", label: "Card" },
  { value: "wallet", label: "Wallet" },
];

export const HISTORICAL_ERROR_CODES = {
  validation: "VALIDATION_ERROR",
  duplicate: "HISTORICAL_DUPLICATE_BOOKING",
  overlap: "HISTORICAL_OVERLAP_CONFLICT",
  ownerReviewRequired: "OWNER_ATTRIBUTION_REQUIRES_REVIEW",
  idempotencyReused: "IDEMPOTENCY_KEY_REUSED",
  idempotencyInProgress: "IDEMPOTENCY_REQUEST_IN_PROGRESS",
  paymentIdempotencyReused: "HISTORICAL_PAYMENT_IDEMPOTENCY_KEY_REUSED",
  paymentInProgress: "HISTORICAL_PAYMENT_REQUEST_IN_PROGRESS",
} as const;

export const OWNER_REVIEW_WARNING_CODES = {
  currentOwnerInactive: "CURRENT_OWNER_INACTIVE",
  payoutReviewRequired: "PAYOUT_REVIEW_REQUIRED",
} as const;
