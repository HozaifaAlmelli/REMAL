# Kaza Branching and Production Release Workflow

```
feature/* -> dev -> main -> explicit production workflow
hotfix/*  -> main (then merge back to dev)
```

- `main` is the reviewed deployable set. A merge does not deploy.
- `dev` is the permanent integration branch and never has production access.
- Feature branches start from `dev` and return through a pull request.
- Hotfix branches start from `main`, return through a pull request, then merge back to `dev`.

The VPS is production only. There is no staging deployment.

## Supported production entry point

Normal production operations use the manually dispatched **Deploy Production** workflow
from `refs/heads/main`. It accepts a full 40-character `deploy_sha` and one mode:

| Mode | Contract |
|---|---|
| `deploy` | Validate the complete migration ledger, build application images, recreate only `api`, `demo`, and `portal`, then verify. The database container is never recreated. |
| `release` | Validate ledger, create and validate one exact backup artifact, apply the pending migration suffix, verify ledger, then run the same application deploy. |

The workflow checks out the current `main` revision as the trusted deployment control
plane and sends only its bootstrap script over SSH. The application target is a separate
candidate worktree. A historical target cannot execute its own deployment scripts.
Schema-changing releases must target current `main`; a code rollback may target only the
recorded previous successful deployment.

The host-wide `flock` in `/opt/kaza/releases/production-operation.lock` is shared by
deploy, release, and direct migration execution. Contention fails fast.

## Trust chain

All of these controls are required:

1. `main` requires a reviewed pull request, the required status checks, current-branch
   checks, resolved review threads, and has no bypass actor.
2. The `production` Environment allows only `main`, requires independent review,
   prevents self-review and admin bypass, and contains only the approved SSH secrets.
3. The workflow runtime refuses any ref other than `refs/heads/main`.
4. The bootstrap requires its control SHA to equal the current `origin/main` SHA.
5. The candidate must be a `main` ancestor, with historical targeting restricted to the
   recorded previous successful release.
6. The migration guard validates the ordered registry, immutable checksums, and the
   database ledger as an exact prefix. A maximum migration number is never accepted as
   proof.

The first hardened production run has one explicit transition control for containers
created by the legacy deploy. `approve_unverified_legacy_replacement=true` authorizes
replacement of that unverified runtime; it never certifies the old image as having come
from `current-sha.txt`. It is accepted only before any successful trusted audit exists,
only for current `main`, only when the clean live checkout equals `current-sha.txt`, and
only for running Kaza application containers with content-addressed image IDs and the
expected Compose identity. Release mode checks this before migration. Once a trusted
deployment succeeds, running image IDs must match its audit record and the exception
cannot be used again.

Run `bash scripts/verify-production-environment-policy.sh` before a release window. The
checked-in policy is [`production-environment-policy.json`](../.github/production-environment-policy.json).

## Artifact and state evidence

SHA tags are convenience aliases, not the deployment authority. Each build records its
content-addressed Docker image ID and OCI revision/control labels. After recreate, the
running container's `.Image` must equal the captured image ID and both labels must match.
The moving `:prod` alias is updated only after all verification succeeds.

`/opt/kaza/releases/` contains:

- `current-sha.txt` and `previous-sha.txt`;
- append-only, fsynced `deployments.jsonl` records;
- one recovery manifest per run with changed services and exact image IDs/tags;
- exact backup-result handoff files during release execution.

No one file is authoritative in isolation. Run `bash scripts/production-state.sh` from
the current-`main` control plane; it returns zero only when audit, state files, checkout,
running digests/labels, and the validated migration head all agree.

If a deployment fails after changing a service, no automatic rollback runs. The candidate
and recovery manifest are retained, the audit result is `FAILED`, and an operator uses the
reviewed recovery procedure. This avoids an unreviewed automatic database or multi-service
rollback.

For a reviewed application-only recovery, `recovery_run_id` binds the request to a
regular failed-run manifest and authorizes only that manifest's exact `previous_sha`.
Recovery continues to use the current `main` control plane and never executes tooling
from the historical application revision.

## GitHub Environment secrets

Only these names are permitted: `SSH_HOST`, `SSH_USER`, `SSH_PORT`, `SSH_KEY`, and
`SSH_HOST_FINGERPRINT`. `SSH_PASSWORD` is forbidden and the workflow has no password
input. Application and database secrets stay on the VPS in the protected production env
file.

The deployment workflow intentionally remains unavailable until both `SSH_KEY` and
`SSH_HOST_FINGERPRINT` are provisioned and the checked-in environment-policy verifier
passes.
