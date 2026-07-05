# Wave 4 — Finance + Owners + Clients
## Rental Platform Frontend — Complete Ticket Pack
**Wave Number:** 4
**Wave Name:** Finance + Owners + Clients
**Total Tickets:** 16
**Estimated Days (1 dev):** 6
**Parallel Tracks:** 3 — Finance (Track A), Owners (Track B), Clients + Admin Users (Track C)

---

## Wave 4 Overview

**Track A — Finance (FE-4-FIN-01 → 05):**
Finance admin views: overview of platform revenue, all payments list, owner payouts management (record, schedule, mark paid), and the daily analytics reports page.

**Track B — Owners (FE-4-OWN-01 → 06):**
Full owner management: list, create, detail, edit, status toggle, earnings view, payout history per owner.

**Track C — Clients + Admin Users (FE-4-CLI-01 → 05):**
Client profile management (read-heavy), client detail with booking history, admin users management (SuperAdmin only).

---

## ⛔ GLOBAL RULES

```
NO MOCK DATA — EVER.

Enum values (PascalCase):
PayoutStatus:  'Pending' | 'Scheduled' | 'Paid' | 'Cancelled'
PaymentMethod: 'InstaPay' | 'VodafoneCash' | 'Cash' | 'BankTransfer'
AdminRole:     'SuperAdmin' | 'Sales' | 'Finance' | 'Tech'

Owner status:  'active' | 'inactive'  (lowercase — confirm with API)
CommissionRate: stored as percentage (e.g., 20.00 = 20%) — display as percentage

Pagination: totalCount + totalPages (not total)
```

---

## Ticket List

| # | Ticket ID | Title | Track | Priority |
|---|-----------|-------|-------|----------|
| 1 | FE-4-FIN-01 | Create Finance service layer + types | A | Critical |
| 2 | FE-4-FIN-02 | Build Finance overview page | A | Critical |
| 3 | FE-4-FIN-03 | Build Owner Payouts management | A | Critical |
| 4 | FE-4-FIN-04 | Build Payments list (all platform payments) | A | High |
| 5 | FE-4-FIN-05 | Build Finance reports page | A | High |
| 6 | FE-4-OWN-01 | Create Owners service layer + types | B | Critical |
| 7 | FE-4-OWN-02 | Build Owners list page | B | Critical |
| 8 | FE-4-OWN-03 | Build Create Owner form | B | Critical |
| 9 | FE-4-OWN-04 | Build Owner Detail page | B | Critical |
| 10 | FE-4-OWN-05 | Build Edit Owner + Status toggle | B | High |
| 11 | FE-4-OWN-06 | Build Owner Payout Summary panel | B | High |
| 12 | FE-4-CLI-01 | Create Clients service layer + types | C | Critical |
| 13 | FE-4-CLI-02 | Build Clients list page | C | Critical |
| 14 | FE-4-CLI-03 | Build Client Detail page | C | High |
| 15 | FE-4-ADM-01 | Build Admin Users management page | C | High |
| 16 | FE-4-ADM-02 | Build Create Admin User + Role management | C | High |

---

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TICKET ID: FE-4-FIN-01
TITLE: Create Finance service layer + TypeScript types
WAVE: Wave 4 — Finance + Owners + Clients
DOMAIN: Finance
PRIORITY: Critical
DEPENDS ON: FE-0-INFRA-03, FE-0-INFRA-04
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section 1 — Walkthrough

**What is this ticket about?**
All 5 Finance tickets depend on typed API contracts covering owner payouts (the primary Finance workflow), payments list, and finance reporting. This ticket creates the service layer and all type definitions upfront.

---

### Section 4 — In Scope

- [ ] `lib/types/finance.types.ts` — payout, payment method, finance summary types
- [ ] Extend `lib/api/services/bookings.service.ts` with payment queries if not already done
- [ ] Create `lib/api/services/payouts.service.ts` — owner payout CRUD + lifecycle

**Files to create:**
- `lib/types/finance.types.ts`
- `lib/api/services/payouts.service.ts`
- `lib/hooks/usePayouts.ts`

**Files to modify:**
- `lib/types/index.ts`

---

### Section 6 — Technical Contract

```typescript
// lib/types/finance.types.ts
// From KAZA_BOOKING_API_Reference.md

type PayoutStatus  = 'Pending' | 'Scheduled' | 'Paid' | 'Cancelled'
type PaymentMethod = 'InstaPay' | 'VodafoneCash' | 'Cash' | 'BankTransfer'

// ── Owner Payout ──
interface OwnerPayoutResponse {
  id:             string
  bookingId:      string
  ownerId:        string
  payoutStatus:   PayoutStatus
  grossBookingAmount: number
  commissionRate:     number
  commissionAmount:   number
  payoutAmount:       number
  scheduledAt:    string | null
  paidAt:         string | null
  notes:          string | null
  createdAt:      string
  updatedAt:      string
}

interface CreateOwnerPayoutRequest {
  bookingId:      string
  commissionRate: number   // 0..100 percentage
  notes?:        string
}

interface SetOwnerPayoutScheduledRequest {
  notes?: string
}

interface MarkOwnerPayoutPaidRequest {
  notes?:        string
}

interface CancelOwnerPayoutRequest {
  notes?: string
}

// ── Owner Payout Summary ──
interface OwnerPayoutSummaryResponse {
  ownerId:        string
  totalPending:   number
  totalScheduled: number
  totalPaid:      number
}

// ── Finance Reporting (from Wave 2 reports service) ──
// Already defined in report.types.ts — import from there
// FinanceAnalyticsSummaryResponse, BookingAnalyticsSummaryResponse
// FinanceAnalyticsDailySummaryResponse — daily breakdown:
interface FinanceAnalyticsDailySummaryResponse {
  date:                    string
  totalRevenue:            number
  depositsCollected:       number
  remainingCollected:      number
  refunds:                 number
  numberOfConfirmedBookings: number
}

// ── Payments List ──
// PaymentResponse already defined in booking.types.ts
// Reuse from there

interface PaymentListFilters {
  bookingId?:     string
  invoiceId?:     string
  paymentStatus?: PaymentStatus
  page?:          number
  pageSize?:      number
}

interface PaginatedPayments {
  items:      PaymentResponse[]
  pagination: PaginationMeta
}
```

```typescript
// lib/api/services/payouts.service.ts
export const payoutsService = {
  // Get payouts for a specific owner
  getByOwner:    (ownerId: string): Promise<OwnerPayoutResponse[]> =>
    api.get(endpoints.ownerPayouts.byOwner(ownerId)),

  // Get payouts related to a specific booking
  getByBooking:  (bookingId: string): Promise<OwnerPayoutResponse[]> =>
    api.get(endpoints.ownerPayouts.byBooking(bookingId)),

  // Get payout summary for an owner
  getSummary:    (ownerId: string): Promise<OwnerPayoutSummaryResponse> =>
    api.get(endpoints.financeSummary.ownerPayoutSummary(ownerId)),

  // Create a new payout record
  create:        (data: CreateOwnerPayoutRequest): Promise<OwnerPayoutResponse> =>
    api.post(endpoints.ownerPayouts.create, data),

  // Schedule a payout (Pending → Scheduled)
  schedule:      (id: string, data: SetOwnerPayoutScheduledRequest): Promise<OwnerPayoutResponse> =>
    api.post(endpoints.ownerPayouts.schedule(id), data),

  // Mark payout as paid (Pending | Scheduled → Paid)
  markPaid:      (id: string, data: MarkOwnerPayoutPaidRequest): Promise<OwnerPayoutResponse> =>
    api.post(endpoints.ownerPayouts.markPaid(id), data),

  // Cancel a payout
  cancel:        (id: string, data: CancelOwnerPayoutRequest): Promise<OwnerPayoutResponse> =>
    api.post(endpoints.ownerPayouts.cancel(id), data),
}
```

---

### Section 12 — Acceptance Criteria

- [ ] `PayoutStatus`: 'Pending' | 'Scheduled' | 'Paid' | 'Cancelled' (PascalCase)
- [ ] `MarkOwnerPayoutPaidRequest` uses optional `notes` only
- [ ] `OwnerPayoutSummaryResponse` has `totalPending`, `totalScheduled`, `totalPaid`
- [ ] No `any` types, zero TypeScript errors, no mock data

---

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TICKET ID: FE-4-FIN-02
TITLE: Build Finance overview page
WAVE: Wave 4 — Finance + Owners + Clients
DOMAIN: Finance
PRIORITY: Critical
DEPENDS ON: FE-4-FIN-01, FE-2-ADMIN-02 (reports service), FE-2-ADMIN-01
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section 1 — Walkthrough

**What is this ticket about?**
The Finance overview at `/admin/finance` is the Finance team's primary dashboard. It shows revenue summary, payment breakdown by type, outstanding amounts across all bookings, and links to payouts and payments lists. Finance needs this to understand the platform's financial health at a glance.

---

### Section 2 — Objective

Build the Finance overview page at `/admin/finance` showing revenue summary, payment type breakdown, and quick links — using `GET /api/internal/reports/finance/summary` and the finance snapshot data.

---

### Section 4 — In Scope

- [ ] `app/(admin)/finance/page.tsx`
- [ ] **Revenue Summary section:** 6 stat cards (reuse `<StatCard>` from FE-2-ADMIN-02):
  - Total Revenue
  - Total Deposits Collected
  - Total Remaining Collected
  - Total Refunds
  - Total Owner Payouts
  - Platform Earnings (= Revenue − Owner Payouts)
- [ ] Date range filter (from/to) → re-fetches summary with new params
- [ ] **Quick Links section:**
  - "View All Payments" → `ROUTES.admin.finance` payments tab or sub-route
  - "Manage Owner Payouts" → `ROUTES.admin.finance` payouts tab
- [ ] Guard: `canViewFinance`

**Files to create:**
- `app/(admin)/finance/page.tsx`
- `components/admin/finance/FinanceSummaryCards.tsx`

---

### Section 6 — Technical Contract

```typescript
// Date range filter state:
interface FinanceDateFilter {
  startDate?: string   // ISO "2026-04-01"
  endDate?:   string   // ISO "2026-04-30"
}
```

---

### Section 7 — API Integration

| Method | Endpoint | Query | Response | When |
|---|---|---|---|---|
| GET | `/api/internal/reports/finance/summary` | `FinanceDateFilter` | `FinanceAnalyticsSummaryResponse` | on mount + filter change |

```typescript
// FinanceAnalyticsSummaryResponse (from report.types.ts):
{
  totalRevenue:            number
  totalDepositsCollected:  number
  totalRemainingCollected: number
  totalRefunds:            number
  totalOwnerPayouts:       number
  platformEarnings:        number
  totalBookings:           number
}
```

#### 7c. Query Configuration

```typescript
staleTime: 1000 * 60 * 5   // 5 minutes
```

---

### Section 10 — UX & Loading State Rules

| State | Required? | Behavior |
|---|---|---|
| Loading | ✓ | 6 StatCard skeletons |
| Empty filter range | ✓ | Show all-time data (no startDate/endDate) |
| Date filter | ✓ | Re-fetch on change, keepPreviousData |

---

### Section 12 — Acceptance Criteria

- [ ] 6 stat cards with correct field mapping from `FinanceAnalyticsSummaryResponse`
- [ ] `formatCurrency()` on all money values
- [ ] Date range filter re-fetches data
- [ ] `canViewFinance` gates the page
- [ ] No mock data

---

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TICKET ID: FE-4-FIN-03
TITLE: Build Owner Payouts management
WAVE: Wave 4 — Finance + Owners + Clients
DOMAIN: Finance
PRIORITY: Critical
DEPENDS ON: FE-4-FIN-01, FE-2-ADMIN-01, FE-1-UI-01..04, FE-1-UI-08
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section 1 — Walkthrough

**What is this ticket about?**
Owner payouts are the most important Finance workflow: the platform pays owners their earnings monthly (typically via Instapay or Vodafone Cash). Finance creates a payout record, optionally schedules it for a future date, marks it as paid when the transfer is done, and uploads proof. This ticket builds the full payout management UI.

**Payout workflow (lifecycle):**
`Pending` (created) → `Scheduled` (date set) → `Paid` (transfer confirmed) | `Cancelled`

---

### Section 2 — Objective

Build the Owner Payouts management at `/admin/finance/payouts` covering the full payout lifecycle: create, schedule, mark paid, cancel — with list view, filters by owner and status.

---

### Section 4 — In Scope

- [ ] `app/(admin)/finance/payouts/page.tsx`
- [ ] List of all owner payouts: `GET /api/internal/owner-payouts/by-booking/{id}` or by owner
  - **Note:** There's no `GET /api/internal/owner-payouts` (list all). Payouts are fetched by owner or by booking. Build a "by owner" view: select owner → see their payouts.
- [ ] Payout table columns: Owner, Amount, Method, Status badge, Scheduled Date, Payment Date, Actions
- [ ] Payout table columns: bookingId, ownerId, payoutAmount, commissionRate, status badge, scheduledAt, paidAt, actions
- [ ] **Actions per payout status:**
  - `Pending` → "Schedule" + "Mark Paid" + "Cancel"
  - `Scheduled` → "Mark Paid" + "Cancel"
  - `Paid` → show paidAt + notes
  - `Cancelled` → no actions
- [ ] **"New Payout" button** → modal form
- [ ] `components/admin/finance/RecordPayoutModal.tsx`
- [ ] Payout form fields:
  - `bookingId` — Combobox (searchable bookings), required
  - `commissionRate` — Number input (0..100), required
  - `notes` — Textarea, optional
- [ ] "Schedule" dialog: notes only
- [ ] "Mark Paid" dialog: notes only
- [ ] Guard: `canManageFinance`

**Files to create:**
- `app/(admin)/finance/payouts/page.tsx`
- `components/admin/finance/PayoutsTable.tsx`
- `components/admin/finance/RecordPayoutModal.tsx`
- `components/admin/finance/MarkPayoutPaidDialog.tsx`
- `components/admin/finance/SchedulePayoutDialog.tsx`

---

### Section 6 — Technical Contract

#### 6c. Zod Schemas

```typescript
// Create payout schema:
const createPayoutSchema = z.object({
  bookingId:      z.string().min(1, 'Booking is required'),
  commissionRate: z.number({ invalid_type_error: 'Commission rate is required' }).min(0).max(100),
  notes:         z.string().optional(),
})

// Mark paid schema:
const markPaidSchema = z.object({
  notes:         z.string().optional(),
})

// Schedule schema:
const scheduleSchema = z.object({
  notes: z.string().optional(),
})
```

---

### Section 7 — API Integration

| Method | Endpoint | Request | Response | When |
|---|---|---|---|---|
| GET | `/api/internal/owners/{ownerId}/payouts` | — | `OwnerPayoutResponse[]` | on owner select |
| POST | `/api/internal/owner-payouts` | `CreateOwnerPayoutRequest` | `OwnerPayoutResponse` | on create |
| POST | `/api/internal/owner-payouts/{id}/schedule` | `SetOwnerPayoutScheduledRequest` | `OwnerPayoutResponse` | on schedule |
| POST | `/api/internal/owner-payouts/{id}/mark-paid` | `MarkOwnerPayoutPaidRequest` | `OwnerPayoutResponse` | on mark paid |
| POST | `/api/internal/owner-payouts/{id}/cancel` | `CancelOwnerPayoutRequest` | `OwnerPayoutResponse` | on cancel |

**CRITICAL — `MarkOwnerPayoutPaidRequest`:**
```typescript
interface MarkOwnerPayoutPaidRequest {
  notes?:         string
}
```

#### 7b. TanStack Query Keys

```typescript
queryKeys.ownerPayouts.byOwner(ownerId)    // per-owner payouts list
queryKeys.ownerPayouts.byBooking(bookingId)

// Invalidate after mutations:
queryKeys.ownerPayouts.byOwner(ownerId)
queryKeys.owners.payoutSummary(ownerId)
```

#### 7d. Mutation Side Effects

```typescript
// After create:
toastSuccess('Payout record created')
queryClient.invalidateQueries({ queryKey: queryKeys.ownerPayouts.byOwner(ownerId) })
closeModal()

// After mark paid:
toastSuccess('Payout marked as paid')
queryClient.invalidateQueries({ queryKey: queryKeys.ownerPayouts.byOwner(ownerId) })
queryClient.invalidateQueries({ queryKey: queryKeys.owners.payoutSummary(ownerId) })
closeDialog()
```

---

### Section 10 — UX & Loading State Rules

| State | Required? | Behavior |
|---|---|---|
| No owner selected | ✓ | "Select an owner to view their payouts" prompt |
| Loading payouts | ✓ | SkeletonTable |
| Empty payouts | ✓ | EmptyState "No payouts for this owner yet" |
| Mark Paid dialog | ✓ | Notes optional only |
| Cancel confirm | ✓ | ConfirmDialog with optional notes |

---

### Section 12 — Acceptance Criteria

- [ ] Payouts displayed grouped by owner (select owner → see their payouts)
- [ ] `PayoutStatus` badge: Pending=warning, Scheduled=info, Paid=success, Cancelled=danger
- [ ] Payout lifecycle buttons shown based on current status
- [ ] `paymentMethod` PascalCase: 'InstaPay', 'VodafoneCash', etc.
- [ ] `MarkOwnerPayoutPaidRequest`: notes optional only
- [ ] Cancel uses optional notes
- [ ] `formatCurrency()` for amount display
- [ ] `canManageFinance` gates action buttons
- [ ] No mock data

---

### Section 13 — Notes for AI / Common Mistakes

**DO NOT:**
- ⛔ NO MOCK DATA.
- Do NOT use `'instapay'` — must be `'InstaPay'` (PascalCase from `PAYMENT_METHODS` constants)
- Do NOT send unsupported payment metadata for payout mark-paid; endpoint accepts optional notes only
- Do NOT skip the Schedule step — payout lifecycle is: Create → Schedule → Mark Paid

---

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TICKET ID: FE-4-FIN-04
TITLE: Build Payments list (all platform payments)
WAVE: Wave 4 — Finance + Owners + Clients
DOMAIN: Finance
PRIORITY: High
DEPENDS ON: FE-4-FIN-01, FE-2-ADMIN-01
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section 1 — Walkthrough

**What is this ticket about?**
Finance needs to see ALL payments across the platform — not just per-booking. This page lists every payment with documented filters (payment status, booking, invoice, pagination). It's an audit trail and reconciliation tool.

---

### Section 4 — In Scope

- [ ] `app/(admin)/finance/payments/page.tsx`
- [ ] `GET /api/internal/payments` with filters
- [ ] Table columns: Booking ID (link), Client, Type badge, Amount, Method, Status badge, Date, Recorded By, Actions
- [ ] Filters: paymentStatus (Pending/Paid/Failed/Cancelled), bookingId, invoiceId, pagination
- [ ] Actions: Mark Paid / Mark Failed / Cancel (for Pending payments only)
- [ ] Clicking booking ID → navigates to `/admin/bookings/{bookingId}`
- [ ] Guard: `canViewFinance`

**Files to create:**
- `app/(admin)/finance/payments/page.tsx`
- `components/admin/finance/PaymentsTable.tsx`

---

### Section 7 — API Integration

| Method | Endpoint | Query | Response | When |
|---|---|---|---|---|
| GET | `/api/internal/payments` | `PaymentListFilters` | `PaginatedPayments` | on mount + filter |
| POST | `/api/internal/payments/{id}/mark-paid` | `MarkPaymentPaidRequest` | `PaymentResponse` | action |
| POST | `/api/internal/payments/{id}/mark-failed` | `MarkPaymentFailedRequest` | `PaymentResponse` | action |
| POST | `/api/internal/payments/{id}/cancel` | `CancelPaymentRequest` | `PaymentResponse` | action |

```typescript
// PaymentListFilters:
{
  paymentStatus?: 'Pending' | 'Paid' | 'Failed' | 'Cancelled',
  bookingId?:     string,
  invoiceId?:     string,
  page?:          number,
  pageSize?:      number,
}
```

---

### Section 12 — Acceptance Criteria

- [ ] Only documented payment filters are sent to API (`paymentStatus`, `bookingId`, `invoiceId`, `page`, `pageSize`)
- [ ] `PAYMENT_TYPE_LABELS` and `PAYMENT_STATUS_LABELS` used for badge display
- [ ] Actions only on `Pending` payments
- [ ] Pagination uses `totalCount` + `totalPages`
- [ ] No mock data

---

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TICKET ID: FE-4-FIN-05
TITLE: Build Finance reports page
WAVE: Wave 4 — Finance + Owners + Clients
DOMAIN: Finance
PRIORITY: High
DEPENDS ON: FE-4-FIN-02, FE-2-ADMIN-02 (reports service already built)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section 1 — Walkthrough

**What is this ticket about?**
Finance needs daily breakdowns — how much came in each day, how many bookings were confirmed. This page uses the daily reporting endpoints and renders data in a simple table with optional date range filter.

---

### Section 4 — In Scope

- [ ] `app/(admin)/finance/reports/page.tsx`
- [ ] Finance daily table: `GET /api/internal/reports/finance/daily`
- [ ] Bookings daily table: `GET /api/internal/reports/bookings/daily`
- [ ] Two tabs: "Revenue" and "Bookings"
- [ ] Each tab: date range filter + data table
- [ ] Revenue table columns: Date, Total Revenue, Deposits, Remaining, Refunds, Confirmed Bookings
- [ ] Bookings table columns: Date, Total Leads, Active Leads, Confirmed, Completed, Cancelled, Conversion Rate
- [ ] Totals row at bottom of each table
- [ ] Guard: `canViewReports`

**Files to create:**
- `app/(admin)/finance/reports/page.tsx`
- `components/admin/finance/RevenueTable.tsx`
- `components/admin/finance/BookingsAnalyticsTable.tsx`

---

### Section 7 — API Integration

| Method | Endpoint | Query | Response | When |
|---|---|---|---|---|
| GET | `/api/internal/reports/finance/daily` | `{ startDate, endDate }` | `FinanceAnalyticsDailySummaryResponse[]` | on load + filter |
| GET | `/api/internal/reports/bookings/daily` | `{ startDate, endDate }` | `BookingAnalyticsDailySummaryResponse[]` | on load + filter |

```typescript
// FinanceAnalyticsDailySummaryResponse:
{
  date:                       string
  totalRevenue:               number
  depositsCollected:          number
  remainingCollected:         number
  refunds:                    number
  numberOfConfirmedBookings:  number
}

// BookingAnalyticsDailySummaryResponse:
{
  date:               string
  totalLeads:         number
  activeLeads:        number
  confirmedBookings:  number
  completedBookings:  number
  cancelledBookings:  number
  conversionRate:     number
}
```

---

### Section 12 — Acceptance Criteria

- [ ] Both endpoints called on page mount with default date range (current month)
- [ ] `formatCurrency()` for all money cells
- [ ] `conversionRate` shown as percentage: `(value * 100).toFixed(1)%`
- [ ] Totals row computed from response data
- [ ] `canViewReports` gates this page
- [ ] No mock data

---

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TICKET ID: FE-4-OWN-01
TITLE: Create Owners service layer + TypeScript types
WAVE: Wave 4 — Finance + Owners + Clients
DOMAIN: Owners
PRIORITY: Critical
DEPENDS ON: FE-0-INFRA-03, FE-0-INFRA-04
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section 1 — Walkthrough

**What is this ticket about?**
All 5 Owner tickets depend on typed contracts. This ticket creates the full Owners service layer: list, CRUD, status toggle, earnings, and payouts by owner.

---

### Section 4 — In Scope

- [ ] `lib/types/owner.types.ts`
- [ ] `lib/api/services/owners.service.ts` (was stubbed in FE-2-UNITS-03 — now complete it)
- [ ] `lib/hooks/useOwners.ts`

**Files to create:**
- `lib/types/owner.types.ts`
- `lib/hooks/useOwners.ts`

**Files to modify:**
- `lib/api/services/owners.service.ts` — was stubbed with `getAll()` only; add all methods
- `lib/types/index.ts`

---

### Section 6 — Technical Contract

```typescript
// lib/types/owner.types.ts
// From KAZA_BOOKING_API_Reference.md

// ── Owner status (lowercase per API design) ──
type OwnerStatus = 'active' | 'inactive'

// ── Owner list item ──
interface OwnerListItemResponse {
  id:             string
  name:           string
  phone:          string
  email:          string | null
  commissionRate: number       // percentage: 20.00 = 20%
  status:         OwnerStatus
  createdAt:      string
}

// ── Owner full detail ──
interface OwnerDetailsResponse {
  id:             string
  name:           string
  phone:          string
  email:          string | null
  commissionRate: number
  status:         OwnerStatus
  notes:          string | null
  createdAt:      string
  updatedAt:      string
}

// ── Owner Filters ──
interface OwnerListFilters {
  includeInactive?: boolean
  page?:     number
  pageSize?: number
}

// ── Create/Update ──
interface CreateOwnerRequest {
  name:           string
  phone:          string
  email?:         string
  commissionRate: number    // percentage: send 20.00 for 20%
  status:         OwnerStatus
  notes?:         string
}

interface UpdateOwnerRequest {
  name:           string
  phone:          string
  email?:         string
  commissionRate: number
  status:         OwnerStatus
  notes?:         string
}

interface UpdateOwnerStatusRequest {
  status: OwnerStatus   // 'active' | 'inactive' (lowercase)
}

// ── Owner Earnings ──
// Backend gap: no documented `/api/owners/{id}/earnings` endpoint in Kaza Booking_API_Reference.
// Use documented payout summary (`/api/internal/owners/{ownerId}/payout-summary`) instead.

// ── Paginated Owners ──
interface PaginatedOwners {
  items:      OwnerListItemResponse[]
  pagination: PaginationMeta
}
```

```typescript
// lib/api/services/owners.service.ts (complete version)
export const ownersService = {
  getAll:       (filters?: OwnerListFilters): Promise<PaginatedOwners> =>
    api.get(endpoints.owners.list, { params: filters }),

  getById:      (id: string): Promise<OwnerDetailsResponse> =>
    api.get(endpoints.owners.byId(id)),

  create:       (data: CreateOwnerRequest): Promise<OwnerDetailsResponse> =>
    api.post(endpoints.owners.create, data),

  update:       (id: string, data: UpdateOwnerRequest): Promise<OwnerDetailsResponse> =>
    api.put(endpoints.owners.update(id), data),

  updateStatus: (id: string, status: OwnerStatus): Promise<OwnerDetailsResponse> =>
    api.patch(endpoints.owners.status(id), { status }),

  getPayouts:   (id: string): Promise<OwnerPayoutResponse[]> =>
    api.get(endpoints.ownerPayouts.byOwner(id)),

  // getEarnings removed: endpoint not documented in API reference.

  getPayoutSummary: (id: string): Promise<OwnerPayoutSummaryResponse> =>
    api.get(endpoints.financeSummary.ownerPayoutSummary(id)),
}
```

---

### Section 12 — Acceptance Criteria

- [ ] `OwnerStatus` is lowercase: 'active' | 'inactive'
- [ ] `commissionRate` stored/sent as percentage (20.00 not 0.20)
- [ ] `UpdateOwnerStatusRequest` sends `{ status: 'active' | 'inactive' }` (lowercase)
- [ ] `PaginatedOwners.pagination` uses `totalCount` + `totalPages`
- [ ] No `any` types, no mock data

---

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TICKET ID: FE-4-OWN-02
TITLE: Build Owners list page
WAVE: Wave 4 — Finance + Owners + Clients
DOMAIN: Owners
PRIORITY: Critical
DEPENDS ON: FE-4-OWN-01, FE-2-ADMIN-01, FE-1-UI-06
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section 1 — Walkthrough

**What is this ticket about?**
The owners list at `/admin/owners` lets Sales, Finance, and SuperAdmin browse all property owners. SuperAdmin can create new ones. The list shows key info: name, phone, commission rate, and status.

---

### Section 4 — In Scope

- [ ] `app/(admin)/owners/page.tsx`
- [ ] Table columns: Name, Phone, Email, Commission Rate (%), Status, Created, Actions
- [ ] Filters: `includeInactive` + pagination only (documented)
- [ ] Actions: View Details, Edit (SuperAdmin), Toggle Status (SuperAdmin)
- [ ] "New Owner" button — visible only `canManageOwners`
- [ ] Status toggle via `<ConfirmDialog>`
- [ ] Commission rate displayed directly as % from API: `${owner.commissionRate.toFixed(0)}%`
- [ ] Guard: `canViewOwners`

**Files to create:**
- `app/(admin)/owners/page.tsx`
- `components/admin/owners/OwnerTable.tsx`
- `components/admin/owners/OwnerFilters.tsx`

---

### Section 7 — API Integration

| Method | Endpoint | Query | Response | When |
|---|---|---|---|---|
| GET | `/api/owners` | `OwnerListFilters` | `PaginatedOwners` | on mount + filter |
| PATCH | `/api/owners/{id}/status` | `{ status }` | `OwnerDetailsResponse` | on status toggle |

**Documented owner list query params:**
```typescript
{ includeInactive?: boolean, page?: number, pageSize?: number }
```

---

### Section 12 — Acceptance Criteria

- [ ] Commission rate displayed as percentage: `Math.round(owner.commissionRate)%`
- [ ] Only documented owner list filters are sent (`includeInactive`, `page`, `pageSize`)
- [ ] Status toggle uses `<ConfirmDialog>`
- [ ] `canManageOwners` gates New/Edit/Toggle buttons
- [ ] `keepPreviousData: true`
- [ ] Pagination uses `totalCount` + `totalPages`
- [ ] No mock data

---

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TICKET ID: FE-4-OWN-03
TITLE: Build Create Owner form
WAVE: Wave 4 — Finance + Owners + Clients
DOMAIN: Owners
PRIORITY: Critical
DEPENDS ON: FE-4-OWN-01, FE-2-ADMIN-01
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section 1 — Walkthrough

**What is this ticket about?**
SuperAdmin creates new owners — the property landlords who will list their units on the platform. Key field: commission rate (stored as percentage 0..100 and displayed as %).

---

### Section 4 — In Scope

- [ ] `app/(admin)/owners/new/page.tsx`
- [ ] Form fields:
  - `name` — Input, required
  - `phone` — Input (tel), required
  - `email` — Input (email), optional
  - `commissionRate` — Number input (%) with helper "Enter as percentage e.g. 20 for 20%", required
  - `status` — Select (`active` / `inactive`), required
  - `notes` — Textarea, optional
- [ ] On submit: send `commissionRate` as percentage value directly (0..100)
- [ ] On success: redirect to `ROUTES.admin.owners.detail(newOwner.id)`
- [ ] Guard: `canManageOwners`

**Files to create:**
- `app/(admin)/owners/new/page.tsx`
- `components/admin/owners/OwnerForm.tsx` (shared for create + edit)

---

### Section 6 — Technical Contract

```typescript
const ownerFormSchema = z.object({
  name:           z.string().min(1, 'Name is required'),
  phone:          z.string().min(1, 'Phone is required'),
  email:          z.string().email().optional().or(z.literal('')),
  commissionRate: z.number({ invalid_type_error: 'Commission rate required' })
                   .min(0, 'Cannot be negative').max(100, 'Cannot exceed 100%'),
  notes:          z.string().optional(),
})

// IMPORTANT: send percentage directly to API:
// commissionRate: formValues.commissionRate   (20 → 20.00)
```

---

### Section 7 — API Integration

| Method | Endpoint | Request | Response | When |
|---|---|---|---|---|
| POST | `/api/owners` | `CreateOwnerRequest` | `OwnerDetailsResponse` | on submit |

```typescript
// CreateOwnerRequest:
{
  name:           string,
  phone:          string,
  email?:         string | undefined,
  commissionRate: 20.00,    // percentage value (0..100)
  status:         'active' | 'inactive',
  notes?:         string,
}
```

---

### Section 12 — Acceptance Criteria

- [ ] `commissionRate` sent as percentage value (0..100) without /100 conversion
- [ ] `email` sent as `undefined` (not `""`) when empty
- [ ] 422 errors (phone/email taken) shown as field-level errors
- [ ] Redirect to owner detail on success
- [ ] `status` is required in create payload
- [ ] `canManageOwners` gates this page
- [ ] No mock data

---

### Section 13 — Notes for AI / Common Mistakes

**DO NOT:**
- ⛔ NO MOCK DATA.
- Do NOT divide commission by 100 before sending; API expects percentage value (e.g., 20.00)

---

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TICKET ID: FE-4-OWN-04
TITLE: Build Owner Detail page
WAVE: Wave 4 — Finance + Owners + Clients
DOMAIN: Owners
PRIORITY: Critical
DEPENDS ON: FE-4-OWN-01, FE-2-ADMIN-01
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section 1 — Walkthrough

**What is this ticket about?**
The owner detail page at `/admin/owners/{id}` shows the full owner profile: contact info, commission rate, status, notes, and financial summary. Embedded unit list in owner details is a backend gap unless documented.

---

### Section 4 — In Scope

- [ ] `app/(admin)/owners/[id]/page.tsx`
- [ ] **Header:** name, phone, email, status badge, commission rate (as %)
- [ ] **Backend gap:** owner details endpoint does not document embedded `OwnerDetailsResponse.units`
- [ ] **Financial summary:** from `GET /api/internal/owners/{ownerId}/payout-summary`:
  - Total Pending, Total Scheduled, Total Paid
- [ ] **Notes field:** display `owner.notes` (read-only)
- [ ] Actions in header: "Edit Owner" (→ edit page), "Toggle Status" (ConfirmDialog)
- [ ] Guard: `canViewOwners`

**Files to create:**
- `app/(admin)/owners/[id]/page.tsx`
- `components/admin/owners/OwnerDetailHeader.tsx`
- `components/admin/owners/OwnerUnitsList.tsx`
- `components/admin/owners/OwnerFinancialSummary.tsx`

---

### Section 7 — API Integration

| Method | Endpoint | Response | When |
|---|---|---|---|
| GET | `/api/owners/{id}` | `OwnerDetailsResponse` | on mount |
| GET | `/api/internal/owners/{id}/payout-summary` | `OwnerPayoutSummaryResponse` | on mount |
| PATCH | `/api/owners/{id}/status` | `OwnerDetailsResponse` | on status toggle |

---

### Section 12 — Acceptance Criteria

- [ ] Commission rate displayed as %: `Math.round(owner.commissionRate)%`
- [ ] No undocumented `owner.units` assumptions in owner detail contract
- [ ] Payout summary shows totalPending, totalScheduled, totalPaid
- [ ] Status toggle uses ConfirmDialog
- [ ] Edit button navigates to edit page (FE-4-OWN-05)
- [ ] `canManageOwners` gates Edit + Status toggle buttons
- [ ] No mock data

---

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TICKET ID: FE-4-OWN-05
TITLE: Build Edit Owner + Status toggle
WAVE: Wave 4 — Finance + Owners + Clients
DOMAIN: Owners
PRIORITY: High
DEPENDS ON: FE-4-OWN-04, FE-4-OWN-03 (OwnerForm shared component)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section 1 — Walkthrough

**What is this ticket about?**
SuperAdmin can edit an owner's details (name, phone, email, commission rate, notes). The `OwnerForm` component from FE-4-OWN-03 is reused in edit mode with pre-filled values.

---

### Section 4 — In Scope

- [ ] `app/(admin)/owners/[id]/edit/page.tsx`
- [ ] Reuse `<OwnerForm>` in edit mode (pre-filled from owner detail cache)
- [ ] `PUT /api/owners/{id}` on submit
- [ ] Commission rate: display/send as percentage value directly (0..100)
- [ ] Payload must include full documented owner shape, including `status`
- [ ] On success: redirect to owner detail page

**Files to create:**
- `app/(admin)/owners/[id]/edit/page.tsx`

---

### Section 6 — Technical Contract

```typescript
// EditOwnerRequest (same percentage contract as create):
{
  name:            string,
  phone:           string,
  email?:          string | undefined,
  commissionRate:  20.00,   // percentage value
  status:          'active' | 'inactive',
  notes?:          string,
}
```

---

### Section 12 — Acceptance Criteria

- [ ] Form pre-fills directly from cached owner data (`owner.commissionRate`)
- [ ] `commissionRate` sent as percentage to API
- [ ] `PUT /api/owners/{id}` used (not POST or PATCH)
- [ ] Redirect to owner detail after success
- [ ] No mock data

---

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TICKET ID: FE-4-OWN-06
TITLE: Build Owner Payout Summary panel
WAVE: Wave 4 — Finance + Owners + Clients
DOMAIN: Owners
PRIORITY: High
DEPENDS ON: FE-4-OWN-04, FE-4-FIN-03
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section 1 — Walkthrough

**What is this ticket about?**
Within the owner detail page, a payouts tab shows the full payout history for that specific owner — all past payments, upcoming scheduled payouts, and pending amounts. Finance can also create a new payout directly from the owner's page.

---

### Section 4 — In Scope

- [ ] `components/admin/owners/OwnerPayoutsTab.tsx` — tab on owner detail page
- [ ] `GET /api/internal/owners/{ownerId}/payouts` — payout history
- [ ] Table: Date, Amount, Status badge, Scheduled At, Paid At, Notes, Actions
- [ ] "New Payout" button → opens the same `<RecordPayoutModal>` from FE-4-FIN-03 (pre-filled with `ownerId`)
- [ ] Status-based actions: Schedule, Mark Paid, Cancel
- [ ] Summary bar at top: from `GET /api/internal/owners/{ownerId}/payout-summary`

**Files to create:**
- `components/admin/owners/OwnerPayoutsTab.tsx`

---

### Section 12 — Acceptance Criteria

- [ ] Payout history loaded from owner-specific endpoint
- [ ] Summary bar shows totalPending, totalScheduled, totalPaid
- [ ] New payout pre-fills owner (not a blank form)
- [ ] Status-based actions work correctly
- [ ] No mock data

---

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TICKET ID: FE-4-CLI-01
TITLE: Create Clients service layer + TypeScript types
WAVE: Wave 4 — Finance + Owners + Clients
DOMAIN: Clients
PRIORITY: Critical
DEPENDS ON: FE-0-INFRA-03, FE-0-INFRA-04
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section 1 — Walkthrough

**What is this ticket about?**
Clients domain is simpler than others (read-mostly). The API has `GET /api/clients` and `GET /api/clients/{id}` — no create/edit (clients are created via registration or booking form). This ticket creates the service + types.

---

### Section 4 — In Scope

- [ ] `lib/types/client.types.ts`
- [ ] `lib/api/services/clients.service.ts`
- [ ] `lib/hooks/useClients.ts`

**Files to create:**
- `lib/types/client.types.ts`
- `lib/api/services/clients.service.ts`
- `lib/hooks/useClients.ts`

**Files to modify:**
- `lib/types/index.ts`

---

### Section 6 — Technical Contract

```typescript
// lib/types/client.types.ts
// From KAZA_BOOKING_API_Reference.md

// ── Client list item ──
interface ClientListItemResponse {
  id:            string
  name:          string
  phone:         string
  email:         string | null
  isActive:      boolean
  totalBookings: number
  createdAt:     string
}

// ── Client detail ──
interface ClientDetailsResponse {
  id:        string
  name:      string
  phone:     string
  email:     string | null
  isActive:  boolean
  createdAt: string
  updatedAt: string
  // Backend gap: no documented client booking-history endpoint in KAZA_BOOKING_API_Reference.md.
  // Do not assume internal bookings endpoint supports clientId filter until backend confirms.
}

// ── Client filters ──
interface ClientListFilters {
  search?:   string    // search by name or phone
  isActive?: boolean
  page?:     number
  pageSize?: number
}

// ── Paginated Clients ──
interface PaginatedClients {
  items:      ClientListItemResponse[]
  pagination: PaginationMeta
}
```

```typescript
// lib/api/services/clients.service.ts
export const clientsService = {
  getAll:    (filters?: ClientListFilters): Promise<PaginatedClients> =>
    api.get(endpoints.clients.list, { params: filters }),

  getById:   (id: string): Promise<ClientDetailsResponse> =>
    api.get(endpoints.clients.byId(id)),

  // Backend gap: client booking-history endpoint is not documented.
  // Keep this method blocked behind backend confirmation.
  getBookings: async (_clientId: string): Promise<PaginatedBookings> =>
    Promise.reject(new Error('Backend gap: no documented client booking-history endpoint')),
}
```

**IMPORTANT NOTE:**
`GET /api/clients/{id}/bookings` is not documented in the API reference, and internal bookings query does not document `clientId` filtering. Treat this as a backend gap and do not implement fallback assumptions.

---

### Section 12 — Acceptance Criteria

- [ ] `ClientDetailsResponse` typed correctly
- [ ] `clientsService.getBookings()` is blocked with explicit backend-gap handling until endpoint is provided
- [ ] `PaginatedClients.pagination` uses `totalCount` + `totalPages`
- [ ] No mock data

---

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TICKET ID: FE-4-CLI-02
TITLE: Build Clients list page
WAVE: Wave 4 — Finance + Owners + Clients
DOMAIN: Clients
PRIORITY: Critical
DEPENDS ON: FE-4-CLI-01, FE-2-ADMIN-01, FE-1-UI-06
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section 1 — Walkthrough

**What is this ticket about?**
The clients list at `/admin/clients` lets Sales and SuperAdmin browse all registered clients. It's primarily a lookup tool — find a client by phone, see their booking count, navigate to their profile.

---

### Section 4 — In Scope

- [ ] `app/(admin)/clients/page.tsx`
- [ ] `GET /api/clients` with search + filters
- [ ] Table columns: Name, Phone (masked), Email, Total Bookings, Active, Registered Date, Actions
- [ ] Actions: View Details
- [ ] Search by name or phone
- [ ] Guard: `canViewClients`

**Files to create:**
- `app/(admin)/clients/page.tsx`
- `components/admin/clients/ClientTable.tsx`

---

### Section 7 — API Integration

| Method | Endpoint | Query | Response | When |
|---|---|---|---|---|
| GET | `/api/clients` | `ClientListFilters` | `PaginatedClients` | on mount + search |

---

### Section 12 — Acceptance Criteria

- [ ] Phone masked in display
- [ ] Search re-fetches with search query param
- [ ] Pagination uses `totalCount` + `totalPages`
- [ ] `canViewClients` gates the page
- [ ] No mock data

---

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TICKET ID: FE-4-CLI-03
TITLE: Build Client Detail page
WAVE: Wave 4 — Finance + Owners + Clients
DOMAIN: Clients
PRIORITY: High
DEPENDS ON: FE-4-CLI-01, FE-2-ADMIN-01
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section 1 — Walkthrough

**What is this ticket about?**
The client detail page at `/admin/clients/{id}` shows the client's profile and their full booking history. Sales uses this to understand a client's relationship with the platform — how many bookings they've had, which units they stayed at, their total spend.

---

### Section 4 — In Scope

- [ ] `app/(admin)/clients/[id]/page.tsx`
- [ ] **Client Info section:** name, phone, email (or "not provided"), status badge, registered date
- [ ] **Booking History section:** list of all bookings for this client
  - Backend gap: booking-history endpoint for clients is not documented
  - Table: Unit, Check-in, Check-out, Nights, Total, Status, Booked On
  - Each booking row links to `/admin/bookings/{bookingId}`
- [ ] **Summary stats:** Total Bookings count, Total Spent (sum of confirmed booking amounts)
- [ ] No edit/delete for clients (they're managed via their own account)
- [ ] Guard: `canViewClients`

**Files to create:**
- `app/(admin)/clients/[id]/page.tsx`
- `components/admin/clients/ClientDetailHeader.tsx`
- `components/admin/clients/ClientBookingHistory.tsx`

---

### Section 7 — API Integration

| Method | Endpoint | Query | Response | When |
|---|---|---|---|---|
| GET | `/api/clients/{id}` | — | `ClientDetailsResponse` | on mount |
| GET | `/api/internal/bookings` | `{ clientId: id }` | `PaginatedBookings` | on mount |

---

### Section 12 — Acceptance Criteria

- [ ] Booking history uses `?clientId=` filter on bookings endpoint
- [ ] Each booking row links to the booking detail page via `booking.bookingId`
- [ ] Total Spent computed from bookings (only Confirmed + Completed statuses)
- [ ] Phone shown in full (not masked — admin context)
- [ ] No mock data

---

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TICKET ID: FE-4-ADM-01
TITLE: Build Admin Users management page
WAVE: Wave 4 — Finance + Owners + Clients
DOMAIN: Admin
PRIORITY: High
DEPENDS ON: FE-2-ADMIN-01, FE-1-UI-01..06
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section 1 — Walkthrough

**What is this ticket about?**
SuperAdmin manages the admin team at `/admin/settings` — who has Sales access, who has Finance access, who can manage units. This page lists all admin users and lets SuperAdmin change their roles and activate/deactivate them.

---

### Section 2 — Objective

Build the Admin Users management section at `/admin/settings` showing all admin team members with role and status management — accessible only to SuperAdmin.

---

### Section 4 — In Scope

- [ ] Add Admin Users section to `app/(admin)/settings/page.tsx` (which was started in FE-2-ADMIN-04 for amenities)
- [ ] `GET /api/admin-users` → list all admin users
- [ ] Create `lib/api/services/admin-users.service.ts`
- [ ] Table columns: Name, Email, Role badge, Status (active/inactive), Created, Actions
- [ ] Actions:
  - Change Role → `PATCH /api/admin-users/{id}/role`
  - Toggle Status → `PATCH /api/admin-users/{id}/status`
- [ ] Change Role: dropdown select with 4 options (SuperAdmin/Sales/Finance/Tech)
- [ ] "Create Admin User" button → FE-4-ADM-02
- [ ] Guard: `canManageAdminUsers` (SuperAdmin only)

**Files to create:**
- `components/admin/settings/AdminUsersSection.tsx`
- `components/admin/settings/AdminUserTable.tsx`
- `components/admin/settings/ChangeRoleDialog.tsx`
- `lib/api/services/admin-users.service.ts`
- `lib/types/admin-user.types.ts`
- `lib/hooks/useAdminUsers.ts`

---

### Section 6 — Technical Contract

```typescript
// lib/types/admin-user.types.ts
interface AdminUserResponse {
  id:        string
  name:      string
  email:     string
  role:      AdminRole      // 'SuperAdmin' | 'Sales' | 'Finance' | 'Tech'
  isActive:  boolean
  createdAt: string
  updatedAt: string
}

interface UpdateAdminUserRoleRequest {
  role: AdminRole    // PascalCase: 'SuperAdmin' | 'Sales' | 'Finance' | 'Tech'
}

interface UpdateAdminUserStatusRequest {
  isActive: boolean
}
```

```typescript
// lib/api/services/admin-users.service.ts
export const adminUsersService = {
  getAll:        (): Promise<AdminUserResponse[]> =>
    api.get(endpoints.adminUsers.list),

  create:        (data: CreateAdminUserRequest): Promise<AdminUserResponse> =>
    api.post(endpoints.adminUsers.create, data),

  changeRole:    (id: string, role: AdminRole): Promise<AdminUserResponse> =>
    api.patch(endpoints.adminUsers.role(id), { role }),

  toggleStatus:  (id: string, isActive: boolean): Promise<AdminUserResponse> =>
    api.patch(endpoints.adminUsers.status(id), { isActive }),
}
```

---

### Section 7 — API Integration

| Method | Endpoint | Request | Response | When |
|---|---|---|---|---|
| GET | `/api/admin-users` | — | `AdminUserResponse[]` | on section mount |
| PATCH | `/api/admin-users/{id}/role` | `{ role: AdminRole }` | `AdminUserResponse` | on role change |
| PATCH | `/api/admin-users/{id}/status` | `{ isActive: boolean }` | `AdminUserResponse` | on toggle |

**Role values PascalCase:**
```typescript
{ role: 'SuperAdmin' }   // or 'Sales', 'Finance', 'Tech'
// NOT 'super_admin', 'sales', etc.
```

---

### Section 12 — Acceptance Criteria

- [ ] Role badge uses `ADMIN_ROLE_LABELS` for display
- [ ] Role change sends PascalCase: `{ role: 'Finance' }` not `{ role: 'finance' }`
- [ ] Status toggle uses `<ConfirmDialog>` before deactivating
- [ ] Admin cannot deactivate themselves (compare `adminUser.id` with `useAuthStore().user.userId`)
- [ ] `canManageAdminUsers` gates entire section
- [ ] Query invalidated after mutations
- [ ] No mock data

---

### Section 13 — Notes for AI / Common Mistakes

**DO NOT:**
- ⛔ NO MOCK DATA.
- Do NOT allow an admin to deactivate their own account — compare IDs and disable that row's actions
- Do NOT use `role: 'super_admin'` — must be `role: 'SuperAdmin'`

---

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TICKET ID: FE-4-ADM-02
TITLE: Build Create Admin User form
WAVE: Wave 4 — Finance + Owners + Clients
DOMAIN: Admin
PRIORITY: High
DEPENDS ON: FE-4-ADM-01
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section 1 — Walkthrough

**What is this ticket about?**
SuperAdmin creates new admin users (Sales, Finance, Tech team members) by providing name, email, password, and role. The new user can then log in with those credentials.

---

### Section 4 — In Scope

- [ ] `components/admin/settings/CreateAdminUserModal.tsx`
- [ ] Form fields:
  - `name` — Input, required
  - `email` — Input (email), required
  - `password` — Input (password), required, min 8 chars
  - `role` — Select (SuperAdmin / Sales / Finance / Tech), required
- [ ] `POST /api/admin-users` on submit
- [ ] On success: toast + modal close + list refreshes

**Files to create:**
- `components/admin/settings/CreateAdminUserModal.tsx`

---

### Section 6 — Technical Contract

```typescript
const createAdminUserSchema = z.object({
  name:     z.string().min(1, 'Name is required'),
  email:    z.string().email('Valid email required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role:     z.enum(['SuperAdmin', 'Sales', 'Finance', 'Tech']),
})

// CreateAdminUserRequest:
interface CreateAdminUserRequest {
  name:     string
  email:    string
  password: string
  role:     AdminRole   // 'SuperAdmin' | 'Sales' | 'Finance' | 'Tech'
}
```

---

### Section 12 — Acceptance Criteria

- [ ] `role` sent as PascalCase: 'SuperAdmin', 'Sales', 'Finance', 'Tech'
- [ ] `ADMIN_ROLE_LABELS` used for dropdown display
- [ ] New user appears in admin users list after creation
- [ ] Query invalidated after create
- [ ] No mock data

---

---

# Wave 4 — QA Prompt

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WAVE QA REVIEW PROMPT
Wave: 4 — Finance + Owners + Clients
Tickets: FE-4-FIN-01..05, FE-4-OWN-01..06, FE-4-CLI-01..03, FE-4-ADM-01..02
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You are a senior QA engineer reviewing Wave 4.

## MOCK DATA AUDIT — HARD GATE

```bash
grep -rn "mockOwner\|fakeOwner\|sampleOwner\|mockClient\|mockPayout" \
  --include="*.ts" --include="*.tsx" .

grep -rn "commissionRate.*0\.2\b\|commissionRate.*20\b" \
  --include="*.ts" --include="*.tsx" components/ lib/api/
# Hardcoded values — must be from real API

grep -rn "'instapay'\|'vodafonecash'\|'cash'\|'banktransfer'" \
  --include="*.ts" --include="*.tsx" .
# Must be PascalCase: 'InstaPay', 'VodafoneCash', 'Cash', 'BankTransfer'

grep -rn "'super_admin'\|'super admin'" --include="*.ts" --include="*.tsx" .
# Must be 'SuperAdmin'

grep -rn "'pending'\|'scheduled'\|'paid'" \
  --include="*.ts" --include="*.tsx" lib/api/services/ components/admin/finance/
# Payout statuses must be PascalCase: 'Pending', 'Scheduled', 'Paid'

grep -rn "pagination\.total[^C]" --include="*.ts" --include="*.tsx" .
```

## API CONTRACT VERIFICATION

### Finance:
- [ ] `MarkOwnerPayoutPaidRequest` uses optional notes-only body
- [ ] `paymentMethod` PascalCase: 'InstaPay', 'VodafoneCash', 'Cash', 'BankTransfer'
- [ ] `PayoutStatus` PascalCase: 'Pending', 'Scheduled', 'Paid', 'Cancelled'
- [ ] Finance reports use `startDate`/`endDate` ISO date strings in query params
- [ ] `conversionRate` displayed as %: `(value * 100).toFixed(1)%`
- [ ] Payout lifecycle: Pending → Schedule → Mark Paid (not skipping schedule)

### Owners:
- [ ] `commissionRate` stored as PERCENTAGE (20.00), displayed as %
- [ ] Form submits `commissionRate` directly
- [ ] Edit form pre-fills directly from `owner.commissionRate`
- [ ] `OwnerStatus` is LOWERCASE: 'active' | 'inactive' (not PascalCase)
- [ ] `UpdateOwnerStatusRequest` sends `{ status: 'active' }` (lowercase)
- [ ] `OwnerPayoutSummaryResponse` has `totalPending`, `totalScheduled`, `totalPaid`

### Clients:
- [ ] Client booking-history endpoint is a backend gap until documented
- [ ] Booking history row uses `booking.id` for navigation
- [ ] Total Spent computed only from Confirmed + Completed bookings

### Admin Users:
- [ ] Role change sends `{ role: 'Finance' }` (PascalCase)
- [ ] Cannot deactivate own account (ID check implemented)
- [ ] `ADMIN_ROLE_LABELS` used for display (SuperAdmin → "Super Admin")

## PER-TICKET CHECKS

### FE-4-FIN-01 — Finance Types
- [ ] `PayoutStatus`: Pending | Scheduled | Paid | Cancelled
- [ ] `MarkOwnerPayoutPaidRequest` uses optional notes-only body

### FE-4-FIN-02 — Finance Overview
- [ ] 6 stat cards from `FinanceAnalyticsSummaryResponse`
- [ ] Date range filter re-fetches data
- [ ] `canViewFinance` gate

### FE-4-FIN-03 — Owner Payouts
- [ ] Payouts loaded per owner (not global list)
- [ ] "Mark Paid" dialog sends optional notes only
- [ ] Schedule dialog sends optional notes only
- [ ] Cancel uses optional notes

### FE-4-FIN-04 — Payments List
- [ ] Filter params sent as PascalCase
- [ ] Booking ID in table links to booking detail

### FE-4-FIN-05 — Reports
- [ ] Both finance and bookings daily endpoints called
- [ ] Default range = current month
- [ ] Conversion rate as percentage

### FE-4-OWN-01 — Owner Types
- [ ] `OwnerStatus` lowercase: 'active' | 'inactive'
- [ ] `commissionRate` is percentage (0..100) in type definition

### FE-4-OWN-02 — Owners List
- [ ] Commission shown as %
- [ ] Status filter sends lowercase
- [ ] `canManageOwners` gates action buttons

### FE-4-OWN-03 — Create Owner
- [ ] `commissionRate` sent directly (no /100 conversion)
- [ ] `email` = undefined (not "") when empty

### FE-4-OWN-04 — Owner Detail
- [ ] Commission shown as `%`
- [ ] Payout summary loaded from separate endpoint
- [ ] No undocumented embedded units list assumption

### FE-4-OWN-05 — Edit Owner
- [ ] Pre-fills with `commissionRate` for display
- [ ] Sends `commissionRate` to API

### FE-4-OWN-06 — Owner Payouts Tab
- [ ] Uses owner-specific payout endpoint
- [ ] New payout pre-fills ownerId

### FE-4-CLI-01 — Client Types
- [ ] `getBookings` uses correct endpoint

### FE-4-CLI-02 — Clients List
- [ ] Phone masked, search works

### FE-4-CLI-03 — Client Detail
- [ ] Booking history uses `?clientId=` filter
- [ ] Total Spent only from Confirmed/Completed bookings

### FE-4-ADM-01 — Admin Users
- [ ] Role badge uses ADMIN_ROLE_LABELS
- [ ] Self-deactivation blocked

### FE-4-ADM-02 — Create Admin User
- [ ] Role sent as PascalCase

## ARCHITECTURE CHECKS
- [ ] No inline endpoint strings
- [ ] No inline role/status strings
- [ ] `commissionRate` never hardcoded
- [ ] `pnpm type-check` zero errors
- [ ] No mock data anywhere

## Business Validation

| Test | Expected |
|---|---|
| SuperAdmin creates owner with commission=20% | API receives commissionRate=20.00 |
| Finance creates payout for owner, then marks paid | mark-paid request sends optional notes only |
| Finance views owners list | Commission shows as 20% (API value 20.00) |
| SuperAdmin changes Finance user role to Tech | Role updates, badge changes to "Tech" |
| SuperAdmin tries to deactivate own account | Disabled or blocked |
| Finance views revenue report for current month | Real data shows (no hardcoded numbers) |

## Wave 4 Sign-off Recommendation
[ ] APPROVED
[ ] CONDITIONAL — conditions: ...
[ ] BLOCKED — blockers: ...
```

---

---

# Wave 4 — PM Sign-off Checklist

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PM WAVE SIGN-OFF CHECKLIST
Wave: 4 — Finance + Owners + Clients
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
| SuperAdmin creates owner (20% commission) → API receives 20.00 | | |
| Finance views Finance overview page (no CRM visible) | | |
| Finance creates payout (2400 EGP, Vodafone Cash) → payout in Pending | | |
| Finance schedules payout for next week | | |
| Finance marks payout as paid (with proof URL) | | |
| Finance views revenue report — current month breakdown | | |
| Sales searches for client by phone → client detail shows booking history | | |
| SuperAdmin creates new Finance admin user | | |
| SuperAdmin changes Sales user role to Tech | | |
| SuperAdmin cannot deactivate their own account | | |

### C. Definition of Done
- [ ] `pnpm type-check` clean
- [ ] `pnpm lint` clean
- [ ] All 16 tickets merged
- [ ] Mock data audit passed
- [ ] `commissionRate` percentage contract verified (form ↔ API)
- [ ] All payout statuses PascalCase
- [ ] Owner status lowercase (`active`/`inactive`)
- [ ] Admin roles PascalCase (`SuperAdmin`, `Sales`, etc.)

### D. API Contract Sign-off
- [ ] `commissionRate` = percentage in API (20.00), % in UI (20%) ✓
- [ ] `MarkOwnerPayoutPaidRequest` uses notes-only body ✓
- [ ] Owner status = lowercase ✓
- [ ] Admin role = PascalCase ✓
- [ ] Payout lifecycle: Pending → Scheduled → Paid ✓

### E. Next Wave Readiness (Wave 5 — Dashboard + Reviews + Notifications)
- [ ] Finance reports service built (Wave 5 uses it for charts)
- [ ] Admin users list available (Wave 5 needs it for notification targeting)
- [ ] All service layers complete

### F. Mock Data Final Audit
```bash
grep -rn "faker\|json-server\|msw\|mockOwner\|mockPayout\|fakeClient" \
  --include="*.ts" --include="*.tsx" .
grep -rn "'instapay'\|'vodafonecash'\|'super_admin'\|'pending'" \
  --include="*.ts" --include="*.tsx" lib/api/ components/admin/
grep -rn "commissionRate.*0\.\d\d\b" --include="*.ts" --include="*.tsx" components/
grep -rn "pagination\.total[^C]" --include="*.ts" --include="*.tsx" .
```
- [ ] All zero results
- [ ] Audit by: ____________ Date: ____________

### G. Sign-off Decision
```
[ ] WAVE 4 APPROVED — Wave 5 may begin.
[ ] WAVE 4 APPROVED WITH CONDITIONS — Conditions: _______________
[ ] WAVE 4 NOT APPROVED — Blockers: _______________
```
**Signed off by:** ______________ **Date:** ______________

---

# Wave 4 — Final Summary

| Track | # | Ticket | Key Deliverable |
|---|---|---|---|
| A | 1 | FE-4-FIN-01 | Finance types (PayoutStatus, PaymentMethod PascalCase) |
| A | 2 | FE-4-FIN-02 | Finance overview (6 stat cards, date filter) |
| A | 3 | FE-4-FIN-03 | Owner payouts (create→schedule→mark-paid lifecycle) |
| A | 4 | FE-4-FIN-04 | All payments list (with lifecycle actions) |
| A | 5 | FE-4-FIN-05 | Finance daily reports page |
| B | 6 | FE-4-OWN-01 | Owner types (commissionRate decimal, status lowercase) |
| B | 7 | FE-4-OWN-02 | Owners list (commission as %) |
| B | 8 | FE-4-OWN-03 | Create owner (commissionRate sent directly) |
| B | 9 | FE-4-OWN-04 | Owner detail (profile + payout summary) |
| B | 10 | FE-4-OWN-05 | Edit owner (pre-fill and send percentage directly) |
| B | 11 | FE-4-OWN-06 | Owner payout history tab |
| C | 12 | FE-4-CLI-01 | Client types + service |
| C | 13 | FE-4-CLI-02 | Clients list |
| C | 14 | FE-4-CLI-03 | Client detail + booking history |
| C | 15 | FE-4-ADM-01 | Admin users list + role/status management |
| C | 16 | FE-4-ADM-02 | Create admin user form |

**Key Pitfall Summary for this wave:**
- `commissionRate` → percentage contract end-to-end (send/display directly as 0..100)
- `PayoutStatus` → PascalCase (Pending/Scheduled/Paid/Cancelled)
- `OwnerStatus` → lowercase exception (active/inactive)
- `AdminRole` → PascalCase (SuperAdmin/Sales/Finance/Tech)
- Can't deactivate own admin account

**Next Wave:** Wave 5 — Dashboard + Reviews + Notifications (12 tickets).

*End of Wave 4 ticket pack.*

