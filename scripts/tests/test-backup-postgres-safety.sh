#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# shellcheck source=scripts/lib/postgres-backup.sh
source "$ROOT/scripts/lib/postgres-backup.sh"

fail() {
  echo "FAIL: $*" >&2
  exit 1
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

cat > "$TMP/valid.sql" <<'SQL'
--
-- PostgreSQL database dump
--

CREATE TABLE release_hardening_test(id integer);

--
-- PostgreSQL database dump complete
--
SQL
gzip -c "$TMP/valid.sql" > "$TMP/valid.sql.gz"
validate_postgres_backup_artifact "$TMP/valid.sql.gz"

expect_failure "missing artifact" validate_postgres_backup_artifact "$TMP/missing.sql.gz" >/dev/null
: > "$TMP/empty.sql.gz"
expect_failure "empty artifact" validate_postgres_backup_artifact "$TMP/empty.sql.gz" >/dev/null
printf 'not-gzip' > "$TMP/corrupt.sql.gz"
expect_failure "corrupt artifact" validate_postgres_backup_artifact "$TMP/corrupt.sql.gz" >/dev/null
printf 'valid gzip, wrong payload\n' | gzip -c > "$TMP/not-a-dump.sql.gz"
expect_failure "invalid dump metadata" validate_postgres_backup_artifact "$TMP/not-a-dump.sql.gz" >/dev/null

cp "$TMP/valid.sql.gz" "$TMP/collision.partial"
printf 'existing-artifact' > "$TMP/collision.sql.gz"
expect_failure \
  "backup publication collision" \
  publish_postgres_backup_artifact \
  "$TMP/collision.partial" \
  "$TMP/collision.sql.gz" >/dev/null
[ "$(cat "$TMP/collision.sql.gz")" = "existing-artifact" ] ||
  fail "collision attempt overwrote the existing artifact"

mkdir -p "$TMP/runner/lib" "$TMP/bin" "$TMP/backups"
cp "$ROOT/scripts/backup-postgres.sh" "$TMP/runner/backup-postgres.sh"
cp "$ROOT/scripts/lib/postgres-backup.sh" "$TMP/runner/lib/postgres-backup.sh"
cp "$ROOT/scripts/lib/env-file.sh" "$TMP/runner/lib/env-file.sh"
cat > "$TMP/test.env" <<'ENV'
POSTGRES_DB=kaza_test_backup
POSTGRES_USER=postgres
POSTGRES_PASSWORD=test-only
ENV
cat > "$TMP/bin/docker" <<'SH'
#!/usr/bin/env bash
set -euo pipefail

case "${BACKUP_TEST_MODE:-success}" in
  success)
    cat <<'SQL'
--
-- PostgreSQL database dump
--
CREATE TABLE backup_test(id integer);
--
-- PostgreSQL database dump complete
--
SQL
    ;;
  command-failure)
    printf '%s\n' '-- PostgreSQL database dump'
    exit 23
    ;;
  empty-output)
    exit 0
    ;;
  invalid-output)
    printf '%s\n' 'not a PostgreSQL dump'
    ;;
  *)
    exit 99
    ;;
esac
SH
chmod +x "$TMP/runner/backup-postgres.sh" "$TMP/bin/docker"

run_backup() {
  PATH="$TMP/bin:$PATH" \
  ENV_FILE="$TMP/test.env" \
  COMPOSE_FILE="$TMP/compose.yml" \
  BACKUP_DIR="$1" \
  BACKUP_TEST_MODE="${2:-success}" \
  "$TMP/runner/backup-postgres.sh"
}

run_backup "$TMP/backups" success >/dev/null &
first_pid=$!
run_backup "$TMP/backups" success >/dev/null &
second_pid=$!
wait "$first_pid"
wait "$second_pid"
mapfile -t backups < <(find "$TMP/backups" -maxdepth 1 -type f -name 'kaza_postgres_*.sql.gz' | sort)
[ "${#backups[@]}" -eq 2 ] || fail "concurrent backups did not publish two artifacts"
[ "${backups[0]}" != "${backups[1]}" ] || fail "concurrent backups selected the same filename"
validate_postgres_backup_artifact "${backups[0]}"
validate_postgres_backup_artifact "${backups[1]}"

for mode in command-failure empty-output invalid-output; do
  failure_dir="$TMP/failure-$mode"
  mkdir -p "$failure_dir"
  expect_failure "$mode backup" run_backup "$failure_dir" "$mode" >/dev/null
  [ -z "$(find "$failure_dir" -maxdepth 1 -type f -print -quit)" ] ||
    fail "$mode backup left a partial or accepted artifact"
done

touch "$TMP/not-a-directory"
expect_failure \
  "inaccessible backup destination" \
  run_backup \
  "$TMP/not-a-directory/child" \
  success >/dev/null

echo "PASS: PostgreSQL backup artifacts are unique, validated, and fail closed"
