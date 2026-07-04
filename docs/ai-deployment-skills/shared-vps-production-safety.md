---
name: shared-vps-production-safety
description: >
  The baseline safety contract for ANY action on the shared VPS that hosts both Kaza
  Booking and Novatova. Read it first, every time, and keep it in mind throughout.
risk_level: critical
when_to_use: >
  Before and during every production action on the VPS — deploys, container recreates,
  nginx/SSL work, DB changes, debugging, or SSH sessions. This is the umbrella rule set
  every other skill assumes.
do_not_use_when: >
  You are working purely locally (local dev server, unit tests, UI design) with no
  connection to the production host.
required_inputs:
  - Confirmation that you are on the correct host and the task is Kaza-scoped
  - The shared-VPS facts (paths, project, containers) from the library README
forbidden_actions:
  - Any command affecting Novatova containers, config, certs, or data
  - docker compose down / bare docker compose up -d
  - Starting any service that binds host ports 80 or 443
  - Deleting Docker volumes, /etc/letsencrypt, or running docker system prune
  - Editing the production env file without explicit human approval
preflight_checks:
  - Confirm host and that Novatova is present and healthy (baseline you must not regress)
  - Confirm correct paths and compose project labels (see production-inventory-and-discovery)
safe_procedure: "See 'The safety contract' below — it is a rule set, not a sequence."
verification: "novatova.com still 200/301/302; no Novatova container restarted; nginx -t OK."
rollback: "If any rule was about to be broken, stop before acting; nothing to roll back."
stop_conditions: "See 'Global Stop Conditions' below."
final_report_required: true
lessons_from_kaza_incident: >
  Kaza was deployed onto a live Novatova host. Bare compose commands, edge-service
  collisions on 80/443, and dropped networks each threatened Novatova. Scoping every
  action and never touching the other tenant is what kept Novatova up throughout.
---

# Shared-VPS production safety

Kaza Booking runs on a **shared, live VPS** alongside **Novatova**. `novatova-nginx`
is the single public reverse proxy on **ports 80/443** for both tenants. Treat
Novatova as untouchable production you happen to share a machine with.

## The safety contract

**Isolation**
- Never touch, restart, or reconfigure Novatova (`novatova-*`). Only `novatova.com`
  may be *checked* (as a safety signal) and `novatova-nginx` may be *inspected /
  `nginx -t`-tested / reloaded* — never restarted.
- Do not "fix" unrelated tenants (n8n, chatwoot, evolution, etc.) as a side quest.

**Container lifecycle**
- Never `docker compose down`.
- Never a bare `docker compose up -d`. The only approved recreate is
  `"${COMPOSE[@]}" up -d --no-deps <service>` (see
  [docker-compose-scoped-deploy](docker-compose-scoped-deploy.md)).
- Never start a service that binds 80/443. Kaza's own `nginx`/`certbot` live under
  `profiles: ["edge"]` and must stay OFF here.

**Network / proxy**
- A recreate can drop the shared `proxy-network`; reattach it and reload
  `novatova-nginx` **only after `nginx -t` passes** (see
  [proxy-network-reattach-and-nginx-reload](proxy-network-reattach-and-nginx-reload.md)).
- Reload nginx, never restart it.

**Data**
- No Docker volume removal (`docker volume rm`) — it destroys the DB, certs, uploads.
- No `docker system prune` / `builder prune -a`.
- No destructive SQL. Back up before any DB write (see
  [database-migration-production-safety](database-migration-production-safety.md)).
- Do not delete or edit `/etc/letsencrypt`; do not `certbot delete`.

**Config / secrets**
- No edits to `/opt/kaza/env/.env.production` without explicit human approval.
- Never print/write secrets. Pipe suspect output through `redact` (see
  [command-templates](command-templates.md#1-redaction-wrap-every-command-whose-output-may-contain-secrets)).

**Durability**
- The VPS is not durable: production deploy force-checks-out `main`. Promote every
  verified live fix to `main` (see
  [live-hotfix-to-main-durability](live-hotfix-to-main-durability.md)).

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

State: what you did; what you deliberately did **not** touch (Novatova, DB, env);
`nginx -t` result; `novatova.com` status; and any Stop Condition you hit.
