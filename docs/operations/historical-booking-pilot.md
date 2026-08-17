# Historical Booking pilot reconciliation

This is the pull-only daily operating checklist for a low-volume Historical Booking pilot. It does not
authorize a production migration or deployment. Follow the production workbook and database safety playbook
before any live change.

## Access boundary

- Keep the SuperAdmin bootstrap baseline unchanged.
- Grant `bookings:record_historical` explicitly to one existing operational pilot role.
- Grant `payments:record_historical` only when payment-evidence capture is part of the pilot.
- Keep owner-attribution correction SuperAdmin-exclusive.
- Keep reporting access independent. Historical write permission does not grant report reads.
- Sign affected operators in again after a role-access change.

## Daily pull-only check

1. Pull Historical records entered for the Recorded date and identify the operator through authorized audit
   data.
2. Compare the represented Stay date range without summing Recorded and Stay totals.
3. Review per-booking entry lag, original-source provenance and any duplicate or overlap rejection observed by
   the operator.
4. Review owner-attribution warnings and immutable correction evidence. Do not rewrite Historical truth during
   reconciliation.
5. Reconcile Historical Payment Evidence count and amount separately from platform paid and invoice settlement.
6. Review authorization failures for unexpected access attempts.
7. Confirm unexpected automatic invoice creation, payout creation and notification creation are each zero.
8. Record unexplained differences for owner/engineering review before increasing pilot volume.

The process adds no webhook, scheduled push or telemetry platform. The existing structured reporting query
logs remain bounded and PII-free.

## Presentation checks

- Admin booking list and detail label Historical records using persisted classification.
- Recorded reports explain that their date is when KAZA recorded the row.
- Stay reports use check-in date; an old stay recorded today stays in its original Stay bucket.
- The operational acquisition funnel excludes Historical records and states the excluded count.
- Historical Payment Evidence is labelled as evidence, never platform paid, invoice paid, settlement or payout.
- Owner-facing booking rows may show the Historical label, while payout truth remains `owner_payouts`.
- Occupancy percentage correction is intentionally separate; do not repoint the existing formula and call it
  fixed.

## Access rollback

Revoke pilot permissions to stop new Historical recording access. Existing Historical bookings, payment
evidence, booking history, owner review and correction evidence remain intact and reportable to authorized
readers.

Never delete or rewrite Historical data as a rollback step. A later reporting-code or reporting-view rollback
may restore prior definitions under its approved migration procedure, but it must preserve all write-side
truth.
