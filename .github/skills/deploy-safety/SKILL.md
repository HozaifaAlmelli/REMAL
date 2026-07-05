---
name: deploy-safety
description: >
  Use this BEFORE any production action on the Kaza Booking stack, which runs on a
  SHARED Hostinger VPS that also hosts Novatova behind a single shared reverse proxy
  (novatova-nginx on ports 80/443). Invoke whenever the task involves: deploying,
  hotfixing, or operating Kaza in production; running docker / docker compose against
  kaza-prod-api / kaza-prod-demo / kaza-prod-portal / kaza-prod-db; nginx / certbot /
  SSL / TLS certificate work; the proxy-network Docker network; the Deploy Production
  GitHub Actions workflow; database migrations or backups on the production DB;
  smoke-account or credential testing; a post-login freeze / redirect loop on
  app.kaza-booking.com; app-vs-demo routing; or being granted temporary SSH access to
  the VPS. Trigger even if the user does not say "deploy" — words like VPS, Kaza,
  Novatova, nginx, proxy-network, migration, /opt/apps/kaza-booking, or "login freezes"
  are enough. This skill routes you to the full playbook library and enforces the
  non-negotiable shared-VPS safety rules. Not for local dev-only or pure UI design work.
version: 1.0.0
user-invocable: true
---

# Kaza / Novatova shared-VPS deployment safety

You are about to operate a **live production stack on a shared host**. Another
tenant (**Novatova**) runs on the same VPS behind the same reverse proxy. A careless
command can take Novatova down or wipe the Kaza DB. Slow down and use the playbooks.

> This is the durable, committed copy of the entry-point skill. In an active Claude
> Code session it is mirrored to `.claude/skills/deploy-safety/` (which is gitignored,
> like every skill under `.claude/`). The full library lives in `docs/ai-deployment-skills/`.

## Do this first

1. **Read the library index:** [`docs/ai-deployment-skills/README.md`](../../../docs/ai-deployment-skills/README.md).
   It has the skills index, the shared-VPS facts table, and the order of use.
2. **Open the specific skill** for your task from that index (e.g.
   `docker-compose-scoped-deploy.md`, `portal-auth-and-post-login-debug.md`,
   `database-migration-production-safety.md`).
3. **Keep** [`docs/ai-deployment-skills/command-templates.md`](../../../docs/ai-deployment-skills/command-templates.md)
   open for copy-paste-safe, scoped commands.

## Non-negotiables (full detail in the skills)

- **Never** `docker compose down`. **Never** a bare `docker compose up -d`. Recreate
  one service only: `"${COMPOSE[@]}" up -d --no-deps <service>`.
- **Never** touch, restart, or reconfigure Novatova. `novatova-nginx` may only be
  inspected, `nginx -t`-tested, and **reloaded** (never restarted), and only after
  `nginx -t` passes.
- **Kaza must never bind 80/443** — the `nginx`/`certbot` services are `profiles: ["edge"]`
  and stay OFF on this host.
- **Back up before any DB write** (`scripts/backup-postgres.sh`); migrations are
  additive, gated, and never run during deploy.
- **The VPS is not durable** — production deploy force-checks-out `main`; promote every
  verified live fix to `main` or it is wiped.
- **Never print secrets.** Pipe anything that might contain them through `redact`.
- **Remove any temporary SSH key** at the end and verify access is denied.

## Ground truth in this repo

- Deploy flow: `scripts/deploy-production.sh` (run by `.github/workflows/deploy-production.yml`).
- DB: `scripts/backup-postgres.sh`, `scripts/apply-migrations.sh`, `scripts/restore-postgres.sh`.
- Compose: `docker-compose.prod.yml` (edge services gated behind the `edge` profile).
- Correct paths: repo `/opt/apps/kaza-booking`, env `/opt/kaza/env/.env.production`,
  project `kaza-prod`. The path `/opt/kaza/app` is stale — do not use it.

If any Global Stop Condition in the skills is met, **halt and report** rather than guess.
