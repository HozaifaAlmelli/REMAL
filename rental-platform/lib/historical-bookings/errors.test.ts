import assert from "node:assert/strict";
import test from "node:test";
import { ApiError } from "@/lib/api/api-error";
import {
  bookingErrorMessage,
  isUnknownCommandOutcome,
  ownerReviewIssue,
  paymentErrorMessage,
  toHistoricalWizardConflict,
} from "./errors";

test("safe conflict parsing accepts contract metadata and drops PII", () => {
  const error = new ApiError(
    409,
    "Duplicate",
    [],
    "HISTORICAL_DUPLICATE_BOOKING",
    {
      candidates: [
        {
          bookingId: "60000000-0000-4000-8000-000000000001",
          status: "Relevant",
          checkInDate: "2026-06-10",
          checkOutDate: "2026-06-13",
          clientName: "must not render",
          phone: "+201000000000",
          amount: 9000,
        },
      ],
    }
  );
  assert.deepEqual(toHistoricalWizardConflict(error)?.candidates, [
    {
      bookingId: "60000000-0000-4000-8000-000000000001",
      status: "Relevant",
      checkInDate: "2026-06-10",
      checkOutDate: "2026-06-13",
    },
  ]);
  assert.equal(toHistoricalWizardConflict(error)?.acknowledgeable, true);
});

test("safe conflict parsing accepts only supported UUID versions and RFC variants", () => {
  const accepted = [
    "60000000-0000-4000-8000-000000000001",
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
  const parseExactDuplicate = (bookingId: string) =>
    toHistoricalWizardConflict(
      new ApiError(409, "Duplicate", [], "HISTORICAL_DUPLICATE_BOOKING", {
        duplicateOf: bookingId,
      })
    )?.exactDuplicateOf;

  for (const bookingId of accepted) {
    assert.equal(parseExactDuplicate(bookingId), bookingId);
  }
  for (const bookingId of rejected) {
    assert.equal(parseExactDuplicate(bookingId), null, bookingId);
  }
});

test("exact duplicate scalar is displayed safely but cannot be acknowledged", () => {
  const duplicateOf = "60000000-0000-4000-8000-000000000001";
  const conflict = toHistoricalWizardConflict(
    new ApiError(409, "Duplicate", [], "HISTORICAL_DUPLICATE_BOOKING", {
      duplicateOf,
      clientName: "must not render",
    })
  );
  assert.equal(conflict?.exactDuplicateOf, duplicateOf);
  assert.equal(conflict?.acknowledgeable, false);
});

test("unsafe malformed metadata is ignored", () => {
  const error = new ApiError(
    409,
    "Overlap",
    [],
    "HISTORICAL_OVERLAP_CONFLICT",
    {
      conflicts: [
        {
          bookingId: "not-a-guid",
          status: "Booked",
          checkInDate: "soon",
          checkOutDate: "later",
        },
      ],
    }
  );
  assert.deepEqual(toHistoricalWizardConflict(error)?.hardConflicts, []);
});

test("hard overlaps are safe and never acknowledgeable", () => {
  const conflict = toHistoricalWizardConflict(
    new ApiError(409, "Overlap", [], "HISTORICAL_OVERLAP_CONFLICT", {
      conflicts: [
        {
          bookingId: "60000000-0000-4000-8000-000000000001",
          status: "Booked",
          checkInDate: "2026-06-10",
          checkOutDate: "2026-06-13",
        },
      ],
    })
  );
  assert.equal(conflict?.hardConflicts.length, 1);
  assert.equal(conflict?.acknowledgeable, false);
});

test("review required, forbidden, not found, business and transport errors are distinct", () => {
  assert.equal(
    ownerReviewIssue(
      new ApiError(409, "", [], "OWNER_ATTRIBUTION_REQUIRES_REVIEW")
    ).kind,
    "review-required"
  );
  assert.equal(
    ownerReviewIssue(new ApiError(403, "Forbidden")).kind,
    "forbidden"
  );
  assert.equal(
    ownerReviewIssue(new ApiError(404, "Missing")).kind,
    "not-found"
  );
  const unknownBusiness = ownerReviewIssue(
    new ApiError(409, "Unknown business", [], "UNKNOWN")
  );
  assert.equal(unknownBusiness.kind, "business");
  assert.equal(unknownBusiness.retryable, false);
  assert.deepEqual(ownerReviewIssue(new Error("network")).kind, "transport");
});

test("gateway statuses are unknown command outcomes while controlled 500 is definite", () => {
  for (const status of [0, 408, 502, 503, 504]) {
    assert.equal(
      isUnknownCommandOutcome(
        new ApiError(status, "Gateway response"),
        "IDEMPOTENCY_REQUEST_IN_PROGRESS"
      ),
      true,
      `status ${status}`
    );
  }
  assert.equal(
    isUnknownCommandOutcome(
      new ApiError(500, "Controlled application failure"),
      "IDEMPOTENCY_REQUEST_IN_PROGRESS"
    ),
    false
  );
  assert.equal(
    isUnknownCommandOutcome(
      new ApiError(
        409,
        "In progress",
        [],
        "IDEMPOTENCY_REQUEST_IN_PROGRESS"
      ),
      "IDEMPOTENCY_REQUEST_IN_PROGRESS"
    ),
    true
  );
});

test("unknown booking codes use a safe static fallback", () => {
  assert.equal(
    bookingErrorMessage(
      new ApiError(409, "Safe operational message", [], "UNKNOWN_CODE")
    ),
    "The booking request could not be completed."
  );
});

test("payment validation uses a safe field detail and rejects technical text", () => {
  assert.equal(
    paymentErrorMessage(
      new ApiError(
        400,
        "Validation failed",
        ["Reference number must be 100 characters or fewer."],
        "VALIDATION_ERROR"
      )
    ),
    "Reference number must be 100 characters or fewer."
  );
  assert.equal(
    paymentErrorMessage(
      new ApiError(
        400,
        "Validation failed",
        ["SQL constraint payment_reference_key failed"],
        "VALIDATION_ERROR"
      )
    ),
    "The payment evidence could not be recorded."
  );
});
