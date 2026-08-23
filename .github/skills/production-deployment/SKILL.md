---
name: production-deployment
description: >
  Use this BEFORE any production, VPS, or deployment action on the Kaza Booking stack.
  Kaza runs on a SHARED Hostinger VPS that also hosts Novatova behind one shared reverse
  proxy (novatova-nginx, ports 80/443), and production identity is governed: every
  deployment must reconcile to GOVERNED or the next one fails closed. Invoke whenever the
  task involves deploying, releasing, rolling back, or inspecting Kaza production; the
  Deploy Production workflow; docker / docker compose against kaza-prod-api /
  kaza-prod-demo / kaza-prod-portal / kaza-prod-db; production database migrations,
  backups, or restores; nginx / certbot / SSL work; the proxy-network Docker network;
  smoke accounts or production credentials; SSH access to the VPS; a post-login freeze on
  app.kaza-booking.com; or app-vs-demo routing. Trigger even if the user never says
  "deploy" - the words VPS, Kaza, Novatova, nginx, proxy-network, migration, GOVERNED,
  DRIFTED, /opt/apps/kaza-booking, or "production" are enough. Not for local dev-only or
  pure UI design work.
version: 2.0.0
user-invocable: true
---

# Kaza production deployment

You are operating a **live production stack on a shared host**, and its identity is
**governed**. A careless command can take Novatova down, wipe the Kaza database, or
permanently block every future deployment. Slow down.

**Reference:** [`docs/operations/production-deployment.md`](../../../docs/operations/production-deployment.md)
— the single source of truth. Read it before Execute. This skill is the contract; that
guide is the detail.

## Before you do anything

1. **Never invent a deployment method.** There is exactly one: the manually dispatched
   `deploy-production.yml` workflow from `refs/heads/main`. If what you are about to do is
   not in the guide, stop and report instead.
2. **Establish the current state first** (Mode 1 below). Do not act on assumptions about
   what is live.
3. **Report risks before executing**, not after.

## The one-way door — read this first

Production reached `GOVERNED` on 2026-08-23 at `e628ad9c8b88567f20d1d68d67239b3601749dca`.
Before every build, the deploy verifies each running container's image ID against the last
successful audit record. A container built or recreated by hand does not match, and:

- the one-time legacy-adoption input is **permanently spent**;
- the recovery input requires a manifest only a *failed trusted run* can write.

**One manual `docker compose up -d api` on this host blocks every future deployment.** The
only exit is an owner-authorized incident procedure. There is no shortcut back.

## Three operating modes — in order

### Mode 1 — Inspect (read-only)

```bash
gh workflow run deploy-production.yml --ref main \
  -f deploy_sha=<full-40-char-sha> -f mode=inspect
gh run watch
```

Emits one `kaza-production-state-v1` JSON document; exits 0 **only** for `GOVERNED`.
Report `governanceStatus`, `reconciliationFailures`, `commitSha`, `previousVersion`,
`databaseMigrationHead`.

**GO / NO-GO:** `GOVERNED` with no failures -> GO. `DRIFTED` or `UNVERIFIED_LEGACY` ->
**NO-GO. Stop and report.** Never deploy to "fix" drift.

### Mode 2 — Prepare (no mutation)

A checklist, not a workflow input. Verify and report each:

- target SHA reachable from `origin/main` (`git merge-base --is-ancestor`);
- CI green for that exact SHA;
- `bash scripts/verify-production-environment-policy.sh` passes;
- **mode decision:** any new `db/migrations/NNNN_*.sql` between live and target ->
  `release` (must target current `main`); otherwise `deploy`;
- rollback target ready (`previousVersion` has a successful audit record);
- backup requirement (none for `deploy`; exactly one, validated, for `release`);
- smoke credentials pre-flighted — the real login smoke runs *after* the services are
  replaced, so bad credentials fail an already-mutated deployment;
- no queued or waiting runs of the workflow.

End Prepare by stating: target SHA, mode, migration transition, rollback target, expected
impact. Then **stop and ask for authorization.**

### Mode 3 — Execute (mutation; explicit authorization required)

```bash
gh workflow run deploy-production.yml --ref main \
  -f deploy_sha="$SHA" -f mode=<deploy|release>
gh run watch
```

A human approves the `production` Environment gate. The trusted control plane then runs 17
gated steps (lock, authorization, lineage, DB identity, provenance, ledger, schema guard,
audit, build, recreate, verify, proxy, health, smoke, re-assert, advance checkout, state +
audit). Every one fails closed.

**Close out with Mode 1.** A deployment is not done until a fresh Inspect returns
`GOVERNED`. Then report what you changed **and what you did not touch**.

## Never

- Manual deployment: `docker compose up`/`build`/`down`, manual recreate, manual image tag.
- `git checkout` / `pull` / `reset` / any edit inside `/opt/apps/kaza-booking`.
- Direct database changes: ad-hoc SQL, manual `schema_migrations` rows, password, user,
  ownership or inventory writes.
- Migrations during a code deploy — a schema change is `mode=release`, always.
- Recreating or restarting `kaza-prod-db`.
- Deploying from `dev`, an unreviewed SHA, or a SHA not reachable from `origin/main`.
- Trusting a mutable tag (`:prod`) as identity.
- Bypassing the Environment approval, the host lock, or the audit.
- Ignoring a reconciliation failure.
- Touching Novatova (`novatova-*`). `novatova-nginx` may be inspected, `nginx -t`-tested
  and **reloaded** — never restarted.
- Starting Kaza `nginx`/`certbot` (they must stay behind the `edge` profile).
- Printing a secret. Report `HTTP 200 / subject type / token=yes`, nothing more.
- Fabricating production state. If you cannot read the host, say so.
- Setting `script_stop: true` in the deploy workflow — it shreds the bootstrap script.

## Rollback

| Failure | Allowed action |
|---|---|
| Application | Re-dispatch `mode=deploy` at `previous-sha.txt` only. Arbitrary ancestors are refused. |
| Partial trusted run | `mode=deploy` with `deploy_sha` = manifest `previous_sha` **and** `recovery_run_id` = the failed run's ID. |
| Database | **Never automatic.** Owner approval + the exact audited backup artifact + a scratch-DB rehearsal + the incident procedure. |

## Stop and report immediately if

Inspect is not `GOVERNED` · the target is not reachable from `origin/main` · CI is not
green · the mode decision is ambiguous · the host lock is held · any provenance, ledger,
backup, or smoke gate fails · a command would touch Novatova, `kaza-prod-db`, or bind
80/443 · `nginx -t` fails · a secret would be printed · a real user's data would change ·
you cannot establish the trusted control plane.

A safe halt beats a risky guess.

## Deeper reference

| Need | Document |
|---|---|
| **Everything above, in full** | [`docs/operations/production-deployment.md`](../../../docs/operations/production-deployment.md) |
| Human operator guide (Arabic) | [`docs/KAZA_PRODUCTION_WORKBOOK.md`](../../../docs/KAZA_PRODUCTION_WORKBOOK.md) |
| Governance model + adoption history | [`docs/operations/production-state-governance.md`](../../../docs/operations/production-state-governance.md) |
| Rollback and recovery detail | [`docs/operations/rollback-and-recovery.md`](../../../docs/operations/rollback-and-recovery.md) |
| Backups, restore, migrations | [`docs/operations/database-operations.md`](../../../docs/operations/database-operations.md) |
| Specialist playbooks (nginx, SSL, portal auth, API health, SSH hygiene, …) | [`docs/ai-deployment-skills/README.md`](../../../docs/ai-deployment-skills/README.md) |
| Copy-paste-safe scoped commands | [`docs/ai-deployment-skills/command-templates.md`](../../../docs/ai-deployment-skills/command-templates.md) |
| Root agent rules | [`AGENTS.md`](../../../AGENTS.md) |

---

This file is mirrored byte-for-byte at `.agents/skills/production-deployment/SKILL.md`
(and locally at `.claude/skills/production-deployment/SKILL.md`, which is gitignored).
`scripts/tests/test-deployment-skill-sync.sh` enforces that they do not drift. Edit one,
copy to the others, and run that test.
