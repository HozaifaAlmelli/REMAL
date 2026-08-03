import { ApiError } from "@/lib/api/api-error";
import { HISTORICAL_ERROR_CODES } from "@/lib/constants/historical-bookings";
import type {
  HistoricalConflictBookingMetadata,
  HistoricalDateBlockMetadata,
} from "@/lib/types/historical-booking.types";
import type {
  HistoricalWizardConflict,
  OwnerReviewIssue,
} from "@/lib/historical-bookings/wizard";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const UNKNOWN_COMMAND_OUTCOME_STATUSES = new Set([0, 408, 502, 503, 504]);

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function safeBooking(value: unknown): HistoricalConflictBookingMetadata | null {
  if (!isObject(value)) return null;
  const { bookingId, status, checkInDate, checkOutDate } = value;
  if (
    typeof bookingId !== "string" ||
    !UUID.test(bookingId) ||
    typeof status !== "string" ||
    status.length > 40 ||
    typeof checkInDate !== "string" ||
    !DATE.test(checkInDate) ||
    typeof checkOutDate !== "string" ||
    !DATE.test(checkOutDate)
  )
    return null;
  return { bookingId, status, checkInDate, checkOutDate };
}

function safeDateBlock(value: unknown): HistoricalDateBlockMetadata | null {
  if (!isObject(value)) return null;
  const { dateBlockId, startDate, endDate } = value;
  if (
    typeof dateBlockId !== "string" ||
    !UUID.test(dateBlockId) ||
    typeof startDate !== "string" ||
    !DATE.test(startDate) ||
    typeof endDate !== "string" ||
    !DATE.test(endDate)
  )
    return null;
  return { dateBlockId, startDate, endDate };
}

function safeArray<T>(value: unknown, map: (item: unknown) => T | null): T[] {
  if (!Array.isArray(value)) return [];
  return value.map(map).filter((item): item is T => item !== null);
}

export function toHistoricalWizardConflict(
  error: ApiError
): HistoricalWizardConflict | null {
  if (
    error.code !== HISTORICAL_ERROR_CODES.duplicate &&
    error.code !== HISTORICAL_ERROR_CODES.overlap
  )
    return null;

  const metadata = error.metadata ?? {};
  const exactDuplicateOf =
    typeof metadata.duplicateOf === "string" && UUID.test(metadata.duplicateOf)
      ? metadata.duplicateOf
      : null;
  const candidates = safeArray(metadata.candidates, safeBooking);
  const hardConflicts = safeArray(metadata.conflicts, safeBooking);
  const dateBlocks = safeArray(metadata.dateBlocks, safeDateBlock);
  return {
    code: error.code,
    message:
      error.code === HISTORICAL_ERROR_CODES.duplicate
        ? (BOOKING_MESSAGES[HISTORICAL_ERROR_CODES.duplicate] ??
          "A probable duplicate requires review.")
        : (BOOKING_MESSAGES[HISTORICAL_ERROR_CODES.overlap] ??
          "The stay conflicts with existing availability."),
    exactDuplicateOf,
    candidates,
    hardConflicts,
    dateBlocks,
    acknowledgeable:
      (error.code === HISTORICAL_ERROR_CODES.duplicate &&
        !exactDuplicateOf &&
        candidates.length > 0) ||
      (error.code === HISTORICAL_ERROR_CODES.overlap &&
        hardConflicts.length === 0 &&
        dateBlocks.length > 0),
  };
}

const BOOKING_MESSAGES: Record<string, string> = {
  VALIDATION_ERROR: "Review the highlighted fields and try again.",
  CLIENT_REFERENCE_INVALID:
    "Choose one existing client or enter one new client.",
  CLIENT_NOT_FOUND: "The selected client is no longer available.",
  CLIENT_PHONE_ALREADY_EXISTS:
    "That phone number already belongs to another client.",
  CLIENT_PHONE_REQUIRES_REVIEW:
    "The client phone requires a separate review before this booking can be recorded.",
  UNIT_NOT_FOUND: "The selected unit is no longer available.",
  UNIT_DELETED_UNSUPPORTED:
    "Deleted units cannot be used for historical bookings.",
  ADMIN_USER_NOT_FOUND: "The assigned administrator is no longer available.",
  HISTORICAL_CHECKOUT_NOT_COMPLETED:
    "The stay must be fully completed in Cairo time.",
  ORIGINAL_SOURCE_INVALID: "The selected original source is no longer active.",
  IDEMPOTENCY_KEY_REQUIRED:
    "The booking request identity is invalid. Refresh and try again.",
  IDEMPOTENCY_KEY_REUSED:
    "This request identity belongs to different booking details. Review and submit again.",
  IDEMPOTENCY_REQUEST_IN_PROGRESS:
    "This booking request is still being processed. Retry with the same details.",
  OWNER_ATTRIBUTION_REQUIRES_REVIEW:
    "Owner attribution could not be established safely.",
  EXTERNAL_REFERENCE_ALREADY_EXISTS:
    "That external reference is already used by another historical booking.",
  HISTORICAL_OVERLAP_CONFLICT:
    "The stay overlaps an existing booking or an approved date block.",
  HISTORICAL_DUPLICATE_BOOKING:
    "A probable duplicate requires explicit review before recording.",
};

const PAYMENT_MESSAGES: Record<string, string> = {
  HISTORICAL_PAYMENT_IDEMPOTENCY_KEY_REQUIRED:
    "The payment request identity is invalid. Try again.",
  HISTORICAL_PAYMENT_IDEMPOTENCY_KEY_REUSED:
    "This payment request identity belongs to different details.",
  HISTORICAL_PAYMENT_REQUEST_IN_PROGRESS:
    "This payment request is still being processed. Retry with the same details.",
  HISTORICAL_PAYMENT_BOOKING_NOT_FOUND:
    "The recorded booking could not be found.",
  HISTORICAL_PAYMENT_BOOKING_REQUIRED:
    "Payment evidence can be recorded only for a historical booking.",
  HISTORICAL_PAYMENT_SNAPSHOT_REQUIRED:
    "The booking financial snapshot requires review before payment evidence can be recorded.",
  HISTORICAL_PAYMENT_AMOUNT_INVALID: "Enter a valid positive payment amount.",
  HISTORICAL_PAYMENT_METHOD_INVALID: "Select a supported payment method.",
  HISTORICAL_PAYMENT_REASON_REQUIRED:
    "Enter why this historical payment is being recorded.",
  HISTORICAL_PAYMENT_EXCEEDS_AGREED_AMOUNT:
    "The payment would exceed the booking's agreed amount.",
  HISTORICAL_PAYMENT_REFERENCE_ALREADY_EXISTS:
    "That payment reference is already recorded for this booking.",
  HISTORICAL_PAYMENT_LIVE_COLLECTION_FORBIDDEN:
    "Historical evidence cannot use live payment collection.",
};

export function bookingErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError))
    return "The booking request could not be completed. Your entries are preserved.";
  return (
    (error.code && BOOKING_MESSAGES[error.code]) ||
    "The booking request could not be completed."
  );
}

function safeValidationDetail(error: ApiError): string | null {
  if (error.code !== HISTORICAL_ERROR_CODES.validation) return null;
  const detail = error.errors.find(
    (item) =>
      typeof item === "string" &&
      item.trim().length > 0 &&
      item.length <= 200 &&
      !/[\r\n\0]/.test(item) &&
      !/(sql|constraint|exception|stack trace|password|token|request body)/i.test(
        item
      )
  );
  return detail?.trim() ?? null;
}

export function paymentErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError))
    return "The payment evidence could not be recorded. The booking remains created.";
  return (
    safeValidationDetail(error) ||
    (error.code && PAYMENT_MESSAGES[error.code]) ||
    "The payment evidence could not be recorded."
  );
}

export function isUnknownCommandOutcome(
  error: unknown,
  inProgressCode: string
): boolean {
  return (
    !(error instanceof ApiError) ||
    UNKNOWN_COMMAND_OUTCOME_STATUSES.has(error.status) ||
    error.code === inProgressCode
  );
}

export function ownerReviewIssue(error: unknown): OwnerReviewIssue {
  if (error instanceof ApiError) {
    if (error.code === HISTORICAL_ERROR_CODES.ownerReviewRequired) {
      return {
        kind: "review-required",
        message: "Owner attribution requires a separate operational review.",
        retryable: false,
      };
    }
    if (error.status === 403) {
      return {
        kind: "forbidden",
        message:
          "Owner-attribution details are unavailable to the current user.",
        retryable: false,
      };
    }
    if (error.status === 404) {
      return {
        kind: "not-found",
        message:
          "The booking was created, but its owner review could not be located. Contact operations with the booking ID.",
        retryable: false,
      };
    }
    if (error.status === 409) {
      return {
        kind: "business",
        message:
          "Owner attribution review returned a business state that cannot be retried here.",
        retryable: false,
      };
    }
  }

  return {
    kind: "transport",
    message:
      "Owner attribution review is temporarily unavailable. The booking remains created.",
    retryable: true,
  };
}
