# Kaza Production Deployment Guide

The single operational source of truth for deploying Kaza Booking to production.

Production reached governance status `GOVERNED` on **2026-08-23** at commit
`e628ad9c8b88567f20d1d68d67239b3601749dca`. Everything below describes the system that
holds that status. Deviating from it does not merely bypass a policy — it breaks the
provenance chain and **fails the next deployment closed** (see
[The one-way door](#the-one-way-door)).

- **Agents:** invoke the `production-deployment` skill first. This guide is its reference.
- **Human operators:** the Arabic step-by-step guide is
  [`../KAZA_PRODUCTION_WORKBOOK.md`](../KAZA_PRODUCTION_WORKBOOK.md); this guide is the
  English engineering contract behind it.

---

## 1. Architecture

Kaza shares a Hostinger VPS with a second live tenant, **Novatova**, behind one shared
reverse proxy (`novatova-nginx`) that owns ports 80/443. Kaza must never bind them.

| Fact | Value |
|---|---|
| Live repository (production identity) | `/opt/apps/kaza-booking` |
| Production env file | `/opt/kaza/env/.env.production` |
| Release state directory | `/opt/kaza/releases` |
| Compose project | `kaza-prod` |
| Application services | `api`, `demo`, `portal` (containers `kaza-prod-*`) |
| Database service | `db` — `postgres:16-alpine`, **never recreated by a deployment** |
| Edge services | `nginx`, `certbot` under `profiles: ["edge"]` — must stay OFF |
| Shared network | `proxy-network` (external; reattached after each recreate) |
| Auth smoke credentials | `/opt/kaza/secrets/auth-smoke.json` (VPS-only, mode 400/600) |
| Host operation lock | `/opt/kaza/releases/production-operation.lock` (`flock`, non-blocking) |

Images are built **on the VPS**. There is no registry. Image identity is therefore the
content-addressed local image ID, not a tag.

### The trust chain

```
GitHub Actions (deploy-production.yml, refs/heads/main only)
   |  environment: production  -> manual approval, main-only branch policy
   v
scripts/bootstrap-production-control.sh          <- sent over SSH by the workflow
   |  asserts CONTROL_SHA == origin/main, live repo clean
   |  creates an ephemeral control worktree at CONTROL_SHA
   v
scripts/production-dispatch.sh                   <- runs FROM the control worktree
   |  host flock . authorization . target reachable from origin/main
   |  creates a separate candidate worktree at DEPLOY_SHA
   |--> scripts/production-state.sh              (mode=inspect)
   |--> scripts/deploy-production.sh             (mode=deploy)
   `--> scripts/release-production.sh            (mode=release) -> deploy-production.sh
```

**The load-bearing separation:** the *control plane* (every orchestration, migration,
audit, backup and smoke script) always comes from current `origin/main`. The *candidate*
supplies only application code, `docker-compose.prod.yml` and migrations. A historical or
malicious commit can never supply its own deployment engine.

### Ownership boundaries

| Component | Owns | Never does |
|---|---|---|
| `deploy-production.yml` | Input validation, credential presence, main-only ref check | Contains no deployment logic |
| `bootstrap-production-control.sh` | Proving control SHA == `origin/main`; creating the control worktree | Touches containers |
| `production-dispatch.sh` | Host lock, authorization, target lineage, candidate worktree | Builds or recreates anything |
| `deploy-production.sh` | Build, provenance, recreate, verify, advance checkout, state, audit | Runs migrations; touches `db` |
| `release-production.sh` | Backup -> migrate -> verify ledger -> call deploy | Recreates services itself |
| `apply-migrations.sh` | Gated, ledger-tracked migration execution | Runs during a code deploy |
| `production-state.sh` | Read-only reconciliation | Mutates anything |
| `release-state.sh` | Ledger/tree/audit authority | Applies migrations |

---

## 2. Deployment lifecycle

```
feature/*  --> dev --> main --> [manual dispatch] --> production --> GOVERNED
hotfix/*   ---------->  main --> (then merge back to dev)
```

- A **merge is not a release.** There is deliberately no `push` trigger.
- Every deployment is an explicit, SHA-addressed `workflow_dispatch` from `main`.
- `main` requires a reviewed PR and all seven status checks. The single-maintainer review
  model is documented in [`../branching.md`](../branching.md#single-maintainer-review-model).

---

## 3. Operating modes

Three modes, in strict order. **Never skip Inspect. Never skip Prepare.**

### Mode 1 — Inspect (read-only, no mutation)

Answers one question: *is production currently governed, and at which commit?*

```bash
gh workflow run deploy-production.yml --ref main \
  -f deploy_sha=<expected-full-40-char-sha> -f mode=inspect
gh run watch
```

This runs `scripts/production-state.sh` from a verified current-`main` control worktree
and emits one `kaza-production-state-v1` JSON document. It **exits 0 only for
`GOVERNED`**; `DRIFTED` and `UNVERIFIED_LEGACY` exit 2.

Read from the output:

| Field | Use |
|---|---|
| `governanceStatus` | Must be `GOVERNED` before you plan anything |
| `reconciliationFailures` | Empty, or the exact reason it is not governed |
| `commitSha` | What is actually live, from the audit record |
| `previousVersion` | Your rollback target |
| `databaseMigrationHead` | Compare against the candidate's requirement |
| `imageDigests` | The evidence any recovery must restore |

**GO / NO-GO:** `GOVERNED` with no failures -> GO. Anything else -> **NO-GO, stop and
report.** Do not deploy "to fix" a drifted state; diagnose it first.

### Mode 2 — Prepare (no production mutation)

Prepare is an operator/agent checklist, **not a workflow input**. Do not invent one.

```bash
SHA=<full-40-char-target-sha>
LIVE=<commitSha reported by Inspect>

# 1. Target is reachable from origin/main.
git fetch origin main
git merge-base --is-ancestor "$SHA" origin/main && echo "lineage OK"

# 2. CI is green for that exact commit (all seven checks).
gh run list --commit "$SHA" --json name,conclusion

# 3. The production Environment still matches the checked-in contract.
bash scripts/verify-production-environment-policy.sh

# 4. Mode decision - does this candidate add migrations?
git diff --name-only "$LIVE".."$SHA" -- db/migrations/
#    Any new NNNN_*.sql  -> mode=release  (and it must target current main)
#    None                -> mode=deploy
#    New files must also be registered in infra/db/production-migrations.sha256
#    and infra/db/init.prod.sql, or the runner refuses.

# 5. No stale or queued runs are waiting to fire.
gh run list --workflow deploy-production.yml --status queued
gh run list --workflow deploy-production.yml --status waiting
```

Also confirm, and record the answers:

- **Rollback readiness** — Inspect's `previousVersion` is non-empty and
  `deployments.jsonl` holds a successful record for it.
- **Backup requirement** — `deploy` takes no backup and needs none (it never writes to
  the database). `release` takes exactly one, validates it, and records its absolute path
  in the audit.
- **Smoke-credential readiness** — see
  [the smoke ordering trap](#42-the-smoke-runs-after-the-services-are-replaced).

Prepare ends with an explicit statement of: target SHA, mode, expected migration
transition, rollback target, and what will change. Nothing has been mutated yet.

### Mode 3 — Execute (production mutation; requires explicit authorization)

Only after Inspect returned `GOVERNED`, Prepare passed, and a human authorized this exact
SHA and mode.

```bash
gh workflow run deploy-production.yml --ref main \
  -f deploy_sha="$SHA" -f mode=<deploy|release>
gh run watch
```

The run pauses on the `production` Environment for manual approval. What then happens, in
order, entirely inside the trusted control plane:

| # | Step | Fails closed if |
|---|---|---|
| 1 | Acquire host `flock` | Another production operation is running |
| 2 | Validate authorization (actor, run URL, `github-environment:production:<run_id>`) | Identity does not bind to this Actions run |
| 3 | Validate SHA lineage and mode | Target not reachable from `origin/main`; `release` not targeting current `main` |
| 4 | Verify `kaza-prod-db` identity, running, labels, `pg_isready` | Database is not the expected container |
| 5 | Verify existing runtime provenance against the last successful audit | Any running image differs from recorded evidence |
| 6 | Validate the complete migration registry, checksums and ledger prefix | Ledger is not an exact prefix of the registry |
| 7 | Schema guard | Database ledger is **behind** the candidate |
| 8 | Record `DEPLOYMENT_PREPARED` | Audit append fails |
| 9 | Build `api`, `demo`, `portal`; verify OCI revision + control-revision labels | Built image provenance mismatch |
| 10 | Write recovery manifest, then recreate each service with `--no-deps --no-build` | — |
| 11 | Verify each running container's image ID and both labels | Running provenance mismatch |
| 12 | Reattach `proxy-network`; assert no Kaza edge container; `nginx -t` then reload | Edge container running; `nginx -t` fails |
| 13 | Health checks on all Kaza domains **and** `novatova.com` | Any non-2xx/3xx |
| 14 | Read-only auth smoke (admin, owner, client) | Any login not HTTP 200 with the right subject type |
| 15 | Scan API logs for `libgssapi`; re-assert `kaza-prod-db` identity and unchanged ledger head | The native-library error is present; database container or ledger changed |
| 16 | Move the `:prod` alias onto the verified images, then advance the live checkout to the deployed SHA | Live repo dirty, or checkout did not advance |
| 17 | Write `previous-sha.txt`, `current-sha.txt`; record `DEPLOYMENT_RESULT OK` | — |

`release` mode inserts backup -> migrate -> verify-ledger before the deploy engine runs,
and passes the exact backup artifact path into the audit record.

**Close out with Inspect.** A deployment is not done until a fresh `mode=inspect` returns
`GOVERNED`.

---

## 4. Source-of-truth model

A deployment is trusted only when **eight independent facts agree**:

```
deployment audit record (deployments.jsonl, result=OK)
  = git commit SHA
  = control SHA
  = current-sha.txt
  = live checkout HEAD (/opt/apps/kaza-booking, clean, detached)
  = running container image digests  (all three services)
  = OCI labels org.opencontainers.image.revision + com.kaza.deployment.control-revision
  = validated migration ledger head
```

| Outcome | Meaning |
|---|---|
| **`GOVERNED`** | All eight agree. The only state that is release evidence. |
| **`DRIFTED`** | A successful audit exists but a live fact disagrees. Diagnose; never overwrite. |
| **`UNVERIFIED_LEGACY`** | No successful trusted deployment record exists at all. |

No single fact is authoritative alone. `current-sha.txt` is a *claim*; the audit plus the
image digests are the *evidence*. Reconcile — never infer.

### 4.1 Why the live checkout must advance

`production-state.sh` treats the live checkout as production identity and reports
`live_checkout_mismatch` when it disagrees with the audited SHA. Builds run from an
ephemeral *candidate* worktree, so the live repository does not move on its own. The
deploy therefore advances it explicitly, in a block marked with sentinel comments in
`scripts/deploy-production.sh` and covered by
`scripts/tests/test-live-checkout-advance.sh`.

**Placement is the safety property:** the advance runs after every verification gate and
*before* `current-sha.txt` is written. A failure there aborts with the recorded state
still describing the un-advanced checkout, rather than claiming a release the live
repository does not reflect. The test asserts that ordering by line number — do not move
the block.

This is why the live checkout is expected to be **detached and clean**. A branch checkout,
a `git pull`, or a stray edited file on the host all produce `DRIFTED` or a hard `FATAL`.

### 4.2 The smoke runs after the services are replaced

`deploy-production.sh` validates the *structure and permissions* of `auth-smoke.json`
early, but the **real login smoke runs at step 14, after all three services have already
been recreated.** Wrong or expired smoke credentials therefore fail a deployment that has
already mutated production, leaving a `FAILED` audit and a recovery manifest.

Pre-flight it out of band before dispatching:

```bash
# On the VPS, read-only, from the current-main checkout. Prints status only, never secrets.
AUTH_SMOKE_CREDENTIALS_FILE=/opt/kaza/secrets/auth-smoke.json \
  bash scripts/smoke-production-auth.sh
```

*Known improvement, not yet implemented:* running the full smoke before the first recreate
would turn this into a pre-mutation gate. That is a change to the production path and
needs its own reviewed PR.

---

## 5. Mandatory safety rules

### Never

- **Never** deploy by hand: no `docker compose up`/`build`/`down` against `kaza-prod`, no
  manual `docker image tag`, no manual container recreate. See
  [The one-way door](#the-one-way-door).
- **Never** `git checkout`, `git pull`, `git reset` or edit files in
  `/opt/apps/kaza-booking`. It is production identity and only the deploy may move it.
- **Never** modify the database directly — no ad-hoc SQL, no manual `schema_migrations`
  rows, no password, user, ownership or inventory writes.
- **Never** run migrations during a code deploy. `deploy` refuses to build when the ledger
  is behind the candidate; a schema change is `release`, always.
- **Never** recreate or restart `kaza-prod-db`.
- **Never** deploy from `dev`, from an unreviewed SHA, or from a SHA not reachable from
  `origin/main`.
- **Never** trust a mutable tag. `:prod` is a convenience alias updated only after every
  verification passes; image identity is the content-addressed ID.
- **Never** bypass the Environment approval, the host lock, or the audit.
- **Never** ignore a reconciliation failure, and never "re-deploy to make it green".
- **Never** touch Novatova. `novatova-nginx` may be inspected, `nginx -t`-tested and
  **reloaded** — never restarted, never reconfigured.
- **Never** start Kaza `nginx`/`certbot`; they must stay behind the `edge` profile.
- **Never** print a secret. Report `HTTP 200 / subject type / token=yes`, nothing more.
- **Never** fabricate production state. If you cannot read the host, say so.

### Always

- Inspect -> Prepare -> authorize -> Execute -> Inspect.
- Use full 40-character lowercase SHAs everywhere.
- Report what you did **not** touch, not only what you did.
- Halt and report on any stop condition. A safe halt beats a risky guess.

### The one-way door

This is the most important consequence of reaching `GOVERNED`, and it is new.

Before every build, `verify_existing_runtime_provenance`
(`scripts/lib/image-provenance.sh`) looks up each running container's expected image ID in
the audit record for `current-sha.txt` and refuses if the running image differs. There are
exactly three ways past that gate, and **none of them covers a hand-made change**:

1. Normal path — the running images match the last successful audit. A hand-built or
   hand-recreated container does not.
2. `approve_unverified_legacy_replacement` — accepted **only while no successful trusted
   deployment exists**. That input was spent on 2026-08-23 and is now permanently refused.
3. `recovery_run_id` — requires a `recovery-<run-id>.json` manifest with status `FAILED`
   written by a *trusted run*. A manual action produces no manifest.

**Therefore: one manual `docker compose up -d api` on this host blocks every future
deployment.** Recovery is not a workflow input — it is an owner-authorized incident
procedure that restores the exact image ID recorded in the audit. Do not take the
shortcut; there is no way back through the front door.

---

## 6. Rollback

### Application failure — allowed

Roll back only to the recorded previous successful deployment:

```bash
# previousVersion from Inspect, or /opt/kaza/releases/previous-sha.txt
gh workflow run deploy-production.yml --ref main \
  -f deploy_sha=<previous-sha> -f mode=deploy
```

The dispatcher refuses any historical target other than `previous-sha.txt`, and requires a
successful trusted audit record for it. Arbitrary ancestors are refused. `release` mode can
**never** target an old SHA.

After a rollback, merge a reviewed revert so `main` reflects the intended durable state.

### Partial-run recovery

If a trusted run failed *after* changing one or more services, it left
`recovery-<run-id>.json`. Dispatch `mode=deploy` with `deploy_sha` = that manifest's
`previous_sha` **and** `recovery_run_id` = the failed run's exact ID. The control plane
verifies every live container matches either its recorded previous image ID or, for an
attempted service, the recorded target ID. Any unrelated image blocks recovery.

### Database failure — never automatic

There is no automatic database rollback, by design: an automatic reversal would make a
partial failure less observable and could destroy newer data.

A restore requires **all** of:

1. an explicit owner decision;
2. the exact backup artifact recorded in the release audit — never "the newest file";
3. a rehearsal into a disposable scratch database first
   (`scripts/restore-postgres.sh` defaults to a scratch DB precisely for this);
4. the incident procedure in [`database-operations.md`](database-operations.md) and
   [`rollback-and-recovery.md`](rollback-and-recovery.md).

Additive migrations normally **remain** during an application rollback. Never run rollback
SQL automatically.

---

## 7. Emergency procedure

### GitHub Actions cannot reach the host

Do **not** improvise. A break-glass operator must still use the current `origin/main`
`bootstrap-production-control.sh` -> `production-dispatch.sh` chain, with:

- an identified actor (never the literal `manual`);
- `DEPLOY_RUN_ID=manual-<something>`;
- `DEPLOY_WORKFLOW_RUN=manual`;
- `DEPLOY_AUTHORIZATION_REF=emergency:<reviewed-reference>`.

Every gate — host lock, lineage, ledger, provenance, smoke, audit — still runs. If the
trusted control plane cannot be established, **stop rather than downgrade**.

### Production is down

1. Inspect (`mode=inspect`) — is this drift, or an application fault?
2. `docker ps` / `docker logs --tail=200 kaza-prod-api` — read-only diagnosis is fine.
3. If a service is stopped: **do not recreate it by hand.** Re-dispatch `mode=deploy` at
   the currently deployed SHA. That is a legitimate, provenance-preserving restart.
4. If that fails, roll back to `previous-sha.txt` via the workflow.
5. If neither works, stop and escalate. Report exactly what is running and what is not.

---

## 8. Common failure scenarios

| Symptom | Cause | Action |
|---|---|---|
| `governanceStatus: DRIFTED`, `live_checkout_mismatch` | Someone moved `/opt/apps/kaza-booking`, or a deploy predating the advance fix | Do not `git checkout` on the host. Re-dispatch `mode=deploy` at the audited SHA. |
| `DRIFTED`, `<svc>_image_digest_mismatch` | A container was recreated outside the workflow | [One-way door](#the-one-way-door). Owner-authorized incident procedure. |
| `DRIFTED`, `migration_head_mismatch` | Migrations applied outside a `release` | Investigate the ledger before anything else. Never "fix" it with a deploy. |
| `UNVERIFIED_LEGACY` | No successful audit record | Should not recur after 2026-08-23. If seen, the ledger was lost — stop and escalate. |
| `FATAL: validated database ledger is behind the application candidate` | You used `deploy` for a schema-changing SHA | Re-dispatch with `mode=release`. |
| `FATAL: existing <svc> container differs from its last successful deployment evidence` | The one-way door | See above. |
| `REFUSING: another Kaza production deploy or release is already running` | Host `flock` held | Wait. Do not remove the lock file. |
| `FATAL: trusted control SHA is not the current origin/main` | `main` moved after the run started | Re-dispatch from the new `main`. |
| `FATAL: historical targets are limited to the recorded previous release` | Rollback aimed at an arbitrary ancestor | Only `previous-sha.txt` is a valid historical target. |
| `FATAL: read-only auth smoke credentials are not provisioned` | `auth-smoke.json` missing, wrong mode, or a symlink | Owner reprovisions it on the VPS at mode 400/600. Never print it. |
| The SSH step dies with a bash syntax error before any check runs | `script_stop` was set back to `true` | It **must stay `false`** — see below. |

### `script_stop: false` is load-bearing

drone-ssh (`appleboy/ssh-action`) injects a
`DRONE_SSH_PREV_COMMAND_EXIT_CODE=$? ; if ...` line after **every** line of the transported
script when `script_stop` is true. That splits every multi-line construct — `case`/`esac`,
`for`/`done`, `if`/`fi`, `|| { ... }` — and the bootstrap died on its first `case ... in`
with a bash syntax error before it could run a single check. The transported script sets
`set -Eeuo pipefail` itself, which is strictly stronger than the per-line check, and its
exit code still fails the step. **Do not "restore" `script_stop: true`.**

### Ordering rule: dangerous workflows out before secrets in

Adding a deployment secret to the `production` Environment **arms every queued and stale
run** of that workflow, including runs created before the current hardening. Remove or fix
any workflow that can mutate production *before* provisioning credentials, and check
`gh run list --status queued` / `--status waiting` afterwards.

---

## 9. Related documents

| Topic | Document |
|---|---|
| Agent entry point | `.github/skills/production-deployment/SKILL.md` |
| Human operator guide (Arabic) | [`../KAZA_PRODUCTION_WORKBOOK.md`](../KAZA_PRODUCTION_WORKBOOK.md) |
| Governance model and adoption history | [`production-state-governance.md`](production-state-governance.md) |
| Rollback and recovery detail | [`rollback-and-recovery.md`](rollback-and-recovery.md) |
| Backups, restore, migrations | [`database-operations.md`](database-operations.md) |
| Branch protection and trust chain | [`../branching.md`](../branching.md) |
| Workflow/Environment policy detail | [`../ai-deployment-skills/github-actions-production-deploy-safety.md`](../ai-deployment-skills/github-actions-production-deploy-safety.md) |
| Schema-change specifics | [`../ai-deployment-skills/database-migration-production-safety.md`](../ai-deployment-skills/database-migration-production-safety.md) |
| Smoke accounts and secret hygiene | [`../ai-deployment-skills/smoke-accounts-and-secret-hygiene.md`](../ai-deployment-skills/smoke-accounts-and-secret-hygiene.md) |
| Closeout report template | [`../ai-deployment-skills/final-verification-and-reporting.md`](../ai-deployment-skills/final-verification-and-reporting.md) |
