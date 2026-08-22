#!/usr/bin/env bash
# ============================================================================
# Deployment safety guards — scripts/release-state.sh and the invariants the
# deploy path depends on.
#
# The failure this suite exists for: on 2026-08-17 a merge to main auto-queued
# a production deploy of code requiring migration 0064 against a database at
# 0057. The deploy path runs no migrations, so it would have served code
# reading tables that did not exist. Only an SSH timeout prevented it.
# ============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

fail() { echo "FAIL: $*" >&2; exit 1; }

expect_failure() {
  local description="$1"; shift
  local output status
  set +e
  output="$("$@" 2>&1)"
  status=$?
  set -e
  [ "$status" -ne 0 ] || fail "$description unexpectedly succeeded"
  printf '%s\n' "$output"
}

TMP="$(mktemp -d)"
trap 'rm -rf -- "$TMP"' EXIT

mkdir -p "$TMP/bin" "$TMP/migrations" "$TMP/releases"

cat > "$TMP/test.env" <<'ENV'
POSTGRES_DB=kaza_guard_test
POSTGRES_USER=postgres
POSTGRES_PASSWORD=test-only
ENV

export KAZA_PROBE_STUB_LIB="$ROOT/scripts/tests/lib/compose-probe-stub.sh"
export KAZA_PROBE_POSTGRES_USER="postgres"
export KAZA_PROBE_POSTGRES_DB="kaza_guard_test"

# A docker stub that answers the compose-agreement probe and returns a
# configurable ledger head for the psql call release-state.sh makes.
cat > "$TMP/bin/docker" <<'SH'
#!/usr/bin/env bash
set -euo pipefail

# shellcheck source=scripts/tests/lib/compose-probe-stub.sh
source "$KAZA_PROBE_STUB_LIB"
respond_to_compose_probe "$@"

for arg in "$@"; do
  if [ "$arg" = "config" ]; then exit 0; fi
done

# The ledger read: `... exec -T db psql ... -c 'SELECT ... FROM schema_migrations;'`
case "$*" in
  *schema_migrations*)
    if [ "${LEDGER_HEAD_FAILS:-0}" = "1" ]; then
      echo "connection refused" >&2
      exit 2
    fi
    printf '%s\n' "${LEDGER_HEAD-0057}"
    exit 0
    ;;
esac

echo "unexpected docker invocation: $*" >&2
exit 90
SH
chmod +x "$TMP/bin/docker"

run_state() {
  PATH="$TMP/bin:$PATH" \
  ENV_FILE="$TMP/test.env" \
  COMPOSE_FILE="$TMP/compose.yml" \
  MIG_DIR="$TMP/migrations" \
  DEPLOYMENT_LEDGER="$TMP/releases/deployments.jsonl" \
  bash "$ROOT/scripts/release-state.sh" "$@"
}

# ── tree-level ──────────────────────────────────────────────────────────────
for n in 0055 0056 0057; do
  : > "$TMP/migrations/${n}_thing.sql"
  : > "$TMP/migrations/${n}_thing_rollback.sql"
  : > "$TMP/migrations/${n}_thing_verify.sql"
done
[ "$(run_state tree-level)" = "0057" ] || fail "tree-level did not report the highest main migration"

# A rollback/verify file for a HIGHER number must not raise the level: those
# are not applied migrations and treating them as such would demand a schema
# the runner never produces.
: > "$TMP/migrations/0099_future_rollback.sql"
: > "$TMP/migrations/0099_future_verify.sql"
[ "$(run_state tree-level)" = "0057" ] ||
  fail "tree-level counted a rollback/verify file as an applied migration"
rm -f "$TMP/migrations/0099_future_rollback.sql" "$TMP/migrations/0099_future_verify.sql"

# ── schema-guard: the incident ──────────────────────────────────────────────
for n in 0058 0059 0060 0061 0062 0063 0064; do
  : > "$TMP/migrations/${n}_historical.sql"
done
[ "$(run_state tree-level)" = "0064" ] || fail "tree-level did not pick up the new migrations"

out="$(LEDGER_HEAD=0057 expect_failure "code ahead of schema" run_state schema-guard)"
grep -q "the live database is behind the code being deployed" <<<"$out" ||
  fail "schema-guard did not explain the code-ahead-of-schema refusal"
grep -q "database migration head : 0057" <<<"$out" ||
  fail "schema-guard did not report the live head"
grep -q "this tree requires      : 0064" <<<"$out" ||
  fail "schema-guard did not report the required level"

# ── schema-guard: the allowed cases ─────────────────────────────────────────
out="$(LEDGER_HEAD=0064 run_state schema-guard)"
grep -q "Schema compatibility OK" <<<"$out" || fail "schema-guard rejected an exact match"
grep -q "WARNING" <<<"$out" && fail "schema-guard warned on an exact match"

# Database ahead of code is the rollback case: allowed, but never silently.
out="$(LEDGER_HEAD=0070 run_state schema-guard)"
grep -q "Schema compatibility OK" <<<"$out" || fail "schema-guard blocked a rollback"
grep -q "database head (0070) is AHEAD of this tree (0064)" <<<"$out" ||
  fail "schema-guard did not warn that the database is ahead"

# ── schema-guard: fails closed ──────────────────────────────────────────────
out="$(LEDGER_HEAD="" expect_failure "empty ledger" run_state schema-guard)"
grep -q "schema_migrations is empty or unreadable" <<<"$out" ||
  fail "an empty ledger did not fail closed"

expect_failure "unreachable database" env LEDGER_HEAD_FAILS=1 \
  bash -c 'PATH="'"$TMP"'/bin:$PATH" ENV_FILE="'"$TMP"'/test.env" COMPOSE_FILE="'"$TMP"'/compose.yml" MIG_DIR="'"$TMP"'/migrations" bash "'"$ROOT"'/scripts/release-state.sh" schema-guard' >/dev/null

out="$(LEDGER_HEAD="57" expect_failure "malformed head" run_state schema-guard)"
grep -q "malformed migration level" <<<"$out" ||
  fail "a malformed ledger head was not rejected"

# A missing migration directory must refuse, not report level 0000 and let a
# deploy of an empty tree pass the guard.
expect_failure "missing migration dir" env MIG_DIR="$TMP/nope" \
  bash -c 'PATH="'"$TMP"'/bin:$PATH" ENV_FILE="'"$TMP"'/test.env" COMPOSE_FILE="'"$TMP"'/compose.yml" MIG_DIR="'"$TMP"'/nope" bash "'"$ROOT"'/scripts/release-state.sh" tree-level' >/dev/null

# ── deployment ledger: append-only ──────────────────────────────────────────
run_state record '{"sha":"aaa","result":"OK"}' >/dev/null
run_state record '{"sha":"bbb","result":"FAILED"}' >/dev/null
[ "$(wc -l < "$TMP/releases/deployments.jsonl")" -eq 2 ] ||
  fail "the deployment ledger did not append two records"
grep -q '"sha":"aaa"' "$TMP/releases/deployments.jsonl" ||
  fail "the first record was overwritten"

expect_failure "non-object record" run_state record 'not json' >/dev/null
expect_failure "multi-line record" run_state record '{"a":1}
{"b":2}' >/dev/null
[ "$(wc -l < "$TMP/releases/deployments.jsonl")" -eq 2 ] ||
  fail "a rejected record still reached the ledger"

# ── deploy-production.sh: the guard runs before anything is built ───────────
# The stub fails loudly on any build/up/restart. With an incompatible database
# the deploy must exit before reaching one.
mkdir -p "$TMP/deploy/bin"
cat > "$TMP/deploy/bin/docker" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
source "$KAZA_PROBE_STUB_LIB"
respond_to_compose_probe "$@"
case "$*" in
  *schema_migrations*) printf '%s\n' "${LEDGER_HEAD-0057}"; exit 0 ;;
  *build*|*" up "*|*restart*|*"image tag"*)
    echo "MUTATION ATTEMPTED: $*" >&2; exit 99 ;;
esac
exit 0
SH
chmod +x "$TMP/deploy/bin/docker"

out="$(
  PATH="$TMP/deploy/bin:$PATH" KAZA_PROBE_STUB_LIB="$KAZA_PROBE_STUB_LIB" \
  KAZA_PROBE_POSTGRES_USER=postgres KAZA_PROBE_POSTGRES_DB=kaza_guard_test \
  LEDGER_HEAD=0057 ENV_FILE="$TMP/test.env" MIG_DIR="$TMP/migrations" \
  bash "$ROOT/scripts/release-state.sh" schema-guard 2>&1 || true
)"
grep -q "MUTATION ATTEMPTED" <<<"$out" && fail "the guard itself mutated something"
grep -q "the live database is behind" <<<"$out" ||
  fail "the guard did not refuse an incompatible database"

# ── static invariants of the deploy path ────────────────────────────────────
WF="$ROOT/.github/workflows/deploy-production.yml"
DEPLOY="$ROOT/scripts/deploy-production.sh"

grep -qE '^\s*push:' "$WF" &&
  fail "deploy-production.yml still deploys on push — a merge is not a release decision"
grep -qE '^\s*password:' "$WF" &&
  fail "deploy-production.yml still offers SSH password authentication"
grep -q 'key: \${{ secrets.SSH_KEY }}' "$WF" ||
  fail "deploy-production.yml no longer uses key authentication"
grep -q 'merge-base --is-ancestor' "$WF" ||
  fail "deploy-production.yml does not restrict deploys to commits reachable from origin/main"

grep -q 'release-state.sh" schema-guard' "$DEPLOY" ||
  fail "deploy-production.sh no longer runs the schema guard"
# The guard must precede the first build: a refusal after a build has already
# replaced an image is not a refusal.
guard_line="$(grep -n 'schema-guard' "$DEPLOY" | head -1 | cut -d: -f1)"
build_line="$(grep -n 'compose build' "$DEPLOY" | head -1 | cut -d: -f1)"
[ "$guard_line" -lt "$build_line" ] ||
  fail "the schema guard runs after the first build (guard=$guard_line build=$build_line)"

grep -q 'compose down' "$DEPLOY" && fail "deploy-production.sh introduced 'compose down'"
grep -qE 'compose up -d[^ ]*$' "$DEPLOY" && fail "deploy-production.sh introduced a bare 'up -d'"
grep -q 'nginx -t' "$DEPLOY" || fail "deploy-production.sh lost the nginx config test"
grep -q 'kaza-prod-(nginx|certbot)' "$DEPLOY" || fail "deploy-production.sh lost the edge guard"
grep -q 'org.opencontainers.image.revision' "$DEPLOY" ||
  fail "deploy-production.sh does not verify the running container revision"

COMPOSE="$ROOT/docker-compose.prod.yml"
for svc in api demo portal; do
  grep -q "image: kaza-$svc:\${KAZA_IMAGE_TAG:-prod}" "$COMPOSE" ||
    fail "kaza-$svc is not SHA-addressable in docker-compose.prod.yml"
done
[ "$(grep -c 'org.opencontainers.image.revision' "$COMPOSE")" -ge 6 ] ||
  fail "docker-compose.prod.yml does not label both images and containers with the revision"

echo "PASS: schema guard, append-only deployment ledger, and deploy-path invariants"
