#!/usr/bin/env bash
# Trusted application deployment engine for the shared Kaza/Novatova VPS.
set -Eeuo pipefail

DEPLOY_SHA="${1:-}"
CONTROL_DIR="${CONTROL_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
SOURCE_DIR="${SOURCE_DIR:-$CONTROL_DIR}"
LIVE_DIR="${LIVE_DIR:-/opt/apps/kaza-booking}"
ENV_FILE="${ENV_FILE:-/opt/kaza/env/.env.production}"
RELEASES_DIR="${RELEASES_DIR:-/opt/kaza/releases}"
PROJECT="${PROJECT:-kaza-prod}"
PROXY_NETWORK="${PROXY_NETWORK:-proxy-network}"
CONTROL_SHA="${CONTROL_SHA:-$(git -C "$CONTROL_DIR" rev-parse HEAD)}"
DEPLOY_RUN_ID="${DEPLOY_RUN_ID:-manual-$(date -u +%Y%m%dT%H%M%SZ)-$$}"
DEPLOY_ACTOR="${DEPLOY_ACTOR:-manual}"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-main}"
DEPLOY_MODE="${DEPLOY_MODE:-deploy}"
DEPLOY_BACKUP_REF="${DEPLOY_BACKUP_REF:-}"
DEPLOY_MIGRATION_BEFORE="${DEPLOY_MIGRATION_BEFORE:-}"
DEPLOY_MIGRATION_AFTER="${DEPLOY_MIGRATION_AFTER:-}"
AUTH_SMOKE_CREDENTIALS_FILE="${AUTH_SMOKE_CREDENTIALS_FILE:-/opt/kaza/secrets/auth-smoke.json}"
APPROVE_UNVERIFIED_LEGACY_REPLACEMENT="${APPROVE_UNVERIFIED_LEGACY_REPLACEMENT:-0}"
COMPOSE_FILE="${COMPOSE_FILE:-$SOURCE_DIR/docker-compose.prod.yml}"
PROVENANCE_FILE="$CONTROL_DIR/infra/deploy/compose.provenance.yml"
DEPLOYMENT_LEDGER="$RELEASES_DIR/deployments.jsonl"
RECOVERY_MANIFEST="$RELEASES_DIR/recovery-${DEPLOY_RUN_ID}.json"
STARTED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

# shellcheck source=scripts/lib/production-lock.sh
source "$CONTROL_DIR/scripts/lib/production-lock.sh"
production_lock_acquire
# shellcheck source=scripts/lib/deployment-authorization.sh
source "$CONTROL_DIR/scripts/lib/deployment-authorization.sh"
# shellcheck source=scripts/lib/image-provenance.sh
source "$CONTROL_DIR/scripts/lib/image-provenance.sh"

mkdir -p "$RELEASES_DIR"
PREVIOUS_SHA="$(cat "$RELEASES_DIR/current-sha.txt" 2>/dev/null || true)"
MIGRATION_BEFORE="$DEPLOY_MIGRATION_BEFORE"
MIGRATION_AFTER="$DEPLOY_MIGRATION_AFTER"
LEDGER_AT_DEPLOY_START=""
CHANGED_SERVICES=()
IMAGE_IDS_JSON='{}'
ROLLBACK_IMAGES_JSON='{}'
PREVIOUS_IMAGE_IDS_JSON='{}'
TERMINAL_RECORDED=0
RECOVERY_WRITTEN=0

compose() {
  KAZA_IMAGE_TAG="$DEPLOY_SHA" KAZA_CONTROL_SHA="$CONTROL_SHA" docker compose \
    -p "$PROJECT" -f "$COMPOSE_FILE" -f "$PROVENANCE_FILE" \
    --env-file "$ENV_FILE" --project-directory "$SOURCE_DIR" "$@"
}

services_json() { python3 -c 'import json,sys; print(json.dumps(sys.argv[1:],separators=(",",":")))' "$@"; }
map_json() { python3 -c 'import json,sys; print(json.dumps(dict(x.split("=",1) for x in sys.argv[1:]),separators=(",",":"),sort_keys=True))' "$@"; }

write_state_file() {
  local path="$1" value="$2" tmp
  tmp="$(mktemp "$RELEASES_DIR/state.XXXXXX")"
  printf '%s\n' "$value" > "$tmp"
  chmod 600 "$tmp"
  python3 - "$tmp" <<'PY'
import os, sys
with open(sys.argv[1], "rb") as handle: os.fsync(handle.fileno())
PY
  mv "$tmp" "$path"
  python3 - "$RELEASES_DIR" <<'PY'
import os, sys
fd=os.open(sys.argv[1], os.O_RDONLY)
try: os.fsync(fd)
finally: os.close(fd)
PY
}

record_audit() {
  local event="$1" result="$2" payload timestamp changed_services
  timestamp="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  changed_services="$(services_json "${CHANGED_SERVICES[@]}")"
  export KAZA_AUDIT_EVENT="$event" KAZA_AUDIT_SHA="$DEPLOY_SHA" KAZA_AUDIT_CONTROL_SHA="$CONTROL_SHA"
  export KAZA_AUDIT_BRANCH="$DEPLOY_BRANCH" KAZA_AUDIT_ACTOR="$DEPLOY_ACTOR" KAZA_AUDIT_RUN_ID="$DEPLOY_RUN_ID"
  export KAZA_AUDIT_MODE="$DEPLOY_MODE" KAZA_AUDIT_TIMESTAMP="$timestamp"
  export KAZA_AUDIT_STARTED_AT="$STARTED_AT" KAZA_AUDIT_PREVIOUS_SHA="$PREVIOUS_SHA"
  export KAZA_AUDIT_MIGRATION_BEFORE="$MIGRATION_BEFORE" KAZA_AUDIT_MIGRATION_AFTER="$MIGRATION_AFTER"
  export KAZA_AUDIT_BACKUP_ARTIFACT="$DEPLOY_BACKUP_REF" KAZA_AUDIT_RESULT="$result"
  export KAZA_AUDIT_CHANGED_SERVICES="$changed_services"
  export KAZA_AUDIT_IMAGE_IDS="$IMAGE_IDS_JSON" KAZA_AUDIT_ROLLBACK_IMAGES="$ROLLBACK_IMAGES_JSON"
  export KAZA_AUDIT_RECOVERY_MANIFEST="$RECOVERY_MANIFEST"
  payload="$(python3 "$CONTROL_DIR/scripts/lib/deployment-record.py" audit)"
  DEPLOYMENT_LEDGER="$DEPLOYMENT_LEDGER" bash "$CONTROL_DIR/scripts/release-state.sh" record "$payload"
}

write_recovery_manifest() {
  local status="$1" tmp changed_services
  changed_services="$(services_json "${CHANGED_SERVICES[@]}")"
  export KAZA_AUDIT_SHA="$DEPLOY_SHA" KAZA_AUDIT_CONTROL_SHA="$CONTROL_SHA" KAZA_AUDIT_RUN_ID="$DEPLOY_RUN_ID"
  export KAZA_AUDIT_PREVIOUS_SHA="$PREVIOUS_SHA"
  export KAZA_AUDIT_CHANGED_SERVICES="$changed_services"
  export KAZA_AUDIT_IMAGE_IDS="$IMAGE_IDS_JSON" KAZA_AUDIT_ROLLBACK_IMAGES="$ROLLBACK_IMAGES_JSON"
  export KAZA_RECOVERY_SOURCE_DIR="$SOURCE_DIR" KAZA_RECOVERY_STATUS="$status"
  export KAZA_RECOVERY_PREVIOUS_IMAGE_IDS="$PREVIOUS_IMAGE_IDS_JSON"
  tmp="$(mktemp "$RELEASES_DIR/recovery.XXXXXX")"
  python3 "$CONTROL_DIR/scripts/lib/deployment-record.py" recovery > "$tmp"
  chmod 600 "$tmp"
  python3 - "$tmp" <<'PY'
import json, os, sys
path=sys.argv[1]
with open(path, encoding="utf-8") as handle:
    value=json.load(handle)
required={"schema","run_id","target_sha","control_sha","previous_sha","source_dir","status","changed_services","previous_image_ids","target_image_ids","rollback_images"}
if not isinstance(value,dict) or set(value)!=required:
    raise SystemExit("recovery manifest fields do not match the required schema")
with open(path,"rb") as handle:
    os.fsync(handle.fileno())
PY
  mv "$tmp" "$RECOVERY_MANIFEST"
  python3 - "$RELEASES_DIR" <<'PY'
import os, sys
fd=os.open(sys.argv[1], os.O_RDONLY)
try: os.fsync(fd)
finally: os.close(fd)
PY
  RECOVERY_WRITTEN=1
}

on_exit() {
  local status=$?
  trap - EXIT
  if [ "$status" -ne 0 ] && [ "$TERMINAL_RECORDED" = "0" ]; then
    if [ "$RECOVERY_WRITTEN" = "1" ]; then write_recovery_manifest FAILED || true; fi
    if ! record_audit DEPLOYMENT_RESULT FAILED; then
      echo "FATAL: deployment failed and the terminal audit record could not be persisted" >&2
    fi
    if [ "${#CHANGED_SERVICES[@]}" -gt 0 ]; then
      echo "RECOVERY REQUIRED: changed=${CHANGED_SERVICES[*]} manifest=$RECOVERY_MANIFEST" >&2
    fi
  fi
  exit "$status"
}
trap on_exit EXIT

[[ "$DEPLOY_SHA" =~ ^[0-9a-f]{40}$ ]] || { echo "FATAL: deploy SHA must be full lowercase hex" >&2; exit 64; }
[[ "$DEPLOY_RUN_ID" =~ ^[A-Za-z0-9._-]+$ ]] || { echo "FATAL: deployment run id contains unsafe characters" >&2; exit 1; }
case "$DEPLOY_MODE" in deploy|release) ;; *) echo "FATAL: unsupported deployment mode" >&2; exit 1 ;; esac
[ "$(git -C "$SOURCE_DIR" rev-parse --is-inside-work-tree 2>/dev/null)" = "true" ] || {
  echo "FATAL: application candidate is not a Git worktree" >&2; exit 1; }
[ "$(git -C "$CONTROL_DIR" rev-parse --is-inside-work-tree 2>/dev/null)" = "true" ] || {
  echo "FATAL: trusted control source is not a Git worktree" >&2; exit 1; }
[ "$(git -C "$SOURCE_DIR" rev-parse HEAD)" = "$DEPLOY_SHA" ] || { echo "FATAL: candidate SHA mismatch" >&2; exit 1; }
[ -z "$(git -C "$SOURCE_DIR" status --porcelain)" ] || { echo "FATAL: application candidate is dirty" >&2; exit 1; }
[ -z "$(git -C "$CONTROL_DIR" status --porcelain)" ] || { echo "FATAL: trusted control tree is dirty" >&2; exit 1; }
validate_deployment_authorization
[ -s "$ENV_FILE" ] || { echo "FATAL: production env file is missing or empty" >&2; exit 1; }
[ -s "$AUTH_SMOKE_CREDENTIALS_FILE" ] || { echo "FATAL: read-only auth smoke credentials are not provisioned" >&2; exit 1; }
[ -f "$PROVENANCE_FILE" ] || { echo "FATAL: trusted compose provenance override is missing" >&2; exit 1; }
AUTH_SMOKE_CREDENTIALS_FILE="$AUTH_SMOKE_CREDENTIALS_FILE" \
  bash "$CONTROL_DIR/scripts/smoke-production-auth.sh" --validate-only
[[ "$PREVIOUS_SHA" =~ ^[0-9a-f]{40}$ ]] || {
  echo "FATAL: current-sha.txt must identify the complete pre-deploy application state" >&2
  exit 1
}

check_head() {
  local code
  code="$(curl -sS -o /dev/null -w '%{http_code}' -I "$1" --max-time 15)"
  case "$code" in 2??|3??) ;; *) echo "FATAL: $1 returned HTTP $code" >&2; return 1 ;; esac
}
check_get() {
  local code
  code="$(curl -sS -o /dev/null -w '%{http_code}' "$1" --max-time 15)"
  [ "$code" = "200" ] || { echo "FATAL: $1 returned HTTP $code" >&2; return 1; }
}

echo "### Verifying existing database container (never recreating it)"
DB_ID_BEFORE="$(docker inspect -f '{{.Id}}' kaza-prod-db)"
[ "$(docker inspect -f '{{.State.Running}}' kaza-prod-db)" = "true" ] || { echo "FATAL: kaza-prod-db is not running" >&2; exit 1; }
[ "$(docker inspect -f '{{index .Config.Labels "com.docker.compose.project"}}' kaza-prod-db)" = "$PROJECT" ] || { echo "FATAL: database project label mismatch" >&2; exit 1; }
[ "$(docker inspect -f '{{index .Config.Labels "com.docker.compose.service"}}' kaza-prod-db)" = "db" ] || { echo "FATAL: database service label mismatch" >&2; exit 1; }
docker exec kaza-prod-db sh -lc 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"' >/dev/null
docker network inspect "$PROXY_NETWORK" >/dev/null
docker inspect novatova-nginx >/dev/null

verify_existing_runtime_provenance "$PREVIOUS_SHA" "$DEPLOY_SHA" "$CONTROL_SHA" \
  "$LIVE_DIR" "$DEPLOYMENT_LEDGER" "$APPROVE_UNVERIFIED_LEGACY_REPLACEMENT" "$CONTROL_DIR" \
  "${AUTHORIZED_RECOVERY_MANIFEST:-}"

echo "### Validating complete migration registry and ledger before any build"
LEDGER_AT_DEPLOY_START="$(APP_DIR="$SOURCE_DIR" COMPOSE_FILE="$COMPOSE_FILE" MIGRATION_AUTHORITY_DIR="$CONTROL_DIR" \
  ENV_FILE="$ENV_FILE" bash "$CONTROL_DIR/scripts/release-state.sh" ledger-head)"
if [ -z "$MIGRATION_BEFORE" ]; then MIGRATION_BEFORE="$LEDGER_AT_DEPLOY_START"; fi
if [ -n "$DEPLOY_MIGRATION_AFTER" ] && [ "$LEDGER_AT_DEPLOY_START" != "$DEPLOY_MIGRATION_AFTER" ]; then
  echo "FATAL: release ledger does not match the migration result ($LEDGER_AT_DEPLOY_START != $DEPLOY_MIGRATION_AFTER)" >&2
  exit 1
fi
APP_DIR="$SOURCE_DIR" COMPOSE_FILE="$COMPOSE_FILE" MIGRATION_AUTHORITY_DIR="$CONTROL_DIR" ENV_FILE="$ENV_FILE" \
  bash "$CONTROL_DIR/scripts/release-state.sh" schema-guard
record_audit DEPLOYMENT_PREPARED PREPARED

echo "### Validating target compose and building SHA-addressed application images"
compose config --quiet
compose build api demo portal

image_pairs=() previous_pairs=() rollback_pairs=()
for svc in api demo portal; do
  image="kaza-$svc:$DEPLOY_SHA"
  image_id="$(verify_built_image_provenance "$image" "$DEPLOY_SHA" "$CONTROL_SHA")"
  previous_id="$(docker inspect -f '{{.Image}}' "kaza-prod-$svc")"
  rollback_tag="kaza-$svc:rollback-$DEPLOY_RUN_ID"
  docker image tag "$previous_id" "$rollback_tag"
  image_pairs+=("$svc=$image_id")
  previous_pairs+=("$svc=$previous_id")
  rollback_pairs+=("$svc=$rollback_tag")
done
IMAGE_IDS_JSON="$(map_json "${image_pairs[@]}")"
PREVIOUS_IMAGE_IDS_JSON="$(map_json "${previous_pairs[@]}")"
ROLLBACK_IMAGES_JSON="$(map_json "${rollback_pairs[@]}")"
write_recovery_manifest PREPARED

echo "### Recreating application services individually"
for svc in api demo portal; do
  CHANGED_SERVICES+=("$svc")
  write_recovery_manifest IN_PROGRESS
  compose up -d --no-deps --no-build "$svc"
done

for svc in api demo portal; do
  expected="$(python3 -c 'import json,sys; print(json.loads(sys.argv[1])[sys.argv[2]])' "$IMAGE_IDS_JSON" "$svc")"
  verify_running_image_provenance "kaza-prod-$svc" "$expected" "$DEPLOY_SHA" "$CONTROL_SHA"
done

for c in kaza-prod-api kaza-prod-demo kaza-prod-portal; do
  if ! docker inspect -f '{{json .NetworkSettings.Networks}}' "$c" | grep -q "\"$PROXY_NETWORK\""; then
    docker network connect "$PROXY_NETWORK" "$c"
  fi
done
if docker ps --format '{{.Names}}' | grep -Eq '^kaza-prod-(nginx|certbot)$'; then
  echo "FATAL: Kaza edge container is running unexpectedly" >&2; exit 1
fi
docker exec novatova-nginx nginx -t
docker exec novatova-nginx nginx -s reload

sleep "${DEPLOY_HEALTH_DELAY_SECONDS:-12}"
check_head https://kaza-booking.com
check_head https://www.kaza-booking.com
check_head https://app.kaza-booking.com
check_get https://api.kaza-booking.com/
check_get https://api.kaza-booking.com/health
check_get https://api.kaza-booking.com/api/projects
check_head https://novatova.com
AUTH_SMOKE_CREDENTIALS_FILE="$AUTH_SMOKE_CREDENTIALS_FILE" bash "$CONTROL_DIR/scripts/smoke-production-auth.sh"

if docker logs --tail=200 kaza-prod-api 2>&1 | grep -iE 'libgssapi|gssapi_krb5'; then
  echo "FATAL: libgssapi error found in API logs" >&2; exit 1
fi
[ "$(docker inspect -f '{{.Id}}' kaza-prod-db)" = "$DB_ID_BEFORE" ] || { echo "FATAL: database container identity changed" >&2; exit 1; }

MIGRATION_AFTER="$(APP_DIR="$SOURCE_DIR" COMPOSE_FILE="$COMPOSE_FILE" MIGRATION_AUTHORITY_DIR="$CONTROL_DIR" \
  ENV_FILE="$ENV_FILE" bash "$CONTROL_DIR/scripts/release-state.sh" ledger-head)"
[ "$MIGRATION_AFTER" = "$LEDGER_AT_DEPLOY_START" ] || { echo "FATAL: database ledger changed during application deploy" >&2; exit 1; }

for svc in api demo portal; do docker image tag "kaza-$svc:$DEPLOY_SHA" "kaza-$svc:prod"; done
if [ -n "$PREVIOUS_SHA" ]; then write_state_file "$RELEASES_DIR/previous-sha.txt" "$PREVIOUS_SHA"; fi
write_state_file "$RELEASES_DIR/current-sha.txt" "$DEPLOY_SHA"
write_recovery_manifest DEPLOYED
record_audit DEPLOYMENT_RESULT OK
TERMINAL_RECORDED=1
echo "### DEPLOY OK: sha=$DEPLOY_SHA image_ids=$IMAGE_IDS_JSON db_container_unchanged=$DB_ID_BEFORE"
