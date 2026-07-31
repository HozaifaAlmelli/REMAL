# Decision Record — Record Historical Booking

> [README](README.md) · [Master Plan](00_MASTER_PLAN.md) · [HB-01](01_TICKET_DISCOVERY_AND_ARCHITECTURE_DECISIONS.md)

---

## Governance model

This project is designed, owned, reviewed and implemented by **one person**. There is no separate Product,
Engineering, Finance, Security or Operations team.

| Field | Value |
|---|---|
| **Sole Project Owner and Decision Authority** | **Hozaifa Almelli** |
| **Decision date for every record in this document** | **2026-07-29** |
| **Review lenses** | Product · Engineering · Finance · Security · Operations |

**What a review lens is.** Product, Engineering, Finance, Security and Operations are *perspectives the sole
owner applies* when reaching a decision. They are **not** separate approvers, they do not require separate
names, and they do not require separate signatures. Naming the lenses records *what was considered*, not
*who considered it*. The owner is named once, here, and is not restated per lens — repeating one name across
several rows would misrepresent one decision as several independent approvals.

**What this document is not.** It is not independent review. A single person approving their own design has
no second pair of eyes, and this document does not pretend otherwise. Where that matters — money, privilege
boundaries, irreversible schema — the compensating controls are written into the decisions themselves:
explicit risk acceptance, an explicit revisit trigger, and reliability scenarios that fail loudly rather
than a reviewer who might catch the problem.

### Status vocabulary

| Status | Meaning |
|---|---|
| `OWNER APPROVED` | Decided by the sole owner on the date above. Implementation may proceed against it |
| `DEFERRED` | Deliberately out of v1. Carries an accepted risk and a revisit trigger. **Not** an unresolved approval |
| `BLOCKED BY TECHNICAL PREREQUISITE` | The decision itself is made; execution waits on a named technical prerequisite, not on a person |

There is no `PENDING RATIFICATION` status in this project, and no decision is blocked on an unassigned role.
Any earlier text implying that a Product owner, Engineering owner, Finance approver or Security reviewer was
"missing" has been withdrawn — those roles are lenses held by the owner, not vacancies.

---

## Summary

### Cross-ticket decisions

| ID | Decision | Outcome | Review lenses | Status |
|---|---|---|---|---|
| [D-CAL-01](#d-cal-01--historical-completion-boundary) | Historical completion boundary | `check_out_date <= Cairo business date − 1` | Product · Engineering · Operations | **`OWNER APPROVED`** |
| [D-INV-01](#d-inv-01--invoice-policy) | Invoice policy | No invoice created or issued in v1 | Product · Finance · Security | **`OWNER APPROVED`** |
| [D-PAY-01](#d-pay-01--historical-payment-policy) | Historical payment policy | Separate privileged command; never inline | Finance · Security · Engineering | **`OWNER APPROVED`** |
| [D-OWN-01](#d-own-01--owner-attribution) | Owner attribution | Default unit owner, explicit review, block on uncertainty | Product · Finance · Operations | **`OWNER APPROVED`** |
| [D-OWN-02](#d-own-02--owner-override) | Owner override | Distinct permission, mandatory reason, full audit | Finance · Security · Engineering | **`OWNER APPROVED`** |
| [D-MIG-01](#d-mig-01--migration-ownership) | Migration ownership | One owner per schema object; cross-ticket use is a dependency | Engineering · Operations | **`OWNER APPROVED`** |
| [D-ROLL-01](#d-roll-01--rollout-sequence) | Rollout sequence | Implement → test → pilot → then harden | Product · Engineering · Operations | **`OWNER APPROVED`** |
| [D-HARD-01](#d-hard-01--normal-flow-hardening) | Normal-flow hardening | HB-01 specifies; HB-08 implements and activates last | Product · Security · Engineering | **`OWNER APPROVED`** |
| [D-TEST-01](#d-test-01--postgresql-test-requirement) | PostgreSQL test requirement | Real PostgreSQL integration testing is mandatory before HB-03 merges | Engineering · Operations | **`OWNER APPROVED`**, execution `BLOCKED BY TECHNICAL PREREQUISITE PRE-02` |


### HB-02 decisions

Eight further decisions were ratified when HB-02 was made implementation-ready. Each either changes a shared
contract or settles a boundary between HB-02 and a later ticket, which is why each is recorded here rather
than only inside the ticket. The six decisions local to HB-02 alone
([D-HB02-01, -02, -07, -08, -09, -10](02_TICKET_HISTORICAL_BOOKING_DOMAIN_AND_API.md#101-ratified-decisions))
live in the ticket.

| ID | Decision | Outcome | Review lenses | Status |
|---|---|---|---|---|
| [D-HB02-03](#d-hb02-03--machine-readable-error-transport) | Machine-readable error transport | Optional `Code` on the shared `ApiResponse` contract; never in `errors[0]` | Engineering · Product | **`OWNER APPROVED`** |
| [D-HB02-04](#d-hb02-04--producing-a-403-for-an-owner-override-refusal) | Producing a `403` for an owner-override refusal | Dissolved for HB-02 — no override exists there. Mechanism moves to HB-05 | Engineering · Security | **`OWNER APPROVED`** |
| [D-HB02-05](#d-hb02-05--client-reference-contract) | Client reference contract | Exactly one of `clientId` / `newClient`; known phone refused with the existing id | Product · Engineering | **`OWNER APPROVED`** |
| [D-HB02-06](#d-hb02-06--original_source-vocabulary) | `original_source` vocabulary | Database-backed lookup table, four seeded codes, active/inactive | Product · Finance · Engineering | **`OWNER APPROVED`** |
| [D-HB02-IDEM](#d-hb02-idem--idempotency-ownership-and-contract) | Idempotency ownership and contract | HB-02 owns `idempotency_keys`; `Idempotency-Key` required | Engineering · Operations | **`OWNER APPROVED`** |
| [D-HB02-AMT](#d-hb02-amt--financial-truth-boundary) | Financial truth boundary | HB-02 captures raw `agreedAmount`; HB-04 owns the snapshot and payments | Finance · Engineering | **`OWNER APPROVED`** |
| [D-HB02-OWN](#d-hb02-own--owner-attribution-boundary) | Owner attribution boundary | Current owner resolved server-side; no owner input; refuse when uncertain | Finance · Security · Product | **`OWNER APPROVED`** |
| [D-HB02-CAL](#d-hb02-cal--cairo-business-date-ownership) | Cairo business-date ownership | HB-02 creates the narrowest resolver; no longer a readiness blocker | Engineering · Operations | **`OWNER APPROVED`** |

Nine of nine cross-ticket decisions and eight of eight HB-02 decisions have a final status. None is waiting
on a person.

### Deferred v1 scope decisions

| ID | Subject | Status | Accepted risk | Revisit trigger |
|---|---|---|---|---|
| [OQ-05](#oq-05--currency-model) | Currency model | **`DEFERRED`** | Historical bookings cannot represent multi-currency financial snapshots | The platform introduces more than one supported transaction currency |
| [OQ-06](#oq-06--fee-tax-and-discount-model) | Fee, tax and discount model | **`DEFERRED`** | Component-level financial breakdown may be unavailable | Legal, tax, invoicing or reporting requirements demand component-level values |
| [OQ-07](#oq-07--paid-payout-correction) | Paid payout correction | **`DEFERRED`** | Corrections require manual handling until an adjustment ledger exists | A formal payout-adjustment or settlement-period model is introduced |

### Active technical prerequisites

Three independent prerequisite PRs. Each is a standalone piece of work; none is delivered inside a feature
ticket, and their repository footprints do not overlap, so they may proceed in parallel.

| ID | Prerequisite | Blocks |
|---|---|---|
| [PRE-00](#pre-00--historical-data-census) | Historical data census — read-only, non-production, sanitized aggregates | **Pilot and migration rollout approval.** Blocks HB-02 **only if** the migration or backfill strategy materially depends on existing-row evidence |
| [PRE-01](#pre-01--database-bootstrap-parity-for-migration-0057) | Restore database bootstrap parity concerning migration `0057` | **`COMPLETE` — merged.** Formerly gated HB-02's merge |
| [PRE-02](#pre-02--baseline-test-execution-and-postgresql-integration-infrastructure) | Baseline test execution and reusable real-PostgreSQL integration infrastructure | **`COMPLETE` — merged.** Formerly gated HB-03's merge; HB-09 still consumes and extends it |

**Two of the three are now discharged.** `PRE-01` and `PRE-02` are merged. **`PRE-00` is the only
prerequisite still outstanding**, and it blocks pilot and migration rollout approval rather than any
ticket's implementation. None of the three was ever an approval gap; all were technical.

**`PRE-02` is not delivered by HB-09.** An earlier revision said it was, which was contradictory: `PRE-02`
gates HB-03's merge, while HB-09 runs after every feature wave including HB-03. `PRE-02` is now an
independent prerequisite PR delivered **before** HB-03, and HB-09 **consumes and extends** it. See
[the split](#pre-02-versus-hb-09--who-owns-what).

---

## D-CAL-01 — Historical completion boundary

| Field | Value |
|---|---|
| **Decision** | A stay is complete, and therefore eligible for the historical flow, when `check_out_date <= (Cairo business date − 1)`. A checkout falling on the current Cairo business date is **not** yet complete. |
| **Basis** | The existing Cairo business-date behaviour is authoritative. `CONFIRMED` — `RentalPlatform.API/Services/AutoCompleteBookingsJob.cs:70`: `var completedAfterCheckoutCutoff = DateOnly.FromDateTime(cairoNow).AddDays(-1);`, with the timezone resolved at `:18` and `:133-143` (`Africa/Cairo`, falling back to `Egypt Standard Time`), and the predicate at `:86-87`. |
| **Review lenses** | Product · Engineering · Operations |
| **Decision authority** | Sole Project Owner |
| **Decision date** | 2026-07-29 |
| **Status** | **`OWNER APPROVED`** |

**Why this and not an alternative.** Allowing a checkout dated today would create a second, contradictory
definition of a finished stay: a booking could be "historical" while `AutoCompleteBookingsJob` still treats
the day as open. Using UTC would shift the business day by two or three hours and misclassify stays around
midnight. Reusing the job's expression means the platform has exactly one definition of "the business day
ended".

**Consequences.** HB-02 validates the boundary and returns `400 HISTORICAL_CHECKOUT_NOT_COMPLETED` outside it.
HB-08 extracts the expression into a shared resolver so the job and the validator cannot drift.
`SC-DATE-01`, `SC-DATE-04` and `SC-DATE-06` are the boundary tests.

**Operational note.** A stay ending today must wait until tomorrow to be recorded. This is intended and must
appear in the operator documentation, because it will otherwise be reported as a bug.

---

## D-INV-01 — Invoice policy

| Field | Value |
|---|---|
| **Decision** | Historical booking creation **will not create or issue an invoice in v1**. No invoice notification will run. The reporting limitation must be visible and is owned by HB-08. Historical invoice support is deferred until a dedicated accounting model is designed. |
| **Basis** | `CONFIRMED` — the only invoice auto-creation site is the `Booked → Confirmed` transition, `BookingLifecycleService.cs:186-200` (`:194` create, `:199` issue), which the historical flow never executes. Invoice numbers come from a **daily-reset** sequence, `InvoiceService.cs:500-518`, so a number asserts the date the document was produced. `reporting_finance_daily_summary.total_paid_amount` reaches payments only through `payments.invoice_id`, so an uninvoiced payment reports as zero cash received. Manual draft creation remains available for `Completed` bookings via `POST /api/internal/invoices/drafts`. |
| **Review lenses** | Product · Finance · Security |
| **Decision authority** | Sole Project Owner |
| **Decision date** | 2026-07-29 |
| **Status** | **`OWNER APPROVED`** |

**Risk accepted.** Historical bookings will not have automatically generated invoice records in v1.
Concretely: `reporting_finance_daily_summary.total_paid_amount` and `owner_portal_finance_overview`
under-count historical cash by the value of every unlinked historical payment.

**Why the risk is acceptable.** An invoice is an externally meaningful accounting document. Issuing a real,
numbered document into a period that has already closed is a larger and less reversible problem than a
reporting shortfall that is measured and published. Outstanding balances remain correct through the
documented `booking.FinalAmount` fallback (`AutoCompleteBookingsJob.cs:160`), and Finance can still create
an invoice manually at any time.

**Mandatory visibility — owned by HB-08.** The limitation must not be silent. HB-08 publishes
`payments_unlinked_count` and `payments_unlinked_amount`, surfaces them in the reconciliation view, and
states the shortfall in the reconciliation runbook. `AC-HB08-10` asserts the unlinked amount equals exactly
the difference between the booking-scoped and invoice-linked totals.

**Revisit trigger.** A confirmed accounting or customer-document requirement for historical invoices.

**Consequences.** HB-04 authors no invoice code. HB-02 `AC-HB02-15` and HB-07 matrix row `S-03` stand as
written. `SC-NOTIF-04` is the assertion that no invoice is auto-created.

---

## D-PAY-01 — Historical payment policy

| Field | Value |
|---|---|
| **Decision** | Historical payment data is **not** accepted inline during historical-booking creation. Historical payment recording uses a **separate privileged command** that requires a distinct permission, a mandatory reason, idempotency protection and truthful audit records. It records historical evidence and **must not** trigger live payment collection. |
| **Basis** | `CONFIRMED` — `Payment.PaidAt` is a real nullable effective date distinct from `CreatedAt` (`RentalPlatform.Data/Entities/Payment.cs:14-15`), so a truthful historical payment date is representable without falsifying any timestamp. `ck_payments_method` permits `cash`, `bank_transfer`, `card`, `wallet` (`db/migrations/0022_create_payments.sql:18`); `ck_payments_amount_positive` forbids non-positive amounts (`:19`). `Payment` has **no** recorded-by actor column. Every existing payment endpoint requires `finance:manage`. |
| **Review lenses** | Finance · Security · Engineering |
| **Decision authority** | Sole Project Owner |
| **Decision date** | 2026-07-29 |
| **Status** | **`OWNER APPROVED`** |

**Command contract (`PROPOSED` shape, binding intent):**

| Property | Requirement |
|---|---|
| Separation | The historical creation command writes booking and history only. Payment recording is a distinct call against an already-created historical booking |
| Permission | A distinct permission, **and** the existing `finance:manage`. Recording money is a finance privilege and must not be acquired implicitly by holding `bookings:record_historical` |
| Reason | Mandatory, non-empty, persisted |
| Idempotency | An explicit idempotency key, so a retried call cannot double-record a payment |
| Audit | Truthful records: real `CreatedAt`, operator-supplied `PaidAt`, the recording actor in `payments.created_by_admin_user_id` |
| No live collection | No gateway call, no payment link, no fabricated transaction id. `card` is rejected for historical payments because it implies a gateway that does not exist in this codebase |

**Why not inline.** Fusing a finance write into a booking-domain command widens what a single permission
authorizes, and it does so invisibly. Separation keeps the privilege boundary legible, which matters more
here than saving the operator one step.

**Accepted consequence.** Booking creation and payment recording are **not atomic together**. A historical
booking can briefly exist with no payment. That intermediate state is a legal business state — a completed
stay with an outstanding balance — so it is recoverable rather than corrupt. `SC-TXN-03` asserts the
non-atomic expectation explicitly; each command remains atomic on its own.

**Consequences.** HB-02's request contract carries no `payment` field. HB-04 specifies the second command
and the `HistoricalPaymentContext(PaidAtUtc, RecordedByAdminUserId)` parameter. HB-06's wizard collects the
payment in step 4 and posts it after the booking returns `200`, with an explicit retry affordance.

---

## D-OWN-01 — Owner attribution

| Field | Value |
|---|---|
| **Decision** | Default to the current unit owner. Require explicit operator review before submission. **Block submission when ownership is uncertain.** |
| **Basis** | `CONFIRMED` — `BookingService.cs:225` snapshots `OwnerId = unit.OwnerId` and never accepts an owner from caller input. `owner_payouts` is one row per booking (`ux_owner_payouts_booking_id` UNIQUE) with `commission_rate` and `commission_amount` frozen onto the row; there is no settlement-period or statement table, and payouts are created explicitly by `OwnerPayoutService`, not automatically. `Owner.CommissionRate` is mutable and read live at payout time. |
| **Review lenses** | Product · Finance · Operations |
| **Decision authority** | Sole Project Owner |
| **Decision date** | 2026-07-29 |
| **Status** | **`OWNER APPROVED`** |

**Why blocking is the right failure mode.** There is no date-ranged ownership history to consult, so if a
unit changed hands between the stay and the recording, the system cannot resolve the correct owner. Guessing
credits money to the wrong person silently. Refusing is visible and correctable.

**Consequences.** HB-05 adds the mandatory review step and the three `snapshot_*` columns; owner attribution
is immutable after creation; a dedicated correction workflow handles genuine mistakes; date-ranged ownership
history is a separate future epic and must not block v1.

---

## D-OWN-02 — Owner override

| Field | Value |
|---|---|
| **Decision** | Owner override requires a **distinct privileged permission**. A **non-empty reason is mandatory**. Audit records must include **previous owner, selected owner, actor, timestamp and reason**. |
| **Basis** | `CONFIRMED` — no existing endpoint accepts an owner id for a booking; `BookingService.cs:225` derives it from the unit. Permission keys follow an `area:action` convention in `RentalPlatform.API/Authorization/PermissionKeys.cs`, are `VARCHAR(50)`, and are seeded per the pattern at `db/migrations/0053_create_dynamic_rbac.sql`. Per-user grants and denies exist via `rbac_admin_user_permission_overrides`. |
| **Review lenses** | Finance · Security · Engineering |
| **Decision authority** | Sole Project Owner |
| **Decision date** | 2026-07-29 |
| **Status** | **`OWNER APPROVED`** |

**Why a second permission.** Recording a historical booking and redirecting who gets paid for it are
different privileges. Collapsing them into one means anyone who can record can also redirect money.
`bookings:override_owner` is granted to **no** role template by default and issued as a per-user grant.

**Enforcement.** In-service, not merely at the policy layer, so the check cannot be lost if a route is
refactored. An override emits `booking.historical.owner_override` carrying both owner ids and sharing the
recording's correlation id. HB-08 alerts when the override rate exceeds the agreed threshold.

---

## D-MIG-01 — Migration ownership

| Field | Value |
|---|---|
| **Decision** | The [migration-ownership matrix](00_MASTER_PLAN.md#111-migration-ownership-matrix) is authoritative. Every schema object has exactly one ticket owner. Cross-ticket use is represented as a **dependency**. No two tickets may claim ownership of the same column, index, constraint or table. |
| **Basis** | `CONFIRMED` — migrations are raw SQL under `db/migrations/NNNN_name.sql` with paired `_verify.sql` and `_rollback.sql`, applied by `scripts/apply-migrations.sh`; there is no EF Core migrations directory. The latest observed number is `0057`. |
| **Review lenses** | Engineering · Operations |
| **Decision authority** | Sole Project Owner |
| **Decision date** | 2026-07-29 |
| **Status** | **`OWNER APPROVED`** |

**Domain split.** **HB-02** owns historical-booking identity, audit metadata, reason, creation mode and
booking-level lifecycle fields. **HB-04** owns the agreed financial snapshot and historical payment fields.
**HB-05** owns owner commission, payout snapshot, attribution, override and adjustment-related fields.
**HB-08** owns reporting views only.

**Ordering.** `HB-02 (#1–#13) → HB-04 (#14–#17) → HB-05 (#18–#28) → HB-08 (#29–#33)`. Each `_verify.sql`
asserts the upstream columns it depends on **before** asserting its own objects, and fails loudly if they
are absent.

**Prerequisite.** [PRE-01](#pre-01--database-bootstrap-parity-for-migration-0057) must be resolved before
these migrations land, because bootstrap parity is currently broken.

---

## D-ROLL-01 — Rollout sequence

| Field | Value |
|---|---|
| **Decision** | 1. Implement the historical booking path. 2. Test it. 3. Pilot and verify it. 4. Activate normal-flow past-date hardening **only afterward**. |
| **Basis** | `CONFIRMED` — there is no feature-flag infrastructure in the repository; RBAC permission grants are the existing server-side, audited, deploy-free control (`db/migrations/0053_create_dynamic_rbac.sql`). |
| **Review lenses** | Product · Engineering · Operations |
| **Decision authority** | Sole Project Owner |
| **Decision date** | 2026-07-29 |
| **Status** | **`OWNER APPROVED`** |

**Why the order is not negotiable.** The normal flow accepts past dates today, so past stays are being
recorded that way whether or not anyone intended it. Hardening first would remove that capability with
nothing in its place. Reversing steps 3 and 4 is the single most consequential sequencing error available in
this plan.

**Control mechanism.** A deployment-order release gate, not a runtime flag. The emergency stop for the
historical flow is revoking `bookings:record_historical` — instant, audited, server-side, no deploy.

---

## D-HARD-01 — Normal-flow hardening

| Field | Value |
|---|---|
| **Decision** | **HB-01 contains no implementation.** **HB-08 owns implementation and activation** of normal-flow past-date rejection. Hardening is the **final rollout change**, applied after successful historical-flow pilot verification. |
| **Basis** | `CONFIRMED` — the only stay-date rule is `BookingService.ValidateStayDates` at `RentalPlatform.Business/Services/BookingService.cs:463-467`, which tests only `checkOutDate <= checkInDate`. No validator in `RentalPlatform.API/Validators/` and no `CHECK` in `db/migrations/0016_create_bookings.sql` compares against today. The sole past-date guard in the product is a client-side storefront calendar, `demo/src/components/ui/UnitBookingWidget.tsx:324`. Separately, `UpdatePendingAsync` already rejects any booking outside `Prospecting`/`Relevant` with a `409` at `BookingService.cs:385-387`, which bounds the current update-path bypass. |
| **Review lenses** | Product · Security · Engineering |
| **Decision authority** | Sole Project Owner |
| **Decision date** | 2026-07-29 |
| **Status** | **`OWNER APPROVED`** |

**Why HB-01 ships no code.** The update-path guard must exempt `is_historical`, a column HB-02 creates, and
the rule must activate after the flow it protects. A wave-0 gating ticket can satisfy neither. Splitting
specification from implementation is what makes the dependency graph acyclic; it is not a downgrade of
REQ-16.

**Risk accepted.** `RISK-10` — silent backdating through the normal endpoint by any `bookings:write` holder
— remains open for the duration of the programme. This is accepted deliberately, in exchange for never
stranding operations.

**Compensating controls while the window is open:**

1. The [PRE-00 historical data census](#pre-00--historical-data-census) sizes actual past-dated usage before anything changes.
2. HB-08's reconciliation view detects ongoing normal-flow backdating as off-diagonal rows with
   `historical_count = 0`.
3. The hardening change is the **last commit** on HB-08's branch, so it can be reverted alone if it blocks a
   legitimate workflow ([HB-08 §34.1a](08_TICKET_REPORTING_AUDIT_OBSERVABILITY_AND_ROLLOUT.md#341a-the-req-16-hardening-rollback--independently-revertible)).
4. `AC-HB08-23` … `AC-HB08-26` are runtime assertions and `SC-REG-02` is a P0 release gate, so REQ-16 cannot
   be quietly dropped.

**Revisit trigger.** Evidence that the open window is being exploited, or any external requirement to close
it sooner — in which case hardening is brought forward and operators get a documented interim procedure.

---

## D-TEST-01 — PostgreSQL test requirement

| Field | Value |
|---|---|
| **Decision** | Real PostgreSQL integration testing is **mandatory before HB-03 may merge**. Mocked or in-memory persistence cannot prove lock, transaction, uniqueness, concurrency or database-constraint behaviour. |
| **Basis** | `CONFIRMED` — `.github/workflows/pr-checks.yml` (90 lines) defines five jobs: `backend` (restore plus `dotnet build -c Release`), `api-container`, `frontend-demo`, `frontend-portal` and `compose-validate`. There is **no `dotnet test` step and no `services:` block** anywhere in the file. Existing tests use EF Core InMemory, which raises `TransactionIgnoredWarning`, cannot execute `ExecuteSqlInterpolatedAsync` (relational-only, and the mechanism advisory locks use), and enforces neither unique indexes nor `CHECK` constraints. |
| **Review lenses** | Engineering · Operations |
| **Decision authority** | Sole Project Owner |
| **Decision date** | 2026-07-29 |
| **Status** | **`OWNER APPROVED`** — execution **`BLOCKED BY TECHNICAL PREREQUISITE PRE-02`** |

**What cannot be proven without it:**

| HB-03 guarantee | Why in-memory persistence cannot prove it |
|---|---|
| The historical conflict check runs inside a transaction | InMemory raises `TransactionIgnoredWarning`; transactions are no-ops |
| `pg_advisory_xact_lock(booking-unit:{unitId})` serialises concurrent recordings | Advisory locks are issued via `ExecuteSqlInterpolatedAsync`, which is relational-only |
| `ux_bookings_external_reference` rejects a duplicate reference | Unique indexes are not enforced |
| `CHECK` constraints reject incoherent historical rows | `CHECK` constraints do not exist in InMemory |
| Two concurrent identical requests produce exactly one booking and one `409` | Requires real concurrency against a real engine |

**Interim honesty requirement.** Until PRE-02 is complete, no document, PR description or release note may
claim these behaviours are covered. The correct wording is "asserted by design, not yet verified by an
automated test", and `SC-CONC-01` … `SC-CONC-05`, `SC-TXN-01` … `SC-TXN-06` and `SC-DUP-01` … `SC-DUP-08`
are recorded as manually executed.

---

## D-HB02-03 — Machine-readable error transport

| Field | Value |
|---|---|
| **Decision** | Adopt an **explicit optional machine-readable error code in the shared API response contract**. Add a nullable `Code` property to `ApiResponse` and `ApiResponse<T>`, populated by `ExceptionHandlingMiddleware` from coded business exceptions. The code is **never** encoded inside `errors[0]`. |
| **Basis** | `CONFIRMED` — `RentalPlatform.API/Models/ApiResponse.cs` exposes only `Success`, `Data`, `Message`, `Errors`, `Pagination`; there is no code field. `ExceptionHandlingMiddleware.cs:45-72` maps four typed exceptions to statuses and discards everything else. The four exception types in `RentalPlatform.Business/Exceptions/` derive directly from `Exception` and share no base class. |
| **Review lenses** | Engineering · Product |
| **Decision authority** | Sole Project Owner |
| **Decision date** | 2026-07-29 |
| **Status** | **`OWNER APPROVED`** |

**The narrowest repository-consistent carrier.** Because the four exception types share no base, "a `Code`
property on the business exception base" has no base to attach to. The equivalent that changes least is a
one-member interface, `IBusinessErrorCode { string? Code { get; } }`, implemented by all four through an
**additive optional constructor argument**. Every existing constructor keeps its signature, so every
existing throw site compiles untouched and the middleware needs one `is IBusinessErrorCode` test. Creating
a common abstract base and reparenting four widely-thrown types would be a larger change for no additional
capability.

**Backward compatibility is a requirement, not an aspiration.** All existing response fields are preserved;
every `CreateSuccess`/`CreateFailure` overload keeps its signature; `code` is absent or null everywhere it
is not set. Human-readable `message` and `errors` continue to work exactly as they do now — the code is
machine-readable *in addition to* the message, never instead of it.

**Why `errors[0]` is rejected outright.** It is the obvious shortcut and it is wrong: `errors` is a
human-readable array that clients render. Putting a machine token in it means either an operator eventually
sees `CLIENT_PHONE_ALREADY_EXISTS` in a UI, or every consumer must learn to strip element zero. It also
makes the code unrepresentable when there are no errors to report.

**Scope of migration.** **Unrelated endpoints are not required to migrate.** They keep returning a null
`code` until their owning ticket decides otherwise. **HB-02 errors must expose stable documented codes** —
the complete set, with statuses aligned to the repository's existing exception mapping, is
[HB-02 §14.4](02_TICKET_HISTORICAL_BOOKING_DOMAIN_AND_API.md#144-error-contract--machine-readable-codes-d-hb02-03).

---

## D-HB02-04 — Producing a `403` for an owner-override refusal

| Field | Value |
|---|---|
| **Subject, verbatim** | *"How is `403 OWNER_OVERRIDE_FORBIDDEN` produced, given that `ExceptionHandlingMiddleware` has no `403` branch?"* It was a transport question about one specific error, not a question about ownership policy. |
| **Decision** | **Not applicable to HB-02; nothing is built there.** HB-02 accepts no owner input at all ([D-HB02-OWN](#d-hb02-own--owner-attribution-boundary)), so an override can never be requested on that endpoint and no override refusal can arise. `ForbiddenBusinessException` and the middleware's `403` branch are **HB-05's**, introduced alongside the override that throws them. HB-02's own uncertainty path is `409 OWNER_ATTRIBUTION_REQUIRES_REVIEW` through the **existing** `ConflictException` branch. |
| **Basis** | `CONFIRMED` — `ExceptionHandlingMiddleware.cs:45-72` has exactly four typed branches and no `403`. `ConflictException` → `409` already exists at `:53-56`. Every error HB-02 can produce is a `400`, `404` or `409`, so the existing switch is sufficient. |
| **Review lenses** | Engineering · Security |
| **Decision authority** | Sole Project Owner |
| **Decision date** | 2026-07-29 |
| **Status** | **`OWNER APPROVED`** |

**Why the original recommendation was withdrawn.** It was correct for the contract as it stood, when the
HB-02 request carried an `ownerAttribution` object with an override. Removing that object removes the
condition. Building the reporting mechanism for a refusal that cannot occur would place HB-05 behaviour
inside HB-02 — exactly what the ticket boundaries exist to prevent, and it would leave a `403` branch in the
middleware that nothing throws.

**Consequences.** HB-02 touches `ExceptionHandlingMiddleware` for one reason only — propagating the new
`Code`. The status-mapping switch is unchanged, and a diff that adds a `403` branch is a stop condition. The
`403` for a *missing* `bookings:record_historical` is unaffected: it comes from the authorization policy
before the action body runs, carries an empty body, and needs no exception type.

---

## D-HB02-05 — Client reference contract

| Field | Value |
|---|---|
| **Decision** | The canonical request contains **exactly one of `clientId` or `newClient`**. Both or neither ⇒ `400 CLIENT_REFERENCE_INVALID`. Unknown `clientId` ⇒ `404 CLIENT_NOT_FOUND`. A `newClient` whose normalised phone already belongs to an existing client ⇒ **no duplicate is created, no silent reuse, no merge** — `409 CLIENT_PHONE_ALREADY_EXISTS`, carrying `existingClientId` in safe internal error metadata, and the caller retries with that id. Phone normalisation and validation **follow existing repository behaviour**. Actor and audit fields can never be supplied by the caller. |
| **Basis** | `CONFIRMED` — there is no match-or-create helper anywhere in the solution. `ClientService.cs:23` validates `^\+?\d{10,15}$`; `:198` normalises identity as `phone.TrimStart('+')`; `:72-76` refuses a duplicate with `ConflictException`. `GuestBookingService.cs:42-52` does the same. The database enforces `ux_clients_phone` UNIQUE (`db/migrations/0005_create_clients.sql:61`). The platform's existing answer to a known phone is therefore *refuse*, not *merge*. |
| **Review lenses** | Product · Engineering |
| **Decision authority** | Sole Project Owner |
| **Decision date** | 2026-07-29 |
| **Status** | **`OWNER APPROVED`** |

**Why not silent match-and-reuse.** Attaching a historical booking to a client the operator did not
explicitly choose is a quiet identity decision about a real person, made on the strength of a phone number
that may have been recycled or mistyped. It is also irreversible in the audit trail. Refusing costs one
extra round trip and makes the operator confirm who the guest is.

**Why not silent create.** That is `RISK-12` — duplicate client records accumulating invisibly, splitting a
guest's history across two identities.

**Why the refusal returns `existingClientId`.** Without it the operator is in a dead end: told the phone
exists, unable to proceed, with no way to find the record. The id is safe to return — it is an internal
identifier already visible to any operator with `clients:read`, and it carries **no** name, phone or email.
The refusal path never discloses guest PII.

**Consequence.** HB-02 writes no phone-normalisation code. It calls the existing behaviour, so a future
change to the platform's phone rules applies to the historical flow automatically.

---

## D-HB02-06 — `original_source` vocabulary

| Field | Value |
|---|---|
| **Decision** | `original_source` is **database-backed and must not accept arbitrary free text**. It is a lookup table `booking_original_sources(code, label, is_active)`, with `bookings.original_source` a foreign key to `code`. Seeded with **exactly** `legacy_system`, `external_platform`, `offline_record`, `other`. An unknown **or inactive** code ⇒ `400 ORIGINAL_SOURCE_INVALID`. |
| **Basis** | `CONFIRMED` — the repository was inspected for an existing booking-source, channel, origin or platform vocabulary. Exactly one exists: `ck_bookings_source CHECK (source IN ('direct','admin','phone','whatsapp','website'))` at `db/migrations/0016_create_bookings.sql:24`, mirrored at `db/migrations/0018_create_crm_leads.sql:23`, `BookingService.cs:23` and `CrmLeadService.cs:22`. There is **no** lookup table for it, and no other source-like vocabulary anywhere in the schema. |
| **Review lenses** | Product · Finance · Engineering |
| **Decision authority** | Sole Project Owner |
| **Decision date** | 2026-07-29 |
| **Status** | **`OWNER APPROVED`** |

**Why the existing vocabulary is not reused.** It was checked first, as it should be, and it fails on three
counts. It is a *contact-channel* taxonomy answering "how did this booking reach us?", whereas
`original_source` is a *provenance* taxonomy answering "where did this record exist before we entered it?" —
`admin` is the truthful channel for every historical row and a useless provenance value for all of them. It
is structurally incapable of the required contract: a `CHECK` constraint holds a list of strings, with
nowhere to put a human-readable label and nowhere to put an active/inactive flag. And widening it would make
provenance values legal on *every* booking, including live ones, touching every existing consumer and every
reporting view.

**Why a table rather than a second `CHECK`.** The decision requires a stable code, a human-readable label,
and active/inactive behaviour. Only a table provides all three. It also makes retirement a data change
rather than a migration: setting `is_active = false` stops new use while leaving every historical row
readable, which a `CHECK` cannot do without invalidating existing data. `ON DELETE RESTRICT` prevents a code
from being deleted once referenced — provenance must stay readable forever.

**Why no commercial platform names.** Adding named third-party brands would require a migration every time a
commercial relationship changes, and no canonical repository vocabulary requires them. `external_platform`
plus the existing `externalReference` field carries the same information without the churn.

---

## D-HB02-IDEM — Idempotency ownership and contract

| Field | Value |
|---|---|
| **Decision** | **HB-02 owns `idempotency_keys` and the command's idempotency contract.** The canonical header is `Idempotency-Key` and it is **required** on the historical creation endpoint. Scope is **actor + command/endpoint + key**. A canonical request hash is persisted. Booking creation and idempotency completion are **atomic**. Same key + same request ⇒ the original successful `200` and the original booking identity. Same key + different request ⇒ `409 IDEMPOTENCY_KEY_REUSED`. An incomplete or in-progress request **fails deterministically and never creates a second booking**. **No automatic expiration in v1.** HB-03 still owns booking-level duplicate and availability-conflict protection. |
| **Basis** | `CONFIRMED` — no idempotency infrastructure exists anywhere: a repository-wide grep for `idempotenc` across `*.cs` and `*.sql` returns only a comment in `db/migrations/0001_init_postgres_conventions_rollback.sql:31`. The [migration-ownership matrix](00_MASTER_PLAN.md#111-migration-ownership-matrix) already assigns `idempotency_keys` to HB-02 as object #12. |
| **Review lenses** | Engineering · Operations |
| **Decision authority** | Sole Project Owner |
| **Decision date** | 2026-07-29 |
| **Status** | **`OWNER APPROVED`** |

**The conflict this resolves.** The matrix assigned the table to HB-02 while HB-03's text described it as
deferred into "HB-04's migration" and treated the header as advisory in v1 — three different answers in one
pack. **The matrix wins**, per [D-MIG-01](#d-mig-01--migration-ownership): idempotency is a property of
HB-02's endpoint, and an endpoint that cannot be safely retried is not finished. Every statement that HB-02
idempotency storage is optional, deferred, or owned by HB-03 is withdrawn.

**Why required rather than optional.** An optional key leaves a duplicate window open by default, and the
one caller that matters — the HB-06 wizard — can always send one. Requiring it means the safe path is the
only path, and the failure when it is missing is immediate and explicit rather than a duplicate discovered
during reconciliation.

**Why the scope includes the actor.** Two operators independently generating the same key string must not
collide, and one operator must never be able to replay another's request. Scoping by actor + endpoint + key
makes squatting across endpoints and across users impossible by construction.

**Why no expiry in v1.** A sweeper is a background job that deletes financial-adjacent audit rows. It needs
a retention decision, an operational owner and its own failure modes, none of which HB-02 should invent.
Keys are small and bounded by the number of historical bookings ever recorded. Adding retention later is
additive.

**The boundary with HB-03, stated plainly.** Idempotency answers *"is this the same request?"*. HB-03
answers *"is this the same booking?"*. A retry of one request and two operators independently entering the
same stay are different problems with different correct responses, and both checks run.

---

## D-HB02-AMT — Financial truth boundary

| Field | Value |
|---|---|
| **Decision** | The canonical HB-02 request **requires `agreedAmount`**: the exact user-supplied historical agreed amount. It **must never default from the current unit price**. It may be **zero or positive**. It uses the repository's existing decimal precision and currency convention, and introduces **no currency redesign**. It is persisted **only** as the booking's required base agreed amount under the current schema and domain model. HB-02 creates **no** invoice, payment, payment evidence, fee, tax, discount, payout, or immutable extended financial snapshot. |
| **Basis** | `CONFIRMED` — `BookingService.cs:213,231-232` computes `BaseAmount` and `FinalAmount` from current pricing, which for a past stay is the wrong number. Booking money is `DECIMAL(12,2)` with `ck_bookings_base_amount_non_negative` and `ck_bookings_final_amount_non_negative` (`db/migrations/0016_create_bookings.sql:11-12,28-29`), mirrored in EF at `BookingConfiguration.cs:56,61`. `>= 0` already permits zero. |
| **Review lenses** | Finance · Engineering |
| **Decision authority** | Sole Project Owner |
| **Decision date** | 2026-07-29 |
| **Status** | **`OWNER APPROVED`** |

**Ownership, stated once so it stops being restated differently.** HB-02 owns **truthful capture of the raw
`agreedAmount` needed to create the booking** — nothing more. [HB-04](04_TICKET_FINANCIAL_SNAPSHOT_AND_HISTORICAL_PAYMENTS.md)
owns **the extended immutable historical financial snapshot and payment behaviour** — the dedicated
`bookings.agreed_amount` column (matrix #14), its constraint, the repricing guard, and every payment
concern. Two different things, two different migrations, one owner each.

**Why the field cannot simply be deferred to HB-04.** A booking row cannot be inserted without an amount,
and the amount the platform would compute is today's price for a stay that happened at a different price.
HB-02 must therefore supply the truth at creation or write a known-false number and correct it later — which
would mean a historical booking briefly carrying the wrong revenue figure.

**Why zero is valid.** A recorded stay with no charge is a real case: a comped stay, an owner's own use, a
goodwill arrangement. The existing constraint is `>= 0`, so zero needs no schema change and rejecting it
would invent a rule the platform does not have.

**Accepted residual risk.** Until HB-04's repricing guard ships, some other write path could in principle
overwrite the captured amount. The main path already cannot — `BookingService.cs:385-387` refuses to update
anything outside `Prospecting`/`Relevant`, and a historical booking is created `Completed`. HB-04 enumerates
the remainder rather than treating the risk as closed. **Revisit trigger:** any write path is found that can
mutate a `Completed` booking's amounts.

---

## D-HB02-OWN — Owner attribution boundary

| Field | Value |
|---|---|
| **Decision** | HB-02 **does not accept an arbitrary client-supplied owner override**. It resolves the current unit owner from trusted repository state. When exactly one valid current owner is deterministically available, it uses and persists that attribution. It **never silently guesses** and **never uses an arbitrary request owner**. When ownership is absent, multiple, ambiguous, or requires historical correction, it rejects with **`409 OWNER_ATTRIBUTION_REQUIRES_REVIEW`**. The canonical request exposes **no** unrestricted `ownerAttribution` or `ownerId` field. |
| **Basis** | `CONFIRMED` — `BookingService.cs:225` snapshots `OwnerId = unit.OwnerId` and no existing endpoint accepts an owner id for a booking. There is no date-ranged ownership history table, so a unit that changed hands between the stay and the recording cannot be resolved automatically. |
| **Review lenses** | Finance · Security · Product |
| **Decision authority** | Sole Project Owner |
| **Decision date** | 2026-07-29 |
| **Status** | **`OWNER APPROVED`** |

**Why removing the field is stronger than validating it.** An `ownerId` on the request must be checked
against the unit's owner on every path, forever, and a missed check silently redirects money. A field that
does not exist cannot be forged, cannot be mass-assigned, and cannot drift out of validation. This closes
`RISK-11` for HB-02 by construction rather than by vigilance.

**Why `409` rather than `400`.** The request is well-formed; the *state* is not resolvable. `409` is the
repository's existing conflict semantic (`ConflictException` → `409`), which also means HB-02 needs no new
exception type and no new middleware branch — see [D-HB02-04](#d-hb02-04--producing-a-403-for-an-owner-override-refusal).

**What HB-05 adds, additively.** Explicit owner confirmation and the gated override: a separate permission
(`bookings:override_owner`), a mandatory reason, previous and selected owner, actor and timestamp audit, and
the payout implications. **The extension must be backward-compatible** — a request valid under this decision
must remain valid after HB-05 ships, so HB-05's new fields are optional-with-safe-default or arrive with
their own permission. This is consistent with [D-OWN-01](#d-own-01--owner-attribution) and
[D-OWN-02](#d-own-02--owner-override); it settles only *which ticket* carries which half.

**Accepted risk.** Until HB-05 ships, a unit that changed hands cannot have its historical stay recorded at
all — the operator is blocked rather than given an override. That is the intended failure direction:
blocking is visible and correctable, misattribution is neither. **Revisit trigger:** the
`OWNER_ATTRIBUTION_REQUIRES_REVIEW` rate makes the pilot unworkable before HB-05 lands.

---

## D-HB02-CAL — Cairo business-date ownership

| Field | Value |
|---|---|
| **Decision** | **HB-02 owns creation of the narrowest repository-consistent Cairo business-date/clock abstraction** necessary for deterministic validation of `check_out_date <= Cairo business date − 1`. The absence of a pre-existing shared resolver is **no longer a readiness blocker**. This does **not** authorize an application-wide time redesign. |
| **Basis** | `CONFIRMED` — the expression exists in exactly one place and is private to a hosted service: `AutoCompleteBookingsJob.cs:70`, with the timezone lookup at `:137` (`Africa/Cairo`) and `:141` (`Egypt Standard Time` fallback). Nothing in `RentalPlatform.Business` or `RentalPlatform.Shared` exposes a business date. |
| **Review lenses** | Engineering · Operations |
| **Decision authority** | Sole Project Owner |
| **Decision date** | 2026-07-29 |
| **Status** | **`OWNER APPROVED`** |

**What "narrowest" means, concretely.** A single injectable abstraction exposing the current Cairo business
date and nothing else — no general clock, no `UtcNow` wrapper, no ambient time service. It reuses the exact
timezone lookup already proven in the job, so the platform keeps one definition of the Cairo day.

**What is explicitly not authorized.** Refactoring `AutoCompleteBookingsJob` onto the abstraction,
introducing a general `ITimeProvider`, or touching any other date handling. Converging the job is HB-08's,
alongside the rest of the observability work. HB-02 creates the abstraction and uses it; it does not migrate
the codebase to it.

**Why this unblocks readiness.** The earlier plan assumed HB-01 would deliver the resolver, and HB-01 is
decision-only and ships no code — so the dependency could never have been satisfied. Naming HB-02 as the
owner removes a phantom prerequisite. It also makes the boundary testable: an injected clock lets
`−2 / −1 / today / +1` be asserted directly rather than by waiting for midnight.

This implements [D-CAL-01](#d-cal-01--historical-completion-boundary), which fixes the *rule*. This decision
fixes *who builds the mechanism*.

---

## Deferred v1 decisions

Each of these is a **deliberate scope decision**, not an unresolved approval.

### OQ-05 — Currency model

| Field | Value |
|---|---|
| **Decision** | v1 assumes the repository's existing single-currency behaviour. **No new currency model will be introduced.** |
| **Basis** | `CONFIRMED` — no currency column exists in any table, no rate table exists, and no conversion code exists |
| **Review lenses** | Finance · Engineering |
| **Decision authority** | Sole Project Owner |
| **Decision date** | 2026-07-29 |
| **Status** | **`DEFERRED`** |
| **Risk accepted** | Historical bookings cannot represent multi-currency financial snapshots |
| **Revisit trigger** | The platform introduces more than one supported transaction currency |

Consequence: the historical command accepts no `currency` field, and one is explicitly rejected if sent
(HB-04 `FIN-15`). Assumption A-1 in HB-04 records this.

### OQ-06 — Fee, tax and discount model

| Field | Value |
|---|---|
| **Decision** | v1 will **not** introduce a new fee, tax or discount engine. The approved agreed total is treated as the historical financial snapshot. |
| **Basis** | `CONFIRMED` — no fee, tax or discount columns exist; invoice lines are limited to `booking_stay` and `manual_adjustment` and cannot be negative |
| **Review lenses** | Finance · Product |
| **Decision authority** | Sole Project Owner |
| **Decision date** | 2026-07-29 |
| **Status** | **`DEFERRED`** |
| **Risk accepted** | Component-level financial breakdown may be unavailable |
| **Revisit trigger** | Legal, tax, invoicing or reporting requirements demand component-level values |

Consequence: fees and taxes are folded into the agreed total, and the wizard states this to the operator
rather than leaving it as a silent assumption.

### OQ-07 — Paid payout correction

| Field | Value |
|---|---|
| **Decision** | Automated correction of an already-**paid** owner payout is outside v1. Such cases require a **manual owner-reviewed finance process**. Historical booking creation **must not mutate an existing paid payout**. |
| **Basis** | `CONFIRMED` — no adjustment or credit-note entity exists; `owner_payouts` is one row per booking with no settlement-period model, so a new historical booking creates its own payout and structurally cannot alter a settled one |
| **Review lenses** | Finance · Engineering · Operations |
| **Decision authority** | Sole Project Owner |
| **Decision date** | 2026-07-29 |
| **Status** | **`DEFERRED`** |
| **Risk accepted** | Corrections require manual handling until an adjustment ledger exists |
| **Revisit trigger** | A formal payout-adjustment or settlement-period model is introduced |

Consequence: HB-05's correction endpoint must **refuse loudly** on a paid payout rather than corrupt it, and
emit a `settlement_locked` signal so the frequency of the gap is measurable.

---

## ADR-01 … ADR-12

Every ADR has a final status. Decision authority for all twelve is the Sole Project Owner, decided
2026-07-29; the authority is stated once here rather than repeated per row.

| ID | Decision | Review lenses | Status |
|---|---|---|---|
| ADR-01 | Separate flow, separate endpoint, separate permission. No client-supplied bypass flag | Product · Security · Engineering | **`OWNER APPROVED`** |
| ADR-02 | v1 supports **completed** stays only | Product · Operations | **`OWNER APPROVED`** |
| ADR-03 | Completed-stay boundary = the `AutoCompleteBookingsJob` Cairo cutoff; checkout today is not complete | Product · Engineering · Operations | **`OWNER APPROVED`** — see [D-CAL-01](#d-cal-01--historical-completion-boundary) |
| ADR-04 | Create directly in `Completed` via the existing `initialStatus`; one truthful history event; no fake transitions | Engineering · Product | **`OWNER APPROVED`** |
| ADR-05 | A migration is required and accepted | Engineering · Operations | **`OWNER APPROVED`** — object ownership per [D-MIG-01](#d-mig-01--migration-ownership) |
| ADR-06 | Overloading `internal_notes` for structured historical data is rejected | Engineering · Product | **`OWNER APPROVED`** |
| ADR-07 | Operator-entered agreed amount, protected from automatic repricing | Finance · Engineering | **`OWNER APPROVED`** |
| ADR-08 | Hybrid owner model: default unit owner, mandatory review, gated override, snapshot, block on unknown | Product · Finance · Security · Operations | **`OWNER APPROVED`** — see [D-OWN-01](#d-own-01--owner-attribution) and [D-OWN-02](#d-own-02--owner-override) |
| ADR-09 | **Both** normal-flow hardening and the historical flow are in scope | Product · Security · Engineering | **`OWNER APPROVED`** — timing per [D-HARD-01](#d-hard-01--normal-flow-hardening) |
| ADR-10 | Historical conflict detection must include `Completed` and `LeftEarly` | Engineering · Operations | **`OWNER APPROVED`** in design; **`BLOCKED BY TECHNICAL PREREQUISITE PRE-02`** for merge — the conflict, concurrency and uniqueness behaviour it depends on cannot be verified until real PostgreSQL tests exist. This is the one ADR where implementation evidence is genuinely required before the code lands |
| ADR-11 | Reporting gains a stay-period dimension | Finance · Engineering · Product | **`OWNER APPROVED`** |
| ADR-12 | Inactive units allowed; soft-deleted units unsupported in v1 | Product · Engineering | **`OWNER APPROVED`** |

**Summary:** 12 of 12 have a final status. 11 are `OWNER APPROVED` outright. ADR-10 is approved as a design
decision but its merge is gated by `PRE-02`, which is a technical prerequisite, not an approval gap. No ADR
is deferred, and none is pending for want of a role holder.

---

## Active technical prerequisites

### PRE-00 — Historical data census

| Field | Value |
|---|---|
| **Purpose** | Establish, from real data rather than assumption, how many past-dated bookings already exist, what state they are in, and whether any of them would break the proposed schema constraints or migration defaults. |
| **Why it is a prerequisite and not a ticket task** | It is evidence-gathering against an existing dataset, not feature work. It was previously the last unfinished execution item inside HB-01, which contradicted HB-01's status as a completed decision-only gate. |
| **Owner** | An independent prerequisite PR. Not HB-01 — that ticket is complete and ships nothing. |
| **Review lenses** | Operations · Engineering · Finance |
| **Status** | **Active technical prerequisite** |

#### Data-access safety rules — binding

These are not advisory. Violating any of them invalidates the census.

1. Use **only** an authorized local, development, staging, or approved read-only snapshot.
2. **Do not access production without explicit authorization.** Wanting the numbers is not authorization.
3. **Do not write or mutate database data.** `SELECT` only — no `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`,
   `ALTER`, `MERGE`, `UPSERT`, no temporary tables, no session settings that alter data.
4. Produce **sanitized aggregate evidence only** — counts, sums, distributions, date ranges.
5. **Do not expose customer or sensitive personal data in documentation.** No guest name, phone, email,
   address, national id, payment reference or free-text note reaches any artefact, including screenshots.
   If a row must be discussed, refer to it by an opaque identifier.

#### Required findings

| # | Finding | Shape |
|---|---|---|
| C-1 | Count of existing past-dated bookings — `check_out_date` before the current Cairo business date | Single integer, plus the query used |
| C-2 | The same count **grouped by booking status** | One row per `booking_status` |
| C-3 | Related records attached to those bookings | Counts of associated `payments`, `invoices`, `owner_payouts` and `booking_status_history` rows |
| C-4 | Values that would conflict with the proposed schema constraints or migration defaults | Explicit list, checked against every `CHECK`, `NOT NULL`, default and unique index in the [ownership matrix](00_MASTER_PLAN.md#111-migration-ownership-matrix) — in particular `ck_bookings_historical_fields_coherent`, `ux_bookings_external_reference`, and the non-negative money constraints |
| C-5 | Whether any backfill or compatibility handling is required | A yes/no conclusion with the reasoning, not a hedge |
| C-6 | Entry-lag distribution for the past-dated rows, if derivable | p50 and max days between `created_at` and `check_out_date` — sizes `RISK-16` before hardening is activated |

#### Blocking semantics — read this carefully

`PRE-00` does **not** block the programme uniformly. Its blocking strength depends on what the evidence is
being used for.

| Relationship | Strength |
|---|---|
| Pilot approval | **Blocking.** No pilot begins without knowing what already exists |
| Migration rollout approval | **Blocking.** `C-4` and `C-5` determine whether the additive migrations are genuinely safe on real rows |
| HB-02 | **Conditionally blocking.** Blocks HB-02 **only when** the migration or backfill strategy materially depends on existing-row evidence — that is, when `C-4` finds a conflict or `C-5` concludes that backfill is required. If the census shows a clean dataset, HB-02 proceeds |
| HB-03 … HB-09 | Not blocking |
| REQ-16 hardening activation | **Blocking in effect** — `C-1`, `C-2` and `C-6` size how many operators rely on the open door today. Activating hardening without that number is guessing |

#### When no authorized dataset is available

This is the case the census must not paper over.

- **Absence of an accessible non-production dataset must not produce fabricated findings.** No estimated
  counts, no "likely zero", no numbers inferred from the schema.
- Record `PRE-00` as a **deployment-readiness gate** instead: the census remains outstanding, is carried
  into the release checklist, and must be executed against an authorized dataset before pilot and before
  migration rollout are approved.
- State plainly in the PR which environments were unavailable and why. An honest "not yet obtainable" is a
  valid outcome; an invented figure is not.

### PRE-01 — Database bootstrap parity for migration `0057`

| Field | Value |
|---|---|
| **Problem** | `db/init.sql` applies `0001` … `0056` and stops. `CONFIRMED` — the final `\i` is `0056_add_unit_portfolio_visibility.sql` at `db/init.sql:172`, while `db/migrations/0057_add_owner_contact_fields.sql` exists on disk. Any database bootstrapped from `init.sql` is therefore one migration behind a database built by replaying `db/migrations` in order. A second observation: `0057` ships `_verify.sql` but, unlike every migration from `0050` to `0056`, no `_rollback.sql`. |
| **Owner** | A separate prerequisite implementation PR. **Not** HB-02, HB-04, HB-05, HB-08 or HB-09 — this is a pre-existing bootstrap defect and must not be folded into a feature migration |
| **Review lenses** | Engineering · Operations |
| **Status** | **`COMPLETE` — merged.** `db/init.sql` now includes `0057` exactly once (commit `4d649d6`, merged as `9f7af2f`), and the chosen rollback answer was option (d): `db/migrations/0057_add_owner_contact_fields_rollback.md` documents that an automated rollback is unsafe, because both columns are mapped by current application code and may hold real owner contact data |
| **Blocks** | *(discharged)* Formerly: migration ordering assumptions, the CI schema-parity gate, and any claim that a CI or local schema matches production. **HB-02 is no longer gated on it** |

**Required outcome:** database bootstrap parity is restored, so a database built from `db/init.sql` matches
one built by replaying `db/migrations` in order, and the parity is machine-checkable thereafter.

**The rollback question is deliberately left open.** This document does **not** prescribe writing a
`0057_add_owner_contact_fields_rollback.sql`. Adding an unexamined rollback script for a column that may
already hold production data would be worse than having none. The implementing agent must first perform
repository and data-safety analysis — what `0057` actually adds, whether those columns are populated in any
live environment, and whether dropping them is recoverable — and then choose and justify **one** of:

| Option | When it is correct |
|---|---|
| A safe rollback script | The change is genuinely reversible with no data loss in every environment |
| A guarded rollback | Reversal is safe only under a checkable precondition, which the script asserts and refuses to proceed without |
| A forward-repair migration | Reversal is not the right shape; the correct remedy is a subsequent corrective migration |
| Explicit documentation that rollback is unsafe after data exists | No safe automated reversal is possible; the limitation is recorded in the release checklist instead of pretended away |

The analysis and the chosen option must be attached to the PR. Choosing an option without the analysis is a
stop condition.

### PRE-02 — Baseline test execution and PostgreSQL integration infrastructure

| Field | Value |
|---|---|
| **Problem** | CI executes **no tests at all**. `CONFIRMED` — `.github/workflows/pr-checks.yml` contains five build jobs and no `dotnet test` step and no `services:` block. Consequently no transaction, advisory-lock, uniqueness, concurrency or database-`CHECK` guarantee in this pack is currently verifiable. |
| **Owner** | **An independent prerequisite implementation PR, delivered before HB-03.** Not HB-09, and not any feature ticket |
| **Review lenses** | Engineering · Operations |
| **Status** | **Active technical prerequisite** |
| **Blocks** | **HB-03 must not merge before PRE-02 is complete** |

#### Required outcome — baseline testing infrastructure only

`PRE-02` builds the substrate. It contains **no** Historical Bookings feature tests.

| # | Deliverable | Acceptance |
|---|---|---|
| 1 | **An actual CI test step that can fail the build** | A test job exists in the pipeline, runs on every PR, and a deliberately failing test turns the build red. A build-only pipeline is not a test gate |
| 2 | **Reusable real-PostgreSQL provisioning** | A service container in CI and an equivalent local path (`docker compose up db`), using the same image the application uses |
| 3 | **A reusable PostgreSQL integration-test fixture** | Any ticket can inherit it to obtain a clean, isolated database. Not a one-off harness written for this feature |
| 4 | **Transaction-capable test setup** | A test can open a real transaction, exercise `pg_advisory_xact_lock`, and observe commit and rollback semantics — the three things EF Core InMemory cannot do |
| 5 | **Clear failure when PostgreSQL is unavailable** | The job fails with a legible message naming the missing dependency |
| 6 | **No silent fallback** | It must be impossible for the relational suite to quietly degrade to mocked or in-memory persistence and still report green. This is the single most important property: a fallback that passes is worse than no suite at all |
| 7 | **Baseline documentation for later feature tests** | How to write a relational test, how to get a database locally, what the fixture guarantees, and what the tier boundaries are |

#### PRE-02 versus HB-09 — who owns what

An earlier revision recorded `PRE-02` as being *delivered through* HB-09. That was contradictory and is
withdrawn: `PRE-02` gates HB-03's merge, while HB-09 runs after every feature wave including HB-03. A
prerequisite cannot be delivered by a ticket that depends on the thing it gates.

| Concern | **PRE-02** (prerequisite, before HB-03) | **HB-09** (final ticket, after HB-06…HB-08) |
|---|---|---|
| CI test step that can fail the build | **Owns** | Extends with feature suites and required-check configuration |
| Real-PostgreSQL provisioning and fixture | **Owns** | **Consumes.** Must not reimplement, fork or replace it |
| Transaction / advisory-lock capability | **Owns** | Consumes |
| No-silent-fallback guarantee | **Owns** | Asserts it still holds |
| Historical Bookings regression suites | Out of scope | **Owns** |
| Reliability-scenario release coverage | Out of scope | **Owns** |
| Feature release gates | Out of scope | **Owns** |
| Rollout verification | Out of scope | **Owns** |
| Final traceability and sign-off evidence | Out of scope | **Owns** |

**HB-09 must not own, delay, or reimplement the baseline PostgreSQL infrastructure.** If HB-09 finds the
`PRE-02` fixture inadequate, the correct action is to extend it in place and record why — not to rebuild it,
and not to defer `PRE-02`'s guarantees into HB-09's timeline.

**Note on scope.** The documentation passes that produced this pack **read** `.github/workflows/`,
`db/init.sql` and `db/migrations/` to establish the facts above and **modified none of them**. All three
prerequisites are implementation work for later, separate PRs.

---

## Decision record

| Decision | Outcome | Status | Authority | Date |
|---|---|---|---|---|
| D-CAL-01 | `check_out_date <= Cairo business date − 1` | `OWNER APPROVED` | Sole Project Owner | 2026-07-29 |
| D-INV-01 | No invoice created or issued in v1; limitation visible via HB-08 | `OWNER APPROVED` | Sole Project Owner | 2026-07-29 |
| D-PAY-01 | Separate privileged historical-payment command | `OWNER APPROVED` | Sole Project Owner | 2026-07-29 |
| D-OWN-01 | Default unit owner; explicit review; block on uncertainty | `OWNER APPROVED` | Sole Project Owner | 2026-07-29 |
| D-OWN-02 | Distinct permission; mandatory reason; full audit | `OWNER APPROVED` | Sole Project Owner | 2026-07-29 |
| D-MIG-01 | One owner per schema object; cross-ticket use is a dependency | `OWNER APPROVED` | Sole Project Owner | 2026-07-29 |
| D-ROLL-01 | Implement → test → pilot → harden | `OWNER APPROVED` | Sole Project Owner | 2026-07-29 |
| D-HARD-01 | HB-01 specifies; HB-08 implements and activates last | `OWNER APPROVED` | Sole Project Owner | 2026-07-29 |
| D-TEST-01 | Real PostgreSQL testing mandatory before HB-03 merges | `OWNER APPROVED`; execution `BLOCKED BY TECHNICAL PREREQUISITE PRE-02` | Sole Project Owner | 2026-07-29 |
| OQ-05 | Single currency; no currency model in v1 | `DEFERRED` | Sole Project Owner | 2026-07-29 |
| OQ-06 | No fee/tax/discount engine; agreed total is the snapshot | `DEFERRED` | Sole Project Owner | 2026-07-29 |
| OQ-07 | Paid-payout correction is a manual process in v1 | `DEFERRED` | Sole Project Owner | 2026-07-29 |
| ADR-01 … ADR-09, ADR-11, ADR-12 | As tabulated above | `OWNER APPROVED` | Sole Project Owner | 2026-07-29 |
| ADR-10 | Historical conflict set incl. `Completed`/`LeftEarly` | `OWNER APPROVED` in design; merge `BLOCKED BY TECHNICAL PREREQUISITE PRE-02` | Sole Project Owner | 2026-07-29 |
| PRE-00 | Historical data census — read-only, non-production, sanitized aggregates | Active technical prerequisite. Blocks pilot and migration rollout approval; blocks HB-02 only on existing-row evidence | Sole Project Owner | 2026-07-29 |
| PRE-01 | Database bootstrap parity for `0057`; rollback approach chosen by analysis | Active technical prerequisite. Blocks HB-02 | Sole Project Owner | 2026-07-29 |
| PRE-02 | Baseline test execution and real-PostgreSQL infrastructure, delivered independently before HB-03 | Active technical prerequisite. Blocks HB-03. **Not delivered by HB-09** | Sole Project Owner | 2026-07-29 |

**Nothing in this programme is waiting on a person.** The only open items are `PRE-00`, `PRE-01` and
`PRE-02` — all three technical, all three independent prerequisite PRs.
