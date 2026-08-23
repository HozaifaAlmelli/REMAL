#!/usr/bin/env bash
# Read-only reconciliation of the Kaza production application, artifact and DB identity.
set -Eeuo pipefail

CONTROL_DIR="${CONTROL_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
LIVE_DIR="${LIVE_DIR:-/opt/apps/kaza-booking}"
ENV_FILE="${ENV_FILE:-/opt/kaza/env/.env.production}"
RELEASES_DIR="${RELEASES_DIR:-/opt/kaza/releases}"
PROJECT="${PROJECT:-kaza-prod}"
EXPECTED_SHA="${EXPECTED_SHA:-}"
RELEASE_STATE_SCRIPT="${RELEASE_STATE_SCRIPT:-$CONTROL_DIR/scripts/release-state.sh}"
PRODUCTION_LOCK_SCRIPT="${PRODUCTION_LOCK_SCRIPT:-$CONTROL_DIR/scripts/lib/production-lock.sh}"
DEPLOYMENT_LEDGER="$RELEASES_DIR/deployments.jsonl"

# shellcheck disable=SC1090 # selected trusted-control path is validated by the caller
source "$PRODUCTION_LOCK_SCRIPT"
production_lock_acquire

[ "$(git -C "$CONTROL_DIR" rev-parse --is-inside-work-tree 2>/dev/null)" = "true" ] || {
  echo "FATAL: trusted control source is not a Git worktree" >&2
  exit 1
}
[ -z "$(git -C "$CONTROL_DIR" status --porcelain)" ] || {
  echo "FATAL: trusted control source is dirty" >&2
  exit 1
}
CONTROL_SHA="$(git -C "$CONTROL_DIR" rev-parse HEAD)"
MAIN_SHA="$(git -C "$CONTROL_DIR" rev-parse refs/remotes/origin/main 2>/dev/null)" || {
  echo "FATAL: trusted control source has no origin/main reference" >&2
  exit 1
}
[ "$CONTROL_SHA" = "$MAIN_SHA" ] || {
  echo "FATAL: production identity must be inspected with the current origin/main control plane" >&2
  exit 1
}
[ -d "$LIVE_DIR/.git" ] || { echo "FATAL: live repository is missing" >&2; exit 1; }
[ -s "$ENV_FILE" ] || { echo "FATAL: production env file is missing or empty" >&2; exit 1; }
[ -z "$(git -C "$LIVE_DIR" status --porcelain)" ] || {
  echo "FATAL: live repository is dirty" >&2
  exit 1
}
if [ -n "$EXPECTED_SHA" ] && [[ ! "$EXPECTED_SHA" =~ ^[0-9a-f]{40}$ ]]; then
  echo "FATAL: expected SHA must be a full lowercase commit id" >&2
  exit 64
fi

read_state_file() {
  local path="$1" value
  if [ ! -s "$path" ] || [ -L "$path" ]; then
    printf ''
    return
  fi
  value="$(head -n 1 "$path")"
  printf '%s' "$value"
}

LIVE_HEAD="$(git -C "$LIVE_DIR" rev-parse HEAD)"
LIVE_BRANCH="$(git -C "$LIVE_DIR" symbolic-ref --short -q HEAD || printf 'DETACHED')"
CURRENT_SHA="$(read_state_file "$RELEASES_DIR/current-sha.txt")"
PREVIOUS_SHA="$(read_state_file "$RELEASES_DIR/previous-sha.txt")"
MIGRATION_HEAD="$(APP_DIR="$CONTROL_DIR" COMPOSE_FILE="$LIVE_DIR/docker-compose.prod.yml" \
  MIGRATION_AUTHORITY_DIR="$CONTROL_DIR" ENV_FILE="$ENV_FILE" \
  bash "$RELEASE_STATE_SCRIPT" ledger-head)"

container_rows=()
for service in api demo portal; do
  container="kaza-prod-$service"
  docker inspect "$container" >/dev/null 2>&1 || {
    echo "FATAL: required application container is missing: $container" >&2
    exit 1
  }
  container_rows+=("$(docker inspect -f \
    "$service|{{.Id}}|{{.Image}}|{{.Created}}|{{.State.StartedAt}}|{{.State.Running}}|{{index .Config.Labels \"com.docker.compose.project\"}}|{{index .Config.Labels \"com.docker.compose.service\"}}|{{index .Config.Labels \"org.opencontainers.image.revision\"}}|{{index .Config.Labels \"com.kaza.deployment.control-revision\"}}" \
    "$container")")
done

LATEST_AUDIT=""
set +e
LATEST_AUDIT="$(DEPLOYMENT_LEDGER="$DEPLOYMENT_LEDGER" \
  bash "$RELEASE_STATE_SCRIPT" latest-successful)"
audit_status=$?
set -e
case "$audit_status" in
  0) ;;
  3) LATEST_AUDIT="" ;;
  *) echo "FATAL: deployment audit ledger is invalid or unreadable" >&2; exit 1 ;;
esac

KAZA_STATE_OBSERVED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
export KAZA_STATE_OBSERVED_AT
export KAZA_STATE_CONTROL_SHA="$CONTROL_SHA" KAZA_STATE_LIVE_HEAD="$LIVE_HEAD"
export KAZA_STATE_LIVE_BRANCH="$LIVE_BRANCH" KAZA_STATE_CURRENT_SHA="$CURRENT_SHA"
export KAZA_STATE_PREVIOUS_SHA="$PREVIOUS_SHA" KAZA_STATE_MIGRATION_HEAD="$MIGRATION_HEAD"
export KAZA_STATE_EXPECTED_SHA="$EXPECTED_SHA" KAZA_STATE_AUDIT="$LATEST_AUDIT"
KAZA_STATE_CONTAINERS="$(printf '%s\n' "${container_rows[@]}")"
export KAZA_STATE_CONTAINERS

set +e
python3 - <<'PY'
import json
import os
import re


def clean_label(value: str) -> str:
    return "" if value in {"", "<no value>"} else value


services = {"api", "demo", "portal"}
containers = {}
for line in os.environ["KAZA_STATE_CONTAINERS"].splitlines():
    service, container_id, image_id, created, started, running, project, compose_service, revision, control = line.split("|", 9)
    containers[service] = {
        "containerId": container_id,
        "imageDigest": image_id,
        "createdAt": created,
        "startedAt": started,
        "running": running == "true",
        "composeProject": clean_label(project),
        "composeService": clean_label(compose_service),
        "commitSha": clean_label(revision),
        "controlSha": clean_label(control),
    }

reasons = []
audit_raw = os.environ.get("KAZA_STATE_AUDIT", "")
audit = json.loads(audit_raw) if audit_raw else None
claimed = os.environ.get("KAZA_STATE_CURRENT_SHA", "")
live_head = os.environ["KAZA_STATE_LIVE_HEAD"]
migration_head = os.environ["KAZA_STATE_MIGRATION_HEAD"]
expected = os.environ.get("KAZA_STATE_EXPECTED_SHA", "")

if audit is None:
    status = "UNVERIFIED_LEGACY"
    reasons.append("no_successful_trusted_deployment_record")
    authoritative_sha = None
    deployment_id = None
    deployment = None
else:
    authoritative_sha = audit["commit_sha"]
    deployment_id = audit["deployment_id"]
    deployment = {
        "id": deployment_id,
        "actor": audit["actor"],
        "branch": audit["branch"],
        "workflowRun": audit["workflow_run"],
        "authorizationRef": audit["authorization_ref"],
        "mode": audit["mode"],
        "timestamp": audit["timestamp"],
        "previousVersion": audit["previous_version"] or None,
        "databaseMigrationBefore": audit["database_migration_before"],
        "databaseMigrationAfter": audit["database_migration_after"],
        "backupArtifact": audit["backup_artifact"] or None,
        "result": audit["result"],
    }
    if claimed != authoritative_sha:
        reasons.append("current_sha_mismatch")
    if live_head != authoritative_sha:
        reasons.append("live_checkout_mismatch")
    if migration_head != audit["database_migration_after"]:
        reasons.append("migration_head_mismatch")
    for service in sorted(services):
        current = containers[service]
        if not current["running"]:
            reasons.append(f"{service}_not_running")
        if current["composeProject"] != "kaza-prod" or current["composeService"] != service:
            reasons.append(f"{service}_compose_identity_mismatch")
        if current["imageDigest"] != audit["image_digests"][service]:
            reasons.append(f"{service}_image_digest_mismatch")
        if current["commitSha"] != authoritative_sha:
            reasons.append(f"{service}_commit_label_mismatch")
        if current["controlSha"] != audit["control_sha"]:
            reasons.append(f"{service}_control_label_mismatch")
    status = "GOVERNED" if not reasons else "DRIFTED"

if expected and authoritative_sha != expected:
    reasons.append("expected_sha_mismatch")
    status = "DRIFTED" if audit is not None else status

result = {
    "schema": "kaza-production-state-v1",
    "observedAt": os.environ["KAZA_STATE_OBSERVED_AT"],
    "governanceStatus": status,
    "deploymentId": deployment_id,
    "deployment": deployment,
    "commitSha": authoritative_sha,
    "claimedCommitSha": claimed if re.fullmatch(r"[0-9a-f]{40}", claimed) else None,
    "liveCheckoutSha": live_head,
    "liveCheckoutBranch": os.environ["KAZA_STATE_LIVE_BRANCH"],
    "controlSha": os.environ["KAZA_STATE_CONTROL_SHA"],
    "previousVersion": os.environ.get("KAZA_STATE_PREVIOUS_SHA") or None,
    "databaseMigrationHead": migration_head,
    "imageDigests": {key: value["imageDigest"] for key, value in sorted(containers.items())},
    "containers": containers,
    "reconciliationFailures": reasons,
}
print(json.dumps(result, separators=(",", ":"), sort_keys=True))
raise SystemExit(0 if status == "GOVERNED" else 2)
PY
status=$?
set -e

case "$status" in
  0) echo "### Production identity: GOVERNED" >&2 ;;
  2) echo "FATAL: production identity is not governed; inspect reconciliationFailures" >&2 ;;
  *) echo "FATAL: production identity reconciliation failed" >&2 ;;
esac
exit "$status"
