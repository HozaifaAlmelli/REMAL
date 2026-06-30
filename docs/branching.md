# KAZA — Branching & Release Workflow

```
feature/*  ->  dev  ->  main  ->  (deploy to production VPS)
hotfix/*   ->  main  (then merge back to dev)
```

- **`main`** — production-ready only. Every merge must be deployable. Pushing to `main`
  (or merging a PR into it) triggers the manual-approval production deploy.
- **`dev`** — integration branch. **CI-checks only — it does NOT deploy anywhere.**
  Developers run the full stack locally via the existing `docker-compose.yml`.
- **`feature/*`** — branch from `dev`, PR back into `dev`, must pass PR checks.
- **`hotfix/*`** — branch from `main`, PR into `main`, then merge back into `dev`.

> The VPS is **production only** (per decision). There is no staging deployment.

## Branch protection

**`main`**
- [ ] Require a pull request before merging (+ ≥1 approval).
- [ ] Require status checks to pass: the `PR Checks` jobs (backend, demo, portal, compose-validate).
- [ ] Require branches to be up to date before merging.
- [ ] Require conversation resolution before merging.
- [ ] Block force pushes and direct pushes.

**`dev`**
- [ ] Require a pull request before merging.
- [ ] Require the `PR Checks` build jobs to pass.
- [ ] Block force pushes.

## GitHub Environments

- **`production`** — restrict deployments to the `main` branch; enable **required reviewers**
  (manual approval) before the deploy job runs. Holds ONLY the deploy SSH secrets:
  `SSH_HOST`, `SSH_USER`, `SSH_KEY`, `SSH_PORT`.
- **Application secrets never live in GitHub.** DB password, `Jwt__Secret`, Telegram/SMTP,
  etc. exist only in `/opt/kaza/env/.env.production` on the VPS (chmod 600).

## First-time setup

```bash
git checkout main && git pull
git checkout -b dev && git push -u origin dev
# Then configure the protection rules + the production Environment in GitHub settings.
```
