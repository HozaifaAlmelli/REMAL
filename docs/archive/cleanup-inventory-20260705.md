# Docs cleanup inventory — 2026-07-05

Phase 1–2 deliverable of the `chore/reorganize-docs-and-ai-skills` branch. Every
docs/skills/runbook-related file was inspected and classified before anything was moved.
**No file was hard-deleted except one untracked, already-merged local patch file** (see F).
No secrets appear in this report.

Classification legend:
**A** ACTIVE_CANONICAL · **B** ACTIVE_REFERENCE · **C** INCIDENT_HISTORY ·
**D** SUPERSEDED · **E** OBSOLETE · **F** LOCAL_ONLY (not committed) · **G** DO_NOT_TOUCH

---

## A. ACTIVE_CANONICAL (kept, linked from indexes)

| File | Why canonical |
|---|---|
| `docs/KAZA_PRODUCTION_WORKBOOK.md` | Human operator workbook — first read for production. |
| `docs/ai-deployment-skills/README.md` + 15 skills + `command-templates.md` | Deep AI/human deployment playbooks. |
| `AGENTS.md` | Root agent rules (Codex/Claude/others). |
| `.github/skills/deploy-safety/SKILL.md` | Tracked Claude-style pointer skill. |
| `.agents/skills/deploy-safety/SKILL.md` | Codex-style pointer skill. |
| `docs/README.md`, `docs/DOCS_STRUCTURE.md` | New navigation indexes (this cleanup). |
| `docs/operations/README.md`, `rollback-and-recovery.md`, `database-operations.md` | New/migrated current ops docs (this cleanup). |

## B. ACTIVE_REFERENCE (kept in place)

| File | Note |
|---|---|
| `docs/branching.md` | Branch/release flow + branch protection. Still accurate. |
| `docs/auth_config.md` | Env-var mapping + cookie security behavior. Still accurate. |
| `docs/api/KAZA_BOOKING_API_Reference.md` | Canonical API reference — referenced by `demo/docs/KAZA_BOOKING_Design_System.md`. |
| `docs/api/KAZA_BOOKING_MASTER_API_REFERENCE.md` | Master controller-level reference (2026-04-22). |
| `docs/architecture/*`, `docs/decisions/*` | Architecture/business-scope decision records. |
| `docs/setup/active_solution.md`, `docs/setup/solution_guide.md` | Solution entrypoint guides. |
| `docs/review-followups/*` | Open review follow-up trackers. |
| `docs/superpowers/specs/*` | Design specs (availability hold). |
| Root: `PRODUCT.md`, `DESIGN.md`, `business_req.md`, `technical_req.md`, `Front-end-technical-req.md`, `integration.md`, `.github/copilot-instructions.md` | Product/design/agent context — untouched. |

## C. INCIDENT_HISTORY (new home: `docs/incidents/`)

| File | Note |
|---|---|
| `docs/incidents/2026-07-kaza-production-stabilization.md` | New: consolidated history of the production bring-up incidents (wrong path, SSL, libgssapi, pipeline, proxy-network, hotfix durability, migration numbering, smoke hygiene, post-login loop, SSH hygiene). |

## D. SUPERSEDED (moved to `docs/archive/superseded-runbooks/`, stubs left where referenced)

| Old path | Superseded by | Why | Stub? |
|---|---|---|---|
| `docs/deployment.md` | Workbook + `ai-deployment-skills/` | Pre-Novatova-era runbook: instructs the stale `/opt/kaza/app` path, assumes Kaza-owned nginx/certbot on 80/443, prints the VPS IP. Dangerous if followed today. | Yes — referenced by a comment in `docker-compose.prod.yml` (not modified) and by archived tickets. |
| `docs/rollback.md` | `docs/operations/rollback-and-recovery.md` | Claims an automatic rollback the current pipeline does not have; manual procedure uses the stale path and a bare `docker compose up -d` (now forbidden). | Yes. |
| `docs/backup-restore.md` | `docs/operations/database-operations.md` | Content still valuable (cron, retention, restore test) but cron lines instruct the stale path; migrated with corrected paths. | Yes. |
| `tickets-production-deployment.md` (root) | Executed — production is live | Plan-handoff ticket file, fully executed. Historical. | No (nothing active links to it). |
| `tickets-storefront-integration.md` (root) | Executed — storefront integrated | Plan-handoff ticket file, fully executed. Historical. | No. |

## D2. PROJECT_HISTORY (wave-era artifacts → `docs/archive/project-history/`)

Development-phase planning/QA artifacts from the Wave build-out. Useful history, not
current guidance. None are referenced by active docs, `.github`, or app code (verified by grep).

- `docs/Context.md` — wave-era AI agent context prompt (superseded by `AGENTS.md` / copilot-instructions).
- `docs/Pre_Wave1_API_Analysis.md`
- `docs/Wave_0_continuation.md`, `Wave_1_Track_A_Auth.md`, `Wave_1_Track_B_UI_QA_PM.md`, `Wave_2_Admin_Shell_Units.md`, `Wave_3_Part1_CRM.md`, `Wave_3_Part2_Bookings_QA_PM.md`, `Wave_4_Finance_Owners_Clients.md`, `Wave_5_Dashboard_Reviews_Notifications.md`, `Wave_6_Owner_Portal.md`, `Wave_7_Part1_Infrastructure_Landing.md`, `Wave_7_Part2_Units_Booking_Account.md`
- `docs/wave7-qa-report.md`, `docs/wave7-qa-summary.md`
- `docs/tasks-tickets.md` — wave QA review prompt.
- `docs/Pasted markdown.md` → renamed `api-validation-report-waves.md` — wave-ticket API validation report (content kept; filename was unusable).
- `docs/wave1-2.zip`, `docs/wave3.zip`, `docs/wave7.zip` — tracked binary bundles of wave docs (kept for audit, moved out of the active tree).

## E. OBSOLETE (moved to `docs/archive/obsolete/`; nothing hard-deleted)

| Old path | Why obsolete | Action |
|---|---|---|
| `docs/qa.md` (6,665 lines) | A pasted AI-agent session transcript ("Created 5 todos… Searched for files…"), not a document. | Moved → `qa-agent-transcript.md`. |
| `docs/api_reference.md` (2.7 KB) | Early, tiny API list; superseded by `docs/api/`. | Moved. |
| `docs/KAZA_BOOKING_API_Reference.md` (docs-root copy) | Near-duplicate of the canonical `docs/api/KAZA_BOOKING_API_Reference.md` (same head, same last commit); the `docs/api/` copy is the one referenced by the demo design system. | Moved. |
| `docs/archive/KAZA_BOOKING.sln.stale` | Already-archived stale solution file. | Moved into `obsolete/` for tidiness. |

## F. LOCAL_ONLY (untracked; not committed)

| File | Status | Action |
|---|---|---|
| `0001-fix-api-install-libgssapi-and-add-health-endpoints.patch` (root) | Untracked (`*.patch` is gitignored). Its content is fully merged to `main` (commit `6bfff26` — verified the Dockerfile on `origin/main` contains the libgssapi install). | Deleted from working tree. |
| `.playwright-mcp/*.log` | Ignored (`.playwright-mcp/` in `.gitignore`). | Left alone. |
| `.claude/**` (incl. local `skills/deploy-safety/`) | Ignored (`.claude/` in `.gitignore`). Local mirror of the tracked `.github/skills` pointer. | Left alone; never committed. |
| `demo/.next/**` build logs | Ignored build output. | Left alone. |

## G. DO_NOT_TOUCH (out of scope — not modified)

- All app/API/frontend source (`RentalPlatform.API/`, `rental-platform/`, `demo/`, …)
- Database migrations
- `scripts/*.sh` (deploy/backup/migrate/restore/smoke)
- `.github/workflows/*` (deploy-production, pr-checks, smoke-maintenance)
- `docker-compose.yml`, `docker-compose.prod.yml` (the `docs/deployment.md` comment inside it is satisfied by the stub)
- Dockerfiles, package files, `RentalPlatform.slnx`, env templates
- `.github/skills/impeccable/**` (active design skill)
- `test-complete-booking.ps1` / `.sh` (operational test scripts)
- Root `README.md` content (only a small Production/Operations link section added at top)

## Files NOT moved because they may be referenced

- `docs/api/**` — referenced by `demo/docs/KAZA_BOOKING_Design_System.md`.
- `docs/deployment.md` path — referenced by a comment in `docker-compose.prod.yml`
  (stub left in place so the reference stays resolvable; compose file untouched).
- `docs/branching.md` — referenced by archived tickets and still-current workflow guidance.

## Adaptation note (target structure vs. repo reality)

The task's target tree lists seven files under `docs/operations/`. The workbook
(§1 production map, §6 safe deploy commands, §8 verification, §12 smoke accounts, §13
SSL/nginx) and the 15 skills already cover five of those topics canonically — duplicating
them into thin per-topic files would recreate the redundancy this cleanup removes. So
`docs/operations/` contains the two docs with **unique** operational content
(`rollback-and-recovery.md`, `database-operations.md`) plus a README that maps every
operations purpose (production map, deployment, verification, rollback, database,
SSL/nginx, smoke testing, emergencies) to its canonical home.
