# Decision 0014 — Reports & Analytics Business Scope: Read-Only Internal Analytics (MVP Freeze)

**Date:** 2026-04-22
**Status:** Frozen
**Domain:** Reports & Analytics
**Applies to:** Tier 3 (Business) and all Reports & Analytics tiers

---

## 1. Decision Summary

Reports & Analytics MVP Business layer is **read-only internal analytics**.

Services in this domain read exclusively from the four aggregate SQL views established in Tier 1 (DB) and mapped in Tier 2 (Data Access). No write operations, no warehouse abstractions, no ETL, no chart rendering, and no export functionality exist at any tier of the current MVP.

This decision is frozen. No future Reports & Analytics ticket may introduce write-side operations, warehouse abstractions, export services, or chart engines without an explicit approved decision note superseding this one.

---

## 2. Rationale

Reports & Analytics services exist to provide a stable, consistent read surface for internal operational analytics. The aggregate SQL views established in Tier 1 already do the heavy lifting of aggregation and filtering. Business-layer services need only:

1. Apply optional date-range and dimension filters to the view queries.
2. Aggregate daily rows into a summary result when requested.
3. Validate filter inputs (date ordering).

Introducing export logic, chart rendering, ETL pipelines, or warehouse abstractions at this stage would:

- Violate the read-model-first scope established in DB-RA-01.
- Duplicate the aggregation already performed by the SQL views.
- Add operational complexity (scheduling, rendering, export formats) with no MVP business justification.
- Risk leaking provider/community/marketing concerns into the internal analytics layer.

---

## 3. Explicitly Prohibited in MVP Business Tier

| Prohibited | Reason |
|---|---|
| Export services (`ExportService`, CSV/PDF export) | No export infrastructure planned for MVP |
| Chart rendering / visualization logic | Belongs in the frontend, not the Business layer |
| Warehouse / ETL / staging abstractions | Out of scope per DB-RA-01 freeze |
| Background refresh / scheduled analytics jobs | No scheduling infrastructure in MVP |
| Materialized view management | Explicitly prohibited per DB-RA-01 |
| Provider-specific analytics | No provider drilldown in reporting views |
| Community / helpfulness / sentiment analytics | No such fields in reporting views |
| Marketing / campaign analytics | No such fields in reporting views |
| Write-side reporting entities | Reports & Analytics reads data, does not own it |
| Public-facing analytics endpoints | Out of MVP scope — internal admin only |
| Per-owner / per-unit drilldowns not in the views | Reporting views are intentionally aggregate-only |

> **Rule:** Reports & Analytics reads data. Reports & Analytics does not own, transform, export, or visualize data.

---

## 4. Official Service Contracts

Four services cover the four reporting view domains:

| Interface | View | Filters |
|---|---|---|
| `IReportingBookingAnalyticsService` | `reporting_booking_daily_summary` | `dateFrom`, `dateTo`, `bookingSource` |
| `IReportingFinanceAnalyticsService` | `reporting_finance_daily_summary` | `dateFrom`, `dateTo` |
| `IReportingReviewsAnalyticsService` | `reporting_reviews_daily_summary` | `dateFrom`, `dateTo` |
| `IReportingNotificationsAnalyticsService` | `reporting_notifications_daily_summary` | `dateFrom`, `dateTo`, `channel` |

Each service exposes exactly two methods:
- `GetDailySummaryAsync(...)` — returns the filtered daily rows as-is from the view.
- `GetSummaryAsync(...)` — returns an aggregated summary across the filtered daily rows.

---

## 5. Filter Rules

### Date-range filtering
- `dateFrom` and `dateTo` are optional parameters on all four services.
- When supplied, they filter the `MetricDate` column **inclusively** on both ends.
- `dateFrom` must be `<=` `dateTo` when both are provided. Violation raises `BusinessValidationException`.
- Neither bound is required in isolation.

### Dimension filters
- `bookingSource` (booking analytics only) — exact string match on `booking_source` column when supplied. No partial/fuzzy match.
- `channel` (notifications analytics only) — exact string match on `channel` column when supplied.
- Finance and reviews analytics have **no additional dimension filters** in MVP.

### Null/empty filter behavior
- A `null` filter is treated as "no filter applied" (returns all rows).
- An empty string `bookingSource` or `channel` is equivalent to `null`.

---

## 6. Summary Result Calculation Rules

| Service | AverageRating rule |
|---|---|
| Booking | Sum all daily `bookings_created_count`, `pending_...`, etc. |
| Finance | Sum all daily amount fields independently |
| Reviews | `TotalPublishedReviewsCount` = sum of daily counts; `AverageRating` = weighted average: `SUM(published_reviews_count * average_rating) / SUM(published_reviews_count)`, falling back to `0.00` when count is 0 |
| Notifications | Sum all daily status-bucket counts |

> **Important:** `ReviewsAnalyticsSummaryResult.AverageRating` is a **weighted** average across days (weighted by `PublishedReviewsCount` per day), not a simple `AVG` of daily averages.

---

## 7. Access Pattern

Services access reporting read models exclusively through `IUnitOfWork`:

```
IUnitOfWork.ReportingBookingDailySummaries        — IQueryable<ReportingBookingDailySummary>
IUnitOfWork.ReportingFinanceDailySummaries        — IQueryable<ReportingFinanceDailySummary>
IUnitOfWork.ReportingReviewsDailySummaries        — IQueryable<ReportingReviewsDailySummary>
IUnitOfWork.ReportingNotificationsDailySummaries  — IQueryable<ReportingNotificationsDailySummary>
```

No direct `AppDbContext` access from Business tier. No raw SQL in Business tier.

---

## 8. What IS Introduced in Reports & Analytics Business Tier

| Category | What It Is |
|---|---|
| This decision note | Architecture freeze document |
| 4 service interfaces | Read-only query contracts per view domain |
| 4 summary result models | Lightweight aggregate result records |
| 4 service implementations | Filter + aggregate logic backed by `IUnitOfWork` |

Nothing else is introduced in the Business tier for this domain.

---

## 9. HB-08A2 Additive API Extension — Owner Ratified 2026-08-10

The earlier four-service/two-method statement remains the ordinary reporting baseline. HB-08A2 additively
extends the existing booking and finance services with the following `analytics:read` routes:

1. `GET /api/internal/reports/bookings/stay-daily`
2. `GET /api/internal/reports/finance/stay-daily`
3. `GET /api/internal/reports/bookings/historical-reconciliation`

Stay-daily filters use inclusive `dateFrom`/`dateTo`; reconciliation uses inclusive `YYYY-MM`
`stayMonthFrom`/`stayMonthTo`. Ranges are ordered and capped at 24 months. Historical rows are included by
default. On Stay routes, `historicalOnly=true` is restrictive and cannot be combined with
`includeHistorical=false`; invalid requests return `400 VALIDATION_ERROR`. Reconciliation is intrinsically
Historical and rejects either filter when supplied. Existing recorded routes do not acquire these filters.

Responses are PII-free. Recorded and stay axes answer different questions and must never be summed.
`actual_booked_at` is used only for per-booking Historical reconciliation/entry-lag reporting. Stay Finance
contains no cash measures. Historical Payment Evidence remains separate, uses `paid_at` for first/last
evidence dates in reconciliation, and never becomes platform settlement.
