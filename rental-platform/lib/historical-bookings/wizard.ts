import type {
  HistoricalConflictBookingMetadata,
  HistoricalDateBlockMetadata,
  HistoricalEntryReason,
  HistoricalOriginalSource,
  HistoricalOwnerAttributionReviewResponse,
  HistoricalPaymentMethod,
  HistoricalPaymentResponse,
  RecordHistoricalBookingRequest,
  RecordHistoricalPaymentRequest,
} from "@/lib/types/historical-booking.types";

export const HISTORICAL_WIZARD_STEPS = [
  { id: "provenance", label: "Provenance" },
  { id: "stay", label: "Unit & occupied dates" },
  { id: "client", label: "Client & stay details" },
  { id: "financial", label: "Financial truth" },
  { id: "owner-policy", label: "Owner review" },
  { id: "review", label: "Review & create" },
] as const;

export type HistoricalWizardStep = 1 | 2 | 3 | 4 | 5 | 6;
export type BookingStatus =
  | "Drafting"
  | "StepValidating"
  | "Submitting"
  | "OutcomeUnknown"
  | "Committed"
  | "RecoveredVerifying"
  | "RecoveredUnverified";
export type OwnerReviewStatus =
  | "Idle"
  | "Loading"
  | "Available"
  | "Required"
  | "Forbidden"
  | "NotFound"
  | "Unavailable";
export type PaymentStatus =
  | "Available"
  | "Submitting"
  | "OutcomeUnknown"
  | "ReconciliationRequired"
  | "Failed"
  | "Recorded";

export type ClientMode = "existing" | "new";

export interface HistoricalBookingDraft {
  originalSource: HistoricalOriginalSource | "";
  actualBookedAt: string;
  historicalEntryReason: HistoricalEntryReason | "";
  historicalEntryNote: string;
  externalReference: string;
  unitId: string;
  checkInDate: string;
  checkOutDate: string;
  clientMode: ClientMode;
  clientId: string;
  newClientName: string;
  newClientPhone: string;
  newClientEmail: string;
  guestCount: string;
  internalNotes: string;
  agreedAmount: string;
  acknowledgedDuplicateOf: string[];
  acknowledgedDateBlockIds: string[];
}

export interface HistoricalPaymentDraft {
  amount: string;
  paymentMethod: HistoricalPaymentMethod | "";
  paidAt: string;
  referenceNumber: string;
  reason: string;
}

export interface WizardValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

export interface HistoricalWizardConflict {
  code: string;
  message: string;
  exactDuplicateOf: string | null;
  candidates: HistoricalConflictBookingMetadata[];
  hardConflicts: HistoricalConflictBookingMetadata[];
  dateBlocks: HistoricalDateBlockMetadata[];
  acknowledgeable: boolean;
}

export interface OwnerReviewIssue {
  kind:
    | "review-required"
    | "forbidden"
    | "not-found"
    | "transport"
    | "malformed"
    | "business";
  message: string;
  retryable: boolean;
}

export interface RecoveryIssue {
  kind: "forbidden" | "not-found" | "transport" | "malformed";
  message: string;
  retryable: boolean;
}

export interface CommittedHistoricalBooking {
  id: string;
  unitId?: string;
  unitName?: string | null;
  checkInDate?: string;
  checkOutDate?: string;
  agreedAmount?: number;
  recordedAt?: string;
}

export interface HistoricalWizardState {
  currentStep: HistoricalWizardStep;
  bookingStatus: BookingStatus;
  ownerReviewStatus: OwnerReviewStatus;
  paymentStatus: PaymentStatus;
  draft: HistoricalBookingDraft;
  validationErrors: Record<string, string>;
  paymentValidationErrors: Record<string, string>;
  bookingError: string | null;
  conflict: HistoricalWizardConflict | null;
  booking: CommittedHistoricalBooking | null;
  recoveryBookingId: string | null;
  recoveryIssue: RecoveryIssue | null;
  ownerReview: HistoricalOwnerAttributionReviewResponse | null;
  ownerReviewIssue: OwnerReviewIssue | null;
  paymentDraft: HistoricalPaymentDraft;
  payment: HistoricalPaymentResponse | null;
  paymentError: string | null;
}

export type HistoricalWizardAction =
  | { type: "updateDraft"; patch: Partial<HistoricalBookingDraft> }
  | { type: "updatePaymentDraft"; patch: Partial<HistoricalPaymentDraft> }
  | { type: "goToStep"; step: HistoricalWizardStep }
  | {
      type: "validationFailed";
      errors: Record<string, string>;
      step: HistoricalWizardStep;
    }
  | { type: "bookingSubmitting" }
  | { type: "bookingOutcomeUnknown"; message: string }
  | {
      type: "bookingFailed";
      message: string;
      conflict?: HistoricalWizardConflict;
    }
  | { type: "bookingCreated"; booking: CommittedHistoricalBooking }
  | {
      type: "recoveryVerifying";
      bookingId: string;
      paymentOutcomeUnknown: boolean;
    }
  | {
      type: "recoveryConfirmed";
      bookingId: string;
      review?: HistoricalOwnerAttributionReviewResponse;
      reviewIssue?: OwnerReviewIssue;
      paymentOutcomeUnknown: boolean;
    }
  | { type: "recoveryUnverified"; issue: RecoveryIssue }
  | { type: "recoveryRetrying" }
  | {
      type: "ownerReviewLoaded";
      review: HistoricalOwnerAttributionReviewResponse;
    }
  | { type: "ownerReviewRequired"; issue: OwnerReviewIssue }
  | { type: "ownerReviewUnavailable"; issue: OwnerReviewIssue }
  | { type: "ownerReviewRetrying" }
  | { type: "paymentValidationFailed"; errors: Record<string, string> }
  | { type: "paymentSubmitting" }
  | { type: "paymentOutcomeUnknown"; message: string }
  | { type: "paymentRecorded"; payment: HistoricalPaymentResponse }
  | { type: "paymentFailed"; message: string };

export const emptyHistoricalBookingDraft = (): HistoricalBookingDraft => ({
  originalSource: "",
  actualBookedAt: "",
  historicalEntryReason: "",
  historicalEntryNote: "",
  externalReference: "",
  unitId: "",
  checkInDate: "",
  checkOutDate: "",
  clientMode: "existing",
  clientId: "",
  newClientName: "",
  newClientPhone: "",
  newClientEmail: "",
  guestCount: "1",
  internalNotes: "",
  agreedAmount: "",
  acknowledgedDuplicateOf: [],
  acknowledgedDateBlockIds: [],
});

export const emptyHistoricalPaymentDraft = (): HistoricalPaymentDraft => ({
  amount: "",
  paymentMethod: "",
  paidAt: "",
  referenceNumber: "",
  reason: "",
});

export const createInitialHistoricalWizardState =
  (): HistoricalWizardState => ({
    currentStep: 1,
    bookingStatus: "Drafting",
    ownerReviewStatus: "Idle",
    paymentStatus: "Available",
    draft: emptyHistoricalBookingDraft(),
    validationErrors: {},
    paymentValidationErrors: {},
    bookingError: null,
    conflict: null,
    booking: null,
    recoveryBookingId: null,
    recoveryIssue: null,
    ownerReview: null,
    ownerReviewIssue: null,
    paymentDraft: emptyHistoricalPaymentDraft(),
    payment: null,
    paymentError: null,
  });

const ACKNOWLEDGEMENT_INPUTS = new Set<keyof HistoricalBookingDraft>([
  "unitId",
  "checkInDate",
  "checkOutDate",
  "clientMode",
  "clientId",
  "newClientPhone",
  "externalReference",
]);

function acknowledgementInputsChanged(
  draft: HistoricalBookingDraft,
  patch: Partial<HistoricalBookingDraft>
): boolean {
  return Object.entries(patch).some(
    ([key, value]) =>
      ACKNOWLEDGEMENT_INPUTS.has(key as keyof HistoricalBookingDraft) &&
      draft[key as keyof HistoricalBookingDraft] !== value
  );
}

export function historicalWizardReducer(
  state: HistoricalWizardState,
  action: HistoricalWizardAction
): HistoricalWizardState {
  switch (action.type) {
    case "updateDraft": {
      if (
        state.booking ||
        state.bookingStatus === "Submitting" ||
        state.bookingStatus === "OutcomeUnknown" ||
        state.bookingStatus.startsWith("Recovered")
      )
        return state;
      const clearAcknowledgements = acknowledgementInputsChanged(
        state.draft,
        action.patch
      );
      return {
        ...state,
        bookingStatus: "Drafting",
        draft: {
          ...state.draft,
          ...action.patch,
          ...(clearAcknowledgements
            ? {
                acknowledgedDuplicateOf: [],
                acknowledgedDateBlockIds: [],
              }
            : {}),
        },
        validationErrors: {},
        bookingError: null,
        conflict: null,
      };
    }
    case "updatePaymentDraft":
      if (
        !state.booking ||
        state.payment ||
        state.paymentStatus === "Submitting" ||
        state.paymentStatus === "OutcomeUnknown" ||
        state.paymentStatus === "ReconciliationRequired"
      )
        return state;
      return {
        ...state,
        paymentDraft: { ...state.paymentDraft, ...action.patch },
        paymentValidationErrors: {},
        paymentError: null,
        paymentStatus: "Available",
      };
    case "goToStep":
      if (
        state.booking ||
        state.bookingStatus === "Submitting" ||
        state.bookingStatus === "OutcomeUnknown" ||
        action.step < 1 ||
        action.step > 6
      )
        return state;
      return {
        ...state,
        currentStep: action.step,
        bookingStatus: "Drafting",
        validationErrors: {},
      };
    case "validationFailed":
      return {
        ...state,
        currentStep: action.step,
        bookingStatus: "StepValidating",
        validationErrors: action.errors,
      };
    case "bookingSubmitting":
      if (state.booking) return state;
      return {
        ...state,
        bookingStatus: "Submitting",
        bookingError: null,
        conflict: null,
      };
    case "bookingOutcomeUnknown":
      if (state.booking) return state;
      return {
        ...state,
        bookingStatus: "OutcomeUnknown",
        bookingError: action.message,
        conflict: null,
      };
    case "bookingFailed":
      if (state.booking) return state;
      return {
        ...state,
        bookingStatus: "Drafting",
        bookingError: action.message,
        conflict: action.conflict ?? null,
      };
    case "bookingCreated":
      return {
        ...state,
        bookingStatus: "Committed",
        ownerReviewStatus: "Loading",
        paymentStatus: "Available",
        booking: action.booking,
        recoveryBookingId: null,
        recoveryIssue: null,
        bookingError: null,
        conflict: null,
        validationErrors: {},
        draft: emptyHistoricalBookingDraft(),
        ownerReview: null,
        ownerReviewIssue: null,
      };
    case "recoveryVerifying":
      if (state.booking) return state;
      return {
        ...state,
        bookingStatus: "RecoveredVerifying",
        ownerReviewStatus: "Loading",
        paymentStatus: action.paymentOutcomeUnknown
          ? "ReconciliationRequired"
          : "Available",
        recoveryBookingId: action.bookingId,
        recoveryIssue: null,
        draft: emptyHistoricalBookingDraft(),
        validationErrors: {},
      };
    case "recoveryConfirmed": {
      const reviewIssue = action.reviewIssue ?? null;
      return {
        ...state,
        bookingStatus: "Committed",
        booking: { id: action.bookingId },
        recoveryIssue: null,
        ownerReview: action.review ?? null,
        ownerReviewIssue: reviewIssue,
        ownerReviewStatus: action.review
          ? "Available"
          : reviewIssue?.kind === "review-required"
            ? "Required"
            : "Unavailable",
        paymentStatus: action.paymentOutcomeUnknown
          ? "ReconciliationRequired"
          : "Available",
      };
    }
    case "recoveryUnverified":
      return {
        ...state,
        bookingStatus: "RecoveredUnverified",
        ownerReviewStatus: "Idle",
        recoveryIssue: action.issue,
        booking: null,
      };
    case "recoveryRetrying":
      if (!state.recoveryBookingId) return state;
      return {
        ...state,
        bookingStatus: "RecoveredVerifying",
        recoveryIssue: null,
      };
    case "ownerReviewLoaded":
      if (!state.booking || action.review.bookingId !== state.booking.id)
        return {
          ...state,
          ownerReviewStatus: "Unavailable",
          ownerReview: null,
          ownerReviewIssue: {
            kind: "malformed",
            message:
              "Owner attribution returned an inconsistent booking identity. Contact operations.",
            retryable: false,
          },
        };
      return {
        ...state,
        ownerReviewStatus: "Available",
        ownerReview: action.review,
        ownerReviewIssue: null,
      };
    case "ownerReviewRequired":
      if (!state.booking) return state;
      return {
        ...state,
        ownerReviewStatus: "Required",
        ownerReview: null,
        ownerReviewIssue: action.issue,
      };
    case "ownerReviewUnavailable":
      if (!state.booking) return state;
      return {
        ...state,
        ownerReviewStatus:
          action.issue.kind === "forbidden"
            ? "Forbidden"
            : action.issue.kind === "not-found"
              ? "NotFound"
              : "Unavailable",
        ownerReview: null,
        ownerReviewIssue: action.issue,
      };
    case "ownerReviewRetrying":
      if (!state.booking) return state;
      return {
        ...state,
        ownerReviewStatus: "Loading",
        ownerReviewIssue: null,
      };
    case "paymentValidationFailed":
      return {
        ...state,
        paymentValidationErrors: action.errors,
        paymentStatus: "Failed",
      };
    case "paymentSubmitting":
      if (!state.booking || state.payment) return state;
      return {
        ...state,
        paymentStatus: "Submitting",
        paymentValidationErrors: {},
        paymentError: null,
      };
    case "paymentOutcomeUnknown":
      if (!state.booking) return state;
      return {
        ...state,
        paymentStatus: "OutcomeUnknown",
        paymentError: action.message,
      };
    case "paymentRecorded":
      if (!state.booking || action.payment.bookingId !== state.booking.id)
        return {
          ...state,
          paymentStatus: "OutcomeUnknown",
          paymentError:
            "Payment recording returned an inconsistent booking identity. Reconcile before recording another payment.",
        };
      return {
        ...state,
        paymentStatus: "Recorded",
        payment: action.payment,
        paymentDraft: emptyHistoricalPaymentDraft(),
        paymentValidationErrors: {},
        paymentError: null,
      };
    case "paymentFailed":
      if (!state.booking) return state;
      return {
        ...state,
        paymentStatus: "Failed",
        paymentError: action.message,
      };
  }
}

const required = (value: string): boolean => value.trim().length > 0;
export const GUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DATE_TIME_LOCAL_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;
const phonePattern = /^\+?\d{10,15}$/;
const moneyPattern = /^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/;

export function cairoToday(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = Object.fromEntries(
    parts.map((part) => [part.type, part.value])
  );
  return `${value.year}-${value.month}-${value.day}`;
}

export function cairoWallTimeToIso(value: string): string | null {
  const match = DATE_TIME_LOCAL_PATTERN.exec(value);
  if (!match) return null;
  const target = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: Number(match[6] ?? "0"),
  };
  if (
    target.month < 1 ||
    target.month > 12 ||
    target.day < 1 ||
    target.day > 31 ||
    target.hour > 23 ||
    target.minute > 59 ||
    target.second > 59
  )
    return null;

  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Cairo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const targetUtc = Date.UTC(
    target.year,
    target.month - 1,
    target.day,
    target.hour,
    target.minute,
    target.second
  );
  let instant = targetUtc;
  for (let iteration = 0; iteration < 3; iteration += 1) {
    const parts = Object.fromEntries(
      formatter
        .formatToParts(new Date(instant))
        .map((part) => [part.type, part.value])
    );
    const representedUtc = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second)
    );
    instant += targetUtc - representedUtc;
  }
  const resolved = Object.fromEntries(
    formatter
      .formatToParts(new Date(instant))
      .map((part) => [part.type, part.value])
  );
  if (
    Number(resolved.year) !== target.year ||
    Number(resolved.month) !== target.month ||
    Number(resolved.day) !== target.day ||
    Number(resolved.hour) !== target.hour ||
    Number(resolved.minute) !== target.minute ||
    Number(resolved.second) !== target.second
  )
    return null;
  return new Date(instant).toISOString();
}

export function validateHistoricalWizardStep(
  step: HistoricalWizardStep,
  draft: HistoricalBookingDraft,
  now = new Date()
): WizardValidationResult {
  const errors: Record<string, string> = {};

  if (step === 1) {
    if (!required(draft.originalSource))
      errors.originalSource = "Select the original source.";
    if (!required(draft.actualBookedAt))
      errors.actualBookedAt = "Enter the original booking date.";
    if (!required(draft.historicalEntryReason))
      errors.historicalEntryReason = "Select an entry reason.";
    if (
      draft.historicalEntryReason === "other" &&
      draft.historicalEntryNote.trim().length < 10
    ) {
      errors.historicalEntryNote =
        "Add at least 10 characters when the reason is Other.";
    }
    if (draft.historicalEntryNote.length > 1000)
      errors.historicalEntryNote =
        "Keep the note to 1,000 characters or fewer.";
    if (draft.externalReference.trim().length > 100)
      errors.externalReference =
        "Keep the reference to 100 characters or fewer.";
  }

  if (step === 2) {
    if (!GUID_PATTERN.test(draft.unitId)) errors.unitId = "Select a unit.";
    if (!required(draft.checkInDate))
      errors.checkInDate = "Enter check-in date.";
    if (!required(draft.checkOutDate))
      errors.checkOutDate = "Enter check-out date.";
    if (
      draft.checkInDate &&
      draft.checkOutDate &&
      draft.checkOutDate <= draft.checkInDate
    ) {
      errors.checkOutDate = "Check-out must be after check-in.";
    }
    if (draft.checkOutDate && draft.checkOutDate >= cairoToday(now)) {
      errors.checkOutDate =
        "Check-out must be no later than yesterday in Cairo.";
    }
  }

  if (step === 3) {
    const guests = Number(draft.guestCount);
    if (!Number.isInteger(guests) || guests < 1)
      errors.guestCount = "Enter at least one guest.";
    if (draft.clientMode === "existing") {
      if (!GUID_PATTERN.test(draft.clientId))
        errors.clientId = "Select an existing client.";
    } else {
      if (!required(draft.newClientName))
        errors.newClientName = "Enter the client name.";
      else if (draft.newClientName.trim().length > 150)
        errors.newClientName = "Keep the name to 150 characters or fewer.";
      if (!phonePattern.test(draft.newClientPhone.trim()))
        errors.newClientPhone =
          "Enter 10 to 15 digits, optionally starting with +.";
      if (
        draft.newClientEmail &&
        !/^\S+@\S+\.\S+$/.test(draft.newClientEmail.trim())
      )
        errors.newClientEmail = "Enter a valid email address.";
      if (draft.newClientEmail.trim().length > 255)
        errors.newClientEmail = "Keep the email to 255 characters or fewer.";
    }
  }

  if (step === 4) {
    if (!moneyPattern.test(draft.agreedAmount.trim())) {
      errors.agreedAmount =
        "Enter a non-negative amount with up to two decimal places.";
    } else if (Number(draft.agreedAmount) > 9_999_999_999.99) {
      errors.agreedAmount = "The amount exceeds the supported limit.";
    }
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

export function validateAllHistoricalWizardSteps(
  draft: HistoricalBookingDraft,
  now = new Date()
): WizardValidationResult {
  const errors = [1, 2, 3, 4, 5, 6].reduce<Record<string, string>>(
    (current, step) => ({
      ...current,
      ...validateHistoricalWizardStep(step as HistoricalWizardStep, draft, now)
        .errors,
    }),
    {}
  );
  return { valid: Object.keys(errors).length === 0, errors };
}

const FIELD_STEPS: Record<string, HistoricalWizardStep> = {
  originalSource: 1,
  actualBookedAt: 1,
  historicalEntryReason: 1,
  historicalEntryNote: 1,
  externalReference: 1,
  unitId: 2,
  checkInDate: 2,
  checkOutDate: 2,
  clientId: 3,
  newClientName: 3,
  newClientPhone: 3,
  newClientEmail: 3,
  guestCount: 3,
  internalNotes: 3,
  agreedAmount: 4,
};

export function firstInvalidStep(
  errors: Record<string, string>
): HistoricalWizardStep {
  return Object.keys(errors).reduce<HistoricalWizardStep>(
    (first, field) => Math.min(first, FIELD_STEPS[field] ?? 6) as HistoricalWizardStep,
    6
  );
}

const optional = (value: string): string | undefined =>
  value.trim() || undefined;

export function buildHistoricalBookingRequest(
  draft: HistoricalBookingDraft
): RecordHistoricalBookingRequest {
  const request: RecordHistoricalBookingRequest = {
    unitId: draft.unitId,
    checkInDate: draft.checkInDate,
    checkOutDate: draft.checkOutDate,
    guestCount: Number(draft.guestCount),
    actualBookedAt: draft.actualBookedAt,
    historicalEntryReason: draft.historicalEntryReason as HistoricalEntryReason,
    originalSource: draft.originalSource as HistoricalOriginalSource,
    agreedAmount: Number(draft.agreedAmount),
    acknowledgedDuplicateOf: [...draft.acknowledgedDuplicateOf].sort(),
    acknowledgedDateBlockIds: [...draft.acknowledgedDateBlockIds].sort(),
  };

  if (draft.clientMode === "existing") {
    request.clientId = draft.clientId;
  } else {
    request.newClient = {
      name: draft.newClientName.trim(),
      phone: draft.newClientPhone.trim(),
      ...(optional(draft.newClientEmail)
        ? { email: optional(draft.newClientEmail) }
        : {}),
    };
  }

  const historicalEntryNote = optional(draft.historicalEntryNote);
  const externalReference = optional(draft.externalReference);
  const internalNotes = optional(draft.internalNotes);
  if (historicalEntryNote) request.historicalEntryNote = historicalEntryNote;
  if (externalReference) request.externalReference = externalReference;
  if (internalNotes) request.internalNotes = internalNotes;
  return request;
}

export function validateHistoricalPaymentDraft(
  draft: HistoricalPaymentDraft,
  now = new Date()
): WizardValidationResult {
  const errors: Record<string, string> = {};
  if (!moneyPattern.test(draft.amount.trim()) || Number(draft.amount) <= 0) {
    errors.paymentAmount =
      "Enter a positive amount with up to two decimal places.";
  }
  if (!draft.paymentMethod) errors.paymentMethod = "Select a payment method.";
  const paidAt = draft.paidAt ? cairoWallTimeToIso(draft.paidAt) : null;
  if (!draft.paidAt) errors.paidAt = "Enter when the payment occurred.";
  else if (!paidAt) errors.paidAt = "Enter a valid Cairo payment time.";
  else if (new Date(paidAt).getTime() > now.getTime())
    errors.paidAt = "Payment time cannot be in the future.";
  if (!required(draft.reason) || draft.reason.trim().length > 500)
    errors.paymentReason = "Enter a reason of 500 characters or fewer.";
  if (draft.referenceNumber.trim().length > 100)
    errors.referenceNumber = "Keep the reference to 100 characters or fewer.";
  return { valid: Object.keys(errors).length === 0, errors };
}

export function buildHistoricalPaymentRequest(
  draft: HistoricalPaymentDraft
): RecordHistoricalPaymentRequest {
  const paidAt = cairoWallTimeToIso(draft.paidAt);
  if (!paidAt) throw new Error("Payment timestamp must be valid Cairo wall time.");
  const request: RecordHistoricalPaymentRequest = {
    amount: Number(draft.amount),
    paymentMethod: draft.paymentMethod as HistoricalPaymentMethod,
    paidAt,
    reason: draft.reason.trim(),
  };
  const referenceNumber = optional(draft.referenceNumber);
  if (referenceNumber) request.referenceNumber = referenceNumber;
  return request;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)])
    );
  }
  return value;
}

export function commandFingerprint(command: unknown): string {
  return JSON.stringify(canonicalize(command));
}

export interface CommandIdentity {
  fingerprint: string;
  key: string;
}

export interface FrozenCommand<T> {
  identity: CommandIdentity;
  request: T;
}

export function resolveCommandIdentity(
  previous: CommandIdentity | null,
  command: unknown,
  createKey: () => string = () => crypto.randomUUID()
): CommandIdentity {
  const fingerprint = commandFingerprint(command);
  if (previous?.fingerprint === fingerprint) return previous;
  return { fingerprint, key: createKey() };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isDate(value: unknown): value is string {
  return typeof value === "string" && DATE_PATTERN.test(value);
}

function isTimestamp(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

export function parseHistoricalBookingResponse(
  value: unknown
): CommittedHistoricalBooking | null {
  if (!isObject(value)) return null;
  if (
    typeof value.id !== "string" ||
    !GUID_PATTERN.test(value.id) ||
    typeof value.unitId !== "string" ||
    !GUID_PATTERN.test(value.unitId) ||
    !(typeof value.unitName === "string" || value.unitName === null) ||
    !isDate(value.checkInDate) ||
    !isDate(value.checkOutDate) ||
    typeof value.agreedAmount !== "number" ||
    !Number.isFinite(value.agreedAmount) ||
    value.agreedAmount < 0 ||
    !isTimestamp(value.recordedAt) ||
    value.bookingStatus !== "Completed" ||
    value.isHistorical !== true
  )
    return null;
  return {
    id: value.id,
    unitId: value.unitId,
    unitName: value.unitName,
    checkInDate: value.checkInDate,
    checkOutDate: value.checkOutDate,
    agreedAmount: value.agreedAmount,
    recordedAt: value.recordedAt,
  };
}

const OWNER_WARNING_CODES = new Set([
  "CURRENT_OWNER_INACTIVE",
  "TARGET_OWNER_INACTIVE",
  "PAYOUT_REVIEW_REQUIRED",
]);

export function parseOwnerReviewResponse(
  value: unknown
): HistoricalOwnerAttributionReviewResponse | null {
  if (!isObject(value)) return null;
  if (
    typeof value.bookingId !== "string" ||
    !GUID_PATTERN.test(value.bookingId) ||
    typeof value.currentOwnerId !== "string" ||
    !GUID_PATTERN.test(value.currentOwnerId) ||
    typeof value.canCorrect !== "boolean" ||
    typeof value.payoutReviewRequired !== "boolean" ||
    !Array.isArray(value.warnings) ||
    !value.warnings.every(
      (warning) =>
        typeof warning === "string" && OWNER_WARNING_CODES.has(warning)
    ) ||
    new Set(value.warnings).size !== value.warnings.length
  )
    return null;
  return {
    bookingId: value.bookingId,
    currentOwnerId: value.currentOwnerId,
    canCorrect: value.canCorrect,
    payoutReviewRequired: value.payoutReviewRequired,
    warnings: [...value.warnings].sort(),
  };
}

const PAYMENT_METHODS = new Set<HistoricalPaymentMethod>([
  "cash",
  "bank_transfer",
  "card",
  "wallet",
]);

export function parseHistoricalPaymentResponse(
  value: unknown
): HistoricalPaymentResponse | null {
  if (!isObject(value)) return null;
  if (
    typeof value.paymentId !== "string" ||
    !GUID_PATTERN.test(value.paymentId) ||
    typeof value.bookingId !== "string" ||
    !GUID_PATTERN.test(value.bookingId) ||
    typeof value.amount !== "number" ||
    !Number.isFinite(value.amount) ||
    value.amount <= 0 ||
    typeof value.paymentMethod !== "string" ||
    !PAYMENT_METHODS.has(value.paymentMethod as HistoricalPaymentMethod) ||
    !isTimestamp(value.paidAt) ||
    !(typeof value.referenceNumber === "string" ||
      value.referenceNumber === null) ||
    typeof value.reason !== "string" ||
    !value.reason.trim() ||
    value.isHistoricalRecord !== true ||
    typeof value.recordedByAdminUserId !== "string" ||
    !GUID_PATTERN.test(value.recordedByAdminUserId) ||
    !isTimestamp(value.recordedAt) ||
    typeof value.historyEventId !== "string" ||
    !GUID_PATTERN.test(value.historyEventId)
  )
    return null;
  return {
    paymentId: value.paymentId,
    bookingId: value.bookingId,
    amount: value.amount,
    paymentMethod: value.paymentMethod as HistoricalPaymentMethod,
    paidAt: value.paidAt,
    referenceNumber: value.referenceNumber,
    reason: value.reason,
    isHistoricalRecord: true,
    recordedByAdminUserId: value.recordedByAdminUserId,
    recordedAt: value.recordedAt,
    historyEventId: value.historyEventId,
  };
}

export interface HistoricalRecoveryMetadata {
  version: 1;
  bookingId: string;
  payment?: {
    idempotencyKey: string;
    status: "pending" | "outcome-unknown";
  };
}

export function parseRecoveryMetadata(
  value: unknown
): HistoricalRecoveryMetadata | null {
  if (
    !isObject(value) ||
    value.version !== 1 ||
    Object.keys(value).some(
      (key) => key !== "version" && key !== "bookingId" && key !== "payment"
    )
  )
    return null;
  if (
    typeof value.bookingId !== "string" ||
    !GUID_PATTERN.test(value.bookingId)
  )
    return null;
  if (value.payment === undefined)
    return { version: 1, bookingId: value.bookingId };
  if (
    !isObject(value.payment) ||
    Object.keys(value.payment).some(
      (key) => key !== "idempotencyKey" && key !== "status"
    ) ||
    typeof value.payment.idempotencyKey !== "string" ||
    !GUID_PATTERN.test(value.payment.idempotencyKey) ||
    (value.payment.status !== "pending" &&
      value.payment.status !== "outcome-unknown")
  )
    return null;
  return {
    version: 1,
    bookingId: value.bookingId,
    payment: {
      idempotencyKey: value.payment.idempotencyKey,
      status: value.payment.status,
    },
  };
}
