# HB-05 — Historical Owner Attribution Review and Privileged Correction

> Navigation: [README](README.md) · [Master](00_MASTER_PLAN.md) · [Decision record](DECISION_RATIFICATION_PACKET.md) · [Scenarios](99_RELIABILITY_TEST_SCENARIOS.md)

## 1. Ticket metadata

| Field | Value |
|---|---|
| Ticket | HB-05 |
| Status | **OWNER APPROVED — READY** |
| Depends on | HB-02, HB-03, HB-04A and HB-04B |
| Branch | `feature/historical-booking-owner-attribution` |
| Migration ownership | `0062_add_historical_owner_attribution_corrections`; HB-05 correction audit and correction-command idempotency objects only |
| Decision authority | Sole Project Owner |

This document is the final HB-05 contract. It replaces the earlier design that placed owner overrides inside
historical booking creation or allowed a payout row to be recalculated. No material HB-05 decision remains
open.

## 2. Scope

HB-05 adds a read-only attribution review and a separate privileged correction command. It preserves the
owner already snapshotted on the booking, keeps an immutable chain of corrections, and refuses any correction
whose accounting consequences cannot be handled without touching a payout.

HB-05 does not administer unit ownership, infer historical ownership, modify a financial snapshot, mutate a
payment or invoice, recalculate a payout, correct a paid payout, send a notification, or add UI.

## 3. Authoritative attribution model

| Truth | Rule |
|---|---|
| Unit owner today | Live `units.owner_id`; contextual only |
| Current booking attribution | Persisted `bookings.owner_id`; never recomputed from the unit |
| Original booking attribution | The booking owner before the first correction, preserved by the first immutable correction row |
| Corrected attribution | The target owner persisted to `bookings.owner_id` by this command |
| Correction chain | Ordered immutable rows; each row's previous values must equal the booking state immediately before that correction |

No owner name, phone, email, current price, payment, payout amount, or free-text match can establish identity.
When ownership is absent, multiple, ambiguous, deleted, or unsupported, the read-only review returns `409
OWNER_ATTRIBUTION_REQUIRES_REVIEW`. The correction command uses its correction-specific `409
OWNER_CORRECTION_CURRENT_ATTRIBUTION_REQUIRES_REVIEW`; it never reuses the HB-02 review/creation transport.
The operator resolves ownership offline and retries with an explicit owner ID. The request contains no
caller-supplied determinability flag.

## 4. Review API

`GET /api/internal/bookings/{bookingId:guid}/owner-attribution-review`

The route ID is authoritative and the endpoint requires the existing `bookings:read` policy. The response is
read-only and contains only stable IDs, the persisted
`currentOwnerId` used as the correction command's optimistic precondition, payout-state capability flags,
and bounded warning codes. It does not expose owner PII, infer a
historical commission, calculate an owner/KAZA split, or make a correction.

```json
{
  "success": true,
  "data": {
    "bookingId": "guid",
    "currentOwnerId": "guid",
    "canCorrect": true,
    "payoutReviewRequired": false,
    "warnings": []
  }
}
```

The only v1 warning codes are `CURRENT_OWNER_INACTIVE`, `TARGET_OWNER_INACTIVE`, and
`PAYOUT_REVIEW_REQUIRED`. They carry no owner display data or payout detail.

An inactive but non-deleted target owner is selectable with an explicit warning. A soft-deleted or missing
owner is not selectable. The server never claims that the current unit owner was the owner at the time of the
stay.

## 5. Correction API

`POST /api/internal/bookings/{bookingId:guid}/owner-attribution-corrections`

Success is `200 OK`. Required policy: `bookings:correct_owner_attribution`. Required header:
`Idempotency-Key`. The route booking ID is authoritative.

Canonical request:

```json
{
  "expectedCurrentOwnerId": "guid",
  "targetOwnerId": "guid",
  "reason": "ownership_changed_after_stay",
  "note": null
}
```

`reason` is one of:

- `ownership_changed_after_stay`
- `booking_belonged_to_previous_owner_agreement`
- `accounting_reconciliation`
- `other`

`note` is required and nonblank only for `other`; otherwise it is optional and bounded to 500 characters.
`expectedCurrentOwnerId` must be the exact persisted value returned by the latest review. It is only a
staleness precondition and never an owner source of truth. Unknown JSON fields are rejected. The request
cannot contain actor, owner-source, payout, lock, audit, force, bypass, override, or settlement fields.

Canonical response uses stable persisted values only:

```json
{
  "success": true,
  "data": {
    "correctionId": "guid",
    "bookingId": "guid",
    "previousOwnerId": "guid",
    "targetOwnerId": "guid",
    "correctedByAdminUserId": "guid",
    "reason": "ownership_changed_after_stay",
    "note": null,
    "correctedAt": "2026-08-01T19:00:00Z",
    "historyEventId": "guid",
    "warnings": []
  }
}
```

It contains no mutable display name, live commission value, calculated split or financial-system detail that
could make an idempotent replay drift. Response warnings are normalized once under the correction lock and
persisted with the completed idempotency claim. Initial success and replay use that immutable warning snapshot;
replay never reconstructs warnings from a target owner's later status.

## 6. Permission and actor

The review uses `bookings:read`. `bookings:correct_owner_attribution` is the correction endpoint's dedicated
least-privilege permission. It is not replaced by the
historical-booking creation permission or a broad finance permission. Migration `0062` seeds it to the
SuperAdmin role template only, grants it to no other role template, and applies the repository-standard
`admin_users.updated_at` token-refresh bump to affected SuperAdmin users. The authenticated active admin claim
is the sole actor source.

## 7. Payout safety matrix

| Payout state for the booking | Correction |
|---|---|
| No payout row | Allowed |
| `Pending` | Blocked: `409 OWNER_CORRECTION_PAYOUT_REVIEW_REQUIRED` |
| `Scheduled` | Blocked: `409 OWNER_CORRECTION_PAYOUT_REVIEW_REQUIRED` |
| `Paid` | Blocked: `409 OWNER_CORRECTION_PAYOUT_REVIEW_REQUIRED` |
| `Cancelled` | Blocked: `409 OWNER_CORRECTION_PAYOUT_REVIEW_REQUIRED` |
| Multiple or unknown state | Blocked: `409 OWNER_CORRECTION_PAYOUT_REVIEW_REQUIRED` |

HB-05 never updates, deletes, reassigns, regenerates, reverses, or duplicates a payout. A separately
ratified accounting-adjustment command is required before any correction with an existing payout can be
allowed.

## 8. Same-owner and repeated corrections

A mismatched `expectedCurrentOwnerId` returns `409 OWNER_CORRECTION_STALE_ATTRIBUTION` before any write. A
target equal to the current attributed owner is a coded no-op and returns `409
OWNER_CORRECTION_SAME_OWNER`; it does not create audit. Multiple successive corrections are allowed only from
the latest persisted attribution and therefore require a fresh expected ID. A stale expected chain or
concurrent conflicting command returns `409
OWNER_CORRECTION_STALE_ATTRIBUTION` or `409 OWNER_CORRECTION_CONFLICT` without a partial write.

## 9. Idempotency and concurrency

HB-05 owns a dedicated correction-command idempotency store. Scope is authenticated actor + canonical
endpoint + key. The canonical SHA-256 hash contains booking ID, expected current owner ID, target owner ID,
normalized reason, and normalized note. It excludes JSON formatting and server-generated values.

- Missing/malformed key: `400 OWNER_CORRECTION_IDEMPOTENCY_KEY_REQUIRED`.
- Same key and same command: original `200` response and correction identity.
- Same key and different command: `409 OWNER_CORRECTION_IDEMPOTENCY_KEY_REUSED`.
- Visible incomplete claim: `409 OWNER_CORRECTION_REQUEST_IN_PROGRESS`.
- Failed transaction: no permanent claim.
- Same textual key used by another actor has separate scope.

Completion persists the correction identity, response status/timestamps, and canonical response-warning
snapshot together. Warning values are constrained to the approved vocabulary, deterministic order, and no
null or duplicate elements.

The command uses one transaction and server-derived transaction-scoped advisory lock
`historical-owner-correction:{bookingId:N}`. Ordering is: begin; lock; claim/replay; load booking and current
chain; validate historical status and target; inspect payout; write booking attribution; append correction and
one concise booking-history link; complete idempotency; save; commit. Concurrent conflicting corrections have
one winner.

## 10. Immutable audit chain

`historical_owner_attribution_corrections` is append-only and records correction ID, booking ID, previous and
target owner IDs, trusted actor ID, reason, note, and transaction timestamp. Exactly one concise
`HistoricalOwnerAttributionCorrected` booking-history event links the
correction ID. Replays create no second row. Reachable update/delete attempts return `409
OWNER_CORRECTION_AUDIT_IMMUTABLE`. PostgreSQL row-level `UPDATE`/`DELETE` and statement-level `TRUNCATE`
triggers prevent direct mutation or truncation of the audit chain.

## 11. Migration ownership and legacy policy

HB-05 implements its owned objects in migration `0062_add_historical_owner_attribution_corrections`:

1. `historical_owner_attribution_corrections`, its PK, FKs, immutable-chain indexes and coherence checks.
2. A dedicated `historical_owner_correction_idempotency_keys` table, actor/endpoint/key uniqueness, request
   hash, correction FK, response status/timestamps, immutable response-warning snapshot, and lookup indexes.
3. The `bookings:correct_owner_attribution` permission seed for the SuperAdmin role template only, including
   the standard affected-user token-refresh timestamp bump.

No other ticket owns these objects. HB-05 does not add ownership-history ranges or payout-adjustment schema.

Migration preflight must abort atomically when an existing historical booking lacks the persisted owner or
HB-02 historical provenance required to establish original truth. Remediation requires an owner-reviewed
input dataset. The migration must never backfill from the unit's current owner or the owner's current rate. Normal
bookings receive no correction rows. Rollback is guarded and must refuse when HB-05-only audit truth exists.

## 12. Stable error contract

| HTTP | Code | Meaning |
|---|---|---|
| 400 | `OWNER_CORRECTION_IDEMPOTENCY_KEY_REQUIRED` | Required key absent or malformed |
| 404 | `OWNER_CORRECTION_BOOKING_NOT_FOUND` | Booking not found |
| 409 | `OWNER_CORRECTION_BOOKING_REQUIRED` | Booking is not historical |
| 409 | `OWNER_CORRECTION_CURRENT_ATTRIBUTION_REQUIRES_REVIEW` | Persisted current attribution is missing, deleted, unsupported or incoherent |
| 404 | `OWNER_CORRECTION_TARGET_NOT_FOUND` | Target owner does not exist |
| 409 | `OWNER_CORRECTION_TARGET_INVALID` | Target owner is soft-deleted or otherwise ineligible |
| 409 | `OWNER_CORRECTION_SAME_OWNER` | No owner change requested |
| 409 | `OWNER_CORRECTION_STALE_ATTRIBUTION` | Request is based on an obsolete attribution |
| 409 | `OWNER_CORRECTION_PAYOUT_REVIEW_REQUIRED` | Any payout row exists or payout state is uncertain |
| 409 | `OWNER_CORRECTION_IDEMPOTENCY_KEY_REUSED` | Key reused for another command |
| 409 | `OWNER_CORRECTION_REQUEST_IN_PROGRESS` | Claim is incomplete |
| 409 | `OWNER_CORRECTION_CONFLICT` | Concurrent correction lost |
| 409 | `OWNER_CORRECTION_AUDIT_IMMUTABLE` | Audit mutation/deletion attempted |

Validation-shape errors use `VALIDATION_ERROR`. Authorization 403 remains the existing policy response.
Every HB-05 business 400/404/409 response carries a non-null `Code`. HB-05 owns 13 correction codes; the
canonical Historical Bookings registry contains 45 codes in total.

## 13. Acceptance criteria

| ID | Criterion |
|---|---|
| AC-HB05-01 | Review returns stable attribution IDs, warnings and capability flags without owner PII or inferred financial values. |
| AC-HB05-02 | Correction uses the canonical route, `200 OK`, dedicated permission and trusted actor. |
| AC-HB05-03 | Route ID is authoritative; `expectedCurrentOwnerId` is a staleness precondition; unknown body fields are rejected. |
| AC-HB05-04 | All four reason codes validate; `other` requires a note. |
| AC-HB05-05 | An inactive non-deleted target is permitted with a warning. |
| AC-HB05-06 | Missing or soft-deleted target is rejected with its stable code. |
| AC-HB05-07 | Uncertain attribution blocks for offline review; the system never guesses. |
| AC-HB05-08 | Successful correction preserves original and previous attribution in the immutable chain. |
| AC-HB05-09 | Owner correction leaves `agreed_amount`, `base_amount`, `final_amount`, payments, invoices and payouts unchanged. |
| AC-HB05-10 | Same-owner requests are coded no-ops. |
| AC-HB05-11 | Success appends exactly one correction and one concise history event. |
| AC-HB05-12 | Replay returns the byte-equivalent persisted response without another event. |
| AC-HB05-13 | Idempotency mismatch and in-progress claims return canonical conflicts. |
| AC-HB05-14 | Same textual key is isolated by actor. |
| AC-HB05-15 | Concurrent conflicting corrections using the same reviewed current-owner precondition produce one winner and one `OWNER_CORRECTION_STALE_ATTRIBUTION` loser. |
| AC-HB05-16 | A failed command rolls back booking, correction, history and idempotency changes. |
| AC-HB05-17 | No payout allows correction. |
| AC-HB05-18 | Every existing payout state blocks with `OWNER_CORRECTION_PAYOUT_REVIEW_REQUIRED`. |
| AC-HB05-19 | A blocked correction leaves the payout bit-for-bit unchanged. |
| AC-HB05-20 | The migration preserves coherent legacy attribution without deriving current-owner truth. |
| AC-HB05-21 | Ambiguous legacy rows abort the migration with no partial schema/data change. |
| AC-HB05-22 | Catalog verifier proves owned tables, FKs, indexes and validated constraints. |
| AC-HB05-23 | Guarded rollback succeeds only before HB-05 audit truth exists. |
| AC-HB05-24 | HB-02 through HB-04B behavior and normal booking attribution remain unchanged. |
| AC-HB05-25 | Invalid or incoherent current attribution uses `OWNER_CORRECTION_CURRENT_ATTRIBUTION_REQUIRES_REVIEW` on correction while review retains `OWNER_ATTRIBUTION_REQUIRES_REVIEW`. |
| AC-HB05-26 | Initial success and replay are byte-equivalent after target-owner status changes because the canonical warning snapshot is persisted with completion. |
| AC-HB05-27 | Migration `0062` grants the dedicated correction permission only to the SuperAdmin role template and refreshes affected SuperAdmin authorization timestamps. |

## 14. Negative acceptance criteria

| ID | Prohibited outcome |
|---|---|
| NAC-HB05-01 | No owner inference from names, PII, dates, current pricing, payment or payout data. |
| NAC-HB05-02 | No caller-controlled actor, owner source-of-truth, lock, audit or bypass field; `expectedCurrentOwnerId` is only a checked precondition. |
| NAC-HB05-03 | No correction through a normal booking edit DTO. |
| NAC-HB05-04 | No same-owner success or empty audit row. |
| NAC-HB05-05 | No cross-actor or cross-booking idempotent replay. |
| NAC-HB05-06 | No second correction/history row on replay. |
| NAC-HB05-07 | No last-write-wins behavior for concurrent conflicting corrections. |
| NAC-HB05-08 | No mutation of any payout state. |
| NAC-HB05-09 | No financial snapshot, payment or invoice mutation. |
| NAC-HB05-10 | No client, unit ownership, booking date or status mutation. |
| NAC-HB05-11 | No owner PII, payout details, SQL or constraint name in errors/logs. |
| NAC-HB05-12 | No current-owner/current-rate legacy backfill. |
| NAC-HB05-13 | No partial migration or partial command commit. |
| NAC-HB05-14 | No migration number reserved in planning. |
| NAC-HB05-15 | No notification or external accounting side effect. |
| NAC-HB05-16 | No automatic paid-payout correction or hidden adjustment model. |
| NAC-HB05-17 | No correction-path reuse of `OWNER_ATTRIBUTION_REQUIRES_REVIEW`, live warning reconstruction, or non-SuperAdmin role-template permission grant. |

## 15. Test and release evidence

Fast tests cover DTO shape, reason normalization, permission registration, stable codes, hash stability,
payout decision matrix and safe response mapping. PostgreSQL tests cover transaction rollback, advisory-lock
races, actor isolation, chain immutability, every payout state, migration preflight, fresh/upgrade/bootstrap,
verifier and guarded rollback. Critical correction and payout races run at least five times with independent
connections.

## 16. Definition of Ready and Done

HB-05 is **READY**: endpoint, permission, request/response, errors, idempotency, concurrency, payout policy,
migration ownership, legacy behavior, AC/NAC and scenario ownership are final. Done requires all tests and
catalog verification green, no side effects, and no deployment action.

## 17. Future architecture epic: date-ranged unit ownership

Date-ranged unit-owner contracts and automated historical ownership inference remain a separate future epic.
They are not needed to implement this explicit, auditable correction command.
