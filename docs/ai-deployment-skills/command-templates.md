# Command Templates (shared, safe-by-default)

Copy-paste-safe snippets reused across the skills. Every template here is
**scoped** and **non-destructive**. Run them on the VPS (`root@<VPS>`), never bring
secrets to a local machine, and always pass output through `redact` before logging.

The single source of truth for a production mutation is the current-`main` control plane
entered through [`.github/workflows/deploy-production.yml`](../../.github/workflows/deploy-production.yml).
The snippets below are read-only diagnostics unless a section explicitly says otherwise.
They are not a substitute for the host lock, provenance, audit, or recovery evidence.

---

## 0. Environment (define once per session)

```bash
APP_DIR="/opt/apps/kaza-booking"        # CORRECT path. NOT /opt/kaza/app.
ENV_FILE="/opt/kaza/env/.env.production"
PROJECT="kaza-prod"
PROXY_NETWORK="proxy-network"

# Fail fast if the env file is missing/empty — a bare compose run would then
# silently use wrong defaults.
test -s "$ENV_FILE" || { echo "FATAL: env-file missing/empty — abort"; exit 1; }
```

## 1. Redaction (wrap EVERY command whose output may contain secrets)

```bash
redact() {
  sed -E 's/(PASSWORD|SECRET|TOKEN|KEY|CONNECTION|CONNECTIONSTRING|JWT|API_KEY|DATABASE_URL)[^=]*=.*/\1=***REDACTED***/Ig'
}

# Example:
docker exec kaza-prod-api sh -lc 'printenv | sort' | redact
```

## 2. Compose array (scopes every compose call to the Kaza project)

```bash
COMPOSE=(
  docker compose
  -p "$PROJECT"
  -f "$APP_DIR/docker-compose.prod.yml"
  --env-file "$ENV_FILE"
  --project-directory "$APP_DIR"
)
```

## 3. Application deployment (workflow only)

```bash
# Run from a trusted operator workstation after review and Environment approval.
gh workflow run deploy-production.yml --ref main \
  -f deploy_sha=<full-reviewed-main-sha> -f mode=deploy
```

Do not recreate a service directly with Compose. Even a service-scoped command would
bypass the production-operation lock, current-main tooling, migration guard, image-ID
proof, audit record, and recovery manifest. A bare `docker compose up -d` is additionally
capable of recreating the whole project and remains forbidden.

## 4. Network inspection

```bash
# Read-only. The trusted deploy performs any required reattachment and audits the run.
docker inspect -f '{{json .NetworkSettings.Networks}}' kaza-prod-portal
```

## 5. nginx test + reload (test ALWAYS precedes reload; reload, never restart)

```bash
docker exec novatova-nginx nginx -t          # MUST pass first
docker exec novatova-nginx nginx -s reload    # refreshes cached static upstream IPs
```

## 6. DB backup (run BEFORE any DB write; prefer the repo script)

```bash
# Preferred: the repo's verified, retention-managed backup.
bash "$APP_DIR/scripts/backup-postgres.sh"

# Manual equivalent (compressed custom-format dump into a root-only file):
BACKUP_DIR="/opt/kaza/backups/postgres"; mkdir -p "$BACKUP_DIR"
PARTIAL="$(mktemp "$BACKUP_DIR/kaza-prod-$(date -u +%F_%H-%M-%S)_XXXXXXXX.dump.partial")"
BACKUP_FILE="${PARTIAL%.partial}"
if ! docker exec -e PGUSER -e PGDATABASE kaza-prod-db sh -lc '
  set -e
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc
' > "$PARTIAL"; then rm -f -- "$PARTIAL"; exit 1; fi
test -s "$PARTIAL" || { rm -f -- "$PARTIAL"; echo "FATAL: backup empty — do NOT proceed"; exit 1; }
docker exec -i kaza-prod-db pg_restore --list < "$PARTIAL" >/dev/null || {
  rm -f -- "$PARTIAL"; echo "FATAL: backup metadata invalid — do NOT proceed"; exit 1; }
ln -- "$PARTIAL" "$BACKUP_FILE" || { rm -f -- "$PARTIAL"; exit 1; }
rm -f -- "$PARTIAL"
chmod 600 "$BACKUP_FILE"
```

## 7. Health checks (post-deploy; includes the Novatova safety signal)

```bash
curl -sS -I https://kaza-booking.com        --max-time 15
curl -sS -I https://www.kaza-booking.com    --max-time 15
curl -sS -I https://app.kaza-booking.com    --max-time 15
curl -sS -i https://api.kaza-booking.com/health --max-time 15 | head -40
curl -sS -i https://api.kaza-booking.com/       --max-time 15 | head -40
curl -sS -I https://novatova.com            --max-time 15   # must stay 200/301/302
```

## 8. Temporary SSH key removal (end of task; then verify denial)

```bash
# Remove the tagged key (use YOUR key's comment tag, e.g. claude-kaza-debug).
sed -i '/claude-kaza-debug/d' ~/.ssh/authorized_keys

# From your machine, prove the key no longer works (expect: Permission denied):
# ssh -i ./that_key -o BatchMode=yes root@<VPS> true   # should FAIL
```

## 9. Internal container probe (aspnet image has no curl/wget)

```bash
# Use a throwaway curl container on the Kaza network to hit a service internally.
# Confirm the network name from `docker inspect` first (often kaza-prod_public).
NET="kaza-prod_public"
docker run --rm --network "$NET" curlimages/curl -sS -i --max-time 15 \
  "http://kaza-prod-api:8080/health" | head -30
```

## 10. Application recovery

```bash
# Normal previous-release rollback:
gh workflow run deploy-production.yml --ref main \
  -f deploy_sha=<recorded-previous-sha> -f mode=deploy

# Partial failed-run recovery additionally supplies the exact failed run id:
gh workflow run deploy-production.yml --ref main \
  -f deploy_sha=<manifest-previous-sha> -f mode=deploy \
  -f recovery_run_id=<failed-run-id>
```

The current-main runner validates the successful audit or failed recovery manifest and
then applies the same lock, ledger, provenance, health, and audit gates. Do not retag or
recreate containers manually.

---

### Notes on false positives when grepping for "dangerous" strings

- Direct Compose recreation examples are intentionally absent. Production mutation is
  routed through the trusted workflow and host control plane.
- The DB templates never issue `DROP`/`TRUNCATE`/`DELETE`. Those appear only in
  Forbidden Commands and in the migration skill's explanation of what the gated
  runner refuses.
