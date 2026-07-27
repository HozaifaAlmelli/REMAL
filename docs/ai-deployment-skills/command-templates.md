# Command Templates (shared, safe-by-default)

Copy-paste-safe snippets reused across the skills. Every template here is
**scoped** and **non-destructive**. Run them on the VPS (`root@<VPS>`), never bring
secrets to a local machine, and always pass output through `redact` before logging.

The single source of truth for the real deploy flow is
[`scripts/deploy-production.sh`](../../scripts/deploy-production.sh); these templates
mirror it so you can run individual steps by hand safely.

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

## 3. Service-scoped deploy (the ONLY approved recreate)

```bash
# Rebuild + recreate a single service. --no-deps so dependencies are NOT recreated.
# Replace `portal` with `api` or `demo` as needed. NEVER omit the service name.
"${COMPOSE[@]}" build portal
"${COMPOSE[@]}" up -d --no-deps portal
```

> A bare `docker compose up -d` (no service, no `--no-deps`) recreates the whole
> project, may start the `edge` profile if invoked wrong, and drops
> `proxy-network`. It is forbidden — see every skill's Forbidden Commands.

## 4. Network reattach (recreate can drop `proxy-network`)

```bash
# Reattach only if missing. Repeat for kaza-prod-api / kaza-prod-demo / kaza-prod-portal.
if ! docker inspect -f '{{json .NetworkSettings.Networks}}' kaza-prod-portal | grep -q '"proxy-network"'; then
  docker network connect proxy-network kaza-prod-portal
fi
```

## 5. nginx test + reload (test ALWAYS precedes reload; reload, never restart)

```bash
docker exec novatova-nginx nginx -t          # MUST pass first
docker exec novatova-nginx nginx -s reload    # refreshes cached static upstream IPs
```

## 6. DB backup (run BEFORE any DB write; prefer the repo script)

```bash
# Preferred: the repo's verified, retention-managed backup.
sh "$APP_DIR/scripts/backup-postgres.sh"

# Manual equivalent (compressed custom-format dump into a root-only file):
BACKUP_DIR="/opt/kaza/backups/postgres"; mkdir -p "$BACKUP_DIR"
TS="$(date +%F_%H-%M-%S)"
BACKUP_FILE="$BACKUP_DIR/kaza-prod-$TS.dump"
docker exec -e PGUSER -e PGDATABASE kaza-prod-db sh -lc '
  set -e
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc
' > "$BACKUP_FILE"
# Verify non-empty before trusting it, then lock it down.
test -s "$BACKUP_FILE" || { echo "FATAL: backup empty — do NOT proceed"; exit 1; }
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

## 10. Rollback to previous image (recreate is expected to blip a few seconds)

```bash
# BEFORE building, tag the current image so you can revert:
ROLLBACK_TAG="kaza-api:rollback-$(date +%Y%m%d-%H%M%S)"
docker image tag "$(docker inspect -f '{{.Image}}' kaza-prod-api)" "$ROLLBACK_TAG"

# To revert:
docker image tag "$ROLLBACK_TAG" kaza-api:prod
"${COMPOSE[@]}" up -d --no-deps api
docker exec novatova-nginx nginx -t && docker exec novatova-nginx nginx -s reload
```

---

### Notes on false positives when grepping for "dangerous" strings

- The scoped deploy uses `"${COMPOSE[@]}" up -d --no-deps <service>` — it does **not**
  contain the literal string `docker compose up -d`. Only the **Forbidden Commands**
  sections name the bare form, on purpose.
- The DB templates never issue `DROP`/`TRUNCATE`/`DELETE`. Those appear only in
  Forbidden Commands and in the migration skill's explanation of what the gated
  runner refuses.
