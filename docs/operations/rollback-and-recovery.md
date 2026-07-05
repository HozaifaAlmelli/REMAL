# Rollback & recovery — Kaza Booking production

Rollback always targets a **specific commit SHA** — never a vague "previous version."
The deploy script records the live SHA at `/opt/kaza/releases/current-sha.txt` and copies
the prior one to `/opt/kaza/releases/previous-sha.txt` before each release
(`scripts/deploy-production.sh`).

> ⚠️ **There is no automatic rollback in the current pipeline.** The deploy runs
> post-deploy health checks and fails loudly, but it does **not** roll back on its own.
> (An earlier runbook claimed it did — that doc is archived. Rollback is a deliberate,
> manual decision.)

This doc replaces the superseded `docs/rollback.md`. Deep playbooks:
[docker-compose-scoped-deploy](../ai-deployment-skills/docker-compose-scoped-deploy.md) ·
[github-actions-production-deploy-safety](../ai-deployment-skills/github-actions-production-deploy-safety.md) ·
[deployment-decision-matrix](../ai-deployment-skills/deployment-decision-matrix.md).

## Option 1 — Git revert through the pipeline (preferred, durable)

Revert the bad commit on a branch → PR → merge to `main` → the gated Deploy Production
workflow redeploys. Slowest, but auditable, reviewed, and `main` stays the source of
truth (nothing on the VPS diverges).

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

> The VPS is now on a detached/older commit — the **next merge to `main` will overwrite
> it**. Follow up immediately with Option 1 (revert in `main`) so git and production agree.

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
