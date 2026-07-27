---
name: ssl-and-nginx-reverse-proxy
description: >
  Safely diagnose and fix SSL/TLS and nginx reverse-proxy issues on the shared VPS,
  where novatova-nginx terminates TLS for both tenants. Distinguish a real SSL failure
  from an upstream 404/502, and never break another tenant's server block or certs.
risk_level: high
when_to_use: >
  A Kaza domain shows a cert error, nginx -t fails, ACME/renewal issues, a placeholder
  leaked into a rendered config, or you must tell "SSL broken" apart from "app returned
  404/502".
do_not_use_when: >
  The TLS handshake and cert are fine and the problem is purely inside the app
  (use api-runtime-and-health-debug or portal-auth-and-post-login-debug instead).
required_inputs:
  - Which domain(s) are affected
  - Access to novatova-nginx (inspect / nginx -t / reload only)
forbidden_actions:
  - Editing or deleting /etc/letsencrypt; certbot delete
  - Restarting novatova-nginx
  - Reloading nginx before nginx -t passes
  - Editing or duplicating another tenant's server block
  - Blindly substituting config placeholders
preflight_checks:
  - Identify whether novatova-nginx uses static upstreams or a resolver
  - Locate the exact host-mounted config file backing the affected server block
safe_procedure: "See 'Diagnose, then (only if needed) edit in place' below."
verification: "nginx -t OK; affected domain serves valid cert + expected status; novatova.com unaffected."
rollback: "Restore the backed-up config file, nginx -t, nginx -s reload."
stop_conditions: "See 'Global Stop Conditions' below."
final_report_required: true
lessons_from_kaza_incident: >
  Two real traps: (1) an unresolved ${DOMAIN} placeholder in a rendered vhost made
  nginx -t fail — and the correct substitution was novatova.com (the OWNING tenant),
  NOT Kaza; blind replacement would have hijacked routing. (2) After the cert was
  issued (SAN: kaza-booking.com, www, api, app), api.kaza-booking.com still returned
  404 — that was a MISSING APP ROUTE, not an SSL failure. Always separate the TLS layer
  from the upstream layer before "fixing SSL".
---

# SSL & nginx reverse proxy (shared edge)

`novatova-nginx` terminates TLS for **both** tenants. Any nginx mistake here can take
Novatova offline. Diagnose fully before editing; edit in place, never duplicate.

## Diagnose, then (only if needed) edit in place

```bash
# 1. Does the cert exist and what does it cover? (SAN must list the affected host)
docker exec novatova-nginx sh -lc \
  'openssl x509 -in /etc/letsencrypt/live/kaza-booking.com/fullchain.pem -noout -text' \
  2>/dev/null | grep -A1 'Subject Alternative Name'
# Expect SAN: kaza-booking.com, www.kaza-booking.com, api.kaza-booking.com, app.kaza-booking.com

# 2. Is TLS actually failing, or is it the app? Look at the handshake vs the HTTP status.
echo | openssl s_client -servername api.kaza-booking.com \
  -connect api.kaza-booking.com:443 2>/dev/null \
  | openssl x509 -noout -subject -issuer -dates
curl -sS -i https://api.kaza-booking.com/ --max-time 15 | head -20
# Valid cert + a 404/502 => NOT an SSL problem. Go to api-runtime-and-health-debug.

# 3. Find the exact config + confirm it parses. NEVER reload if this fails.
docker exec novatova-nginx nginx -T 2>/dev/null | grep -nE 'server_name|proxy_pass|\$\{'
docker exec novatova-nginx nginx -t

# 4. ACME reachability (only if a cert genuinely needs (re)issuing)
curl -sS -I "http://kaza-booking.com/.well-known/acme-challenge/probe" --max-time 15 || true
```

**If a config edit is truly required:**
- Locate the **host-mounted** file backing the block (from `nginx -T` / the compose
  mounts), and `cp` it to a timestamped backup first.
- Edit **that block in place**. Never add a second `server_name` for a host that
  already has one (duplicate server blocks break routing).
- Resolve placeholders deliberately. `${DOMAIN}` belongs to the **owning tenant** —
  for Novatova's shared config that is `novatova.com`, not a Kaza domain. Confirm
  which tenant a block serves before substituting anything.
- Never touch Novatova's own server blocks or `/etc/letsencrypt`.
- Then: `nginx -t` → **only if OK** → `nginx -s reload` (see
  [proxy-network-reattach-and-nginx-reload](proxy-network-reattach-and-nginx-reload.md)).

## SSL failure vs upstream failure — the decision

| Symptom | Meaning | Go to |
|---|---|---|
| Browser/`openssl` cert error, `NET::ERR_CERT_*` | Real TLS/cert problem | Fix cert / server block here |
| Valid cert, HTTP **404** | App up, route missing | [api-runtime-and-health-debug](api-runtime-and-health-debug.md) |
| Valid cert, HTTP **502/504** | Upstream down or stale IP | [proxy-network-reattach-and-nginx-reload](proxy-network-reattach-and-nginx-reload.md) |
| `nginx -t` fails | Bad/placeholder config | Fix config in place, do NOT reload until it passes |

> **Static upstream note:** `novatova-nginx` uses **name-based static upstreams**
> (e.g. `kaza-prod-portal:3001`) with **no `resolver`**, so it caches the container
> IP. After any Kaza container recreate, the IP changes and nginx must be **reloaded**
> (after `nginx -t`) or it will 502 against the old IP.

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

State whether the issue was TLS or upstream; the cert SAN; any config file edited
(with backup path); `nginx -t` result; the affected domain's final status; and
confirmation `novatova.com` is unaffected.
