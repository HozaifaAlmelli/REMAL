# KAZA — Branching & Release Workflow

```
feature/*  ->  dev  ->  main  ->  (manual, SHA-addressed deploy to production)
hotfix/*   ->  main  (then merge back to dev)
```

- **`main`** — the *deployable set*. Every commit on it must be releasable, but a merge
  to `main` is **not** a release: it does not deploy anything. Production only changes
  when a human dispatches the Deploy Production workflow with an explicit SHA.
- **`dev`** — permanent integration branch. **CI-checks only — it does NOT deploy
  anywhere.** Developers run the full stack locally via `docker-compose.yml`.
- **`feature/*`** — branch from `dev`, PR back into `dev`, must pass PR checks.
- **`hotfix/*`** — branch from `main`, PR into `main`, then merge back into `dev`.

> The VPS is **production only**. There is no staging deployment yet — the design for
> one is at [`operations/staging-environment-design.md`](operations/staging-environment-design.md).

## Deploying

Production has exactly one entry point: the **Deploy Production** workflow, dispatched
manually with a full 40-character `deploy_sha` and a `mode`.

| Mode | Use when | What runs |
|---|---|---|
| `deploy` | the release adds no migrations | schema guard → build → service-scoped recreate → health checks |
| `release` | the release adds migrations | baseline → candidate worktree → backup → migrate → verify → deploy → verify |

Three independent things must all agree before code reaches production:

1. **Branch protection** — the SHA got onto `main` through a reviewed PR.
2. **Reachability** — the deploy refuses any SHA not reachable from `origin/main`, so a
   dispatch cannot smuggle in unreviewed code.
3. **Schema guard** — the deploy refuses to build if the live database is behind the
   tree being deployed.

There is deliberately **no `push` trigger**. A docs merge, a revert and a schema-changing
feature all produce a push to `main`; only a human knows which of them should reach
production.

### Why the deployed SHA is provable

- `scripts/deploy-production.sh` asserts `git rev-parse HEAD == <sha>` before building.
- Images are tagged `kaza-api:<sha>` (`:prod` is kept as a moving alias) and carry
  `org.opencontainers.image.revision`.
- The deploy re-reads that label off each **running container** and fails if it differs.
- `/opt/kaza/releases/current-sha.txt` records the result;
  `/opt/kaza/releases/deployments.jsonl` is the append-only history.

## Branch protection

**`main`**
- [x] Require a pull request before merging (+ ≥1 approval).
- [x] Require status checks to pass: the `PR Checks` jobs (backend, demo, portal, compose-validate).
- [x] Require branches to be up to date before merging.
- [x] Require conversation resolution before merging.
- [x] Block force pushes and direct pushes (`bypass_actors: []` — admins included).

**`dev`**
- [x] Require a pull request before merging.
- [x] Require the `PR Checks` build jobs to pass.
- [x] Block force pushes.

## GitHub Environments

- **`production`** — restricts deployments to `main` and requires a human reviewer.
  Holds ONLY the deploy SSH secrets: `SSH_HOST`, `SSH_USER`, `SSH_KEY`, `SSH_PORT`.
- **`SSH_PASSWORD` must not exist.** Authentication is key-only; the workflow fails fast
  if `SSH_KEY` is empty rather than silently downgrading to a password.
- **Application secrets never live in GitHub.** DB password, `Jwt__Secret`, Telegram/SMTP,
  etc. exist only in `/opt/kaza/env/.env.production` on the VPS (chmod 600).
- More than one required reviewer is recommended: a single approver is a bus factor of one.
