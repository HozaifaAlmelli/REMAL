# Ticket — KAZA Production Deployment on Hostinger KVM 4

**Type:** DevOps / Infrastructure · **Priority:** High / Production-critical
**Mode:** Nginx + Certbot · single VPS · **production only** (dev stays local)

---

## ⚠️⚠️ DO-NOT-TOUCH-PRODUCTION / DO-NOT-TOUCH-PROJECTS ⚠️⚠️

> - **Nothing in this ticket has been run against the live VPS** (`76.13.144.224`): no SSH,
>   no Docker on the server, no DNS, no certs, no DB writes, no deploy. Execution is gated
>   behind explicit, step-by-step approval (see the runbook).
> - **No existing project code was modified.** `demo/`, `rental-platform/`, and
>   `RentalPlatform.{API,Business,Data,Shared}/` are byte-for-byte unchanged. Every artifact
>   lives OUTSIDE them (`infra/`, repo root, `.github/`, `scripts/`, `docs/`). The only edited
>   pre-existing file is the root `.gitignore` (secret-hygiene hardening, explicitly approved).
> - The dev `docker-compose.yml` is untouched; production has its own files.

## Status: infra authored & locally validated; live deploy NOT performed

`docker compose -f docker-compose.prod.yml --env-file .env.example config` → **valid**.

## What was delivered (all new files)

| File | Purpose |
|---|---|
| `docker-compose.prod.yml` | Prod stack: `db` (internal-only), `api`, `demo`, `portal`, `nginx`, `certbot`. Pinned images; secrets via `--env-file`. |
| `.env.example` | Documents every prod env NAME (no values). Real file lives only on the VPS. |
| `.gitignore` (edited) | Now ignores `.env`, `.env.*` (keep `.env.example`), `secrets/`, `*.key`, `*.pem`. |
| `infra/db/init.prod.sql` | First-boot schema build — **excludes dev seeds**, seeds the `schema_migrations` baseline. |
| `infra/db/seed.prod.sql` | **Manual** bootstrap of one real SuperAdmin (rotated password; nothing committed). |
| `infra/docker/demo.Dockerfile` (+`.dockerignore`) | Next 16 prod image (`next start :3000`). Context `./demo`, app dir untouched. |
| `infra/docker/portal.Dockerfile` (+`.dockerignore`) | Next 14 prod image (`next start :3001`). Context `./rental-platform`. |
| `infra/nginx/nginx.conf` + `templates/{portfolio,portal,api}.conf.template` | TLS, HTTP→HTTPS, security headers, `/uploads` proxy, `/swagger` 404. Domains via envsubst. |
| `infra/certbot/init-letsencrypt.sh` | One-time TLS bootstrap (dummy cert → real cert → reload). |
| `.github/workflows/pr-checks.yml` | PR→dev/main: build API + both frontends, type-check portal, validate prod compose. No deploy. |
| `.github/workflows/deploy-production.yml` | push→main (manual-approval `production` env): SSH, record SHA, build, up, health-check, SHA-rollback. |
| `scripts/{backup-postgres,backup-uploads,restore-postgres}.sh` | Backups (14-day retention, integrity checks) + tested restore. |
| `scripts/apply-migrations.sh` | Gated, `schema_migrations`-tracked runner: backup-first, verify-after, refuses destructive without `APPROVE_DESTRUCTIVE=1`. |
| `docs/{deployment,branching,backup-restore,rollback}.md` | Runbooks. |

## 🚦 Approval blockers — all GREEN before a live deploy

- **B1 Secrets:** revoke+replace the Telegram token; treat the committed dev `Jwt__Secret` + DB password as **burned**; `.gitignore` hardened (done); prod `.env` only on VPS `chmod 600`.
- **B2 Portal images:** `NEXT_PUBLIC_STORAGE_URL=""` + Nginx `/uploads` proxy must render portal images in a prod build. If it fails → STOP, approve the one-line `next.config.mjs` `remotePatterns` fix.
- **B3 Prod-like smoke test** passes (off-VPS). **B4 Rollback tested once** (off-VPS).
- **B5 Images pinned** (no `latest`; table in `docs/deployment.md`). ⚠️ .NET base is `10.0-preview` (inherited from the untouched API Dockerfile) — pin to GA later.
- **B6 Deployed-SHA logging** to `/opt/kaza/releases/current-sha.txt`; rollback targets a specific SHA.
- **B7 Migrations tracked** in the `schema_migrations` table.

## Clean production data (per requirement)

Production starts **clean**: **no clients, no owners, no units, no demo master data.** The dev
seeds are excluded (`0008` demo master data + public `Admin@1234` admins, `0046` heavy demo set,
`0047` dev owner/client logins). The **managerial role templates** `SuperAdmin/Sales/Finance/Tech`
(migration `0053`) **are kept**. The first admin is created securely and manually via
`infra/db/seed.prod.sql` (rotated bcrypt password, never committed); remaining managerial
accounts + real master data are created in-app by that SuperAdmin. See `docs/deployment.md` → Phase C.

## How prod works without touching app code (config-only)

`ASPNETCORE_ENVIRONMENT=Production`, connection string, and CORS origins are injected via the
prod compose env (runtime overrides the image defaults; `appsettings.Production.json` CORS is
empty by design). Health gates on the existing anonymous `GET /api/projects`. Swagger is blocked
at Nginx. Frontends build with prod `NEXT_PUBLIC_*` build-args; `STORAGE_URL` is relative so unit
images are served same-origin through the `/uploads` proxy.

## Execution order (later, with approval)

1. **GitHub:** create `dev`; protect `main`+`dev`; create `production` Environment (manual approval, SSH secrets only). `docs/branching.md`.
2. **VPS provision** + `/opt/kaza` tree + `.env.production` (chmod 600). `docs/deployment.md` Phase A.
3. **DNS** A-records → issue certs (`init-letsencrypt.sh`, staging first). Phase B.
4. **First boot** (`up -d --build`) → schema builds clean → **bootstrap SuperAdmin** via `seed.prod.sql`. Phase C.
5. **Prod-like smoke test (B3)** + **rollback test (B4)** off-VPS before trusting the live deploy.
6. **Backups** cron + **restore test**. `docs/backup-restore.md`.
7. Ongoing: merge→`main` → approve → deploy workflow. Migrations via `apply-migrations.sh` only, after backup.

## Out of scope

No app/feature/UI changes; no change to existing app tables (the `schema_migrations` ledger is
the only addition, created by init/runner); no Telegram/SMTP delivery (env reserved only — no such
code exists yet); no staging stack; no Kubernetes/registry/CDN/blue-green.
