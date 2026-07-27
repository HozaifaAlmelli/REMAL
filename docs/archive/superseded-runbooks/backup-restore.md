# KAZA — Backup & Restore

All backups live on the VPS under `/opt/kaza/backups/` with 14-day retention. Copy them
off-box (e.g. to object storage) for real disaster recovery — on-box backups alone do not
survive losing the VPS.

## Scheduled backups (cron on the VPS)

```cron
15 3 * * *  /opt/kaza/app/scripts/backup-postgres.sh >> /opt/kaza/logs/backup-postgres.log 2>&1
30 3 * * *  /opt/kaza/app/scripts/backup-uploads.sh  >> /opt/kaza/logs/backup-uploads.log  2>&1
```

- **Postgres:** `scripts/backup-postgres.sh` → `pg_dump | gzip` →
  `/opt/kaza/backups/postgres/kaza_postgres_YYYY-MM-DD_HH-mm.sql.gz`. Verifies non-empty + valid gzip.
- **Uploads:** `scripts/backup-uploads.sh` → tars the VPS-local uploads path
  (`UPLOADS_HOST_PATH`, default `/opt/kaza/uploads`) →
  `/opt/kaza/backups/uploads/kaza_uploads_YYYY-MM-DD_HH-mm.tar.gz`.

## Test a restore (do this before trusting backups)

```bash
cd /opt/kaza/app
# Restores into a SCRATCH db by default (safe):
./scripts/restore-postgres.sh /opt/kaza/backups/postgres/kaza_postgres_2026-06-30_03-15.sql.gz
# Inspect RentalPlatform_restore_test, confirm tables/rows look right, then drop it.
```

Restoring over the **live** database is destructive and requires the real DB name + `CONFIRM=1`:
```bash
CONFIRM=1 ./scripts/restore-postgres.sh <backup.sql.gz> RentalPlatform
```

## Uploads restore

```bash
docker run --rm -v /opt/kaza/uploads:/data -v /opt/kaza/backups/uploads:/backup \
  alpine:3.20 sh -c "cd /data && tar xzf /backup/kaza_uploads_<TS>.tar.gz"
```

## Before any production migration or release

1. Run `scripts/backup-postgres.sh` (the migration runner does this automatically).
2. Run `scripts/backup-uploads.sh`.
3. Confirm both artifacts are non-empty.

## Migrations (tracked, gated)

Schema changes after first boot go through `scripts/apply-migrations.sh`, which:
- backs up first, applies only un-recorded `db/migrations/NNNN_*.sql`, runs each `*_verify.sql`,
  records success in the `schema_migrations` table, and **refuses destructive changes** unless
  `APPROVE_DESTRUCTIVE=1`. It refuses to run if the `schema_migrations` baseline is missing.
```bash
cd /opt/kaza/app
./scripts/apply-migrations.sh                      # safe, non-destructive only
APPROVE_DESTRUCTIVE=1 ./scripts/apply-migrations.sh   # only after explicit approval
```
