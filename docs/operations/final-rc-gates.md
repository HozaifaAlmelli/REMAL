# Final Release Candidate gates

`RC-ENABLEMENT-01` turns the existing release checks into one auditable runner. It does not deploy, connect to
production, run a production migration, or publish rentable-capacity coverage.

## Run the automated code gates

From a clean checkout at the proposed RC commit:

```bash
sha="$(git rev-parse HEAD)"
run_id="$(date -u +%Y%m%dt%H%M%sz)-operator"
bash scripts/final-rc-gates.sh \
  --expected-sha "$sha" \
  --lane full \
  --mode automated \
  --evidence-root "artifacts/final-rc" \
  --run-id "$run_id"
```

The full lane always provisions its own official `postgres:16-alpine` container and volume and overrides the
test connection for that process. The disposable resources are removed on exit. This prevents the code/test
orchestrator from being pointed at an owner, shared, staging, release or production database.

The runner requires an exact 40-character SHA, takes an exclusive repository-local execution lock, checks
`HEAD`, rejects a dirty tracked tree or index before and after every gate, streams redacted underlying output,
stops at the first failing mandatory gate, and treats any unverified completion or discovered skipped test as
a failure. Every retry uses a new, exclusively created
`artifacts/final-rc/<sha>/<run-id>/` directory. Traversal, symlink escape, unsafe gate IDs and overwrite are
rejected. Recursive redaction is applied before writing JSON, Markdown or logs.

`--mode automated` verifies code gates while honestly retaining external items as
`MANUAL_EVIDENCE_REQUIRED`. `--mode final` can report `READY_FOR_OWNER_GO_NO_GO` only for the `full` lane,
after every full-lane gate, ratified identity, #99 category and manual item is resolved and the final postflight
is clean. A hosted lane can never produce readiness.

Manual evidence follows `manual-evidence.schema.json`. Every `MANUAL_PASS` is independently bound to the full
RC SHA and includes executor identity, timezone-qualified timestamp, evidence type, reference and lowercase
SHA-256 provenance digest. `owner_go_no_go` additionally requires `owner_decision` evidence. Arbitrary text
references, stale per-item SHAs, malformed attestations, duplicates and unknown items are refused.

## Automated commands

The checked manifest at `release-gates/final-rc/gates.json` is the executable inventory. Its full lane runs:

- Release solution build; focused Historical Booking, Historical Reporting, B1, B2, invoice/payment and
  INV-AUDIT implementation tests; Fast, PostgreSQL and full backend suites;
- portal install, TypeScript, lint, historical-booking/reporting/occupancy/RBAC contracts, production build,
  and isolated Historical Booking, Historical Reporting, Occupancy and Booking History/RBAC Playwright;
- storefront install, tests and its TypeScript-validating production build;
- migration selection, backup safety, release-hardening PostgreSQL, current migration/bootstrap PostgreSQL,
  API production-image construction, production Compose rendering, ShellCheck and actionlint;
- the final-RC validator's own fail-closed tests.

The manifest maps those commands into the #99 `P0`, `P1`, `security`, `accounting`, and
`release_critical_uat` categories. Human UAT and finance review remain explicit manual gates.
The hosted aggregate lane depends on all six existing PR checks at the same PR-head SHA, then runs the gate
self-tests, portal contracts and four isolated browser suites. Its success proves automated PR evidence only;
it does not resolve release-database or manual evidence.

## Ratified HB-09 identity inventory

`ratified-identities.json` is an independently reviewed oracle containing the exact 160 scenarios, 208 AC,
155 NAC and 45 public errors. Source documentation and final packet rows are reconciled independently against
those exact identities. A future identity change therefore requires an explicit catalog diff. Broad suite
success does not automatically claim identity evidence: the SHA-bound `reliability_99_completion` attestation
must resolve the exact inventory.

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
