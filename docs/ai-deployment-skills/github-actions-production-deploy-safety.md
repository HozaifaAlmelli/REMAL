---
name: github-actions-production-deploy-safety
description: >
  Review, harden, merge, and monitor the Deploy Production GitHub Actions workflow so a
  merge to main deploys Kaza safely on the shared VPS — service-scoped, edge-excluded,
  proxy-network reattached, nginx tested before reload, and Novatova untouched.
risk_level: critical
when_to_use: >
  Before dispatching a production deploy or release, when reviewing/changing
  deploy-production.yml, scripts/deploy-production.sh, scripts/release-production.sh or
  scripts/release-state.sh, and while watching a run and its post-deploy health checks.
do_not_use_when: >
  You only need a one-off manual recreate (use docker-compose-scoped-deploy) and are not
  merging to main.
required_inputs:
  - The PR to be merged (and whether merge to main triggers a deploy)
  - Access to the Actions run + logs
forbidden_actions:
  - Introducing a bare docker compose up -d or docker compose down into the pipeline
  - Removing the edge-profile exclusion or the proxy-network reattach
  - Removing the schema-compatibility guard, or moving it after the first build
  - Re-adding a push trigger, or an SSH password fallback
  - Deploying a schema-changing release through mode deploy instead of mode release
  - Bypassing the production environment approval gate
preflight_checks:
  - Read deploy-production.yml triggers + the environment gate
  - Read scripts/deploy-production.sh for scope, edge guard, nginx test, health checks
  - Confirm the live VPS tree is clean (deploy FATALs otherwise)
  - Compare the live ledger head against the tree level for the SHA being deployed
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

  Second incident, 2026-08-17: merging PR #73 (dev -> main) auto-queued a production
  deploy of code requiring migration 0064 against a database at 0057. The deploy path
  runs no migrations, so it would have served code reading `is_historical`,
  `agreed_amount` and the rentable-capacity tables — none of which existed. Only an SSH
  `dial tcp … i/o timeout` prevented it. Two things were wrong: a merge was treated as a
  release decision, and nothing compared the code's schema requirement against the live
  schema. Hence: no push trigger, an explicit deploy_sha, and a schema guard that
  refuses before the first build.
---

# GitHub Actions production deploy safety

The pipeline is the durable, repeatable deploy path. Its safety is defined by
[`.github/workflows/deploy-production.yml`](../../.github/workflows/deploy-production.yml)
and [`scripts/deploy-production.sh`](../../scripts/deploy-production.sh). Keep those
properties intact.

## What the current (safe) pipeline guarantees

- **Trigger:** `workflow_dispatch` ONLY, gated by the `production` GitHub Environment
  (**manual approval** + branch restriction). There is **no `push` trigger**: merging to
  `main` deploys nothing. A docs merge, a revert and a schema-changing feature all
  produce a push, and only a human knows which should reach production.
- **Explicit SHA:** `deploy_sha` is a required full 40-character commit id, validated as
  lowercase hex before the SSH step runs.
- **Reachability guard:** the deploy refuses any SHA not reachable from `origin/main`,
  so a dispatch cannot smuggle unreviewed code past branch protection.
- **Schema-compatibility guard:** `release-state.sh schema-guard` compares the live
  `schema_migrations` head against the migration level the tree requires, and **refuses
  before the first build** if the database is behind. Database-ahead-of-code is allowed
  with a warning — that is the rollback direction.
- **Two modes:** `deploy` (code only) and `release`
  (`scripts/release-production.sh`: baseline → candidate worktree → backup → migrate →
  verify → deploy → verify). Migrations never run in `deploy` mode.
- **Key-only SSH:** no `password:` input. An empty `SSH_KEY` fails the run instead of
  silently downgrading to password auth.
- **Correct path:** `APP_DIR=/opt/apps/kaza-booking` (not the stale `/opt/kaza/app`).
- **Clean-tree guard:** FATALs if `git status --porcelain` is non-empty on the VPS.
- **SHA pin:** detached checkout of the exact SHA, then asserts `HEAD == deploy_sha`.
- **Provable provenance:** images are tagged `kaza-<svc>:<sha>` and carry
  `org.opencontainers.image.revision`; the deploy re-reads that label off each **running
  container** and FATALs on a mismatch. `:prod` is kept as a moving alias.
- **Immutable audit:** every attempt appends one JSON line to
  `/opt/kaza/releases/deployments.jsonl` — sha, branch, actor, run id, timestamps,
  previous sha, migration head before/after, backup reference, result. Failures are
  recorded too.
- **Service-scoped:** `compose build api demo portal`; `up -d --no-deps db`;
  `up -d --no-deps api demo portal`. No `down`, no bare `up -d`.
- **Edge excluded:** `nginx`/`certbot` stay behind `profiles: ["edge"]`; the script
  FATALs if `kaza-prod-nginx`/`kaza-prod-certbot` are ever found running.
- **Network + proxy:** reattaches `proxy-network` to each Kaza app container, then
  `nginx -t` on `novatova-nginx` and `nginx -s reload` (never restart).
- **Health gate:** curls all Kaza hosts + `novatova.com`, and **fails on any
  `libgssapi` error** in the API logs. Records `current-sha.txt` / `previous-sha.txt`.

## Choosing the mode

| The SHA you are deploying… | Mode |
|---|---|
| adds no files under `db/migrations/` beyond what is already applied | `deploy` |
| adds any new migration | `release` |

To decide without guessing, compare the two numbers directly:

```bash
# On the VPS. Both are read-only.
bash scripts/release-state.sh ledger-head                       # live database head
MIG_DIR=<candidate>/db/migrations bash scripts/release-state.sh tree-level
```

Equal → `deploy`. Tree ahead → `release`. If you pick `deploy` when the tree is ahead,
the guard refuses the run before anything is built; that is a safe failure, not a
disaster, but it wastes an approval.

## Dispatch, monitor

```bash
# 1. Confirm the SHA is on main and pick the mode (see above).
git log -1 --format='%H %s' origin/main

# 2. Confirm the live VPS tree is clean, or the deploy will FATAL.
git -C /opt/apps/kaza-booking status --short   # must be empty

# 3. Dispatch explicitly. A merge to main does NOT deploy.
gh workflow run deploy-production.yml --repo <owner>/REMAL \
  -f deploy_sha=<full-40-char-sha> -f mode=deploy

# 4. A human approves the production environment gate, then watch it.
gh run watch --repo <owner>/REMAL
gh run view --log --repo <owner>/REMAL <run-id> | tail -80

# 5. Confirm what actually landed — three independent sources must agree.
cat /opt/kaza/releases/current-sha.txt
docker inspect -f '{{index .Config.Labels "org.opencontainers.image.revision"}}' kaza-prod-api
tail -1 /opt/kaza/releases/deployments.jsonl
```

> **Docs-only merges no longer queue a deploy.** The `push` trigger was removed, so
> merging to `main` is safe at any time. The trade-off is that a real release is never
> automatic — someone must dispatch it.

## If you must edit the pipeline — preserve these invariants

Never introduce `docker compose down` or a bare `docker compose up -d`. Keep the
service scope, the `edge`-profile exclusion, the proxy-network reattach, the
`nginx -t`-before-reload, and the health/`libgssapi` gates. Keep the schema guard
**before the first build**, keep the reachability check, and do not re-add a `push`
trigger or an SSH password fallback.

`scripts/tests/test-deployment-safety-guards.sh` asserts every one of those statically
and runs in the PR Checks `compose-validate` job — if you remove a guard, that test
fails by name. Validate compose changes with `docker compose ... config` (the same job
does this too).

## Global Stop Conditions — halt and report, do not proceed

Stop immediately if any of these is true:
- The schema guard refuses: the live database is behind the tree. Use `mode: release`.
- The SHA is not reachable from `origin/main`.
- `mode: deploy` was chosen for a SHA that adds migrations.
- `SSH_KEY` is unset — do not work around it by restoring password authentication.
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

State the deploy run ID + result; the mode used; the deployed SHA **as read back from
`current-sha.txt` and from the container revision label** (not as intended); the
migration head before and after; that only Kaza app services changed; the health-check
results incl. `novatova.com`; that no `libgssapi` error appeared; who approved the
environment gate; and the `deployments.jsonl` line that was appended.

If you could not reach the VPS, report that instead of inferring any of it.
