#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf -- "$TMP"' EXIT
fail() { echo "FAIL: $*" >&2; exit 1; }
expect_failure() {
  local label="$1"; shift
  local output status
  set +e; output="$("$@" 2>&1)"; status=$?; set -e
  [ "$status" -ne 0 ] || fail "$label unexpectedly succeeded"
  printf '%s\n' "$output"
}

CONTROL="$TMP/control"
LIVE="$TMP/live"
RELEASES="$TMP/releases"
mkdir -p "$CONTROL" "$LIVE" "$RELEASES" "$TMP/bin"
for repo in "$CONTROL" "$LIVE"; do
  git -C "$repo" init -q
  git -C "$repo" config user.email test@example.com
  git -C "$repo" config user.name Test
  printf 'trusted\n' > "$repo/app"
  git -C "$repo" add .
  git -C "$repo" commit -qm trusted
done
CONTROL_SHA="$(git -C "$CONTROL" rev-parse HEAD)"
LIVE_SHA="$(git -C "$LIVE" rev-parse HEAD)"
# Both repositories must model the same governed application revision.
git -C "$LIVE" reset -q --hard "$CONTROL_SHA" 2>/dev/null || {
  rm -rf "$LIVE"
  git clone -q "$CONTROL" "$LIVE"
}
LIVE_SHA="$(git -C "$LIVE" rev-parse HEAD)"
CONTROL_SHA="$LIVE_SHA"
printf '%s\n' "$LIVE_SHA" > "$RELEASES/current-sha.txt"
printf '%s\n' "$(printf 'f%.0s' {1..40})" > "$RELEASES/previous-sha.txt"
printf 'POSTGRES_DB=test\nPOSTGRES_USER=test\nPOSTGRES_PASSWORD=test-only\n' > "$TMP/test.env"
printf 'services: {}\n' > "$LIVE/docker-compose.prod.yml"
git -C "$LIVE" add docker-compose.prod.yml
git -C "$LIVE" commit -qm compose
LIVE_SHA="$(git -C "$LIVE" rev-parse HEAD)"
printf '%s\n' "$LIVE_SHA" > "$RELEASES/current-sha.txt"
rm -rf "$CONTROL"
git clone -q "$LIVE" "$CONTROL"
CONTROL_SHA="$(git -C "$CONTROL" rev-parse HEAD)"
git -C "$CONTROL" update-ref refs/remotes/origin/main "$CONTROL_SHA"

cat > "$TMP/bin/docker" <<'SH'
#!/usr/bin/env bash
set -Eeuo pipefail
last="${*: -1}"
case "$last" in
  kaza-prod-api) service=api; digit=1 ;;
  kaza-prod-demo) service=demo; digit=2 ;;
  kaza-prod-portal) service=portal; digit=3 ;;
  *) echo "unexpected docker target: $last" >&2; exit 90 ;;
esac
if [ "$#" -eq 2 ] && [ "$1" = inspect ]; then exit 0; fi
image="sha256:$(printf "$digit%.0s" {1..64})"
if [ "${STATE_IMAGE_DRIFT:-0}" = 1 ] && [ "$service" = api ]; then image="sha256:$(printf '9%.0s' {1..64})"; fi
printf '%s|container-%s|%s|2026-08-23T00:00:00Z|2026-08-23T00:00:01Z|true|kaza-prod|%s|%s|%s\n' \
  "$service" "$service" "$image" "$service" "$STATE_SHA" "$STATE_CONTROL_SHA"
SH
chmod +x "$TMP/bin/docker"

cat > "$TMP/fake-release-state.sh" <<'SH'
#!/usr/bin/env bash
case "${1:-}" in
  ledger-head) printf '%s\n' "${STATE_MIGRATION_HEAD:-0064}" ;;
  latest-successful)
    [ "${STATE_BAD_AUDIT:-0}" != 1 ] || exit 1
    [ "${STATE_NO_AUDIT:-0}" != 1 ] || exit 3
    cat "$STATE_AUDIT"
    ;;
  *) exit 64 ;;
esac
SH
chmod +x "$TMP/fake-release-state.sh"

AUDIT="$TMP/audit.json"
KAZA_AUDIT_EVENT=DEPLOYMENT_RESULT KAZA_AUDIT_SHA="$LIVE_SHA" \
KAZA_AUDIT_CONTROL_SHA="$CONTROL_SHA" KAZA_AUDIT_BRANCH=main KAZA_AUDIT_ACTOR=test \
KAZA_AUDIT_RUN_ID=gh-200-1 DEPLOY_WORKFLOW_RUN=https://github.com/HozaifaAlmelli/REMAL/actions/runs/200 \
DEPLOY_AUTHORIZATION_REF=github-environment:production:200 KAZA_AUDIT_MODE=deploy \
KAZA_AUDIT_TIMESTAMP=2026-08-23T00:00:02Z KAZA_AUDIT_STARTED_AT=2026-08-23T00:00:00Z \
KAZA_AUDIT_PREVIOUS_SHA="$(printf 'f%.0s' {1..40})" KAZA_AUDIT_MIGRATION_BEFORE=0064 \
KAZA_AUDIT_MIGRATION_AFTER=0064 KAZA_AUDIT_BACKUP_ARTIFACT="" KAZA_AUDIT_RESULT=OK \
KAZA_AUDIT_CHANGED_SERVICES='["api","demo","portal"]' \
KAZA_AUDIT_IMAGE_IDS='{"api":"sha256:1111111111111111111111111111111111111111111111111111111111111111","demo":"sha256:2222222222222222222222222222222222222222222222222222222222222222","portal":"sha256:3333333333333333333333333333333333333333333333333333333333333333"}' \
KAZA_AUDIT_ROLLBACK_IMAGES='{"api":"kaza-api:rollback","demo":"kaza-demo:rollback","portal":"kaza-portal:rollback"}' \
KAZA_AUDIT_RECOVERY_MANIFEST=/opt/kaza/releases/recovery-gh-200-1.json \
  python3 "$ROOT/scripts/lib/deployment-record.py" audit > "$AUDIT"

run_state() {
  PATH="$TMP/bin:$PATH" CONTROL_DIR="$CONTROL" LIVE_DIR="$LIVE" ENV_FILE="$TMP/test.env" \
  RELEASES_DIR="$RELEASES" RELEASE_STATE_SCRIPT="$TMP/fake-release-state.sh" \
  PRODUCTION_LOCK_SCRIPT="$ROOT/scripts/lib/production-lock.sh" \
  PRODUCTION_LOCK_FILE="$TMP/production.lock" STATE_AUDIT="$AUDIT" \
  STATE_SHA="$LIVE_SHA" STATE_CONTROL_SHA="$CONTROL_SHA" \
    bash "$ROOT/scripts/production-state.sh"
}

governed="$(run_state)" || fail "governed production state was rejected"
python3 -c 'import json,sys; p=json.loads(sys.argv[1]); assert p["governanceStatus"]=="GOVERNED" and p["commitSha"]==sys.argv[2] and p["databaseMigrationHead"]=="0064" and p["deployment"]=={"actor":"test","authorizationRef":"github-environment:production:200","backupArtifact":None,"branch":"main","databaseMigrationAfter":"0064","databaseMigrationBefore":"0064","id":"gh-200-1","mode":"deploy","previousVersion":"ffffffffffffffffffffffffffffffffffffffff","result":"OK","timestamp":"2026-08-23T00:00:02Z","workflowRun":"https://github.com/HozaifaAlmelli/REMAL/actions/runs/200"}' "$governed" "$LIVE_SHA" ||
  fail "governed production summary is incorrect"

git -C "$CONTROL" update-ref refs/remotes/origin/main "$(git -C "$CONTROL" rev-parse "$CONTROL_SHA^")"
stale_control="$(expect_failure "stale control plane" run_state)"
grep -q 'current origin/main control plane' <<<"$stale_control" || fail "stale control plane was not diagnosed"
git -C "$CONTROL" update-ref refs/remotes/origin/main "$CONTROL_SHA"

drift="$(STATE_IMAGE_DRIFT=1 expect_failure "image digest drift" run_state)"
grep -q 'api_image_digest_mismatch' <<<"$drift" || fail "image drift was not diagnosed"

db_drift="$(STATE_MIGRATION_HEAD=0063 expect_failure "migration drift" run_state)"
grep -q 'migration_head_mismatch' <<<"$db_drift" || fail "migration drift was not diagnosed"

legacy="$(STATE_NO_AUDIT=1 expect_failure "missing trusted audit" run_state)"
grep -q 'UNVERIFIED_LEGACY' <<<"$legacy" || fail "missing audit was not classified as unverified legacy"
python3 -c 'import json,sys; p=json.loads(next(line for line in sys.argv[1].splitlines() if line.startswith("{"))); assert p["deployment"] is None and p["commitSha"] is None' "$legacy" ||
  fail "unverified legacy state asserted deployment provenance"

bad_audit="$(STATE_BAD_AUDIT=1 expect_failure "invalid trusted audit" run_state)"
grep -q 'audit ledger is invalid' <<<"$bad_audit" || fail "invalid audit was weakened to an unverified legacy state"

unknown="$(EXPECTED_SHA="$(printf 'e%.0s' {1..40})" expect_failure "unknown expected SHA" run_state)"
grep -q 'expected_sha_mismatch' <<<"$unknown" || fail "expected SHA mismatch was not diagnosed"

# A live checkout left behind on the previous release is the exact drift the
# trusted deploy's live-checkout advance exists to prevent. Reconciliation must
# keep refusing it: the fix belongs in the deploy, never in this invariant.
git -C "$LIVE" checkout -q --detach "$(git -C "$LIVE" rev-parse HEAD^)"
stale_checkout="$(expect_failure "stale live checkout" run_state)"
grep -q 'live_checkout_mismatch' <<<"$stale_checkout" || fail "stale live checkout was not diagnosed"
grep -q 'DRIFTED' <<<"$stale_checkout" || fail "stale live checkout was not classified as drift"
git -C "$LIVE" checkout -q --detach "$LIVE_SHA"

# ...and once the deploy has advanced it again, the same state is GOVERNED.
regoverned="$(run_state)" || fail "state was not governed again after the live checkout advanced"
grep -q '"governanceStatus":"GOVERNED"' <<<"$regoverned" ||
  fail "restored live checkout did not reconcile to GOVERNED"

echo "PASS: production identity reconciles audit, image, checkout and migration truth"
