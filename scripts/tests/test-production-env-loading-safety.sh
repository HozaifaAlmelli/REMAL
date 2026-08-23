#!/usr/bin/env bash
# ============================================================================
# Reproduces the production defect that blocked the rollout — release scripts
# that `source` .env.production die on values containing whitespace — and pins
# the fixed behaviour: preflight, no host-side sourcing, fail-closed ordering
# and non-destructive retention.
#
# No real credential appears anywhere in this file. The whitespace values below
# are synthetic and exist only to reproduce the parse failure.
# ============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# shellcheck source=scripts/lib/env-file.sh
source "$ROOT/scripts/lib/env-file.sh"
# shellcheck source=scripts/lib/postgres-backup.sh
source "$ROOT/scripts/lib/postgres-backup.sh"

# The stubbed docker binaries below answer the compose-agreement probe from these
# literals — the values this suite's fixture declares — so the oracle is
# independent of the parser under test.
export KAZA_PROBE_STUB_LIB="$ROOT/scripts/tests/lib/compose-probe-stub.sh"
export KAZA_PROBE_POSTGRES_USER="kaza test user"
export KAZA_PROBE_POSTGRES_DB="kaza_whitespace_test"

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

assert_contains() {
  case "$1" in
    *"$2"*) ;;
    *) fail "expected output to contain: $2" ;;
  esac
}

assert_not_contains() {
  case "$1" in
    *"$2"*) fail "expected output NOT to contain: $2" ;;
    *) ;;
  esac
}

expect_failure() {
  local description="$1"
  shift
  local output
  local status

  set +e
  output="$("$@" 2>&1)"
  status=$?
  set -e
  [ "$status" -ne 0 ] || fail "$description unexpectedly succeeded"
  printf '%s\n' "$output"
}

TMP="$(mktemp -d)"
trap 'rm -rf -- "$TMP"' EXIT

# --------------------------------------------------------------------------
# The env file shape that broke production: unquoted values containing spaces.
# --------------------------------------------------------------------------
cat > "$TMP/whitespace.env" <<'ENV'
# KAZA production-shaped environment file (synthetic values only).
POSTGRES_DB=kaza_whitespace_test
POSTGRES_USER=kaza test user
POSTGRES_PASSWORD=first second third
CERTBOT_EMAIL=ops team@example.test
  export API_DOMAIN=api example test
QUOTED_DOUBLE="quoted value"
QUOTED_SINGLE='another value'
HOSTILE=a $(rm -rf /) `whoami` ; echo pwned
# The real production file carries trailing inline comments on unquoted values.
# Compose strips them; so must we, or the wrong identifier reaches psql.
COMMENTED_USER=kaza_prod   # the application role used by the API
COMMENTED_QUOTED="value with  spaces"   # and a trailing comment
HASH_INSIDE=abc#def
ESCAPES="line1\nline2"
# Repeated assignments. Compose keeps the LAST one; so must we, or the backup and
# the migration would use a stale identifier the containers were never created with.
DUP_UNQUOTED=stale value
DUP_UNQUOTED=winning value
DUP_QUOTED="stale quoted"
DUP_QUOTED="winning quoted"   # with a trailing comment
DUP_MIXED=stale
  export DUP_MIXED="winning mixed"

#POSTGRES_COMMENTED=should not count
ENV

# --------------------------------------------------------------------------
# 1. The original defect, reproduced. `source` is shell evaluation: the second
#    word of an unquoted value is run as a command and the shell exits 127.
# --------------------------------------------------------------------------
set +e
source_output="$(bash -c 'set -euo pipefail; set -a; . "$1"; set +a' _ "$TMP/whitespace.env" 2>&1)"
source_status=$?
set -e
[ "$source_status" -ne 0 ] ||
  fail "sourcing an unquoted-whitespace env file unexpectedly succeeded — the defect is not reproduced"
assert_contains "$source_output" "command not found"
echo "reproduced: 'source' of the production-shaped env file exits ${source_status}"

# --------------------------------------------------------------------------
# 2. The shipped scripts no longer source the env file at all.
# --------------------------------------------------------------------------
for script in backup-postgres.sh apply-migrations.sh; do
  if grep -Eq '(^|[^#])(source|\.)[[:space:]]+"\$ENV_FILE"' "$ROOT/scripts/$script"; then
    fail "$script still shell-sources the environment file"
  fi
done
echo "confirmed: neither release script shell-sources the environment file"

# --------------------------------------------------------------------------
# 3. Key presence detection reads no values and honours dotenv line shapes.
# --------------------------------------------------------------------------
for key in POSTGRES_DB POSTGRES_USER POSTGRES_PASSWORD CERTBOT_EMAIL API_DOMAIN; do
  env_file_has_key "$TMP/whitespace.env" "$key" || fail "key $key was not detected"
done
! env_file_has_key "$TMP/whitespace.env" POSTGRES_COMMENTED ||
  fail "a commented-out assignment was counted as present"
! env_file_has_key "$TMP/whitespace.env" POSTGRES_ABSENT ||
  fail "an absent key was reported as present"

# Values are parsed, never evaluated: whitespace survives, one layer of matching
# quotes is stripped, and shell metacharacters are returned verbatim and inert.
[ "$(env_file_value "$TMP/whitespace.env" POSTGRES_USER)" = "kaza test user" ] ||
  fail "an unquoted whitespace value was not parsed verbatim"
[ "$(env_file_value "$TMP/whitespace.env" QUOTED_DOUBLE)" = "quoted value" ] ||
  fail "surrounding double quotes were not stripped"
[ "$(env_file_value "$TMP/whitespace.env" QUOTED_SINGLE)" = "another value" ] ||
  fail "surrounding single quotes were not stripped"
[ "$(env_file_value "$TMP/whitespace.env" HOSTILE)" = 'a $(rm -rf /) `whoami` ; echo pwned' ] ||
  fail "a value containing shell metacharacters was not returned verbatim"

# Inline comments: this is the exact production shape that made an earlier
# implementation hand psql a 69-character "username".
[ "$(env_file_value "$TMP/whitespace.env" COMMENTED_USER)" = "kaza_prod" ] ||
  fail "a trailing inline comment was not stripped from an unquoted value"
[ "$(env_file_value "$TMP/whitespace.env" COMMENTED_QUOTED)" = "value with  spaces" ] ||
  fail "a trailing inline comment after a quoted value was not discarded"
[ "$(env_file_value "$TMP/whitespace.env" HASH_INSIDE)" = "abc#def" ] ||
  fail "a # not preceded by whitespace was wrongly treated as a comment"
[ "$(env_file_value "$TMP/whitespace.env" ESCAPES)" = "$(printf 'line1\nline2')" ] ||
  fail "double-quoted escape sequences were not decoded the way Compose decodes them"
[ -z "$(env_file_value "$TMP/whitespace.env" POSTGRES_COMMENTED)" ] ||
  fail "a commented-out assignment produced a value"

# Duplicate keys: the LAST assignment wins, exactly as docker compose resolves it.
# Reading the first would silently disagree with the running containers.
[ "$(env_file_value "$TMP/whitespace.env" DUP_UNQUOTED)" = "winning value" ] ||
  fail "a repeated unquoted key did not resolve to its last assignment"
[ "$(env_file_value "$TMP/whitespace.env" DUP_QUOTED)" = "winning quoted" ] ||
  fail "a repeated quoted key did not resolve to its last assignment"
[ "$(env_file_value "$TMP/whitespace.env" DUP_MIXED)" = "winning mixed" ] ||
  fail "a repeated key whose last assignment is exported did not resolve to it"
echo "confirmed: a repeated key resolves to its last assignment, as compose does"

# The loader exposes only the two non-secret connection identifiers.
( load_db_connection_identifiers "$TMP/whitespace.env"
  [ "$POSTGRES_USER" = "kaza test user" ] || exit 1
  [ "$POSTGRES_DB" = "kaza_whitespace_test" ] || exit 1
  [ -z "${POSTGRES_PASSWORD:-}" ] || exit 1 ) ||
  fail "load_db_connection_identifiers did not load exactly the two non-secret identifiers"

# --------------------------------------------------------------------------
# 4. The preflight accepts the production-shaped file and never echoes a value.
# --------------------------------------------------------------------------
preflight_output="$(env_file_preflight "$TMP/whitespace.env" POSTGRES_USER POSTGRES_DB POSTGRES_PASSWORD)"
assert_contains "$preflight_output" "env preflight OK"
for secret in "first second third" "kaza test user" "ops team@example.test"; do
  assert_not_contains "$preflight_output" "$secret"
done

# --------------------------------------------------------------------------
# 5. The preflight fails closed on every unusable env file.
# --------------------------------------------------------------------------
expect_failure "missing env file" env_file_preflight "$TMP/absent.env" POSTGRES_USER |
  grep -q "does not exist" || fail "missing env file produced the wrong refusal"
: > "$TMP/empty.env"
expect_failure "empty env file" env_file_preflight "$TMP/empty.env" POSTGRES_USER |
  grep -q "is empty" || fail "empty env file produced the wrong refusal"
mkdir -p "$TMP/dir.env"
expect_failure "directory env file" env_file_preflight "$TMP/dir.env" POSTGRES_USER >/dev/null
expect_failure "missing required key" \
  env_file_preflight "$TMP/whitespace.env" POSTGRES_USER POSTGRES_NOT_THERE |
  grep -q "missing a required key: POSTGRES_NOT_THERE" ||
  fail "a missing required key produced the wrong refusal"

# --------------------------------------------------------------------------
# 6. Compose agreement. The identifiers the release scripts use must be exactly
#    what docker compose resolves from the same file. This is what protects the
#    rollout from dotenv behaviour this reader deliberately does not model —
#    interpolation, `$$`, a future Compose parser change — without
#    reimplementing Compose's semantics here. Runs against the real docker.
# --------------------------------------------------------------------------
command -v docker >/dev/null 2>&1 ||
  fail "docker is required: the compose agreement preflight is the subject of this section"

cat > "$TMP/agree-ok.env" <<'ENV'
POSTGRES_DB=kaza_agreement_test
POSTGRES_USER=kaza_prod   # the application role used by the API
POSTGRES_PASSWORD=first second third
ENV

# A repeated assignment must still AGREE, because both sides take the last one.
cat > "$TMP/agree-duplicate.env" <<'ENV'
POSTGRES_DB=kaza_agreement_test
POSTGRES_USER=stale_role
POSTGRES_PASSWORD=first second third
POSTGRES_USER=kaza_prod
ENV

# Interpolation is Compose behaviour this reader does not model. The preflight
# must catch the disagreement and refuse rather than guess.
cat > "$TMP/agree-interpolated.env" <<'ENV'
POSTGRES_DB=kaza_agreement_test
ROLE_PREFIX=kaza
POSTGRES_USER=${ROLE_PREFIX}_prod
POSTGRES_PASSWORD=first second third
ENV

for shape in ok duplicate; do
  agreement_output="$(compose_identifier_agreement_preflight \
    "$TMP/agree-$shape.env" POSTGRES_USER POSTGRES_DB)" ||
    fail "the compose agreement preflight refused a file it should accept ($shape)"
  assert_contains "$agreement_output" "compose agreement OK"
  for secret in kaza_prod stale_role kaza_agreement_test "first second third"; do
    assert_not_contains "$agreement_output" "$secret"
  done
done

[ "$(env_file_value "$TMP/agree-duplicate.env" POSTGRES_USER)" = "kaza_prod" ] ||
  fail "the duplicate-key fixture did not resolve to its last assignment"

mismatch_output="$(expect_failure "an interpolated identifier" \
  compose_identifier_agreement_preflight "$TMP/agree-interpolated.env" POSTGRES_USER POSTGRES_DB)"
assert_contains "$mismatch_output" "does not match the value docker compose resolves"
assert_contains "$mismatch_output" "POSTGRES_USER"
for secret in kaza_prod '${ROLE_PREFIX}' "first second third"; do
  assert_not_contains "$mismatch_output" "$secret"
done
echo "confirmed: parsed identifiers are proven equal to docker compose's own resolution"

# --------------------------------------------------------------------------
# 7. backup-postgres.sh runs end to end against the production-shaped env file.
# --------------------------------------------------------------------------
mkdir -p "$TMP/runner/lib" "$TMP/bin" "$TMP/backups"
cp "$ROOT/scripts/backup-postgres.sh" "$TMP/runner/backup-postgres.sh"
cp "$ROOT/scripts/lib/postgres-backup.sh" "$TMP/runner/lib/postgres-backup.sh"
cp "$ROOT/scripts/lib/env-file.sh" "$TMP/runner/lib/env-file.sh"
cat > "$TMP/bin/docker" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
joined="$*"
# shellcheck source=scripts/tests/lib/compose-probe-stub.sh
source "$KAZA_PROBE_STUB_LIB"
respond_to_compose_probe "$@"
if [[ "$joined" == *" config --quiet"* ]]; then
  exit "${COMPOSE_CONFIG_STATUS:-0}"
fi
# The secret must never reach a command line, and the whitespace-bearing user
# must arrive as ONE argument rather than being word-split.
for arg in "$@"; do
  if [[ "$arg" == *"first second third"* ]]; then
    echo "the database password reached a command line" >&2
    exit 90
  fi
done
seen_user=no
while [ "$#" -gt 0 ]; do
  if [ "$1" = "-U" ]; then
    [ "${2:-}" = "kaza test user" ] || { echo "POSTGRES_USER was word-split: ${2:-}" >&2; exit 91; }
    seen_user=yes
  fi
  shift
done
[ "$seen_user" = yes ] || { echo "pg_dump was invoked without -U" >&2; exit 92; }
cat <<'SQL'
--
-- PostgreSQL database dump
--
CREATE TABLE env_loading_test(id integer);
--
-- PostgreSQL database dump complete
--
SQL
SH
chmod +x "$TMP/runner/backup-postgres.sh" "$TMP/bin/docker"

run_backup() {
  PATH="$TMP/bin:$PATH" \
  ENV_FILE="$TMP/whitespace.env" \
  COMPOSE_FILE="$TMP/compose.yml" \
  BACKUP_DIR="$TMP/backups" \
  "$TMP/runner/backup-postgres.sh" "$@"
}

backup_output="$(RETENTION_DAYS=0 run_backup)"
assert_contains "$backup_output" "backup OK"
assert_contains "$backup_output" "retention pruning disabled"
for secret in "first second third" "kaza test user"; do
  assert_not_contains "$backup_output" "$secret"
done
mapfile -t produced < <(find "$TMP/backups" -maxdepth 1 -type f -name 'kaza_postgres_*.sql.gz')
[ "${#produced[@]}" -eq 1 ] || fail "the backup did not publish exactly one artifact"
validate_postgres_backup_artifact "${produced[0]}"
echo "confirmed: backup-postgres.sh succeeds against the env file that used to break it"

# The backup still refuses an unreadable env file, before it dumps anything.
rm -f "${produced[0]}"
expect_failure "backup with a missing env file" \
  env ENV_FILE="$TMP/absent.env" PATH="$TMP/bin:$PATH" COMPOSE_FILE="$TMP/compose.yml" \
  BACKUP_DIR="$TMP/backups" "$TMP/runner/backup-postgres.sh" >/dev/null
[ -z "$(find "$TMP/backups" -maxdepth 1 -type f -print -quit)" ] ||
  fail "a backup artifact was produced despite an unusable env file"

# --------------------------------------------------------------------------
# 8. Retention never deletes silently and never drops below the retained floor.
# --------------------------------------------------------------------------
mkdir -p "$TMP/retention"
for age in 400 300 200 100 1; do
  artifact="$TMP/retention/kaza_postgres_age_${age}.sql.gz"
  printf 'x' | gzip -c > "$artifact"
  touch -d "${age} days ago" "$artifact"
done

disabled="$(prune_postgres_backup_artifacts "$TMP/retention" 0 3)"
assert_contains "$disabled" "retention pruning disabled"
[ "$(find "$TMP/retention" -maxdepth 1 -type f | wc -l)" -eq 5 ] ||
  fail "RETENTION_DAYS=0 removed an artifact"

floor="$(prune_postgres_backup_artifacts "$TMP/retention" 14 5)"
assert_contains "$floor" "minimum retained is 5"
[ "$(find "$TMP/retention" -maxdepth 1 -type f | wc -l)" -eq 5 ] ||
  fail "the retained floor did not protect every artifact"

pruned="$(prune_postgres_backup_artifacts "$TMP/retention" 14 3)"
assert_contains "$pruned" "removing $TMP/retention/kaza_postgres_age_400.sql.gz"
assert_contains "$pruned" "removing $TMP/retention/kaza_postgres_age_300.sql.gz"
[ ! -e "$TMP/retention/kaza_postgres_age_400.sql.gz" ] || fail "an expired artifact survived"
[ -e "$TMP/retention/kaza_postgres_age_1.sql.gz" ] || fail "the newest artifact was pruned"
[ -e "$TMP/retention/kaza_postgres_age_200.sql.gz" ] ||
  fail "an artifact inside the retained floor was pruned"

# --------------------------------------------------------------------------
# 9. apply-migrations.sh: the env preflight runs before the lock, the backup
#    and any SQL, and an unusable env file stops the rollout with nothing done.
# --------------------------------------------------------------------------
mkdir -p "$TMP/mig/runner/lib" "$TMP/mig/migrations"
cp "$ROOT/scripts/apply-migrations.sh" "$TMP/mig/runner/apply-migrations.sh"
cp "$ROOT/scripts/lib/production-migrations.sh" "$TMP/mig/runner/lib/production-migrations.sh"
cp "$ROOT/scripts/lib/env-file.sh" "$TMP/mig/runner/lib/env-file.sh"
cp "$ROOT/scripts/lib/production-lock.sh" "$TMP/mig/runner/lib/production-lock.sh"
cat > "$TMP/mig/runner/backup-postgres.sh" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
echo backup >> "$BACKUP_CALLS_FILE"
SH
chmod +x "$TMP/mig/runner/apply-migrations.sh" "$TMP/mig/runner/backup-postgres.sh"

cat > "$TMP/mig/migrations/0096_baseline.sql" <<'SQL'
SELECT 'baseline';
SQL
cat > "$TMP/mig/production.sql" <<'SQL'
\i /docker-entrypoint-initdb.d/migrations/0096_baseline.sql
SQL
printf '%s  %s\n' \
  "$(sha256sum "$TMP/mig/migrations/0096_baseline.sql" | cut -d' ' -f1)" \
  '0096_baseline.sql' > "$TMP/mig/checksums.sha256"
printf '0096|0096_baseline.sql\n' > "$TMP/mig/ledger"
: > "$TMP/mig/backups"
: > "$TMP/mig/db-calls"
: > "$TMP/mig/executed.sql"

cat > "$TMP/bin/docker-mig" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
joined="$*"
# shellcheck source=scripts/tests/lib/compose-probe-stub.sh
source "$KAZA_PROBE_STUB_LIB"
respond_to_compose_probe "$@"
echo "$joined" >> "$DB_CALLS_FILE"
if [[ "$joined" == *" config --quiet"* ]]; then
  exit "${COMPOSE_CONFIG_STATUS:-0}"
fi
for arg in "$@"; do
  if [[ "$arg" == *"first second third"* ]]; then
    echo "the database password reached a command line" >&2
    exit 90
  fi
done
if [[ "$joined" == *" -qAt "* ]]; then
  while IFS= read -r sql; do
    if [[ "$sql" == *"pg_try_advisory_lock"* ]]; then echo LOCKED
    elif [[ "$sql" == *"SELECT 'LOCK_HELD'"* ]]; then echo LOCK_HELD
    elif [ "$sql" = '\q' ]; then exit 0
    fi
  done
  exit 0
fi
if [[ "$joined" == *"to_regclass('public.schema_migrations')"* ]]; then echo t; exit 0; fi
if [[ "$joined" == *"information_schema.columns"* ]]; then echo 4; exit 0; fi
if [[ "$joined" == *"FROM schema_migrations"* ]]; then cat "$LEDGER_FILE"; exit 0; fi
cat >> "$EXECUTED_SQL_FILE"
SH
mkdir -p "$TMP/migbin"
cp "$TMP/bin/docker-mig" "$TMP/migbin/docker"
chmod +x "$TMP/migbin/docker"

run_migrations() {
  env PATH="$TMP/migbin:$PATH" \
    ENV_FILE="${MIG_ENV_FILE:-$TMP/whitespace.env}" \
    COMPOSE_FILE="$TMP/mig/compose.yml" \
    APP_DIR="$TMP/mig" \
    MIG_DIR="$TMP/mig/migrations" \
    PRODUCTION_MANIFEST="$TMP/mig/production.sql" \
    MIGRATION_CHECKSUMS="$TMP/mig/checksums.sha256" \
    LEDGER_FILE="$TMP/mig/ledger" \
    EXECUTED_SQL_FILE="$TMP/mig/executed.sql" \
    BACKUP_CALLS_FILE="$TMP/mig/backups" \
    DB_CALLS_FILE="$TMP/mig/db-calls" \
    PRODUCTION_LOCK_FILE="$TMP/mig/production-operation.lock" \
    COMPOSE_CONFIG_STATUS="${COMPOSE_CONFIG_STATUS:-0}" \
    bash "$TMP/mig/runner/apply-migrations.sh"
}

up_to_date="$(run_migrations)"
assert_contains "$up_to_date" "env preflight OK"
assert_contains "$up_to_date" "compose preflight OK"
assert_contains "$up_to_date" "Up to date"
for secret in "first second third" "kaza test user"; do
  assert_not_contains "$up_to_date" "$secret"
done
echo "confirmed: apply-migrations.sh runs against the env file that used to break it"

: > "$TMP/mig/backups"
: > "$TMP/mig/db-calls"
set +e
MIG_ENV_FILE="$TMP/absent.env" run_migrations > "$TMP/mig/missing.log" 2>&1
missing_status=$?
set -e
[ "$missing_status" -ne 0 ] || fail "a missing env file did not stop the migration runner"
assert_contains "$(cat "$TMP/mig/missing.log")" "environment file does not exist"
[ ! -s "$TMP/mig/backups" ] || fail "a backup was taken despite an unusable env file"
[ ! -s "$TMP/mig/db-calls" ] || fail "a database command ran despite an unusable env file"

: > "$TMP/mig/backups"
: > "$TMP/mig/db-calls"
set +e
COMPOSE_CONFIG_STATUS=1 run_migrations > "$TMP/mig/unparseable.log" 2>&1
unparseable_status=$?
set -e
[ "$unparseable_status" -ne 0 ] || fail "an unparseable deployment configuration did not stop the runner"
assert_contains "$(cat "$TMP/mig/unparseable.log")" "docker compose cannot parse"
[ ! -s "$TMP/mig/backups" ] || fail "a backup was taken despite an unparseable configuration"
assert_not_contains "$(cat "$TMP/mig/db-calls")" "to_regclass"

echo "PASS: production env loading is source-free, fail-closed, and non-destructive"
