# Decision 0013 — Reports & Analytics DB Scope: Read-Model-First, Aggregate-View-Only (MVP Freeze)

**Date:** 2026-04-22
**Status:** Frozen
**Domain:** Reports & Analytics
**Applies to:** Tier 1 (DB) through all Reports & Analytics tiers

---

## 1. Decision Summary

Reports & Analytics MVP is **read-model-first**.

No warehouse tables, fact tables, dimension tables, staging tables, or materialized views are introduced at any tier of the current MVP. All reporting data is served from existing operational source-of-truth tables via non-materialized aggregate SQL views.

This decision is frozen. No future Reports & Analytics ticket may create a warehouse, fact, dimension, staging, or ETL table without an explicit approved decision note superseding this one.

---

## 2. Rationale

By the time Reports & Analytics is implemented, the following operational source-of-truth tables are fully established by prior domains:

| Table | Established In |
|---|---|
| `bookings` | Domain 3 — Booking & CRM |
| `clients` | Domain 1 — Master Data & Auth |
| `owners` | Domain 1 — Master Data & Auth |
| `units` | Domain 2 — Units & Availability |
| `invoices` | Domain 4 — Payments / Invoices / Finance |
| `payments` | Domain 4 — Payments / Invoices / Finance |
| `owner_payouts` | Domain 4 — Payments / Invoices / Finance |
| `reviews` | Domain 6 — Reviews & Ratings |
| `notifications` | Domain 7 — Notifications & Alerts |
| `notification_delivery_logs` | Domain 7 — Notifications & Alerts |

All reporting data needed for MVP dashboards, summaries, and operational metrics already exists in these tables. Introducing new reporting-specific write tables would:

- Duplicate the source of truth
- Create synchronization risk between operational and reporting tables
- Require ETL logic that has no business justification in MVP
- Violate the principle that each domain owns one canonical source
- Add unnecessary write paths and operational complexity

The aggregate SQL view approach eliminates all of these risks at the cost of slightly less query performance — an acceptable trade-off at MVP scale.

---

## 3. Explicitly Prohibited in MVP

The following approaches are explicitly **out of scope** for Reports & Analytics MVP and must not be introduced at any tier without a superseding decision note:

| Prohibited | Reason |
|---|---|
| `fact_*` tables | Data warehouse pattern, not needed at MVP scale |
| `dim_*` tables | Dimension modeling, not needed at MVP scale |
| Staging / ETL tables | No ETL pipeline exists or is planned for MVP |
| Materialized views | Introduces refresh complexity and write-side scheduling |
| Scheduled refresh jobs | Out of MVP scope; no refresh infrastructure planned |
| Separate reporting schema / database | Out of MVP scope |
| Incremental load / change-capture tables | Out of MVP scope |

> **Rule:** Reports & Analytics reads data. Reports & Analytics does not own, copy, or store data.

---

## 4. Source-of-Truth Tables (Immutable for Reporting)

The following tables are the authoritative sources for all reporting queries. Reporting views must never perform writes to these tables, and no reporting-tier code may write to them via reporting-initiated flows.

| Table | Reporting Usage |
|---|---|
| `bookings` | Booking counts, occupancy, booking status breakdowns, daily volume |
| `clients` | Client registration activity |
| `owners` | Owner registration activity |
| `units` | Unit counts, availability, active/inactive breakdown |
| `invoices` | Revenue figures, invoice status breakdowns |
| `payments` | Collected payment totals, payment channel breakdown |
| `owner_payouts` | Payout totals, commission summary |
| `reviews` | Review counts, average ratings, moderation status |
| `notifications` | Notification volume, channel breakdown, delivery status |
| `notification_delivery_logs` | Delivery attempt counts, failure rates |

---

## 5. What IS Introduced in Reports & Analytics Tier 1

Reports & Analytics Tier 1 DB support is limited to exactly three categories:

| Category | What It Is |
|---|---|
| This decision note | Architecture freeze document |
| Aggregate SQL views | Non-materialized `CREATE OR REPLACE VIEW` statements that aggregate source tables into daily/summary read models |
| Verification scripts | Static checks confirming views exist and return expected columns |

Nothing else is introduced in Tier 1.

---

## 6. Planned Aggregate SQL Views

The following views will be created in Reports & Analytics Tier 1. All views are non-materialized and read-only.

---

### `reporting_booking_daily_summary`

**Purpose:** One row per calendar day. Provides a daily aggregate of booking activity including new bookings, cancellations, completions, and revenue.

**Source tables:** `bookings`, `invoices`

**Key columns (illustrative):**
- `summary_date` — the calendar day (derived from `bookings.created_at`)
- `new_bookings_count` — bookings created on this day
- `confirmed_bookings_count` — bookings confirmed on this day
- `cancelled_bookings_count` — bookings cancelled on this day
- `completed_bookings_count` — bookings completed on this day
- `total_revenue` — sum of `final_amount` for bookings active on this day
- `avg_booking_value` — average `final_amount` for new bookings on this day

---

### `reporting_finance_daily_summary`

**Purpose:** One row per calendar day. Provides a daily aggregate of financial activity including payments collected, invoices issued, and payouts recorded.

**Source tables:** `invoices`, `payments`, `owner_payouts`

**Key columns (illustrative):**
- `summary_date`
- `invoices_issued_count` — invoices created on this day
- `invoices_paid_count` — invoices with status `paid` as of this day
- `total_payments_collected` — sum of `amount` from payments with status `paid` on this day
- `total_payouts_recorded` — sum of `payout_amount` from owner_payouts created on this day
- `total_commission_earned` — sum of `commission_amount` from owner_payouts created on this day

---

### `reporting_reviews_daily_summary`

**Purpose:** One row per calendar day. Provides a daily aggregate of review activity including submission counts, average rating, and moderation outcomes.

**Source tables:** `reviews`

**Key columns (illustrative):**
- `summary_date`
- `reviews_submitted_count` — reviews created on this day
- `reviews_approved_count` — reviews with status `approved` on this day
- `reviews_rejected_count` — reviews with status `rejected` on this day
- `avg_rating` — average `rating` across reviews created on this day
- `reviews_with_reply_count` — reviews that have a reply recorded

---

### `reporting_notifications_daily_summary`

**Purpose:** One row per calendar day. Provides a daily aggregate of notification activity including volume by channel and delivery status breakdown.

**Source tables:** `notifications`, `notification_delivery_logs`

**Key columns (illustrative):**
- `summary_date`
- `notifications_created_count` — notifications created on this day
- `in_app_count` — notifications with `channel = 'in_app'` on this day
- `email_count` — notifications with `channel = 'email'` on this day
- `sms_count` — notifications with `channel = 'sms'` on this day
- `whatsapp_count` — notifications with `channel = 'whatsapp'` on this day
- `delivered_count` — notifications with `notification_status = 'delivered'` on this day
- `failed_count` — notifications with `notification_status = 'failed'` on this day
- `cancelled_count` — notifications with `notification_status = 'cancelled'` on this day
- `delivery_attempts_count` — total rows in `notification_delivery_logs` on this day

---

## 7. Rules for Reporting Views

All reporting views must adhere to the following rules at every tier:

1. **Read-only**: Views are non-materialized `CREATE OR REPLACE VIEW` — no `MATERIALIZED VIEW`, no `INSERT`, no `UPDATE`.
2. **Aggregate only**: Views perform `GROUP BY` aggregation over source tables — they do not expose raw row-level transactional data.
3. **Source-table immutability**: Views may only reference tables established by prior operational domains. No new source tables may be created for the sole purpose of feeding a reporting view.
4. **No reporting-domain write paths**: No reporting-layer service, controller, or job may write to any source-of-truth table.
5. **No ETL artifacts**: No staging tables, no change-log tables, no incremental load markers.
6. **Internal read models only**: Reporting views are internal operational dashboards only. They are not public-facing and do not expose PII-rich joins without explicit business approval.

---

## 8. Future Considerations (Post-MVP Only)

The following topics are explicitly deferred to post-MVP and must not be implemented in the current Reports & Analytics domain without a superseding decision note:

- Materialized view refresh scheduling
- Dedicated reporting database or schema separation
- BI tool integration (e.g. Metabase, Superset)
- Warehouse modeling (fact/dimension tables)
- Time-series partitioning for reporting tables
- Incremental/streaming ETL
- Real-time dashboards
- Custom report builder
- Exported report files (PDF, CSV)

---

## 9. Cross-Reference

This decision supersedes any implicit assumption that Reports & Analytics requires new persistent write tables. It is consistent with the read-model-first pattern established in:

- Decision 0009 — Owner Portal DB Scope
- Decision 0010 — Owner Portal Business Scope

All future Reports & Analytics tickets at every tier must reference this note as the governing scope constraint.

---

## 10. HB-08A2 Additive Extension — Final Owner-Ratified Dictionary

Migration `0063_add_historical_reporting_read_models.sql` preserves the exact original eight-column prefix of
both `reporting_booking_daily_summary` and `reporting_finance_daily_summary`. It appends only:

- booking recorded view: `historical_bookings_count`, historical status counts,
  `historical_final_amount`, `historical_agreed_amount`, and the four fixed provenance counts;
- finance recorded view: historical invoice count/amount, historical invoice-linked paid/remaining,
  ordinary orphan count/amount and its historical-booking subset, standalone Historical Payment Evidence
  count/amount, and `historical_agreed_amount`.

The same migration creates three non-materialized, keyless read-only views:

| View | Grain and bounded dictionary |
|---|---|
| `reporting_booking_stay_daily_summary` | `(check_in_date, booking_source)` grain with mixed totals and additive Historical count/status/final/agreed components |
| `reporting_finance_stay_daily_summary` | `(check_in_date, booking_source)` grain with contracted/final and active-invoice value only, including `historical_bookings_with_invoice_count`; no cash or remaining measures |
| `reporting_historical_entry_reconciliation` | one PII-free row per Historical `booking_id`, with recorded/actual/stay facts, entry lag, finance/evidence facts and owner-correction facts |

Historical provenance uses `original_source`; the fourth fixed provenance count is a catch-all remainder.
Historical Payment Evidence is identified only by `is_historical_record = true AND invoice_id IS NULL AND
payment_status = 'paid'`, uses `paid_at` for its evidence dates, and never enters ordinary/invoice-linked paid
or remaining totals. Recorded Finance cannot create a `paid_at`-only date row. The payout prefix measures are
intentionally corrected by pre-aggregating payouts per booking so active-invoice fan-out cannot multiply them.
No write-side table, materialized view, ETL object or per-night allocation is introduced.
