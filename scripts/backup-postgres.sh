#!/usr/bin/env bash
# Daily PostgreSQL backup for KAZA production. Run via cron on the VPS.
#   Example cron (03:15 daily):  15 3 * * * bash /opt/apps/kaza-booking/scripts/backup-postgres.sh >> /opt/kaza/logs/backup-postgres.log 2>&1
set -euo pipefail

ENV_FILE="${ENV_FILE:-/opt/kaza/env/.env.production}"
COMPOSE_FILE="${COMPOSE_FILE:-/opt/apps/kaza-booking/docker-compose.prod.yml}"
BACKUP_DIR="${BACKUP_DIR:-/opt/kaza/backups/postgres}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
BACKUP_MIN_RETAINED="${BACKUP_MIN_RETAINED:-3}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=scripts/lib/postgres-backup.sh
source "$SCRIPT_DIR/lib/postgres-backup.sh"
# shellcheck source=scripts/lib/env-file.sh
source "$SCRIPT_DIR/lib/env-file.sh"

# The env file is parsed, never sourced. Only the two non-secret connection
# identifiers are read; POSTGRES_PASSWORD is never read on the host. See
# scripts/lib/env-file.sh for why.
env_file_preflight "$ENV_FILE" POSTGRES_USER POSTGRES_DB POSTGRES_PASSWORD
load_db_connection_identifiers "$ENV_FILE"

if ! mkdir -p "$BACKUP_DIR"; then
  echo "ERROR: backup destination is inaccessible: $BACKUP_DIR" >&2
  exit 1
fi

TS="$(date -u +%F_%H-%M-%S)"
if ! PARTIAL="$(mktemp "$BACKUP_DIR/kaza_postgres_${TS}_XXXXXXXX.sql.gz.partial")"; then
  echo "ERROR: unable to allocate a unique backup artifact in $BACKUP_DIR" >&2
  exit 1
fi
OUT="${PARTIAL%.partial}"

cleanup_partial_backup() {
  if [ -n "${PARTIAL:-}" ] && [ -e "$PARTIAL" ]; then
    rm -f -- "$PARTIAL"
  fi
}
trap cleanup_partial_backup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

if ! docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T db \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" | gzip -c > "$PARTIAL"; then
  echo "ERROR: PostgreSQL backup command failed; partial artifact rejected" >&2
  exit 1
fi

validate_postgres_backup_artifact "$PARTIAL"
publish_postgres_backup_artifact "$PARTIAL" "$OUT"
PARTIAL=""

echo "$(date -Is) backup OK: $OUT ($(du -h "$OUT" | cut -f1))"

# Retention. Never silent, never below the retained floor, and fully disabled by
# RETENTION_DAYS=0 — which is what a production rollout must use so that no
# pre-existing reference artifact can be removed by the pre-migration backup.
prune_postgres_backup_artifacts "$BACKUP_DIR" "$RETENTION_DAYS" "$BACKUP_MIN_RETAINED"
