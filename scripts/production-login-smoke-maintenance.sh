#!/usr/bin/env bash
set -Eeuo pipefail
if (set -o pipefail) 2>/dev/null; then
  set -o pipefail
fi

TS="$(date +%Y%m%d-%H%M%S)"
APP_DIR="/opt/apps/kaza-booking"
ENV_FILE="/opt/kaza/env/.env.production"
PROJECT="kaza-prod"
LOG_DIR="/root/kaza-login-fix-logs"
BACKUP_DIR="/root/kaza-db-backups"
CRED_FILE="$LOG_DIR/${TS}-smoke-credentials.txt"
STATUS_LOG="$LOG_DIR/${TS}-maintenance-status.txt"
HASH_DIR=""
DOTNET_SDK_IMAGE="mcr.microsoft.com/dotnet/sdk:10.0-preview"
SQL_FILE=""
ADMIN_BODY=""
OWNER_BODY=""
CLIENT_BODY=""
RESP_FILE=""

cleanup() {
  [ -z "$HASH_DIR" ] || rm -rf "$HASH_DIR"
  [ -z "$SQL_FILE" ] || rm -f "$SQL_FILE"
  [ -z "$ADMIN_BODY" ] || rm -f "$ADMIN_BODY"
  [ -z "$OWNER_BODY" ] || rm -f "$OWNER_BODY"
  [ -z "$CLIENT_BODY" ] || rm -f "$CLIENT_BODY"
  [ -z "$RESP_FILE" ] || rm -f "$RESP_FILE"
}
trap cleanup EXIT INT TERM

log() {
  printf '%s %s\n' "$(date -Is)" "$*" | tee -a "$STATUS_LOG"
}

compose() {
  docker compose \
    -p "$PROJECT" \
    -f "$APP_DIR/docker-compose.prod.yml" \
    --env-file "$ENV_FILE" \
    --project-directory "$APP_DIR" \
    "$@"
}

psql_db() {
  compose exec -T db sh -lc 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" "$@"' sh "$@"
}

check_url() {
  url="$1"
  code="$(curl -sS -o /dev/null -w '%{http_code}' "$url" --max-time 15 || true)"
  log "$url -> HTTP $code"
  case "$code" in
    2??|3??) ;;
    *) echo "FATAL: $url returned HTTP $code" >&2; exit 1 ;;
  esac
}

login_check() {
  label="$1"
  url="$2"
  body="$3"
  code="$(curl -sS -o "$RESP_FILE" -w '%{http_code}' \
    -X POST "$url" \
    -H 'Content-Type: application/json' \
    --data-binary "@$body" \
    --max-time 20 || true)"
  if [ "$code" = "200" ]; then
    log "$label login -> HTTP 200"
  else
    log "$label login -> HTTP $code"
    python3 - "$RESP_FILE" <<'PY'
import json
import sys
path = sys.argv[1]
try:
    payload = json.load(open(path, encoding="utf-8"))
    print("login failure message:", payload.get("message", "no message"))
except Exception:
    print("login failure body was not JSON")
PY
    exit 1
  fi
}

if [ ! -d "$APP_DIR" ]; then
  echo "FATAL: app directory missing: $APP_DIR" >&2
  exit 1
fi

if [ ! -s "$ENV_FILE" ]; then
  echo "FATAL: env file missing or empty: $ENV_FILE" >&2
  exit 1
fi

mkdir -p "$LOG_DIR" "$BACKUP_DIR"
chmod 700 "$LOG_DIR" "$BACKUP_DIR"
touch "$STATUS_LOG"
chmod 600 "$STATUS_LOG"

log "Starting production login smoke maintenance"
check_url "https://app.kaza-booking.com"
check_url "https://api.kaza-booking.com/health"
check_url "https://novatova.com"
docker exec novatova-nginx nginx -t
log "novatova-nginx config test passed"

cd "$APP_DIR"
if [ -n "$(git status --porcelain)" ]; then
  echo "FATAL: live repo has local changes" >&2
  git status --short
  exit 1
fi
git fetch origin main --quiet
git checkout main
git pull --ff-only origin main

BACKUP_FILE="$BACKUP_DIR/kaza_postgres_${TS}_before_login_smoke.sql.gz"
compose exec -T db sh -lc 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB"' | gzip > "$BACKUP_FILE"
if [ ! -s "$BACKUP_FILE" ] || ! gzip -t "$BACKUP_FILE" 2>/dev/null; then
  rm -f "$BACKUP_FILE"
  echo "FATAL: backup missing, empty, or corrupt" >&2
  exit 1
fi
chmod 600 "$BACKUP_FILE"
log "DB backup OK: $BACKUP_FILE"

log "Owner contact columns before migration:"
psql_db -tA -c "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='owners' AND column_name IN ('detailed_address','emergency_phone') ORDER BY column_name;" | tee -a "$STATUS_LOG" || true

psql_db < "$APP_DIR/db/migrations/0057_add_owner_contact_fields.sql"
psql_db < "$APP_DIR/db/migrations/0057_add_owner_contact_fields_verify.sql"
psql_db -c "INSERT INTO schema_migrations (migration_number, migration_name) VALUES ('0057', '0057_add_owner_contact_fields.sql') ON CONFLICT (migration_number) DO NOTHING;" >/dev/null
log "Migration 0057 applied and verified"

log "Owner contact columns after migration:"
psql_db -tA -c "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='owners' AND column_name IN ('detailed_address','emergency_phone') ORDER BY column_name;" | tee -a "$STATUS_LOG"

HASH_DIR="$(mktemp -d /tmp/kaza-smoke-hasher.XXXXXX)"
cat > "$HASH_DIR/KazaSmokeHasher.csproj" <<'EOF'
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net10.0</TargetFramework>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>enable</Nullable>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="BCrypt.Net-Next" Version="4.1.0" />
  </ItemGroup>
</Project>
EOF
cat > "$HASH_DIR/Program.cs" <<'EOF'
using BCrypt.Net;

var password = Console.In.ReadToEnd().TrimEnd('\r', '\n');
if (string.IsNullOrWhiteSpace(password))
{
    return 2;
}

Console.Write(BCrypt.Net.BCrypt.HashPassword(password, 12));
EOF
log "Building BCrypt smoke hash helper"
docker run --rm -e NUGET_PACKAGES=/src/.nuget/packages -v "$HASH_DIR:/src" -w /src "$DOTNET_SDK_IMAGE" dotnet restore
docker run --rm -e NUGET_PACKAGES=/src/.nuget/packages -v "$HASH_DIR:/src" -w /src "$DOTNET_SDK_IMAGE" dotnet build --no-restore

hash_password() {
  printf '%s' "$1" | docker run --rm -i -e NUGET_PACKAGES=/src/.nuget/packages -v "$HASH_DIR:/src" -w /src "$DOTNET_SDK_IMAGE" dotnet run --no-restore --no-build --nologo
}

make_password() {
  printf 'KazaSmoke_%s_Aa1' "$(openssl rand -hex 18)"
}

ADMIN_EMAIL="smoke-admin@kaza-booking.com"
OWNER_EMAIL="smoke-owner@kaza-booking.com"
CLIENT_EMAIL="smoke-client@kaza-booking.com"
OWNER_PHONE="+201099900001"
OWNER_EMERGENCY_PHONE="+201099900011"
CLIENT_PHONE="+201099900002"
ADMIN_PASSWORD="$(make_password)"
OWNER_PASSWORD="$(make_password)"
CLIENT_PASSWORD="$(make_password)"
ADMIN_HASH="$(hash_password "$ADMIN_PASSWORD")"
OWNER_HASH="$(hash_password "$OWNER_PASSWORD")"
CLIENT_HASH="$(hash_password "$CLIENT_PASSWORD")"

umask 077
cat > "$CRED_FILE" <<EOF
Kaza production smoke login credentials
Generated: $TS

Admin
Email: $ADMIN_EMAIL
Password: $ADMIN_PASSWORD
Login URL: https://app.kaza-booking.com/auth/admin/login

Owner
Email: $OWNER_EMAIL
Phone: $OWNER_PHONE
Password: $OWNER_PASSWORD
Login URL: https://app.kaza-booking.com/auth/owner/login

Client
Email: $CLIENT_EMAIL
Phone: $CLIENT_PHONE
Password: $CLIENT_PASSWORD
Login URL: https://app.kaza-booking.com/auth/client/login
EOF
chmod 600 "$CRED_FILE"
log "Smoke credentials stored: $CRED_FILE"

SQL_FILE="$(mktemp /tmp/kaza-smoke-accounts.XXXXXX.sql)"
cat > "$SQL_FILE" <<'SQL'
BEGIN;

CREATE TEMP TABLE smoke_login_vars (
    admin_email TEXT NOT NULL,
    admin_hash TEXT NOT NULL,
    owner_email TEXT NOT NULL,
    owner_phone TEXT NOT NULL,
    owner_emergency_phone TEXT NOT NULL,
    owner_hash TEXT NOT NULL,
    client_email TEXT NOT NULL,
    client_phone TEXT NOT NULL,
    client_hash TEXT NOT NULL
) ON COMMIT DROP;

INSERT INTO smoke_login_vars
VALUES (:'admin_email', :'admin_hash', :'owner_email', :'owner_phone', :'owner_emergency_phone', :'owner_hash', :'client_email', :'client_phone', :'client_hash');

DO $$
DECLARE
    v smoke_login_vars%ROWTYPE;
BEGIN
    SELECT * INTO v FROM smoke_login_vars LIMIT 1;

    IF EXISTS (SELECT 1 FROM admin_users WHERE LOWER(email) = LOWER(v.admin_email) AND name <> 'Smoke Admin') THEN
        RAISE EXCEPTION 'Admin smoke email is already used by a non-smoke admin';
    END IF;

    IF EXISTS (SELECT 1 FROM owners WHERE phone = v.owner_phone AND COALESCE(LOWER(email), '') <> LOWER(v.owner_email)) THEN
        RAISE EXCEPTION 'Owner smoke phone is already used by a non-smoke owner';
    END IF;

    IF EXISTS (SELECT 1 FROM owners WHERE LOWER(email) = LOWER(v.owner_email) AND phone <> v.owner_phone) THEN
        RAISE EXCEPTION 'Owner smoke email is already used by a different owner phone';
    END IF;

    IF EXISTS (SELECT 1 FROM clients WHERE phone = v.client_phone AND COALESCE(LOWER(email), '') <> LOWER(v.client_email)) THEN
        RAISE EXCEPTION 'Client smoke phone is already used by a non-smoke client';
    END IF;

    IF EXISTS (SELECT 1 FROM clients WHERE LOWER(email) = LOWER(v.client_email) AND phone <> v.client_phone) THEN
        RAISE EXCEPTION 'Client smoke email is already used by a different client phone';
    END IF;
END $$;

WITH v AS (
    SELECT * FROM smoke_login_vars
),
updated_admin AS (
    UPDATE admin_users a
    SET name = 'Smoke Admin',
        password_hash = v.admin_hash,
        role = 'super_admin',
        role_template_id = '10000000-0000-0000-0000-000000000001'::uuid,
        is_active = TRUE,
        updated_at = CURRENT_TIMESTAMP
    FROM v
    WHERE LOWER(a.email) = LOWER(v.admin_email)
    RETURNING a.id
)
INSERT INTO admin_users (name, email, password_hash, role, role_template_id, is_active, created_at, updated_at)
SELECT 'Smoke Admin',
       v.admin_email,
       v.admin_hash,
       'super_admin',
       '10000000-0000-0000-0000-000000000001'::uuid,
       TRUE,
       CURRENT_TIMESTAMP,
       CURRENT_TIMESTAMP
FROM v
WHERE NOT EXISTS (SELECT 1 FROM updated_admin)
  AND NOT EXISTS (SELECT 1 FROM admin_users a WHERE LOWER(a.email) = LOWER(v.admin_email));

WITH v AS (
    SELECT * FROM smoke_login_vars
),
updated_owner AS (
    UPDATE owners o
    SET name = 'Smoke Owner',
        email = v.owner_email,
        emergency_phone = v.owner_emergency_phone,
        detailed_address = 'Smoke-test owner address',
        commission_rate = 0.00,
        notes = 'Controlled production smoke-test account.',
        status = 'active',
        password_hash = v.owner_hash,
        deleted_at = NULL,
        updated_at = CURRENT_TIMESTAMP
    FROM v
    WHERE o.phone = v.owner_phone
    RETURNING o.id
)
INSERT INTO owners (name, phone, email, emergency_phone, detailed_address, commission_rate, notes, status, password_hash, created_at, updated_at, deleted_at)
SELECT 'Smoke Owner',
       v.owner_phone,
       v.owner_email,
       v.owner_emergency_phone,
       'Smoke-test owner address',
       0.00,
       'Controlled production smoke-test account.',
       'active',
       v.owner_hash,
       CURRENT_TIMESTAMP,
       CURRENT_TIMESTAMP,
       NULL
FROM v
WHERE NOT EXISTS (SELECT 1 FROM updated_owner)
  AND NOT EXISTS (SELECT 1 FROM owners o WHERE o.phone = v.owner_phone);

WITH v AS (
    SELECT * FROM smoke_login_vars
),
updated_client AS (
    UPDATE clients c
    SET name = 'Smoke Client',
        email = v.client_email,
        password_hash = v.client_hash,
        is_active = TRUE,
        deleted_at = NULL,
        updated_at = CURRENT_TIMESTAMP
    FROM v
    WHERE c.phone = v.client_phone
    RETURNING c.id
)
INSERT INTO clients (name, phone, email, password_hash, is_active, created_at, updated_at, deleted_at)
SELECT 'Smoke Client',
       v.client_phone,
       v.client_email,
       v.client_hash,
       TRUE,
       CURRENT_TIMESTAMP,
       CURRENT_TIMESTAMP,
       NULL
FROM v
WHERE NOT EXISTS (SELECT 1 FROM updated_client)
  AND NOT EXISTS (SELECT 1 FROM clients c WHERE c.phone = v.client_phone);

COMMIT;
SQL

psql_db \
  -v admin_email="$ADMIN_EMAIL" \
  -v admin_hash="$ADMIN_HASH" \
  -v owner_email="$OWNER_EMAIL" \
  -v owner_phone="$OWNER_PHONE" \
  -v owner_emergency_phone="$OWNER_EMERGENCY_PHONE" \
  -v owner_hash="$OWNER_HASH" \
  -v client_email="$CLIENT_EMAIL" \
  -v client_phone="$CLIENT_PHONE" \
  -v client_hash="$CLIENT_HASH" \
  < "$SQL_FILE"
log "Smoke accounts created or reset"

ADMIN_BODY="$(mktemp /tmp/kaza-admin-login.XXXXXX.json)"
OWNER_BODY="$(mktemp /tmp/kaza-owner-login.XXXXXX.json)"
CLIENT_BODY="$(mktemp /tmp/kaza-client-login.XXXXXX.json)"
RESP_FILE="$(mktemp /tmp/kaza-login-response.XXXXXX.json)"
printf '{"email":"%s","password":"%s"}' "$ADMIN_EMAIL" "$ADMIN_PASSWORD" > "$ADMIN_BODY"
printf '{"phone":"%s","password":"%s"}' "$OWNER_PHONE" "$OWNER_PASSWORD" > "$OWNER_BODY"
printf '{"phone":"%s","password":"%s"}' "$CLIENT_PHONE" "$CLIENT_PASSWORD" > "$CLIENT_BODY"

login_check "Admin" "https://api.kaza-booking.com/api/auth/admin/login" "$ADMIN_BODY"
login_check "Owner" "https://api.kaza-booking.com/api/auth/owner/login" "$OWNER_BODY"
login_check "Client" "https://api.kaza-booking.com/api/auth/client/login" "$CLIENT_BODY"

check_url "https://app.kaza-booking.com"
check_url "https://api.kaza-booking.com/health"
check_url "https://novatova.com"
docker exec novatova-nginx nginx -t
log "Final novatova-nginx config test passed"
log "Maintenance complete"
