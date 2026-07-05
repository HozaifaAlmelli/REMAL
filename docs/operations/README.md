# Operations index — Kaza Booking production

Current operational guidance, grouped by purpose. The two canonical sources are the
**[Kaza Production Workbook](../KAZA_PRODUCTION_WORKBOOK.md)** (human operator guide,
Arabic-first) and the **[AI Deployment Skills](../ai-deployment-skills/README.md)**
(deep playbooks). This index maps each operations topic to its canonical home instead of
duplicating content.

> Old runbooks (`docs/deployment.md`, `docs/rollback.md`, `docs/backup-restore.md`) are
> superseded — stubs at those paths redirect here. Do not follow archived runbooks for
> live changes.

| Purpose | Canonical doc |
|---|---|
| **Production map** (domains, containers, paths, Novatova boundary) | [Workbook §1](../KAZA_PRODUCTION_WORKBOOK.md) · [production-inventory-and-discovery](../ai-deployment-skills/production-inventory-and-discovery.md) |
| **Deployment** (safe scoped deploy, merge-to-main behavior, branch choice) | [Workbook §3–§6](../KAZA_PRODUCTION_WORKBOOK.md) · [docker-compose-scoped-deploy](../ai-deployment-skills/docker-compose-scoped-deploy.md) · [github-actions-production-deploy-safety](../ai-deployment-skills/github-actions-production-deploy-safety.md) |
| **Verification** (post-change checklist, expected results) | [Workbook §8](../KAZA_PRODUCTION_WORKBOOK.md) · [final-verification-and-reporting](../ai-deployment-skills/final-verification-and-reporting.md) |
| **Rollback & recovery** | [rollback-and-recovery.md](rollback-and-recovery.md) |
| **Database** (backups, restore, gated migrations) | [database-operations.md](database-operations.md) · [database-migration-production-safety](../ai-deployment-skills/database-migration-production-safety.md) |
| **SSL / nginx** (shared edge, cert checks, reload discipline) | [Workbook §13](../KAZA_PRODUCTION_WORKBOOK.md) · [ssl-and-nginx-reverse-proxy](../ai-deployment-skills/ssl-and-nginx-reverse-proxy.md) · [proxy-network-reattach-and-nginx-reload](../ai-deployment-skills/proxy-network-reattach-and-nginx-reload.md) |
| **Smoke testing** (production login smoke, secret hygiene) | [Workbook §12](../KAZA_PRODUCTION_WORKBOOK.md) · [smoke-accounts-and-secret-hygiene](../ai-deployment-skills/smoke-accounts-and-secret-hygiene.md) · `scripts/production-login-smoke-maintenance.sh` (run by `.github/workflows/production-login-smoke-maintenance.yml`) |
| **Emergency playbooks** (app down, 500/502, SSL, deploy failed, login freeze, …) | [Workbook §17](../KAZA_PRODUCTION_WORKBOOK.md) |
| **Branching & release flow** | [../branching.md](../branching.md) |

## Non-negotiables (full list in the workbook §2)

Never `docker compose down` · never a bare `docker compose up -d` (service-scoped
`up -d --no-deps <service>` only) · never start Kaza nginx/certbot on 80/443 · never
restart `novatova-*` · never touch the DB without a verified backup · always `nginx -t`
before reload · promote every live fix to `main` · never print secrets.
