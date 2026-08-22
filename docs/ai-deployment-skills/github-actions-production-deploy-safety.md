---
name: github-actions-production-deploy-safety
description: Review, dispatch, and monitor Kaza production operations through the trusted current-main control plane.
risk_level: critical
when_to_use: Before any production deploy/release or any change to its workflow and scripts.
do_not_use_when: The task is local-only and cannot affect production.
required_inputs:
  - Full reviewed target SHA
  - Deploy or release mode decision
  - Access to the GitHub Environment approval and run logs
forbidden_actions:
  - Executing deployment scripts from an application candidate
  - Reintroducing a push trigger, password SSH, unpinned actions, or arbitrary hooks
  - Recreating the database during code deployment
  - Bypassing the production Environment or host operation lock
preflight_checks:
  - Verify the production Environment policy and required secret names
  - Verify current main branch protections and hosted checks
  - Verify target lineage and migration mode
safe_procedure: Follow this document.
verification: Exact running image IDs, health checks, ledger, audit record, and unchanged database container.
rollback: Use the recorded previous successful SHA and recovery manifest through the same trusted control plane.
stop_conditions: Any failed guard or unverifiable state.
final_report_required: true
---

# GitHub Actions Production Deploy Safety

## Trust model

The workflow is manual-only and must run from `refs/heads/main`. It checks out the current
main revision and sends [`bootstrap-production-control.sh`](../../scripts/bootstrap-production-control.sh)
to the host. That bootstrap verifies that its control SHA is still current `origin/main`,
creates a clean control worktree, and invokes only control-plane scripts from that tree.

The requested application SHA is a separate candidate worktree. A candidate never supplies
deployment, migration-runner, audit, locking, backup-validation, or smoke-test code. Releases
must target current main. A rollback may target only `previous-sha.txt` when the append-only
audit proves that exact SHA previously completed under the trusted runner.

## Environment and SSH policy

Before every release window run:

```bash
bash scripts/verify-production-environment-policy.sh
```

The policy requires:

- custom deployment branch policy with only `main`;
- independent required reviewers, self-review disabled, and admin bypass disabled;
- only `SSH_HOST`, `SSH_USER`, `SSH_PORT`, `SSH_KEY`, and
  `SSH_HOST_FINGERPRINT` in the Environment;
- no `SSH_PASSWORD`.

The workflow pins both checkout and SSH actions to full commits and passes the expected SSH
host fingerprint to the action. If key or fingerprint provisioning is incomplete, the safe
state is an unavailable deployment, never password fallback.

## Modes

| Mode | Permitted operation |
|---|---|
| `deploy` | Code-only deploy. The complete database ledger must already satisfy the candidate. The existing `kaza-prod-db` identity is checked before and after and is never recreated. |
| `release` | Current-main only. Validate ledger, create and validate the exact returned backup artifact, apply pending migrations, verify ledger, then call the code deploy. |

Both paths acquire `/opt/kaza/releases/production-operation.lock` using non-blocking
`flock`. Direct migration execution uses the same host lock in addition to its PostgreSQL
advisory lock. A concurrent operation refuses with a clear message.

## One-time legacy provenance transition

Containers created by the pre-hardening deploy use the generic revision label `prod` and
have no trusted content-ID audit record. The first hardened deployment therefore requires
the explicit `approve_legacy_provenance_baseline` input. It is accepted only when there is
no successful trusted deployment in `deployments.jsonl`, the live checkout equals
`current-sha.txt`, all three application containers have the known legacy `prod` label,
and the target is current `main`. Release mode performs this check before any database
mutation. After the first successful trusted deployment, the exception is permanently
refused and every running image ID must match the last successful audit evidence.

## Required deployment evidence

The deploy builds `api`, `demo`, and `portal` from the candidate. For each service it
captures the content-addressed Docker image ID plus target/control OCI labels. The running
container must match all three. SHA and `:prod` tags are aliases only; `:prod` is updated
after verification.

Before the first service recreate, the runner writes a recovery manifest containing prior
and target image identities. After each recreate it updates the changed-service list. A
failure does not attempt an unsafe automatic rollback: the manifest and candidate are
retained, a strict `FAILED` audit record is required, and the operator follows
[`rollback-and-recovery.md`](../operations/rollback-and-recovery.md).

A partial-run recovery may select only the failed manifest's exact `previous_sha`, using
the workflow's `recovery_run_id` input in `deploy` mode. Current `main` still supplies all
control scripts. Missing, symlinked, malformed, non-failed, wrong-run, or wrong-SHA
manifests fail closed. The mixed live state must match the manifest's exact previous and
attempted target image IDs service by service. This exception never authorizes migration
rollback.

Every audit append is schema-validated JSON, serialized, fsynced, and blocking. Existing
malformed JSONL prevents further operation. Required fields include target/control SHA,
actor, workflow run, timestamps, previous SHA, migration state, backup artifact, result,
changed services, image evidence, and recovery manifest.

The former arbitrary pre/post release hooks do not exist. Every production step must be a
reviewed control-plane command with explicit ordering and audit semantics.

## Dispatch and verify

```bash
git log -1 --format='%H %s' origin/main
gh workflow run deploy-production.yml --repo <owner>/REMAL \
  --ref main -f deploy_sha=<full-sha> -f mode=<deploy|release>
gh run watch --repo <owner>/REMAL
```

After approval and completion, verify without exposing secrets:

```bash
cat /opt/kaza/releases/current-sha.txt
docker inspect -f '{{.Image}}' kaza-prod-api
docker inspect -f '{{index .Config.Labels "org.opencontainers.image.revision"}}' kaza-prod-api
tail -1 /opt/kaza/releases/deployments.jsonl
```

The run must also prove the database container ID did not change, the final migration
ledger matches its fully validated state, all Kaza health checks pass, the read-only auth
smoke passes, Novatova remains healthy, and no `libgssapi` error appears.

## Global stop conditions

Stop if the control SHA is not current main, target is unauthorized, Environment policy
differs, repository is dirty, host lock is held, ledger/checksum validation fails, backup
handoff is missing or outside its destination, database container identity changes, image
identity differs, audit write fails, auth-smoke credentials are unavailable, nginx test
fails, or any operation would touch Novatova or Kaza edge containers.

Never run `docker compose down`, a bare `up -d`, an unscoped recreate, direct candidate
deployment scripts, or a password-based SSH workaround.
