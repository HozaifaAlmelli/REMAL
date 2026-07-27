# Archive — not active guidance

Everything in this folder is kept for **audit and history only**. Nothing here is
current process. Some archived runbooks contain paths and commands that are now
**wrong or forbidden** (stale `/opt/kaza/app` path, unscoped compose commands,
pre-Novatova assumptions) — do not follow them.

For the current process, use:

- [docs/README.md](../README.md) — main docs entry
- [Kaza Production Workbook](../KAZA_PRODUCTION_WORKBOOK.md) — operator guide
- [AI Deployment Skills](../ai-deployment-skills/README.md) — deep playbooks
- [Operations index](../operations/README.md)

## Layout

| Folder | Contents |
|---|---|
| [`superseded-runbooks/`](superseded-runbooks/) | Old deployment/rollback/backup runbooks and executed plan-handoff ticket files, replaced by the workbook, skills, and `docs/operations/`. |
| [`project-history/`](project-history/) | Wave-era development planning docs, QA reports, context prompts, and doc bundles from the initial build-out. |
| [`obsolete/`](obsolete/) | Pasted transcripts, duplicate API references, and stale artifacts with no successor. |
| [`cleanup-inventory-20260705.md`](cleanup-inventory-20260705.md) | The classification report that produced this structure. |

## Why archive instead of delete?

Git history preserves deleted files, but an explicit archive keeps the audit trail
browsable and makes "this is no longer the way" unmistakable. If you find yourself
adding a *new* file here as active guidance — stop; it belongs in `docs/operations/`,
`docs/ai-deployment-skills/`, or `docs/incidents/` instead.
