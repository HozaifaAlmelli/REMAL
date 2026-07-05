# AGENTS.md — instructions for AI agents (Codex, Claude, and others)

This repo is **Kaza Booking**, deployed on a **shared production VPS that also hosts
Novatova** behind a single shared reverse proxy (`novatova-nginx` on ports 80/443). A
careless production command can take Novatova offline or wipe the Kaza database. Before
doing any production, VPS, or deployment work, use the deployment skills library.

> General project/design context for the frontend lives in
> [`.github/copilot-instructions.md`](.github/copilot-instructions.md),
> [`PRODUCT.md`](PRODUCT.md), and [`DESIGN.md`](DESIGN.md). **This file governs
> production/VPS/deployment safety**, which overrides convenience.

## Before ANY production / VPS / deploy task, read these first

0. [`docs/KAZA_PRODUCTION_WORKBOOK.md`](docs/KAZA_PRODUCTION_WORKBOOK.md) — the operator
   workbook (production map, golden rules, per-layer workflows, emergency playbooks)
1. [`docs/ai-deployment-skills/README.md`](docs/ai-deployment-skills/README.md) — index, shared-VPS facts, order of use, emergency stop rules
2. [`docs/ai-deployment-skills/shared-vps-production-safety.md`](docs/ai-deployment-skills/shared-vps-production-safety.md)
3. [`docs/ai-deployment-skills/production-inventory-and-discovery.md`](docs/ai-deployment-skills/production-inventory-and-discovery.md)
4. [`docs/ai-deployment-skills/docker-compose-scoped-deploy.md`](docs/ai-deployment-skills/docker-compose-scoped-deploy.md)
5. [`docs/ai-deployment-skills/github-actions-production-deploy-safety.md`](docs/ai-deployment-skills/github-actions-production-deploy-safety.md)
6. [`docs/ai-deployment-skills/live-hotfix-to-main-durability.md`](docs/ai-deployment-skills/live-hotfix-to-main-durability.md)
7. [`docs/ai-deployment-skills/final-verification-and-reporting.md`](docs/ai-deployment-skills/final-verification-and-reporting.md)

Keep [`docs/ai-deployment-skills/command-templates.md`](docs/ai-deployment-skills/command-templates.md)
open for copy-paste-safe, scoped commands. The full documentation map is
[`docs/README.md`](docs/README.md); historical incident context is in
[`docs/incidents/`](docs/incidents/README.md) (history — never current instructions).

## Kaza / Novatova production — non-negotiable rules

- **Never** run `docker compose down`.
- **Never** run a bare `docker compose up -d` (no service scope). Recreate one service
  only: `docker compose ... up -d --no-deps <service>`.
- **Never** start Kaza's `nginx`/`certbot` on 80/443 — they are `profiles: ["edge"]`
  and must stay OFF (the shared `novatova-nginx` owns those ports).
- **Never** restart Novatova containers (`novatova-*`). `novatova-nginx` may only be
  inspected, `nginx -t`-tested, and reloaded — never restarted.
- **Never** touch the database without a verified backup first.
- **Never** leave a VPS-only hotfix without a PR to `main` — the production deploy
  force-checks-out `main`, so any VPS-only edit is wiped.
- **Always** use the repo path `/opt/apps/kaza-booking` (never the stale `/opt/kaza/app`).
- **Always** use **service-scoped** compose commands (`--no-deps <service>`).
- **Always** run `nginx -t` before any `nginx -s reload` (reload, never restart).
- **Never** print secrets (passwords/tokens/JWTs/connection strings); redact all output.

## Choosing the right skill

If a task involves the **API, portal, DB, nginx, SSL, GitHub Actions, or VPS access**,
open the matching playbook in [`docs/ai-deployment-skills/`](docs/ai-deployment-skills/):

| Task | Skill |
|---|---|
| First look at the box / confirm paths & routes | `production-inventory-and-discovery.md` |
| Recreate one Kaza service | `docker-compose-scoped-deploy.md` |
| After any recreate (network + edge) | `proxy-network-reattach-and-nginx-reload.md` |
| SSL / cert / nginx config | `ssl-and-nginx-reverse-proxy.md` |
| API 404/500, `libgssapi`, health, DB connect | `api-runtime-and-health-debug.md` |
| Production schema change | `database-migration-production-safety.md` |
| Login testing without leaking secrets | `smoke-accounts-and-secret-hygiene.md` |
| Login succeeds but app freezes / redirect loop | `portal-auth-and-post-login-debug.md` |
| `app.` serves the wrong app (demo vs portal) | `portal-vs-demo-routing-and-build-source.md` |
| Review / merge / monitor the deploy | `github-actions-production-deploy-safety.md` |
| Make a live fix durable | `live-hotfix-to-main-durability.md` |
| Temporary SSH access granted | `temporary-ssh-access-hygiene.md` |
| Closing out any production action | `final-verification-and-reporting.md` |
| Choosing the safest path when several exist | `deployment-decision-matrix.md` |

If any **Global Stop Condition** in a skill is met, **halt and report** rather than guess.
A safe halt beats a risky guess.
