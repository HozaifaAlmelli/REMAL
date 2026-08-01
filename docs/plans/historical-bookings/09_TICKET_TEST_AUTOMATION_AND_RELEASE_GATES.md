# HB-09 — Test Automation and Release Gates

> Navigation: [README](README.md) · [Master](00_MASTER_PLAN.md) · [Scenarios](99_RELIABILITY_TEST_SCENARIOS.md)

## 1. Ticket metadata

| Field | Value |
|---|---|
| Ticket | HB-09 |
| Status | **OWNER APPROVED — BLOCKED BY DEPENDENCY** |
| Depends on | HB-02 through HB-08A; HB-08B gates final release when REQ-16 is included |
| Migration ownership | None |
| Foundation | PRE-01 and PRE-02 are complete and merged |

HB-09 completes feature-owned automation and produces release evidence. It does not rebuild PRE-02, deploy,
or turn a merged test PR into production approval.

## 2. Actual test foundation

PRE-01 restored development bootstrap parity through migration `0057` and deliberately documents automated
rollback as unsafe (Strategy D). PRE-02 supplies:

- explicit required `KAZA_TEST_DB` with no localhost, Compose, SQLite, InMemory or mock fallback;
- a reusable disposable real-PostgreSQL fixture;
- test categories `Fast`, `PostgreSQL`, and `Concurrency`;
- GitHub Actions jobs `backend` and `backend-postgres` that execute tests;
- PostgreSQL 16 provisioning for hosted integration tests.

Missing/blank `KAZA_TEST_DB` fails before a connection or database creation. Local values must target an
authorized disposable PostgreSQL 16 database satisfying the fixture's test-name and host safety rules.

## 3. Suite topology

| Suite | Purpose | Required substrate |
|---|---|---|
| Fast | Validation, mapping, error transport, pure domain decisions | `dotnet test --filter Category=Fast` |
| PostgreSQL | Migrations, constraints, transactions, locks, idempotency, rollback | Explicit `KAZA_TEST_DB`; `Category=PostgreSQL` |
| Concurrency | Independent-connection races and deterministic winner/loser outcomes | PostgreSQL 16; serialized where tests share state |
| Portal contract | Wizard reducers/mappers/error handling | Existing `tsx --test` convention |
| Browser | Permission, workflow, accessibility and responsive behavior | Existing Playwright setup |

Vitest, Jest and React Testing Library are not introduced. EF InMemory is never evidence for PostgreSQL
constraints, transactions, advisory locks, uniqueness or concurrency.

## 4. Dynamic contract counts

No stable-code, scenario or test count is hard-coded as a release invariant. CI derives and publishes:

1. canonical error rows from Master §12.3, asserting unique code spelling and one owner;
2. scenario definitions from `99_RELIABILITY_TEST_SCENARIOS.md`, asserting unique IDs and valid references;
3. discovered test totals from runner output, split by category and skip/failure state;
4. AC/NAC identifiers and contiguous ticket mappings;
5. migration-object ownership rows, asserting one owner and no reserved migration number.

The PR may report the observed counts, but gates compare generated inventories, not stale constants.

## 5. Feature coverage

HB-09 fills only missing cross-ticket/release coverage; each feature ticket retains its focused tests. Required
coverage includes canonical endpoint/error contracts, Cairo dates, idempotency, conflicts, payment evidence,
owner correction, notification absence, two-axis reporting, invoice/evidence separation, migrations,
rollback guards, concurrency and normal-flow regressions.

Every automatable scenario marked YES in the scenario catalog maps to an executable test or an explicit
hosted/manual gate with evidence. No scenario is skipped merely because it is expensive or currently failing.

## 6. CI required-check policy

After each workflow has run successfully for an observation window, the owner configures these required
branch-protection checks:

- backend Fast/build check;
- `backend-postgres`;
- schema/bootstrap parity and migration verifier check;
- portal `tsx --test`/build check;
- relevant Playwright frontend check.

Workflow success is not claimed until GitHub hosts the run. Branch-protection changes remain owner-controlled
and are not part of HB-09 code.

## 7. Release gates

There is no arbitrary line/branch coverage percentage. Release gates are invariant- and scenario-based:

- zero failed and zero unjustified skipped required tests;
- all catalog IDs unique and mapped;
- every stable business response has a code;
- fresh development and production bootstrap parity;
- upgrade, verifier and guarded rollback evidence;
- repeated concurrency evidence;
- no notification/invoice/payout/payment side-effect violations;
- recorded/stay/evidence reconciliation;
- PRE-00, backup, restore, rehearsal, integrity comparison and rollback readiness;
- sole owner manual review of residual risks and explicit go/no-go.

The HB-09 implementation PR is complete when automation and evidence contracts pass. Staging, pilot and
production go/no-go are separate later operational decisions. A merged HB-09 PR is not release approval.

## 8. Reliability scenario corrections

The catalog uses the separate HB-04B payment command. Payment-command failure leaves the already-created
booking intact while rolling back only payment, payment-history and payment-idempotency rows. Manual invoices
remain allowed; historical evidence stays unlinked. Owner correction follows HB-05's no-payout-only policy.
Reporting scenarios use `source='admin'`, canonical `original_source`, stay-start bucketing and dedicated
historical-evidence totals. UI scenarios use two-phase booking/payment UX and safe metadata.

## 9. Test data and safety

Use generated or sanitized fixtures only. Never copy production data. Every destructive reset validates an
explicit test database name and authorized host. Independent concurrency contexts use independent
connections. Task-created databases/containers/volumes/networks are removed and cleanup is asserted.

## 10. Acceptance criteria

| ID | Criterion |
|---|---|
| AC-HB09-01 | Fast tests execute and fail the workflow on failure. |
| AC-HB09-02 | PostgreSQL tests require explicit `KAZA_TEST_DB` and PostgreSQL 16. |
| AC-HB09-03 | Missing/blank configuration fails before any connection or database creation. |
| AC-HB09-04 | Concurrency tests use independent connections and deterministic assertions. |
| AC-HB09-05 | Fresh development and production bootstrap checks execute. |
| AC-HB09-06 | Upgrade, verifier, ledger and guarded rollback paths execute. |
| AC-HB09-07 | Canonical error inventory is generated, uniquely owned and asserted. |
| AC-HB09-08 | Scenario inventory is generated, unique and fully mapped. |
| AC-HB09-09 | AC/NAC inventory and traceability are machine-validated. |
| AC-HB09-10 | HB-02 idempotency and Cairo regressions remain green. |
| AC-HB09-11 | HB-03 conflict and concurrency regressions remain green. |
| AC-HB09-12 | HB-04A snapshot and HB-04B payment regressions remain green. |
| AC-HB09-13 | HB-05 correction/payout-safety regressions remain green. |
| AC-HB09-14 | HB-06 uses `tsx --test` and relevant Playwright checks. |
| AC-HB09-15 | HB-07 proves zero automatic notifications/integrations. |
| AC-HB09-16 | HB-08 axes and standalone-evidence totals reconcile. |
| AC-HB09-17 | Required check candidates are observed successfully before owner configuration. |
| AC-HB09-18 | Test output publishes actual discovered pass/fail/skip counts. |
| AC-HB09-19 | No required scenario is silently skipped or weakened. |
| AC-HB09-20 | Cleanup proves no disposable PostgreSQL resource remains. |
| AC-HB09-21 | HB-09 PR completion is reported separately from operational release readiness. |
| AC-HB09-22 | Final go/no-go requires explicit sole-owner review of all release evidence. |

## 11. Negative acceptance criteria

| ID | Prohibited outcome |
|---|---|
| NAC-HB09-01 | No SQLite/InMemory/mock fallback for PostgreSQL behavior. |
| NAC-HB09-02 | No implicit localhost or development Compose connection. |
| NAC-HB09-03 | No production, staging or shared database data in tests. |
| NAC-HB09-04 | No `continue-on-error`, ignored exit code or unconditional skip. |
| NAC-HB09-05 | No fixed stable-code/scenario/test count as a correctness oracle. |
| NAC-HB09-06 | No new Vitest, Jest or React Testing Library dependency. |
| NAC-HB09-07 | No arbitrary coverage-percentage release threshold. |
| NAC-HB09-08 | No test weakening to make a known invariant pass. |
| NAC-HB09-09 | No HB-09-owned migration or schema object. |
| NAC-HB09-10 | No branch-protection mutation by the implementation agent. |
| NAC-HB09-11 | No claim that hosted checks passed before observation. |
| NAC-HB09-12 | No claim that PR completion equals staging/pilot/production approval. |
| NAC-HB09-13 | No generated dump, credential, log or disposable resource committed. |
| NAC-HB09-14 | No release before PRE-00 and mandatory backup/restore/rehearsal gates. |

## 12. QA and release checklist

Run restore, Release build, Fast, PostgreSQL, full suite, focused races repeatedly, portal tests, relevant
Playwright, fresh/upgrade/verifier/rollback, traceability validators and `git diff --check`. Publish actual
counts and hosted-check links. The sole owner records any manual residue and the final go/no-go.

## 13. Readiness

The HB-09 contract is closed. Implementation is **BLOCKED BY DEPENDENCY** until HB-06, HB-07 and HB-08A are
complete; final release evidence also depends on HB-08B and operational gates.
