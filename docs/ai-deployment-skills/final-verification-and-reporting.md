---
name: final-verification-and-reporting
description: >
  The standard closeout for any production action: run the full endpoint + container +
  nginx + logs + Novatova-safety verification, then produce a precise report of what
  changed, what was deployed, and — explicitly — what was NOT touched.
risk_level: low
when_to_use: >
  At the end of every production action (deploy, hotfix, recreate, migration, debug) before
  declaring it done.
do_not_use_when: >
  Never skip it. "It looked fine" is not verification.
required_inputs:
  - What you changed and which containers were recreated
  - The deployed Git SHA and any PR links
forbidden_actions:
  - Declaring success without the checks below
  - Reporting that hides a failed check or a skipped step
preflight_checks:
  - Have the change list, SHA, and rollback info ready
safe_procedure: "See 'Run the checks' and 'Report template' below."
verification: "All endpoints healthy incl. novatova.com; nginx -t OK; no unexpected recreates; DB intact."
rollback: "If a check fails, roll back per the relevant skill and re-verify before reporting done."
stop_conditions: "See 'Global Stop Conditions' below."
final_report_required: true
lessons_from_kaza_incident: >
  The safe outcome (SHA 3e962da) was only trustworthy because it was PROVEN: all Kaza hosts
  + novatova.com returned healthy; nginx -t passed; kaza-prod-db was NOT recreated (uptime
  unchanged); only api/demo/portal were recreated by the deploy; all Novatova containers'
  uptimes were unchanged (no restart); and login worked for Admin/Owner/Client (status +
  token-exists only). Report explicitly what was NOT touched, not just what was.
---

# Final verification & reporting

Prove it worked and prove you left everything else alone. The report's most important
lines are the "did NOT touch" lines.

## Run the checks

```bash
# 1. Endpoints (Kaza + Novatova safety signal)
curl -sS -I https://kaza-booking.com        --max-time 15
curl -sS -I https://www.kaza-booking.com    --max-time 15
curl -sS -I https://app.kaza-booking.com    --max-time 15
curl -sS -i https://api.kaza-booking.com/       --max-time 15 | head -20
curl -sS -i https://api.kaza-booking.com/health --max-time 15 | head -20
curl -sS -i https://api.kaza-booking.com/api/projects --max-time 15 | head -10   # DB readiness
curl -sS -I https://novatova.com            --max-time 15

# 2. Containers: what is running, and (crucially) what did NOT restart.
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.RunningFor}}"
#   - kaza-prod-db uptime should be UNCHANGED (not recreated) unless intended.
#   - novatova-* uptimes should be UNCHANGED (no restart).
#   - no kaza-prod-nginx / kaza-prod-certbot (edge stays off).

# 3. Edge config + API logs
docker exec novatova-nginx nginx -t
docker logs --tail=100 kaza-prod-api 2>&1 | grep -i libgssapi && echo "BAD" || echo "no libgssapi"

# 4. Deployed SHA
cat /opt/kaza/releases/current-sha.txt 2>/dev/null
```

## Report template

```
## Production action report

What changed & why: <one paragraph>
Files changed:       <paths / PR link>
Deployed Git SHA:    <sha>  (PR: <link>, merged by: <who>)
Containers rebuilt/recreated: <e.g. api, demo, portal>  (via <deploy | scoped recreate>)

Verification:
- kaza-booking.com / www / app: <status>
- api / api/health / api/projects: <status>
- Login Admin/Owner/Client: <HTTP + token=yes|no>  (NO secrets printed)
- nginx -t: OK    proxy-network reattached: yes/n-a    nginx reloaded (not restarted): yes/n-a
- API logs: no libgssapi

Explicitly NOT touched:
- Novatova: no container restarted; novatova.com <status>
- DB: kaza-prod-db not recreated; no destructive SQL; (backup taken: yes/n-a)
- Env file: not edited
- Edge (80/443): kaza-prod-nginx/certbot not started

Rollback: <rollback image tag / previous SHA / revert PR>
Remaining risks / follow-ups: <e.g. optional cookie-Domain change, deferred>
Durability: <fix is in main (SHA) / PR open awaiting merge>
Temporary SSH key: <removed + denial verified / n-a>
```

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

Use the template above. The "Explicitly NOT touched" section is mandatory.
