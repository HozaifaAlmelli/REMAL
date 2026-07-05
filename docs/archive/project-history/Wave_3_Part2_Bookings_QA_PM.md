# Wave 3 — Bookings Domain + QA + PM
## Tickets FE-3-BOOK-01 through FE-3-BOOK-09

> **Continues from Wave_3_Part1_CRM.md**. Run both tracks in parallel.

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TICKET ID: FE-3-BOOK-01
TITLE: Create Bookings service layer + TypeScript types
WAVE: Wave 3 — CRM + Bookings
DOMAIN: Bookings
PRIORITY: Critical
DEPENDS ON: FE-0-INFRA-03, FE-0-INFRA-04
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section 1 — Walkthrough

**What is this ticket about?**
All 9 bookings tickets depend on typed contracts and a service layer. This ticket creates: full TypeScript types for bookings, payments, invoices, and the finance snapshot — plus all service functions. This is the most comprehensive service file in the project.

**CRITICAL DISTINCTION:**
- CRM Lead: entity with 10 statuses, `id` field, managed by Sales
- Booking: entity with 6 statuses, `id` field, has payments, invoices, finance snapshot

---

### Section 2 — Objective

Create `lib/types/booking.types.ts`, `lib/api/services/bookings.service.ts`, and `lib/hooks/useBookings.ts` covering bookings, payments, invoices, and finance snapshot.

---

### Section 4 — In Scope

- [ ] `lib/types/booking.types.ts` — all booking, payment, invoice, finance snapshot types
- [ ] `lib/api/services/bookings.service.ts` — all booking CRUD + lifecycle + payment + invoice
- [ ] `lib/hooks/useBookings.ts` — hook stubs

**Files to create:**
- `lib/types/booking.types.ts`
- `lib/api/services/bookings.service.ts`
- `lib/hooks/useBookings.ts`

**Files to modify:**
- `lib/types/index.ts`

---

### Section 6 — Technical Contract

```typescript
// lib/types/booking.types.ts
// All from KAZA_BOOKING_API_Reference.md

// ── Booking Statuses (DIFFERENT from CRM Lead statuses) ──
// Booking has only 6 statuses (post-conversion formal status)
type FormalBookingStatus =
  | 'Pending' | 'Confirmed' | 'CheckIn'
  | 'Completed' | 'Cancelled' | 'LeftEarly'

type PaymentStatus = 'Pending' | 'Paid' | 'Failed' | 'Cancelled'
type PaymentMethod = 'InstaPay' | 'VodafoneCash' | 'Cash' | 'BankTransfer'

// ── Invoice status (PascalCase) ──
type InvoiceStatus = 'Draft' | 'Issued' | 'Cancelled'

// ── Booking list item (from GET /api/internal/bookings) ──
interface BookingListItemResponse {
  id:              string
  clientId:        string
  unitId:          string
  ownerId:         string
  assignedAdminUserId: string | null
  bookingStatus:   FormalBookingStatus
  checkInDate:     string
  checkOutDate:    string
  guestCount:      number
  baseAmount:      number
  finalAmount:     number
  source:          string
  createdAt:       string
}

// ── Booking full details (from GET /api/internal/bookings/{id}) ──
interface BookingDetailsResponse {
  id:              string
  clientId:        string
  unitId:          string
  ownerId:         string
  assignedAdminUserId: string | null
  bookingStatus:   FormalBookingStatus
  checkInDate:     string
  checkOutDate:    string
  guestCount:      number
  baseAmount:      number
  finalAmount:     number
  source:          string
  internalNotes:   string | null
  createdAt:       string
  updatedAt:       string
}

// ── Booking Filters ──
interface BookingListFilters {
  bookingStatus?:       FormalBookingStatus
  assignedAdminUserId?: string
  page?:                number
  pageSize?:            number
}

// ── Lifecycle Requests ──
interface ConfirmBookingRequest {
  notes?: string
}

interface CancelBookingRequest {
  notes?: string
}

interface CompleteBookingRequest {
  notes?: string
}

// ── Payment ──
interface PaymentResponse {
  id:              string
  bookingId:       string
  invoiceId:       string | null
  paymentStatus:   PaymentStatus
  paymentMethod:   PaymentMethod
  amount:          number
  referenceNumber: string | null
  notes:           string | null
  paidAt:          string | null
  createdAt:       string
  updatedAt:       string
}

interface CreatePaymentRequest {
  bookingId:     string
  invoiceId?:    string
  paymentMethod: PaymentMethod
  amount:        number
  referenceNumber?: string
  notes?:        string
}

type MarkPaymentPaidRequest = Record<string, never>

interface MarkPaymentFailedRequest {
  notes?: string
}

interface CancelPaymentRequest {
  notes?: string
}

// ── Invoice ──
interface InvoiceResponse {
  id:              string
  bookingId:       string
  invoiceNumber:   string
  subtotalAmount:  number
  totalAmount:     number
  invoiceStatus:   InvoiceStatus
  issuedAt:        string | null
  dueDate:         string | null
  notes:           string | null
  createdAt:       string
  updatedAt:       string
}

interface InvoiceBalanceResponse {
  invoiceId:      string
  totalAmount:    number
  paidAmount:     number
  remainingAmount:number
  isFullyPaid:    boolean
}

interface AddInvoiceManualAdjustmentRequest {
  description:     string
  amount:          number
  adjustmentType:  'addition' | 'deduction'
}

// ── Finance Snapshot ──
interface BookingFinanceSnapshotResponse {
  bookingId:         string
  invoiceId:         string | null
  invoiceStatus:     InvoiceStatus | null
  invoicedAmount:    number
  paidAmount:        number
  remainingAmount:   number
  ownerPayoutStatus: OwnerPayoutStatus | null
}

// ── Booking Notes ──
interface BookingNoteResponse {
  id:            string
  bookingId:     string
  crmLeadId:     string | null
  createdByAdminUserId: string
  noteText:      string
  createdAt:     string
  updatedAt:     string
}

interface AddBookingNoteRequest {
  noteText: string
}

// ── Status History ──
interface BookingStatusHistoryResponse {
  id:          string
  bookingId:   string
  oldStatus:   FormalBookingStatus | null
  newStatus:   FormalBookingStatus
  changedByAdminUserId: string
  notes:       string | null
  changedAt:   string
}

// ── Assignment ──
interface AssignBookingRequest {
  assignedAdminUserId: string
}

// ── Paginated Bookings ──
interface PaginatedBookings {
  items:      BookingListItemResponse[]
  pagination: PaginationMeta
}
```

```typescript
// lib/api/services/bookings.service.ts

export const bookingsService = {
  // ── Bookings CRUD ──
  getList:    (filters?: BookingListFilters): Promise<PaginatedBookings> =>
    api.get(endpoints.internalBookings.list, { params: filters }),

  getById:    (id: string): Promise<BookingDetailsResponse> =>
    api.get(endpoints.internalBookings.byId(id)),

  // ── Lifecycle ──
  confirm:    (id: string, data?: ConfirmBookingRequest): Promise<BookingDetailsResponse> =>
    api.post(endpoints.bookingLifecycle.confirm(id), data ?? {}),

  cancel:     (id: string, data: CancelBookingRequest): Promise<BookingDetailsResponse> =>
    api.post(endpoints.bookingLifecycle.cancel(id), data),

  complete:   (id: string, data?: CompleteBookingRequest): Promise<BookingDetailsResponse> =>
    api.post(endpoints.bookingLifecycle.complete(id), data ?? {}),

  // ── Status History ──
  getStatusHistory: (id: string): Promise<BookingStatusHistoryResponse[]> =>
    api.get(endpoints.internalBookings.statusHistory(id)),

  // ── Notes ──
  getNotes:   (bookingId: string): Promise<BookingNoteResponse[]> =>
    api.get(endpoints.crmNotes.bookingNotesList(bookingId)),

  addNote:    (bookingId: string, data: AddBookingNoteRequest): Promise<BookingNoteResponse> =>
    api.post(endpoints.crmNotes.bookingNotesCreate(bookingId), data),

  // ── Assignment ──
  getAssignment:  (bookingId: string): Promise<CrmAssignmentResponse> =>
    api.get(endpoints.crmAssignments.bookingGet(bookingId)),

  assign:         (bookingId: string, data: AssignBookingRequest): Promise<CrmAssignmentResponse> =>
    api.post(endpoints.crmAssignments.bookingSet(bookingId), data),

  unassign:       (bookingId: string): Promise<void> =>
    api.delete(endpoints.crmAssignments.bookingDelete(bookingId)),

  // ── Payments ──
  getPayments:    (filters?: { bookingId?: string }): Promise<PaymentResponse[]> =>
    api.get(endpoints.payments.list, { params: filters }),

  createPayment:  (data: CreatePaymentRequest): Promise<PaymentResponse> =>
    api.post(endpoints.payments.create, data),

  markPaid:       (id: string, data?: MarkPaymentPaidRequest): Promise<PaymentResponse> =>
    api.post(endpoints.payments.markPaid(id), data ?? {}),

  markFailed:     (id: string, data: MarkPaymentFailedRequest): Promise<PaymentResponse> =>
    api.post(endpoints.payments.markFailed(id), data),

  cancelPayment:  (id: string, data?: CancelPaymentRequest): Promise<PaymentResponse> =>
    api.post(endpoints.payments.cancel(id), data ?? {}),

  // ── Finance Snapshot ──
  getFinanceSnapshot: (bookingId: string): Promise<BookingFinanceSnapshotResponse> =>
    api.get(endpoints.financeSummary.bookingFinanceSnapshot(bookingId)),

  // ── Invoices ──
  getInvoiceById:     (id: string): Promise<InvoiceResponse> =>
    api.get(endpoints.invoices.byId(id)),

  getInvoiceBalance:  (id: string): Promise<InvoiceBalanceResponse> =>
    api.get(endpoints.invoices.balance(id)),

  issueInvoice:       (id: string): Promise<InvoiceResponse> =>
    api.post(endpoints.invoices.issue(id)),

  cancelInvoice:      (id: string): Promise<InvoiceResponse> =>
    api.post(endpoints.invoices.cancel(id)),

  addAdjustment:      (id: string, data: AddInvoiceManualAdjustmentRequest): Promise<InvoiceResponse> =>
    api.post(endpoints.invoices.addAdjustment(id), data),
}
```

---

### Section 12 — Acceptance Criteria

- [ ] `FormalBookingStatus`: 6 values (Pending/Confirmed/CheckIn/Completed/Cancelled/LeftEarly)
- [ ] `BookingListItemResponse` has `id` and `bookingStatus` (not legacy `bookingId`/`status`)
- [ ] `PaymentMethod`: 'InstaPay' | 'VodafoneCash' | 'Cash' | 'BankTransfer' (PascalCase)
- [ ] `InvoiceStatus`: 'Draft' | 'Issued' | 'Cancelled' (PascalCase)
- [ ] `BookingFinanceSnapshotResponse` has `invoicedAmount`, `paidAmount`, `remainingAmount`, `ownerPayoutStatus`
- [ ] `PaginatedBookings.pagination` uses `totalCount` + `totalPages`
- [ ] No `any` type
- [ ] Zero TypeScript errors
- [ ] No mock data

---

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TICKET ID: FE-3-BOOK-02
TITLE: Build Bookings list page
WAVE: Wave 3 — CRM + Bookings
DOMAIN: Bookings
PRIORITY: Critical
DEPENDS ON: FE-3-BOOK-01, FE-2-ADMIN-01, FE-1-UI-06
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section 1 — Walkthrough

**What is this ticket about?**
The bookings list at `/admin/bookings` shows all formal bookings (post-conversion from CRM leads). Admin and Sales can view and filter by status, date range, unit, and assigned sales person. Finance can view too (read-only). The list is used for daily operations: who checks in today, who's pending confirmation, what's the revenue pipeline.

---

### Section 2 — Objective

Build the bookings list page at `/admin/bookings` using `GET /api/internal/bookings` with filters, search, and pagination — the operational view of all formal bookings.

---

### Section 4 — In Scope

- [ ] `app/(admin)/bookings/page.tsx`
- [ ] Filter bar: Status select, Date range (check-in from/to), search
- [ ] `DataTable` columns: Client Name, Phone (masked), Unit, Check-in, Check-out, Nights, Total, Status (StatusBadge), Assigned To, Actions
- [ ] Row actions: "View Details" → `/admin/bookings/{bookingId}`
- [ ] Pagination with `totalCount` / `totalPages`
- [ ] URL query param sync for filters
- [ ] `keepPreviousData: true`
- [ ] Guard: `canViewBookings`

**Files to create:**
- `app/(admin)/bookings/page.tsx`
- `components/admin/bookings/BookingFilters.tsx`
- `components/admin/bookings/BookingTable.tsx`

---

### Section 6 — Technical Contract

```typescript
// Hook:
export function useBookingsList(filters: BookingListFilters) {
  return useQuery({
    queryKey:        queryKeys.bookings.list(filters),
    queryFn:         () => bookingsService.getList(filters),
    placeholderData: keepPreviousData,
    staleTime:       1000 * 60 * 2,
  })
}
```

---

### Section 7 — API Integration

| Method | Endpoint | Query | Response | When |
|---|---|---|---|---|
| GET | `/api/internal/bookings` | `BookingListFilters` | `PaginatedBookings` | on mount + filter change |

**Status values in filter sent as PascalCase:**
```
?status=Confirmed  (not ?status=confirmed)
?status=CheckIn    (not ?status=check_in)
```

---

### Section 10 — UX & Loading State Rules

| State | Required? | Behavior |
|---|---|---|
| Loading | ✓ REQUIRED | `<SkeletonTable rows={8} columns={8}>` |
| Empty (no bookings) | ✓ REQUIRED | `<EmptyState title="No bookings yet">` |
| Empty (filtered) | ✓ REQUIRED | `<EmptyState title="No bookings match filters" action={{ label: 'Clear filters' }}>` |
| Today's check-ins | Highlight | Rows where `checkInDate === today` → subtle amber left border |

---

### Section 12 — Acceptance Criteria

- [ ] `GET /api/internal/bookings` called with active filter params
- [ ] Status filter sends PascalCase value to API
- [ ] `bookingId` used for row navigation (not `id`)
- [ ] `bookingStatus` shown via `<StatusBadge>` (not raw string)
- [ ] Phone masked in display
- [ ] Nights calculated using `getNights()` util
- [ ] `keepPreviousData: true`
- [ ] Pagination uses `totalCount` + `totalPages`
- [ ] No mock data

---

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TICKET ID: FE-3-BOOK-03
TITLE: Build Booking Detail page
WAVE: Wave 3 — CRM + Bookings
DOMAIN: Bookings
PRIORITY: Critical
DEPENDS ON: FE-3-BOOK-01, FE-2-ADMIN-01
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section 1 — Walkthrough

**What is this ticket about?**
The booking detail page at `/admin/bookings/{bookingId}` is the most complex page in the Admin Panel. It's the operational hub for a single booking with 8 sections:

1. **Booking Header** — status badge, booking ID, dates, unit info
2. **Client Info** — name, phone, email (if set)
3. **Financial Summary** — total, deposit, remaining, outstanding
4. **Status & Lifecycle Actions** — confirm/cancel/complete buttons
5. **Payments** — payment history + record payment
6. **Invoice** — invoice status + PDF link + lifecycle actions
7. **Notes** — booking notes feed
8. **Status History** — timeline of all status changes

This ticket builds the page shell and sections 1–3 only. Sections 4–8 are built in FE-3-BOOK-04 through FE-3-BOOK-09.

**Why is this the most complex page?**
It has 5+ API calls, 4+ mutation flows, and requires perfectly coordinated cache invalidation across bookings, payments, invoices, and the finance snapshot.

---

### Section 2 — Objective

Build the Booking Detail page shell at `/admin/bookings/{bookingId}` with Booking Header, Client Info, and Financial Summary sections — the scaffold that FE-3-BOOK-04 through FE-3-BOOK-09 slot their sections into.

---

### Section 4 — In Scope

- [ ] `app/(admin)/bookings/[bookingId]/page.tsx`
- [ ] `GET /api/internal/bookings/{id}` — booking details
- [ ] `GET /api/internal/bookings/{bookingId}/finance-snapshot` — for financial summary section
- [ ] **Section 1 — Booking Header:**
  - Booking ID (truncated UUID), `bookingStatus` badge, source badge
  - Check-in → Check-out dates, nights count
  - Unit name + project, type badge
  - "Back to Bookings" breadcrumb
- [ ] **Section 2 — Client Info:**
  - Client name, phone (masked), email (if set)
  - Link: "View Client Profile" → `ROUTES.admin.clients.detail(client.clientId)`
- [ ] **Section 3 — Financial Summary:**
  - Total amount, Deposit amount, Remaining amount
  - Total Paid, Outstanding amount (from finance snapshot)
  - Platform commission, Owner earnings
  - All values formatted with `formatCurrency()`
- [ ] Section placeholders for 4–8 (render empty `<div>` — later tickets fill them)
- [ ] Skeleton loading for all 3 sections
- [ ] 404 handling

**Files to create:**
- `app/(admin)/bookings/[bookingId]/page.tsx`
- `components/admin/bookings/BookingHeader.tsx`
- `components/admin/bookings/BookingClientInfo.tsx`
- `components/admin/bookings/BookingFinancialSummary.tsx`

---

### Section 7 — API Integration

| Method | Endpoint | Response | When |
|---|---|---|---|
| GET | `/api/internal/bookings/{id}` | `BookingDetailsResponse` | on page mount |
| GET | `/api/internal/bookings/{id}/finance-snapshot` | `BookingFinanceSnapshotResponse` | on page mount |

```typescript
// Hooks:
export function useBookingDetail(bookingId: string) {
  return useQuery({
    queryKey: queryKeys.bookings.detail(bookingId),
    queryFn:  () => bookingsService.getById(bookingId),
    staleTime: 1000 * 30,   // 30 seconds — booking status changes often
  })
}

export function useBookingFinanceSnapshot(bookingId: string) {
  return useQuery({
    queryKey: queryKeys.bookings.financeSnapshot(bookingId),
    queryFn:  () => bookingsService.getFinanceSnapshot(bookingId),
    staleTime: 1000 * 30,
  })
}
```

#### Key invalidation pattern (used by ALL tickets on this page):
```typescript
// After any mutation on this booking (status change, payment, invoice):
queryClient.invalidateQueries({ queryKey: queryKeys.bookings.detail(bookingId) })
queryClient.invalidateQueries({ queryKey: queryKeys.bookings.financeSnapshot(bookingId) })
queryClient.invalidateQueries({ queryKey: queryKeys.bookings.list({}) })
```

---

### Section 12 — Acceptance Criteria

- [ ] `booking.id` used
- [ ] `booking.bookingStatus` used (not `booking.status`)
- [ ] Finance snapshot shows `invoicedAmount`, `paidAmount`, `remainingAmount`, `ownerPayoutStatus`
- [ ] `formatCurrency()` used for all money values
- [ ] `getNights()` used for night count
- [ ] `staleTime: 30 seconds` on both queries
- [ ] 404 handled with EmptyState
- [ ] No mock data

---

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TICKET ID: FE-3-BOOK-04
TITLE: Build Booking lifecycle actions
WAVE: Wave 3 — CRM + Bookings
DOMAIN: Bookings
PRIORITY: Critical
DEPENDS ON: FE-3-BOOK-03, FE-1-UI-04
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section 1 — Walkthrough

**What is this ticket about?**
Formal bookings have a lifecycle: Pending → Confirmed → CheckIn → Completed (or → Cancelled / LeftEarly). Each transition is a specific API endpoint. This ticket builds the lifecycle action buttons on the booking detail page, with confirmation dialogs, and handles the side effects each transition triggers.

**Business rules per transition:**
- `→ Confirmed`: generates invoice, sends confirmation email to client
- `→ CheckIn`: triggers prompt to record remaining payment
- `→ Completed`: auto-completes after checkout date (background job) OR manual here
- `→ Cancelled`: no deposit refund (unless manual override). Releases availability.
- `→ LeftEarly`: releases availability, logs early departure

---

### Section 4 — In Scope

- [ ] `components/admin/bookings/BookingLifecycleActions.tsx`
- [ ] Shows available actions based on current `bookingStatus`
- [ ] Valid transitions (per business rules):
  - `Pending` → Confirm | Cancel
  - `Confirmed` → CheckIn | Cancel
  - `CheckIn` → Complete | LeftEarly
  - `Completed`, `Cancelled`, `LeftEarly` → no actions (terminal)
- [ ] Confirm → `POST /api/internal/bookings/{id}/confirm`
- [ ] Cancel → `POST /api/internal/bookings/{id}/cancel` (requires cancel reason input)
- [ ] CheckIn → `POST /api/internal/bookings/{id}/confirm` (Wait — check API: CheckIn uses a separate endpoint? Check reference)
  - Actually: The lifecycle is Pending → Confirmed → CheckIn → Completed
  - `confirm` endpoint: Pending → Confirmed
  - There may be a separate check-in transition... Per the BookingLifecycle section: `confirm`, `cancel`, `complete`
  - CheckIn status change: may use the generic status or the confirm endpoint chain — verify with API
  - Use: For moving to CheckIn use confirm-like flow, for Complete use `complete` endpoint
- [ ] Cancel: requires `reason` (string, required) + optional notes
- [ ] LeftEarly: requires notes
- [ ] All destructive actions (Cancel, LeftEarly) use `<ConfirmDialog>` with reason input

**Files to create:**
- `components/admin/bookings/BookingLifecycleActions.tsx`
- `components/admin/bookings/CancelBookingDialog.tsx`

---

### Section 6 — Technical Contract

```typescript
interface BookingLifecycleActionsProps {
  bookingId:     string
  currentStatus: FormalBookingStatus
}

// Cancel dialog:
interface CancelBookingDialogProps {
  isOpen:    boolean
  onClose:   () => void
  onConfirm: (data: CancelBookingRequest) => void
  isLoading: boolean
}
```

```typescript
// CancelBookingRequest:
interface CancelBookingRequest {
  reason: string   // required — why was the booking cancelled?
  notes?: string
}
```

---

### Section 7 — API Integration

| Method | Endpoint | Request | When |
|---|---|---|---|
| POST | `/api/internal/bookings/{id}/confirm` | `ConfirmBookingRequest` | on Confirm action |
| POST | `/api/internal/bookings/{id}/cancel` | `CancelBookingRequest` | on Cancel confirm |
| POST | `/api/internal/bookings/{id}/complete` | `CompleteBookingRequest` | on Complete action |

**Note:** CheckIn transition may be handled differently — if there's no separate `check-in` endpoint, the status progresses via confirm → confirmCheckIn. Verify the exact flow with the backend team.

#### 7d. Mutation Side Effects

```typescript
// After ANY lifecycle transition:
toastSuccess('Booking status updated')
queryClient.invalidateQueries({ queryKey: queryKeys.bookings.detail(bookingId) })
queryClient.invalidateQueries({ queryKey: queryKeys.bookings.financeSnapshot(bookingId) })
queryClient.invalidateQueries({ queryKey: queryKeys.bookings.list({}) })
queryClient.invalidateQueries({ queryKey: queryKeys.bookings.statusHistory(bookingId) })

// Additional: after Confirm specifically → invoice will be generated by backend
// Invalidate invoice query too:
queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all })
```

---

### Section 12 — Acceptance Criteria

- [ ] Actions shown only for valid `bookingStatus` transitions
- [ ] `POST /api/internal/bookings/{id}/confirm` → `ConfirmBookingRequest` body
- [ ] `POST /api/internal/bookings/{id}/cancel` → `CancelBookingRequest` (optional `notes`)
- [ ] `POST /api/internal/bookings/{id}/complete` → `CompleteBookingRequest` body
- [ ] All transitions use `<ConfirmDialog>` before executing
- [ ] Cancel dialog supports optional `notes` field
- [ ] `canManageBookings` gates all action buttons
- [ ] All relevant caches invalidated after each transition
- [ ] No mock data

---

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TICKET ID: FE-3-BOOK-05
TITLE: Build Record Payment flow
WAVE: Wave 3 — CRM + Bookings
DOMAIN: Bookings
PRIORITY: Critical
DEPENDS ON: FE-3-BOOK-03, FE-1-UI-08
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section 1 — Walkthrough

**What is this ticket about?**
Recording payments is the primary Finance workflow. Finance records payment method, amount, optional reference number, and optional notes. Payments can be marked as paid, failed, or cancelled.

**Money flow reminder:** Client always pays Admin. Never directly to owner. Admin records it here.

---

### Section 4 — In Scope

- [ ] `components/admin/bookings/BookingPayments.tsx` — section on booking detail page
- [ ] List of all payments for this booking (from finance snapshot `payments` array)
- [ ] "Record Payment" button → modal form
- [ ] `components/admin/bookings/RecordPaymentModal.tsx`
- [ ] Payment form fields:
  - `amount` — Number input (EGP), required
  - `paymentMethod` — Select: InstaPay / VodafoneCash / Cash / BankTransfer
  - `referenceNumber` — Input, optional
  - `notes` — Textarea, optional
- [ ] Each payment row: type badge, amount, date, method, status badge, recorded by, actions
- [ ] Payment actions (Finance/SuperAdmin):
  - `Pending` → "Mark Paid" button → `POST /api/internal/payments/{id}/mark-paid`
  - `Pending` → "Mark Failed" button → requires reason → `POST /api/internal/payments/{id}/mark-failed`
  - `Pending` → "Cancel" button → `POST /api/internal/payments/{id}/cancel`

**Files to create:**
- `components/admin/bookings/BookingPayments.tsx`
- `components/admin/bookings/RecordPaymentModal.tsx`

---

### Section 6 — Technical Contract

```typescript
const recordPaymentSchema = z.object({
  amount:        z.number({ invalid_type_error: 'Amount required' }).min(0.01, 'Amount must be positive'),
  paymentMethod: z.enum(['InstaPay', 'VodafoneCash', 'Cash', 'BankTransfer']),
  referenceNumber: z.string().optional(),
  notes:         z.string().optional(),
})
```

---

### Section 7 — API Integration

| Method | Endpoint | Request | Response | When |
|---|---|---|---|---|
| GET | Finance snapshot | — | includes `payments[]` | from parent page query |
| POST | `/api/internal/payments` | `CreatePaymentRequest` | `PaymentResponse` | on form submit |
| POST | `/api/internal/payments/{id}/mark-paid` | `MarkPaymentPaidRequest` | `PaymentResponse` | on Mark Paid |
| POST | `/api/internal/payments/{id}/mark-failed` | `MarkPaymentFailedRequest` | `PaymentResponse` | on Mark Failed |
| POST | `/api/internal/payments/{id}/cancel` | `CancelPaymentRequest` | `PaymentResponse` | on Cancel confirm |

**CreatePaymentRequest:**
```typescript
// CRITICAL: paymentMethod is PascalCase
{
  bookingId:     string,
  invoiceId?:    string,
  paymentMethod: 'InstaPay' | 'VodafoneCash' | 'Cash' | 'BankTransfer',
  amount:        number,
  referenceNumber?: string,
  notes?:        string,
}
```

#### 7d. Mutation Side Effects

```typescript
// After record payment / mark paid / mark failed / cancel:
toastSuccess('[Action] recorded successfully')
queryClient.invalidateQueries({ queryKey: queryKeys.bookings.financeSnapshot(bookingId) })
queryClient.invalidateQueries({ queryKey: queryKeys.bookings.detail(bookingId) })
closeModal()
```

---

### Section 12 — Acceptance Criteria

- [ ] `paymentMethod` sends PascalCase: 'InstaPay', 'VodafoneCash', etc.
- [ ] `amount` sent as number (not string)
- [ ] `referenceNumber` sent when available
- [ ] Payment status badges use `PAYMENT_STATUS_LABELS` from constants
- [ ] `canManageFinance || canManageBookings` gates record payment
- [ ] Finance snapshot invalidated after mutations (to refresh the payments list)
- [ ] No mock data

---

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TICKET ID: FE-3-BOOK-06
TITLE: Build Invoice management
WAVE: Wave 3 — CRM + Bookings
DOMAIN: Bookings
PRIORITY: High
DEPENDS ON: FE-3-BOOK-03
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section 1 — Walkthrough

**What is this ticket about?**
When a booking is confirmed, the backend auto-generates an invoice in `Draft` status. This section on the booking detail page shows the invoice status, allows issuing it (making it official), adding manual adjustments, cancelling, and downloading the PDF.

**Invoice workflow:**
`Draft` (auto-created on confirm) → Manual Adjustments (optional) → `Issue` (PDF generated) → `Cancelled` (if needed)

---

### Section 4 — In Scope

- [ ] `components/admin/bookings/BookingInvoice.tsx`
- [ ] Shows: invoice number, status badge, subtotal amount, total amount, due date, issuedAt
- [ ] Invoice status badge: Draft (warning), Issued (success), Cancelled (danger)
- [ ] Balance info from `GET /api/internal/invoices/{id}/balance`: paidAmount, remainingAmount
- [ ] Actions:
  - `Draft` → "Issue Invoice" button → `POST /api/internal/invoices/{id}/issue`
  - `Draft` → "Add Adjustment" button → modal → `POST /api/internal/invoices/{id}/items/manual-adjustment`
  - `Draft` → "Cancel Invoice" button → `POST /api/internal/invoices/{id}/cancel` (ConfirmDialog)
  - `Issued` → show issued metadata (read-only)
- [ ] Invoice loaded from the booking detail response (if available) OR separate fetch by invoiceId

**Files to create:**
- `components/admin/bookings/BookingInvoice.tsx`
- `components/admin/bookings/AddAdjustmentModal.tsx`

---

### Section 6 — Technical Contract

```typescript
const adjustmentSchema = z.object({
  description:    z.string().min(1, 'Description required'),
  amount:         z.number().min(0.01, 'Amount must be positive'),
  adjustmentType: z.enum(['addition', 'deduction']),
})
```

---

### Section 7 — API Integration

| Method | Endpoint | Request | When |
|---|---|---|---|
| GET | `/api/internal/invoices/{id}/balance` | — | on mount |
| POST | `/api/internal/invoices/{id}/issue` | — | on Issue click |
| POST | `/api/internal/invoices/{id}/cancel` | — | on Cancel confirm |
| POST | `/api/internal/invoices/{id}/items/manual-adjustment` | `AddInvoiceManualAdjustmentRequest` | on adjustment submit |

---

### Section 12 — Acceptance Criteria

- [ ] Invoice status badge: Draft=warning, Issued=success, Cancelled=danger (using `INVOICE_STATUS_LABELS`)
- [ ] "Issue Invoice" only shown when status = 'Draft'
- [ ] Issued status shows issued metadata according to documented response fields
- [ ] "Add Adjustment" only when status = 'Draft'
- [ ] Cancel requires `<ConfirmDialog>`
- [ ] Balance shows `remainingAmount` from balance endpoint
- [ ] Caches invalidated after mutations
- [ ] No mock data

---

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TICKET ID: FE-3-BOOK-07
TITLE: Build Booking Finance Snapshot section
WAVE: Wave 3 — CRM + Bookings
DOMAIN: Bookings
PRIORITY: High
DEPENDS ON: FE-3-BOOK-03
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section 1 — Walkthrough

**What is this ticket about?**
The finance snapshot gives a compact financial picture of a booking: invoiced amount, paid amount, remaining amount, invoice status, and owner payout status. This is purely informational — no actions.

---

### Section 4 — In Scope

- [ ] `components/admin/bookings/BookingFinanceSnapshot.tsx`
- [ ] Data from `GET /api/internal/bookings/{bookingId}/finance-snapshot`
- [ ] Display documented snapshot fields:
  - Invoiced Amount
  - Paid Amount
  - Remaining Amount (highlighted if > 0)
  - Invoice Status
  - Owner Payout Status
- [ ] All values: `formatCurrency()`
- [ ] `Remaining Amount` — red if > 0, green if 0
- [ ] Read-only — no actions

**Files to create:**
- `components/admin/bookings/BookingFinanceSnapshot.tsx`

---

### Section 12 — Acceptance Criteria

- [ ] Monetary snapshot fields displayed using `formatCurrency()`
- [ ] `remainingAmount > 0` → red styling
- [ ] `remainingAmount === 0` → green styling
- [ ] Read-only (no buttons)
- [ ] No mock data (data from real finance snapshot API)

---

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TICKET ID: FE-3-BOOK-08
TITLE: Build Booking Notes + Assignment
WAVE: Wave 3 — CRM + Bookings
DOMAIN: Bookings
PRIORITY: High
DEPENDS ON: FE-3-BOOK-03
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section 1 — Walkthrough

**What is this ticket about?**
Same pattern as CRM Lead notes and assignment (FE-3-CRM-06, 07) but for formal bookings. Notes track operational details ("Client requested early check-in", "Owner informed of arrival"). Assignment tracks which Sales person is responsible.

---

### Section 4 — In Scope

**Notes:**
- [ ] `components/admin/bookings/BookingNotes.tsx`
- [ ] `GET /api/internal/bookings/{bookingId}/notes`
- [ ] `POST /api/internal/bookings/{bookingId}/notes`
- [ ] `PUT /api/internal/crm/notes/{noteId}` — same notes endpoint as CRM
- [ ] `DELETE /api/internal/crm/notes/{noteId}`

**Assignment:**
- [ ] `components/admin/bookings/BookingAssignment.tsx`
- [ ] `GET /api/internal/bookings/{bookingId}/assignment`
- [ ] `POST /api/internal/bookings/{bookingId}/assignment`
- [ ] `DELETE /api/internal/bookings/{bookingId}/assignment`

**Files to create:**
- `components/admin/bookings/BookingNotes.tsx`
- `components/admin/bookings/BookingAssignment.tsx`

---

### Section 7 — API Integration

Notes endpoints:
```typescript
// GET /api/internal/bookings/{bookingId}/notes → BookingNoteResponse[]
// POST /api/internal/bookings/{bookingId}/notes → { noteText } → BookingNoteResponse
// PUT /api/internal/crm/notes/{noteId} → { noteText } → BookingNoteResponse
// DELETE /api/internal/crm/notes/{noteId} → void
```

Assignment endpoints:
```typescript
// GET /api/internal/bookings/{bookingId}/assignment → CrmAssignmentResponse
// POST /api/internal/bookings/{bookingId}/assignment → { assignedAdminUserId } → CrmAssignmentResponse
// DELETE /api/internal/bookings/{bookingId}/assignment → void
```

---

### Section 12 — Acceptance Criteria

- [ ] Notes uses booking-specific endpoint for GET/POST, shared CRM endpoint for PUT/DELETE
- [ ] Assignment uses booking-specific endpoints (different from lead assignment)
- [ ] Query keys correctly scoped: `queryKeys.bookings.notes(bookingId)`, `queryKeys.bookings.assignment(bookingId)`
- [ ] No mock data

---

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TICKET ID: FE-3-BOOK-09
TITLE: Build Booking Status History timeline
WAVE: Wave 3 — CRM + Bookings
DOMAIN: Bookings
PRIORITY: High
DEPENDS ON: FE-3-BOOK-03
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section 1 — Walkthrough

**What is this ticket about?**
Every status change on a booking is logged with: old status, new status, who changed it, when, and optional notes. This creates an audit trail visible on the booking detail page as a timeline. Essential for resolving disputes ("who cancelled this?") and compliance.

---

### Section 4 — In Scope

- [ ] `components/admin/bookings/BookingStatusHistory.tsx`
- [ ] `GET /api/internal/bookings/{id}/status-history`
- [ ] Timeline display: newest first
- [ ] Each entry: status arrow (old → new), admin name, `formatRelativeTime(changedAt)`, notes (if any)
- [ ] Status badges for old and new status using `<StatusBadge>`
- [ ] "SYSTEM" entries (from background auto-complete job): special system icon instead of avatar
- [ ] Read-only — no actions

**Files to create:**
- `components/admin/bookings/BookingStatusHistory.tsx`

---

### Section 7 — API Integration

| Method | Endpoint | Response | When |
|---|---|---|---|
| GET | `/api/internal/bookings/{id}/status-history` | `BookingStatusHistoryResponse[]` | on section mount |

```typescript
export function useBookingStatusHistory(bookingId: string) {
  return useQuery({
    queryKey: queryKeys.bookings.statusHistory(bookingId),
    queryFn:  () => bookingsService.getStatusHistory(bookingId),
    staleTime: 1000 * 60 * 5,   // 5 minutes — history doesn't change often
  })
}
```

---

### Section 12 — Acceptance Criteria

- [ ] History sorted newest first (or oldest first with newest at bottom — consistent with Notes)
- [ ] Both old and new status shown as `<StatusBadge>` components
- [ ] `changedBy === 'SYSTEM'` (or null) → show system icon instead of person name
- [ ] `formatRelativeTime()` used for timestamps
- [ ] Notes shown if present
- [ ] Read-only (no actions)
- [ ] No mock data

---

---

# Wave 3 — QA Prompt

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WAVE QA REVIEW PROMPT
Wave: 3 — CRM + Bookings
Tickets: FE-3-CRM-01 through FE-3-CRM-09,
         FE-3-BOOK-01 through FE-3-BOOK-09
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You are a senior QA engineer reviewing Wave 3 of the Rental Platform frontend.

## MOCK DATA AUDIT — HARD GATE

Run ALL commands — must return zero results:

```bash
grep -rn "mockLead\|fakeLead\|sampleLead\|mockBooking\|fakeBooking" \
  --include="*.ts" --include="*.tsx" .

grep -rn "contactName.*Ahmed\|contactName.*Mohamed\|clientName.*test" \
  --include="*.ts" --include="*.tsx" .

grep -rn "const leads = \[\|const bookings = \[" \
  --include="*.ts" --include="*.tsx" .

# Enum case violations:
grep -rn "'prospecting'\|'no_answer'\|'not_relevant'\|'booked'\|'check_in'\|'left_early'" \
  --include="*.ts" --include="*.tsx" lib/ components/admin/crm/ components/admin/bookings/
# ↑ Must return ZERO — all statuses are PascalCase

grep -rn "'deposit'\|'remaining'\|'refund'" \
  --include="*.ts" --include="*.tsx" components/ lib/api/services/bookings.service.ts
# ↑ Must be 'Deposit' | 'Remaining' | 'Refund'

grep -rn "'instapay'\|'vodafonecash'\|'cash'\|'banktransfer'" \
  --include="*.ts" --include="*.tsx" .
# ↑ Must be PascalCase: 'InstaPay' | 'VodafoneCash' | etc.

grep -rn "pagination\.total[^C]" --include="*.ts" --include="*.tsx" .
grep -rn "lead\.id[^s]\|lead\.status[^H]" --include="*.ts" --include="*.tsx" .
grep -rn "booking\.id[^s]\|booking\.status[^H]" --include="*.ts" --include="*.tsx" .
```

## CRM — CRITICAL API CONTRACT CHECKS

### Field naming:
- [ ] `lead.id` used everywhere (not legacy `lead.leadId`)
- [ ] `lead.leadStatus` used everywhere (not `lead.status`)
- [ ] `booking.id` used everywhere (not legacy `booking.bookingId`)
- [ ] `booking.bookingStatus` used everywhere (not `booking.status`)
- [ ] `CrmNoteResponse.id` used for update/delete (not `noteId`)

### Status values:
- [ ] CRM Lead statuses — PascalCase: 'Prospecting', 'Relevant', 'NoAnswer', 'NotRelevant', 'Booked', 'Confirmed', 'CheckIn', 'Completed', 'Cancelled', 'LeftEarly'
- [ ] Formal Booking statuses — PascalCase: 'Pending', 'Confirmed', 'CheckIn', 'Completed', 'Cancelled', 'LeftEarly'
- [ ] `VALID_TRANSITIONS` from constants used for allowed moves (not hardcoded)
- [ ] Status transition request body: `{ leadStatus: 'Confirmed' }` (PascalCase)

### CRM Service:
- [ ] `POST /api/internal/crm/leads` used for admin-created leads
- [ ] `PATCH /api/internal/crm/leads/{id}/status` for status transition
- [ ] `POST /api/internal/crm/leads/{id}/convert-to-booking` returns booking object
- [ ] Convert redirects to `/admin/bookings/{id}` (not back to CRM)
- [ ] Notes: lead notes use `/api/internal/crm/leads/{leadId}/notes`, update/delete use `/api/internal/crm/notes/{id}`

### Bookings Service:
- [ ] Lifecycle: confirm = `POST /confirm`, cancel = `POST /cancel`, complete = `POST /complete`
- [ ] Cancel request body uses optional `{ notes?: string }`
- [ ] `POST /api/internal/payments` for record payment (not PUT)
- [ ] Payment `paymentMethod`: 'InstaPay' | 'VodafoneCash' | 'Cash' | 'BankTransfer' (PascalCase)
- [ ] Invoice lifecycle: `POST /issue`, `POST /cancel`, `POST /items/manual-adjustment`
- [ ] Finance snapshot: `GET /api/internal/bookings/{bookingId}/finance-snapshot`
- [ ] Finance snapshot has `invoicedAmount`, `paidAmount`, `remainingAmount`, `ownerPayoutStatus`

## PER-TICKET CHECKS

### FE-3-CRM-01 — CRM Types/Service
- [ ] `CrmLeadStatus` = 10 values (full pipeline)
- [ ] `FormalBookingStatus` NOT in this file (belongs to bookings)
- [ ] `convertToBooking` returns booking object; redirect uses `response.id`

### FE-3-CRM-02 — Pipeline Board
- [ ] `pageSize: 200` passed to get all leads
- [ ] Grouping by `leadStatus` (not `status`) using `useMemo`
- [ ] `refetchOnWindowFocus: true` set on this specific query
- [ ] `staleTime: 1 minute` on this query
- [ ] `CRM_PIPELINE_COLUMNS` from constants (not hardcoded array)
- [ ] Closed statuses in separate collapsed section
- [ ] PipelineBoard loaded via `dynamic()`

### FE-3-CRM-03 — Lead Card
- [ ] Phone masked: first 4 + *** + last 4
- [ ] Navigation uses `lead.id`
- [ ] Days counter from `lead.updatedAt`
- [ ] NoAnswer → amber border indicator
- [ ] `BOOKING_SOURCE_LABELS` used for source display (PascalCase key)

### FE-3-CRM-04 — Lead Detail
- [ ] `GET` by `id` path param
- [ ] `convertedBookingId` not null → "View Booking" link shown
- [ ] 404 handled

### FE-3-CRM-05 — Status Transitions
- [ ] Only `VALID_TRANSITIONS[currentStatus]` shown as buttons
- [ ] Request body: `{ leadStatus: 'Relevant' }` (PascalCase)
- [ ] Optional notes textarea in confirmation dialog
- [ ] Both lead detail + leads list invalidated

### FE-3-CRM-06 — Lead Notes
- [ ] Add note → `POST /api/internal/crm/leads/{leadId}/notes`
- [ ] Update note → `PUT /api/internal/crm/notes/{noteId}` (shared endpoint)
- [ ] Delete note → `DELETE /api/internal/crm/notes/{noteId}`

### FE-3-CRM-07 — Lead Assignment
- [ ] `POST` to assign, `DELETE` to unassign (not PATCH)
- [ ] Admin users list from `GET /api/admin-users`

### FE-3-CRM-08 — Create Lead
- [ ] `source` sent as PascalCase: 'PhoneCall' not 'phone'
- [ ] Uses internal crm/leads endpoint
- [ ] `contactEmail` = undefined (not "") when empty

### FE-3-CRM-09 — Convert to Booking
- [ ] Panel shown ONLY when `leadStatus === 'Booked'`
- [ ] Request includes `clientId`, `unitId`, `checkInDate`, `checkOutDate`, `guestCount`
- [ ] Response `id` used for redirect to bookings

### FE-3-BOOK-01 — Bookings Types/Service
- [ ] `FormalBookingStatus` = 6 values only (Pending through LeftEarly)
- [ ] `PaymentMethod` = 'InstaPay' | 'VodafoneCash' | 'Cash' | 'BankTransfer'
- [ ] `InvoiceStatus` = 'Draft' | 'Issued' | 'Cancelled'
- [ ] `BookingFinanceSnapshotResponse` has: invoicedAmount, paidAmount, remainingAmount, ownerPayoutStatus

### FE-3-BOOK-02 — Bookings List
- [ ] Status filter sends PascalCase value
- [ ] `bookingId` used for navigation
- [ ] `bookingStatus` shown via StatusBadge
- [ ] `keepPreviousData: true`
- [ ] Phone masked

### FE-3-BOOK-03 — Booking Detail
- [ ] `staleTime: 30 seconds` on booking detail + finance snapshot
- [ ] Finance snapshot shows invoicedAmount, paidAmount, remainingAmount, ownerPayoutStatus
- [ ] `formatCurrency()` for all money values
- [ ] `getNights()` for night count

### FE-3-BOOK-04 — Lifecycle Actions
- [ ] Cancel request body uses optional notes only
- [ ] `canManageBookings` gates all action buttons
- [ ] Invoice cache invalidated after Confirm (backend auto-creates invoice)

### FE-3-BOOK-05 — Record Payment
- [ ] `paymentMethod` = PascalCase: 'InstaPay', 'VodafoneCash', etc.
- [ ] `referenceNumber` is sent when available
- [ ] `amount` = number (not string)
- [ ] Finance snapshot invalidated after payment mutation

### FE-3-BOOK-06 — Invoice
- [ ] Status-dependent actions (Issue = Draft only, Download = Issued only)
- [ ] Balance endpoint used for remainingAmount display
- [ ] Adjustment modal: description + amount + type (addition/deduction)

### FE-3-BOOK-07 — Finance Snapshot
- [ ] `remainingAmount > 0` → red styling
- [ ] All 7 financial fields shown
- [ ] Read-only

### FE-3-BOOK-08 — Notes + Assignment
- [ ] Booking notes use booking-specific endpoints
- [ ] Update/delete notes use shared CRM notes endpoint
- [ ] Booking assignment uses booking-specific endpoints

### FE-3-BOOK-09 — Status History
- [ ] Newest first (or consistent order)
- [ ] SYSTEM entries handled gracefully
- [ ] `formatRelativeTime()` used

## ARCHITECTURE CHECKS
- [ ] CRM service (`crm.service.ts`) and Bookings service (`bookings.service.ts`) are SEPARATE files
- [ ] Query keys separated: `queryKeys.crm.*` and `queryKeys.bookings.*`
- [ ] No server data in Zustand
- [ ] No inline endpoint or route strings
- [ ] No `any` TypeScript types
- [ ] `pnpm type-check` → zero errors

## BUSINESS VALIDATION MANUAL TESTS

| Test | Expected |
|---|---|
| Sales creates a lead manually with source=Phone Call | Lead appears in Prospecting column with 'PhoneCall' source badge |
| Sales transitions lead Prospecting → Relevant | Status updates, pipeline board refreshes |
| Sales tries to transition Prospecting → Confirmed (invalid) | Button NOT shown |
| Sales converts Booked lead to booking with required payload fields | New booking created, redirect to booking detail |
| Finance records a Deposit payment of 1500 EGP via InstaPay | Payment appears in payment list, finance snapshot updates |
| Admin confirms booking → invoice generated | Invoice section shows Draft status |
| Admin issues invoice | Invoice status → Issued, Download PDF button appears |
| Admin cancels booking | Optional notes may be provided, status → Cancelled |

## Wave 3 Sign-off Recommendation
[ ] APPROVED
[ ] CONDITIONAL — conditions: ...
[ ] BLOCKED — blockers: ...
```

---

---

# Wave 3 — PM Sign-off Checklist

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PM WAVE SIGN-OFF CHECKLIST
Wave: 3 — CRM + Bookings
Date: _______________
Reviewed by: _______________
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### A. QA Report Review
- [ ] QA report received and reviewed
- [ ] All BLOCKERs resolved (PR links): ________________
- [ ] MOCK DATA AUDIT PASSED — all grep commands returned zero

### B. Business Requirements Validation

**Manually test the complete lead-to-booking-to-payment flow:**

| Step | Action | Expected Result | Tested | Pass/Fail |
|---|---|---|---|---|
| 1 | Sales creates lead via New Lead (phone call source) | Lead in Prospecting, source='PhoneCall' | | |
| 2 | Sales transitions lead Prospecting → Relevant | Status updates immediately | | |
| 3 | Sales transitions Relevant → NoAnswer | Lead shows amber indicator | | |
| 4 | Sales transitions NoAnswer → Relevant | Back in pipeline | | |
| 5 | Sales transitions Relevant → Booked | Convert panel appears | | |
| 6 | Sales converts to Booking with required fields | Redirect to Booking detail | | |
| 7 | Admin confirms booking | Invoice created (Draft), client notified | | |
| 8 | Admin issues invoice | Invoice PDF URL available | | |
| 9 | Finance records deposit payment (1500 EGP, InstaPay) | Payment in list, snapshot updated | | |
| 10 | Admin marks check-in | Booking status → CheckIn | | |
| 11 | Admin marks complete | Status → Completed | | |
| 12 | Check status history | All 6 transitions logged with admin names | | |

**Permission matrix test:**

| Role | CRM visible | Bookings visible | Finance visible | Can transition | Can record payment |
|---|---|---|---|---|---|
| SuperAdmin | ✓ | ✓ | ✓ | ✓ | ✓ |
| Sales | ✓ | ✓ | ✗ | ✓ | ✗ |
| Finance | ✗ | ✓ (view) | ✓ | ✗ | ✓ |
| Tech | ✗ | ✗ | ✗ | ✗ | ✗ |

### C. Definition of Done
- [ ] `pnpm type-check` clean
- [ ] `pnpm lint` clean
- [ ] All 18 tickets merged
- [ ] Mock data audit passed (all greps = zero)
- [ ] CRM and Bookings are SEPARATE service files (not merged)
- [ ] All status values PascalCase in API requests
- [ ] Payment method + type PascalCase in requests
- [ ] `id` field names used for leads/bookings entities (legacy `leadId`/`bookingId` removed from entity payloads)
- [ ] `bookingStatus` / `leadStatus` field names (not `status`)
- [ ] `pagination.totalCount` used (not `.total`)

### D. API Contract Sign-off
- [ ] CRM Lead: 10 statuses (full pipeline) ✓
- [ ] Formal Booking: 6 statuses (post-conversion) ✓
- [ ] Cancel booking uses optional `notes` body ✓
- [ ] Convert to booking → redirect to new booking `id` ✓
- [ ] Payment type/method in PascalCase ✓
- [ ] Invoice lifecycle (Draft → Issue → Cancel) ✓
- [ ] Finance snapshot follows documented fields (`invoicedAmount`, `paidAmount`, `remainingAmount`, `ownerPayoutStatus`) ✓

### E. Critical Path — "Earliest Something Working" Milestone

After Wave 3, verify this milestone is met:
> **A complete sale cycle can be demonstrated:** lead created → pipeline tracked → converted → payment recorded → invoice issued → check-in marked.

- [ ] Full cycle demonstrated with real backend: ✓ / ✗
- [ ] Notes: ______________________

### F. Mock Data Final Audit

```bash
# All must return zero:
grep -rn "mockLead\|fakeLead\|mockBooking\|fakeBooking\|faker\|json-server\|msw" \
  --include="*.ts" --include="*.tsx" .
grep -rn "'prospecting'\|'no_answer'\|'booked'\|'check_in'\|'left_early'" \
  --include="*.ts" --include="*.tsx" lib/ components/
grep -rn "'deposit'\|'remaining'\|'instapay'\|'vodafonecash'" \
  --include="*.ts" --include="*.tsx" lib/ components/
grep -rn "lead\.id[^s]\|lead\.status[^H]\|booking\.id[^s]\|booking\.status[^H]" \
  --include="*.ts" --include="*.tsx" components/
grep -rn "pagination\.total[^C]" --include="*.ts" --include="*.tsx" .
```

- [ ] All above = zero results
- [ ] Audit by: ________________ Date: ________________

### G. Sign-off Decision

```
[ ] WAVE 3 APPROVED
    Full sales cycle demonstrated with real backend.
    Wave 4 (Finance + Owners + Clients) may begin.

[ ] WAVE 3 APPROVED WITH CONDITIONS
    Conditions: _______________
    Must resolve by: _______________

[ ] WAVE 3 NOT APPROVED
    Blockers: _______________
    Wave 4 BLOCKED.
```

**Signed off by:** ______________ **Date:** ______________

---

# Wave 3 — Final Summary

| Track | # | Ticket | Key Deliverable |
|---|---|---|---|
| A | 1 | FE-3-CRM-01 | CRM service + types (10 statuses, id, leadStatus) |
| A | 2 | FE-3-CRM-02 | CRM Pipeline kanban board |
| A | 3 | FE-3-CRM-03 | Lead Card (masked phone, days counter, source badge) |
| A | 4 | FE-3-CRM-04 | Lead Detail page shell |
| A | 5 | FE-3-CRM-05 | Status transitions (VALID_TRANSITIONS, PascalCase) |
| A | 6 | FE-3-CRM-06 | Lead Notes (add/edit/delete) |
| A | 7 | FE-3-CRM-07 | Lead Assignment (assign/unassign) |
| A | 8 | FE-3-CRM-08 | Create Lead form (admin-initiated, source=PhoneCall) |
| A | 9 | FE-3-CRM-09 | Convert to Booking (required payload, redirect to booking id) |
| B | 10 | FE-3-BOOK-01 | Bookings service + types (6 statuses, payment/invoice types) |
| B | 11 | FE-3-BOOK-02 | Bookings list (filters, pagination, statusBadge) |
| B | 12 | FE-3-BOOK-03 | Booking Detail page (header + client + finance summary) |
| B | 13 | FE-3-BOOK-04 | Lifecycle actions (confirm/cancel/complete — cancel needs reason) |
| B | 14 | FE-3-BOOK-05 | Record Payment (PascalCase type+method, finance snapshot refresh) |
| B | 15 | FE-3-BOOK-06 | Invoice management (Draft→Issue→Cancel, PDF download) |
| B | 16 | FE-3-BOOK-07 | Finance Snapshot (7 fields, outstanding amount highlighting) |
| B | 17 | FE-3-BOOK-08 | Booking Notes + Assignment |
| B | 18 | FE-3-BOOK-09 | Status History timeline |

**"Earliest something working" milestone:** End of Wave 3 — full sale cycle demonstrable.

**Next Wave:** Wave 4 — Finance + Owners + Clients (16 tickets, 3 parallel tracks).

*End of Wave 3 ticket pack.*
