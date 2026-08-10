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

expect_failure() {
  local description="$1"
  local expected="$2"
  shift 2
  local output
  local status

  set +e
  output="$("$@" 2>&1)"
  status=$?
  set -e
  [ "$status" -ne 0 ] || fail "$description unexpectedly succeeded"
  assert_contains "$output" "$expected"
}

validate_supported_manifest_include_syntax() {
  local manifest="$1"
  if grep -Eq '^[[:space:]]*\\(ir|include)([[:space:]]|$).*\/migrations\/' "$manifest"; then
    echo "ERROR: unsupported production migration include syntax" >&2
    return 1
  fi
}

declare -A INTENTIONAL_FORWARD_EXCLUSIONS=(
  [0008_seed_dev_master_data.sql]="development-only master-data seed"
  [0046_seed_dev_users_units.sql]="development-only demo-data seed"
  [0047_seed_minimal_dev_login.sql]="development-only known-login seed"
  [0048_add_owner_contact_fields.sql]="superseded duplicate-number artifact; replaced by 0057"
)
MANIFEST_COMPLETENESS_CHECKED=0

assert_manifest_completeness() {
  local manifest="$1"
  local migration_dir="$2"
  local file
  local index
  local -a registered=()
  local -a baseline_numbers=()
  local -a forward_files=()
  local -A registered_names=()

  validate_supported_manifest_include_syntax "$manifest"
  mapfile -t registered < <(list_production_migrations "$manifest" "$migration_dir")
  mapfile -t forward_files < <(
    find "$migration_dir" -maxdepth 1 -type f \
      -name '[0-9][0-9][0-9][0-9]_*.sql' -exec basename {} \; |
      grep -Ev '_(rollback|verify|test)\.sql$' |
      sort
  )
  for file in "${registered[@]}"; do
    registered_names[$file]=1
  done

  for file in "${!INTENTIONAL_FORWARD_EXCLUSIONS[@]}"; do
    [ -n "${INTENTIONAL_FORWARD_EXCLUSIONS[$file]}" ] ||
      fail "intentional exclusion lacks a documented reason: $file"
    [ -f "$migration_dir/$file" ] ||
      fail "intentional exclusion no longer exists: $file"
    [ -z "${registered_names[$file]:-}" ] ||
      fail "migration is both production-registered and intentionally excluded: $file"
  done

  for file in "${forward_files[@]}"; do
    if [ -z "${registered_names[$file]:-}" ] &&
       [ -z "${INTENTIONAL_FORWARD_EXCLUSIONS[$file]:-}" ]; then
      echo "ERROR: forward migration is neither production-registered nor intentionally excluded: $file" >&2
      return 1
    fi
  done

  mapfile -t baseline_numbers < <(
    awk '
      /FROM unnest\(ARRAY\[/ { capture = 1; next }
      capture && /\]\) AS n/ { exit }
      capture { print }
    ' "$manifest" | grep -oE "'[0-9]{4}'" | tr -d "'"
  )
  [ "${#registered[@]}" -eq "${#baseline_numbers[@]}" ] || {
    echo "ERROR: production registration and baseline ledger count mismatch" >&2
    return 1
  }
  for index in "${!registered[@]}"; do
    [ "${registered[$index]:0:4}" = "${baseline_numbers[$index]}" ] || {
      echo "ERROR: production registration and baseline ledger numbers differ" >&2
      return 1
    }
  done
  MANIFEST_COMPLETENESS_CHECKED=1
}

current="$(list_production_migrations "$ROOT/infra/db/init.prod.sql" "$ROOT/db/migrations")"
assert_not_contains "$current" "0008_seed_dev_master_data.sql"
assert_not_contains "$current" "0046_seed_dev_users_units.sql"
assert_not_contains "$current" "0047_seed_minimal_dev_login.sql"
assert_not_contains "$current" "dev_login"
validate_supported_manifest_include_syntax "$ROOT/infra/db/init.prod.sql"
assert_manifest_completeness "$ROOT/infra/db/init.prod.sql" "$ROOT/db/migrations"
[ "$MANIFEST_COMPLETENESS_CHECKED" -eq 1 ] ||
  fail "production manifest completeness assertion did not run"
[ "$(printf '%s\n' "$current" | wc -l | tr -d ' ')" -eq 59 ] ||
  fail "expected 59 production-registered migrations"

TMP="$(mktemp -d)"
trap 'rm -rf -- "$TMP"' EXIT
mkdir -p "$TMP/bin" "$TMP/migrations" "$TMP/runner/lib"
cp "$ROOT/scripts/apply-migrations.sh" "$TMP/runner/apply-migrations.sh"
cp "$ROOT/scripts/lib/production-migrations.sh" "$TMP/runner/lib/production-migrations.sh"

mkdir -p "$TMP/completeness-migrations"
cp -a "$ROOT/db/migrations/." "$TMP/completeness-migrations/"
cat > "$TMP/completeness-migrations/9999_unregistered_forward.sql" <<'SQL'
SELECT 'must be registered or explicitly excluded';
SQL
expect_failure \
  "unregistered ordinary forward migration" \
  "neither production-registered nor intentionally excluded: 9999_unregistered_forward.sql" \
  assert_manifest_completeness \
  "$ROOT/infra/db/init.prod.sql" \
  "$TMP/completeness-migrations"
rm "$TMP/completeness-migrations/9999_unregistered_forward.sql"
cat > "$TMP/completeness-migrations/9998_seed_dev_future.sql" <<'SQL'
SELECT 'still requires an explicit exclusion decision';
SQL
expect_failure \
  "unregistered development seed" \
  "neither production-registered nor intentionally excluded: 9998_seed_dev_future.sql" \
  assert_manifest_completeness \
  "$ROOT/infra/db/init.prod.sql" \
  "$TMP/completeness-migrations"

cat > "$TMP/unsupported-include.sql" <<'SQL'
\ir /docker-entrypoint-initdb.d/migrations/0097_legitimate_first.sql
SQL
expect_failure \
  "unsupported recursive include" \
  "unsupported production migration include syntax" \
  validate_supported_manifest_include_syntax \
  "$TMP/unsupported-include.sql"
cat > "$TMP/unsupported-include.sql" <<'SQL'
\include /docker-entrypoint-initdb.d/migrations/0097_legitimate_first.sql
SQL
expect_failure \
  "unsupported long include" \
  "unsupported production migration include syntax" \
  validate_supported_manifest_include_syntax \
  "$TMP/unsupported-include.sql"

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
echo "$joined" >> "$DB_CALLS_FILE"
if [[ "$joined" == *"CREATE TABLE IF NOT EXISTS schema_migrations"* ]]; then
  [ -e "$LEDGER_FILE" ] || : > "$LEDGER_FILE"
  exit 0
fi
if [[ "$joined" == *"SELECT count(*) FROM schema_migrations"* ]]; then
  wc -l < "$LEDGER_FILE" | tr -d ' '
  exit 0
fi
if [[ "$joined" == *"SELECT 1 FROM schema_migrations WHERE migration_number="* ]]; then
  # Reproduce the real stdin-starvation hazard: docker/psql may consume the
  # discovery loop's stdin even when the query itself does not need SQL input.
  cat >/dev/null
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
: > "$TMP/db-calls"
export PATH="$TMP/bin:$PATH"
export LEDGER_FILE="$TMP/ledger"
export EXECUTED_SQL_FILE="$TMP/executed.sql"
export BACKUP_CALLS_FILE="$TMP/backups"
export DB_CALLS_FILE="$TMP/db-calls"

run_runner() {
  local manifest="${2:-$TMP/production.sql}"
  local migration_dir="${3:-$TMP/migrations}"
  ENV_FILE="$TMP/test.env" \
  COMPOSE_FILE="$TMP/compose.yml" \
  APP_DIR="$ROOT" \
  MIG_DIR="$migration_dir" \
  PRODUCTION_MANIFEST="$manifest" \
  APPROVE_DESTRUCTIVE="${1:-0}" \
  "$TMP/runner/apply-migrations.sh" </dev/null
}

expect_runner_manifest_failure() {
  local description="$1"
  local expected="$2"
  local manifest="$3"
  local migration_dir="$4"
  local output
  local status

  : > "$TMP/db-calls"
  : > "$TMP/backups"
  set +e
  output="$(run_runner 0 "$manifest" "$migration_dir" 2>&1)"
  status=$?
  set -e
  [ "$status" -ne 0 ] || fail "$description unexpectedly succeeded"
  assert_contains "$output" "$expected"
  [ ! -s "$TMP/db-calls" ] ||
    fail "$description executed a database command before manifest validation"
  [ ! -s "$TMP/backups" ] ||
    fail "$description executed a backup before manifest validation"
}

mkdir -p "$TMP/invalid/migrations"
for file in \
  0097_alpha.sql \
  0097_beta.sql \
  0098_middle.sql \
  0099_last.sql \
  0097_bad_rollback.sql \
  0097_bad_verify.sql \
  0097_bad_test.sql; do
  printf "SELECT '%s';\n" "$file" > "$TMP/invalid/migrations/$file"
done

cat > "$TMP/invalid/duplicate.sql" <<'SQL'
\i /docker-entrypoint-initdb.d/migrations/0097_alpha.sql
\i /docker-entrypoint-initdb.d/migrations/0097_beta.sql
SQL
expect_runner_manifest_failure \
  "duplicate production number" \
  "duplicate production migration number: 0097" \
  "$TMP/invalid/duplicate.sql" \
  "$TMP/invalid/migrations"

cat > "$TMP/invalid/out-of-order.sql" <<'SQL'
\i /docker-entrypoint-initdb.d/migrations/0099_last.sql
\i /docker-entrypoint-initdb.d/migrations/0098_middle.sql
SQL
expect_runner_manifest_failure \
  "out-of-order production number" \
  "production migrations are not strictly ordered" \
  "$TMP/invalid/out-of-order.sql" \
  "$TMP/invalid/migrations"

cat > "$TMP/invalid/missing-file.sql" <<'SQL'
\i /docker-entrypoint-initdb.d/migrations/0097_missing.sql
SQL
expect_runner_manifest_failure \
  "missing production file" \
  "production migration is missing: 0097_missing.sql" \
  "$TMP/invalid/missing-file.sql" \
  "$TMP/invalid/migrations"

for suffix in rollback verify test; do
  cat > "$TMP/invalid/bad-suffix.sql" <<SQL
\\i /docker-entrypoint-initdb.d/migrations/0097_bad_${suffix}.sql
SQL
  expect_runner_manifest_failure \
    "${suffix} forward declaration" \
    "invalid production migration entry: 0097_bad_${suffix}.sql" \
    "$TMP/invalid/bad-suffix.sql" \
    "$TMP/invalid/migrations"
done

cat > "$TMP/invalid/count-mismatch.sql" <<'SQL'
\i /docker-entrypoint-initdb.d/migrations/0097_alpha.sql
\i /docker-entrypoint-initdb.d/migrations/not-a-forward-migration.sql
SQL
expect_runner_manifest_failure \
  "manifest include count mismatch" \
  "unsupported migration include directive" \
  "$TMP/invalid/count-mismatch.sql" \
  "$TMP/invalid/migrations"

: > "$TMP/invalid/empty.sql"
expect_runner_manifest_failure \
  "empty production manifest" \
  "contains no migration include directives" \
  "$TMP/invalid/empty.sql" \
  "$TMP/invalid/migrations"
expect_runner_manifest_failure \
  "missing production manifest" \
  "production migration manifest not found" \
  "$TMP/invalid/does-not-exist.sql" \
  "$TMP/invalid/migrations"

rm -f "$TMP/ledger"
set +e
missing_ledger_output="$(run_runner 2>&1)"
missing_ledger_status=$?
set -e
[ "$missing_ledger_status" -ne 0 ] || fail "missing ledger was not rejected"
assert_contains "$missing_ledger_output" "schema_migrations is empty"
[ ! -s "$TMP/backups" ] || fail "missing ledger triggered a backup"

: > "$TMP/ledger"
set +e
empty_ledger_output="$(run_runner 2>&1)"
empty_ledger_status=$?
set -e
[ "$empty_ledger_status" -ne 0 ] || fail "empty ledger was not rejected"
assert_contains "$empty_ledger_output" "schema_migrations is empty"
[ ! -s "$TMP/backups" ] || fail "empty ledger triggered a backup"

printf '0001\n0097\n' > "$TMP/ledger"
: > "$TMP/db-calls"
first_run="$(run_runner)"
assert_contains "$first_run" "Pending: 0099_legitimate_second.sql"
assert_contains "$(cat "$TMP/executed.sql")" "legitimate-second"
assert_contains "$(cat "$TMP/executed.sql")" "legitimate-second-verified"
assert_not_contains "$(cat "$TMP/executed.sql")" "legitimate-first"
assert_not_contains "$(cat "$TMP/executed.sql")" "development-only"
[ "$(grep -cx 0099 "$TMP/ledger")" -eq 1 ] || fail "legitimate migration was not recorded once"
[ "$(grep -c "SELECT 1 FROM schema_migrations WHERE migration_number=" "$TMP/db-calls")" -eq 2 ] ||
  fail "runner did not inspect every materialized migration candidate"
assert_contains "$(cat "$TMP/db-calls")" "'0097'"
assert_contains "$(cat "$TMP/db-calls")" "'0099'"

before_second="$(sha256sum "$TMP/executed.sql" | cut -d' ' -f1)"
second_run="$(run_runner)"
after_second="$(sha256sum "$TMP/executed.sql" | cut -d' ' -f1)"
assert_contains "$second_run" "Up to date"
[ "$before_second" = "$after_second" ] || fail "second invocation re-executed a migration"

printf '0001\n' > "$TMP/ledger"
: > "$TMP/executed.sql"
: > "$TMP/db-calls"
multiple_run="$(run_runner)"
assert_contains "$multiple_run" "Pending: 0097_legitimate_first.sql 0099_legitimate_second.sql"
[ "$(grep -cx 0097 "$TMP/ledger")" -eq 1 ] || fail "first pending migration was not recorded"
[ "$(grep -cx 0099 "$TMP/ledger")" -eq 1 ] || fail "second pending migration was not recorded"
first_line="$(grep -n "legitimate-first" "$TMP/executed.sql" | head -1 | cut -d: -f1)"
second_line="$(grep -n "legitimate-second';" "$TMP/executed.sql" | head -1 | cut -d: -f1)"
[ "$first_line" -lt "$second_line" ] || fail "multiple pending migrations ran out of order"

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
