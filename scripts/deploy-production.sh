#!/usr/bin/env sh
# ============================================================================
# KAZA — production code deployment (shared VPS with Novatova).
#
# Deploys ONE explicit immutable commit. It does NOT run database migrations:
# schema changes go through scripts/release-production.sh. To make that
# separation safe rather than merely documented, this script REFUSES to build
# or restart anything when the live database is behind the tree being deployed.
#
# Invariants that must survive any edit to this file:
#   - service-scoped compose only: never `down`, never a bare `up -d`
#   - the `edge` profile (kaza-prod-nginx / kaza-prod-certbot) stays OFF
#   - proxy-network reattach, then `nginx -t` before `nginx -s reload` on
#     novatova-nginx — inspect and reload only, never restart
#   - health gate over every Kaza host plus novatova.com
#   - fail on any libgssapi error in the API log
#
# Usage:  sh scripts/deploy-production.sh <deploy-sha>
# ============================================================================
set -eu

if (set -o pipefail) 2>/dev/null; then
  set -o pipefail
fi

DEPLOY_SHA="${1:-}"
APP_DIR="/opt/apps/kaza-booking"
ENV_FILE="/opt/kaza/env/.env.production"
PROJECT="kaza-prod"
PROXY_NETWORK="proxy-network"
RELEASES_DIR="/opt/kaza/releases"
TMP_DIR="${TMPDIR:-/tmp}"
HEAD_CHECK_FILE="$(mktemp "$TMP_DIR/kaza-head-check.XXXXXX")"
GET_CHECK_FILE="$(mktemp "$TMP_DIR/kaza-get-check.XXXXXX")"
SHA_TMP_FILE=""

# Audit metadata. Supplied by the workflow; defaulted so a manual host-side run
# is still recorded rather than silently absent from the ledger.
DEPLOY_ACTOR="${DEPLOY_ACTOR:-manual}"
DEPLOY_RUN_ID="${DEPLOY_RUN_ID:-}"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-}"
DEPLOY_MODE="${DEPLOY_MODE:-deploy}"
DEPLOY_BACKUP_REF="${DEPLOY_BACKUP_REF:-}"
DEPLOY_MIGRATION_BEFORE="${DEPLOY_MIGRATION_BEFORE:-}"

STARTED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
PREVIOUS_SHA=""
MIGRATION_BEFORE=""
MIGRATION_AFTER=""
DEPLOY_RESULT="FAILED"

json_escape() {
  # Only the characters that can occur in these fields need escaping.
  printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g'
}

record_deployment() {
  finished_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  payload="$(printf '{"sha":"%s","branch":"%s","actor":"%s","workflow_run_id":"%s","mode":"%s","started_at":"%s","finished_at":"%s","previous_sha":"%s","migration_before":"%s","migration_after":"%s","backup_reference":"%s","result":"%s"}' \
    "$(json_escape "$DEPLOY_SHA")" \
    "$(json_escape "$DEPLOY_BRANCH")" \
    "$(json_escape "$DEPLOY_ACTOR")" \
    "$(json_escape "$DEPLOY_RUN_ID")" \
    "$(json_escape "$DEPLOY_MODE")" \
    "$STARTED_AT" "$finished_at" \
    "$(json_escape "$PREVIOUS_SHA")" \
    "$(json_escape "$MIGRATION_BEFORE")" \
    "$(json_escape "$MIGRATION_AFTER")" \
    "$(json_escape "$DEPLOY_BACKUP_REF")" \
    "$DEPLOY_RESULT")"
  # Recording must never mask the deployment's own exit status.
  bash "$APP_DIR/scripts/release-state.sh" record "$payload" ||
    echo "WARNING: deployment ledger write failed" >&2
}

cleanup() {
  rm -f "$HEAD_CHECK_FILE" "$GET_CHECK_FILE"
  if [ -n "$SHA_TMP_FILE" ]; then
    rm -f "$SHA_TMP_FILE"
  fi
  # Only record once a target has actually been named.
  if [ -n "$DEPLOY_SHA" ]; then
    record_deployment
  fi
}

trap cleanup EXIT INT TERM

if [ -z "$DEPLOY_SHA" ]; then
  echo "FATAL: deploy SHA argument is required"
  exit 1
fi

compose() {
  KAZA_IMAGE_TAG="$DEPLOY_SHA" docker compose \
    -p "$PROJECT" \
    -f "$APP_DIR/docker-compose.prod.yml" \
    --env-file "$ENV_FILE" \
    --project-directory "$APP_DIR" \
    "$@"
}

check_head() {
  url="$1"
  code="$(curl -sS -o "$HEAD_CHECK_FILE" -w '%{http_code}' -I "$url" --max-time 15)"
  cat "$HEAD_CHECK_FILE"
  case "$code" in
    2??|3??) ;;
    *)
      echo "FATAL: $url returned HTTP $code"
      exit 1
      ;;
  esac
}

check_get() {
  url="$1"
  code="$(curl -sS -o "$GET_CHECK_FILE" -w '%{http_code}' "$url" --max-time 15)"
  head -40 "$GET_CHECK_FILE"
  if [ "$code" != "200" ]; then
    echo "FATAL: $url returned HTTP $code"
    exit 1
  fi
}

if [ ! -d "$APP_DIR" ]; then
  echo "FATAL: app directory missing: $APP_DIR"
  exit 1
fi

if [ ! -s "$ENV_FILE" ]; then
  echo "FATAL: env file missing or empty: $ENV_FILE"
  exit 1
fi

docker network inspect "$PROXY_NETWORK" >/dev/null
docker inspect novatova-nginx >/dev/null

cd "$APP_DIR"

if [ "$(git rev-parse HEAD)" != "$DEPLOY_SHA" ]; then
  echo "FATAL: checked out SHA $(git rev-parse HEAD) does not match deploy SHA $DEPLOY_SHA"
  exit 1
fi

mkdir -p "$RELEASES_DIR"
if [ -f "$RELEASES_DIR/current-sha.txt" ]; then
  PREVIOUS_SHA="$(cat "$RELEASES_DIR/current-sha.txt")"
  cp "$RELEASES_DIR/current-sha.txt" "$RELEASES_DIR/previous-sha.txt"
fi

# ── Schema compatibility gate ───────────────────────────────────────────────
# Runs before the first build and before any container is touched. A tree whose
# migrations are ahead of the live database is refused here, with nothing built,
# nothing restarted, and the previous release still serving.
echo "### Checking database schema compatibility"
MIGRATION_BEFORE="$(bash "$APP_DIR/scripts/release-state.sh" ledger-head)"
if [ -n "$DEPLOY_MIGRATION_BEFORE" ] && [ "$DEPLOY_MIGRATION_BEFORE" != "$MIGRATION_BEFORE" ]; then
  echo "FATAL: database head changed under the release (expected $DEPLOY_MIGRATION_BEFORE, found $MIGRATION_BEFORE)"
  exit 1
fi
bash "$APP_DIR/scripts/release-state.sh" schema-guard

echo "### Validating compose config"
compose config --quiet

echo "### Building app services only (image tag: $DEPLOY_SHA)"
compose build api demo portal

# A stable :prod tag keeps every existing reference working, while the immutable
# :<sha> tag is what actually proves which code a container holds.
for svc in api demo portal; do
  docker image tag "kaza-$svc:$DEPLOY_SHA" "kaza-$svc:prod"
done

echo "### Ensuring database service is running without recreating unrelated services"
compose up -d --no-deps db

echo "### Deploying app services only"
compose up -d --no-deps api demo portal

echo "### Ensuring Kaza app containers are attached to proxy-network"
for c in kaza-prod-api kaza-prod-demo kaza-prod-portal; do
  if docker ps --format '{{.Names}}' | grep -qx "$c"; then
    if ! docker inspect -f '{{json .NetworkSettings.Networks}}' "$c" | grep -q "\"$PROXY_NETWORK\""; then
      docker network connect "$PROXY_NETWORK" "$c"
    fi
  else
    echo "FATAL: expected container $c is not running"
    exit 1
  fi
done

echo "### Verifying the running containers carry the deploy SHA"
for c in kaza-prod-api kaza-prod-demo kaza-prod-portal; do
  revision="$(docker inspect -f '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$c")"
  if [ "$revision" != "$DEPLOY_SHA" ]; then
    echo "FATAL: $c reports revision '$revision', expected $DEPLOY_SHA"
    exit 1
  fi
done

if docker ps --format '{{.Names}}' | grep -Eq '^kaza-prod-(nginx|certbot)$'; then
  echo "FATAL: Kaza edge container is running unexpectedly"
  docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E 'kaza-prod-(nginx|certbot)'
  exit 1
fi

echo "### Testing novatova-nginx config"
docker exec novatova-nginx nginx -t

echo "### Reloading novatova-nginx to refresh static upstream IPs"
docker exec novatova-nginx nginx -s reload

echo "### Post-deploy health checks"
sleep 12
check_head "https://kaza-booking.com"
check_head "https://www.kaza-booking.com"
check_head "https://app.kaza-booking.com"
check_get "https://api.kaza-booking.com/"
check_get "https://api.kaza-booking.com/health"
check_get "https://api.kaza-booking.com/api/projects"
check_head "https://novatova.com"

echo "### Checking API logs for libgssapi error"
if docker logs --tail=200 kaza-prod-api 2>&1 | grep -iE "libgssapi|gssapi_krb5"; then
  echo "FATAL: libgssapi error still present"
  exit 1
else
  echo "OK: no libgssapi error"
fi

docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Deploy never migrates; re-reading proves it and records the proof.
MIGRATION_AFTER="$(bash "$APP_DIR/scripts/release-state.sh" ledger-head)"

SHA_TMP_FILE="$(mktemp "$RELEASES_DIR/current-sha.XXXXXX")"
git rev-parse HEAD > "$SHA_TMP_FILE"
mv "$SHA_TMP_FILE" "$RELEASES_DIR/current-sha.txt"
SHA_TMP_FILE=""
DEPLOY_RESULT="OK"
echo "### DEPLOY OK - live SHA: $(cat "$RELEASES_DIR/current-sha.txt")"
