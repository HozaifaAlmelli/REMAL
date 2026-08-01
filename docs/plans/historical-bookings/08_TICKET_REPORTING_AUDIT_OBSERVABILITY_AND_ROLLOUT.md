# HB-08 — Reporting, Audit, Observability, Rollout and Later Hardening

> Navigation: [README](README.md) · [Master](00_MASTER_PLAN.md) · [Scenarios](99_RELIABILITY_TEST_SCENARIOS.md)

## 1. Ticket metadata

| Field | Value |
|---|---|
| Ticket | HB-08 |
| Status | **OWNER APPROVED — BLOCKED BY DEPENDENCY** |
| Delivery | HB-08A reporting/rollout first; HB-08B normal-flow hardening only after pilot evidence |
| Depends on | HB-02 through HB-05 for complete domain truth; PRE-00 blocks rollout, not documentation or implementation preparation |
| Migration ownership | Reporting views and append-only report columns listed in §15; no migration number is reserved |

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

## 6. Audit and observability

Durable audit remains in domain tables: booking history for creation/payment linkage and the HB-05 immutable
correction table for owner changes. Structured logs are supplementary and contain bounded event names,
stable IDs, result code and timing only. v1 introduces no metrics platform and no unbounded-cardinality labels.

Operational reconciliation is database-derived and pull-only. HB-08 adds no scheduled push, notification,
webhook or per-request post-commit verification query.

## 7. External consumers

Rollout is blocked until Operations records whether any BI tool, direct-SQL consumer, spreadsheet or export
depends on the reporting views. Historical rows remain included by default with additive breakdown columns;
an opt-out is explicit. Unknown external consumers are a rollout blocker, not permission to silently exclude
historical data.

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

## 16. Migration and rollout plan

### 16.1 Ordering

Implement HB-08A after HB-05 domain truth. Verify fresh and upgrade schemas, consumer compatibility and
reconciliation. Complete PRE-00 and safety rehearsals before pilot. Pilot HB-08A and the historical flow.
Only after pilot exit may HB-08B be implemented and activated.

### 16.2 Pilot definition

The pilot is least-privilege, low-volume, reversible, and reconciled daily across recorded/stay axes,
historical evidence, invoices and payouts. It is not production-wide enablement.

## 17. Detailed implementation tasks

Implement the three read models/routes, append-only breakdowns, safe UI consumption, structured logs,
consumer inventory, reconciliation and rollout evidence. Keep HB-08A and HB-08B in separate PRs.

### 17.1 REQ-16 hardening tasks — a later independent PR

Add server-side normal-flow past-date rejection, stable error transport and regressions only after pilot
approval. Do not alter the historical endpoint. The hardening commit/PR must be independently revertible.

## 18. Rollback strategy

HB-08A rollback restores prior view definitions and backend/UI reporting code without deleting booking,
payment, invoice or audit data. Deployment remains gated by verified backup and isolated rehearsal.

### 18.1 The REQ-16 hardening rollback — independently revertible

HB-08B can be reverted without reverting historical creation or reporting. Reversion reopens the pre-existing
normal past-date behavior only; it does not touch stored historical records.

## 19. Readiness

The contract is closed. HB-08 overall is **BLOCKED BY DEPENDENCY** until HB-05 is implemented; rollout is
additionally blocked by PRE-00 and the release gates. HB-08B remains blocked by successful pilot evidence.
