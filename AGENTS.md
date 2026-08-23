# AGENTS.md — instructions for AI agents (Codex, Claude, and others)

This repo is **Kaza Booking**, deployed on a **shared production VPS that also hosts
Novatova** behind a single shared reverse proxy (`novatova-nginx` on ports 80/443). A
careless production command can take Novatova offline, wipe the Kaza database, or
permanently block every future deployment.

> General project/design context for the frontend lives in
> [`.github/copilot-instructions.md`](.github/copilot-instructions.md),
> [`PRODUCT.md`](PRODUCT.md), and [`DESIGN.md`](DESIGN.md). **This file governs
> production/VPS/deployment safety**, which overrides convenience.

## Before you touch production — the four rules

1. **Invoke the `production-deployment` skill.** It is the single entry point, mirrored at
   [`.github/skills/production-deployment/SKILL.md`](.github/skills/production-deployment/SKILL.md)
   and [`.agents/skills/production-deployment/SKILL.md`](.agents/skills/production-deployment/SKILL.md).
   There is exactly one deployment skill; do not add a second.
2. **Inspect the current governance state before planning anything.** Dispatch the
   workflow with `mode=inspect`. If it does not return `GOVERNED`, stop and report — do
   not deploy to "fix" it.
3. **Never invent a deployment method.** There is one: the manually dispatched
   `deploy-production.yml` from `refs/heads/main`. If what you are about to do is not in
   [`docs/operations/production-deployment.md`](docs/operations/production-deployment.md),
   stop and report instead.
4. **Report risks before executing, not after.** State the target SHA, mode, expected
   impact, and rollback method, then wait for authorization.

## The one-way door

Production is `GOVERNED` (since 2026-08-23, `e628ad9c…`). Before every build, the deploy
verifies each running container's image ID against the last successful audit record. A
container built or recreated by hand does not match, the one-time legacy-adoption input is
permanently spent, and the recovery input needs a manifest only a *failed trusted run* can
write.

**One manual `docker compose up -d api` on this host blocks every future deployment.** The
only exit is an owner-authorized incident procedure. There is no shortcut back.

## Kaza / Novatova production — non-negotiable rules

- **Never** deploy by hand: no `docker compose up`/`build`/`down` against `kaza-prod`, no
  manual container recreate, no manual `docker image tag`.
- **Never** `git checkout`, `git pull`, `git reset`, or edit files inside
  `/opt/apps/kaza-booking`. It is production identity; only the deploy may move it, and it
  is expected to be clean and detached.
- **Never** change the database directly — no ad-hoc SQL, no manual `schema_migrations`
  rows, no password, user, ownership, or inventory writes.
- **Never** run migrations during a code deploy. A schema change is `mode=release`, always.
- **Never** recreate or restart `kaza-prod-db`.
- **Never** start Kaza's `nginx`/`certbot` on 80/443 — they are `profiles: ["edge"]` and
  must stay OFF (the shared `novatova-nginx` owns those ports).
- **Never** restart Novatova containers (`novatova-*`). `novatova-nginx` may only be
  inspected, `nginx -t`-tested, and reloaded — never restarted.
- **Never** touch the database without a verified backup first.
- **Never** deploy from `dev`, from an unreviewed SHA, or from a SHA that is not reachable
  from `origin/main`.
- **Never** print secrets (passwords/tokens/JWTs/connection strings); redact all output.
- **Always** use the repo path `/opt/apps/kaza-booking` (never the stale `/opt/kaza/app`).
- **Always** identify live production by reconciliation, not inference —
  `scripts/production-state.sh` from the trusted control plane. A state file, tag,
  checkout, or comment is not authoritative by itself.
- **Always** run `nginx -t` before any `nginx -s reload` (reload, never restart).
- **Always** close out with a fresh `mode=inspect` and report what you did **not** touch.

## Documentation map

| Need | Document |
|---|---|
| **Deploy, release, roll back, or inspect production** | [`docs/operations/production-deployment.md`](docs/operations/production-deployment.md) — the single source of truth |
| Human operator guide (Arabic, step-by-step) | [`docs/KAZA_PRODUCTION_WORKBOOK.md`](docs/KAZA_PRODUCTION_WORKBOOK.md) |
| Governance model and adoption history | [`docs/operations/production-state-governance.md`](docs/operations/production-state-governance.md) |
| Rollback and recovery detail | [`docs/operations/rollback-and-recovery.md`](docs/operations/rollback-and-recovery.md) |
| Backups, restore, gated migrations | [`docs/operations/database-operations.md`](docs/operations/database-operations.md) |
| Branch protection and trust chain | [`docs/branching.md`](docs/branching.md) |
| Specialist playbooks | [`docs/ai-deployment-skills/README.md`](docs/ai-deployment-skills/README.md) |
| Copy-paste-safe scoped commands | [`docs/ai-deployment-skills/command-templates.md`](docs/ai-deployment-skills/command-templates.md) |
| Historical incidents (history, never instructions) | [`docs/incidents/README.md`](docs/incidents/README.md) |
| The whole docs tree | [`docs/README.md`](docs/README.md) |

## Specialist playbooks

For work that is adjacent to a deployment rather than a deployment itself, open the
matching playbook in [`docs/ai-deployment-skills/`](docs/ai-deployment-skills/):

| Task | Playbook |
|---|---|
| First look at the box / confirm paths & routes | `production-inventory-and-discovery.md` |
| After any recreate (network + edge) | `proxy-network-reattach-and-nginx-reload.md` |
| SSL / cert / nginx config | `ssl-and-nginx-reverse-proxy.md` |
| API 404/500, `libgssapi`, health, DB connect | `api-runtime-and-health-debug.md` |
| Production schema change | `database-migration-production-safety.md` |
| Login testing without leaking secrets | `smoke-accounts-and-secret-hygiene.md` |
| Login succeeds but app freezes / redirect loop | `portal-auth-and-post-login-debug.md` |
| `app.` serves the wrong app (demo vs portal) | `portal-vs-demo-routing-and-build-source.md` |
| Review / dispatch / monitor the deploy | `github-actions-production-deploy-safety.md` |
| Make a live diagnosis durable | `live-hotfix-to-main-durability.md` |
| Temporary SSH access granted | `temporary-ssh-access-hygiene.md` |
| Closing out any production action | `final-verification-and-reporting.md` |
| Choosing the safest path when several exist | `deployment-decision-matrix.md` |

If any **Global Stop Condition** in a playbook is met, **halt and report** rather than
guess. A safe halt beats a risky guess.
