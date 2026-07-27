# KAZA — Production Rollback

Rollback always targets a **specific commit SHA** — never a vague "previous version."
The live SHA is recorded at `/opt/kaza/releases/current-sha.txt`, and the prior one at
`/opt/kaza/releases/previous-sha.txt` (written by the deploy workflow before each release).

## Automatic rollback (built into the deploy)

`deploy-production.yml` runs post-deploy health checks (`GET /api/projects` + both frontends
over HTTPS). **On failure it automatically checks out `previous-sha.txt`, rebuilds, and
restarts**, then exits non-zero so the run is clearly marked failed. No data is restored.

## Manual rollback

```bash
cd /opt/kaza/app
set -a; source /opt/kaza/env/.env.production; set +a
COMPOSE="docker compose -f docker-compose.prod.yml --env-file /opt/kaza/env/.env.production"

TARGET="$(cat /opt/kaza/releases/previous-sha.txt)"   # or paste a known-good SHA explicitly
git fetch --all --prune
git checkout --force "$TARGET"
$COMPOSE build
$COMPOSE up -d

# Verify, then record the rolled-back SHA as current:
curl -fsS "https://${API_DOMAIN}/api/projects" >/dev/null && echo "API OK"
echo "$TARGET" > /opt/kaza/releases/current-sha.txt
```

## Database & uploads

- **Do NOT restore the database during a code rollback** unless a migration corrupted data
  AND restore is explicitly approved. Code rollbacks are independent of DB state.
- If a restore is required: `docs/backup-restore.md` (use the pre-migration backup; the live
  restore needs the real DB name + `CONFIRM=1`).
- Uploads live in the `uploads_data` volume and are unaffected by a code rollback.

## Pre-launch requirement (Blocker B4)

Rollback must be **tested once in a prod-like environment before the first live deploy**:
deploy commit A → deploy commit B → roll back to A → confirm API health + both frontends load,
DB not restored, uploads intact, and `current-sha.txt` reflects commit A.
