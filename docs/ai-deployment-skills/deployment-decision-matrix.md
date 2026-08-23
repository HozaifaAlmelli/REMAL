---
name: deployment-decision-matrix
description: >
  Decision matrices for choosing the SAFEST path when several exist: live hotfix vs
  GitHub-first, frontend-only vs backend auth fix, API-only vs portal-only vs full deploy,
  migrate now vs defer, reload nginx vs not, deploy mode vs release mode, temporary SSH key
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
  change (not a backend cookie-Domain change); take a backup before the additive migration;
  choose release mode whenever the SHA adds a migration; and remove the temporary SSH key
  at the end. Since the governed transition, "narrow" no longer means a narrower manual
  command — every application change goes through the same workflow, and the only remaining
  choice is which reviewed SHA and which mode.
---

# Deployment decision matrix

Pick the **smallest blast radius that fully fixes the problem**, then make it durable.
When in doubt, prefer the safer row and hand back to a human.

## 1. How urgent is it? (There is no longer a "live hotfix" option)

Production is `GOVERNED`. A hand-built or hand-recreated container no longer merely gets
wiped by the next deploy — it **blocks** the next deploy, permanently, because its image
ID will not match the last successful audit record. See
[the one-way door](../operations/production-deployment.md#the-one-way-door).

| Situation | Choose |
|---|---|
| Prod is broken now | **Diagnose read-only** (`docker ps`, `docker logs`, `mode=inspect`). If a service is down, re-dispatch `mode=deploy` at the **currently deployed SHA** — that is a provenance-preserving restart. |
| Read-only diagnosis found a code fix | **GitHub-first, expedited**: hotfix branch from `main` → PR → CI → merge → dispatch. The whole loop is minutes, and it is the only loop that ends in a governed state. |
| Prod is broken and the workflow itself cannot reach the host | **Break-glass**, still through the current-`main` bootstrap with an `emergency:<reviewed-reference>` authorization ([production-deployment.md §7](../operations/production-deployment.md#7-emergency-procedure)). Never improvise Compose commands. |
| Fix is unproven / risky | GitHub-first with review. Urgency is not a reason to skip Inspect. |

> Editing files or rebuilding an image directly on the VPS is no longer a fast path. It is
> an incident that needs owner-authorized recovery before anything can deploy again.

## 2. Frontend-only vs backend auth fix

| Situation | Choose |
|---|---|
| Post-login loop caused by Edge middleware gating on a cross-subdomain cookie | **Frontend-only** middleware pass-through (portal rebuild only) — low blast radius |
| You need edge-level gating restored across the whole platform | **Backend** cookie `Domain=.kaza-booking.com` — but ONLY as a deliberate change that also fixes logout cookie clearing; affects every user → full review |

## 3. API-only vs portal-only vs full app deploy

The deploy always rebuilds and recreates all three application services (`api`, `demo`,
`portal`), one at a time with `--no-deps --no-build`. There is no per-service dispatch, and
recreating one service by hand is [a one-way door](../operations/production-deployment.md#the-one-way-door).
What you are actually choosing is the **mode**:

| Situation | Choose |
|---|---|
| Any application change whose SHA adds no new migration | **Dispatch `mode: deploy`** — all three services, `db` untouched, edge excluded |
| The SHA adds any new `db/migrations/NNNN_*.sql` | **Dispatch `mode: release`** — backup + migrate + verify happen before the code moves, and it must target current `main` |
| You only need to know what is live | **Dispatch `mode: inspect`** — read-only, mutates nothing |
| Diagnosing which layer is at fault before choosing | Read-only first: [api-runtime-and-health-debug](api-runtime-and-health-debug.md), [portal-auth-and-post-login-debug](portal-auth-and-post-login-debug.md) |

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
| Change is verified and a deploy is wanted + a human will approve the gate | **Merge** (squash), then **dispatch separately** — merging never deploys |
| You are unsure whether the SHA needs migrations | **Compare before dispatching**: `release-state.sh ledger-head` vs `MIG_DIR=<tree> release-state.sh tree-level` |
| Docs-only change | Merge when reviewed; it does not queue a deploy because production is manual-only |

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
- A step would run `docker compose` (build / up / down) against `kaza-prod`, or
  recreate, build, or tag a Kaza application container outside the trusted workflow.
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
