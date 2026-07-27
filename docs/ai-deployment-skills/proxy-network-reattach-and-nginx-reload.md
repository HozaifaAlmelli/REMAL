---
name: proxy-network-reattach-and-nginx-reload
description: >
  After ANY Kaza container recreate, reattach the shared proxy-network to the affected
  Kaza containers and reload novatova-nginx so it picks up the new upstream IPs — all
  without restarting nginx or touching Novatova containers.
risk_level: high
when_to_use: >
  Immediately after recreating kaza-prod-api / kaza-prod-demo / kaza-prod-portal (scoped
  deploy, hotfix rebuild, or CI deploy verification). Also when a Kaza domain suddenly
  502s after a recreate (stale cached upstream IP).
do_not_use_when: >
  No container was recreated and no 502 is present. Do not reload nginx "just in case"
  on an untouched, healthy edge.
required_inputs:
  - Which Kaza containers were recreated
  - The before/after network snapshots (see docker-compose-scoped-deploy)
forbidden_actions:
  - Restarting novatova-nginx (reload only)
  - Reloading before nginx -t passes
  - Connecting Novatova containers to networks
  - Recreating a container to "fix" its network config
preflight_checks:
  - Compare before/after network attachments for each recreated container
  - Confirm novatova-nginx uses static upstreams (needs reload) vs a resolver
safe_procedure: "See 'Reattach then reload' below."
verification: "Each Kaza container back on proxy-network; nginx -t OK; endpoints 200; novatova.com 200."
rollback: "Network connect is additive and safe; if a reload surfaced a bad config, restore the config backup and reload again."
stop_conditions: "See 'Global Stop Conditions' below."
final_report_required: true
lessons_from_kaza_incident: >
  Recreating Kaza containers dropped proxy-network, so novatova-nginx (name-based static
  upstreams, NO resolver) kept routing to dead/old IPs and returned 502. The fix is to
  reconnect ONLY the affected Kaza containers to proxy-network and reload nginx after
  nginx -t. Never restart novatova-nginx; a restart risks every tenant it fronts.
---

# proxy-network reattach & nginx reload

The shared `proxy-network` is **external** — it is not defined in
`docker-compose.prod.yml`, so a recreate can silently drop it. `novatova-nginx` caches
upstream IPs (no `resolver`), so a dropped/changed network means 502 until you reload.

## Reattach then reload

```bash
PROXY_NETWORK="proxy-network"

# 1. Reattach ONLY the Kaza app containers that were recreated (idempotent).
for c in kaza-prod-api kaza-prod-demo kaza-prod-portal; do
  if docker ps --format '{{.Names}}' | grep -qx "$c"; then
    if ! docker inspect -f '{{json .NetworkSettings.Networks}}' "$c" | grep -q "\"$PROXY_NETWORK\""; then
      echo "reattaching $PROXY_NETWORK -> $c"
      docker network connect "$PROXY_NETWORK" "$c"
    else
      echo "$c already on $PROXY_NETWORK"
    fi
  fi
done
# NOTE: only iterate the containers you actually recreated. Never connect Novatova
# containers to anything.

# 2. Validate config, THEN reload (never restart). Reload refreshes cached upstream IPs.
docker exec novatova-nginx nginx -t
docker exec novatova-nginx nginx -s reload

# 3. Prove the 502 is gone
curl -sS -I https://app.kaza-booking.com --max-time 15
curl -sS -I https://api.kaza-booking.com --max-time 15
curl -sS -I https://novatova.com --max-time 15   # unaffected
```

## Why reload (not restart), and why it's needed at all

- `novatova-nginx` resolves `kaza-prod-portal:3001` etc. **once** and caches the IP.
  A recreate gives the container a new IP → nginx 502s against the stale one until
  reloaded.
- `nginx -s reload` re-resolves upstreams with **zero downtime** for all tenants.
- `docker restart novatova-nginx` would drop every tenant's connections and risks a
  bad-config container that won't come back — forbidden.

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

State which containers were reattached to `proxy-network`; `nginx -t` result; that you
reloaded (not restarted) nginx; the endpoint checks; and that `novatova.com` stayed up.
