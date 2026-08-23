# AI Deployment Skills Library — Kaza Booking on the shared Novatova VPS

A durable, reusable set of **playbooks for AI agents (and humans)** operating the
Kaza Booking production stack. Every skill encodes a real lesson learned the hard
way during the Kaza production bring-up on a **shared live VPS** that also runs
**Novatova**. Read the relevant skill *before* you touch anything.

> These are operational safety playbooks, not generic DevOps advice. They exist to
> stop a future agent from repeating a specific, already-paid-for mistake.

> ⚠️ **Deploying, releasing, or rolling back?** Do not start here. Start with
> [`../operations/production-deployment.md`](../operations/production-deployment.md) — the
> single source of truth for the governed deployment path — and its
> `production-deployment` skill. This library holds the *specialist* playbooks that sit
> around a deployment (nginx, SSL, API health, portal auth, SSH hygiene, closeout).

> 👤 **Human operator?** Start with the Arabic-first, step-by-step operator guide:
> [`../KAZA_PRODUCTION_WORKBOOK.md`](../KAZA_PRODUCTION_WORKBOOK.md). It tells you *what*
> to do, *when*, *why*, and *when to stop*, then routes you here for the deep detail.

---

## What this library is

- 15 focused playbook files + this index + [`command-templates.md`](command-templates.md)
  (copy-paste-safe command snippets shared by all playbooks).
- Each skill has a fixed structure: metadata frontmatter, then **Global Stop
  Conditions**, **Forbidden Commands**, preflight checks, a safe procedure with
  concrete commands, verification, rollback, required final report, and the exact
  Kaza incident it prevents.
- The auto-discovery entry point is the single `production-deployment` skill
  (`.github/skills/production-deployment/SKILL.md`, mirrored to `.agents/skills/`). It
  routes to [`../operations/production-deployment.md`](../operations/production-deployment.md)
  for the deployment contract and here for everything around it. There is deliberately
  only one deployment skill; the former `deploy-safety` skill was retired because three
  drifting copies of it had produced three different sets of instructions.

## When to use it

Use it **before, during, and after any production action** on the VPS: deploys,
hotfixes, container recreates, SSL/nginx changes, DB migrations, login/auth
debugging, or SSH access. If you are about to run a command against
`root@<VPS>`, `docker`, `nginx`, `certbot`, `git` on the live repo, or the
production DB — open the matching skill first.

## Skills index

| # | Skill | Use it when |
|---|-------|-------------|
| — | **[production-deployment.md](../operations/production-deployment.md)** | **Any deploy, release, rollback, or state check. Read this first — it is the source of truth, not a playbook.** |
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
2. **Never mutate the application by hand.** No `docker compose` build/up/down against
   `kaza-prod`, no manual recreate, no manual image tag, no `git` operation inside
   `/opt/apps/kaza-booking`. Application changes happen only through the trusted
   Deploy Production workflow, which scopes its own internal recreates.
3. **Kaza must never bind 80/443.** The Kaza `nginx`/`certbot` services exist only
   under the `edge` compose profile and must stay off on this host.
4. **`nginx -t` before any reload.** Reload, never restart, `novatova-nginx`.
5. **Back up before any DB write.** Migrations are additive, gated, and never run
   during a code deploy.
6. **Migration is not deployment.** A schema-changing release goes through
   `mode: release` (`scripts/release-production.sh`). The code path refuses to build
   when the live database is behind the tree being deployed.
6b. **Provenance is a one-way door.** Production is `GOVERNED`. A hand-built or
   hand-recreated application container no longer just gets overwritten — it **blocks**
   every future deployment, and no workflow input can clear it. See
   [the one-way door](../operations/production-deployment.md#the-one-way-door).
7. **A merge is not a release.** There is no push deploy trigger; production changes
   only via an explicit `workflow_dispatch` from `main`. Current `main` supplies the
   trusted runner; the separate application candidate cannot supply safety logic.
8. **The VPS is not a deployment authority.** Every verified fix must land in `main`.
   Direct execution of candidate or historical deployment scripts is unsupported.
9. **Never print secrets.** Redact passwords/tokens/JWTs/connection strings in every
   log, chat message, and transcript.
10. **Leave no keys behind.** Remove any temporary SSH key and verify access is denied.

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
| Trusted dispatch/bootstrap | `scripts/bootstrap-production-control.sh`, then `scripts/production-dispatch.sh` from current `main` |
| Authoritative deploy script (code only) | current-main control `scripts/deploy-production.sh` with a separate candidate worktree |
| Authoritative release script (schema-changing) | current-main control `scripts/release-production.sh` with a separate candidate worktree |
| Production identity reconciliation | `scripts/production-state.sh` (audit + digest/labels + checkout/state + validated DB head) |
| Release-state authority | `scripts/release-state.sh` (`ledger-head`, `tree-level`, `schema-guard`, `record`, `latest-successful`) |
| Normal production entry point | `.github/workflows/deploy-production.yml` — main-only `workflow_dispatch`, inputs `deploy_sha` + `mode` |
| Live SHA / rollback target / history | `/opt/kaza/releases/current-sha.txt`, `previous-sha.txt`, `deployments.jsonl` (append-only) |
| DB backup / migrate / restore | `scripts/backup-postgres.sh`, `scripts/apply-migrations.sh`, `scripts/restore-postgres.sh` |
| Production release state | Never infer it from this document. Read and reconcile the strict deployment audit, state files, running image IDs, and validated migration ledger. |

## Order of skill usage during a deployment

```
0.  operations/production-deployment.md   (the contract: Inspect -> Prepare -> Execute)
0b. shared-vps-production-safety          (read once, keep in mind throughout)
1.  mode=inspect                          (GO/NO-GO; must return GOVERNED)
2.  deployment-decision-matrix            (deploy vs release; nothing else to choose)
3a. api-runtime-and-health-debug          (if diagnosing the API — read-only)
3b. portal-auth-and-post-login-debug      (if diagnosing login — read-only)
3c. ssl-and-nginx-reverse-proxy           (if SSL/nginx)
3d. database-migration-production-safety  (if schema change — mode=release)
4.  smoke-accounts-and-secret-hygiene     (pre-flight the smoke BEFORE dispatching)
5.  github-actions-production-deploy-safety (dispatch, approve, monitor)
6.  mode=inspect                          (close out; must return GOVERNED again)
7.  final-verification-and-reporting      (prove it worked; prove Novatova/DB safe)
8.  temporary-ssh-access-hygiene          (remove any temp key; verify denied)
```

`proxy-network-reattach-and-nginx-reload` and `docker-compose-scoped-deploy` describe what
the trusted runner does internally; they are reference, not steps you perform.
`live-hotfix-to-main-durability` is now an incident procedure, not a step in a deployment.

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
