#!/usr/bin/env bash
# ============================================================================
# KAZA — gated, tracked production migration runner (Blocker B7).
# Applies production-bootstrap migrations that are NOT yet recorded in the
# PostgreSQL `schema_migrations` ledger. Directory presence alone is not enough.
# NEVER runs automatically during deploy.
#
#   - Backs up the DB first (scripts/backup-postgres.sh).
#   - Applies only "main" migrations (skips *_rollback / *_verify / *_test).
#   - Runs the matching *_verify.sql after each apply (when present).
#   - Records a migration ONLY after it (and its verify) succeed.
#   - Refuses destructive migrations (DROP/TRUNCATE/DELETE) unless
#     APPROVE_DESTRUCTIVE=1 is set.
#   - Refuses to run if the ledger is empty (the baseline must come from
#     init.prod.sql), to avoid re-applying the whole history onto a live DB.
#
# Usage:   APPROVE_DESTRUCTIVE=0 bash ./scripts/apply-migrations.sh
# ============================================================================
set -euo pipefail

ENV_FILE="${ENV_FILE:-/opt/kaza/env/.env.production}"
COMPOSE_FILE="${COMPOSE_FILE:-/opt/apps/kaza-booking/docker-compose.prod.yml}"
APP_DIR="${APP_DIR:-/opt/apps/kaza-booking}"
MIG_DIR="${MIG_DIR:-$APP_DIR/db/migrations}"
PRODUCTION_MANIFEST="${PRODUCTION_MANIFEST:-$APP_DIR/infra/db/init.prod.sql}"
MIGRATION_CHECKSUMS="${MIGRATION_CHECKSUMS:-$APP_DIR/infra/db/production-migrations.sha256}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=scripts/lib/production-migrations.sh
source "$SCRIPT_DIR/lib/production-migrations.sh"

# Validate and materialize the complete production list before any database or
# backup command. Invalid deployment metadata must fail closed without writes.
PRODUCTION_MIGRATION_OUTPUT="$(list_production_migrations "$PRODUCTION_MANIFEST" "$MIG_DIR")"
mapfile -t MIGRATION_FILES <<< "$PRODUCTION_MIGRATION_OUTPUT"
validate_production_migration_checksums "$MIGRATION_CHECKSUMS" "$MIG_DIR" "${MIGRATION_FILES[@]}"

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

db_exec() {
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T db "$@"
}

psql_db() {
  db_exec psql -X -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" "$@"
}

# Two-key advisory locks use a PostgreSQL key space distinct from the one-key
# business locks. The fixed first key is the migration-runner namespace; the
# database OID is mapped one-to-one into the signed second key so unrelated
# databases in the same cluster do not block one another.
MIGRATION_LOCK_NAMESPACE=1263092295
MIGRATION_LOCK_PID=""
MIGRATION_LOCK_READ_FD=""
MIGRATION_LOCK_WRITE_FD=""

release_migration_lock() {
  if [ -n "$MIGRATION_LOCK_WRITE_FD" ]; then
    printf '\\q\n' >&"$MIGRATION_LOCK_WRITE_FD" 2>/dev/null || true
    eval "exec ${MIGRATION_LOCK_WRITE_FD}>&-" 2>/dev/null || true
    MIGRATION_LOCK_WRITE_FD=""
  fi
  if [ -n "$MIGRATION_LOCK_READ_FD" ]; then
    eval "exec ${MIGRATION_LOCK_READ_FD}<&-" 2>/dev/null || true
    MIGRATION_LOCK_READ_FD=""
  fi
  if [ -n "$MIGRATION_LOCK_PID" ]; then
    wait "$MIGRATION_LOCK_PID" 2>/dev/null || true
    MIGRATION_LOCK_PID=""
  fi
}

trap release_migration_lock EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

start_migration_lock() {
  local result
  local lock_sql

  lock_sql="WITH target AS (
    SELECT CASE
      WHEN oid::bigint > 2147483647 THEN (oid::bigint - 4294967296)::integer
      ELSE oid::integer
    END AS database_key
    FROM pg_database
    WHERE datname = current_database()
  )
  SELECT CASE
    WHEN pg_try_advisory_lock(${MIGRATION_LOCK_NAMESPACE}, database_key) THEN 'LOCKED'
    ELSE 'BUSY'
  END
  FROM target;"

  coproc MIGRATION_LOCK_SESSION {
    db_exec psql -X -qAt -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"
  }
  MIGRATION_LOCK_PID="$MIGRATION_LOCK_SESSION_PID"
  MIGRATION_LOCK_READ_FD="${MIGRATION_LOCK_SESSION[0]}"
  MIGRATION_LOCK_WRITE_FD="${MIGRATION_LOCK_SESSION[1]}"

  printf '%s\n' "$lock_sql" >&"$MIGRATION_LOCK_WRITE_FD"
  if ! IFS= read -r result <&"$MIGRATION_LOCK_READ_FD"; then
    echo "REFUSING: unable to establish the PostgreSQL migration-runner lock session" >&2
    return 1
  fi
  if [ "$result" != "LOCKED" ]; then
    echo "REFUSING: another migration runner already owns this database's migration lock" >&2
    return 1
  fi
}

assert_migration_lock_alive() {
  local result

  printf "SELECT 'LOCK_HELD';\n" >&"$MIGRATION_LOCK_WRITE_FD"
  if ! IFS= read -r result <&"$MIGRATION_LOCK_READ_FD" || [ "$result" != "LOCK_HELD" ]; then
    echo "REFUSING: PostgreSQL migration-runner lock session was lost" >&2
    return 1
  fi
}

read_and_validate_ledger() {
  local ledger_table
  local ledger_columns
  local ledger_rows

  ledger_table="$(psql_db -tA -c "SELECT to_regclass('public.schema_migrations') IS NOT NULL;")"
  [ "$ledger_table" = "t" ] || {
    echo "REFUSING: schema_migrations is missing; initialize with infra/db/init.prod.sql" >&2
    return 1
  }

  ledger_columns="$(psql_db -tA -c "
    SELECT count(*)
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'schema_migrations'
      AND column_name IN ('id', 'migration_number', 'migration_name', 'applied_at');")"
  [ "$ledger_columns" = "4" ] || {
    echo "REFUSING: schema_migrations has an unsupported shape" >&2
    return 1
  }

  ledger_rows="$(psql_db -F '|' -tA -c "
    SELECT migration_number, COALESCE(migration_name, '')
    FROM schema_migrations
    ORDER BY id;")"
  validate_migration_ledger_rows "$ledger_rows" "${MIGRATION_FILES[@]}"
}

start_migration_lock
assert_migration_lock_alive
read_and_validate_ledger

echo "### Taking a pre-migration backup ..."
assert_migration_lock_alive
bash "$SCRIPT_DIR/backup-postgres.sh"
assert_migration_lock_alive

echo "### Scanning for pending migrations in $MIG_DIR ..."
PENDING=("${MIGRATION_FILES[@]:$MIGRATION_LEDGER_APPLIED_COUNT}")

if [ "${#PENDING[@]}" -eq 0 ]; then
  echo "### Up to date — no pending migrations."
  exit 0
fi

echo "### Pending: ${PENDING[*]}"

for f in "${PENDING[@]}"; do
  num="${f:0:4}"
  path="$MIG_DIR/$f"
  assert_migration_lock_alive

  if grep -Eiq '\b(DROP|TRUNCATE|DELETE)\b' "$path"; then
    if [ "$f" = "0059_add_historical_booking_external_reference_index.sql" ] &&
       ! grep -Eiq '\b(DROP[[:space:]]+(TABLE|SCHEMA|COLUMN)|TRUNCATE|DELETE)\b' "$path"; then
      echo "    (approved 0059 concurrent-index recovery cleanup)"
    elif [ "${APPROVE_DESTRUCTIVE:-0}" != "1" ]; then
      echo "STOP: $f looks destructive (DROP/TRUNCATE/DELETE)." >&2
      echo "Re-run with APPROVE_DESTRUCTIVE=1 after explicit approval. Halting." >&2
      exit 1
    else
      echo "    (destructive change approved via APPROVE_DESTRUCTIVE=1)"
    fi
  fi

  echo "--- applying $f"
  psql_db < "$path"
  assert_migration_lock_alive

  verify="${MIG_DIR}/${f%.sql}_verify.sql"
  if [ -f "$verify" ]; then
    echo "    verifying ${f%.sql}_verify.sql"
    psql_db < "$verify"
    assert_migration_lock_alive
  fi

  # Record ONLY after success (apply + verify both passed; set -e aborts before here on failure).
  psql_db -c \
    "INSERT INTO schema_migrations (migration_number, migration_name)
     VALUES ('${num}', '${f}');" >/dev/null
  echo "    recorded ${num}"
done

assert_migration_lock_alive
read_and_validate_ledger
[ "$MIGRATION_LEDGER_APPLIED_COUNT" -eq "${#MIGRATION_FILES[@]}" ] || {
  echo "REFUSING: post-migration ledger verification did not reach the expected registry head" >&2
  exit 1
}

echo "### All pending migrations applied and recorded."
