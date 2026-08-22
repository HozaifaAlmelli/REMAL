#!/usr/bin/env bash
# ============================================================================
# KAZA — production release state: the single source of truth for
#   "what schema is live", "what schema does this tree need", and
#   "what was deployed, when, by whom".
#
# Subcommands
#   ledger-head            print the highest migration_number in schema_migrations
#   tree-level             print the highest migration number in a source tree
#   schema-guard           FAIL-CLOSED if the tree needs a migration the DB lacks
#   record <json-object>   append one immutable line to the deployment ledger
#
# The schema guard exists because the code deploy path deliberately does NOT run
# migrations. Without it, deploying a tree whose application code reads columns
# the live database does not have produces a runtime-broken production. It is
# cheap, runs before any build, and refuses rather than guesses.
#
# Direction matters and is not symmetric:
#   db_head  <  tree_level   REFUSE. Code ahead of schema — the failure this guard exists for.
#   db_head  == tree_level   OK.
#   db_head  >  tree_level   ALLOW, loudly. This is the rollback case: additive
#                            migrations leave older code able to run, and refusing
#                            here would block the emergency path.
#
# The env file is parsed, never sourced (scripts/lib/env-file.sh). No secret is
# read on the host and none is ever printed.
# ============================================================================
set -euo pipefail

ENV_FILE="${ENV_FILE:-/opt/kaza/env/.env.production}"
COMPOSE_FILE="${COMPOSE_FILE:-/opt/apps/kaza-booking/docker-compose.prod.yml}"
APP_DIR="${APP_DIR:-/opt/apps/kaza-booking}"
MIG_DIR="${MIG_DIR:-$APP_DIR/db/migrations}"
DEPLOYMENT_LEDGER="${DEPLOYMENT_LEDGER:-/opt/kaza/releases/deployments.jsonl}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

usage() {
  cat >&2 <<'USAGE'
usage: release-state.sh <ledger-head|tree-level|schema-guard|record>
  ledger-head          print the live database migration head (4 digits)
  tree-level           print the migration level MIG_DIR requires (4 digits)
  schema-guard         exit 0 if the live schema can serve MIG_DIR's code, else exit 1
  record <json>        append one JSON object to DEPLOYMENT_LEDGER
USAGE
  exit 64
}

# --- database identifiers ---------------------------------------------------
# Sourced lazily: `tree-level` and `record` must work with no database and no
# env file at all, so a failed deploy can still be recorded.
load_db_identifiers() {
  # shellcheck source=scripts/lib/env-file.sh
  source "$SCRIPT_DIR/lib/env-file.sh"
  env_file_preflight "$ENV_FILE" POSTGRES_USER POSTGRES_DB POSTGRES_PASSWORD
  compose_identifier_agreement_preflight "$ENV_FILE" POSTGRES_USER POSTGRES_DB
  load_db_connection_identifiers "$ENV_FILE"
}

psql_db() {
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T db \
    psql -X -v ON_ERROR_STOP=1 -qAt -U "$POSTGRES_USER" -d "$POSTGRES_DB" "$@"
}

# --- readers ----------------------------------------------------------------
ledger_head() {
  # The preflights narrate to stdout. This function's stdout IS its return
  # value and is captured by callers, so that narration goes to stderr —
  # otherwise the operator's own preflight banner becomes part of the head.
  load_db_identifiers >&2
  local head
  head="$(psql_db -c 'SELECT coalesce(max(migration_number), '"''"') FROM schema_migrations;' | tr -d '[:space:]')"
  if [ -z "$head" ]; then
    echo "ERROR: schema_migrations is empty or unreadable — refusing to report a head" >&2
    return 1
  fi
  printf '%s\n' "$head"
}

tree_level() {
  local level
  # Main migrations only: *_rollback / *_verify / *_test are not applied levels.
  level="$(
    find "$MIG_DIR" -maxdepth 1 -type f -name '[0-9][0-9][0-9][0-9]_*.sql' \
      -not -name '*_rollback.sql' -not -name '*_verify.sql' -not -name '*_test.sql' \
      -printf '%f\n' 2>/dev/null | cut -c1-4 | sort | tail -1
  )"
  if [ -z "$level" ]; then
    echo "ERROR: no migrations found in $MIG_DIR — refusing to report a level" >&2
    return 1
  fi
  printf '%s\n' "$level"
}

# --- guard ------------------------------------------------------------------
schema_guard() {
  local db_head tree_req
  tree_req="$(tree_level)"
  db_head="$(ledger_head)"

  echo "### Schema compatibility: database head=$db_head, tree requires=$tree_req"

  # String compare is safe and intentional: every migration number is exactly
  # four zero-padded digits, so lexical and numeric order agree. Avoiding a
  # numeric cast keeps a malformed value from being silently coerced to 0.
  if [ "${#db_head}" -ne 4 ] || [ "${#tree_req}" -ne 4 ]; then
    echo "FATAL: malformed migration level (db='$db_head' tree='$tree_req')" >&2
    return 1
  fi

  if [ "$db_head" \< "$tree_req" ]; then
    cat >&2 <<EOF
FATAL: the live database is behind the code being deployed.
  database migration head : $db_head
  this tree requires      : $tree_req
Deploying now would run application code against a schema that lacks the
columns and tables it reads. Run the migration release path first:
  scripts/release-production.sh <sha>
Refusing to build or restart anything.
EOF
    return 1
  fi

  if [ "$db_head" \> "$tree_req" ]; then
    echo "WARNING: database head ($db_head) is AHEAD of this tree ($tree_req)."
    echo "WARNING: this is expected only for a rollback to a previous SHA."
  fi

  echo "### Schema compatibility OK"
}

# --- immutable deployment ledger -------------------------------------------
# Append-only. Never rewritten, never truncated, never sorted. One JSON object
# per line so the file survives partial writes and stays greppable.
record() {
  local payload="${1:-}"
  [ -n "$payload" ] || usage

  # Reject anything that is not a single-line JSON object: a stray newline would
  # corrupt the one-record-per-line contract this file depends on.
  case "$payload" in
    '{'*'}') ;;
    *) echo "FATAL: deployment record must be a JSON object" >&2; return 1 ;;
  esac
  if [ "$(printf '%s' "$payload" | wc -l)" -ne 0 ]; then
    echo "FATAL: deployment record must be a single line" >&2
    return 1
  fi

  local dir
  dir="$(dirname "$DEPLOYMENT_LEDGER")"
  mkdir -p "$dir"

  # flock serialises concurrent writers; the workflow's concurrency group makes
  # that unlikely, but a manual run on the host is not covered by it.
  if command -v flock >/dev/null 2>&1; then
    flock "$dir" sh -c "printf '%s\n' \"\$1\" >> \"\$2\"" _ "$payload" "$DEPLOYMENT_LEDGER"
  else
    printf '%s\n' "$payload" >> "$DEPLOYMENT_LEDGER"
  fi
  echo "### Deployment recorded: $DEPLOYMENT_LEDGER"
}

case "${1:-}" in
  ledger-head)  ledger_head ;;
  tree-level)   tree_level ;;
  schema-guard) schema_guard ;;
  record)       shift; record "${1:-}" ;;
  *)            usage ;;
esac
