---
name: docker-compose-scoped-deploy
description: >
  Rebuild and recreate exactly ONE Kaza service (api, demo, or portal) on the shared
  VPS without recreating the whole stack, starting edge services, or disturbing
  Novatova. The only approved manual recreate procedure.
risk_level: high
when_to_use: >
  You must apply a change to a single Kaza service in production (e.g. rebuild the
  portal after a frontend fix) and cannot wait for the full CI deploy, or you are
  reproducing/patching one service under a hotfix.
do_not_use_when: >
  A full, coordinated release is expected — use the CI Deploy Production workflow (see
  github-actions-production-deploy-safety). Never use this to "just bring everything up".
required_inputs:
  - The exact service to recreate (api | demo | portal)
  - APP_DIR, ENV_FILE, PROJECT confirmed via production-inventory-and-discovery
forbidden_actions:
  - docker compose down / bare docker compose up -d
  - Recreating db unless explicitly intended and backed up
  - Starting the edge (nginx/certbot) profile
  - Omitting --no-deps or the service name
preflight_checks:
  - Snapshot the container's networks BEFORE recreate
  - Confirm env file non-empty; tag the current image for rollback
safe_procedure: "See 'Scoped build + recreate' below."
verification: "Target container healthy; proxy-network attached; nginx -t OK + reloaded; endpoints 200; novatova.com 200."
rollback: "Retag the pre-build image to :prod and up -d --no-deps the service (see command-templates #10)."
stop_conditions: "See 'Global Stop Conditions' below."
final_report_required: true
lessons_from_kaza_incident: >
  A bare `docker compose up -d` recreates every service, can start the edge profile
  (colliding with novatova-nginx on 80/443), and drops proxy-network from the Kaza
  containers. Also, BuildKit attestation makes every build produce a new image digest
  even when all layers are cached, so `up -d` WILL recreate the service — expect the
  recreate and the network reattach + nginx reload that follow it.
---

# Docker Compose scoped deploy (one service only)

The **only** approved manual recreate. It mirrors `scripts/deploy-production.sh`, which
also builds only `api demo portal` and never brings up the edge profile.

## Scoped build + recreate

```bash
# 0. Environment + compose array (see command-templates.md #0 and #2)
APP_DIR="/opt/apps/kaza-booking"; ENV_FILE="/opt/kaza/env/.env.production"; PROJECT="kaza-prod"
test -s "$ENV_FILE" || { echo "FATAL: env-file missing/empty — abort"; exit 1; }
COMPOSE=( docker compose -p "$PROJECT" -f "$APP_DIR/docker-compose.prod.yml"
          --env-file "$ENV_FILE" --project-directory "$APP_DIR" )

SERVICE="portal"   # <-- set to the ONE service: api | demo | portal

# 1. Snapshot networks BEFORE recreate (so you can detect a dropped proxy-network)
docker inspect -f '{{json .NetworkSettings.Networks}}' "kaza-prod-$SERVICE" \
  > "/tmp/kaza-$SERVICE-nets-before.json"

# 2. Tag the current image for rollback BEFORE building (build overwrites the tag)
ROLLBACK_TAG="kaza-$SERVICE:rollback-$(date +%Y%m%d-%H%M%S)"
docker image tag "$(docker inspect -f '{{.Image}}' "kaza-prod-$SERVICE")" "$ROLLBACK_TAG"
echo "rollback image = $ROLLBACK_TAG"

# 3. Build + recreate ONLY this service. --no-deps => dependencies are NOT recreated.
"${COMPOSE[@]}" build "$SERVICE"
"${COMPOSE[@]}" up -d --no-deps "$SERVICE"

# 4. Confirm it came up and kept its config (NOT Development, NOT empty)
sleep 8
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep "kaza-prod-$SERVICE"
docker logs --tail=120 "kaza-prod-$SERVICE"
```

Then **always** run [proxy-network-reattach-and-nginx-reload](proxy-network-reattach-and-nginx-reload.md):
reattach `proxy-network` if the recreate dropped it, `nginx -t`, then `nginx -s reload`.

## Guardrails baked into the procedure

- `--no-deps` + explicit `$SERVICE` → no other Kaza service is rebuilt/recreated.
- The `db` service is **not** in scope. Recreating `db` risks data and is out of
  bounds unless explicitly intended, backed up first, and approved.
- The edge (`nginx`/`certbot`) services are `profiles: ["edge"]`; a scoped
  `build/up <service>` never selects them. If you ever see `kaza-prod-nginx` or
  `kaza-prod-certbot` running, **stop** — that is the 80/443 collision the deploy
  script explicitly fails on.

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

State which single service was rebuilt/recreated; the rollback tag; that `proxy-network`
was reattached; `nginx -t` + reload result; the endpoint checks; and that db/edge/Novatova
were untouched. Remember: a live-only rebuild is wiped by the next deploy — promote to
`main` (see [live-hotfix-to-main-durability](live-hotfix-to-main-durability.md)).
