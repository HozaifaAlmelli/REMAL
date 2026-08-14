# HB-08 — Reporting, Audit, Observability, Rollout and Later Hardening

> Navigation: [README](README.md) · [Master](00_MASTER_PLAN.md) · [Scenarios](99_RELIABILITY_TEST_SCENARIOS.md)

## 1. Ticket metadata

| Field | Value |
|---|---|
| Ticket | HB-08 |
| Status | **OWNER APPROVED — HB-08A3 IMPLEMENTED, PENDING REVIEW** |
| Delivery | HB-08A reporting/rollout first; HB-08B normal-flow hardening only after pilot evidence |
| Depends on | HB-02 through HB-05 for complete domain truth; PRE-00 is closed; production rollout remains separately gated by §9 |
| Migration ownership | Reporting views and append-only report columns listed in §15; implemented by migration `0063` |

## 2. Binding reporting model

Historical bookings are included by default with an explicit historical breakdown. Consumers may opt out.
Two time axes answer different questions:

- **Recorded axis:** `DATE(bookings.created_at)`, answering when KAZA recorded activity.
- **Stay-start axis:** `bookings.check_in_date`, answering the period to which the stay belongs.

Each booking is bucketed once on the stay-start axis. Revenue is never spread per occupied night because the
platform has no truthful per-night historical price allocation. The two axes reconcile to the same all-time
booking and agreed-amount totals but must never be added together.

## 3. Source and occupancy

Historical rows keep `source = 'admin'`; provenance reporting uses `original_source` with the canonical
vocabulary (`legacy_system`, `external_platform`, `offline_record`, `other`). It never fabricates `walk_in`.

The OccupancyWidget must consume the stay-axis read model. A full nights-based occupancy redesign is later
scope; HB-08 does not derive per-night financial revenue.

## 4. Invoice and payment evidence

Manual invoice draft creation and normal invoice issuance remain allowed for a historical booking. No
historical command auto-creates or auto-issues an invoice.

Historical payment evidence is standalone external-payment evidence:

- always `invoice_id = NULL`;
- never attached by issue, reissue or orphan-linking;
- never counted in invoice-linked paid totals or ordinary orphan-payment totals;
- counted in dedicated `historical_payment_evidence_count` and
  `historical_payment_evidence_amount` fields.

Invoice-linked calculations explicitly use nonhistorical payments. Reconciliation presents invoice-linked
payments and historical evidence as separate columns and never implies that one settles the other. Future
reconciliation/settlement behavior is outside HB-08.

## 5. Canonical report APIs

All routes require the existing `analytics:read` policy.

1. `GET /api/internal/reports/bookings/stay-daily?dateFrom&dateTo&includeHistorical`
2. `GET /api/internal/reports/finance/stay-daily?dateFrom&dateTo&includeHistorical`
3. `GET /api/internal/reports/bookings/historical-reconciliation?stayMonthFrom&stayMonthTo`

Date ranges are inclusive, valid, ordered and capped at 24 months. `historicalOnly=true` takes precedence as
the restrictive mode and cannot be combined with `includeHistorical=false`; contradictory filters return
`400 VALIDATION_ERROR`. Absent filters include historical rows with breakdowns.

Responses expose metric/stay date, booking counts, historical counts, agreed amounts, invoice-linked amounts,
historical evidence count/amount, original-source breakdown, and entry-lag fields where applicable. They
contain no client PII, free-text notes, payment reference or owner banking data.

The reconciliation route is intrinsically Historical and does not accept `includeHistorical` or
`historicalOnly`; supplying either parameter returns `400 VALIDATION_ERROR`. The two Stay routes own those
filters. Existing recorded routes retain their pre-HB-08A2 query contract.

## 6. Audit and observability

Durable audit remains in domain tables: booking history for creation/payment linkage and the HB-05 immutable
correction table for owner changes. Structured logs are supplementary and use the stable event concepts
`reporting.historical.query` and `reporting.historical.range_rejected` with bounded route, filter, count and
timing fields only. v1 introduces no metrics platform and no unbounded-cardinality labels.

Operational reconciliation is database-derived and pull-only. HB-08 adds no scheduled push, notification,
webhook or per-request post-commit verification query.

## 7. External consumers — PRE-00 closed

The repository census found no in-repository `SELECT *` or positional reporting-view consumer, export,
BI/warehouse/ETL integration, or operational/CI query of the reporting views. On 2026-08-10 the Sole Project
Owner, applying the Operations lens, confirmed **NO** to all six external-consumer questions: no direct BI
database connection, scheduled spreadsheet extract, out-of-repository reporting query, `SELECT *`/positional
consumer, reporting database identity, or external daily/weekly/monthly report. PRE-00 is therefore
**CLOSED**. No production database was accessed to reach this conclusion.

Historical rows remain included by default with additive breakdown columns; an opt-out is explicit. Backup,
restore rehearsal, integrity comparison, reconciliation, rollback readiness and explicit owner approval remain
independent production rollout gates under §9.

## 8. HB-08A/HB-08B split

### HB-08A — reporting and rollout preparation

Owns the views, report APIs, report UI changes, structured logs, reconciliation runbook, compatibility tests,
consumer inventory, pilot plan and rollback evidence.

### HB-08B — later normal-flow hardening

Owns REQ-16: rejecting past-dated stays on the normal booking endpoint with `400 STAY_DATES_IN_PAST`.
HB-08B is a separate later PR after the historical flow and reporting have passed pilot verification. It
must preserve the historical endpoint and must not be activated as part of HB-08A.

## 9. Rollout gates

No pilot or production migration occurs before PRE-00 census, verified backup, isolated restore drill,
migration rehearsal, before/after integrity comparison, reporting/payout reconciliation, rollback readiness,
consumer inventory and explicit owner approval. Historical write traffic is quiesced or coordinated where a
mixed-version write window is unsafe.

Pilot starts with least-privilege users, low volume and daily reconciliation. Exit requires zero unexplained
differences, zero historical notification side effects, correct axes, stable invoice/evidence separation and
no paid-payout mutation.

## 10. Compatibility

Existing report routes keep their behavior and response fields; additions are append-only. New portal code
must degrade to recorded-axis views when deployed against an older backend. Normal booking, invoice and
ordinary payment reporting remain unchanged except for explicitly additive breakdown columns.

## 11. Error contract

HB-08 owns `STAY_DATES_IN_PAST` (`400`) for HB-08B. Report input shape/range errors use
`VALIDATION_ERROR`. No other HB-08 stable business code is required.

## 12. Security

Existing report permissions remain authoritative. Reports expose aggregate data only. Logs and API responses
exclude client PII, notes, payment references, owner banking data, raw SQL and constraint names. Historical
write permission does not grant reporting permission.

## 13. Acceptance criteria

| ID | Criterion |
|---|---|
| AC-HB08-01 | A historical booking appears once in its check-in-date stay bucket. |
| AC-HB08-02 | The same booking appears on its recorded date with a historical breakdown. |
| AC-HB08-03 | `includeHistorical=false` excludes historical rows without changing ordinary totals. |
| AC-HB08-04 | All-time recorded/stay booking and agreed-amount totals reconcile. |
| AC-HB08-05 | No per-night historical revenue allocation is produced. |
| AC-HB08-06 | Booking and finance stay-daily routes implement the 24-month filter contract. |
| AC-HB08-07 | Historical reconciliation exposes both axes and entry lag. |
| AC-HB08-08 | `source='admin'` and `original_source` are reported distinctly. |
| AC-HB08-09 | OccupancyWidget uses the stay axis. |
| AC-HB08-10 | Historical evidence count/amount is separate from invoice-linked payment totals. |
| AC-HB08-11 | Manual historical invoices remain allowed. |
| AC-HB08-12 | Historical evidence remains unlinked through issue, reissue and orphan linking. |
| AC-HB08-13 | Structured logs are bounded and PII-free. |
| AC-HB08-14 | Durable creation/payment/correction audit remains queryable. |
| AC-HB08-15 | Existing report routes and ordinary payment/invoice totals remain compatible. |
| AC-HB08-16 | Unknown external consumers block rollout until recorded. |
| AC-HB08-17 | Historical rows are included by default with explicit opt-out. |
| AC-HB08-18 | PRE-00, backup, restore, rehearsal and integrity gates are mandatory. |
| AC-HB08-19 | New report UI degrades safely against an older backend. |
| AC-HB08-20 | Pilot reconciliation detects any unexplained axis or evidence difference. |
| AC-HB08-21 | HB-08A contains no normal-flow hardening activation. |
| AC-HB08-22 | HB-08B is a separate later PR after pilot approval. |
| AC-HB08-23 | Normal flow rejects past check-in/check-out dates with `STAY_DATES_IN_PAST`. |
| AC-HB08-24 | Historical endpoint continues accepting completed past stays. |
| AC-HB08-25 | Cairo boundary and normal future-booking behavior remain deterministic. |
| AC-HB08-26 | Hardening is reversible independently of reporting changes. |

## 14. Negative acceptance criteria

| ID | Prohibited outcome |
|---|---|
| NAC-HB08-01 | No replacement or reinterpretation of `created_at`. |
| NAC-HB08-02 | No per-night revenue fabrication. |
| NAC-HB08-03 | No default exclusion of historical records. |
| NAC-HB08-04 | No automatic invoice creation/issuance. |
| NAC-HB08-05 | No historical evidence in invoice-linked or ordinary orphan totals. |
| NAC-HB08-06 | No attachment or mutation of historical payment evidence. |
| NAC-HB08-07 | No claim that historical evidence settles an invoice or payout. |
| NAC-HB08-08 | No PII, notes or payment references in reports/logs. |
| NAC-HB08-09 | No metrics platform, scheduled push or notification. |
| NAC-HB08-10 | No silent change to existing report routes or field order. |
| NAC-HB08-11 | No rollout before external-consumer inventory. |
| NAC-HB08-12 | No rollout before PRE-00 and database safety gates. |
| NAC-HB08-13 | No production access or deployment in the implementation PR. |
| NAC-HB08-14 | No HB-08B hardening bundled into HB-08A. |
| NAC-HB08-15 | No normal-flow past-date bypass flag. |
| NAC-HB08-16 | No change to historical completion semantics. |
| NAC-HB08-17 | No paid-payout correction or financial reconciliation command. |
| NAC-HB08-18 | No full nightly occupancy redesign in v1. |

## 15. Migration ownership

HB-08A owns, without reserving a migration number:

1. `reporting_booking_stay_daily_summary` view.
2. `reporting_finance_stay_daily_summary` view.
3. `reporting_historical_entry_reconciliation` view.
4. Append-only historical breakdown columns on `reporting_booking_daily_summary`.
5. Append-only historical, invoice-linked and standalone-evidence columns on
   `reporting_finance_daily_summary`.

Payment expressions must count historical evidence only where `payments.is_historical_record = true AND
payments.invoice_id IS NULL`; invoice-linked totals must count only `is_historical_record = false` linked
payments; ordinary orphan totals must exclude historical evidence. Catalog verifier and rollback preserve the
prior view definitions. No table or write-side schema is owned by HB-08.

### 15.1 Final owner-ratified physical dictionary — migration 0063

The owner froze this physical dictionary on 2026-08-11 before the final implementation correction. Migration
`0063_add_historical_reporting_read_models.sql` implements it exactly. The first eight columns of each existing
view remain unchanged in name, type, order and axis meaning. The sole intentional value correction in that
frozen finance prefix is owner-payout aggregation: payouts are aggregated once per booking before joining
invoice facts, preventing one payout from being multiplied by multiple active invoices.

| View | Count | Final ordered columns |
|---|---:|---|
| `reporting_booking_daily_summary` | 14 | `metric_date`, `booking_source`, `bookings_created_count`, `prospecting_bookings_count`, `confirmed_bookings_count`, `cancelled_bookings_count`, `completed_bookings_count`, `total_final_amount`, `historical_bookings_count`, `historical_agreed_amount`, `historical_legacy_system_bookings_count`, `historical_external_platform_bookings_count`, `historical_offline_record_bookings_count`, `historical_other_source_bookings_count` |
| `reporting_booking_stay_daily_summary` | 14 | `stay_start_date`, `booking_source`, `stay_bookings_count`, `prospecting_bookings_count`, `confirmed_bookings_count`, `cancelled_bookings_count`, `completed_bookings_count`, `total_final_amount`, `historical_bookings_count`, `historical_agreed_amount`, `historical_legacy_system_bookings_count`, `historical_external_platform_bookings_count`, `historical_offline_record_bookings_count`, `historical_other_source_bookings_count` |
| `reporting_finance_daily_summary` | 16 | `metric_date`, `bookings_with_invoice_count`, `total_invoiced_amount`, `total_paid_amount`, `total_remaining_amount`, `total_pending_payout_amount`, `total_scheduled_payout_amount`, `total_paid_payout_amount`, `historical_bookings_count`, `historical_agreed_amount`, `historical_bookings_with_invoice_count`, `historical_invoiced_amount`, `ordinary_unlinked_paid_count`, `ordinary_unlinked_paid_amount`, `historical_evidence_recorded_count`, `historical_evidence_recorded_amount` |
| `reporting_finance_stay_daily_summary` | 9 | `stay_start_date`, `stay_bookings_count`, `bookings_with_invoice_count`, `total_invoiced_amount`, `total_final_amount`, `historical_bookings_count`, `historical_agreed_amount`, `historical_bookings_with_invoice_count`, `historical_invoiced_amount` |
| `reporting_historical_entry_reconciliation` | 25 | `booking_id`, `recorded_date`, `recorded_at`, `actual_booked_at`, `entry_lag_days`, `stay_start_date`, `stay_end_date`, `stay_nights`, `booking_source`, `original_source`, `historical_entry_reason`, `booking_status`, `unit_id`, `owner_id`, `agreed_amount`, `invoiced_amount`, `invoice_linked_paid_amount`, `ordinary_unlinked_paid_count`, `ordinary_unlinked_paid_amount`, `historical_payment_evidence_count`, `historical_payment_evidence_amount`, `first_evidence_paid_date`, `last_evidence_paid_date`, `owner_attribution_correction_count`, `last_owner_attribution_corrected_at` |

Booking Stay uses `(check_in_date, booking_source)` grain. Finance Stay uses `check_in_date` grain without a
source split. Historical contribution is projected from additive measures, so mixed buckets remain
decomposable without adding `is_historical` to either physical grain. Stay Finance contains contracted and
invoiced value only: no cash, paid, remaining, unlinked-payment or evidence amount is attributed to a stay date.

Recorded Booking provenance uses `original_source`. The `other` measure is the remainder for canonical
`other`, structurally possible nulls, and future source codes, so the four provenance measures always sum to
`historical_bookings_count`. Recorded Finance rows originate only from `DATE(bookings.created_at)`; evidence
is associated through the booking's recorded bucket and cannot create a `paid_at`-only row.

Reconciliation is per booking and PII-free. `entry_lag_days` is
`DATE(bookings.created_at) - actual_booked_at`; `-1` is valid at the Cairo/UTC boundary, while values below
`-1` violate the verification contract. Evidence first/last dates use `payments.paid_at`.

#### Correction history

The original PR #57 implementation and its first correction produced alternative `19 / 15 / 19 / 9 / 24`
physical dictionaries. Independent review rejected those implementation-authored alternatives. They did not
ratify themselves and are not retained as approved fields. The final correction normalized all five views to
the owner-frozen `14 / 14 / 16 / 9 / 25` contract before merge. The finance invoice-count amendment is included
in both finance views. The payout fan-out correction is separately and explicitly accepted as an intentional
reporting defect correction.

### 15.2 HB-08A2 implementation evidence

- Migration, verifier and guarded rollback: `db/migrations/0063_add_historical_reporting_read_models*.sql`.
- Production registration: `infra/db/init.prod.sql`; development bootstrap: `db/init.sql`.
- Keyless read models and explicit mappings: `RentalPlatform.Data/ReadModels/Reporting*` and
  `RentalPlatform.Data/Configurations/Reporting*`.
- Authorized APIs and bounded query logs: `ReportingBookingAnalyticsController`,
  `ReportingFinanceAnalyticsController` and their reporting services.
- Contract, HTTP, persisted-data, verifier and rollback coverage:
  `HistoricalReportingContractTests`, `HistoricalReportingHttpContractTests` and
  `HistoricalReportingPostgreSqlTests`.

### 15.3 HB-08A3 presentation evidence

- Admin booking lists use the persisted `isHistorical` flag for the `All / Ordinary / Historical` filter and
  render an accessible Historical label. Booking detail keeps Recorded date, actual booked date and original
  source distinct.
- Analytics consumes the recorded, stay and per-booking reconciliation contracts without adding Recorded and
  Stay axes together. Historical records are shown as subset markers and are excluded from the operational
  acquisition funnel with an explicit explanation.
- Finance labels platform paid, ordinary unlinked payments, Historical agreed value and Historical Payment
  Evidence as separate concepts. Stay Finance shows contracted and invoiced value only; occupancy formula
  correction remains a separate release-hardening concern.
- Owner booking reads expose only the Historical classification needed for a visible label. They do not expose
  internal reconciliation data or reinterpret Historical Payment Evidence as payout truth.
- Browser and component coverage lives in `rental-platform/tests/historical-reporting/` and
  `rental-platform/lib/historical-reporting/`. The pilot procedure is
  [`docs/operations/historical-booking-pilot.md`](../../operations/historical-booking-pilot.md).

### 15.4 PAY-HIST-01 release-hardening evidence

- The ordinary `PaymentService` overpayment guards previously summed Historical Payment Evidence by booking,
  allowing external receipt evidence to consume ordinary settlement capacity.
- Creation and mark-paid validation now count only non-Historical paid or otherwise already-reserved ordinary
  payments under their existing status rules. Ordinary unlinked payments remain settlement-eligible; the fix
  does not substitute invoice linkage for the canonical `is_historical_record` distinction.
- Focused PostgreSQL coverage proves Evidence does not consume capacity, genuine ordinary overpayment keeps its
  existing conflict contract, and invoice, finance, immutability and payout boundaries remain unchanged.
- PAY-HIST-01 changes no migration, schema, endpoint, permission or reporting-view contract.

### 15.5 PAY-OPS-01 settlement serialization evidence

- Ordinary payment creation and `MarkPaidAsync` share the transaction-scoped
  `payment-booking:{bookingId:N}` advisory lock. `MarkPaidAsync` re-reads the payment after acquiring
  the lock, then performs status, capacity, overpayment and invoice-synchronization work in the same
  transaction. A caller-owned transaction is joined but never committed by the service.
- Invoice cancellation participates in the same booking lock because it can remove the active-invoice
  capacity while a pending ordinary payment is settling. Invoice reissue retains its existing lock and
  does not join this boundary because it preserves the invoice amount; both concurrency orderings are
  covered by PostgreSQL tests.
- Focused supported-flow coverage raises invoice capacity, records pending reservations, cancels the
  invoice to restore booking fallback capacity, and proves concurrent settlement cannot make ordinary
  paid exceed that capacity. Exact-capacity settlement, same-payment concurrency, creation concurrency,
  different-booking parallelism and PAY-HIST-01 boundaries remain covered.
- PAY-OPS-01 changes no schema, endpoint, permission, Historical Payment command or reporting contract.
  `INV-OPS-01` (manual-adjustment invoice-total divergence) and `INV-OPS-02` (invoice capacity shrink can
  leave paid plus pending reservations above the new capacity) remain separate release-hardening work.

### 15.6 INV-OPS-01 invoice-total invariant evidence

**Status: COMPLETE — INDEPENDENTLY APPROVED AND OWNER-MERGED.** PR #61's focused arithmetic and
same-invoice manual-adjustment serialization correction was independently approved and Owner-merged.

- Manual adjustment persistence previously counted the newly tracked invoice item twice after EF relationship
  fixup, so a 2,000 adjustment on a 10,000 invoice persisted 12,000 of items but a 14,000 invoice total.
- The canonical manual-adjustment calculation now uses the persisted item sum plus the new line exactly once.
  Concurrent manual adjustments on the same invoice are transactionally serialized so they cannot lose an item
  contribution. Caller-owned transactions remain caller-owned.
- Focused PostgreSQL coverage compares the stored total with an independent persisted-item sum after positive,
  sequential, zero-value, tracked, fresh-context, concurrent and reissue flows. It also proves rejected and
  failed adjustments leave both sides unchanged and that ordinary settlement capacity uses the corrected total.
- Independent review confirmed the INV-OPS-01 arithmetic, atomic persistence and manual-adjustment concurrency
  correction is sound. INV-OPS-01 does not serialize different invoice writers and does not claim to protect
  adjustment versus issue, cancellation or reissue; that cross-writer boundary belongs to INV-OPS-03.
- INV-OPS-01 changes no schema, endpoint or payment contract. Negative unit amounts remain unsupported by the
  existing request validator. `INV-OPS-02`, covering capacity shrink against existing paid and pending
  reservations, remains separately owned and is not changed by this arithmetic correction.

### 15.7 INV-OPS-03 invoice cross-writer lost-update serialization

**Status: COMPLETE — INDEPENDENTLY APPROVED AND OWNER-MERGED.** PR #62 received independent approval and was
Owner-merged before INV-OPS-02 implementation. Reliability/UAT remains gated by the other open release blockers.

- INV-OPS-03 was discovered by the expanded independent review after PR #61 implemented INV-OPS-01. The review
  confirmed the defect existed on the PR #61 base, was not introduced or worsened by PR #61, and is separate
  from the corrected manual-adjustment arithmetic. The post-lock reload in PR #61 closes one stale adjustment
  ordering but cannot coordinate writers that do not share a same-invoice concurrency boundary.
- The proven cross-writer case is `AddManualAdjustmentAsync` versus `IssueAsync`. One ordering can persist a
  12,000 item sum with a stale 10,000 subtotal and total while both operations report success. Another can let a
  stale adjustment persist the invoice status back to draft after issue reported success.
- The production writer census found existing-invoice writers in `AddManualAdjustmentAsync`, `IssueAsync`,
  `CancelAsync`, `ReissueAsync` and payment-driven invoice-status synchronization in `MarkPaidAsync`.
  `CreateDraftFromBookingAsync` creates a new, not-yet-visible invoice under its existing booking lock;
  orphan-payment linking and payment failure/cancellation do not write invoice fields. No raw-SQL, bulk-update,
  item-removal or invoice-deletion writer exists in the application path.
- The selected mechanism is the transaction-scoped, identity-specific
  `invoice-mutation:{invoiceId:N}` advisory lock. Each existing-invoice writer acquires it before its authoritative
  read and status validation, keeps it through `SaveChanges` and commit, and re-reads tracked state after waiting.
  Whole-entity EF updates remain, but no participating writer can persist a pre-lock invoice snapshot.
- At PR #62 merge, lock ordering was acyclic: payment settlement and invoice cancellation acquired
  `payment-booking:{bookingId:N}` before the invoice lock; generated reissue numbers acquired
  `invoice-number-generation` before the invoice lock; adjustment and issue acquired only the invoice lock.
  Booking confirmation retains `booking-unit` then `invoice-booking` then invoice-number generation before issuing
  its newly created invoice. No protected path acquires one of those outer locks after an invoice lock.
- Deterministic PostgreSQL coverage proves both adjustment/issue and adjustment/cancellation serial orders,
  stale tracked-context protection, payment-driven status synchronization, cancellation/reissue outcomes,
  different-invoice parallelism, caller-owned reissue transactions and payment-to-invoice deadlock ordering.
  Adjustment and reissue cannot share a valid initial status under the existing state machine, but reissue still
  participates because it supersedes invoice state and can overlap cancellation or payment synchronization.
- The correction changes no schema, migration, endpoint, permission or public error contract. INV-OPS-01 remains
  canonical, and legacy inconsistent rows are not repaired or normalized by this concurrency boundary.
- INV-OPS-03 is not INV-OPS-02. INV-OPS-03 concerns stale writes and lost updates between invoice writers;
  INV-OPS-02 owns the capacity/reservation invariant when a valid invoice capacity shrinks after ordinary paid or
  pending reservations already exist.

### 15.8 INV-OPS-02 invoice capacity/reservation invariant

**Status: COMPLETE — INDEPENDENTLY APPROVED AND OWNER-MERGED.** PR #63 received independent approval and was
Owner-merged after the Owner ratified the fail-closed capacity policy from the repository and PostgreSQL
evidence packet.

- A supported capacity-reducing mutation is rejected when booking-scoped ordinary paid plus pending commitments
  exceed the proposed effective settlement capacity. Equality is valid. Rejection uses the existing uncoded
  `ConflictException` / HTTP 409 contract and does not cancel, release, reclassify or compensate any payment.
- The commitment population is `BookingId = target booking`, `IsHistoricalRecord = false`, and
  `PaymentStatus IN ('paid', 'pending')`. Invoice linkage is not a classification boundary: ordinary linked and
  unlinked commitments participate, while failed, cancelled and Historical Payment Evidence rows do not.
- `CancelAsync` validates the authoritative ordinary commitment total before removing an active invoice whose
  cancellation would reduce capacity to `Booking.FinalAmount`. A rejection leaves invoice and payment state
  unchanged. Existing linked-paid and invoice-status cancellation conflicts remain earlier, unchanged guards.
- Non-negative manual adjustments normally increase capacity, but canonical recomputation can normalize a legacy
  INV-OPS-01-inconsistent stored total downward. `AddManualAdjustmentAsync` therefore protects that path with
  `payment-booking:{bookingId:N}` followed by `invoice-mutation:{invoiceId:N}`, recomputes item truth after both
  locks, and rejects an unsafe normalization before staging an item or aggregate update.
- The resulting lock graph remains acyclic: every path needing both locks uses payment-booking then
  invoice-mutation. Commitment reads occur inside the transaction after the booking lock, and transaction-scoped
  locks remain held through `SaveChanges` and the owning commit. Different booking IDs remain independent.
- Deterministic PostgreSQL coverage proves pending-only, paid-plus-pending, paid-only, exact-boundary, one-cent,
  Historical Evidence, ordinary-unlinked, cancellation atomicity, legacy normalization and both payment/shrink
  serial orderings. Mutation checks protect rejection, payment populations, read placement and lock ordering.
- INV-OPS-02 changes no schema, migration, endpoint, permission, payment lifecycle, payout policy or reporting
  contract. INV-OPS-01 and owner-merged INV-OPS-03 remain canonical; INV-OPS-02 does not repair legacy rows.

### 15.9 INV-AUDIT-01 read-only invoice aggregate consistency gate

**Status: IMPLEMENTED — PENDING INDEPENDENT REVIEW.** This gate was implemented after the Owner-merged
INV-OPS-01, INV-OPS-02 and INV-OPS-03 write-side integrity corrections. It must pass after invoice-integrity
write fixes and before #99 Reliability/UAT; execution against a release environment remains a later explicit
Owner/operator step.

- The defective manual-adjustment calculation existed before PR #61, so an environment that previously exercised
  that path may contain an invoice whose stored subtotal or total does not equal its persisted invoice-item sum.
  No production database was inspected, and this risk is not evidence that any production row is inconsistent.
- `RentalPlatform.InvoiceAggregateAudit` scans every persisted invoice, including draft, issued, paid, cancelled
  and superseded rows. It independently checks exact PostgreSQL `numeric` truth for
  `subtotal_amount = SUM(invoice_items.line_total)`, `total_amount = subtotal_amount`, and the required presence
  of at least one persisted item. Subtotal and total/subtotal failures remain separately diagnosable.
- The audit uses one set-based aggregate query in a repeatable-read, database-enforced read-only transaction. Its
  approved least-privilege identity needs only database/schema access and `SELECT` on `invoices` and
  `invoice_items`; it does not need mutation privileges. Exit `0` means consistent, exit `2` means inconsistent,
  and verification/configuration failures are nonzero and never treated as a pass.
- Diagnostics are bounded to invoice/booking identifiers, invoice number and status, item count, exact aggregate
  values/deltas, mismatch flags and invoice timestamps. Client/owner PII, payment references, notes, banking
  fields and external references are not queried or emitted.
- `ReissueAsync` copies the stored source totals and source items. A pre-existing inconsistent source invoice may
  therefore propagate its inconsistency to the replacement. Reissue behavior is unchanged in PR #61; this belongs
  to the consistency gate and any separately authorized remediation work, not INV-OPS-02.
- Detection does not authorize repair. Any inconsistency blocks release readiness pending Owner assessment; no
  invoice, item, status or payment is automatically changed, and remediation requires a separate evidence-driven
  decision and task.

### 15.10 PAY-OPS-F01 mark-paid/cancel test reliability follow-up

**Status: COMPLETE — INDEPENDENTLY APPROVED AND OWNER-MERGED.** During the independent read-only review of
PR #64, the pre-existing `ConcurrentMarkPaidAndInvoiceCancelCannotCommitPaidAboveFinalCapacity` test failed
intermittently under statement logging and concurrent database lifecycle load. The investigation reproduced the
failure without changing production services and classified it as a test-contract defect, not a durable financial
failure.

- The test fixture has a 10,000 booking fallback, an active 12,000 invoice and one 12,000 ordinary pending
  payment. If MarkPaid commits first, cancellation observes the paid invoice and rejects it. If cancellation
  validates first, INV-OPS-02 rejects the fallback-capacity reduction because 12,000 of pending commitment exceeds
  10,000; MarkPaid then settles against the still-active 12,000 invoice. Both are valid serial outcomes.
- The old test accepted both command winners in principle but required the cancellation loser to report only
  `already paid`. Under review-style load, the reproduced failure instead carried the truthful INV-OPS-02
  commitment conflict. The test's preceding exactly-one-success and paid-within-capacity assertions had passed.
- The corrected coverage waits on the exact `payment-booking:{bookingId:N}` advisory key, forces both serial
  orderings in separate tests and reads final invoice, payment, commitment, capacity and payout truth directly
  from PostgreSQL through an independent connection. It accepts only the two stable cancellation conflicts and
  retains exact paid/pending/capacity and no-partial-mutation assertions.
- Clean unmodified repetition passed 50/50; review-style loaded unmodified repetition reproduced the stale
  assertion once in 50 runs. Corrected repetition passed 50/50 clean and 50/50 with statement logging plus three
  concurrent database create/remove workers, with no hangs or timeouts.
- Scratch mutations proved the coverage fails if cancellation leaves the booking serialization boundary or if
  paid/link/capacity guards are bypassed. `PaymentService`, `InvoiceService`, lock helpers, financial semantics,
  schema and API contracts are unchanged by this follow-up.

### 15.11 AN-OPS-01A historical rentable-capacity contract and persistence design

**Status: OWNER RATIFIED.** Occupancy is a stay-date physical-capacity metric whose denominator requires
historically effective operational rentability. The ratified inputs are `Unit.IsActive`, `Unit.DeletedAt` and
non-deleted pending/approved DateBlocks. Project activity, portfolio visibility, guest capacity, pricing and
owner attribution are not physical-capacity inputs. Pre-ledger availability is unknown and must remain N/A;
current inventory state and legacy timestamps are not historical evidence.

The Owner selected versioned resolved half-open rentability intervals per unit. Ordinary changes become
effective on the current Cairo date and cannot alter closed prior nights. Resolved state is always recomputed
from all authoritative inputs so overlapping causes compose correctly. Event sourcing, nightly snapshots,
retroactive guessing and privileged historical correction are outside the approved design.

### 15.12 AN-OPS-01B1 rentable-capacity history persistence and writer atomicity

**Status: IMPLEMENTED — PENDING INDEPENDENT REVIEW.** Migration `0064` adds an explicitly unpublished global
ledger and versioned `unit_rentability_periods`; it does not seed or claim a production epoch. PostgreSQL
`btree_gist` enforces non-overlap of active half-open intervals, with a separate partial uniqueness rule for
the single current open interval. The rollback refuses to discard seeded or published history and retains the
extension because later objects may share it.

- The one-time operational initializer accepts only the current Cairo date, acquires exclusive
  `rentable-capacity:publication`, seeds existing units from authoritative current state, resolves surviving
  pending/approved DateBlocks at and after the epoch, verifies the complete projection, and publishes in the
  same transaction. Replay fails closed. No production initialization occurs in this PR.
- Ordinary capacity writers acquire shared `rentable-capacity:publication`, then
  `booking-unit:{unitId:N}`, then reload authoritative state. Source mutation and resolved interval changes
  commit atomically. Caller-owned transactions remain caller-owned. Different units retain parallelism because
  the publication lock is shared and the unit lock is identity-scoped.
- Integrated writers are `UnitService.CreateAsync`, `UpdateAsync`, `SetActiveAsync`, `SoftDeleteAsync`,
  `DateBlockService.CreateAsync`, `UpdateAsync`, `DeleteAsync`, and
  `DateBlockApprovalService.RequestOwnerBlockAsync`, `ResolveAsync`, and `WithdrawOwnerBlockAsync`.
  `SetPortfolioVisibilityAsync` remains a targeted non-capacity update. Project and portfolio writers do not
  write capacity history.
- DateBlocks are operationally inclusive and project to ledger intervals as `[StartDate, EndDate + 1)`.
  Pending and approved non-deleted blocks both remove capacity. Rejection, withdrawal and deletion release only
  current/future capacity. Deleting one overlapping cause cannot reopen nights still covered by another.
- The booking/rentability census found supported firm allocation through CRM conversion, Historical Booking,
  `Relevant -> Booked`, and confirmation. CRM conversion, Historical Booking and confirmation already used the
  canonical unit lock. B1 adds authoritative locked validation to `Relevant -> Booked`; prospecting/relevant
  date edits remain soft holds and are revalidated when entering Booked. Check-in/completion/early departure do
  not allocate a new unit-night. Historical Booking remains intentionally authoritative for past truth; any B2
  occupied-pair conflict with known capacity makes the future occupancy rate unavailable rather than changing
  B1 history.
- The read-only verifier runs in a repeatable-read database-enforced read-only transaction and fails closed on
  an unpublished ledger, overlap, gaps, missing opening/current periods, invalid bounds, pre-epoch claims or
  malformed supersession truth. It never repairs data.
- Focused PostgreSQL evidence covers opening active/inactive/blocked units, post-epoch entry, unit lifecycle,
  DateBlock composition and approval lifecycle, closed-history preservation, source/ledger rollback, caller
  transactions, same-unit and different-unit concurrency, database overlap rejection, seed publication failure,
  and the Blocked/Booked race. Scratch mutations killed each load-bearing guard.

AN-OPS-01B2 remains responsible for the occupancy backend/API, coverage completeness, physical occupied-pair
integrity conflicts and N/A behavior. AN-OPS-01B3 remains responsible for the widget correction. Neither is
implemented by B1, and no revenue allocation semantics change.

## 16. Migration and rollout plan

### 16.1 Ordering

Implement HB-08A after HB-05 domain truth. Verify fresh and upgrade schemas, consumer compatibility and
reconciliation. Complete PRE-00 and safety rehearsals before pilot. Pilot HB-08A and the historical flow.
Only after pilot exit may HB-08B be implemented and activated.

### 16.2 Pilot definition

The pilot is least-privilege, low-volume, reversible, and reconciled daily across recorded/stay axes,
historical evidence, invoices and payouts. It is not production-wide enablement.

### 16.3 Pilot permissions

SuperAdmin retains the bootstrap baseline. Grant `bookings:record_historical` explicitly to one existing
operational role for the pilot. Grant `payments:record_historical` only when that role is expected to capture
payment evidence. Owner-attribution correction remains SuperAdmin-exclusive, and reporting access remains
independent under the existing reporting permission. No permission bundle or role-name bypass is introduced.

## 17. Detailed implementation tasks

Implement the three read models/routes, append-only breakdowns, safe UI consumption, structured logs,
consumer inventory, reconciliation and rollout evidence. Keep HB-08A and HB-08B in separate PRs.

### 17.1 REQ-16 hardening tasks — a later independent PR

Add server-side normal-flow past-date rejection, stable error transport and regressions only after pilot
approval. Do not alter the historical endpoint. The hardening commit/PR must be independently revertible.

## 18. Rollback strategy

HB-08A rollback restores prior view definitions and backend/UI reporting code without deleting booking,
payment, invoice or audit data. Deployment remains gated by verified backup and isolated rehearsal.
Removing pilot access may stop new Historical recording, but it never implies rollback or deletion of already
recorded Historical bookings, payment evidence, owner-review history or correction evidence.

### 18.1 The REQ-16 hardening rollback — independently revertible

HB-08B can be reverted without reverting historical creation or reporting. Reversion reopens the pre-existing
normal past-date behavior only; it does not touch stored historical records.

## 19. Readiness

The contract and PRE-00 are closed. HB-08A1 settlement isolation, HB-08A2 migration `0063` and report APIs,
and HB-08A3 presentation/runbook behavior are implemented and pending independent review. This does not mark
the pilot or production rollout complete. Rollout remains blocked by the release gates in §9. HB-08B remains
blocked by successful pilot evidence.
