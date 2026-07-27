# Incident history — Kaza Booking production stabilization (2026-06 → 2026-07)

Historical record of the incidents hit while bringing Kaza Booking live on a **shared
VPS that also hosts Novatova** behind a single shared reverse proxy (`novatova-nginx`,
ports 80/443). Each lesson here is encoded as a playbook in
[`docs/ai-deployment-skills/`](../ai-deployment-skills/README.md).

> ⚠️ Historical document. Do not execute anything from this file. Current guidance:
> [Kaza Production Workbook](../KAZA_PRODUCTION_WORKBOOK.md).

## Outcome

Production stable: `kaza-booking.com`/`www` → demo (storefront),
`app.kaza-booking.com` → portal (Rental Platform), `api.kaza-booking.com` → API with
`/` + `/health`, DB healthy, Novatova unaffected throughout.

## Incidents and root causes

### 1. Wrong live repo path
Documentation said `/opt/kaza/app`; the real live checkout was `/opt/apps/kaza-booking`.
Work aimed at the stale path was operating on a dead tree.
**Lesson:** derive the live path from compose labels, never trust docs paths.
→ [production-inventory-and-discovery](../ai-deployment-skills/production-inventory-and-discovery.md)

### 2. Missing SSL cert / unresolved nginx placeholder
Kaza domains had no cert initially, and a shared nginx config contained an unresolved
`${DOMAIN}` placeholder that broke `nginx -t`. The correct substitution belonged to the
*owning* tenant (novatova.com), not Kaza.
**Lesson:** on a shared edge, fix only your tenant's blocks; `nginx -t` before any reload.
→ [ssl-and-nginx-reverse-proxy](../ai-deployment-skills/ssl-and-nginx-reverse-proxy.md)

### 3. SSL vs upstream confusion
`api.` returned 404 **with a valid certificate** — a missing app route, not an SSL
failure. Time was nearly lost "fixing" certificates.
**Lesson:** distinguish SSL error vs 404 (missing route) vs 502 (upstream unreachable) first.

### 4. API runtime failure (libgssapi)
The .NET aspnet Debian runtime image lacked `libgssapi_krb5.so.2`, which Npgsql loads at
PostgreSQL connect — DB-touching endpoints failed. The API also had no `/` or `/health`
routes, so it answered 404 at its root.
**Fix:** install `libgssapi-krb5-2` + `ca-certificates` in the runtime stage; add `/` and
`/health` endpoints (merged to `main` as `fix(api): install libgssapi and add health endpoints`).
→ [api-runtime-and-health-debug](../ai-deployment-skills/api-runtime-and-health-debug.md)

### 5. Unsafe deploy pipeline
The original pipeline used the wrong path, a bare `docker compose up -d`, and would start
Kaza's own `nginx`/`certbot` binding 80/443 — a direct collision with `novatova-nginx`.
**Fix:** service-scoped deploy (`up -d --no-deps <service>`), edge services gated behind
`profiles: ["edge"]`, health checks, SHA recording (`scripts/deploy-production.sh`).
→ [github-actions-production-deploy-safety](../ai-deployment-skills/github-actions-production-deploy-safety.md)

### 6. proxy-network dropped on recreate
`proxy-network` is an external network not defined in the compose file — recreated
containers silently lost it, and `novatova-nginx` (static upstreams, no resolver, cached
IPs) returned 502 until the network was reattached and nginx **reloaded** (never restarted).
→ [proxy-network-reattach-and-nginx-reload](../ai-deployment-skills/proxy-network-reattach-and-nginx-reload.md)

### 7. VPS-only hotfix overwritten
A live fix applied only on the VPS was wiped because the deploy force-checks-out `main`.
**Lesson:** every live fix must land in `main` via PR before the next deploy.
→ [live-hotfix-to-main-durability](../ai-deployment-skills/live-hotfix-to-main-durability.md)

### 8. Owner login broken — missing columns + duplicated migration number
Production DB lacked owner contact columns, and migration number `0048` had been
duplicated. **Fix:** verified backup first, then a new *additive* migration with a unique
number (`0057_add_owner_contact_fields`) through the gated runner.
→ [database-migration-production-safety](../ai-deployment-skills/database-migration-production-safety.md)

### 9. Smoke-credential hygiene
Dev credentials do not exist in production; testing needed dedicated smoke accounts with
a root-only (`chmod 600`) credentials file, never printed to chat/logs.
→ [smoke-accounts-and-secret-hygiene](../ai-deployment-skills/smoke-accounts-and-secret-hygiene.md)

### 10. Post-login freeze / redirect loop on the portal
Edge middleware gated on the `refresh_token` cookie — which is host-only on the **api**
host and invisible on `app.` cross-subdomain — so every login bounced. **Fix:** frontend-only
middleware pass-through (client shells enforce auth), portal rebuild only; no backend
cookie-Domain change.
→ [portal-auth-and-post-login-debug](../ai-deployment-skills/portal-auth-and-post-login-debug.md)

### 11. Temporary SSH key hygiene
A temporary agent SSH key had to be tagged, removed after use, and the denial verified.
→ [temporary-ssh-access-hygiene](../ai-deployment-skills/temporary-ssh-access-hygiene.md)

## Durable outputs of the stabilization

- `docs/ai-deployment-skills/` — 15 playbooks + command templates (PR "docs: add AI
  deployment safety skills").
- `docs/KAZA_PRODUCTION_WORKBOOK.md` — Arabic-first operator workbook.
- `AGENTS.md` + `.github/skills/deploy-safety/` + `.agents/skills/deploy-safety/` —
  agent entry points.
- Hardened `scripts/deploy-production.sh`, gated `scripts/apply-migrations.sh`,
  `scripts/backup-postgres.sh` / `restore-postgres.sh` / `backup-uploads.sh`.
