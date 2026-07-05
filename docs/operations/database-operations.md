# Database operations — backups, restore, migrations

PostgreSQL runs in the `kaza-prod-db` container; its data lives in a Docker volume/mount.
All backups live on the VPS under `/opt/kaza/backups/` with 14-day retention. Copy them
off-box (e.g. to object storage) for real disaster recovery — on-box backups alone do not
survive losing the VPS.

This doc replaces the superseded `docs/backup-restore.md` (paths corrected). Deep
playbook: [database-migration-production-safety](../ai-deployment-skills/database-migration-production-safety.md).

> 🚫 Never delete DB volumes. Never run destructive SQL. Never edit an applied migration
> or reuse a migration number. Back up before **any** DB write.

## Scheduled backups (cron on the VPS)

```cron
15 3 * * *  /opt/apps/kaza-booking/scripts/backup-postgres.sh >> /opt/kaza/logs/backup-postgres.log 2>&1
30 3 * * *  /opt/apps/kaza-booking/scripts/backup-uploads.sh  >> /opt/kaza/logs/backup-uploads.log  2>&1
```

> ⚠️ The live repo path is `/opt/apps/kaza-booking`. If the actual VPS crontab still
> references the stale `/opt/kaza/app` path, its backups are silently failing or running
> stale scripts — verify `crontab -l` on the box and fix deliberately (a VPS change,
> outside this doc).

- **Postgres:** `scripts/backup-postgres.sh` → `pg_dump | gzip` →
  `/opt/kaza/backups/postgres/kaza_postgres_YYYY-MM-DD_HH-mm.sql.gz`. Verifies non-empty + valid gzip.
- **Uploads:** `scripts/backup-uploads.sh` → tars the VPS-local uploads path
  (`UPLOADS_HOST_PATH`, default `/opt/kaza/uploads`) →
  `/opt/kaza/backups/uploads/kaza_uploads_YYYY-MM-DD_HH-mm.tar.gz`.

## Test a restore (do this before trusting backups)

```bash
cd /opt/apps/kaza-booking
# Restores into a SCRATCH db by default (safe):
./scripts/restore-postgres.sh /opt/kaza/backups/postgres/kaza_postgres_<TS>.sql.gz
# Inspect the restore-test DB, confirm tables/rows look right, then drop it.
```

Restoring over the **live** database is destructive and requires the real DB name +
`CONFIRM=1` — treat it as a human-led, explicitly approved operation:

```bash
CONFIRM=1 ./scripts/restore-postgres.sh <backup.sql.gz> RentalPlatform
```

## Uploads restore

```bash
docker run --rm -v /opt/kaza/uploads:/data -v /opt/kaza/backups/uploads:/backup \
  alpine:3.20 sh -c "cd /data && tar xzf /backup/kaza_uploads_<TS>.tar.gz"
```

## Before any production migration or release

1. Run `scripts/backup-postgres.sh` (the migration runner also does this itself).
2. Run `scripts/backup-uploads.sh`.
3. Confirm both artifacts are non-empty.

## Migrations (tracked, gated — never during deploy)

Schema changes go through `scripts/apply-migrations.sh`, which backs up first, applies
only un-recorded `db/migrations/NNNN_*.sql`, runs each `*_verify.sql`, records success in
the `schema_migrations` table, refuses an empty/missing ledger, refuses duplicate
numbers, and **refuses destructive changes** unless `APPROVE_DESTRUCTIVE=1`.

```bash
cd /opt/apps/kaza-booking
./scripts/apply-migrations.sh                        # safe, additive only
APPROVE_DESTRUCTIVE=1 ./scripts/apply-migrations.sh  # only after explicit human approval
```

Prefer additive, nullable migrations with unique numbers. (Incident history: a duplicated
migration number broke owner login — see
[incidents](../incidents/2026-07-kaza-production-stabilization.md).)
