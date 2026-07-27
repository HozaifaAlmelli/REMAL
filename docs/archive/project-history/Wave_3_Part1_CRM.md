# Wave 3 — CRM + Bookings
## Rental Platform Frontend — Complete Ticket Pack
**Wave Number:** 3
**Wave Name:** CRM + Bookings
**Total Tickets:** 18
**Estimated Days (1 dev):** 7
**Parallel Tracks:** Track A (CRM, 9 tickets) + Track B (Bookings, 9 tickets)
**Critical Path:** This is the heart of the business. Nothing generates revenue without this wave.

---

## Wave 3 Overview

**Track A — CRM Domain (FE-3-CRM-01 → 09):**
The sales pipeline. Every lead from the website lands here. Sales tracks them through stages (Prospecting → Relevant → Booked → Confirmed → CheckIn → Completed), adds notes, assigns leads to team members, and converts booked leads into formal bookings.

**Track B — Bookings Domain (FE-3-BOOK-01 → 09):**
The bookings management system. After a lead converts, it becomes a formal booking. Admin records payments, generates invoices, confirms check-in, marks completion, and can view the full financial snapshot per booking.

**IMPORTANT ARCHITECTURE NOTE — CRM vs Bookings:**
These are two DIFFERENT entities:
- **CRM Lead** (`/api/internal/crm/leads`) — the sales pipeline entity. Has 10 statuses (Prospecting through LeftEarly). Created from the public website form. Managed by Sales team.
- **Booking** (`/api/internal/bookings`) — the formal booking entity. Has 6 statuses (Pending through LeftEarly). Created via "Convert Lead to Booking" or directly. Finance records payments against bookings.
- They have separate service files, separate hooks, separate type files, and separate query keys.
- Do NOT merge or confuse them.

---

## ⛔ GLOBAL RULES

```
NO MOCK DATA — EVER.
All data from real API only.

CRM Lead Statuses (PascalCase):
'Prospecting' | 'Relevant' | 'NoAnswer' | 'NotRelevant' |
'Booked' | 'Confirmed' | 'CheckIn' | 'Completed' | 'Cancelled' | 'LeftEarly'

Booking Statuses (PascalCase):
'Pending' | 'Confirmed' | 'CheckIn' | 'Completed' | 'Cancelled' | 'LeftEarly'

Payment Statuses: 'Pending' | 'Paid' | 'Failed' | 'Cancelled'
Payment Methods:  'InstaPay' | 'VodafoneCash' | 'Cash' | 'BankTransfer'
Invoice Statuses: 'Draft' | 'Issued' | 'Cancelled'

Pagination: totalCount + totalPages (not total)
Endpoints: from endpoints.ts only
Routes: from routes.ts only
```

---

## Ticket List

| # | Ticket ID | Title | Track | Priority |
|---|-----------|-------|-------|----------|
| 1 | FE-3-CRM-01 | Create CRM service layer + TypeScript types | A | Critical |
| 2 | FE-3-CRM-02 | Build CRM Pipeline kanban board | A | Critical |
| 3 | FE-3-CRM-03 | Build Lead Card component | A | Critical |
| 4 | FE-3-CRM-04 | Build Lead Detail page | A | Critical |
| 5 | FE-3-CRM-05 | Build Lead status transitions UI | A | Critical |
| 6 | FE-3-CRM-06 | Build Lead Notes management | A | High |
| 7 | FE-3-CRM-07 | Build Lead Assignment | A | High |
| 8 | FE-3-CRM-08 | Build Create Lead form (admin-initiated) | A | High |
| 9 | FE-3-CRM-09 | Build Convert Lead to Booking | A | Critical |
| 10 | FE-3-BOOK-01 | Create Bookings service layer + TypeScript types | B | Critical |
| 11 | FE-3-BOOK-02 | Build Bookings list page | B | Critical |
| 12 | FE-3-BOOK-03 | Build Booking Detail page | B | Critical |
| 13 | FE-3-BOOK-04 | Build Booking lifecycle actions | B | Critical |
| 14 | FE-3-BOOK-05 | Build Record Payment flow | B | Critical |
| 15 | FE-3-BOOK-06 | Build Invoice management | B | High |
| 16 | FE-3-BOOK-07 | Build Booking Finance Snapshot | B | High |
| 17 | FE-3-BOOK-08 | Build Booking Notes + Assignment | B | High |
| 18 | FE-3-BOOK-09 | Build Booking Status History timeline | B | High |

---

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TICKET ID: FE-3-CRM-01
TITLE: Create CRM service layer + TypeScript types
WAVE: Wave 3 — CRM + Bookings
DOMAIN: CRM
PRIORITY: Critical
DEPENDS ON: FE-0-INFRA-03, FE-0-INFRA-04, FE-0-INFRA-07
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section 1 — Walkthrough

**What is this ticket about?**
All 9 CRM tickets depend on typed API contracts and a service layer. This ticket creates everything upfront: full TypeScript types matching the API reference exactly, plus all service functions for CRM leads, notes, and assignments.

**Why NOW?**
FE-3-CRM-02 through FE-3-CRM-09 all import from here. Must exist first.

---

### Section 2 — Objective

Create `lib/types/crm.types.ts`, `lib/api/services/crm.service.ts`, and `lib/hooks/useCrm.ts` with full contracts for all CRM endpoints.

---

### Section 4 — In Scope

- [ ] `lib/types/crm.types.ts` — all CRM type definitions
- [ ] `lib/api/services/crm.service.ts` — all CRM API calls
- [ ] `lib/hooks/useCrm.ts` — TanStack Query hooks (stubs — implementations added per ticket)

**Files to create:**
- `lib/types/crm.types.ts`
- `lib/api/services/crm.service.ts`
- `lib/hooks/useCrm.ts`

**Files to modify:**
- `lib/types/index.ts` — add `export * from './crm.types'`

---

### Section 6 — Technical Contract

```typescript
// lib/types/crm.types.ts
// All contracts from KAZA_BOOKING_API_Reference.md

// ── Status Types ──
// CRM Lead uses the FULL 10-status pipeline:
type CrmLeadStatus =
  | 'Prospecting' | 'Relevant' | 'NoAnswer' | 'NotRelevant'
  | 'Booked' | 'Confirmed' | 'CheckIn' | 'Completed'
  | 'Cancelled' | 'LeftEarly'

// ── CRM Lead List Item (from GET /api/internal/crm/leads) ──
interface CrmLeadListItemResponse {
  id:              string
  clientId:        string | null
  targetUnitId:    string | null
  assignedAdminUserId: string | null
  contactName:     string
  contactPhone:    string
  contactEmail:    string | null
  leadStatus:      CrmLeadStatus
  source:          string          // BookingSource PascalCase: 'Website'|'App'|'WhatsApp'|'PhoneCall'|'Referral'
  desiredCheckInDate:  string | null
  desiredCheckOutDate: string | null
  guestCount:          number | null
  createdAt:       string
}

// ── CRM Lead Full Details (from GET /api/internal/crm/leads/{id}) ──
interface CrmLeadDetailsResponse {
  id:              string
  clientId:        string | null
  targetUnitId:    string | null
  assignedAdminUserId: string | null
  contactName:     string
  contactPhone:    string
  contactEmail:    string | null
  leadStatus:      CrmLeadStatus
  source:          string
  notes:           string | null
  desiredCheckInDate:  string | null
  desiredCheckOutDate: string | null
  guestCount:          number | null
  createdAt:       string
  updatedAt:       string
}

// ── CRM Lead Filters ──
interface CrmLeadFilters {
  leadStatus?:          CrmLeadStatus
  assignedAdminUserId?: string
  page?:                number
  pageSize?:            number
}

// ── Create Lead (admin-initiated) ──
interface CreateCrmLeadRequest {
  clientId?:       string
  targetUnitId?:   string
  contactName:    string
  contactPhone:   string
  contactEmail?:  string
  desiredCheckInDate?:  string
  desiredCheckOutDate?: string
  guestCount?:          number
  source:         string      // 'Website'|'App'|'WhatsApp'|'PhoneCall'|'Referral'
  notes?:         string
}

// ── Update Lead ──
interface UpdateCrmLeadRequest {
  clientId?:       string
  targetUnitId?:   string
  assignedAdminUserId?: string
  contactName?:   string
  contactPhone?:  string
  contactEmail?:  string
  desiredCheckInDate?:  string
  desiredCheckOutDate?: string
  guestCount?:          number
  source?:        string
  notes?:         string
}

// ── Status Transition ──
interface UpdateCrmLeadStatusRequest {
  leadStatus: CrmLeadStatus
}

// ── Convert to Booking ──
interface ConvertLeadToBookingRequest {
  clientId:      string
  unitId:        string
  checkInDate:   string
  checkOutDate:  string
  guestCount:    number
  internalNotes?: string
}

// ── CRM Note ──
interface CrmNoteResponse {
  id:              string
  bookingId:       string | null
  crmLeadId:       string
  createdByAdminUserId: string
  noteText:        string
  createdAt:       string
  updatedAt:       string
}

interface AddLeadNoteRequest {
  noteText: string
}

interface UpdateCrmNoteRequest {
  noteText: string
}

// ── CRM Assignment ──
interface CrmAssignmentResponse {
  id:                  string
  bookingId:           string | null
  crmLeadId:           string
  assignedAdminUserId: string
  isActive:            boolean
  assignedAt:          string
  updatedAt:           string
}

interface AssignLeadRequest {
  assignedAdminUserId: string
}

// ── Paginated Leads ──
interface PaginatedLeads {
  items:      CrmLeadListItemResponse[]
  pagination: PaginationMeta   // { page, pageSize, totalCount, totalPages }
}
```

```typescript
// lib/api/services/crm.service.ts
import api from '@/lib/api/axios'
import { endpoints } from '@/lib/api/endpoints'
import type { ... } from '@/lib/types/crm.types'
import type { PaginationMeta } from '@/lib/api/types'

export const crmService = {
  // ── Leads ──
  getLeads:         (filters?: CrmLeadFilters): Promise<PaginatedLeads> =>
    api.get(endpoints.crmLeads.list, { params: filters }),

  getLeadById:      (id: string): Promise<CrmLeadDetailsResponse> =>
    api.get(endpoints.crmLeads.byId(id)),

  createLead:       (data: CreateCrmLeadRequest): Promise<CrmLeadDetailsResponse> =>
    api.post(endpoints.crmLeads.create, data),

  updateLead:       (id: string, data: UpdateCrmLeadRequest): Promise<CrmLeadDetailsResponse> =>
    api.put(endpoints.crmLeads.update(id), data),

  updateLeadStatus: (id: string, data: UpdateCrmLeadStatusRequest): Promise<CrmLeadDetailsResponse> =>
    api.patch(endpoints.crmLeads.status(id), data),

  convertToBooking: (id: string, data: ConvertLeadToBookingRequest): Promise<BookingDetailsResponse> =>
    api.post(endpoints.crmLeads.convertToBooking(id), data),

  // ── Notes ──
  getLeadNotes:   (leadId: string): Promise<CrmNoteResponse[]> =>
    api.get(endpoints.crmNotes.leadNotesList(leadId)),

  addLeadNote:    (leadId: string, data: AddLeadNoteRequest): Promise<CrmNoteResponse> =>
    api.post(endpoints.crmNotes.leadNotesCreate(leadId), data),

  updateNote:     (noteId: string, data: UpdateCrmNoteRequest): Promise<CrmNoteResponse> =>
    api.put(endpoints.crmNotes.update(noteId), data),

  deleteNote:     (noteId: string): Promise<void> =>
    api.delete(endpoints.crmNotes.delete(noteId)),

  // ── Assignment ──
  getLeadAssignment:    (leadId: string): Promise<CrmAssignmentResponse> =>
    api.get(endpoints.crmAssignments.leadGet(leadId)),

  assignLead:           (leadId: string, data: AssignLeadRequest): Promise<CrmAssignmentResponse> =>
    api.post(endpoints.crmAssignments.leadSet(leadId), data),

  unassignLead:         (leadId: string): Promise<void> =>
    api.delete(endpoints.crmAssignments.leadDelete(leadId)),
}
```

---

### Section 7 — API Integration

All 14 CRM endpoints covered. No direct API calls in this ticket — only type + service definitions.

---

### Section 12 — Acceptance Criteria

- [ ] `CrmLeadStatus` has all 10 values in PascalCase
- [ ] `CrmLeadListItemResponse` has `id` + `leadStatus` (not legacy `leadId`/`status`)
- [ ] `PaginatedLeads.pagination` uses `totalCount` + `totalPages`
- [ ] All service functions typed with correct request/response types
- [ ] `convertToBooking` returns full `BookingDetailsResponse` and uses `response.id` as booking ID
- [ ] No `any` types
- [ ] Zero TypeScript errors
- [ ] No mock data

---

### Section 13 — Notes for AI / Common Mistakes

**DO NOT:**
- ⛔ NO MOCK DATA.
- Do NOT use legacy `leadId` field in lead payloads — API field name is `id`
- Do NOT use `status` — the API field name is `leadStatus`
- Do NOT confuse CRM leads with formal bookings — separate entities, separate service files

---

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TICKET ID: FE-3-CRM-02
TITLE: Build CRM Pipeline kanban board
WAVE: Wave 3 — CRM + Bookings
DOMAIN: CRM
PRIORITY: Critical
DEPENDS ON: FE-3-CRM-01, FE-2-ADMIN-01, FE-1-UI-05, FE-1-UI-10
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section 1 — Walkthrough

**What is this ticket about?**
The CRM pipeline at `/admin/crm` is the Sales team's daily workspace. It's a kanban board with columns for each pipeline stage. Every lead card shows the client name, requested unit, days in current status, and source badge. Clicking a card opens the lead detail. Sales sees who's prospecting, who's relevant, who's been booked, all at a glance.

**Why NOW?**
This is the Sales team's primary workflow. Everything in the CRM domain builds on top of this board.

**What does success look like?**
Sales opens `/admin/crm` and sees leads grouped by status in columns. Cards show client name, unit, days in status. Clicking a card navigates to the lead detail page.

---

### Section 2 — Objective

Build the CRM pipeline kanban board at `/admin/crm` that fetches all leads via `GET /api/internal/crm/leads`, groups them by `leadStatus` on the frontend, and renders them in ordered columns — so Sales has a visual pipeline overview.

---

### Section 3 — User-Facing Outcome

The Sales user can:
- See all leads grouped by pipeline stage
- See each lead's contact name, unit (if assigned), days in current status, source
- Click any lead card to navigate to lead detail
- See how many leads are in each column
- See "closed" leads (NotRelevant, Cancelled, LeftEarly) in a collapsed section below

---

### Section 4 — In Scope

- [ ] `app/(admin)/crm/page.tsx`
- [ ] `components/admin/crm/PipelineBoard.tsx` — loaded via `dynamic()` (heavy component)
- [ ] `components/admin/crm/PipelineColumn.tsx` — single column (header + count + cards)
- [ ] `components/admin/crm/PipelineColumnSkeleton.tsx` — loading state
- [ ] Fetch ALL leads via `GET /api/internal/crm/leads` (no server-side grouping — group on frontend)
- [ ] Group leads by `leadStatus` using `useMemo` inside the hook
- [ ] Column order per `CRM_PIPELINE_COLUMNS` constant from Wave 0
- [ ] Separate "Closed" section (NotRelevant, Cancelled, LeftEarly) — collapsed by default, toggle to expand
- [ ] Each column: label, count badge, scrollable card list
- [ ] Empty column: muted "No leads in this stage" text
- [ ] Board-level empty state: `<EmptyState>` with icon=`Users`
- [ ] Board-level error: EmptyState with retry button
- [ ] `usePermissions().canViewCRM` guards this page
- [ ] "New Lead" button for Sales/SuperAdmin: `canManageCRM`

**Files to create:**
- `app/(admin)/crm/page.tsx`
- `components/admin/crm/PipelineBoard.tsx`
- `components/admin/crm/PipelineColumn.tsx`
- `components/admin/crm/PipelineColumnSkeleton.tsx`

---

### Section 6 — Technical Contract

#### 6a. Component Props Interface

```typescript
interface PipelineBoardProps {
  // No props — fetches own data
}

interface PipelineColumnProps {
  status:    CrmLeadStatus
  label:     string
  leads:     CrmLeadListItemResponse[]
  isLoading: boolean
}
```

#### 6b. Hook Return Type

```typescript
// lib/hooks/useCrm.ts — add:
export function useLeadsPipeline() {
  const query = useQuery({
    queryKey:  queryKeys.crm.leads(),
    queryFn:   () => crmService.getLeads({ pageSize: 200 }),  // fetch all for pipeline view
    staleTime: 1000 * 60 * 1,      // 1 minute — pipeline needs to be relatively fresh
    refetchOnWindowFocus: true,    // sales switches between windows
  })

  const groupedLeads = useMemo(() => {
    const all = query.data?.items ?? []
    return all.reduce((acc, lead) => {
      const status = lead.leadStatus
      if (!acc[status]) acc[status] = []
      acc[status].push(lead)
      return acc
    }, {} as Record<CrmLeadStatus, CrmLeadListItemResponse[]>)
  }, [query.data])

  return {
    groupedLeads,
    totalCount: query.data?.pagination.totalCount ?? 0,
    isLoading:  query.isLoading,
    isError:    query.isError,
    refetch:    query.refetch,
  }
}
```

#### 6d. Key Enums / Constants Used

```typescript
// From lib/constants/booking-statuses.ts:
CRM_PIPELINE_COLUMNS    // ['Prospecting','Relevant','NoAnswer','Booked','Confirmed','CheckIn','Completed']
CRM_CLOSED_STATUSES     // ['NotRelevant','Cancelled','LeftEarly']
BOOKING_STATUS_LABELS   // { Prospecting: 'Prospecting', ... }

// From lib/constants/routes.ts:
ROUTES.admin.crm.index
```

---

### Section 7 — API Integration

| Method | Endpoint | Query | Response | When |
|---|---|---|---|---|
| GET | `/api/internal/crm/leads` | `{ pageSize: 200 }` | `PaginatedLeads` | on board mount |

**Note:** `pageSize: 200` fetches enough leads for the pipeline view. If the platform grows beyond 200 active leads, this needs revisiting. For MVP this is acceptable.

#### 7b. TanStack Query Keys

```typescript
queryKeys.crm.leads()

// staleTime: 1 minute
// refetchOnWindowFocus: true  ← OVERRIDE global default (global is false)
```

#### 7e. Error Handling

Board-level error: `<EmptyState icon={AlertCircle} title="Could not load pipeline" action={{ label: 'Retry', onClick: refetch }}>` 

---

### Section 8 — State & Data Management Rules

| State | Where | Why |
|---|---|---|
| All leads data | TanStack Query | server state |
| Grouped leads by status | `useMemo` in hook | computed from server state |
| "Closed section" expanded | `useState` in PipelineBoard | local UI — no persist needed |

---

### Section 9 — Component & File Deliverables

```
app/(admin)/crm/page.tsx                          ← page, guards via usePermissions
components/admin/crm/PipelineBoard.tsx            ← loaded via dynamic(), renders columns
components/admin/crm/PipelineColumn.tsx           ← single column
components/admin/crm/PipelineColumnSkeleton.tsx   ← loading state (3 ghost cards)
```

`app/(admin)/crm/page.tsx` key logic:
```tsx
'use client'
import dynamic from 'next/dynamic'
import { usePermissions } from '@/lib/hooks/usePermissions'
import { redirect } from 'next/navigation'
import { ROUTES } from '@/lib/constants/routes'

const PipelineBoard = dynamic(
  () => import('@/components/admin/crm/PipelineBoard'),
  { loading: () => <PipelineBoardSkeleton /> }
)

export default function CrmPage() {
  const { canViewCRM } = usePermissions()
  if (!canViewCRM) redirect(ROUTES.admin.dashboard)

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-h2 font-display text-neutral-800">CRM Pipeline</h1>
        {canManageCRM && <Button onClick={openCreateLeadModal}>New Lead</Button>}
      </div>
      <PipelineBoard />
    </div>
  )
}
```

---

### Section 10 — UX & Loading State Rules

| State | Required? | Behavior |
|---|---|---|
| Loading | ✓ REQUIRED | 4 `<PipelineColumnSkeleton>` side by side |
| Empty board (0 leads) | ✓ REQUIRED | `<EmptyState icon={Users} title="No leads yet" description="Leads appear here when clients submit booking requests">` |
| Empty column (0 leads in stage) | ✓ REQUIRED | Muted italic text inside column: "No leads in this stage" |
| Error | ✓ REQUIRED | Board-level EmptyState with retry button |
| Closed section | ✓ REQUIRED | Accordion — collapsed by default, "Show Closed (N)" toggle |

---

### Section 11 — Verification Steps

1. Log in as Sales → navigate to `/admin/crm`
2. Expected: skeleton columns briefly → real data with cards grouped by stage
3. Verify column counts match actual card counts
4. Cards show: contact name, unit name (if assigned), source badge
5. Click any card → navigates to `/admin/crm/leads/{id}`
6. "Closed" section collapsed by default → click to expand
7. Log in as Finance → navigate to `/admin/crm` → expected: redirect to dashboard

---

### Section 12 — Acceptance Criteria

- [ ] Pipeline board renders `CRM_PIPELINE_COLUMNS` in correct order
- [ ] Leads grouped by `leadStatus` field (not `status`)
- [ ] `useMemo` used for grouping (not in component render)
- [ ] `staleTime: 1 minute`, `refetchOnWindowFocus: true` for this query
- [ ] PipelineBoard loaded via `dynamic()` with loading fallback
- [ ] Closed statuses in collapsed section
- [ ] `canViewCRM` gates the page
- [ ] Empty state: board-level + per-column
- [ ] No mock data (no hardcoded lead objects)

---

### Section 13 — Notes for AI / Common Mistakes

**DO NOT:**
- ⛔ NO MOCK DATA. No `const sampleLeads = [{ id: '1', contactName: 'Ahmed' }]`.
- Do NOT use `lead.status` — the API field is `lead.leadStatus`
- Do NOT use `lead.leadId` — the API field is `lead.id`
- Do NOT implement drag-and-drop — status change is via buttons in the lead detail, not drag
- Do NOT add server-side grouping — fetch all and group with `useMemo` on the client
- Do NOT skip `useMemo` — re-grouping on every render with 200 leads is expensive

**WATCH OUT FOR:**
- `refetchOnWindowFocus: true` is an override — the global config has it as `false`. Must be set explicitly on this query.
- Leads without an assigned unit will have `targetUnitId: null` — card must handle this gracefully
- Days in current status: calculate from `lead.updatedAt` to now using `differenceInDays()` from date-fns

---

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TICKET ID: FE-3-CRM-03
TITLE: Build Lead Card component
WAVE: Wave 3 — CRM + Bookings
DOMAIN: CRM
PRIORITY: Critical
DEPENDS ON: FE-3-CRM-01, FE-1-UI-07
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section 1 — Walkthrough

**What is this ticket about?**
The Lead Card is the visual unit of the CRM pipeline — every card in every column is one of these. It must show: contact name, phone (masked), unit name (if assigned), date range (if set), days in current status, source badge, and assigned-to name. Clicking the card navigates to the lead detail page.

---

### Section 2 — Objective

Build the `<LeadCard>` component used by `PipelineColumn` to render each lead in the kanban board, with all required fields from `CrmLeadListItemResponse` displayed cleanly.

---

### Section 4 — In Scope

- [ ] `components/admin/crm/LeadCard.tsx`
- [ ] Displays:
  - Contact name (bold)
  - Phone (masked: first 4 digits visible, rest as *** — e.g., "0102***4567")
  - Unit reference (if `targetUnitId` is not null)
  - Check-in → Check-out dates (if set) using `formatDateRange()`
  - Days in current status: `differenceInDays(new Date(), parseISO(lead.updatedAt))` + "d"
  - Source badge: `<Badge variant="info">{BOOKING_SOURCE_LABELS[lead.source]}</Badge>`
  - Assignment indicator (if `assignedAdminUserId` is present)
- [ ] Click entire card → `router.push(ROUTES.admin.crm.leadDetail(lead.id))`
- [ ] Hover state: subtle shadow elevation
- [ ] `lead.leadStatus === 'NoAnswer'` → show amber warning indicator (days since contact is critical)

**Files to create:**
- `components/admin/crm/LeadCard.tsx`

---

### Section 6 — Technical Contract

```typescript
interface LeadCardProps {
  lead:      CrmLeadListItemResponse
  className?: string
}
```

---

### Section 7 — API Integration

N/A — pure display component, data passed as props.

---

### Section 9 — Component & File Deliverables

```typescript
// components/admin/crm/LeadCard.tsx
'use client'
import { useRouter } from 'next/navigation'
import { differenceInDays, parseISO } from 'date-fns'
import { ROUTES } from '@/lib/constants/routes'
import { BOOKING_SOURCE_LABELS } from '@/lib/constants/booking-sources'
import { formatDateRange } from '@/lib/utils/format'
import { cn } from '@/lib/utils/cn'
import type { CrmLeadListItemResponse } from '@/lib/types/crm.types'

export function LeadCard({ lead, className }: LeadCardProps) {
  const router = useRouter()
  const daysInStatus = differenceInDays(new Date(), parseISO(lead.updatedAt))
  const isNoAnswer   = lead.leadStatus === 'NoAnswer'

  // Phone masking: "01023456789" → "0102***6789"
  const maskedPhone = lead.contactPhone.length > 7
    ? `${lead.contactPhone.slice(0, 4)}***${lead.contactPhone.slice(-4)}`
    : lead.contactPhone

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => router.push(ROUTES.admin.crm.leadDetail(lead.id))}
      onKeyDown={(e) => e.key === 'Enter' && router.push(ROUTES.admin.crm.leadDetail(lead.id))}
      className={cn(
        'bg-white rounded-lg p-3.5 shadow-sm hover:shadow-card-hover cursor-pointer',
        'border border-neutral-100 transition-shadow duration-150',
        isNoAnswer && 'border-l-2 border-l-warning',
        className
      )}
    >
      {/* Header: name + days counter */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="font-medium text-neutral-800 text-sm leading-tight">{lead.contactName}</p>
        <span className={cn(
          'text-xs font-mono shrink-0',
          isNoAnswer ? 'text-warning font-semibold' : 'text-neutral-400'
        )}>
          {daysInStatus}d
        </span>
      </div>

      {/* Phone */}
      <p className="text-xs text-neutral-500 mb-1.5">{maskedPhone}</p>

      {/* Unit reference */}
      {lead.targetUnitId && (
        <p className="text-xs text-neutral-600 mb-1.5 truncate">
          🏠 Unit ID: {lead.targetUnitId}
        </p>
      )}

      {/* Dates */}
      {lead.desiredCheckInDate && lead.desiredCheckOutDate && (
        <p className="text-xs text-neutral-500 mb-2">
          {formatDateRange(lead.desiredCheckInDate, lead.desiredCheckOutDate)}
        </p>
      )}

      {/* Footer: source + assigned */}
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-neutral-50">
        <Badge variant="info" size="sm">
          {BOOKING_SOURCE_LABELS[lead.source as keyof typeof BOOKING_SOURCE_LABELS] ?? lead.source}
        </Badge>
        {lead.assignedAdminUserId && (
          <span className="text-xs text-neutral-400 truncate max-w-28">Assigned</span>
        )}
      </div>
    </div>
  )
}
```

---

### Section 12 — Acceptance Criteria

- [ ] `lead.id` used for navigation
- [ ] Phone masked: first 4 + *** + last 4
- [ ] `lead.targetUnitId` null case: no unit line shown
- [ ] `lead.desiredCheckInDate` null case: no date line shown
- [ ] `lead.source` displayed using `BOOKING_SOURCE_LABELS` (PascalCase key lookup)
- [ ] Days counter shows days since `lead.updatedAt`
- [ ] `NoAnswer` status → amber left border indicator
- [ ] Keyboard accessible (tabIndex, onKeyDown)
- [ ] No mock data

---

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TICKET ID: FE-3-CRM-04
TITLE: Build Lead Detail page
WAVE: Wave 3 — CRM + Bookings
DOMAIN: CRM
PRIORITY: Critical
DEPENDS ON: FE-3-CRM-01, FE-3-CRM-02, FE-2-ADMIN-01
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section 1 — Walkthrough

**What is this ticket about?**
Clicking a lead card opens `/admin/crm/leads/{id}` — the full lead detail page. It shows all lead information, current status with transition buttons, notes, assignment, and (if converted) a link to the booking. This page is the hub for all CRM actions on a single lead.

**Why NOW?**
The pipeline board is useless without the ability to open a lead and take action. This page is where the sales work actually happens.

**What does success look like?**
Sales opens a lead, sees all client info, sees which unit they're interested in, sees the current status, and can perform allowed transitions, add notes, and reassign.

---

### Section 2 — Objective

Build the Lead Detail page at `/admin/crm/leads/{id}` that displays the full lead information and serves as the hub for all CRM actions (status transitions, notes, assignment, conversion).

---

### Section 4 — In Scope

- [ ] `app/(admin)/crm/leads/[id]/page.tsx`
- [ ] `GET /api/internal/crm/leads/{id}` — fetch lead details
- [ ] Page sections:
  - **Header:** Contact name, phone, email (if set), source badge, current status badge, days in status
  - **Unit Info:** Unit name, project, check-in/check-out, number of guests (if set)
  - **Status & Actions:** Current status + transition buttons (built in FE-3-CRM-05)
  - **Notes:** Notes list + add note (built in FE-3-CRM-06)
  - **Assignment:** Assigned to + reassign (built in FE-3-CRM-07)
  - **Converted Booking:** If `convertedBookingId` is set → link to `/admin/bookings/{id}`
- [ ] THIS TICKET builds the page shell, header, and unit info section only
- [ ] Status, Notes, Assignment sections: render placeholder `<div>` — filled by FE-3-CRM-05, 06, 07
- [ ] Skeleton loading for header
- [ ] 404 handling

**Files to create:**
- `app/(admin)/crm/leads/[leadId]/page.tsx`
- `components/admin/crm/LeadDetailHeader.tsx`
- `components/admin/crm/LeadUnitInfo.tsx`

---

### Section 7 — API Integration

| Method | Endpoint | Response | When |
|---|---|---|---|
| GET | `/api/internal/crm/leads/{id}` | `CrmLeadDetailsResponse` | on page mount |

```typescript
// Hook:
export function useLeadDetail(leadId: string) {
  return useQuery({
    queryKey: queryKeys.crm.leadDetail(leadId),
    queryFn:  () => crmService.getLeadById(leadId),
    staleTime: 1000 * 60 * 2,
  })
}
```

---

### Section 12 — Acceptance Criteria

- [ ] `GET /api/internal/crm/leads/{id}` fetches by `id` path param
- [ ] `lead.id` used everywhere
- [ ] `lead.leadStatus` (not `lead.status`) used for status display
- [ ] `convertedBookingId` non-null → "View Booking" link shown
- [ ] 404 handled with EmptyState + "Back to Pipeline"
- [ ] No mock data

---

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TICKET ID: FE-3-CRM-05
TITLE: Build Lead status transitions UI
WAVE: Wave 3 — CRM + Bookings
DOMAIN: CRM
PRIORITY: Critical
DEPENDS ON: FE-3-CRM-04, FE-1-UI-04
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section 1 — Walkthrough

**What is this ticket about?**
The status machine is the core of the CRM. From each status, only certain transitions are valid (defined in `VALID_TRANSITIONS` from Wave 0). This ticket builds the status transition UI on the lead detail page: shows the current status, lists allowed transitions as buttons, shows a confirmation step with optional notes, and calls `PATCH /api/internal/crm/leads/{id}/status`.

**Critical business rule:** Transitioning to `Booked` creates a soft hold on the unit dates. Transitioning to `NotRelevant` or `Cancelled` releases it. These side effects are handled by the backend — the frontend just calls the status endpoint.

---

### Section 2 — Objective

Build the `<LeadStatusTransition>` component on the lead detail page that shows allowed next statuses based on `VALID_TRANSITIONS`, prompts for optional notes, calls `PATCH /api/internal/crm/leads/{id}/status`, and invalidates the lead cache.

---

### Section 4 — In Scope

- [ ] `components/admin/crm/LeadStatusTransition.tsx`
- [ ] Renders: current status badge + available next status buttons
- [ ] Button labels: use `BOOKING_STATUS_LABELS` (PascalCase lookup)
- [ ] Button variants: `success` for positive moves (Relevant, Booked, Confirmed, CheckIn, Completed), `danger` for exits (NotRelevant, Cancelled), `warning` for NoAnswer
- [ ] On click: open a small confirmation dialog with:
  - "Move to [Status]?" heading
  - Optional notes textarea
  - Confirm + Cancel buttons
- [ ] On confirm: call `PATCH /api/internal/crm/leads/{id}/status` with `{ leadStatus }`
- [ ] On success: `toastSuccess`, invalidate lead detail + leads list
- [ ] `VALID_TRANSITIONS` from constants: only show buttons for allowed next states

**Files to create:**
- `components/admin/crm/LeadStatusTransition.tsx`
- `components/admin/crm/StatusTransitionDialog.tsx`

---

### Section 6 — Technical Contract

```typescript
interface LeadStatusTransitionProps {
  leadId:        string
  currentStatus: CrmLeadStatus
}

interface StatusTransitionDialogProps {
  isOpen:       boolean
  onClose:      () => void
  onConfirm:    (notes?: string) => void
  targetStatus: CrmLeadStatus
  isLoading:    boolean
}
```

---

### Section 7 — API Integration

| Method | Endpoint | Request | Response | When |
|---|---|---|---|---|
| PATCH | `/api/internal/crm/leads/{id}/status` | `UpdateCrmLeadStatusRequest` | `CrmLeadDetailsResponse` | on transition confirm |

```typescript
// Request body:
interface UpdateCrmLeadStatusRequest {
  leadStatus: CrmLeadStatus   // PascalCase: 'Relevant', 'Booked', etc.
}
```

#### 7d. Mutation Side Effects

```typescript
toastSuccess(`Lead moved to ${BOOKING_STATUS_LABELS[leadStatus]}`)
queryClient.invalidateQueries({ queryKey: queryKeys.crm.leadDetail(leadId) })
queryClient.invalidateQueries({ queryKey: queryKeys.crm.leads() })
closeDialog()
```

---

### Section 12 — Acceptance Criteria

- [ ] Only transitions from `VALID_TRANSITIONS[currentStatus]` shown as buttons
- [ ] `leadStatus` sent in PascalCase to API
- [ ] Optional notes textarea in confirmation dialog
- [ ] Query cache invalidated after transition
- [ ] `canManageCRM` gates transition buttons (view-only roles see status but no buttons)
- [ ] No mock data

---

### Section 13 — Notes for AI / Common Mistakes

**DO NOT:**
- ⛔ NO MOCK DATA.
- Do NOT hardcode allowed transitions — always derive from `VALID_TRANSITIONS[currentStatus]`
- Do NOT send `leadStatus: 'booked'` — must be `'Booked'` (PascalCase)
- Do NOT skip the confirmation dialog — accidental status changes are costly

---

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TICKET ID: FE-3-CRM-06
TITLE: Build Lead Notes management
WAVE: Wave 3 — CRM + Bookings
DOMAIN: CRM
PRIORITY: High
DEPENDS ON: FE-3-CRM-04
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section 1 — Walkthrough

**What is this ticket about?**
Sales agents add notes to leads to track conversations: "Client called back, interested in villa", "Waiting for payment confirmation", etc. This ticket builds the notes section on the lead detail page: display notes chronologically, add new notes, edit/delete existing notes.

---

### Section 4 — In Scope

- [ ] `components/admin/crm/LeadNotes.tsx`
- [ ] `GET /api/internal/crm/leads/{leadId}/notes` — list notes
- [ ] `POST /api/internal/crm/leads/{leadId}/notes` — add note
- [ ] `PUT /api/internal/crm/notes/{noteId}` — edit note (inline edit)
- [ ] `DELETE /api/internal/crm/notes/{noteId}` — delete note with ConfirmDialog
- [ ] Notes displayed as a feed: avatar/initials + name + content + `formatRelativeTime(createdAt)`
- [ ] "Edit" button only on own notes (compare `createdByAdminUserId` with `user.userId`)
- [ ] "Delete" button only for SuperAdmin or own notes
- [ ] New note: textarea at bottom with "Add Note" button

**Files to create:**
- `components/admin/crm/LeadNotes.tsx`
- `components/admin/crm/NoteItem.tsx`

---

### Section 7 — API Integration

| Method | Endpoint | Request | Response | When |
|---|---|---|---|---|
| GET | `/api/internal/crm/leads/{leadId}/notes` | — | `CrmNoteResponse[]` | on section mount |
| POST | `/api/internal/crm/leads/{leadId}/notes` | `AddLeadNoteRequest` | `CrmNoteResponse` | on add |
| PUT | `/api/internal/crm/notes/{noteId}` | `UpdateCrmNoteRequest` | `CrmNoteResponse` | on edit |
| DELETE | `/api/internal/crm/notes/{noteId}` | — | void | on delete confirm |

```typescript
// AddLeadNoteRequest:
interface AddLeadNoteRequest { noteText: string }

// UpdateCrmNoteRequest:
interface UpdateCrmNoteRequest { noteText: string }
```

#### 7b. TanStack Query Keys

```typescript
queryKeys.crm.leadNotes(leadId)

// Invalidate after add/edit/delete:
queryKeys.crm.leadNotes(leadId)
```

---

### Section 12 — Acceptance Criteria

- [ ] Notes sorted chronologically (oldest first, newest at bottom)
- [ ] `formatRelativeTime()` used for note timestamp display
- [ ] Add note textarea clears on success
- [ ] Edit is inline (no modal)
- [ ] Delete requires ConfirmDialog
- [ ] `CrmNoteResponse.id` used for update/delete (not `leadId`)
- [ ] No mock data

---

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TICKET ID: FE-3-CRM-07
TITLE: Build Lead Assignment
WAVE: Wave 3 — CRM + Bookings
DOMAIN: CRM
PRIORITY: High
DEPENDS ON: FE-3-CRM-04
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section 1 — Walkthrough

**What is this ticket about?**
Leads should be assigned to a specific Sales team member. This ticket builds the assignment section on the lead detail page: show current assignee, allow reassignment (SuperAdmin only), and allow unassignment.

---

### Section 4 — In Scope

- [ ] `components/admin/crm/LeadAssignment.tsx`
- [ ] `GET /api/internal/crm/leads/{leadId}/assignment` — current assignment
- [ ] `POST /api/internal/crm/leads/{leadId}/assignment` — assign
- [ ] `DELETE /api/internal/crm/leads/{leadId}/assignment` — unassign
- [ ] Admin users list: `GET /api/admin-users` (filter to Sales role visually)
- [ ] Combobox to select assignee (searchable by name)
- [ ] "Unassign" button with ConfirmDialog
- [ ] Only SuperAdmin can reassign (guarded by `canManageAdminUsers` or a new `canAssignLeads` derived from SuperAdmin)

**Files to create:**
- `components/admin/crm/LeadAssignment.tsx`

---

### Section 7 — API Integration

| Method | Endpoint | Request | Response | When |
|---|---|---|---|---|
| GET | `/api/internal/crm/leads/{leadId}/assignment` | — | `CrmAssignmentResponse` | on mount |
| POST | `/api/internal/crm/leads/{leadId}/assignment` | `{ assignedAdminUserId }` | `CrmAssignmentResponse` | on assign |
| DELETE | `/api/internal/crm/leads/{leadId}/assignment` | — | void | on unassign |
| GET | `/api/admin-users` | — | `AdminUserResponse[]` | for dropdown |

```typescript
// AdminUserResponse (partial — for dropdown):
interface AdminUserResponse {
  id:       string
  name:     string
  email:    string
  role:     AdminRole
  isActive: boolean
}
```

---

### Section 12 — Acceptance Criteria

- [ ] Current assignee shown with name
- [ ] Reassign Combobox shows admin users
- [ ] Assign/Unassign actions guarded by SuperAdmin permission
- [ ] Query invalidated: assignment + lead detail
- [ ] No mock data

---

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TICKET ID: FE-3-CRM-08
TITLE: Build Create Lead form (admin-initiated)
WAVE: Wave 3 — CRM + Bookings
DOMAIN: CRM
PRIORITY: High
DEPENDS ON: FE-3-CRM-01, FE-2-ADMIN-01
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section 1 — Walkthrough

**What is this ticket about?**
While most leads come from the public website form, Sales can also create leads manually (for phone calls, walk-ins, WhatsApp inquiries). This ticket builds the "New Lead" modal form accessible from the CRM pipeline page.

---

### Section 4 — In Scope

- [ ] `components/admin/crm/CreateLeadModal.tsx` — Modal with form
- [ ] Fields:
  - `contactName` — Input, required
  - `contactPhone` — Input (tel), required
  - `contactEmail` — Input (email), optional
  - `targetUnitId` — Combobox (searchable units list), optional
  - `desiredCheckInDate` / `desiredCheckOutDate` — DateRangePicker, optional
  - `guestCount` — Number input, optional
  - `source` — Select: Website/App/WhatsApp/PhoneCall/Referral, required
  - `notes` — Textarea, optional
- [ ] Calls `POST /api/internal/crm/leads` (internal, not public endpoint)

**Note:** The PUBLIC endpoint (`POST /api/crm/leads`) is for the website form (Wave 7). THIS ticket uses the internal endpoint.

**Files to create:**
- `components/admin/crm/CreateLeadModal.tsx`
- `components/admin/crm/CreateLeadForm.tsx`

---

### Section 6 — Technical Contract

```typescript
const createLeadSchema = z.object({
  contactName:    z.string().min(1, 'Contact name is required'),
  contactPhone:   z.string().min(1, 'Phone is required'),
  contactEmail:   z.string().email().optional().or(z.literal('')),
  targetUnitId:   z.string().optional(),
  desiredCheckInDate:  z.string().optional(),
  desiredCheckOutDate: z.string().optional(),
  guestCount:     z.number().min(1).optional(),
  source:         z.enum(['Website','App','WhatsApp','PhoneCall','Referral']),
  notes:          z.string().optional(),
})
```

#### 7a. Endpoints Used

| Method | Endpoint | Notes |
|---|---|---|
| POST | `/api/internal/crm/leads` | Admin-initiated lead creation |
| GET | `/api/internal/units` | For unit search Combobox |

**IMPORTANT:** Use the explicit internal endpoint `POST /api/internal/crm/leads` for admin-created leads.

---

### Section 12 — Acceptance Criteria

- [ ] `source` values sent as PascalCase: 'PhoneCall' not 'phone'
- [ ] `contactEmail` sent as `undefined` (not empty string) when not filled
- [ ] Lead appears in pipeline after creation
- [ ] Query invalidated: `queryKeys.crm.leads()`
- [ ] `canManageCRM` gates the "New Lead" button
- [ ] No mock data

---

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TICKET ID: FE-3-CRM-09
TITLE: Build Convert Lead to Booking
WAVE: Wave 3 — CRM + Bookings
DOMAIN: CRM
PRIORITY: Critical
DEPENDS ON: FE-3-CRM-04, FE-3-CRM-05
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section 1 — Walkthrough

**What is this ticket about?**
When a lead reaches `Booked` status, it can be converted into a formal booking. This is the critical business transition — from CRM pipeline to the booking management system. The conversion creates a new booking entity and links it to the lead. The Sales agent enters the deposit amount and clicks convert.

**Why is this critical?**
This is the bridge between CRM and Bookings. Without it, the business has no way to turn a qualified lead into a billable booking.

---

### Section 2 — Objective

Build the Convert Lead to Booking action on the lead detail page (visible only when `leadStatus === 'Booked'`) that calls `POST /api/internal/crm/leads/{id}/convert-to-booking` with client/unit/dates/guestCount payload, and redirects to the new booking detail page.

---

### Section 4 — In Scope

- [ ] `components/admin/crm/ConvertToBookingPanel.tsx` — shown only when `leadStatus === 'Booked'`
- [ ] Panel shows: unit details, date range, total night count + estimated total (from `formatCurrency`)
- [ ] Form fields: `clientId`, `unitId`, `checkInDate`, `checkOutDate`, `guestCount` — required
- [ ] `internalNotes` — Textarea, optional
- [ ] Submit: `POST /api/internal/crm/leads/{id}/convert-to-booking`
- [ ] On success: `toastSuccess('Lead converted to booking')` → `router.push(ROUTES.admin.bookings.detail(response.bookingId))`
- [ ] Guard: `canManageCRM`

**Files to create:**
- `components/admin/crm/ConvertToBookingPanel.tsx`

---

### Section 6 — Technical Contract

```typescript
interface ConvertToBookingRequest {
  clientId:      string
  unitId:        string
  checkInDate:   string
  checkOutDate:  string
  guestCount:    number
  internalNotes?: string
}

// API Response: full Booking object
// Use response.id as the new formal booking ID for redirect
```

```typescript
const convertSchema = z.object({
  clientId:      z.string().min(1, 'Client is required'),
  unitId:        z.string().min(1, 'Unit is required'),
  checkInDate:   z.string().min(1, 'Check-in date is required'),
  checkOutDate:  z.string().min(1, 'Check-out date is required'),
  guestCount:    z.number({ invalid_type_error: 'Guest count is required' }).min(1),
  internalNotes: z.string().optional(),
})
```

---

### Section 7 — API Integration

| Method | Endpoint | Request | Response | When |
|---|---|---|---|---|
| POST | `/api/internal/crm/leads/{id}/convert-to-booking` | `ConvertLeadToBookingRequest` | `BookingDetailsResponse` | on form submit |

#### 7d. Mutation Side Effects

```typescript
toastSuccess('Lead successfully converted to booking')
queryClient.invalidateQueries({ queryKey: queryKeys.crm.leadDetail(leadId) })
queryClient.invalidateQueries({ queryKey: queryKeys.crm.leads() })
router.push(ROUTES.admin.bookings.detail(response.id))
```

---

### Section 12 — Acceptance Criteria

- [ ] Panel visible ONLY when `leadStatus === 'Booked'`
- [ ] Required fields `clientId`, `unitId`, `checkInDate`, `checkOutDate`, `guestCount` are submitted
- [ ] API response `id` used for redirect
- [ ] Redirect goes to `/admin/bookings/{id}` after conversion
- [ ] Lead + leads list cache invalidated
- [ ] No mock data

---

### Section 13 — Notes for AI / Common Mistakes

**DO NOT:**
- ⛔ NO MOCK DATA.
- Do NOT auto-calculate the deposit — Sales enters this manually (frozen business decision)
- Do NOT redirect to the CRM pipeline — redirect to the NEW BOOKING detail page
- Do NOT show this panel for any status other than `'Booked'`

---
