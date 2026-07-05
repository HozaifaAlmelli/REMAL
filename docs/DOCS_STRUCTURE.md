# Docs structure — what lives where and why

The final documentation tree after the 2026-07 reorganization
([inventory report](archive/cleanup-inventory-20260705.md)).

```
docs/
  README.md                         Main docs entry — start here
  DOCS_STRUCTURE.md                 This file: the tree, explained
  KAZA_PRODUCTION_WORKBOOK.md       Human operator workbook (Arabic-first) — CANONICAL
  branching.md                      Branch/release flow + branch protection
  auth_config.md                    Env-var mapping + cookie security behavior
  deployment.md                     STUB → superseded (kept because docker-compose.prod.yml comments reference it)
  rollback.md                       STUB → operations/rollback-and-recovery.md
  backup-restore.md                 STUB → operations/database-operations.md

  operations/                       Current operational docs — CANONICAL
    README.md                       Ops index: purpose → canonical doc (map, deploy, verify, smoke, SSL, emergencies)
    rollback-and-recovery.md        Current rollback procedure (manual; no auto-rollback exists)
    database-operations.md          Backups, restore testing, gated migrations

  ai-deployment-skills/             Deep AI/human deployment playbooks — CANONICAL
    README.md                       Skills index + shared-VPS facts + emergency stop rules
    command-templates.md            Copy-paste-safe scoped commands
    <15 skill playbooks>.md

  incidents/                        Historical incidents — HISTORY, never instructions
    README.md
    2026-07-kaza-production-stabilization.md

  api/                              Canonical API references (referenced by demo design system)
  architecture/  decisions/         Architecture & business-scope decision records
  setup/                            Solution/entrypoint guides
  review-followups/                 Review follow-up trackers
  superpowers/specs/                Design specs

  archive/                          NOT active guidance — audit/history only
    README.md
    cleanup-inventory-20260705.md   Classification report behind this structure
    superseded-runbooks/            Old deploy/rollback/backup runbooks + executed ticket files
    project-history/                Wave-era planning docs, QA reports, doc bundles
    obsolete/                       Transcripts, duplicate API refs, stale artifacts
```

Related, outside `docs/`:

```
AGENTS.md                           Root agent rules (production safety overrides all)
.github/skills/deploy-safety/       Tracked Claude-style pointer skill → this library
.agents/skills/deploy-safety/       Codex-style pointer skill → this library
.claude/                            GITIGNORED — local-only mirrors; never committed
scripts/                            Operational shell scripts (deploy/backup/migrate/restore/smoke) — code, not docs
.github/workflows/                  CI + gated production deploy — code, not docs
```

## Canonical vs archive

- **Canonical production guidance has exactly two homes:** the
  [workbook](KAZA_PRODUCTION_WORKBOOK.md) (operators) and
  [ai-deployment-skills](ai-deployment-skills/README.md) (agents + deep detail).
  `operations/` holds the few procedures with unique content (rollback, DB ops) plus the
  purpose→doc index.
- **`archive/` is never guidance.** Some archived files contain now-wrong paths and
  now-forbidden commands on purpose (that's the history). Its README says so.

## Rules for future contributors

- **Don't add a new top-level runbook.** Extend the workbook, a skill, or
  `operations/` instead. A third "deployment guide" is how this mess started.
- **New incident write-up** → `incidents/YYYY-MM-slug.md` (+ its README index row).
  Reusable lessons get encoded as/into a skill in `ai-deployment-skills/`.
- **New playbook** → `ai-deployment-skills/` following the existing frontmatter format,
  linked from its README index.
- **Retiring a doc** → move it under `archive/` (pick the matching subfolder), leave a
  stub only if something still links to the old path, and note it in the archive README
  if significant.
- **Never commit**: secrets, credentials, dumps, logs, patches, `.claude/` local files
  (all gitignored).
