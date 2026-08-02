import type {
  HistoricalBookingResponse,
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
export type HistoricalWizardPhase =
  | "Drafting"
  | "StepValidating"
  | "BookingSubmitting"
  | "BookingCreatedOwnerReviewLoading"
  | "BookingCreatedOwnerReviewAvailable"
  | "BookingCreatedOwnerReviewRequired"
  | "BookingCreatedOwnerReviewUnavailable"
  | "PaymentSubmitting"
  | "PaymentRecorded"
  | "PaymentFailed"
  | "Completed";

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
  candidates: HistoricalConflictBookingMetadata[];
  dateBlocks: HistoricalDateBlockMetadata[];
}

export interface OwnerReviewIssue {
  kind: "review-required" | "forbidden" | "not-found" | "transport";
  message: string;
  retryable: boolean;
}

export interface HistoricalWizardState {
  currentStep: HistoricalWizardStep;
  phase: HistoricalWizardPhase;
  draft: HistoricalBookingDraft;
  validationErrors: Record<string, string>;
  bookingError: string | null;
  conflict: HistoricalWizardConflict | null;
  booking: CommittedHistoricalBooking | null;
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
  | { type: "validationFailed"; errors: Record<string, string> }
  | { type: "bookingSubmitting" }
  | {
      type: "bookingFailed";
      message: string;
      conflict?: HistoricalWizardConflict;
    }
  | { type: "bookingCreated"; booking: HistoricalBookingResponse }
  | { type: "bookingRecovered"; bookingId: string }
  | {
      type: "ownerReviewLoaded";
      review: HistoricalOwnerAttributionReviewResponse;
    }
  | { type: "ownerReviewRequired"; issue: OwnerReviewIssue }
  | { type: "ownerReviewUnavailable"; issue: OwnerReviewIssue }
  | { type: "ownerReviewRetrying" }
  | { type: "paymentSubmitting" }
  | { type: "paymentRecorded"; payment: HistoricalPaymentResponse }
  | { type: "paymentFailed"; message: string }
  | { type: "completed" };

export type CommittedHistoricalBooking = Pick<
  HistoricalBookingResponse,
  | "id"
  | "unitId"
  | "unitName"
  | "checkInDate"
  | "checkOutDate"
  | "agreedAmount"
  | "recordedAt"
>;

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
    phase: "Drafting",
    draft: emptyHistoricalBookingDraft(),
    validationErrors: {},
    bookingError: null,
    conflict: null,
    booking: null,
    ownerReview: null,
    ownerReviewIssue: null,
    paymentDraft: emptyHistoricalPaymentDraft(),
    payment: null,
    paymentError: null,
  });

export function historicalWizardReducer(
  state: HistoricalWizardState,
  action: HistoricalWizardAction
): HistoricalWizardState {
  switch (action.type) {
    case "updateDraft":
      if (state.booking) return state;
      return {
        ...state,
        phase: "Drafting",
        draft: { ...state.draft, ...action.patch },
        validationErrors: {},
        bookingError: null,
        conflict: null,
      };
    case "updatePaymentDraft":
      if (!state.booking || state.payment) return state;
      return {
        ...state,
        paymentDraft: { ...state.paymentDraft, ...action.patch },
        paymentError: null,
      };
    case "goToStep":
      if (state.booking || action.step < 1 || action.step > 6) return state;
      return {
        ...state,
        currentStep: action.step,
        phase: "Drafting",
        validationErrors: {},
      };
    case "validationFailed":
      return {
        ...state,
        phase: "StepValidating",
        validationErrors: action.errors,
      };
    case "bookingSubmitting":
      if (state.booking) return state;
      return {
        ...state,
        phase: "BookingSubmitting",
        bookingError: null,
        conflict: null,
      };
    case "bookingFailed":
      if (state.booking) return state;
      return {
        ...state,
        phase: "Drafting",
        bookingError: action.message,
        conflict: action.conflict ?? null,
      };
    case "bookingCreated":
      return {
        ...state,
        phase: "BookingCreatedOwnerReviewLoading",
        booking: action.booking,
        bookingError: null,
        conflict: null,
        validationErrors: {},
        ownerReview: null,
        ownerReviewIssue: null,
      };
    case "bookingRecovered":
      if (state.booking) return state;
      return {
        ...state,
        phase: "BookingCreatedOwnerReviewLoading",
        booking: {
          id: action.bookingId,
          unitId: "",
          unitName: null,
          checkInDate: "",
          checkOutDate: "",
          agreedAmount: 0,
          recordedAt: "",
        },
        bookingError: null,
        conflict: null,
        validationErrors: {},
      };
    case "ownerReviewLoaded":
      if (!state.booking || action.review.bookingId !== state.booking.id)
        return state;
      return {
        ...state,
        phase: "BookingCreatedOwnerReviewAvailable",
        ownerReview: action.review,
        ownerReviewIssue: null,
      };
    case "ownerReviewRequired":
      if (!state.booking) return state;
      return {
        ...state,
        phase: "BookingCreatedOwnerReviewRequired",
        ownerReview: null,
        ownerReviewIssue: action.issue,
      };
    case "ownerReviewUnavailable":
      if (!state.booking) return state;
      return {
        ...state,
        phase: "BookingCreatedOwnerReviewUnavailable",
        ownerReview: null,
        ownerReviewIssue: action.issue,
      };
    case "ownerReviewRetrying":
      if (!state.booking) return state;
      return {
        ...state,
        phase: "BookingCreatedOwnerReviewLoading",
        ownerReviewIssue: null,
      };
    case "paymentSubmitting":
      if (!state.booking || state.payment) return state;
      return { ...state, phase: "PaymentSubmitting", paymentError: null };
    case "paymentRecorded":
      if (!state.booking || action.payment.bookingId !== state.booking.id)
        return state;
      return {
        ...state,
        phase: "PaymentRecorded",
        payment: action.payment,
        paymentError: null,
      };
    case "paymentFailed":
      if (!state.booking) return state;
      return { ...state, phase: "PaymentFailed", paymentError: action.message };
    case "completed":
      if (!state.booking) return state;
      return { ...state, phase: "Completed" };
  }
}

const required = (value: string): boolean => value.trim().length > 0;
const guidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
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
    if (!guidPattern.test(draft.unitId)) errors.unitId = "Select a unit.";
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
    if (draft.checkOutDate && draft.checkOutDate > cairoToday(now)) {
      errors.checkOutDate = "Historical stays must be completed in Cairo time.";
    }
  }

  if (step === 3) {
    const guests = Number(draft.guestCount);
    if (!Number.isInteger(guests) || guests < 1)
      errors.guestCount = "Enter at least one guest.";
    if (draft.clientMode === "existing") {
      if (!guidPattern.test(draft.clientId))
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
  if (!draft.paidAt) errors.paidAt = "Enter when the payment occurred.";
  else if (new Date(draft.paidAt).getTime() > now.getTime())
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
  const request: RecordHistoricalPaymentRequest = {
    amount: Number(draft.amount),
    paymentMethod: draft.paymentMethod as HistoricalPaymentMethod,
    paidAt: new Date(draft.paidAt).toISOString(),
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

export function resolveCommandIdentity(
  previous: CommandIdentity | null,
  command: unknown,
  createKey: () => string = () => crypto.randomUUID()
): CommandIdentity {
  const fingerprint = commandFingerprint(command);
  if (previous?.fingerprint === fingerprint) return previous;
  return { fingerprint, key: createKey() };
}
