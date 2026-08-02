#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# shellcheck source=scripts/lib/production-migrations.sh
source "$ROOT/scripts/lib/production-migrations.sh"

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

assert_contains() {
  local text="$1"
  local expected="$2"
  [[ "$text" == *"$expected"* ]] || fail "expected output to contain: $expected"
}

assert_not_contains() {
  local text="$1"
  local unexpected="$2"
  [[ "$text" != *"$unexpected"* ]] || fail "unexpected output contained: $unexpected"
}

current="$(list_production_migrations "$ROOT/infra/db/init.prod.sql" "$ROOT/db/migrations")"
assert_not_contains "$current" "0008_seed_dev_master_data.sql"
assert_not_contains "$current" "0046_seed_dev_users_units.sql"
assert_not_contains "$current" "0047_seed_minimal_dev_login.sql"
assert_not_contains "$current" "dev_login"

TMP="$(mktemp -d)"
trap 'rm -rf -- "$TMP"' EXIT
mkdir -p "$TMP/bin" "$TMP/migrations" "$TMP/runner/lib"
cp "$ROOT/scripts/apply-migrations.sh" "$TMP/runner/apply-migrations.sh"
cp "$ROOT/scripts/lib/production-migrations.sh" "$TMP/runner/lib/production-migrations.sh"

cat > "$TMP/production.sql" <<'SQL'
\i /docker-entrypoint-initdb.d/migrations/0097_legitimate_first.sql
\i /docker-entrypoint-initdb.d/migrations/0099_legitimate_second.sql
SQL
cat > "$TMP/migrations/0097_legitimate_first.sql" <<'SQL'
SELECT 'legitimate-first';
SQL
cat > "$TMP/migrations/0098_seed_dev_future.sql" <<'SQL'
SELECT 'development-only';
SQL
cat > "$TMP/migrations/0099_legitimate_second.sql" <<'SQL'
SELECT 'legitimate-second';
SQL
cat > "$TMP/migrations/0099_legitimate_second_verify.sql" <<'SQL'
SELECT 'legitimate-second-verified';
SQL

synthetic="$(list_production_migrations "$TMP/production.sql" "$TMP/migrations")"
[ "$synthetic" = $'0097_legitimate_first.sql\n0099_legitimate_second.sql' ] ||
  fail "production migrations did not preserve manifest ordering"
assert_not_contains "$synthetic" "0098_seed_dev_future.sql"

cat > "$TMP/test.env" <<'ENV'
POSTGRES_DB=test
POSTGRES_USER=test
POSTGRES_PASSWORD=test
ENV
cat > "$TMP/runner/backup-postgres.sh" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
echo backup >> "$BACKUP_CALLS_FILE"
SH
cat > "$TMP/bin/docker" <<'SH'
#!/usr/bin/env bash
set -euo pipefail

joined="$*"
if [[ "$joined" == *"CREATE TABLE IF NOT EXISTS schema_migrations"* ]]; then
  exit 0
fi
if [[ "$joined" == *"SELECT count(*) FROM schema_migrations"* ]]; then
  wc -l < "$LEDGER_FILE" | tr -d ' '
  exit 0
fi
if [[ "$joined" == *"SELECT 1 FROM schema_migrations WHERE migration_number="* ]]; then
  number="$(printf '%s' "$joined" | grep -oE "'[0-9]{4}'" | head -1 | tr -d "'")"
  if grep -qx "$number" "$LEDGER_FILE"; then
    echo 1
  fi
  exit 0
fi
if [[ "$joined" == *"INSERT INTO schema_migrations"* ]]; then
  number="$(printf '%s' "$joined" | grep -oE "'[0-9]{4}'" | head -1 | tr -d "'")"
  grep -qx "$number" "$LEDGER_FILE" || echo "$number" >> "$LEDGER_FILE"
  exit 0
fi

cat >> "$EXECUTED_SQL_FILE"
printf '\n-- invocation --\n' >> "$EXECUTED_SQL_FILE"
SH
chmod +x "$TMP/runner/apply-migrations.sh" "$TMP/runner/backup-postgres.sh" "$TMP/bin/docker"

printf '0001\n0097\n' > "$TMP/ledger"
: > "$TMP/executed.sql"
: > "$TMP/backups"
export PATH="$TMP/bin:$PATH"
export LEDGER_FILE="$TMP/ledger"
export EXECUTED_SQL_FILE="$TMP/executed.sql"
export BACKUP_CALLS_FILE="$TMP/backups"

run_runner() {
  ENV_FILE="$TMP/test.env" \
  COMPOSE_FILE="$TMP/compose.yml" \
  APP_DIR="$ROOT" \
  MIG_DIR="$TMP/migrations" \
  PRODUCTION_MANIFEST="$TMP/production.sql" \
  APPROVE_DESTRUCTIVE="${1:-0}" \
  "$TMP/runner/apply-migrations.sh"
}

first_run="$(run_runner)"
assert_contains "$first_run" "Pending: 0099_legitimate_second.sql"
assert_contains "$(cat "$TMP/executed.sql")" "legitimate-second"
assert_contains "$(cat "$TMP/executed.sql")" "legitimate-second-verified"
assert_not_contains "$(cat "$TMP/executed.sql")" "legitimate-first"
assert_not_contains "$(cat "$TMP/executed.sql")" "development-only"
[ "$(grep -cx 0099 "$TMP/ledger")" -eq 1 ] || fail "legitimate migration was not recorded once"

before_second="$(sha256sum "$TMP/executed.sql" | cut -d' ' -f1)"
second_run="$(run_runner)"
after_second="$(sha256sum "$TMP/executed.sql" | cut -d' ' -f1)"
assert_contains "$second_run" "Up to date"
[ "$before_second" = "$after_second" ] || fail "second invocation re-executed a migration"

cat >> "$TMP/production.sql" <<'SQL'
\i /docker-entrypoint-initdb.d/migrations/0100_legitimate_destructive.sql
SQL
cat > "$TMP/migrations/0100_legitimate_destructive.sql" <<'SQL'
DELETE FROM disposable_test_table;
SQL

set +e
destructive_output="$(run_runner 0 2>&1)"
destructive_status=$?
set -e
[ "$destructive_status" -ne 0 ] || fail "destructive migration was not blocked"
assert_contains "$destructive_output" "looks destructive"
grep -qx 0100 "$TMP/ledger" && fail "blocked destructive migration was recorded"
assert_not_contains "$(cat "$TMP/executed.sql")" "disposable_test_table"

echo "PASS: production migration selection and runner safeguards"
