# Incidents — historical record

This folder holds **historical** incident write-ups: what broke, why, how it was fixed,
and what was learned. It exists for audit and context, not for operating production.

> ⚠️ **Do not use old incident runbooks or their inline commands as current deploy
> instructions.** Environments drift; commands that were right during an incident can be
> wrong (or dangerous) later. Current instructions live in:
>
> - [Kaza Production Workbook](../KAZA_PRODUCTION_WORKBOOK.md) — operator guide
> - [AI Deployment Skills](../ai-deployment-skills/README.md) — deep playbooks
> - [Operations index](../operations/README.md)

## Index

| Incident | Period | Summary |
|---|---|---|
| [2026-07 Kaza production stabilization](2026-07-kaza-production-stabilization.md) | 2026-06 → 2026-07 | Full production bring-up on the shared Novatova VPS: wrong repo path, missing SSL, API runtime failure, unsafe pipeline, proxy-network drops, migration numbering, post-login freeze, and the lessons now encoded in the skills library. |

## Adding a new incident

Create `YYYY-MM-short-slug.md` here with: impact, timeline, root cause(s), fix, and
lessons. Redact all secrets/IPs. If a lesson is reusable, encode it in
[`docs/ai-deployment-skills/`](../ai-deployment-skills/README.md) — the incident file
records *what happened*; the skill records *what to do next time*.
