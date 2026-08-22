#!/usr/bin/env bash
# ============================================================================
# KAZA — production RELEASE (schema-changing) orchestrator.
#
# This is the ONLY path allowed to change the production database. It executes,
# in order and stopping at the first failure:
#
#   0. baseline        live tree clean, containers healthy, ledger head recorded
#   1. fetch           objects only; the live working tree is not touched
#   2. candidate       detached worktree at the target SHA, outside the live tree
#   3. backup          validated dump, pruning disabled
#   4. migrate         apply-migrations.sh with APP_DIR pointed at the candidate
#   5. ledger check    the head must equal what the candidate tree requires
#   6. hook            optional release-specific pre-deploy step
#   7. deploy          live checkout moved to the SHA, then deploy-production.sh
#   8. verify          current-sha.txt must equal the target SHA
#   9. hook            optional release-specific post-deploy step
#  10. cleanup         candidate worktree removed
#
# Why a separate worktree: the live checkout keeps serving the previous release
# until the database is migrated and verified. Steps 1-3 create, recreate,
# start, stop and restart nothing. apply-migrations.sh derives its migration
# directory from APP_DIR, so pointing APP_DIR at the live tree would scan the
# OLD migrations, find nothing pending and report "Up to date" — a silent no-op
# that looks exactly like success. Step 4 asserts against that.
#
# Usage:
#   bash scripts/release-production.sh <target-sha>
#   DRY_RUN=1 bash scripts/release-production.sh <target-sha>   # steps 0-2 only
#
# Optional:
#   RELEASE_PRE_DEPLOY_HOOK    executable run after migrations, before deploy
#   RELEASE_POST_DEPLOY_HOOK   executable run after the deployed SHA is verified
#   APPROVE_DESTRUCTIVE=1      forwarded to apply-migrations.sh
# ============================================================================
set -euo pipefail

TARGET_SHA="${1:-}"
LIVE_DIR="${LIVE_DIR:-/opt/apps/kaza-booking}"
ENV_FILE="${ENV_FILE:-/opt/kaza/env/.env.production}"
RELEASES_DIR="${RELEASES_DIR:-/opt/kaza/releases}"
COMPOSE_FILE="${COMPOSE_FILE:-$LIVE_DIR/docker-compose.prod.yml}"
CANDIDATE_DIR="${CANDIDATE_DIR:-$RELEASES_DIR/candidate-$TARGET_SHA}"
DRY_RUN="${DRY_RUN:-0}"

DEPLOY_ACTOR="${DEPLOY_ACTOR:-manual}"
DEPLOY_RUN_ID="${DEPLOY_RUN_ID:-}"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-}"

BACKUP_DIR="${BACKUP_DIR:-/opt/kaza/backups/postgres}"
CONTAINERS_BEFORE=""
WORKTREE_CREATED=0
BACKUP_REF=""
LEDGER_BEFORE=""

die() { echo "FATAL: $*" >&2; exit 1; }
step() { echo; echo "=== [$1] $2"; }

if [ -z "$TARGET_SHA" ]; then
  echo "usage: release-production.sh <target-sha>" >&2
  exit 64
fi
case "$TARGET_SHA" in
  *[!0-9a-f]* | "") die "target SHA must be a full lowercase hex commit id" ;;
esac
[ "${#TARGET_SHA}" -eq 40 ] || die "target SHA must be the full 40-character commit id"

cleanup_worktree() {
  if [ "$WORKTREE_CREATED" = "1" ] && [ -d "$CANDIDATE_DIR" ]; then
    echo "### Removing candidate worktree"
    git -C "$LIVE_DIR" worktree remove --force "$CANDIDATE_DIR" 2>/dev/null || true
    git -C "$LIVE_DIR" worktree prune 2>/dev/null || true
  fi
}
trap cleanup_worktree EXIT

# ── 0. Baseline ─────────────────────────────────────────────────────────────
step 0 "Baseline"
[ -d "$LIVE_DIR" ] || die "live directory missing: $LIVE_DIR"
[ -s "$ENV_FILE" ] || die "env file missing or empty: $ENV_FILE"

[ -z "$(git -C "$LIVE_DIR" status --porcelain)" ] ||
  die "the live checkout has local changes; a release must start from a clean tree"

LIVE_HEAD_BEFORE="$(git -C "$LIVE_DIR" rev-parse HEAD)"
CONTAINERS_BEFORE="$(docker ps --format '{{.Names}} {{.ID}}' | sort)"
echo "live HEAD      : $LIVE_HEAD_BEFORE"
echo "target SHA     : $TARGET_SHA"
printf '%s\n' "$CONTAINERS_BEFORE" | sed 's/^/container      : /'

LEDGER_BEFORE="$(ENV_FILE="$ENV_FILE" COMPOSE_FILE="$COMPOSE_FILE" APP_DIR="$LIVE_DIR" \
  bash "$LIVE_DIR/scripts/release-state.sh" ledger-head)"
echo "ledger head    : $LEDGER_BEFORE"

if [ "$LIVE_HEAD_BEFORE" = "$TARGET_SHA" ]; then
  echo "NOTE: the live checkout is already at the target SHA; the database steps still run."
fi

# ── 1. Fetch (objects only) ─────────────────────────────────────────────────
step 1 "Fetch"
git -C "$LIVE_DIR" fetch origin --prune --quiet
git -C "$LIVE_DIR" cat-file -e "$TARGET_SHA^{commit}" 2>/dev/null ||
  die "target SHA is not a commit in this repository after fetch"
# Refuse anything that is not on the release branch: a release must be reviewed
# code, not an arbitrary commit that happens to exist in the object store.
git -C "$LIVE_DIR" merge-base --is-ancestor "$TARGET_SHA" origin/main ||
  die "target SHA is not reachable from origin/main — refusing to release unreviewed code"
[ "$(git -C "$LIVE_DIR" rev-parse HEAD)" = "$LIVE_HEAD_BEFORE" ] ||
  die "fetch moved the live checkout; aborting"

# ── 2. Candidate worktree ───────────────────────────────────────────────────
step 2 "Candidate worktree"
[ "$CANDIDATE_DIR" != "$LIVE_DIR" ] || die "candidate directory must not be the live directory"
# A leftover candidate means a previous release crashed. Reusing it silently could
# migrate from a tree nobody has verified, so the operator must clear it deliberately:
#   git -C "$LIVE_DIR" worktree remove --force "$CANDIDATE_DIR" && git -C "$LIVE_DIR" worktree prune
[ ! -e "$CANDIDATE_DIR" ] ||
  die "candidate directory already exists: $CANDIDATE_DIR
     A previous release did not clean up. Inspect it, then remove it with:
       git -C $LIVE_DIR worktree remove --force $CANDIDATE_DIR
       git -C $LIVE_DIR worktree prune"
mkdir -p "$RELEASES_DIR"
git -C "$LIVE_DIR" worktree add --detach "$CANDIDATE_DIR" "$TARGET_SHA" >/dev/null
WORKTREE_CREATED=1

[ "$(git -C "$CANDIDATE_DIR" rev-parse HEAD)" = "$TARGET_SHA" ] ||
  die "candidate worktree is not at the target SHA"
[ "$(git -C "$LIVE_DIR" rev-parse HEAD)" = "$LIVE_HEAD_BEFORE" ] ||
  die "creating the worktree moved the live checkout"
[ "$(docker ps --format '{{.Names}} {{.ID}}' | sort)" = "$CONTAINERS_BEFORE" ] ||
  die "the running container set changed while preparing the candidate"
echo "candidate ready: $CANDIDATE_DIR (live checkout untouched, no container changed)"

CANDIDATE_LEVEL="$(MIG_DIR="$CANDIDATE_DIR/db/migrations" \
  bash "$LIVE_DIR/scripts/release-state.sh" tree-level)"
echo "candidate requires migration level: $CANDIDATE_LEVEL"

if [ "$DRY_RUN" = "1" ]; then
  echo
  echo "=== DRY RUN — stopping before the backup. Nothing was written."
  echo "    would back up      : $BACKUP_DIR (pruning disabled)"
  echo "    would migrate      : $LEDGER_BEFORE -> $CANDIDATE_LEVEL"
  echo "    would deploy       : $TARGET_SHA"
  exit 0
fi

# ── 3. Backup ───────────────────────────────────────────────────────────────
# RETENTION_DAYS=0 disables pruning outright: a rollout must never remove a
# pre-existing artifact as a side effect of protecting itself.
step 3 "Validated backup (pruning disabled)"
ENV_FILE="$ENV_FILE" COMPOSE_FILE="$COMPOSE_FILE" BACKUP_DIR="$BACKUP_DIR" RETENTION_DAYS=0 \
  bash "$CANDIDATE_DIR/scripts/backup-postgres.sh"
BACKUP_REF="$(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'kaza_postgres_*.sql.gz' \
  -printf '%T@ %p\n' | sort -rn | head -1 | cut -d' ' -f2-)"
[ -n "$BACKUP_REF" ] || die "backup reported success but no artifact was found"
echo "backup artifact: $BACKUP_REF"

# ── 4. Migrate from the candidate tree ──────────────────────────────────────
step 4 "Apply migrations"
[ "$CANDIDATE_DIR" != "$LIVE_DIR" ] || die "APP_DIR assertion failed"
MIGRATION_LOG="$(mktemp)"
if ! APP_DIR="$CANDIDATE_DIR" ENV_FILE="$ENV_FILE" COMPOSE_FILE="$COMPOSE_FILE" \
     APPROVE_DESTRUCTIVE="${APPROVE_DESTRUCTIVE:-0}" \
     bash "$CANDIDATE_DIR/scripts/apply-migrations.sh" 2>&1 | tee "$MIGRATION_LOG"; then
  rm -f "$MIGRATION_LOG"
  die "migrations failed — the database is at its last fully applied and verified migration.
     Nothing was deployed; the previous release is still serving.
     Restore point: $BACKUP_REF"
fi
if grep -q '### Up to date — no pending migrations.' "$MIGRATION_LOG" &&
   [ "$LEDGER_BEFORE" != "$CANDIDATE_LEVEL" ]; then
  rm -f "$MIGRATION_LOG"
  die "the runner reported 'Up to date' but the ledger ($LEDGER_BEFORE) is behind the
     candidate ($CANDIDATE_LEVEL) — APP_DIR did not point at the candidate tree"
fi
rm -f "$MIGRATION_LOG"

# ── 5. Ledger check ─────────────────────────────────────────────────────────
step 5 "Ledger verification"
LEDGER_AFTER="$(ENV_FILE="$ENV_FILE" COMPOSE_FILE="$COMPOSE_FILE" APP_DIR="$LIVE_DIR" \
  bash "$LIVE_DIR/scripts/release-state.sh" ledger-head)"
echo "ledger head: $LEDGER_BEFORE -> $LEDGER_AFTER (candidate requires $CANDIDATE_LEVEL)"
[ "$LEDGER_AFTER" = "$CANDIDATE_LEVEL" ] ||
  die "ledger head $LEDGER_AFTER does not match the candidate level $CANDIDATE_LEVEL.
     Do NOT deploy. Restore point: $BACKUP_REF"

# ── 6. Optional pre-deploy hook ─────────────────────────────────────────────
if [ -n "${RELEASE_PRE_DEPLOY_HOOK:-}" ]; then
  step 6 "Pre-deploy hook: $RELEASE_PRE_DEPLOY_HOOK"
  CANDIDATE_DIR="$CANDIDATE_DIR" ENV_FILE="$ENV_FILE" COMPOSE_FILE="$COMPOSE_FILE" \
    bash "$RELEASE_PRE_DEPLOY_HOOK" ||
    die "pre-deploy hook failed. The database is migrated; the OLD code is still live.
       Restore point: $BACKUP_REF"
fi

# ── 7. Deploy the exact SHA ─────────────────────────────────────────────────
step 7 "Deploy exact SHA"
git -C "$LIVE_DIR" checkout --detach "$TARGET_SHA" --quiet
[ "$(git -C "$LIVE_DIR" rev-parse HEAD)" = "$TARGET_SHA" ] ||
  die "the live checkout did not move to the target SHA"

DEPLOY_ACTOR="$DEPLOY_ACTOR" DEPLOY_RUN_ID="$DEPLOY_RUN_ID" DEPLOY_BRANCH="$DEPLOY_BRANCH" \
DEPLOY_MODE="release" DEPLOY_BACKUP_REF="$BACKUP_REF" DEPLOY_MIGRATION_BEFORE="$LEDGER_AFTER" \
  sh "$LIVE_DIR/scripts/deploy-production.sh" "$TARGET_SHA"

# ── 8. Verify the deployed SHA ──────────────────────────────────────────────
step 8 "Verify deployed SHA"
DEPLOYED="$(cat "$RELEASES_DIR/current-sha.txt")"
[ "$DEPLOYED" = "$TARGET_SHA" ] ||
  die "current-sha.txt reads $DEPLOYED, expected $TARGET_SHA"
echo "deployed SHA verified: $DEPLOYED"

# ── 9. Optional post-deploy hook ────────────────────────────────────────────
# Runs only once the exact release code is confirmed live. Release-specific
# steps that seed or initialise data belong here, never earlier: they must not
# run against the previous release's code.
if [ -n "${RELEASE_POST_DEPLOY_HOOK:-}" ]; then
  step 9 "Post-deploy hook: $RELEASE_POST_DEPLOY_HOOK"
  LIVE_DIR="$LIVE_DIR" ENV_FILE="$ENV_FILE" COMPOSE_FILE="$COMPOSE_FILE" \
    bash "$RELEASE_POST_DEPLOY_HOOK" ||
    die "post-deploy hook failed. Code and schema are live and consistent;
       the hook's own effect is incomplete. Do not re-run the release — re-run the hook."
fi

# ── 10. Cleanup ─────────────────────────────────────────────────────────────
step 10 "Cleanup"
cleanup_worktree
WORKTREE_CREATED=0

echo
echo "### RELEASE OK"
echo "    sha            : $TARGET_SHA"
echo "    ledger         : $LEDGER_BEFORE -> $LEDGER_AFTER"
echo "    backup         : $BACKUP_REF"
echo "    audit record   : appended to $RELEASES_DIR/deployments.jsonl"
