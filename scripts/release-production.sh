#!/usr/bin/env bash
# Trusted schema-changing release path. The application candidate contributes
# migrations and app code only; every operational script comes from CONTROL_DIR.
set -Eeuo pipefail

TARGET_SHA="${1:-}"
CONTROL_DIR="${CONTROL_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
SOURCE_DIR="${SOURCE_DIR:-}"
LIVE_DIR="${LIVE_DIR:-/opt/apps/kaza-booking}"
ENV_FILE="${ENV_FILE:-/opt/kaza/env/.env.production}"
RELEASES_DIR="${RELEASES_DIR:-/opt/kaza/releases}"
BACKUP_DIR="${BACKUP_DIR:-/opt/kaza/backups/postgres}"
COMPOSE_FILE="${COMPOSE_FILE:-$SOURCE_DIR/docker-compose.prod.yml}"
CONTROL_SHA="${CONTROL_SHA:-$(git -C "$CONTROL_DIR" rev-parse HEAD)}"
DEPLOY_RUN_ID="${DEPLOY_RUN_ID:-manual-$(date -u +%Y%m%dT%H%M%SZ)-$$}"
AUTH_SMOKE_CREDENTIALS_FILE="${AUTH_SMOKE_CREDENTIALS_FILE:-/opt/kaza/secrets/auth-smoke.json}"
APPROVE_LEGACY_PROVENANCE_BASELINE="${APPROVE_LEGACY_PROVENANCE_BASELINE:-0}"
DEPLOYMENT_LEDGER="$RELEASES_DIR/deployments.jsonl"

# shellcheck source=scripts/lib/production-lock.sh
source "$CONTROL_DIR/scripts/lib/production-lock.sh"
production_lock_acquire

[[ "$TARGET_SHA" =~ ^[0-9a-f]{40}$ ]] || { echo "FATAL: target SHA must be full lowercase hex" >&2; exit 64; }
[ "$(git -C "$SOURCE_DIR" rev-parse --is-inside-work-tree 2>/dev/null)" = "true" ] || {
  echo "FATAL: application candidate is not a Git worktree" >&2; exit 1; }
[ "$(git -C "$SOURCE_DIR" rev-parse HEAD)" = "$TARGET_SHA" ] || { echo "FATAL: candidate SHA mismatch" >&2; exit 1; }
[ -z "$(git -C "$SOURCE_DIR" status --porcelain)" ] || { echo "FATAL: application candidate is dirty" >&2; exit 1; }
[ "$TARGET_SHA" = "$CONTROL_SHA" ] || { echo "FATAL: schema-changing release must target current main" >&2; exit 1; }
[ -s "$AUTH_SMOKE_CREDENTIALS_FILE" ] || { echo "FATAL: read-only auth smoke credentials are not provisioned" >&2; exit 1; }
[ -f "$CONTROL_DIR/infra/deploy/compose.provenance.yml" ] || { echo "FATAL: trusted compose provenance override is missing" >&2; exit 1; }
AUTH_SMOKE_CREDENTIALS_FILE="$AUTH_SMOKE_CREDENTIALS_FILE" \
  bash "$CONTROL_DIR/scripts/smoke-production-auth.sh" --validate-only
# Verify the existing application state before a release can mutate the database.
# shellcheck source=scripts/lib/image-provenance.sh
source "$CONTROL_DIR/scripts/lib/image-provenance.sh"
PREVIOUS_SHA="$(cat "$RELEASES_DIR/current-sha.txt" 2>/dev/null || true)"
verify_existing_runtime_provenance "$PREVIOUS_SHA" "$TARGET_SHA" "$CONTROL_SHA" \
  "$LIVE_DIR" "$DEPLOYMENT_LEDGER" "$APPROVE_LEGACY_PROVENANCE_BASELINE" "$CONTROL_DIR"

BACKUP_RESULT_FILE="$RELEASES_DIR/backup-result-${DEPLOY_RUN_ID}.txt"
[ ! -e "$BACKUP_RESULT_FILE" ] || { echo "FATAL: backup result file already exists" >&2; exit 1; }
BACKUP_REF=""
LEDGER_BEFORE=""
LEDGER_AFTER=""
DEPLOY_STARTED=0
STARTED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

record_predeploy_failure() {
  local status="$1" payload timestamp previous_sha
  if [ "$status" -eq 0 ] || [ "$DEPLOY_STARTED" != "0" ]; then return 0; fi
  timestamp="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  previous_sha="$(cat "$RELEASES_DIR/current-sha.txt" 2>/dev/null || true)"
  export KAZA_AUDIT_EVENT=DEPLOYMENT_RESULT KAZA_AUDIT_SHA="$TARGET_SHA"
  export KAZA_AUDIT_CONTROL_SHA="$CONTROL_SHA" KAZA_AUDIT_BRANCH="${DEPLOY_BRANCH:-main}"
  export KAZA_AUDIT_ACTOR="${DEPLOY_ACTOR:-manual}" KAZA_AUDIT_RUN_ID="$DEPLOY_RUN_ID"
  export KAZA_AUDIT_MODE=release KAZA_AUDIT_TIMESTAMP="$timestamp"
  export KAZA_AUDIT_STARTED_AT="$STARTED_AT" KAZA_AUDIT_PREVIOUS_SHA="$previous_sha"
  export KAZA_AUDIT_MIGRATION_BEFORE="$LEDGER_BEFORE" KAZA_AUDIT_MIGRATION_AFTER="$LEDGER_AFTER"
  export KAZA_AUDIT_BACKUP_ARTIFACT="$BACKUP_REF" KAZA_AUDIT_RESULT=FAILED
  export KAZA_AUDIT_CHANGED_SERVICES='[]' KAZA_AUDIT_IMAGE_IDS='{}' KAZA_AUDIT_ROLLBACK_IMAGES='{}'
  export KAZA_AUDIT_RECOVERY_MANIFEST=""
  payload="$(python3 "$CONTROL_DIR/scripts/lib/deployment-record.py" audit)" || return 1
  DEPLOYMENT_LEDGER="$RELEASES_DIR/deployments.jsonl" \
    bash "$CONTROL_DIR/scripts/release-state.sh" record "$payload"
}

on_exit() {
  local status=$?
  trap - EXIT
  rm -f -- "$BACKUP_RESULT_FILE"
  if ! record_predeploy_failure "$status"; then
    echo "FATAL: release failed and its audit record could not be persisted" >&2
    exit 1
  fi
  exit "$status"
}
trap on_exit EXIT

echo "=== [1] Validate authoritative migration state"
LEDGER_BEFORE="$(APP_DIR="$SOURCE_DIR" COMPOSE_FILE="$COMPOSE_FILE" MIGRATION_AUTHORITY_DIR="$CONTROL_DIR" \
  ENV_FILE="$ENV_FILE" bash "$CONTROL_DIR/scripts/release-state.sh" ledger-head)"
CANDIDATE_LEVEL="$(APP_DIR="$SOURCE_DIR" bash "$CONTROL_DIR/scripts/release-state.sh" tree-level)"
echo "validated ledger=$LEDGER_BEFORE candidate=$CANDIDATE_LEVEL"

echo "=== [2] Apply candidate migrations through trusted runner"
APP_DIR="$SOURCE_DIR" MIG_DIR="$SOURCE_DIR/db/migrations" \
PRODUCTION_MANIFEST="$SOURCE_DIR/infra/db/init.prod.sql" \
MIGRATION_CHECKSUMS="$SOURCE_DIR/infra/db/production-migrations.sha256" \
ENV_FILE="$ENV_FILE" COMPOSE_FILE="$COMPOSE_FILE" BACKUP_DIR="$BACKUP_DIR" \
BACKUP_RESULT_FILE="$BACKUP_RESULT_FILE" APPROVE_DESTRUCTIVE="${APPROVE_DESTRUCTIVE:-0}" \
  bash "$CONTROL_DIR/scripts/apply-migrations.sh"

[ -s "$BACKUP_RESULT_FILE" ] || { echo "FATAL: migration runner did not return its exact backup artifact" >&2; exit 1; }
BACKUP_REF="$(cat "$BACKUP_RESULT_FILE")"
[ "$(wc -l < "$BACKUP_RESULT_FILE")" -eq 1 ] || { echo "FATAL: backup result is ambiguous" >&2; exit 1; }
BACKUP_DIR_REAL="$(realpath -e "$BACKUP_DIR")"
BACKUP_REF_REAL="$(realpath -e "$BACKUP_REF")"
case "$BACKUP_REF_REAL" in
  "$BACKUP_DIR_REAL"/kaza_postgres_*.sql.gz) ;;
  *) echo "FATAL: migration runner returned a backup outside the approved backup directory" >&2; exit 1 ;;
esac
[ ! -L "$BACKUP_REF" ] || { echo "FATAL: backup artifact must not be a symbolic link" >&2; exit 1; }
BACKUP_REF="$BACKUP_REF_REAL"
source "$CONTROL_DIR/scripts/lib/postgres-backup.sh"
validate_postgres_backup_artifact "$BACKUP_REF"

echo "=== [3] Verify resulting authoritative ledger"
LEDGER_AFTER="$(APP_DIR="$SOURCE_DIR" COMPOSE_FILE="$COMPOSE_FILE" MIGRATION_AUTHORITY_DIR="$CONTROL_DIR" \
  ENV_FILE="$ENV_FILE" bash "$CONTROL_DIR/scripts/release-state.sh" ledger-head)"
[ "$LEDGER_AFTER" = "$CANDIDATE_LEVEL" ] || {
  echo "FATAL: validated ledger $LEDGER_AFTER does not match candidate $CANDIDATE_LEVEL" >&2; exit 1; }

echo "=== [4] Deploy exact application candidate through trusted engine"
DEPLOY_STARTED=1
DEPLOY_MODE=release DEPLOY_BACKUP_REF="$BACKUP_REF" DEPLOY_MIGRATION_BEFORE="$LEDGER_BEFORE" \
DEPLOY_MIGRATION_AFTER="$LEDGER_AFTER" \
APPROVE_LEGACY_PROVENANCE_BASELINE="$APPROVE_LEGACY_PROVENANCE_BASELINE" \
  bash "$CONTROL_DIR/scripts/deploy-production.sh" "$TARGET_SHA"

echo "### RELEASE OK: sha=$TARGET_SHA ledger=$LEDGER_BEFORE->$LEDGER_AFTER backup=$BACKUP_REF"
