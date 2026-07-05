# Wave 6 — Owner Portal
## Rental Platform Frontend — Complete Ticket Pack
**Wave Number:** 6
**Wave Name:** Owner Portal
**Total Tickets:** 12
**Estimated Days (1 dev):** 4
**Parallel Tracks:** 2 — Core Portal (Track A), Secondary Features (Track B)

---

## Wave 6 Overview

The Owner Portal is a completely separate app from the Admin Panel. Property owners log in at `/auth/owner/login` (built in FE-1-AUTH-02) and land on their own portal — different layout, different routes, different API endpoints (all prefixed `/api/owner/`), different data scope (their own units and bookings only).

**Track A — Core Portal (FE-6-OWN-01 → 06):**
Service layer + types, portal layout, dashboard, units view, bookings view, finance page.

**Track B — Secondary Features (FE-6-OWN-07 → 12):**
Notifications inbox, notification preferences, reviews list, review replies management, profile page, unit availability calendar.

**Critical Business Rules for Owner Portal:**
- Owner sees ONLY their own data — no other owner's units, bookings, or earnings
- Owner CANNOT approve or reject bookings (view-only)
- Owner CANNOT edit prices (Admin-only per frozen decision #9)
- Client personal details (phone, email) are NOT shown to owners — anonymized
- Owner CAN view confirmed bookings, earnings, and payout history
- Owner CAN reply to reviews on their units
- Owner CAN toggle visibility of their own reply

---

## ⛔ GLOBAL RULES

```
NO MOCK DATA — EVER.

All /api/owner/* endpoints require: subjectType = 'Owner' in JWT
These endpoints reject Admin tokens — test with real owner login

Owner Portal field names (DIFFERENT from admin):
- Unit: 'unitId' (not 'id'), 'unitName' (not 'name')
- Booking: 'bookingId' (not 'id'), 'bookingStatus' (not 'status')
- Client info: ANONYMIZED — only first name or initials shown

Pagination: totalCount + totalPages
NotificationChannel: 'Email' | 'SMS' | 'InApp' (PascalCase)
```

---

## Ticket List

| # | Ticket ID | Title | Track | Priority |
|---|-----------|-------|-------|----------|
| 1 | FE-6-OWN-01 | Create Owner Portal service layer + types | A | Critical |
| 2 | FE-6-OWN-02 | Build Owner Portal layout (sidebar + header) | A | Critical |
| 3 | FE-6-OWN-03 | Build Owner Dashboard page | A | Critical |
| 4 | FE-6-OWN-04 | Build Owner Units list + detail | A | Critical |
| 5 | FE-6-OWN-05 | Build Owner Bookings list + detail | A | Critical |
| 6 | FE-6-OWN-06 | Build Owner Finance page | A | Critical |
| 7 | FE-6-OWN-07 | Build Owner Notification inbox | B | High |
| 8 | FE-6-OWN-08 | Build Owner Notification preferences | B | High |
| 9 | FE-6-OWN-09 | Build Owner Reviews list | B | High |
| 10 | FE-6-OWN-10 | Build Owner Review Reply management | B | High |
| 11 | FE-6-OWN-11 | Build Owner Profile page | B | Medium |
| 12 | FE-6-OWN-12 | Build Owner Unit Availability calendar | B | Medium |

---

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TICKET ID: FE-6-OWN-01
TITLE: Create Owner Portal service layer + TypeScript types
WAVE: Wave 6 — Owner Portal
DOMAIN: OwnerPortal
PRIORITY: Critical
DEPENDS ON: FE-0-INFRA-03, FE-0-INFRA-04
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section 1 — Walkthrough

**What is this ticket about?**
All 12 Owner Portal tickets depend on typed API contracts for the `/api/owner/*` endpoints. This ticket creates the complete service layer and type definitions — distinct from the admin-side types (which use `/api/owners/*` — different routes, different shapes).

**The key naming distinction:**
- Admin route: `GET /api/owners/{id}` → `OwnerDetailsResponse` (admin sees ALL owners)
- Owner route: `GET /api/owner/units` → `OwnerPortalUnitResponse[]` (owner sees ONLY their own)

---

### Section 4 — In Scope

- [ ] `lib/types/owner-portal.types.ts`
- [ ] `lib/api/services/owner-portal.service.ts`
- [ ] `lib/hooks/useOwnerPortal.ts`

**Files to create:**
- `lib/types/owner-portal.types.ts`
- `lib/api/services/owner-portal.service.ts`
- `lib/hooks/useOwnerPortal.ts`

**Files to modify:**
- `lib/types/index.ts`

---

### Section 6 — Technical Contract

```typescript
// lib/types/owner-portal.types.ts
// All from KAZA_BOOKING_API_Reference.md /api/owner/* endpoints

// ── Dashboard Summary ──
interface OwnerPortalDashboardSummaryResponse {
  ownerId:             string
  totalUnits:          number
  activeUnits:         number
  totalBookings:       number
  confirmedBookings:   number
  completedBookings:   number
  totalPaidAmount:     number
  totalPendingPayoutAmount: number
  totalPaidPayoutAmount: number
}

// ── Unit (owner view — DIFFERENT from admin UnitDetailsResponse) ──
interface OwnerPortalUnitResponse {
  unitId:             string
  projectId:             string
  unitName:           string
  unitType:           string
  isActive:           boolean
  bedrooms:           number
  bathrooms:          number
  maxGuests:          number
  basePricePerNight:  number
  createdAt:          string
  updatedAt:          string
}

// ── Booking (owner view — ANONYMIZED client info) ──
interface OwnerPortalBookingResponse {
  bookingId:       string
  unitId:          string
  clientId:        string
  assignedAdminUserId: string | null
  checkInDate:     string
  checkOutDate:    string
  guestCount:      number
  bookingStatus:   string            // FormalBookingStatus
  finalAmount:     number
  source:          string
  createdAt:       string
  updatedAt:       string
}

// ── Finance row (per-booking earnings breakdown) ──
interface OwnerPortalFinanceRowResponse {
  bookingId:         string
  unitId:            string
  invoiceId:         string
  invoiceStatus:     string
  invoicedAmount:    number
  paidAmount:        number
  remainingAmount:   number
  payoutId:          string | null
  payoutStatus:      string | null
  payoutAmount:      number | null
  payoutScheduledAt: string | null
  payoutPaidAt:      string | null
}

// ── Finance Summary ──
interface OwnerPortalFinanceSummaryResponse {
  ownerId:                    string
  totalInvoicedAmount:        number
  totalPaidAmount:            number
  totalRemainingAmount:       number
  totalPendingPayoutAmount:   number
  totalScheduledPayoutAmount: number
  totalPaidPayoutAmount:      number
}

// ── Review Reply ──
interface ReviewReplyResponse {
  id:        string
  reviewId:  string
  ownerId:   string
  replyText: string
  isVisible: boolean
  createdAt: string
  updatedAt: string
}

interface CreateOrUpdateReviewReplyRequest {
  replyText: string
}

interface SetReviewReplyVisibilityRequest {
  isVisible: boolean
}

// ── Paginated types ──
interface PaginatedOwnerBookings {
  items:      OwnerPortalBookingResponse[]
  pagination: PaginationMeta
}

interface PaginatedOwnerFinance {
  items:      OwnerPortalFinanceRowResponse[]
  pagination: PaginationMeta
}
```

```typescript
// lib/api/services/owner-portal.service.ts
export const ownerPortalService = {
  // ── Dashboard ──
  getDashboard:     (): Promise<OwnerPortalDashboardSummaryResponse> =>
    api.get(endpoints.ownerPortal.dashboard),

  // ── Units ──
  getUnits:         (): Promise<OwnerPortalUnitResponse[]> =>
    api.get(endpoints.ownerPortal.units),

  getUnitById:      (unitId: string): Promise<OwnerPortalUnitResponse> =>
    api.get(endpoints.ownerPortal.unitById(unitId)),

  // ── Bookings ──
  getBookings:      (filters?: { status?: string; page?: number; pageSize?: number }): Promise<PaginatedOwnerBookings> =>
    api.get(endpoints.ownerPortal.bookings, { params: filters }),

  getBookingById:   (bookingId: string): Promise<OwnerPortalBookingResponse> =>
    api.get(endpoints.ownerPortal.bookingById(bookingId)),

  // ── Finance ──
  getFinance:       (filters?: { page?: number; pageSize?: number }): Promise<PaginatedOwnerFinance> =>
    api.get(endpoints.ownerPortal.finance, { params: filters }),

  getFinanceSummary: (): Promise<OwnerPortalFinanceSummaryResponse> =>
    api.get(endpoints.ownerPortal.financeSummary),

  getFinanceBooking: (bookingId: string): Promise<OwnerPortalFinanceRowResponse> =>
    api.get(endpoints.ownerPortal.financeBooking(bookingId)),

  // ── Review Replies ──
  getReply:         (reviewId: string): Promise<ReviewReplyResponse> =>
    api.get(endpoints.reviewReplies.get(reviewId)),

  upsertReply:      (reviewId: string, data: CreateOrUpdateReviewReplyRequest): Promise<ReviewReplyResponse> =>
    api.put(endpoints.reviewReplies.upsert(reviewId), data),

  deleteReply:      (reviewId: string): Promise<void> =>
    api.delete(endpoints.reviewReplies.delete(reviewId)),

  setReplyVisibility: (reviewId: string, data: SetReviewReplyVisibilityRequest): Promise<ReviewReplyResponse> =>
    api.patch(endpoints.reviewReplies.visibility(reviewId), data),

  // ── Notifications (already in notificationsService — these are aliases) ──
  getInbox:         () => notificationsService.getOwnerInbox(),
  getInboxSummary:  () => notificationsService.getOwnerSummary(),
  markRead:         (id: string) => notificationsService.markOwnerRead(id),
}
```

---

### Section 7 — API Integration

All 12 `/api/owner/*` endpoints covered.

---

### Section 12 — Acceptance Criteria

- [ ] `OwnerPortalUnitResponse` has `unitId` (not `id`), `unitName` (not `name`)
- [ ] `OwnerPortalBookingResponse` has `bookingId` (not `id`) and `finalAmount`
- [ ] `OwnerPortalBookingResponse` does not include client personal fields; anonymized client display fields are a backend gap unless documented
- [ ] `OwnerPortalFinanceSummaryResponse` matches documented `/api/owner/finance/summary` fields exactly
- [ ] `ReviewReplyResponse` has `isVisible` boolean
- [ ] `PaginatedOwnerBookings.pagination` uses `totalCount` + `totalPages`
- [ ] No `any` types, zero TypeScript errors, no mock data

---

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TICKET ID: FE-6-OWN-02
TITLE: Build Owner Portal layout (sidebar + header)
WAVE: Wave 6 — Owner Portal
DOMAIN: OwnerPortal
PRIORITY: Critical
DEPENDS ON: FE-6-OWN-01, FE-1-AUTH-02, FE-1-AUTH-06, FE-0-INFRA-05
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section 1 — Walkthrough

**What is this ticket about?**
The Owner Portal has its own layout — simpler than the admin shell, with a clean sidebar showing only the sections relevant to property owners: Dashboard, My Units, Bookings, Finance, Reviews, Notifications. The header shows the owner's name and a logout button.

**Why a separate layout?**
The admin layout (FE-2-ADMIN-01) is built for the admin team — it has role-based nav, complex filtering, and many sections. Owners need a simpler, cleaner experience — different branding project, fewer nav items, different color accent potentially.

---

### Section 2 — Objective

Build `app/(owner)/layout.tsx` with a clean owner-specific sidebar and header that wraps every Owner Portal page — using auth store to display owner info and the existing `<LogoutButton>`.

---

### Section 4 — In Scope

- [ ] `app/(owner)/layout.tsx`
- [ ] `components/owner/layout/OwnerSidebar.tsx`
- [ ] `components/owner/layout/OwnerHeader.tsx`
- [ ] `components/owner/layout/OwnerNav.tsx`
- [ ] Nav items (no permission filtering — all owners see all):
  - Dashboard (`ROUTES.owner.dashboard`) — LayoutDashboard icon
  - My Units (`ROUTES.owner.units`) — Home icon
  - Bookings (`ROUTES.owner.bookings`) — Calendar icon
  - Finance (`ROUTES.owner.finance`) — Wallet icon
  - Reviews — Star icon (navigates to unit's reviews list)
  - Notifications (`ROUTES.owner.notifications`) — Bell icon + unread count
- [ ] Sidebar: collapsible (uses `useUIStore.isSidebarOpen`)
- [ ] Header: owner name (`user.identifier` from auth store), logout button
- [ ] Notification bell in header: polls `GET /api/owner/me/notifications/inbox/summary`
- [ ] Guard: `usePermissions().isOwner` — if not owner, redirect to home

**Files to create:**
- `app/(owner)/layout.tsx`
- `components/owner/layout/OwnerSidebar.tsx`
- `components/owner/layout/OwnerHeader.tsx`
- `components/owner/layout/OwnerNav.tsx`
- `components/owner/layout/OwnerNotificationBell.tsx`

---

### Section 6 — Technical Contract

```typescript
// Nav config — no permission filtering needed (all owners see everything)
const OWNER_NAV_ITEMS = [
  { label: 'Dashboard',      icon: LayoutDashboard, href: ROUTES.owner.dashboard },
  { label: 'My Units',       icon: Home,            href: ROUTES.owner.units },
  { label: 'Bookings',       icon: Calendar,        href: ROUTES.owner.bookings },
  { label: 'Finance',        icon: Wallet,          href: ROUTES.owner.finance },
  { label: 'Reviews',        icon: Star,            href: ROUTES.owner.reviews },
  { label: 'Notifications',  icon: Bell,            href: ROUTES.owner.notifications },
] as const
```

---

### Section 7 — API Integration

| Method | Endpoint | Response | When |
|---|---|---|---|
| GET | `/api/owner/me/notifications/inbox/summary` | `NotificationRecipientInboxSummaryResponse` | polled every 2min |

---

### Section 12 — Acceptance Criteria

- [ ] Owner portal layout at `app/(owner)/layout.tsx` wraps all `/owner/*` pages
- [ ] Nav items are fixed (no permission filtering)
- [ ] `isOwner` check: if `subjectType !== 'Owner'` → redirect away
- [ ] Notification bell polls owner-specific endpoint (not admin)
- [ ] `user.identifier` shown (the phone number used to login)
- [ ] `<LogoutButton>` redirects to `/auth/owner/login` after logout (because `subjectType === 'Owner'`)
- [ ] No mock data

---

### Section 13 — Notes for AI / Common Mistakes

**DO NOT:**
- ⛔ NO MOCK DATA.
- Do NOT use the admin sidebar component — build a separate owner sidebar
- Do NOT reuse admin nav items or admin permission checks
- Do NOT use `user.name` — the auth store has `identifier` (the phone number)
- Do NOT show client phone/email in any owner portal page
- Do NOT use the admin notification bell — use `OwnerNotificationBell` with `/api/owner/me/notifications/inbox/summary`

---

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TICKET ID: FE-6-OWN-03
TITLE: Build Owner Dashboard page
WAVE: Wave 6 — Owner Portal
DOMAIN: OwnerPortal
PRIORITY: Critical
DEPENDS ON: FE-6-OWN-01, FE-6-OWN-02
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section 1 — Walkthrough

**What is this ticket about?**
The owner's first page after login — a summary of their portfolio from `GET /api/owner/dashboard`: unit counts, booking counts, paid totals, and payout totals. Simple, clean, immediately useful.

---

### Section 2 — Objective

Build the Owner Dashboard at `/owner/dashboard` using `GET /api/owner/dashboard` to show portfolio summary stats — the first thing an owner sees every time they log in.

---

### Section 4 — In Scope

- [ ] `app/(owner)/dashboard/page.tsx`
- [ ] **Stat cards:**
  - Total Units (activeUnits / totalUnits)
  - Confirmed Bookings
  - Completed Bookings
  - Total Paid Amount (`formatCurrency()`)
  - Pending Payout Amount (`formatCurrency()`)
- [ ] **Upcoming bookings section:** "Next 3 confirmed bookings" — mini list with unit, dates, guest count
- [ ] **Quick links:** "View all bookings", "View finance"
- [ ] Loading: skeleton cards

**Files to create:**
- `app/(owner)/dashboard/page.tsx`
- `components/owner/dashboard/OwnerStatCard.tsx`
- `components/owner/dashboard/UpcomingBookings.tsx`

---

### Section 7 — API Integration

| Method | Endpoint | Response | When |
|---|---|---|---|
| GET | `/api/owner/dashboard` | `OwnerPortalDashboardSummaryResponse` | on mount |
| GET | `/api/owner/bookings` | `PaginatedOwnerBookings` | for upcoming bookings section (status=Confirmed, pageSize=3) |

```typescript
export function useOwnerDashboard() {
  return useQuery({
    queryKey: queryKeys.ownerPortal.dashboard(),
    queryFn:  () => ownerPortalService.getDashboard(),
    staleTime: 1000 * 60 * 5,
  })
}
```

---

### Section 10 — UX & Loading State Rules

| State | Required? | Behavior |
|---|---|---|
| Loading | ✓ | 4 skeleton stat cards |
| No bookings | ✓ | "No upcoming bookings" text in that section |
| Zero earnings | ✓ | Show "0 EGP" — not empty state |

---

### Section 12 — Acceptance Criteria

- [ ] `formatCurrency()` for all money values
- [ ] Upcoming bookings uses `bookingId` for linking (not `id`)
- [ ] Stats from real API (no hardcoded numbers)
- [ ] `staleTime: 5 minutes`
- [ ] No mock data

---

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TICKET ID: FE-6-OWN-04
TITLE: Build Owner Units list + detail
WAVE: Wave 6 — Owner Portal
DOMAIN: OwnerPortal
PRIORITY: Critical
DEPENDS ON: FE-6-OWN-01, FE-6-OWN-02
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section 1 — Walkthrough

**What is this ticket about?**
Owners browse their own units at `/owner/units`. They can see each unit's name, type, price, current status, total bookings, and primary image. Clicking a unit shows a read-only detail view with the unit's info. No editing allowed — Owner cannot modify prices or details.

---

### Section 4 — In Scope

- [ ] `app/(owner)/units/page.tsx` — grid/list of owner's units
- [ ] `app/(owner)/units/[unitId]/page.tsx` — unit detail (read-only)
- [ ] Units list: card grid with unit image, name, project, type badge, price/night, status badge, booking count
- [ ] Unit detail:
  - Header: name, project, type, status, price/night
  - Amenities list (read-only)
  - Images gallery (thumbnails — no upload/edit)
  - "View Availability" button → navigates to `/owner/units/{unitId}/availability` (FE-6-OWN-12)
- [ ] Both pages: read-only. No create/edit/delete buttons.
- [ ] Image thumbnails use `next/image`

**Files to create:**
- `app/(owner)/units/page.tsx`
- `app/(owner)/units/[unitId]/page.tsx`
- `components/owner/units/OwnerUnitCard.tsx`
- `components/owner/units/OwnerUnitDetail.tsx`

---

### Section 7 — API Integration

| Method | Endpoint | Response | When |
|---|---|---|---|
| GET | `/api/owner/units` | `OwnerPortalUnitResponse[]` | on list mount |
| GET | `/api/owner/units/{unitId}` | `OwnerPortalUnitResponse` | on detail mount |

```typescript
export function useOwnerUnits() {
  return useQuery({
    queryKey: queryKeys.ownerPortal.units(),
    queryFn:  () => ownerPortalService.getUnits(),
    staleTime: 1000 * 60 * 5,
  })
}

export function useOwnerUnitDetail(unitId: string) {
  return useQuery({
    queryKey: queryKeys.ownerPortal.unitDetail(unitId),
    queryFn:  () => ownerPortalService.getUnitById(unitId),
    staleTime: 1000 * 60 * 5,
  })
}
```

---

### Section 12 — Acceptance Criteria

- [ ] `unit.unitId` used for navigation (not `unit.id`)
- [ ] `unit.unitName` displayed (not `unit.name`)
- [ ] NO edit/create/delete buttons — read-only throughout
- [ ] `next/image` for all unit images
- [ ] Empty state: "No units in your portfolio yet" (if owner has 0 units — edge case)
- [ ] No mock data

---

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TICKET ID: FE-6-OWN-05
TITLE: Build Owner Bookings list + detail
WAVE: Wave 6 — Owner Portal
DOMAIN: OwnerPortal
PRIORITY: Critical
DEPENDS ON: FE-6-OWN-01, FE-6-OWN-02
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section 1 — Walkthrough

**What is this ticket about?**
Owners view confirmed bookings for their units at `/owner/bookings`. They see anonymized client info (no phone/email), the unit, dates, guest count, and their earnings per booking. Clicking a booking shows the booking detail — again, read-only, anonymized.

**Critical business rule:** Owner CANNOT see client's phone or email. The documented owner-bookings response does not include a client display field. If anonymized display is required, it must be documented by backend first.

---

### Section 4 — In Scope

- [ ] `app/(owner)/bookings/page.tsx` — bookings list
- [ ] `app/(owner)/bookings/[bookingId]/page.tsx` — booking detail
- [ ] **List columns:** Unit Name, Check-in, Check-out, Nights, Status badge, Guests, Owner Earnings
- [ ] **Filters:** Status select, date range
- [ ] **Booking detail:**
  - Unit: unitName + type
  - Dates: check-in/out, nights count
  - Guests count
  - Status badge
  - Owner Earnings (formatted with `formatCurrency()`)
  - No client personal fields shown
- [ ] Read-only — no action buttons
- [ ] Pagination

**Files to create:**
- `app/(owner)/bookings/page.tsx`
- `app/(owner)/bookings/[bookingId]/page.tsx`
- `components/owner/bookings/OwnerBookingTable.tsx`
- `components/owner/bookings/OwnerBookingDetail.tsx`

---

### Section 7 — API Integration

| Method | Endpoint | Query | Response | When |
|---|---|---|---|---|
| GET | `/api/owner/bookings` | `{ status?, page?, pageSize? }` | `PaginatedOwnerBookings` | on list mount |
| GET | `/api/owner/bookings/{bookingId}` | — | `OwnerPortalBookingResponse` | on detail mount |

---

### Section 12 — Acceptance Criteria

- [ ] `booking.bookingId` used for navigation (not `booking.id`)
- [ ] `booking.bookingStatus` displayed via `<StatusBadge>` (FormalBookingStatus)
- [ ] `booking.finalAmount` displayed with `formatCurrency()`
- [ ] No client personal fields shown; if anonymized display is needed, treat as Backend Gap until documented
- [ ] NO action buttons — read-only throughout
- [ ] Pagination uses `totalCount` + `totalPages`
- [ ] No mock data

---

### Section 13 — Notes for AI / Common Mistakes

**DO NOT:**
- ⛔ NO MOCK DATA.
- Do NOT display `clientPhone`, `clientEmail`, or full client identity
- Do NOT add approve/reject/confirm buttons — owner has no lifecycle actions
- Do NOT use `booking.id` — use `booking.bookingId`

---

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TICKET ID: FE-6-OWN-06
TITLE: Build Owner Finance page
WAVE: Wave 6 — Owner Portal
DOMAIN: OwnerPortal
PRIORITY: Critical
DEPENDS ON: FE-6-OWN-01, FE-6-OWN-02
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section 1 — Walkthrough

**What is this ticket about?**
The Finance page at `/owner/finance` is where owners view documented finance totals and per-booking amounts from owner endpoints. This is read-only — owners cannot initiate or manage payouts (that's Admin's job).

---

### Section 4 — In Scope

- [ ] `app/(owner)/finance/page.tsx`
- [ ] **Summary cards (documented fields):** Total Invoiced Amount, Total Paid Amount, Total Remaining Amount, Total Pending Payout Amount, Total Scheduled Payout Amount, Total Paid Payout Amount
- [ ] **Per-booking finance table:**
  - Columns: Unit, Check-in, Check-out, Invoiced Amount, Paid Amount, Remaining Amount, Payout Amount, Payout Status, Paid Date
  - `payoutStatus` shown as `<StatusBadge>` using `PAYOUT_STATUS_LABELS`
  - `formatCurrency()` on all money columns
- [ ] Pagination
- [ ] Read-only — no payout actions (owner cannot request or manage payouts)

**Files to create:**
- `app/(owner)/finance/page.tsx`
- `components/owner/finance/OwnerFinanceSummary.tsx`
- `components/owner/finance/OwnerFinanceTable.tsx`

---

### Section 7 — API Integration

| Method | Endpoint | Response | When |
|---|---|---|---|
| GET | `/api/owner/finance/summary` | `OwnerPortalFinanceSummaryResponse` | on mount |
| GET | `/api/owner/finance` | `PaginatedOwnerFinance` | on mount |

**Backend gap note:** if `/api/owner/finance` list payload differs from `OwnerPortalFinanceRowResponse`, treat the list shape as backend gap until fully documented.

```typescript
export function useOwnerFinanceSummary() {
  return useQuery({
    queryKey: queryKeys.ownerPortal.financeSummary(),
    queryFn:  () => ownerPortalService.getFinanceSummary(),
    staleTime: 1000 * 60 * 5,
  })
}

export function useOwnerFinance(filters?: object) {
  return useQuery({
    queryKey: queryKeys.ownerPortal.finance(),
    queryFn:  () => ownerPortalService.getFinance(filters),
    staleTime: 1000 * 60 * 5,
    placeholderData: keepPreviousData,
  })
}
```

---

### Section 12 — Acceptance Criteria

- [ ] Summary cards map to documented fields from finance summary endpoint
- [ ] Per-booking table uses documented monetary fields (`invoicedAmount`, `paidAmount`, `remainingAmount`, `payoutAmount`) formatted
- [ ] `payoutStatus` badge: Pending=warning, Scheduled=info, Paid=success, Cancelled=danger
- [ ] Pagination uses `totalCount` + `totalPages`
- [ ] NO payout buttons — read-only
- [ ] `formatCurrency()` on all money values
- [ ] No mock data

---

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TICKET ID: FE-6-OWN-07
TITLE: Build Owner Notification inbox
WAVE: Wave 6 — Owner Portal
DOMAIN: OwnerPortal
PRIORITY: High
DEPENDS ON: FE-6-OWN-01, FE-6-OWN-02, FE-5-NOT-01
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section 1 — Walkthrough

**What is this ticket about?**
Owner receives notifications when bookings are confirmed on their units, when they receive payouts, etc. This page shows their notification inbox — same pattern as the admin inbox (FE-5-NOT-03) but using owner-specific endpoints.

---

### Section 4 — In Scope

- [ ] `app/(owner)/notifications/page.tsx`
- [ ] `GET /api/owner/me/notifications/inbox`
- [ ] `POST /api/owner/me/notifications/inbox/{notificationId}/read`
- [ ] Same display pattern as admin inbox: unread bold, channel badge, timestamp, mark read on click
- [ ] "Mark all as read" button

**Files to create:**
- `app/(owner)/notifications/page.tsx`
- `components/owner/notifications/OwnerNotificationItem.tsx` (or reuse admin component if generic enough)

---

### Section 7 — API Integration

| Method | Endpoint | Response | When |
|---|---|---|---|
| GET | `/api/owner/me/notifications/inbox` | `NotificationListItemResponse[]` | on mount |
| POST | `/api/owner/me/notifications/inbox/{notificationId}/read` | void | on click |

```typescript
export function useOwnerInbox() {
  return useQuery({
    queryKey: queryKeys.notifications.ownerInbox(),
    queryFn:  () => notificationsService.getOwnerInbox(),
    staleTime: 0,
  })
}
```

#### 7d. Mutation Side Effects

```typescript
// After mark read:
queryClient.invalidateQueries({ queryKey: queryKeys.notifications.ownerInbox() })
queryClient.invalidateQueries({ queryKey: queryKeys.notifications.ownerInboxSummary() })
// ↑ Updates bell count in header
```

---

### Section 12 — Acceptance Criteria

- [ ] Owner-specific endpoints used (`/api/owner/me/...` not `/api/internal/me/...`)
- [ ] `notificationId` used in mark-read URL (not `id`)
- [ ] Both inbox + summary invalidated after mark-read (bell count updates)
- [ ] `NotificationChannel` labels: 'InApp' → "In-app"
- [ ] No mock data

---

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TICKET ID: FE-6-OWN-08
TITLE: Build Owner Notification preferences
WAVE: Wave 6 — Owner Portal
DOMAIN: OwnerPortal
PRIORITY: High
DEPENDS ON: FE-6-OWN-07
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section 1 — Walkthrough

**What is this ticket about?**
Owner controls which notifications they receive — same pattern as admin (FE-5-NOT-04) but using owner endpoints. A settings tab within the notifications page.

---

### Section 4 — In Scope

- [ ] Tab or section within `/owner/notifications` page
- [ ] `GET /api/owner/me/notification-preferences`
- [ ] `PUT /api/owner/me/notification-preferences`
- [ ] Toggle matrix: notification type × channel
- [ ] Channel sent as PascalCase: 'Email', 'SMS', 'InApp'

**Files to create:**
- `components/owner/notifications/OwnerNotificationPreferences.tsx`

---

### Section 7 — API Integration

| Method | Endpoint | Request | When |
|---|---|---|---|
| GET | `/api/owner/me/notification-preferences` | — | on mount |
| PUT | `/api/owner/me/notification-preferences` | `UpsertNotificationPreferenceRequest` | on toggle |

---

### Section 12 — Acceptance Criteria

- [ ] Owner-specific endpoint (`/api/owner/me/...` not `/api/internal/me/...`)
- [ ] `channel` PascalCase: 'Email', 'SMS', 'InApp'
- [ ] Toggle fires immediately (no batch save)
- [ ] No mock data

---

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TICKET ID: FE-6-OWN-09
TITLE: Build Owner Reviews list
WAVE: Wave 6 — Owner Portal
DOMAIN: OwnerPortal
PRIORITY: High
DEPENDS ON: FE-6-OWN-04, FE-5-REV-01
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section 1 — Walkthrough

**What is this ticket about?**
Owners can see published reviews left on their units. This gives them feedback on client experiences. The owner views reviews per unit — selecting a unit and seeing its published reviews, ratings, titles, comments, and whether they've replied.

---

### Section 4 — In Scope

- [ ] `app/(owner)/reviews/page.tsx`
- [ ] Unit selector Combobox (from `GET /api/owner/units`)
- [ ] After unit selected: `GET /api/public/units/{unitId}/reviews` — published reviews only
- [ ] Review summary bar: average rating (stars + number), total review count
- [ ] Each review card: client display name, rating stars, title, comment, date, reply indicator
- [ ] Reply status: "Owner replied" badge or "Reply" button (FE-6-OWN-10)
- [ ] Clicking review → opens reply management panel/drawer

**Files to create:**
- `app/(owner)/reviews/page.tsx`
- `components/owner/reviews/OwnerReviewCard.tsx`
- `components/owner/reviews/OwnerReviewSummary.tsx`

---

### Section 7 — API Integration

| Method | Endpoint | Response | When |
|---|---|---|---|
| GET | `/api/owner/units` | `OwnerPortalUnitResponse[]` | on mount (for selector) |
| GET | `/api/public/units/{unitId}/reviews` | `PublishedReviewListItemResponse[]` | on unit select |
| GET | `/api/public/units/{unitId}/reviews/summary` | `UnitPublishedReviewSummaryResponse` | on unit select |

---

### Section 12 — Acceptance Criteria

- [ ] Only PUBLISHED reviews shown (public endpoint returns published only)
- [ ] Average rating shown with visual stars
- [ ] `reviewId` used for reply management
- [ ] `ownerReplyText` not null → "Replied" badge shown
- [ ] Unit selector from real API (owner's units only)
- [ ] No mock data

---

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TICKET ID: FE-6-OWN-10
TITLE: Build Owner Review Reply management
WAVE: Wave 6 — Owner Portal
DOMAIN: OwnerPortal
PRIORITY: High
DEPENDS ON: FE-6-OWN-09, FE-6-OWN-01
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section 1 — Walkthrough

**What is this ticket about?**
This is the feature confirmed by the Validation Report v2 — the backend DOES support owner review replies. Owners can write a reply to a published review, edit it, delete it, or toggle its visibility (hide their reply temporarily). This builds the reply UI within the reviews page.

**The backend has confirmed these endpoints exist:**
- `GET /api/owner/reviews/{reviewId}/reply`
- `PUT /api/owner/reviews/{reviewId}/reply` (create or update)
- `DELETE /api/owner/reviews/{reviewId}/reply`
- `PATCH /api/owner/reviews/{reviewId}/reply/visibility`

---

### Section 2 — Objective

Build the review reply panel within the owner reviews page that lets owners write, edit, delete, and toggle visibility of their replies to client reviews.

---

### Section 4 — In Scope

- [ ] `components/owner/reviews/OwnerReviewReplyPanel.tsx` — slides open from review card
- [ ] Shows the original review (read-only: stars, title, comment)
- [ ] **If no reply exists:**
  - Textarea + "Post Reply" button
  - `PUT /api/owner/reviews/{reviewId}/reply` with `{ replyText }`
- [ ] **If reply exists:**
  - Shows reply text
  - Visibility toggle: "Visible to public" / "Hidden" → `PATCH /api/owner/reviews/{reviewId}/reply/visibility`
  - "Edit Reply" button → inline textarea edit → `PUT` again
  - "Delete Reply" button → `<ConfirmDialog>` → `DELETE`
- [ ] Character limit: `replyText` max 1000 chars (show counter)

**Files to create:**
- `components/owner/reviews/OwnerReviewReplyPanel.tsx`

---

### Section 6 — Technical Contract

```typescript
interface OwnerReviewReplyPanelProps {
  reviewId:       string
  review:         PublishedReviewListItemResponse
  existingReply?: ReviewReplyResponse   // null if no reply yet
  onClose:        () => void
}

// Zod schema:
const replySchema = z.object({
  replyText: z.string()
               .min(1, 'Reply cannot be empty')
               .max(1000, 'Reply cannot exceed 1000 characters'),
})
```

---

### Section 7 — API Integration

| Method | Endpoint | Request | Response | When |
|---|---|---|---|---|
| GET | `/api/owner/reviews/{reviewId}/reply` | — | `ReviewReplyResponse` | on panel open |
| PUT | `/api/owner/reviews/{reviewId}/reply` | `{ replyText }` | `ReviewReplyResponse` | on post/edit |
| DELETE | `/api/owner/reviews/{reviewId}/reply` | — | void | on delete confirm |
| PATCH | `/api/owner/reviews/{reviewId}/reply/visibility` | `{ isVisible: boolean }` | `ReviewReplyResponse` | on visibility toggle |

#### 7d. Mutation Side Effects

```typescript
// After any reply mutation:
queryClient.invalidateQueries({ queryKey: queryKeys.reviews.reply(reviewId) })
queryClient.invalidateQueries({ queryKey: queryKeys.reviews.publicByUnit(unitId) })
// ↑ Refreshes the review list to show updated reply status
```

---

### Section 12 — Acceptance Criteria

- [ ] `PUT` used for both create AND update (upsert pattern)
- [ ] Delete requires `<ConfirmDialog>`
- [ ] Visibility toggle: shows `isVisible` current state, toggles on click
- [ ] Character counter shows remaining chars when typing
- [ ] Both reply + unit reviews invalidated after mutations
- [ ] No mock data

---

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TICKET ID: FE-6-OWN-11
TITLE: Build Owner Profile page
WAVE: Wave 6 — Owner Portal
DOMAIN: OwnerPortal
PRIORITY: Medium
DEPENDS ON: FE-6-OWN-02
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section 1 — Walkthrough

**What is this ticket about?**
A simple profile page at `/owner/profile` showing the owner's own contact info (name, phone, email) and their commission rate. Read-only — owners cannot edit their own profile (Admin manages that). Useful as a reference: "what email is on file for me?"

---

### Section 4 — In Scope

- [ ] `app/(owner)/profile/page.tsx`
- [ ] Display: Name, Phone, Email (or "Not on file"), Commission Rate (as %)
- [ ] "To update your information, contact the platform administrator" notice
- [ ] Data source: documented owner endpoint fields only
  - **Backend gap:** owner profile endpoint is not documented. If richer profile data is required, backend contract must be documented first.

**Files to create:**
- `app/(owner)/profile/page.tsx`
- `components/owner/profile/OwnerProfileCard.tsx`

---

### Section 12 — Acceptance Criteria

- [ ] Commission rate shown as % (multiply by 100)
- [ ] "Contact admin to update" notice visible
- [ ] No edit buttons
- [ ] No mock data

---

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TICKET ID: FE-6-OWN-12
TITLE: Build Owner Unit Availability calendar
WAVE: Wave 6 — Owner Portal
DOMAIN: OwnerPortal
PRIORITY: Medium
DEPENDS ON: FE-6-OWN-04, FE-6-OWN-01
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section 1 — Walkthrough

**What is this ticket about?**
Owners want to see when their units are booked, blocked, or available. The availability calendar at `/owner/units/{unitId}/availability` shows a monthly view — same visual as the admin availability calendar (FE-2-UNITS-10) but using the public availability endpoint (owner token is accepted) and shown in read-only mode.

---

### Section 4 — In Scope

- [ ] `app/(owner)/units/[unitId]/availability/page.tsx`
- [ ] Month navigation (prev/next)
- [ ] `POST /api/units/{unitId}/availability/operational-check` — same endpoint as admin (accepts owner token)
- [ ] Calendar grid: Available (white) / Booked (terracotta) / Blocked (neutral gray)
- [ ] Legend below calendar
- [ ] Read-only — no click-to-block (owner cannot create date blocks)
- [ ] "View Availability" link from `/owner/units/{unitId}` page

**Files to create:**
- `app/(owner)/units/[unitId]/availability/page.tsx`
- Reuse `<AvailabilityCalendar>` from `components/admin/units/AvailabilityCalendar.tsx` if generic enough — or create `components/owner/units/OwnerAvailabilityCalendar.tsx`

---

### Section 7 — API Integration

| Method | Endpoint | Request | Response | When |
|---|---|---|---|---|
| POST | `/api/units/{unitId}/availability/operational-check` | `{ startDate, endDate }` | `OperationalAvailabilityResponse` | on month change |

**Note:** This is the PUBLIC `/api/units/` endpoint — the same one used by the guest app. Owner token is accepted here. `unitId` must be one of the owner's units (backend enforces this).

---

### Section 12 — Acceptance Criteria

- [ ] Calendar shows real booked + blocked dates from API
- [ ] `staleTime: 0` — availability always fresh
- [ ] Read-only (no click interactions)
- [ ] Month navigation updates the API call range
- [ ] `unitId` from URL params (owner's own unit)
- [ ] No mock data

---

---

# Wave 6 — QA Prompt

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WAVE QA REVIEW PROMPT
Wave: 6 — Owner Portal
Tickets: FE-6-OWN-01 through FE-6-OWN-12
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You are a senior QA engineer reviewing Wave 6 — the Owner Portal.

## MOCK DATA AUDIT — HARD GATE

```bash
grep -rn "mockUnit\|fakeUnit\|sampleBooking\|mockOwner\|Ahmed.*phone\|0100" \
  --include="*.ts" --include="*.tsx" components/owner/ app/\(owner\)/

grep -rn "clientPhone\|clientEmail\|client\.phone\|client\.email" \
  --include="*.ts" --include="*.tsx" components/owner/
# ↑ MUST return zero — client contact info is NEVER shown in owner portal

grep -rn "'in_app'\|channel.*in_app" \
  --include="*.ts" --include="*.tsx" components/owner/ lib/api/services/owner-portal.service.ts
# Must be 'InApp'

grep -rn "unit\.id[^s]\|unit\.name\b\|booking\.id[^s]\|booking\.status\b" \
  --include="*.ts" --include="*.tsx" components/owner/ app/\(owner\)/
# Must use unitId, unitName, bookingId, bookingStatus
```

## CRITICAL SECURITY AUDIT — CLIENT DATA ANONYMIZATION

This is the most important check in Wave 6. Run manually:

1. Log in as an Owner
2. Navigate to /owner/bookings
3. Click any booking
4. Inspect the booking detail page

**Expected:** No client personal fields shown in owner booking views.
**FAIL if:** Any of these appear: phone number, email address, full client name, clientId

```bash
# Code audit:
grep -rn "clientPhone\|clientEmail\|client\.email\|client\.phone" \
  --include="*.tsx" app/\(owner\)/ components/owner/
# Must return ZERO results
```

## API CONTRACT VERIFICATION

### Owner Portal Field Names:
- [ ] `unit.unitId` used (not `unit.id`)
- [ ] `unit.unitName` used (not `unit.name`)
- [ ] `booking.bookingId` used (not `booking.id`)
- [ ] `booking.bookingStatus` used (not `booking.status`)
- [ ] `booking.finalAmount` shown (not legacy earnings aliases)

### Owner-specific Endpoints:
- [ ] Dashboard: `GET /api/owner/dashboard` (not `/api/internal/*`)
- [ ] Units: `GET /api/owner/units` (not `/api/internal/units`)
- [ ] Bookings: `GET /api/owner/bookings` (not `/api/internal/bookings`)
- [ ] Finance: `GET /api/owner/finance/summary` + `GET /api/owner/finance`
- [ ] Notifications: `GET /api/owner/me/notifications/inbox` (not `/api/internal/me/...`)
- [ ] Notification preferences: `GET /api/owner/me/notification-preferences`

### Review Replies:
- [ ] `PUT` used for BOTH create AND update (upsert pattern)
- [ ] Delete uses `<ConfirmDialog>`
- [ ] Visibility toggle: `PATCH` with `{ isVisible: boolean }`
- [ ] Both reply query + unit reviews query invalidated after mutations

### Commission Rate:
- [ ] Displayed as percentage value from API (no multiply-by-100 conversion)
- [ ] NOT sent to API from owner portal (read-only)

### Notification Channel:
- [ ] 'InApp' (not 'in_app')

## PER-TICKET CHECKS

### FE-6-OWN-01 — Types
- [ ] No undocumented client display field in `OwnerPortalBookingResponse` (backend gap if needed)
- [ ] `unitId` and `unitName` in OwnerPortalUnitResponse
- [ ] `bookingId` and `finalAmount` in OwnerPortalBookingResponse
- [ ] `ReviewReplyResponse` has `isVisible` boolean

### FE-6-OWN-02 — Layout
- [ ] Owner-specific notification bell endpoint (`/api/owner/me/...`)
- [ ] `isOwner` check in layout
- [ ] `user.identifier` shown (phone number)
- [ ] Logout redirects to `/auth/owner/login`

### FE-6-OWN-03 — Dashboard
- [ ] Dashboard stat cards map directly to documented `/api/owner/dashboard` fields
- [ ] Upcoming bookings from real API
- [ ] `formatCurrency()` on money values

### FE-6-OWN-04 — Units
- [ ] `unitId` for navigation (not `id`)
- [ ] `unitName` for display (not `name`)
- [ ] NO edit buttons visible

### FE-6-OWN-05 — Bookings
- [ ] No client personal fields displayed
- [ ] `bookingId` for navigation
- [ ] `finalAmount` displayed (not legacy earnings aliases)
- [ ] NO action buttons (view-only)

### FE-6-OWN-06 — Finance
- [ ] Finance summary + per-booking table
- [ ] `commissionAmount` visible to owner (they should know the commission rate)
- [ ] `payoutStatus` badge using PAYOUT_STATUS_LABELS
- [ ] NO payout creation buttons

### FE-6-OWN-07 — Notifications Inbox
- [ ] `/api/owner/me/notifications/inbox` endpoint
- [ ] `notificationId` in mark-read URL
- [ ] Both inbox + summary invalidated

### FE-6-OWN-08 — Notification Preferences
- [ ] `/api/owner/me/notification-preferences` endpoint
- [ ] `channel: 'InApp'` (not 'in_app')

### FE-6-OWN-09 — Reviews List
- [ ] Published reviews only shown
- [ ] Reply status indicator on each review card
- [ ] Unit selector from owner's own units

### FE-6-OWN-10 — Review Replies
- [ ] `PUT` for create AND update
- [ ] DELETE with ConfirmDialog
- [ ] PATCH for visibility toggle
- [ ] Character counter shown (max 1000)
- [ ] Both queries invalidated after mutation

### FE-6-OWN-11 — Profile
- [ ] Commission as %
- [ ] No edit buttons
- [ ] "Contact admin to update" notice

### FE-6-OWN-12 — Availability Calendar
- [ ] Uses `/api/units/{unitId}/availability/operational-check` (POST)
- [ ] `staleTime: 0`
- [ ] Read-only (no click to block)

## ARCHITECTURE CHECKS
- [ ] Owner portal uses `app/(owner)/` route group exclusively
- [ ] No admin endpoints called from owner portal (`/api/internal/*` not used)
- [ ] No inline endpoint strings
- [ ] `pnpm type-check` → zero errors

## BUSINESS VALIDATION

| Test | Expected |
|---|---|
| Owner logs in with phone+password | Lands on /owner/dashboard |
| Owner views dashboard | Real stats shown (no hardcoded) |
| Owner browses My Units | Their units only (no other owners') |
| Owner clicks a booking | Sees anonymized client, no phone/email |
| Owner views finance | Commission breakdown + payout status |
| Owner receives booking notification | Bell count increases |
| Owner writes reply to review | Reply saved, visible on public site |
| Owner hides their reply | Reply hidden from public |
| Owner views availability calendar | Blocked + booked dates shown visually |

## Wave 6 Sign-off Recommendation
[ ] APPROVED
[ ] CONDITIONAL — conditions: ...
[ ] BLOCKED — blockers: ...
```

---

---

# Wave 6 — PM Sign-off Checklist

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PM WAVE SIGN-OFF CHECKLIST
Wave: 6 — Owner Portal
Date: _______________
Reviewed by: _______________
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### A. QA Report Review
- [ ] QA report received, all BLOCKERs resolved
- [ ] **CLIENT DATA ANONYMIZATION AUDIT PASSED** — no phone/email shown in owner portal

### B. Business Requirements Validation

| Scenario | Tested | Pass/Fail |
|---|---|---|
| Owner logs in → sees dashboard with real stats | | |
| Owner views their units (not other owners' units) | | |
| Owner views a booking — NO client phone/email shown | | |
| Owner sees their earnings + commission breakdown | | |
| Owner receives in-app notification, bell shows count | | |
| Owner replies to a review | | |
| Owner hides their reply | | |
| Owner views availability calendar for a unit | | |
| Admin visits /owner/dashboard → redirect happens | | |
| Owner visits /admin/crm → middleware redirects | | |

### C. Security Checklist
- [ ] **Client anonymization confirmed** — no phone, no email, no full name in booking views
- [ ] Owner can only view their OWN units (not other owners')
- [ ] Owner cannot create/edit/delete anything (units, prices, date blocks)
- [ ] Owner cannot initiate or cancel payouts
- [ ] Owner portal uses owner-specific API endpoints only

### D. Definition of Done
- [ ] `pnpm type-check` clean
- [ ] `pnpm lint` clean
- [ ] All 12 tickets merged
- [ ] Mock data audit passed
- [ ] Client anonymization audit passed
- [ ] `unitId`/`unitName`/`bookingId`/`bookingStatus` field names correct

### E. Next Wave Readiness (Wave 7 — Guest App)
- [ ] Auth system (Wave 1) supports client login + registration
- [ ] Public units endpoint works (`GET /api/units`)
- [ ] Public reviews endpoint works
- [ ] CRM lead creation endpoint (`POST /api/crm/leads`) ready for booking form
- [ ] `notificationsService.getClientInbox()` already built (FE-5-NOT-01)

### F. Mock + Security Final Audit
```bash
# Mock data:
grep -rn "faker\|mockUnit\|fakeUnit\|mockOwner" \
  --include="*.ts" --include="*.tsx" components/owner/ app/\(owner\)/

# Client data exposure:
grep -rn "clientPhone\|clientEmail\|client\.phone\|client\.email" \
  --include="*.tsx" app/\(owner\)/ components/owner/

# Field name correctness:
grep -rn "unit\.id[^s]\|unit\.name\b\|booking\.id[^s]" \
  --include="*.tsx" components/owner/ app/\(owner\)/
```
- [ ] All zero results
- [ ] Audit by: ____________ Date: ____________

### G. Sign-off Decision
```
[ ] WAVE 6 APPROVED — Wave 7 (Guest App) may begin.
[ ] WAVE 6 APPROVED WITH CONDITIONS — Conditions: _______________
[ ] WAVE 6 NOT APPROVED — Blockers: _______________
```
**Signed off by:** ______________ **Date:** ______________

---

# Wave 6 — Final Summary

| Track | # | Ticket | Key Deliverable |
|---|---|---|---|
| A | 1 | FE-6-OWN-01 | Owner Portal types (unitId, unitName, anonymized client) |
| A | 2 | FE-6-OWN-02 | Owner layout (owner-specific nav, bell, logout → owner login) |
| A | 3 | FE-6-OWN-03 | Owner Dashboard (real stats from /api/owner/dashboard) |
| A | 4 | FE-6-OWN-04 | Units list + detail (read-only, unitId/unitName) |
| A | 5 | FE-6-OWN-05 | Bookings list + detail (anonymized client, finalAmount) |
| A | 6 | FE-6-OWN-06 | Finance page (earnings + payout status, read-only) |
| B | 7 | FE-6-OWN-07 | Owner notification inbox (/api/owner/me/...) |
| B | 8 | FE-6-OWN-08 | Owner notification preferences (InApp not in_app) |
| B | 9 | FE-6-OWN-09 | Reviews list (published only, per unit) |
| B | 10 | FE-6-OWN-10 | Review replies (PUT upsert + DELETE + visibility PATCH) |
| B | 11 | FE-6-OWN-11 | Owner profile page (read-only) |
| B | 12 | FE-6-OWN-12 | Unit availability calendar (read-only, POST check endpoint) |

**Key Pitfalls Summary:**
- `unitId` / `unitName` (NOT `id` / `name`) throughout
- `bookingId` / `bookingStatus` / `finalAmount` (NOT `id` / `status` / legacy aliases)
- Client info ANONYMIZED — zero exposure of phone/email
- Owner portal endpoints: `/api/owner/*` (NOT `/api/internal/*` or `/api/owners/*`)
- Review reply: `PUT` = upsert (create + update same endpoint)
- Notification channel: 'InApp' (NOT 'in_app')

**Next Wave:** Wave 7 — Guest App (~30+ tickets — the public-facing cinematic experience).

*End of Wave 6 ticket pack.*
