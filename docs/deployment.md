# KAZA — Production Deployment Runbook (Hostinger KVM 4)

> ⚠️ **Nothing in this runbook has been executed against the live VPS.** It is the
> operator procedure. Run it deliberately, with the [Approval Blockers](#approval-blockers)
> all GREEN, and never skip the prod-like smoke test ([SMOKE-TEST](#prod-like-smoke-test)).

Single VPS, **production only**. Reverse proxy: **Nginx + Certbot**. Build happens **on
the VPS** (no registry). Dev runs locally via the existing `docker-compose.yml`.

| Item | Value |
|---|---|
| VPS | `76.13.144.224` · Ubuntu 24.04 LTS (KVM 4) |
| Repo | `github.com/HazemAlMili/REMAL` (default `main`; create `dev`) |
| Deploy path | `/opt/kaza/app` · env at `/opt/kaza/env/.env.production` (chmod 600) |
| Domains | `<PORTFOLIO_DOMAIN>` (demo) · `<PORTAL_DOMAIN>` (portals) · `<API_DOMAIN>` (API) — TBD |

## Pinned image versions (Blocker B5 — no `latest`)

| Component | Image | Tag | Defined in |
|---|---|---|---|
| .NET SDK (build) | `mcr.microsoft.com/dotnet/sdk` | `10.0-preview` | `RentalPlatform.API/Dockerfile` (existing) |
| .NET runtime | `mcr.microsoft.com/dotnet/aspnet` | `10.0-preview` | `RentalPlatform.API/Dockerfile` (existing) |
| Node (demo) | `node` | `20-bookworm-slim` | `infra/docker/demo.Dockerfile` |
| Node (portal) | `node` | `20-bookworm-slim` | `infra/docker/portal.Dockerfile` |
| PostgreSQL | `postgres` | `16-alpine` | `docker-compose.prod.yml` |
| Nginx | `nginx` | `1.27-alpine` | `docker-compose.prod.yml` |
| Certbot | `certbot/certbot` | `v3.1.0` | `docker-compose.prod.yml` |

> ⚠️ The .NET base images are **preview** (inherited from the existing, untouched Dockerfile).
> Pin to a .NET 10 GA tag once available (that edit is outside this hands-off ticket).
> For full reproducibility, pin each image by `@sha256:` digest after first pull.

## Approval blockers

See the ticket (`tickets-production-deployment.md`). All of B1–B7 must be GREEN before a live deploy:
secret rotation + `.gitignore` hardening, portal-image verification, prod-like smoke test, rollback
test, pinned images, deployed-SHA logging, `schema_migrations` tracking.

## Phase A — VPS provisioning (one time)

```bash
# As root, then create an unprivileged deploy user.
adduser --disabled-password deploy && usermod -aG sudo deploy
# Add your SSH public key to /home/deploy/.ssh/authorized_keys, then harden sshd:
#   PermitRootLogin no ; PasswordAuthentication no  -> systemctl restart ssh
ufw default deny incoming && ufw default allow outgoing
ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443/tcp && ufw enable   # restrict 22 to your IP if possible
# Docker Engine + compose plugin + git (official convenience script or distro repo):
curl -fsSL https://get.docker.com | sh && usermod -aG docker deploy
apt-get install -y git
# Directory tree (env + releases + backups live OUTSIDE git):
mkdir -p /opt/kaza/{app,env,releases,backups/postgres,backups/uploads,logs}
chown -R deploy:deploy /opt/kaza
```

As `deploy`:
```bash
git clone https://github.com/HazemAlMili/REMAL.git /opt/kaza/app
cd /opt/kaza/app
chmod +x scripts/*.sh infra/certbot/*.sh          # restore exec bit (authored on Windows)
cp .env.example /opt/kaza/env/.env.production
chmod 600 /opt/kaza/env/.env.production
# Fill in real values: rotated DB password, fresh Jwt__Secret, domains, CORS origins, etc.
```

## Phase B — DNS + first certificates

1. Point A records `<PORTFOLIO_DOMAIN>`, `<PORTAL_DOMAIN>`, `<API_DOMAIN>` → `76.13.144.224`.
2. Bootstrap TLS once (creates dummy certs, starts Nginx, fetches real certs, reloads):
   ```bash
   cd /opt/kaza/app
   STAGING=1 ./infra/certbot/init-letsencrypt.sh   # dry-run against LE staging first
   ./infra/certbot/init-letsencrypt.sh             # real certs
   ```

## Phase C — First production boot

```bash
cd /opt/kaza/app
docker compose -f docker-compose.prod.yml --env-file /opt/kaza/env/.env.production up -d --build
```
- On an **empty** `postgres_data` volume, `infra/db/init.prod.sql` builds the schema
  (structural migrations only) and records the `schema_migrations` baseline.
- **Clean-data guarantee (by design):** production starts with **no clients, no owners,
  no units, and no demo master data** — the dev seeds (`0008` master data + public dev
  admins, `0046` demo dataset, `0047` dev owner/client logins) are all excluded. The four
  **managerial role templates** (`SuperAdmin`/`Sales`/`Finance`/`Tech`) **are** present
  (migration `0053`).

### Bootstrap the first admin (required — there is no seeded login)

The dev admins use the public password `Admin@1234` and are intentionally absent. Create one
real SuperAdmin with a password you control:

```bash
cd /opt/kaza/app
set -a; source /opt/kaza/env/.env.production; set +a

# 1) Generate a BCrypt cost-12 hash for your chosen password (no secret is stored on disk):
HASH="$(htpasswd -bnBC 12 "" 'CHOOSE_A_STRONG_PASSWORD' | tr -d ':\n' | sed 's/^\$2y/\$2a/')"

# 2) Seed exactly one SuperAdmin (rotated credentials, never committed):
docker compose -f docker-compose.prod.yml --env-file /opt/kaza/env/.env.production \
  exec -T db psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  -v admin_name='Platform Admin' \
  -v admin_email='admin@yourdomain.com' \
  -v admin_password_hash="$HASH" \
  < infra/db/seed.prod.sql
```

Then log in to the portal as that SuperAdmin and create the remaining managerial accounts
(Sales/Finance/Tech) and real master data (projects/amenities) through the UI — those flows
exist and keep credentials out of the database seed.

## Phase D — Ongoing deploys (automated)

- Merge to `main` → **Deploy Production** workflow waits for manual approval in the
  `production` GitHub Environment → SSHes in, records SHA, builds, `up -d`, health-checks,
  and rolls back to the previous SHA on failure. See `docs/rollback.md`.
- DB migrations are **never** auto-run. Apply them deliberately (`docs/backup-restore.md`
  + `scripts/apply-migrations.sh`) after a backup.

## Prod-like smoke test

**(Blocker B3 — run on a throwaway/local host, NEVER the live VPS.)** See the checklist in
`tickets-production-deployment.md` (API in Production, portal images render via the `/uploads`
proxy, Postgres not publicly reachable, data/uploads persist across restart, `/swagger` → 404,
backups non-empty + restore tested, deployed SHA recorded, no secrets in logs).

## Notes / gotchas

- **Portal images (Blocker B2):** `NEXT_PUBLIC_STORAGE_URL` is empty so image URLs are relative
  `/uploads/...`, proxied to the API by Nginx on each frontend domain. If portal images fail in
  the smoke test, STOP and approve the one-line `next.config.mjs` fix (env-driven `remotePatterns`).
- **NEXT_PUBLIC_* are baked at build time** — changing a domain requires rebuilding the frontend images.
- **Swagger** is blocked at Nginx and also off in Production mode.
- **Health gate** uses `GET /api/projects` (API up + DB reachable). Add a real `/health` endpoint post-launch.
