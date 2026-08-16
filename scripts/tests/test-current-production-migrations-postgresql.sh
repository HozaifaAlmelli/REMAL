#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ROOT_NATIVE="$(cygpath -w "$ROOT" 2>/dev/null || printf '%s' "$ROOT")"
CONTAINER="${KAZA_MIGRATION_TEST_CONTAINER:?Set KAZA_MIGRATION_TEST_CONTAINER to a disposable PostgreSQL 16 container}"
DATABASE_PREFIX="${KAZA_MIGRATION_TEST_DB_PREFIX:-kaza_test_current_migrations}"

[[ "$CONTAINER" == *test* || "$CONTAINER" == *release-hardening* ]] || {
  echo "REFUSING: migration integration container name must be explicitly test-scoped" >&2
  exit 1
}
[[ "$DATABASE_PREFIX" == kaza_test_* ]] || {
  echo "REFUSING: migration integration database prefix must begin with kaza_test_" >&2
  exit 1
}

image="$(docker inspect "$CONTAINER" --format '{{.Config.Image}}')"
version="$(docker exec "$CONTAINER" psql -U postgres -d postgres -tA -c 'SHOW server_version_num;')"
[[ "$image" == postgres:16* ]] || {
  echo "REFUSING: expected official postgres:16 image, found $image" >&2
  exit 1
}
[ "${version:0:2}" = "16" ] || {
  echo "REFUSING: PostgreSQL 16 is required, found version number $version" >&2
  exit 1
}

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

TMP="$(mktemp -d)"
RUN_ID="${RANDOM}_$$"
DATABASE="${DATABASE_PREFIX}_${RUN_ID}"
CONTAINER_ASSETS="/tmp/kaza-release-hardening-$RUN_ID"

cleanup() {
  docker exec "$CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
    -c "DROP DATABASE IF EXISTS \"$DATABASE\" WITH (FORCE);" >/dev/null 2>&1 || true
  MSYS_NO_PATHCONV=1 docker exec "$CONTAINER" rm -rf -- "$CONTAINER_ASSETS" >/dev/null 2>&1 || true
  rm -rf -- "$TMP"
}
trap cleanup EXIT

mkdir -p "$TMP/bin" "$TMP/backups"
REAL_DOCKER="$(command -v docker)"
cat > "$TMP/bin/docker" <<'SH'
#!/usr/bin/env bash
set -euo pipefail

# `docker compose config --quiet` is the runner's env-file preflight: it
# validates and prints nothing. There is no compose project in this harness, so
# accept it.
for arg in "$@"; do
  if [ "$arg" = "config" ]; then
    exit 0
  fi
done

while [ "$#" -gt 0 ]; do
  if [ "$1" = "exec" ]; then
    shift
    [ "${1:-}" = "-T" ] && shift
    [ "${1:-}" = "db" ] || exit 91
    shift
    exec "$REAL_DOCKER" exec -i "$KAZA_MIGRATION_TEST_CONTAINER" "$@"
  fi
  shift
done
exit 92
SH
chmod +x "$TMP/bin/docker"
export REAL_DOCKER KAZA_MIGRATION_TEST_CONTAINER="$CONTAINER"

cat > "$TMP/test.env" <<ENV
POSTGRES_DB=$DATABASE
POSTGRES_USER=postgres
POSTGRES_PASSWORD=test-only
ENV

MSYS_NO_PATHCONV=1 docker exec "$CONTAINER" mkdir -p "$CONTAINER_ASSETS/migrations"
MSYS_NO_PATHCONV=1 docker cp "$ROOT_NATIVE/db/migrations/." "$CONTAINER:$CONTAINER_ASSETS/migrations" >/dev/null
MSYS_NO_PATHCONV=1 docker cp "$ROOT_NATIVE/infra/db/init.prod.sql" "$CONTAINER:$CONTAINER_ASSETS/init.prod.sql" >/dev/null

# The production bootstrap uses the container-init migration path. This test
# container is disposable and dedicated to release-hardening verification.
MSYS_NO_PATHCONV=1 docker exec "$CONTAINER" mkdir -p /docker-entrypoint-initdb.d/migrations
MSYS_NO_PATHCONV=1 docker cp "$ROOT_NATIVE/db/migrations/." "$CONTAINER:/docker-entrypoint-initdb.d/migrations" >/dev/null

docker exec "$CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
  -c "CREATE DATABASE \"$DATABASE\";" >/dev/null
MSYS_NO_PATHCONV=1 docker exec "$CONTAINER" psql -X -v ON_ERROR_STOP=1 -U postgres -d "$DATABASE" \
  -f "$CONTAINER_ASSETS/init.prod.sql" > "$TMP/bootstrap.log"

source "$ROOT/scripts/lib/production-migrations.sh"
mapfile -t expected_migrations < <(
  list_production_migrations "$ROOT/infra/db/init.prod.sql" "$ROOT/db/migrations"
)
validate_production_migration_checksums \
  "$ROOT/infra/db/production-migrations.sha256" \
  "$ROOT/db/migrations" \
  "${expected_migrations[@]}"

ledger_count="$(docker exec "$CONTAINER" psql -U postgres -d "$DATABASE" -tA \
  -c 'SELECT count(*) FROM schema_migrations;')"
[ "$ledger_count" -eq "${#expected_migrations[@]}" ] ||
  fail "production bootstrap ledger count differs from the ordered registry"

tail_rows="$(docker exec "$CONTAINER" psql -U postgres -d "$DATABASE" -tA -F '|' \
  -c "SELECT migration_number, migration_name FROM schema_migrations
      WHERE migration_number IN ('0063', '0064') ORDER BY migration_number;")"
[ "$tail_rows" = $'0063|baseline (init.prod.sql)\n0064|baseline (init.prod.sql)' ] ||
  fail "production bootstrap did not recognize migrations 0063 and 0064"

MSYS_NO_PATHCONV=1 docker exec "$CONTAINER" psql -X -v ON_ERROR_STOP=1 -U postgres -d "$DATABASE" \
  -f "$CONTAINER_ASSETS/migrations/0063_add_historical_reporting_read_models_verify.sql" >/dev/null
MSYS_NO_PATHCONV=1 docker exec "$CONTAINER" psql -X -v ON_ERROR_STOP=1 -U postgres -d "$DATABASE" \
  -f "$CONTAINER_ASSETS/migrations/0064_add_rentable_capacity_history_verify.sql" >/dev/null

MSYS_NO_PATHCONV=1 docker exec "$CONTAINER" psql -X -v ON_ERROR_STOP=1 -U postgres -d "$DATABASE" \
  -f "$CONTAINER_ASSETS/migrations/0064_add_rentable_capacity_history_rollback.sql" >/dev/null
set +e
MSYS_NO_PATHCONV=1 docker exec "$CONTAINER" psql -X -v ON_ERROR_STOP=1 -U postgres -d "$DATABASE" \
  -f "$CONTAINER_ASSETS/migrations/0064_add_rentable_capacity_history_verify.sql" > "$TMP/0064-rolled-back-verify.log" 2>&1
verify_0064_rollback_status=$?
set -e
[ "$verify_0064_rollback_status" -ne 0 ] || fail "0064 verifier passed after its rollback"
docker exec "$CONTAINER" psql -U postgres -d "$DATABASE" -v ON_ERROR_STOP=1 \
  -c "DELETE FROM schema_migrations WHERE migration_number = '0064';" >/dev/null

MSYS_NO_PATHCONV=1 docker exec "$CONTAINER" psql -X -v ON_ERROR_STOP=1 -U postgres -d "$DATABASE" \
  -f "$CONTAINER_ASSETS/migrations/0063_add_historical_reporting_read_models_rollback.sql" >/dev/null
set +e
MSYS_NO_PATHCONV=1 docker exec "$CONTAINER" psql -X -v ON_ERROR_STOP=1 -U postgres -d "$DATABASE" \
  -f "$CONTAINER_ASSETS/migrations/0063_add_historical_reporting_read_models_verify.sql" > "$TMP/0063-rolled-back-verify.log" 2>&1
verify_0063_rollback_status=$?
set -e
[ "$verify_0063_rollback_status" -ne 0 ] || fail "0063 verifier passed after its rollback"

PATH="$TMP/bin:$PATH" \
ENV_FILE="$TMP/test.env" \
COMPOSE_FILE="$TMP/compose.yml" \
APP_DIR="$ROOT" \
BACKUP_DIR="$TMP/backups" \
APPROVE_DESTRUCTIVE=1 \
bash "$ROOT/scripts/apply-migrations.sh" > "$TMP/upgrade.log"

grep -Fq -- '--- applying 0063_add_historical_reporting_read_models.sql' "$TMP/upgrade.log" ||
  fail "hardened runner did not apply 0063 on the disposable upgrade path"
grep -Fq -- '--- applying 0064_add_rentable_capacity_history.sql' "$TMP/upgrade.log" ||
  fail "hardened runner did not apply 0064 on the disposable upgrade path"

MSYS_NO_PATHCONV=1 docker exec "$CONTAINER" psql -X -v ON_ERROR_STOP=1 -U postgres -d "$DATABASE" \
  -f "$CONTAINER_ASSETS/migrations/0063_add_historical_reporting_read_models_verify.sql" >/dev/null
MSYS_NO_PATHCONV=1 docker exec "$CONTAINER" psql -X -v ON_ERROR_STOP=1 -U postgres -d "$DATABASE" \
  -f "$CONTAINER_ASSETS/migrations/0064_add_rentable_capacity_history_verify.sql" >/dev/null

upgraded_tail="$(docker exec "$CONTAINER" psql -U postgres -d "$DATABASE" -tA -F '|' \
  -c "SELECT migration_number, migration_name FROM schema_migrations
      WHERE migration_number IN ('0063', '0064') ORDER BY migration_number;")"
[ "$upgraded_tail" = $'0063|0063_add_historical_reporting_read_models.sql\n0064|0064_add_rentable_capacity_history.sql' ] ||
  fail "hardened runner did not record the current migration identities"

ledger_rows="$(docker exec "$CONTAINER" psql -U postgres -d "$DATABASE" -tA -F '|' \
  -c 'SELECT migration_number, migration_name FROM schema_migrations ORDER BY id;')"
validate_migration_ledger_rows "$ledger_rows" "${expected_migrations[@]}"
[ "$MIGRATION_LEDGER_APPLIED_COUNT" -eq "${#expected_migrations[@]}" ] ||
  fail "upgraded ledger did not reach the registry head"

source "$ROOT/scripts/lib/postgres-backup.sh"
mapfile -t backups < <(find "$TMP/backups" -maxdepth 1 -type f -name 'kaza_postgres_*.sql.gz')
[ "${#backups[@]}" -eq 1 ] || fail "upgrade path did not create exactly one unique backup"
validate_postgres_backup_artifact "${backups[0]}"

ledger_publication="$(docker exec "$CONTAINER" psql -U postgres -d "$DATABASE" -tA -F '|' \
  -c "SELECT publication_status, coverage_start_date, published_at
      FROM rentable_capacity_ledger WHERE scope = 'global';")"
[ "$ledger_publication" = 'uninitialized||' ] ||
  fail "0064 upgrade unexpectedly initialized rentable-capacity coverage"

echo "PASS: production bootstrap, 0063/0064 rollback verification, and current upgrade path"
