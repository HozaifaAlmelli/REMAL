---
name: live-hotfix-to-main-durability
description: >
  What to do when something was changed directly on the VPS. Since the governed
  transition, a hand-built or hand-recreated application container is no longer a fast fix
  that gets overwritten later - it blocks every future deployment and needs owner-authorized
  recovery. Non-application host state (nginx config, env file, cron) is not
  provenance-tracked but still has to be promoted into reviewed Git or reviewed host config.
risk_level: critical
when_to_use: >
  Someone edited files, rebuilt an image, or recreated a container directly on the VPS -
  or you are being asked to.
do_not_use_when: >
  The change went through the normal branch -> PR -> merge -> dispatch path (then it is
  already durable and governed).
required_inputs:
  - Exactly what was changed on the host, and whether it touched an application container
  - The output of a read-only `mode=inspect` run
forbidden_actions:
  - Building, tagging, or recreating a Kaza application container by hand
  - git checkout / pull / reset / any edit inside /opt/apps/kaza-booking
  - Presenting a host-only change as a completed fix
preflight_checks:
  - Run `mode=inspect` and record `governanceStatus` and `reconciliationFailures`
  - Classify the change - application container, or host configuration
safe_procedure: "See the two paths below."
verification: "A fresh `mode=inspect` returns GOVERNED and the fix is present."
rollback: "Application: restore the exact image ID recorded in the audit. Host config: restore the reviewed configuration."
stop_conditions: "See 'Global Stop Conditions' below."
final_report_required: true
lessons_from_kaza_incident: >
  Before governance, a VPS-only edit was merely fragile - the next deploy overwrote it.
  After governance it is worse than fragile. The deploy verifies every running container's
  content-addressed image ID against the last successful audit record, the one-time legacy
  adoption input is spent, and the recovery input only accepts a manifest written by a
  failed trusted run. A hand-made container therefore fails the next deployment closed with
  no workflow input able to clear it.
---

# Host changes and durability

**Before governance:** a live edit was a fast fix that the next deploy would overwrite.

**Now:** the deploy checks each running container's image ID against the last successful
audit record before it builds anything. A hand-made container does not match, and neither
escape hatch applies — `approve_unverified_legacy_replacement` is only accepted while no
successful trusted deployment exists (it was spent on 2026-08-23), and `recovery_run_id`
requires a manifest that only a *failed trusted run* can write.

> **One manual `docker compose up -d api` on this host blocks every future deployment.**
> See [`production-deployment.md` — the one-way door](../operations/production-deployment.md#the-one-way-door).

## First: classify what was changed

```bash
# Read-only. Reports governanceStatus and the exact reconciliation failures.
gh workflow run deploy-production.yml --ref main \
  -f deploy_sha=<expected-full-sha> -f mode=inspect
gh run watch
```

| What changed | Provenance-tracked? | Path |
|---|---|---|
| A Kaza application container (`api`/`demo`/`portal`) — built, tagged, or recreated by hand | **Yes** | [Path A](#path-a--an-application-container-was-changed-by-hand) |
| Files in `/opt/apps/kaza-booking` | **Yes** — the live checkout is production identity | [Path A](#path-a--an-application-container-was-changed-by-hand) |
| `novatova-nginx` config, `/opt/kaza/env/.env.production`, cron, host packages | No | [Path B](#path-b--host-configuration-was-changed) |

## Path A — an application container was changed by hand

This is an incident, not a deployment. Do not try to deploy your way out of it.

1. **Stop.** Do not build, tag, or recreate anything else.
2. **Record the evidence:** the `mode=inspect` output, `docker inspect -f '{{.Image}}'` for
   each application container, and the last successful record in
   `/opt/kaza/releases/deployments.jsonl`.
3. **Report to the owner** with the exact recorded image IDs the audit expects and the
   exact IDs currently running.
4. **Recovery is owner-authorized:** restore each container to the exact image ID recorded
   in the audit for `current-sha.txt`. Only after `mode=inspect` returns `GOVERNED` again
   can a normal deployment proceed.
5. **Promote the underlying fix properly** — branch from `main`, PR, CI, merge, dispatch.

## Path B — host configuration was changed

Not provenance-tracked, but still not durable until it is reviewed and recorded.

```bash
# Capture exactly what changed, redacted. Never copy the env file off the host.
docker exec novatova-nginx nginx -T | redact > /root/kaza-agent-logs/nginx-effective.conf
diff -u <reviewed-copy> <live-copy>
```

- **nginx / edge:** `nginx -t` must pass, then **reload** (never restart). Record the diff
  and get the reviewed configuration updated wherever it is kept.
- **Env file:** an env change alters application behaviour without changing any image, so
  reconciliation will still report `GOVERNED` while production behaves differently. Treat
  every env edit as a reviewed change: record what changed (keys only, never values) in the
  release notes for the next deployment.
- **Cron / host packages:** record them in the operations notes. They are outside the
  deployment audit entirely, which is exactly why they need a written trail.

## Promote a code fix to main

```bash
git fetch origin main
git switch -c fix/<short-description> origin/main
#   ...make the change in the repo, not on the VPS...
git add <only the files that changed>          # never env files / secrets / creds
git commit -m "fix(<area>): <what and why>"
git push -u origin fix/<short-description>
gh pr create --base main --title "fix(<area>): <summary>" --body-file <pr-body.md>
```

Merging does not deploy. After the merge, dispatch **Deploy Production** with the merge
SHA and close out with `mode=inspect`.

## Global Stop Conditions — halt and report, do not proceed

Stop immediately if any of these is true:
- An application container would be built, tagged, or recreated outside the workflow.
- A command would `git checkout` / `pull` / `reset` or edit `/opt/apps/kaza-booking`.
- A command would affect Novatova (any `novatova-*` container, config, or data).
- A command would start a service that binds host ports 80 or 443.
- A step requires `docker compose down` or a bare `docker compose up -d`.
- `docker exec novatova-nginx nginx -t` fails.
- The env file `/opt/kaza/env/.env.production` is missing or empty.
- `mode=inspect` does not return `GOVERNED` and you are being asked to deploy anyway.
- A DB backup fails (or cannot be verified) before any DB write.
- A secret (password/token/JWT/connection string) would be printed or written unredacted.
- An already-applied migration would need editing, or a migration number would be reused.
- A production user's password would be reset.
- A temporary SSH key cannot be removed at the end of the task.

## Forbidden Commands — never run these on the shared VPS

Named here only to mark them forbidden. Do not execute them.
- `docker compose down`
- `docker compose up -d` (bare, scoped, or otherwise) against `kaza-prod`
- `docker compose build` / `docker image tag` for a Kaza application image
- `docker system prune` / `docker builder prune -a`
- `docker volume rm ...`
- `git checkout` / `git pull` / `git reset` inside `/opt/apps/kaza-booking`
- `rm -rf /etc/letsencrypt`
- `certbot delete ...`
- `docker restart novatova-nginx` and `docker restart novatova-*`
- `DROP TABLE ...` / `TRUNCATE TABLE ...` / `DELETE FROM ...` without WHERE + backup + approval
- `git push --force` to `main`

## Final report (required)

State what was changed on the host and by whom; whether it touched an application
container; the `mode=inspect` result before and after; the recovery performed and who
authorized it; the PR that makes the fix durable; and that the live working tree is clean
and detached at the audited SHA.
