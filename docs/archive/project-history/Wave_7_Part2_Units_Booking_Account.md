# Wave 7 — Guest App
## Part 2: Units + Booking Flow + Client Account + QA + PM
**Continues from Wave_7_Part1_Infrastructure_Landing.md**
**Tickets: FE-7-UNITS-01..03, FE-7-BOOK-01..04, FE-7-ACC-01..04**

---

## Units Tickets (FE-7-UNITS-01 → 03)

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TICKET ID: FE-7-UNITS-01
TITLE: Build Units search/listing page
WAVE: Wave 7 — Guest App
DOMAIN: GuestApp / Units
PRIORITY: Critical
DEPENDS ON: FE-7-INFRA-01, FE-7-INFRA-03, FE-7-LP-06 (UnitCard component)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section 1 — Walkthrough

**What is this ticket about?**
The units listing page at `/units` is where visitors browse available properties. `GET /api/units` supports pagination plus public catalog filters for project, unit type, guests, price, amenities, search, and safe sort keys.

---

### Section 2 — Objective

Build the units listing page at `/units` using `GET /api/units` with documented pagination and filters, URL sync, and the `<UnitCard>` component (from FE-7-LP-06).

---

### Section 4 — In Scope

- [ ] `app/(public)/units/page.tsx`
- [ ] **Documented query params:** `page`, `pageSize`, `projectId`, `unitType`, `minGuests`, `minPrice`, `maxPrice`, `search`, `sortBy`, and repeated `amenityIds`.
- [ ] **Results grid:** `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`
- [ ] **URL sync:** `useSearchParams()` + `router.push()` on filter change
- [ ] **Pagination:** Prev/Next + page numbers
- [ ] **Results count:** "Showing 12 of 48 properties"
- [ ] URL query params pre-populated from Hero search (reads them on mount)
- [ ] Sort options: newest arrivals, price low to high, price high to low.
- [ ] Empty state: "No properties match your filters" + "Clear all filters" button
- [ ] Loading: 6 UnitCard skeletons

**Files to create:**
- `app/(public)/units/page.tsx`
- `components/public/search/UnitFilters.tsx`
- `components/public/search/SortSelect.tsx`

---

### Section 6 — Technical Contract

```typescript
// Hook:
export function usePublicUnits(filters: PublicUnitFilters) {
  return useQuery({
    queryKey:        queryKeys.units.publicList(filters),
    queryFn:         () => publicService.getUnits(filters),
    staleTime:       1000 * 60 * 5,
    placeholderData: keepPreviousData,
  })
}
```

---

### Section 7 — API Integration

| Method | Endpoint | Query | Response | When |
|---|---|---|---|---|
| GET | `/api/units` | documented params (`page`, `pageSize`) | `PaginatedPublicUnits` | on mount + page change |
| GET | `/api/projects` | — | `ProjectResponse[]` | on mount (for filter) |

**Documented query params sent to API:**
```
?page=1&pageSize=12
```

---

### Section 10 — UX & Loading State Rules

| State | Required? | Behavior |
|---|---|---|
| Loading | ✓ REQUIRED | 6 `<UnitCard>` skeletons in same grid layout |
| Empty | ✓ REQUIRED | EmptyState + "Clear filters" button that resets all params |
| Pagination | ✓ REQUIRED | "Showing X–Y of totalCount properties" + Pagination component |
| Filter change | ✓ REQUIRED | `keepPreviousData: true` — no flash to loading state |

---

### Section 12 — Acceptance Criteria

- [ ] Filters from hero search pre-populate from URL params on page load
- [ ] All filter changes update URL params (shprojectble links)
- [ ] `unit.id` used for card navigation (public API field is `id`)
- [ ] Advanced sort options treated as backend gap until API documents sort params
- [ ] `keepPreviousData: true` for smooth pagination
- [ ] `totalCount` + `totalPages` from pagination used
- [ ] `<UnitCard>` reused from FE-7-LP-06
- [ ] No mock data

---

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TICKET ID: FE-7-UNITS-02
TITLE: Build Unit Detail page
WAVE: Wave 7 — Guest App
DOMAIN: GuestApp / Units
PRIORITY: Critical
DEPENDS ON: FE-7-INFRA-01, FE-7-INFRA-02, FE-7-INFRA-03
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section 1 — Walkthrough

**What is this ticket about?**
The unit detail page at `/units/{id}` is where a visitor decides whether to book. It shows: image gallery (fullscreen), unit name + project reference, unitType + maxGuests, full description, amenities list, pricing calculator, availability calendar (read-only), and reviews section. The sticky "Book Now" CTA panel on the right drives the conversion.

**Note from validation report:** This was identified as the highest-risk ticket in the entire implementation (`FE-3-BOOK-02` equivalent in Guest App context). Multiple API calls, complex layout.

---

### Section 4 — In Scope

- [ ] `app/(public)/units/[id]/page.tsx`
- [ ] **Gallery section:** first image full-width, rest as thumbnails below. Click opens fullscreen. (FE-7-UNITS-03)
- [ ] **Info section:**
  - Unit name (`font-display text-h1`)
  - Project reference + unitType badge + maxGuests
  - Tagline/description (full text)
  - Amenities grid: icon + name for each
- [ ] **Sticky booking panel (right side, desktop):**
  - "From {price}/night" base price
  - Check-in / Check-out DateRangePicker
  - Guest count selector
  - Dynamic pricing: calls `POST /api/units/{id}/pricing/calculate` when dates selected
  - Shows: nights count, nightly breakdown (accordion), total amount
  - "Book Now" button → navigates to `/units/{id}/book`
  - "Check Availability" button → shows `isAvailable` + unavailable dates highlighted
- [ ] **Reviews section:** average rating + bar chart + list (FE-7-LP-09 testimonial card reused)
- [ ] `useImageReveal()` on main image, `useFadeUp()` on info section
- [ ] Loading: skeleton for the page (heading + gallery + info sections)
- [ ] 404: unit not found or not active → `<EmptyState>`

**Files to create:**
- `app/(public)/units/[id]/page.tsx`
- `components/public/unit/UnitDetailInfo.tsx`
- `components/public/unit/UnitBookingPanel.tsx`
- `components/public/unit/UnitAmenitiesGrid.tsx`
- `components/public/unit/UnitReviewsSection.tsx`
- `components/public/unit/PricingBreakdown.tsx`

---

### Section 7 — API Integration

| Method | Endpoint | Response | When |
|---|---|---|---|
| GET | `/api/units/{id}` | `PublicUnitDetail` | on mount |
| GET | `/api/units/{unitId}/amenities` | `UnitAmenityResponse[]` | on mount |
| GET | `/api/public/units/{unitId}/reviews` | `PublishedReviewListItemResponse[]` | on mount |
| GET | `/api/public/units/{unitId}/reviews/summary` | `UnitPublishedReviewSummaryResponse` | on mount |
| POST | `/api/units/{unitId}/pricing/calculate` | `UnitPricingResponse` | when checkIn+checkOut selected |
| POST | `/api/units/{unitId}/availability/operational-check` | `OperationalAvailabilityResponse` | when "Check Availability" clicked |

**Type reuse note:** reuse corrected public review contracts from Wave 5 (`PublishedReviewListItemResponse`, `UnitPublishedReviewSummaryResponse`) without redefining local variants.

```typescript
// Pricing hook:
export function usePricingCalculate(
  unitId: string,
  checkIn: string | null,
  checkOut: string | null
) {
  return useQuery({
    queryKey: queryKeys.units.pricing(unitId, { checkIn, checkOut }),
    queryFn:  () => publicService.calculatePricing(unitId, checkIn!, checkOut!),
    enabled:  Boolean(checkIn && checkOut),
    staleTime: 0,   // pricing is time-sensitive
  })
}
```

---

### Section 10 — UX & Loading State Rules

| State | Required? | Behavior |
|---|---|---|
| Loading | ✓ REQUIRED | Skeleton: gallery placeholder + heading skeleton + booking panel skeleton |
| 404 | ✓ REQUIRED | EmptyState "Property not found" + "Browse all properties" link |
| Dates not selected | ✓ REQUIRED | Booking panel shows "Select dates to see price" |
| Dates selected, calculating | ✓ REQUIRED | Pricing project shows spinner while calculating |
| Not available | ✓ REQUIRED | "Not available for selected dates" + red indicator |

---

### Section 12 — Acceptance Criteria

- [ ] `unit.id` used (not `unit.unitId` — public API field)
- [ ] Pricing calculation: `enabled: Boolean(checkIn && checkOut)` — not called without dates
- [ ] `UnitPricingResponse.totalAmount` displayed with `formatCurrency()`
- [ ] `UnitPricingResponse.nightlyBreakdown` shown in expandable accordion
- [ ] Reviews section shows `review.title` (not just comment)
- [ ] "Book Now" disabled if no dates selected
- [ ] Sticky booking panel on desktop, bottom-fixed on mobile
- [ ] No mock data (no hardcoded pricing, no placeholder unit details)

---

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TICKET ID: FE-7-UNITS-03
TITLE: Build Unit Detail image gallery
WAVE: Wave 7 — Guest App
DOMAIN: GuestApp / Units
PRIORITY: High
DEPENDS ON: FE-7-UNITS-02
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section 1 — Walkthrough

**What is this ticket about?**
The unit images gallery on the detail page: primary image large at top, thumbnail strip below, and a fullscreen lightbox on click. The `<ImageReveal>` animation plays on the primary image as it enters the viewport.

---

### Section 4 — In Scope

- [ ] `components/public/unit/UnitGallery.tsx`
- [ ] Primary image: `next/image` with `fill` + `object-cover`, `useImageReveal()` on scroll
- [ ] Thumbnail strip: scrollable horizontally, `next/image` per thumbnail
- [ ] Click primary or thumbnail → opens fullscreen lightbox (`<GalleryLightbox>`)
- [ ] Lightbox: keyboard navigation (← → arrows + Escape), swipe on touch, close button
- [ ] Loaded with images from `GET /api/units/{unitId}/images` (already fetched by parent page)
- [ ] Gallery image source uses `fileKey` from unit images API response
- [ ] Cover image first, then remaining in `displayOrder`

**Files to create:**
- `components/public/unit/UnitGallery.tsx`
- `components/public/unit/GalleryLightbox.tsx`

---

### Section 12 — Acceptance Criteria

- [ ] Images sorted by `displayOrder` with cover image first
- [ ] `next/image` for all images (no `<img>` tags)
- [ ] Lightbox: Escape closes, arrow keys navigate
- [ ] Touch swipe supported in lightbox
- [ ] `useImageReveal()` on primary image
- [ ] No mock data (images from API)

---

---

## Booking Flow Tickets (FE-7-BOOK-01 → 04)

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TICKET ID: FE-7-BOOK-01
TITLE: Build Booking form (dates + guests + pricing summary)
WAVE: Wave 7 — Guest App
DOMAIN: GuestApp / Booking
PRIORITY: Critical
DEPENDS ON: FE-7-UNITS-02, FE-7-INFRA-01
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section 1 — Walkthrough

**What is this ticket about?**
The booking page at `/units/{id}/book` is a multi-step form:
1. **Step 1:** Confirm dates, guest count, see pricing breakdown
2. **Step 2:** Enter contact details (or log in if already have account)
3. **Step 3:** Review summary + submit

This ticket builds Step 1 and the overall page structure. Steps 2-3 are in FE-7-BOOK-02 and FE-7-BOOK-03.

**Business Rule:** The form creates a CRM Lead (not a formal booking). The Sales team then contacts the client and converts it to a formal booking. This is the "Website" source booking flow.

---

### Section 4 — In Scope

- [ ] `app/(public)/units/[id]/book/page.tsx`
- [ ] Multi-step progress indicator (Step 1/3 → 2/3 → 3/3)
- [ ] **Step 1 — Booking Details:**
  - Unit summary card (image, name, project, type, price/night)
  - Date confirmation (pre-filled from URL params or editable DateRangePicker)
  - Guest count selector
  - Availability check: `POST /api/units/{id}/availability/operational-check`
  - Pricing summary: `POST /api/units/{id}/pricing/calculate`
  - Nights count, nightly breakdown, total
  - "Continue" button → only enabled if dates + guests filled and unit is available

**Files to create:**
- `app/(public)/units/[id]/book/page.tsx`
- `components/public/booking/BookingProgress.tsx`
- `components/public/booking/BookingStep1Details.tsx`
- `components/public/booking/BookingPricingSummary.tsx`

---

### Section 7 — API Integration

| Method | Endpoint | Request | Response | When |
|---|---|---|---|---|
| GET | `/api/units/{id}` | — | `PublicUnitDetail` | on mount (unit summary) |
| POST | `/api/units/{id}/availability/operational-check` | `{ startDate, endDate }` | `OperationalAvailabilityResponse` | when dates selected |
| POST | `/api/units/{id}/pricing/calculate` | `{ startDate, endDate }` | `UnitPricingResponse` | when dates selected |

---

### Section 12 — Acceptance Criteria

- [ ] Dates pre-populated from URL params (`?checkIn=...&checkOut=...&guests=...`)
- [ ] Availability checked before allowing "Continue"
- [ ] Not available → error message + cannot proceed
- [ ] Pricing shown: nights × price + any seasonal adjustments
- [ ] `formatCurrency()` on all money values
- [ ] "Continue" disabled until: dates set, guests set, availability confirmed
- [ ] No mock data (real availability + pricing from API)

---

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TICKET ID: FE-7-BOOK-02
TITLE: Build Inline client registration/login (seamless)
WAVE: Wave 7 — Guest App
DOMAIN: GuestApp / Booking
PRIORITY: Critical
DEPENDS ON: FE-7-BOOK-01, FE-1-AUTH-03, FE-1-AUTH-04
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section 1 — Walkthrough

**What is this ticket about?**
Step 2 of the booking form — the "seamless" registration per the PRD (frozen decision #8): clients create an account INSIDE the booking form, without being redirected away. If already logged in, Step 2 is skipped. If logged in as admin/owner, show an error.

**PRD Decision #8:** "Browse as guest, create account inside booking form (phone required, email optional, password required). Seamless — no separate signup screen."

---

### Section 4 — In Scope

- [ ] `components/public/booking/BookingStep2Contact.tsx`
- [ ] **If user is already logged in as client:** Step 2 auto-skipped. Shows "Booking as: {identifier}" + "Continue" button.
- [ ] **If user is NOT logged in:** Two tabs — "New to the platform" and "Already have an account"
  - **New:** Name (required), Phone (required), Email (optional), Password (min 8 chars)
  - **Existing:** Phone + Password
- [ ] On register (new): `POST /api/auth/client/register` → then auto `POST /api/auth/client/login` (same as FE-1-AUTH-04)
- [ ] On login (existing): `POST /api/auth/client/login`
- [ ] On success: auth store populated → proceed to Step 3
- [ ] If logged in as Admin or Owner: show error "Please log out of your admin/owner account to continue as a client"
- [ ] `useAuthStore().subjectType` determines which tab is shown

**Files to create:**
- `components/public/booking/BookingStep2Contact.tsx`
- `components/public/booking/InlineRegisterForm.tsx`
- `components/public/booking/InlineLoginForm.tsx`

---

### Section 6 — Technical Contract

```typescript
// Step 2 logic:
const { subjectType, user } = useAuthStore()

if (subjectType === 'Client') {
  // Already logged in → auto-skip this step
  return <AlreadyLoggedIn identifier={user.identifier} onContinue={goToStep3} />
}

if (subjectType === 'Admin' || subjectType === 'Owner') {
  return <WrongAccountError />
}

// Anonymous → show tabs
return <RegisterOrLoginTabs />
```

---

### Section 7 — API Integration

| Method | Endpoint | Request | Response | When |
|---|---|---|---|---|
| POST | `/api/auth/client/register` | `ClientRegisterRequest` | `ClientProfileResponse` | on new register |
| POST | `/api/auth/client/login` | `PhoneLoginRequest` | `AuthResponse` | after register OR on existing login |

**CRITICAL:** After register, auto-login with same phone+password (same pattern as FE-1-AUTH-04). No intermediate screen.

---

### Section 12 — Acceptance Criteria

- [ ] Already-logged-in client → Step 2 auto-skipped
- [ ] Admin/Owner token → error message shown, cannot proceed
- [ ] Register then auto-login (2 API calls, seamless)
- [ ] Existing client login: `{ phone, password }` (NOT email)
- [ ] Auth store populated after login
- [ ] `email` sent as `undefined` (not `""`) when not filled
- [ ] No mock data

---

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TICKET ID: FE-7-BOOK-03
TITLE: Build Booking confirmation page
WAVE: Wave 7 — Guest App
DOMAIN: GuestApp / Booking
PRIORITY: Critical
DEPENDS ON: FE-7-BOOK-01, FE-7-BOOK-02, FE-7-BOOK-04
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section 1 — Walkthrough

**What is this ticket about?**
Step 3 — the final review and submission step. Shows a complete summary: unit, dates, guests, pricing, and client info. The client confirms by clicking "Submit Booking Request". This calls `POST /api/crm/leads` (the public lead creation endpoint) — NOT `POST /api/internal/bookings`. The lead goes into the Sales pipeline at `Prospecting` status, and Sales will follow up.

**Important:** This does NOT create a formal booking. It creates a CRM lead. The Sales team contacts the client and converts it via the admin panel.

---

### Section 4 — In Scope

- [ ] `components/public/booking/BookingStep3Review.tsx`
- [ ] **Summary display:**
  - Unit: image, name, project, type
  - Dates: check-in, check-out, nights
  - Guests
  - Pricing: total amount, deposit note ("A deposit will be required upon confirmation")
  - Contact info: name, phone, email (from auth store or newly registered)
- [ ] **Submit button:** "Submit Booking Request" → calls CRM lead creation (FE-7-BOOK-04)
- [ ] On success → navigate to `/booking-confirmation` page
- [ ] `components/public/booking/BookingConfirmationPage.tsx`:
  - Success icon + "Request Submitted!" heading
  - "Our team will contact you within 24 hours" message
  - "Reference: {id}" if returned
  - "Browse more properties" link
  - "View my account" link → `ROUTES.client.account`

**Files to create:**
- `components/public/booking/BookingStep3Review.tsx`
- `app/(public)/booking-confirmation/page.tsx`

---

### Section 12 — Acceptance Criteria

- [ ] Summary shows all booking details (no fields missing)
- [ ] Deposit info: clear messaging that deposit is required later
- [ ] Submit calls CRM lead creation (FE-7-BOOK-04)
- [ ] Success: navigates to confirmation page
- [ ] Confirmation page shows returned `id` as reference number
- [ ] No mock data

---

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TICKET ID: FE-7-BOOK-04
TITLE: Build Public CRM Lead creation (booking form submission)
WAVE: Wave 7 — Guest App
DOMAIN: GuestApp / Booking
PRIORITY: Critical
DEPENDS ON: FE-7-BOOK-02, FE-7-INFRA-01
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section 1 — Walkthrough

**What is this ticket about?**
The actual API call that submits the booking request. Calls `POST /api/crm/leads` — the PUBLIC endpoint that creates a CRM lead in Prospecting status. No admin authentication needed (this is the public-facing endpoint). The client's auth token IS included in the request (they're logged in) but the endpoint accepts anonymous calls too.

---

### Section 4 — In Scope

- [ ] Create `useSubmitBookingRequest` hook in `lib/hooks/usePublic.ts`
- [ ] Calls `POST /api/crm/leads` with all booking details
- [ ] Handles 422 errors (e.g., dates conflict — though unlikely since availability was pre-checked)
- [ ] On success: returns CRM lead object (use `id` for confirmation reference)
- [ ] `source: 'Website'` (hardcoded — bookings from the web app are always "Website")

---

### Section 7 — API Integration

| Method | Endpoint | Request | Response | When |
|---|---|---|---|---|
| POST | `/api/crm/leads` | `PublicCreateCrmLeadRequest` | `PublicCreateCrmLeadResponse` | on "Submit Booking Request" |

```typescript
// PublicCreateCrmLeadRequest:
interface PublicCreateCrmLeadRequest {
  contactName:    string      // from auth store user OR from registration form
  contactPhone:   string      // from auth store user.identifier (owner/client = phone)
  contactEmail?:  string      // from auth store OR registration form
  targetUnitId:   string      // the unit being requested
  desiredCheckInDate:  string // ISO date from Step 1
  desiredCheckOutDate: string // ISO date from Step 1
  guestCount:     number      // from Step 1
  source:         'Website'   // ALWAYS 'Website' for public form
  notes?:         string
}

// IMPORTANT: source is PascalCase 'Website' (not 'website')
```

---

### Section 12 — Acceptance Criteria

- [ ] `source: 'Website'` (PascalCase) in every public booking request
- [ ] `contactPhone` = `user.identifier` from auth store (phone number for clients)
- [ ] Request includes `targetUnitId`, `desiredCheckInDate`, `desiredCheckOutDate`, `guestCount`
- [ ] On success: `id` returned and shown on confirmation page
- [ ] 422 error shown inline (dates conflict, unit unavailable)
- [ ] No mock data

---

---

## Client Account Tickets (FE-7-ACC-01 → 04)

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TICKET ID: FE-7-ACC-01
TITLE: Build Client account layout + dashboard
WAVE: Wave 7 — Guest App
DOMAIN: GuestApp / Account
PRIORITY: High
DEPENDS ON: FE-7-INFRA-03, FE-1-AUTH-03
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section 1 — Walkthrough

**What is this ticket about?**
Logged-in clients have a simple account workspace at `/account`. It has a minimal sidebar (Bookings, Reviews, Notifications, Logout) and a dashboard showing their recent bookings and notifications. Much simpler than the admin panel.

---

### Section 4 — In Scope

- [ ] `app/(public)/account/layout.tsx` — client account layout (sidebar + content)
- [ ] `app/(public)/account/page.tsx` — dashboard (recent bookings, unread notifications)
- [ ] `components/public/account/AccountSidebar.tsx`
  - Nav: My Bookings, Reviews, Notifications, Logout
- [ ] Dashboard: uses existing `bookingsService.getList({ page: 1, pageSize: 3 })` (client sees their own via auth)
  - **Backend gap:** No dedicated `/api/client/bookings` endpoint is documented, and using internal bookings endpoints for client account is not guaranteed by the API reference.
  - Keep account booking-history integration blocked until backend provides a documented client-scoped endpoint.
- [ ] Guard: `usePermissions().isClient` — redirect if not client

**Files to create:**
- `app/(public)/account/layout.tsx`
- `app/(public)/account/page.tsx`
- `components/public/account/AccountSidebar.tsx`

---

### Section 12 — Acceptance Criteria

- [ ] `isClient` check: non-client users cannot access `/account/*`
- [ ] Recent bookings shown with `bookingStatus` badge
- [ ] Logout redirects to `/auth/client/login` (because `subjectType === 'Client'`)
- [ ] No mock data

---

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TICKET ID: FE-7-ACC-02
TITLE: Build Client booking history
WAVE: Wave 7 — Guest App
DOMAIN: GuestApp / Account
PRIORITY: High
DEPENDS ON: FE-7-ACC-01, FE-3-BOOK-01 (bookings service)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section 1 — Walkthrough

**What is this ticket about?**
The client's booking history at `/account/bookings` — all their past and upcoming bookings. Each booking shows: unit name, dates, status, total amount (what they'll pay), and a "Write Review" button (visible only for Completed bookings 24h+ after checkout, if no review yet).

---

### Section 4 — In Scope

- [ ] `app/(public)/account/bookings/page.tsx`
- [ ] List of client's bookings
  - **Backend gap:** No documented `GET /api/client/bookings` (or equivalent client-scoped bookings list) in `KAZA_BOOKING_API_Reference.md`.
  - Do NOT use internal admin endpoints as a fallback in the client account.
  - Keep booking-history integration blocked until backend provides a documented client endpoint.
- [ ] Columns: Unit, Check-in, Check-out, Nights, Total Amount, Status badge, Actions
- [ ] Actions:
  - "Write Review" — visible only if: `bookingStatus === 'Completed'` AND 24h has passed AND no review yet
  - Check if review exists: `GET /api/client/reviews/by-booking/{bookingId}` — before showing button
- [ ] Status badge uses `FORMAL_BOOKING_STATUS_LABELS` (Pending → "Pending", Confirmed → "Confirmed", etc.)

**Files to create:**
- `app/(public)/account/bookings/page.tsx`
- `components/public/account/ClientBookingTable.tsx`

---

### Section 7 — API Integration

| Method | Endpoint | Response | When |
|---|---|---|---|
| GET | **Backend gap: missing client bookings endpoint** | — | blocked |
| GET | `/api/client/reviews/by-booking/{bookingId}` | `ReviewResponse` | before showing "Write Review" button |

---

### Section 12 — Acceptance Criteria

- [ ] Client booking list integration is marked as blocked until backend exposes documented client endpoint
- [ ] "Write Review" only shown for Completed bookings with no existing review
- [ ] `reviewsService.getByBooking()` called to check for existing review before showing button
- [ ] `bookingStatus` displayed via `FORMAL_BOOKING_STATUS_LABELS`
- [ ] When backend endpoint is added, use API response booking identifier exactly as documented
- [ ] `formatCurrency()` for total amount
- [ ] No mock data

---

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TICKET ID: FE-7-ACC-03
TITLE: Build Review submission flow
WAVE: Wave 7 — Guest App
DOMAIN: GuestApp / Account
PRIORITY: High
DEPENDS ON: FE-7-ACC-02, FE-5-REV-01 (reviews service)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section 1 — Walkthrough

**What is this ticket about?**
The review form at `/account/bookings/{bookingId}/review`. Client rates their stay (1-5 stars), writes a title and comment. Activated 24h after checkout per PRD (Decision #12). The form checks if a review already exists and pre-fills if editing.

---

### Section 4 — In Scope

- [ ] `app/(public)/account/bookings/[bookingId]/review/page.tsx`
- [ ] On mount: `GET /api/client/reviews/by-booking/{bookingId}` — check for existing review
  - If exists → pre-fill form (edit mode, uses `PUT /api/client/reviews/{reviewId}`)
  - If none → empty form (create mode, uses `POST /api/client/reviews`)
- [ ] Form fields:
  - Rating: 1-5 stars (interactive star selector, NOT a number input)
  - Title: Input, required
  - Comment: Textarea, optional
- [ ] On success: `toastSuccess('Review submitted!')` + redirect to `/account/bookings`
- [ ] Guard: booking must be in `Completed` status (redirect back if not)

**Files to create:**
- `app/(public)/account/bookings/[bookingId]/review/page.tsx`
- `components/public/account/ReviewForm.tsx`
- `components/public/account/StarRatingInput.tsx` — interactive star selector

---

### Section 6 — Technical Contract

```typescript
const reviewSchema = z.object({
  rating:  z.number().min(1, 'Please select a rating').max(5),
  title:   z.string().min(1, 'Title is required').max(200),
  comment: z.string().max(2000).optional(),
})

// CreateReviewRequest:
interface CreateReviewRequest {
  bookingId: string
  rating:    number    // 1-5
  title:     string    // REQUIRED — reviews have titles
  comment?:  string
}
```

---

### Section 7 — API Integration

| Method | Endpoint | Request | Response | When |
|---|---|---|---|---|
| GET | `/api/client/reviews/by-booking/{bookingId}` | — | `ReviewResponse` | on mount (check existing) |
| POST | `/api/client/reviews` | `CreateReviewRequest` | `ReviewResponse` | on create submit |
| PUT | `/api/client/reviews/{reviewId}` | `UpdatePendingReviewRequest` | `ReviewResponse` | on edit submit |

---

### Section 12 — Acceptance Criteria

- [ ] `GET /api/client/reviews/by-booking/{bookingId}` called on mount
- [ ] Existing review: form pre-fills, `PUT` used on submit
- [ ] No review: empty form, `POST` used on submit
- [ ] `review.title` is REQUIRED (not just rating + comment)
- [ ] Star rating: interactive selector (not a number input)
- [ ] Non-completed bookings: redirect back to bookings list
- [ ] No mock data

---

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TICKET ID: FE-7-ACC-04
TITLE: Build Client notification inbox
WAVE: Wave 7 — Guest App
DOMAIN: GuestApp / Account
PRIORITY: High
DEPENDS ON: FE-7-ACC-01, FE-5-NOT-01 (notifications service)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section 1 — Walkthrough

**What is this ticket about?**
Clients receive notifications: booking confirmation, check-in reminders, review request. This page shows their notification inbox — same pattern as admin and owner inboxes but using client-specific endpoints.

---

### Section 4 — In Scope

- [ ] `app/(public)/account/notifications/page.tsx`
- [ ] `GET /api/client/me/notifications/inbox`
- [ ] `POST /api/client/me/notifications/inbox/{notificationId}/read`
- [ ] Same display pattern: title, body, channel badge, timestamp, read/unread
- [ ] Bell indicator in `PublicNav`: polls `/api/client/me/notifications/inbox/summary` if logged in as client
- [ ] "Mark all as read" button

**Files to create:**
- `app/(public)/account/notifications/page.tsx`

**Files to modify:**
- `components/public/layout/PublicNav.tsx` — add notification bell if `isClient`

---

### Section 7 — API Integration

| Method | Endpoint | Response | When |
|---|---|---|---|
| GET | `/api/client/me/notifications/inbox` | `NotificationListItemResponse[]` | on mount |
| GET | `/api/client/me/notifications/inbox/summary` | `NotificationRecipientInboxSummaryResponse` | polled 2min |
| POST | `/api/client/me/notifications/inbox/{notificationId}/read` | void | on click |

---

### Section 12 — Acceptance Criteria

- [ ] Client-specific endpoint `/api/client/me/...` (not `/api/internal/me/...`)
- [ ] `notificationId` in mark-read URL
- [ ] Both inbox + summary invalidated after mark-read
- [ ] Bell in nav only shown when `isClient` is true
- [ ] No mock data

---

---

# Wave 7 — QA Prompt

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WAVE QA REVIEW PROMPT
Wave: 7 — Guest App
Tickets: FE-7-INFRA-01..03, FE-7-LP-01..10, FE-7-UNITS-01..03,
         FE-7-BOOK-01..04, FE-7-ACC-01..04
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You are a senior QA engineer reviewing Wave 7 — the Guest App.

## MOCK DATA AUDIT — HARD GATE

```bash
# Hardcoded unit/project names:
grep -rn "Palm Hills\|NEOM\|Ain Sokhna\|Ahmed Mohamed" \
  --include="*.ts" --include="*.tsx" components/public/ app/\(public\)/

# Hardcoded reviews:
grep -rn "Great stay\|Amazing villa\|Loved it\|5 stars" \
  --include="*.tsx" components/public/sections/TestimonialsSection.tsx

# Hardcoded prices:
grep -rn "1500 EGP\|2000 EGP\|basePricePerNight.*\d\d\d\d" \
  --include="*.tsx" components/public/

# Source case violations:
grep -rn "'website'\|source.*website" \
  --include="*.ts" --include="*.tsx" components/public/booking/
# Must be 'Website' (PascalCase)

grep -rn "pagination\.total[^C]" --include="*.ts" --include="*.tsx" .

# Heavy libraries imported at module level:
grep -rn "^import.*mapbox-gl\|^import.*gsap\|^import.*Swiper" \
  --include="*.tsx" components/public/ app/\(public\)/
# Must be dynamic() imports, NOT module-level imports
```

## CRITICAL CHECKS

### Animation + Performance:
- [ ] GSAP: `useGSAP()` used (never raw `useEffect + gsap.to()`)
- [ ] GSAP ScrollTrigger synced with `window.__lenis` via GsapProvider
- [ ] All animation hooks check `prefers-reduced-motion`
- [ ] Swiper: `dynamic({ ssr: false })` — NOT imported at module level
- [ ] Mapbox: `dynamic({ ssr: false })` — NOT imported at module level
- [ ] Recharts: NOT used in Guest App (only in Admin)
- [ ] `GsapProvider` in `app/(public)/layout.tsx` ONLY — not root layout
- [ ] No duplicate `<SmoothScrollProvider>` — already in root layout from Wave 0

### Design System:
- [ ] `bg-primary-500` (terracotta) used — NOT `bg-blue-500` or `bg-red-500`
- [ ] `font-display` (Playfair Display) on headings
- [ ] `shadow-card` + `shadow-card-hover` (warm-toned) on cards
- [ ] Gradient overlay: `rgba(13,11,10,...)` — warm black, NOT `rgba(0,0,0,...)`
- [ ] Container: `max-w-container` (1440px) — NOT `max-w-7xl` (1280px)

### API Contracts:
- [ ] Public unit fields: `unit.id` and `unit.name` (NOT `unitId`/`unitName`)
- [ ] `POST /api/crm/leads` for booking request (NOT `/api/internal/bookings`)
- [ ] `source: 'Website'` (PascalCase) in lead creation
- [ ] Review: `title` field REQUIRED in create request
- [ ] Client login: `{ phone, password }` (NOT email)
- [ ] After client register → auto-login (2 API calls, no intermediate screen)
- [ ] Availability check: POST method (not GET)
- [ ] Pricing calculate: POST method (not GET)
- [ ] `staleTime: 0` on availability + pricing queries

## PER-TICKET CHECKS

### FE-7-INFRA-01 — Public Service
- [ ] `PublicUnitListItem.id` (not `unitId`)
- [ ] `PublicCreateCrmLeadRequest.source: 'Website'` (PascalCase)

### FE-7-INFRA-02 — GSAP Setup
- [ ] GsapProvider syncs with Lenis
- [ ] All 6 animation hooks exist
- [ ] Each hook checks `prefers-reduced-motion`
- [ ] `useGSAP()` used, not `useEffect`

### FE-7-INFRA-03 — Public Nav
- [ ] Nav transparent → solid on scroll (80px threshold)
- [ ] Auth state correctly shows Login or Account link
- [ ] `GsapProvider` added to `(public)/layout.tsx`

### FE-7-LP-01 — Hero
- [ ] `next/image` with `fill` + `object-cover`
- [ ] GSAP timeline: 6 elements, fires once on mount
- [ ] `useTextReveal()` on heading
- [ ] `prefers-reduced-motion`: no carousel, no animation

### FE-7-LP-02 — Hero Search
- [ ] Projects from real API (not hardcoded)
- [ ] Glass morphism CSS correct
- [ ] checkOut > checkIn validation
- [ ] Submit → URL params to `/units`

### FE-7-LP-05 — Projects Section
- [ ] Project cards from real API
- [ ] Click → `/units` (project prefilter via query string is Backend Gap until documented for `GET /api/units`)

### FE-7-LP-06 — Featured Units
- [ ] Units from real API
- [ ] `unit.id` used for navigation
- [ ] Swiper: `dynamic({ ssr: false })`

### FE-7-LP-07 — Map
- [ ] Mapbox: `dynamic({ ssr: false })`
- [ ] `NEXT_PUBLIC_MAPBOX_TOKEN` from env (not hardcoded)
- [ ] Project markers from real API

### FE-7-LP-09 — Testimonials
- [ ] Review content from real API (no hardcoded text)
- [ ] `review.title` displayed
- [ ] Empty state if no reviews

### FE-7-UNITS-01 — Units Listing
- [ ] URL params sync (shprojectble links)
- [ ] Pre-populates from hero search
- [ ] `keepPreviousData: true`

### FE-7-UNITS-02 — Unit Detail
- [ ] 5+ API calls all fired
- [ ] Pricing `enabled: Boolean(checkIn && checkOut)`
- [ ] `staleTime: 0` on availability + pricing

### FE-7-BOOK-02 — Inline Registration
- [ ] Already-logged-in client → Step 2 skipped
- [ ] Admin/Owner → error message
- [ ] Register → auto-login (2 API calls)
- [ ] Login uses `phone` NOT `email`

### FE-7-BOOK-04 — CRM Lead
- [ ] `POST /api/crm/leads` (public endpoint)
- [ ] `source: 'Website'` (PascalCase)

### FE-7-ACC-03 — Review
- [ ] `GET /api/client/reviews/by-booking/{id}` checked first
- [ ] `review.title` required in form
- [ ] Star rating: interactive selector (not number input)
- [ ] Existing review: `PUT` used
- [ ] New review: `POST` used

### FE-7-ACC-04 — Client Notifications
- [ ] `/api/client/me/notifications/...` (not `/api/internal/me/...`)

## VISUAL QA (Manual — Must Test in Browser)

| Test | Expected |
|---|---|
| Hero loads on desktop | Cinematic full-viewport, Playfair Display heading, GSAP reveal |
| Scroll down hero | Nav transitions transparent → solid |
| Hero search: select dates + project → submit | Lands on /units with URL params pre-filled |
| Projects section: hover card | Overlay darkens, count slides up |
| Featured units: hover card | Lifts + image zooms + CTA appears |
| Map section loads | Markers visible, click → popup with project link |
| How It Works: scroll into view | Steps stagger in (if motion enabled) |
| Unit detail: select dates | Pricing calculates immediately |
| Unit detail: unavailable dates | Error shown, Book Now disabled |
| Booking form: anonymous user | Step 2 shows register + login tabs |
| Booking form: register new client | Auto-logs in, proceeds to Step 3 |
| Submit booking | Confirmation page with lead id shown |
| Client reviews booking after completion | Star selector + title field required |
| `prefers-reduced-motion` enabled | No GSAP, no carousel, no parallax |

## Architecture Check
- [ ] `next/image` used for ALL images (no `<img>` tags)
- [ ] No GSAP module-level imports in page files
- [ ] `pnpm type-check` → zero errors
- [ ] No mock data

## Wave 7 Sign-off Recommendation
[ ] APPROVED — Guest App launches!
[ ] CONDITIONAL — conditions: ...
[ ] BLOCKED — blockers: ...
```

---

---

# Wave 7 — PM Sign-off Checklist

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PM WAVE SIGN-OFF CHECKLIST
Wave: 7 — Guest App
Date: _______________
Reviewed by: _______________
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### A. QA Report Review
- [ ] QA report received, all BLOCKERs resolved
- [ ] MOCK DATA AUDIT PASSED — all grep commands returned zero
- [ ] Visual QA manually tested in browser

### B. Business Requirements Validation

**Complete end-to-end booking flow (test with real backend):**

| Step | Action | Expected | Tested | Pass |
|---|---|---|---|---|
| 1 | Anonymous visitor opens the website | Cinematic landing page loads, hero animation plays | | |
| 2 | Visitor browses projects section | Real projects from API shown as cards | | |
| 3 | Visitor clicks project card | Units listing filtered by that project | | |
| 4 | Visitor uses hero search (dates + guests) | Units listing with URL params pre-filled | | |
| 5 | Visitor clicks a unit | Unit detail page loads with real data | | |
| 6 | Visitor selects dates on unit detail | Pricing calculates from real API | | |
| 7 | Visitor clicks "Book Now" | Proceeds to booking form Step 1 | | |
| 8 | Visitor (anonymous) reaches Step 2 | Register + Login tabs shown | | |
| 9 | Visitor registers (name, phone, password) | Auto-logged in, proceeds to Step 3 | | |
| 10 | Visitor reviews summary + submits | CRM lead created, confirmation page shows lead id | | |
| 11 | Client logs in to /account | Sees their booking in history | | |
| 12 | Client submits a review (post-completion) | Review with title + rating + comment submitted | | |
| 13 | Admin sees the lead in CRM pipeline | Lead in Prospecting status, source = 'Website' | | |

### C. Design Review (Brand Quality Gate)

The Guest App must meet the luxury hospitality aesthetic:
- [ ] Playfair Display font visible on headings (NOT Roboto/Poppins)
- [ ] Terracotta primary color (`#E87651`) — NOT generic blue
- [ ] Warm-toned shadows (NOT cold gray `rgba(0,0,0,...)`)
- [ ] Container max-width 1440px (NOT 1280px)
- [ ] Glass morphism search bar on hero
- [ ] Hover effects on unit cards (lift + zoom + CTA)
- [ ] No "generic AI aesthetic" — matches Clone.md intent

### D. Animation Quality Gate (Desktop only)
- [ ] Hero GSAP timeline: 6 elements animate in sequence on load
- [ ] Text reveals: heading words slide up on scroll
- [ ] Parallax: image sections have depth on scroll
- [ ] Smooth scroll: Lenis enabled (not jerky native scroll)
- [ ] `prefers-reduced-motion`: all animations disabled when OS preference set

### E. Definition of Done
- [ ] `pnpm type-check` clean
- [ ] `pnpm lint` clean
- [ ] All 24 tickets merged
- [ ] Mock data audit passed
- [ ] `source: 'Website'` (PascalCase) verified in lead creation
- [ ] `review.title` required field confirmed
- [ ] `unit.id` (not `unitId`) in public API calls
- [ ] No module-level GSAP/Mapbox/Swiper imports

### F. Mock Data Final Audit
```bash
# All must return zero:
grep -rn "Palm Hills\|NEOM\|Ahmed Mohamed\|Loved it" \
  --include="*.tsx" components/public/ app/\(public\)/

grep -rn "^import.*gsap\|^import.*mapbox-gl\|^import.*Swiper" \
  --include="*.tsx" components/public/ app/\(public\)/

grep -rn "'website'\|source.*'website'" \
  --include="*.ts" --include="*.tsx" components/public/booking/

grep -rn "pagination\.total[^C]" --include="*.ts" --include="*.tsx" .
```
- [ ] All zero results
- [ ] Audit by: ____________ Date: ____________

### G. Sign-off Decision
```
[ ] WAVE 7 APPROVED
    Guest App live. Full platform functional.
    Wave 8 (Polish + Performance + QA) may begin.

[ ] WAVE 7 APPROVED WITH CONDITIONS
    Conditions: _______________

[ ] WAVE 7 NOT APPROVED
    Blockers: _______________
```
**Signed off by:** ______________ **Date:** ______________

---

# Wave 7 — Final Summary

| Group | # | Ticket | Key Deliverable |
|---|---|---|---|
| INFRA | 1 | FE-7-INFRA-01 | Public service layer (unit.id, source:'Website') |
| INFRA | 2 | FE-7-INFRA-02 | GSAP + Lenis sync + 6 animation hooks |
| INFRA | 3 | FE-7-INFRA-03 | Public nav (transparent→solid) + footer |
| LP | 4 | FE-7-LP-01 | Hero (GSAP timeline + SplitType + carousel) |
| LP | 5 | FE-7-LP-02 | Hero search (glass morphism + real projects) |
| LP | 6 | FE-7-LP-03 | Marquee banner (CSS infinite loop) |
| LP | 7 | FE-7-LP-04 | Brand story (parallax + text reveal) |
| LP | 8 | FE-7-LP-05 | Projects section (real projects, hover effects) |
| LP | 9 | FE-7-LP-06 | Featured units Swiper (UnitCard component) |
| LP | 10 | FE-7-LP-07 | Mapbox map (dynamic, NEXT_PUBLIC_MAPBOX_TOKEN) |
| LP | 11 | FE-7-LP-08 | How It Works (stagger animation) |
| LP | 12 | FE-7-LP-09 | Testimonials (real reviews, title field) |
| LP | 13 | FE-7-LP-10 | Newsletter CTA (parallax, no API) |
| Units | 14 | FE-7-UNITS-01 | Units listing (URL params sync, filters) |
| Units | 15 | FE-7-UNITS-02 | Unit detail (5 API calls, sticky booking panel) |
| Units | 16 | FE-7-UNITS-03 | Image gallery + lightbox |
| Booking | 17 | FE-7-BOOK-01 | Step 1: dates + pricing + availability |
| Booking | 18 | FE-7-BOOK-02 | Step 2: inline registration/login (seamless) |
| Booking | 19 | FE-7-BOOK-03 | Step 3: review + confirmation page |
| Booking | 20 | FE-7-BOOK-04 | CRM lead creation (POST /api/crm/leads, source:'Website') |
| Account | 21 | FE-7-ACC-01 | Client account layout + dashboard |
| Account | 22 | FE-7-ACC-02 | Booking history + "Write Review" button |
| Account | 23 | FE-7-ACC-03 | Review form (title required, star selector, check existing) |
| Account | 24 | FE-7-ACC-04 | Client notification inbox (/api/client/me/...) |

**Key Pitfalls Summary:**
- GSAP/Mapbox/Swiper → `dynamic({ ssr: false })` only
- `useGSAP()` not `useEffect + gsap`
- Public unit fields: `id` and `name` (not `unitId`/`unitName`)
- CRM lead: `source: 'Website'` (PascalCase)
- Client login: `phone` not email
- Review: `title` is required
- No module-level heavy library imports

**🎉 MILESTONE: Complete Platform — All 3 Apps Functional after Wave 7**

**Next Wave:** Wave 8 — Polish + Performance + QA (8 tickets) — the final wave.

*End of Wave 7 ticket pack.*
