#!/usr/bin/env bash
# ============================================================================
# KAZA — gated, tracked production migration runner (Blocker B7).
# Applies db/migrations/NNNN_*.sql files that are NOT yet recorded in the
# PostgreSQL `schema_migrations` ledger. NEVER runs automatically during deploy.
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
# Usage:   APPROVE_DESTRUCTIVE=0 ./scripts/apply-migrations.sh
# ============================================================================
set -euo pipefail

ENV_FILE="${ENV_FILE:-/opt/kaza/env/.env.production}"
COMPOSE_FILE="${COMPOSE_FILE:-/opt/kaza/app/docker-compose.prod.yml}"
APP_DIR="${APP_DIR:-/opt/kaza/app}"
MIG_DIR="${MIG_DIR:-$APP_DIR/db/migrations}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck disable=SC1090
set -a; source "$ENV_FILE"; set +a

psql_db() { docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T db \
  psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" "$@"; }

# Ensure ledger exists (idempotent).
psql_db -c "CREATE TABLE IF NOT EXISTS schema_migrations (
  id BIGSERIAL PRIMARY KEY,
  migration_number TEXT NOT NULL UNIQUE,
  migration_name TEXT,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW());" >/dev/null

LEDGER_COUNT="$(psql_db -tA -c "SELECT count(*) FROM schema_migrations;")"
if [ "$LEDGER_COUNT" = "0" ]; then
  echo "REFUSING: schema_migrations is empty. The baseline must be seeded by init.prod.sql" >&2
  echo "on first boot. Running every migration onto an existing schema would fail/corrupt it." >&2
  exit 1
fi

echo "### Taking a pre-migration backup ..."
"$SCRIPT_DIR/backup-postgres.sh"

echo "### Scanning for pending migrations in $MIG_DIR ..."
PENDING=()
while IFS= read -r f; do
  num="${f:0:4}"
  applied="$(psql_db -tA -c "SELECT 1 FROM schema_migrations WHERE migration_number='${num}';")"
  [ "$applied" = "1" ] && continue
  PENDING+=("$f")
done < <(ls -1 "$MIG_DIR" | grep -E '^[0-9]{4}_.*\.sql$' | grep -Ev '_(rollback|verify|test)\.sql$' | sort)

if [ "${#PENDING[@]}" -eq 0 ]; then
  echo "### Up to date — no pending migrations."
  exit 0
fi

echo "### Pending: ${PENDING[*]}"

for f in "${PENDING[@]}"; do
  num="${f:0:4}"
  path="$MIG_DIR/$f"

  if grep -Eiq '\b(DROP|TRUNCATE|DELETE)\b' "$path"; then
    if [ "${APPROVE_DESTRUCTIVE:-0}" != "1" ]; then
      echo "STOP: $f looks destructive (DROP/TRUNCATE/DELETE)." >&2
      echo "Re-run with APPROVE_DESTRUCTIVE=1 after explicit approval. Halting." >&2
      exit 1
    fi
    echo "    (destructive change approved via APPROVE_DESTRUCTIVE=1)"
  fi

  echo "--- applying $f"
  psql_db < "$path"

  verify="${MIG_DIR}/${f%.sql}_verify.sql"
  if [ -f "$verify" ]; then
    echo "    verifying ${f%.sql}_verify.sql"
    psql_db < "$verify"
  fi

  # Record ONLY after success (apply + verify both passed; set -e aborts before here on failure).
  psql_db -c "INSERT INTO schema_migrations (migration_number, migration_name)
              VALUES ('${num}', '${f}') ON CONFLICT (migration_number) DO NOTHING;" >/dev/null
  echo "    recorded ${num}"
done

echo "### All pending migrations applied and recorded."
