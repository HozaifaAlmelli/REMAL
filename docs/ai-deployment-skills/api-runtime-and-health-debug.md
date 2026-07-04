---
name: api-runtime-and-health-debug
description: >
  Diagnose the Kaza .NET API when the container is up but requests fail — 404 vs 500,
  missing native runtime libraries (libgssapi_krb5.so.2), absent health/root routes, and
  DB connectivity — then rebuild ONLY the API safely.
risk_level: high
when_to_use: >
  api.kaza-booking.com returns 404/500/502 with a valid cert, the API logs show a native
  library error, /health is missing, or DB-backed endpoints fail while the app is running.
do_not_use_when: >
  The failure is a TLS/cert problem (use ssl-and-nginx-reverse-proxy) or a login redirect
  loop in the portal (use portal-auth-and-post-login-debug).
required_inputs:
  - The failing endpoint(s) and their HTTP status
  - Access to kaza-prod-api logs and an internal probe path
forbidden_actions:
  - Recreating db or running migrations as a side effect
  - Editing appsettings/env secrets in place on the VPS
  - Adding an auth requirement to /health
preflight_checks:
  - Distinguish nginx 404 from app 404 (probe the container internally)
  - Read API logs for startup exceptions / native lib errors
safe_procedure: "See 'Diagnose then rebuild only the API' below."
verification: "/ and /health return 200 JSON; /api/projects 200 (DB OK); no libgssapi in logs; novatova.com 200."
rollback: "Retag the pre-build API image to :prod and up -d --no-deps api (command-templates #10)."
stop_conditions: "See 'Global Stop Conditions' below."
final_report_required: true
lessons_from_kaza_incident: >
  Two root causes surfaced together: (1) the .NET aspnet (Debian) runtime image lacked
  libgssapi_krb5.so.2, which Npgsql loads when connecting to PostgreSQL — so DB-touching
  endpoints failed; the fix added `libgssapi-krb5-2` and `ca-certificates` to the API
  Dockerfile runtime stage. (2) There was no `/` or `/health` route, so api.kaza-booking.com
  returned 404 even though the API was UP (an app 404, not an SSL failure). Health
  endpoints were added to Program.cs. Rebuild ONLY the api service afterwards.
---

# API runtime & health debug

An up container is not a healthy API. Separate "nginx can't reach it" from "the app
answered 404/500", then fix the real layer and rebuild only the API.

## Diagnose then rebuild only the API

```bash
# 1. Read the logs for startup exceptions / native library errors.
docker logs --tail=200 kaza-prod-api 2>&1 | grep -iE "libgssapi|gssapi_krb5|exception|fail" || true

# 2. nginx 404 vs app 404: probe the API INTERNALLY (aspnet image has no curl/wget).
NET="kaza-prod_public"   # confirm via docker inspect
for p in / /health /api/projects; do
  echo "== internal http://kaza-prod-api:8080$p =="
  docker run --rm --network "$NET" curlimages/curl -sS -i --max-time 15 \
    "http://kaza-prod-api:8080$p" | head -20 || true
done
# Internal 200 but public 404/502 => edge/routing (ssl-and-nginx / proxy-network).
# Internal 404 => missing app route.  Internal 500 => app/DB error (check logs).

# 3. DB connectivity signal: /api/projects is the deploy's readiness probe.
#    A 500 here with a libgssapi log line => the native-lib root cause below.
```

### Root cause A — missing native lib (`libgssapi_krb5.so.2`)

Npgsql needs Kerberos/GSSAPI libs at runtime; the base image omitted them. **Repo fix**
(not a live-only patch): add to the **runtime stage** of
`RentalPlatform.API/Dockerfile`:

```dockerfile
# Debian aspnet runtime:
USER root
RUN apt-get update \
 && apt-get install -y --no-install-recommends libgssapi-krb5-2 ca-certificates \
 && rm -rf /var/lib/apt/lists/*
# Alpine runtime instead:  RUN apk add --no-cache krb5-libs ca-certificates
# Distroless / chiseled runtime: STOP and report (no package manager).
```

### Root cause B — no `/` or `/health` route (app 404)

Add lightweight, **unauthenticated** endpoints in `Program.cs` before `app.MapControllers()`:

```csharp
app.MapGet("/", () => Results.Ok(new { service = "kaza-booking-api", status = "ok" }));
app.MapGet("/health", () => Results.Ok(new { status = "healthy", service = "kaza-booking-api" }));
```

`/health` must not require auth and must not leak config/secrets.

### Rebuild ONLY the API

```bash
# Tag rollback, then scoped build/recreate (see docker-compose-scoped-deploy).
COMPOSE=( docker compose -p kaza-prod -f /opt/apps/kaza-booking/docker-compose.prod.yml
          --env-file /opt/kaza/env/.env.production --project-directory /opt/apps/kaza-booking )
"${COMPOSE[@]}" build api
"${COMPOSE[@]}" up -d --no-deps api
docker logs --tail=120 kaza-prod-api 2>&1 | grep -i libgssapi && echo "STILL BROKEN" || echo "no libgssapi"
```

Then reattach `proxy-network` + reload nginx, and **promote the Dockerfile/Program.cs
change to main** (a live rebuild is wiped by the next deploy).

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

State the failing layer (edge vs app vs DB); the root cause(s); the exact repo change;
that only `api` was rebuilt; `/`, `/health`, `/api/projects` results; log check for
`libgssapi`; and that the fix was promoted to `main`.
