# INV-AUDIT-01 invoice aggregate consistency gate

This command performs a read-only pre-release check of every persisted invoice. It reports an
invoice when any of these exact PostgreSQL `numeric` invariants is false:

- `subtotal_amount = SUM(invoice_items.line_total)`;
- `total_amount = subtotal_amount`;
- the invoice has at least one persisted item.

The gate detects inconsistencies only. It never repairs or normalizes data.

Set `KAZA_INVOICE_AUDIT_DB` to the approved review database connection string, then run:

```bash
dotnet run --project RentalPlatform.InvoiceAggregateAudit/RentalPlatform.InvoiceAggregateAudit.csproj \
  -c Release --no-build
```

Use a database identity with `CONNECT`, `USAGE` on the invoice schema, and `SELECT` on only
`invoices` and `invoice_items`. The command additionally executes inside a PostgreSQL
repeatable-read, read-only transaction.

Exit codes:

| Code | Meaning |
| ---: | --- |
| `0` | Every scanned invoice is consistent. |
| `2` | At least one inconsistent invoice was detected. |
| `3` | Verification could not complete or read-only execution could not be proven. |
| `64` | `KAZA_INVOICE_AUDIT_DB` was not provided. |

Diagnostic rows contain bounded operational invoice identifiers, status, item count and aggregate
amounts/deltas. They do not contain client, owner, payment, external-reference, or note data.

Detection is a release gate, not remediation authorization. A nonzero result blocks release
readiness until the Owner approves a separate evidence-driven remediation task.
