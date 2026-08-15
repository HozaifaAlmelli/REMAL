#!/usr/bin/env bash
# Daily PostgreSQL backup for KAZA production. Run via cron on the VPS.
#   Example cron (03:15 daily):  15 3 * * * bash /opt/apps/kaza-booking/scripts/backup-postgres.sh >> /opt/kaza/logs/backup-postgres.log 2>&1
set -euo pipefail

ENV_FILE="${ENV_FILE:-/opt/kaza/env/.env.production}"
COMPOSE_FILE="${COMPOSE_FILE:-/opt/apps/kaza-booking/docker-compose.prod.yml}"
BACKUP_DIR="${BACKUP_DIR:-/opt/kaza/backups/postgres}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=scripts/lib/postgres-backup.sh
source "$SCRIPT_DIR/lib/postgres-backup.sh"

# shellcheck disable=SC1090
set -a; source "$ENV_FILE"; set +a

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

# Retention
find "$BACKUP_DIR" -name 'kaza_postgres_*.sql.gz' -type f -mtime +"$RETENTION_DAYS" -delete
echo "$(date -Is) pruned backups older than ${RETENTION_DAYS} days"
