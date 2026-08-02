import assert from "node:assert/strict";
import test from "node:test";
import { ApiError } from "@/lib/api/api-error";
import {
  bookingErrorMessage,
  ownerReviewIssue,
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
  assert.deepEqual(toHistoricalWizardConflict(error)?.candidates, []);
});

test("review required, forbidden, not found and transport errors are distinct", () => {
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
  assert.deepEqual(ownerReviewIssue(new Error("network")).kind, "transport");
});

test("unknown booking codes retain a safe server message", () => {
  assert.equal(
    bookingErrorMessage(
      new ApiError(409, "Safe operational message", [], "UNKNOWN_CODE")
    ),
    "Safe operational message"
  );
});
