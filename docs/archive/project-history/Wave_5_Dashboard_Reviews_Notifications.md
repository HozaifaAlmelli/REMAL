# Wave 5 — Dashboard Analytics + Reviews + Notifications
## Rental Platform Frontend — Complete Ticket Pack
**Wave Number:** 5
**Wave Name:** Dashboard Analytics + Reviews + Notifications
**Total Tickets:** 12
**Estimated Days (1 dev):** 4
**Parallel Tracks:** 3 — Dashboard Analytics (Track A), Reviews Moderation (Track B), Notifications (Track C)

---

## Wave 5 Overview

After Wave 5, the Admin Panel is 100% complete. This wave adds the analytics layer on top of the existing dashboard, the reviews moderation workflow, and the notifications system (bell, inbox, preferences, dispatch).

**Track A — Dashboard Analytics (FE-5-DASH-01 → 03):**
Recharts-powered analytics charts on the dashboard and a standalone `/admin/analytics` page using the daily reporting endpoints built in Wave 2/4.

**Track B — Reviews Moderation (FE-5-REV-01 → 04):**
Admin moderation of client reviews: list all reviews pending moderation, publish/reject/hide, and view the full audit trail.

**Track C — Notifications (FE-5-NOT-01 → 05):**
Notification bell with unread count in the admin header, notification inbox, preferences, and a dispatch UI for sending notifications to users.

---

## ⛔ GLOBAL RULES

```
NO MOCK DATA — EVER.

ReviewStatus:         'Pending' | 'Published' | 'Rejected' | 'Hidden'  (PascalCase)
NotificationChannel:  'Email' | 'SMS' | 'InApp'  (PascalCase — 'InApp' not 'in_app')
NotificationStatus:   'Pending' | 'Queued' | 'Sent' | 'Delivered' | 'Failed' | 'Cancelled'

Recharts: dynamic() import with ssr: false — heavy library, Guest App only loaded it there
Pagination: totalCount + totalPages
```

---

## Ticket List

| # | Ticket ID | Title | Track | Priority |
|---|-----------|-------|-------|----------|
| 1 | FE-5-DASH-01 | Add analytics charts to admin dashboard | A | High |
| 2 | FE-5-DASH-02 | Build standalone analytics page | A | High |
| 3 | FE-5-DASH-03 | Build occupancy + top units widgets | A | Medium |
| 4 | FE-5-REV-01 | Create Reviews service + types | B | Critical |
| 5 | FE-5-REV-02 | Build Reviews moderation list page | B | Critical |
| 6 | FE-5-REV-03 | Build Review moderation actions | B | Critical |
| 7 | FE-5-REV-04 | Build Review detail view + status history | B | High |
| 8 | FE-5-NOT-01 | Create Notifications service + types | C | Critical |
| 9 | FE-5-NOT-02 | Build notification bell (admin header) | C | Critical |
| 10 | FE-5-NOT-03 | Build admin notification inbox page | C | High |
| 11 | FE-5-NOT-04 | Build notification preferences settings | C | High |
| 12 | FE-5-NOT-05 | Build admin notification dispatch UI | C | Medium |

---

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TICKET ID: FE-5-DASH-01
TITLE: Add analytics charts to admin dashboard
WAVE: Wave 5 — Dashboard Analytics + Reviews + Notifications
DOMAIN: Dashboard
PRIORITY: High
DEPENDS ON: FE-2-ADMIN-02 (dashboard page + reports service), FE-0-INFRA-01 (recharts installed)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section 1 — Walkthrough

**What is this ticket about?**
The admin dashboard (Wave 2) shows 4 static stat cards. This ticket adds two Recharts charts below them: a Line Chart showing revenue over the last 30 days, and a Bar Chart showing bookings by status. These make trends instantly visible — instead of just knowing this month's revenue, you see if it's going up or down.

**Why Recharts here?**
Recharts is already installed (FE-0-INFRA-01). It uses `dynamic()` with `ssr: false` to avoid SSR issues and bundle bloat.

---

### Section 2 — Objective

Add two Recharts charts to `/admin/dashboard`: a 30-day revenue line chart and a bookings-by-status bar chart — using `GET /api/internal/reports/finance/daily` and `GET /api/internal/reports/bookings/daily`.

---

### Section 4 — In Scope

- [ ] `components/admin/dashboard/RevenueLineChart.tsx` — 30-day revenue trend
- [ ] `components/admin/dashboard/BookingsBarChart.tsx` — bookings count by status
- [ ] Both loaded via `dynamic({ ssr: false, loading: () => <Skeleton height={300}> })`
- [ ] Default date range: last 30 days (computed from `new Date()`)
- [ ] Revenue chart: X-axis = date labels, Y-axis = EGP amount, data line = `totalRevenue` per day
- [ ] Bookings chart: X-axis = date, Y-axis = count, bars = confirmed + completed + cancelled
- [ ] Recharts custom tooltip: warm-toned, matches design system (`font-body`, `neutral-800` text)
- [ ] Responsive: `<ResponsiveContainer width="100%" height={280}>`
- [ ] Both charts below the 4 stat cards on the dashboard

**Files to create:**
- `components/admin/dashboard/RevenueLineChart.tsx`
- `components/admin/dashboard/BookingsBarChart.tsx`

**Files to modify:**
- `app/(admin)/dashboard/page.tsx` — add charts below stat cards

---

### Section 6 — Technical Contract

#### 6a. Component Props Interface

```typescript
// RevenueLineChart.tsx
interface RevenueLineChartProps {
  data:      FinanceAnalyticsDailySummaryResponse[]
  isLoading: boolean
}

// BookingsBarChart.tsx
interface BookingsBarChartProps {
  data:      BookingAnalyticsDailySummaryResponse[]
  isLoading: boolean
}
```

#### 6b. Hook — extend useReports in lib/hooks/useReports.ts

```typescript
// Add to existing useReports.ts:
export function useFinanceDaily(filters?: ReportFilters) {
  return useQuery({
    queryKey: queryKeys.reports.financeDaily(filters),
    queryFn:  () => reportsService.getFinanceDaily(filters),
    staleTime: 1000 * 60 * 10,   // 10 minutes — daily data doesn't change often
  })
}

export function useBookingsDaily(filters?: ReportFilters) {
  return useQuery({
    queryKey: queryKeys.reports.bookingsDaily(filters),
    queryFn:  () => reportsService.getBookingsDaily(filters),
    staleTime: 1000 * 60 * 10,
  })
}
```

---

### Section 7 — API Integration

| Method | Endpoint | Query | Response | When |
|---|---|---|---|---|
| GET | `/api/internal/reports/finance/daily` | `{ startDate, endDate }` | `FinanceAnalyticsDailySummaryResponse[]` | on dashboard mount |
| GET | `/api/internal/reports/bookings/daily` | `{ startDate, endDate }` | `BookingAnalyticsDailySummaryResponse[]` | on dashboard mount |

```typescript
// Default date range — last 30 days:
const endDate   = format(new Date(), 'yyyy-MM-dd')
const startDate = format(subDays(new Date(), 30), 'yyyy-MM-dd')
```

---

### Section 9 — Component & File Deliverables

```typescript
// components/admin/dashboard/RevenueLineChart.tsx
'use client'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { formatCurrency } from '@/lib/utils/format'
import { formatDate } from '@/lib/utils/format'

export function RevenueLineChart({ data, isLoading }: RevenueLineChartProps) {
  if (isLoading) return <Skeleton height={280} className="rounded-card" />

  const chartData = data.map(d => ({
    date:    formatDate(d.date),    // "15 Apr 2026"
    revenue: d.totalRevenue,
  }))

  return (
    <div className="bg-white rounded-card shadow-card p-6">
      <h3 className="font-medium text-neutral-700 mb-4">Revenue — Last 30 Days</h3>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-neutral-200)" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: 'var(--color-neutral-400)' }}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 11, fill: 'var(--color-neutral-400)' }}
            tickLine={false}
            tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
          />
          <Tooltip
            formatter={(value: number) => [formatCurrency(value), 'Revenue']}
            contentStyle={{
              backgroundColor: 'var(--color-neutral-800)',
              border: 'none',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '13px',
            }}
          />
          <Line
            type="monotone"
            dataKey="revenue"
            stroke="var(--color-primary-500)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
```

---

### Section 10 — UX & Loading State Rules

| State | Required? | Behavior |
|---|---|---|
| Loading | ✓ REQUIRED | `<Skeleton height={280}>` placeholder for each chart |
| No data (empty 30 days) | ✓ REQUIRED | Chart renders with flat 0 line — no empty state component (chart IS the state) |
| Error | ✓ REQUIRED | Small inline "Could not load chart data" text below stat cards |

---

### Section 12 — Acceptance Criteria

- [ ] Both charts loaded via `dynamic({ ssr: false })` with skeleton loading
- [ ] Default range: last 30 days using `date-fns subDays()`
- [ ] `formatCurrency()` in tooltip, not raw numbers
- [ ] `staleTime: 10 minutes` on both queries
- [ ] Charts use design system colors: `var(--color-primary-500)` for revenue line
- [ ] `ResponsiveContainer` used — no fixed pixel widths
- [ ] No `<img>` tags — Recharts is SVG only
- [ ] No mock data

---

### Section 13 — Notes for AI / Common Mistakes

**DO NOT:**
- ⛔ NO MOCK DATA. No `const chartData = [{ date: 'Jan', revenue: 5000 }]`.
- Do NOT import Recharts at the module level — use `dynamic({ ssr: false })`
- Do NOT use hardcoded colors in charts — use CSS variables `var(--color-primary-500)`
- Do NOT skip `ResponsiveContainer` — charts must be responsive

**WATCH OUT FOR:**
- Recharts XAxis `interval="preserveStartEnd"` prevents label overlap on narrow screens
- The tooltip `contentStyle` needs inline styles (Recharts doesn't accept className)
- `FinanceAnalyticsDailySummaryResponse.date` is an ISO string — format with `formatDate()` for display

---

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TICKET ID: FE-5-DASH-02
TITLE: Build standalone analytics page
WAVE: Wave 5
DOMAIN: Dashboard
PRIORITY: High
DEPENDS ON: FE-5-DASH-01, FE-2-ADMIN-01
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section 1 — Walkthrough

**What is this ticket about?**
The dashboard shows a 30-day snapshot. The analytics page at `/admin/analytics` is a deeper dive: adjustable date range, revenue breakdown table, bookings funnel (leads → confirmed → completed), conversion rate trend, and a full data table for export.

---

### Section 4 — In Scope

- [ ] `app/(admin)/analytics/page.tsx`
- [ ] Date range picker (from/to) — default: current month
- [ ] **Revenue Summary cards:** (same as Finance overview but with date filter)
- [ ] **Revenue Line Chart** (from FE-5-DASH-01 — reuse component)
- [ ] **Bookings Funnel Bar Chart:** Total Leads → Active → Confirmed → Completed → Cancelled
- [ ] **Daily Revenue Table:** date-by-date breakdown (same data as chart, in table form)
- [ ] **Booking Analytics Table:** daily lead/booking counts
- [ ] Guard: `canViewReports`
- [ ] Add Analytics link to admin sidebar nav (update `AdminNav` constants from FE-2-ADMIN-01)

**Files to create:**
- `app/(admin)/analytics/page.tsx`
- `components/admin/analytics/BookingsFunnelChart.tsx`
- `components/admin/analytics/DailyRevenueTable.tsx`
- `components/admin/analytics/DailyBookingsTable.tsx`

**Files to modify:**
- `components/admin/layout/AdminNav.tsx` — add Analytics nav item

---

### Section 7 — API Integration

Same as FE-5-DASH-01 — finance/daily and bookings/daily with user-selected date range.

---

### Section 12 — Acceptance Criteria

- [ ] Date range picker re-fetches all report data
- [ ] Funnel chart shows: Leads → Active → Confirmed → Completed
- [ ] Daily table sortable by date
- [ ] `canViewReports` gates the page
- [ ] No mock data

---

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TICKET ID: FE-5-DASH-03
TITLE: Build occupancy + top units widgets
WAVE: Wave 5
DOMAIN: Dashboard
PRIORITY: Medium
DEPENDS ON: FE-5-DASH-01, FE-2-UNITS-01 (units service)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section 1 — Walkthrough

**What is this ticket about?**
Two additional dashboard widgets: an occupancy rate indicator (% of days booked vs total days across all active units in the current month) and a "top bookings by unit" mini-table showing which units are most in demand. Both are derived from existing data — no new API endpoints needed.

---

### Section 4 — In Scope

- [ ] `components/admin/dashboard/OccupancyWidget.tsx`
  - Computes: `confirmedBookings / totalActiveDays * 100` from `BookingAnalyticsSummaryResponse`
  - Displayed as a radial progress or horizontal bar
- [ ] `components/admin/dashboard/TopUnitsWidget.tsx`
  - Fetches `GET /api/internal/units` sorted by most bookings (if sort param exists) OR derives from bookings daily data
  - Shows top 5 units: name, project, booking count
- [ ] Both placed on dashboard as a second row, beside or below the charts

**Files to create:**
- `components/admin/dashboard/OccupancyWidget.tsx`
- `components/admin/dashboard/TopUnitsWidget.tsx`

---

### Section 12 — Acceptance Criteria

- [ ] Occupancy rate computed from real data (no hardcoded %)
- [ ] Top units list from real API (no hardcoded unit names)
- [ ] Skeleton loading for both widgets
- [ ] No mock data

---

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TICKET ID: FE-5-REV-01
TITLE: Create Reviews service + TypeScript types
WAVE: Wave 5
DOMAIN: Reviews
PRIORITY: Critical
DEPENDS ON: FE-0-INFRA-03, FE-0-INFRA-04
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section 1 — Walkthrough

**What is this ticket about?**
All Review moderation tickets depend on typed contracts for reviews and moderation actions. This ticket creates the service layer and types.

**Note on review listing:** The API's moderation endpoints act on specific `reviewId`, but no `GET /api/internal/reviews` list endpoint is documented. Treat admin review list as a backend gap; do not use public review endpoints as a fallback for moderation data.

---

### Section 4 — In Scope

- [ ] `lib/types/review.types.ts`
- [ ] `lib/api/services/reviews.service.ts`
- [ ] `lib/hooks/useReviews.ts`

---

### Section 6 — Technical Contract

```typescript
// lib/types/review.types.ts
// From KAZA_BOOKING_API_Reference.md

type ReviewStatus = 'Pending' | 'Published' | 'Rejected' | 'Hidden'

// ── Public review (from GET /api/public/units/{unitId}/reviews) ──
interface PublishedReviewListItemResponse {
  reviewId:            string
  unitId:              string
  rating:              number
  title:               string
  comment:             string | null
  publishedAt:         string
  ownerReplyText:      string | null
  ownerReplyUpdatedAt: string | null
}

// ── Public review summary ──
interface UnitPublishedReviewSummaryResponse {
  unitId:                string
  publishedReviewCount:  number
  averageRating:         number
  lastReviewPublishedAt: string | null
}

// ── Internal/admin moderation list ──
// Backend Gap: enriched moderation list contract is not documented.
// Do NOT invent review list fields (client identity/unit identity/visibility/etc.)
// until backend publishes a documented internal list endpoint.

// ── Review Status History ──
interface ReviewStatusHistoryResponse {
  id:           string
  reviewId:     string
  oldStatus:    ReviewStatus | null
  newStatus:    ReviewStatus
  changedByName: string
  notes:        string | null
  changedAt:    string
}

// ── Moderation requests ──
interface PublishReviewRequest {
  notes?: string
}

interface RejectReviewRequest {
  notes?: string
}

interface HideReviewRequest {
  notes?: string
}

// ── Client review submission ──
interface CreateReviewRequest {
  bookingId: string
  rating:    number     // 1-5
  title:     string     // REQUIRED — reviews have a title
  comment?:  string
}

interface UpdatePendingReviewRequest {
  rating?:  number
  title?:   string
  comment?: string
}
```

```typescript
// lib/api/services/reviews.service.ts
export const reviewsService = {
  // ── Public ──
  getPublicByUnit:   (unitId: string): Promise<PublishedReviewListItemResponse[]> =>
    api.get(endpoints.publicReviews.byUnitList(unitId)),

  getPublicSummary:  (unitId: string): Promise<UnitPublishedReviewSummaryResponse> =>
    api.get(endpoints.publicReviews.byUnitSummary(unitId)),

  getPublicById:     (unitId: string, reviewId: string): Promise<PublishedReviewListItemResponse> =>
    api.get(endpoints.publicReviews.byUnitDetail(unitId, reviewId)),

  // ── Moderation ──
  publish:           (reviewId: string, data?: PublishReviewRequest): Promise<unknown> =>
    api.post(endpoints.reviewModeration.publish(reviewId), data ?? {}),

  reject:            (reviewId: string, data: RejectReviewRequest): Promise<unknown> =>
    api.post(endpoints.reviewModeration.reject(reviewId), data),

  hide:              (reviewId: string, data: HideReviewRequest): Promise<unknown> =>
    api.post(endpoints.reviewModeration.hide(reviewId), data),

  getStatusHistory:  (reviewId: string): Promise<ReviewStatusHistoryResponse[]> =>
    api.get(endpoints.reviewModeration.statusHistory(reviewId)),

  // ── Client review submission (used in Wave 7) ──
  createReview:      (data: CreateReviewRequest): Promise<unknown> =>
    api.post(endpoints.clientReviews.create, data),

  updateReview:      (reviewId: string, data: UpdatePendingReviewRequest): Promise<unknown> =>
    api.put(endpoints.clientReviews.update(reviewId), data),

  getByBooking:      (bookingId: string): Promise<unknown> =>
    api.get(endpoints.clientReviews.byBooking(bookingId)),
}
```

---

### Section 12 — Acceptance Criteria

- [ ] `ReviewStatus`: 'Pending' | 'Published' | 'Rejected' | 'Hidden' (PascalCase)
- [ ] `PublishedReviewListItemResponse` and `UnitPublishedReviewSummaryResponse` match documented public review endpoints
- [ ] Internal/admin moderation list remains Backend Gap until documented endpoint shape is provided
- [ ] `CreateReviewRequest.title` is required
- [ ] `reject` and `hide` use optional `notes`
- [ ] No `any` types, no mock data

---

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TICKET ID: FE-5-REV-02
TITLE: Build Reviews moderation list page
WAVE: Wave 5
DOMAIN: Reviews
PRIORITY: Critical
DEPENDS ON: FE-5-REV-01, FE-2-ADMIN-01
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section 1 — Walkthrough

**What is this ticket about?**
The reviews moderation page at `/admin/reviews` lets SuperAdmin view and manage client reviews. The primary workflow is: browse pending reviews → publish or reject them. Enriched moderation list data is a backend gap until an internal list endpoint is documented.

**⚠️ Architecture Note:** This ticket is blocked on backend support for an internal reviews list endpoint. Keep the gap documented and avoid fallback assumptions.

---

### Section 2 — Objective

Build the Reviews moderation page at `/admin/reviews` with explicit backend-gap handling for the moderation list data source, while keeping moderation actions guarded by `canModerateReviews`.

---

### Section 4 — In Scope

- [ ] `app/(admin)/reviews/page.tsx`
- [ ] **Unit selector:** Combobox to pick a unit (from `GET /api/internal/units`)
- [ ] **Backend gap:** enriched moderation list endpoint/shape is not documented; do not assume public list can replace internal moderation list
- [ ] Table columns must be based on documented moderation-list contract once backend provides it
- [ ] Status filter: All / Pending / Published / Rejected / Hidden
- [ ] Actions per row:
  - `Pending` → "Publish" + "Reject"
  - `Published` → "Hide"
  - `Rejected` or `Hidden` → "Publish" (reinstate)
- [ ] Each row links to review detail (FE-5-REV-04)
- [ ] Rating displayed as 5-star visual (★★★★☆)
- [ ] Guard: `canModerateReviews`

**Files to create:**
- `app/(admin)/reviews/page.tsx`
- `components/admin/reviews/ReviewTable.tsx`
- `components/admin/reviews/StarRating.tsx`

---

### Section 6 — Technical Contract

```typescript
// StarRating component:
interface StarRatingProps {
  rating:   number    // 1-5
  size?:    'sm' | 'md'
  readOnly: true      // always read-only in admin context
}
```

#### 6d. Key Enums / Constants Used

```typescript
// From lib/constants/review-statuses.ts (created in Wave 0 fix):
REVIEW_STATUSES        // { pending: 'Pending', published: 'Published', ... }
REVIEW_STATUS_LABELS   // { Pending: 'Pending Review', Published: 'Published', ... }

// Status → badge variant mapping:
const REVIEW_STATUS_BADGE: Record<ReviewStatus, BadgeVariant> = {
  Pending:   'warning',
  Published: 'success',
  Rejected:  'danger',
  Hidden:    'neutral',
}
```

---

### Section 7 — API Integration

| Method | Endpoint | Query | Response | When |
|---|---|---|---|---|
| GET | `/api/internal/units` | `{ pageSize: 100 }` | `PaginatedUnits` | on mount (for unit selector) |

**⚠️ Note:** Public reviews endpoint returns PUBLISHED reviews only and is not a replacement for moderation list data. Keep moderation list as a backend gap requiring documented internal list support.

```typescript
// Query key:
queryKeys.reviews.moderationList(unitId)

// staleTime: 1000 * 60 * 2  (2 minutes)
```

---

### Section 10 — UX & Loading State Rules

| State | Required? | Behavior |
|---|---|---|
| No unit selected | ✓ REQUIRED | "Select a unit to view its reviews" prompt |
| Loading reviews | ✓ REQUIRED | `<SkeletonTable rows={5}>` |
| No reviews for unit | ✓ REQUIRED | `<EmptyState title="No reviews for this unit yet">` |
| Empty after filter | ✓ REQUIRED | `<EmptyState title="No reviews match this status">` |

---

### Section 12 — Acceptance Criteria

- [ ] Unit selector uses real units from API (no hardcoded units)
- [ ] Reviews loaded after unit selection
- [ ] `ReviewStatus` badges use correct variants from `REVIEW_STATUS_BADGE` map
- [ ] Rating displayed as star visual (not just "4/5")
- [ ] `canModerateReviews` gates entire page
- [ ] Action buttons shown based on current review status
- [ ] No mock data

---

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TICKET ID: FE-5-REV-03
TITLE: Build Review moderation actions
WAVE: Wave 5
DOMAIN: Reviews
PRIORITY: Critical
DEPENDS ON: FE-5-REV-02, FE-1-UI-04
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section 1 — Walkthrough

**What is this ticket about?**
Three moderation actions: Publish (makes review visible to public), Reject (marks as rejected), and Hide (temporarily hides a published review). Each action has a dialog and triggers the appropriate API endpoint.

**Business rule from PRD:** Admin can hide inappropriate reviews. SuperAdmin only.

---

### Section 4 — In Scope

- [ ] `components/admin/reviews/ModerationActions.tsx` — action buttons (Publish / Reject / Hide / Reinstate)
- [ ] `components/admin/reviews/PublishReviewDialog.tsx` — optional notes
- [ ] `components/admin/reviews/RejectReviewDialog.tsx` — optional notes
- [ ] `components/admin/reviews/HideReviewDialog.tsx` — optional notes
- [ ] All three: `<ConfirmDialog>` pattern with appropriate fields

---

### Section 6 — Technical Contract

```typescript
// Moderation dialog props:
interface PublishReviewDialogProps {
  isOpen:    boolean
  onClose:   () => void
  onConfirm: (notes?: string) => void
  isLoading: boolean
}

interface RejectReviewDialogProps {
  isOpen:    boolean
  onClose:   () => void
  onConfirm: (data: RejectReviewRequest) => void
  isLoading: boolean
}
// Same pattern for HideReviewDialog
```

---

### Section 7 — API Integration

| Method | Endpoint | Request | Response | When |
|---|---|---|---|---|
| POST | `/api/internal/reviews/{reviewId}/publish` | `PublishReviewRequest` | `ReviewResponse` | on Publish confirm |
| POST | `/api/internal/reviews/{reviewId}/reject` | `RejectReviewRequest` | `ReviewResponse` | on Reject confirm |
| POST | `/api/internal/reviews/{reviewId}/hide` | `HideReviewRequest` | `ReviewResponse` | on Hide confirm |

**CRITICAL:**
```typescript
// RejectReviewRequest: notes optional
interface RejectReviewRequest {
  notes?: string
}

// HideReviewRequest: notes optional
interface HideReviewRequest {
  notes?: string
}

// PublishReviewRequest: no required fields
interface PublishReviewRequest {
  notes?: string
}
```

#### 7d. Mutation Side Effects

```typescript
// After any moderation action:
toastSuccess('Review [published/rejected/hidden]')
queryClient.invalidateQueries({ queryKey: queryKeys.reviews.publicByUnit(unitId) })
queryClient.invalidateQueries({ queryKey: queryKeys.reviews.statusHistory(reviewId) })
closeDialog()
```

---

### Section 12 — Acceptance Criteria

- [ ] Publish dialog: optional notes only
- [ ] Reject dialog supports optional `notes`
- [ ] Hide dialog supports optional `notes`
- [ ] Each action properly mapped to correct API endpoint
- [ ] Both queries invalidated after action (unit reviews + review status history)
- [ ] `canModerateReviews` gates all action buttons
- [ ] No mock data

---

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TICKET ID: FE-5-REV-04
TITLE: Build Review detail view + status history
WAVE: Wave 5
DOMAIN: Reviews
PRIORITY: High
DEPENDS ON: FE-5-REV-01, FE-5-REV-03
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section 1 — Walkthrough

**What is this ticket about?**
Clicking a review in the moderation list opens a detail view (slide-over or modal) showing the full review content, the client's identity, the unit it refers to, the current status, owner reply (if any), and the full audit trail of status changes.

---

### Section 4 — In Scope

- [ ] `components/admin/reviews/ReviewDetailDrawer.tsx` — slide-over panel (not a full page)
- [ ] Content:
  - Client name + unit name + rating (stars) + title + full comment
  - Current status badge + `isVisible` indicator
  - Owner reply (if `ownerReplyText` is set) — read-only in admin view
  - Moderation actions (reuse `<ModerationActions>` from FE-5-REV-03)
  - Status history timeline (from `GET /api/internal/reviews/{reviewId}/status-history`)
- [ ] Drawer opens from review table row click

**Files to create:**
- `components/admin/reviews/ReviewDetailDrawer.tsx`
- `components/admin/reviews/ReviewStatusHistory.tsx`

---

### Section 7 — API Integration

| Method | Endpoint | Response | When |
|---|---|---|---|
| GET | `/api/internal/reviews/{reviewId}/status-history` | `ReviewStatusHistoryResponse[]` | on drawer open |

```typescript
export function useReviewStatusHistory(reviewId: string) {
  return useQuery({
    queryKey: queryKeys.reviews.statusHistory(reviewId),
    queryFn:  () => reviewsService.getStatusHistory(reviewId),
    staleTime: 1000 * 60 * 5,
  })
}
```

---

### Section 12 — Acceptance Criteria

- [ ] Full review content shown (title + comment + rating stars)
- [ ] Owner reply shown if `ownerReplyText !== null`
- [ ] Status history timeline rendered newest-first
- [ ] Moderation actions embedded in drawer
- [ ] `reviewId` used (not `id`)
- [ ] No mock data

---

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TICKET ID: FE-5-NOT-01
TITLE: Create Notifications service + TypeScript types
WAVE: Wave 5
DOMAIN: Notifications
PRIORITY: Critical
DEPENDS ON: FE-0-INFRA-03, FE-0-INFRA-04
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section 1 — Walkthrough

**What is this ticket about?**
The notification system covers 3 audiences (admin, owner, client), each with their own inbox. This ticket creates all type definitions and service functions for the notification domain — covering inbox, preferences, and dispatch.

---

### Section 4 — In Scope

- [ ] `lib/types/notification.types.ts`
- [ ] `lib/api/services/notifications.service.ts`
- [ ] `lib/hooks/useNotifications.ts`

---

### Section 6 — Technical Contract

```typescript
// lib/types/notification.types.ts
// From KAZA_BOOKING_API_Reference.md

type NotificationChannel = 'Email' | 'SMS' | 'InApp'   // PascalCase — 'InApp' not 'in_app'

// ── Notification inbox item ──
interface NotificationListItemResponse {
  notificationId: string
  channel:        NotificationChannel
  notificationStatus: string
  subject:        string
  body:           string
  createdAt:      string
  sentAt:         string | null
  readAt:         string | null
}

// ── Inbox summary (for bell badge count) ──
interface NotificationRecipientInboxSummaryResponse {
  unreadCount: number
  totalCount:  number
}

// ── Notification preference ──
interface NotificationPreferenceResponse {
  channel:   NotificationChannel
  preferenceKey: string
  isEnabled: boolean
}

interface UpsertNotificationPreferenceRequest {
  channel:   NotificationChannel
  preferenceKey: string
  isEnabled: boolean
}

// ── Admin dispatch requests ──
interface CreateAdminNotificationRequest {
  templateCode: string
  channel: NotificationChannel
  variables?: Record<string, string>
  scheduledAt?: string
}

interface CreateClientNotificationRequest {
  templateCode: string
  channel: NotificationChannel
  variables?: Record<string, string>
  scheduledAt?: string
}

interface CreateOwnerNotificationRequest {
  templateCode: string
  channel: NotificationChannel
  variables?: Record<string, string>
  scheduledAt?: string
}
```

```typescript
// lib/api/services/notifications.service.ts
export const notificationsService = {
  // ── Admin inbox ──
  getAdminInbox:      (): Promise<NotificationListItemResponse[]> =>
    api.get(endpoints.notifications.admin.inbox),

  getAdminSummary:    (): Promise<NotificationRecipientInboxSummaryResponse> =>
    api.get(endpoints.notifications.admin.summary),

  markAdminRead:      (id: string): Promise<void> =>
    api.post(endpoints.notifications.admin.read(id)),

  // ── Admin preferences ──
  getAdminPreferences:    (): Promise<NotificationPreferenceResponse[]> =>
    api.get(endpoints.notificationPreferences.adminGet),

  updateAdminPreferences: (data: UpsertNotificationPreferenceRequest): Promise<NotificationPreferenceResponse> =>
    api.put(endpoints.notificationPreferences.adminUpdate, data),

  // ── Dispatch (admin sends to users) ──
  sendToAdmin:   (adminUserId: string, data: CreateAdminNotificationRequest): Promise<void> =>
    api.post(endpoints.internalNotifications.toAdmin(adminUserId), data),

  sendToClient:  (clientId: string, data: CreateClientNotificationRequest): Promise<void> =>
    api.post(endpoints.internalNotifications.toClient(clientId), data),

  sendToOwner:   (ownerId: string, data: CreateOwnerNotificationRequest): Promise<void> =>
    api.post(endpoints.internalNotifications.toOwner(ownerId), data),

  // ── Owner inbox (for Wave 6 Owner Portal) ──
  getOwnerInbox:      (): Promise<NotificationListItemResponse[]> =>
    api.get(endpoints.notifications.owner.inbox),

  getOwnerSummary:    (): Promise<NotificationRecipientInboxSummaryResponse> =>
    api.get(endpoints.notifications.owner.summary),

  markOwnerRead:      (id: string): Promise<void> =>
    api.post(endpoints.notifications.owner.read(id)),

  // ── Client inbox (for Wave 7 Guest App) ──
  getClientInbox:     (): Promise<NotificationListItemResponse[]> =>
    api.get(endpoints.notifications.client.inbox),

  getClientSummary:   (): Promise<NotificationRecipientInboxSummaryResponse> =>
    api.get(endpoints.notifications.client.summary),

  markClientRead:     (id: string): Promise<void> =>
    api.post(endpoints.notifications.client.read(id)),
}
```

**NOTE — Endpoints file needs update for dispatch:**
```typescript
// Add to lib/api/endpoints.ts under a new group:
internalNotifications: {
  toAdmin:  (adminUserId: string) => `/api/internal/notifications/admins/${adminUserId}`,
  toClient: (clientId: string)    => `/api/internal/notifications/clients/${clientId}`,
  toOwner:  (ownerId: string)     => `/api/internal/notifications/owners/${ownerId}`,
},
```

---

### Section 12 — Acceptance Criteria

- [ ] `NotificationChannel`: 'Email' | 'SMS' | 'InApp' (NOT 'in_app')
- [ ] `NotificationListItemResponse` has `notificationId` (not `id`)
- [ ] All 3 inbox endpoints (admin/owner/client) covered
- [ ] Dispatch endpoints for all 3 recipient types
- [ ] `internalNotifications` group added to `endpoints.ts`
- [ ] No `any` types, no mock data

---

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TICKET ID: FE-5-NOT-02
TITLE: Build notification bell (admin header)
WAVE: Wave 5
DOMAIN: Notifications
PRIORITY: Critical
DEPENDS ON: FE-5-NOT-01, FE-2-ADMIN-01 (AdminHeader)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section 1 — Walkthrough

**What is this ticket about?**
The admin header (built in FE-2-ADMIN-01) has a placeholder notification bell. This ticket makes it real: an animated bell icon with a red unread count badge that polls for new notifications. Clicking opens the inbox.

---

### Section 2 — Objective

Build the `<NotificationBell>` component for the admin header that shows the unread notification count and navigates to the inbox on click — using `GET /api/internal/me/notifications/inbox/summary`.

---

### Section 4 — In Scope

- [ ] `components/admin/layout/NotificationBell.tsx`
- [ ] `GET /api/internal/me/notifications/inbox/summary` → `{ unreadCount, totalCount }`
- [ ] Shows bell icon (`<Bell>` from lucide-react) with:
  - Red badge with `unreadCount` when > 0
  - Badge shows "9+" when count > 9
  - Pulsing animation on new notifications (`animate-pulse` on badge)
- [ ] Click → navigates to `ROUTES.admin.notifications`
- [ ] Polling: `refetchInterval: 1000 * 60 * 2` (every 2 minutes)

**Files to create:**
- `components/admin/layout/NotificationBell.tsx`

**Files to modify:**
- `components/admin/layout/AdminHeader.tsx` — add `<NotificationBell>` to header

---

### Section 6 — Technical Contract

```typescript
interface NotificationBellProps {
  // No props — fetches own data
}
```

```typescript
// Hook:
export function useAdminNotificationSummary() {
  return useQuery({
    queryKey:        queryKeys.notifications.adminInboxSummary(),
    queryFn:         () => notificationsService.getAdminSummary(),
    refetchInterval: 1000 * 60 * 2,   // poll every 2 minutes
    staleTime:       0,                // always fresh
  })
}
```

---

### Section 10 — UX & Loading State Rules

| State | Required? | Behavior |
|---|---|---|
| Loading | ✓ | Bell icon shows, badge hidden (not 0 — just hidden during load) |
| unreadCount = 0 | ✓ | Bell shows, no badge |
| unreadCount > 0 | ✓ | Red badge with count |
| unreadCount > 9 | ✓ | Badge shows "9+" |

---

### Section 12 — Acceptance Criteria

- [ ] `GET /api/internal/me/notifications/inbox/summary` polled every 2 minutes
- [ ] `staleTime: 0` — always fetch fresh count
- [ ] Badge shows "9+" when `unreadCount > 9`
- [ ] Bell navigates to admin notifications page on click
- [ ] No hardcoded unread count
- [ ] No mock data

---

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TICKET ID: FE-5-NOT-03
TITLE: Build admin notification inbox page
WAVE: Wave 5
DOMAIN: Notifications
PRIORITY: High
DEPENDS ON: FE-5-NOT-01, FE-5-NOT-02, FE-2-ADMIN-01
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section 1 — Walkthrough

**What is this ticket about?**
The admin notification inbox at `/admin/notifications` lists all notifications received by the current admin user, with read/unread state. Clicking a notification marks it as read and (if applicable) navigates to the relevant entity.

---

### Section 4 — In Scope

- [ ] `app/(admin)/notifications/page.tsx`
- [ ] `GET /api/internal/me/notifications/inbox`
- [ ] List: each notification shows: title, body (truncated), channel badge, timestamp, read/unread indicator
- [ ] Click notification → `POST /api/internal/me/notifications/inbox/{notificationId}/read` → mark read → update bell count
- [ ] "Mark all as read" button — iterates through unread notifications (no bulk endpoint — call individually)
- [ ] Channel badges: Email / SMS / InApp (using `NOTIFICATION_CHANNEL_LABELS`)
- [ ] Unread notifications: bold + highlighted background
- [ ] Add `/admin/notifications` to `ROUTES` constants

**Files to create:**
- `app/(admin)/notifications/page.tsx`
- `components/admin/notifications/NotificationItem.tsx`

**Files to modify:**
- `lib/constants/routes.ts` — add `admin.notifications`
- `components/admin/layout/AdminNav.tsx` — add Notifications nav item (with bell icon + count)

---

### Section 7 — API Integration

| Method | Endpoint | Response | When |
|---|---|---|---|
| GET | `/api/internal/me/notifications/inbox` | `NotificationListItemResponse[]` | on page mount |
| POST | `/api/internal/me/notifications/inbox/{notificationId}/read` | void | on click |

```typescript
export function useAdminInbox() {
  return useQuery({
    queryKey: queryKeys.notifications.adminInbox(),
    queryFn:  () => notificationsService.getAdminInbox(),
    staleTime: 0,
  })
}
```

#### 7d. Mutation Side Effects

```typescript
// After mark read:
queryClient.invalidateQueries({ queryKey: queryKeys.notifications.adminInbox() })
queryClient.invalidateQueries({ queryKey: queryKeys.notifications.adminInboxSummary() })
// ↑ This updates the bell count automatically
```

---

### Section 12 — Acceptance Criteria

- [ ] `notificationId` used (not `id`) in mark-read API call
- [ ] Mark read invalidates BOTH inbox query AND summary query (bell count updates)
- [ ] `NotificationChannel` badge uses `NOTIFICATION_CHANNEL_LABELS`: 'InApp' → "In-app"
- [ ] Unread: bold + subtle highlight
- [ ] Read: normal weight + white background
- [ ] "Mark all as read" iterates and marks individually
- [ ] No mock data

---

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TICKET ID: FE-5-NOT-04
TITLE: Build notification preferences settings
WAVE: Wave 5
DOMAIN: Notifications
PRIORITY: High
DEPENDS ON: FE-5-NOT-01, FE-2-ADMIN-01
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section 1 — Walkthrough

**What is this ticket about?**
Each admin user can control which notifications they receive and via which channel. This settings section lets them toggle their preferences per notification type (BookingConfirmed, CheckInReminder, etc.) per channel (Email/SMS/InApp).

---

### Section 4 — In Scope

- [ ] Add Notification Preferences section to `/admin/settings` page
- [ ] `GET /api/internal/me/notification-preferences` — list current preferences
- [ ] `PUT /api/internal/me/notification-preferences` — update a preference
- [ ] Display: table of notification types (rows) × channels (columns) with toggle switches
- [ ] Each cell: on/off toggle → calls `PUT` with `{ channel, type, isEnabled }`

**Files to create:**
- `components/admin/settings/NotificationPreferencesSection.tsx`

---

### Section 7 — API Integration

| Method | Endpoint | Request | Response | When |
|---|---|---|---|---|
| GET | `/api/internal/me/notification-preferences` | — | `NotificationPreferenceResponse[]` | on mount |
| PUT | `/api/internal/me/notification-preferences` | `UpsertNotificationPreferenceRequest` | `NotificationPreferenceResponse` | on toggle |

```typescript
// UpsertNotificationPreferenceRequest:
interface UpsertNotificationPreferenceRequest {
  channel:   NotificationChannel   // 'Email' | 'SMS' | 'InApp'
  preferenceKey: string
  isEnabled: boolean
}
```

---

### Section 12 — Acceptance Criteria

- [ ] Channel values sent as PascalCase: 'Email', 'SMS', 'InApp'
- [ ] Toggle immediately updates via PUT (no batch save button)
- [ ] Loading state: toggle disabled while mutation is in flight
- [ ] Query invalidated after update
- [ ] No mock data

---

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TICKET ID: FE-5-NOT-05
TITLE: Build admin notification dispatch UI
WAVE: Wave 5
DOMAIN: Notifications
PRIORITY: Medium
DEPENDS ON: FE-5-NOT-01, FE-2-ADMIN-01
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section 1 — Walkthrough

**What is this ticket about?**
SuperAdmin can manually send a notification to a specific admin user, client, or owner. This is a power-user tool for triggering template-based notifications. The dispatch UI should collect recipient + channel + template data that matches API contracts.

---

### Section 4 — In Scope

- [ ] `components/admin/notifications/DispatchNotificationModal.tsx`
- [ ] Accessible from notifications page via "Send Notification" button
- [ ] Form fields:
  - `recipientType` — Select: Admin User / Client / Owner
  - `recipientId` — Combobox (loads relevant list based on type)
  - `templateCode` — Input, required
  - `variables` — key/value map, optional
  - `scheduledAt` — datetime, optional
  - `channel` — Select: Email / InApp (SMS excluded — deferred per business decision #15 in PRD)
- [ ] Submit → calls appropriate endpoint based on `recipientType`
- [ ] Guard: `canManageAdminUsers` (SuperAdmin only for dispatch)

**Files to create:**
- `components/admin/notifications/DispatchNotificationModal.tsx`

---

### Section 6 — Technical Contract

```typescript
const dispatchSchema = z.object({
  recipientType: z.enum(['Admin', 'Client', 'Owner']),
  recipientId:   z.string().min(1, 'Recipient is required'),
  templateCode:  z.string().min(1, 'Template code is required'),
  variables:     z.record(z.string()).optional(),
  scheduledAt:   z.string().optional(),
  channel:       z.enum(['Email', 'InApp']),   // SMS excluded (deferred)
})
```

---

### Section 7 — API Integration

| Method | Endpoint | Request | When |
|---|---|---|---|
| POST | `/api/internal/notifications/admins/{adminUserId}` | `CreateAdminNotificationRequest` | when recipientType = 'Admin' |
| POST | `/api/internal/notifications/clients/{clientId}` | `CreateClientNotificationRequest` | when recipientType = 'Client' |
| POST | `/api/internal/notifications/owners/{ownerId}` | `CreateOwnerNotificationRequest` | when recipientType = 'Owner' |

---

### Section 12 — Acceptance Criteria

- [ ] Correct endpoint called based on `recipientType`
- [ ] `channel` sent as PascalCase: 'Email' or 'InApp' (not 'email' or 'in_app')
- [ ] Recipient Combobox loads real users from API based on type
- [ ] SMS option not available (excluded per PRD decision #15)
- [ ] No mock data

---

---

# Wave 5 — QA Prompt

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WAVE QA REVIEW PROMPT
Wave: 5 — Dashboard Analytics + Reviews + Notifications
Tickets: FE-5-DASH-01..03, FE-5-REV-01..04, FE-5-NOT-01..05
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You are a senior QA engineer reviewing Wave 5.

## MOCK DATA AUDIT — HARD GATE

```bash
# Chart data:
grep -rn "const chartData = \[\|const mockCharts\|sampleRevenue" \
  --include="*.ts" --include="*.tsx" components/admin/dashboard/

# Review data:
grep -rn "mockReview\|fakeReview\|sampleReview\|rating.*5\|rating.*4" \
  --include="*.ts" --include="*.tsx" components/admin/reviews/
# ↑ Hardcoded rating values only in constants/config, not in component logic

# Notification data:
grep -rn "mockNotif\|fakeNotif\|unreadCount.*42\|title.*test" \
  --include="*.ts" --include="*.tsx" components/admin/notifications/

# Enum case violations:
grep -rn "'in_app'\|'sms'\|'email'" \
  --include="*.ts" --include="*.tsx" lib/api/services/notifications.service.ts components/
# Must be 'InApp', 'SMS', 'Email'

grep -rn "'pending'\|'published'\|'rejected'\|'hidden'" \
  --include="*.ts" --include="*.tsx" components/admin/reviews/ lib/
# Review statuses must be PascalCase
```

## API CONTRACT VERIFICATION

### Dashboard Charts:
- [ ] Recharts loaded via `dynamic({ ssr: false })` — NOT regular import
- [ ] Chart data from real API (daily reports endpoints)
- [ ] `formatCurrency()` in tooltip, not raw numbers
- [ ] Design system colors used (`var(--color-primary-500)`) not hardcoded hex

### Reviews:
- [ ] `ReviewStatus`: 'Pending' | 'Published' | 'Rejected' | 'Hidden' (PascalCase)
- [ ] `ReviewResponse.reviewId` used (not `.id`)
- [ ] `ReviewResponse.reviewStatus` used (not `.status`)
- [ ] `ReviewResponse.title` field present (reviews have a title!)
- [ ] Reject and Hide: optional `notes` field in request
- [ ] Publish: no required fields
- [ ] Status history: `GET /api/internal/reviews/{reviewId}/status-history`

### Notifications:
- [ ] `NotificationChannel`: 'Email' | 'SMS' | 'InApp' ('InApp' not 'in_app')
- [ ] `NotificationListItemResponse.notificationId` used (not `.id`)
- [ ] Bell polls every 2 minutes (`refetchInterval: 120000`)
- [ ] Bell: `staleTime: 0` (always fresh)
- [ ] Mark-read invalidates BOTH inbox AND summary queries
- [ ] `unreadCount > 9` → shows "9+"
- [ ] Dispatch: `channel` sent as PascalCase
- [ ] SMS channel NOT available in dispatch UI (deferred per PRD)
- [ ] Notification preferences `channel` sent as PascalCase

## PER-TICKET CHECKS

### FE-5-DASH-01 — Charts
- [ ] Both charts dynamic() with ssr: false
- [ ] Default range: last 30 days using date-fns
- [ ] Skeleton shown while loading

### FE-5-DASH-02 — Analytics Page
- [ ] `canViewReports` gates the page
- [ ] Date range picker works

### FE-5-DASH-03 — Widgets
- [ ] Occupancy rate computed from real data

### FE-5-REV-01 — Review Types
- [ ] `CreateReviewRequest.title` is required
- [ ] Reject/Hide use optional `notes` in type definition

### FE-5-REV-02 — Review List
- [ ] Unit selector loads from real API
- [ ] Stars display is visual (not "4/5" text)
- [ ] Status badge variants: Pending=warning, Published=success, Rejected=danger, Hidden=neutral

### FE-5-REV-03 — Moderation Actions
- [ ] Reject dialog allows empty notes
- [ ] Hide dialog allows empty notes
- [ ] Cache invalidated after each action

### FE-5-REV-04 — Review Detail
- [ ] `reviewId` used in status history call
- [ ] Owner reply shown if present

### FE-5-NOT-01 — Notification Types
- [ ] `NotificationChannel` = 'Email' | 'SMS' | 'InApp'
- [ ] `internalNotifications` endpoints added to endpoints.ts

### FE-5-NOT-02 — Bell
- [ ] Polling every 2 minutes
- [ ] "9+" for count > 9
- [ ] Badge hidden when loading (not showing 0)

### FE-5-NOT-03 — Inbox
- [ ] `notificationId` in mark-read URL
- [ ] Both inbox + summary invalidated after mark-read

### FE-5-NOT-04 — Preferences
- [ ] `channel` = 'InApp' (not 'in_app')
- [ ] Toggle fires immediately (no batch save)

### FE-5-NOT-05 — Dispatch
- [ ] Correct endpoint for each recipient type
- [ ] SMS not available
- [ ] `canManageAdminUsers` gate

## ARCHITECTURE CHECKS
- [ ] Recharts never imported at module level — dynamic() only
- [ ] No inline endpoint strings
- [ ] `pnpm type-check` → zero errors
- [ ] No mock data

## Wave 5 Sign-off Recommendation
[ ] APPROVED — Admin Panel 100% complete.
[ ] CONDITIONAL — conditions: ...
[ ] BLOCKED — blockers: ...
```

---

---

# Wave 5 — PM Sign-off Checklist

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PM WAVE SIGN-OFF CHECKLIST
Wave: 5 — Dashboard Analytics + Reviews + Notifications
Date: _______________
Reviewed by: _______________
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### A. QA Report Review
- [ ] QA report received, all BLOCKERs resolved
- [ ] MOCK DATA AUDIT PASSED

### B. Business Requirements Validation

| Scenario | Tested | Pass/Fail |
|---|---|---|
| Dashboard shows 30-day revenue line chart from real data | | |
| SuperAdmin navigates to /admin/analytics with date range filter | | |
| SuperAdmin views reviews for a unit → sees Pending reviews | | |
| SuperAdmin publishes a Pending review → status → Published | | |
| SuperAdmin rejects a review with reason | | |
| SuperAdmin hides a Published review with reason | | |
| Admin bell shows unread count (waits 2 min for poll) | | |
| Admin opens inbox, clicks notification → marked as read, bell count decreases | | |
| Admin toggles InApp preference off | | |
| SuperAdmin sends InApp notification to a client | | |

### C. MILESTONE: Admin Panel Complete
After Wave 5, the Admin Panel is 100% feature-complete. Verify:

- [ ] **CRM Pipeline:** Leads → status transitions → convert to booking ✓
- [ ] **Bookings:** Full lifecycle + payments + invoices ✓
- [ ] **Finance:** Overview + payouts + payments + reports ✓
- [ ] **Units:** Full property management + images + dates + pricing ✓
- [ ] **Owners:** CRUD + earnings + payouts ✓
- [ ] **Clients:** List + detail + booking history ✓
- [ ] **Reviews:** Moderation complete ✓
- [ ] **Notifications:** Bell + inbox + preferences + dispatch ✓
- [ ] **Analytics:** Charts + standalone analytics page ✓

**Admin Panel milestone sign-off:** ✅ / ❌

### D. Definition of Done
- [ ] `pnpm type-check` clean
- [ ] `pnpm lint` clean
- [ ] All 12 tickets merged
- [ ] Review statuses PascalCase
- [ ] Notification channels PascalCase ('InApp' not 'in_app')
- [ ] Charts loaded via dynamic() (no SSR)
- [ ] Bell polling: every 2 minutes

### E. Next Wave Readiness (Wave 6 — Owner Portal)
- [ ] Notifications service covers owner inbox endpoints (built in FE-5-NOT-01)
- [ ] Reviews service covers owner reply endpoints stub (Wave 6 builds the UI)
- [ ] Auth system (Wave 1) covers owner login flow

### F. Mock Data Final Audit
```bash
grep -rn "faker\|json-server\|mockChart\|mockReview\|mockNotif" \
  --include="*.ts" --include="*.tsx" .
grep -rn "'in_app'\|'pending'\|'published'\|'rejected'\|'hidden'" \
  --include="*.ts" --include="*.tsx" components/admin/reviews/ components/admin/notifications/ lib/
```
- [ ] All zero results
- [ ] Audit by: ____________ Date: ____________

### G. Sign-off Decision
```
[ ] WAVE 5 APPROVED
    Admin Panel 100% complete. Wave 6 (Owner Portal) may begin.

[ ] WAVE 5 APPROVED WITH CONDITIONS
    Conditions: _______________

[ ] WAVE 5 NOT APPROVED
    Blockers: _______________
```
**Signed off by:** ______________ **Date:** ______________

---

# Wave 5 — Final Summary

| Track | # | Ticket | Key Deliverable |
|---|---|---|---|
| A | 1 | FE-5-DASH-01 | Revenue + bookings Recharts charts (dynamic, ssr:false) |
| A | 2 | FE-5-DASH-02 | Standalone /admin/analytics page with date range |
| A | 3 | FE-5-DASH-03 | Occupancy + top units widgets |
| B | 4 | FE-5-REV-01 | Reviews service + types (title required, PascalCase statuses) |
| B | 5 | FE-5-REV-02 | Review moderation list (unit selector approach) |
| B | 6 | FE-5-REV-03 | Moderation actions (reject/hide optional notes) |
| B | 7 | FE-5-REV-04 | Review detail drawer + status history |
| C | 8 | FE-5-NOT-01 | Notifications service + types ('InApp' not 'in_app') |
| C | 9 | FE-5-NOT-02 | Notification bell (polling 2min, 9+ count) |
| C | 10 | FE-5-NOT-03 | Admin inbox (mark read → invalidates bell) |
| C | 11 | FE-5-NOT-04 | Notification preferences (toggle fires immediately) |
| C | 12 | FE-5-NOT-05 | Dispatch notification (no SMS, SuperAdmin only) |

**Key Pitfalls Summary:**
- Recharts → always `dynamic({ ssr: false })`
- Review `notes` → optional for Reject and Hide (not Publish)
- `NotificationChannel` → 'InApp' (not 'in_app', not 'in-app')
- `notificationId` (not `id`) in mark-read calls
- Bell invalidates BOTH inbox query AND summary query

**🎉 MILESTONE: Admin Panel 100% Complete after Wave 5**

**Next Wave:** Wave 6 — Owner Portal (12 tickets).

*End of Wave 5 ticket pack.*
