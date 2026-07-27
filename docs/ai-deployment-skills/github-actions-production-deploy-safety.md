---
name: github-actions-production-deploy-safety
description: >
  Review, harden, merge, and monitor the Deploy Production GitHub Actions workflow so a
  merge to main deploys Kaza safely on the shared VPS — service-scoped, edge-excluded,
  proxy-network reattached, nginx tested before reload, and Novatova untouched.
risk_level: critical
when_to_use: >
  Before merging anything to main, when reviewing/changing deploy-production.yml or
  scripts/deploy-production.sh, and while watching a deploy run and its post-deploy
  health checks.
do_not_use_when: >
  You only need a one-off manual recreate (use docker-compose-scoped-deploy) and are not
  merging to main.
required_inputs:
  - The PR to be merged (and whether merge to main triggers a deploy)
  - Access to the Actions run + logs
forbidden_actions:
  - Introducing a bare docker compose up -d or docker compose down into the pipeline
  - Removing the edge-profile exclusion or the proxy-network reattach
  - Merging to main when a deploy is unwanted / unreviewed
  - Bypassing the production environment approval gate
preflight_checks:
  - Read deploy-production.yml triggers + the environment gate
  - Read scripts/deploy-production.sh for scope, edge guard, nginx test, health checks
  - Confirm the live VPS tree is clean (deploy FATALs otherwise)
safe_procedure: "See 'Review, merge, monitor' below."
verification: "Deploy run green; all health checks pass; only Kaza app services changed; novatova.com 200; no libgssapi."
rollback: "Re-run the previous good deploy SHA / revert the merge commit on main, then re-deploy."
stop_conditions: "See 'Global Stop Conditions' below."
final_report_required: true
lessons_from_kaza_incident: >
  The original pipeline used the WRONG path (/opt/kaza/app), ran a bare
  `docker compose up -d`, and the compose file's nginx/certbot bound 80/443 — a direct
  collision with novatova-nginx. The hardened workflow (current) uses
  /opt/apps/kaza-booking, builds only api/demo/portal, keeps edge behind the `edge`
  profile, ensures db without recreating unrelated services, reattaches proxy-network,
  runs `nginx -t` before reload, then health-checks and fails on any libgssapi error.
  A deploy also FATALs if the live tree has local changes — keep it clean.
---

# GitHub Actions production deploy safety

The pipeline is the durable, repeatable deploy path. Its safety is defined by
[`.github/workflows/deploy-production.yml`](../../.github/workflows/deploy-production.yml)
and [`scripts/deploy-production.sh`](../../scripts/deploy-production.sh). Keep those
properties intact.

## What the current (safe) pipeline guarantees

- **Trigger:** `push` to `main` or manual `workflow_dispatch`, gated by the `production`
  GitHub Environment (**manual approval** + branch restriction). Opening a PR or pushing
  a feature branch does **not** deploy; only a merge to `main` does, and only after a
  human approves the environment.
- **Correct path:** `APP_DIR=/opt/apps/kaza-booking` (not the stale `/opt/kaza/app`).
- **Clean-tree guard:** FATALs if `git status --porcelain` is non-empty on the VPS.
- **SHA pin:** checks out `main` and asserts `HEAD == github.sha`.
- **Service-scoped:** `compose build api demo portal`; `up -d --no-deps db`;
  `up -d --no-deps api demo portal`. No `down`, no bare `up -d`.
- **Edge excluded:** `nginx`/`certbot` stay behind `profiles: ["edge"]`; the script
  FATALs if `kaza-prod-nginx`/`kaza-prod-certbot` are ever found running.
- **Network + proxy:** reattaches `proxy-network` to each Kaza app container, then
  `nginx -t` on `novatova-nginx` and `nginx -s reload` (never restart).
- **Health gate:** curls all Kaza hosts + `novatova.com`, and **fails on any
  `libgssapi` error** in the API logs. Records `current-sha.txt` / `previous-sha.txt`.

## Review, merge, monitor

```bash
# 1. Confirm triggers + gate before merging (no surprise deploys).
sed -n '1,35p' .github/workflows/deploy-production.yml

# 2. Confirm the live VPS tree is clean, or the deploy will FATAL.
git -C /opt/apps/kaza-booking status --short   # must be empty

# 3. Merge the PR (a human approves the production environment gate at run time).
gh pr merge <num> --squash --repo <owner>/REMAL

# 4. Watch the run; it must pass the health gate.
gh run watch --repo <owner>/REMAL
gh run view --log --repo <owner>/REMAL <run-id> | tail -80
```

> **Docs-only PRs still queue a deploy.** The workflow has no `paths:` filter, so even a
> documentation merge to `main` queues a (manual-approval-gated) deploy. If you do not
> want a deploy, **leave the PR open** for a human to merge deliberately.

## If you must edit the pipeline — preserve these invariants

Never introduce `docker compose down` or a bare `docker compose up -d`. Keep the
service scope, the `edge`-profile exclusion, the proxy-network reattach, the
`nginx -t`-before-reload, and the health/`libgssapi` gates. Validate compose changes
with `docker compose ... config` (the PR Checks `compose-validate` job does this too).

## Global Stop Conditions — halt and report, do not proceed

Stop immediately if any of these is true:
- A command would affect Novatova (any `novatova-*` container, config, or data).
- A command would start a service that binds host ports 80 or 443.
- A step requires `docker compose down`.
- A step is a bare `docker compose up -d` (no `--no-deps <service>`, no service list).
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

State the deploy run ID + result; the deployed SHA; that only Kaza app services changed;
the health-check results incl. `novatova.com`; that no `libgssapi` error appeared; and who
approved the environment gate.
