# Kaza Production Rollback and Failure Recovery

Rollback always identifies a full reviewed commit and exact image identities. There is no
automatic rollback: an automatic multi-service or database reversal would make a partial
failure less observable and could destroy newer data.

## Evidence created before mutation

Before recreating the first application service, the trusted runner writes
`/opt/kaza/releases/recovery-<run-id>.json`. It contains:

- target and control SHA;
- candidate path;
- previous and target content-addressed image IDs;
- temporary rollback image tags;
- services changed so far;
- status (`PREPARED`, `IN_PROGRESS`, `FAILED`, or `DEPLOYED`).

The runner durably updates this manifest before each service mutation. The service list is
therefore conservative: a listed service was attempted and may have changed. Every attempt also requires a
strict terminal record in `deployments.jsonl`. `current-sha.txt` changes only after all
service, provenance, database-container, migration-ledger, proxy, health, and auth-smoke
checks pass.

## Failure classification

| Failure point | Durable state | Operator action |
|---|---|---|
| Before first service recreate | Existing application remains live | Fix the cause in Git or host configuration and rerun through the workflow. |
| After one or more service recreates | Mixed application state is possible; database state is explicit in the audit | Stop. Preserve candidate and recovery manifest. Inspect exact changed services and image IDs. Do not rerun blindly. |
| Migration fails before deployment | Old application remains live; ledger is at the runner's last verified transaction boundary | Investigate ledger and exact release backup. Do not deploy code and do not automatically restore. |
| Post-deploy verification fails | Changed-service list and previous image IDs are recorded | Decide explicitly whether to complete the deployment or roll back only recorded changed application services. |
| Data corruption suspected | Application rollback is not a database recovery | Stop for owner-authorized restore planning using the exact release backup in an isolated restore rehearsal first. |

## Supported code rollback

The normal rollback is the same protected workflow:

1. Read `previous-sha.txt` and confirm `deployments.jsonl` contains a successful trusted
   deployment for that exact SHA.
2. Dispatch **Deploy Production** from `main` with that full SHA and `mode=deploy`.
3. The current-main control plane validates the complete database ledger. Database-ahead
   is allowed only for this recorded previous release.
4. Verify running content image IDs, revision labels, health, audit, and state files.
5. Create and merge a reviewed revert so `main` reflects the desired durable application.

Historical arbitrary ancestors are refused. Release mode can never target an old SHA.

For a reviewed application-only recovery after a partial trusted run, dispatch the
current `main` workflow in `deploy` mode with `deploy_sha` set to the failed manifest's
`previous_sha` and `recovery_run_id` set to that failed run's exact ID. The control plane
reads `/opt/kaza/releases/recovery-<run-id>.json` and refuses unless it is a regular,
non-symlink JSON manifest with status `FAILED`, the exact run ID, and the exact requested
previous SHA. The historical application revision never supplies deployment scripts.
Before rebuilding, the runner also proves that every live application container still
matches either its recorded previous image ID or, for an attempted service, the failed
run's recorded target image ID. Any unrelated image blocks recovery. This authorization
does not restore a database or reverse a migration.

The one-time `approve_legacy_provenance_baseline` input is not a rollback mechanism. It
exists only to establish the first trusted image-ID record from the pre-hardening `prod`
containers under the deployment playbook's strict first-run checks. It is refused after
any successful trusted deployment.

## Recovery when GitHub Actions cannot reach the host

Do not run a candidate's `deploy-production.sh` and do not improvise `docker compose`
commands. A break-glass operator must first obtain the current `origin/main` control SHA,
use its reviewed `bootstrap-production-control.sh` / `production-dispatch.sh`, and allow
the same host lock, target authorization, ledger, audit, provenance, and smoke gates to
run. If that trusted control plane cannot be established, stop rather than downgrade.

## Database boundary

Additive migrations normally remain during application rollback. Never automatically run
rollback SQL or restore a backup over the live database. A restore requires a separate
owner decision, a disposable restore proof, and the database operations runbook. The
release audit's exact backup path is authoritative; do not choose the newest file by time.

## Stop conditions

Stop if the recovery manifest is missing/malformed, the previous SHA has neither a
successful trusted audit record nor an exact failed-run recovery authorization, image
identity cannot be resolved, the ledger is inconsistent, the
host production lock is held, a database restore is being considered, or any recovery
would touch Novatova, the database container, or Kaza edge services.
