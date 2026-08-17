# 99 — Reliability and UAT Test Scenario Pack

> [README](README.md) · [Master Plan](00_MASTER_PLAN.md) · [HB-01](01_TICKET_DISCOVERY_AND_ARCHITECTURE_DECISIONS.md) ·
> [HB-02](02_TICKET_HISTORICAL_BOOKING_DOMAIN_AND_API.md) · [HB-03](03_TICKET_AVAILABILITY_CONFLICTS_AND_DUPLICATE_PROTECTION.md) ·
> [HB-04](04_TICKET_FINANCIAL_SNAPSHOT_AND_HISTORICAL_PAYMENTS.md) · [HB-05](05_TICKET_OWNER_ACCOUNTING_AND_SETTLEMENT_ADJUSTMENTS.md) ·
> [HB-06](06_TICKET_HISTORICAL_BOOKING_WIZARD_UI.md) · [HB-07](07_TICKET_NOTIFICATIONS_AUTOMATIONS_AND_INTEGRATIONS.md) ·
> [HB-08](08_TICKET_REPORTING_AUDIT_OBSERVABILITY_AND_ROLLOUT.md) · [HB-09](09_TICKET_TEST_AUTOMATION_AND_RELEASE_GATES.md)

---

## P1. Purpose and scope

This is **not** a ticket. It is the executable verification pack for the *Record Historical Booking*
(`تسجيل حجز سابق`) capability, intended to be run **after** HB-01 … HB-08 are implemented and **as the
evidence base** for the release gate defined in [HB-09](09_TICKET_TEST_AUTOMATION_AND_RELEASE_GATES.md).

| Aspect | Statement |
|---|---|
| Document status | `OWNER APPROVED` — target verification contract |
| Applies to | The historical command, the hardened normal flow, and every subsystem they touch |
| Scenario count | **160**, across **17** groups — `SC-HAPPY` 7, `SC-DATE` 10, `SC-AVAIL` 12, `SC-DUP` 8, `SC-SEC` 12, `SC-FIN` 14, `SC-PAY` 10, `SC-OWN` 18, `SC-NOTIF` 12, `SC-AUDIT` 6, `SC-REP` 14, `SC-UI` 10, `SC-TXN` 6, `SC-REG` 7, `SC-MIG` 5, `SC-PERF` 4, `SC-CONC` 5 |
| Duplicate scenario ids | 0 |
| Dangling scenario references | 0 |
| Expected to fail against `8dafb5a` | Exactly **one** — `SC-REG-02`. See [the expected-to-fail set](#the-expected-to-fail-set) |
| Contract-closure base | `3e2090ecda2a0a70197521390f2c8d2c34905eff` |
| Executable in production? | **No**, except the explicitly marked read-only smoke subset in [P14](#p14-production-smoke-restrictions) |
| Relationship to acceptance criteria | Every currently ratified identifier is covered by the dynamically recounted contiguous ranges in [§Traceability matrices](#traceability-matrices): 208 ACs and 155 NACs at this revision, 363 total, including HB-04B |
| Canonical endpoint | `POST /api/internal/bookings/historical`, success `200 OK` — see [P16](#p16-canonical-contract-and-decided-behaviour) |
| Decisions governing these scenarios | All final. Invoice and historical-payment policy are `OWNER APPROVED` — see [P16.2](#p16-canonical-contract-and-decided-behaviour) |

**In scope of this pack:** normal-flow past-date rejection; authorised historical creation; unauthorised
attempts; the completed-stay boundary in `Africa/Cairo`; active and inactive units; soft-deleted unit
rejection; `Completed`/`LeftEarly` overlap detection; duplicate detection; historical agreed price and
repricing protection; invoice consistency; partial, full and deposit payments; historical `PaidAt`; owner
review and privileged correction; payout-safe attribution audit; reporting by recorded date versus stay date; absence of
notification replay; `AutoCompleteBookingsJob` exclusion; concurrency; rollback; migration compatibility;
normal-booking regression; accounting reconciliation.

**Out of scope of this pack:** bulk/CSV import, ongoing stays, date-ranged ownership history, hold
semantics, payment-gateway behaviour, multi-currency — all excluded from v1 by
[Master §5](00_MASTER_PLAN.md#5-non-goals).

---

## P2. How to read a scenario record

Every scenario uses the identical fifteen-row block below. No field is ever omitted; where a field does not
apply it reads `n/a` plus a one-clause reason.

| Row | Meaning |
|---|---|
| **Priority · Category · Automate** | `P0` release-blocking / `P1` regression / `P2` desirable. Category = the group. Automation candidate `YES`/`NO` with the harness in brackets |
| **Traceability** | `REQ-nn` requirements · `HB-nn` ticket · `INV-nn` invariants asserted |
| **Preconditions** | System and fixture state required before step 1 |
| **Test data** | The concrete fixture handles and values used |
| **Steps** | Numbered, executable, no ambiguity |
| **Expected — UI** | What the operator portal must show |
| **Expected — API** | HTTP status, error code from [Master §12](00_MASTER_PLAN.md#12-api-and-command-design), body shape |
| **Expected — DB** | Rows written or provably not written |
| **Expected — Audit** | `booking_status_history` and audit-event expectations |
| **Expected — Financial** | Amounts, balances, invoice consequences |
| **Expected — Owner** | Attribution, snapshot, payout consequences |
| **Expected — Notification** | Notification rows and background-job consequences |
| **Expected — Reporting** | Which report/view/read-model changes, and in which bucket |
| **Cleanup** | How to return the environment to the baseline |
| **Diagnostics** | What to capture if the scenario fails |

**Route shorthand used throughout** (`CONFIRMED` for existing routes,
`RentalPlatform.API/Controllers/BookingsController.cs:32,68,81,97,118,139`):

| Shorthand | Route | Status |
|---|---|---|
| `N-CREATE` | `POST /api/internal/bookings` | `CONFIRMED` — `BookingsController.cs:97` |
| `Q-CREATE` | `POST /api/internal/bookings/quick` | `CONFIRMED` — `BookingsController.cs:118` |
| `B-UPDATE` | `PUT /api/internal/bookings/{id}` | `CONFIRMED` — `BookingsController.cs:139` |
| `B-HISTORY` | `GET /api/internal/bookings/{id}/status-history` | `CONFIRMED` — `BookingsController.cs:81` |
| `H-CREATE` | `POST /api/internal/bookings/historical` | `OWNER APPROVED`, implemented by HB-02 |
| `H-PAY` | `POST /api/internal/bookings/{bookingId:guid}/historical-payments` | `OWNER APPROVED`, implemented by HB-04B |
| `H-OWNER-CORRECT` | `POST /api/internal/bookings/{bookingId:guid}/owner-attribution-corrections` | `OWNER APPROVED`, owned by HB-05 |
| `I-DRAFT` | `POST /api/internal/invoices/drafts` | `CONFIRMED` — already permitted for `Completed`/`LeftEarly` bookings (F-10) |

---

## P3. Environments

| Env | Purpose | Database | Constraints |
|---|---|---|---|
| **E-DEV** | Developer loop, unit and service scenarios | Explicit authorized disposable PostgreSQL 16 through `KAZA_TEST_DB` | Never use the shared development database; missing configuration fails before connection |
| **E-CI** | Automated suite on every PR | Ephemeral PostgreSQL 16 service | PRE-02 complete; `backend-postgres` executes `Category=PostgreSQL` with no fallback |
| **E-STG** | Migration forward/verify, integration, full P0+P1 | Staging Postgres restored from a sanitized production snapshot | Must contain realistic booking volume for `SC-PERF-02` |
| **E-UAT** | Operator-executed manual UAT and accounting reconciliation | Sanitized UAT Postgres | Finance participates directly; snapshot taken before the pack starts |
| **E-PROD** | Post-deploy verification only | Production | **Read-only subset only** — see [P14](#p14-production-smoke-restrictions) |

`CONFIRMED` — the operator portal is English-only and has no i18n system; the storefront (`demo`) is Arabic.
Scenario expectations are written against English portal copy. See
[OQ-08](00_MASTER_PLAN.md#32-open-questions).

---

## P4. Required permissions

`CONFIRMED` (F-14) — permissions are `area:action` constants in
`RentalPlatform.API/Authorization/PermissionKeys.cs:13-33`, enforced as ASP.NET policies
(`BookingsController.cs:98,119,140`), persisted as `permission_key VARCHAR(50)` in
`db/migrations/0053_create_dynamic_rbac.sql:22`, seeded to role templates at `:68-70`, and overridable
per-user through `rbac_admin_user_permission_overrides` with `grant`/`deny` modifier types
(observed in `AutoCompleteBookingsJob.cs:172-179`).

| Permission | Status | Needed by |
|---|---|---|
| `bookings:read` | `CONFIRMED` existing | All read assertions |
| `bookings:write` | `CONFIRMED` existing | Normal-flow and regression scenarios |
| `bookings:record_historical` | Implemented (HB-02) | Every `H-CREATE` scenario |
| `payments:record_historical` | Implemented (HB-04B) | Every `H-PAY` scenario |
| `bookings:correct_owner_attribution` | Owner-approved (HB-05) | Owner-correction scenarios |
| `finance:manage` | `CONFIRMED` existing | Outstanding-balance alert recipients (`AutoCompleteBookingsJob.cs:145-221`); invoice assertions |
| `finance:payouts` | `CONFIRMED` existing | Owner payout assertions |
| `owners:read` / `owners:manage` | `CONFIRMED` existing | Owner fixture setup and commission-rate mutation |
| `units:manage` | `CONFIRMED` existing | Unit fixture setup, deactivation, soft delete |

---

## P5. Required test users

All admin users are seeded in the sanitized environment only. Password policy follows the existing dev seed
convention (`*.dev@rental.local` / `Admin@1234`) — never reuse production credentials.

| Handle | Permissions | Purpose |
|---|---|---|
| `A-HIST` | `bookings:read`, `bookings:write`, `bookings:record_historical` | The canonical authorised historical operator, without owner-correction rights |
| `A-HIST-CORR` | as `A-HIST` plus `bookings:correct_owner_attribution` | Separate HB-05 correction scenarios |
| `A-PLAIN` | `bookings:read`, `bookings:write` | The unauthorised-but-legitimate operator; proves the permission is a real gate and the normal endpoint is not a bypass |
| `A-READONLY` | `bookings:read` | Read-only negative checks |
| `A-FIN` | `finance:overview`, `finance:manage`, `finance:payouts` | Invoice, payout and balance-alert assertions |
| `A-DENY` | role template grants `bookings:record_historical`, but a user-level `deny` override is applied | Proves overrides win over template grants |
| `A-OTHER-PF` | `bookings:record_historical` scoped to a **different** portfolio | Cross-portfolio / IDOR scenarios |
| `CL-CLIENT` | A client-portal principal (not an admin) | Principal-type confusion checks |
| `OW-OWNER` | An owner-portal principal | Principal-type confusion checks |

For cross-scope tests, use the repository's `units.portfolio_visibility` access axis introduced by migration
`0056`; tests must not invent a second tenant model. Owner IDs are still loaded and validated server-side,
and no scenario treats a supplied GUID as authorization.

---

## P6. Required units

All fixtures are sanitized (no real guest or owner PII). Prices are fixture values, not production values.

| Handle | `is_active` | `deleted_at` | Owner | `max_guests` | `base_price_per_night` | Purpose |
|---|---|---|---|---|---|---|
| `U-ACTIVE-1` | true | null | `O-ALPHA` | 4 | 1500.00 | Canonical happy-path unit |
| `U-ACTIVE-2` | true | null | `O-BETA` | 2 | 900.00 | Capacity and second-unit checks |
| `U-SEASONAL-1` | true | null | `O-ALPHA` | 6 | 1200.00 | Has `SeasonalPricing` rows covering the historical window, so the live reference price provably differs from the agreed amount (F-07) |
| `U-INACTIVE-1` | **false** | null | `O-ALPHA` | 4 | 1400.00 | Inactive-but-not-deleted — must be **allowed** for historical entry (REQ-17, ADR-12) |
| `U-DELETED-1` | false | **set** | `O-BETA` | 3 | 1100.00 | Soft-deleted — must be **rejected** (`UNIT_DELETED_UNSUPPORTED`) |
| `U-BUSY-1` | true | null | `O-ALPHA` | 4 | 1500.00 | Pre-loaded with `Completed`, `LeftEarly`, `Cancelled` and `NotRelevant` bookings for the overlap matrix |
| `U-BLOCKED-1` | true | null | `O-BETA` | 2 | 950.00 | Has a `DateBlock` covering the historical window (`UnitAvailabilityService.cs:39,83`) |
| `U-OTHER-PF-1` | true | null | `O-GAMMA` | 2 | 800.00 | Outside `A-HIST`'s portfolio — IDOR target |
| `U-VOLUME-1` | true | null | `O-ALPHA` | 4 | 1500.00 | Carries ≥ 5 000 historical bookings for `SC-PERF-02` |

`CONFIRMED` — the current create path requires `u.IsActive && u.DeletedAt == null`
(`BookingService.cs:156-165`) and `UnitAvailabilityService.cs:33-34` throws when `!unit.IsActive`, which is
exactly why `U-INACTIVE-1` is a first-class fixture rather than an edge case.

---

## P7. Required owners

| Handle | `commission_rate` | Payout state | Purpose |
|---|---|---|---|
| `O-ALPHA` | 15.00 | Test bookings may have no payout or a state-specific payout | Default attribution; correction safety |
| `O-BETA` | 20.00 | Test bookings may have a paid payout | Proves owner correction never mutates settlement |
| `O-GAMMA` | 10.00 | none | Out-of-portfolio injection target |
| `O-DELTA` | 25.00 | none | **The owner-changed case.** `U-ACTIVE-1` was, as a documented business fact, owned by `O-DELTA` during the `STAY-PAST` window and is owned by `O-ALPHA` today |

`CONFIRMED` (F-13) — there is **no** ownership-history, contract or effective-date model anywhere
(`BookingService.cs:225` snapshots `unit.OwnerId`; `Owner.cs:13` `CommissionRate` is mutable). The
`O-DELTA` situation therefore cannot be derived by the system; it exists only as an out-of-band fact given
to the tester, which is precisely the condition ADR-08 addresses with deterministic creation-time
attribution plus a separate privileged correction.

**Closed-period note.** `CONFIRMED` (F-03) — `owner_payouts` is one row per booking
(`ux_owner_payouts_booking_id` UNIQUE) with `payout_status IN ('pending','scheduled','paid','cancelled')`
and **no** `period_start`/`period_end`, no statement table and no adjustment entity. Therefore in this pack
**"closed period" means: a payout row whose `payout_status = 'paid'`.** No scenario may assume a settlement
period exists.

---

## P8. Required clients

| Handle | State | Purpose |
|---|---|---|
| `C-EXISTING-1` | Active, phone `+20100 000 0001` | Canonical historical guest |
| `C-EXISTING-2` | Active, phone stored in a different format (`00201000000002`) | Match-or-create normalisation checks |
| `C-NEW-1` | **Not present** in the database | Inline client creation during the wizard |
| `C-DELETED-1` | Soft-deleted / inactive | Invalid-client rejection (`SC-SEC-10`) |
| `C-OTHER-PF-1` | Belongs to another portfolio | IDOR target |

HB-02 owns the final rule: use the client subsystem's server-side normalized phone identity. An active,
non-deleted match conflicts with `CLIENT_PHONE_ALREADY_EXISTS`; an inactive/deleted holder conflicts with
`CLIENT_PHONE_REQUIRES_REVIEW`; only an unknown normalized phone may create a client in the transaction.

---

## P9. Required payout states

| State needed | How to create it | Used by |
|---|---|---|
| **Open** — `payout_status = 'pending'` for `O-ALPHA` | Create a payout row through `OwnerPayoutService` for a pre-existing non-historical booking | `SC-OWN-09` |
| **Scheduled** — `payout_status = 'scheduled'` | Same, then schedule | `SC-OWN-09` |
| **Closed/paid** — `payout_status = 'paid'` with `paid_at` set for `O-BETA` | Same, then mark paid with proof-of-payment | `SC-OWN-09`, `SC-REP-06` |
| **No payout at all** for the historical booking under test | Default — payout rows are created explicitly, not automatically (`OwnerPayoutService.cs:107-123`) | Every historical creation scenario |

`CONFIRMED` — `ck_owner_payouts_payout_formula CHECK (payout_amount = gross_booking_amount -
commission_amount)` means any reconciliation assertion must satisfy that identity exactly; a rounding
mismatch will surface as a constraint violation, not as a silent drift.

---

## P10. Required payment methods

`CONFIRMED` (F-12) — `db/migrations/0022_create_payments.sql:18`
`ck_payments_method CHECK (payment_method IN ('cash','bank_transfer','card','wallet'))`.

| Method | Used in this pack? | Rationale |
|---|---|---|
| `cash` | **Yes** — primary | The brief's real case: a deposit handed to a KAZA representative |
| `bank_transfer` | **Yes** | Second method, exercises `reference_number` |
| `wallet` | **Yes** | Third manual method |
| `card` | **Yes** | Records immutable evidence of a card payment that occurred outside KAZA; PAY-12 still forbids any live gateway call |

`CONFIRMED` — `ck_payments_amount_positive CHECK (amount > 0)` means **refunds and negative adjustments are
not representable**; no scenario may attempt one.

---

## P11. Timezone and date assumptions

| Assumption | Label | Evidence |
|---|---|---|
| The business timezone is `Africa/Cairo`, falling back to `Egypt Standard Time` | `CONFIRMED` | `AutoCompleteBookingsJob.cs:18,133-143` |
| A stay is *complete* when `check_out_date <= DateOnly.FromDateTime(cairoNow).AddDays(-1)` | `OWNER APPROVED` historical boundary (ADR-03) | `AutoCompleteBookingsJob.cs:70,86-87` |
| `check_in_date` / `check_out_date` are `DateOnly` in C# and `DATE` in Postgres — **timezone-free** | `CONFIRMED` | `Booking.cs:15-16`; `db/migrations/0016_create_bookings.sql` |
| `created_at` / `updated_at` are `TIMESTAMP` **without** time zone, written as `DateTime.UtcNow` | `CONFIRMED` | Booking entity `:22-23`; `0016_create_bookings.sql` |
| `payments.paid_at` is `TIMESTAMP NULL` and is the real effective date | `CONFIRMED` | `Payment.cs:14`; `0022_create_payments.sql` |
| Egypt observes DST; because stay dates are `DateOnly`, DST can only affect the derivation of "today", never a stored stay date | `INFERRED` | Master §10 |

**Date anchors.** All scenarios are written relative to `D0`, resolved **once** at suite start:

| Anchor | Definition | Example when `D0 = 2026-07-28` |
|---|---|---|
| `D0` | The current `Africa/Cairo` business date | `2026-07-28` |
| `STAY-IN` | `D0 − 8` | `2026-07-20` |
| `STAY-OUT` | `D0 − 5` (3 nights; last night `D0 − 6`) | `2026-07-23` |
| `AGREED-AT` | `D0 − 9` — the historical agreement date | `2026-07-19` |
| `PAID-AT` | `D0 − 9` at `09:30` Cairo | `2026-07-19T09:30+03:00` |
| `EDGE-OUT-YDAY` | `D0 − 1` — the last **allowed** checkout | `2026-07-27` |
| `EDGE-OUT-TODAY` | `D0` — checkout today, **not** complete | `2026-07-28` |
| `FUT-IN` / `FUT-OUT` | `D0 + 5` / `D0 + 8` | `2026-08-02` / `2026-08-05` |

**Overlap semantics reminder.** `CONFIRMED` — the existing predicate at `UnitAvailabilityService.cs:52` is
`startDate < b.CheckOutDate && endDate >= b.CheckInDate` where `endDate` is the **last night**, i.e.
`checkOut − 1` (`BookingService.cs:188-190` uses the same convention for pricing). Consequently a checkout
on day *X* and a check-in on day *X* for the same unit is a legal **same-day turnover**, not a conflict.
Every `SC-AVAIL-*` expectation is written against that convention.

**Canonical financial fixture** used by the happy path:

| Value | Amount |
|---|---|
| Reference price (3 nights × 1500.00 live rate) | 4 500.00 |
| **Agreed amount** (operator-entered) | **3 900.00** |
| Deposit paid `cash` at `PAID-AT` | 1 000.00 |
| Outstanding balance after the deposit | 2 900.00 |

Reconciliation identities asserted everywhere: `agreed_amount = base_amount = final_amount` for historical
bookings, and cumulative historical evidence never exceeds `agreed_amount`. No owner/KAZA split is invented.

---

## P12. Test-data setup procedure

1. Restore `E-STG` / `E-UAT` from the sanitized snapshot and record the snapshot label in the run sheet.
2. Apply migrations forward with `scripts/apply-migrations.sh`; run every paired `_verify.sql`.
   `CONFIRMED` — migrations are raw SQL under `db/migrations/NNNN_name.sql` with `_verify` and usually
   `_rollback` companions; there is no EF Core Migrations directory. Latest number present in the
   repository is `0057` (`0057_add_owner_contact_fields.sql`).
3. Seed the RBAC rows: the two new permission keys, their role-template assignments, and the `A-DENY`
   user-level `deny` override.
4. Seed admin users `A-HIST`, `A-HIST-CORR`, `A-PLAIN`, `A-READONLY`, `A-FIN`, `A-DENY`, `A-OTHER-PF`.
5. Seed owners `O-ALPHA`, `O-BETA`, `O-GAMMA`, `O-DELTA` with the commission rates in [P7](#p7-required-owners).
6. Seed units per [P6](#p6-required-units), including the seasonal-pricing rows on `U-SEASONAL-1` and the
   `DateBlock` on `U-BLOCKED-1`.
7. Seed clients per [P8](#p8-required-clients); confirm `C-NEW-1` is genuinely absent.
8. Seed the overlap corpus on `U-BUSY-1`: one `Completed`, one `LeftEarly`, one `Cancelled` and one
   `NotRelevant` booking, each with explicitly chosen dates so the five overlap shapes in
   `SC-AVAIL-02 … 06` are constructible.
9. Seed the payout corpus per [P9](#p9-required-payout-states).
10. Seed `U-VOLUME-1`'s ≥ 5 000-row booking corpus for `SC-PERF-02` (bulk insert, not through the API).
11. Capture the baseline counters listed in [P15](#p15-evidence-collection) **before** the first scenario.
12. Freeze the fixture set. Any scenario that mutates a shared fixture must state it in its Cleanup row.

---

## P13. Test-data cleanup procedure

`CONFIRMED` — `BookingsController.cs` exposes `GET`, `GET {id}`, `GET {id}/status-history`, `POST`,
`POST quick` and `PUT {id}` at lines `32,68,81,97,118,139`. **There is no booking deletion endpoint.**
Combined with the append-only audit design (ADR-04), individual scenario "undo" is not possible through the
product surface.

| Level | Procedure |
|---|---|
| **Per scenario** | Record the created identifiers in the run sheet. Do **not** delete rows by hand — hand-deletion invalidates the audit assertions of later scenarios and can orphan payout or payment rows |
| **Per group** | Restore the group's baseline counters by re-reading them; if a group left the fixture set dirty in a way a later group depends on, restore the snapshot |
| **Per suite** | Restore the environment from the pre-suite snapshot. This is the only supported full reset |
| **Rejection scenarios** | No cleanup required; the assertion is precisely that nothing was written |
| **Production** | No cleanup, because no write scenario runs there ([P14](#p14-production-smoke-restrictions)) |

---

## P14. Production smoke restrictions

Only these read-only checks may run against `E-PROD` after deploy, and only by an operator holding the
relevant permission:

1. `H-CREATE` returns `403` (not `404`, not `500`) for a principal lacking `bookings:record_historical`.
2. The historical wizard entry point is **absent** for a user without the permission and **present** for a
   pilot user.
3. `GET /api/internal/bookings` filtered to `is_historical = true` returns the expected pilot rows and nothing else.
4. The metrics named in [Master §23](00_MASTER_PLAN.md#23-observability) are being scraped.
5. The daily reconciliation query (historical count and value by stay month versus recorded month) runs and
   returns a result.

No production scenario may create, update, or delete any row.

---

## P15. Evidence collection

Every executed scenario produces a run-sheet row: scenario ID, environment, executor, timestamp (UTC and
Cairo), result, and the evidence artefacts below.

| Artefact | How captured | Required for |
|---|---|---|
| HTTP request/response pair, headers redacted | API client export or Playwright network log | Every API scenario |
| `bookings` row dump for the created id (all columns) | `SELECT` by id, attached as CSV | Every creation scenario |
| `booking_status_history` rows for the created id | via `B-HISTORY` **and** direct `SELECT` | Every audit scenario |
| `payments` rows for the created id | direct `SELECT` | Every payment scenario |
| `owner_payouts` before/after counts and statuses | direct `SELECT` | Every owner scenario |
| Notification-table count before and after | direct `SELECT COUNT(*)` | Every notification scenario |
| Portal screenshot (light theme, reduced motion) | Playwright | Every UI scenario |
| Report/view output before and after | direct `SELECT` against the view | Every reporting scenario |
| Structured application log slice, correlation id | container logs from `remal-api` | Every failure |
| Metric sample | scrape endpoint snapshot | `SC-PERF-04` |

**No real guest PII may appear in any artefact.** Sanitized fixtures only; redact phone and email in
screenshots.

**Automation harness reality check** (`CONFIRMED`): backend tests live in `RentalPlatform.Tests` (xUnit,
33 passing, EF Core InMemory fixtures — `BookingHistoryCreatorTests.cs`, `CrmRecommendationLeadTests.cs`,
`PublicUnitCatalogTests.cs`). Frontend tests are Playwright only
(`rental-platform/playwright.crm.config.ts`, with suites under `rental-platform/tests/` including
`admin-smoke`, `booking-history`, `client-smoke`, `crm-ui`, `owner-smoke`); there is no vitest/jest/RTL in
`rental-platform`. `demo` has vitest-style unit tests (`demo/src/lib/booking/guest-count.test.ts`).
Automation candidacy in each scenario names the intended harness on that basis.

---

## P16. Canonical contract and decided behaviour

**P16.1 The canonical endpoint.** Every scenario in this pack exercises exactly one historical write
contract, restated from [Master §12.1](00_MASTER_PLAN.md#121-the-canonical-historical-contract):

| Property | Value |
|---|---|
| Method and route | `POST /api/internal/bookings/historical` (shorthand `H-CREATE`) |
| Success status | `200 OK` with the `ApiResponse<T>` envelope — `CONFIRMED` at `BookingsController.cs:114,135`; this API never returns `201` |
| Policy | `bookings:record_historical` |

Older drafts of this pack used `/api/bookings/historical` and `201 Created`. Both are retired. A scenario
asserting either is a defect in the scenario, not in the implementation.

**P16.2 Two behaviours were open and are now decided.** Both are `OWNER APPROVED` in the
[decision record](DECISION_RATIFICATION_PACKET.md). The scenarios below are written against the decided
behaviour. They are listed so that, if a revisit trigger fires and a decision changes, the affected records
are re-baselined rather than quietly left wrong.

| Decision | Decided behaviour the scenarios assert | Scenarios that would change if it is revisited |
|---|---|---|
| [D-INV-01](DECISION_RATIFICATION_PACKET.md#d-inv-01--invoice-policy) invoice policy | Historical commands create no invoice automatically; manual draft/issuance remains allowed; historical evidence always stays unlinked | `SC-NOTIF-04`, `SC-NOTIF-05`, `SC-REP-02`, `SC-REP-06`, `SC-FIN-01` |
| [D-PAY-01](DECISION_RATIFICATION_PACKET.md#d-pay-01--historical-payment-policy) payment policy | Payment is recorded by a **separate privileged command**, never inline; booking and payment are not atomic together | All of Group 7 (`SC-PAY-01`…`SC-PAY-10`), plus `SC-HAPPY-02`, `SC-HAPPY-03`, `SC-TXN-03` |

**Binding Group 7 command boundary.** Every payment scenario first creates or selects an existing historical
booking and then calls HB-04B with its own permission, idempotency key, transaction and audit. Booking success
is never rolled back by a later payment-command failure.

---

## Group 1 — Happy path (`SC-HAPPY-nn`)

#### SC-HAPPY-01 — Canonical late entry: agreed day 1, stay days 2–5, recorded day 10, no payment

| | |
|---|---|
| **Priority · Category · Automate** | P0 · Happy path · YES (xUnit service + Playwright E2E) |
| **Traceability** | REQ-01, REQ-02, REQ-03, REQ-04, REQ-12, REQ-19 · HB-02 · INV-01, INV-02, INV-05, INV-11 |
| **Preconditions** | `A-HIST` signed in; `U-ACTIVE-1` free for `STAY-IN … STAY-OUT`; `C-EXISTING-1` present; baseline counters captured |
| **Test data** | unit `U-ACTIVE-1`; client `C-EXISTING-1`; `check_in = STAY-IN`, `check_out = STAY-OUT`; `actual_booked_at = AGREED-AT`; `historical_entry_reason = offline_agreement`; `original_source = offline_record`; `guest_count = 2`; `agreed_amount = 3900.00`; no payment |
| **Steps** | 1. Open the historical wizard. 2. Step 1: source `offline_record`, agreement date `AGREED-AT`, reason `offline_agreement`. 3. Step 2: pick `U-ACTIVE-1`, dates `STAY-IN`/`STAY-OUT`, 2 guests. 4. Step 3: select `C-EXISTING-1`. 5. Step 4: agreed amount `3900.00`. 6. Step 5: review owner-attribution policy; make no owner call. 7. Step 6: submit. 8. After `200`, review persisted attribution with the returned booking ID. |
| **Expected — UI** | Wizard advances only when each step validates; step 6 lists all five mandatory warnings; on success booking identity remains authoritative while owner review loads or fails independently; no review outcome returns to draft |
| **Expected — API** | `200 OK` from `H-CREATE`, then HB-05 GET with the returned booking ID; body contains the booking id, `isHistorical: true`, `bookingStatus: "Completed"`, `actualBookedAt`, `historicalEntryReason`, `originalSource` |
| **Expected — DB** | Exactly one new `bookings` row: `booking_status = 'completed'`, `is_historical = true`, `actual_booked_at = AGREED-AT`, `historical_entry_reason = 'offline_agreement'`, `original_source = 'offline_record'`, `owner_id = O-ALPHA`, dates as entered. `created_at` and `updated_at` are within 60 s of real UTC now — **not** `AGREED-AT` |
| **Expected — Audit** | Exactly **one** `booking_status_history` row: `old_status = NULL`, `new_status = 'completed'`, `changed_by_admin_user_id = A-HIST`, `changed_at ≈ now`, note = the historical-creation constant. Audit event `booking.historical.recorded` emitted |
| **Expected — Financial** | `agreed_amount = base_amount = final_amount = 3900.00`; no invoice or payment is created automatically; outstanding evidence balance = 3 900.00 |
| **Expected — Owner** | `owner_id = O-ALPHA`; no commission/split snapshot and no payout row is fabricated |
| **Expected — Notification** | Notification-table count **unchanged**. No client message, no admin alert. Structurally guaranteed: creation has no dispatch path (F-04) and `TransitionAsync` is never called |
| **Expected — Reporting** | Occupancy for `U-ACTIVE-1` gains nights `STAY-IN … STAY-OUT − 1`. Booking and finance daily summary views attribute the row to `DATE(created_at)` = today unless the stay-period dimension (ADR-11) is applied; both figures must be derivable |
| **Cleanup** | Record the booking id; no per-scenario undo (no delete endpoint). Suite-level snapshot restore |
| **Diagnostics** | Full booking row, history rows, `remal-api` log slice for the correlation id, request/response pair, notification counts before and after |

#### SC-HAPPY-02 — Booking followed by a separate cash-evidence command

| | |
|---|---|
| **Priority · Category · Automate** | P0 · Happy path · YES (xUnit service + Playwright E2E) |
| **Traceability** | REQ-01, REQ-06, REQ-14, REQ-19 · HB-02, HB-04 · INV-02, INV-05, INV-06 |
| **Preconditions** | As `SC-HAPPY-01` |
| **Test data** | As `SC-HAPPY-01` **plus** payment: `amount = 1000.00`, `method = cash`, `paid_at = PAID-AT`, `reference_number = "RCPT-TEST-001"`, `payment_status = paid` |
| **Steps** | 1. Complete `SC-HAPPY-01`. 2. If authorized for payments, submit HB-04B with `cash`, `1000.00`, `PAID-AT`, reason and reference using a distinct idempotency key. |
| **Expected — UI** | Booking success appears first; payment evidence is an optional second phase and displays a running remaining amount of `2 900.00` |
| **Expected — API** | Booking `200 OK`, followed by payment `200 OK`; each response has its own persisted identity |
| **Expected — DB** | One booking commit followed by one immutable historical payment commit. Payment `paid_at = PAID-AT`, `invoice_id = NULL`, `created_at ≈ now`, `created_by_admin_user_id = A-HIST` |
| **Expected — Audit** | One creation history row and one later `HistoricalPaymentRecorded` link; actor is trusted in each command |
| **Expected — Financial** | `agreed_amount = final_amount = 3900.00`; historical evidence = 1 000.00; outstanding = 2 900.00 by `agreed_amount − Σ historical evidence` |
| **Expected — Owner** | Unchanged from `SC-HAPPY-01`; evidence does not alter attribution |
| **Expected — Notification** | Count unchanged. No payment notification exists in the codebase (F-04) and none must appear |
| **Expected — Reporting** | The payment appears in payment reporting at `PAID-AT` under ratified OQ-03; the booking still lands in today's `created_at` bucket |
| **Cleanup** | Snapshot restore at suite level |
| **Diagnostics** | Booking and payment rows, transaction log, balance computation trace |

#### SC-HAPPY-03 — Fully settled historical booking with two payments

| | |
|---|---|
| **Priority · Category · Automate** | P0 · Happy path · YES (xUnit service) |
| **Traceability** | REQ-06, REQ-14 · HB-04 · INV-05, INV-13 |
| **Preconditions** | As `SC-HAPPY-01` |
| **Test data** | Agreed `3900.00`; payment A `cash 1000.00 @ PAID-AT`; payment B `bank_transfer 2900.00 @ D0 − 6 14:00` with reference `TRX-TEST-002` |
| **Steps** | 1. Complete `SC-HAPPY-01`. 2. Submit two separate HB-04B commands with distinct idempotency keys. |
| **Expected — UI** | Each payment is a post-booking step; the remaining amount reaches `0.00` after the second success |
| **Expected — API** | Booking `200`, then two payment `200` responses |
| **Expected — DB** | One booking transaction followed by two payment transactions; both `paid_at` values preserved distinctly and both `invoice_id` values null |
| **Expected — Audit** | One creation history row and two distinct `HistoricalPaymentRecorded` links |
| **Expected — Financial** | Σ paid = 3 900.00; outstanding = 0.00 |
| **Expected — Owner** | Attribution unchanged; no payout is created or modified |
| **Expected — Notification** | Count unchanged; specifically **no** `BOOKING_COMPLETED_WITH_BALANCE` alert, which is emitted only by `AutoCompleteBookingsJob.cs:145-221` for bookings the job itself completes |
| **Expected — Reporting** | Finance daily summary counts both payments at their `paid_at` dates |
| **Cleanup** | Snapshot restore |
| **Diagnostics** | Both payment rows, balance recomputation, notification delta |

#### SC-HAPPY-04 — Historical booking on an inactive-but-not-deleted unit

| | |
|---|---|
| **Priority · Category · Automate** | P0 · Happy path · YES (xUnit service) |
| **Traceability** | REQ-17 · HB-03 · INV-04 (ADR-12) |
| **Preconditions** | `U-INACTIVE-1` has `is_active = false`, `deleted_at IS NULL` |
| **Test data** | unit `U-INACTIVE-1`; dates `STAY-IN`/`STAY-OUT`; agreed `3600.00`; client `C-EXISTING-1` |
| **Steps** | 1. In step 2, enable "include retired units" in the unit picker. 2. Select `U-INACTIVE-1`. 3. Complete and submit. |
| **Expected — UI** | The unit appears with an explicit "Retired" badge and an inline note that it is selectable for historical entry only |
| **Expected — API** | `200 OK` — **not** `400`. This is the deliberate divergence from the normal flow (`BookingService.cs:156-165`, `UnitAvailabilityService.cs:33-34`) |
| **Expected — DB** | Booking row created against the inactive unit; the unit row is **not** modified (still `is_active = false`) |
| **Expected — Audit** | One status-history row; the audit event records that an inactive unit was used |
| **Expected — Financial** | Agreed amount honoured; a reference price may be unavailable or stale for a retired unit, and that must not block creation |
| **Expected — Owner** | `owner_id` from the retired unit owner; no financial split inferred |
| **Expected — Notification** | Count unchanged |
| **Expected — Reporting** | The retired unit reappears in occupancy history for the stay window; it must **not** reappear in future availability |
| **Cleanup** | Snapshot restore; verify `U-INACTIVE-1` is still inactive |
| **Diagnostics** | Unit row before and after, availability path trace showing which check was bypassed and why |

#### SC-HAPPY-05 — Inline creation of a new client during historical entry

| | |
|---|---|
| **Priority · Category · Automate** | P1 · Happy path · YES (Playwright E2E) |
| **Traceability** | REQ-01, REQ-19 · HB-02 · INV-05 |
| **Preconditions** | `C-NEW-1` genuinely absent |
| **Test data** | New client: sanitized name, phone `+20100 000 0099`, no email; unit `U-ACTIVE-1`; agreed `3900.00` |
| **Steps** | 1. Step 3: search for the phone, get no match. 2. Choose "create new client". 3. Complete and submit. |
| **Expected — UI** | The no-match state is explicit, not an empty dropdown; the create-client sub-form validates inline |
| **Expected — API** | `200 OK`; response carries the new client id |
| **Expected — DB** | One new `clients` row **and** one `bookings` row in the **same** transaction; if creation fails after the client insert, neither persists |
| **Expected — Audit** | One booking status-history row; client creation attributed to `A-HIST` |
| **Expected — Financial** | As `SC-HAPPY-01` |
| **Expected — Owner** | As `SC-HAPPY-01` |
| **Expected — Notification** | Count unchanged; no welcome or onboarding message |
| **Expected — Reporting** | New-client counts increase in the recorded-date bucket, not the stay bucket |
| **Cleanup** | Snapshot restore |
| **Diagnostics** | Client row, booking row, transaction boundary evidence and normalized-phone identity per [P8](#p8-required-clients) |

#### SC-HAPPY-06 — Separate authorized owner-attribution correction

| | |
|---|---|
| **Priority · Category · Automate** | P0 · Happy path · YES (xUnit service + Playwright E2E) |
| **Traceability** | REQ-07, REQ-08 · HB-05 · INV-12, INV-14, INV-17 |
| **Preconditions** | `A-HIST-CORR` signed in; a historical booking is attributed to `O-ALPHA`; no payout exists; an offline-reviewed fact supports `O-DELTA` |
| **Test data** | Target `O-DELTA`; reason `ownership_changed_after_stay`; unique correction key |
| **Steps** | 1. Create the booking normally. 2. Open the read-only owner review. 3. Submit the separate correction command with reason. |
| **Expected — UI** | Creation has no owner override control. The later correction surface appears only with `bookings:correct_owner_attribution` and shows stable before/after IDs without a financial split |
| **Expected — API** | Booking `200`, then correction `200` from the canonical HB-05 endpoint |
| **Expected — DB** | `owner_id = O-DELTA`; exactly one immutable correction row; no owner fields are added to the creation payload |
| **Expected — Audit** | Original creation history plus one `HistoricalOwnerAttributionCorrected` link; correction row carries previous/target IDs, trusted actor and reason |
| **Expected — Financial** | `agreed_amount = base_amount = final_amount = 3900.00`; payments, invoices and payouts unchanged |
| **Expected — Owner** | Attribution is `O-DELTA`; no commission or owner/KAZA split is inferred |
| **Expected — Notification** | Count unchanged; no owner notification |
| **Expected — Reporting** | Owner-attributed agreed amount moves to `O-DELTA`, not `O-ALPHA`, in both the stay and recorded dimensions; no commission share is inferred |
| **Cleanup** | Snapshot restore |
| **Diagnostics** | Booking row, correction chain, permission claim and before/after side-effect counts |

#### SC-HAPPY-07 — Long historical stay crossing a month boundary with seasonal price divergence

| | |
|---|---|
| **Priority · Category · Automate** | P1 · Happy path · YES (xUnit service) |
| **Traceability** | REQ-05, REQ-18 · HB-04, HB-08 · INV-13, INV-15 |
| **Preconditions** | `U-SEASONAL-1` has `SeasonalPricing` rows covering part of the stay window so the live reference price differs materially from the agreed amount |
| **Test data** | unit `U-SEASONAL-1`; `check_in = D0 − 40`, `check_out = D0 − 26` (14 nights spanning a month boundary); agreed `15000.00`; reference computed from live seasonal rows (expected ≠ 15 000.00) |
| **Steps** | 1. Enter the long window. 2. Observe the reference-only current price. 3. Enter the agreed amount. 4. Submit. |
| **Expected — UI** | Any current-price reference is visually subordinate and explicitly not used for the record; it never pre-fills or rewrites the agreed amount |
| **Expected — API** | `200 OK`; the canonical response returns the persisted agreed truth and does not add a `referenceAmount` contract |
| **Expected — DB** | `agreed_amount = base_amount = final_amount = 15000.00`; no current or seasonal price is persisted as historical truth |
| **Expected — Audit** | One status-history row records the agreed truth; no invented reference-price audit field exists |
| **Expected — Financial** | `final_amount` follows the agreed amount, never the seasonal computation (`CalculatePricingAsync` at `UnitAvailabilityService.cs:125-169` is advisory here) |
| **Expected — Owner** | Attribution remains `O-ALPHA`; no commission or owner/KAZA split is inferred |
| **Expected — Notification** | Count unchanged |
| **Expected — Reporting** | The stay-period dimension splits the nights across two calendar months; the recorded-period dimension places the whole record in today's bucket. Both must reconcile to the same total |
| **Cleanup** | Snapshot restore |
| **Diagnostics** | Seasonal rows in force prove current pricing differs; persisted values and month-axis reporting still derive from the agreed truth |

---

## Group 2 — Date validation (`SC-DATE-nn`)

#### SC-DATE-01 — Checkout yesterday (Cairo) is accepted by the historical flow

| | |
|---|---|
| **Priority · Category · Automate** | P0 · Date validation · YES (xUnit unit + service) |
| **Traceability** | REQ-01, REQ-16 · HB-01, HB-02 · INV-03 (ADR-03) |
| **Preconditions** | `A-HIST` signed in; `U-ACTIVE-1` free |
| **Test data** | `check_in = D0 − 3`, `check_out = EDGE-OUT-YDAY (D0 − 1)`; agreed `3000.00` |
| **Steps** | 1. Submit `H-CREATE` with those dates. |
| **Expected — UI** | The date control permits the selection; no boundary warning |
| **Expected — API** | `200 OK`. This is the **last allowed** checkout date: `check_out <= DateOnly.FromDateTime(cairoNow).AddDays(-1)` (`AutoCompleteBookingsJob.cs:70`) |
| **Expected — DB** | Booking created with `booking_status = 'completed'` |
| **Expected — Audit** | One status-history row |
| **Expected — Financial** | Agreed amount honoured |
| **Expected — Owner** | Default attribution |
| **Expected — Notification** | Count unchanged |
| **Expected — Reporting** | Occupancy gains nights `D0 − 3 … D0 − 2` |
| **Cleanup** | Snapshot restore |
| **Diagnostics** | Server-resolved `D0`, the boundary expression inputs and output, the request timestamp in UTC and Cairo |

#### SC-DATE-02 — Ongoing stay (started in the past, not yet ended) is rejected

| | |
|---|---|
| **Priority · Category · Automate** | P0 · Date validation · YES (xUnit service) |
| **Traceability** | REQ-01 · HB-02 · INV-03 (ADR-02) |
| **Preconditions** | `A-HIST` signed in |
| **Test data** | `check_in = D0 − 2`, `check_out = D0 + 2` |
| **Steps** | 1. Submit `H-CREATE`. |
| **Expected — UI** | The wizard blocks submission at step 2 with copy explaining that only completed stays can be recorded in v1 |
| **Expected — API** | `400` with code `HISTORICAL_CHECKOUT_NOT_COMPLETED` |
| **Expected — DB** | No row written anywhere |
| **Expected — Audit** | n/a — nothing is created, so there is no booking event to audit; the rejection is logged, not audited |
| **Expected — Financial** | n/a — rejection precedes any financial write |
| **Expected — Owner** | n/a — rejection precedes owner resolution |
| **Expected — Notification** | Count unchanged |
| **Expected — Reporting** | Counter `historical_booking_rejected_total{reason="not_complete"}` increments |
| **Cleanup** | None required |
| **Diagnostics** | Resolved `D0`, submitted dates, rejection branch taken. Cross-reference [OQ-04](00_MASTER_PLAN.md#32-open-questions) — ongoing stays are a deferred v2 question, not a defect |

#### SC-DATE-03 — Wholly future stay is rejected by the historical flow

| | |
|---|---|
| **Priority · Category · Automate** | P0 · Date validation · YES (xUnit service) |
| **Traceability** | REQ-01, REQ-16 · HB-02 · INV-03 |
| **Preconditions** | `A-HIST` signed in |
| **Test data** | `check_in = FUT-IN`, `check_out = FUT-OUT` |
| **Steps** | 1. Submit `H-CREATE`. |
| **Expected — UI** | Blocked at step 2; the message routes the operator to the **normal** booking flow |
| **Expected — API** | `400 HISTORICAL_CHECKOUT_NOT_COMPLETED` |
| **Expected — DB** | No row written |
| **Expected — Audit** | n/a — no entity created |
| **Expected — Financial** | n/a — no financial write |
| **Expected — Owner** | n/a — no owner resolution |
| **Expected — Notification** | Count unchanged |
| **Expected — Reporting** | Rejection counter increments |
| **Cleanup** | None |
| **Diagnostics** | Submitted dates versus resolved `D0`; confirm the same request succeeds against `N-CREATE`, proving the two flows are complementary rather than overlapping |

#### SC-DATE-04 — Checkout **today** (Cairo) is not yet complete and is rejected

| | |
|---|---|
| **Priority · Category · Automate** | P0 · Date validation · YES (xUnit unit) |
| **Traceability** | REQ-01 · HB-02 · INV-03 (ADR-03) |
| **Preconditions** | `A-HIST` signed in |
| **Test data** | `check_in = D0 − 3`, `check_out = EDGE-OUT-TODAY (D0)` |
| **Steps** | 1. Submit `H-CREATE`. |
| **Expected — UI** | Blocked, with copy stating the stay is not finished until the checkout day has fully passed |
| **Expected — API** | `400 HISTORICAL_CHECKOUT_NOT_COMPLETED` |
| **Expected — DB** | No row written |
| **Expected — Audit** | n/a — nothing created |
| **Expected — Financial** | n/a — rejection precedes any financial write |
| **Expected — Owner** | n/a — rejection precedes owner resolution |
| **Expected — Notification** | Count unchanged |
| **Expected — Reporting** | Rejection counter increments with `reason="not_complete"` |
| **Cleanup** | None |
| **Diagnostics** | The evaluated cutoff. **This is the pivotal boundary assertion of the pack**: it proves the historical flow uses the platform's own definition (`AutoCompleteBookingsJob.cs:70` leaves such a booking in `CheckIn`) rather than an invented one |

#### SC-DATE-05 — Checkout before or equal to check-in is rejected

| | |
|---|---|
| **Priority · Category · Automate** | P0 · Date validation · YES (xUnit unit + API contract) |
| **Traceability** | REQ-01 · HB-01, HB-02 · INV-03 |
| **Preconditions** | `A-HIST` signed in |
| **Test data** | Case A `check_in = D0 − 5`, `check_out = D0 − 8`. Case B `check_in = check_out = D0 − 5` |
| **Steps** | 1. Submit case A to `H-CREATE`. 2. Submit case B. 3. Repeat both against `N-CREATE`. |
| **Expected — UI** | The checkout control has `min = check_in + 1`; manual entry is rejected inline |
| **Expected — API** | `400 VALIDATION_ERROR` in all four submissions |
| **Expected — DB** | No row written. Defence in depth: even if the service were bypassed, `ck_bookings_valid_stay_range CHECK (check_out_date > check_in_date)` (`db/migrations/0016_create_bookings.sql:26`) refuses the insert |
| **Expected — Audit** | n/a — nothing created |
| **Expected — Financial** | n/a — rejection precedes any financial write |
| **Expected — Owner** | n/a — rejection precedes owner resolution |
| **Expected — Notification** | Count unchanged |
| **Expected — Reporting** | No reporting effect |
| **Cleanup** | None |
| **Diagnostics** | Which layer rejected — validator, `ValidateStayDates` (`BookingService.cs:463-467`), or the CHECK constraint. All three should be provably capable of it |

#### SC-DATE-06 — Check-in today / checkout tomorrow: allowed normally, rejected historically

| | |
|---|---|
| **Priority · Category · Automate** | P1 · Date validation · YES (xUnit service) |
| **Traceability** | REQ-01, REQ-16 · HB-01, HB-02 · INV-03 |
| **Preconditions** | Both `A-HIST` and `A-PLAIN` available |
| **Test data** | `check_in = D0`, `check_out = D0 + 1` |
| **Steps** | 1. Submit to `H-CREATE` as `A-HIST`. 2. Submit the same dates to `N-CREATE` as `A-PLAIN`. |
| **Expected — UI** | The historical wizard blocks; the normal booking form accepts |
| **Expected — API** | Step 1 → `400 HISTORICAL_CHECKOUT_NOT_COMPLETED`. Step 2 → `200 OK` (same-day check-in remains legal under the D-02 recommended default in [HB-01 §10](01_TICKET_DISCOVERY_AND_ARCHITECTURE_DECISIONS.md#10-decisions)) |
| **Expected — DB** | Exactly one booking row, created by step 2, with `is_historical = false` |
| **Expected — Audit** | Step 2 writes the ordinary `BookingCreated` history row with the caller's starting status |
| **Expected — Financial** | Step 2 prices from live pricing, exactly as today |
| **Expected — Owner** | Step 2 snapshots `unit.OwnerId` per `BookingService.cs:225` |
| **Expected — Notification** | Count unchanged for both — creation triggers no notification (F-04) |
| **Expected — Reporting** | Step 2's booking is an ordinary booking in every report |
| **Cleanup** | Snapshot restore |
| **Diagnostics** | Both responses side by side. This is the clearest demonstration that hardening (D-02) does not break same-day operations |

#### SC-DATE-07 — Cairo midnight boundary is evaluated once, server-side

| | |
|---|---|
| **Priority · Category · Automate** | P0 · Date validation · YES (xUnit unit with an injected clock) |
| **Traceability** | REQ-01, REQ-16 · HB-01, HB-02 · INV-03 (RISK-08) |
| **Preconditions** | The Cairo business-date resolver is injectable per [HB-01 §11.2.1](01_TICKET_DISCOVERY_AND_ARCHITECTURE_DECISIONS.md#112-normal-flow-hardening--specification) |
| **Test data** | Clock at `23:59:59` Cairo on day *X*, then `00:00:01` Cairo on day *X + 1* |
| **Steps** | 1. With the clock at `23:59:59` on day *X*, submit `check_out = X − 1` (expect accept) and `check_out = X` (expect reject). 2. Advance the clock past midnight. 3. Resubmit `check_out = X` (now expect accept). 4. Assert the boundary is read exactly once per request. |
| **Expected — UI** | n/a — a server-clock scenario; the UI cannot demonstrate it deterministically |
| **Expected — API** | Step 1 accept then reject; step 3 `200 OK`; no request produces a half-evaluated result |
| **Expected — DB** | Two bookings created across the scenario (steps 1a and 3); none from the rejected calls |
| **Expected — Audit** | One history row per created booking |
| **Expected — Financial** | Agreed amounts honoured |
| **Expected — Owner** | Default attribution |
| **Expected — Notification** | Count unchanged |
| **Expected — Reporting** | The two bookings land in different `created_at` day buckets — assert explicitly; it is the reporting consequence of the boundary |
| **Cleanup** | Reset the injected clock; snapshot restore |
| **Diagnostics** | Invocation count of the resolver per request (must be 1), the resolved value, and the UTC↔Cairo offset in force |

#### SC-DATE-08 — DST transition inside the stay window has no effect

| | |
|---|---|
| **Priority · Category · Automate** | P1 · Date validation · YES (xUnit unit) |
| **Traceability** | REQ-01 · HB-01, HB-02 · INV-02 |
| **Preconditions** | A stay window containing an Egyptian DST transition date |
| **Test data** | `check_in`/`check_out` straddling the transition; a `paid_at` timestamp on the transition day |
| **Steps** | 1. Record a historical booking spanning the transition. 2. Read the row back. 3. Compute the night count. 4. Read the payment `paid_at` back. |
| **Expected — UI** | Night count displayed matches the naive date difference; no off-by-one |
| **Expected — API** | `200 OK`; returned dates identical to those submitted |
| **Expected — DB** | `check_in_date`/`check_out_date` identical to input — they are `DATE`, so no conversion occurs (`Booking.cs:15-16`) |
| **Expected — Audit** | One history row; `changed_at` is UTC and unaffected |
| **Expected — Financial** | Nightly count = `check_out − check_in`, unaffected by the transition |
| **Expected — Owner** | Snapshot unaffected |
| **Expected — Notification** | Count unchanged |
| **Expected — Reporting** | Occupancy night count matches; no duplicated or missing night at the transition |
| **Cleanup** | Snapshot restore |
| **Diagnostics** | Submitted versus stored dates, night-count arithmetic, the `TimeZoneInfo` adjustment rule in force. Note the residual `INFERRED` label on DST handling in [Master §10](00_MASTER_PLAN.md#10-date-and-timezone-model) |

#### SC-DATE-09 — Client sends a timezone-qualified datetime instead of a date

| | |
|---|---|
| **Priority · Category · Automate** | P1 · Date validation · YES (API contract test) |
| **Traceability** | REQ-01, REQ-02 · HB-02 · INV-01, INV-02 |
| **Preconditions** | Direct API access, bypassing the wizard |
| **Test data** | `checkInDate = "2026-07-20T23:00:00-05:00"`, `checkOutDate = "2026-07-23T01:00:00+09:00"`, `actualBookedAt = "2026-07-19T22:30:00Z"`, plus a `createdAt` field that must be ignored |
| **Steps** | 1. POST the payload to `H-CREATE`. 2. Read the stored row. |
| **Expected — UI** | n/a — the portal always sends plain dates; this scenario targets hostile or naive API clients |
| **Expected — API** | Either `400 VALIDATION_ERROR` for a non-date value, **or** `200` with server-authoritative coercion to `DateOnly`. The contract must pick one and document it. A silent timezone shift that changes the calendar day is a **failure** either way |
| **Expected — DB** | If accepted: `check_in_date = 2026-07-20`, `check_out_date = 2026-07-23`, matching the literal date parts. `created_at` is server time; the client-supplied `createdAt` is discarded |
| **Expected — Audit** | `changed_at` is server UTC, never client-supplied |
| **Expected — Financial** | Night count derived from the coerced dates |
| **Expected — Owner** | Default attribution |
| **Expected — Notification** | Count unchanged |
| **Expected — Reporting** | The booking appears on the coerced stay dates, not offset-shifted ones |
| **Cleanup** | Snapshot restore |
| **Diagnostics** | Raw request body, model-binding result, stored values. Any divergence between the literal date part and the stored date is a P0 defect |

#### SC-DATE-10 — Agreement date must precede the stay and must not be in the future

| | |
|---|---|
| **Priority · Category · Automate** | P1 · Date validation · YES (xUnit unit) |
| **Traceability** | REQ-03, REQ-04 · HB-02 · INV-02 |
| **Preconditions** | `A-HIST` signed in |
| **Test data** | Case A `actual_booked_at = D0 + 1`. Case B `actual_booked_at = D0 − 2` with `check_in = D0 − 8` (agreed after the stay started). Case C `actual_booked_at = AGREED-AT` (valid control) |
| **Steps** | 1. Submit each case to `H-CREATE`. |
| **Expected — UI** | The agreement-date control caps at `D0` and warns when the date falls after check-in |
| **Expected — API** | A → `400 VALIDATION_ERROR`. B → `400 VALIDATION_ERROR`. C → `200 OK` |
| **Expected — DB** | Only case C persists |
| **Expected — Audit** | Case C writes one history row with the agreement date recorded in the audit event |
| **Expected — Financial** | n/a for A and B — rejected before any financial write; C behaves as `SC-HAPPY-01` |
| **Expected — Owner** | n/a for A and B — rejected before owner resolution; default for C |
| **Expected — Notification** | Count unchanged |
| **Expected — Reporting** | Case C's agreement date is available as a reporting attribute distinct from both the stay and recorded dimensions |
| **Cleanup** | Snapshot restore |
| **Diagnostics** | Which case produced which code. **Settled — hard `400 VALIDATION_ERROR`, naming both dates** ([D-HB02-08](02_TICKET_HISTORICAL_BOOKING_DOMAIN_AND_API.md#101-ratified-decisions)). A booking agreed mid-stay is overwhelmingly a typo, and accepting it silently corrupts the agreement-date dimension Finance reconciles against. Revisited only if Operations produces a real counter-example |

---

## Group 3 — Availability and conflicts (`SC-AVAIL-nn`)

> The defect these scenarios exist to catch: `Completed` and `LeftEarly` are absent from every current
> conflict set (`BookingStatusTransitions.cs:39,44,46-53`; `UnitAvailabilityService.cs:48-74`), so without
> HB-03's dedicated historical conflict set two completed stays on the same unit and dates both succeed.

#### SC-AVAIL-01 — No conflict: clear window

| | |
|---|---|
| **Priority · Category · Automate** | P0 · Availability · YES (xUnit service) |
| **Traceability** | REQ-09, REQ-15 · HB-03 · INV-04 |
| **Preconditions** | `U-ACTIVE-1` has no booking or date block intersecting `STAY-IN … STAY-OUT` |
| **Test data** | unit `U-ACTIVE-1`; dates `STAY-IN`/`STAY-OUT` |
| **Steps** | 1. `H-CREATE` with the above. |
| **Expected — UI** | No conflict banner; review step proceeds |
| **Expected — API** | `200 OK` |
| **Expected — DB** | One booking row |
| **Expected — Audit** | One history row |
| **Expected — Financial** | As entered |
| **Expected — Owner** | Default `O-ALPHA` |
| **Expected — Notification** | Count unchanged |
| **Expected — Reporting** | Occupancy gains the nights |
| **Cleanup** | Snapshot restore |
| **Diagnostics** | Conflict-query SQL and its parameters |

#### SC-AVAIL-02 — Exact overlap against an existing **Completed** historical booking

| | |
|---|---|
| **Priority · Category · Automate** | **P0** · Availability · YES (xUnit + integration) |
| **Traceability** | REQ-09 · HB-03 · INV-04 |
| **Preconditions** | A historical booking already exists on `U-ACTIVE-1` for exactly `STAY-IN … STAY-OUT`, status `completed` |
| **Test data** | Identical unit and dates, **different** client `C-EXISTING-2` (so this is not a duplicate test) |
| **Steps** | 1. `H-CREATE` with the identical unit and dates. |
| **Expected — UI** | Inline, persistent conflict surface naming the conflicting dates — not a transient toast |
| **Expected — API** | `409 HISTORICAL_OVERLAP_CONFLICT` |
| **Expected — DB** | **No** second booking row. Count on `U-ACTIVE-1` for that window remains 1 |
| **Expected — Audit** | No new history row |
| **Expected — Financial** | Nothing written |
| **Expected — Owner** | Nothing written |
| **Expected — Notification** | Count unchanged |
| **Expected — Reporting** | Occupancy unchanged — no double-counted nights |
| **Cleanup** | Snapshot restore |
| **Diagnostics** | The conflict query, the status set it used, and the id of the blocking booking. **If this scenario passes today without HB-03, the test is wrong** — the current service cannot detect it |

#### SC-AVAIL-03 — Partial overlap at the start

| | |
|---|---|
| **Priority · Category · Automate** | P0 · Availability · YES (xUnit) |
| **Traceability** | REQ-09 · HB-03 · INV-04 |
| **Preconditions** | Completed booking on `U-ACTIVE-1` for `STAY-IN … STAY-OUT` |
| **Test data** | New stay `STAY-IN − 2 … STAY-IN + 1` |
| **Steps** | 1. `H-CREATE`. |
| **Expected — UI** | Conflict surface |
| **Expected — API** | `409 HISTORICAL_OVERLAP_CONFLICT` |
| **Expected — DB** | No new row |
| **Expected — Audit** | None |
| **Expected — Financial** | None |
| **Expected — Owner** | None |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | Unchanged |
| **Cleanup** | Snapshot restore |
| **Diagnostics** | Overlap predicate evaluation for each candidate night |

#### SC-AVAIL-04 — Partial overlap at the end

| | |
|---|---|
| **Priority · Category · Automate** | P0 · Availability · YES (xUnit) |
| **Traceability** | REQ-09 · HB-03 · INV-04 |
| **Preconditions** | Completed booking on `U-ACTIVE-1` for `STAY-IN … STAY-OUT` |
| **Test data** | New stay `STAY-OUT − 1 … STAY-OUT + 2` |
| **Steps** | 1. `H-CREATE`. |
| **Expected — UI** | Conflict surface |
| **Expected — API** | `409 HISTORICAL_OVERLAP_CONFLICT` |
| **Expected — DB** | No new row |
| **Expected — Audit** | None |
| **Expected — Financial** | None |
| **Expected — Owner** | None |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | Unchanged |
| **Cleanup** | Snapshot restore |
| **Diagnostics** | Overlap predicate evaluation |

#### SC-AVAIL-05 — Encompassing overlap

| | |
|---|---|
| **Priority · Category · Automate** | P0 · Availability · YES (xUnit) |
| **Traceability** | REQ-09 · HB-03 · INV-04 |
| **Preconditions** | Completed booking on `U-ACTIVE-1` for `STAY-IN … STAY-OUT` |
| **Test data** | New stay `STAY-IN − 3 … STAY-OUT + 3`, fully containing the existing one |
| **Steps** | 1. `H-CREATE`. |
| **Expected — UI** | Conflict surface |
| **Expected — API** | `409 HISTORICAL_OVERLAP_CONFLICT` |
| **Expected — DB** | No new row |
| **Expected — Audit** | None |
| **Expected — Financial** | None |
| **Expected — Owner** | None |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | Unchanged |
| **Cleanup** | Snapshot restore |
| **Diagnostics** | Overlap predicate evaluation |

#### SC-AVAIL-06 — Adjacent same-day turnover is **allowed**

| | |
|---|---|
| **Priority · Category · Automate** | **P0** · Availability · YES (xUnit) |
| **Traceability** | REQ-09, REQ-15 · HB-03 · INV-04 |
| **Preconditions** | Completed booking on `U-ACTIVE-1` checking out on day `D` |
| **Test data** | New stay checking **in** on day `D` |
| **Steps** | 1. `H-CREATE`. |
| **Expected — UI** | No conflict |
| **Expected — API** | `200 OK` |
| **Expected — DB** | Both bookings coexist |
| **Expected — Audit** | One history row for the new booking |
| **Expected — Financial** | As entered |
| **Expected — Owner** | Default |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | Occupancy counts day `D` **once**, not twice |
| **Cleanup** | Snapshot restore |
| **Diagnostics** | Boundary arithmetic. This asserts the documented semantics: the end parameter is the **last night** (`checkOut.AddDays(-1)`, `BookingService.cs:188-190`) and the predicate is `startDate < b.CheckOutDate && endDate >= b.CheckInDate` (`UnitAvailabilityService.cs:52`), so the checkout day is free. **A false conflict here would wrongly block legitimate turnover** |

#### SC-AVAIL-07 — Date block intersects the historical window

| | |
|---|---|
| **Priority · Category · Automate** | P1 · Availability · YES (xUnit) |
| **Traceability** | REQ-09, REQ-15 · HB-03 |
| **Preconditions** | `U-BLOCKED-1` has an active, non-deleted date block over `STAY-IN … STAY-OUT` |
| **Test data** | unit `U-BLOCKED-1`; dates `STAY-IN`/`STAY-OUT` |
| **Steps** | 1. `H-CREATE`. |
| **Expected — UI** | Conflict surface distinguishing a maintenance/operational block from a booking clash |
| **Expected — API** | `409` with the block reason (`date_blocked` precedence per `UnitAvailabilityService.cs:107`) |
| **Expected — DB** | No new row |
| **Expected — Audit** | None |
| **Expected — Financial** | None |
| **Expected — Owner** | None |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | Unchanged |
| **Cleanup** | Snapshot restore |
| **Diagnostics** | Only current approved, non-deleted overlapping blocks participate. Exact IDs must be acknowledged; stale, duplicate, wrong-unit, pending, rejected or deleted IDs are rejected |

#### SC-AVAIL-08 — Inactive but not deleted unit is **accepted**

| | |
|---|---|
| **Priority · Category · Automate** | **P0** · Availability · YES (xUnit + integration) |
| **Traceability** | REQ-17 · HB-03 · ADR-12 |
| **Preconditions** | `U-INACTIVE-1` has `IsActive = false`, `DeletedAt = null` |
| **Test data** | unit `U-INACTIVE-1`; dates `STAY-IN`/`STAY-OUT` |
| **Steps** | 1. `H-CREATE`. |
| **Expected — UI** | The unit picker offers retired units in the historical wizard, visibly marked as retired |
| **Expected — API** | `200 OK` |
| **Expected — DB** | Booking row created against the inactive unit |
| **Expected — Audit** | One history row |
| **Expected — Financial** | As entered |
| **Expected — Owner** | Snapshot from the inactive unit's owner |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | Occupancy recorded for the retired unit |
| **Cleanup** | Snapshot restore |
| **Diagnostics** | Confirm the historical path did **not** call the standard guard, which throws on `!unit.IsActive` (`UnitAvailabilityService.cs:33-34`) and requires `IsActive` (`BookingService.cs:156-165`) |

#### SC-AVAIL-09 — Soft-deleted unit is **rejected**

| | |
|---|---|
| **Priority · Category · Automate** | P0 · Availability · YES (xUnit) |
| **Traceability** | REQ-17 · HB-03 · ADR-12 |
| **Preconditions** | `U-DELETED-1` has `DeletedAt != null` |
| **Test data** | unit `U-DELETED-1` |
| **Steps** | 1. `H-CREATE`. |
| **Expected — UI** | The unit is not offered; a direct attempt shows a clear refusal |
| **Expected — API** | `400 UNIT_DELETED_UNSUPPORTED` |
| **Expected — DB** | No row |
| **Expected — Audit** | None |
| **Expected — Financial** | None |
| **Expected — Owner** | None |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | Unchanged |
| **Cleanup** | None needed |
| **Diagnostics** | Confirm soft-delete filtering is applied on the historical path |

#### SC-AVAIL-10 — Guest count exceeds unit capacity

| | |
|---|---|
| **Priority · Category · Automate** | P1 · Availability · YES (xUnit) |
| **Traceability** | REQ-15 · HB-03 |
| **Preconditions** | `U-ACTIVE-1.MaxGuests = 4` |
| **Test data** | `guest_count = 6` |
| **Steps** | 1. `H-CREATE`. |
| **Expected — UI** | Inline field error on the guest control |
| **Expected — API** | **`400`**, not `409` — capacity overflow is a validation failure (`BookingService.cs:184-186` raises `BusinessValidationException`) |
| **Expected — DB** | No row |
| **Expected — Audit** | None |
| **Expected — Financial** | None |
| **Expected — Owner** | None |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | Unchanged |
| **Cleanup** | None |
| **Diagnostics** | Status code asserted explicitly — a `409` here would be a regression |

#### SC-AVAIL-11 — Concurrent historical creation on the same unit and window

| | |
|---|---|
| **Priority · Category · Automate** | **P0** · Availability · YES (integration, real Postgres only) |
| **Traceability** | REQ-09, REQ-19 · HB-03 · INV-04, INV-05 |
| **Preconditions** | `U-ACTIVE-1` free; two authenticated sessions for `A-HIST` |
| **Test data** | Two identical requests but different clients, dispatched simultaneously |
| **Steps** | 1. Fire both `H-CREATE` calls concurrently. |
| **Expected — UI** | One wizard succeeds; the other shows the conflict surface |
| **Expected — API** | Exactly one `200`, exactly one `409` |
| **Expected — DB** | Exactly **one** booking on that window |
| **Expected — Audit** | Exactly one history row |
| **Expected — Financial** | One booking's financials only |
| **Expected — Owner** | One attribution only |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | Nights counted once |
| **Cleanup** | Snapshot restore |
| **Diagnostics** | Advisory-lock acquisition order on `booking-unit:{unitId:N}`. **Cannot run on EF InMemory** — `ExecuteSqlInterpolatedAsync` is relational-only (OQ-09) |

#### SC-AVAIL-12 — Historical booking does **not** block future storefront availability

| | |
|---|---|
| **Priority · Category · Automate** | **P0** · Availability · YES (xUnit + API) |
| **Traceability** | REQ-15 · HB-03 · INV-04 |
| **Preconditions** | A historical booking exists in the past on `U-ACTIVE-1` |
| **Test data** | Storefront availability query for `FUT-IN … FUT-OUT` |
| **Steps** | 1. Query public availability. 2. Attempt a normal future booking on the same unit. |
| **Expected — UI** | The unit shows as available for future dates |
| **Expected — API** | Availability returns available; normal creation returns `200` |
| **Expected — DB** | Future booking created |
| **Expected — Audit** | Normal creation history row |
| **Expected — Financial** | Normal pricing |
| **Expected — Owner** | Normal snapshot |
| **Expected — Notification** | Normal behaviour |
| **Expected — Reporting** | Normal |
| **Cleanup** | Snapshot restore |
| **Diagnostics** | This guards the key HB-03 design constraint: the historical conflict set must be a **separate** query, not an addition to `ActiveAvailabilityHoldStatuses`. Adding `Completed` to that shared set would make every past booking block future inventory forever |

---

## Group 4 — Duplicate prevention (`SC-DUP-nn`)

#### SC-DUP-01 — Exact duplicate is blocked

| | |
|---|---|
| **Priority · Category · Automate** | **P0** · Duplicate · YES (xUnit) |
| **Traceability** | REQ-10 · HB-03 · INV-08 |
| **Preconditions** | A historical booking exists: `U-ACTIVE-1`, `C-EXISTING-1`, `STAY-IN … STAY-OUT` |
| **Test data** | The identical unit, client and dates |
| **Steps** | 1. `H-CREATE` with identical values. |
| **Expected — UI** | The existing record is shown, with an explicit "already recorded" message |
| **Expected — API** | `409 HISTORICAL_DUPLICATE_BOOKING` |
| **Expected — DB** | Still exactly one booking |
| **Expected — Audit** | No new history row |
| **Expected — Financial** | No second charge, no second payment |
| **Expected — Owner** | No second attribution |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | Revenue not double-counted |
| **Cleanup** | Snapshot restore |
| **Diagnostics** | The duplicate key used. Must be unit + check-in + check-out + client — **never customer name alone** |

#### SC-DUP-02 — Duplicate external reference is blocked

| | |
|---|---|
| **Priority · Category · Automate** | P0 · Duplicate · YES (integration — partial unique index) |
| **Traceability** | REQ-10 · HB-03 · INV-08 |
| **Preconditions** | A historical booking exists with `external_reference = "EXT-TEST-001"` |
| **Test data** | A **different** unit, client and dates, but the same external reference |
| **Steps** | 1. `H-CREATE`. |
| **Expected — UI** | Field-level error on the external reference |
| **Expected — API** | `409 HISTORICAL_DUPLICATE_BOOKING` |
| **Expected — DB** | No new row; the partial unique index rejects it |
| **Expected — Audit** | None |
| **Expected — Financial** | None |
| **Expected — Owner** | None |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | Unchanged |
| **Cleanup** | Snapshot restore |
| **Diagnostics** | Index name and the constraint violation. Confirms the index is `WHERE external_reference IS NOT NULL` so multiple nulls remain legal |

#### SC-DUP-03 — Same unit and dates, different client → **not** a duplicate

| | |
|---|---|
| **Priority · Category · Automate** | P1 · Duplicate · YES (xUnit) |
| **Traceability** | REQ-09, REQ-10 · HB-03 |
| **Preconditions** | Historical booking exists for `C-EXISTING-1` |
| **Test data** | Same unit and dates, client `C-EXISTING-2` |
| **Steps** | 1. `H-CREATE`. |
| **Expected — UI** | Overlap conflict, **not** a duplicate message |
| **Expected — API** | `409 HISTORICAL_OVERLAP_CONFLICT` — the *overlap* rule catches it, not the duplicate rule |
| **Expected — DB** | No new row |
| **Expected — Audit** | None |
| **Expected — Financial** | None |
| **Expected — Owner** | None |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | Unchanged |
| **Cleanup** | Snapshot restore |
| **Diagnostics** | Assert the **error code** distinguishes the two rules — operators need different remedies |

#### SC-DUP-04 — Same client and dates, different unit → allowed

| | |
|---|---|
| **Priority · Category · Automate** | P1 · Duplicate · YES (xUnit) |
| **Traceability** | REQ-10 · HB-03 |
| **Preconditions** | Historical booking exists on `U-ACTIVE-1` |
| **Test data** | Same client and dates, unit `U-ACTIVE-2` |
| **Steps** | 1. `H-CREATE`. |
| **Expected — UI** | Possibly a probable-duplicate warning; acknowledgement permits it |
| **Expected — API** | `200` after acknowledgement |
| **Expected — DB** | Two bookings, different units |
| **Expected — Audit** | One history row each |
| **Expected — Financial** | Independent |
| **Expected — Owner** | Independent |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | Both counted |
| **Cleanup** | Snapshot restore |
| **Diagnostics** | A guest legitimately booking two units for the same nights must not be blocked |

#### SC-DUP-05 — Probable duplicate warns and requires acknowledgement

| | |
|---|---|
| **Priority · Category · Automate** | **P0** · Duplicate · YES (Playwright + API) |
| **Traceability** | REQ-10 · HB-03 · INV-08 |
| **Preconditions** | Historical booking exists: `U-ACTIVE-1`, `C-EXISTING-1`, `STAY-IN … STAY-OUT`, 3 900.00 |
| **Test data** | Same unit and client, dates shifted by one day, similar amount |
| **Steps** | 1. `H-CREATE` without acknowledgement. 2. Re-submit with explicit acknowledgement. |
| **Expected — UI** | Step 1 presents the candidate record for comparison and requires an explicit confirmation control; step 2 proceeds |
| **Expected — API** | Step 1 `409` with the candidate in the body; step 2 `200` |
| **Expected — DB** | No row after step 1; one row after step 2 |
| **Expected — Audit** | One history row after step 2; the acknowledgement is captured in the audit event |
| **Expected — Financial** | Only the acknowledged booking |
| **Expected — Owner** | Default |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | One booking |
| **Cleanup** | Snapshot restore |
| **Diagnostics** | The probable-duplicate score and the signals that fired |

#### SC-DUP-06 — Legitimate repeat customer is not obstructed

| | |
|---|---|
| **Priority · Category · Automate** | P1 · Duplicate · YES (xUnit) |
| **Traceability** | REQ-10 · HB-03 |
| **Preconditions** | Historical booking exists for `C-EXISTING-1` on `U-ACTIVE-1` |
| **Test data** | Same client and unit, dates two months earlier, no overlap |
| **Steps** | 1. `H-CREATE`. |
| **Expected — UI** | No warning |
| **Expected — API** | `200` |
| **Expected — DB** | Two bookings |
| **Expected — Audit** | One row each |
| **Expected — Financial** | Independent |
| **Expected — Owner** | Independent |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | Both counted |
| **Cleanup** | Snapshot restore |
| **Diagnostics** | Over-eager duplicate detection is itself a defect |

#### SC-DUP-07 — Double-click and network retry are absorbed

| | |
|---|---|
| **Priority · Category · Automate** | P0 · Duplicate · YES (API + Playwright) |
| **Traceability** | REQ-10, REQ-19 · HB-03 · INV-08 |
| **Preconditions** | Clean window |
| **Test data** | The same request sent twice with the same idempotency key |
| **Steps** | 1. Submit. 2. Immediately resubmit with the identical key. |
| **Expected — UI** | Submit control disables on first click; no second booking appears |
| **Expected — API** | First `200`; second either `200` returning the **same** booking id or `409` — never a second id |
| **Expected — DB** | Exactly one booking |
| **Expected — Audit** | Exactly one history row |
| **Expected — Financial** | One set of amounts; one payment if supplied |
| **Expected — Owner** | One attribution |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | Counted once |
| **Cleanup** | Snapshot restore |
| **Diagnostics** | Note that the pre-existing 30-second `RecentDuplicateWindow` (`BookingService.cs:19,335-345`) is a double-click guard only and must not be relied on as the business duplicate control |

---

## Group 5 — Permissions and security (`SC-SEC-nn`)

#### SC-SEC-01 — Authorized user succeeds

| | |
|---|---|
| **Priority · Category · Automate** | P0 · Security · YES (API) |
| **Traceability** | REQ-11 · HB-02 · INV-10 |
| **Preconditions** | `A-HIST` holds `bookings:record_historical` |
| **Test data** | Valid historical request |
| **Steps** | 1. `H-CREATE`. |
| **Expected — UI** | Entry point visible |
| **Expected — API** | `200` |
| **Expected — DB** | Booking created |
| **Expected — Audit** | Actor = `A-HIST` |
| **Expected — Financial** | As entered |
| **Expected — Owner** | Default |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | Normal |
| **Cleanup** | Snapshot restore |
| **Diagnostics** | Resolved permission set |

#### SC-SEC-02 — Unauthorized role is refused

| | |
|---|---|
| **Priority · Category · Automate** | **P0** · Security · YES (API) |
| **Traceability** | REQ-11 · HB-02 · INV-10 |
| **Preconditions** | `A-PLAIN` holds `bookings:write` but **not** `bookings:record_historical` |
| **Test data** | An otherwise perfectly valid historical request |
| **Steps** | 1. `H-CREATE` as `A-PLAIN`. |
| **Expected — UI** | The wizard entry point is not rendered at all |
| **Expected — API** | `403 forbidden` |
| **Expected — DB** | Nothing written |
| **Expected — Audit** | No booking audit; the refusal is logged |
| **Expected — Financial** | Nothing |
| **Expected — Owner** | Nothing |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | Unchanged |
| **Cleanup** | None |
| **Diagnostics** | Policy evaluation trace. Holding `bookings:write` must never be sufficient |

#### SC-SEC-03 — Permission revoked mid-session

| | |
|---|---|
| **Priority · Category · Automate** | P1 · Security · YES (API) |
| **Traceability** | REQ-11 · HB-02 · INV-10 |
| **Preconditions** | `A-HIST` signed in and mid-wizard |
| **Test data** | Revoke the permission, then submit |
| **Steps** | 1. Open the wizard. 2. Revoke via an override row with `ModifierType = 'deny'`. 3. Submit. |
| **Expected — UI** | Clear refusal, no data loss in the form |
| **Expected — API** | `403 forbidden` |
| **Expected — DB** | Nothing written |
| **Expected — Audit** | Refusal logged |
| **Expected — Financial** | Nothing |
| **Expected — Owner** | Nothing |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | Unchanged |
| **Cleanup** | Restore the permission |
| **Diagnostics** | Confirms authorization is evaluated per-request, not cached from sign-in |

#### SC-SEC-04 — Direct API attempt bypassing the wizard

| | |
|---|---|
| **Priority · Category · Automate** | P0 · Security · YES (API) |
| **Traceability** | REQ-11 · HB-02 · INV-10 |
| **Preconditions** | `A-PLAIN` credentials |
| **Test data** | A hand-crafted `H-CREATE` body |
| **Steps** | 1. POST directly with curl. |
| **Expected — UI** | n/a — no UI involved |
| **Expected — API** | `403 forbidden` |
| **Expected — DB** | Nothing |
| **Expected — Audit** | Refusal logged |
| **Expected — Financial** | Nothing |
| **Expected — Owner** | Nothing |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | Unchanged |
| **Cleanup** | None |
| **Diagnostics** | Proves the control is server-side, not a hidden button |

#### SC-SEC-05 — Cross-portfolio unit injection

| | |
|---|---|
| **Priority · Category · Automate** | **P0** · Security · YES (API) |
| **Traceability** | REQ-11 · HB-02, HB-05 · INV-12 |
| **Preconditions** | `A-OTHER-PF` is scoped to a different portfolio |
| **Test data** | `unitId = U-ACTIVE-1` (outside their scope) |
| **Steps** | 1. `H-CREATE` as `A-OTHER-PF`. |
| **Expected — UI** | The unit is not offered |
| **Expected — API** | `404 not_found` — **not** `403`, to avoid confirming the resource exists |
| **Expected — DB** | Nothing |
| **Expected — Audit** | Refusal logged |
| **Expected — Financial** | Nothing |
| **Expected — Owner** | Nothing |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | Unchanged |
| **Cleanup** | None |
| **Diagnostics** | Scoping predicate applied to the unit lookup |

#### SC-SEC-06 — Actor spoofing attempt

| | |
|---|---|
| **Priority · Category · Automate** | P0 · Security · YES (API) |
| **Traceability** | REQ-12 · HB-02 · INV-11 |
| **Preconditions** | `A-HIST` authenticated |
| **Test data** | Body includes `createdByAdminUserId` / `changedByAdminUserId` naming `A-FIN` |
| **Steps** | 1. `H-CREATE` with the injected actor. |
| **Expected — UI** | n/a |
| **Expected — API** | `400 VALIDATION_ERROR`; unknown actor fields are rejected |
| **Expected — DB** | No booking created |
| **Expected — Audit** | No event. A valid retry records `changed_by_admin_user_id = A-HIST` from claims only |
| **Expected — Financial** | As entered |
| **Expected — Owner** | Default |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | Normal |
| **Cleanup** | Snapshot restore |
| **Diagnostics** | Assert the persisted actor differs from the injected one |

#### SC-SEC-07 — Timestamp injection attempt

| | |
|---|---|
| **Priority · Category · Automate** | **P0** · Security · YES (API) |
| **Traceability** | REQ-02 · HB-02 · INV-01 |
| **Preconditions** | `A-HIST` authenticated |
| **Test data** | Body includes `createdAt = AGREED-AT` and `updatedAt = AGREED-AT` |
| **Steps** | 1. `H-CREATE`. |
| **Expected — UI** | n/a |
| **Expected — API** | `200` with the fields ignored (or `400` if the DTO rejects unknown fields) |
| **Expected — DB** | `created_at` and `updated_at` are real system time, **not** `AGREED-AT` |
| **Expected — Audit** | `changed_at` is real system time |
| **Expected — Financial** | As entered |
| **Expected — Owner** | Default |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | Bucketed on the real recorded date |
| **Cleanup** | Snapshot restore |
| **Diagnostics** | This is the single most important security assertion in the pack — it defends REQ-02 directly |

#### SC-SEC-08 — Financial field tampering

| | |
|---|---|
| **Priority · Category · Automate** | P0 · Security · YES (API) |
| **Traceability** | REQ-05, REQ-08 · HB-04, HB-05 |
| **Preconditions** | `A-HIST` authenticated |
| **Test data** | Body supplies invented `snapshotOwnerAmount`, `snapshotKazaAmount` and `commissionRate` fields |
| **Steps** | 1. `H-CREATE`. |
| **Expected — UI** | No editable or calculated owner/KAZA split exists |
| **Expected — API** | `400 VALIDATION_ERROR`; unknown financial fields are rejected |
| **Expected — DB** | Nothing written |
| **Expected — Audit** | None |
| **Expected — Financial** | No split is fabricated |
| **Expected — Owner** | No attribution change |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | No historical commission result is fabricated |
| **Cleanup** | Snapshot restore |
| **Diagnostics** | Never trust a client-supplied split |

#### SC-SEC-09 — Missing or invalid reason and source

| | |
|---|---|
| **Priority · Category · Automate** | P0 · Security · YES (xUnit validator) |
| **Traceability** | REQ-04 · HB-02 |
| **Preconditions** | `A-HIST` authenticated |
| **Test data** | Case A: reason omitted. Case B: reason `not_a_real_reason`. Case C: reason `other` with no note. Case D: `originalSource` omitted |
| **Steps** | 1. `H-CREATE` for each case. |
| **Expected — UI** | Field-level errors on the offending controls |
| **Expected — API** | `400 VALIDATION_ERROR` in all four cases |
| **Expected — DB** | Nothing written in any case |
| **Expected — Audit** | None |
| **Expected — Financial** | None |
| **Expected — Owner** | None |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | Unchanged |
| **Cleanup** | None |
| **Diagnostics** | Per-case error detail. A historical record without a reason defeats the audit purpose of the feature |

#### SC-SEC-10 — Invalid or inaccessible client

| | |
|---|---|
| **Priority · Category · Automate** | P1 · Security · YES (API) |
| **Traceability** | REQ-11 · HB-02 · INV-12 |
| **Preconditions** | `C-DELETED-1` is soft-deleted; `C-OTHER-PF-1` belongs to another portfolio |
| **Test data** | Case A: `clientId = C-DELETED-1`. Case B: `clientId = C-OTHER-PF-1`. Case C: a random GUID |
| **Steps** | 1. `H-CREATE` for each. |
| **Expected — UI** | The client is not selectable |
| **Expected — API** | `400` or `404` per case; never `200` |
| **Expected — DB** | Nothing |
| **Expected — Audit** | None |
| **Expected — Financial** | None |
| **Expected — Owner** | None |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | Unchanged |
| **Cleanup** | None |
| **Diagnostics** | Client resolution predicate |

#### SC-SEC-11 — Mass assignment of protected fields

| | |
|---|---|
| **Priority · Category · Automate** | P0 · Security · YES (API) |
| **Traceability** | REQ-07, REQ-11 · HB-02, HB-05 · INV-12, INV-14 |
| **Preconditions** | `A-HIST` lacks `bookings:correct_owner_attribution` |
| **Test data** | Body includes a bare top-level `ownerId = O-BETA`, plus `bookingStatus = "Confirmed"` and `isHistorical = false` |
| **Steps** | 1. `H-CREATE` with protected fields. 2. On an existing historical booking, call the correction endpoint as `A-HIST`. |
| **Expected — UI** | n/a |
| **Expected — API** | Creation payload is `400 VALIDATION_ERROR`; separate correction is the existing policy-system `403` with no invented business code |
| **Expected — DB** | No row from the invalid creation; existing booking attribution unchanged after the unauthorized correction |
| **Expected — Audit** | No success event |
| **Expected — Financial** | Unchanged |
| **Expected — Owner** | Existing attribution retained |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | Attributed to `O-ALPHA` |
| **Cleanup** | Snapshot restore |
| **Diagnostics** | Confirms owner correction exists only on its dedicated endpoint and authorization policy |

#### SC-SEC-12 — Audit immutability

| | |
|---|---|
| **Priority · Category · Automate** | P1 · Security · NO (manual — no update path should exist to test) |
| **Traceability** | REQ-12 · HB-02 |
| **Preconditions** | A historical booking with its history row exists |
| **Test data** | Attempt to modify or delete the history row through any exposed API |
| **Steps** | 1. Enumerate booking endpoints for any history mutation route. |
| **Expected — UI** | No control exists |
| **Expected — API** | No route exists; any attempt is `404` or `405` |
| **Expected — DB** | History row unchanged |
| **Expected — Audit** | Append-only |
| **Expected — Financial** | n/a — no financial surface involved |
| **Expected — Owner** | n/a — no owner surface involved |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | Unchanged |
| **Cleanup** | None |
| **Diagnostics** | Route inventory. If a mutation route is found, raise it as a defect |

---

## Group 6 — Financial calculations (`SC-FIN-nn`)

#### SC-FIN-01 — Agreed amount overrides computed pricing

| | |
|---|---|
| **Priority · Category · Automate** | **P0** · Financial · YES (xUnit) |
| **Traceability** | REQ-05 · HB-04 · INV-15 |
| **Preconditions** | `U-ACTIVE-1` current pricing yields 4 500.00 for the window |
| **Test data** | `agreed_amount = 3900.00` |
| **Steps** | 1. `H-CREATE`. |
| **Expected — UI** | The agreed amount is shown as the historical financial truth |
| **Expected — API** | `200` |
| **Expected — DB** | `agreed_amount = base_amount = final_amount = 3900.00`; current pricing is not persisted into the historical snapshot |
| **Expected — Audit** | Audit event records the agreed truth |
| **Expected — Financial** | Balance computed from 3 900.00 |
| **Expected — Owner** | Attribution unchanged; no split or payout is fabricated |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | Revenue 3 900.00 |
| **Cleanup** | Snapshot restore |
| **Diagnostics** | Current pricing must never silently win |

#### SC-FIN-02 — Repricing protection: unit price changes after recording

| | |
|---|---|
| **Priority · Category · Automate** | **P0** · Financial · YES (xUnit + integration) |
| **Traceability** | REQ-05 · HB-04 · INV-15 |
| **Preconditions** | A historical booking exists with `agreed_amount = 3900.00` |
| **Test data** | Raise `U-ACTIVE-1.BasePricePerNight` by 50 %, then read the booking |
| **Steps** | 1. Change the unit price. 2. Read the booking. 3. Recompute reports. |
| **Expected — UI** | Booking still shows 3 900.00 |
| **Expected — API** | Unchanged amounts |
| **Expected — DB** | `agreed_amount` and `final_amount` unchanged |
| **Expected — Audit** | No amount-change entry |
| **Expected — Financial** | Balance unchanged |
| **Expected — Owner** | Attribution unchanged; no split exists to recalculate |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | Historical revenue unchanged |
| **Cleanup** | Restore the price |
| **Diagnostics** | Directly targets `RISK-04` |

#### SC-FIN-03 — Prospective invariant: a permitted non-financial edit preserves the agreed financial snapshot

| | |
|---|---|
| **Priority · Category · Automate** | **P0** · Financial · YES (xUnit + integration) |
| **Traceability** | REQ-05 · HB-04 · INV-15 |
| **Classification** | **Prospective invariant.** Not a reproduction of a current defect — see the three-way distinction below |
| **Preconditions** | A historical booking exists with `agreed_amount = 3900.00`; current pricing for the same window is 4 500.00 |
| **Test data** | Any edit that HB-04 permits on a historical booking and that touches no financial field — `internal_notes` is the canonical example |
| **Steps** | 1. Apply the permitted non-financial edit. 2. Re-read the booking. |
| **Expected — UI** | Amount unchanged |
| **Expected — API** | `200` for the permitted edit |
| **Expected — DB** | `agreed_amount`, `base_amount` and `final_amount` all still 3 900.00 — **not** recomputed to 4 500.00 |
| **Expected — Audit** | The notes change is recorded; no financial-change entry |
| **Expected — Financial** | Balance unchanged |
| **Expected — Owner** | Attribution unchanged |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | Unchanged |
| **Cleanup** | Snapshot restore |
| **Diagnostics** | See the three-way distinction below. The mechanism at risk is `BookingService.cs:428,439-440`, which recomputes and reassigns `BaseAmount` and `FinalAmount` on every update; HB-04's `ApplyPricingSnapshot` guard is what makes this invariant hold for `is_historical` rows |

**The three-way distinction for `SC-FIN-03`.** These were previously conflated, and the conflation produced
a false claim that this scenario fails against today's code.

| | Statement | Evidence | Status |
|---|---|---|---|
| **Current verified defect** | `UpdatePendingAsync` unconditionally recomputes `BaseAmount` and `FinalAmount` from *current* pricing and reassigns both, for every booking it is allowed to touch | `CONFIRMED` — `BookingService.cs:428` (`CalculatePricingAsync`), `:439-440` (`booking.BaseAmount = booking.FinalAmount = pricing.TotalPrice`) | Real. This is the mechanism REQ-05 exists to contain |
| **Not a current defect** | "Today's code overwrites the amount of a *completed* historical booking" | **Refuted.** `UpdatePendingAsync` rejects any booking whose status is not `Prospecting` or `Relevant`, throwing `ConflictException` → `409`, at `BookingService.cs:385-387`. A booking created directly in `Completed` (ADR-04) is therefore unreachable by this path today | Must not be asserted. A historical booking cannot currently be edited at all through this route |
| **Owner-approved invariant (what this scenario tests)** | After a historical booking is created, any edit the system permits must preserve the agreed financial snapshot | [D-HB04-01](DECISION_RATIFICATION_PACKET.md#d-hb04-01--repricing-guard-scope) | The scenario protects every current and future repository mutation path |

**Why keep it as `P0` when it cannot fail today.** The `409` at `:385-387` is a *status* gate, not a
*financial* one. It was written to protect confirmed bookings from date changes, not to protect historical
amounts, and any future ticket that widens the editable status set would remove the protection without
touching HB-04. This scenario is the tripwire for that. It is **not** in the expected-to-fail set — see
[the regression note in Group 14](#group-14--regression-sc-reg-nn).

#### SC-FIN-04 — Seasonal pricing for the historical window

| | |
|---|---|
| **Priority · Category · Automate** | P1 · Financial · YES (xUnit) |
| **Traceability** | REQ-05 · HB-04 |
| **Preconditions** | `U-SEASONAL-1` has a seasonal row covering the historical window |
| **Test data** | Historical stay inside the seasonal period |
| **Steps** | 1. `H-CREATE` while the live seasonal price differs from the supplied agreed amount. |
| **Expected — UI** | Any current-price reference remains advisory and cannot populate the agreed amount |
| **Expected — API** | `200` with the persisted agreed truth and no new reference-price response field |
| **Expected — DB** | `agreed_amount = base_amount = final_amount` as entered; no live-price value is persisted |
| **Expected — Audit** | The agreed truth is recorded; no invented reference-price field is written |
| **Expected — Financial** | Agreed amount authoritative |
| **Expected — Owner** | Attribution unchanged; no financial split is inferred |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | Agreed amount |
| **Cleanup** | Snapshot restore |
| **Diagnostics** | `CalculatePricingAsync` is date-ranged (`UnitAvailabilityService.cs:136-148`) so past seasonal rows still apply, but `BasePricePerNight` is today's — the reference is therefore only partly historical, which is exactly why the agreed amount exists |

#### SC-FIN-05 — Owner attribution does not fabricate a financial split

| | |
|---|---|
| **Priority · Category · Automate** | **P0** · Financial · YES (xUnit) |
| **Traceability** | REQ-08 · HB-04, HB-05 · INV-14 |
| **Preconditions** | `O-ALPHA.CommissionRate = 15.00`; historical creation is otherwise valid |
| **Test data** | `agreed_amount = 3900.00` |
| **Steps** | 1. `H-CREATE`. |
| **Expected — UI** | Step 5 shows policy only; the post-create owner review shows persisted attribution only and no calculated split |
| **Expected — API** | `200` without invented commission/split fields |
| **Expected — DB** | `owner_id = O-ALPHA`; `agreed_amount = base_amount = final_amount = 3900.00`; no split columns or payout row |
| **Expected — Audit** | Creation records owner identity, not inferred commission economics |
| **Expected — Financial** | Agreed truth remains authoritative |
| **Expected — Owner** | `O-ALPHA` |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | No fabricated commission amount |
| **Cleanup** | Snapshot restore |
| **Diagnostics** | Prevents the planning layer from claiming a booking commission snapshot that the post-0061 schema does not contain |

#### SC-FIN-06 — Owner rate changes do not rewrite booking financial truth

| | |
|---|---|
| **Priority · Category · Automate** | **P0** · Financial · YES (xUnit + integration) |
| **Traceability** | REQ-08 · HB-05 · INV-14 |
| **Preconditions** | Historical booking attributed to an owner whose rate is 15 % |
| **Test data** | Change `O-ALPHA.CommissionRate` to 25 % |
| **Steps** | 1. Change the rate. 2. Re-read the booking. 3. Create the payout. |
| **Expected — UI** | Booking agreed amount and owner ID are unchanged; no historical rate is invented |
| **Expected — API** | Protected booking response unchanged except any live owner profile viewed separately |
| **Expected — DB** | `agreed_amount`, `base_amount`, `final_amount` and `owner_id` unchanged |
| **Expected — Audit** | No change entry |
| **Expected — Financial** | Booking truth unchanged; no payout is created |
| **Expected — Owner** | Attribution unchanged |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | No historical commission total is inferred from the changed live rate |
| **Cleanup** | Restore the rate |
| **Diagnostics** | Targets `RISK-03` |

#### SC-FIN-07 — Historical evidence reconciliation invariant

| | |
|---|---|
| **Priority · Category · Automate** | P0 · Financial · YES (xUnit) |
| **Traceability** | REQ-05, REQ-06 · HB-04 |
| **Preconditions** | Any historical booking with zero or more HB-04B evidence rows |
| **Test data** | Several agreed amounts and cumulative payment totals |
| **Steps** | 1. Create each booking. 2. Record permitted evidence. 3. Assert the invariant. |
| **Expected — UI** | Remaining evidence amount never becomes negative |
| **Expected — API** | Valid totals `200`; excess returns `409 HISTORICAL_PAYMENT_EXCEEDS_AGREED_AMOUNT` |
| **Expected — DB** | `agreed_amount = base_amount = final_amount` and `SUM(historical evidence) <= agreed_amount` exactly |
| **Expected — Audit** | One event per successful command |
| **Expected — Financial** | No over-recording or lost cents |
| **Expected — Owner** | Unchanged |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | Reconciles |
| **Cleanup** | Snapshot restore |
| **Diagnostics** | Uses decimal arithmetic and standalone evidence, never invoice-linked totals |

#### SC-FIN-08 — Decimal precision boundaries

| | |
|---|---|
| **Priority · Category · Automate** | P1 · Financial · YES (xUnit) |
| **Traceability** | REQ-05 · HB-04 |
| **Preconditions** | None |
| **Test data** | Valid two-decimal amounts and invalid over-scale values for booking and payment commands |
| **Steps** | 1. Submit valid boundary values. 2. Submit values with more than two decimal places. |
| **Expected — UI** | Two-decimal input/display |
| **Expected — API** | Valid commands `200`; over-scale values return `400 VALIDATION_ERROR` or the command-specific amount code |
| **Expected — DB** | PostgreSQL `DECIMAL(12,2)` stores accepted values exactly; invalid values create no row |
| **Expected — Audit** | Only accepted commands record events |
| **Expected — Financial** | No binary floating-point or silent rounding drift |
| **Expected — Owner** | Unchanged |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | Reconciles |
| **Cleanup** | Snapshot restore |
| **Diagnostics** | No commission-split rounding rule is introduced by Historical Bookings v1 |

#### SC-FIN-09 — Negative amount rejected

| | |
|---|---|
| **Priority · Category · Automate** | P0 · Financial · YES (xUnit + DB CHECK) |
| **Traceability** | REQ-05 · HB-04 |
| **Preconditions** | None |
| **Test data** | `agreed_amount = -100.00` |
| **Steps** | 1. `H-CREATE`. |
| **Expected — UI** | Field error |
| **Expected — API** | `400 VALIDATION_ERROR` |
| **Expected — DB** | Nothing; `ck_bookings_final_amount_non_negative` would also refuse it |
| **Expected — Audit** | None |
| **Expected — Financial** | None |
| **Expected — Owner** | None |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | Unchanged |
| **Cleanup** | None |
| **Diagnostics** | Defence in depth: validator and constraint |

#### SC-FIN-10 — Zero amount

| | |
|---|---|
| **Priority · Category · Automate** | P1 · Financial · YES (xUnit) |
| **Traceability** | REQ-05 · HB-04 |
| **Preconditions** | None |
| **Test data** | `agreed_amount = 0.00` |
| **Steps** | 1. `H-CREATE`. |
| **Expected — UI** | Confirmation prompt for a zero-value stay |
| **Expected — API** | `200` — zero is legal (`>= 0`), unlike negative |
| **Expected — DB** | `agreed_amount = base_amount = final_amount = 0.00`; no split fields exist |
| **Expected — Audit** | Recorded |
| **Expected — Financial** | Balance 0.00 |
| **Expected — Owner** | Attribution only; no entitlement is inferred |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | Zero revenue, one occupancy record |
| **Cleanup** | Snapshot restore |
| **Diagnostics** | **Settled — zero is valid** ([D-HB02-AMT](DECISION_RATIFICATION_PACKET.md#d-hb02-amt--financial-truth-boundary)). `agreedAmount` may be zero or positive; the existing `ck_bookings_base_amount_non_negative` constraint is already `>= 0`, so no schema change is needed and rejecting zero would invent a rule the platform does not have. A comped stay, an owner's own use and a goodwill arrangement are all real cases, and forcing a false non-zero amount would be worse than recording the truth |

#### SC-FIN-11 — Payment greater than the agreed total

| | |
|---|---|
| **Priority · Category · Automate** | P1 · Financial · YES (xUnit) |
| **Traceability** | REQ-06 · HB-04 |
| **Preconditions** | `agreed_amount = 3900.00` |
| **Test data** | Payment of 5 000.00 |
| **Steps** | 1. `H-CREATE`. 2. Call `H-PAY` for 5 000.00. |
| **Expected — UI** | Booking remains successful; payment shows an actionable cumulative-total conflict |
| **Expected — API** | Booking `200`; payment `409 HISTORICAL_PAYMENT_EXCEEDS_AGREED_AMOUNT` |
| **Expected — DB** | Booking remains; no payment/history/payment-idempotency residue from the failed command |
| **Expected — Audit** | Booking creation only |
| **Expected — Financial** | No overpayment persisted |
| **Expected — Owner** | None |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | Unchanged |
| **Cleanup** | None |
| **Diagnostics** | PAY-06 owner-approved rule: cumulative historical evidence may equal but never exceed `agreed_amount` |

#### SC-FIN-12 — Currency

| | |
|---|---|
| **Priority · Category · Automate** | P2 · Financial · YES (contract) |
| **Traceability** | REQ-05 · HB-04 |
| **Preconditions** | None |
| **Test data** | A booking intended in a non-default currency |
| **Steps** | 1. Attempt to express a currency. |
| **Expected — UI** | No currency control exists |
| **Expected — API** | No currency field exists |
| **Expected — DB** | No currency column exists on `bookings` or `payments` |
| **Expected — Audit** | n/a — nothing to record |
| **Expected — Financial** | Single-currency assumption |
| **Expected — Owner** | n/a — no currency dimension |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | Single currency |
| **Cleanup** | None |
| **Diagnostics** | Owner-approved v1 single-currency boundary: no currency override or redesign is permitted |

---

## Group 7 — Payments (`SC-PAY-nn`)

**HB-04B binding interpretation (PAY-01 through PAY-14):** every payment step in this group invokes
`POST /api/internal/bookings/{bookingId:guid}/historical-payments` after historical booking creation. Each call
records exactly one immutable evidence row and requires `payments:record_historical` plus `Idempotency-Key`.
References to payment being inline with `H-CREATE` are superseded. Payment-command rollback never removes the
already-created booking; it removes only that command's payment, audit event and idempotency claim.

#### SC-PAY-01 — No payment recorded

| | |
|---|---|
| **Priority · Category · Automate** | P0 · Payments · YES (xUnit) |
| **Traceability** | REQ-06 · HB-04 |
| **Preconditions** | Clean window |
| **Test data** | No payment supplied |
| **Steps** | 1. `H-CREATE`. |
| **Expected — UI** | Balance shown as fully outstanding |
| **Expected — API** | `200` |
| **Expected — DB** | One booking, zero payments |
| **Expected — Audit** | One history row |
| **Expected — Financial** | Outstanding = agreed amount |
| **Expected — Owner** | Attribution unchanged; no payout is created |
| **Expected — Notification** | Unchanged — no outstanding-balance alert, because that fires only from the sweep job |
| **Expected — Reporting** | Outstanding balance reported |
| **Cleanup** | Snapshot restore |
| **Diagnostics** | Balance formula trace |

#### SC-PAY-02 — Deposit only

| | |
|---|---|
| **Priority · Category · Automate** | P0 · Payments · YES (xUnit) |
| **Traceability** | REQ-06 · HB-04 |
| **Preconditions** | Clean window |
| **Test data** | 1 000.00 cash at `PAID-AT` against 3 900.00 |
| **Steps** | 1. `H-CREATE` without payment. 2. Call the HB-04B payment endpoint with its own key. |
| **Expected — UI** | Booking success, then payment success; balance 2 900.00 |
| **Expected — API** | Two `200` responses |
| **Expected — DB** | One booking and one immutable historical payment, `payment_status = 'paid'`, `paid_at = PAID-AT`, `invoice_id = NULL` |
| **Expected — Audit** | One booking creation event and one `HistoricalPaymentRecorded` event |
| **Expected — Financial** | Outstanding 2 900.00 |
| **Expected — Owner** | Attribution unchanged; evidence does not create or alter a payout |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | Payment at `PAID-AT` |
| **Cleanup** | Snapshot restore |
| **Diagnostics** | Only `paid` status counts toward the balance (`AutoCompleteBookingsJob.cs:156-158`) |

#### SC-PAY-03 — Fully paid

| | |
|---|---|
| **Priority · Category · Automate** | P0 · Payments · YES (xUnit) |
| **Traceability** | REQ-06 · HB-04 |
| **Preconditions** | Clean window |
| **Test data** | 3 900.00 bank transfer at `PAID-AT` |
| **Steps** | 1. `H-CREATE`. 2. Record 3 900.00 through HB-04B with a distinct key. |
| **Expected — UI** | Booking success followed by evidence success; historical evidence total 3 900.00 |
| **Expected — API** | Two `200` responses |
| **Expected — DB** | One unlinked immutable historical payment of 3 900.00 |
| **Expected — Audit** | Separate booking and payment events |
| **Expected — Financial** | Outstanding 0.00 |
| **Expected — Owner** | Attribution unchanged; no payout is created |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | Fully-paid historical booking |
| **Cleanup** | Snapshot restore |
| **Diagnostics** | Balance trace |

#### SC-PAY-04 — Multiple partial payments

| | |
|---|---|
| **Priority · Category · Automate** | P1 · Payments · YES (xUnit) |
| **Traceability** | REQ-06 · HB-04 |
| **Preconditions** | Clean window |
| **Test data** | Two payments: 1 000.00 cash at `PAID-AT`, 1 500.00 wallet two days later |
| **Steps** | 1. `H-CREATE`. 2. Call HB-04B twice with distinct idempotency keys. |
| **Expected — UI** | Booking success, then two evidence successes; running external-evidence amount 2 500.00 |
| **Expected — API** | Three `200` responses |
| **Expected — DB** | Two immutable unlinked payment rows with distinct `paid_at` values |
| **Expected — Audit** | One booking event and two payment events with trusted actors |
| **Expected — Financial** | Outstanding 1 400.00 |
| **Expected — Owner** | Unchanged |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | Two payment events on their real dates |
| **Cleanup** | Snapshot restore |
| **Diagnostics** | Atomicity across both payments |

#### SC-PAY-05 — Each legal manual method

| | |
|---|---|
| **Priority · Category · Automate** | P1 · Payments · YES (xUnit) |
| **Traceability** | REQ-06 · HB-04 |
| **Preconditions** | Clean windows |
| **Test data** | One historical booking and one command for each of `cash`, `bank_transfer`, `card`, `wallet` |
| **Steps** | 1. Create the historical booking. 2. Call the PAY-01 endpoint once for each method with a unique key. |
| **Expected — UI** | Out of scope for HB-04B |
| **Expected — API** | `200` for all four canonical methods |
| **Expected — DB** | Four immutable historical-evidence payments; `ck_payments_method` satisfied |
| **Expected — Audit** | Each recorded |
| **Expected — Financial** | Correct balances |
| **Expected — Owner** | Unchanged |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | Method breakdown correct |
| **Cleanup** | Snapshot restore |
| **Diagnostics** | `card` records evidence of an external payment; PAY-12 proves that no gateway or live collection path runs |

#### SC-PAY-06 — Future `PaidAt` rejected

| | |
|---|---|
| **Priority · Category · Automate** | P0 · Payments · YES (xUnit validator) |
| **Traceability** | REQ-06 · HB-04 · INV-02 |
| **Preconditions** | None |
| **Test data** | `paid_at = D0 + 1` |
| **Steps** | 1. `H-CREATE`. |
| **Expected — UI** | The date control refuses future dates |
| **Expected — API** | `400 VALIDATION_ERROR` |
| **Expected — DB** | Nothing |
| **Expected — Audit** | None |
| **Expected — Financial** | None |
| **Expected — Owner** | None |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | Unchanged |
| **Cleanup** | None |
| **Diagnostics** | Money cannot have been received in the future |

#### SC-PAY-07 — Payment actor is captured

| | |
|---|---|
| **Priority · Category · Automate** | **P0** · Payments · YES (xUnit) |
| **Traceability** | REQ-06 · HB-04 |
| **Preconditions** | `A-HIST` authenticated |
| **Test data** | Any historical payment |
| **Steps** | 1. `H-CREATE`. 2. Call HB-04B as `A-HIST`. 3. Inspect the payment row. |
| **Expected — UI** | The recorded-by actor is visible on the payment |
| **Expected — API** | `200` |
| **Expected — DB** | `payments.created_by_admin_user_id = A-HIST` |
| **Expected — Audit** | Actor attributable |
| **Expected — Financial** | Normal |
| **Expected — Owner** | Unchanged |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | Normal |
| **Cleanup** | Snapshot restore |
| **Diagnostics** | Closes the F-12 gap — `Payment` has no actor column today |

#### SC-PAY-08 — Payment failure preserves the booking and rolls back the payment command

| | |
|---|---|
| **Priority · Category · Automate** | **P0** · Payments · YES (integration, real Postgres only) |
| **Traceability** | REQ-19 · HB-02, HB-04 · INV-05, INV-06 |
| **Preconditions** | A successful historical booking; fault injection on the separate payment insert |
| **Test data** | Valid HB-04B command engineered to fail |
| **Steps** | 1. `H-CREATE` successfully. 2. Force the HB-04B payment command to fail. |
| **Expected — UI** | Booking remains successful; payment-only retry is offered |
| **Expected — API** | Booking `200`; payment mapped failure, not `200` |
| **Expected — DB** | Booking and its original history remain; no payment, payment-history or payment-idempotency residue |
| **Expected — Audit** | Exactly the original booking event; no payment event |
| **Expected — Financial** | Snapshot unchanged; no evidence amount recorded |
| **Expected — Owner** | Booking attribution unchanged |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | Unchanged |
| **Cleanup** | None needed |
| **Diagnostics** | Proves command-local atomicity under the owner-approved two-phase contract; real PostgreSQL only |

#### SC-PAY-09 — No gateway is contacted

| | |
|---|---|
| **Priority · Category · Automate** | P0 · Payments · YES (integration with egress assertion) |
| **Traceability** | REQ-06, REQ-13 · HB-04, HB-07 |
| **Preconditions** | Outbound HTTP monitored |
| **Test data** | Any historical payment |
| **Steps** | 1. `H-CREATE`. 2. Record evidence through HB-04B. 3. Inspect outbound calls. |
| **Expected — UI** | No payment-link control exists |
| **Expected — API** | `200` |
| **Expected — DB** | Payment persisted locally |
| **Expected — Audit** | Normal |
| **Expected — Financial** | Normal |
| **Expected — Owner** | Unchanged |
| **Expected — Notification** | Unchanged; no payment link generated |
| **Expected — Reporting** | Normal |
| **Cleanup** | Snapshot restore |
| **Diagnostics** | Structurally guaranteed — no gateway integration exists — but asserted so a future integration cannot silently acquire this path |

---

## Group 8 — Owner accounting (`SC-OWN-nn`)

#### SC-OWN-01 — Read-only owner attribution review

| | |
|---|---|
| **Priority · Category · Automate** | P0 · Owner · YES (xUnit + Playwright) |
| **Traceability** | REQ-07 · HB-05 · INV-14 |
| **Preconditions** | Historical booking attributed to `O-ALPHA` |
| **Test data** | Read-only review request |
| **Steps** | 1. Open the HB-05 owner-attribution review. 2. Inspect values and capabilities. |
| **Expected — UI** | Persisted attribution IDs, warning codes and capabilities; no browser financial calculation or owner PII |
| **Expected — API** | `200` from the review endpoint |
| **Expected — DB** | No write |
| **Expected — Audit** | No event for a read |
| **Expected — Financial** | No financial values inferred or changed |
| **Expected — Owner** | Persisted attribution is `O-ALPHA` |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | Revenue to `O-ALPHA` |
| **Cleanup** | Snapshot restore |
| **Diagnostics** | Confirmation must be an explicit act, not a default |

#### SC-OWN-02 — Privileged correction to the previous owner

| | |
|---|---|
| **Priority · Category · Automate** | **P0** · Owner · YES (xUnit + Playwright) |
| **Traceability** | REQ-07 · HB-05 · INV-14 |
| **Preconditions** | Historical booking attributed to `O-GAMMA`, no payout; actor holds `bookings:correct_owner_attribution` |
| **Test data** | Review returns `expectedCurrentOwnerId = O-GAMMA`; correct to `O-BETA`, reason `ownership_changed_after_stay`, unique key |
| **Steps** | 1. Submit the dedicated correction command with the reviewed expected ID. 2. Replay it with the same key. |
| **Expected — UI** | Before/after attribution shown in a separate correction flow |
| **Expected — API** | `200` |
| **Expected — DB** | `owner_id = O-BETA`; exactly one immutable correction row |
| **Expected — Audit** | Previous/target owner, actor, reason, timestamp and correction ID; replay adds nothing |
| **Expected — Financial** | Agreed/base/final amounts, payments, invoices and payouts unchanged |
| **Expected — Owner** | Persisted attribution is `O-BETA`, not `O-GAMMA` |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | Owner-attributed agreed amount moves to `O-BETA`; no commission share is inferred |
| **Cleanup** | Snapshot restore |
| **Diagnostics** | The core reason the separate correction command exists — targets `RISK-02` |

#### SC-OWN-03 — Owner attribution is immutable after a later unit-owner change

| | |
|---|---|
| **Priority · Category · Automate** | **P0** · Owner · YES (xUnit) |
| **Traceability** | REQ-07 · HB-05 · INV-14 |
| **Preconditions** | Historical booking attributed to `O-ALPHA` |
| **Test data** | Reassign `U-ACTIVE-1` to `O-DELTA`, then edit the booking's notes |
| **Steps** | 1. Change the unit's owner. 2. Edit unrelated booking fields. 3. Re-read. |
| **Expected — UI** | Booking still shows `O-ALPHA` |
| **Expected — API** | Unchanged |
| **Expected — DB** | `owner_id` still `O-ALPHA` — **not** resynchronized from the unit |
| **Expected — Audit** | No attribution change |
| **Expected — Financial** | Snapshot unchanged |
| **Expected — Owner** | `O-ALPHA` |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | Revenue stays with `O-ALPHA` |
| **Cleanup** | Restore ownership |
| **Diagnostics** | Every code path that could resync `Booking.OwnerId` from `Unit.OwnerId` must be audited |

#### SC-OWN-04 — Unauthorized correction attempt

| | |
|---|---|
| **Priority · Category · Automate** | **P0** · Owner · YES (API) |
| **Traceability** | REQ-07, REQ-11 · HB-05 · INV-10 |
| **Preconditions** | Actor lacks `bookings:correct_owner_attribution` |
| **Test data** | Valid correction target and reason |
| **Steps** | 1. Call the dedicated correction endpoint. |
| **Expected — UI** | The correction control is not rendered; the owner is read-only with an escalation message |
| **Expected — API** | Existing authorization-system `403` |
| **Expected — DB** | Nothing written |
| **Expected — Audit** | Refusal logged |
| **Expected — Financial** | Nothing |
| **Expected — Owner** | Nothing |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | Unchanged |
| **Cleanup** | None |
| **Diagnostics** | Browser manipulation must not enable it — the server is authoritative |

#### SC-OWN-05 — Non-existent correction target owner

| | |
|---|---|
| **Priority · Category · Automate** | P1 · Owner · YES (API) |
| **Traceability** | REQ-07 · HB-05 |
| **Preconditions** | Authorized correction actor; historical booking with no payout |
| **Test data** | Random target owner GUID |
| **Steps** | 1. Call the correction endpoint. |
| **Expected — UI** | Owner not selectable |
| **Expected — API** | `404 OWNER_CORRECTION_TARGET_NOT_FOUND` |
| **Expected — DB** | Nothing |
| **Expected — Audit** | None |
| **Expected — Financial** | Nothing |
| **Expected — Owner** | Nothing |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | Unchanged |
| **Cleanup** | None |
| **Diagnostics** | An owner is never accepted merely because a caller supplied a GUID |

#### SC-OWN-06 — Inactive target warning and deleted target rejection

| | |
|---|---|
| **Priority · Category · Automate** | **P0** · Owner · YES (API) |
| **Traceability** | REQ-07, REQ-11 · HB-05 · INV-12 |
| **Preconditions** | Authorized actor; no payout; one inactive and one soft-deleted owner |
| **Test data** | One correction per target |
| **Steps** | 1. Correct to inactive target. 2. Attempt a deleted target on a fresh booking. |
| **Expected — UI** | Inactive target carries a warning; deleted target is unavailable |
| **Expected — API** | `200` with warning, then `409 OWNER_CORRECTION_TARGET_INVALID` |
| **Expected — DB** | First correction persisted; second leaves no correction row |
| **Expected — Audit** | Exactly one success event |
| **Expected — Financial** | Nothing |
| **Expected — Owner** | Nothing |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | Unchanged |
| **Cleanup** | None |
| **Diagnostics** | Revenue misattribution across portfolios would be a serious financial defect |

#### SC-OWN-07 — Missing correction reason

| | |
|---|---|
| **Priority · Category · Automate** | P0 · Owner · YES (xUnit validator) |
| **Traceability** | REQ-07 · HB-05 |
| **Preconditions** | Authorized correction actor |
| **Test data** | Correction with no reason; and reason `other` with no note |
| **Steps** | 1. Call the correction endpoint for each case. |
| **Expected — UI** | Field errors |
| **Expected — API** | `400 VALIDATION_ERROR` |
| **Expected — DB** | Nothing |
| **Expected — Audit** | None |
| **Expected — Financial** | Nothing |
| **Expected — Owner** | Nothing |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | Unchanged |
| **Cleanup** | None |
| **Diagnostics** | An unexplained correction is indistinguishable from a mistake |

#### SC-OWN-08 — Uncertain ownership blocks without a caller determinability flag

| | |
|---|---|
| **Priority · Category · Automate** | **P0** · Owner · YES (Playwright + API) |
| **Traceability** | REQ-07 · HB-05 · INV-17 |
| **Preconditions** | Repository state cannot determine one valid owner |
| **Test data** | Review/creation request; attempt to inject a determinability field |
| **Steps** | 1. Request review/create. 2. Attempt unknown-field injection. |
| **Expected — UI** | Offline administrative-review guidance; no owner guess |
| **Expected — API** | `409 OWNER_ATTRIBUTION_REQUIRES_REVIEW`; injected field rejected |
| **Expected — DB** | **Nothing written** — no booking, no draft |
| **Expected — Audit** | No booking audit |
| **Expected — Financial** | Nothing |
| **Expected — Owner** | Nothing |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | Unchanged |
| **Cleanup** | None |
| **Diagnostics** | No draft workflow is invented — none exists in the repository. Wrong owner accounting is worse than no record |

#### SC-OWN-09 — Existing payout blocks owner correction

| | |
|---|---|
| **Priority · Category · Automate** | P0 · Owner · YES (integration) |
| **Traceability** | REQ-08 · HB-05 · INV-14 |
| **Preconditions** | Historical booking has one payout in any allowed repository payout status |
| **Test data** | Attempt correction to another eligible owner |
| **Steps** | 1. Capture payout bytes. 2. Submit the HB-05 correction. 3. Compare state. |
| **Expected — UI** | Administrative payout-review message |
| **Expected — API** | `409 OWNER_CORRECTION_PAYOUT_REVIEW_REQUIRED` |
| **Expected — DB** | Payout and booking attribution unchanged; no correction/idempotency completion row |
| **Expected — Audit** | No success event |
| **Expected — Financial** | Existing payout bit-for-bit unchanged |
| **Expected — Owner** | Attribution unchanged |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | Unchanged |
| **Cleanup** | Snapshot restore |
| **Diagnostics** | HB-05 performs no payout correction or rate reconstruction |

#### SC-OWN-10 — A paid payout is never silently mutated

| | |
|---|---|
| **Priority · Category · Automate** | **P0** · Owner · YES (integration) |
| **Traceability** | REQ-07 · HB-05 · INV-09 |
| **Preconditions** | `O-ALPHA` has an existing payout with `payout_status = 'paid'` for a **different** booking |
| **Test data** | Record a new historical booking for `O-ALPHA` with stay dates inside the same month |
| **Steps** | 1. `H-CREATE`. 2. Inspect the existing paid payout. |
| **Expected — UI** | No indication that any existing payout changed |
| **Expected — API** | `200` |
| **Expected — DB** | The paid payout row is **byte-identical**; a new booking simply has no payout yet |
| **Expected — Audit** | Only the new booking's audit |
| **Expected — Financial** | Existing settlement untouched |
| **Expected — Owner** | New booking remains attributed to `O-ALPHA`; no payout or entitlement is generated automatically |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | Both visible, independently |
| **Cleanup** | Snapshot restore |
| **Diagnostics** | Because payouts are per booking, any existing payout blocks HB-05 correction; a future accounting-adjustment command requires separate owner ratification |

#### SC-OWN-11 — An unrelated edit preserves owner and financial truth

| | |
|---|---|
| **Priority · Category · Automate** | **P0** · Owner · YES (xUnit + integration) |
| **Traceability** | REQ-08 · HB-05 · INV-14 |
| **Preconditions** | Historical booking with owner `O-ALPHA` and agreed amount `3900.00` |
| **Test data** | Edit only the client contact details and the internal note via `B-UPDATE` |
| **Steps** | 1. Perform the unrelated edit. 2. Re-read booking attribution and amounts. |
| **Expected — UI** | Owner attribution and agreed amount unchanged |
| **Expected — API** | `200` |
| **Expected — DB** | `owner_id`, `agreed_amount`, `base_amount` and `final_amount` unchanged |
| **Expected — Audit** | Only the edited fields recorded; no attribution correction |
| **Expected — Financial** | Agreed truth identical |
| **Expected — Owner** | `O-ALPHA` retained |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | Attribution and amounts unchanged |
| **Cleanup** | Snapshot restore |
| **Diagnostics** | Pairs with `SC-FIN-03` and proves a routine edit cannot silently rewrite attribution or agreed truth |

---

## Group 9 — Notifications and integrations (`SC-NOTIF-nn`)

**Binding HB-07 policy:** v1 emits no automatic internal or external notification, analytics event, outbox,
webhook or scheduled side effect for booking creation, historical payment, or owner correction. Manual
notification tools remain human-governed and unchanged.

#### SC-NOTIF-01 — No client confirmation replay

| | |
|---|---|
| **Priority · Category · Automate** | **P0** · Notifications · YES (xUnit + DB assertion) |
| **Traceability** | REQ-13 · HB-07 · INV-07 |
| **Preconditions** | Notification row count captured |
| **Test data** | Any historical creation |
| **Steps** | 1. Count notifications. 2. `H-CREATE`. 3. Recount. |
| **Expected — UI** | No message indicator for the client |
| **Expected — API** | `200` |
| **Expected — DB** | Notification count **identical** before and after |
| **Expected — Audit** | Booking audit only |
| **Expected — Financial** | Normal |
| **Expected — Owner** | Normal |
| **Expected — Notification** | Zero new rows of any channel |
| **Expected — Reporting** | Notification analytics unchanged |
| **Cleanup** | Snapshot restore |
| **Diagnostics** | Structural: creation has no dispatch path and `TransitionAsync` is never called (F-04) |

#### SC-NOTIF-02 — `AutoCompleteBookingsJob` excludes historical records

| | |
|---|---|
| **Priority · Category · Automate** | **P0** · Notifications · YES (integration) |
| **Traceability** | REQ-13 · HB-07 · INV-07 |
| **Preconditions** | A historical booking in `Completed` with an outstanding balance |
| **Test data** | Trigger the sweep |
| **Steps** | 1. Record the historical booking with a balance. 2. Run the sweep. 3. Inspect status, history and notifications. |
| **Expected — UI** | Nothing changes |
| **Expected — API** | n/a — background job |
| **Expected — DB** | Status still `completed`; **no** second history row |
| **Expected — Audit** | Still exactly one history row |
| **Expected — Financial** | Unchanged |
| **Expected — Owner** | Unchanged |
| **Expected — Notification** | **No** `BOOKING_COMPLETED_WITH_BALANCE` alert to finance admins |
| **Expected — Reporting** | Unchanged |
| **Cleanup** | Snapshot restore |
| **Diagnostics** | The job filters `BookingStatus == CheckIn` (`AutoCompleteBookingsJob.cs:86`), so `Completed` is outside it. Had the booking been created in `CheckIn`, it would have been swept and would have alerted (`:145-221`) |

#### SC-NOTIF-03 — A historical booking created in `CheckIn` would be swept (negative guard)

| | |
|---|---|
| **Priority · Category · Automate** | **P0** · Notifications · YES (integration) |
| **Traceability** | REQ-13 · HB-02, HB-07 · INV-07 |
| **Preconditions** | Fault injection or a direct fixture insert placing a past-dated booking in `CheckIn` |
| **Test data** | Past checkout, status `CheckIn` |
| **Steps** | 1. Insert. 2. Run the sweep. 3. Observe. |
| **Expected — UI** | The record silently changes status overnight |
| **Expected — API** | n/a |
| **Expected — DB** | Status flips to `completed`; a second history row appears with a null actor |
| **Expected — Audit** | Two history rows — demonstrating the failure mode |
| **Expected — Financial** | Unchanged |
| **Expected — Owner** | Unchanged |
| **Expected — Notification** | An outstanding-balance alert **is** created |
| **Expected — Reporting** | Unchanged |
| **Cleanup** | Snapshot restore |
| **Diagnostics** | This scenario **documents the trap**, proving why NAC-HB02-08 exists. The production code must never create in `CheckIn`; this test asserts the consequence if it did |

#### SC-NOTIF-04 — No invoice is auto-created

| | |
|---|---|
| **Priority · Category · Automate** | P0 · Notifications · YES (xUnit) |
| **Traceability** | REQ-13 · HB-04, HB-07 |
| **Preconditions** | Clean window |
| **Test data** | Any historical creation |
| **Steps** | 1. `H-CREATE`. 2. Query invoices for the booking. |
| **Expected — UI** | Booking detail shows "Invoice not issued" |
| **Expected — API** | `200`; invoice list empty |
| **Expected — DB** | Zero invoice rows |
| **Expected — Audit** | No invoice audit |
| **Expected — Financial** | Balance from `booking.FinalAmount` |
| **Expected — Owner** | Unchanged |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | Invoice-based read models exclude it until an invoice is issued |
| **Cleanup** | Snapshot restore |
| **Diagnostics** | The only auto-create site is Booked→Confirmed (`BookingLifecycleService.cs:186-200`), which this path never traverses |

#### SC-NOTIF-05 — Manual invoice issuance for a completed historical booking

| | |
|---|---|
| **Priority · Category · Automate** | P1 · Notifications · YES (API) |
| **Traceability** | REQ-14 · HB-04 |
| **Preconditions** | A historical booking exists |
| **Test data** | `I-DRAFT` then issue |
| **Steps** | 1. Create a draft. 2. Issue it. |
| **Expected — UI** | Invoice appears |
| **Expected — API** | `200` then `200` — permitted because `FinanceEligibleStatuses` includes `Completed` |
| **Expected — DB** | Invoice with `invoice_number = INV-{today}-NNNN` and `issued_at ≈ now` |
| **Expected — Audit** | Invoice audit |
| **Expected — Financial** | Balance now prefers the invoice total |
| **Expected — Owner** | Unchanged |
| **Expected — Notification** | No client message |
| **Expected — Reporting** | Now visible to invoice-based read models |
| **Cleanup** | Snapshot restore |
| **Diagnostics** | Note the number and issue date assert **today**, not the stay period (`InvoiceService.cs:502`) — an accepted v1 limitation that must be visible to Finance |

#### SC-NOTIF-06 — No outbound integration is contacted

| | |
|---|---|
| **Priority · Category · Automate** | P0 · Notifications · YES (integration with egress assertion) |
| **Traceability** | REQ-13 · HB-07 |
| **Preconditions** | Outbound HTTP and SMTP monitored |
| **Test data** | Historical booking followed by a separate HB-04B payment command |
| **Steps** | 1. `H-CREATE`. 2. Record payment evidence. 3. Inspect all egress. |
| **Expected — UI** | n/a |
| **Expected — API** | `200` |
| **Expected — DB** | Local writes only |
| **Expected — Audit** | Normal |
| **Expected — Financial** | Normal |
| **Expected — Owner** | Normal |
| **Expected — Notification** | Zero outbound calls; `NotificationDeliveryLog` unchanged |
| **Expected — Reporting** | Unchanged |
| **Cleanup** | Snapshot restore |
| **Diagnostics** | No SMTP/HTTP delivery implementation exists today; this asserts a future one cannot silently inherit this path |

---

## Group 10 — Status and audit (`SC-AUDIT-nn`)

#### SC-AUDIT-01 — Final status is `Completed`

| | |
|---|---|
| **Priority · Category · Automate** | P0 · Audit · YES (xUnit) |
| **Traceability** | REQ-12 · HB-02 |
| **Preconditions** | Clean window |
| **Test data** | Standard historical request |
| **Steps** | 1. `H-CREATE`. 2. Read the booking. |
| **Expected — UI** | Status badge reads `Completed` |
| **Expected — API** | `bookingStatus: "Completed"` |
| **Expected — DB** | `booking_status = 'completed'`, legal under `ck_bookings_status` |
| **Expected — Audit** | One history row ending at `completed` |
| **Expected — Financial** | Finance-eligible |
| **Expected — Owner** | Payout-eligible |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | Counted as a completed stay |
| **Cleanup** | Snapshot restore |
| **Diagnostics** | `Completed` is terminal (`BookingStatusTransitions.cs:18`) — no further transition is offered |

#### SC-AUDIT-02 — No fabricated intermediate transitions

| | |
|---|---|
| **Priority · Category · Automate** | **P0** · Audit · YES (xUnit) |
| **Traceability** | REQ-12 · HB-02 · INV-01 |
| **Preconditions** | Clean window |
| **Test data** | Standard historical request |
| **Steps** | 1. `H-CREATE`. 2. `B-HISTORY`. |
| **Expected — UI** | Timeline shows exactly one event |
| **Expected — API** | History array length 1 |
| **Expected — DB** | Exactly one `booking_status_history` row |
| **Expected — Audit** | **No** rows for `relevant`, `booked`, `confirmed`, `checkin` |
| **Expected — Financial** | Unchanged |
| **Expected — Owner** | Unchanged |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | Unchanged |
| **Cleanup** | Snapshot restore |
| **Diagnostics** | Walking the chain would require five fabricated transitions and would trigger both the auto-invoice and the client notification |

#### SC-AUDIT-03 — Recorded timestamps are real, historical dates are explicit

| | |
|---|---|
| **Priority · Category · Automate** | **P0** · Audit · YES (xUnit) |
| **Traceability** | REQ-02, REQ-03 · HB-02 · INV-01, INV-02 |
| **Preconditions** | Clean window |
| **Test data** | `AGREED-AT` nine days before now; `PAID-AT` likewise |
| **Steps** | 1. `H-CREATE`. 2. Inspect every timestamp. |
| **Expected — UI** | "Recorded on" and "Agreed on" shown as distinct facts |
| **Expected — API** | Both present and distinct |
| **Expected — DB** | `created_at ≈ now`; `actual_booked_at = AGREED-AT`; `payments.paid_at = PAID-AT`; `payments.created_at ≈ now` |
| **Expected — Audit** | `changed_at ≈ now` |
| **Expected — Financial** | Normal |
| **Expected — Owner** | Normal |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | Recorded and stay dimensions both derivable |
| **Cleanup** | Snapshot restore |
| **Diagnostics** | The defining assertion of REQ-02 and REQ-03 |

#### SC-AUDIT-04 — Actor, reason and source are recorded

| | |
|---|---|
| **Priority · Category · Automate** | P0 · Audit · YES (xUnit) |
| **Traceability** | REQ-04, REQ-12 · HB-02 · INV-11 |
| **Preconditions** | `A-HIST` authenticated |
| **Test data** | Reason and original source supplied |
| **Steps** | 1. `H-CREATE`. 2. Inspect the row and the audit event. |
| **Expected — UI** | All three visible on the booking detail |
| **Expected — API** | All three echoed |
| **Expected — DB** | `historical_entry_reason`, `original_source` persisted; `source` holds a value legal under `ck_bookings_source` |
| **Expected — Audit** | `changed_by_admin_user_id = A-HIST`; event carries reason and source |
| **Expected — Financial** | Normal |
| **Expected — Owner** | Normal |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | Source reporting can use `original_source` |
| **Cleanup** | Snapshot restore |
| **Diagnostics** | Confirms `ck_bookings_source` was not widened |

#### SC-AUDIT-05 — Structured data is not stringified into notes

| | |
|---|---|
| **Priority · Category · Automate** | P1 · Audit · YES (xUnit) |
| **Traceability** | REQ-04 · HB-02 · ADR-06 |
| **Preconditions** | Clean window |
| **Test data** | Standard historical request with an internal note |
| **Steps** | 1. `H-CREATE`. 2. Inspect `internal_notes` and the history note. |
| **Expected — UI** | Notes show only operator free text |
| **Expected — API** | Notes field contains only the supplied text |
| **Expected — DB** | `internal_notes` contains no reason code, no marker, no serialized payload |
| **Expected — Audit** | History note is the fixed constant only |
| **Expected — Financial** | n/a — no financial surface involved |
| **Expected — Owner** | n/a — no owner surface involved |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | Unchanged |
| **Cleanup** | Snapshot restore |
| **Diagnostics** | ADR-06 rejects notes-overloading; this asserts it |

#### SC-AUDIT-06 — Audit event shape is complete

| | |
|---|---|
| **Priority · Category · Automate** | P1 · Audit · YES (log assertion) |
| **Traceability** | REQ-12 · HB-08 |
| **Preconditions** | Structured logging enabled |
| **Test data** | Standard historical request |
| **Steps** | 1. `H-CREATE`. 2. Capture `booking.historical.recorded`. |
| **Expected — UI** | n/a |
| **Expected — API** | `200` |
| **Expected — DB** | Normal |
| **Expected — Audit** | Creation event carries booking id, unit id, actor, recorded-at, stay dates, agreement date, reason, source and owner id; later correction has its own immutable linked record |
| **Expected — Financial** | Amounts present |
| **Expected — Owner** | Attribution present |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | Feeds reconciliation |
| **Cleanup** | Snapshot restore |
| **Diagnostics** | Assert **no** guest name, phone or email appears in the event |

---

## Group 11 — Reporting (`SC-REP-nn`)

#### SC-REP-01 — Booking daily summary view

| | |
|---|---|
| **Priority · Category · Automate** | P0 · Reporting · YES (SQL assertion) |
| **Traceability** | REQ-18 · HB-08 · INV-13 |
| **Preconditions** | Historical booking with a stay in a previous month |
| **Test data** | `STAY-IN`/`STAY-OUT` last month; recorded today |
| **Steps** | 1. `H-CREATE`. 2. Query the view. |
| **Expected — UI** | Dashboard reflects the view |
| **Expected — API** | n/a — SQL surface |
| **Expected — DB** | Row appears at `DATE(created_at)` = today |
| **Expected — Audit** | n/a — reporting only |
| **Expected — Financial** | Counted today |
| **Expected — Owner** | n/a — not owner-scoped |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | Documented behaviour; stay-month total must also be derivable after ADR-11 |
| **Cleanup** | Snapshot restore |
| **Diagnostics** | `0041_create_reporting_booking_daily_summary_view.sql:49,59` groups on `DATE(b.created_at)` |

#### SC-REP-02 — Finance daily summary view

| | |
|---|---|
| **Priority · Category · Automate** | **P0** · Reporting · YES (SQL assertion) |
| **Traceability** | REQ-18 · HB-08 · INV-13 |
| **Preconditions** | As `SC-REP-01` |
| **Test data** | Agreed amount 3 900.00 |
| **Steps** | 1. `H-CREATE`. 2. Query the finance view for today and for the stay month. |
| **Expected — UI** | Finance dashboard |
| **Expected — API** | n/a |
| **Expected — DB** | Revenue attributed to today |
| **Expected — Audit** | n/a — reporting only |
| **Expected — Financial** | 3 900.00 in today's bucket |
| **Expected — Owner** | n/a |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | Both figures reconcilable; the discrepancy must be explainable, not surprising |
| **Cleanup** | Snapshot restore |
| **Diagnostics** | `0042_create_reporting_finance_daily_summary_view.sql:65,87,94` |

#### SC-REP-03 — Finance analytics service filters

| | |
|---|---|
| **Priority · Category · Automate** | P1 · Reporting · YES (API) |
| **Traceability** | REQ-18 · HB-08 |
| **Preconditions** | Historical booking recorded today, stay last month |
| **Test data** | Query with a date range covering the stay month, then today |
| **Steps** | 1. Query both ranges. |
| **Expected — UI** | Analytics screen |
| **Expected — API** | Stay-month query excludes it; today's includes it |
| **Expected — DB** | n/a — read path |
| **Expected — Audit** | n/a |
| **Expected — Financial** | Attributed to today |
| **Expected — Owner** | n/a |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | Documents the `CreatedAt` filter at `ReportingFinanceAnalyticsService.cs:75-81` |
| **Cleanup** | Snapshot restore |
| **Diagnostics** | After ADR-11 a stay-period filter must also be available |

#### SC-REP-04 — Outstanding balances

| | |
|---|---|
| **Priority · Category · Automate** | P1 · Reporting · YES (API) |
| **Traceability** | REQ-14 · HB-08 |
| **Preconditions** | Historical booking with a deposit |
| **Test data** | 3 900.00 agreed, 1 000.00 paid |
| **Steps** | 1. Query outstanding balances. |
| **Expected — UI** | 2 900.00 outstanding |
| **Expected — API** | 2 900.00 |
| **Expected — DB** | n/a — derived |
| **Expected — Audit** | n/a |
| **Expected — Financial** | Correct |
| **Expected — Owner** | n/a |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | Correct |
| **Cleanup** | Snapshot restore |
| **Diagnostics** | Formula `bookings.agreed_amount − Σ payments.amount WHERE is_historical_record = true`; invoice-linked totals remain separate |

#### SC-REP-05 — Occupancy is correct automatically

| | |
|---|---|
| **Priority · Category · Automate** | P0 · Reporting · YES (SQL) |
| **Traceability** | REQ-18 · HB-08 |
| **Preconditions** | Historical booking for a past window |
| **Test data** | 3-night stay |
| **Steps** | 1. Query occupancy for the stay month. |
| **Expected — UI** | Occupancy chart shows the nights |
| **Expected — API** | Nights counted in the stay month |
| **Expected — DB** | n/a — derived from stay dates |
| **Expected — Audit** | n/a |
| **Expected — Financial** | n/a — occupancy is non-financial |
| **Expected — Owner** | Unit-scoped |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | **Correct without any change** — occupancy already derives from stay dates |
| **Cleanup** | Snapshot restore |
| **Diagnostics** | The one reporting surface needing no work |

#### SC-REP-06 — Standalone historical evidence is separate from invoice-linked totals

| | |
|---|---|
| **Priority · Category · Automate** | **P0** · Reporting · YES (SQL) |
| **Traceability** | REQ-18 · HB-08 · INV-13 |
| **Preconditions** | Historical booking with a payment **not** linked to an invoice |
| **Test data** | Payment with `invoice_id = NULL` |
| **Steps** | 1. Query finance/owner reports. 2. Compare invoice-linked and historical-evidence columns. |
| **Expected — UI** | Clearly labelled separate totals |
| **Expected — API** | Dedicated evidence count/amount; invoice-linked total excludes it |
| **Expected — DB** | Payment exists with a null invoice link |
| **Expected — Audit** | n/a |
| **Expected — Financial** | Evidence amount appears exactly once in its dedicated column and never as invoice-linked paid |
| **Expected — Owner** | No unsupported reconciliation or settlement claim |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | Separate columns reconcile without double-counting |
| **Cleanup** | Snapshot restore |
| **Diagnostics** | Manual invoices remain allowed, but historical evidence is never attached or included in invoice-linked totals |

#### SC-REP-07 — Source and channel reporting

| | |
|---|---|
| **Priority · Category · Automate** | P1 · Reporting · YES (SQL) |
| **Traceability** | REQ-04, REQ-18 · HB-08 |
| **Preconditions** | Historical booking with `source = 'admin'`, `original_source = 'offline_record'` |
| **Test data** | As above |
| **Steps** | 1. Query source reporting. |
| **Expected — UI** | Channel breakdown |
| **Expected — API** | n/a |
| **Expected — DB** | `source = 'admin'`; `original_source = 'offline_record'` |
| **Expected — Audit** | Both recorded |
| **Expected — Financial** | n/a — attribution only |
| **Expected — Owner** | n/a |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | Grouping on `source` alone misrepresents origin; reporting should prefer `original_source` for historical rows |
| **Cleanup** | Snapshot restore |
| **Diagnostics** | Consequence of `ck_bookings_source` |

#### SC-REP-08 — Exports

| | |
|---|---|
| **Priority · Category · Automate** | P2 · Reporting · YES (inventory assertion) |
| **Traceability** | REQ-18 · HB-08 |
| **Preconditions** | Historical booking exists |
| **Test data** | Attempt any CSV/PDF export |
| **Steps** | 1. Enumerate export surfaces. |
| **Expected — UI** | Any discovered export uses the same filters and labels as the source report; absence is recorded explicitly |
| **Expected — API** | Any discovered export route preserves the two reporting axes and historical evidence classification |
| **Expected — DB** | n/a — read path |
| **Expected — Audit** | n/a |
| **Expected — Financial** | No evidence is counted as invoice-linked payment |
| **Expected — Owner** | Uses persisted booking attribution |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | External-consumer inventory is complete before rollout; no unverified export is silently approved |
| **Cleanup** | None |
| **Diagnostics** | This is a rollout inventory gate, not an unresolved product decision |

---

## Group 12 — UI and UX (`SC-UI-nn`)

**Binding HB-06 policy — OWNER APPROVED CONTRACT AMENDMENT (2026-08-03):** the wizard is a full page. Step 5
is policy-only and makes no owner call. Booking creation succeeds in step 6, then HB-05 review uses the
returned booking ID without gating success. Optional HB-04B payment is a second permission-gated command,
independent from review. Payment failure preserves the booking and retries only payment. No endpoint,
migration, schema object or stable error is added by this amendment.

#### SC-UI-01 — Entry point is permission-gated

| | |
|---|---|
| **Priority · Category · Automate** | P0 · UI · YES (Playwright) |
| **Traceability** | REQ-11 · HB-06 |
| **Preconditions** | Two sessions: `A-HIST` and `A-PLAIN` |
| **Test data** | Portal navigation |
| **Steps** | 1. Sign in as each. 2. Inspect navigation and direct route access. |
| **Expected — UI** | Visible for `A-HIST`; absent for `A-PLAIN`; the direct route is refused for `A-PLAIN` |
| **Expected — API** | `403` on direct call |
| **Expected — DB** | Nothing |
| **Expected — Audit** | Refusal logged |
| **Expected — Financial** | n/a — no write attempted |
| **Expected — Owner** | n/a |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | Unchanged |
| **Cleanup** | None |
| **Diagnostics** | Hiding is UX; the server refusal is the control |

#### SC-UI-02 — Step state survives Back and Next

| | |
|---|---|
| **Priority · Category · Automate** | P1 · UI · YES (Playwright) |
| **Traceability** | REQ-01 · HB-06 |
| **Preconditions** | `A-HIST` in the wizard |
| **Test data** | Complete steps 1–4, go back to 1, return |
| **Steps** | 1. Fill 1–4. 2. Back to step 1. 3. Forward again. |
| **Expected — UI** | All entered values preserved; no silent reset |
| **Expected — API** | No premature write |
| **Expected — DB** | Nothing written until submit |
| **Expected — Audit** | None |
| **Expected — Financial** | None |
| **Expected — Owner** | None |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | Unchanged |
| **Cleanup** | Abandon the wizard |
| **Diagnostics** | Data loss mid-wizard is a common and costly defect |

#### SC-UI-03 — Conflict is an inline, persistent surface

| | |
|---|---|
| **Priority · Category · Automate** | **P0** · UI · YES (Playwright) |
| **Traceability** | REQ-09 · HB-06 |
| **Preconditions** | A conflicting booking exists |
| **Test data** | Overlapping dates |
| **Steps** | 1. Submit. 2. Observe the surface. 3. Change the unit. 4. Resubmit. |
| **Expected — UI** | Persistent inline conflict naming the conflicting dates and offering a remedy — **not** a transient toast; after the 409, cached availability is invalidated so the rejected unit is not still offered as free |
| **Expected — API** | `409` then `200` |
| **Expected — DB** | One booking after step 4 |
| **Expected — Audit** | One history row |
| **Expected — Financial** | Normal |
| **Expected — Owner** | Normal |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | Normal |
| **Cleanup** | Snapshot restore |
| **Diagnostics** | A prior defect in this repository showed a stale unit list after a 409; cache invalidation is required |

#### SC-UI-04 — Review step shows all mandatory warnings

| | |
|---|---|
| **Priority · Category · Automate** | P0 · UI · YES (Playwright) |
| **Traceability** | REQ-01, REQ-13 · HB-06 |
| **Preconditions** | Wizard at step 6 |
| **Test data** | Complete request |
| **Steps** | 1. Reach step 6. |
| **Expected — UI** | All five warnings present: a completed historical booking is being recorded; reports will be affected; owner accounting may be affected; notifications will not be sent; audit timestamps remain current |
| **Expected — API** | No call until submit |
| **Expected — DB** | Nothing |
| **Expected — Audit** | None |
| **Expected — Financial** | Summary shown |
| **Expected — Owner** | Attribution shown |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | Consequence stated |
| **Cleanup** | Abandon |
| **Diagnostics** | Informed consent before an irreversible financial record |

#### SC-UI-05 — Accessibility

| | |
|---|---|
| **Priority · Category · Automate** | P1 · UI · YES (Playwright + axe) |
| **Traceability** | REQ-01 · HB-06 |
| **Preconditions** | Wizard open |
| **Test data** | Keyboard-only and screen-reader traversal |
| **Steps** | 1. Traverse all six steps by keyboard. 2. Trigger a validation error. |
| **Expected — UI** | Logical focus order; focus moves to the new step on advance; errors associated via `aria-describedby` and `aria-invalid`; step changes announced |
| **Expected — API** | n/a |
| **Expected — DB** | n/a |
| **Expected — Audit** | n/a |
| **Expected — Financial** | n/a |
| **Expected — Owner** | n/a |
| **Expected — Notification** | n/a |
| **Expected — Reporting** | n/a |
| **Cleanup** | Abandon |
| **Diagnostics** | The existing CRM wizard already sets `aria-invalid` and `aria-describedby` — match that standard |

#### SC-UI-06 — Responsive behaviour

| | |
|---|---|
| **Priority · Category · Automate** | P1 · UI · YES (Playwright viewports) |
| **Traceability** | REQ-01 · HB-06 |
| **Preconditions** | Wizard open |
| **Test data** | Desktop, tablet and mobile viewports |
| **Steps** | 1. Complete the wizard at each width. |
| **Expected — UI** | No horizontal page scroll; controls reachable; summary tables scroll within their own container |
| **Expected — API** | Normal |
| **Expected — DB** | Normal |
| **Expected — Audit** | Normal |
| **Expected — Financial** | Normal |
| **Expected — Owner** | Normal |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | Normal |
| **Cleanup** | Snapshot restore |
| **Diagnostics** | Capture screenshots at each width |

#### SC-UI-07 — Language

| | |
|---|---|
| **Priority · Category · Automate** | P2 · UI · NO (documentation check) |
| **Traceability** | REQ-01 · HB-06 |
| **Preconditions** | Portal open |
| **Test data** | Wizard copy |
| **Steps** | 1. Inspect all wizard strings. |
| **Expected — UI** | English copy, consistent with the rest of the operator portal |
| **Expected — API** | n/a |
| **Expected — DB** | n/a |
| **Expected — Audit** | n/a |
| **Expected — Financial** | n/a |
| **Expected — Owner** | n/a |
| **Expected — Notification** | n/a |
| **Expected — Reporting** | n/a |
| **Cleanup** | None |
| **Diagnostics** | `CONFIRMED` the operator portal is English-only with no i18n system; the Arabic step name `المالك والحسابات` is documented for product parity only. Registered as [OQ-08](00_MASTER_PLAN.md#32-open-questions) |

---

## Group 13 — API and transaction reliability (`SC-TXN-nn`)

#### SC-TXN-01 — Atomic success

| | |
|---|---|
| **Priority · Category · Automate** | P0 · Transaction · YES (integration) |
| **Traceability** | REQ-19 · HB-02 · INV-05 |
| **Preconditions** | Clean window |
| **Test data** | Booking plus payment |
| **Steps** | 1. `H-CREATE`. |
| **Expected — UI** | Success |
| **Expected — API** | `200` |
| **Expected — DB** | Booking, history row and payment all present |
| **Expected — Audit** | One history row |
| **Expected — Financial** | Consistent |
| **Expected — Owner** | Consistent |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | Consistent |
| **Cleanup** | Snapshot restore |
| **Diagnostics** | Transaction boundary log |

#### SC-TXN-02 — Failure before the booking write

| | |
|---|---|
| **Priority · Category · Automate** | P0 · Transaction · YES (integration) |
| **Traceability** | REQ-19 · HB-02 · INV-06 |
| **Preconditions** | Fault injected at owner resolution |
| **Test data** | Valid request |
| **Steps** | 1. `H-CREATE` with the fault. |
| **Expected — UI** | Error |
| **Expected — API** | Non-2xx |
| **Expected — DB** | Nothing written anywhere |
| **Expected — Audit** | None |
| **Expected — Financial** | None |
| **Expected — Owner** | None |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | Unchanged |
| **Cleanup** | None |
| **Diagnostics** | Rollback trace |

#### SC-TXN-03 — Failure after the booking write, before the payment

| | |
|---|---|
| **Priority · Category · Automate** | **P0** · Transaction · YES (integration) |
| **Traceability** | REQ-19 · HB-02, HB-04 · INV-05, INV-06 |
| **Preconditions** | Fault injected at the payment insert |
| **Test data** | Booking plus payment |
| **Steps** | 1. `H-CREATE` with the fault. |
| **Expected — UI** | Error |
| **Expected — API** | Non-2xx |
| **Expected — DB** | Booking and original history persist; no payment, payment-history or payment-idempotency residue |
| **Expected — Audit** | Booking creation only |
| **Expected — Financial** | Snapshot unchanged; no evidence amount |
| **Expected — Owner** | Booking attribution unchanged |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | Unchanged |
| **Cleanup** | None |
| **Policy dependence** | D-PAY-01 is final: booking and payment are separate commands. Payment failure cannot roll back an already committed booking |
| **Diagnostics** | Identical assertion to `SC-PAY-08`, viewed from the transaction layer |

#### SC-TXN-04 — Timeout and retry safety

| | |
|---|---|
| **Priority · Category · Automate** | P1 · Transaction · YES (integration) |
| **Traceability** | REQ-10, REQ-19 · HB-03 · INV-08 |
| **Preconditions** | Client timeout shorter than server processing |
| **Test data** | Same idempotency key on the retry |
| **Steps** | 1. Submit, force a client timeout. 2. Retry with the same key. |
| **Expected — UI** | One booking appears |
| **Expected — API** | Retry does not create a second booking |
| **Expected — DB** | Exactly one booking |
| **Expected — Audit** | One history row |
| **Expected — Financial** | One set of amounts |
| **Expected — Owner** | One attribution |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | Counted once |
| **Cleanup** | Snapshot restore |
| **Diagnostics** | The classic duplicate-creation path |

#### SC-TXN-05 — Deadlock retry

| | |
|---|---|
| **Priority · Category · Automate** | P2 · Transaction · YES (integration) |
| **Traceability** | REQ-19 · HB-03 |
| **Preconditions** | Contended advisory lock |
| **Test data** | Concurrent historical and normal operations on one unit |
| **Steps** | 1. Drive contention. |
| **Expected — UI** | One succeeds; the other reports a clear conflict |
| **Expected — API** | No unhandled 500 |
| **Expected — DB** | Consistent |
| **Expected — Audit** | Consistent |
| **Expected — Financial** | Consistent |
| **Expected — Owner** | Consistent |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | Consistent |
| **Cleanup** | Snapshot restore |
| **Diagnostics** | Lock wait and retry behaviour |

#### SC-TXN-06 — Error contract shape

| | |
|---|---|
| **Priority · Category · Automate** | P1 · Transaction · YES (API) |
| **Traceability** | REQ-01 · HB-02 |
| **Preconditions** | None |
| **Test data** | One request per documented error code |
| **Steps** | 1. Trigger each condition. |
| **Expected — UI** | Each renders an actionable message |
| **Expected — API** | Status and code match [Master §12](00_MASTER_PLAN.md#12-api-and-command-design) exactly |
| **Expected — DB** | Nothing on failures |
| **Expected — Audit** | Refusals logged |
| **Expected — Financial** | Nothing |
| **Expected — Owner** | Nothing |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | Unchanged |
| **Cleanup** | None |
| **Diagnostics** | Codes are a contract; drift breaks the wizard's surfaces |

---

## Group 14 — Regression (`SC-REG-nn`)

### The expected-to-fail set

Exactly **one** scenario in this entire pack is expected to fail when run against the repository as it
stands at `8dafb5a`. A scenario is listed here only when a **reproducible current code path violates it**.

| Scenario | Why it fails today | Evidence | Closed by |
|---|---|---|---|
| `SC-REG-02` | No server-side past-date rule exists on any creation path, so a past-dated booking is accepted | `CONFIRMED` — `BookingService.cs:463-467`, `ValidateStayDates` tests only `checkOutDate <= checkInDate`; no validator in `RentalPlatform.API/Validators/` and no DB `CHECK` in `0016_create_bookings.sql` compares against today | REQ-16 hardening, specified in [HB-01 §11.2](01_TICKET_DISCOVERY_AND_ARCHITECTURE_DECISIONS.md#112-normal-flow-hardening--specification), implemented and activated in [HB-08](08_TICKET_REPORTING_AUDIT_OBSERVABILITY_AND_ROLLOUT.md) |

**Scenarios that are *not* in this set, and why:**

| Scenario | Sometimes mistaken for expected-to-fail | Actual status |
|---|---|---|
| `SC-REG-03` | Update moving dates into the past | **Not reproducible today.** `UpdatePendingAsync` rejects any booking outside `Prospecting`/`Relevant` with `409` (`BookingService.cs:385-387`), and for a booking that *is* prospecting, moving dates into the past is accepted — so the defect is real for that narrow case but the scenario as written spans both. Run it after hardening; before hardening, record the prospecting-only sub-case as the observed baseline |
| `SC-FIN-03` | Repricing overwriting a historical amount | **Prospective invariant**, not a current defect. No historical booking can be edited today, because none can exist and because the same `409` gate blocks completed bookings. See the three-way distinction under `SC-FIN-03` |
| Every scenario referencing new columns, the new endpoint, or the new permission | — | **Not applicable** until the feature exists. Unimplemented is not the same as failing; these are not run against `8dafb5a` at all |

The distinction matters because a release gate that counts "expected failures" will silently absorb a real
regression if the set is padded. Keep it at one entry until a second reproducible violation is demonstrated
with a citation.

#### SC-REG-01 — Normal future booking still works

| | |
|---|---|
| **Priority · Category · Automate** | P0 · Regression · YES (xUnit + API) |
| **Traceability** | REQ-15 · HB-01 |
| **Preconditions** | Clean future window |
| **Test data** | `FUT-IN`/`FUT-OUT` |
| **Steps** | 1. `N-CREATE`. |
| **Expected — UI** | Normal |
| **Expected — API** | `200` |
| **Expected — DB** | Normal booking in `Prospecting` |
| **Expected — Audit** | Normal creation row |
| **Expected — Financial** | Computed pricing |
| **Expected — Owner** | Unit owner |
| **Expected — Notification** | Normal |
| **Expected — Reporting** | Normal |
| **Cleanup** | Snapshot restore |
| **Diagnostics** | The feature must not disturb the mainline |

#### SC-REG-02 — Normal flow rejects past dates after hardening

| | |
|---|---|
| **Priority · Category · Automate** | **P0** · Regression · YES (xUnit per path) |
| **Traceability** | REQ-16 · HB-01 (specification) · **HB-08 (implementation and activation)** · INV-03 |
| **Classification** | **Expected to fail against `8dafb5a`** — the single member of the expected-to-fail set |
| **Preconditions** | Hardening implemented and activated — HB-08 rollout step 9 |
| **Test data** | Past check-in through `N-CREATE`, `Q-CREATE`, client booking, guest booking, owner-portal creation, CRM conversion |
| **Steps** | 1. Attempt a past-dated booking on each path. |
| **Expected — UI** | Error naming the historical flow as the correct route |
| **Expected — API** | `400 STAY_DATES_IN_PAST` on **every** path |
| **Expected — DB** | Nothing written |
| **Expected — Audit** | None |
| **Expected — Financial** | None |
| **Expected — Owner** | None |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | Rejection metric increments |
| **Cleanup** | None |
| **Diagnostics** | **This scenario fails on today's code** — no past-date rule exists (`BookingService.cs:463-467`). HB-01 ratifies the rule; HB-08 implements and activates it as rollout step 9, after the historical flow is live |

#### SC-REG-03 — Update cannot move dates into the past

| | |
|---|---|
| **Priority · Category · Automate** | P0 · Regression · YES (xUnit) |
| **Traceability** | REQ-16 · HB-01 (specification) · **HB-08 (implementation and activation)** · INV-03 |
| **Classification** | Prospective, with a narrow current sub-case — **not** in the expected-to-fail set |
| **Preconditions** | An existing future booking in `Prospecting` (the only status `UpdatePendingAsync` accepts, `BookingService.cs:385-387`) |
| **Test data** | `B-UPDATE` moving check-in to the past |
| **Steps** | 1. Update. |
| **Expected — UI** | Refused |
| **Expected — API** | `400 STAY_DATES_IN_PAST` |
| **Expected — DB** | Dates unchanged |
| **Expected — Audit** | No change row |
| **Expected — Financial** | Unchanged |
| **Expected — Owner** | Unchanged |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | Unchanged |
| **Cleanup** | Snapshot restore |
| **Diagnostics** | Closes the update-path bypass. Scope note: the bypass exists today **only** for `Prospecting`/`Relevant` bookings, because `:385-387` already rejects every other status with `409`. Do not report a `409` on a confirmed booking as a pass for this scenario — it is the pre-existing status gate, not the date rule |

#### SC-REG-04 — CRM lead conversion unaffected

| | |
|---|---|
| **Priority · Category · Automate** | P0 · Regression · YES (xUnit + Playwright) |
| **Traceability** | REQ-15 · HB-01 |
| **Preconditions** | A lead ready to convert with future dates |
| **Test data** | Standard conversion |
| **Steps** | 1. Convert. |
| **Expected — UI** | Normal |
| **Expected — API** | `200` |
| **Expected — DB** | Booking created in `Booked` |
| **Expected — Audit** | Normal |
| **Expected — Financial** | Normal |
| **Expected — Owner** | Unit owner |
| **Expected — Notification** | Normal |
| **Expected — Reporting** | Normal |
| **Cleanup** | Snapshot restore |
| **Diagnostics** | Conversion shares `CreateAsync`, so hardening touches it |

#### SC-REG-05 — Storefront guest booking unaffected

| | |
|---|---|
| **Priority · Category · Automate** | P0 · Regression · YES (Playwright) |
| **Traceability** | REQ-15 · HB-01 |
| **Preconditions** | Storefront reachable |
| **Test data** | Future stay |
| **Steps** | 1. Complete a guest booking. |
| **Expected — UI** | Calendar still disables past dates; booking completes |
| **Expected — API** | `200` |
| **Expected — DB** | Booking created |
| **Expected — Audit** | Normal |
| **Expected — Financial** | Normal |
| **Expected — Owner** | Unit owner |
| **Expected — Notification** | Normal |
| **Expected — Reporting** | Normal |
| **Cleanup** | Snapshot restore |
| **Diagnostics** | The client guard at `UnitBookingWidget.tsx:324` is now backed by a server rule |

#### SC-REG-06 — `AutoCompleteBookingsJob` behaviour unchanged for normal bookings

| | |
|---|---|
| **Priority · Category · Automate** | **P0** · Regression · YES (integration) |
| **Traceability** | REQ-15 · HB-01 |
| **Preconditions** | A normal booking in `CheckIn` with a past checkout |
| **Test data** | Run the sweep before and after the shared-resolver refactor |
| **Steps** | 1. Snapshot the selected set. 2. Refactor. 3. Re-run. |
| **Expected — UI** | Unchanged |
| **Expected — API** | n/a |
| **Expected — DB** | Identical set transitions to `completed` |
| **Expected — Audit** | Same history rows |
| **Expected — Financial** | Unchanged |
| **Expected — Owner** | Unchanged |
| **Expected — Notification** | Same alerts |
| **Expected — Reporting** | Unchanged |
| **Cleanup** | Snapshot restore |
| **Diagnostics** | HB-01 extracts the Cairo boundary into a shared helper; this proves behavioural equivalence |

#### SC-REG-07 — Existing test suite remains green

| | |
|---|---|
| **Priority · Category · Automate** | P0 · Regression · YES (CI) |
| **Traceability** | REQ-15 · HB-09 |
| **Preconditions** | Full suite runnable |
| **Test data** | n/a |
| **Steps** | 1. `dotnet test`. 2. Run the Playwright CRM config. |
| **Expected — UI** | n/a |
| **Expected — API** | n/a |
| **Expected — DB** | n/a |
| **Expected — Audit** | n/a |
| **Expected — Financial** | n/a |
| **Expected — Owner** | n/a |
| **Expected — Notification** | n/a |
| **Expected — Reporting** | n/a |
| **Cleanup** | None |
| **Diagnostics** | Baseline is 33 passing xUnit tests; any drop is a blocker |

---

## Group 15 — Migration and deployment (`SC-MIG-nn`)

#### SC-MIG-01 — Migration forward

| | |
|---|---|
| **Priority · Category · Automate** | P0 · Migration · YES (CI) |
| **Traceability** | REQ-05 · HB-04 |
| **Preconditions** | Database at the pre-feature schema with representative data |
| **Test data** | Normal bookings plus coherent and deliberately incoherent post-0059 HB-02 historical rows |
| **Steps** | 1. Prove incoherent data aborts with no row changed. 2. Correct the disposable row. 3. Apply migration `0060`. 4. Run its verifier. |
| **Expected — UI** | n/a |
| **Expected — API** | n/a |
| **Expected — DB** | Coherent historical rows have `agreed_amount = final_amount`; normal rows remain NULL; both HB-04A constraints exist and are validated |
| **Expected — Audit** | No audit rows created or changed |
| **Expected — Financial** | Existing `base_amount`/`final_amount` are unchanged; only deterministic `agreed_amount` is populated |
| **Expected — Owner** | No attribution altered |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | Existing reports unchanged |
| **Cleanup** | Restore the snapshot |
| **Diagnostics** | Verifier catalogs, preflight violation count, row counts and all-or-nothing transaction evidence |

#### SC-MIG-02 — Old frontend against the new backend

| | |
|---|---|
| **Priority · Category · Automate** | P0 · Migration · YES (manual + API) |
| **Traceability** | REQ-15 · HB-08 |
| **Preconditions** | New backend, previous portal build |
| **Test data** | Normal booking operations |
| **Steps** | 1. Exercise the old portal. |
| **Expected — UI** | Works; the historical wizard is simply absent |
| **Expected — API** | Additive fields ignored by the old client |
| **Expected — DB** | Normal |
| **Expected — Audit** | Normal |
| **Expected — Financial** | Normal |
| **Expected — Owner** | Normal |
| **Expected — Notification** | Normal |
| **Expected — Reporting** | Normal |
| **Cleanup** | None |
| **Diagnostics** | Deploy-order safety |

#### SC-MIG-03 — New frontend against the old backend

| | |
|---|---|
| **Priority · Category · Automate** | P1 · Migration · YES (manual) |
| **Traceability** | REQ-15 · HB-06 |
| **Preconditions** | New portal, previous backend |
| **Test data** | Attempt the historical wizard |
| **Steps** | 1. Open the wizard and submit. |
| **Expected — UI** | Feature hidden, or a graceful unavailable message — never a raw error |
| **Expected — API** | `404` on the endpoint |
| **Expected — DB** | Nothing |
| **Expected — Audit** | None |
| **Expected — Financial** | Nothing |
| **Expected — Owner** | Nothing |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | Unchanged |
| **Cleanup** | None |
| **Diagnostics** | Degradation behaviour |

#### SC-MIG-04 — Permission disabled

| | |
|---|---|
| **Priority · Category · Automate** | P0 · Migration · YES (API) |
| **Traceability** | REQ-11 · HB-08 |
| **Preconditions** | Feature deployed, permission granted to nobody |
| **Test data** | Any user |
| **Steps** | 1. Attempt access. |
| **Expected — UI** | Entry point absent for everyone |
| **Expected — API** | `403` for all |
| **Expected — DB** | Nothing |
| **Expected — Audit** | Refusals logged |
| **Expected — Financial** | Nothing |
| **Expected — Owner** | Nothing |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | Unchanged |
| **Cleanup** | None |
| **Diagnostics** | The permission is the feature flag; this is the effective off switch |

#### SC-MIG-05 — Rollback limitation

| | |
|---|---|
| **Priority · Category · Automate** | **P0** · Migration · NO (manual, staging only) |
| **Traceability** | REQ-05 · HB-04 |
| **Preconditions** | Disposable PostgreSQL with at least one HB-04A snapshot |
| **Test data** | Attempt the migration rollback |
| **Steps** | 1. Record a historical booking. 2. Attempt rollback. 3. Inspect. |
| **Expected — UI** | n/a |
| **Expected — API** | n/a |
| **Expected — DB** | Rollback succeeds only when every `agreed_amount` is still reconstructable from coherent HB-02 amounts; otherwise it fails before dropping anything |
| **Expected — Audit** | Unchanged |
| **Expected — Financial** | No truth is discarded silently |
| **Expected — Owner** | Unchanged |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | Historical rows become invisible as historical |
| **Cleanup** | Disposable database removal |
| **Diagnostics** | Proves guarded safe and unsafe paths; production rollback still requires backup/restore rehearsal and explicit approval |

---

## Group 16 — Performance and observability (`SC-PERF-nn`)

#### SC-PERF-01 — Historical conflict query performance

| | |
|---|---|
| **Priority · Category · Automate** | P1 · Performance · YES (integration) |
| **Traceability** | REQ-09 · HB-03 |
| **Preconditions** | `U-VOLUME-1` carries several thousand historical bookings |
| **Test data** | A conflict check against that unit |
| **Steps** | 1. Run the check. 2. Capture the query plan. |
| **Expected — UI** | Wizard remains responsive |
| **Expected — API** | Well within the request budget |
| **Expected — DB** | Index-backed plan using the existing `ix_bookings_unit_id`, `ix_bookings_check_in_date`, `ix_bookings_check_out_date` |
| **Expected — Audit** | n/a — read path |
| **Expected — Financial** | n/a |
| **Expected — Owner** | n/a |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | n/a |
| **Cleanup** | Snapshot restore |
| **Diagnostics** | Widening the status set increases the candidate rows; confirm no sequential scan appears |

#### SC-PERF-02 — Duplicate detection performance

| | |
|---|---|
| **Priority · Category · Automate** | P1 · Performance · YES (integration) |
| **Traceability** | REQ-10 · HB-03 |
| **Preconditions** | High-volume fixture |
| **Test data** | A probable-duplicate scan |
| **Steps** | 1. Run the scan. 2. Capture the plan. |
| **Expected — UI** | Responsive |
| **Expected — API** | Within budget |
| **Expected — DB** | Index-backed |
| **Expected — Audit** | n/a — read path |
| **Expected — Financial** | n/a |
| **Expected — Owner** | n/a |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | n/a |
| **Cleanup** | Snapshot restore |
| **Diagnostics** | Fuzzy matching must not degrade into a table scan |

#### SC-PERF-03 — Observability signals and PII hygiene

| | |
|---|---|
| **Priority · Category · Automate** | **P0** · Observability · YES (log assertion) |
| **Traceability** | REQ-12 · HB-08 |
| **Preconditions** | Logging and metrics enabled |
| **Test data** | A successful creation, a 409 and a 403 |
| **Steps** | 1. Trigger each. 2. Inspect logs and metrics. |
| **Expected — UI** | n/a |
| **Expected — API** | Respective statuses |
| **Expected — DB** | Per scenario |
| **Expected — Audit** | Events emitted |
| **Expected — Financial** | Amounts in the audit event only |
| **Expected — Owner** | Attribution in the audit event |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | `historical_booking_created_total` and `historical_booking_rejected_total{reason}` increment correctly |
| **Cleanup** | Snapshot restore |
| **Diagnostics** | **Assert no guest name, phone, or email appears in any log line or metric label** |

#### SC-PERF-04 — Reconciliation monitoring

| | |
|---|---|
| **Priority · Category · Automate** | P1 · Observability · YES (SQL) |
| **Traceability** | REQ-18 · HB-08 · INV-13 |
| **Preconditions** | Several historical bookings across different stay months |
| **Test data** | The daily reconciliation query |
| **Steps** | 1. Run it. |
| **Expected — UI** | Reconciliation report |
| **Expected — API** | n/a |
| **Expected — DB** | n/a — read path |
| **Expected — Audit** | n/a |
| **Expected — Financial** | Count and value by stay month **and** by recorded month, both derivable |
| **Expected — Owner** | Owner-attributed booking counts and agreed totals reconcile |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | The two views differ by exactly the historical bookings recorded out of period |
| **Cleanup** | None |
| **Diagnostics** | The ongoing production control for `RISK-07` |

---

## Group 17 — Concurrency (`SC-CONC-nn`)

> Referenced by [HB-03](03_TICKET_AVAILABILITY_CONFLICTS_AND_DUPLICATE_PROTECTION.md). Every scenario here
> requires a **real relational database** — none can run on the EF InMemory harness ([OQ-09](00_MASTER_PLAN.md#32-open-questions)).

#### SC-CONC-01 — Advisory lock is acquired inside a transaction

| | |
|---|---|
| **Priority · Category · Automate** | **P0** · Concurrency · YES (integration) |
| **Traceability** | REQ-19 · HB-03 · INV-05 |
| **Preconditions** | Real Postgres; lock instrumentation enabled |
| **Test data** | A single historical creation |
| **Steps** | 1. `H-CREATE`. 2. Inspect the ordering of `BEGIN` and the lock acquisition. |
| **Expected — UI** | Normal success |
| **Expected — API** | `200` |
| **Expected — DB** | The lock is taken **after** `BEGIN`, so it is released on commit or rollback |
| **Expected — Audit** | Normal |
| **Expected — Financial** | Normal |
| **Expected — Owner** | Normal |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | Normal |
| **Cleanup** | Snapshot restore |
| **Diagnostics** | A transaction-scoped advisory lock taken outside a transaction would either throw or leak. Assert the guard raises if no transaction is open |

#### SC-CONC-02 — Two historical creations serialise

| | |
|---|---|
| **Priority · Category · Automate** | **P0** · Concurrency · YES (integration) |
| **Traceability** | REQ-09, REQ-19 · HB-03 · INV-04 |
| **Preconditions** | Clean window on `U-ACTIVE-1` |
| **Test data** | Two overlapping requests, different clients, fired simultaneously |
| **Steps** | 1. Fire both. |
| **Expected — UI** | One success, one conflict |
| **Expected — API** | Exactly one `200`, one `409 HISTORICAL_OVERLAP_CONFLICT` |
| **Expected — DB** | Exactly one booking |
| **Expected — Audit** | One history row |
| **Expected — Financial** | One set of amounts |
| **Expected — Owner** | One attribution |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | Counted once |
| **Cleanup** | Snapshot restore |
| **Diagnostics** | Same assertion as `SC-AVAIL-11`, viewed from the locking layer |

#### SC-CONC-03 — Historical creation serialises against normal confirmation

| | |
|---|---|
| **Priority · Category · Automate** | P0 · Concurrency · YES (integration) |
| **Traceability** | REQ-09, REQ-15 · HB-03 · INV-04 |
| **Preconditions** | A normal booking on `U-ACTIVE-1` awaiting confirmation, overlapping the historical window |
| **Test data** | Confirm the normal booking and record the historical booking simultaneously |
| **Steps** | 1. Fire both. |
| **Expected — UI** | One succeeds; the other reports a clear conflict |
| **Expected — API** | One `2xx`, one `409` |
| **Expected — DB** | Only one holding record for the window |
| **Expected — Audit** | Consistent |
| **Expected — Financial** | Consistent |
| **Expected — Owner** | Consistent |
| **Expected — Notification** | Only the normal path's notification, if it won |
| **Expected — Reporting** | Consistent |
| **Cleanup** | Snapshot restore |
| **Diagnostics** | Both paths must use the same key format `booking-unit:{unitId:N}`, otherwise they do not serialise against each other |

#### SC-CONC-04 — Idempotency key is required and well-formed

| | |
|---|---|
| **Priority · Category · Automate** | P1 · Concurrency · YES (API) |
| **Traceability** | REQ-10 · **HB-02** · INV-08 |
| **Preconditions** | None |
| **Test data** | Case A: header absent. Case B: malformed value. Case C: valid, replayed with an identical body. Case D: valid, replayed with a **different** body. Case E: a claim that exists without a completion |
| **Steps** | 1. `H-CREATE` for each case. |
| **Expected — UI** | The wizard always supplies a valid key |
| **Expected — API** | A and B `400 IDEMPOTENCY_KEY_REQUIRED`; C `200` with **the original booking id**; D `409 IDEMPOTENCY_KEY_REUSED`; E `409 IDEMPOTENCY_REQUEST_IN_PROGRESS` deterministically on every retry. **Never a second booking id** |
| **Expected — DB** | At most one booking |
| **Expected — Audit** | At most one history row |
| **Expected — Financial** | One set of amounts |
| **Expected — Owner** | One attribution |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | Counted once |
| **Cleanup** | Snapshot restore |
| **Diagnostics** | **Settled — the key is REQUIRED on the historical endpoint** ([D-HB02-IDEM](DECISION_RATIFICATION_PACKET.md#d-hb02-idem--idempotency-ownership-and-contract)). An optional key leaves a duplicate window open by default; the only caller that matters is the HB-06 wizard, which always sends one. There is no naive-API-client constituency for a privileged internal endpoint |

#### SC-CONC-05 — Lock contention does not corrupt state

| | |
|---|---|
| **Priority · Category · Automate** | P1 · Concurrency · YES (integration soak) |
| **Traceability** | REQ-19 · HB-03 · INV-05, INV-06 |
| **Preconditions** | Sustained concurrent load on one unit |
| **Test data** | 20 concurrent mixed operations |
| **Steps** | 1. Drive the load. 2. Assert invariants afterwards. |
| **Expected — UI** | n/a — load test |
| **Expected — API** | No unhandled 500s |
| **Expected — DB** | No overlapping holding bookings; no orphan payments |
| **Expected — Audit** | One history row per created booking |
| **Expected — Financial** | Balances consistent |
| **Expected — Owner** | Attributions consistent |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | Totals reconcile |
| **Cleanup** | Snapshot restore |
| **Diagnostics** | Lock wait times and any deadlock retries |

---

## Group 4 continued — Duplicate prevention

#### SC-DUP-08 — Duplicate detection ignores customer name alone

| | |
|---|---|
| **Priority · Category · Automate** | P1 · Duplicate · YES (xUnit) |
| **Traceability** | REQ-10 · HB-03 |
| **Preconditions** | Two distinct clients share a common name |
| **Test data** | Two bookings, same name, different phone and different dates |
| **Steps** | 1. Record both. |
| **Expected — UI** | No duplicate warning |
| **Expected — API** | `200` for both |
| **Expected — DB** | Two bookings |
| **Expected — Audit** | One history row each |
| **Expected — Financial** | Independent |
| **Expected — Owner** | Independent |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | Both counted |
| **Cleanup** | Snapshot restore |
| **Diagnostics** | Name alone must never be a duplicate key — common names would block legitimate records |

---

## Group 6 continued — Financial calculations

#### SC-FIN-13 — Agreed amount below the computed reference is permitted

| | |
|---|---|
| **Priority · Category · Automate** | P1 · Financial · YES (xUnit) |
| **Traceability** | REQ-05 · HB-04 |
| **Preconditions** | Computed reference 4 500.00 |
| **Test data** | `agreed_amount = 2000.00`, a heavily discounted real agreement |
| **Steps** | 1. `H-CREATE`. |
| **Expected — UI** | The variance from the reference is displayed, not hidden |
| **Expected — API** | `200` |
| **Expected — DB** | `agreed_amount = base_amount = final_amount = 2000.00` |
| **Expected — Audit** | The agreed truth is recorded; no computed reference is persisted |
| **Expected — Financial** | Balance 2 000.00 |
| **Expected — Owner** | Attribution unchanged; no owner/KAZA split is fabricated |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | Revenue 2 000.00 |
| **Cleanup** | Snapshot restore |
| **Diagnostics** | Real offline agreements are frequently discounted; the system must record truth, not policy |

#### SC-FIN-14 — Fees and taxes are folded into the agreed total

| | |
|---|---|
| **Priority · Category · Automate** | P2 · Financial · NO (documentation check) |
| **Traceability** | REQ-05 · HB-04 |
| **Preconditions** | A real agreement with a separate cleaning fee |
| **Test data** | 3 500.00 stay plus 400.00 cleaning |
| **Steps** | 1. Attempt to record the components separately. |
| **Expected — UI** | Only a single agreed total is offered |
| **Expected — API** | Single amount field |
| **Expected — DB** | `agreed_amount = 3900.00` as one figure |
| **Expected — Audit** | The breakdown may be captured in the free-text note only |
| **Expected — Financial** | Total correct; the breakdown is not machine-readable |
| **Expected — Owner** | No owner/KAZA split is fabricated |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | No fee dimension exists to report |
| **Cleanup** | Snapshot restore |
| **Diagnostics** | Owner-approved v1 boundary: fees, tax and discounts are represented only inside the agreed total and have no component reporting |

---

## Group 7 continued — Payments

#### SC-PAY-10 — Refund or negative adjustment is not representable

| | |
|---|---|
| **Priority · Category · Automate** | P2 · Payments · NO (documentation check) |
| **Traceability** | REQ-06 · HB-04 |
| **Preconditions** | A historical booking with a payment |
| **Test data** | Attempt to record a −500.00 refund |
| **Steps** | 1. Attempt a negative payment. |
| **Expected — UI** | No refund control exists |
| **Expected — API** | `400 VALIDATION_ERROR` |
| **Expected — DB** | Rejected by `ck_payments_amount_positive CHECK (amount > 0)` even if validation were bypassed |
| **Expected — Audit** | None |
| **Expected — Financial** | The refund cannot be recorded |
| **Expected — Owner** | Unaffected |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | Refund invisible |
| **Cleanup** | None |
| **Diagnostics** | Owner-approved v1 boundary: correction/reversal/refund requires a future separately ratified command; HB-04B must not encode it as negative or net evidence |

---

## Group 8 continued — Owner accounting

#### SC-OWN-12 — Live owner profile changes do not rewrite attribution

| | |
|---|---|
| **Priority · Category · Automate** | **P0** · Owner · YES (xUnit + integration) |
| **Traceability** | REQ-08 · HB-05 · INV-14 |
| **Preconditions** | Historical booking attributed to `O-ALPHA` |
| **Test data** | Change an owner profile field, including `CommissionRate`, without invoking HB-05 |
| **Steps** | 1. Change the owner profile. 2. Re-read the booking and every derived surface. |
| **Expected — UI** | Persisted booking attribution remains `O-ALPHA`; no historical commission claim is displayed |
| **Expected — API** | Booking owner ID and financial snapshot unchanged |
| **Expected — DB** | `bookings.owner_id`, `agreed_amount`, `base_amount` and `final_amount` unchanged |
| **Expected — Audit** | No change entry |
| **Expected — Financial** | No booking financial field or payout changed |
| **Expected — Owner** | Attribution unchanged |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | Historical attribution remains based on the booking owner ID |
| **Cleanup** | Restore the rate |
| **Diagnostics** | Targets accidental resynchronization; no nonexistent commission snapshot is asserted |

#### SC-OWN-13 — Owner correction has no accounting side effects

| | |
|---|---|
| **Priority · Category · Automate** | P0 · Owner · YES (xUnit) |
| **Traceability** | REQ-08 · HB-05 |
| **Preconditions** | Historical booking has no payout; actor is authorized for correction |
| **Test data** | Correct from `O-ALPHA` to `O-BETA` |
| **Steps** | 1. Capture booking financials and payment/invoice/payout counts. 2. Correct owner. 3. Compare. |
| **Expected — UI** | Only attribution before/after is displayed |
| **Expected — API** | `200` without financial split fields |
| **Expected — DB** | Owner ID and immutable correction chain change; all financial rows and amounts remain identical |
| **Expected — Audit** | One correction row and one concise history link |
| **Expected — Financial** | No fabricated owner/KAZA calculation |
| **Expected — Owner** | Attribution changes explicitly |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | Owner attribution changes on owner-axis reports; totals do not change |
| **Cleanup** | Snapshot restore |
| **Diagnostics** | Proves HB-05 is attribution-only and does not smuggle in payout reconciliation |

#### SC-OWN-14 — Correction against any payout is refused

| | |
|---|---|
| **Priority · Category · Automate** | **P0** · Owner · YES (integration) |
| **Traceability** | REQ-07 · HB-05 · INV-09 |
| **Preconditions** | Historical bookings with `Pending`, `Scheduled`, `Paid` and `Cancelled` payouts |
| **Test data** | One correction attempt per state |
| **Steps** | 1. Attempt every correction. |
| **Expected — UI** | Administrative payout-review refusal |
| **Expected — API** | `409 OWNER_CORRECTION_PAYOUT_REVIEW_REQUIRED` for every state |
| **Expected — DB** | Payout row **byte-identical**; booking attribution unchanged |
| **Expected — Audit** | Refusal logged |
| **Expected — Financial** | Nothing altered |
| **Expected — Owner** | Nothing altered |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | Unchanged |
| **Cleanup** | None |
| **Diagnostics** | The only allowed state is no payout row. A future adjustment command must be separately ratified |

#### SC-OWN-15 — Owner correction produces a full audit

| | |
|---|---|
| **Priority · Category · Automate** | P0 · Owner · YES (integration) |
| **Traceability** | REQ-07, REQ-12 · HB-05 |
| **Preconditions** | Historical booking attributed to `O-ALPHA`; no payout; actor holds `bookings:correct_owner_attribution` |
| **Test data** | Review returns `expectedCurrentOwnerId = O-ALPHA`; correct to `O-BETA` with a reason |
| **Steps** | 1. Perform the correction with the reviewed expected ID. 2. Inspect the audit. |
| **Expected — UI** | Correction is a distinct flow, not the normal booking edit screen |
| **Expected — API** | `200` |
| **Expected — DB** | `owner_id = O-BETA`; one immutable correction row; agreed/base/final amounts remain coherent |
| **Expected — Audit** | Before/after owner, reason, actor, timestamp and correction ID preserved |
| **Expected — Financial** | Agreed/base/final amounts and all payment/invoice/payout rows unchanged |
| **Expected — Owner** | Persisted attribution changes from `O-ALPHA` to `O-BETA` |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | Owner-attributed booking counts and agreed totals move consistently; no commission split is generated |
| **Cleanup** | Snapshot restore |
| **Diagnostics** | A correction without a full before/after trail is indistinguishable from tampering |

#### SC-OWN-16 — Correction cannot silently mutate a finalized settlement

| | |
|---|---|
| **Priority · Category · Automate** | **P0** · Owner · YES (integration) |
| **Traceability** | REQ-07 · HB-05 · INV-09 |
| **Preconditions** | `O-ALPHA` has a paid payout for the booking |
| **Test data** | Force a correction attempt through the API |
| **Steps** | 1. Attempt. 2. Compare the payout row before and after. |
| **Expected — UI** | Refusal |
| **Expected — API** | `409 OWNER_CORRECTION_PAYOUT_REVIEW_REQUIRED` |
| **Expected — DB** | Payout unchanged in every column including `paid_at` |
| **Expected — Audit** | Refusal recorded |
| **Expected — Financial** | Settled money untouched |
| **Expected — Owner** | Balance unchanged |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | Unchanged |
| **Cleanup** | None |
| **Diagnostics** | The strongest financial-integrity assertion for owners |

#### SC-OWN-17 — Normal bookings still snapshot the owner from the unit, with no owner field exposed

| | |
|---|---|
| **Priority · Category · Automate** | P0 · Owner · YES (xUnit + contract test) |
| **Traceability** | REQ-15 · HB-05 |
| **Preconditions** | Normal flow available |
| **Test data** | `N-CREATE` with an injected `ownerId = O-BETA`; also inspect the DTO contract |
| **Steps** | 1. `N-CREATE`. 2. Assert the request contract exposes no owner field. |
| **Expected — UI** | No owner control on the normal form |
| **Expected — API** | `200`; the injected field is absent from the contract and ignored |
| **Expected — DB** | `owner_id = unit.OwnerId` |
| **Expected — Audit** | Normal |
| **Expected — Financial** | Normal |
| **Expected — Owner** | Normal booking remains attributed to the unit owner |
| **Expected — Notification** | Normal |
| **Expected — Reporting** | Normal |
| **Cleanup** | Snapshot restore |
| **Diagnostics** | Guards `BookingService.cs:225` and proves the historical correction surface did not leak into the normal flow |

#### SC-OWN-18 — Correction uses correction-specific attribution uncertainty transport

| | |
|---|---|
| **Priority · Category · Automate** | P0 · Owner · YES (API + integration) |
| **Traceability** | REQ-07 · HB-05 · AC-HB05-25 |
| **Preconditions** | Historical booking whose persisted owner is missing, soft-deleted, unsupported or incoherent |
| **Test data** | Review and correction requests for the same booking |
| **Steps** | 1. Request read-only review. 2. Attempt correction. 3. Compare coded transport and database state. |
| **Expected — UI** | Administrative-review guidance without owner PII |
| **Expected — API** | Review: `409 OWNER_ATTRIBUTION_REQUIRES_REVIEW`; correction: `409 OWNER_CORRECTION_CURRENT_ATTRIBUTION_REQUIRES_REVIEW` |
| **Expected — DB** | No booking, correction, history, payout or completed-idempotency mutation |
| **Expected — Audit** | No success event |
| **Expected — Financial** | Unchanged |
| **Expected — Owner** | Unchanged; no inferred replacement |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | Unchanged |
| **Cleanup** | Snapshot restore |
| **Diagnostics** | Proves correction never overloads HB-02 review/creation transport |

---

## Group 9 continued — Notifications and integrations

#### SC-NOTIF-07 — Notification count is unchanged across every rejection path

| | |
|---|---|
| **Priority · Category · Automate** | P1 · Notifications · YES (xUnit) |
| **Traceability** | REQ-13 · HB-07 |
| **Preconditions** | Baseline count captured |
| **Test data** | One request per rejection code |
| **Steps** | 1. Trigger each rejection. 2. Recount. |
| **Expected — UI** | Errors shown |
| **Expected — API** | Respective error codes |
| **Expected — DB** | Nothing written |
| **Expected — Audit** | Refusals only |
| **Expected — Financial** | Nothing |
| **Expected — Owner** | Nothing |
| **Expected — Notification** | Count identical throughout |
| **Expected — Reporting** | Unchanged |
| **Cleanup** | None |
| **Diagnostics** | Failed attempts must be as silent as successful ones |

#### SC-NOTIF-08 — No housekeeping, cleaning or calendar task is created

| | |
|---|---|
| **Priority · Category · Automate** | P1 · Notifications · YES (DB assertion) |
| **Traceability** | REQ-13 · HB-07 |
| **Preconditions** | Historical creation |
| **Test data** | Standard request |
| **Steps** | 1. `H-CREATE`. 2. Search for any task or calendar artefact. |
| **Expected — UI** | No task appears |
| **Expected — API** | `200` |
| **Expected — DB** | No task rows — **no such table exists** |
| **Expected — Audit** | Booking audit only |
| **Expected — Financial** | Normal |
| **Expected — Owner** | Normal |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | Normal |
| **Cleanup** | Snapshot restore |
| **Diagnostics** | Confirms the absence finding: no housekeeping, cleaning, calendar or task subsystem exists in the repository |

#### SC-NOTIF-09 — No outbox or domain event is enqueued

| | |
|---|---|
| **Priority · Category · Automate** | P1 · Notifications · YES (code + DB assertion) |
| **Traceability** | REQ-13 · HB-07 |
| **Preconditions** | Historical creation |
| **Test data** | Standard request |
| **Steps** | 1. `H-CREATE`. 2. Search for outbox or event rows. |
| **Expected — UI** | n/a |
| **Expected — API** | `200` |
| **Expected — DB** | No outbox or event table exists |
| **Expected — Audit** | Booking audit only |
| **Expected — Financial** | Normal |
| **Expected — Owner** | Normal |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | Normal |
| **Cleanup** | Snapshot restore |
| **Diagnostics** | Confirms no outbox, MediatR, or domain-event infrastructure exists |

#### SC-NOTIF-10 — External-channel state machine is untouched

| | |
|---|---|
| **Priority · Category · Automate** | P2 · Notifications · YES (DB assertion) |
| **Traceability** | REQ-13 · HB-07 |
| **Preconditions** | Historical creation |
| **Test data** | Standard request |
| **Steps** | 1. `H-CREATE`. 2. Inspect `NotificationDeliveryLog`. |
| **Expected — UI** | n/a |
| **Expected — API** | `200` |
| **Expected — DB** | No delivery-log rows added |
| **Expected — Audit** | Booking audit only |
| **Expected — Financial** | Normal |
| **Expected — Owner** | Normal |
| **Expected — Notification** | No queued, sent, delivered or failed rows |
| **Expected — Reporting** | Notification analytics unchanged |
| **Cleanup** | Snapshot restore |
| **Diagnostics** | The dispatch service is a state machine only; nothing should enter it |

#### SC-NOTIF-11 — A future delivery implementation must respect historical mode

| | |
|---|---|
| **Priority · Category · Automate** | P2 · Notifications · NO (design review gate) |
| **Traceability** | REQ-13 · HB-07 |
| **Preconditions** | A future email/WhatsApp delivery implementation exists on a test branch |
| **Test data** | Design review of that change |
| **Steps** | 1. Review the side-effect matrix. 2. Confirm historical exclusion. |
| **Expected — UI** | n/a — process control |
| **Expected — API** | n/a |
| **Expected — DB** | n/a |
| **Expected — Audit** | Review recorded |
| **Expected — Financial** | n/a |
| **Expected — Owner** | n/a |
| **Expected — Notification** | Any new channel must derive historical mode from the persisted `is_historical` column, never from a request field |
| **Expected — Reporting** | n/a |
| **Cleanup** | None |
| **Diagnostics** | Today suppression is structural because no delivery exists. That guarantee weakens the moment delivery is built — this gate exists so the matrix is revisited |

#### SC-NOTIF-12 — No automatic analytics event in v1

| | |
|---|---|
| **Priority · Category · Automate** | P1 · Notifications · YES (code + integration assertion) |
| **Traceability** | REQ-13 · HB-07 |
| **Preconditions** | Historical creation |
| **Test data** | Standard request |
| **Steps** | 1. Search for any analytics emission on the creation path. |
| **Expected — UI** | No browser analytics emission |
| **Expected — API** | `200` |
| **Expected — DB** | No analytics or outbox row |
| **Expected — Audit** | Booking audit only |
| **Expected — Financial** | Normal |
| **Expected — Owner** | Normal |
| **Expected — Notification** | None |
| **Expected — Reporting** | Durable reporting derives from domain rows only |
| **Cleanup** | Snapshot restore |
| **Diagnostics** | HB-07 performs one positive repository-wide integration audit; no per-request query or metrics platform is added |

---

## Group 11 continued — Reporting

#### SC-REP-09 — Stay-axis query path

| | |
|---|---|
| **Priority · Category · Automate** | P0 · Reporting · YES (SQL + API) |
| **Traceability** | REQ-18 · HB-08 · INV-13 |
| **Preconditions** | Historical bookings across several stay months |
| **Test data** | Query by stay period with and without `includeHistorical` |
| **Steps** | 1. Query both ways. |
| **Expected — UI** | Reporting screen offers a stay-period axis |
| **Expected — API** | Stay-axis totals returned; the filter changes the result predictably |
| **Expected — DB** | n/a — read path |
| **Expected — Audit** | n/a |
| **Expected — Financial** | Stay-month revenue derivable |
| **Expected — Owner** | Owner-attributed booking counts and agreed totals are derivable by stay period |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | Both axes reconcile to the same grand total |
| **Cleanup** | Snapshot restore |
| **Diagnostics** | The core deliverable of ADR-11 |

#### SC-REP-10 — Payment reporting separates unlinked historical evidence

| | |
|---|---|
| **Priority · Category · Automate** | **P0** · Reporting · YES (SQL) |
| **Traceability** | REQ-18 · HB-08 |
| **Preconditions** | Historical payment with `invoice_id = NULL` |
| **Test data** | Payment reporting query |
| **Steps** | 1. Query payment reporting. 2. Compare with the invoice-linked read models. |
| **Expected — UI** | Payment appears |
| **Expected — API** | Included only in dedicated historical-evidence totals |
| **Expected — DB** | Payment exists, unlinked |
| **Expected — Audit** | n/a |
| **Expected — Financial** | Evidence amount is excluded from invoice-linked and ordinary orphan totals |
| **Expected — Owner** | No automatic invoice, payout or settlement implication |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | Dedicated count/amount reconciles exactly and prevents double-counting |
| **Cleanup** | Snapshot restore |
| **Diagnostics** | Pairs with `SC-REP-06`; historical evidence remains standalone even when a manual invoice exists |

#### SC-REP-11 — Dashboard cards do not contradict each other

| | |
|---|---|
| **Priority · Category · Automate** | P1 · Reporting · YES (API) |
| **Traceability** | REQ-18 · HB-08 |
| **Preconditions** | A historical booking recorded today for a past stay |
| **Test data** | Load the dashboard |
| **Steps** | 1. Compare every card that could disagree. |
| **Expected — UI** | No two cards state contradictory totals for the same period |
| **Expected — API** | Consistent |
| **Expected — DB** | n/a — read path |
| **Expected — Audit** | n/a |
| **Expected — Financial** | Consistent |
| **Expected — Owner** | Consistent |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | Where axes genuinely differ, each card states which axis it uses |
| **Cleanup** | Snapshot restore |
| **Diagnostics** | Silent contradiction between cards destroys trust faster than a known caveat |

#### SC-REP-12 — Dashboard booking count on the recording day

| | |
|---|---|
| **Priority · Category · Automate** | P1 · Reporting · YES (API) |
| **Traceability** | REQ-18 · HB-08 |
| **Preconditions** | Baseline count captured |
| **Test data** | One historical booking |
| **Steps** | 1. Capture the count. 2. `H-CREATE`. 3. Recapture. |
| **Expected — UI** | Count increments by exactly one on the recording day |
| **Expected — API** | +1 |
| **Expected — DB** | n/a — derived |
| **Expected — Audit** | n/a |
| **Expected — Financial** | Revenue +agreed amount today |
| **Expected — Owner** | Owner-attributed booking count and agreed total increase; no owner share is inferred |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | Documented as recorded-axis behaviour; an optional historical series makes it explicable |
| **Cleanup** | Snapshot restore |
| **Diagnostics** | Ops must not read the spike as new sales activity |

#### SC-REP-13 — Owner portal shows a stay the owner may not recognise

| | |
|---|---|
| **Priority · Category · Automate** | P1 · Reporting · YES (Playwright) |
| **Traceability** | REQ-18 · HB-08 |
| **Preconditions** | Historical booking attributed to `O-ALPHA` |
| **Test data** | Sign in to the owner portal |
| **Steps** | 1. View bookings and finance. |
| **Expected — UI** | The stay appears with its true past dates |
| **Expected — API** | Included |
| **Expected — DB** | n/a — read path |
| **Expected — Audit** | n/a |
| **Expected — Financial** | Agreed amount visible; no inferred owner share or commission |
| **Expected — Owner** | Owner sees a booking that appeared after the fact |
| **Expected — Notification** | No owner notification is sent |
| **Expected — Reporting** | Documented; support runbook explains it |
| **Cleanup** | Snapshot restore |
| **Diagnostics** | No code change required, but a real support consequence — owners will ask why a stay appeared late |

#### SC-REP-14 — Reconciliation tool is stay-filterable on day one

| | |
|---|---|
| **Priority · Category · Automate** | P1 · Reporting · YES (SQL) |
| **Traceability** | REQ-18 · HB-08 · INV-13 |
| **Preconditions** | Mixed historical and normal bookings |
| **Test data** | The reconciliation query |
| **Steps** | 1. Run with and without the historical filter. |
| **Expected — UI** | Ops-facing report |
| **Expected — API** | n/a |
| **Expected — DB** | n/a — read path |
| **Expected — Audit** | n/a |
| **Expected — Financial** | Difference equals exactly the historical bookings recorded out of period |
| **Expected — Owner** | Owner-attributed booking counts and agreed totals reconcile across both axes |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | Already stay-filterable without waiting for the full ADR-11 work |
| **Cleanup** | None |
| **Diagnostics** | The day-one operational control while broader reporting changes land |

---

## Group 12 continued — UI and UX

#### SC-UI-08 — Loading and in-flight states

| | |
|---|---|
| **Priority · Category · Automate** | P1 · UI · YES (Playwright) |
| **Traceability** | REQ-01 · HB-06 |
| **Preconditions** | Latency injected on the endpoint |
| **Test data** | Slow submit |
| **Steps** | 1. Submit. 2. Attempt to submit again while in flight. 3. Hold the post-create owner-review GET and inspect state. |
| **Expected — UI** | Submit control disabled with a visible pending state; no double submission possible; after `200`, booking success is visible and irreversible while owner review loads |
| **Expected — API** | One booking POST, followed only after success by one owner-review GET using the returned booking ID |
| **Expected — DB** | One booking |
| **Expected — Audit** | One history row |
| **Expected — Financial** | One set of amounts |
| **Expected — Owner** | One attribution |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | Counted once |
| **Cleanup** | Snapshot restore |
| **Diagnostics** | Complements `SC-DUP-07` from the UI side |

#### SC-UI-09 — Error recovery without data loss

| | |
|---|---|
| **Priority · Category · Automate** | P1 · UI · YES (Playwright) |
| **Traceability** | REQ-01 · HB-06 |
| **Preconditions** | Wizard fully filled |
| **Test data** | Force a server error, then succeed |
| **Steps** | 1. Submit and fail. 2. Correct. 3. Resubmit. |
| **Expected — UI** | All entered data retained; the error is actionable and names the offending step |
| **Expected — API** | Error then `200` |
| **Expected — DB** | One booking after success |
| **Expected — Audit** | One history row |
| **Expected — Financial** | Correct |
| **Expected — Owner** | Correct |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | Correct |
| **Cleanup** | Snapshot restore |
| **Diagnostics** | Losing a six-step form on an error is a severe usability defect |

#### SC-UI-10 — Long values and text overflow

| | |
|---|---|
| **Priority · Category · Automate** | P2 · UI · YES (Playwright) |
| **Traceability** | REQ-01 · HB-06 |
| **Preconditions** | Fixtures with long names |
| **Test data** | Very long client, unit and owner names; a maximum-length note |
| **Steps** | 1. Complete the wizard with these values. |
| **Expected — UI** | No layout break; text truncates or wraps; the review step remains readable |
| **Expected — API** | `200`; length limits enforced |
| **Expected — DB** | Values stored within column limits |
| **Expected — Audit** | Normal |
| **Expected — Financial** | Normal |
| **Expected — Owner** | Normal |
| **Expected — Notification** | Unchanged |
| **Expected — Reporting** | Normal |
| **Cleanup** | Snapshot restore |
| **Diagnostics** | Capture screenshots at each viewport |

---

## Traceability matrices

### How completeness is claimed

The traceability contract is `REQ-nn → ADR-nn → HB-nn → AC/NAC-HBnn-nn → SC-GROUP-nn`, and it must hold in
both directions. Two of the five links are enumerated **individually** (requirements, scenarios) and one is
enumerated by **contiguous range** (acceptance criteria). A range mapping is used only where the range is
verifiably contiguous — every `AC-HBnn-nn` and `NAC-HBnn-nn` in this pack numbers from `01` with no gaps, so
a range unambiguously includes every member.

| Link | Enumeration | Where |
|---|---|---|
| `REQ → SC` | Individual | [Requirement → scenarios](#requirement-to-scenarios) |
| `HB → SC` | Individual | [Ticket → scenarios](#ticket-to-scenarios) |
| `REQ → ADR → HB` | Individual | [Requirement → ADR → ticket](#requirement-to-adr-to-ticket) |
| `HB → AC/NAC` | **Contiguous range** | [Ticket → acceptance criteria](#ticket-to-acceptance-criteria) |
| `SC → AC/NAC → HB → REQ` | Group-level, individual per group | [Scenario group → tickets and requirements](#scenario-group-to-tickets-and-requirements) |

**Counts.** These are the numbers the completeness claim rests on; recount them after any edit.

| Item | Defined | Mapped | Unmapped | Duplicate ids | Dangling references |
|---|---|---|---|---|---|
| Requirements `REQ-01 … REQ-20` | 20 | 20 | 0 | 0 | 0 |
| Architecture decisions `ADR-01 … ADR-12` | 12 | 12 | 0 | 0 | 0 |
| Tickets `HB-01 … HB-09` | 9 | 9 | 0 | 0 | 0 |
| Acceptance criteria `AC-HBnn-nn` | 208 | 208 | 0 | 0 | 0 |
| Negative acceptance criteria `NAC-HBnn-nn` | 155 | 155 | 0 | 0 | 0 |
| Reliability scenarios `SC-GROUP-nn` | 160 | 160 | 0 | 0 | 0 |
| Scenario groups | 17 | 17 | 0 | 0 | 0 |

### Requirement to ADR to ticket

| Requirement | ADR | Ticket(s) that satisfy it |
|---|---|---|
| REQ-01 dedicated separate flow | ADR-01 | HB-02, HB-06 |
| REQ-02 never backdate `CreatedAt` | ADR-04 | HB-02 |
| REQ-03 capture agreement date | ADR-05 | HB-02 |
| REQ-04 reason and original source | ADR-05, ADR-06 | HB-02 |
| REQ-05 protected agreed financials | ADR-07 | HB-04 |
| REQ-06 historical payments | ADR-07 | HB-04 |
| REQ-07 owner attribution | ADR-08 | HB-05 |
| REQ-08 owner-attribution chain and financial/payout safety | ADR-08 | HB-05 |
| REQ-09 overlap prevention | ADR-10 | HB-03 |
| REQ-10 duplicate prevention | ADR-10 | HB-03 |
| REQ-11 dedicated permission | ADR-01 | HB-02, HB-06 |
| REQ-12 truthful audit | ADR-04 | HB-02, HB-08 |
| REQ-13 suppress automation | ADR-04 | HB-07 |
| REQ-14 keep accounting updates | ADR-07, ADR-11 | HB-04, HB-07, HB-08 |
| REQ-15 availability integrity | ADR-10 | HB-03, HB-08 |
| REQ-16 harden the normal flow | ADR-09 | **HB-01 (specification) → HB-08B (separate post-pilot implementation)** |
| REQ-17 inactive units | ADR-12 | HB-03 |
| REQ-18 reporting reconcilable | ADR-11 | HB-08 |
| REQ-19 atomic creation | ADR-04 | HB-02, HB-03 |
| REQ-20 no hold policy | ADR-02 | HB-03 — asserted by absence |

### Ticket to acceptance criteria

Every AC and NAC identifier in this pack is covered by exactly one range below. Each range is **contiguous
from `01`**, so membership is unambiguous: `AC-HB04-14` is in `AC-HB04-01 … AC-HB04-14` and nowhere else.

| Ticket | Acceptance criteria | Count | Negative acceptance criteria | Count | Requirements covered |
|---|---|---|---|---|---|
| HB-01 | `AC-HB01-01` … `AC-HB01-10` | 10 | `NAC-HB01-01` … `NAC-HB01-08` | 8 | REQ-16 (specification) |
| HB-02 | `AC-HB02-01` … `AC-HB02-41` | 41 | `NAC-HB02-01` … `NAC-HB02-38` | 38 | REQ-01, REQ-02, REQ-03, REQ-04, REQ-11, REQ-12, REQ-19 |
| HB-03 | `AC-HB03-01` … `AC-HB03-20` | 20 | `NAC-HB03-01` … `NAC-HB03-14` | 14 | REQ-09, REQ-10, REQ-15, REQ-17, REQ-19, REQ-20 |
| HB-04A | `AC-HB04-01` … `AC-HB04-14` | 14 | `NAC-HB04-01` … `NAC-HB04-12` | 12 | REQ-05, REQ-14 |
| HB-04B | `AC-HB04B-01` … `AC-HB04B-09` | 9 | `NAC-HB04B-01` … `NAC-HB04B-05` | 5 | REQ-06, REQ-14 |
| HB-05 | `AC-HB05-01` … `AC-HB05-27` | 27 | `NAC-HB05-01` … `NAC-HB05-17` | 17 | REQ-07, REQ-08 |
| HB-06 | `AC-HB06-01` … `AC-HB06-24` | 24 | `NAC-HB06-01` … `NAC-HB06-15` | 15 | REQ-01, REQ-11 |
| HB-07 | `AC-HB07-01` … `AC-HB07-15` | 15 | `NAC-HB07-01` … `NAC-HB07-14` | 14 | REQ-13, REQ-14 |
| HB-08 | `AC-HB08-01` … `AC-HB08-26` | 26 | `NAC-HB08-01` … `NAC-HB08-18` | 18 | REQ-12, REQ-14, REQ-15, REQ-16 (implementation), REQ-18 |
| HB-09 | `AC-HB09-01` … `AC-HB09-22` | 22 | `NAC-HB09-01` … `NAC-HB09-14` | 14 | All — HB-09 automates the pack |
| **Observed at contract closure; CI recounts dynamically** | | **208** | | **155** | 20 of 20 |

`AC-HB08-23` … `AC-HB08-26` and `NAC-HB08-16` … `NAC-HB08-18` are the REQ-16 hardening criteria, added when
implementation moved from HB-01 to HB-08. They are the runtime counterparts of `AC-HB01-01` … `AC-HB01-05`,
which a document alone can satisfy. REQ-16 therefore has unbroken specification-to-proof coverage.

### Scenario group to tickets and requirements

The reverse direction, `SC → AC/NAC → HB → REQ`. Every one of the 160 scenarios belongs to exactly one of
these 17 groups, and every group resolves to a ticket and its criterion range.

| Group | Count | Ticket(s) | AC/NAC range | Requirements |
|---|---|---|---|---|
| `SC-HAPPY-01` … `-07` | 7 | HB-02 | `AC-HB02-01` … `-41`, `NAC-HB02-01` … `-38` | REQ-01, REQ-02, REQ-03 |
| `SC-DATE-01` … `-10` | 10 | HB-02 (boundary), HB-08 (hardening) | `AC-HB02-*`, `AC-HB08-23` … `-26` | REQ-03, REQ-16 |
| `SC-AVAIL-01` … `-12` | 12 | HB-03 | `AC-HB03-01` … `-20`, `NAC-HB03-01` … `-14` | REQ-09, REQ-15, REQ-17 |
| `SC-DUP-01` … `-08` | 8 | HB-03 | same range | REQ-10 |
| `SC-SEC-01` … `-12` | 12 | HB-02, HB-05, HB-06 | `AC-HB02-*`, `AC-HB05-*`, `AC-HB06-*` | REQ-11, REQ-07 |
| `SC-FIN-01` … `-14` | 14 | HB-04A, HB-05 | `AC-HB04-01` … `-14`, `AC-HB05-*` | REQ-05, REQ-08 |
| `SC-PAY-01` … `-10` | 10 | HB-04B | `AC-HB04B-01` … `-09`, `NAC-HB04B-01` … `-05` | REQ-06 |
| `SC-OWN-01` … `-18` | 18 | HB-05 | `AC-HB05-01` … `-27`, `NAC-HB05-01` … `-17` | REQ-07, REQ-08 |
| `SC-NOTIF-01` … `-12` | 12 | HB-07 | `AC-HB07-01` … `-15`, `NAC-HB07-01` … `-14` | REQ-13, REQ-14 |
| `SC-AUDIT-01` … `-06` | 6 | HB-02, HB-08 | `AC-HB02-*`, `AC-HB08-11` … `-13` | REQ-12 |
| `SC-REP-01` … `-14` | 14 | HB-08 | `AC-HB08-01` … `-22` | REQ-18, REQ-14 |
| `SC-UI-01` … `-10` | 10 | HB-06 | `AC-HB06-01` … `-24`, `NAC-HB06-01` … `-15` | REQ-01, REQ-11 |
| `SC-TXN-01` … `-06` | 6 | HB-02, HB-04A, HB-04B | `AC-HB02-13`, `-14`, `AC-HB04-11`, `AC-HB04B-02` … `-04` | REQ-19 |
| `SC-REG-01` … `-07` | 7 | HB-08 (hardening), HB-09 | `AC-HB08-23` … `-26`, `AC-HB09-*` | REQ-15, REQ-16 |
| `SC-MIG-01` … `-05` | 5 | HB-04A, HB-06, HB-08 | `AC-HB04-07` … `-14`, `AC-HB08-05`, `-06` | REQ-05, REQ-11, REQ-15 |
| `SC-PERF-01` … `-04` | 4 | HB-03, HB-08 | `AC-HB03-*`, `AC-HB08-13` | REQ-09, REQ-10, REQ-12, REQ-18 |
| `SC-CONC-01` … `-05` | 5 | HB-03 | `AC-HB03-01` … `-20` | REQ-09, REQ-19 |
| **Total** | **160** | | | 20 of 20 |

### Requirement to scenarios

| Requirement | Scenarios |
|---|---|
| REQ-01 dedicated separate flow | `SC-HAPPY-01`, `SC-UI-01`, `SC-UI-02`, `SC-UI-04`, `SC-TXN-06` |
| REQ-02 never backdate `CreatedAt` | `SC-HAPPY-01`, `SC-SEC-07`, `SC-AUDIT-03` |
| REQ-03 capture agreement date | `SC-HAPPY-01`, `SC-DATE-10`, `SC-AUDIT-03` |
| REQ-04 reason and original source | `SC-SEC-09`, `SC-AUDIT-04`, `SC-REP-07` |
| REQ-05 protected agreed financials | `SC-FIN-01`, `SC-FIN-02`, `SC-FIN-03`, `SC-FIN-09`, `SC-FIN-13`, `SC-FIN-14`, `SC-MIG-01`, `SC-MIG-05` |
| REQ-06 historical payments | `SC-HAPPY-02`, `SC-PAY-01`…`SC-PAY-10` |
| REQ-07 owner attribution | `SC-OWN-01`…`SC-OWN-08`, `SC-OWN-14`…`SC-OWN-18`, `SC-SEC-11` |
| REQ-08 owner-attribution chain and financial/payout safety | `SC-FIN-05`, `SC-FIN-06`, `SC-OWN-09`, `SC-OWN-11`, `SC-OWN-12`, `SC-OWN-13`, `SC-SEC-08` |
| REQ-09 overlap prevention | `SC-AVAIL-01`…`SC-AVAIL-06`, `SC-AVAIL-11`, `SC-AVAIL-12`, `SC-DUP-03`, `SC-CONC-02`, `SC-CONC-03`, `SC-PERF-01` |
| REQ-10 duplicate prevention | `SC-DUP-01`…`SC-DUP-08`, `SC-CONC-04`, `SC-TXN-04`, `SC-PERF-02` |
| REQ-11 dedicated permission | `SC-SEC-01`…`SC-SEC-06`, `SC-SEC-10`, `SC-UI-01`, `SC-MIG-04` |
| REQ-12 truthful audit | `SC-AUDIT-01`…`SC-AUDIT-06`, `SC-SEC-06`, `SC-PERF-03` |
| REQ-13 suppress automation | `SC-NOTIF-01`…`SC-NOTIF-12`, `SC-PAY-09` |
| REQ-14 keep accounting updates | `SC-PAY-01`, `SC-NOTIF-05`, `SC-REP-04` |
| REQ-15 availability integrity | `SC-AVAIL-12`, `SC-OWN-17`, `SC-REG-01`, `SC-REG-04`…`SC-REG-07`, `SC-MIG-02` |
| REQ-16 harden the normal flow | `SC-REG-02`, `SC-REG-03`, `SC-REG-06`, `SC-DATE-06`, `SC-DATE-07`, `SC-DATE-08` — specified by HB-01, executed against HB-08's implementation |
| REQ-17 inactive units | `SC-AVAIL-08`, `SC-AVAIL-09` |
| REQ-18 reporting reconcilable | `SC-REP-01`…`SC-REP-14`, `SC-PERF-04` |
| REQ-19 atomic creation | `SC-PAY-08`, `SC-TXN-01`…`SC-TXN-04`, `SC-AVAIL-11`, `SC-CONC-01`…`SC-CONC-05` |
| REQ-20 no hold policy | Asserted by absence — no scenario introduces a hold; `SC-AVAIL-12` proves historical records hold no future inventory |

### Ticket to scenarios

| Ticket | Scenarios |
|---|---|
| HB-01 | **None executed against HB-01 itself** — it ships no code. It *specifies* the behaviour that `SC-REG-01`…`SC-REG-06` and `SC-DATE-01`…`SC-DATE-10` verify, and those scenarios run against HB-02's boundary and HB-08's hardening. HB-01's own criteria are document-satisfiable (`AC-HB01-01` … `AC-HB01-10`) |
| HB-02 | `SC-HAPPY-01`…`SC-HAPPY-07`, `SC-DATE-01`…`SC-DATE-10`, `SC-AUDIT-01`…`SC-AUDIT-06`, `SC-SEC-06`, `SC-SEC-07`, `SC-SEC-09`, `SC-TXN-01`…`SC-TXN-06` |
| HB-03 | `SC-AVAIL-01`…`SC-AVAIL-12`, `SC-DUP-01`…`SC-DUP-08`, `SC-CONC-01`…`SC-CONC-05`, `SC-PERF-01`, `SC-PERF-02` |
| HB-04A | `SC-FIN-01`…`SC-FIN-04`, `SC-FIN-09`, `SC-FIN-10`, `SC-FIN-13`, `SC-FIN-14`, `SC-NOTIF-04`, `SC-NOTIF-05`, `SC-MIG-01`, `SC-MIG-05` |
| HB-04B | `SC-PAY-01`…`SC-PAY-10` and payment-dependent financial scenarios |
| HB-05 | `SC-OWN-01`…`SC-OWN-18`, `SC-SEC-08`, `SC-SEC-11`, `SC-FIN-05`, `SC-FIN-06` |
| HB-06 | `SC-UI-01`…`SC-UI-10`, `SC-MIG-03` |
| HB-07 | `SC-NOTIF-01`…`SC-NOTIF-12`, `SC-PAY-09` |
| HB-08A | `SC-REP-01`…`SC-REP-14`, `SC-PERF-03`, `SC-PERF-04`, `SC-MIG-02`, `SC-MIG-04` |
| HB-08B | `SC-REG-01`…`SC-REG-06` after successful HB-08A pilot evidence |
| HB-09 | `SC-REG-07` and the automation of every scenario marked `YES` |

Every scenario appears in at least one ticket row, and every ticket row resolves to a criterion range in
[Ticket to acceptance criteria](#ticket-to-acceptance-criteria). Some scenarios appear under more than one
ticket where two tickets genuinely share the outcome — `SC-DATE-*` is the clearest case, verifying HB-02's
historical boundary and HB-08's hardening rule against the same date arithmetic.

---

## Suites

### P0 smoke suite (must pass before any release)

`SC-HAPPY-01`, `SC-HAPPY-02`, `SC-DATE-01`, `SC-DATE-04`, `SC-AVAIL-02`, `SC-AVAIL-06`, `SC-AVAIL-08`,
`SC-AVAIL-09`, `SC-DUP-01`, `SC-SEC-02`, `SC-SEC-07`, `SC-FIN-01`, `SC-FIN-03`, `SC-PAY-08`, `SC-OWN-01`,
`SC-OWN-04`, `SC-OWN-08`, `SC-NOTIF-01`, `SC-NOTIF-02`, `SC-AUDIT-02`, `SC-AUDIT-03`, `SC-TXN-03`,
`SC-REG-02`, `SC-MIG-01`.

### P1 regression suite

All `SC-REG-nn`, plus `SC-AVAIL-12`, `SC-OWN-11`, `SC-REP-05`, `SC-MIG-02`, `SC-MIG-03`, all currently
discovered Fast/PostgreSQL tests, and the relevant portal/Playwright suites. Counts come from runner output.

### Accounting reconciliation suite

`SC-FIN-01`…`SC-FIN-08`, `SC-PAY-01`…`SC-PAY-05`, `SC-PAY-07`, `SC-OWN-01`, `SC-OWN-02`, `SC-OWN-09`,
`SC-OWN-10`, `SC-REP-02`, `SC-REP-04`, `SC-REP-06`, `SC-PERF-04`. **Reviewed under the Finance lens by the
owner; the reconciliation output is the evidence.**

### Security suite

`SC-SEC-01`…`SC-SEC-12`, `SC-OWN-04`, `SC-OWN-06`, `SC-UI-01`, `SC-MIG-04`.

---

## Release go/no-go checklist

- [ ] P0 smoke suite green
- [ ] P1 regression suite green
- [ ] Security suite green
- [ ] Accounting reconciliation suite green **and its figures reviewed under the Finance lens**
- [ ] `SC-REG-02` passes on every creation path
- [ ] `SC-NOTIF-01` and `SC-NOTIF-02` prove zero notifications
- [ ] `SC-MIG-01` migration applied forward with its verify script passing
- [ ] `SC-MIG-05` rollback limitation understood and accepted in writing
- [ ] Permission granted only to the agreed pilot role
- [ ] Observability signals visible; `SC-PERF-03` confirms no PII
- [ ] Operator documentation and support runbook published
- [ ] Every decision in the [decision record](DECISION_RATIFICATION_PACKET.md) still final; no item has
      reverted to open
- [ ] Hardening sequenced **after** the historical flow is live and verified
- [ ] `PRE-01` and `PRE-02` both closed — `PRE-02` delivered as its own PR before HB-03, not by HB-09
- [ ] `PRE-00` census run against an authorized dataset, or explicitly carried as an outstanding
      deployment-readiness gate

## Post-release monitoring checklist

- [ ] `historical_booking_created_total` — expected low volume; investigate spikes
- [ ] `historical_booking_rejected_total{reason}` — a rise in `overlap` or `duplicate` may indicate operator confusion
- [ ] Every immutable owner-correction row reviewed against its reason and before/after attribution in week one
- [ ] `booking_create_rejected_total{reason="STAY_DATES_IN_PAST"}` — validates assumption A-4 in HB-01
- [ ] Daily reconciliation (`SC-PERF-04`) for the first month
- [ ] Zero notification rows attributable to historical bookings
- [ ] No `AutoCompleteBookingsJob` transitions on historical records
- [ ] Owner statement disputes tracked as a leading indicator of misattribution

---

## Release sign-off

**Decision authority: Sole Project Owner, Hozaifa Almelli.** This project has one owner, so there is one
signature, not five. The five rows below are the **review lenses** the owner applies before releasing —
each names what must be true and what evidence proves it. They are not separate people and do not require
separate names ([governance model](DECISION_RATIFICATION_PACKET.md#governance-model)).

| Lens | What must be true before release | Evidence that proves it |
|---|---|---|
| Product | Scope matches the recorded decisions; the wizard flow is the one specified; owner-approved out-of-v1 scope is explicit | `SC-HAPPY-01`…`-07`, `SC-UI-01`…`-10`; the [decision record](DECISION_RATIFICATION_PACKET.md) |
| Engineering | Architecture, data model, migration ordering and rollback behave as specified | `SC-TXN-01`…`-06`, `SC-CONC-01`…`-05`, `SC-MIG-01`…`-05`; `_verify.sql` green forward and after rollback-then-forward |
| QA | Suite coverage is real, not asserted; the automation level is honest; release gates block | P0 smoke, P1 regression, security and accounting suites green; `PRE-02` closed **before HB-03 merged**, so relational coverage actually executes rather than silently falling back |
| Finance / Accounting | The numbers reconcile on both axes, and the known limitation is quantified rather than hidden | Accounting reconciliation suite green; `payments_unlinked_amount` matches the expected gap exactly (`AC-HB08-10`); reconciliation runbook produces sane figures on seeded data |
| Operations | Rollout order held, the pilot ran clean, and support knows what changed | Pilot exit criteria met; hardening activated **last**; operator documentation published including "a stay ending today cannot be recorded until tomorrow" |

**Release condition.** Every lens above satisfied; `PRE-01` and `PRE-02` closed; `PRE-00` either executed
or explicitly carried as an outstanding deployment-readiness gate; and the go/no-go checklist complete.

> **The Finance lens carries the most weight and the least redundancy.** This feature writes revenue and
> owner-attributed booking records that existing reports cannot distinguish from ordinary bookings until ADR-11
> ships, and under [D-INV-01](DECISION_RATIFICATION_PACKET.md#d-inv-01--invoice-policy) historical cash is
> deliberately not invoice-linked. With no second reviewer, the reconciliation output *is* the review: if
> the numbers do not tie out, that is the signal, and it must not be waved through.
