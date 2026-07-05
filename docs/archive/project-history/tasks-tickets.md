```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WAVE QA REVIEW PROMPT
Wave: 7 — Guest App (FULL — Part 1 + Part 2)
Tickets: FE-7-INFRA-01..03, FE-7-LP-01..10, FE-7-UNITS-01..03,
         FE-7-BOOK-01..04, FE-7-ACC-01..04 (24 tickets)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You are a senior QA engineer reviewing Wave 7 — the Guest App.
This wave delivers the public-facing revenue-generating part of the platform.

## MOCK DATA AUDIT — HARD GATE

```bash
# ── Hardcoded unit/project/client names ──
grep -rn "Palm Hills\|NEOM\|Ain Sokhna\|Villa Sunset\|Chalet Blue\|Ahmed Mohamed\|Sara Mohamed" \
  --include="*.ts" --include="*.tsx" components/public/ app/\(public\)/
# ↑ Zero matches expected — all names from API

# ── Hardcoded reviews ──
grep -rn "Great stay\|Amazing villa\|Loved it\|5 stars\|mockReview\|fakeReview\|sampleReview" \
  --include="*.ts" --include="*.tsx" components/public/

# ── Hardcoded prices ──
grep -rn "1500 EGP\|2000 EGP\|basePricePerNight.*\d\d\d\d\|mockPricing\|fakePricing" \
  --include="*.ts" --include="*.tsx" components/public/

# ── External placeholder images ──
grep -rn "unsplash.com\|picsum.photos\|placeholder.com\|cloudinary.com" \
  --include="*.ts" --include="*.tsx" components/public/

# ── Hardcoded auth states ──
grep -rn "mockUser\|fakeToken\|isLoggedIn.*true\|isLoggedIn.*false" \
  --include="*.ts" --include="*.tsx" components/public/

# ── Source case violations (CRM lead) ──
grep -rn "'website'\|source.*'website'\|source.*=\"website\"" \
  --include="*.ts" --include="*.tsx" components/public/booking/ lib/api/services/public.service.ts
# Must be 'Website' (PascalCase)

# ── WRONG field names — P01 unit fields ──
grep -rn "unitName\|\.type.*UnitType\|\.capacity\b\|status.*UnitStatus" \
  --include="*.ts" --include="*.tsx" lib/types/public.types.ts lib/types/client.types.ts \
  lib/hooks/usePublic.ts lib/api/services/public.service.ts components/public/
# ↑ Zero matches expected. name/unitType/maxGuests/isActive only.

# ── WRONG field names — P02 images ──
grep -rn "imageUrl\|isPrimary" \
  --include="*.ts" --include="*.tsx" lib/types/ components/public/
# ↑ Zero matches expected — fileKey and isCover only

# ── WRONG field names — P04/P05 availability/pricing ──
grep -rn "checkInDate\|checkOutDate" \
  --include="*.ts" --include="*.tsx" lib/types/public.types.ts lib/hooks/usePublic.ts \
  lib/api/services/public.service.ts components/public/unit/ components/public/booking/
# ↑ Zero matches expected — startDate/endDate only

grep -rn "totalAmount.*pricing\|nightlyBreakdown" \
  --include="*.ts" --include="*.tsx" lib/types/ lib/hooks/ components/public/
# ↑ Zero matches expected — totalPrice and nights[] per P05

# ── WRONG field names — P06 CRM lead ──
grep -rn "unitId.*lead\|checkInDate.*lead\|checkOutDate.*lead\|numberOfGuests\|leadId\b" \
  --include="*.ts" --include="*.tsx" lib/types/ lib/api/services/ lib/hooks/usePublic.ts \
  components/public/booking/
# ↑ Zero matches expected. targetUnitId/desiredCheckInDate/desiredCheckOutDate/guestCount/id only.

# ── WRONG field names — P10 booking ──
grep -rn "bookingId\b.*type\|numberOfGuests\|totalAmount.*booking\|assignedToUserId\|assignedToName\|\.status.*booking" \
  --include="*.ts" --include="*.tsx" lib/types/client.types.ts components/public/account/
# ↑ Zero matches expected. id/guestCount/finalAmount/bookingStatus/assignedAdminUserId only.

# ── WRONG field names — P22/P23 reviews ──
grep -rn "totalReviews\|ratingBreakdown\|clientName.*review" \
  --include="*.ts" --include="*.tsx" lib/types/public.types.ts components/public/
# ↑ Zero matches expected

# ── WRONG field names — P27 notifications ──
grep -rn "\.title.*notification\|isRead.*boolean\|\.title.*notif" \
  --include="*.ts" --include="*.tsx" lib/types/ components/public/
# ↑ Zero matches expected. subject/readAt/notificationStatus/createdAt only.

# ── Pagination field names ──
grep -rn "pagination\.total[^C]\|\.pages\b" \
  --include="*.ts" --include="*.tsx" lib/ components/public/
# ↑ Zero matches for .total (must be .totalCount) or .pages (must be .totalPages)

# ── Auth anti-patterns ──
grep -rn "localStorage\|sessionStorage" \
  --include="*.ts" --include="*.tsx" components/public/ lib/stores/
# ↑ Zero matches expected — tokens in Zustand memory only

# ── Internal API calls from public pages ──
grep -rn "/api/internal/" \
  --include="*.ts" --include="*.tsx" components/public/ app/\(public\)/
# ↑ Zero matches expected — public + client endpoints only

# ── Heavy libraries imported at module level ──
grep -rn "^import.*mapbox-gl\|^import.*gsap\|^import.*Swiper\|^import.*Recharts" \
  --include="*.tsx" components/public/ app/\(public\)/
# Must be dynamic() imports, NOT module-level imports
# Exception: gsap imported in hooks (not sections), GsapProvider handles registration.

# ── Swiper CSS not global ──
grep -rn "swiper/css" --include="*.tsx" --include="*.ts" app/ lib/
# ↑ Should ONLY appear in FeaturedUnitsCarousel.tsx and TestimonialsCarousel.tsx

# ── Mapbox CSS not global ──
grep -rn "mapbox-gl/dist" --include="*.tsx" --include="*.ts" app/ lib/
# ↑ Should ONLY appear in UnitsMap.tsx

# ── No inline endpoint strings ──
grep -rn "'/api/\|\"\/api\/" \
  --include="*.ts" --include="*.tsx" components/public/ lib/hooks/usePublic.ts \
  lib/hooks/useClient.ts lib/api/services/client.service.ts
# ↑ Zero matches expected — all endpoints from endpoints.ts

# ── motion-safe pattern ──
grep -rn "className.*opacity-0" --include="*.tsx" components/public/
# ↑ Every match should be "motion-safe:opacity-0", NOT bare "opacity-0"

# ── prefers-reduced-motion checked ──
grep -rn "prefers-reduced-motion" --include="*.ts" lib/hooks/animations/
# ↑ Should appear in ALL 6 hook files

# ── useGSAP used (not raw useEffect + gsap) ──
grep -rn "useEffect.*gsap\.\|useEffect.*ScrollTrigger" \
  --include="*.ts" --include="*.tsx" lib/hooks/animations/
# ↑ Zero matches expected — all hooks use useGSAP()
# Exception: GsapProvider uses useEffect for Lenis sync (this is correct)
```

## API CONTRACT VERIFICATION

### Public Unit Types (P01, P30):

- [ ]  `PublicUnitListItem.id` used (NOT `unitId` — that’s owner portal P30)
- [ ]  `PublicUnitListItem.name` used (NOT `unitName` — that’s owner portal P30)
- [ ]  `PublicUnitListItem.maxGuests` used (NOT `capacity` or `numberOfGuests`)
- [ ]  `PublicUnitListItem.isActive` is `boolean` (NOT `status: UnitStatus`)
- [ ]  `PublicUnitListItem.bedrooms` and `bathrooms` present
- [ ]  `PublicUnitDetail` extends list with `description`, `address`, `updatedAt`
- [ ]  `unitType` values lowercase: `'villa'` | `'chalet'` | `'studio'`

### Unit Images (P02):

- [ ]  `UnitImage.fileKey` used (NOT `imageUrl`)
- [ ]  Image URL built from `${NEXT_PUBLIC_STORAGE_URL}/${fileKey}`
- [ ]  `isCover` used (NOT `isPrimary`)
- [ ]  Images sorted by `isCover: true` first, then `displayOrder`
- [ ]  Placeholder image when no images: `/images/placeholder-unit.jpg`
- [ ]  `next/image` used for ALL images (no `<img>` tags)
- [ ]  Storage domain in `next.config.ts` `images.remotePatterns`

### Availability Check (P04):

- [ ]  Request body: `{ startDate, endDate }` (NOT `checkInDate`/`checkOutDate`)
- [ ]  Response: `blockedDates: string[]` (FLAT ARRAY — NOT objects)
- [ ]  NO `conflictingBookings` referenced anywhere
- [ ]  NO `applicablePricing` referenced anywhere
- [ ]  `staleTime: 0` on availability query
- [ ]  POST method used (not GET)

### Pricing Calculate (P05):

- [ ]  Request body: `{ startDate, endDate }` (NOT `checkInDate`/`checkOutDate`)
- [ ]  Response: `totalPrice` used (NOT `totalAmount`)
- [ ]  Response: `nights[]` used (NOT `nightlyBreakdown`)
- [ ]  Each night: `{ date, pricePerNight, priceSource }` (NOT `price`)
- [ ]  `staleTime: 0` on pricing query
- [ ]  `enabled: Boolean(startDate && endDate)` — not called without dates
- [ ]  POST method used (not GET)

### CRM Lead — Booking Submission (P06):

- [ ]  Request: `targetUnitId` (NOT `unitId`)
- [ ]  Request: `desiredCheckInDate`/`desiredCheckOutDate` (NOT `checkInDate`/`checkOutDate`)
- [ ]  Request: `guestCount` (NOT `numberOfGuests`)
- [ ]  Request: `contactName`, `contactPhone`, `contactEmail`
- [ ]  Request: `clientId` included when logged in
- [ ]  Request: `source: 'Website'` (PascalCase — NOT `'website'`)
- [ ]  Response: `id` (NOT `leadId`)
- [ ]  Response: `leadStatus` (NOT `status`)
- [ ]  Endpoint: `POST /api/crm/leads` (public, NOT `/api/internal/bookings`)
- [ ]  Button text: “Submit Booking Request” (NOT “Confirm Booking”)
- [ ]  Success heading: “Request Submitted!” (NOT “Booking Confirmed!”)

### Public Reviews (P22, P23):

- [ ]  `PublishedReviewListItem.reviewId` used (NOT `id`)
- [ ]  `PublishedReviewListItem` has NO `clientName` field
- [ ]  `PublicReviewSummary.publishedReviewCount` used (NOT `totalReviews`)
- [ ]  NO `ratingBreakdown` field in summary
- [ ]  Testimonial cards use “Verified Guest” attribution

### Client Reviews (API §22):

- [ ]  Create: `{ bookingId, rating, title, comment? }` — `title` REQUIRED
- [ ]  Update: `{ rating, title, comment }` — NO `bookingId` in update
- [ ]  Response: `reviewStatus` field present
- [ ]  Edit only allowed when `reviewStatus === 'Pending'`
- [ ]  Check existing: `GET /api/client/reviews/by-booking/{bookingId}`

### Client Auth (API §1):

- [ ]  Client login: `{ phone, password }` (NOT `{ email, password }`)
- [ ]  Register response: profile ONLY — NO `accessToken`
- [ ]  Auto-login after register: `POST /api/auth/client/login` called immediately
- [ ]  `POST /api/auth/logout` called BEFORE `clearAuth()` on logout
- [ ]  Tokens in Zustand memory only (never localStorage)

### Booking Fields (P10):

- [ ]  `id` used (NOT `bookingId`)
- [ ]  `guestCount` used (NOT `numberOfGuests`)
- [ ]  `bookingStatus` used (NOT `status`)
- [ ]  `finalAmount` used (NOT `totalAmount`)
- [ ]  Flat `unitId`/`clientId` (NOT nested objects)

### Notifications (P27):

- [ ]  `subject` used (NOT `title`)
- [ ]  `readAt: string | null` used (NOT `isRead: boolean`)
- [ ]  `notificationStatus` and `createdAt` present
- [ ]  Unread check: `readAt === null`
- [ ]  Client inbox: `/api/client/me/notifications/inbox` (NOT `/api/internal/me/...`)

### Public Unit Filters (P34):

- [ ]  `PublicUnitFilters` only has `page` + `pageSize` (documented params)
- [ ]  URL params `projectId`, `checkIn`, `checkOut`, `guests` are router-level only
- [ ]  ⚠️ Backend confirmation needed for server-side filtering

### Pagination:

- [ ]  `totalCount` and `totalPages` used (NOT `total`, `count`, `pages`)
- [ ]  `keepPreviousData` (TanStack v5 `placeholderData: keepPreviousData` syntax)

## PER-TICKET CHECKS — PART 1 (VALIDATED ✅)

### FE-7-INFRA-01 — Public Service Layer + Types

- [ ]  `PublicUnitListItem` has all 11 fields per API §5
- [ ]  `PublicUnitDetail` has all 13 fields per API §5
- [ ]  `PublishedReviewListItem` has all 8 fields per API §23 (including `reviewId`)
- [ ]  `PublicReviewSummary` has 4 fields: `unitId`, `publishedReviewCount`, `averageRating`, `lastReviewPublishedAt`
- [ ]  `PublicCreateCrmLeadRequest` has all 10 fields per API §13
- [ ]  `PublicCreateCrmLeadResponse` has all 16 fields per API §13
- [ ]  `publicService` has 11 methods covering all public endpoints
- [ ]  `usePublic.ts` has 8 query hooks + 3 mutation hooks
- [ ]  `getUnitReviews` supports pagination params (`page`, `pageSize`)
- [ ]  All hooks use `enabled: !!id` where appropriate
- [ ]  Barrel export in `lib/types/index.ts` updated
- [ ]  Zero `any` types

### FE-7-INFRA-02 — GSAP + Animation Hooks

- [ ]  `GsapProvider` registers `ScrollTrigger` + `useGSAP` plugins
- [ ]  `GsapProvider` syncs with `window.__lenis` via `ScrollTrigger.scrollerProxy`
- [ ]  Lenis scroll listener cleaned up on unmount
- [ ]  6 hooks: `useFadeUp`, `useImageReveal`, `useParallax`, `useTextReveal`, `useStaggerCards`, `useHeroTimeline`
- [ ]  ALL 6 hooks use `useGSAP()` (NOT raw `useEffect` + `gsap`)
- [ ]  ALL 6 hooks check `prefers-reduced-motion` and skip if true
- [ ]  `useTextReveal` calls `split.revert()` in cleanup
- [ ]  `useParallax` skips on touch devices
- [ ]  `useHeroTimeline` fires on mount (NOT scroll-triggered)
- [ ]  `useStaggerCards` animates direct children of ref container
- [ ]  `GsapProvider` in `app/(public)/layout.tsx` only (NOT root layout)
- [ ]  Barrel export from `lib/hooks/animations/index.ts`

### FE-7-INFRA-03 — Public Nav + Footer

- [ ]  Nav: `fixed top-0 z-50`, transparent → solid at `scrollY > 80`
- [ ]  Transition: `duration-300` with `ease-out-quart`
- [ ]  Scroll reads from `window.__lenis?.scroll` with native fallback
- [ ]  Both scroll listeners cleaned up on unmount
- [ ]  Auth from `useAuthStore()` (not context/props)
- [ ]  Not logged in: “Login” + “Register” | Logged in: “My Account”
- [ ]  Mobile hamburger → `MobileMenu` → closes on route change
- [ ]  `GsapProvider` wraps public layout
- [ ]  No `<SmoothScrollProvider>` duplication (already in root)
- [ ]  No `<QueryClientProvider>` duplication (already in root)
- [ ]  Footer: `bg-neutral-900`, links, dynamic year copyright
- [ ]  Route strings from `ROUTES` constants

### FE-7-LP-01 — Hero Section

- [ ]  Full viewport `h-screen` with `overflow-hidden`
- [ ]  Carousel: 7s interval, 1200ms crossfade, CSS opacity
- [ ]  First image: `priority` flag (LCP optimization)
- [ ]  Gradient: `rgba(13,11,10,0.15)` top → `rgba(13,11,10,0.65)` bottom
- [ ]  `useHeroTimeline` 6-element sequence on mount
- [ ]  `useTextReveal` on heading
- [ ]  `ScrollIndicator` with `animate-hero-bounce`
- [ ]  `motion-safe:opacity-0` pattern (NOT bare `opacity-0`)
- [ ]  `prefers-reduced-motion`: no carousel, no GSAP, all visible
- [ ]  Static images from `/public/images/hero/`

### FE-7-LP-02 — Hero Search Bar

- [ ]  Glass morphism: `bg-white/10 backdrop-blur-md border-white/20 rounded-2xl`
- [ ]  Projects from `usePublicProjects()` (real API)
- [ ]  Only active projects in dropdown
- [ ]  Check-in min: today | Check-out min: checkIn + 1 day
- [ ]  Check-out disabled until check-in selected
- [ ]  Check-out resets when check-in invalidates it
- [ ]  `GuestSelector`: min 1, max 20, default 2
- [ ]  Submit: `router.push('/units?...')` with non-empty params only
- [ ]  `[color-scheme:dark]` on date inputs
- [ ]  No API call on submit (navigation only)

### FE-7-LP-03 — Marquee Banner

- [ ]  Pure CSS: `@keyframes marquee`, `translateX(-50%)`
- [ ]  Two copies of content (seamless loop)
- [ ]  Hover pauses | `motion-reduce` pauses
- [ ]  `sr-only` text + `aria-hidden` on strips + `aria-label` on section
- [ ]  `bg-neutral-900`, white uppercase text
- [ ]  No JavaScript animation

### FE-7-LP-04 — Brand Story

- [ ]  Two-column grid: text left / image right (desktop), stacked (mobile)
- [ ]  `useTextReveal` on heading, `useFadeUp(0.3)` on paragraph
- [ ]  `useImageReveal` on outer, `useParallax(0.2)` on inner (correct nesting)
- [ ]  Static image from `/public/images/brand/`
- [ ]  CTA → `/units` via `ROUTES.public.unitsList`
- [ ]  `motion-safe:opacity-0` on all animated elements

### FE-7-LP-05 — Projects Section

- [ ]  Projects from `usePublicProjects()` | Only active projects
- [ ]  Section hidden if 0 active or API error
- [ ]  Skeleton: 6 cards | `useStaggerCards({ stagger: 0.15 })`
- [ ]  Card: image + gradient + name + description (NOT `unitCount` — backend gap)
- [ ]  Image from `/public/images/projects/{project.id}.jpg` with `onError` fallback
- [ ]  Hover: zoom + darken + shift | Click → `/units?projectId={project.id}`
- [ ]  Grid: `cols-1 sm:cols-2 lg:cols-3`

### FE-7-LP-06 — Featured Units Carousel

- [ ]  `GET /api/units?page=1&pageSize=8` via `usePublicUnits`
- [ ]  Swiper: `dynamic({ ssr: false })`, CSS imported only in carousel component
- [ ]  `slidesPerView`: 1.2 → 2.5 → 3.5 | `freeMode: true` | `loop: false`
- [ ]  Nav arrows: desktop only, show on carousel hover
- [ ]  No autoplay
- [ ]  `UnitCard`: `unit.id`, `unit.name`, `unit.maxGuests`, `unit.unitType`
- [ ]  Image from `fileKey` via `getCoverImageUrl()` | Placeholder fallback
- [ ]  Price: `formatCurrency(basePricePerNight)` + “/ night”
- [ ]  Hover: lift + zoom + CTA

### FE-7-LP-07 — Map Section

- [ ]  Mapbox: `dynamic({ ssr: false })`, CSS imported only in `UnitsMap.tsx`
- [ ]  `NEXT_PUBLIC_MAPBOX_TOKEN` from env (never hardcoded)
- [ ]  Style: `light-v11` | Center: Egypt | `scrollZoom: false`
- [ ]  Projects from `usePublicProjects()` (shared cache)
- [ ]  Coordinates from `lib/constants/project-coordinates.ts`
- [ ]  Projects without coordinates gracefully skipped
- [ ]  Terracotta markers + `animate-ping` + `motion-reduce:animate-none`
- [ ]  Popup: name + description + “Browse {name}” link → `/units?projectId=...`
- [ ]  Cleanup: `map.remove()` + markers removed on unmount

### FE-7-LP-08 — How It Works

- [ ]  4 steps: Browse, Inquire, Confirm, Check In
- [ ]  Each: numbered badge + lucide icon + heading + description
- [ ]  `useStaggerCards` on grid | `useFadeUp` on heading
- [ ]  Grid: `cols-1 sm:cols-2 lg:cols-4`
- [ ]  Static content, no API, no click handlers

### FE-7-LP-09 — Testimonials Carousel

- [ ]  Reviews from `GET /api/public/units/{unitId}/reviews` per curated unit
- [ ]  Curated IDs in `lib/constants/curated-units.ts`
- [ ]  `review.reviewId` as key (NOT `id`) | `review.title` shown
- [ ]  NO `clientName` — “Verified Guest” (P23)
- [ ]  Swiper: `autoplay: 4000, disableOnInteraction: false, pauseOnMouseEnter: true`
- [ ]  `loop` only when `reviews.length >= 3` | Dots, NO arrows
- [ ]  Swiper: `dynamic({ ssr: false })` | Empty state message
- [ ]  `StarRating` with `aria-label`

### FE-7-LP-10 — Newsletter CTA

- [ ]  Parallax bg: `useParallax(0.3)` + `inset-y-20` buffer
- [ ]  `useTextReveal` on heading | Gradient: `from-black/60 to-black/80`
- [ ]  Email: glass morphism input + `[color-scheme:dark]`
- [ ]  Validation: required + valid email regex
- [ ]  Submit: NO API call (Phase 2) → success message
- [ ]  “Browse Properties” ghost button → `/units`
- [ ]  Accessibility: `aria-label`, `aria-invalid`, `aria-describedby`
- [ ]  `motion-safe:opacity-0` on animated elements

## PER-TICKET CHECKS — PART 2 (PENDING VALIDATION)

> ⚠️ These checks are based on the original ticket specs BEFORE validation.
Field names and API contracts will be confirmed during Part 2 ticket validation.
Use these as a starting checklist — corrections may be applied.
> 

### FE-7-UNITS-01 — Units Listing

- [ ]  `GET /api/units` with `page` + `pageSize` only (documented params)
- [ ]  P34 filter params flagged as ⚠️ NEEDS BACKEND CONFIRMATION
- [ ]  `unit.id` for key/navigation | `unit.name` displayed
- [ ]  `keepPreviousData: true` for smooth pagination
- [ ]  URL params sync on filter/page change
- [ ]  Pre-populates from hero search URL params
- [ ]  `usePublicProjects()` for filter dropdown
- [ ]  Empty state + “Clear all filters”

### FE-7-UNITS-02 — Unit Detail

- [ ]  5+ API calls on mount: unit, images, amenities, review summary, reviews
- [ ]  2 conditional: pricing + availability (`enabled` only with dates)
- [ ]  `staleTime: 0` on pricing and availability
- [ ]  P01/P02/P04/P05/P22/P23 all correct
- [ ]  Sticky booking panel on desktop
- [ ]  “Book Now” disabled if no dates or unavailable
- [ ]  404 empty state for not-found units

### FE-7-UNITS-03 — Image Gallery + Lightbox

- [ ]  Images sorted by `isCover` first, then `displayOrder`
- [ ]  `getImageUrl(fileKey)` used (NOT `imageUrl`)
- [ ]  Lightbox: `dynamic({ ssr: false })`
- [ ]  Keyboard: ← → arrows, Escape closes
- [ ]  Touch: swipe (min 50px) for next/prev
- [ ]  Body scroll locked in lightbox | Backdrop click closes
- [ ]  `useImageReveal()` on hero image

### FE-7-BOOK-01 — Step 1: Dates + Pricing

- [ ]  3-step progress indicator
- [ ]  Pre-populated from URL params
- [ ]  P04: availability `startDate`/`endDate`, `blockedDates` flat array
- [ ]  P05: pricing `totalPrice`, `nights[]`
- [ ]  “Continue” disabled until dates + guests + available
- [ ]  “You won’t be charged yet” messaging

### FE-7-BOOK-02 — Step 2: Inline Registration/Login

- [ ]  Client → skip | Admin/Owner → error | Anonymous → form
- [ ]  Login: `{ phone, password }` (NOT email)
- [ ]  Register → auto-login (2 API calls, register then login)
- [ ]  Register response has NO `accessToken`
- [ ]  `email` sent as `undefined` when empty
- [ ]  Logout: `POST /api/auth/logout` BEFORE `clearAuth()`
- [ ]  Phone validation: Egyptian format

### FE-7-BOOK-03 — Step 3: Confirmation

- [ ]  P06: `targetUnitId`, `desiredCheckInDate`, `guestCount`, `contactName`
- [ ]  `source: 'Website'` (PascalCase)
- [ ]  Button: “Submit Booking Request” (NOT “Confirm Booking”)
- [ ]  Response `id` (NOT `leadId`)
- [ ]  “Request Submitted!” (NOT “Booking Confirmed!”)
- [ ]  “This is not a confirmed booking yet” disclaimer
- [ ]  Double-submit prevention

### FE-7-BOOK-04 — CRM Lead Hook

- [ ]  `POST /api/crm/leads` (public, NOT internal)
- [ ]  All P06 field names correct
- [ ]  Zod validates required fields + date order
- [ ]  422 errors parsed
- [ ]  `onSuccess` invalidates queries

### FE-7-ACC-01 — Client Account Layout

- [ ]  Auth guard: `subjectType === 'Client'`
- [ ]  Non-client redirected
- [ ]  Logout: `POST /api/auth/logout` BEFORE `clearAuth()`
- [ ]  NO calls to `/api/internal/...`

### FE-7-ACC-02 — Booking History

- [ ]  P10: `id`, `bookingStatus`, `guestCount`, `finalAmount`
- [ ]  Flat `unitId` (NOT nested object)
- [ ]  “Write Review” only for `bookingStatus === 'Completed'`
- [ ]  `GET /api/client/reviews/by-booking/{bookingId}` to check existing
- [ ]  Backend gap: documented with placeholder/empty state

### FE-7-ACC-03 — Review Submission

- [ ]  `GET /api/client/reviews/by-booking/{bookingId}` on mount
- [ ]  No review → create | Pending → edit | Published/Rejected/Hidden → read-only
- [ ]  Create: `POST /api/client/reviews` with `{ bookingId, rating, title, comment? }`
- [ ]  Edit: `PUT /api/client/reviews/{reviewId}` with `{ rating, title, comment }`
- [ ]  `title` REQUIRED (Zod validates)
- [ ]  Star rating: interactive 1–5 selector (NOT number input)
- [ ]  Auth guard: redirect non-clients

### FE-7-ACC-04 — Client Notifications

- [ ]  P27: `subject` (NOT `title`), `readAt === null` for unread
- [ ]  Client inbox: `/api/client/me/notifications/inbox` (NOT internal)
- [ ]  Bell only for `subjectType === 'Client'`
- [ ]  Backend gap: documented with placeholder/empty state

## VISUAL QA (Manual — Must Test in Browser)

| Test | Expected |
| --- | --- |
| Hero loads on desktop | Cinematic full-viewport, Playfair Display heading, GSAP reveal |
| Scroll down hero | Nav transitions transparent → solid at 80px |
| Hero search: select dates + project → submit | Lands on `/units` with URL params pre-filled |
| Projects section: hover card | Overlay darkens, text shifts up |
| Featured units: hover card | Lifts + image zooms + CTA appears |
| Map section loads | Terracotta markers visible, click → popup with project link |
| How It Works: scroll into view | Steps stagger in (if motion enabled) |
| Testimonials carousel | Autoplay 4s, dots pagination, real review content |
| Newsletter CTA: submit email | Success message, no network request |
| Units listing: filter by project | URL updates, cards re-render |
| Unit detail: select dates | Pricing calculates immediately |
| Unit detail: unavailable dates | Error shown, “Book Now” disabled |
| Booking form: anonymous user | Step 2 shows register + login tabs |
| Booking form: register new client | Auto-logs in, proceeds to Step 3 |
| Submit booking | Confirmation with lead ID, “Request Submitted!” |
| Client reviews booking after completion | Star selector + title field required |
| `prefers-reduced-motion` enabled | No GSAP, no carousel, no parallax, all content visible |
| Mobile viewport | Nav hamburger, stacked layouts, touch swipe on carousels |

## PERFORMANCE CHECKS

- [ ]  First hero image has `priority` flag (LCP)
- [ ]  `next/image` with `fill` + `object-cover` + appropriate `sizes` everywhere
- [ ]  Marquee uses `transform: translateX` (GPU-composited)
- [ ]  Parallax uses `transform: translateY` (GPU-composited)
- [ ]  `setInterval` in HeroCarousel cleaned up on unmount
- [ ]  Mapbox `map.remove()` on unmount
- [ ]  TanStack Query shared cache: projects fetched once (used by 3+ components)
- [ ]  `placeholderData: keepPreviousData` on paginated queries
- [ ]  `staleTime: 0` on availability + pricing
- [ ]  Lightbox: body scroll locked, restored on close

## ACCESSIBILITY CHECKS

- [ ]  `prefers-reduced-motion` respected in ALL 6 animation hooks
- [ ]  `prefers-reduced-motion` stops HeroCarousel cycling
- [ ]  `prefers-reduced-motion` stops marquee scrolling
- [ ]  `prefers-reduced-motion` stops marker pulse
- [ ]  Marquee: `sr-only` text + `aria-hidden` + `aria-label`
- [ ]  Map: `aria-label` on container
- [ ]  Decorative images: `aria-hidden="true"`
- [ ]  Email input: `aria-label`, `aria-invalid`, `aria-describedby`
- [ ]  `StarRating`: `aria-label` (e.g., “4 out of 5 stars”)
- [ ]  `GuestSelector` buttons: `aria-label`
- [ ]  Mobile menu toggle: `aria-label`
- [ ]  All navigation: Next.js `<Link>` (not `<a>`)

## ARCHITECTURE CHECKS

- [ ]  Swiper: `dynamic({ ssr: false })` only — never module-level import
- [ ]  Mapbox: `dynamic({ ssr: false })` only
- [ ]  Lightbox: `dynamic({ ssr: false })` only
- [ ]  Swiper CSS in carousel components only (2 files)
- [ ]  Mapbox CSS in `UnitsMap.tsx` only
- [ ]  No inline `/api/...` strings
- [ ]  No `localStorage`/`sessionStorage` for auth
- [ ]  All animation hooks use `useGSAP()` (not `useEffect + gsap`)
- [ ]  All animated elements use `motion-safe:opacity-0`
- [ ]  All 6 animation hooks check `prefers-reduced-motion`
- [ ]  `pnpm type-check` → zero errors
- [ ]  `pnpm build` → zero errors
- [ ]  No mock data anywhere

## Wave 7 Sign-off Recommendation

- [ ]  **APPROVED** — Guest App launches! Full platform functional.
- [ ]  **CONDITIONAL** — Conditions: ___
- [ ]  **BLOCKED** — Blockers: ___
```