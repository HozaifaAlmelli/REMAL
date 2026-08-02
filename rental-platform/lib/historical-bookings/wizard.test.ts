import assert from "node:assert/strict";
import test from "node:test";
import {
  HISTORICAL_WIZARD_STEPS,
  buildHistoricalBookingRequest,
  buildHistoricalPaymentRequest,
  createInitialHistoricalWizardState,
  historicalWizardReducer,
  resolveCommandIdentity,
  validateAllHistoricalWizardSteps,
  validateHistoricalPaymentDraft,
  validateHistoricalWizardStep,
  type HistoricalBookingDraft,
} from "./wizard";

const BOOKING_ID = "60000000-0000-4000-8000-000000000001";
const UNIT_ID = "50000000-0000-4000-8000-000000000001";
const CLIENT_ID = "40000000-0000-4000-8000-000000000001";
const OWNER_ID = "70000000-0000-4000-8000-000000000001";

function validDraft(): HistoricalBookingDraft {
  return {
    ...createInitialHistoricalWizardState().draft,
    originalSource: "offline_record",
    actualBookedAt: "2026-06-01",
    historicalEntryReason: "offline_booking_recorded_after_stay",
    unitId: UNIT_ID,
    checkInDate: "2026-06-10",
    checkOutDate: "2026-06-13",
    clientId: CLIENT_ID,
    guestCount: "2",
    agreedAmount: "3900.00",
  };
}

const booking = {
  id: BOOKING_ID,
  clientId: CLIENT_ID,
  unitId: UNIT_ID,
  unitName: "Sanitized unit",
  ownerId: OWNER_ID,
  assignedAdminUserId: null,
  assignedAdminUserName: null,
  assignedAdminUserRole: null,
  bookingStatus: "Completed" as const,
  checkInDate: "2026-06-10",
  checkOutDate: "2026-06-13",
  guestCount: 2,
  baseAmount: 3900,
  finalAmount: 3900,
  source: "admin",
  internalNotes: null,
  createdAt: "2026-08-02T10:00:00Z",
  updatedAt: "2026-08-02T10:00:00Z",
  isHistorical: true as const,
  actualBookedAt: "2026-06-01",
  historicalEntryReason: "offline_booking_recorded_after_stay" as const,
  historicalEntryNote: null,
  originalSource: "offline_record" as const,
  originalSourceLabel: "Offline record",
  externalReference: null,
  agreedAmount: 3900,
  recordedAt: "2026-08-02T10:00:00Z",
  recordedByAdminUserId: "10000000-0000-4000-8000-000000000001",
  idempotencyKey: "20000000-0000-4000-8000-000000000001",
  statusHistoryEventId: "30000000-0000-4000-8000-000000000001",
};

test("the canonical wizard has exactly six steps in contract order", () => {
  assert.deepEqual(
    HISTORICAL_WIZARD_STEPS.map((step) => step.label),
    [
      "Provenance",
      "Unit & occupied dates",
      "Client & stay details",
      "Financial truth",
    "Owner review",
      "Review & create",
    ]
  );
});

test("Step 5 is valid without any owner field or lookup result", () => {
  assert.deepEqual(validateHistoricalWizardStep(5, validDraft()), {
    valid: true,
    errors: {},
  });
});

test("buildHistoricalBookingRequest maps only approved fields", () => {
  const request = buildHistoricalBookingRequest(validDraft());
  assert.equal(request.clientId, CLIENT_ID);
  assert.equal(request.agreedAmount, 3900);
  assert.deepEqual(request.acknowledgedDuplicateOf, []);
  assert.deepEqual(request.acknowledgedDateBlockIds, []);
  for (const forbidden of [
    "ownerId",
    "ownerReview",
    "ownerPolicyAcknowledged",
    "payment",
    "actorId",
    "bookingStatus",
    "invoiceId",
  ]) {
    assert.equal(forbidden in request, false, forbidden);
  }
});

test("new client mapping preserves exact XOR and normalizes optional values", () => {
  const draft = {
    ...validDraft(),
    clientMode: "new" as const,
    clientId: CLIENT_ID,
    newClientName: "  New Client  ",
    newClientPhone: "  +201001234567  ",
    newClientEmail: "  new@example.test  ",
  };
  const request = buildHistoricalBookingRequest(draft);
  assert.equal(request.clientId, undefined);
  assert.deepEqual(request.newClient, {
    name: "New Client",
    phone: "+201001234567",
    email: "new@example.test",
  });
});

test("date validation uses half-open completed-stay boundaries without timezone conversion", () => {
  const today = new Date("2026-08-02T10:00:00Z");
  assert.equal(
    validateHistoricalWizardStep(2, validDraft(), today).valid,
    true
  );
  const adjacentToday = {
    ...validDraft(),
    checkInDate: "2026-08-01",
    checkOutDate: "2026-08-02",
  };
  assert.equal(
    validateHistoricalWizardStep(2, adjacentToday, today).valid,
    true
  );
  const future = { ...validDraft(), checkOutDate: "2026-08-03" };
  assert.equal(
    validateHistoricalWizardStep(2, future, today).errors.checkOutDate,
    "Historical stays must be completed in Cairo time."
  );
});

test("validation covers client XOR, amount precision, and Other reason detail", () => {
  const invalid = {
    ...validDraft(),
    historicalEntryReason: "other" as const,
    historicalEntryNote: "short",
    clientId: "",
    agreedAmount: "-1.001",
  };
  const result = validateAllHistoricalWizardSteps(invalid);
  assert.equal(result.valid, false);
  assert.ok(result.errors.historicalEntryNote);
  assert.ok(result.errors.clientId);
  assert.ok(result.errors.agreedAmount);
});

test("zero agreed amount is accepted and never defaulted from unit pricing", () => {
  const draft = { ...validDraft(), agreedAmount: "0.00" };
  assert.equal(validateHistoricalWizardStep(4, draft).valid, true);
  assert.equal(buildHistoricalBookingRequest(draft).agreedAmount, 0);
});

test("same semantic booking command retains its idempotency key", () => {
  let sequence = 0;
  const key = () => `key-${++sequence}`;
  const request = buildHistoricalBookingRequest(validDraft());
  const first = resolveCommandIdentity(null, request, key);
  const retry = resolveCommandIdentity(first, { ...request }, key);
  assert.equal(retry.key, "key-1");
  assert.equal(sequence, 1);
});

test("materially changed command rotates the booking idempotency key", () => {
  let sequence = 0;
  const key = () => `key-${++sequence}`;
  const request = buildHistoricalBookingRequest(validDraft());
  const first = resolveCommandIdentity(null, request, key);
  const changed = resolveCommandIdentity(
    first,
    { ...request, guestCount: 3 },
    key
  );
  assert.equal(changed.key, "key-2");
});

test("booking creation is irreversible before owner review completes", () => {
  let state = createInitialHistoricalWizardState();
  state = historicalWizardReducer(state, { type: "bookingCreated", booking });
  assert.equal(state.phase, "BookingCreatedOwnerReviewLoading");
  assert.equal(state.booking?.id, BOOKING_ID);
  assert.equal(
    historicalWizardReducer(state, { type: "goToStep", step: 2 }),
    state
  );
  assert.equal(
    historicalWizardReducer(state, {
      type: "updateDraft",
      patch: { unitId: "changed" },
    }),
    state
  );
});

test("review-required and unavailable states preserve committed booking identity", () => {
  const created = historicalWizardReducer(
    createInitialHistoricalWizardState(),
    { type: "bookingCreated", booking }
  );
  const required = historicalWizardReducer(created, {
    type: "ownerReviewRequired",
    issue: { kind: "review-required", message: "review", retryable: false },
  });
  assert.equal(required.phase, "BookingCreatedOwnerReviewRequired");
  assert.equal(required.booking?.id, BOOKING_ID);
  const unavailable = historicalWizardReducer(created, {
    type: "ownerReviewUnavailable",
    issue: { kind: "transport", message: "unavailable", retryable: true },
  });
  assert.equal(unavailable.phase, "BookingCreatedOwnerReviewUnavailable");
  assert.equal(unavailable.booking?.id, BOOKING_ID);
});

test("owner review must match the authoritative returned booking ID", () => {
  const created = historicalWizardReducer(
    createInitialHistoricalWizardState(),
    { type: "bookingCreated", booking }
  );
  const mismatched = historicalWizardReducer(created, {
    type: "ownerReviewLoaded",
    review: {
      bookingId: "60000000-0000-4000-8000-000000000099",
      currentOwnerId: OWNER_ID,
      canCorrect: false,
      payoutReviewRequired: false,
      warnings: [],
    },
  });
  assert.equal(mismatched, created);
});

test("payment validation and mapping are independent of booking creation", () => {
  const paymentDraft = {
    amount: "1000.00",
    paymentMethod: "cash" as const,
    paidAt: "2026-07-15T10:30",
    referenceNumber: "  LEGACY-123  ",
    reason: "  Verified legacy receipt  ",
  };
  assert.equal(
    validateHistoricalPaymentDraft(
      paymentDraft,
      new Date("2026-08-02T10:00:00Z")
    ).valid,
    true
  );
  assert.deepEqual(buildHistoricalPaymentRequest(paymentDraft), {
    amount: 1000,
    paymentMethod: "cash",
    paidAt: new Date("2026-07-15T10:30").toISOString(),
    referenceNumber: "LEGACY-123",
    reason: "Verified legacy receipt",
  });
});

test("payment failure keeps the booking and permits payment-only retry", () => {
  let state = historicalWizardReducer(createInitialHistoricalWizardState(), {
    type: "bookingCreated",
    booking,
  });
  state = historicalWizardReducer(state, { type: "paymentSubmitting" });
  state = historicalWizardReducer(state, {
    type: "paymentFailed",
    message: "retry",
  });
  assert.equal(state.phase, "PaymentFailed");
  assert.equal(state.booking?.id, BOOKING_ID);
  assert.equal(state.payment, null);
});
