#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CONTAINER="${KAZA_MIGRATION_TEST_CONTAINER:?Set KAZA_MIGRATION_TEST_CONTAINER to a disposable PostgreSQL 16 container}"
DATABASE_PREFIX="${KAZA_MIGRATION_TEST_DB_PREFIX:-kaza_test_release_hardening}"

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

assert_contains() {
  local path="$1"
  local expected="$2"
  grep -Fq -- "$expected" "$path" || fail "expected $path to contain: $expected"
}

TMP="$(mktemp -d)"
RUN_ID="${RANDOM}_$$"
DB_SAME="${DATABASE_PREFIX}_${RUN_ID}_same"
DB_OTHER="${DATABASE_PREFIX}_${RUN_ID}_other"
DB_CRASH="${DATABASE_PREFIX}_${RUN_ID}_crash"
DB_RESTORE="${DATABASE_PREFIX}_${RUN_ID}_restore"
DATABASES=("$DB_SAME" "$DB_OTHER" "$DB_CRASH" "$DB_RESTORE")

cleanup() {
  local database
  for database in "${DATABASES[@]}"; do
    docker exec "$CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
      -c "DROP DATABASE IF EXISTS \"$database\" WITH (FORCE);" >/dev/null 2>&1 || true
  done
  rm -rf -- "$TMP"
}
trap cleanup EXIT

mkdir -p "$TMP/bin" "$TMP/migrations" "$TMP/backups"
REAL_DOCKER="$(command -v docker)"
cat > "$TMP/bin/docker" <<'SH'
#!/usr/bin/env bash
set -euo pipefail

printf '%q ' "$@" >> "$DOCKER_CALLS_FILE"
printf '\n' >> "$DOCKER_CALLS_FILE"

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
export DOCKER_CALLS_FILE="$TMP/docker-calls.log"

cat > "$TMP/production.sql" <<'SQL'
\i /docker-entrypoint-initdb.d/migrations/0001_baseline.sql
\i /docker-entrypoint-initdb.d/migrations/0002_serialized_change.sql
SQL
cat > "$TMP/migrations/0001_baseline.sql" <<'SQL'
SELECT 'baseline';
SQL
cat > "$TMP/migrations/0002_serialized_change.sql" <<'SQL'
SELECT pg_sleep(4);
CREATE TABLE release_hardening_applied(id integer PRIMARY KEY);
SQL
cat > "$TMP/migrations/0002_serialized_change_verify.sql" <<'SQL'
DO $$
BEGIN
  IF to_regclass('public.release_hardening_applied') IS NULL THEN
    RAISE EXCEPTION 'release hardening migration did not apply';
  END IF;
END $$;
SQL

source "$ROOT/scripts/lib/production-migrations.sh"
: > "$TMP/checksums.sha256"
while IFS= read -r file; do
  printf '%s  %s\n' \
    "$(canonical_migration_sha256 "$TMP/migrations/$file")" \
    "$file" >> "$TMP/checksums.sha256"
done < <(list_production_migrations "$TMP/production.sql" "$TMP/migrations")

create_database() {
  local database="$1"
  local include_pending="${2:-0}"
  docker exec "$CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
    -c "CREATE DATABASE \"$database\";" >/dev/null
  docker exec -i "$CONTAINER" psql -U postgres -d "$database" -v ON_ERROR_STOP=1 <<SQL >/dev/null
CREATE TABLE schema_migrations (
  id BIGSERIAL PRIMARY KEY,
  migration_number TEXT NOT NULL UNIQUE,
  migration_name TEXT,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO schema_migrations (migration_number, migration_name)
VALUES ('0001', '0001_baseline.sql');
SQL
  if [ "$include_pending" = "1" ]; then
    docker exec "$CONTAINER" psql -U postgres -d "$database" -v ON_ERROR_STOP=1 \
      -c "CREATE TABLE release_hardening_applied(id integer PRIMARY KEY);
          INSERT INTO schema_migrations (migration_number, migration_name)
          VALUES ('0002', '0002_serialized_change.sql');" >/dev/null
  fi
}

write_env() {
  local database="$1"
  local path="$TMP/$database.env"
  cat > "$path" <<ENV
POSTGRES_DB=$database
POSTGRES_USER=postgres
POSTGRES_PASSWORD=test-only
ENV
  printf '%s\n' "$path"
}

run_runner() {
  local database="$1"
  local backup_dir="${2:-$TMP/backups}"
  PATH="$TMP/bin:$PATH" \
  ENV_FILE="$(write_env "$database")" \
  COMPOSE_FILE="$TMP/compose.yml" \
  APP_DIR="$ROOT" \
  MIG_DIR="$TMP/migrations" \
  PRODUCTION_MANIFEST="$TMP/production.sql" \
  MIGRATION_CHECKSUMS="$TMP/checksums.sha256" \
  BACKUP_DIR="$backup_dir" \
  "$ROOT/scripts/apply-migrations.sh"
}

expect_ledger_refusal() {
  local database="$1"
  local expected="$2"
  local backup_dir="$TMP/refused-backups-$database"
  local output="$TMP/refused-$database.log"
  local status

  DATABASES+=("$database")
  mkdir -p "$backup_dir"
  set +e
  run_runner "$database" "$backup_dir" > "$output" 2>&1
  status=$?
  set -e
  [ "$status" -ne 0 ] || fail "inconsistent ledger unexpectedly ran for $database"
  assert_contains "$output" "$expected"
  [ -z "$(find "$backup_dir" -type f -print -quit)" ] ||
    fail "inconsistent ledger triggered a backup for $database"
  applied_table="$(docker exec "$CONTAINER" psql -U postgres -d "$database" -tA \
    -c "SELECT to_regclass('public.release_hardening_applied') IS NOT NULL;")"
  [ "$applied_table" = "f" ] || fail "inconsistent ledger executed migration SQL for $database"
}

create_ledger_fixture() {
  local database="$1"
  local table_sql="$2"
  local rows_sql="${3:-}"

  docker exec "$CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
    -c "CREATE DATABASE \"$database\";" >/dev/null
  docker exec "$CONTAINER" psql -U postgres -d "$database" -v ON_ERROR_STOP=1 \
    -c "$table_sql $rows_sql" >/dev/null
}

wait_for_log() {
  local path="$1"
  local expected="$2"
  local attempts=0
  until grep -Fq -- "$expected" "$path" 2>/dev/null; do
    attempts=$((attempts + 1))
    if [ "$attempts" -ge 200 ]; then
      echo "--- captured runner log: $path" >&2
      cat "$path" >&2 || true
      echo "--- captured docker calls" >&2
      cat "$DOCKER_CALLS_FILE" >&2 || true
      fail "timed out waiting for '$expected' in $path"
    fi
    sleep 0.05
  done
}

create_database "$DB_SAME"
direct_ledger_exists="$(docker exec "$CONTAINER" psql -U postgres -d "$DB_SAME" -tA \
  -c "SELECT to_regclass('public.schema_migrations') IS NOT NULL;")"
[ "$direct_ledger_exists" = "t" ] || fail "test fixture did not create schema_migrations"
run_runner "$DB_SAME" > "$TMP/runner-a.log" 2>&1 &
runner_a=$!
wait_for_log "$TMP/runner-a.log" "--- applying 0002_serialized_change.sql"

set +e
run_runner "$DB_SAME" > "$TMP/runner-b.log" 2>&1
runner_b_status=$?
set -e
[ "$runner_b_status" -ne 0 ] || fail "second same-database runner unexpectedly acquired the lock"
assert_contains "$TMP/runner-b.log" "another migration runner already owns this database's migration lock"
if ! wait "$runner_a"; then
  echo "--- captured runner A log" >&2
  cat "$TMP/runner-a.log" >&2 || true
  fail "first same-database runner failed"
fi

ledger_count="$(docker exec "$CONTAINER" psql -U postgres -d "$DB_SAME" -tA \
  -c 'SELECT count(*) FROM schema_migrations;')"
[ "$ledger_count" = "2" ] || fail "serialized runner did not leave the expected ledger"
run_runner "$DB_SAME" > "$TMP/runner-after.log" 2>&1
assert_contains "$TMP/runner-after.log" "Up to date"

create_database "$DB_OTHER" 1
create_database "$DB_CRASH"

run_runner "$DB_CRASH" > "$TMP/runner-crash.log" 2>&1 &
runner_crash=$!
wait_for_log "$TMP/runner-crash.log" "--- applying 0002_serialized_change.sql"

# A real runner holding DB_CRASH's lock must not block a runner targeting the
# different DB_OTHER database in the same PostgreSQL cluster.
run_runner "$DB_OTHER" > "$TMP/runner-other.log" 2>&1
assert_contains "$TMP/runner-other.log" "Up to date"

kill -TERM "$runner_crash"
set +e
wait "$runner_crash"
crash_status=$?
set -e
[ "$crash_status" -ne 0 ] || fail "terminated runner unexpectedly reported success"

lock_reacquired="$(docker exec "$CONTAINER" psql -X -qAt -U postgres -d "$DB_CRASH" -c \
  "SELECT pg_try_advisory_lock(1263092295, (SELECT oid::integer FROM pg_database WHERE datname=current_database()));")"
[ "$lock_reacquired" = "t" ] || fail "connection close orphaned the migration advisory lock"

mapfile -t artifacts < <(find "$TMP/backups" -maxdepth 1 -type f -name 'kaza_postgres_*.sql.gz' | sort)
[ "${#artifacts[@]}" -ge 4 ] || fail "expected independently named real backup artifacts"
source "$ROOT/scripts/lib/postgres-backup.sh"
for artifact in "${artifacts[@]}"; do
  validate_postgres_backup_artifact "$artifact"
done
[ "$(printf '%s\n' "${artifacts[@]}" | sort -u | wc -l | tr -d ' ')" -eq "${#artifacts[@]}" ] ||
  fail "real backup attempts reused an artifact name"

restore_source="${artifacts[0]}"
PATH="$TMP/bin:$PATH" \
ENV_FILE="$(write_env "$DB_SAME")" \
COMPOSE_FILE="$TMP/compose.yml" \
"$ROOT/scripts/restore-postgres.sh" "$restore_source" "$DB_RESTORE" > "$TMP/restore.log"
restored_ledger="$(docker exec "$CONTAINER" psql -U postgres -d "$DB_RESTORE" -tA \
  -c "SELECT to_regclass('public.schema_migrations') IS NOT NULL;")"
[ "$restored_ledger" = "t" ] || fail "validated backup did not restore into the disposable scratch database"

LEDGER_TABLE_SQL="CREATE TABLE schema_migrations (
  id BIGSERIAL PRIMARY KEY,
  migration_number TEXT NOT NULL UNIQUE,
  migration_name TEXT,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);"

DB_LEDGER_MISSING="${DATABASE_PREFIX}_${RUN_ID}_ledger_missing"
docker exec "$CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
  -c "CREATE DATABASE \"$DB_LEDGER_MISSING\";" >/dev/null
expect_ledger_refusal "$DB_LEDGER_MISSING" "schema_migrations is missing"

DB_LEDGER_EMPTY="${DATABASE_PREFIX}_${RUN_ID}_ledger_empty"
create_ledger_fixture "$DB_LEDGER_EMPTY" "$LEDGER_TABLE_SQL"
expect_ledger_refusal "$DB_LEDGER_EMPTY" "schema_migrations is empty"

DB_LEDGER_GAP="${DATABASE_PREFIX}_${RUN_ID}_ledger_gap"
create_ledger_fixture "$DB_LEDGER_GAP" "$LEDGER_TABLE_SQL" \
  "INSERT INTO schema_migrations (migration_number, migration_name)
   VALUES ('0002', '0002_serialized_change.sql');"
expect_ledger_refusal "$DB_LEDGER_GAP" "ordering gap; expected 0001 but found 0002"

DB_LEDGER_UNKNOWN="${DATABASE_PREFIX}_${RUN_ID}_ledger_unknown"
create_ledger_fixture "$DB_LEDGER_UNKNOWN" "$LEDGER_TABLE_SQL" \
  "INSERT INTO schema_migrations (migration_number, migration_name) VALUES
   ('0001', '0001_baseline.sql'), ('9999', '9999_unknown.sql');"
expect_ledger_refusal "$DB_LEDGER_UNKNOWN" "applied migration is absent from the production registry: 9999"

DB_LEDGER_DUPLICATE="${DATABASE_PREFIX}_${RUN_ID}_ledger_duplicate"
create_ledger_fixture "$DB_LEDGER_DUPLICATE" \
  "CREATE TABLE schema_migrations (
    id BIGSERIAL PRIMARY KEY,
    migration_number TEXT NOT NULL,
    migration_name TEXT,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );" \
  "INSERT INTO schema_migrations (migration_number, migration_name) VALUES
   ('0001', '0001_baseline.sql'), ('0001', '0001_baseline.sql');"
expect_ledger_refusal "$DB_LEDGER_DUPLICATE" "duplicate schema_migrations entry: 0001"

DB_LEDGER_ORDER="${DATABASE_PREFIX}_${RUN_ID}_ledger_order"
create_ledger_fixture "$DB_LEDGER_ORDER" "$LEDGER_TABLE_SQL" \
  "INSERT INTO schema_migrations (migration_number, migration_name) VALUES
   ('0002', '0002_serialized_change.sql'), ('0001', '0001_baseline.sql');"
expect_ledger_refusal "$DB_LEDGER_ORDER" "ordering gap; expected 0001 but found 0002"

DB_LEDGER_NAME="${DATABASE_PREFIX}_${RUN_ID}_ledger_name"
create_ledger_fixture "$DB_LEDGER_NAME" "$LEDGER_TABLE_SQL" \
  "INSERT INTO schema_migrations (migration_number, migration_name)
   VALUES ('0001', '0001_changed.sql');"
expect_ledger_refusal "$DB_LEDGER_NAME" "name conflicts with the production registry for 0001"

DB_LEDGER_SHAPE="${DATABASE_PREFIX}_${RUN_ID}_ledger_shape"
create_ledger_fixture "$DB_LEDGER_SHAPE" \
  "CREATE TABLE schema_migrations (migration_number TEXT NOT NULL);" \
  "INSERT INTO schema_migrations (migration_number) VALUES ('0001');"
expect_ledger_refusal "$DB_LEDGER_SHAPE" "schema_migrations has an unsupported shape"

echo "PASS: real PostgreSQL migration lock, backup, ledger, and restore safety"
