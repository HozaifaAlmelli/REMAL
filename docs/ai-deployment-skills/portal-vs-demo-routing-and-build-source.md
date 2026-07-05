---
name: portal-vs-demo-routing-and-build-source
description: >
  Ensure each Kaza domain serves the RIGHT app — app.kaza-booking.com must serve the
  rental-platform portal, not the demo storefront. Verify nginx upstreams and the compose
  build contexts, then rebuild only the affected service.
risk_level: medium
when_to_use: >
  app.kaza-booking.com shows the storefront/landing page instead of the portal (or vice
  versa), or you suspect a service was built from the wrong source directory.
do_not_use_when: >
  Routing is correct and the issue is inside the app (auth loop -> portal-auth-and-post-login-debug;
  API errors -> api-runtime-and-health-debug).
required_inputs:
  - Which domain serves the wrong app
  - Access to novatova-nginx upstream config and the compose build contexts
forbidden_actions:
  - Editing another tenant's server block
  - Rebuilding a service from the wrong context to "make it match"
  - Restarting novatova-nginx
preflight_checks:
  - Map each domain -> upstream -> container in novatova-nginx
  - Confirm each service's compose build context (demo vs rental-platform)
safe_procedure: "See 'Verify routing + build source' below."
verification: "Each domain serves the expected app (distinct HTML title/markers); portal != demo; novatova.com 200."
rollback: "Retag the pre-build image to :prod and up -d --no-deps <service>; restore any nginx file from backup + reload."
stop_conditions: "See 'Global Stop Conditions' below."
final_report_required: true
lessons_from_kaza_incident: >
  app.kaza-booking.com needed to serve the rental-platform PORTAL, but was serving the
  demo/landing page. The fix was to route app. to the portal upstream and build the portal
  service from ./rental-platform (the demo builds from ./demo). Confirm the mapping in
  novatova-nginx AND the compose build contexts before rebuilding, then rebuild only the
  affected service.
---

# Portal vs demo routing & build source

Two Next.js apps, four domains. Getting the mapping wrong shows the storefront where the
portal belongs. Verify **both** the edge route and the build source.

## Expected routing

| Domain | Serves | Upstream | Compose service | Build context |
|---|---|---|---|---|
| `kaza-booking.com` | demo (storefront) | `kaza-prod-demo:3000` | `demo` | `./demo` |
| `www.kaza-booking.com` | demo (storefront) | `kaza-prod-demo:3000` | `demo` | `./demo` |
| `app.kaza-booking.com` | **portal** (rental-platform) | `kaza-prod-portal:3001` | `portal` | `./rental-platform` |
| `api.kaza-booking.com` | API | `kaza-prod-api:8080` | `api` | `RentalPlatform.API/Dockerfile` |

## Verify routing + build source

```bash
# 1. Edge: which upstream does each host map to?
docker exec novatova-nginx nginx -T 2>/dev/null \
  | grep -nE 'server_name (app|www)?\.?kaza-booking\.com|proxy_pass|upstream (kaza_portal|kaza_api|kaza_demo)'

# 2. Build source: confirm the compose build contexts (portal from ./rental-platform).
grep -nE 'context:|container_name:' /opt/apps/kaza-booking/docker-compose.prod.yml

# 3. Content signature: portal and demo must differ. Compare titles/markers.
echo "== app (expect portal) =="; curl -sS https://app.kaza-booking.com --max-time 15 | grep -ioE '<title>[^<]*</title>' | head -1
echo "== www (expect demo)  =="; curl -sS https://www.kaza-booking.com --max-time 15 | grep -ioE '<title>[^<]*</title>' | head -1
# If app shows the storefront title, routing or build source is wrong.
```

## Fix at the right layer

- **Wrong upstream** (app. → demo): correct the `app.kaza-booking.com` server block to
  `proxy_pass` the portal upstream, in the **host-mounted** nginx file (back it up first),
  `nginx -t`, then `nginx -s reload`. Never duplicate a server block; never touch
  Novatova's blocks. See [ssl-and-nginx-reverse-proxy](ssl-and-nginx-reverse-proxy.md).
- **Wrong build source** (portal built from `./demo`): fix the compose `context:` and
  rebuild **only** that service (`docker-compose-scoped-deploy`), then reattach
  `proxy-network` + reload nginx, and **promote the compose change to main**.

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

State the domain→app mapping before/after; whether the fix was edge (nginx) or build
(compose context); that only the affected service was rebuilt; the content-signature
proof that portal ≠ demo; and that `novatova.com` is unaffected.
