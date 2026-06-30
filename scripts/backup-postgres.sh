#!/usr/bin/env bash
# Daily PostgreSQL backup for KAZA production. Run via cron on the VPS.
#   Example cron (03:15 daily):  15 3 * * * /opt/kaza/app/scripts/backup-postgres.sh >> /opt/kaza/logs/backup-postgres.log 2>&1
set -euo pipefail

ENV_FILE="${ENV_FILE:-/opt/kaza/env/.env.production}"
COMPOSE_FILE="${COMPOSE_FILE:-/opt/kaza/app/docker-compose.prod.yml}"
BACKUP_DIR="${BACKUP_DIR:-/opt/kaza/backups/postgres}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

# shellcheck disable=SC1090
set -a; source "$ENV_FILE"; set +a

mkdir -p "$BACKUP_DIR"
TS="$(date +%F_%H-%M)"
OUT="$BACKUP_DIR/kaza_postgres_${TS}.sql.gz"

docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T db \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" | gzip > "$OUT"

# Verify the backup is non-empty and actually decompresses.
if [ ! -s "$OUT" ] || ! gzip -t "$OUT" 2>/dev/null; then
  echo "ERROR: backup missing/empty/corrupt: $OUT" >&2
  rm -f "$OUT"
  exit 1
fi

echo "$(date -Is) backup OK: $OUT ($(du -h "$OUT" | cut -f1))"

# Retention
find "$BACKUP_DIR" -name 'kaza_postgres_*.sql.gz' -type f -mtime +"$RETENTION_DAYS" -delete
echo "$(date -Is) pruned backups older than ${RETENTION_DAYS} days"
