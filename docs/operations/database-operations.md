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
15 3 * * *  bash /opt/apps/kaza-booking/scripts/backup-postgres.sh >> /opt/kaza/logs/backup-postgres.log 2>&1
30 3 * * *  bash /opt/apps/kaza-booking/scripts/backup-uploads.sh  >> /opt/kaza/logs/backup-uploads.log  2>&1
```

> ⚠️ The live repo path is `/opt/apps/kaza-booking`. If the actual VPS crontab still
> references the stale `/opt/kaza/app` path, its backups are silently failing or running
> stale scripts — verify `crontab -l` on the box and fix deliberately (a VPS change,
> outside this doc).

- **Postgres:** `scripts/backup-postgres.sh` → `pg_dump | gzip` → a collision-safe
  `/opt/kaza/backups/postgres/kaza_postgres_YYYY-MM-DD_HH-mm-ss_<random>.sql.gz` artifact. The script
  rejects a failed dump, missing/empty output, invalid gzip and incomplete PostgreSQL plain-dump metadata.
  It writes to a unique partial file and publishes with an atomic no-clobber operation, so rapid or concurrent
  invocations cannot overwrite a valid backup.
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

1. Run `scripts/backup-postgres.sh` (the migration runner also does this itself after its ledger preflight).
2. Run `scripts/backup-uploads.sh`.
3. Confirm both artifacts are non-empty.

## Migrations (tracked, gated — never during deploy)

Schema changes go through `scripts/apply-migrations.sh`. The runner:

1. Validates the ordered production manifest and LF-normalized SHA-256 identities in
   `infra/db/production-migrations.sha256` before connecting.
2. Acquires the dedicated, database-scoped PostgreSQL migration-runner advisory lock. A concurrent runner for
   the same database fails immediately with a clear refusal; other databases remain independent.
3. Validates `schema_migrations` as a non-empty, ordered registry prefix. Missing, malformed, duplicate,
   unknown, out-of-order, gapped or conflicting-name state fails before backup or migration SQL. The runner
   never creates or rewrites ledger truth and never blesses changed historical migration content.
4. Creates and validates a unique pre-migration backup. Any backup failure stops execution.
5. Applies only the pending suffix, runs each `*_verify.sql`, records each success strictly, then validates the
   resulting ledger at the registry head before releasing the session lock.

The runner still **refuses destructive changes** unless `APPROVE_DESTRUCTIVE=1`. The session lock is held from
the first database inspection through backup, apply, verification and final ledger validation. Connection loss
releases the PostgreSQL advisory lock automatically.

This eligibility rule prevents development-only seeds from becoming production-pending
merely because their files exist under `db/migrations`. Future development-only seed
migrations must contain `_seed_dev_` in the filename, be included only by `db/init.sql`,
and never be added to `infra/db/init.prod.sql`. Every legitimate production migration
must be registered in `infra/db/init.prod.sql`; an unregistered file is intentionally
ineligible, and its canonical checksum must be added to `infra/db/production-migrations.sha256`. Never update
that checksum to legitimize edits to an already-applied migration; create a new migration instead. The production
runner materializes and verifies the registry before querying the ledger, so database commands cannot consume or
truncate migration discovery input.

```bash
cd /opt/apps/kaza-booking
bash ./scripts/apply-migrations.sh                        # safe, additive only
APPROVE_DESTRUCTIVE=1 bash ./scripts/apply-migrations.sh  # only after explicit human approval
```

Prefer additive, nullable migrations with unique numbers. (Incident history: a duplicated
migration number broke owner login — see
[incidents](../incidents/2026-07-kaza-production-stabilization.md).)

No production migration was executed while introducing these safeguards; validation uses repository-local shell
tests and official disposable PostgreSQL 16. Automated artifact validation proves a complete gzip/plain-dump
stream; disposable integration coverage also restores a validated artifact into a scratch database. A
production/pre-release restore rehearsal remains a separate deliberate operator gate and is not implied by
artifact validation alone.
