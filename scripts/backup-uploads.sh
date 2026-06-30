#!/usr/bin/env bash
# Daily uploads backup for KAZA production (tars the uploads_data Docker volume).
#   Example cron (03:30 daily):  30 3 * * * /opt/kaza/app/scripts/backup-uploads.sh >> /opt/kaza/logs/backup-uploads.log 2>&1
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/opt/kaza/backups/uploads}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
# Compose project is `name: kaza-prod`, volume `uploads_data` -> docker volume kaza-prod_uploads_data
VOLUME="${UPLOADS_VOLUME:-kaza-prod_uploads_data}"

mkdir -p "$BACKUP_DIR"
TS="$(date +%F_%H-%M)"
OUT="kaza_uploads_${TS}.tar.gz"

# Read the volume through a throwaway alpine container.
docker run --rm \
  -v "${VOLUME}:/data:ro" \
  -v "${BACKUP_DIR}:/backup" \
  alpine:3.20 \
  tar czf "/backup/${OUT}" -C /data .

if [ ! -s "${BACKUP_DIR}/${OUT}" ] || ! gzip -t "${BACKUP_DIR}/${OUT}" 2>/dev/null; then
  echo "ERROR: uploads backup missing/empty/corrupt: ${BACKUP_DIR}/${OUT}" >&2
  rm -f "${BACKUP_DIR}/${OUT}"
  exit 1
fi

echo "$(date -Is) uploads backup OK: ${BACKUP_DIR}/${OUT} ($(du -h "${BACKUP_DIR}/${OUT}" | cut -f1))"
find "$BACKUP_DIR" -name 'kaza_uploads_*.tar.gz' -type f -mtime +"$RETENTION_DAYS" -delete
