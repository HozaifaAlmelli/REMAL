---
name: production-inventory-and-discovery
description: >
  Discover the REAL production environment before changing anything. Never trust
  documented or remembered paths — confirm project, service, network, routes, and
  live endpoints from the running containers themselves.
risk_level: low
when_to_use: >
  As the very first step on the VPS, before any deploy, debug, or fix. Re-run it any
  time you are unsure which container, path, network, or route you are dealing with.
do_not_use_when: >
  Never skip it. Even "I already know the path" is a reason to confirm — the path
  everyone remembered (/opt/kaza/app) was wrong.
required_inputs:
  - SSH access to the VPS
  - The expected facts from the README to compare against reality
forbidden_actions:
  - Any write/mutation — this skill is strictly read-only
  - Printing env output without piping through redact
preflight_checks:
  - Confirm you can reach the host and run docker read commands
safe_procedure: "See 'Read-only inventory' below."
verification: "You can state the confirmed repo path, project, services, networks, and routes."
rollback: "None — read-only."
stop_conditions: "See 'Global Stop Conditions' below."
final_report_required: true
lessons_from_kaza_incident: >
  The expected repo path /opt/kaza/app was WRONG; the real live path (confirmed from
  compose labels) is /opt/apps/kaza-booking. Acting on the stale path would have built
  and deployed the wrong tree. Always derive the path from the running container's
  com.docker.compose.project.working_dir label, not from docs or memory.
---

# Production inventory & discovery (read-only)

Confirm ground truth from the running system. **Nothing here mutates anything.**

## Read-only inventory

```bash
# 1. What is actually running (Kaza + Novatova + everything else on the host)
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# 2. Derive the REAL repo path, project, and service from compose labels.
#    Trust THIS over any documented path. (Lesson: /opt/kaza/app was stale.)
for c in kaza-prod-api kaza-prod-demo kaza-prod-portal kaza-prod-db; do
  echo "== $c =="
  docker inspect -f 'project={{index .Config.Labels "com.docker.compose.project"}}
service={{index .Config.Labels "com.docker.compose.service"}}
workdir={{index .Config.Labels "com.docker.compose.project.working_dir"}}
files={{index .Config.Labels "com.docker.compose.project.config_files"}}' "$c"
done
# Expect: project=kaza-prod, workdir=/opt/apps/kaza-booking.

# 3. Verify the env file exists and is non-empty (do NOT cat it).
test -s /opt/kaza/env/.env.production && echo "env-file OK" || echo "env-file MISSING/EMPTY"

# 4. Networks (needed before any recreate — proxy-network can be dropped on recreate)
docker inspect -f '{{json .NetworkSettings.Networks}}' kaza-prod-api    | tr ',' '\n'
docker inspect -f '{{json .NetworkSettings.Networks}}' novatova-nginx   | tr ',' '\n'
docker network ls

# 5. How novatova-nginx routes Kaza (static upstream vs resolver) — governs whether a
#    reload is needed after recreate.
docker exec novatova-nginx nginx -T 2>/dev/null \
  | grep -nE 'kaza-booking|kaza-prod-(api|demo|portal)|resolver|proxy_pass|upstream'

# 6. Live endpoints (record the baseline BEFORE you change anything)
for d in kaza-booking.com www.kaza-booking.com app.kaza-booking.com api.kaza-booking.com novatova.com; do
  echo "== $d =="; curl -sS -I "https://$d" --max-time 15 || true
done

# 7. Env sanity for one service, redacted (never raw)
docker exec kaza-prod-api sh -lc 'printenv | sort' | redact
```

## What "good" looks like

- `project=kaza-prod`, `workdir=/opt/apps/kaza-booking` on all four Kaza containers.
- `kaza-prod-{api,demo,portal}` attached to `proxy-network`; `kaza-prod-db` on the
  internal network only (not published to the host).
- No `kaza-prod-nginx` / `kaza-prod-certbot` running (edge profile stays off).
- `novatova.com` returns 200/301/302 (your do-not-regress baseline).

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

State the confirmed repo path, compose project, service→container map, networks,
how nginx routes Kaza, and the baseline endpoint statuses (including `novatova.com`).
