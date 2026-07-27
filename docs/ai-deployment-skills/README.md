# AI Deployment Skills Library — Kaza Booking on the shared Novatova VPS

A durable, reusable set of **playbooks for AI agents (and humans)** operating the
Kaza Booking production stack. Every skill encodes a real lesson learned the hard
way during the Kaza production bring-up on a **shared live VPS** that also runs
**Novatova**. Read the relevant skill *before* you touch anything.

> These are operational safety playbooks, not generic DevOps advice. They exist to
> stop a future agent from repeating a specific, already-paid-for mistake.

> 👤 **Human operator?** Start with the Arabic-first, step-by-step operator guide:
> [`../KAZA_PRODUCTION_WORKBOOK.md`](../KAZA_PRODUCTION_WORKBOOK.md). It tells you *what*
> to do, *when*, *why*, and *when to stop*, then routes you here for the deep detail.

---

## What this library is

- 15 focused skill files + this index + [`command-templates.md`](command-templates.md)
  (copy-paste-safe command snippets shared by all skills).
- Each skill has a fixed structure: metadata frontmatter, then **Global Stop
  Conditions**, **Forbidden Commands**, preflight checks, a safe procedure with
  concrete commands, verification, rollback, required final report, and the exact
  Kaza incident it prevents.
- An auto-discovery entry point lives at `.claude/skills/deploy-safety/SKILL.md`,
  which routes agents here. This directory is the source of truth.

## When to use it

Use it **before, during, and after any production action** on the VPS: deploys,
hotfixes, container recreates, SSL/nginx changes, DB migrations, login/auth
debugging, or SSH access. If you are about to run a command against
`root@<VPS>`, `docker`, `nginx`, `certbot`, `git` on the live repo, or the
production DB — open the matching skill first.

## Skills index

| # | Skill | Use it when |
|---|-------|-------------|
| — | [shared-vps-production-safety](shared-vps-production-safety.md) | Always. The non-negotiable baseline for any action on this host. |
| — | [production-inventory-and-discovery](production-inventory-and-discovery.md) | First thing on the box — discover the *real* environment; never trust docs paths. |
| — | [ssl-and-nginx-reverse-proxy](ssl-and-nginx-reverse-proxy.md) | Cert missing/expired, `nginx -t` fails, 404/502 vs SSL confusion. |
| — | [docker-compose-scoped-deploy](docker-compose-scoped-deploy.md) | Rebuild/recreate one Kaza service safely. |
| — | [proxy-network-reattach-and-nginx-reload](proxy-network-reattach-and-nginx-reload.md) | After any container recreate — reattach network, reload nginx. |
| — | [live-hotfix-to-main-durability](live-hotfix-to-main-durability.md) | You applied a live fix; make it survive the next deploy. |
| — | [github-actions-production-deploy-safety](github-actions-production-deploy-safety.md) | Review/merge/monitor the Deploy Production workflow. |
| — | [api-runtime-and-health-debug](api-runtime-and-health-debug.md) | API up but 404/500, `libgssapi`, health endpoint, DB connect. |
| — | [database-migration-production-safety](database-migration-production-safety.md) | Any production schema change. |
| — | [smoke-accounts-and-secret-hygiene](smoke-accounts-and-secret-hygiene.md) | Login-testing prod without leaking secrets or touching real users. |
| — | [portal-auth-and-post-login-debug](portal-auth-and-post-login-debug.md) | Login succeeds but the app freezes / redirect loop. |
| — | [portal-vs-demo-routing-and-build-source](portal-vs-demo-routing-and-build-source.md) | `app.` serves the wrong app (demo vs portal). |
| — | [temporary-ssh-access-hygiene](temporary-ssh-access-hygiene.md) | You were granted temporary SSH access. |
| — | [final-verification-and-reporting](final-verification-and-reporting.md) | Closing out any production action. |
| — | [deployment-decision-matrix](deployment-decision-matrix.md) | Choosing the safest path when several exist. |

## Production safety principles (the short list)

1. **This is a shared host.** Novatova is a separate, live tenant. Kaza work must
   never restart, reconfigure, or risk Novatova. `novatova-nginx` owns ports
   **80/443** for everyone.
2. **Scope every action.** Recreate one service with `up -d --no-deps <service>`.
   Never `docker compose down`. Never a bare `docker compose up -d`.
3. **Kaza must never bind 80/443.** The Kaza `nginx`/`certbot` services exist only
   under the `edge` compose profile and must stay off on this host.
4. **`nginx -t` before any reload.** Reload, never restart, `novatova-nginx`.
5. **Back up before any DB write.** Migrations are additive, gated, and never run
   during deploy.
6. **The VPS is not durable.** Production deploy force-checks-out `main`; any
   VPS-only edit is wiped on the next deploy. Every verified fix must land in `main`.
7. **Never print secrets.** Redact passwords/tokens/JWTs/connection strings in every
   log, chat message, and transcript.
8. **Leave no keys behind.** Remove any temporary SSH key and verify access is denied.

## Shared VPS assumptions (Kaza / Novatova)

| Fact | Value |
|------|-------|
| Correct live repo path | `/opt/apps/kaza-booking` |
| Wrong/stale path (do not use) | `/opt/kaza/app` |
| Production env file | `/opt/kaza/env/.env.production` |
| Compose project | `kaza-prod` |
| Compose file | `/opt/apps/kaza-booking/docker-compose.prod.yml` |
| Kaza app services | `db`, `api`, `demo`, `portal` (containers `kaza-prod-*`) |
| Kaza edge services (must stay OFF here) | `nginx`, `certbot` — `profiles: ["edge"]` |
| Shared edge proxy (owns 80/443) | `novatova-nginx` |
| Shared external Docker network | `proxy-network` (not defined in the compose file; reattached by the deploy script) |
| Domains → app | `kaza-booking.com`/`www` → **demo**, `app.kaza-booking.com` → **portal**, `api.kaza-booking.com` → **api** |
| Novatova domain (safety signal only) | `novatova.com` |
| Authoritative deploy script | `scripts/deploy-production.sh` (run by `.github/workflows/deploy-production.yml`) |
| DB backup / migrate / restore | `scripts/backup-postgres.sh`, `scripts/apply-migrations.sh`, `scripts/restore-postgres.sh` |
| Last known-good SHA | `3e962da` (portal freeze + API health fixed, Novatova untouched, DB not recreated) |

## Order of skill usage during a deployment

```
0. shared-vps-production-safety          (read once, keep in mind throughout)
1. production-inventory-and-discovery    (confirm paths, project, networks, routes)
2. deployment-decision-matrix            (pick the safest path for THIS change)
3a. docker-compose-scoped-deploy         (if recreating a service)
3b. api-runtime-and-health-debug         (if diagnosing the API)
3c. portal-auth-and-post-login-debug     (if diagnosing login)
3d. ssl-and-nginx-reverse-proxy          (if SSL/nginx)
3e. database-migration-production-safety  (if schema change — backup first)
4. proxy-network-reattach-and-nginx-reload (after ANY recreate)
5. live-hotfix-to-main-durability        (promote every verified live fix to main)
6. github-actions-production-deploy-safety (merge/monitor the deploy)
7. final-verification-and-reporting      (prove it worked; prove Novatova/DB safe)
8. temporary-ssh-access-hygiene          (remove any temp key; verify denied)
```

## Emergency stop rules

**Stop and report — do not proceed — the moment any of these is true:**

- A command would touch, restart, or reconfigure **Novatova** (`novatova-*`).
- A command would **start a service binding 80/443** (Kaza `nginx`/`certbot`).
- A step requires **`docker compose down`** or a **bare `docker compose up -d`**.
- **`nginx -t` fails** at any point.
- The **env file is missing or empty**, or the **live repo path is uncertain**.
- **Compose labels don't match** `kaza-prod` / the expected service.
- A **DB backup fails** (or can't be verified) before a DB write.
- The **live working tree has unexpected local changes** before a git op.
- A **secret would be printed**, an **old migration would be edited / a number reused**,
  or a **real user's password would be reset**.
- A **temporary SSH key can't be removed** after the task.

When you stop: capture what you saw (redacted), state exactly what you did and did
*not* do, and hand back to a human. A safe halt beats a risky guess.
