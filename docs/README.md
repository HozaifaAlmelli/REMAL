# Kaza Booking — documentation index

Start here. This page routes you to the right doc for what you're doing.

| I want to… | Start here |
|---|---|
| **Change anything in production** (deploy, hotfix, debug live) | [`KAZA_PRODUCTION_WORKBOOK.md`](KAZA_PRODUCTION_WORKBOOK.md) — the human operator workbook (Arabic-first). **Always first.** |
| **Operate as an AI agent on production/VPS** | [`ai-deployment-skills/README.md`](ai-deployment-skills/README.md) — 15 deep playbooks + [command templates](ai-deployment-skills/command-templates.md). Root rules: [`../AGENTS.md`](../AGENTS.md). |
| **Find an operations procedure** (rollback, DB backup/restore, verification, smoke) | [`operations/README.md`](operations/README.md) |
| **Manage unit images** (public URLs, device uploads, persistent VPS uploads) | [`operations/unit-image-management.md`](operations/unit-image-management.md) |
| **Understand what broke during production bring-up** | [`incidents/README.md`](incidents/README.md) — historical, not instructions |
| **Look up an old/retired doc** | [`archive/README.md`](archive/README.md) — audit only, never current guidance |
| **See the whole docs tree explained** | [`DOCS_STRUCTURE.md`](DOCS_STRUCTURE.md) |

## Engineering reference (development, not production ops)

| Topic | Doc |
|---|---|
| Branching & release flow | [`branching.md`](branching.md) |
| API reference | [`api/KAZA_BOOKING_API_Reference.md`](api/KAZA_BOOKING_API_Reference.md) · [`api/KAZA_BOOKING_MASTER_API_REFERENCE.md`](api/KAZA_BOOKING_MASTER_API_REFERENCE.md) |
| Auth & environment configuration | [`auth_config.md`](auth_config.md) |
| Architecture decisions | [`architecture/`](architecture/) · [`decisions/`](decisions/) |
| Solution/entrypoint setup | [`setup/`](setup/) |
| Review follow-ups | [`review-followups/`](review-followups/) |
| Design specs | [`superpowers/specs/`](superpowers/specs/) |

Product/design context lives at the repo root: `PRODUCT.md`, `DESIGN.md`,
`business_req.md`, `technical_req.md`, `Front-end-technical-req.md`, and
`.github/copilot-instructions.md` (frontend agent instructions).

## Ground rules for this docs tree

- **Production guidance has exactly two canonical homes:** the workbook (humans) and the
  skills library (agents + humans). Don't create a third.
- New **incident write-ups** go to `incidents/`; new **playbooks** go to
  `ai-deployment-skills/`; retired docs go to `archive/` (see its README).
- The stubs at `deployment.md`, `rollback.md`, `backup-restore.md` exist only to keep old
  links alive — don't add content to them.
