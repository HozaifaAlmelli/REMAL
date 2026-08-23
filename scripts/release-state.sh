#!/usr/bin/env bash
# Production release state and audit authority. Migration state is validated
# against the existing ordered registry/checksum system; max(number) is never a
# sufficient schema proof.
set -Eeuo pipefail

ENV_FILE="${ENV_FILE:-/opt/kaza/env/.env.production}"
COMPOSE_FILE="${COMPOSE_FILE:-/opt/apps/kaza-booking/docker-compose.prod.yml}"
APP_DIR="${APP_DIR:-/opt/apps/kaza-booking}"
MIG_DIR="${MIG_DIR:-$APP_DIR/db/migrations}"
PRODUCTION_MANIFEST="${PRODUCTION_MANIFEST:-$APP_DIR/infra/db/init.prod.sql}"
MIGRATION_CHECKSUMS="${MIGRATION_CHECKSUMS:-$APP_DIR/infra/db/production-migrations.sha256}"
MIGRATION_AUTHORITY_DIR="${MIGRATION_AUTHORITY_DIR:-$APP_DIR}"
AUTHORITY_MIG_DIR="${AUTHORITY_MIG_DIR:-$MIGRATION_AUTHORITY_DIR/db/migrations}"
AUTHORITY_MANIFEST="${AUTHORITY_MANIFEST:-$MIGRATION_AUTHORITY_DIR/infra/db/init.prod.sql}"
AUTHORITY_CHECKSUMS="${AUTHORITY_CHECKSUMS:-$MIGRATION_AUTHORITY_DIR/infra/db/production-migrations.sha256}"
DEPLOYMENT_LEDGER="${DEPLOYMENT_LEDGER:-/opt/kaza/releases/deployments.jsonl}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=scripts/lib/production-migrations.sh
source "$SCRIPT_DIR/lib/production-migrations.sh"

usage() {
  echo "usage: release-state.sh <ledger-head|tree-level|schema-guard|record|successful-deployment|latest-successful|deployed-image-id|no-successful-deployments|recovery-authorizes>" >&2
  exit 64
}

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

load_registry() {
  local root="$1" manifest="$2" checksums="$3" output
  output="$(list_production_migrations "$manifest" "$root")"
  mapfile -t MIGRATION_FILES <<< "$output"
  validate_production_migration_checksums "$checksums" "$root" "${MIGRATION_FILES[@]}"
}

tree_level() {
  load_registry "$MIG_DIR" "$PRODUCTION_MANIFEST" "$MIGRATION_CHECKSUMS"
  local last="${MIGRATION_FILES[${#MIGRATION_FILES[@]}-1]}"
  printf '%s\n' "${last:0:4}"
}

read_and_validate_ledger() {
  local ledger_table ledger_columns ledger_rows
  load_db_identifiers >&2
  load_registry "$AUTHORITY_MIG_DIR" "$AUTHORITY_MANIFEST" "$AUTHORITY_CHECKSUMS"
  ledger_table="$(psql_db -c "SELECT to_regclass('public.schema_migrations') IS NOT NULL;")"
  [ "$ledger_table" = "t" ] || { echo "REFUSING: schema_migrations is missing" >&2; return 1; }
  ledger_columns="$(psql_db -c "
    SELECT count(*) FROM information_schema.columns
    WHERE table_schema='public' AND table_name='schema_migrations'
      AND column_name IN ('id','migration_number','migration_name','applied_at');")"
  [ "$ledger_columns" = "4" ] || { echo "REFUSING: schema_migrations has an unsupported shape" >&2; return 1; }
  ledger_rows="$(psql_db -F '|' -c "
    SELECT migration_number, COALESCE(migration_name, '')
    FROM schema_migrations ORDER BY id;")"
  validate_migration_ledger_rows "$ledger_rows" "${MIGRATION_FILES[@]}"
}

ledger_head() {
  read_and_validate_ledger
  [ "$MIGRATION_LEDGER_APPLIED_COUNT" -gt 0 ] || {
    echo "REFUSING: schema_migrations has no validated entries" >&2; return 1; }
  local last="${MIGRATION_FILES[$((MIGRATION_LEDGER_APPLIED_COUNT - 1))]}"
  printf '%s\n' "${last:0:4}"
}

schema_guard() {
  local db_head tree_req
  tree_req="$(tree_level)"
  db_head="$(ledger_head)"
  echo "### Schema compatibility: validated database head=$db_head, validated tree requires=$tree_req"
  if [ "$db_head" \< "$tree_req" ]; then
    echo "FATAL: validated database ledger is behind the application candidate" >&2
    return 1
  fi
  if [ "$db_head" \> "$tree_req" ]; then
    echo "WARNING: validated database ledger is ahead of the recorded rollback candidate."
  fi
  echo "### Schema compatibility OK"
}

validate_audit_json() {
  python3 -c '
import json, re, sys
p=json.loads(sys.argv[1])
r={"schema","event","commit_sha","control_sha","branch","actor","deployment_id","workflow_run","authorization_ref","mode","timestamp","started_at","previous_version","database_migration_before","database_migration_after","backup_artifact","result","changed_services","image_digests","rollback_images","recovery_manifest"}
if not isinstance(p,dict) or set(p) != r: raise SystemExit("audit fields do not match the required schema")
for k in r-{"changed_services","image_digests","rollback_images"}:
    if not isinstance(p[k],str): raise SystemExit(f"audit field {k} must be a string")
for k in ("event","commit_sha","control_sha","actor","deployment_id","workflow_run","authorization_ref","mode","timestamp","started_at","result"):
    if not p[k]: raise SystemExit(f"audit field {k} is required")
if p["schema"]!="kaza-production-deployment-v1": raise SystemExit("unsupported deployment audit schema")
if p["event"] not in {"DEPLOYMENT_PREPARED","DEPLOYMENT_RESULT"}: raise SystemExit("unsupported audit event")
if p["result"] not in {"PREPARED","OK","FAILED"}: raise SystemExit("unsupported audit result")
if (p["event"]=="DEPLOYMENT_PREPARED") != (p["result"]=="PREPARED"): raise SystemExit("audit event/result combination is invalid")
if not re.fullmatch(r"[0-9a-f]{40}",p["commit_sha"]) or not re.fullmatch(r"[0-9a-f]{40}",p["control_sha"]): raise SystemExit("audit SHAs must be full lowercase commit ids")
if p["previous_version"] and not re.fullmatch(r"[0-9a-f]{40}",p["previous_version"]): raise SystemExit("audit previous SHA is malformed")
if p["branch"]!="main" or p["mode"] not in {"deploy","release"}: raise SystemExit("audit branch or mode is invalid")
if not re.fullmatch(r"[A-Za-z0-9._-]+",p["deployment_id"]): raise SystemExit("audit deployment id is invalid")
github_run=re.fullmatch(r"gh-(\d+)-(\d+)",p["deployment_id"])
manual_run=re.fullmatch(r"manual-[A-Za-z0-9._-]+",p["deployment_id"])
if github_run:
    expected=f"https://github.com/HozaifaAlmelli/REMAL/actions/runs/{github_run.group(1)}"
    if p["workflow_run"]!=expected: raise SystemExit("audit workflow run does not match deployment id")
    if p["authorization_ref"]!=f"github-environment:production:{github_run.group(1)}": raise SystemExit("audit GitHub authorization reference is invalid")
elif manual_run:
    if p["workflow_run"]!="manual": raise SystemExit("manual deployment must identify its workflow as manual")
    if not re.fullmatch(r"emergency:[A-Za-z0-9._-]{3,100}",p["authorization_ref"]): raise SystemExit("manual deployment lacks an explicit emergency authorization reference")
    if p["actor"]=="manual": raise SystemExit("manual deployment requires an identified actor")
else:
    raise SystemExit("audit deployment id is not a trusted GitHub or emergency-manual identity")
for key in ("timestamp","started_at"):
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z",p[key]): raise SystemExit(f"audit {key} is malformed")
for key in ("database_migration_before","database_migration_after"):
    if p[key] and not re.fullmatch(r"\d{4}",p[key]): raise SystemExit(f"audit {key} is malformed")
if p["mode"]=="release" and p["result"] in {"PREPARED","OK"} and not p["backup_artifact"].startswith("/"): raise SystemExit("successful release audit requires an absolute backup artifact")
if not isinstance(p["changed_services"],list) or any(x not in {"api","demo","portal"} for x in p["changed_services"]): raise SystemExit("invalid changed_services")
if not isinstance(p["image_digests"],dict) or not isinstance(p["rollback_images"],dict): raise SystemExit("image evidence must be objects")
if any(k not in {"api","demo","portal"} for k in p["image_digests"]|p["rollback_images"]): raise SystemExit("image evidence contains an unknown service")
if p["result"]=="OK":
    services={"api","demo","portal"}
    if set(p["changed_services"])!=services or len(p["changed_services"])!=3: raise SystemExit("successful audit must include all application services exactly once")
    if set(p["image_digests"])!=services or set(p["rollback_images"])!=services: raise SystemExit("successful audit requires complete image evidence")
    if any(not isinstance(value,str) or not re.fullmatch(r"sha256:[0-9a-f]{64}",value) for value in p["image_digests"].values()): raise SystemExit("successful audit image id is malformed")
    if not p["database_migration_before"] or not p["database_migration_after"]: raise SystemExit("successful audit requires migration state")
    if not p["recovery_manifest"].startswith("/"): raise SystemExit("successful audit requires an absolute recovery manifest")
' "$1"
}

validate_existing_audit_ledger() {
  local line number=0
  [ -e "$DEPLOYMENT_LEDGER" ] || return 0
  [ -f "$DEPLOYMENT_LEDGER" ] && [ ! -L "$DEPLOYMENT_LEDGER" ] || {
    echo "FATAL: existing deployment ledger is not a regular file" >&2
    return 1
  }
  while IFS= read -r line || [ -n "$line" ]; do
    number=$((number + 1))
    if ! validate_audit_json "$line"; then
      echo "FATAL: existing deployment ledger line $number violates the audit schema" >&2
      return 1
    fi
  done < "$DEPLOYMENT_LEDGER"
}

record() {
  local payload="${1:-}"
  [ -n "$payload" ] || usage
  validate_audit_json "$payload" || { echo "FATAL: deployment record is not valid audit JSON" >&2; return 1; }
  mkdir -p "$(dirname "$DEPLOYMENT_LEDGER")"
  command -v flock >/dev/null 2>&1 || { echo "FATAL: flock is required for audit append" >&2; return 1; }
  (
    flock -x 9
    validate_existing_audit_ledger
    PAYLOAD="$payload" LEDGER="$DEPLOYMENT_LEDGER" python3 - <<'PY'
import json, os
payload=json.loads(os.environ["PAYLOAD"])
path=os.environ["LEDGER"]
if os.path.exists(path):
    with open(path, encoding="utf-8") as handle:
        related=[json.loads(line) for line in handle if json.loads(line)["deployment_id"]==payload["deployment_id"]]
    if any(row["event"]==payload["event"] for row in related):
        raise SystemExit("deployment audit event already exists for this deployment id")
    if payload["event"]=="DEPLOYMENT_PREPARED" and related:
        raise SystemExit("prepared audit cannot follow a terminal deployment result")
flags=os.O_WRONLY|os.O_CREAT|os.O_APPEND
if hasattr(os,"O_NOFOLLOW"): flags |= os.O_NOFOLLOW
fd=os.open(path, flags, 0o600)
try:
    os.write(fd, os.environ["PAYLOAD"].encode("utf-8") + b"\n")
    os.fsync(fd)
finally:
    os.close(fd)
PY
  ) 9>"${DEPLOYMENT_LEDGER}.lock"
  echo "### Deployment recorded: $DEPLOYMENT_LEDGER"
}

successful_deployment() {
  local sha="${1:-}"
  [[ "$sha" =~ ^[0-9a-f]{40}$ ]] || usage
  [ -f "$DEPLOYMENT_LEDGER" ] || return 1
  validate_existing_audit_ledger
  python3 - "$DEPLOYMENT_LEDGER" "$sha" <<'PY'
import json, sys
path, sha = sys.argv[1:]
found=False
with open(path, encoding="utf-8") as handle:
    for line in handle:
        row=json.loads(line)
        if row.get("event")=="DEPLOYMENT_RESULT" and row.get("commit_sha")==sha and row.get("result")=="OK": found=True
raise SystemExit(0 if found else 1)
PY
}

latest_successful() {
  [ -f "$DEPLOYMENT_LEDGER" ] || return 3
  validate_existing_audit_ledger
  python3 - "$DEPLOYMENT_LEDGER" <<'PY'
import json, sys
latest = None
with open(sys.argv[1], encoding="utf-8") as handle:
    for line in handle:
        row = json.loads(line)
        if row["event"] == "DEPLOYMENT_RESULT" and row["result"] == "OK":
            latest = row
if latest is None:
    raise SystemExit(3)
print(json.dumps(latest, separators=(",", ":"), sort_keys=True))
PY
}

deployed_image_id() {
  local sha="${1:-}" service="${2:-}"
  [[ "$sha" =~ ^[0-9a-f]{40}$ ]] || usage
  case "$service" in api|demo|portal) ;; *) usage ;; esac
  [ -f "$DEPLOYMENT_LEDGER" ] || return 1
  validate_existing_audit_ledger
  python3 - "$DEPLOYMENT_LEDGER" "$sha" "$service" <<'PY'
import json, re, sys
path, sha, service = sys.argv[1:]
image_id = None
with open(path, encoding="utf-8") as handle:
    for line in handle:
        row = json.loads(line)
        if row["event"] == "DEPLOYMENT_RESULT" and row["commit_sha"] == sha and row["result"] == "OK":
            image_id = row["image_digests"].get(service)
if not isinstance(image_id, str) or not re.fullmatch(r"sha256:[0-9a-f]+", image_id):
    raise SystemExit(1)
print(image_id)
PY
}

no_successful_deployments() {
  validate_existing_audit_ledger
  [ -e "$DEPLOYMENT_LEDGER" ] || return 0
  python3 - "$DEPLOYMENT_LEDGER" <<'PY'
import json, sys
with open(sys.argv[1], encoding="utf-8") as handle:
    found = any(
        (row := json.loads(line))["event"] == "DEPLOYMENT_RESULT" and row["result"] == "OK"
        for line in handle
    )
raise SystemExit(1 if found else 0)
PY
}

recovery_authorizes() {
  local manifest="${1:-}" target_sha="${2:-}" run_id="${3:-}"
  [[ "$target_sha" =~ ^[0-9a-f]{40}$ ]] || usage
  [[ "$run_id" =~ ^[A-Za-z0-9._-]+$ ]] || usage
  [ -f "$manifest" ] && [ ! -L "$manifest" ] || return 1
  python3 - "$manifest" "$target_sha" "$run_id" <<'PY'
import json, re, sys
path, target, run_id=sys.argv[1:]
with open(path, encoding="utf-8") as handle: value=json.load(handle)
required={"schema","run_id","target_sha","control_sha","previous_sha","source_dir","status","changed_services","previous_image_ids","target_image_ids","rollback_images"}
if not isinstance(value,dict) or set(value)!=required: raise SystemExit("recovery manifest schema mismatch")
if value["schema"]!="kaza-production-recovery-v1" or value["status"]!="FAILED": raise SystemExit("recovery manifest is not a failed trusted run")
if value["run_id"]!=run_id or value["previous_sha"]!=target: raise SystemExit("recovery manifest does not authorize this target")
for key in ("target_sha","control_sha","previous_sha"):
    if not re.fullmatch(r"[0-9a-f]{40}",value[key]): raise SystemExit(f"recovery {key} is malformed")
services={"api","demo","portal"}
if not isinstance(value["changed_services"],list) or len(set(value["changed_services"]))!=len(value["changed_services"]) or any(x not in services for x in value["changed_services"]): raise SystemExit("recovery services are invalid")
if not all(isinstance(value[key],dict) and set(value[key])==services for key in ("previous_image_ids","target_image_ids","rollback_images")): raise SystemExit("recovery image evidence is incomplete")
if any(not isinstance(item,str) or not re.fullmatch(r"sha256:[0-9a-f]{64}",item) for key in ("previous_image_ids","target_image_ids") for item in value[key].values()): raise SystemExit("recovery image id is malformed")
if not isinstance(value["source_dir"],str) or not value["source_dir"].startswith("/"): raise SystemExit("recovery source directory is invalid")
PY
}

case "${1:-}" in
  ledger-head) ledger_head ;;
  tree-level) tree_level ;;
  schema-guard) schema_guard ;;
  record) shift; record "${1:-}" ;;
  successful-deployment) shift; successful_deployment "${1:-}" ;;
  latest-successful) latest_successful ;;
  deployed-image-id) shift; deployed_image_id "${1:-}" "${2:-}" ;;
  no-successful-deployments) no_successful_deployments ;;
  recovery-authorizes) shift; recovery_authorizes "${1:-}" "${2:-}" "${3:-}" ;;
  *) usage ;;
esac
