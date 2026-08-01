# HB-06 — Historical Booking Wizard UI

> Navigation: [README](README.md) · [Master](00_MASTER_PLAN.md) · [HB-05](05_TICKET_OWNER_ACCOUNTING_AND_SETTLEMENT_ADJUSTMENTS.md) · [Scenarios](99_RELIABILITY_TEST_SCENARIOS.md)

## 1. Ticket metadata

| Field | Value |
|---|---|
| Ticket | HB-06 |
| Status | **OWNER APPROVED — BLOCKED BY DEPENDENCY** |
| Depends on | HB-02 through HB-05; HB-05 must expose the read-only owner review before the owner step is integrated |
| Migration ownership | None |
| Route | `/admin/bookings/historical/new` |

This is the final HB-06 contract. It adds frontend code only and does not alter backend contracts, schema,
permissions, or deployment configuration.

## 2. Product shape

The wizard is a full page at `/admin/bookings/historical/new`, reached by a secondary action from the booking
list. It is not a modal and is not the normal create/edit form. Route and action visibility require
`bookings:record_historical`; server policy remains authoritative.

The page follows the portal's existing layout and component conventions. It is keyboard accessible,
responsive, and preserves entered state while moving backward and forward.

## 3. Six-step flow

1. Provenance: `originalSource`, `actualBookedAt`, historical-entry reason, optional external reference.
2. Unit and occupied dates: inactive units may be selected; deleted units never appear.
3. Client and stay details: exact `clientId` XOR `newClient` contract.
4. Financial truth: required `agreedAmount`; current unit price is reference-only.
5. Owner review: consume HB-05's read-only preview; show stable IDs, warnings and capability booleans. The
   browser never computes or infers owner, commission or accounting values.
6. Review and create: warnings, exact command summary, and a single booking submission.

The owner step does not expose owner PII from conflict metadata. Privileged owner correction is a separate
HB-05 flow and is not embedded in creation.

## 4. Conflict and duplicate handling

Machine-readable `Code` drives UI behavior. Conflict metadata is limited to the fields the backend contract
approves: booking ID, status, check-in/check-out dates, date-block IDs and capability booleans. Client name,
phone, amount, notes and owner PII are never shown from a conflict response.

Probable-duplicate acknowledgement uses the exact request field `acknowledgedDuplicateOf`. Approved date
blocks are acknowledged by exact ID. The page does not invent a boolean blanket override and does not
generate lock or identity values.

## 5. Two-phase booking and payment UX

Booking creation and historical-payment recording are two separate commands:

1. Submit `POST /api/internal/bookings/historical` with a booking idempotency key.
2. On `200`, freeze the returned booking identity and show booking success.
3. Only when the user also holds `payments:record_historical`, offer optional payment evidence using one of
   `cash`, `bank_transfer`, `card`, or `wallet`.
4. Submit `POST /api/internal/bookings/{bookingId:guid}/historical-payments` with a separate payment idempotency
   key.

Payment failure preserves the successfully created booking and shows a payment-only retry. Retry never
reposts the historical-booking command. The user may leave payment unrecorded. Historical evidence remains
standalone and never invoice-linked.

## 6. Request lifecycle and recovery

- Create and payment submit buttons are stable-sized and disabled only while their own command is in flight.
- Every command generates and retains its own idempotency key until a terminal result.
- Validation errors focus the first invalid control and preserve all other values.
- 409s render persistent inline surfaces, not transient toasts.
- A booking success cannot be visually rolled back by a later payment failure.
- Explicit Cancel asks for confirmation when dirty.
- Browser navigation/refresh uses `beforeunload` while dirty.
- No autosave, draft booking, local-storage persistence or browser analytics is introduced in v1.

## 7. Warnings

Before booking submission, the page states that the record is historical, the stay is already complete,
audit timestamps remain current, reporting and owner accounting are affected, no automatic notifications are
sent, and no invoice is created automatically. It also states that a manual invoice may still be drafted and
issued later under existing policy, while historical payment evidence remains standalone.

## 8. Frontend validation

Frontend validation mirrors but never replaces server validation: required IDs, client XOR, date range,
Cairo completed-stay explanation, nonnegative agreed amount, bounded text, allowed source/reason values,
acknowledgement IDs, and payment-command fields. Unknown backend codes fall back to a safe generic inline
error while preserving the server message.

## 9. Testing contract

Use the repository's existing `tsx --test` convention for frontend unit/contract tests and Playwright for
integrated browser behavior. Do not introduce Vitest, Jest or React Testing Library.

Required coverage includes permission gating, full-page routing, state preservation, safe conflict metadata,
exact acknowledgement fields, owner preview, booking idempotency, two-phase payment, payment retry without a
second booking call, all four payment methods, warnings, cancellation, accessibility, responsive layouts and
long-text containment.

## 10. Acceptance criteria

| ID | Criterion |
|---|---|
| AC-HB06-01 | The secondary booking-list action opens `/admin/bookings/historical/new`. |
| AC-HB06-02 | Unauthorized users neither see the action nor gain backend access. |
| AC-HB06-03 | The experience is a full page, not a modal or normal booking form. |
| AC-HB06-04 | Six steps preserve values through Back/Next. |
| AC-HB06-05 | Provenance uses canonical source/reason vocabularies. |
| AC-HB06-06 | Unit selection includes inactive and excludes deleted units. |
| AC-HB06-07 | Client entry enforces exact `clientId` XOR `newClient`. |
| AC-HB06-08 | Agreed amount is explicit and current price is reference-only. |
| AC-HB06-09 | Owner review consumes server values and warnings without client calculation. |
| AC-HB06-10 | Conflict surfaces use stable codes and approved safe metadata only. |
| AC-HB06-11 | Probable duplicates use `acknowledgedDuplicateOf`. |
| AC-HB06-12 | Date-block acknowledgement is exact-ID based. |
| AC-HB06-13 | Booking creation submits exactly once with its retained idempotency key. |
| AC-HB06-14 | Booking success is final before optional payment begins. |
| AC-HB06-15 | Payment controls appear only with `payments:record_historical`. |
| AC-HB06-16 | All four canonical payment methods are supported. |
| AC-HB06-17 | Payment uses a separate idempotency key and endpoint. |
| AC-HB06-18 | Payment failure preserves booking success and offers payment-only retry. |
| AC-HB06-19 | Retry never reposts booking creation. |
| AC-HB06-20 | Review shows notification, invoice, audit, reporting and owner warnings. |
| AC-HB06-21 | Dirty explicit Cancel and browser unload both warn. |
| AC-HB06-22 | Validation/error recovery preserves non-offending input. |
| AC-HB06-23 | Keyboard, focus, labels and error announcements meet portal accessibility conventions. |
| AC-HB06-24 | Desktop, tablet and mobile layouts have no incoherent overflow or overlap. |

## 11. Negative acceptance criteria

| ID | Prohibited outcome |
|---|---|
| NAC-HB06-01 | No route alias, modal, or reuse of normal create as the historical flow. |
| NAC-HB06-02 | No client-side permission check as the sole control. |
| NAC-HB06-03 | No owner, actor, lock or privileged field invented by the browser. |
| NAC-HB06-04 | No PII or amount rendered from conflict/duplicate metadata. |
| NAC-HB06-05 | No fuzzy duplicate matching or blanket acknowledgement. |
| NAC-HB06-06 | No browser-side owner split calculation. |
| NAC-HB06-07 | No automatic price default into agreed amount. |
| NAC-HB06-08 | No payment embedded in the booking request. |
| NAC-HB06-09 | No booking rollback message after payment-command failure. |
| NAC-HB06-10 | No booking resubmit during payment retry. |
| NAC-HB06-11 | No automatic invoice, payment, notification or payout claim. |
| NAC-HB06-12 | No autosave, draft, local-storage or analytics transport in v1. |
| NAC-HB06-13 | No new frontend test framework. |
| NAC-HB06-14 | No schema, migration or backend contract change. |
| NAC-HB06-15 | No HB-05 correction controls in the normal booking editor. |

## 12. Readiness

Contract readiness is complete. Implementation status is **BLOCKED BY DEPENDENCY** until HB-05's read-only
owner review contract is implemented. HB-02 through HB-04B are already required foundations.
