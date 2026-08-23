# Staging environment — design (not yet implemented)

**Status: DESIGN ONLY.** Nothing in this document has been built. It exists so the
decision is written down rather than re-argued, and so the work is scoped before anyone
starts it.

## Why

The Historical Booking release accumulated **98 commits, 354 files and 7 migrations**
over roughly a month with nowhere permanent to live before production. Every migration
rehearsal was an ad-hoc, hand-built environment that was torn down afterwards, so each
rehearsal proved something about *that* run and nothing durable about the next one.

A staging environment is the single highest-value structural gap in the current setup.
Its purpose is narrow and worth stating plainly:

> **Staging exists so that migration failures happen there instead of in production.**

It is not a demo environment, not a QA sandbox, and not a place to show work to
stakeholders. Those are different needs with different data requirements.

## Shape

| Concern | Decision | Why |
|---|---|---|
| Host | the same VPS | A second VPS doubles cost and the shared-edge complexity. Staging is small. |
| Compose project | `kaza-staging` | Never `kaza-prod`. Every command must be project-scoped. |
| Compose file | **the same `docker-compose.prod.yml`** | If staging runs a different file it stops predicting production. Differences come from the env file, not a forked compose file. |
| Containers | `kaza-staging-{api,demo,portal,db}` | Distinct names so a mistyped command cannot hit production. |
| Database | separate named volume, separate database | Absolutely no shared volume with `kaza-prod`. |
| Env file | `/opt/kaza/env/.env.staging`, chmod 600 | Separate secrets. Never a copy of production's. |
| Image tags | `kaza-<svc>:<sha>` (same scheme) | The SHA-addressed tags already work; staging reuses them. |
| Edge | staging hostnames on the shared `novatova-nginx` | Kaza still must never bind 80/443. |
| Resource ceiling | memory/CPU limits on every staging service | Staging must not be able to starve production on a shared host. |

## Behaviour

| | Production | Staging |
|---|---|---|
| Deploy trigger | manual dispatch, explicit SHA | **automatic on every merge to `dev`** |
| Migrations | explicit `mode: release`, approved | **automatic, every deploy** |
| Approval | required reviewer | none |
| Per-PR deploys | — | **no** |

Automatic migrations on staging are the entire point: it is the only place where
`apply-migrations.sh` should ever run without a human deciding first. If a migration is
going to fail, it fails here, on a merge to `dev`, days before anyone dispatches a
production release.

Per-PR environments are deliberately excluded. On a shared VPS the cost is real and the
benefit is small — `dev` catches integration problems well enough.

## Data

Periodic **sanitised** restore from the production backup. Sanitisation is not optional
and must run inside the restore, not as a follow-up step someone can forget:

- overwrite every `password_hash` with a known non-production value
- scrub client and owner names, phone numbers and email addresses
- neutralise any outbound notification target

Without sanitisation, staging is a second copy of production PII with weaker access
control — a worse liability than having no staging at all.

## What must be built

1. `.env.staging` on the VPS + the staging entries in the shared nginx config.
2. A `deploy-staging.yml` workflow: trigger on push to `dev`, no approval gate, calls
   `release-production.sh` with staging paths (it is already parameterised by
   `LIVE_DIR`, `ENV_FILE`, `RELEASES_DIR`, `COMPOSE_FILE`).
3. A sanitising restore path — extend `scripts/restore-postgres.sh` rather than adding a
   parallel script.
4. Resource limits in a `docker-compose.staging.override.yml`, applied on top of the
   production compose file.

Item 2 is small precisely because the release orchestrator was written with the paths
injected rather than hardcoded. Do not fork it.

## Open questions

- How often should the sanitised restore run — nightly, or on demand before a release
  rehearsal? Nightly is simpler; on-demand is cheaper.
- Does staging need the storefront (`demo`), or only `api` + `portal`? Migration and
  RBAC failures surface through the portal; the storefront adds build time.
- Disk headroom on the VPS for a second database volume plus a second image set must be
  measured before any of this starts. The last recorded figure was 38 GB free
  (2026-08-16) — re-measure, do not rely on it.
