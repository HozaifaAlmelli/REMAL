# Rollback & recovery — Kaza Booking production

Rollback always targets a **specific commit SHA** — never a vague "previous version."
The deploy script records the live SHA at `/opt/kaza/releases/current-sha.txt`, copies
the prior one to `/opt/kaza/releases/previous-sha.txt` before each release, and appends
an immutable record to `/opt/kaza/releases/deployments.jsonl`
(`scripts/deploy-production.sh`).

> ⚠️ **There is no automatic rollback in the current pipeline.** The deploy runs
> post-deploy health checks and fails loudly, but it does **not** roll back on its own.
> (An earlier runbook claimed it did — that doc is archived. Rollback is a deliberate,
> manual decision.)

## Policy — what "rollback" means here

| Failure | Roll back | Do NOT roll back |
|---|---|---|
| Deploy succeeded, smoke/health failed | **application containers only**, to `previous-sha.txt` | the database |
| Migration failed mid-release | nothing was deployed — the old code is still live | — restore from the release backup only if the ledger is not at a clean boundary |
| Data corruption found after release | — | never automatically; a restore is a deliberate, owner-authorised decision |

**Production migrations are forward-only.** A mistake in `0064` is fixed by `0065`, not
by rolling `0064` back. Every migration still ships a `*_rollback.sql`, and those exist
to (a) prove reversibility in the rehearsal harness, (b) serve as the break-glass path
during the rollout window, before any new data exists. They are **not** the production
recovery path — restore-from-backup is.

**Application rollback is safe without a database rollback** because migrations
`0058`–`0064` are additive: they add tables and nullable columns, so older code runs
unchanged against the newer schema. `release-state.sh schema-guard` allows exactly this
direction (database ahead of code) and warns; it refuses the opposite.

Automatic database rollback is never acceptable once users have written data — the
down-migration would destroy those writes. `0060_rollback` already refuses itself once
`agreed_amount` values stop being reconstructable; treat that as the model.

This doc replaces the superseded `docs/rollback.md`. Deep playbooks:
[docker-compose-scoped-deploy](../ai-deployment-skills/docker-compose-scoped-deploy.md) ·
[github-actions-production-deploy-safety](../ai-deployment-skills/github-actions-production-deploy-safety.md) ·
[deployment-decision-matrix](../ai-deployment-skills/deployment-decision-matrix.md).

## Option 0 — Redeploy the previous SHA (fastest full rollback)

The previous release is already reviewed, already on `main`, and already proven to have
deployed. Dispatch **Deploy Production** with:

- `deploy_sha` = the contents of `/opt/kaza/releases/previous-sha.txt`
- `mode` = `deploy`

The schema guard will warn that the database is ahead of the code — that is the expected
signature of a rollback, and it is allowed. Use this when the current release is bad and
the previous one was good. Then still do Option 1, so `main` reflects reality.

## Option 1 — Git revert through the pipeline (preferred, durable)

Revert the bad commit on a branch → PR → merge to `main` → **dispatch** Deploy Production
against the revert SHA. Slowest, but auditable, reviewed, and `main` stays the source of
truth. Note the merge alone deploys nothing; the dispatch is the release.

Use when: production is degraded but not down, and the bad change is identifiable.

## Option 2 — Image-tag rollback (fastest, one service)

If a rollback image tag was captured before the bad build
([command-templates §10](../ai-deployment-skills/command-templates.md)):

```bash
APP_DIR="/opt/apps/kaza-booking"
ENV_FILE="/opt/kaza/env/.env.production"
COMPOSE=(docker compose -p kaza-prod -f "$APP_DIR/docker-compose.prod.yml" \
  --env-file "$ENV_FILE" --project-directory "$APP_DIR")

docker image tag "$ROLLBACK_TAG" kaza-api:prod     # example: the api image
"${COMPOSE[@]}" up -d --no-deps api
docker exec novatova-nginx nginx -t && docker exec novatova-nginx nginx -s reload
```

Use when: one service just broke and its previous image is still tagged. Then still do
Option 1 so `main` matches what is running.

## Option 3 — Manual SHA rollback on the VPS (last resort)

```bash
cd /opt/apps/kaza-booking     # the live repo path — NOT the stale /opt/kaza/app
git status --short            # STOP if the working tree has unexpected local changes

TARGET="$(cat /opt/kaza/releases/previous-sha.txt)"   # or paste a known-good SHA
git fetch --all --prune
git checkout --force "$TARGET"

# Service-scoped rebuild ONLY (never a bare up -d, never `down`):
"${COMPOSE[@]}" build api demo portal
"${COMPOSE[@]}" up -d --no-deps api demo portal

# Recreates can drop proxy-network — reattach, then reload (never restart) the shared edge:
for c in kaza-prod-api kaza-prod-demo kaza-prod-portal; do
  docker inspect -f '{{json .NetworkSettings.Networks}}' "$c" | grep -q '"proxy-network"' \
    || docker network connect proxy-network "$c"
done
docker exec novatova-nginx nginx -t && docker exec novatova-nginx nginx -s reload

# Verify (workbook §8), then record the rolled-back SHA as current:
echo "$TARGET" > /opt/kaza/releases/current-sha.txt
```

> The VPS is now on a detached/older commit. Since there is no `push` deploy trigger,
> nothing will silently overwrite it — but `current-sha.txt`, the container revision
> labels and `main` now disagree with each other. Follow up with Option 1 (revert in
> `main`, then dispatch) so git, the labels and production agree again.

> Prefer **Option 0** over this. Option 3 exists for when GitHub Actions itself cannot
> reach the host — which has happened (a `dial tcp … i/o timeout` from the runner while
> the host was reachable from elsewhere).

## Database & uploads during a code rollback

- **Do NOT restore the database during a code rollback** unless a migration corrupted
  data AND a restore is explicitly approved. Code rollbacks are independent of DB state.
- If a restore is required: [database-operations.md](database-operations.md) — restore
  goes to a scratch DB by default; overwriting the live DB requires the real DB name +
  `CONFIRM=1`.
- Uploads live on the VPS-local uploads path and are unaffected by a code rollback.

## When to stop

Stop and hand to a human if: the live working tree is dirty, `nginx -t` fails,
`previous-sha.txt` is missing/empty, the rollback would touch Novatova, or a DB restore
over the live database is being considered.
