---
name: live-hotfix-to-main-durability
description: >
  Ensure a live hotfix applied directly on the VPS becomes a reviewed Git candidate by
  promoting the exact verified change into main. Host-only edits are never accepted by
  the trusted deployment control plane.
risk_level: high
when_to_use: >
  Any time you edited files or rebuilt an image directly on the VPS to fix production.
  Start this the moment the live fix is verified — before you move on.
do_not_use_when: >
  The change already went through the normal branch → PR → merge → deploy path (then it
  is already in main and durable).
required_inputs:
  - The exact diff that was applied live (files + content)
  - Write access to the repo (branch from main, open PR)
forbidden_actions:
  - git reset --hard / git push --force on the live repo
  - Leaving the live working tree dirty (the deploy FATALs on local changes)
  - Committing secrets, env files, or generated credentials
preflight_checks:
  - Capture the live diff precisely (git -C /opt/apps/kaza-booking diff)
  - Confirm the change is frontend/config only unless a backend fix is proven
safe_procedure: "See 'Promote the fix to main' below."
verification: "PR merged to main (human-approved); Deploy Production green; fix still present post-deploy; live tree clean."
rollback: "Revert the PR/commit on main; the next deploy restores prior behaviour."
stop_conditions: "See 'Global Stop Conditions' below."
final_report_required: true
lessons_from_kaza_incident: >
  The trusted production runner accepts only current-main control code and reviewed Git
  application candidates, and FATALs if the live repository is dirty. A VPS-only edit is
  therefore not deployable evidence. The post-login-freeze hotfix became durable only
  after it landed in main. Restore the live tree to clean only after proving the exact
  hotfix is reviewed in Git.
---

# Live hotfix → main durability

A live fix buys you minutes of uptime; **main** is what makes it reviewable and durable.
The trusted runner will not consume uncommitted host edits, so treat every live edit as
temporary until the exact diff is merged.

## Promote the fix to main

```bash
# 1. Capture the EXACT change applied live (so main gets the same thing, no drift).
git -C /opt/apps/kaza-booking status --short
git -C /opt/apps/kaza-booking --no-pager diff > /root/kaza-agent-logs/live-hotfix.patch

# 2. In a clean clone / your workstation: branch from main and apply the same diff.
git fetch origin main
git checkout main && git pull --ff-only origin main
git checkout -b fix/<short-description>
#   ...apply the identical edit (e.g. the middleware.ts pass-through)...
git add <only the files that changed>          # never env files / secrets / creds
git commit -m "fix(<area>): <what and why>"
git push -u origin fix/<short-description>

# 3. Open a PR into main. Merging does not deploy; release is a separate manual action.
gh pr create --base main --title "fix(<area>): <summary>" --body-file <pr-body.md>
```

## After the fix is in main — clean the live tree

The deploy will refuse to run while the VPS tree is dirty. Once the identical change is
in `main`, discard the now-redundant live edit so the next deploy is clean:

```bash
git -C /opt/apps/kaza-booking status --short   # confirm ONLY your hotfix files are dirty
git -C /opt/apps/kaza-booking checkout -- <the hotfix files>   # discard; main now carries it
git -C /opt/apps/kaza-booking status --short   # must be clean
```

> **Stop** if the live tree shows changes you did **not** make — do not blindly discard
> someone else's in-flight work; investigate and report.

## Verify durability

- Deploy Production runs green from `main` (see
  [github-actions-production-deploy-safety](github-actions-production-deploy-safety.md)).
- Re-check the symptom after the deploy — the fix must still be present (it now comes
  from `main`, not your live edit).
- `current-sha.txt`, running content image IDs/revision labels, and the strict audit
  record all match the merged SHA.

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

State the live diff captured; the branch/PR opened (link); whether it was merged and by
whom; the post-deploy re-verification; and that the live working tree was returned to clean.
