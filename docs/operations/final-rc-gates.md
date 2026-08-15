# Final Release Candidate gates

`RC-ENABLEMENT-01` turns the existing release checks into one auditable runner. It does not deploy, connect to
production, run a production migration, or publish rentable-capacity coverage.

## Run the automated code gates

From a clean checkout at the proposed RC commit:

```bash
sha="$(git rev-parse HEAD)"
bash scripts/final-rc-gates.sh \
  --expected-sha "$sha" \
  --lane full \
  --mode automated \
  --evidence-dir "artifacts/final-rc/$sha"
```

The full lane always provisions its own official `postgres:16-alpine` container and volume and overrides the
test connection for that process. The disposable resources are removed on exit. This prevents the code/test
orchestrator from being pointed at an owner, shared, staging, release or production database.

The runner requires an exact 40-character SHA, checks `HEAD`, rejects a dirty tracked tree or index, streams
redacted underlying output, stops at the first failing mandatory gate, and treats any discovered skipped test
as a failure. It writes `evidence.json`, `summary.md`, and one log per command. Generated evidence belongs
under ignored `artifacts/`; it must not contain credentials, connection strings, JWTs, payment references, or
database row contents.

`--mode automated` verifies code gates while honestly retaining external items as
`MANUAL_EVIDENCE_REQUIRED`. `--mode final` additionally requires a SHA-bound manual evidence file in which
every manual item is `MANUAL_PASS` with an evidence reference. A manual item cannot be promoted to
`AUTOMATED_PASS`.

## Automated commands

The checked manifest at `release-gates/final-rc/gates.json` is the executable inventory. Its full lane runs:

- Release solution build; focused Historical Booking, Historical Reporting, B1, B2, invoice/payment and
  INV-AUDIT implementation tests; Fast, PostgreSQL and full backend suites;
- portal install, TypeScript, lint, historical-booking/reporting/occupancy/RBAC contracts, production build,
  and isolated Historical Booking, Historical Reporting, Occupancy and Booking History/RBAC Playwright;
- storefront install, tests and its TypeScript-validating production build;
- migration selection, backup safety, release-hardening PostgreSQL, current migration/bootstrap PostgreSQL,
  and production Compose rendering;
- the final-RC validator's own fail-closed tests.

The manifest maps those commands into the #99 `P0`, `P1`, `security`, `accounting`, and
`release_critical_uat` categories. Human UAT and finance review remain explicit manual gates.
The hosted aggregate lane depends on all six existing PR checks at the same PR-head SHA, then runs the gate
self-tests, portal contracts and four isolated browser suites. Its success proves automated PR evidence only;
it does not resolve release-database or manual evidence.

## Dynamic HB-09 inventory

The validator derives scenario headings and automation classification from
`99_RELIABILITY_TEST_SCENARIOS.md`, AC/NAC definitions from the ticket documents, and public error codes from
Master section 12.3. It rejects duplicate IDs, missing group/ticket/error mappings, missing final evidence
rows, passed rows without evidence, wrong-SHA evidence and unexplained skips. Observed counts are output for
review but are never used as a fixed correctness oracle.

## Release-database sequence

The following sequence is external evidence and is never executed by PR CI:

1. approved production-derived snapshot provenance;
2. isolated PostgreSQL 16 restore;
3. pre-migration ledger capture;
4. pre-migration INV-AUDIT-01;
5. hardened migration runner;
6. migration 0063 verifier;
7. migration 0064 verifier;
8. exact-RC application deployment to the isolated release environment;
9. rentable-capacity initializer rehearsal;
10. rentable-capacity verifier;
11. P0, P1, security and finance UAT;
12. post-UAT INV-AUDIT-01;
13. reporting, finance, rentability and RBAC reconciliation;
14. #99 completion;
15. HB-09 sole-owner GO/NO-GO.

Until those references are supplied, final GO remains `NOT_READY`.

## Production boundary

Production begins only after final GO: read-only production census, exact pending-migration suffix proof,
fresh validated backup, explicit destructive approval, hardened migration runner, 0063/0064 verifiers,
INV-AUDIT-01, deployment of the exact approved RC SHA, rentability initialization using the actual current
Cairo date, rentability verification, and read-only smoke. UAT never writes to production. This automation
does not authorize or perform any of those actions.
