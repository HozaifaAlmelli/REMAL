#!/usr/bin/env sh
set -eu

if (set -o pipefail) 2>/dev/null; then
  set -o pipefail
fi

DEPLOY_SHA="${1:-}"
APP_DIR="/opt/apps/kaza-booking"
ENV_FILE="/opt/kaza/env/.env.production"
PROJECT="kaza-prod"
PROXY_NETWORK="proxy-network"
TMP_DIR="${TMPDIR:-/tmp}"
HEAD_CHECK_FILE="$(mktemp "$TMP_DIR/kaza-head-check.XXXXXX")"
GET_CHECK_FILE="$(mktemp "$TMP_DIR/kaza-get-check.XXXXXX")"
SHA_TMP_FILE=""

cleanup() {
  rm -f "$HEAD_CHECK_FILE" "$GET_CHECK_FILE"
  if [ -n "$SHA_TMP_FILE" ]; then
    rm -f "$SHA_TMP_FILE"
  fi
}

trap cleanup EXIT INT TERM

if [ -z "$DEPLOY_SHA" ]; then
  echo "FATAL: deploy SHA argument is required"
  exit 1
fi

compose() {
  docker compose \
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

mkdir -p /opt/kaza/releases
if [ -f /opt/kaza/releases/current-sha.txt ]; then
  cp /opt/kaza/releases/current-sha.txt /opt/kaza/releases/previous-sha.txt
fi

echo "### Validating compose config"
compose config --quiet

echo "### Building app services only"
compose build api demo portal

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
SHA_TMP_FILE="$(mktemp /opt/kaza/releases/current-sha.XXXXXX)"
git rev-parse HEAD > "$SHA_TMP_FILE"
mv "$SHA_TMP_FILE" /opt/kaza/releases/current-sha.txt
SHA_TMP_FILE=""
echo "### DEPLOY OK - live SHA: $(cat /opt/kaza/releases/current-sha.txt)"
