---
name: database-migration-production-safety
description: >
  Apply production database schema changes safely: back up first, use unique additive
  migrations, never edit an applied migration or reuse a migration number, and never run
  destructive SQL. Migrations are gated and never run automatically during deploy.
risk_level: critical
when_to_use: >
  A production endpoint fails because the live schema is missing a column/table, or a new
  feature needs an additive schema change (new nullable columns, new tables/indexes).
do_not_use_when: >
  The fix is code-only, or the change is destructive (dropping/renaming/altering existing
  columns) — that needs a separate, human-led, backup-and-restore-tested plan.
required_inputs:
  - The exact schema gap (from information_schema, read-only)
  - A verified fresh backup before any write
  - The next unused migration number
forbidden_actions:
  - DROP / TRUNCATE / DELETE (destructive) without explicit approval + APPROVE_DESTRUCTIVE=1
  - Editing an already-applied migration file
  - Reusing an existing migration number
  - Running migrations during deploy or on an empty ledger
  - Writing to the DB before a verified backup exists
preflight_checks:
  - Read-only confirm the gap via information_schema
  - Take + verify a backup (scripts/backup-postgres.sh)
  - Check the schema_migrations ledger and pick a unique NNNN
safe_procedure: "See 'Backup, then additive migration' below."
verification: "The failing endpoint works; the migration is recorded once; the ledger has no gaps/dupes."
rollback: "Additive changes are safe to leave; if needed restore the pre-migration backup to a scratch DB and cut over deliberately (restore-postgres.sh)."
stop_conditions: "See 'Global Stop Conditions' below."
final_report_required: true
lessons_from_kaza_incident: >
  Owner login returned 500 because the live DB was missing owners.detailed_address and
  owners.emergency_phone. A migration already used number 0048 (a DUPLICATE), so reusing
  it would have corrupted the ledger. The correct fix was a NEW unique, additive migration
  0057_add_owner_contact_fields, applied after a verified backup, via the gated runner
  scripts/apply-migrations.sh (which backs up, skips destructive SQL, runs *_verify.sql,
  and records the number only on success). Migrations never run during deploy.
---

# Database migration production safety

> **Releasing a feature that adds migrations? Do not run `apply-migrations.sh` by hand.**
> Dispatch **Deploy Production** with `mode: release`. That runs
> `scripts/release-production.sh`, which orders the whole thing for you: baseline →
> candidate worktree → validated backup → migrate → ledger verification → deploy the
> exact SHA → verify what landed, stopping at the first failure and never moving the
> live checkout before the database is verified. This playbook covers the standalone
> case: a schema gap being closed on its own, with no code release attached.
>
> A migration must never be applied through the code deploy path, and the code deploy
> path refuses to run when the live schema is behind the tree — see
> [github-actions-production-deploy-safety](github-actions-production-deploy-safety.md).

The DB is the one thing you cannot rebuild from `main`. Every write is preceded by a
verified backup and every migration is additive, uniquely numbered, and gated.

## Backup, then additive migration

```bash
# 1. READ-ONLY: confirm the actual gap (never assume). Example: owner contact fields.
docker exec kaza-prod-db sh -lc '
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "
    SELECT column_name FROM information_schema.columns
     WHERE table_name = '\''owners'\'' ORDER BY 1;"'

# 2. BACK UP FIRST and verify it (do not proceed if this fails).
bash /opt/apps/kaza-booking/scripts/backup-postgres.sh
# (verifies dump exit, non-empty gzip, complete dump metadata, no-clobber publication
# and retention; see command-templates.md #6)

# 3. Pick a UNIQUE next number. Check both the files and the ledger.
ls -1 /opt/apps/kaza-booking/db/migrations | grep -E '^[0-9]{4}_' | sort | tail
docker exec kaza-prod-db sh -lc '
  psql -tA -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "
    SELECT migration_number FROM schema_migrations ORDER BY 1;"'
# NEVER reuse a number (0048 was already duplicated once). Use the next free NNNN.
```

Author a **new** additive migration `db/migrations/NNNN_<name>.sql` — nullable columns,
new tables, or indexes only. Example shape:

```sql
-- 0057_add_owner_contact_fields.sql  (ADDITIVE ONLY)
ALTER TABLE owners ADD COLUMN IF NOT EXISTS detailed_address text;
ALTER TABLE owners ADD COLUMN IF NOT EXISTS emergency_phone  text;
```

Apply it through the **gated runner** (never ad-hoc, never during deploy):

```bash
# scripts/apply-migrations.sh: verifies the ordered checksum registry, takes the dedicated
# database-scoped migration lock, validates the ledger, creates a validated unique backup,
# applies only the pending suffix, runs *_verify.sql, records success strictly, validates
# the final ledger, and refuses DROP/TRUNCATE/DELETE unless APPROVE_DESTRUCTIVE=1.
APPROVE_DESTRUCTIVE=0 bash /opt/apps/kaza-booking/scripts/apply-migrations.sh
```

## Rules that keep the ledger sane

- **Additive, nullable, idempotent** (`ADD COLUMN IF NOT EXISTS`) — no drops, renames,
  or type changes to existing columns without a separate human-led plan.
- **Never edit an applied migration** — write a new one. Editing history diverges the
  live DB from the ledger and fails the ordered checksum registry.
- **Never reuse a number.** Duplicate numbers (like the historical `0048`) break the
  applied/pending accounting.
- **Register every production migration twice:** once in `infra/db/init.prod.sql` and once
  with its LF-normalized SHA-256 in `infra/db/production-migrations.sha256`. Never update a
  checksum to bless modified applied content.
- **Never bypass ledger refusal.** Missing, empty, malformed, duplicate, unknown,
  out-of-order, gapped or conflicting ledger state requires investigation, not repair by
  the runner.
- **Never run migrations during deploy.** The deploy explicitly does not; keep it that way.
- **Never write before a verified backup.**

## Rollback philosophy (additive changes)

Additive nullable columns/tables are safe to leave in place even if the feature is rolled
back — nothing reads them until code does. If a migration misbehaves, restore the
pre-migration backup into a **scratch** DB and verify before any deliberate cutover:

```bash
# Defaults to a scratch DB; refuses to overwrite the LIVE db without CONFIRM=1.
sh /opt/apps/kaza-booking/scripts/restore-postgres.sh <backup_file.sql.gz>
```

## Global Stop Conditions — halt and report, do not proceed

Stop immediately if any of these is true:
- A command would affect Novatova (any `novatova-*` container, config, or data).
- A command would start a service that binds host ports 80 or 443.
- A step requires `docker compose down`.
- A step is a bare `docker compose up -d` (no `--no-deps <service>`, no service list).
- `docker exec novatova-nginx nginx -t` fails.
- The env file `/opt/kaza/env/.env.production` is missing or empty.
- The live repo path is uncertain (compose labels don't confirm it).
- Compose labels do not match the expected project `kaza-prod` / expected service.
- A DB backup fails (or cannot be verified) before any DB write.
- The live working tree has unexpected local changes before a git operation.
- A secret (password/token/JWT/connection string) would be printed or written unredacted.
- An already-applied migration would need editing, or a migration number would be reused.
- A production user's password would be reset.
- A temporary SSH key cannot be removed at the end of the task.

## Forbidden Commands — never run these on the shared VPS

Named here only to mark them forbidden. Do not execute them.
- `docker compose down`
- `docker compose up -d` (bare — no service scope)
- `docker system prune` / `docker builder prune -a`
- `docker volume rm ...`
- `rm -rf /etc/letsencrypt`
- `certbot delete ...`
- `docker restart novatova-nginx` and `docker restart novatova-*`
- `DROP TABLE ...` / `TRUNCATE TABLE ...` / `DELETE FROM ...` without WHERE + backup + approval
- `git reset --hard` on the live repo (unless explicitly approved AND already backed up)
- `git push --force` to `main`

## Final report (required)

State the schema gap; the verified backup path; the new unique migration number + name;
that it is additive; the verify result; and that no destructive SQL ran and no deploy-time
migration occurred.
