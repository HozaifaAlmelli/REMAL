# Wave 2 — Admin Shell + Units Domain
## Rental Platform Frontend — Complete Ticket Pack
**Wave Number:** 2
**Wave Name:** Admin Shell + Units Domain
**Total Tickets:** 14
**Estimated Days (1 dev):** 5
**Parallel Tracks:** Partial — Admin Shell (Track A, 4 tickets) and Units Domain (Track B, 10 tickets). Track B tickets FE-2-UNITS-01 through FE-2-UNITS-03 can start in parallel with Track A. FE-2-UNITS-04+ depend on FE-2-ADMIN-01 (admin layout must exist).

---

## Wave 2 Overview

**Track A — Admin Shell (FE-2-ADMIN-01 → 04):**
The persistent admin layout (sidebar + header), the dashboard overview page, projects management, and amenities management. After Track A, the admin panel has a working navigation shell and the first two data-management modules.

**Track B — Units Domain (FE-2-UNITS-01 → 10):**
Everything related to managing rental units: service layer + types, list with filters, create form, detail page, edit form, image management, amenities assignment, date blocking, seasonal pricing, and the availability calendar. After Track B, a SuperAdmin or Tech user can fully manage the property inventory.

---

## ⛔ GLOBAL RULES — ENFORCED IN EVERY TICKET

```
NO MOCK DATA — EVER.
All data from real API only. No hardcoded arrays, no faker, no placeholder objects.

ENUM VALUES — PascalCase throughout:
Unit type:    'villa' | 'chalet' | 'studio'  (lowercase — API design)
Unit active state: isActive boolean
Date block reason: 'Maintenance' | 'OwnerUse' | 'Other'
Admin roles:  'SuperAdmin' | 'Sales' | 'Finance' | 'Tech'

PAGINATION — API uses totalCount + totalPages (not total):
{ page, pageSize, totalCount, totalPages }

NO INLINE STRINGS — endpoints from endpoints.ts, routes from routes.ts, enums from constants/
```

---

## Ticket List

| # | Ticket ID | Title | Track | Priority | Depends On |
|---|-----------|-------|-------|----------|------------|
| 1 | FE-2-ADMIN-01 | Build Admin Shell Layout (sidebar + header) | A | Critical | FE-1-AUTH-01, FE-1-AUTH-06, FE-1-UI-10 |
| 2 | FE-2-ADMIN-02 | Build Admin Dashboard overview page | A | High | FE-2-ADMIN-01 |
| 3 | FE-2-ADMIN-03 | Build Projects management (list + CRUD + status) | A | High | FE-2-ADMIN-01, FE-1-UI-01..04 |
| 4 | FE-2-ADMIN-04 | Build Amenities management | A | Medium | FE-2-ADMIN-01 |
| 5 | FE-2-UNITS-01 | Create Units service layer + TypeScript types | B | Critical | FE-0-INFRA-03, FE-0-INFRA-04 |
| 6 | FE-2-UNITS-02 | Build Units list page (admin internal view) | B | Critical | FE-2-UNITS-01, FE-2-ADMIN-01 |
| 7 | FE-2-UNITS-03 | Build Create Unit form | B | Critical | FE-2-UNITS-01, FE-2-ADMIN-03 |
| 8 | FE-2-UNITS-04 | Build Unit Detail page (tabbed layout) | B | Critical | FE-2-UNITS-01, FE-2-ADMIN-01 |
| 9 | FE-2-UNITS-05 | Build Edit Unit form | B | High | FE-2-UNITS-04 |
| 10 | FE-2-UNITS-06 | Build Unit Images management | B | High | FE-2-UNITS-04 |
| 11 | FE-2-UNITS-07 | Build Unit Amenities assignment | B | High | FE-2-UNITS-04, FE-2-ADMIN-04 |
| 12 | FE-2-UNITS-08 | Build Date Blocks management | B | High | FE-2-UNITS-04, FE-1-UI-08 |
| 13 | FE-2-UNITS-09 | Build Seasonal Pricing management | B | High | FE-2-UNITS-04, FE-1-UI-08 |
| 14 | FE-2-UNITS-10 | Build Unit Availability calendar | B | Medium | FE-2-UNITS-04, FE-2-UNITS-08, FE-2-UNITS-09 |

---

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TICKET ID: FE-2-ADMIN-01
TITLE: Build Admin Shell Layout (sidebar + header)
WAVE: Wave 2 — Admin Shell + Units Domain
DOMAIN: Admin
PRIORITY: Critical
DEPENDS ON: FE-1-AUTH-01, FE-1-AUTH-06, FE-1-UI-10, FE-0-INFRA-05
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section 1 — Walkthrough

**What is this ticket about?**
Every admin page (dashboard, CRM, bookings, finance, units, owners, clients, reviews) shares the same persistent shell: a collapsible sidebar on the left and a top header with the user's name, role badge, and a logout button. The sidebar shows navigation links filtered by the current user's role — a Finance user doesn't see the CRM link, a Tech user doesn't see Finance. This ticket builds that shell as a shared layout at `app/(admin)/layout.tsx`.

**Why does this ticket exist NOW?**
Every Wave 2–5 admin page renders inside this layout. Without it, there's nowhere to put the admin pages.

**What does success look like?**
An admin logs in and sees a sidebar with their allowed nav items. The sidebar collapses on click (state persists via Zustand UIStore). The top header shows their `identifier` (from the auth store) and a role badge. Clicking "Sign Out" triggers the logout flow from FE-1-AUTH-06.

---

### Section 2 — Objective

Build the persistent admin shell layout at `app/(admin)/layout.tsx` with a role-aware sidebar, collapsible navigation, and top header with user info and logout — so every Wave 2–5 admin page has a consistent, permission-aware wrapper.

---

### Section 3 — User-Facing Outcome

The admin user can:
- See the sidebar with navigation items relevant to their role only
- Collapse/expand the sidebar (state persists in UIStore)
- See their identifier (email) and role in the header
- Click "Sign Out" from the header to log out
- Navigate between admin sections via the sidebar

---

### Section 4 — In Scope

- [ ] Create `app/(admin)/layout.tsx` — wraps all admin pages
- [ ] Create `components/admin/layout/AdminSidebar.tsx`
- [ ] Create `components/admin/layout/AdminHeader.tsx`
- [ ] Create `components/admin/layout/AdminNav.tsx` — nav items list
- [ ] Sidebar uses `useUIStore` for `isSidebarOpen` + `toggleSidebar()`
- [ ] Sidebar nav items defined as a config array — each item has: label, icon (lucide-react), href (from ROUTES), `requiredPermission` key from `usePermissions()`
- [ ] Nav items filtered at render time using `usePermissions()` — hidden if user lacks permission
- [ ] Active nav item highlighted (using `usePathname()`)
- [ ] Header shows: platform logo/name, current user `identifier` (from auth store), `role` badge (`<Badge>` from FE-1-UI-07), `<LogoutButton>` from FE-1-AUTH-06
- [ ] Admin layout does NOT fetch any API data — pure UI shell

**Nav items and required permissions:**

| Nav Item | Icon | Route | Required Permission |
|---|---|---|---|
| Dashboard | LayoutDashboard | `ROUTES.admin.dashboard` | any admin |
| CRM | Users | `ROUTES.admin.crm.index` | `canViewCRM` |
| Bookings | Calendar | `ROUTES.admin.bookings.list` | `canViewBookings` |
| Finance | Wallet | `ROUTES.admin.finance` | `canViewFinance` |
| Units | Home | `ROUTES.admin.units.list` | `canViewUnits` |
| Owners | Building2 | `ROUTES.admin.owners.list` | `canViewOwners` |
| Clients | UserCheck | `ROUTES.admin.clients.list` | `canViewClients` |
| Reviews | Star | `ROUTES.admin.reviews` | `canModerateReviews` |
| Admin Users | Shield | `ROUTES.admin.settings` | `canManageAdminUsers` |

**Files to create:**
- `app/(admin)/layout.tsx`
- `components/admin/layout/AdminSidebar.tsx`
- `components/admin/layout/AdminHeader.tsx`
- `components/admin/layout/AdminNav.tsx`

---

### Section 5 — Out of Scope

- Do NOT fetch any data in the layout — no API calls here
- Do NOT build the dashboard page — FE-2-ADMIN-02
- Do NOT build any notification bell functionality — Wave 5
- Do NOT add search functionality to the header — not in MVP
- Do NOT add mobile responsive sidebar — MVP is desktop-only for admin
- Do NOT add breadcrumbs — nice-to-have, Wave 8

---

### Section 6 — Technical Contract

#### 6a. Component Props Interface

```typescript
// AdminSidebar.tsx
interface AdminSidebarProps {
  // No props — reads from UIStore + usePermissions
}

// AdminHeader.tsx
interface AdminHeaderProps {
  // No props — reads from auth store
}

// AdminNav.tsx
interface NavItem {
  label:               string
  icon:                LucideIcon
  href:                string
  requiredPermission?: keyof Permissions   // if undefined → always shown
}
interface AdminNavProps {
  isCollapsed: boolean
}
```

#### 6b. Hook Return Type

N/A — uses existing hooks (`useUIStore`, `useAuthStore`, `usePermissions`).

#### 6c. Zod Schema

N/A.

#### 6d. Key Enums / Constants Used

```typescript
// From lib/constants/routes.ts:
ROUTES.admin.dashboard
ROUTES.admin.crm.index
ROUTES.admin.bookings.list
ROUTES.admin.finance
ROUTES.admin.units.list
ROUTES.admin.owners.list
ROUTES.admin.clients.list
ROUTES.admin.reviews
ROUTES.admin.settings

// From lib/stores/ui.store.ts:
useUIStore — isSidebarOpen, toggleSidebar

// From lib/stores/auth.store.ts:
useAuthStore — user.identifier, role

// From lib/hooks/usePermissions.ts:
usePermissions() — all permission flags
```

---

### Section 7 — API Integration

N/A — admin layout has no API calls.

---

### Section 8 — State & Data Management Rules

| State | Where it lives | Why |
|---|---|---|
| Sidebar open/closed | Zustand UIStore (`isSidebarOpen`) | global, persisted across navigation |
| Current user info | Zustand auth store (`user`, `role`) | set by login in Wave 1 |
| Active route | `usePathname()` hook | derived from URL |
| Permissions | `usePermissions()` hook | computed from role |

**Rules:**
- [x] No server data in Zustand
- [x] No API calls in layout
- [x] No `useEffect` for data fetching

---

### Section 9 — Component & File Deliverables

#### Files to CREATE:

```tsx
// app/(admin)/layout.tsx
import { AdminSidebar } from '@/components/admin/layout/AdminSidebar'
import { AdminHeader }  from '@/components/admin/layout/AdminHeader'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-neutral-50 overflow-hidden">
      <AdminSidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <AdminHeader />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
```

```typescript
// Nav config — defined in AdminNav.tsx (not a separate file):
const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard',   icon: LayoutDashboard, href: ROUTES.admin.dashboard },
  { label: 'CRM',         icon: Users,           href: ROUTES.admin.crm.index,      requiredPermission: 'canViewCRM' },
  { label: 'Bookings',    icon: Calendar,        href: ROUTES.admin.bookings.list,   requiredPermission: 'canViewBookings' },
  { label: 'Finance',     icon: Wallet,          href: ROUTES.admin.finance,         requiredPermission: 'canViewFinance' },
  { label: 'Units',       icon: Home,            href: ROUTES.admin.units.list,      requiredPermission: 'canViewUnits' },
  { label: 'Owners',      icon: Building2,       href: ROUTES.admin.owners.list,     requiredPermission: 'canViewOwners' },
  { label: 'Clients',     icon: UserCheck,       href: ROUTES.admin.clients.list,    requiredPermission: 'canViewClients' },
  { label: 'Reviews',     icon: Star,            href: ROUTES.admin.reviews,         requiredPermission: 'canModerateReviews' },
  { label: 'Admin Users', icon: Shield,          href: ROUTES.admin.settings,        requiredPermission: 'canManageAdminUsers' },
]
```

---

### Section 10 — UX & Loading State Rules

| State | Required? | Behavior |
|---|---|---|
| Sidebar collapsed | ✓ REQUIRED | Shows icons only (no labels), persisted via UIStore |
| Active nav item | ✓ REQUIRED | Highlighted with `bg-primary-50 text-primary-600` |
| User not logged in | ✓ REQUIRED | Middleware (FE-1-AUTH-05) prevents reaching this layout unauthenticated |
| Role without certain permissions | ✓ REQUIRED | Nav items filtered — hidden, not greyed out |

---

### Section 11 — Verification Steps

1. Log in as `SuperAdmin` → expected: all 9 nav items visible
2. Log in as `Sales` → expected: CRM ✓, Bookings ✓, Finance ✗, Units ✓, Owners ✓, Clients ✓, Reviews ✗, Admin Users ✗
3. Log in as `Finance` → expected: Bookings ✓, Finance ✓, Units ✓, Owners ✓, CRM ✗, Clients ✗
4. Log in as `Tech` → expected: Units ✓, CRM ✗, Finance ✗, Owners ✗, Clients ✗
5. Click sidebar toggle → expected: sidebar collapses to icons-only width
6. Refresh page → expected: sidebar collapse state persisted
7. Check header → expected: user identifier (email) shown, role badge visible
8. Click "Sign Out" → expected: logout flow runs, redirect to admin login

---

### Section 12 — Acceptance Criteria

**Functionality:**
- [ ] Admin layout renders sidebar + header + main content region
- [ ] Nav items filtered by `usePermissions()` — unauthorized items NOT rendered
- [ ] Active nav item highlighted using `usePathname()`
- [ ] Sidebar collapses/expands via UIStore toggle
- [ ] Sidebar state persists across page navigation (Zustand persist)
- [ ] Header shows `user.identifier` from auth store
- [ ] Header shows role badge using `<Badge>` component
- [ ] `<LogoutButton>` in header triggers FE-1-AUTH-06 logout flow

**Data & State:**
- [ ] No API calls in the layout
- [ ] No server data in Zustand
- [ ] Sidebar state from `useUIStore.isSidebarOpen`

**TypeScript:**
- [ ] `NavItem` interface typed with `requiredPermission?: keyof Permissions`
- [ ] No `any` type
- [ ] Zero TypeScript errors

**Architecture:**
- [ ] Nav item hrefs from `ROUTES` constants (no inline strings)
- [ ] Role-based nav filtering via `usePermissions()` (no hardcoded role strings)
- [ ] `<LogoutButton>` imported from `components/auth/LogoutButton`

**Role-based access:**
- [ ] Each role sees only their permitted nav items (tested with 4 role types)
- [ ] Dashboard always visible regardless of role

---

### Section 13 — Notes for AI / Common Mistakes

**DO NOT:**
- ⛔ NO MOCK DATA. No hardcoded user names, no fake nav items, no placeholder permission checks.
- Do NOT check `role === 'super_admin'` — roles are `'SuperAdmin'` (PascalCase)
- Do NOT hardcode nav visibility (e.g., `if (role === 'Sales') showCRM`) — use `usePermissions()` and the `requiredPermission` config
- Do NOT put API calls in the layout — it runs on every page navigation
- Do NOT show greyed-out nav items for unauthorized roles — HIDE them completely
- Do NOT add mobile hamburger menu — admin is desktop-only in MVP

**WATCH OUT FOR:**
- `usePathname()` returns the full path including dynamic segments. Use `pathname.startsWith(item.href)` for nested routes (e.g., `/admin/units/123` should highlight the Units nav item)
- When sidebar is collapsed, icon-only mode must still be accessible (aria-label on the button)
- The `identifier` in the auth store is the email for admins (set by the login mutation in FE-1-AUTH-01)

**REFERENCES:**
- FE-1-AUTH-06 — LogoutButton component
- FE-1-UI-10 — usePermissions hook + Permissions type
- FE-0-INFRA-05 — UIStore (isSidebarOpen, toggleSidebar)
- KAZA_BOOKING_API_Reference.md — Access Matrix Summary (permissions)

---

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TICKET ID: FE-2-ADMIN-02
TITLE: Build Admin Dashboard overview page
WAVE: Wave 2 — Admin Shell + Units Domain
DOMAIN: Admin
PRIORITY: High
DEPENDS ON: FE-2-ADMIN-01, FE-0-INFRA-06
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section 1 — Walkthrough

**What is this ticket about?**
The dashboard at `/admin/dashboard` is the first page every admin sees after login. In MVP it shows key stats: total active units, open leads in CRM pipeline, confirmed bookings this month, and total revenue this month. These numbers come from the reporting endpoints. The dashboard is a read-only overview — no actions, just numbers and possibly a simple chart.

**Why NOW?**
Every admin redirects here after login (FE-1-AUTH-01). The page must exist and show something meaningful immediately.

**What does success look like?**
Admin lands on `/admin/dashboard` and sees 4 stat cards (units, leads, bookings, revenue) loading with skeletons then populating with real numbers.

---

### Section 2 — Objective

Build the admin dashboard at `/admin/dashboard` that displays key business metrics using the finance and booking reporting endpoints, so every admin has an immediate overview of platform health.

---

### Section 3 — User-Facing Outcome

The admin can:
- See total active units on the platform
- See total open CRM leads (prospecting + relevant + no_answer + booked)
- See confirmed bookings this month
- See total revenue this month (from finance summary)
- See loading skeletons while data loads

---

### Section 4 — In Scope

- [ ] Create `app/(admin)/dashboard/page.tsx`
- [ ] 4 stat cards: Active Units, Open Leads, Confirmed Bookings (month), Revenue (month)
- [ ] Each card: icon, label, value (formatted), skeleton while loading
- [ ] Stat card component: `components/admin/dashboard/StatCard.tsx`
- [ ] Data fetching:
  - Active units: derived from units list count (or reporting endpoint if available)
  - Open leads: `GET /api/internal/reports/bookings/summary` (filter by active lead statuses)
  - Bookings confirmed this month: `GET /api/internal/reports/bookings/summary`
  - Revenue this month: `GET /api/internal/reports/finance/summary`
- [ ] Create `lib/api/services/reports.service.ts`
- [ ] Create `lib/hooks/useReports.ts`
- [ ] Create `lib/types/report.types.ts`

**Files to create:**
- `app/(admin)/dashboard/page.tsx`
- `components/admin/dashboard/StatCard.tsx`
- `lib/api/services/reports.service.ts`
- `lib/hooks/useReports.ts`
- `lib/types/report.types.ts`

---

### Section 5 — Out of Scope

- Do NOT build charts — Wave 5 (FE-5-DASH-02)
- Do NOT add date range filters — Wave 5
- Do NOT add "recent activity" feed — Wave 5
- Do NOT build a separate reports page — Wave 5

---

### Section 6 — Technical Contract

#### 6a. Component Props Interface

```typescript
interface StatCardProps {
  icon:        LucideIcon
  label:       string
  value:       string | number
  isLoading?:  boolean
  trend?:      { value: number; direction: 'up' | 'down' }  // optional — not in MVP
  className?:  string
}
```

#### 6b. Hook Return Type

```typescript
// lib/hooks/useReports.ts
export function useFinanceSummary(filters?: ReportFilters) {
  return useQuery({
    queryKey: queryKeys.reports.financeSummary(filters),
    queryFn:  () => reportsService.getFinanceSummary(filters),
  })
}

export function useBookingsSummary(filters?: ReportFilters) {
  return useQuery({
    queryKey: queryKeys.reports.bookingsSummary(filters),
    queryFn:  () => reportsService.getBookingsSummary(filters),
  })
}
```

#### 6d. Key Enums / Constants Used

```typescript
endpoints.reportsFinance.summary    // GET /api/internal/reports/finance/summary
endpoints.reportsBookings.summary   // GET /api/internal/reports/bookings/summary
```

---

### Section 7 — API Integration

#### 7a. Endpoints Used

| Method | Endpoint | Response Type | When Called |
|---|---|---|---|
| GET | `/api/internal/reports/finance/summary` | `FinanceAnalyticsSummaryResponse` | on page mount |
| GET | `/api/internal/reports/bookings/summary` | `BookingAnalyticsSummaryResponse` | on page mount |

**Full API Contracts (from KAZA_BOOKING_API_Reference.md):**

```typescript
// lib/types/report.types.ts

// Query params for summary endpoints:
interface ReportFilters {
  startDate?: string   // ISO date string e.g. "2026-04-01"
  endDate?:   string
}

// GET /api/internal/reports/finance/summary response:
interface FinanceAnalyticsSummaryResponse {
  totalRevenue:          number
  totalDepositsCollected: number
  totalRemainingCollected: number
  totalRefunds:          number
  totalOwnerPayouts:     number
  platformEarnings:      number
  totalBookings:         number    // bookings included in this period
}

// GET /api/internal/reports/bookings/summary response:
interface BookingAnalyticsSummaryResponse {
  totalLeads:            number
  activeLeads:           number    // pipeline: Prospecting+Relevant+NoAnswer+Booked
  confirmedBookings:     number
  completedBookings:     number
  cancelledBookings:     number
  conversionRate:        number    // percentage: confirmed / total leads
  averageStayNights:     number
}

// lib/api/services/reports.service.ts
export const reportsService = {
  getFinanceSummary:  (filters?: ReportFilters): Promise<FinanceAnalyticsSummaryResponse> =>
    api.get(endpoints.reportsFinance.summary, { params: filters }),

  getBookingsSummary: (filters?: ReportFilters): Promise<BookingAnalyticsSummaryResponse> =>
    api.get(endpoints.reportsBookings.summary, { params: filters }),

  getFinanceDaily:    (filters?: ReportFilters): Promise<FinanceAnalyticsDailySummaryResponse[]> =>
    api.get(endpoints.reportsFinance.daily, { params: filters }),

  getBookingsDaily:   (filters?: ReportFilters): Promise<BookingAnalyticsDailySummaryResponse[]> =>
    api.get(endpoints.reportsBookings.daily, { params: filters }),
}
```

#### 7b. TanStack Query Keys

```typescript
queryKeys.reports.financeSummary()
queryKeys.reports.bookingsSummary()
```

#### 7c. Query Configuration

```typescript
staleTime: 1000 * 60 * 5   // 5 minutes — dashboard doesn't need real-time updates
```

#### 7e. Error Handling

- On load failure → show StatCard with `value="—"` and a subtle error indicator
- No retry prompt needed (data is informational)

---

### Section 8 — State & Data Management Rules

| State | Where it lives | Why |
|---|---|---|
| Finance summary | TanStack Query | server state |
| Bookings summary | TanStack Query | server state |

---

### Section 9 — Component & File Deliverables

```
app/(admin)/dashboard/page.tsx                    ← dashboard page
components/admin/dashboard/StatCard.tsx           ← stat card with skeleton
lib/api/services/reports.service.ts               ← reports API service
lib/hooks/useReports.ts                           ← useFinanceSummary, useBookingsSummary, etc.
lib/types/report.types.ts                         ← all report response types
```

`lib/types/index.ts` — add `export * from './report.types'`

---

### Section 10 — UX & Loading State Rules

| State | Required? | Behavior |
|---|---|---|
| Loading | ✓ REQUIRED | Each StatCard shows Skeleton (number placeholder) |
| Error | ✓ REQUIRED | StatCard shows `value="—"` with muted error text |
| Empty (0 values) | ✓ REQUIRED | Show "0" or "0 EGP" — not an empty state component |
| Skeleton shape | | Rectangle ~40px tall inside the card |

---

### Section 11 — Verification Steps

1. Log in as SuperAdmin → navigate to `/admin/dashboard`
2. Expected: 4 stat cards with skeleton loading briefly, then real data
3. Verify: "Active Leads" = `bookingsSummary.activeLeads`
4. Verify: "Revenue This Month" = `formatCurrency(financeSummary.totalRevenue)`
5. Log in as Finance → dashboard accessible (Finance can see reports)
6. Log in as Tech → dashboard accessible (Tech can see dashboard)

---

### Section 12 — Acceptance Criteria

- [ ] Page at `/admin/dashboard` renders inside admin layout
- [ ] 4 stat cards render with correct data from API
- [ ] `formatCurrency()` used for revenue display
- [ ] Loading state shows skeletons per card
- [ ] Error state shows `—` gracefully
- [ ] `staleTime: 5 minutes` set on queries
- [ ] No mock data

---

### Section 13 — Notes for AI / Common Mistakes

**DO NOT:**
- ⛔ NO MOCK DATA. No `const mockStats = { revenue: 50000, ... }`.
- Do NOT hardcode stat values for "initial display" — show skeleton until API responds
- Do NOT fetch both reports in a single API call — they are separate endpoints

**WATCH OUT FOR:**
- `FinanceAnalyticsSummaryResponse` does not have a filter for "this month" by default — you may need to pass `startDate`/`endDate` for the current month. Check if the API defaults to all-time or current month.
- `formatCurrency()` from FE-0-INFRA-07 formats as "X,XXX EGP"

---

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TICKET ID: FE-2-ADMIN-03
TITLE: Build Projects management (list + CRUD + status toggle)
WAVE: Wave 2 — Admin Shell + Units Domain
DOMAIN: Admin
PRIORITY: High
DEPENDS ON: FE-2-ADMIN-01, FE-1-UI-01..05, FE-1-UI-07, FE-1-UI-10
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section 1 — Walkthrough

**What is this ticket about?**
Projects are the geographic zones where rental units are located (Palm Hills, Abraj Al Alamein, etc.). This ticket builds the full projects management page at `/admin/projects`: a list of all projects, the ability to create new ones, edit existing ones, and toggle their active/inactive status. Only SuperAdmin can create/edit projects. All admin roles can view them.

**Why NOW?**
Project selection is required when creating a unit (FE-2-UNITS-03). The projects list must exist first.

**What does success look like?**
SuperAdmin opens `/admin/projects`, sees all projects in a table, creates a new project via a modal form, edits it inline, and can toggle its status between active and inactive.

---

### Section 2 — Objective

Build the Projects management page at `/admin/projects` with full CRUD operations and status toggling, guarded by `canManageProjects` permission, using the Projects API endpoints.

---

### Section 3 — User-Facing Outcome

The SuperAdmin can:
- View all projects in a table (name, description, status, created date)
- Create a new project via a "New Project" button → modal form
- Edit a project by clicking the edit button in the table row
- Toggle a project's active/inactive status with a ConfirmDialog
- See inactive projects in a muted style

The Sales/Finance/Tech admin can:
- View the projects list (read-only — no create/edit buttons visible)

---

### Section 4 — In Scope

- [ ] Create `app/(admin)/projects/page.tsx`
- [ ] Create `lib/api/services/projects.service.ts`
- [ ] Create `lib/hooks/useProjects.ts`
- [ ] Create `lib/types/project.types.ts`
- [ ] `GET /api/projects` → list with `includeInactive: true` for admin view
- [ ] `POST /api/projects` → create new project
- [ ] `PUT /api/projects/{id}` → update project
- [ ] `PATCH /api/projects/{id}/status` → toggle active/inactive
- [ ] Table columns: Name, Description, Status (Badge), Created At, Actions (edit, toggle status)
- [ ] "New Project" button (visible only if `canManageProjects`)
- [ ] Create/Edit in `<Modal>` with form (shared form component)
- [ ] Status toggle requires `<ConfirmDialog>`
- [ ] Pagination: projects list may be small, but implement pagination support
- [ ] Loading: `<SkeletonTable rows={5}>`
- [ ] Empty: `<EmptyState>` with "No projects yet" + "Create Project" CTA (if `canManageProjects`)

**Files to create:**
- `app/(admin)/projects/page.tsx`
- `components/admin/projects/ProjectTable.tsx`
- `components/admin/projects/ProjectForm.tsx` (shared create/edit form)
- `components/admin/projects/ProjectFormModal.tsx`
- `lib/api/services/projects.service.ts`
- `lib/hooks/useProjects.ts`
- `lib/types/project.types.ts`

---

### Section 6 — Technical Contract

#### 6a. Component Props Interface

```typescript
// ProjectForm.tsx — shared for create and edit
interface ProjectFormProps {
  defaultValues?: Partial<ProjectFormValues>
  onSubmit:       (data: ProjectFormValues) => void
  isLoading?:     boolean
}

// ProjectFormModal.tsx
interface ProjectFormModalProps {
  isOpen:    boolean
  onClose:   () => void
  project?:     ProjectResponse   // if provided → edit mode; if undefined → create mode
}
```

#### 6c. Zod Schema

```typescript
const projectFormSchema = z.object({
  name:        z.string().min(1, 'Project name is required').max(100),
  description: z.string().max(500).optional(),
})

type ProjectFormValues = z.infer<typeof projectFormSchema>
```

#### 6d. Key Enums / Constants Used

```typescript
endpoints.projects.list       // GET /api/projects
endpoints.projects.create     // POST /api/projects
endpoints.projects.update(id) // PUT /api/projects/{id}
endpoints.projects.status(id) // PATCH /api/projects/{id}/status

ROUTES.admin.projects         // '/admin/projects'
```

---

### Section 7 — API Integration

#### 7a. Endpoints Used

| Method | Endpoint | Request Type | Response Type | When Called |
|---|---|---|---|---|
| GET | `/api/projects` | `{ includeInactive: true }` | `ProjectResponse[]` | on page mount |
| POST | `/api/projects` | `CreateProjectRequest` | `ProjectResponse` | on create form submit |
| PUT | `/api/projects/{id}` | `UpdateProjectRequest` | `ProjectResponse` | on edit form submit |
| PATCH | `/api/projects/{id}/status` | `UpdateProjectStatusRequest` | `ProjectResponse` | on status toggle confirm |

**Full API Contracts (from KAZA_BOOKING_API_Reference.md):**

```typescript
// lib/types/project.types.ts

interface ProjectResponse {
  id:          string
  name:        string
  description: string | null
  isActive:    boolean
  createdAt:   string
  updatedAt:   string
}

interface CreateProjectRequest {
  name:         string
  description?: string
}

interface UpdateProjectRequest {
  name?:        string
  description?: string
}

interface UpdateProjectStatusRequest {
  isActive: boolean   // true = activate, false = deactivate
}

// lib/api/services/projects.service.ts
export const projectsService = {
  getAll:      (includeInactive = false): Promise<ProjectResponse[]> =>
    api.get(endpoints.projects.list, { params: { includeInactive } }),

  getById:     (id: string): Promise<ProjectResponse> =>
    api.get(endpoints.projects.byId(id)),

  create:      (data: CreateProjectRequest): Promise<ProjectResponse> =>
    api.post(endpoints.projects.create, data),

  update:      (id: string, data: UpdateProjectRequest): Promise<ProjectResponse> =>
    api.put(endpoints.projects.update(id), data),

  toggleStatus: (id: string, isActive: boolean): Promise<ProjectResponse> =>
    api.patch(endpoints.projects.status(id), { isActive }),
}
```

#### 7b. TanStack Query Keys

```typescript
queryKeys.projects.list()           // GET all projects
queryKeys.projects.detail(id)       // GET single project

// Invalidate after mutations:
// create → invalidate queryKeys.projects.list()
// update → invalidate queryKeys.projects.list() + queryKeys.projects.detail(id)
// toggleStatus → invalidate queryKeys.projects.list() + queryKeys.projects.detail(id)
```

#### 7d. Mutation Side Effects

```typescript
// After CREATE:
toastSuccess('Project created successfully')
queryClient.invalidateQueries({ queryKey: queryKeys.projects.list() })
closeModal()

// After UPDATE:
toastSuccess('Project updated successfully')
queryClient.invalidateQueries({ queryKey: queryKeys.projects.list() })
queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(id) })
closeModal()

// After STATUS TOGGLE:
toastSuccess(isActive ? 'Project activated' : 'Project deactivated')
queryClient.invalidateQueries({ queryKey: queryKeys.projects.list() })
closeConfirmDialog()
```

---

### Section 8 — State & Data Management Rules

| State | Where it lives | Why |
|---|---|---|
| Projects list | TanStack Query | server state |
| Modal open state | `useState` in page | local — only one modal |
| Editing project | `useState` in page | which project is being edited |
| Confirm dialog state | `useState` in page | which project to toggle |
| Form values | React Hook Form | form state |

---

### Section 9 — Component & File Deliverables

```
app/(admin)/projects/page.tsx                    ← page shell, orchestrates modal/confirm state
components/admin/projects/ProjectTable.tsx          ← table with edit/toggle actions
components/admin/projects/ProjectForm.tsx           ← RHF form (name + description)
components/admin/projects/ProjectFormModal.tsx      ← Modal wrapper for create/edit form
lib/api/services/projects.service.ts             ← projects CRUD
lib/hooks/useProjects.ts                         ← useProjectsList, useCreateProject, useUpdateProject, useToggleProjectStatus
lib/types/project.types.ts                       ← ProjectResponse, CreateProjectRequest, UpdateProjectRequest
```

`lib/types/index.ts` → add `export * from './project.types'`

---

### Section 10 — UX & Loading State Rules

| State | Required? | Behavior |
|---|---|---|
| Loading list | ✓ REQUIRED | `<SkeletonTable rows={5} columns={5}>` |
| Empty list | ✓ REQUIRED | `<EmptyState icon={MapPin} title="No projects yet" description="Create your first project to start adding units." action={{ label: 'Create Project', onClick: openCreateModal }}>` — action only if `canManageProjects` |
| Error loading | ✓ REQUIRED | `<EmptyState icon={AlertCircle} title="Failed to load projects">` with retry button |
| Create/Edit loading | ✓ REQUIRED | Submit button spinner, form fields disabled |
| Status toggle | ✓ REQUIRED | `<ConfirmDialog>` before executing. Message: "Deactivate [Project Name]? Units in this project will no longer appear publicly." |
| Inactive project row | ✓ REQUIRED | Row rendered with muted text + `<Badge variant="neutral">Inactive</Badge>` |

---

### Section 11 — Verification Steps

1. Log in as SuperAdmin → navigate to `/admin/projects`
2. Expected: projects list loads with columns: Name, Description, Status, Created, Actions
3. Click "New Project" → modal opens → fill name → submit → project appears in list, toast shown
4. Click edit on existing project → modal pre-filled → change name → save → list updates
5. Click toggle status → ConfirmDialog appears → confirm → status badge changes
6. Log in as Sales → navigate to `/admin/projects` → table visible, NO "New Project" button, NO edit/toggle actions
7. Empty state: if no projects → EmptyState shown

**Edge cases:**
1. Duplicate project name → 422 from API → error shown in form under name field
2. Network error on create → toast from Axios interceptor, modal stays open

---

### Section 12 — Acceptance Criteria

- [ ] `GET /api/projects` called with `{ includeInactive: true }` (not the public endpoint)
- [ ] `canManageProjects` permission gates: "New Project" button, edit button, toggle status button
- [ ] Status toggle uses `PATCH /api/projects/{id}/status` with `{ isActive: boolean }`
- [ ] Status toggle preceded by `<ConfirmDialog>`
- [ ] Inactive projects shown with muted style + neutral Badge
- [ ] 422 errors shown as field-level form errors
- [ ] Query invalidated after every mutation
- [ ] Loading skeleton shown while data fetches
- [ ] EmptyState shown when list is empty
- [ ] No mock data anywhere

---

### Section 13 — Notes for AI / Common Mistakes

**DO NOT:**
- ⛔ NO MOCK DATA. No `const projects = [{ id: '1', name: 'Palm Hills' }]`.
- Do NOT use the public `GET /api/projects` without `includeInactive: true` — admin needs to see inactive projects too
- Do NOT inline permission checks (`role === 'SuperAdmin'`) — use `usePermissions().canManageProjects`
- Do NOT skip the ConfirmDialog for status toggle — it's a destructive-ish action (deactivating a project removes it from public view)

---

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TICKET ID: FE-2-ADMIN-04
TITLE: Build Amenities management
WAVE: Wave 2 — Admin Shell + Units Domain
DOMAIN: Admin
PRIORITY: Medium
DEPENDS ON: FE-2-ADMIN-01, FE-1-UI-01..05
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section 1 — Walkthrough

**What is this ticket about?**
Amenities are tags that can be attached to units (Pool, Parking, Sea View, Gym, Kitchen, etc.). This ticket builds the amenities management section at `/admin/settings` (or as a tab within a settings page). SuperAdmin can create new amenities; all roles can view them. The amenities list is also needed by FE-2-UNITS-07 (unit amenities assignment).

**What does success look like?**
SuperAdmin opens the amenities page, sees the existing amenities as cards/chips, adds a new one by typing a name, and can see them listed.

---

### Section 2 — Objective

Build amenities management at `/admin/settings` (amenities tab) that lets SuperAdmin create new amenities and all admins view existing ones, using `GET /api/amenities` and `POST /api/amenities`.

---

### Section 4 — In Scope

- [ ] Create `app/(admin)/settings/page.tsx` with amenities section
- [ ] `GET /api/amenities` → list all amenities
- [ ] `POST /api/amenities` → create new amenity (SuperAdmin only)
- [ ] Display amenities as badge chips in a grid
- [ ] Inline create form: input + "Add" button (no modal needed — simple enough)
- [ ] Create `lib/api/services/amenities.service.ts`
- [ ] Create `lib/hooks/useAmenities.ts`
- [ ] Create `lib/types/amenity.types.ts`

**Files to create:**
- `app/(admin)/settings/page.tsx`
- `components/admin/settings/AmenitiesManager.tsx`
- `lib/api/services/amenities.service.ts`
- `lib/hooks/useAmenities.ts`
- `lib/types/amenity.types.ts`

---

### Section 6 — Technical Contract

```typescript
// lib/types/amenity.types.ts
interface AmenityResponse {
  id:        string
  name:      string
  icon:      string | null
  createdAt: string
  updatedAt: string
}

interface CreateAmenityRequest {
  name: string
  icon?: string   // icon name string (e.g., "pool", "wifi") — optional
}

// Zod schema:
const amenitySchema = z.object({
  name: z.string().min(1, 'Amenity name is required').max(50),
  icon: z.string().optional(),
})
```

#### 7a. Endpoints Used

| Method | Endpoint | Request | Response | When |
|---|---|---|---|---|
| GET | `/api/amenities` | — | `AmenityResponse[]` | on page mount |
| POST | `/api/amenities` | `CreateAmenityRequest` | `AmenityResponse` | on form submit |

---

### Section 12 — Acceptance Criteria

- [ ] Amenities list loads from `GET /api/amenities`
- [ ] "Add Amenity" form visible only if `canManageAmenities`
- [ ] New amenity appears in list after creation
- [ ] Query invalidated after create
- [ ] Loading skeleton while fetching
- [ ] Empty state if no amenities
- [ ] No mock data

---

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TICKET ID: FE-2-UNITS-01
TITLE: Create Units service layer + TypeScript types
WAVE: Wave 2 — Admin Shell + Units Domain
DOMAIN: Units
PRIORITY: Critical
DEPENDS ON: FE-0-INFRA-03, FE-0-INFRA-04, FE-0-INFRA-07
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section 1 — Walkthrough

**What is this ticket about?**
All 10 unit-domain tickets depend on a service layer and type definitions. This ticket creates them all upfront so FE-2-UNITS-02 through FE-2-UNITS-10 can simply import and use without defining their own types. It covers units, images, amenities assignment, date blocks, seasonal pricing, and availability endpoints.

**Why NOW?**
This is the foundational ticket for the entire Units domain. Every other FE-2-UNITS-* ticket imports from here.

---

### Section 2 — Objective

Create `lib/api/services/units.service.ts`, `lib/types/unit.types.ts`, and `lib/hooks/useUnits.ts` with full TypeScript contracts for all unit-related API endpoints, so every subsequent Units domain ticket has typed API access from day one.

---

### Section 4 — In Scope

- [ ] Create `lib/types/unit.types.ts` — all unit-related types
- [ ] Create `lib/api/services/units.service.ts` — all unit API calls
- [ ] Create `lib/hooks/useUnits.ts` — TanStack Query hooks
- [ ] Cover: units CRUD, images, amenities, date blocks, seasonal pricing, availability check, pricing calculate

**Files to create:**
- `lib/types/unit.types.ts`
- `lib/api/services/units.service.ts`
- `lib/hooks/useUnits.ts`

**Files to modify:**
- `lib/types/index.ts` — add `export * from './unit.types'`

---

### Section 6 — Technical Contract

```typescript
// lib/types/unit.types.ts
// All contracts from KAZA_BOOKING_API_Reference.md

// ── Enums ──
type UnitType = 'villa' | 'chalet' | 'studio'  // lowercase per API

// ── Unit list item (from GET /api/internal/units) ──
interface UnitListItemResponse {
  id:                 string
  ownerId:            string
  projectId:             string
  name:               string
  unitType:           UnitType
  bedrooms:           number
  bathrooms:          number
  maxGuests:          number
  basePricePerNight:  number
  isActive:           boolean
  createdAt:          string
}

// ── Unit detail (from GET /api/internal/units/{id}) ──
interface UnitDetailsResponse {
  id:                 string
  ownerId:            string
  projectId:             string
  name:               string
  description:        string | null
  address:            string | null
  unitType:           UnitType
  bedrooms:           number
  bathrooms:          number
  maxGuests:          number
  basePricePerNight:  number
  isActive:           boolean
  createdAt:          string
  updatedAt:          string
}

// ── Create/Update Unit ──
interface CreateUnitRequest {
  ownerId:           string
  projectId:            string
  name:              string
  unitType:          UnitType
  description?:      string
  address?:          string
  bedrooms:          number
  bathrooms:         number
  maxGuests:         number
  basePricePerNight: number
  isActive?:         boolean
}

interface UpdateUnitRequest {
  ownerId?:           string
  projectId?:            string
  name?:              string
  unitType?:          UnitType
  description?:       string
  address?:           string
  bedrooms?:          number
  bathrooms?:         number
  maxGuests?:         number
  basePricePerNight?: number
  isActive?:          boolean
}

interface UpdateUnitActiveStateRequest {
  isActive: boolean
}

// ── Unit filters ──
interface UnitListFilters {
  page?:     number
  pageSize?: number
}

// ── Images ──
interface UnitImageResponse {
  id:           string
  unitId:       string
  fileKey:      string
  isCover:      boolean
  displayOrder: number
  createdAt:    string
}

interface AddUnitImageRequest {
  fileKey:       string
  isCover?:      boolean
  displayOrder?: number
}

interface ReorderUnitImagesRequest {
  items: Array<{ imageId: string; displayOrder: number }>
}

// ── Amenities ──
interface UnitAmenityResponse {
  amenityId: string
  name:      string
  icon:      string | null
}

interface ReplaceUnitAmenitiesRequest {
  amenityIds: string[]
}

// ── Date Blocks ──
type DateBlockReason = 'Maintenance' | 'OwnerUse' | 'Other'  // PascalCase per API

interface DateBlockResponse {
  id:                 string
  unitId:             string
  startDate:          string   // ISO date "2026-04-15"
  endDate:            string
  reason:             DateBlockReason
  notes:              string | null
  blockedByUserId:    string
  blockedByUserName:  string
  createdAt:          string
}

interface CreateDateBlockRequest {
  startDate: string
  endDate:   string
  reason:    DateBlockReason
  notes?:    string
}

interface UpdateDateBlockRequest {
  startDate?: string
  endDate?:   string
  reason?:    DateBlockReason
  notes?:     string
}

// ── Seasonal Pricing ──
interface SeasonalPricingResponse {
  id:             string
  unitId:         string
  label:          string
  startDate:      string
  endDate:        string
  pricePerNight:  number
  createdAt:      string
}

interface CreateSeasonalPricingRequest {
  label:         string
  startDate:     string
  endDate:       string
  pricePerNight: number
}

interface UpdateSeasonalPricingRequest {
  label?:         string
  startDate?:     string
  endDate?:       string
  pricePerNight?: number
}

// ── Availability Check ──
interface CheckOperationalAvailabilityRequest {
  startDate: string
  endDate:   string
}

interface OperationalAvailabilityResponse {
  unitId:      string
  startDate:   string
  endDate:     string
  isAvailable: boolean
  reason:      string
  blockedDates: string[]
}

// ── Pricing Calculate ──
interface UnitPricingResponse {
  unitId:     string
  startDate:  string
  endDate:    string
  totalPrice: number
  nights:     NightlyPriceItem[]
}

interface NightlyPriceItem {
  date:          string
  pricePerNight: number
  priceSource:   'SeasonalPricing' | 'BasePrice'
}
```

```typescript
// lib/api/services/units.service.ts
import api from '@/lib/api/axios'
import { endpoints } from '@/lib/api/endpoints'
import type { ... } from '@/lib/types/unit.types'
import type { PaginationMeta } from '@/lib/api/types'

interface PaginatedUnits {
  items:      UnitListItemResponse[]
  pagination: PaginationMeta   // { page, pageSize, totalCount, totalPages }
}

export const unitsService = {
  // ── Public ──
  getPublicList:    (filters?: object): Promise<PaginatedUnits> =>
    api.get(endpoints.units.publicList, { params: filters }),

  getPublicById:    (id: string): Promise<UnitDetailsResponse> =>
    api.get(endpoints.units.publicById(id)),

  // ── Internal (admin) ──
  getInternalList:  (filters?: UnitListFilters): Promise<PaginatedUnits> =>
    api.get(endpoints.internalUnits.list, { params: filters }),

  getInternalById:  (id: string): Promise<UnitDetailsResponse> =>
    api.get(endpoints.internalUnits.byId(id)),

  create:           (data: CreateUnitRequest): Promise<UnitDetailsResponse> =>
    api.post(endpoints.internalUnits.create, data),

  update:           (id: string, data: UpdateUnitRequest): Promise<UnitDetailsResponse> =>
    api.put(endpoints.internalUnits.update(id), data),

  delete:           (id: string): Promise<void> =>
    api.delete(endpoints.internalUnits.delete(id)),

  updateStatus:     (id: string, isActive: boolean): Promise<UnitDetailsResponse> =>
    api.patch(endpoints.internalUnits.status(id), { isActive }),

  // ── Images ──
  getImages:        (unitId: string): Promise<UnitImageResponse[]> =>
    api.get(endpoints.units.images(unitId)),

  addImage:         (unitId: string, data: AddUnitImageRequest): Promise<UnitImageResponse> =>
    api.post(endpoints.internalUnitImages.create(unitId), data),

  reorderImages:    (unitId: string, data: ReorderUnitImagesRequest): Promise<void> =>
    api.put(endpoints.internalUnitImages.reorder(unitId), data),

  setCoverImage:    (unitId: string, imageId: string): Promise<void> =>
    api.patch(endpoints.internalUnitImages.cover(unitId, imageId)),

  deleteImage:      (unitId: string, imageId: string): Promise<void> =>
    api.delete(endpoints.internalUnitImages.delete(unitId, imageId)),

  // ── Amenities ──
  getAmenities:     (unitId: string): Promise<UnitAmenityResponse[]> =>
    api.get(endpoints.units.amenities(unitId)),

  replaceAmenities: (unitId: string, data: ReplaceUnitAmenitiesRequest): Promise<UnitAmenityResponse[]> =>
    api.put(endpoints.internalUnitAmenities.replace(unitId), data),

  // ── Date Blocks ──
  getDateBlocks:    (unitId: string): Promise<DateBlockResponse[]> =>
    api.get(endpoints.dateBlocks.list(unitId)),

  createDateBlock:  (unitId: string, data: CreateDateBlockRequest): Promise<DateBlockResponse> =>
    api.post(endpoints.dateBlocks.create(unitId), data),

  updateDateBlock:  (blockId: string, data: UpdateDateBlockRequest): Promise<DateBlockResponse> =>
    api.put(endpoints.dateBlocks.update(blockId), data),

  deleteDateBlock:  (blockId: string): Promise<void> =>
    api.delete(endpoints.dateBlocks.delete(blockId)),

  // ── Seasonal Pricing ──
  getSeasonalPricing:    (unitId: string): Promise<SeasonalPricingResponse[]> =>
    api.get(endpoints.seasonalPricing.list(unitId)),

  createSeasonalPricing: (unitId: string, data: CreateSeasonalPricingRequest): Promise<SeasonalPricingResponse> =>
    api.post(endpoints.seasonalPricing.create(unitId), data),

  updateSeasonalPricing: (id: string, data: UpdateSeasonalPricingRequest): Promise<SeasonalPricingResponse> =>
    api.put(endpoints.seasonalPricing.update(id), data),

  deleteSeasonalPricing: (id: string): Promise<void> =>
    api.delete(endpoints.seasonalPricing.delete(id)),

  // ── Availability ──
  checkAvailability: (unitId: string, data: CheckOperationalAvailabilityRequest): Promise<OperationalAvailabilityResponse> =>
    api.post(endpoints.units.operationalCheck(unitId), data),

  calculatePricing:  (unitId: string, data: { startDate: string; endDate: string }): Promise<UnitPricingResponse> =>
    api.post(endpoints.units.pricingCalculate(unitId), data),
}
```

---

### Section 12 — Acceptance Criteria

- [ ] All types in `lib/types/unit.types.ts` exactly match API response shapes
- [ ] `UnitType` is `'villa' | 'chalet' | 'studio'` (lowercase)
- [ ] `DateBlockReason` is `'Maintenance' | 'OwnerUse' | 'Other'` (PascalCase)
- [ ] `PaginatedUnits` uses `pagination.totalCount` and `pagination.totalPages`
- [ ] All 20+ service functions typed with correct request/response types
- [ ] No `any` types
- [ ] Zero TypeScript errors
- [ ] No mock data

---

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TICKET ID: FE-2-UNITS-02
TITLE: Build Units list page (admin internal view)
WAVE: Wave 2 — Admin Shell + Units Domain
DOMAIN: Units
PRIORITY: Critical
DEPENDS ON: FE-2-UNITS-01, FE-2-ADMIN-01, FE-1-UI-06, FE-1-UI-07
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section 1 — Walkthrough

**What is this ticket about?**
The units list at `/admin/units` is where the entire property inventory lives. Documented API query params for `GET /api/internal/units` are pagination only (`page`, `pageSize`). Project/type/status/owner/search controls are backend gaps unless formally documented.

---

### Section 2 — Objective

Build the units list page at `/admin/units` using `GET /api/internal/units` with documented pagination (`page`, `pageSize`) and a "Create Unit" button for authorized users, while treating project/type/status/owner/search as backend gaps until documented.

---

### Section 4 — In Scope

- [ ] `app/(admin)/units/page.tsx`
- [ ] `GET /api/internal/units` with documented query params: `page`, `pageSize`
- [ ] **Backend gap:** Project/Owner/Type/Status/Search filtering is not documented for `GET /api/internal/units`; do not present it as supported contract.
- [ ] Table columns: Unit Name, Project, Owner, Type, Status (StatusBadge), Price/night, Actions
- [ ] Actions (row): View Details (→ `/admin/units/{id}`), Edit, Toggle Status (SuperAdmin/Tech only)
- [ ] "Create Unit" button — visible only if `canManageUnits`
- [ ] Pagination using `DataTable` + `Pagination` components
- [ ] URL sync for documented pagination params only (`?page=...&pageSize=...`)
- [ ] Loading: `<SkeletonTable>`
- [ ] Empty: `<EmptyState>` with "No units found"

**Files to create:**
- `app/(admin)/units/page.tsx`
- `components/admin/units/UnitFilters.tsx`
- `components/admin/units/UnitTable.tsx`

---

### Section 6 — Technical Contract

#### 6a. Component Props Interface

```typescript
interface UnitFiltersProps {
  filters:   UnitListFilters
  onChange:  (filters: UnitListFilters) => void
  projects:     ProjectResponse[]   // for project dropdown
  isLoading: boolean
}
```

#### 6b. Hook Return Type

```typescript
// In lib/hooks/useUnits.ts — add:
export function useInternalUnitsList(filters: UnitListFilters) {
  return useQuery({
    queryKey: queryKeys.units.internalList(filters),
    queryFn:  () => unitsService.getInternalList(filters),
    placeholderData: keepPreviousData,   // smooth pagination
  })
}
```

#### 6d. Key Enums / Constants Used

```typescript
UNIT_TYPE_LABELS     // { villa: 'Villa', chalet: 'Chalet', studio: 'Studio' }
getUnitActivityLabel(isActive) // true => 'Active', false => 'Inactive'
endpoints.internalUnits.list
ROUTES.admin.units.detail(id)
ROUTES.admin.units.create
```

---

### Section 7 — API Integration

| Method | Endpoint | Query Params | Response | When |
|---|---|---|---|---|
| GET | `/api/internal/units` | `UnitListFilters` (`page`, `pageSize`) | `PaginatedUnits` | on page mount + page change |
| GET | `/api/projects` | `{ includeInactive: false }` | `ProjectResponse[]` | on page mount (for filter dropdown) |

**Pagination response from API:**
```typescript
// Response uses: { items: UnitListItemResponse[], pagination: { page, pageSize, totalCount, totalPages } }
// "totalCount" (NOT "total") and "totalPages" must be used in the DataTable Pagination component
```

#### 7b. TanStack Query Keys

```typescript
queryKeys.units.internalList(filters)
queryKeys.projects.list()

// Invalidate after status change (from action button):
queryKeys.units.internalList(filters)
```

#### 7c. Query Config

```typescript
keepPreviousData: true   // don't flash skeleton when changing page
staleTime: 1000 * 60 * 2
```

---

### Section 9 — Component & File Deliverables

```
app/(admin)/units/page.tsx             ← page with filter state + table
components/admin/units/UnitFilters.tsx ← pagination controls + backend-gap placeholders (project/type/status/owner/search)
components/admin/units/UnitTable.tsx   ← DataTable with unit columns + row actions
```

---

### Section 10 — UX & Loading State Rules

| State | Required? | Behavior |
|---|---|---|
| Loading | ✓ REQUIRED | `<SkeletonTable rows={8} columns={6}>` |
| Empty (no results) | ✓ REQUIRED | `<EmptyState title="No units found" description="Try adjusting your filters.">` |
| Empty (no units at all) | ✓ REQUIRED | `<EmptyState title="No units yet" action={{ label: 'Add Unit', onClick: ... }}>` — action only if `canManageUnits` |
| Status toggle | ✓ REQUIRED | `<ConfirmDialog>` before executing |
| Pagination | ✓ REQUIRED | Shows "Showing X–Y of totalCount results" |
| Filter change | ✓ REQUIRED | `keepPreviousData: true` — no flash to loading state |

---

### Section 12 — Acceptance Criteria

- [ ] `GET /api/internal/units` called with documented params (`page`, `pageSize`) only
- [ ] Filters reflected in URL query params
- [ ] Pagination uses `totalCount` and `totalPages` from API response
- [ ] `canManageUnits` permission gates Create/Edit/Toggle buttons
- [ ] Status toggle uses `<ConfirmDialog>`
- [ ] `keepPreviousData: true` on query
- [ ] Empty state shown when results empty
- [ ] No mock data

---

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TICKET ID: FE-2-UNITS-03
TITLE: Build Create Unit form
WAVE: Wave 2 — Admin Shell + Units Domain
DOMAIN: Units
PRIORITY: Critical
DEPENDS ON: FE-2-UNITS-01, FE-2-ADMIN-03, FE-2-ADMIN-04, FE-1-UI-01..04
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section 1 — Walkthrough

**What is this ticket about?**
Creating a new unit requires selecting: the owner (from owners list), the project (from projects list), a unit name, unit type (villa/chalet/studio), bedrooms, bathrooms, max guests, base price, and optional description/address. This page is the entry point for adding new properties to the platform. After creation, the user is redirected to the unit's detail page.

---

### Section 2 — Objective

Build the Create Unit page at `/admin/units/new` with a form that calls `POST /api/internal/units`, requiring owner and project selections populated from their respective APIs.

---

### Section 4 — In Scope

- [ ] `app/(admin)/units/new/page.tsx`
- [ ] Form fields:
  - `ownerId` — Combobox (searchable) from `GET /api/owners` — required
  - `projectId` — Select from `GET /api/projects` — required
  - `name` — Input — required
  - `unitType` — Select (villa / chalet / studio) — required
  - `bedrooms` — Number Input — required, min 0
  - `bathrooms` — Number Input — required, min 0
  - `maxGuests` — Number Input — required, min 1
  - `basePricePerNight` — Number Input — required, min 0
  - `isActive` — Switch — optional, default true
  - `address` — Input — optional
  - `description` — Textarea — optional
- [ ] Owners fetched from `GET /api/owners` (own service — `lib/api/services/owners.service.ts` stub)
- [ ] Projects fetched from `GET /api/projects`
- [ ] On success: redirect to `ROUTES.admin.units.detail(newUnit.id)`
- [ ] On cancel: navigate back to units list

**Files to create:**
- `app/(admin)/units/new/page.tsx`
- `components/admin/units/UnitForm.tsx` — shared for create AND edit
- `lib/api/services/owners.service.ts` — stub with `getAll()` only (full service in Wave 4)

---

### Section 6 — Technical Contract

#### 6c. Zod Schema

```typescript
const unitFormSchema = z.object({
  ownerId:           z.string().min(1, 'Owner is required'),
  projectId:            z.string().min(1, 'Project is required'),
  name:              z.string().min(1, 'Unit name is required').max(100),
  unitType:          z.enum(['villa', 'chalet', 'studio']),
  bedrooms:          z.number({ invalid_type_error: 'Bedrooms are required' }).min(0, 'Min 0 bedrooms'),
  bathrooms:         z.number({ invalid_type_error: 'Bathrooms are required' }).min(0, 'Min 0 bathrooms'),
  maxGuests:         z.number({ invalid_type_error: 'Max guests is required' }).min(1, 'Min 1 guest'),
  basePricePerNight: z.number({ invalid_type_error: 'Price is required' }).min(0, 'Price cannot be negative'),
  isActive:          z.boolean().optional(),
  address:           z.string().max(300).optional(),
  description:       z.string().max(1000).optional(),
})

type UnitFormValues = z.infer<typeof unitFormSchema>
```

---

### Section 7 — API Integration

| Method | Endpoint | Request | Response | When |
|---|---|---|---|---|
| GET | `/api/owners` | `{ page: 1, pageSize: 100 }` | `OwnerListItemResponse[]` | on form mount (for owner Combobox) |
| GET | `/api/projects` | `{ includeInactive: false }` | `ProjectResponse[]` | on form mount (for project Select) |
| POST | `/api/internal/units` | `CreateUnitRequest` | `UnitDetailsResponse` | on form submit |

#### 7d. Mutation Side Effects

```typescript
// After CREATE success:
toastSuccess('Unit created successfully')
queryClient.invalidateQueries({ queryKey: queryKeys.units.internalList({}) })
router.push(ROUTES.admin.units.detail(newUnit.id))
```

---

### Section 12 — Acceptance Criteria

- [ ] Owner dropdown populated from real API (no hardcoded owners)
- [ ] Project dropdown populated from real API (no hardcoded projects)
- [ ] `unitType` field uses lowercase values: 'villa', 'chalet', 'studio'
- [ ] `bedrooms`, `bathrooms`, `maxGuests`, and `basePricePerNight` are numbers (not strings) in the request body
- [ ] On success: redirect to unit detail page
- [ ] 422 errors shown as field-level errors
- [ ] `canManageUnits` gates this page (middleware + `usePermissions` guard)
- [ ] No mock data (no hardcoded owner/project options)

---

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TICKET ID: FE-2-UNITS-04
TITLE: Build Unit Detail page (tabbed layout)
WAVE: Wave 2 — Admin Shell + Units Domain
DOMAIN: Units
PRIORITY: Critical
DEPENDS ON: FE-2-UNITS-01, FE-2-ADMIN-01
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section 1 — Walkthrough

**What is this ticket about?**
The unit detail page at `/admin/units/{id}` is the hub for managing a specific property. It uses a tabbed layout with tabs: Overview (basic info + status), Images, Amenities, Date Blocks, Seasonal Pricing, and Availability Calendar. This ticket builds the shell, header, and the Overview tab only. Other tabs are built in FE-2-UNITS-05 through FE-2-UNITS-10.

**Why NOW?**
All the sub-feature tickets (FE-2-UNITS-05..10) need this page shell to exist first. They each add one tab to it.

**What does success look like?**
Clicking a unit in the list opens `/admin/units/{id}` with the unit name, ownerId/projectId, unitType, isActive badge, base price, bedrooms, bathrooms, and maxGuests in the overview. Tabs are visible (Image, Amenities, etc.) but empty until later tickets build them.

---

### Section 2 — Objective

Build the Unit Detail page shell at `/admin/units/{id}` with a header section (unit info + status badge + edit button) and a tab navigation, rendering only the Overview tab content — so later tickets can drop each tab panel in cleanly.

---

### Section 4 — In Scope

- [ ] `app/(admin)/units/[id]/page.tsx`
- [ ] `GET /api/internal/units/{id}` — fetch full unit details
- [ ] Unit header: name, ownerId, projectId, unitType badge, active/inactive badge, base price, bedrooms, bathrooms, maxGuests
- [ ] Tab navigation: Overview | Images | Amenities | Date Blocks | Seasonal Pricing | Availability
- [ ] Overview tab content: all basic info fields in a read-only layout
- [ ] "Edit Unit" button in header (→ opens edit form or navigates to edit page) — FE-2-UNITS-05
- [ ] "Change Status" button — active/inactive toggle only
- [ ] Status change uses `PATCH /api/internal/units/{id}/status` with `<ConfirmDialog>` and `{ isActive: boolean }`
- [ ] Skeleton loading for the header and tab content
- [ ] Other tabs render placeholder content: "Coming soon in this release" (replaced by later tickets)

**Files to create:**
- `app/(admin)/units/[id]/page.tsx`
- `components/admin/units/UnitDetailHeader.tsx`
- `components/admin/units/UnitDetailTabs.tsx`
- `components/admin/units/tabs/UnitOverviewTab.tsx`

---

### Section 7 — API Integration

| Method | Endpoint | Response | When |
|---|---|---|---|
| GET | `/api/internal/units/{id}` | `UnitDetailsResponse` | on page mount |
| PATCH | `/api/internal/units/{id}/status` | `UnitDetailsResponse` | on status change confirm |

#### 7b. TanStack Query Keys

```typescript
queryKeys.units.internalDetail(id)

// Invalidate after status change:
queryKeys.units.internalDetail(id)
queryKeys.units.internalList({})
```

---

### Section 10 — UX & Loading State Rules

| State | Required? | Behavior |
|---|---|---|
| Loading | ✓ REQUIRED | Header skeleton + tab content skeleton |
| 404 (unit not found) | ✓ REQUIRED | `<EmptyState title="Unit not found">` with "Back to Units" link |
| Status change | ✓ REQUIRED | `<ConfirmDialog>` with message specific to new status |

---

### Section 12 — Acceptance Criteria

- [ ] `GET /api/internal/units/{id}` fetches real data
- [ ] Header shows: name, ownerId, projectId, unitType, isActive, basePricePerNight, bedrooms, bathrooms, maxGuests
- [ ] Tab navigation renders all 6 tabs
- [ ] Overview tab shows all basic fields
- [ ] Status change goes through `<ConfirmDialog>` first
- [ ] Status change uses `PATCH` with `{ isActive: boolean }` body
- [ ] 404 handled gracefully
- [ ] No mock data

---

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TICKET ID: FE-2-UNITS-05
TITLE: Build Edit Unit form
WAVE: Wave 2 — Admin Shell + Units Domain
DOMAIN: Units
PRIORITY: High
DEPENDS ON: FE-2-UNITS-04, FE-2-UNITS-03 (UnitForm shared component)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section 1 — Walkthrough

**What is this ticket about?**
The Edit Unit form lets SuperAdmin and Tech users update a unit's name, unitType, description, address, bedrooms, bathrooms, maxGuests, basePricePerNight, and isActive. It can also update ownerId and projectId because the API `PUT /api/internal/units/{id}` accepts the full create contract. The form pre-fills with existing data from the unit detail query.

---

### Section 4 — In Scope

- [ ] `app/(admin)/units/[id]/edit/page.tsx`
- [ ] Reuses `<UnitForm>` from FE-2-UNITS-03 but with pre-filled values (edit mode)
- [ ] `GET /api/internal/units/{id}` to pre-fill (cached from detail page)
- [ ] `PUT /api/internal/units/{id}` on submit
- [ ] Owner and Project fields shown as read-only text (not editable Combobox)
- [ ] On success: redirect back to unit detail page

**Files to create:**
- `app/(admin)/units/[id]/edit/page.tsx`

**Files to modify:**
- `components/admin/units/UnitForm.tsx` — add `mode: 'create' | 'edit'` prop + `isOwnerProjectEditable: boolean`

---

### Section 6 — Technical Contract

#### 6c. Zod Schema

Same as FE-2-UNITS-03 (full contract):

```typescript
const editUnitFormSchema = z.object({
  ownerId:           z.string().min(1),
  projectId:            z.string().min(1),
  name:              z.string().min(1, 'Unit name is required'),
  unitType:          z.enum(['villa', 'chalet', 'studio']),
  bedrooms:          z.number().min(0),
  bathrooms:         z.number().min(0),
  maxGuests:         z.number().min(1),
  basePricePerNight: z.number().min(0),
  isActive:          z.boolean().optional(),
  address:           z.string().max(300).optional(),
  description:       z.string().max(1000).optional(),
})
```

---

### Section 7 — API Integration

| Method | Endpoint | Request | Response | When |
|---|---|---|---|---|
| GET | `/api/internal/units/{id}` | — | `UnitDetailsResponse` | pre-fill (cached) |
| PUT | `/api/internal/units/{id}` | `UpdateUnitRequest` | `UnitDetailsResponse` | on form submit |

#### 7d. Mutation Side Effects

```typescript
toastSuccess('Unit updated successfully')
queryClient.invalidateQueries({ queryKey: queryKeys.units.internalDetail(id) })
queryClient.invalidateQueries({ queryKey: queryKeys.units.internalList({}) })
router.push(ROUTES.admin.units.detail(id))
```

---

### Section 12 — Acceptance Criteria

- [ ] Form pre-fills with existing unit data
- [ ] Owner and Project shown as read-only (no edit capability)
- [ ] `PUT /api/internal/units/{id}` called with changed fields only (partial update)
- [ ] Query cache updated after edit
- [ ] No mock data

---

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TICKET ID: FE-2-UNITS-06
TITLE: Build Unit Images management
WAVE: Wave 2 — Admin Shell + Units Domain
DOMAIN: Units
PRIORITY: High
DEPENDS ON: FE-2-UNITS-04
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section 1 — Walkthrough

**What is this ticket about?**
The Images tab on the unit detail page lets admins manage the unit's photo gallery: add new images (by URL — the platform uses cloud storage, images are uploaded externally and the URL is pasted here), reorder them, set the cover image, and delete images.

**Important:** Image UPLOAD is out of scope in MVP. The backend stores URLs pointing to images hosted in Azure Blob or AWS S3. The admin pastes the URL directly. No file upload widget.

---

### Section 4 — In Scope

- [ ] Populates the "Images" tab in `UnitDetailTabs` (from FE-2-UNITS-04)
- [ ] `components/admin/units/tabs/UnitImagesTab.tsx`
- [ ] `GET /api/units/{unitId}/images` — list images (already in `UnitDetailsResponse.images`)
- [ ] Add image: Input for `fileKey` + "Add Image" button → `POST /api/internal/units/{unitId}/images`
- [ ] Reorder: drag-and-drop or up/down arrows → `PUT /api/internal/units/{unitId}/images/reorder`
- [ ] Set cover: "Set as Cover" button → `PATCH /api/internal/units/{unitId}/images/{imageId}/cover`
- [ ] Delete: "Remove" button → `DELETE /api/internal/units/{unitId}/images/{imageId}` with `<ConfirmDialog>`
- [ ] Images displayed as thumbnail grid with `next/image`
- [ ] Cover image marked with a badge/overlay

**Files to create:**
- `components/admin/units/tabs/UnitImagesTab.tsx`

---

### Section 6 — Technical Contract

#### 6c. Zod Schema

```typescript
const addImageSchema = z.object({
  fileKey: z.string().min(1, 'fileKey is required'),
  isCover:  z.boolean().optional(),
})
```

---

### Section 7 — API Integration

| Method | Endpoint | Request | When |
|---|---|---|---|
| GET | `/api/units/{unitId}/images` | — | on tab mount (cached in unit detail) |
| POST | `/api/internal/units/{unitId}/images` | `AddUnitImageRequest` | on add image submit |
| PUT | `/api/internal/units/{unitId}/images/reorder` | `ReorderUnitImagesRequest` | on reorder |
| PATCH | `/api/internal/units/{unitId}/images/{imageId}/cover` | — | on set cover |
| DELETE | `/api/internal/units/{unitId}/images/{imageId}` | — | on delete confirm |

#### 7b. TanStack Query Keys

```typescript
queryKeys.units.images(unitId)
queryKeys.units.internalDetail(unitId)

// Invalidate after any image mutation:
queryKeys.units.images(unitId)
queryKeys.units.internalDetail(unitId)   // because UnitDetailsResponse.images also updates
```

---

### Section 10 — UX & Loading State Rules

| State | Required? | Behavior |
|---|---|---|
| No images | ✓ REQUIRED | EmptyState "No images yet. Add the first image URL above." |
| Cover image | ✓ REQUIRED | Badge "Cover" overlay on the cover image thumbnail |
| Delete confirm | ✓ REQUIRED | ConfirmDialog before deletion |
| Add loading | ✓ REQUIRED | Button spinner while POST is in flight |

---

### Section 12 — Acceptance Criteria

- [ ] Images displayed as thumbnail grid using `next/image`
- [ ] Add image accepts URL input (no file upload)
- [ ] Cover image visually distinguished
- [ ] Delete requires ConfirmDialog
- [ ] Reorder updates `displayOrder` via PUT endpoint
- [ ] All mutations invalidate image query + unit detail query
- [ ] No mock data (no hardcoded image URLs)

---

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TICKET ID: FE-2-UNITS-07
TITLE: Build Unit Amenities assignment
WAVE: Wave 2 — Admin Shell + Units Domain
DOMAIN: Units
PRIORITY: High
DEPENDS ON: FE-2-UNITS-04, FE-2-ADMIN-04
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section 1 — Walkthrough

**What is this ticket about?**
The Amenities tab shows which amenities are currently assigned to the unit (Pool, Parking, Sea View, etc.) and allows updating the selection. The API uses a "replace" pattern — you send the complete new set of amenityIds and it replaces the existing assignment.

---

### Section 4 — In Scope

- [ ] `components/admin/units/tabs/UnitAmenitiesTab.tsx`
- [ ] `GET /api/units/{unitId}/amenities` — current amenities (cached in unit detail)
- [ ] `GET /api/amenities` — all available amenities (from FE-2-ADMIN-04 service)
- [ ] Display: two sections — "Assigned" and "Available"
- [ ] Toggle amenity: click to add/remove from selection
- [ ] "Save Changes" button → `PUT /api/internal/units/{unitId}/amenities` with full `amenityIds` array
- [ ] Optimistic UI optional — not required for MVP

**Files to create:**
- `components/admin/units/tabs/UnitAmenitiesTab.tsx`

---

### Section 7 — API Integration

| Method | Endpoint | Request | Response | When |
|---|---|---|---|---|
| GET | `/api/units/{unitId}/amenities` | — | `UnitAmenityResponse[]` | on tab mount |
| GET | `/api/amenities` | — | `AmenityResponse[]` | on tab mount |
| PUT | `/api/internal/units/{unitId}/amenities` | `ReplaceUnitAmenitiesRequest` | `UnitAmenityResponse[]` | on save |

**CRITICAL:** The API uses `PUT` (replace all) not `POST` (add one). Send the complete array of selected `amenityIds`.

---

### Section 12 — Acceptance Criteria

- [ ] All available amenities shown
- [ ] Currently assigned amenities visually marked (checkmark or highlighted)
- [ ] "Save Changes" sends `PUT` with complete `amenityIds` array
- [ ] Changes reflected immediately after save
- [ ] Query invalidated: unit detail + unit amenities
- [ ] No mock data

---

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TICKET ID: FE-2-UNITS-08
TITLE: Build Date Blocks management
WAVE: Wave 2 — Admin Shell + Units Domain
DOMAIN: Units
PRIORITY: High
DEPENDS ON: FE-2-UNITS-04, FE-1-UI-08
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section 1 — Walkthrough

**What is this ticket about?**
Admins can block specific date ranges on a unit for maintenance, owner personal use, or other reasons. These blocked dates make the unit unavailable to clients during that period. This ticket builds the Date Blocks tab: list existing blocks, add new ones, edit, and delete.

---

### Section 4 — In Scope

- [ ] `components/admin/units/tabs/UnitDateBlocksTab.tsx`
- [ ] `GET /api/internal/units/{unitId}/date-blocks` — list existing blocks
- [ ] `POST /api/internal/units/{unitId}/date-blocks` — create new block
- [ ] `PUT /api/internal/date-blocks/{id}` — edit block
- [ ] `DELETE /api/internal/date-blocks/{id}` — delete block
- [ ] List: table with columns: Start Date, End Date, Reason, Notes, Created By, Actions (edit/delete)
- [ ] Create/Edit: modal form with DateRangePicker + reason Select + notes Textarea
- [ ] Delete requires `<ConfirmDialog>`
- [ ] Reason options: `DATE_BLOCK_REASONS` from constants (Maintenance, OwnerUse, Other)
- [ ] Display: `DATE_BLOCK_REASON_LABELS` for human-readable labels

**Files to create:**
- `components/admin/units/tabs/UnitDateBlocksTab.tsx`
- `components/admin/units/DateBlockForm.tsx`

---

### Section 6 — Technical Contract

#### 6c. Zod Schema

```typescript
const dateBlockSchema = z.object({
  startDate: z.string().min(1, 'Start date is required'),
  endDate:   z.string().min(1, 'End date is required'),
  reason:    z.enum(['Maintenance', 'OwnerUse', 'Other']),
  notes:     z.string().max(500).optional(),
})
// Note: startDate must be before endDate — add .refine() validation
```

#### 6d. Key Enums / Constants Used

```typescript
// From lib/constants/date-block-reasons.ts:
DATE_BLOCK_REASONS         // { maintenance: 'Maintenance', owner_use: 'OwnerUse', other: 'Other' }
DATE_BLOCK_REASON_LABELS   // { Maintenance: 'Maintenance', OwnerUse: "Owner's Personal Use", Other: 'Other' }
```

---

### Section 7 — API Integration

| Method | Endpoint | Request | Response | When |
|---|---|---|---|---|
| GET | `/api/internal/units/{unitId}/date-blocks` | — | `DateBlockResponse[]` | on tab mount |
| POST | `/api/internal/units/{unitId}/date-blocks` | `CreateDateBlockRequest` | `DateBlockResponse` | on create submit |
| PUT | `/api/internal/date-blocks/{id}` | `UpdateDateBlockRequest` | `DateBlockResponse` | on edit submit |
| DELETE | `/api/internal/date-blocks/{id}` | — | void | on delete confirm |

**CRITICAL — Reason values are PascalCase:**
```typescript
// Request body must use: 'Maintenance' | 'OwnerUse' | 'Other'
// NOT: 'maintenance' | 'owner_use' | 'other'
// Use DATE_BLOCK_REASONS constants, which already have PascalCase values
```

---

### Section 12 — Acceptance Criteria

- [ ] Date blocks listed in a table with Start Date, End Date, Reason (human-readable label), Notes, Created By
- [ ] `DateRangePicker` used for start/end date selection
- [ ] Reason dropdown uses `DATE_BLOCK_REASON_LABELS` for display
- [ ] API request sends PascalCase reason: `'Maintenance'`, `'OwnerUse'`, `'Other'`
- [ ] Delete requires `<ConfirmDialog>`
- [ ] `startDate < endDate` validated before submit
- [ ] `formatDate()` used for date display
- [ ] Query invalidated after every mutation
- [ ] No mock data

---

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TICKET ID: FE-2-UNITS-09
TITLE: Build Seasonal Pricing management
WAVE: Wave 2 — Admin Shell + Units Domain
DOMAIN: Units
PRIORITY: High
DEPENDS ON: FE-2-UNITS-04, FE-1-UI-08
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section 1 — Walkthrough

**What is this ticket about?**
Units can have different prices for different seasons (summer peak pricing, Eid pricing, etc.). The Seasonal Pricing tab lets admins define date ranges with a label and a per-night price. When a booking falls within a seasonal pricing window, that price overrides the base price.

---

### Section 4 — In Scope

- [ ] `components/admin/units/tabs/UnitSeasonalPricingTab.tsx`
- [ ] `GET /api/internal/units/{unitId}/seasonal-pricing`
- [ ] `POST /api/internal/units/{unitId}/seasonal-pricing`
- [ ] `PUT /api/internal/seasonal-pricing/{id}`
- [ ] `DELETE /api/internal/seasonal-pricing/{id}`
- [ ] List: table — Label, Date Range, Price/Night, Actions (edit/delete)
- [ ] Create/Edit: modal with label Input, DateRangePicker, price NumberInput
- [ ] Display base price alongside seasonal prices for context: "Base: X EGP/night"
- [ ] `formatCurrency()` for price display
- [ ] `formatDateRange()` for date range display

**Files to create:**
- `components/admin/units/tabs/UnitSeasonalPricingTab.tsx`
- `components/admin/units/SeasonalPricingForm.tsx`

---

### Section 6 — Technical Contract

#### 6c. Zod Schema

```typescript
const seasonalPricingSchema = z.object({
  label:         z.string().min(1, 'Label is required').max(100),
  startDate:     z.string().min(1, 'Start date required'),
  endDate:       z.string().min(1, 'End date required'),
  pricePerNight: z.number({ invalid_type_error: 'Price required' }).min(0, 'Price cannot be negative'),
})
```

---

### Section 7 — API Integration

| Method | Endpoint | Request | Response | When |
|---|---|---|---|---|
| GET | `/api/internal/units/{unitId}/seasonal-pricing` | — | `SeasonalPricingResponse[]` | on tab mount |
| POST | `/api/internal/units/{unitId}/seasonal-pricing` | `CreateSeasonalPricingRequest` | `SeasonalPricingResponse` | on create |
| PUT | `/api/internal/seasonal-pricing/{id}` | `UpdateSeasonalPricingRequest` | `SeasonalPricingResponse` | on edit |
| DELETE | `/api/internal/seasonal-pricing/{id}` | — | void | on delete confirm |

---

### Section 12 — Acceptance Criteria

- [ ] Seasonal pricing rules listed in table
- [ ] Create/edit form uses DateRangePicker and number input for price
- [ ] `pricePerNight` sent as number (not string)
- [ ] `formatCurrency()` used for price display
- [ ] `formatDateRange()` used for date range display
- [ ] Delete requires `<ConfirmDialog>`
- [ ] Base price shown for context
- [ ] Query invalidated after mutations
- [ ] No mock data

---

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TICKET ID: FE-2-UNITS-10
TITLE: Build Unit Availability calendar
WAVE: Wave 2 — Admin Shell + Units Domain
DOMAIN: Units
PRIORITY: Medium
DEPENDS ON: FE-2-UNITS-04, FE-2-UNITS-08, FE-2-UNITS-09
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section 1 — Walkthrough

**What is this ticket about?**
The Availability tab gives a visual calendar view of the unit: which dates are booked (soft-held or confirmed), which are blocked (date blocks), and which have special pricing. It's a read-only visualization using `POST /api/units/{unitId}/availability/operational-check` for a given month range.

**Why NOW?**
This is the last tab on the unit detail page. After this ticket, the unit detail page is 100% feature-complete.

---

### Section 4 — In Scope

- [ ] `components/admin/units/tabs/UnitAvailabilityTab.tsx`
- [ ] Month/year navigation (prev/next month)
- [ ] `POST /api/units/{unitId}/availability/operational-check` called with full month range
- [ ] Calendar grid: each day colored by status:
  - Available: white/light
  - Booked (from `conflictingBookings`): primary/terracotta
  - Blocked (from `blockedDates`): neutral/gray
  - Seasonal pricing (from `applicablePricing`): accent-gold border
- [ ] Legend below calendar explaining colors
- [ ] Tooltip on hover: show booking details or block reason
- [ ] Not interactive (read-only) — no ability to create blocks from here

**Files to create:**
- `components/admin/units/tabs/UnitAvailabilityTab.tsx`
- `components/admin/units/AvailabilityCalendar.tsx`

---

### Section 7 — API Integration

| Method | Endpoint | Request | Response | When |
|---|---|---|---|---|
| POST | `/api/units/{unitId}/availability/operational-check` | `CheckOperationalAvailabilityRequest` | `OperationalAvailabilityResponse` | on month change |

```typescript
// Request for full month:
const firstDay = new Date(year, month, 1)
const lastDay  = new Date(year, month + 1, 0)
const request: CheckOperationalAvailabilityRequest = {
  startDate: format(firstDay, 'yyyy-MM-dd'),
  endDate:   format(lastDay,  'yyyy-MM-dd'),
}
```

#### 7c. Query Configuration

```typescript
staleTime: 0   // availability is time-sensitive — always fresh
```

---

### Section 12 — Acceptance Criteria

- [ ] Calendar shows current month with correct day grid
- [ ] Booked, Blocked, and Seasonal dates visually distinguished
- [ ] Month navigation updates the API call range
- [ ] `staleTime: 0` on availability query
- [ ] Legend visible below calendar
- [ ] Read-only (no click-to-block on the calendar itself)
- [ ] No mock data (no hardcoded booked/blocked dates)

---

---

# Wave 2 — QA Prompt

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WAVE QA REVIEW PROMPT
Wave: 2 — Admin Shell + Units Domain
Tickets: FE-2-ADMIN-01, FE-2-ADMIN-02, FE-2-ADMIN-03, FE-2-ADMIN-04,
         FE-2-UNITS-01 through FE-2-UNITS-10
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You are a senior QA engineer reviewing Wave 2 of the Rental Platform frontend.

## MOCK DATA AUDIT — HARD GATE

Run ALL — must return zero results:

```bash
grep -rn "mockData\|fakeUnit\|sampleUnit\|faker\|json-server\|msw" \
  --include="*.ts" --include="*.tsx" components/admin/ lib/api/services/

grep -rn "const \w*Units\? = \[" --include="*.ts" --include="*.tsx" .
grep -rn "const \w*Projects\? = \[" --include="*.ts" --include="*.tsx" .
grep -rn "const \w*Owners\? = \[" --include="*.ts" --include="*.tsx" .

# Enum case violations:
grep -rn "'villa'\|'chalet'\|'studio'" lib/constants/ components/ lib/api/
# ↑ These ARE correct (lowercase) — but the grep should show only in constants, not hardcoded elsewhere

grep -rn "'maintenance'\|'owner_use'\|'in_app'" --include="*.ts" --include="*.tsx" .
# ↑ These should return ZERO — API uses PascalCase: 'Maintenance', 'OwnerUse', 'InApp'

grep -rn "pagination\.total[^C]" --include="*.ts" --include="*.tsx" .
# ↑ Must be pagination.totalCount — not .total
```

## API CONTRACT VERIFICATION

### Units:
- [ ] `GET /api/internal/units` used (not public `/api/units`) for admin list
- [ ] `GET /api/projects` called with `{ includeInactive: true }` in admin context
- [ ] `POST /api/internal/units` body has: ownerId, projectId, name, unitType, bedrooms, bathrooms, maxGuests, basePricePerNight
- [ ] `unitType` field is lowercase: 'villa' | 'chalet' | 'studio' (API design — lowercase)
- [ ] `PUT /api/internal/units/{id}` used for edit (NOT POST or PATCH)
- [ ] `PATCH /api/internal/units/{id}/status` used for status change with `{ isActive: boolean }` body
- [ ] Images: `PUT /api/internal/units/{unitId}/images/reorder` for reorder
- [ ] Amenities: `PUT /api/internal/units/{unitId}/amenities` for replace-all (NOT POST for individual add)
- [ ] Date blocks: reason values are PascalCase: 'Maintenance', 'OwnerUse', 'Other'
- [ ] Date blocks: CREATE uses `/api/internal/units/{unitId}/date-blocks`, UPDATE uses `/api/internal/date-blocks/{id}`
- [ ] Seasonal pricing: similar pattern — CREATE on unit path, UPDATE/DELETE on standalone path
- [ ] Availability check: uses POST (not GET) to `/api/units/{unitId}/availability/operational-check`
- [ ] Availability/pricing request body: `{ startDate, endDate }` in ISO format

### Pagination:
- [ ] All paginated endpoints use `totalCount` (not `total`)
- [ ] `totalPages` from API used for page navigation
- [ ] `keepPreviousData: true` on units list query

### Permissions:
- [ ] Admin shell sidebar: each nav item shown only to authorized roles
- [ ] "Create Unit" visible only to SuperAdmin + Tech (`canManageUnits`)
- [ ] Project create/edit/delete visible only to SuperAdmin (`canManageProjects`)
- [ ] Amenity create visible only to SuperAdmin (`canManageAmenities`)
- [ ] Status toggles hidden from unauthorized roles

## PER-TICKET CHECKS

### FE-2-ADMIN-01 — Admin Shell
- [ ] Sidebar nav items filtered by `usePermissions()` (not hardcoded role checks)
- [ ] Sidebar collapse persists across navigation (Zustand UIStore)
- [ ] Active nav item highlighted (usePathname)
- [ ] Header shows `user.identifier` (not `user.name` — field is `identifier` from auth store)
- [ ] Header shows role badge
- [ ] LogoutButton present and functional

### FE-2-ADMIN-02 — Dashboard
- [ ] Reports API endpoints used (not units/bookings list endpoints for counting)
- [ ] `staleTime: 5 minutes` on report queries
- [ ] `formatCurrency()` used for revenue display
- [ ] Skeleton shown while loading

### FE-2-ADMIN-03 — Projects
- [ ] `includeInactive: true` passed when fetching for admin view
- [ ] Status toggle uses `PATCH /api/projects/{id}/status` with `{ isActive: boolean }`
- [ ] ConfirmDialog before status toggle
- [ ] 422 errors displayed as field-level form errors
- [ ] Query invalidated after all mutations

### FE-2-UNITS-01 — Types/Service
- [ ] `DateBlockReason`: 'Maintenance' | 'OwnerUse' | 'Other' (PascalCase)
- [ ] `UnitType`: 'villa' | 'chalet' | 'studio' (lowercase)
- [ ] `PaginatedUnits.pagination` uses `totalCount` + `totalPages`
- [ ] All 20+ service functions have correct TypeScript types
- [ ] No `any` type

### FE-2-UNITS-02 — Units List
- [ ] Filters reflected in URL query params
- [ ] `keepPreviousData: true`
- [ ] Pagination shows "X of totalCount results"
- [ ] Empty state distinguishes between "no units" and "no results for filters"

### FE-2-UNITS-03 — Create Unit
- [ ] Owner dropdown from real `GET /api/owners` (no hardcoded)
- [ ] Project dropdown from real `GET /api/projects`
- [ ] `unitType` field sends lowercase value to API
- [ ] `bedrooms`, `bathrooms`, `maxGuests`, and `basePricePerNight` sent as numbers (not strings)
- [ ] Redirect to unit detail on success

### FE-2-UNITS-04 — Unit Detail
- [ ] 404 handled gracefully
- [ ] Status change via ConfirmDialog + PATCH endpoint
- [ ] Tabs visible for all 6 sections

### FE-2-UNITS-05 — Edit Unit
- [ ] Owner and Project shown read-only
- [ ] `PUT` used (not `POST` or `PATCH`)

### FE-2-UNITS-06 — Images
- [ ] Add image accepts URL only (no file upload)
- [ ] Cover image visually distinguished
- [ ] Reorder uses PUT
- [ ] Cover set uses PATCH

### FE-2-UNITS-07 — Amenities
- [ ] Uses `PUT` (replace-all) not `POST` (add-one)
- [ ] Sends complete `amenityIds` array

### FE-2-UNITS-08 — Date Blocks
- [ ] Reason sent as PascalCase to API
- [ ] DateRangePicker used
- [ ] startDate < endDate validated

### FE-2-UNITS-09 — Seasonal Pricing
- [ ] `pricePerNight` sent as number
- [ ] `formatCurrency()` for display

### FE-2-UNITS-10 — Availability Calendar
- [ ] Uses POST for availability check
- [ ] `staleTime: 0`
- [ ] Read-only (no click interactions)

## ARCHITECTURE CHECK
- [ ] No direct axios in components — all through service layer
- [ ] No inline endpoint strings
- [ ] No inline route strings
- [ ] No `any` TypeScript types
- [ ] No server data in Zustand
- [ ] `next/image` used for all unit images (not `<img>`)

## TYPESCRIPT CHECK
Run: `pnpm type-check` → zero errors

## Wave 2 Sign-off Recommendation
[ ] APPROVED
[ ] CONDITIONAL — conditions: ...
[ ] BLOCKED — blockers: ...
```

---

---

# Wave 2 — PM Sign-off Checklist

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PM WAVE SIGN-OFF CHECKLIST
Wave: 2 — Admin Shell + Units Domain
Date: _______________
Reviewed by: _______________
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### A. QA Report Review
- [ ] QA report received and reviewed
- [ ] All BLOCKERs resolved (PR links): ________________
- [ ] All WARNINGs resolved or accepted
- [ ] MOCK DATA AUDIT PASSED — all greps returned zero

### B. Business Requirements Validation

Manually test these scenarios:

| Scenario | Tested | Pass/Fail |
|---|---|---|
| SuperAdmin logs in → sees all 9 nav items in sidebar | | |
| Sales logs in → CRM visible, Finance NOT visible | | |
| Finance logs in → Finance visible, CRM NOT visible | | |
| Tech logs in → Units visible, Finance/CRM NOT visible | | |
| SuperAdmin creates a new project → appears in list | | |
| SuperAdmin creates a new unit (villa, owner X, project Y, 1500 EGP/night) | | |
| Unit detail page shows all tabs | | |
| SuperAdmin adds an image URL to a unit → thumbnail appears | | |
| SuperAdmin blocks dates (maintenance) → reason shows correctly | | |
| Seasonal pricing rule created → appears in list with correct price | | |
| Availability calendar shows blocked dates visually | | |

### C. Definition of Done
- [ ] `pnpm type-check` clean
- [ ] `pnpm lint` clean
- [ ] All 14 tickets merged to main
- [ ] No mock data (grep audit passed)
- [ ] Admin shell sidebar role-filtering verified with all 4 role types
- [ ] Unit type values are lowercase in API requests (villa/chalet/studio)
- [ ] Date block reason values are PascalCase in API requests (Maintenance/OwnerUse/Other)
- [ ] Pagination uses `totalCount` not `total`

### D. API Contract Sign-off
- [ ] Admin internal endpoints used (not public) for admin views
- [ ] `includeInactive: true` passed in admin project fetch
- [ ] Amenities assignment uses PUT (replace-all), not POST (add-one)
- [ ] Availability check uses POST method (not GET)
- [ ] Status changes via correct PATCH endpoints

### E. Next Wave Readiness (Wave 3 — CRM + Bookings)
- [ ] Admin shell layout available for CRM and Bookings pages to drop into
- [ ] `usePermissions()` tested and working
- [ ] Projects service available for booking forms that need project context
- [ ] Units service available for booking forms that reference units

### F. Mock Data Final Audit
```bash
grep -rn "faker\|json-server\|msw\|mockData\|fakeUnit\|sampleUnit" \
  --include="*.ts" --include="*.tsx" components/admin/ lib/
grep -rn "'maintenance'\|'owner_use'" --include="*.ts" --include="*.tsx" .
grep -rn "pagination\.total[^C]" --include="*.ts" --include="*.tsx" .
```
- [ ] All zero results
- [ ] Audit by: ____________ Date: ____________

### G. Sign-off Decision

```
[ ] WAVE 2 APPROVED — Wave 3 may begin.

[ ] WAVE 2 APPROVED WITH CONDITIONS
    Conditions: _______________
    Must resolve by: _______________

[ ] WAVE 2 NOT APPROVED
    Blockers: _______________
    Re-review: _______________
```

**Signed off by:** ______________ **Date:** ______________

---

# Wave 2 — Final Summary

| Track | # | Ticket | Key Deliverable |
|---|---|---|---|
| A | 1 | FE-2-ADMIN-01 | Admin shell (sidebar + header, role-filtered nav) |
| A | 2 | FE-2-ADMIN-02 | Dashboard (stats from reporting API) |
| A | 3 | FE-2-ADMIN-03 | Projects CRUD + status toggle |
| A | 4 | FE-2-ADMIN-04 | Amenities management |
| B | 5 | FE-2-UNITS-01 | Units service layer + all TypeScript types |
| B | 6 | FE-2-UNITS-02 | Units list (filters, search, pagination) |
| B | 7 | FE-2-UNITS-03 | Create unit form |
| B | 8 | FE-2-UNITS-04 | Unit detail page (tabbed shell) |
| B | 9 | FE-2-UNITS-05 | Edit unit form |
| B | 10 | FE-2-UNITS-06 | Unit images (add URL, reorder, set cover) |
| B | 11 | FE-2-UNITS-07 | Unit amenities assignment (replace-all pattern) |
| B | 12 | FE-2-UNITS-08 | Date blocks (maintenance/owner use) |
| B | 13 | FE-2-UNITS-09 | Seasonal pricing rules |
| B | 14 | FE-2-UNITS-10 | Availability calendar (read-only) |

**Next Wave:** Wave 3 — CRM + Bookings (18 tickets — the heart of the business)

*End of Wave 2 ticket pack.*
