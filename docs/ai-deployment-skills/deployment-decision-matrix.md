---
name: deployment-decision-matrix
description: >
  Decision matrices for choosing the SAFEST path when several exist: live hotfix vs
  GitHub-first, frontend-only vs backend auth fix, API-only vs portal-only vs full deploy,
  migrate now vs defer, reload nginx vs not, merge now vs leave PR open, temporary SSH key
  vs manual command execution.
risk_level: medium
when_to_use: >
  Before acting, whenever more than one plausible path exists and you need to pick the one
  with the smallest blast radius that still fixes the problem.
do_not_use_when: >
  The path is unambiguous and already covered by a specific skill — just follow that skill.
required_inputs:
  - The problem, its urgency, and which layer it lives in
  - Whether the change is proven and whether it must survive the next deploy
forbidden_actions:
  - Choosing a broader-blast-radius option when a narrower one fixes it
  - Skipping durability (promotion to main) for a live fix
preflight_checks:
  - Confirm the layer (edge / api / portal / db) and whether a backend change is PROVEN
safe_procedure: "See the matrices below."
verification: "The chosen path matches the smallest-blast-radius option that fully fixes the issue."
rollback: "Each referenced skill carries its own rollback."
stop_conditions: "See 'Global Stop Conditions' below."
final_report_required: true
lessons_from_kaza_incident: >
  The right calls were consistently the narrow ones: fix login with a frontend-only portal
  change (not a backend cookie-Domain change); rebuild only the affected service (not the
  whole stack); take a backup before the additive migration; leave a PR unmerged when a
  merge would trigger an unwanted deploy; and remove the temporary SSH key at the end.
  Default to the smallest change that fully fixes the problem, then make it durable in main.
---

# Deployment decision matrix

Pick the **smallest blast radius that fully fixes the problem**, then make it durable.
When in doubt, prefer the safer row and hand back to a human.

## 1. Live hotfix vs GitHub-first

| Situation | Choose |
|---|---|
| Prod is broken now; fix is small + reversible; you can rebuild one service | **Live hotfix**, then immediately promote to `main` ([live-hotfix-to-main-durability](live-hotfix-to-main-durability.md)) |
| Not an emergency; change touches multiple services or backend | **GitHub-first**: PR → review → merge → CI deploy ([github-actions-production-deploy-safety](github-actions-production-deploy-safety.md)) |
| Fix is unproven / risky | GitHub-first with review |

> A live hotfix is **never** the finish line — it is wiped by the next deploy unless it is in `main`.

## 2. Frontend-only vs backend auth fix

| Situation | Choose |
|---|---|
| Post-login loop caused by Edge middleware gating on a cross-subdomain cookie | **Frontend-only** middleware pass-through (portal rebuild only) — low blast radius |
| You need edge-level gating restored across the whole platform | **Backend** cookie `Domain=.kaza-booking.com` — but ONLY as a deliberate change that also fixes logout cookie clearing; affects every user → full review |

## 3. API-only vs portal-only vs full app deploy

| Situation | Choose |
|---|---|
| Native lib / health / DB-connect issue in the API | **API-only** rebuild ([api-runtime-and-health-debug](api-runtime-and-health-debug.md)) |
| Portal UI / auth / routing fix | **Portal-only** rebuild ([docker-compose-scoped-deploy](docker-compose-scoped-deploy.md)) |
| Coordinated release across services from `main` | **Full CI deploy** (still service-scoped: api/demo/portal, edge excluded) |

## 4. Migration now vs defer

| Situation | Choose |
|---|---|
| Endpoint is 500 due to a missing column; change is additive/nullable | **Now** — backup first, unique number, gated runner ([database-migration-production-safety](database-migration-production-safety.md)) |
| Change is destructive (drop/rename/type change) | **Defer** to a human-led, backup-and-restore-tested plan |
| Ledger is empty / uncertain | **Defer** — the runner refuses an empty ledger for good reason |

## 5. Reload nginx vs no reload

| Situation | Choose |
|---|---|
| A Kaza container was recreated (IP changed) | **Reload** after `nginx -t` — static upstreams cache IPs ([proxy-network-reattach-and-nginx-reload](proxy-network-reattach-and-nginx-reload.md)) |
| You edited an nginx config file | **`nginx -t` then reload** |
| Nothing changed at the edge and no 502 | **No reload** — don't touch a healthy shared edge |
| Any case | **Never restart** `novatova-nginx` |

## 6. Merge now vs leave PR open

| Situation | Choose |
|---|---|
| Change is verified and a deploy is wanted + a human will approve the gate | **Merge** (squash) and monitor |
| Merge to `main` would trigger an unwanted/unreviewed deploy (no `paths:` filter) | **Leave PR open** for a human to merge deliberately |
| Docs-only change | Usually **leave open** — it still queues a (gated) deploy |

## 7. Temporary SSH key vs manual command execution

| Situation | Choose |
|---|---|
| Multi-step interactive debugging needed | **Temporary tagged key**, removed + denial-verified at the end ([temporary-ssh-access-hygiene](temporary-ssh-access-hygiene.md)) |
| One or two commands a human can paste | **Have the human run them** — no key to clean up |
| Secrets/credentials would need to leave the VPS | **Do it on the VPS**; never materialize creds locally |

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

State the options considered, the option chosen, and why it was the smallest blast radius
that fully fixes the problem — plus how durability (promotion to `main`) is handled.
