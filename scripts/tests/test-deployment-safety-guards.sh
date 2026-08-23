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

mkdir -p "$TMP/bin" "$TMP/releases"
cat > "$TMP/test.env" <<'ENV'
POSTGRES_DB=kaza_guard_test
POSTGRES_USER=postgres
POSTGRES_PASSWORD=test-only
ENV

# shellcheck source=scripts/lib/production-migrations.sh
source "$ROOT/scripts/lib/production-migrations.sh"
mapfile -t MIGRATIONS < <(list_production_migrations "$ROOT/infra/db/init.prod.sql" "$ROOT/db/migrations")
VALID_LEDGER="$TMP/valid-ledger.txt"
for migration in "${MIGRATIONS[@]}"; do printf '%s|%s\n' "${migration:0:4}" "$migration"; done > "$VALID_LEDGER"

export KAZA_PROBE_STUB_LIB="$ROOT/scripts/tests/lib/compose-probe-stub.sh"
export KAZA_PROBE_POSTGRES_USER=postgres KAZA_PROBE_POSTGRES_DB=kaza_guard_test
cat > "$TMP/bin/docker" <<'SH'
#!/usr/bin/env bash
set -Eeuo pipefail
source "$KAZA_PROBE_STUB_LIB"
respond_to_compose_probe "$@"
case "$*" in
  *"to_regclass('public.schema_migrations')"*) echo t ;;
  *information_schema.columns*) echo 4 ;;
  *"SELECT migration_number"*) cat "$LEDGER_ROWS_FILE" ;;
  *" config "*|*" config") exit 0 ;;
  *) echo "unexpected docker invocation: $*" >&2; exit 90 ;;
esac
SH
chmod +x "$TMP/bin/docker"

run_state() {
  PATH="$TMP/bin:$PATH" LEDGER_ROWS_FILE="${LEDGER_ROWS_FILE:-$VALID_LEDGER}" \
  ENV_FILE="$TMP/test.env" COMPOSE_FILE="$TMP/compose.yml" APP_DIR="$ROOT" \
  MIGRATION_AUTHORITY_DIR="$ROOT" DEPLOYMENT_LEDGER="$TMP/releases/deployments.jsonl" \
    bash "$ROOT/scripts/release-state.sh" "$@"
}

# Complete registry/checksum/ledger validation.
[ "$(run_state ledger-head)" = "0064" ] || fail "validated ledger head was not 0064"
run_state schema-guard | grep -q 'Schema compatibility OK' || fail "valid schema guard failed"

GAPPED="$TMP/gapped-ledger.txt"
grep -v '^0063|' "$VALID_LEDGER" > "$GAPPED"
out="$(LEDGER_ROWS_FILE="$GAPPED" expect_failure "gapped fake-head ledger" run_state schema-guard)"
grep -q 'ordering gap' <<<"$out" || fail "fake 0064 head did not fail as a ledger gap"

UNKNOWN="$TMP/unknown-ledger.txt"
cp "$VALID_LEDGER" "$UNKNOWN"
printf '9999|9999_fake.sql\n' >> "$UNKNOWN"
expect_failure "unknown migration row" env LEDGER_ROWS_FILE="$UNKNOWN" \
  PATH="$TMP/bin:$PATH" ENV_FILE="$TMP/test.env" COMPOSE_FILE="$TMP/compose.yml" \
  APP_DIR="$ROOT" MIGRATION_AUTHORITY_DIR="$ROOT" \
  bash "$ROOT/scripts/release-state.sh" ledger-head >/dev/null

TREE="$TMP/tree"
mkdir -p "$TREE/db" "$TREE/infra/db"
cp -R "$ROOT/db/migrations" "$TREE/db/"
cp "$ROOT/infra/db/init.prod.sql" "$ROOT/infra/db/production-migrations.sha256" "$TREE/infra/db/"
printf '\n-- mutation\n' >> "$TREE/db/migrations/0064_add_rentable_capacity_history.sql"
out="$(expect_failure "migration checksum mutation" env APP_DIR="$TREE" bash "$ROOT/scripts/release-state.sh" tree-level)"
grep -q 'checksum mismatch' <<<"$out" || fail "migration checksum mutation was not diagnosed"

# Strict audit schema and blocking write behavior.
audit_payload() {
  KAZA_AUDIT_EVENT=DEPLOYMENT_RESULT KAZA_AUDIT_SHA="$(printf 'a%.0s' {1..40})" \
  KAZA_AUDIT_CONTROL_SHA="$(printf 'b%.0s' {1..40})" KAZA_AUDIT_BRANCH=main \
  KAZA_AUDIT_ACTOR=test KAZA_AUDIT_RUN_ID=gh-100-1 KAZA_AUDIT_MODE=deploy \
  DEPLOY_WORKFLOW_RUN=https://github.com/HozaifaAlmelli/REMAL/actions/runs/100 \
  DEPLOY_AUTHORIZATION_REF=github-environment:production:100 \
  KAZA_AUDIT_TIMESTAMP=2026-08-23T00:00:01Z KAZA_AUDIT_STARTED_AT=2026-08-23T00:00:00Z \
  KAZA_AUDIT_PREVIOUS_SHA="" KAZA_AUDIT_MIGRATION_BEFORE=0064 KAZA_AUDIT_MIGRATION_AFTER=0064 \
  KAZA_AUDIT_BACKUP_ARTIFACT="" KAZA_AUDIT_RESULT=OK \
  KAZA_AUDIT_CHANGED_SERVICES='["api","demo","portal"]' \
  KAZA_AUDIT_IMAGE_IDS='{"api":"sha256:1111111111111111111111111111111111111111111111111111111111111111","demo":"sha256:2222222222222222222222222222222222222222222222222222222222222222","portal":"sha256:3333333333333333333333333333333333333333333333333333333333333333"}' \
  KAZA_AUDIT_ROLLBACK_IMAGES='{"api":"kaza-api:rollback-test","demo":"kaza-demo:rollback-test","portal":"kaza-portal:rollback-test"}' \
  KAZA_AUDIT_RECOVERY_MANIFEST=/tmp/recovery.json \
    python3 "$ROOT/scripts/lib/deployment-record.py" audit
}
payload="$(audit_payload)"
run_state record "$payload" >/dev/null
python3 -c 'import json,sys; json.loads(open(sys.argv[1],encoding="utf-8").read())' "$TMP/releases/deployments.jsonl"
[ "$(run_state latest-successful)" = "$payload" ] || fail "latest successful deployment record was not returned"
expect_failure "duplicate terminal deployment audit" run_state record "$payload" >/dev/null
expect_failure "malformed audit JSON" run_state record '{not-json}' >/dev/null
expect_failure "missing audit metadata" run_state record '{"sha":"x"}' >/dev/null
incomplete_success="$(python3 -c 'import json,sys; value=json.loads(sys.argv[1]); value["changed_services"]=["api"]; print(json.dumps(value,separators=(",",":")))' "$payload")"
expect_failure "incomplete successful audit" run_state record "$incomplete_success" >/dev/null
bad_payload="${payload/\"commit_sha\":\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\"/\"commit_sha\":\"old\"}"
expect_failure "malformed audit SHA" run_state record "$bad_payload" >/dev/null
bad_authorization="$(python3 -c 'import json,sys; p=json.loads(sys.argv[1]); p["authorization_ref"]="operator-said-ok"; print(json.dumps(p,separators=(",",":"),sort_keys=True))' "$payload")"
expect_failure "untrusted deployment authorization" run_state record "$bad_authorization" >/dev/null
manual_payload="$(KAZA_AUDIT_EVENT=DEPLOYMENT_RESULT KAZA_AUDIT_SHA="$(printf 'c%.0s' {1..40})" \
  KAZA_AUDIT_CONTROL_SHA="$(printf 'b%.0s' {1..40})" KAZA_AUDIT_BRANCH=main \
  KAZA_AUDIT_ACTOR=identified-operator KAZA_AUDIT_RUN_ID=manual-incident-123 KAZA_AUDIT_MODE=deploy \
  DEPLOY_WORKFLOW_RUN=manual DEPLOY_AUTHORIZATION_REF=emergency:INC-123 \
  KAZA_AUDIT_TIMESTAMP=2026-08-23T00:00:03Z KAZA_AUDIT_STARTED_AT=2026-08-23T00:00:02Z \
  KAZA_AUDIT_PREVIOUS_SHA="$(printf 'a%.0s' {1..40})" KAZA_AUDIT_MIGRATION_BEFORE=0064 KAZA_AUDIT_MIGRATION_AFTER=0064 \
  KAZA_AUDIT_BACKUP_ARTIFACT="" KAZA_AUDIT_RESULT=OK KAZA_AUDIT_CHANGED_SERVICES='["api","demo","portal"]' \
  KAZA_AUDIT_IMAGE_IDS='{"api":"sha256:1111111111111111111111111111111111111111111111111111111111111111","demo":"sha256:2222222222222222222222222222222222222222222222222222222222222222","portal":"sha256:3333333333333333333333333333333333333333333333333333333333333333"}' \
  KAZA_AUDIT_ROLLBACK_IMAGES='{"api":"kaza-api:rollback-manual","demo":"kaza-demo:rollback-manual","portal":"kaza-portal:rollback-manual"}' \
  KAZA_AUDIT_RECOVERY_MANIFEST=/tmp/recovery-manual.json \
    python3 "$ROOT/scripts/lib/deployment-record.py" audit)"
run_state record "$manual_payload" >/dev/null || fail "explicitly authorized manual operation was rejected"
anonymous_manual="$(python3 -c 'import json,sys; p=json.loads(sys.argv[1]); p["actor"]="manual"; print(json.dumps(p,separators=(",",":"),sort_keys=True))' "$manual_payload")"
expect_failure "anonymous manual deployment" run_state record "$anonymous_manual" >/dev/null
printf '{broken-existing-ledger\n' > "$TMP/releases/malformed-existing.jsonl"
expect_failure "malformed existing audit ledger" env DEPLOYMENT_LEDGER="$TMP/releases/malformed-existing.jsonl" \
  bash "$ROOT/scripts/release-state.sh" record "$payload" >/dev/null
printf '{"valid_json":"but_not_a_valid_audit_record"}\n' > "$TMP/releases/wrong-schema-existing.jsonl"
expect_failure "wrong-schema existing audit ledger" env DEPLOYMENT_LEDGER="$TMP/releases/wrong-schema-existing.jsonl" \
  bash "$ROOT/scripts/release-state.sh" record "$payload" >/dev/null
expect_failure "unwritable audit destination" env DEPLOYMENT_LEDGER=/dev/null/deployments.jsonl \
  bash "$ROOT/scripts/release-state.sh" record "$payload" >/dev/null

# A failed trusted-run manifest authorizes only its exact previous SHA. It is
# the narrow recovery exception to the normal successful-deployment rule.
RECOVERY_TARGET="$(printf 'c%.0s' {1..40})"
RECOVERY_PREVIOUS="$(printf 'd%.0s' {1..40})"
RECOVERY_CONTROL="$(printf 'e%.0s' {1..40})"
RECOVERY_MANIFEST="$TMP/releases/recovery-failed-run.json"
KAZA_AUDIT_SHA="$RECOVERY_TARGET" KAZA_AUDIT_CONTROL_SHA="$RECOVERY_CONTROL" \
KAZA_AUDIT_PREVIOUS_SHA="$RECOVERY_PREVIOUS" KAZA_AUDIT_RUN_ID=failed-run \
KAZA_RECOVERY_SOURCE_DIR=/opt/kaza/releases/candidate-test KAZA_RECOVERY_STATUS=FAILED \
KAZA_AUDIT_CHANGED_SERVICES='["api"]' \
KAZA_RECOVERY_PREVIOUS_IMAGE_IDS='{"api":"sha256:1111111111111111111111111111111111111111111111111111111111111111","demo":"sha256:2222222222222222222222222222222222222222222222222222222222222222","portal":"sha256:3333333333333333333333333333333333333333333333333333333333333333"}' \
KAZA_AUDIT_IMAGE_IDS='{"api":"sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","demo":"sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","portal":"sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"}' \
KAZA_AUDIT_ROLLBACK_IMAGES='{"api":"kaza-api:rollback-failed-run","demo":"kaza-demo:rollback-failed-run","portal":"kaza-portal:rollback-failed-run"}' \
  python3 "$ROOT/scripts/lib/deployment-record.py" recovery > "$RECOVERY_MANIFEST"
run_state recovery-authorizes "$RECOVERY_MANIFEST" "$RECOVERY_PREVIOUS" failed-run >/dev/null ||
  fail "failed trusted-run recovery manifest did not authorize its exact previous SHA"
expect_failure "recovery manifest wrong previous SHA" run_state recovery-authorizes \
  "$RECOVERY_MANIFEST" "$RECOVERY_TARGET" failed-run >/dev/null
expect_failure "recovery manifest wrong run id" run_state recovery-authorizes \
  "$RECOVERY_MANIFEST" "$RECOVERY_PREVIOUS" another-run >/dev/null
python3 - "$RECOVERY_MANIFEST" "$TMP/releases/recovery-deployed.json" <<'PY'
import json,sys
value=json.load(open(sys.argv[1],encoding="utf-8")); value["status"]="DEPLOYED"
json.dump(value,open(sys.argv[2],"w",encoding="utf-8"))
PY
expect_failure "non-failed recovery manifest" run_state recovery-authorizes \
  "$TMP/releases/recovery-deployed.json" "$RECOVERY_PREVIOUS" failed-run >/dev/null
ln -s "$RECOVERY_MANIFEST" "$TMP/releases/recovery-symlink.json"
expect_failure "symlink recovery manifest" run_state recovery-authorizes \
  "$TMP/releases/recovery-symlink.json" "$RECOVERY_PREVIOUS" failed-run >/dev/null

# Existing running images must reconcile to the last successful trusted audit.
PROVENANCE_SHA="$(printf '1%.0s' {1..40})"
PROVENANCE_CONTROL="$(printf '2%.0s' {1..40})"
PROVENANCE_LEDGER="$TMP/releases/provenance.jsonl"
KAZA_AUDIT_EVENT=DEPLOYMENT_RESULT KAZA_AUDIT_SHA="$PROVENANCE_SHA" \
KAZA_AUDIT_CONTROL_SHA="$PROVENANCE_CONTROL" KAZA_AUDIT_BRANCH=main \
KAZA_AUDIT_ACTOR=test KAZA_AUDIT_RUN_ID=gh-101-1 KAZA_AUDIT_MODE=deploy \
DEPLOY_WORKFLOW_RUN=https://github.com/HozaifaAlmelli/REMAL/actions/runs/101 \
DEPLOY_AUTHORIZATION_REF=github-environment:production:101 \
KAZA_AUDIT_TIMESTAMP=2026-08-23T00:00:01Z KAZA_AUDIT_STARTED_AT=2026-08-23T00:00:00Z \
KAZA_AUDIT_PREVIOUS_SHA="" KAZA_AUDIT_MIGRATION_BEFORE=0064 KAZA_AUDIT_MIGRATION_AFTER=0064 \
KAZA_AUDIT_BACKUP_ARTIFACT="" KAZA_AUDIT_RESULT=OK \
KAZA_AUDIT_CHANGED_SERVICES='["api","demo","portal"]' \
KAZA_AUDIT_IMAGE_IDS='{"api":"sha256:1111111111111111111111111111111111111111111111111111111111111111","demo":"sha256:2222222222222222222222222222222222222222222222222222222222222222","portal":"sha256:3333333333333333333333333333333333333333333333333333333333333333"}' \
KAZA_AUDIT_ROLLBACK_IMAGES='{"api":"kaza-api:rollback","demo":"kaza-demo:rollback","portal":"kaza-portal:rollback"}' \
KAZA_AUDIT_RECOVERY_MANIFEST=/tmp/recovery.json \
  python3 "$ROOT/scripts/lib/deployment-record.py" audit > "$PROVENANCE_LEDGER"
[ "$(DEPLOYMENT_LEDGER="$PROVENANCE_LEDGER" bash "$ROOT/scripts/release-state.sh" \
  deployed-image-id "$PROVENANCE_SHA" api)" = "sha256:1111111111111111111111111111111111111111111111111111111111111111" ] ||
  fail "trusted audit did not return the exact deployed API image id"
expect_failure "successful history reported as empty" env DEPLOYMENT_LEDGER="$PROVENANCE_LEDGER" \
  bash "$ROOT/scripts/release-state.sh" no-successful-deployments >/dev/null

PROVENANCE_REPO="$TMP/provenance-repo"
mkdir -p "$PROVENANCE_REPO"; git -C "$PROVENANCE_REPO" init -q
git -C "$PROVENANCE_REPO" config user.email test@example.com; git -C "$PROVENANCE_REPO" config user.name Test
printf 'legacy\n' > "$PROVENANCE_REPO/app"; git -C "$PROVENANCE_REPO" add .
git -C "$PROVENANCE_REPO" commit -qm legacy; LEGACY_RUNTIME_SHA="$(git -C "$PROVENANCE_REPO" rev-parse HEAD)"
(
  docker() {
    local joined="$*" service="${*: -1}"
    if [ "${RECOVERY_RUNTIME:-0}" = "1" ]; then
      case "$joined" in
        *'{{.Image}}'*)
          case "$service" in
            *api) echo sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa ;;
            *demo) echo sha256:2222222222222222222222222222222222222222222222222222222222222222 ;;
            *portal) echo sha256:3333333333333333333333333333333333333333333333333333333333333333 ;;
          esac ;;
        *org.opencontainers.image.revision*) case "$service" in *api) echo "$RECOVERY_TARGET" ;; *) echo "$RECOVERY_PREVIOUS" ;; esac ;;
        *com.kaza.deployment.control-revision*) echo "$RECOVERY_CONTROL" ;;
        *) return 90 ;;
      esac
      return
    fi
    case "$joined" in
      *'{{.Image}}'*)
        case "$service" in
          *api) echo "${STUB_RUNTIME_IMAGE:-sha256:1111111111111111111111111111111111111111111111111111111111111111}" ;;
          *demo) echo sha256:2222222222222222222222222222222222222222222222222222222222222222 ;;
          *portal) echo sha256:3333333333333333333333333333333333333333333333333333333333333333 ;;
        esac ;;
      *org.opencontainers.image.revision*) echo "${STUB_RUNTIME_REVISION:-$PROVENANCE_SHA}" ;;
      *com.kaza.deployment.control-revision*) echo "$PROVENANCE_CONTROL" ;;
      *'{{.State.Running}}'*) echo true ;;
      *com.docker.compose.project*) echo kaza-prod ;;
      *com.docker.compose.service*) case "$service" in *api) echo api ;; *demo) echo demo ;; *portal) echo portal ;; esac ;;
      *) return 90 ;;
    esac
  }
  source "$ROOT/scripts/lib/image-provenance.sh"
  verify_existing_runtime_provenance "$PROVENANCE_SHA" "$PROVENANCE_SHA" "$PROVENANCE_SHA" \
    "$PROVENANCE_REPO" "$PROVENANCE_LEDGER" 0 "$ROOT"
  STUB_RUNTIME_IMAGE=sha256:9999 expect_failure "manual running-image drift" \
    verify_existing_runtime_provenance "$PROVENANCE_SHA" "$PROVENANCE_SHA" "$PROVENANCE_SHA" \
      "$PROVENANCE_REPO" "$PROVENANCE_LEDGER" 0 "$ROOT" >/dev/null

  EMPTY_LEDGER="$TMP/releases/legacy-empty.jsonl"
  : > "$EMPTY_LEDGER"
  STUB_RUNTIME_REVISION=prod expect_failure "legacy baseline without explicit approval" \
    verify_existing_runtime_provenance "$LEGACY_RUNTIME_SHA" "$PROVENANCE_CONTROL" "$PROVENANCE_CONTROL" \
      "$PROVENANCE_REPO" "$EMPTY_LEDGER" 0 "$ROOT" >/dev/null
  STUB_RUNTIME_REVISION=prod verify_existing_runtime_provenance \
    "$LEGACY_RUNTIME_SHA" "$PROVENANCE_CONTROL" "$PROVENANCE_CONTROL" \
    "$PROVENANCE_REPO" "$EMPTY_LEDGER" 1 "$ROOT"
  STUB_RUNTIME_REVISION=prod expect_failure "legacy baseline for historical target" \
    verify_existing_runtime_provenance "$LEGACY_RUNTIME_SHA" "$LEGACY_RUNTIME_SHA" "$PROVENANCE_CONTROL" \
      "$PROVENANCE_REPO" "$EMPTY_LEDGER" 1 "$ROOT" >/dev/null
  RECOVERY_RUNTIME=1 verify_existing_runtime_provenance \
    "$RECOVERY_PREVIOUS" "$RECOVERY_PREVIOUS" "$PROVENANCE_CONTROL" \
    "$PROVENANCE_REPO" "$PROVENANCE_LEDGER" 0 "$ROOT" "$RECOVERY_MANIFEST"
) || fail "existing runtime provenance tests failed"

# Host lock is shared, fail-fast and released by process exit.
command -v flock >/dev/null 2>&1 || fail "flock is required by the production contract"
cat > "$TMP/hold-lock.sh" <<SH
#!/usr/bin/env bash
set -Eeuo pipefail
source "$ROOT/scripts/lib/production-lock.sh"
production_lock_acquire
echo locked
sleep "\${1:-0}"
SH
chmod +x "$TMP/hold-lock.sh"
PRODUCTION_LOCK_FILE="$TMP/production.lock" "$TMP/hold-lock.sh" 2 > "$TMP/lock-a.log" & lock_pid=$!
for _ in {1..50}; do grep -q locked "$TMP/lock-a.log" && break; sleep .05; done
out="$(expect_failure "concurrent production lock" env PRODUCTION_LOCK_FILE="$TMP/production.lock" "$TMP/hold-lock.sh" 0)"
grep -q 'another Kaza production' <<<"$out" || fail "lock contention diagnostic missing"
wait "$lock_pid"
PRODUCTION_LOCK_FILE="$TMP/production.lock" "$TMP/hold-lock.sh" 0 >/dev/null || fail "lock was orphaned"
exec 9>"$TMP/not-the-production-lock"
expect_failure "forged inherited lock descriptor" env KAZA_PRODUCTION_LOCK_FD=9 \
  PRODUCTION_LOCK_FILE="$TMP/production.lock" "$TMP/hold-lock.sh" 0 >/dev/null
exec 9>&-

# Built/running image verification is content-addressed, not label-only.
cat > "$TMP/bin/docker-image" <<'SH'
#!/usr/bin/env bash
case "$*" in
  *'image inspect'*'{{.Id}}'*) echo "${STUB_IMAGE_ID:-sha256:good}" ;;
  *'image inspect'*'org.opencontainers.image.revision'*) echo "${STUB_REVISION:-target}" ;;
  *'image inspect'*'com.kaza.deployment.control-revision'*) echo "${STUB_CONTROL:-control}" ;;
  *'inspect'*'{{.Image}}'*) echo "${STUB_RUNNING_ID:-sha256:good}" ;;
  *'inspect'*'org.opencontainers.image.revision'*) echo "${STUB_REVISION:-target}" ;;
  *'inspect'*'com.kaza.deployment.control-revision'*) echo "${STUB_CONTROL:-control}" ;;
  *) exit 90 ;;
esac
SH
chmod +x "$TMP/bin/docker-image"
(
  docker() { "$TMP/bin/docker-image" "$@"; }
  source "$ROOT/scripts/lib/image-provenance.sh"
  [ "$(verify_built_image_provenance kaza-api:target target control)" = sha256:good ]
  verify_running_image_provenance kaza-prod-api sha256:good target control
  STUB_RUNNING_ID=sha256:wrong expect_failure "running image id mismatch" \
    verify_running_image_provenance kaza-prod-api sha256:good target control >/dev/null
) || fail "image provenance tests failed"

# Main-only GitHub environment contract.
cp "$ROOT/.github/production-environment-policy.json" "$TMP/policy-good.json"
bash "$ROOT/scripts/verify-production-environment-policy.sh" "$TMP/policy-good.json" >/dev/null
python3 - "$TMP/policy-good.json" "$TMP/policy-bad.json" <<'PY'
import json,sys
p=json.load(open(sys.argv[1],encoding="utf-8")); p["allowedBranches"]=["dev","main"]
json.dump(p,open(sys.argv[2],"w",encoding="utf-8"))
PY
expect_failure "dev allowed in production environment" bash "$ROOT/scripts/verify-production-environment-policy.sh" "$TMP/policy-bad.json" >/dev/null
python3 - "$TMP/policy-good.json" "$TMP/policy-password.json" <<'PY'
import json,sys
p=json.load(open(sys.argv[1],encoding="utf-8")); p["allowedSecrets"].append("SSH_PASSWORD")
json.dump(p,open(sys.argv[2],"w",encoding="utf-8"))
PY
expect_failure "password secret allowed in production environment" \
  bash "$ROOT/scripts/verify-production-environment-policy.sh" "$TMP/policy-password.json" >/dev/null
python3 - "$TMP/policy-good.json" "$TMP/policy-reviewer.json" <<'PY'
import json,sys
p=json.load(open(sys.argv[1],encoding="utf-8")); p["requiredReviewers"]=p["requiredReviewers"][:1]
json.dump(p,open(sys.argv[2],"w",encoding="utf-8"))
PY
expect_failure "production environment missing independent reviewer" \
  bash "$ROOT/scripts/verify-production-environment-policy.sh" "$TMP/policy-reviewer.json" >/dev/null

# Historical targets cannot execute their own deployment scripts.
OLD_REPO="$TMP/old-target-repo"
mkdir -p "$OLD_REPO"; git -C "$OLD_REPO" init -q; git -C "$OLD_REPO" config user.email test@example.com; git -C "$OLD_REPO" config user.name Test
mkdir -p "$OLD_REPO/scripts/lib"
printf 'old\n' > "$OLD_REPO/app.txt"
git -C "$OLD_REPO" add .; git -C "$OLD_REPO" commit -qm old; OLD_SHA="$(git -C "$OLD_REPO" rev-parse HEAD)"
cp "$ROOT/scripts/production-dispatch.sh" "$OLD_REPO/scripts/production-dispatch.sh"
cp "$ROOT/scripts/lib/production-lock.sh" "$OLD_REPO/scripts/lib/production-lock.sh"
cp "$ROOT/scripts/lib/deployment-authorization.sh" "$OLD_REPO/scripts/lib/deployment-authorization.sh"
cat > "$OLD_REPO/scripts/release-state.sh" <<'SH'
#!/usr/bin/env bash
[ "${1:-}" != successful-deployment ]
SH
chmod +x "$OLD_REPO/scripts/release-state.sh"
printf 'current\n' > "$OLD_REPO/app.txt"
git -C "$OLD_REPO" add .; git -C "$OLD_REPO" commit -qm current; CURRENT_SHA="$(git -C "$OLD_REPO" rev-parse HEAD)"
git -C "$OLD_REPO" branch -M main; git -C "$OLD_REPO" remote add origin "$OLD_REPO"; git -C "$OLD_REPO" update-ref refs/remotes/origin/main "$CURRENT_SHA"
printf '%s\n' "$OLD_SHA" > "$TMP/releases/previous-sha.txt"
out="$(expect_failure "unrecorded old SHA" env CONTROL_DIR="$OLD_REPO" LIVE_DIR="$OLD_REPO" RELEASES_DIR="$TMP/releases" \
  PRODUCTION_LOCK_FILE="$TMP/old-target.lock" DEPLOY_ACTOR=test DEPLOY_BRANCH=main \
  DEPLOY_RUN_ID=gh-103-1 DEPLOY_WORKFLOW_RUN=https://github.com/HozaifaAlmelli/REMAL/actions/runs/103 \
  DEPLOY_AUTHORIZATION_REF=github-environment:production:103 \
  bash "$OLD_REPO/scripts/production-dispatch.sh" "$OLD_SHA" deploy)"
grep -q 'no successful trusted deployment record' <<<"$out" || fail "old target refusal was not explicit"

# The sent bootstrap ignores an unsafe historical runner and uses current main control.
BOOT="$TMP/bootstrap-repo"; mkdir -p "$BOOT"; git -C "$BOOT" init -q; git -C "$BOOT" config user.email test@example.com; git -C "$BOOT" config user.name Test
mkdir -p "$BOOT/scripts"
printf 'legacy\n' > "$BOOT/app.txt"
cat > "$BOOT/scripts/deploy-production.sh" <<'SH'
#!/usr/bin/env bash
echo unsafe-old-runner > "$OLD_RUNNER_MARKER"
SH
chmod +x "$BOOT/scripts/deploy-production.sh"
git -C "$BOOT" add .; git -C "$BOOT" commit -qm legacy; LEGACY_SHA="$(git -C "$BOOT" rev-parse HEAD)"
cat > "$BOOT/scripts/production-dispatch.sh" <<'SH'
#!/usr/bin/env bash
printf '%s|%s\n' "$1" "$2" > "$BOOTSTRAP_MARKER"
SH
chmod +x "$BOOT/scripts/production-dispatch.sh"
printf 'current\n' > "$BOOT/app.txt"; git -C "$BOOT" add .; git -C "$BOOT" commit -qm control; BOOT_SHA="$(git -C "$BOOT" rev-parse HEAD)"
git -C "$BOOT" branch -M main; git -C "$BOOT" remote add origin "$BOOT"; git -C "$BOOT" update-ref refs/remotes/origin/main "$BOOT_SHA"; git -C "$BOOT" checkout -q "$LEGACY_SHA"
BOOT_RELEASES="$TMP/bootstrap-releases"; mkdir -p "$BOOT_RELEASES"
BOOTSTRAP_MARKER="$TMP/bootstrap.marker" OLD_RUNNER_MARKER="$TMP/old-runner.marker" \
CONTROL_SHA="$BOOT_SHA" DEPLOY_SHA="$LEGACY_SHA" DEPLOY_MODE=deploy \
DEPLOY_ACTOR=test DEPLOY_RUN_ID=gh-102-1 DEPLOY_BRANCH=main \
DEPLOY_WORKFLOW_RUN=https://github.com/HozaifaAlmelli/REMAL/actions/runs/102 \
DEPLOY_AUTHORIZATION_REF=github-environment:production:102 \
APP_DIR="$BOOT" ENV_FILE="$TMP/test.env" RELEASES_DIR="$BOOT_RELEASES" \
  bash "$ROOT/scripts/bootstrap-production-control.sh"
[ "$(cat "$TMP/bootstrap.marker")" = "$LEGACY_SHA|deploy" ] || fail "old-checkout bootstrap did not use current main control"
[ ! -e "$TMP/old-runner.marker" ] || fail "historical application deployment script was executed"

# Dirty candidates fail before Docker/build activity.
DIRTY="$TMP/dirty"; mkdir -p "$DIRTY"; git -C "$DIRTY" init -q; git -C "$DIRTY" config user.email test@example.com; git -C "$DIRTY" config user.name Test
printf x > "$DIRTY/app"; git -C "$DIRTY" add .; git -C "$DIRTY" commit -qm clean; DIRTY_SHA="$(git -C "$DIRTY" rev-parse HEAD)"; printf dirty >> "$DIRTY/app"
printf '{}' > "$TMP/smoke.json"; chmod 600 "$TMP/smoke.json"
out="$(expect_failure "dirty application candidate" env CONTROL_DIR="$ROOT" SOURCE_DIR="$DIRTY" RELEASES_DIR="$TMP/releases" \
  ENV_FILE="$TMP/test.env" AUTH_SMOKE_CREDENTIALS_FILE="$TMP/smoke.json" PRODUCTION_LOCK_FILE="$TMP/dirty.lock" \
  bash "$ROOT/scripts/deploy-production.sh" "$DIRTY_SHA")"
grep -q 'application candidate is dirty' <<<"$out" || fail "dirty candidate was not refused before build"

# Read-only auth smoke: exactly the three login endpoints, no secrets in output.
cat > "$TMP/auth.json" <<'JSON'
{"admin":{"email":"admin@example.test","password":"admin-secret"},"owner":{"phone":"111","password":"owner-secret"},"client":{"phone":"222","password":"client-secret"}}
JSON
chmod 600 "$TMP/auth.json"
cat > "$TMP/bin/curl" <<'SH'
#!/usr/bin/env bash
output="" url=""
while [ "$#" -gt 0 ]; do
  case "$1" in -o) output="$2"; shift 2 ;; http*) url="$1"; shift ;; *) shift ;; esac
done
subject="${url%/login}"; subject="${subject##*/}"
printf '{"success":true,"data":{"accessToken":"test-token","subjectType":"%s"}}' "${subject^}" > "$output"
printf '%s\n' "$url" >> "$SMOKE_CALLS"
printf 200
SH
chmod +x "$TMP/bin/curl"
smoke_out="$(PATH="$TMP/bin:$PATH" SMOKE_CALLS="$TMP/smoke.calls" AUTH_SMOKE_CREDENTIALS_FILE="$TMP/auth.json" API_BASE_URL=https://example.test \
  bash "$ROOT/scripts/smoke-production-auth.sh")"
[ "$(wc -l < "$TMP/smoke.calls")" -eq 3 ] || fail "auth smoke did not make exactly three calls"
grep -Ev '/api/auth/(admin|owner|client)/login$' "$TMP/smoke.calls" | grep -q . && fail "auth smoke called a mutating/unknown endpoint"
grep -Eq 'admin-secret|owner-secret|client-secret|test-token' <<<"$smoke_out" && fail "auth smoke leaked a secret"

# Static trust and recovery invariants.
WF="$ROOT/.github/workflows/deploy-production.yml"; DEPLOY="$ROOT/scripts/deploy-production.sh"; RELEASE="$ROOT/scripts/release-production.sh"
MIGRATE="$ROOT/scripts/apply-migrations.sh"
grep -q 'refs/heads/main' "$WF" || fail "workflow lacks runtime main-ref guard"
grep -qE 'actions/checkout@[0-9a-f]{40}' "$WF" || fail "checkout action is not commit-pinned"
grep -qE 'appleboy/ssh-action@[0-9a-f]{40}' "$WF" || fail "SSH action is not commit-pinned"
if grep -R -E 'uses:[[:space:]]+[^#[:space:]]+@v[0-9]' "$ROOT/.github/workflows"; then
  fail "a GitHub workflow still uses a mutable major-version action tag"
fi
grep -q 'fingerprint:.*SSH_HOST_FINGERPRINT' "$WF" || fail "SSH host fingerprint is not pinned"
grep -qE '^[[:space:]]+password:' "$WF" && fail "workflow contains an SSH password input"
grep -q 'script_path: scripts/bootstrap-production-control.sh' "$WF" || fail "workflow does not send trusted bootstrap"
grep -q 'RECOVERY_RUN_ID' "$WF" || fail "workflow does not carry explicit failed-run recovery identity"
grep -q 'APPROVE_UNVERIFIED_LEGACY_REPLACEMENT' "$WF" || fail "workflow lacks explicit one-time legacy replacement approval"
grep -q 'rev-parse --is-inside-work-tree' "$DEPLOY" || fail "deploy does not accept real Git worktree candidates"
grep -q 'rev-parse --is-inside-work-tree' "$RELEASE" || fail "release does not accept real Git worktree candidates"
grep -q 'compose up -d --no-deps db' "$DEPLOY" && fail "code deploy can recreate the database"
grep -q 'production_lock_acquire' "$MIGRATE" || fail "direct migration execution is outside the host operation lock"
grep -q 'find .*BACKUP_DIR' "$RELEASE" && fail "release still discovers the newest backup by timestamp"
grep -q 'RELEASE_PRE_DEPLOY_HOOK\|RELEASE_POST_DEPLOY_HOOK' "$RELEASE" && fail "arbitrary release hook remains"
recovery_line="$(grep -n 'write_recovery_manifest PREPARED' "$DEPLOY" | cut -d: -f1)"
up_line="$(grep -n 'compose up -d --no-deps --no-build' "$DEPLOY" | head -1 | cut -d: -f1)"
[ "$recovery_line" -lt "$up_line" ] || fail "recovery evidence is created after mutation"
grep -q 'recovery-authorizes' "$ROOT/scripts/production-dispatch.sh" ||
  fail "trusted dispatcher cannot validate a failed-run recovery target"
preflight_line="$(grep -n 'verify_existing_runtime_provenance' "$RELEASE" | head -1 | cut -d: -f1)"
migrate_line="$(grep -n 'scripts/apply-migrations.sh' "$RELEASE" | head -1 | cut -d: -f1)"
[ "$preflight_line" -lt "$migrate_line" ] || fail "release validates runtime provenance after migration starts"

echo "PASS: trusted runner, full ledger, locking, provenance, audit, backup, environment, bootstrap and smoke guards"
