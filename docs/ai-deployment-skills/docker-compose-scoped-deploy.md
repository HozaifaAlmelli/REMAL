---
name: docker-compose-scoped-deploy
description: >
  Diagnose a Kaza service and route any required recreate through the trusted
  current-main production workflow. Direct Compose recreation is no longer approved.
risk_level: high
when_to_use: >
  A Kaza application service appears to require recreation or application rollback.
do_not_use_when: You intend to run Docker Compose directly to mutate production.
required_inputs:
  - Exact reviewed application SHA
  - Deploy or release mode decision
forbidden_actions:
  - docker compose down / bare docker compose up -d
  - Any direct service or database recreation
  - Starting the edge (nginx/certbot) profile
  - Bypassing the current-main control plane, host lock, provenance, audit, or recovery evidence
preflight_checks:
  - Inspect service state and identify the exact reviewed SHA
  - Verify production Environment policy and current-main control SHA
safe_procedure: "Use the Deploy Production workflow described below."
verification: "Target container healthy; proxy-network attached; nginx -t OK + reloaded; endpoints 200; novatova.com 200."
rollback: "Use the recorded previous SHA or exact failed-run recovery manifest through the same workflow."
stop_conditions: "See 'Global Stop Conditions' below."
final_report_required: true
lessons_from_kaza_incident: >
  A bare `docker compose up -d` recreates every service, can start the edge profile
  (colliding with novatova-nginx on 80/443), and drops proxy-network from the Kaza
  containers. Also, BuildKit attestation makes every build produce a new image digest
  even when all layers are cached, so `up -d` WILL recreate the service — expect the
  recreate and the network reattach + nginx reload that follow it.
---

# Application service deployment and recovery

Direct Compose recreation is no longer an approved deployment path. Although a scoped
`up -d --no-deps <service>` protects the database better than a stack-wide command, it
still bypasses the global host lock, trusted current-main engine, schema guard,
content-addressed image proof, audit record, and recovery manifest.

## Supported procedure

```bash
gh workflow run deploy-production.yml --ref main \
  -f deploy_sha=<full-reviewed-main-sha> -f mode=deploy
```

The trusted runner builds and recreates `api`, `demo`, and `portal` one at a time using
`--no-deps --no-build`, never recreates `db`, verifies and reattaches the proxy network,
tests and reloads the shared proxy, and records exact image and recovery evidence.

For rollback or partial-run recovery, follow
[`rollback-and-recovery.md`](../operations/rollback-and-recovery.md). Do not retag images
or invoke Compose by hand.

## Guardrails enforced by the trusted runner

- host-wide non-blocking `flock` prevents overlapping production operations;
- current `main` supplies the deployment engine, never the application candidate;
- each application service is recreated explicitly with `--no-deps --no-build`;
- The `db` service is **not** in scope. Recreating `db` risks data and is out of
  bounds unless explicitly intended, backed up first, and approved.
- The edge (`nginx`/`certbot`) services are `profiles: ["edge"]`; a scoped
  `build/up <service>` never selects them. If you ever see `kaza-prod-nginx` or
  `kaza-prod-certbot` running, **stop** — that is the 80/443 collision the deploy
  script explicitly fails on.

## Global Stop Conditions — halt and report, do not proceed

Stop immediately if any of these is true:
- A command would affect Novatova (any `novatova-*` container, config, or data).
- A command would start a service that binds host ports 80 or 443.
- A step requires `docker compose down`.
- A step would run `docker compose` (build / up / down) against `kaza-prod`, or
  recreate, build, or tag a Kaza application container outside the trusted workflow.
- `docker exec novatova-nginx nginx -t` fails.
- The env file `/opt/kaza/env/.env.production` is missing or empty.
- The live repo path is uncertain (compose labels don't confirm it).
- Compose labels do not match the expected project `kaza-prod` / expected service.
- A DB backup fails (or cannot be verified) before any DB write.
- The live working tree has unexpected local changes before a git operation.
- A secret (password/token/JWT/connection string) would be printed or written unredacted.
- An already-applied migration would need editing, or a migration number would be reused.
- A production user's password would be reset.
- A temporary SSH key cannot be removed at the end of the task.

## Forbidden Commands — never run these on the shared VPS

Named here only to mark them forbidden. Do not execute them.
- `docker compose down`
- `docker compose up -d` (bare — no service scope)
- `docker system prune` / `docker builder prune -a`
- `docker volume rm ...`
- `rm -rf /etc/letsencrypt`
- `certbot delete ...`
- `docker restart novatova-nginx` and `docker restart novatova-*`
- `DROP TABLE ...` / `TRUNCATE TABLE ...` / `DELETE FROM ...` without WHERE + backup + approval
- `git reset --hard` on the live repo (unless explicitly approved AND already backed up)
- `git push --force` to `main`

## Final report (required)

State the exact target and control SHAs, workflow run, running content image IDs,
migration-ledger result, recovery manifest, health checks, and that the database container,
Kaza edge services, and Novatova were not recreated. A host-only edit is never release
evidence; all durable changes must be reviewed in Git.
