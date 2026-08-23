#!/usr/bin/env bash
# The trusted deploy builds from a candidate worktree, so the live repository at
# /opt/apps/kaza-booking does not move on its own. production-state.sh treats that
# checkout as production identity and reports `live_checkout_mismatch` when it
# disagrees with the audited SHA, so the deploy must advance it.
#
# These tests exercise the real block shipped in scripts/deploy-production.sh -
# it is extracted between its sentinel markers rather than copied - plus the
# ordering properties that make a failed deployment safe.
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf -- "$TMP"' EXIT
fail() { echo "FAIL: $*" >&2; exit 1; }

DEPLOY="$ROOT/scripts/deploy-production.sh"
STATE="$ROOT/scripts/production-state.sh"

# ---------------------------------------------------------------------------
# Extract the shipped block. Testing a copy would pass while the real script
# regressed, so the block is pulled straight out of the deployed source.
# ---------------------------------------------------------------------------
BLOCK="$TMP/advance.sh"
sed -n '/# >>> live-checkout-advance/,/# <<< live-checkout-advance/p' "$DEPLOY" > "$BLOCK"
[ -s "$BLOCK" ] || fail "live-checkout-advance block is missing from deploy-production.sh"
grep -q 'checkout --detach' "$BLOCK" || fail "extracted block does not advance the checkout"

new_repo() {
  local repo="$1"
  mkdir -p "$repo"
  git -C "$repo" init -q
  git -C "$repo" config user.email test@example.com
  git -C "$repo" config user.name Test
  printf 'a\n' > "$repo/app"
  git -C "$repo" add app
  git -C "$repo" commit -qm a
  printf 'b\n' > "$repo/app"
  git -C "$repo" commit -qam b
}

run_block() { # LIVE_DIR DEPLOY_SHA -> exit status, output on stdout/stderr
  ( set -Eeuo pipefail
    LIVE_DIR="$1" DEPLOY_SHA="$2"
    export LIVE_DIR DEPLOY_SHA
    # shellcheck disable=SC1090 # deliberately executing the shipped block
    . "$BLOCK" ) 2>&1
}

# ---------------------------------------------------------------------------
# 1. A successful deployment leaves the live checkout on the deployed SHA.
# ---------------------------------------------------------------------------
LIVE="$TMP/live"; new_repo "$LIVE"
TARGET="$(git -C "$LIVE" rev-parse HEAD)"
PREVIOUS="$(git -C "$LIVE" rev-parse HEAD^)"
git -C "$LIVE" checkout -q --detach "$PREVIOUS"
[ "$(git -C "$LIVE" rev-parse HEAD)" = "$PREVIOUS" ] || fail "fixture did not start on the previous SHA"

run_block "$LIVE" "$TARGET" >/dev/null || fail "advance rejected a clean live checkout"
[ "$(git -C "$LIVE" rev-parse HEAD)" = "$TARGET" ] ||
  fail "live checkout did not advance to the deployed SHA"
[ -z "$(git -C "$LIVE" status --porcelain)" ] ||
  fail "advance left the live checkout dirty"

# Re-running against the same SHA must stay green: a redeploy of the current
# release is legitimate and must not be treated as drift.
run_block "$LIVE" "$TARGET" >/dev/null || fail "advance is not idempotent for the current release"
[ "$(git -C "$LIVE" rev-parse HEAD)" = "$TARGET" ] || fail "idempotent advance moved HEAD"

# ---------------------------------------------------------------------------
# 2. A failed deployment must not advance the live checkout.
#    A dirty live repository is the one failure the block itself can see; every
#    earlier failure aborts before the block is ever reached (asserted in 3).
# ---------------------------------------------------------------------------
DIRTY="$TMP/dirty"; new_repo "$DIRTY"
D_TARGET="$(git -C "$DIRTY" rev-parse HEAD)"
D_PREVIOUS="$(git -C "$DIRTY" rev-parse HEAD^)"
git -C "$DIRTY" checkout -q --detach "$D_PREVIOUS"
printf 'local edit\n' >> "$DIRTY/app"

set +e
dirty_out="$(run_block "$DIRTY" "$D_TARGET")"
dirty_status=$?
set -e
[ "$dirty_status" -ne 0 ] || fail "advance accepted a dirty live repository"
grep -q 'live repository became dirty' <<<"$dirty_out" ||
  fail "dirty live repository was not diagnosed: $dirty_out"
[ "$(git -C "$DIRTY" rev-parse HEAD)" = "$D_PREVIOUS" ] ||
  fail "a refused advance still moved the live checkout"

# An unreachable target must fail rather than silently leave the old checkout.
MISSING="$TMP/missing"; new_repo "$MISSING"
M_PREVIOUS="$(git -C "$MISSING" rev-parse HEAD^)"
git -C "$MISSING" checkout -q --detach "$M_PREVIOUS"
set +e
run_block "$MISSING" "$(printf 'a%.0s' {1..40})" >/dev/null
missing_status=$?
set -e
[ "$missing_status" -ne 0 ] || fail "advance accepted a SHA the live repository does not contain"
[ "$(git -C "$MISSING" rev-parse HEAD)" = "$M_PREVIOUS" ] ||
  fail "a failed advance moved the live checkout"

# ---------------------------------------------------------------------------
# 3. Ordering: the advance runs after every verification gate and before any
#    state is recorded, so a failure can never leave a record claiming a
#    release the live repository does not reflect.
# ---------------------------------------------------------------------------
line_of() { grep -n "$1" "$DEPLOY" | head -1 | cut -d: -f1; }

ADVANCE="$(line_of '# >>> live-checkout-advance')"
DB_GATE="$(line_of 'FATAL: database container identity changed')"
LEDGER_GATE="$(line_of 'FATAL: database ledger changed during application deploy')"
CURRENT_SHA="$(line_of 'write_state_file "\$RELEASES_DIR/current-sha.txt"')"
AUDIT_OK="$(line_of 'record_audit DEPLOYMENT_RESULT OK')"

for v in ADVANCE DB_GATE LEDGER_GATE CURRENT_SHA AUDIT_OK; do
  [ -n "${!v}" ] || fail "could not locate $v in deploy-production.sh"
done

[ "$DB_GATE" -lt "$ADVANCE" ] ||
  fail "live checkout advances before the database identity gate"
[ "$LEDGER_GATE" -lt "$ADVANCE" ] ||
  fail "live checkout advances before the migration ledger gate"
[ "$ADVANCE" -lt "$CURRENT_SHA" ] ||
  fail "current-sha.txt is written before the live checkout advances"
[ "$ADVANCE" -lt "$AUDIT_OK" ] ||
  fail "the success audit record is written before the live checkout advances"

# ---------------------------------------------------------------------------
# 4. The invariant must be fixed, never relaxed. Reconciliation has to keep
#    failing on a mismatched live checkout.
# ---------------------------------------------------------------------------
grep -q 'live_checkout_mismatch' "$STATE" ||
  fail "production-state.sh no longer reports live_checkout_mismatch"
grep -q 'if live_head != authoritative_sha:' "$STATE" ||
  fail "production-state.sh no longer compares the live checkout to the audited SHA"

echo "PASS: the trusted deploy advances the live checkout only after every gate, and the reconciliation invariant is intact"
