---
name: deploy-safety
description: >
  Use before any production deployment, VPS operation, Docker Compose action, nginx
  action, SSL/certificate change, database migration or backup, GitHub Actions deploy, or
  live hotfix in the Kaza Booking / Novatova shared-VPS environment. Triggers on words
  like deploy, VPS, Kaza, Novatova, nginx, proxy-network, migration, post-login freeze, or
  /opt/apps/kaza-booking. Not for local dev-only or pure UI design work.
---

# deploy-safety (pointer skill)

Kaza Booking runs on a **shared production VPS that also hosts Novatova** behind one
shared reverse proxy (`novatova-nginx`, ports 80/443). Read the library before acting.

## Start here

- **Library index:** [`docs/ai-deployment-skills/README.md`](../../../docs/ai-deployment-skills/README.md)
  — skills index, shared-VPS facts, order of use, emergency stop rules.
- **Safe commands:** [`docs/ai-deployment-skills/command-templates.md`](../../../docs/ai-deployment-skills/command-templates.md).
- **Root agent rules:** [`AGENTS.md`](../../../AGENTS.md).

Open the specific playbook for your task from the index (deploy, API, portal auth, DB
migration, SSL/nginx, proxy-network, hotfix durability, verification, SSH hygiene, …).

## Forbidden Commands — never run these on the shared VPS

Named here only to mark them forbidden. Do not execute them.
- `docker compose down`
- `docker compose up -d` (bare — no service scope; recreate one service with `up -d --no-deps <service>`)
- `docker system prune` / `docker builder prune -a`
- `docker volume rm ...`
- `rm -rf /etc/letsencrypt`
- `certbot delete ...`
- `docker restart novatova-nginx` and `docker restart novatova-*`
- `DROP TABLE ...` / `TRUNCATE TABLE ...` / `DELETE FROM ...` without WHERE + backup + approval
- `git reset --hard` on the live repo (unless explicitly approved AND already backed up)
- `git push --force` to `main`

## Always

- Use `/opt/apps/kaza-booking` (never the stale `/opt/kaza/app`); service-scoped compose
  only; `nginx -t` before any reload (reload, never restart); back up before any DB write;
  promote every live hotfix to `main`; never print secrets. If a Global Stop Condition in
  a skill is met, **halt and report**.
