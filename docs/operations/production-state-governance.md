# Production State Governance

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

## Historical observation

A read-only reconciliation on 2026-08-23 found Historical Booking healthy and migration
ledger head `0064`, but no deployment audit and no application/control revision labels on
the running images. The checkout and `current-sha.txt` agreed on one commit, but that does
not prove which commit produced the image bytes. This is an `UNVERIFIED_LEGACY` state and
must not be rewritten as a governed release without the transition above.
