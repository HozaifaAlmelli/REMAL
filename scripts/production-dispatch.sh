#!/usr/bin/env bash
# Trusted host-side production entrypoint. Application candidates supply code,
# compose configuration and migrations; they never supply orchestration logic.
set -Eeuo pipefail

TARGET_SHA="${1:-}"
MODE="${2:-}"
CONTROL_DIR="${CONTROL_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
LIVE_DIR="${LIVE_DIR:-/opt/apps/kaza-booking}"
ENV_FILE="${ENV_FILE:-/opt/kaza/env/.env.production}"
RELEASES_DIR="${RELEASES_DIR:-/opt/kaza/releases}"
DEPLOY_RUN_ID="${DEPLOY_RUN_ID:-manual-$(date -u +%Y%m%dT%H%M%SZ)-$$}"
RECOVERY_RUN_ID="${RECOVERY_RUN_ID:-}"
AUTHORIZED_RECOVERY_MANIFEST=""

# shellcheck source=scripts/lib/production-lock.sh
source "$CONTROL_DIR/scripts/lib/production-lock.sh"
production_lock_acquire

case "$MODE" in deploy|release) ;; *) echo "FATAL: mode must be deploy or release" >&2; exit 64 ;; esac
[[ "$TARGET_SHA" =~ ^[0-9a-f]{40}$ ]] || { echo "FATAL: target SHA must be full lowercase hex" >&2; exit 64; }

CONTROL_SHA="$(git -C "$CONTROL_DIR" rev-parse HEAD)"
[ -z "$(git -C "$CONTROL_DIR" status --porcelain)" ] || { echo "FATAL: trusted control tree is dirty" >&2; exit 1; }
[ -z "$(git -C "$LIVE_DIR" status --porcelain)" ] || { echo "FATAL: live repository is dirty" >&2; exit 1; }
git -C "$LIVE_DIR" fetch origin main --prune --quiet
[ "$(git -C "$LIVE_DIR" rev-parse origin/main)" = "$CONTROL_SHA" ] || {
  echo "FATAL: trusted control SHA is not the current origin/main" >&2; exit 1; }
git -C "$LIVE_DIR" merge-base --is-ancestor "$TARGET_SHA" origin/main || {
  echo "FATAL: target SHA is not reachable from origin/main" >&2; exit 1; }

if [ "$TARGET_SHA" != "$CONTROL_SHA" ]; then
  [ "$MODE" = "deploy" ] || { echo "FATAL: releases must target the current main SHA" >&2; exit 1; }
  if [ -n "$RECOVERY_RUN_ID" ]; then
    [[ "$RECOVERY_RUN_ID" =~ ^[A-Za-z0-9._-]+$ ]] || { echo "FATAL: recovery run id is malformed" >&2; exit 1; }
    manifest="$RELEASES_DIR/recovery-${RECOVERY_RUN_ID}.json"
    bash "$CONTROL_DIR/scripts/release-state.sh" recovery-authorizes \
      "$manifest" "$TARGET_SHA" "$RECOVERY_RUN_ID" >/dev/null || {
        echo "FATAL: failed-run recovery manifest does not authorize this target" >&2; exit 1; }
    AUTHORIZED_RECOVERY_MANIFEST="$manifest"
  else
    PREVIOUS_SHA_FILE="$RELEASES_DIR/previous-sha.txt"
    if [ ! -s "$PREVIOUS_SHA_FILE" ] || [ "$(cat "$PREVIOUS_SHA_FILE")" != "$TARGET_SHA" ]; then
      echo "FATAL: historical targets are limited to the recorded previous release" >&2
      exit 1
    fi
    DEPLOYMENT_LEDGER="$RELEASES_DIR/deployments.jsonl" \
      bash "$CONTROL_DIR/scripts/release-state.sh" successful-deployment "$TARGET_SHA" >/dev/null || {
        echo "FATAL: previous SHA has no successful trusted deployment record" >&2; exit 1; }
  fi
fi

SOURCE_DIR="$RELEASES_DIR/candidate-${TARGET_SHA}-${DEPLOY_RUN_ID}"
[ ! -e "$SOURCE_DIR" ] || { echo "FATAL: candidate worktree already exists: $SOURCE_DIR" >&2; exit 1; }
git -C "$LIVE_DIR" worktree add --detach "$SOURCE_DIR" "$TARGET_SHA" >/dev/null
SUCCESS=0

cleanup() {
  if [ "$SUCCESS" = "1" ]; then
    git -C "$LIVE_DIR" worktree remove --force "$SOURCE_DIR" >/dev/null 2>&1 || true
    git -C "$LIVE_DIR" worktree prune >/dev/null 2>&1 || true
  else
    echo "RECOVERY REQUIRED: candidate retained at $SOURCE_DIR" >&2
  fi
}
trap cleanup EXIT

[ -z "$(git -C "$SOURCE_DIR" status --porcelain)" ] || { echo "FATAL: application candidate is dirty" >&2; exit 1; }
export CONTROL_DIR LIVE_DIR SOURCE_DIR ENV_FILE RELEASES_DIR TARGET_SHA CONTROL_SHA DEPLOY_RUN_ID
export AUTHORIZED_RECOVERY_MANIFEST

if [ "$MODE" = "release" ]; then
  bash "$CONTROL_DIR/scripts/release-production.sh" "$TARGET_SHA"
else
  DEPLOY_MODE=deploy bash "$CONTROL_DIR/scripts/deploy-production.sh" "$TARGET_SHA"
fi

SUCCESS=1
echo "### Trusted production operation completed: mode=$MODE sha=$TARGET_SHA control=$CONTROL_SHA"
