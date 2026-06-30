#!/usr/bin/env bash
# Restore a KAZA PostgreSQL backup.
#   Usage: restore-postgres.sh <backup_file.sql.gz> [target_db]
#
# DEFAULT target is a SCRATCH database (RentalPlatform_restore_test) so you can
# TEST a restore safely (Blocker B3/B4). Restoring over the LIVE database is
# destructive and must be done deliberately by passing the real DB name AND
# setting CONFIRM=1.
set -euo pipefail

ENV_FILE="${ENV_FILE:-/opt/kaza/env/.env.production}"
COMPOSE_FILE="${COMPOSE_FILE:-/opt/kaza/app/docker-compose.prod.yml}"

BACKUP_FILE="${1:?Usage: restore-postgres.sh <backup_file.sql.gz> [target_db]}"
# shellcheck disable=SC1090
set -a; source "$ENV_FILE"; set +a
TARGET_DB="${2:-${POSTGRES_DB}_restore_test}"

dc() { docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T db "$@"; }

[ -s "$BACKUP_FILE" ] || { echo "Backup not found/empty: $BACKUP_FILE" >&2; exit 1; }
gzip -t "$BACKUP_FILE" || { echo "Backup is not a valid gzip: $BACKUP_FILE" >&2; exit 1; }

if [ "$TARGET_DB" = "$POSTGRES_DB" ] && [ "${CONFIRM:-0}" != "1" ]; then
  echo "REFUSING to overwrite the LIVE database '$POSTGRES_DB' without CONFIRM=1." >&2
  echo "Test restores go to the default scratch DB; for a real restore re-run with CONFIRM=1." >&2
  exit 1
fi

echo "### (Re)creating target database: $TARGET_DB"
dc psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d postgres -c "DROP DATABASE IF EXISTS \"$TARGET_DB\";"
dc psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d postgres -c "CREATE DATABASE \"$TARGET_DB\";"

echo "### Restoring $BACKUP_FILE -> $TARGET_DB"
gzip -dc "$BACKUP_FILE" | dc psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$TARGET_DB"

echo "### Restore complete into '$TARGET_DB'. Verify before any cutover."
