#!/usr/bin/env bash
# Sent by the protected workflow itself. It bootstraps the current main control
# plane even when the live checkout predates the deployment hardening scripts.
set -Eeuo pipefail

APP_DIR="${APP_DIR:-/opt/apps/kaza-booking}"
ENV_FILE="${ENV_FILE:-/opt/kaza/env/.env.production}"
RELEASES_DIR="${RELEASES_DIR:-/opt/kaza/releases}"

required=(CONTROL_SHA DEPLOY_SHA DEPLOY_MODE DEPLOY_ACTOR DEPLOY_RUN_ID DEPLOY_BRANCH)
for name in "${required[@]}"; do
  [ -n "${!name:-}" ] || { echo "FATAL: $name is required" >&2; exit 1; }
done

case "$CONTROL_SHA:$DEPLOY_SHA" in
  *[!0-9a-f:]*|*:*:* ) echo "FATAL: control and deploy SHAs must be lowercase hex" >&2; exit 1 ;;
esac
if [ "${#CONTROL_SHA}" -ne 40 ] || [ "${#DEPLOY_SHA}" -ne 40 ]; then
  echo "FATAL: control and deploy SHAs must be full 40-character commit ids" >&2
  exit 1
fi
[ "$DEPLOY_BRANCH" = "main" ] || {
  echo "FATAL: production control may only be dispatched from main" >&2; exit 1; }
case "$DEPLOY_MODE" in deploy|release) ;; *) echo "FATAL: unsupported mode: $DEPLOY_MODE" >&2; exit 1 ;; esac

[ -d "$APP_DIR/.git" ] || { echo "FATAL: live repository missing: $APP_DIR" >&2; exit 1; }
[ -s "$ENV_FILE" ] || { echo "FATAL: production env file missing or empty" >&2; exit 1; }
[ -z "$(git -C "$APP_DIR" status --porcelain)" ] || {
  echo "FATAL: live repository has local changes" >&2; exit 1; }

git -C "$APP_DIR" fetch origin main --prune --quiet
MAIN_SHA="$(git -C "$APP_DIR" rev-parse origin/main)"
[ "$MAIN_SHA" = "$CONTROL_SHA" ] || {
  echo "FATAL: workflow control SHA $CONTROL_SHA is not the current origin/main $MAIN_SHA" >&2
  exit 1
}

CONTROL_DIR="$RELEASES_DIR/control-${CONTROL_SHA}-${DEPLOY_RUN_ID}"
[ ! -e "$CONTROL_DIR" ] || { echo "FATAL: control worktree already exists: $CONTROL_DIR" >&2; exit 1; }
mkdir -p "$RELEASES_DIR"
git -C "$APP_DIR" worktree add --detach "$CONTROL_DIR" "$CONTROL_SHA" >/dev/null

cleanup() {
  git -C "$APP_DIR" worktree remove --force "$CONTROL_DIR" >/dev/null 2>&1 || true
  git -C "$APP_DIR" worktree prune >/dev/null 2>&1 || true
}
trap cleanup EXIT

[ "$(git -C "$CONTROL_DIR" rev-parse HEAD)" = "$CONTROL_SHA" ] || {
  echo "FATAL: trusted control worktree SHA mismatch" >&2; exit 1; }
[ -z "$(git -C "$CONTROL_DIR" status --porcelain)" ] || {
  echo "FATAL: trusted control worktree is dirty" >&2; exit 1; }

export CONTROL_DIR LIVE_DIR="$APP_DIR" ENV_FILE RELEASES_DIR
export APPROVE_DESTRUCTIVE="${APPROVE_DESTRUCTIVE:-0}"
export APPROVE_LEGACY_PROVENANCE_BASELINE="${APPROVE_LEGACY_PROVENANCE_BASELINE:-0}"
export AUTH_SMOKE_CREDENTIALS_FILE="${AUTH_SMOKE_CREDENTIALS_FILE:-/opt/kaza/secrets/auth-smoke.json}"
bash "$CONTROL_DIR/scripts/production-dispatch.sh" "$DEPLOY_SHA" "$DEPLOY_MODE"
