# Production State Governance

> The operational procedure — how to inspect, prepare, deploy, and roll back — is
> [`production-deployment.md`](production-deployment.md). This document explains the
> governance *model* behind it and records how the current baseline was established.

Production identity is a reconciliation, not a text file, tag, or operator memory.
The current state is `GOVERNED` only when one successful deployment audit record agrees
with all of these live facts:

- the exact application commit and trusted control commit;
- the running `api`, `demo`, and `portal` content-addressed image digests;
- each container's application and control OCI revision labels;
- the complete validated migration-ledger head;
- `current-sha.txt` and the clean live checkout.

The normal operator path dispatches the current-`main` trusted control plane through the
protected production Environment:

```bash
gh workflow run deploy-production.yml --ref main \
  -f deploy_sha=<expected-full-main-sha> -f mode=inspect
```

The workflow runs `scripts/production-state.sh` from an ephemeral verified current-main
control worktree. The script itself refuses a control checkout whose HEAD is not its
`origin/main`; do not invoke a copy from a historical live application checkout.

The command takes the global production-operation lock, issues only read-only state and
database queries, emits one `kaza-production-state-v1` JSON document, and returns zero
only for `GOVERNED`. `UNVERIFIED_LEGACY` means no successful trusted deployment record
exists. `DRIFTED` means a trusted record exists but a live fact differs. Neither state is
release evidence. A governed result includes the validated actor, timestamp, workflow,
authorization reference, previous version, migration transition, backup reference, and
running image digests, so this one result answers who changed production, when, and what
exact state remains live.

The same check is available through **Deploy Production** with `mode=inspect` and an
expected full `main` SHA. This path still uses current `main` tooling and the protected
GitHub Environment.

## First governed release

Legacy containers without exact OCI commit/control labels cannot be assigned to a Git
commit after the fact. `current-sha.txt`, a clean checkout, matching timestamps, and a
mutable image tag are supporting observations, not artifact provenance. The one-time
`approve_unverified_legacy_replacement` input therefore authorizes replacement of the
unverified runtime by a newly built, SHA-labelled, digest-verified current-`main`
release. It does **not** certify the old images or create a successful baseline record
for them.

The transition is:

1. merge and independently approve the hardened control plane through `dev` and `main`;
2. provision the production Environment's `SSH_KEY` and pinned
   `SSH_HOST_FINGERPRINT`;
3. run `inspect` and retain its expected non-governed report;
4. approve one current-`main` `deploy` or `release` operation with the legacy replacement
   input, according to the validated migration state;
5. run `inspect` again and require `GOVERNED`.

If the database already satisfies the candidate's complete migration registry, use
`deploy`; this does not recreate or restart the database. A schema-changing candidate
uses `release` and the established backup/migration gates.

## Deployment evidence

Every prepared/terminal record in `/opt/kaza/releases/deployments.jsonl` is strict
`kaza-production-deployment-v1` JSON. Required identity fields include:

- `deployment_id`, `commit_sha`, `control_sha`, `branch`, `actor`;
- `workflow_run` and `authorization_ref`;
- `timestamp`, `started_at`, `previous_version`;
- `image_digests`, `database_migration_before`, `database_migration_after`;
- `backup_artifact`, `result`, changed services, and recovery evidence.

GitHub operations bind those fields to the exact Actions run and production Environment.
An emergency manual operation must use the same current-`main` bootstrap, dispatcher,
host lock, migration guard, provenance, smoke, recovery, and audit path. It requires an
identified actor plus an `emergency:<reviewed-reference>` authorization. Direct Compose,
manual image replacement, manual migration execution, or direct candidate scripts are
not production paths.

## Recovery

There is no automatic database rollback. A failed run retains its exact candidate and
recovery manifest. The normal code recovery target is only the previously successful
audited SHA; a partial-run recovery is limited to the exact failed manifest. Follow
[rollback-and-recovery.md](rollback-and-recovery.md).

## The completed transition (2026-08-23)

The transition described above has been executed. It is recorded here because the one-time
legacy-adoption input can never be used again, so this is the only account of how the
current baseline was established.

**Starting state.** A read-only reconciliation on 2026-08-23 found Historical Booking
healthy and migration ledger head `0064`, but no deployment audit and no
application/control revision labels on the running images. The checkout and
`current-sha.txt` agreed on one commit, but that does not prove which commit produced the
image bytes — `UNVERIFIED_LEGACY`.

**Two defects had to be fixed first**, both of which made the hardened path unusable:

| Defect | Effect | Fix |
|---|---|---|
| `script_stop: true` on the SSH action | drone-ssh injects an exit-code check after every line of the transported script, splitting every multi-line bash construct. The bootstrap died on its first `case ... in`. The hardened workflow had never once executed. | PR #79 — `script_stop: false`, with the transported script's own `set -Eeuo pipefail` carrying the failure semantics |
| The live checkout never advanced | Builds run from a candidate worktree, so `/opt/apps/kaza-booking` stayed on the previous release and reconciliation reported `live_checkout_mismatch` forever. **No number of correct deployments could have returned `GOVERNED`.** | PR #80 — an explicit advance after every gate and before `current-sha.txt`, covered by `scripts/tests/test-live-checkout-advance.sh` |

The second was fixed rather than relaxed: `live_checkout_mismatch` remains a required
invariant, and the test asserts both the fix and the invariant.

**The transition runs:**

| Step | Run | Result |
|---|---|---|
| Adoption deploy, `approve_unverified_legacy_replacement=true` | `32663279999` | success — unverified legacy runtime replaced by a newly built, labelled, digest-verified release at `e9fa590db8f43ca11b9c2fde6e5e014089e486e3` |
| Final deploy, **no** legacy input (normal provenance applied) | `32665722518` | success at `e628ad9c8b88567f20d1d68d67239b3601749dca` |
| Reconciliation, `mode=inspect` | `32665890315` | **`GOVERNED`**, `reconciliationFailures: []` |

**The governed baseline:**

```
governanceStatus      : GOVERNED
commitSha             : e628ad9c8b88567f20d1d68d67239b3601749dca   (from the audit record)
claimedCommitSha      : e628ad9c8b88567f20d1d68d67239b3601749dca   (current-sha.txt)
liveCheckoutSha       : e628ad9c8b88567f20d1d68d67239b3601749dca   (DETACHED, clean)
controlSha            : e628ad9c8b88567f20d1d68d67239b3601749dca
previousVersion       : e9fa590db8f43ca11b9c2fde6e5e014089e486e3   (rollback target)
databaseMigrationHead : 0064                                       (unchanged throughout)
api    imageDigest    : sha256:a3643e1768c10c467f1d9c3e27978dc8900ccf0cfe0ddb99f05381ae91126fa8
demo   imageDigest    : sha256:eb166dd3a26183c852966db4c0dfcb265874cfba1d40ad4dc000b37e179e49de
portal imageDigest    : sha256:dc7669bf47fbd5ba2bed3adedb3791bbf4867c7e3b37a7a7d908be8ef7e20e36
```

The database container was never recreated (identity asserted identical before and after
each run) and no migration executed — both deployments record `0064 -> 0064`. The audit
ledger holds four rows: a `PREPARED` and an `OK` for each of the two deployments.

**What this means going forward.** `approve_unverified_legacy_replacement` is now
permanently refused, because a successful trusted deployment exists. Every running
application image must match the last successful audit record, and the only ways past that
check are a normal matching runtime or a `recovery_run_id` manifest written by a failed
trusted run. A container built or recreated by hand therefore fails the next deployment
closed with no workflow input able to clear it — see
[`production-deployment.md` § the one-way door](production-deployment.md#the-one-way-door).
