import assert from "node:assert/strict";
import test from "node:test";
import {
  HISTORICAL_WIZARD_STEPS,
  buildHistoricalBookingRequest,
  buildHistoricalPaymentRequest,
  cairoWallTimeToIso,
  createInitialHistoricalWizardState,
  firstInvalidStep,
  historicalWizardReducer,
  mergeConflictAcknowledgements,
  parseHistoricalBookingResponse,
  parseHistoricalPaymentResponse,
  parseOwnerReviewResponse,
  parseRecoveryMetadata,
  resolveCommandIdentity,
  validateAllHistoricalWizardSteps,
  validateHistoricalPaymentDraft,
  validateHistoricalWizardStep,
  type HistoricalBookingDraft,
  type HistoricalWizardState,
} from "./wizard";

const BOOKING_ID = "60000000-0000-4000-8000-000000000001";
const UNIT_ID = "50000000-0000-4000-8000-000000000001";
const CLIENT_ID = "40000000-0000-4000-8000-000000000001";
const OWNER_ID = "70000000-0000-4000-8000-000000000001";
const PAYMENT_ID = "80000000-0000-4000-8000-000000000001";

function validDraft(): HistoricalBookingDraft {
  return {
    ...createInitialHistoricalWizardState().draft,
    originalSource: "offline_record",
    actualBookedAt: "2026-06-01",
    historicalEntryReason: "offline_booking_recorded_after_stay",
    historicalEntryNote: "Verified from legacy booking records",
    externalReference: "LEGACY-BOOKING-1",
    unitId: UNIT_ID,
    checkInDate: "2026-06-10",
    checkOutDate: "2026-06-13",
    clientId: CLIENT_ID,
    guestCount: "2",
    internalNotes: "Internal reconciliation note",
    agreedAmount: "3900.00",
  };
}

const bookingResponse = {
  id: BOOKING_ID,
  clientId: CLIENT_ID,
  unitId: UNIT_ID,
  unitName: "Sanitized unit",
  ownerId: OWNER_ID,
  assignedAdminUserId: null,
  assignedAdminUserName: null,
  assignedAdminUserRole: null,
  bookingStatus: "Completed",
  checkInDate: "2026-06-10",
  checkOutDate: "2026-06-13",
  guestCount: 2,
  baseAmount: 3900,
  finalAmount: 3900,
  source: "admin",
  internalNotes: null,
  createdAt: "2026-08-02T10:00:00Z",
  updatedAt: "2026-08-02T10:00:00Z",
  isHistorical: true,
  actualBookedAt: "2026-06-01",
  historicalEntryReason: "offline_booking_recorded_after_stay",
  historicalEntryNote: null,
  originalSource: "offline_record",
  originalSourceLabel: "Offline record",
  externalReference: null,
  agreedAmount: 3900,
  recordedAt: "2026-08-02T10:00:00Z",
  recordedByAdminUserId: "10000000-0000-4000-8000-000000000001",
  idempotencyKey: "20000000-0000-4000-8000-000000000001",
  statusHistoryEventId: "30000000-0000-4000-8000-000000000001",
};

const ownerReview = {
  bookingId: BOOKING_ID,
  currentOwnerId: OWNER_ID,
  canCorrect: true,
  payoutReviewRequired: false,
  warnings: ["CURRENT_OWNER_INACTIVE"],
};

const paymentResponse = {
  paymentId: PAYMENT_ID,
  bookingId: BOOKING_ID,
  amount: 1000,
  paymentMethod: "cash",
  paidAt: "2026-07-15T07:30:00.000Z",
  referenceNumber: "LEGACY-123",
  reason: "Verified legacy receipt",
  isHistoricalRecord: true,
  recordedByAdminUserId: "10000000-0000-4000-8000-000000000001",
  recordedAt: "2026-08-02T10:10:00Z",
  historyEventId: "30000000-0000-4000-8000-000000000002",
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

test("Step 5 is policy-only and maps no owner field", () => {
  assert.deepEqual(validateHistoricalWizardStep(5, validDraft()), {
    valid: true,
    errors: {},
  });
  const request = buildHistoricalBookingRequest(validDraft());
  for (const forbidden of [
    "ownerId",
    "ownerReview",
    "ownerPolicyAcknowledged",
    "actorId",
    "payment",
  ]) {
    assert.equal(forbidden in request, false, forbidden);
  }
});

test("booking request is explicit and preserves exact material values", () => {
  const request = buildHistoricalBookingRequest(validDraft());
  assert.equal(request.clientId, CLIENT_ID);
  assert.equal(request.agreedAmount, 3900);
  assert.equal(request.historicalEntryNote, "Verified from legacy booking records");
  assert.equal(request.internalNotes, "Internal reconciliation note");
  assert.deepEqual(request.acknowledgedDuplicateOf, []);
  assert.deepEqual(request.acknowledgedDateBlockIds, []);
});

test("new-client mapping enforces the request XOR and normalization", () => {
  const request = buildHistoricalBookingRequest({
    ...validDraft(),
    clientMode: "new",
    newClientName: "  New Client  ",
    newClientPhone: "  +201001234567  ",
    newClientEmail: "  new@example.test  ",
  });
  assert.equal(request.clientId, undefined);
  assert.deepEqual(request.newClient, {
    name: "New Client",
    phone: "+201001234567",
    email: "new@example.test",
  });
});

test("Cairo checkout boundary accepts yesterday and rejects today and tomorrow", () => {
  const now = new Date("2026-08-02T10:00:00Z");
  const yesterday = {
    ...validDraft(),
    checkInDate: "2026-07-30",
    checkOutDate: "2026-08-01",
  };
  assert.equal(validateHistoricalWizardStep(2, yesterday, now).valid, true);
  for (const checkOutDate of ["2026-08-02", "2026-08-03"]) {
    const result = validateHistoricalWizardStep(
      2,
      { ...yesterday, checkOutDate },
      now
    );
    assert.equal(
      result.errors.checkOutDate,
      "Check-out must be no later than yesterday in Cairo."
    );
  }
});

test("historical command and response boundaries accept only UUIDv1-v5 and UUIDv7", () => {
  const accepted = [
    "50000000-0000-4000-8000-000000000001",
    "019fce32-20fe-7bbb-ae0e-a1b766ea2d8e",
    "019FCE32-20FE-7BBB-AE0E-A1B766EA2D8E",
    "019fce32-20fe-7bbb-8e0e-a1b766ea2d8e",
    "019fce32-20fe-7bbb-9e0e-a1b766ea2d8e",
    "019fce32-20fe-7bbb-ae0e-a1b766ea2d8e",
    "019fce32-20fe-7bbb-be0e-a1b766ea2d8e",
  ];
  const rejected = [
    "019fce32-20fe-0bbb-ae0e-a1b766ea2d8e",
    "019fce32-20fe-6bbb-ae0e-a1b766ea2d8e",
    "019fce32-20fe-8bbb-ae0e-a1b766ea2d8e",
    "019fce32-20fe-9bbb-ae0e-a1b766ea2d8e",
    "019fce32-20fe-7bbb-0e0e-a1b766ea2d8e",
    "019fce32-20fe-7bbb-7e0e-a1b766ea2d8e",
    "019fce32-20fe-7bbb-ce0e-a1b766ea2d8e",
    "00000000-0000-0000-0000-000000000000",
    " 019fce32-20fe-7bbb-ae0e-a1b766ea2d8e ",
    "019fce3220fe7bbbae0ea1b766ea2d8e",
    "https://example.test/019fce32-20fe-7bbb-ae0e-a1b766ea2d8e",
    "../../019fce32-20fe-7bbb-ae0e-a1b766ea2d8e",
    "<script>019fce32-20fe-7bbb-ae0e-a1b766ea2d8e</script>",
  ];

  for (const unitId of accepted) {
    const draft = { ...validDraft(), unitId };
    assert.equal(validateHistoricalWizardStep(2, draft).valid, true, unitId);
    assert.equal(buildHistoricalBookingRequest(draft).unitId, unitId);
    assert.equal(
      parseHistoricalBookingResponse({ ...bookingResponse, unitId })?.unitId,
      unitId
    );
  }
  for (const unitId of rejected) {
    assert.equal(
      validateHistoricalWizardStep(2, { ...validDraft(), unitId }).errors
        .unitId,
      "Select a unit.",
      unitId
    );
    assert.equal(
      parseHistoricalBookingResponse({ ...bookingResponse, unitId }),
      null,
      unitId
    );
  }
});

test("Cairo checkout boundary is independent of browser-local timezone", () => {
  const original = process.env.TZ;
  try {
    for (const timezone of ["Africa/Cairo", "UTC", "America/Los_Angeles"]) {
      process.env.TZ = timezone;
      assert.equal(
        validateHistoricalWizardStep(
          2,
          {
            ...validDraft(),
            checkInDate: "2026-07-30",
            checkOutDate: "2026-08-02",
          },
          new Date("2026-08-02T10:00:00Z")
        ).valid,
        false
      );
    }
  } finally {
    process.env.TZ = original;
  }
});

test("Cairo paidAt conversion is deterministic across process timezones", () => {
  const original = process.env.TZ;
  try {
    for (const timezone of ["Africa/Cairo", "UTC", "America/New_York"]) {
      process.env.TZ = timezone;
      assert.equal(
        cairoWallTimeToIso("2026-07-15T10:30"),
        "2026-07-15T07:30:00.000Z"
      );
    }
  } finally {
    process.env.TZ = original;
  }
});

test("payment validation and mapping use Cairo wall time", () => {
  const draft = {
    amount: "1000.00",
    paymentMethod: "cash" as const,
    paidAt: "2026-07-15T10:30",
    referenceNumber: "  LEGACY-123  ",
    reason: "  Verified legacy receipt  ",
  };
  assert.equal(
    validateHistoricalPaymentDraft(
      draft,
      new Date("2026-08-02T10:00:00Z")
    ).valid,
    true
  );
  assert.deepEqual(buildHistoricalPaymentRequest(draft), {
    amount: 1000,
    paymentMethod: "cash",
    paidAt: "2026-07-15T07:30:00.000Z",
    referenceNumber: "LEGACY-123",
    reason: "Verified legacy receipt",
  });
});

test("all four canonical historical payment methods map without widening the contract", () => {
  for (const paymentMethod of [
    "cash",
    "bank_transfer",
    "card",
    "wallet",
  ] as const) {
    const request = buildHistoricalPaymentRequest({
      amount: "10.00",
      paymentMethod,
      paidAt: "2026-07-15T10:30",
      referenceNumber: "",
      reason: "Verified legacy receipt",
    });
    assert.equal(request.paymentMethod, paymentMethod);
  }
});

test("firstInvalidStep routes submit-time validation to the earliest step", () => {
  assert.equal(firstInvalidStep({ unitId: "Select", clientId: "Select" }), 2);
  assert.equal(firstInvalidStep({ clientId: "Select" }), 3);
});

test("duplicate acknowledgements clear on unit, dates, client, phone and reference changes", () => {
  const acknowledged = {
    ...createInitialHistoricalWizardState(),
    draft: {
      ...validDraft(),
      acknowledgedDuplicateOf: [BOOKING_ID],
      acknowledgedDateBlockIds: ["90000000-0000-4000-8000-000000000001"],
    },
  };
  for (const patch of [
    { unitId: "50000000-0000-4000-8000-000000000002" },
    { checkInDate: "2026-06-09" },
    { checkOutDate: "2026-06-14" },
    { clientId: "40000000-0000-4000-8000-000000000002" },
    { clientMode: "new" as const },
    { newClientPhone: "+201009999999" },
    { externalReference: "LEGACY-BOOKING-2" },
  ]) {
    const next = historicalWizardReducer(acknowledged, {
      type: "updateDraft",
      patch,
    });
    assert.deepEqual(next.draft.acknowledgedDuplicateOf, []);
    assert.deepEqual(next.draft.acknowledgedDateBlockIds, []);
    assert.equal(next.conflict, null);
  }
});

test("presentation-only and non-candidate edits retain acknowledgement IDs", () => {
  const state = {
    ...createInitialHistoricalWizardState(),
    draft: {
      ...validDraft(),
      acknowledgedDuplicateOf: [BOOKING_ID],
      acknowledgedDateBlockIds: ["90000000-0000-4000-8000-000000000001"],
    },
  };
  const next = historicalWizardReducer(state, {
    type: "updateDraft",
    patch: { agreedAmount: "4000.00", internalNotes: "updated" },
  });
  assert.deepEqual(next.draft.acknowledgedDuplicateOf, [BOOKING_ID]);
  assert.equal(next.draft.acknowledgedDateBlockIds.length, 1);
});

test("conflict acknowledgements replace only populated categories and stay deterministic", () => {
  const dateBlockId = "90000000-0000-4000-8000-000000000001";
  const draft = {
    ...validDraft(),
    acknowledgedDuplicateOf: [BOOKING_ID, BOOKING_ID],
    acknowledgedDateBlockIds: [],
  };
  const dateBlockRound = mergeConflictAcknowledgements(draft, {
    code: "HISTORICAL_OVERLAP_CONFLICT",
    message: "Date block",
    exactDuplicateOf: null,
    candidates: [],
    hardConflicts: [],
    dateBlocks: [
      {
        dateBlockId,
        startDate: "2026-06-10",
        endDate: "2026-06-13",
      },
      {
        dateBlockId,
        startDate: "2026-06-10",
        endDate: "2026-06-13",
      },
    ],
    acknowledgeable: true,
  });
  assert.deepEqual(dateBlockRound.acknowledgedDuplicateOf, [BOOKING_ID]);
  assert.deepEqual(dateBlockRound.acknowledgedDateBlockIds, [dateBlockId]);

  const replacementId = "60000000-0000-4000-8000-000000000002";
  const duplicateRound = mergeConflictAcknowledgements(
    { ...draft, ...dateBlockRound },
    {
      code: "HISTORICAL_DUPLICATE_BOOKING",
      message: "Duplicate",
      exactDuplicateOf: null,
      candidates: [
        {
          bookingId: replacementId,
          status: "Confirmed",
          checkInDate: "2026-06-10",
          checkOutDate: "2026-06-13",
        },
      ],
      hardConflicts: [],
      dateBlocks: [],
      acknowledgeable: true,
    }
  );
  assert.deepEqual(replacementId, duplicateRound.acknowledgedDuplicateOf[0]);
  assert.deepEqual(duplicateRound.acknowledgedDateBlockIds, [dateBlockId]);
});

test("same semantic booking command retains its idempotency key", () => {
  let sequence = 0;
  const request = buildHistoricalBookingRequest(validDraft());
  const first = resolveCommandIdentity(null, request, () => `key-${++sequence}`);
  const retry = resolveCommandIdentity(first, { ...request }, () => `key-${++sequence}`);
  assert.equal(retry.key, "key-1");
  assert.equal(sequence, 1);
});

test("material booking edits rotate the idempotency key before submission", () => {
  let sequence = 0;
  const request = buildHistoricalBookingRequest(validDraft());
  const first = resolveCommandIdentity(null, request, () => `key-${++sequence}`);
  const changed = resolveCommandIdentity(
    first,
    { ...request, guestCount: 3 },
    () => `key-${++sequence}`
  );
  assert.equal(changed.key, "key-2");
});

test("unknown booking outcome freezes draft mutation and navigation", () => {
  let state: HistoricalWizardState = {
    ...createInitialHistoricalWizardState(),
    currentStep: 6 as const,
    draft: validDraft(),
  };
  state = historicalWizardReducer(state, {
    type: "bookingOutcomeUnknown",
    message: "unknown",
  });
  assert.equal(state.bookingStatus, "OutcomeUnknown");
  assert.equal(
    historicalWizardReducer(state, {
      type: "updateDraft",
      patch: { guestCount: "3" },
    }),
    state
  );
  assert.equal(
    historicalWizardReducer(state, { type: "goToStep", step: 2 }),
    state
  );
});

test("booking creation is irreversible and clears sensitive draft state", () => {
  const parsed = parseHistoricalBookingResponse(bookingResponse);
  assert.ok(parsed);
  let state = { ...createInitialHistoricalWizardState(), draft: validDraft() };
  state = historicalWizardReducer(state, {
    type: "bookingCreated",
    booking: parsed,
  });
  assert.equal(state.bookingStatus, "Committed");
  assert.equal(state.ownerReviewStatus, "Loading");
  assert.equal(state.booking?.id, BOOKING_ID);
  assert.equal(state.draft.newClientPhone, "");
  assert.equal(state.draft.internalNotes, "");
  assert.equal(
    historicalWizardReducer(state, { type: "goToStep", step: 2 }),
    state
  );
});

test("owner review completion cannot change payment submission state", () => {
  const parsed = parseHistoricalBookingResponse(bookingResponse)!;
  let state = historicalWizardReducer(createInitialHistoricalWizardState(), {
    type: "bookingCreated",
    booking: parsed,
  });
  state = historicalWizardReducer(state, { type: "paymentSubmitting" });
  state = historicalWizardReducer(state, {
    type: "ownerReviewLoaded",
    review: parseOwnerReviewResponse(ownerReview)!,
  });
  assert.equal(state.ownerReviewStatus, "Available");
  assert.equal(state.paymentStatus, "Submitting");
});

test("payment failure and unknown outcome preserve committed booking identity", () => {
  const parsed = parseHistoricalBookingResponse(bookingResponse)!;
  const created = historicalWizardReducer(createInitialHistoricalWizardState(), {
    type: "bookingCreated",
    booking: parsed,
  });
  const failed = historicalWizardReducer(created, {
    type: "paymentFailed",
    message: "rejected",
  });
  assert.equal(failed.paymentStatus, "Failed");
  assert.equal(failed.booking?.id, BOOKING_ID);
  const unknown = historicalWizardReducer(created, {
    type: "paymentOutcomeUnknown",
    message: "unknown",
  });
  assert.equal(unknown.paymentStatus, "OutcomeUnknown");
  assert.equal(unknown.booking?.id, BOOKING_ID);
});

test("recovered state requires verification before becoming committed", () => {
  let state = historicalWizardReducer(createInitialHistoricalWizardState(), {
    type: "recoveryVerifying",
    bookingId: BOOKING_ID,
    paymentOutcomeUnknown: true,
  });
  assert.equal(state.bookingStatus, "RecoveredVerifying");
  assert.equal(state.booking, null);
  state = historicalWizardReducer(state, {
    type: "recoveryConfirmed",
    bookingId: BOOKING_ID,
    review: parseOwnerReviewResponse(ownerReview)!,
    paymentOutcomeUnknown: true,
  });
  assert.equal(state.bookingStatus, "Committed");
  assert.equal(state.booking?.id, BOOKING_ID);
  assert.equal(state.paymentStatus, "ReconciliationRequired");
});

test("recovery metadata accepts only safe opaque fields", () => {
  const key = "20000000-0000-4000-8000-000000000001";
  assert.deepEqual(
    parseRecoveryMetadata({
      version: 1,
      bookingId: BOOKING_ID,
      payment: { idempotencyKey: key, status: "outcome-unknown" },
    }),
    {
      version: 1,
      bookingId: BOOKING_ID,
      payment: { idempotencyKey: key, status: "outcome-unknown" },
    }
  );
  assert.equal(
    parseRecoveryMetadata({
      version: 1,
      bookingId: BOOKING_ID,
      amount: 1000,
    }),
    null
  );
  assert.equal(parseRecoveryMetadata({ version: 1, bookingId: "not-guid" }), null);
});

test("booking response parser whitelists valid committed values", () => {
  assert.deepEqual(parseHistoricalBookingResponse(bookingResponse), {
    id: BOOKING_ID,
    unitId: UNIT_ID,
    unitName: "Sanitized unit",
    checkInDate: "2026-06-10",
    checkOutDate: "2026-06-13",
    agreedAmount: 3900,
    recordedAt: "2026-08-02T10:00:00Z",
  });
  assert.equal(parseHistoricalBookingResponse({ ...bookingResponse, id: "bad" }), null);
  assert.equal(parseHistoricalBookingResponse({ ...bookingResponse, agreedAmount: undefined }), null);
});

test("owner review parser rejects malformed and unknown warning values", () => {
  assert.deepEqual(parseOwnerReviewResponse(ownerReview), ownerReview);
  assert.equal(parseOwnerReviewResponse({ ...ownerReview, warnings: undefined }), null);
  assert.equal(parseOwnerReviewResponse({ ...ownerReview, warnings: ["UNKNOWN"] }), null);
  assert.equal(
    parseOwnerReviewResponse({
      ...ownerReview,
      warnings: ["CURRENT_OWNER_INACTIVE", "CURRENT_OWNER_INACTIVE"],
    }),
    null
  );
});

test("payment response parser requires immutable evidence identity", () => {
  assert.deepEqual(parseHistoricalPaymentResponse(paymentResponse), paymentResponse);
  assert.equal(
    parseHistoricalPaymentResponse({ ...paymentResponse, paymentId: undefined }),
    null
  );
  assert.equal(
    parseHistoricalPaymentResponse({
      ...paymentResponse,
      isHistoricalRecord: false,
    }),
    null
  );
});

test("validation covers client XOR, amount precision, and Other note", () => {
  const result = validateAllHistoricalWizardSteps({
    ...validDraft(),
    historicalEntryReason: "other",
    historicalEntryNote: "short",
    clientId: "",
    agreedAmount: "-1.001",
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.historicalEntryNote);
  assert.ok(result.errors.clientId);
  assert.ok(result.errors.agreedAmount);
});

test("zero agreed amount remains valid and is never defaulted", () => {
  const draft = { ...validDraft(), agreedAmount: "0.00" };
  assert.equal(validateHistoricalWizardStep(4, draft).valid, true);
  assert.equal(buildHistoricalBookingRequest(draft).agreedAmount, 0);
});
