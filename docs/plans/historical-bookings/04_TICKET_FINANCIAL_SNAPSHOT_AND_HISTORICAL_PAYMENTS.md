# HB-04 — Historical Financial Snapshot and Historical Payment Evidence

> Navigation: [README](README.md) · [Master](00_MASTER_PLAN.md) · [Decision record](DECISION_RATIFICATION_PACKET.md) · [Scenarios](99_RELIABILITY_TEST_SCENARIOS.md)

## 1. Status and delivery split

| Slice | Status | Scope | Migration |
|---|---|---|---|
| HB-04A | **MERGED — OWNER APPROVED** | Immutable agreed-amount snapshot and repricing guard | `0060_add_historical_financial_snapshot` |
| HB-04B | **MERGED — OWNER APPROVED** | Separate privileged historical-payment-evidence command | `0061_add_historical_payment_recording` |

HB-04A and HB-04B are separate commands and transactions. Payment evidence is never accepted by
`POST /api/internal/bookings/historical`. No material HB-04 decision remains open.

## 2. HB-04A snapshot contract

`bookings.agreed_amount DECIMAL(12,2) NULL` is the only HB-04A snapshot field. A historical booking requires
`agreed_amount = base_amount = final_amount >= 0`; a non-historical booking requires `agreed_amount IS NULL`.
The operator supplies `agreedAmount`; current unit pricing is neither a default nor a backfill source.

Migration `0060` backfills a coherent pre-HB-04A historical row from its persisted HB-02 truth only:
`agreed_amount = final_amount`. Its guarded preflight refuses the whole transaction if any historical row has
incoherent amounts or incomplete HB-02 provenance. It never reads current price, owner terms, fees, tax,
discount, invoice, payment or payout data.

The central persistence guard makes `agreed_amount`, `base_amount` and `final_amount` immutable on an existing
historical booking. Unrelated permitted edits remain legal when those three values are unchanged. A direct,
detached or indirect repricing attempt returns `409 HISTORICAL_FINANCIAL_SNAPSHOT_IMMUTABLE` and commits
nothing. Normal-booking behavior remains unchanged.

## 3. HB-04A migration ownership

HB-04A owns only:

- `bookings.agreed_amount`;
- `ck_bookings_agreed_amount_non_negative`;
- `ck_bookings_historical_agreed_amount_coherent`;
- the application repricing guard and response mapping required by those objects.

Fresh development and production bootstrap, upgrade through `0059`, catalog verification and guarded
rollback are required. Rollback refuses when removing the column could discard truth not recoverable from
the pre-0060 amount columns. Deployment requires coordinated historical-write quiescence plus the production
census, backup, isolated restore, rehearsal and integrity-comparison gates.

## 4. HB-04B endpoint and permission

`POST /api/internal/bookings/{bookingId:guid}/historical-payments`

Success is `200 OK`. The route ID is authoritative. Required permission:
`payments:record_historical`. Required header: `Idempotency-Key`.

Canonical request:

```json
{
  "amount": 1000.00,
  "paymentMethod": "cash",
  "paidAt": "2026-07-15T10:30:00+03:00",
  "referenceNumber": "LEGACY-RECEIPT-123",
  "reason": "Recorded from verified legacy receipt"
}
```

`amount` is positive and uses existing payment precision. `paymentMethod` uses the existing vocabulary.
`paidAt` is the truthful externally effective timestamp. `referenceNumber` is optional, trimmed and bounded;
blank becomes null. `reason` is required, trimmed and stored in `recorded_reason`. Unknown members and any
actor, booking, invoice, payout, gateway, status, currency, force or correction field are rejected.

## 5. Evidence, totals and immutability

The payment row is the v1 evidence record. It has `is_historical_record = true`, `payment_status = 'paid'`,
`invoice_id = NULL`, a trusted claims-derived admin actor, nonblank reason, `paid_at`, and system-created
timestamps. It records an external fact and never contacts a gateway.

Multiple records are allowed. Under the transaction-scoped server-derived lock
`historical-payment:{bookingId:N}`, the cumulative historical-evidence amount may equal but never exceed the
persisted `bookings.agreed_amount`. A normalized non-null reference is unique per booking among historical
evidence; null references remain legal. Database race translation uses the named constraint, never message
parsing.

Historical evidence is immutable. No update, delete, reversal or correction endpoint exists. Reachable
mutation attempts return `409 HISTORICAL_PAYMENT_IMMUTABLE`. Live collection targeting a historical booking
returns `409 HISTORICAL_PAYMENT_LIVE_COLLECTION_FORBIDDEN`; normal live-payment behavior remains unchanged.

## 6. Invoice policy

Manual invoice draft creation and normal invoice issuance remain allowed for historical bookings wherever
existing permissions and status rules allow them. Historical payment evidence is standalone external-payment
evidence: it always remains unlinked, is excluded from invoice attachment and invoice-linked payment totals,
and is untouched by issue, reissue and orphan-linking operations. Ordinary non-historical payments retain
their existing invoice-linking behavior. Future invoice/evidence reconciliation is outside HB-04B.

Neither historical creation nor the payment-evidence command creates or issues an invoice automatically.

## 7. Dedicated idempotency and transaction

`historical_payment_idempotency_keys` is independent of booking-command idempotency. Scope is authenticated
actor + canonical endpoint + key. The canonical SHA-256 hash includes route booking ID, normalized amount,
method, timestamp, reference and reason. Same key/same command replays the persisted response; changed command
returns `HISTORICAL_PAYMENT_IDEMPOTENCY_KEY_REUSED`; an incomplete visible claim returns
`HISTORICAL_PAYMENT_REQUEST_IN_PROGRESS`. Failed transactions leave no claim.

Ordering is: begin; acquire the payment-booking advisory lock; claim/replay; load historical booking and
coherent snapshot; validate cumulative amount and reference; insert evidence; append exactly one
`HistoricalPaymentRecorded` booking-history link; complete idempotency; save; commit. Replay creates no second
payment or event.

## 8. HB-04B migration ownership

Migration `0061` owns only:

- `payments.is_historical_record`;
- `payments.created_by_admin_user_id` and its restrictive actor FK/index;
- `payments.recorded_reason`;
- `ck_payments_historical_record_coherent`;
- `ux_payments_historical_reference`;
- `historical_payment_idempotency_keys` and its PK, FKs, checks and payment lookup index;
- `payments:record_historical` permission seed.

Existing payments remain nonhistorical; no actor or reason is fabricated. Fresh bootstrap, upgrade through
`0060`, PostgreSQL-catalog verifier and guarded rollback are required. Rollback refuses while HB-04B-only
evidence or idempotency truth exists.

## 9. Stable errors

| HTTP | Code |
|---|---|
| 409 | `HISTORICAL_FINANCIAL_SNAPSHOT_IMMUTABLE` |
| 400 | `HISTORICAL_PAYMENT_IDEMPOTENCY_KEY_REQUIRED` |
| 409 | `HISTORICAL_PAYMENT_IDEMPOTENCY_KEY_REUSED` |
| 409 | `HISTORICAL_PAYMENT_REQUEST_IN_PROGRESS` |
| 404 | `HISTORICAL_PAYMENT_BOOKING_NOT_FOUND` |
| 409 | `HISTORICAL_PAYMENT_BOOKING_REQUIRED` |
| 409 | `HISTORICAL_PAYMENT_SNAPSHOT_REQUIRED` |
| 400 | `HISTORICAL_PAYMENT_AMOUNT_INVALID` |
| 400 | `HISTORICAL_PAYMENT_METHOD_INVALID` |
| 400 | `HISTORICAL_PAYMENT_REASON_REQUIRED` |
| 409 | `HISTORICAL_PAYMENT_EXCEEDS_AGREED_AMOUNT` |
| 409 | `HISTORICAL_PAYMENT_REFERENCE_ALREADY_EXISTS` |
| 409 | `HISTORICAL_PAYMENT_IMMUTABLE` |
| 409 | `HISTORICAL_PAYMENT_LIVE_COLLECTION_FORBIDDEN` |

Validation-shape failures use `VALIDATION_ERROR`. Every business 400/404/409 response carries `Code`; raw
SQL, constraint names, PII and gateway details are never exposed.

## 10. Side-effect boundary

HB-04 creates no automatic invoice, payout, notification, payment link, charge, authorization, refund,
reversal, owner override or external accounting entry. HB-04B never mutates the HB-04A snapshot.

### 11.4 Historical payment recording — HB-04B only

Historical payment recording is the separate endpoint and transaction in §§4–8. It is never inline with
historical booking creation. The wizard may offer it only after booking success and only to an operator with
`payments:record_historical`; payment failure preserves the already committed booking and offers payment-only
retry.

## 12. HB-04A acceptance criteria

| ID | Criterion |
|---|---|
| AC-HB04-01 | Historical creation persists the operator-supplied `agreed_amount` and matching base/final amounts, independent of current pricing. |
| AC-HB04-02 | Initial creation and replay return the same persisted amount and response without repricing. |
| AC-HB04-03 | A permitted unrelated edit succeeds without changing protected amounts. |
| AC-HB04-04 | Direct, detached and indirect financial mutation returns the canonical 409 and commits nothing. |
| AC-HB04-05 | Later unit-price changes do not alter the snapshot. |
| AC-HB04-06 | Status transitions and jobs that do not reprice preserve the snapshot. |
| AC-HB04-07 | Valid HB-02 historical rows backfill deterministically, including zero. |
| AC-HB04-08 | Any invalid historical row aborts all of migration `0060` and does not advance the ledger. |
| AC-HB04-09 | Nonhistorical rows remain compatible with `agreed_amount IS NULL`. |
| AC-HB04-10 | Validated PostgreSQL constraints reject negative or incoherent direct writes. |
| AC-HB04-11 | Snapshot creation is atomic with booking, history and booking-command idempotency. |
| AC-HB04-12 | Creation, replay, unrelated edit and rejected repricing create no payment, invoice, payout or notification. |
| AC-HB04-13 | Normal booking creation/update behavior is unchanged. |
| AC-HB04-14 | Fresh bootstraps, upgrade, verifier and guarded rollback pass on PostgreSQL 16. |

## 13. HB-04B acceptance criteria

| ID | Criterion |
|---|---|
| AC-HB04B-01 | Canonical endpoint requires only `payments:record_historical`, rejects unknown fields and returns persisted `200` response. |
| AC-HB04B-02 | A valid call stores one immutable paid historical evidence row with trusted actor, reason, effective time and one audit event. |
| AC-HB04B-03 | Same-key replay is byte-equivalent with no duplicate row; a changed command conflicts. |
| AC-HB04B-04 | Concurrent commands serialize; cumulative evidence never exceeds agreed amount. |
| AC-HB04B-05 | References normalize and are unique per booking; null and other-booking references remain legal. |
| AC-HB04B-06 | Missing/nonhistorical/incoherent bookings and validation/conflict paths return canonical non-null codes. |
| AC-HB04B-07 | Evidence cannot be modified/deleted and historical bookings cannot use live collection. |
| AC-HB04B-08 | Migration, bootstrap, upgrade, verifier and guarded rollback pass on PostgreSQL 16. |
| AC-HB04B-09 | No invoice, payout, notification, gateway call or booking-snapshot mutation occurs. |

## 14. Negative acceptance criteria

| ID | Prohibited outcome |
|---|---|
| NAC-HB04-01 | Automatic overwrite of `agreed_amount`. |
| NAC-HB04-02 | Historical `final_amount` recalculated from live pricing. |
| NAC-HB04-03 | Client control of base/final/snapshot fields. |
| NAC-HB04-04 | Force, override, reprice or guard-suppression input. |
| NAC-HB04-05 | Silent restoration followed by false success. |
| NAC-HB04-06 | Partial commit of a mixed forbidden financial update. |
| NAC-HB04-07 | Backfill consults live pricing or finance tables. |
| NAC-HB04-08 | Partial backfill when any historical row is ambiguous. |
| NAC-HB04-09 | Fabricated nonhistorical snapshot. |
| NAC-HB04-10 | Invented currency, tax, fee, discount, payment, invoice or payout snapshot. |
| NAC-HB04-11 | HB-04A creates or modifies payment, invoice, payout or notification. |
| NAC-HB04-12 | HB-02 idempotency or HB-03 conflict semantics are weakened. |
| NAC-HB04B-01 | Request-controlled actor, booking identity, status, invoice, payout, currency or bypass state. |
| NAC-HB04B-02 | Failed command leaves payment, history or idempotency residue. |
| NAC-HB04B-03 | Existing payment is backfilled as historical or receives fabricated actor/reason. |
| NAC-HB04B-04 | Constraint names, SQL, PII, reason text or gateway details leak. |
| NAC-HB04B-05 | HB-04A agreed/base/final amounts are modified. |

## 15. Definition of Done

All criteria above and mapped reliability scenarios pass against isolated PostgreSQL 16; bootstraps,
upgrades, catalog verifiers and guarded rollback are proven; no side effect is observed; and no production
action occurs.
