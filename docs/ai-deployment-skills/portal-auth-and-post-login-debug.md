---
name: portal-auth-and-post-login-debug
description: >
  Diagnose portal login problems on app.kaza-booking.com — especially a "login succeeds
  (HTTP 200) but the app freezes" infinite redirect loop caused by a cross-subdomain
  cookie/middleware mismatch. Prefer a frontend-only portal fix; know when a backend
  cookie-domain change is warranted.
risk_level: high
when_to_use: >
  Login returns 200 but the dashboard never loads, the tab freezes, or a redirect
  loop bounces dashboard -> login -> dashboard. Also for 401 (bad creds/endpoint) and 500
  (schema) triage.
do_not_use_when: >
  The API itself is down/404/500 for non-auth reasons (use api-runtime-and-health-debug)
  or the wrong app is served entirely (use portal-vs-demo-routing-and-build-source).
required_inputs:
  - The failing role(s) and the exact symptom (401 vs 200+freeze vs 500)
  - Browser network/console capture (redacted) and/or a VPS-side login curl
forbidden_actions:
  - Capturing or printing passwords/tokens from the browser or logs
  - Changing the backend cookie Domain without also fixing logout cookie clearing
  - Rebuilding anything other than the portal for a frontend-only fix
preflight_checks:
  - Classify the failure: 401, 200+freeze (loop), or 500 (schema)
  - Identify where the refresh_token cookie is set and its host scope
safe_procedure: "See 'Classify, then fix at the right layer' below."
verification: "All three roles reach their dashboard with no freeze; protected routes 307->200; login API 200 token=yes."
rollback: "Retag pre-build portal image to :prod and up -d --no-deps portal."
stop_conditions: "See 'Global Stop Conditions' below."
final_report_required: true
lessons_from_kaza_incident: >
  Login returned 200 but the portal froze in an infinite loop (dashboard -> login ->
  dashboard). Root cause: the API sets an httpOnly refresh_token cookie HOST-ONLY on
  api.kaza-booking.com (no Domain), so the browser never sends it to app.kaza-booking.com.
  The Edge middleware in rental-platform/middleware.ts gated protected routes on that
  cookie, always "saw no cookie", redirected to login, and the login page bounced back
  (in-memory access token present) -> frozen tab. It worked in dev only because
  localhost:3001 and localhost:5001 share host "localhost". The chosen fix was
  frontend-only: make middleware a documented pass-through (auth is enforced client-side by
  AdminShell / OwnerLayout / useClientGuard, which refresh via XHR to the API host). Fixed
  in PR #20 -> 3e962da. Rebuild ONLY the portal.
---

# Portal auth & post-login debug

The trap: a **successful** login that still freezes. That is almost never the API — it is
a client-side redirect loop from a cookie the app origin can't see.

## Classify, then fix at the right layer

```bash
# 1. Is login actually succeeding? (VPS-side; print status + token-exists ONLY.)
code=$(curl -sS -o /tmp/l.json -w '%{http_code}' \
  -X POST https://api.kaza-booking.com/api/auth/admin/login \
  -H 'content-type: application/json' --data "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" --max-time 15)
grep -q '"accessToken"' /tmp/l.json && tok=yes || tok=no; echo "login HTTP $code token=$tok"; rm -f /tmp/l.json

# 2. Is the Set-Cookie host-only? (look for absence of Domain= on refresh_token)
curl -sS -D - -o /dev/null -X POST https://api.kaza-booking.com/api/auth/admin/login \
  -H 'content-type: application/json' --data "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" --max-time 15 \
  | grep -i 'set-cookie' | sed -E 's/refresh_token=[^;]+/refresh_token=***REDACTED***/'
#   path=/; secure; samesite=strict; httponly  and NO Domain= => host-only (the trap).

# 3. Protected route behaviour (loop shows as redirect back to /auth/*/login)
curl -sS -I https://app.kaza-booking.com/admin/dashboard --max-time 15
```

### Failure decision matrix

| Symptom | Likely cause | Fix path |
|---|---|---|
| **401** on login | Wrong creds/endpoint/role, or dev creds in prod | [smoke-accounts-and-secret-hygiene](smoke-accounts-and-secret-hygiene.md) |
| **200 + freeze / loop** | Edge middleware gates on a cookie the app origin can't see | **Frontend-only** middleware pass-through (below) |
| **500** on login | Missing schema (e.g. owner contact columns) | [database-migration-production-safety](database-migration-production-safety.md) |

### The frontend-only fix (preferred, low blast radius)

Make the Edge middleware a **pass-through**; do not gate on `refresh_token`. Auth is
already enforced client-side by `AdminShell` / `OwnerLayout` / `useClientGuard`, which
hold the in-memory access token and refresh via XHR to the API host (that request DOES
reach `api.kaza-booking.com` cross-subdomain).

```ts
// rental-platform/middleware.ts — pass-through (see the committed file for the full note)
import { NextResponse } from "next/server";
export function middleware() { return NextResponse.next(); }
// keep the existing `config.matcher`.
```

Then rebuild **only** the portal (`docker-compose-scoped-deploy`), reattach
`proxy-network` + reload nginx, and **promote to main** (a live-only edit is wiped).

### The backend cookie-Domain alternative (bigger blast radius — usually defer)

Setting `Domain=.kaza-booking.com` on the refresh cookie would make it readable at the app
origin and restore edge-level gating. **Only** do this as a deliberate, larger auth change
that **also** updates logout to clear the cookie with the *same* Domain
(`AuthController` `Cookies.Delete`) — otherwise logout silently fails to clear it. It
affects every user's login/logout, so it needs its own review; the frontend fix was chosen
to avoid this.

> **Never capture the password or token** from the browser or curl. Report status and
> `token=yes|no` only.

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

State the failure class (401/200+freeze/500); the root cause; the layer fixed
(frontend-only vs backend); that only the portal was rebuilt (if applicable); the
three-role dashboard verification; and that no secret was captured. Promote the fix to `main`.
