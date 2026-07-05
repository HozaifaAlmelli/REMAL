# Wave 7 — Guest App
## Part 1: Infrastructure + Landing Page
**Wave Number:** 7
**Wave Name:** Guest App
**This File:** FE-7-INFRA-01..03 + FE-7-LP-01..10 (13 tickets)
**Total Wave 7 Tickets:** 24
**Estimated Days (1 dev):** 5
**Parallel Tracks:** Track A (Landing Page), Track B (Units + Booking + Account) — start in parallel after INFRA tickets

---

## Wave 7 Overview

The Guest App is the public-facing, revenue-generating part of the platform. Three groups of users interact with it:
- **Anonymous visitors** — browse units, see availability and pricing
- **Registered clients** — complete the booking form
- **Returning clients** — view their booking history, submit reviews

Wave 7 also delivers the **cinematic landing page** specified in `TravelSensations-Clone-FINAL.md` — a luxury hospitality aesthetic with GSAP animations, Lenis smooth scroll (from Wave 0), Swiper carousels, and Mapbox interactive map.

**Wave 7 Ticket Groups:**
- **INFRA** (3 tickets): Service layer, GSAP setup, public layout
- **Landing Page** (10 tickets): Each section of the landing page
- **Units** (3 tickets): Search listing + unit detail + gallery
- **Booking Flow** (4 tickets): Dates + inline registration + confirmation + CRM lead
- **Client Account** (4 tickets): Layout + booking history + reviews + notifications

---

## ⛔ GLOBAL RULES

```
NO MOCK DATA — EVER.
All content from real API. No hardcoded unit names, fake reviews, placeholder images.

ANIMATION RULES:
- All GSAP: wrap in useGSAP() from @gsap/react
- All ScrollTrigger: sync with Lenis via window.__lenis
- All animations: respect prefers-reduced-motion
- All heavy libs (GSAP, Mapbox, Swiper): dynamic() with ssr:false

DESIGN SYSTEM (from Wave 0 — FE-0-INFRA-08):
- Colors: bg-primary-500 (terracotta), neutral palette (warm grays)
- Fonts: font-display (Playfair Display), font-body (Inter)
- Shadows: shadow-card, shadow-card-hover (warm-toned)
- Container: max-w-container (1440px)
- Easings: ease-out-expo, ease-out-quart (CSS variables)

Public API field names (same as admin public endpoints):
- Unit: id, name (public endpoints use 'id' not 'unitId')
- Pagination: totalCount + totalPages
```

---

## INFRA Tickets

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TICKET ID: FE-7-INFRA-01
TITLE: Create Guest App service layer + public API types
WAVE: Wave 7 — Guest App
DOMAIN: GuestApp
PRIORITY: Critical
DEPENDS ON: FE-0-INFRA-03, FE-0-INFRA-04
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section 1 — Walkthrough

**What is this ticket about?**
All 24 Wave 7 tickets need typed public API contracts. The public endpoints use DIFFERENT field names from the internal admin ones (e.g., public unit has `id` not `unitId`). This ticket creates the service layer for all public-facing API calls.

---

### Section 4 — In Scope

- [ ] `lib/types/public.types.ts` — all public-facing types
- [ ] `lib/api/services/public.service.ts` — all public API calls (units, projects, amenities, availability, pricing, reviews, CRM lead)
- [ ] `lib/hooks/usePublic.ts` — TanStack Query hooks for public data

**Files to create:**
- `lib/types/public.types.ts`
- `lib/api/services/public.service.ts`
- `lib/hooks/usePublic.ts`

**Files to modify:**
- `lib/types/index.ts`

---

### Section 6 — Technical Contract

```typescript
// lib/types/public.types.ts
// Public endpoints use different field shapes from internal admin

// ── Public Unit List Item ──
// (from GET /api/units — public endpoint)
interface PublicUnitListItem {
  id:                 string      // public uses 'id' not 'unitId'
  ownerId:            string
  projectId:             string
  name:               string
  unitType:           string
  bedrooms:           number
  bathrooms:          number
  maxGuests:          number
  basePricePerNight:  number
  isActive:           boolean
  createdAt:          string
}

// ── Public Unit Detail ──
// (from GET /api/units/{id})
interface PublicUnitDetail {
  id:                 string
  ownerId:            string
  projectId:             string
  name:               string
  unitType:           string
  description:        string | null
  address:            string | null
  bedrooms:           number
  bathrooms:          number
  maxGuests:          number
  basePricePerNight:  number
  isActive:           boolean
  createdAt:          string
  updatedAt:          string
}

// ── Public Unit Search Filters ──
interface PublicUnitFilters {
  page?:       number
  pageSize?:   number
}

// ── Paginated Public Units ──
interface PaginatedPublicUnits {
  items:      PublicUnitListItem[]
  pagination: PaginationMeta    // { page, pageSize, totalCount, totalPages }
}

// ── Public CRM Lead (from booking form — no auth required) ──
interface PublicCreateCrmLeadRequest {
  clientId?:        string
  targetUnitId?:    string
  contactName:     string
  contactPhone:    string
  contactEmail?:   string
  desiredCheckInDate?:  string
  desiredCheckOutDate?: string
  guestCount?:          number
  source:          string      // 'Website' | 'App'
  notes?:          string
}

// CRM Lead creation response for public:
interface PublicCreateCrmLeadResponse {
  id:                   string
  clientId:             string | null
  targetUnitId:         string | null
  assignedAdminUserId:  string | null
  contactName:          string
  contactPhone:         string
  contactEmail:         string | null
  desiredCheckInDate:   string | null
  desiredCheckOutDate:  string | null
  guestCount:           number | null
  leadStatus:           string
  source:               string
  notes:                string | null
  createdAt:            string
  updatedAt:            string
}

// ── Pricing Calculation ──
// (from POST /api/units/{unitId}/pricing/calculate)
// Already defined in unit.types.ts — import from there
// UnitPricingResponse: { totalPrice, nights }

// ── Availability Check ──
// Already defined in unit.types.ts
// OperationalAvailabilityResponse: { unitId, startDate, endDate, isAvailable, reason, blockedDates }
```

```typescript
// lib/api/services/public.service.ts
export const publicService = {
  // ── Projects (for landing page + search filters) ──
  getProjects:          (): Promise<ProjectResponse[]> =>
    api.get(endpoints.projects.list),

  // ── Amenities (for search filter chips) ──
  getAmenities:      (): Promise<AmenityResponse[]> =>
    api.get(endpoints.amenities.list),

  // ── Units ──
  getUnits:          (filters?: PublicUnitFilters): Promise<PaginatedPublicUnits> =>
    api.get(endpoints.units.publicList, { params: filters }),

  getUnitById:       (id: string): Promise<PublicUnitDetail> =>
    api.get(endpoints.units.publicById(id)),

  getUnitImages:     (unitId: string): Promise<UnitImageResponse[]> =>
    api.get(endpoints.units.images(unitId)),

  getUnitAmenities:  (unitId: string): Promise<UnitAmenityResponse[]> =>
    api.get(endpoints.units.amenities(unitId)),

  // ── Reviews ──
  getUnitReviews:    (unitId: string): Promise<PublishedReviewListItemResponse[]> =>
    api.get(endpoints.publicReviews.byUnitList(unitId)),

  getUnitReviewSummary: (unitId: string): Promise<UnitPublishedReviewSummaryResponse> =>
    api.get(endpoints.publicReviews.byUnitSummary(unitId)),

  // ── Availability + Pricing ──
  checkAvailability: (unitId: string, checkIn: string, checkOut: string): Promise<OperationalAvailabilityResponse> =>
    api.post(endpoints.units.operationalCheck(unitId), { startDate: checkIn, endDate: checkOut }),

  calculatePricing:  (unitId: string, checkIn: string, checkOut: string): Promise<UnitPricingResponse> =>
    api.post(endpoints.units.pricingCalculate(unitId), { startDate: checkIn, endDate: checkOut }),

  // ── CRM Lead (booking form submission — public, no auth) ──
  submitBookingRequest: (data: PublicCreateCrmLeadRequest): Promise<PublicCreateCrmLeadResponse> =>
    api.post(endpoints.crmLeads.create, data),
}
```

---

### Section 12 — Acceptance Criteria

- [ ] `PublicUnitListItem` has `id` and `name` (not `unitId`/`unitName` — public schema)
- [ ] `PublicCreateCrmLeadRequest.source` is PascalCase: `'Website'` or `'App'`
- [ ] `publicService.submitBookingRequest()` calls `POST /api/crm/leads` (public endpoint — no auth needed)
- [ ] Availability + pricing services handle ISO date strings
- [ ] No `any` types, zero TypeScript errors, no mock data

---

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TICKET ID: FE-7-INFRA-02
TITLE: Setup GSAP ScrollTrigger + animation hooks
WAVE: Wave 7 — Guest App
DOMAIN: GuestApp
PRIORITY: Critical
DEPENDS ON: FE-0-INFRA-09 (Lenis + window.__lenis), FE-0-INFRA-01 (GSAP installed)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section 1 — Walkthrough

**What is this ticket about?**
Clone.md requires scroll-triggered animations throughout the landing page: text reveals, image parallax, fade-ups, staggered cards. GSAP ScrollTrigger must be:
1. Registered with GSAP plugins
2. Synced with Lenis (smooth scroll) via `window.__lenis`
3. Wrapped in reusable React hooks so every section component just calls `useFadeUp()` or `useParallax()`

Wave 0 (FE-0-INFRA-09) installed Lenis and exposed `window.__lenis`. This ticket builds on top of that.

**Why NOW?**
Every landing page section (FE-7-LP-01 through FE-7-LP-10) uses these hooks. Must exist first.

---

### Section 4 — In Scope

- [ ] `lib/providers/gsap-provider.tsx` — registers GSAP plugins + syncs ScrollTrigger with Lenis
- [ ] Add `<GsapProvider>` to `app/(public)/layout.tsx` (NOT root layout — GSAP only needed in public/guest app)
- [ ] Create animation hooks in `lib/hooks/animations/`:
  - `useFadeUp.ts` — fade + translate-up on scroll enter
  - `useImageReveal.ts` — clip-path reveal from bottom
  - `useParallax.ts` — background parallax scrub
  - `useTextReveal.ts` — SplitType character/word stagger reveal
  - `useStaggerCards.ts` — staggered children entrance
  - `useHeroTimeline.ts` — one-shot hero entrance timeline (not scroll-triggered)
- [ ] All hooks: use `useGSAP()` from `@gsap/react`
- [ ] All hooks: check `prefers-reduced-motion` and skip animation if true
- [ ] All hooks: accept `{ trigger?, duration?, delay?, ease? }` options

**Files to create:**
- `lib/providers/gsap-provider.tsx`
- `lib/hooks/animations/useFadeUp.ts`
- `lib/hooks/animations/useImageReveal.ts`
- `lib/hooks/animations/useParallax.ts`
- `lib/hooks/animations/useTextReveal.ts`
- `lib/hooks/animations/useStaggerCards.ts`
- `lib/hooks/animations/useHeroTimeline.ts`
- `lib/hooks/animations/index.ts` — barrel export

**Files to modify:**
- `app/(public)/layout.tsx` — add `<GsapProvider>`

---

### Section 6 — Technical Contract

```typescript
// lib/providers/gsap-provider.tsx
'use client'
import { useEffect } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'

gsap.registerPlugin(ScrollTrigger, useGSAP)

export function GsapProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Sync GSAP ScrollTrigger with Lenis smooth scroll
    const lenis = (window as any).__lenis
    if (!lenis) return

    // Proxy the scroller so ScrollTrigger reads Lenis scroll position
    ScrollTrigger.scrollerProxy(document.documentElement, {
      scrollTop(value?: number) {
        if (typeof value === 'number') {
          lenis.scrollTo(value, { immediate: true })
        }
        return lenis.scroll
      },
      getBoundingClientRect() {
        return {
          top: 0, left: 0,
          width: window.innerWidth,
          height: window.innerHeight,
        }
      },
    })

    lenis.on('scroll', ScrollTrigger.update)

    return () => {
      lenis.off('scroll', ScrollTrigger.update)
      ScrollTrigger.scrollerProxy(document.documentElement, undefined as any)
    }
  }, [])

  return <>{children}</>
}
```

```typescript
// lib/hooks/animations/useFadeUp.ts
import { useRef } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'

interface FadeUpOptions {
  delay?:    number   // seconds
  duration?: number   // default: 0.8
  y?:        number   // default: 40
  ease?:     string   // default: 'power2.out'
  stagger?:  number   // for multiple children
}

export function useFadeUp<T extends HTMLElement = HTMLDivElement>(
  options: FadeUpOptions = {}
) {
  const ref = useRef<T>(null)
  const prefersReduced = typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  useGSAP(() => {
    if (!ref.current || prefersReduced) return

    const target = options.stagger
      ? Array.from(ref.current.children)
      : ref.current

    gsap.fromTo(
      target,
      { opacity: 0, y: options.y ?? 40 },
      {
        opacity: 1, y: 0,
        duration:  options.duration ?? 0.8,
        delay:     options.delay ?? 0,
        ease:      options.ease ?? 'power2.out',
        stagger:   options.stagger,
        scrollTrigger: {
          trigger: ref.current,
          start:   'top 85%',
          once:    true,
        },
      }
    )
  }, [])

  return ref
}
```

```typescript
// lib/hooks/animations/useParallax.ts
export function useParallax<T extends HTMLElement = HTMLDivElement>(
  speed: number = 0.3   // 0 = no parallax, 1 = full scroll
) {
  const ref = useRef<T>(null)
  const prefersReduced = typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  useGSAP(() => {
    if (!ref.current || prefersReduced) return

    gsap.to(ref.current, {
      yPercent: -100 * speed,
      ease:     'none',
      scrollTrigger: {
        trigger: ref.current,
        start:   'top bottom',
        end:     'bottom top',
        scrub:   true,
      },
    })
  }, [])

  return ref
}
```

```typescript
// lib/hooks/animations/useTextReveal.ts
import SplitType from 'split-type'

export function useTextReveal<T extends HTMLElement = HTMLHeadingElement>(
  options: { type?: 'words' | 'chars'; stagger?: number; duration?: number } = {}
) {
  const ref = useRef<T>(null)
  const prefersReduced = typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  useGSAP(() => {
    if (!ref.current || prefersReduced) return

    const split = new SplitType(ref.current, {
      types: options.type ?? 'words',
    })
    const targets = options.type === 'chars' ? split.chars : split.words

    gsap.fromTo(
      targets,
      { opacity: 0, yPercent: 120, rotateX: -15 },
      {
        opacity:  1,
        yPercent: 0,
        rotateX:  0,
        duration: options.duration ?? 0.7,
        stagger:  options.stagger ?? 0.05,
        ease:     'power3.out',
        scrollTrigger: {
          trigger: ref.current,
          start:   'top 90%',
          once:    true,
        },
      }
    )

    return () => split.revert()
  }, [])

  return ref
}
```

---

### Section 12 — Acceptance Criteria

- [ ] `GsapProvider` registers `ScrollTrigger` and `useGSAP` plugins
- [ ] `GsapProvider` syncs with `window.__lenis` via `ScrollTrigger.scrollerProxy`
- [ ] Scroll update listener cleaned up on unmount
- [ ] All 6 hooks check `prefers-reduced-motion` and skip animation if true
- [ ] All hooks use `useGSAP()` (not `useEffect` + gsap)
- [ ] `GsapProvider` in `app/(public)/layout.tsx` (NOT root layout)
- [ ] No `any` types, zero TypeScript errors
- [ ] No mock data (animations don't have data)

---

### Section 13 — Notes for AI / Common Mistakes

**DO NOT:**
- Do NOT import GSAP at the module level without `dynamic()` — the provider handles the global setup, component animations use `useGSAP()`
- Do NOT call `ScrollTrigger.refresh()` manually — it's called automatically by Lenis sync
- Do NOT use `useEffect` + `gsap.to()` directly — always use `useGSAP()` from `@gsap/react`
- Do NOT add GSAP to the root `app/layout.tsx` — only `app/(public)/layout.tsx`
- Do NOT skip the `prefers-reduced-motion` check — accessibility requirement

**WATCH OUT FOR:**
- `window.__lenis` may be undefined on SSR — the `useEffect` wraps the sync correctly
- `SplitType` modifies the DOM — always call `split.revert()` in the cleanup function
- `useGSAP` scope is tied to the ref — ensure the ref is attached before the hook runs

---

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TICKET ID: FE-7-INFRA-03
TITLE: Build Guest App public layout (nav + footer)
WAVE: Wave 7 — Guest App
DOMAIN: GuestApp
PRIORITY: Critical
DEPENDS ON: FE-7-INFRA-02, FE-0-INFRA-08 (design system)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section 1 — Walkthrough

**What is this ticket about?**
Every public page (landing, units listing, unit detail, booking, account) shares a navigation header and footer. The header transitions from transparent (on hero) to solid (on scroll). The footer has platform links and contact info.

---

### Section 4 — In Scope

- [ ] `app/(public)/layout.tsx` — public route group layout (wraps all guest pages)
- [ ] `components/public/layout/PublicNav.tsx` — navigation header
  - Logo/brand name on left
  - Nav links: Home, Units, Projects
  - Right side: Login link (if not logged in) or Account link (if logged in as client)
  - On scroll past hero: transitions from `bg-transparent` → `bg-white/95 backdrop-blur-md shadow-nav`
  - Uses scroll position from `window.__lenis.scroll` or `window.scrollY`
- [ ] `components/public/layout/PublicFooter.tsx`
  - Platform name, brief tagline
  - Links: Browse Units, About, Contact
  - Copyright notice
- [ ] Add `<GsapProvider>` to `app/(public)/layout.tsx`
- [ ] `useAuthStore` to check if user is logged in (for nav links)

**Files to create:**
- `app/(public)/layout.tsx`
- `components/public/layout/PublicNav.tsx`
- `components/public/layout/PublicFooter.tsx`

---

### Section 6 — Technical Contract

```typescript
// Nav scroll behavior:
// Header: position fixed, z-50
// Starts: bg-transparent text-white
// After scrollY > 80px: bg-white/95 backdrop-blur-md text-neutral-800 shadow-nav
// Transition: transition-all duration-300 ease-out-quart

// Scroll detection using Lenis:
useEffect(() => {
  function update() {
    const scrollY = window.__lenis?.scroll ?? window.scrollY
    setScrolled(scrollY > 80)
  }
  window.__lenis?.on('scroll', update)
  window.addEventListener('scroll', update, { passive: true })
  return () => {
    window.__lenis?.off('scroll', update)
    window.removeEventListener('scroll', update)
  }
}, [])
```

---

### Section 12 — Acceptance Criteria

- [ ] Nav transparent on hero, solid on scroll (transition smooth)
- [ ] Login/Account link changes based on auth state
- [ ] `GsapProvider` wraps public layout
- [ ] `SmoothScrollProvider` already wraps everything from root layout (FE-0-INFRA-09)
- [ ] `app/(public)/layout.tsx` does NOT duplicate `<SmoothScrollProvider>` (already in root)
- [ ] Footer has no CTA that requires auth state
- [ ] No mock data

---

---

## Landing Page Tickets (FE-7-LP-01 → 10)

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TICKET ID: FE-7-LP-01
TITLE: Build Landing Hero section (carousel + GSAP timeline + SplitType)
WAVE: Wave 7 — Guest App
DOMAIN: GuestApp / Landing Page
PRIORITY: Critical
DEPENDS ON: FE-7-INFRA-02, FE-7-INFRA-03
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section 1 — Walkthrough

**What is this ticket about?**
The hero is the first thing visitors see — and it must be cinematic. Per Clone.md Section 4.2: a full-viewport image carousel (7s auto-advance, crossfade), a layered gradient overlay, the platform name in Playfair Display with a SplitType character-by-character reveal, a tagline, a coordinates label in monospace, and a scroll indicator. A 6-element GSAP timeline fires once on mount.

---

### Section 4 — In Scope

- [ ] `components/public/hero/HeroSection.tsx` — full-viewport hero
- [ ] Background: static images (from design assets) cycling with crossfade (7s per image)
  - Images from platform's own units or brand images — NOT from API (hero images are brand assets)
  - Stored in `/public/images/hero/` (3-5 static images)
- [ ] Gradient overlay: `from-black/15 to-black/65` (per Clone.md spec)
- [ ] Heading: `<h1>` with `font-display` + `useTextReveal()` hook (SplitType word reveal)
  - Content: "Discover Your Perfect Escape" (or platform-specific copy)
- [ ] Subheading: tagline text, `useFadeUp()` with `delay: 0.6`
- [ ] Coordinates label: `font-mono text-white/60` — e.g., "30.0626° N, 31.2497° E"
- [ ] Scroll indicator: animated bouncing arrow at bottom center
- [ ] Hero timeline (6 elements, triggers on mount, `useHeroTimeline()` hook):
  1. Nav opacity 0 → 1 (staggered from logo to links)
  2. Heading reveal (word by word)
  3. Tagline slide up
  4. Coordinates label fade in
  5. Search bar (FE-7-LP-02) fade up
  6. Scroll indicator bounce in
- [ ] Image carousel: `setTimeout` for advance, CSS `opacity` transition

**Files to create:**
- `components/public/hero/HeroSection.tsx`
- `components/public/hero/HeroCarousel.tsx`
- `components/public/hero/ScrollIndicator.tsx`

---

### Section 6 — Technical Contract

```typescript
// Clone.md Section 4.2 + Section 5.4 specs:
const HERO_TRANSITION_DURATION = 1200   // ms — crossfade duration
const HERO_SLIDE_INTERVAL      = 7000   // ms — time per image

// Overlay gradient:
// background: 'linear-gradient(180deg, rgba(13,11,10,0.15) 0%, rgba(13,11,10,0.65) 100%)'
// (matches Clone.md overlay spec)

// GSAP Hero Timeline (useHeroTimeline hook):
const tl = gsap.timeline({ delay: 0.3 })
tl.fromTo(navRef.current,     { opacity: 0 },              { opacity: 1, duration: 0.6 })
  .fromTo(headingWords,       { opacity: 0, yPercent: 110 }, { opacity: 1, yPercent: 0, stagger: 0.08, duration: 0.7, ease: 'power3.out' }, '-=0.2')
  .fromTo(taglineRef.current, { opacity: 0, y: 30 },        { opacity: 1, y: 0, duration: 0.7 }, '-=0.3')
  .fromTo(coordsRef.current,  { opacity: 0 },              { opacity: 1, duration: 0.6 }, '-=0.4')
  .fromTo(searchRef.current,  { opacity: 0, y: 20 },       { opacity: 1, y: 0, duration: 0.6 }, '-=0.3')
  .fromTo(scrollRef.current,  { opacity: 0 },              { opacity: 1, duration: 0.4 }, '-=0.2')
```

---

### Section 7 — API Integration

N/A — hero uses static brand images, not API data.

---

### Section 10 — UX & Loading State Rules

| State | Required? | Behavior |
|---|---|---|
| Page load | ✓ REQUIRED | Hero visible immediately (no skeleton) — images are pre-selected |
| Prefers reduced motion | ✓ REQUIRED | Hero static (no carousel, no GSAP) |
| Mobile | ✓ REQUIRED | Touch device: `object-fit: cover`, no parallax |

---

### Section 12 — Acceptance Criteria

- [ ] Full viewport height (`h-screen`) with `overflow: hidden`
- [ ] Image carousel with 7s interval and crossfade transition
- [ ] GSAP timeline fires once on mount (not scroll-triggered)
- [ ] `useTextReveal()` applied to heading
- [ ] Gradient overlay matches Clone.md spec
- [ ] `prefers-reduced-motion`: no animation, no carousel
- [ ] `next/image` with `fill` + `object-cover` for hero images
- [ ] No mock data (static brand images in `/public/images/`)

---

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TICKET ID: FE-7-LP-02
TITLE: Build Hero Search bar (glass morphism + availability)
WAVE: Wave 7 — Guest App
DOMAIN: GuestApp / Landing Page
PRIORITY: Critical
DEPENDS ON: FE-7-LP-01, FE-7-INFRA-01
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section 1 — Walkthrough

**What is this ticket about?**
The search bar floating over the hero — the primary conversion tool on the entire site. Clone.md specifies glass morphism styling: `backdrop-blur`, semi-transparent background, warm-toned border. Fields: location (project), check-in, check-out, guests. On submit, it navigates to `/units` with the search params in the URL.

---

### Section 4 — In Scope

- [ ] `components/public/hero/HeroSearchBar.tsx`
- [ ] Glass morphism: `bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl`
- [ ] Fields:
  - Location/Project — Select (from `GET /api/projects`)
  - Check-in Date — DatePicker (styled for dark background)
  - Check-out Date — DatePicker
  - Guests — Number selector (+ / − buttons, min 1 max 20)
- [ ] "Search" button — primary, large
- [ ] On submit: `router.push('/units?projectId=...&checkIn=...&checkOut=...&guests=...')`
- [ ] Projects loaded from API on component mount
- [ ] Inline validation: checkOut must be after checkIn

**Files to create:**
- `components/public/hero/HeroSearchBar.tsx`
- `components/public/hero/GuestSelector.tsx`

---

### Section 7 — API Integration

| Method | Endpoint | Response | When |
|---|---|---|---|
| GET | `/api/projects` | `ProjectResponse[]` | on component mount |

---

### Section 12 — Acceptance Criteria

- [ ] Glass morphism styling matches Clone.md Section 4.2 CSS specs
- [ ] Projects from real API (no hardcoded "Palm Hills", "NEOM", etc.)
- [ ] checkOut > checkIn validated before submit
- [ ] Submit navigates to `/units` with URL query params
- [ ] Works on dark hero background (white text, light borders)
- [ ] No mock data

---

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TICKET ID: FE-7-LP-03
TITLE: Build Landing Marquee Banner
WAVE: Wave 7 — Guest App
DOMAIN: GuestApp / Landing Page
PRIORITY: High
DEPENDS ON: FE-7-INFRA-03
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section 1 — Walkthrough

**What is this ticket about?**
A horizontally scrolling marquee banner between the hero and the brand story section — repeating text or icons (e.g., property types, amenity names, the platform tagline) that creates visual rhythm and reinforces the luxury aesthetic. Pure CSS animation — no JavaScript.

---

### Section 4 — In Scope

- [ ] `components/public/sections/MarqueeBanner.tsx`
- [ ] CSS `@keyframes marquee` — seamless infinite loop (two copies of content side by side)
- [ ] Content: alternating text items and separator icons (e.g., ✦ or ●)
- [ ] Pause on hover: `animation-play-state: paused` on `:hover`
- [ ] Background: `bg-primary-500` (terracotta) or `bg-neutral-900` (dark)
- [ ] Text: white, `font-accent` (Montserrat), uppercase, letter-spacing

**Files to create:**
- `components/public/sections/MarqueeBanner.tsx`

---

### Section 12 — Acceptance Criteria

- [ ] Seamless infinite loop (no visible jump)
- [ ] Pauses on hover
- [ ] Uses design system colors and fonts
- [ ] Respects `prefers-reduced-motion` (pauses animation)
- [ ] No mock data (content is static brand copy)

---

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TICKET ID: FE-7-LP-04
TITLE: Build Landing Brand Story section
WAVE: Wave 7 — Guest App
DOMAIN: GuestApp / Landing Page
PRIORITY: High
DEPENDS ON: FE-7-INFRA-02, FE-7-INFRA-03
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section 1 — Walkthrough

**What is this ticket about?**
A split-layout section: text on the left (heading + paragraph describing the platform), image on the right with a parallax effect. On scroll, the heading reveals word-by-word, the paragraph fades up, and the image has a clip-path reveal from bottom. This is purely static content — no API data.

---

### Section 4 — In Scope

- [ ] `components/public/sections/BrandStorySection.tsx`
- [ ] Layout: `grid grid-cols-2 gap-16` (desktop), single column (mobile)
- [ ] Left: heading (`useTextReveal()`), paragraph (`useFadeUp(delay: 0.3)`), CTA button
- [ ] Right: image with `useImageReveal()` + `useParallax(0.2)`
- [ ] Image: static brand photo from `/public/images/brand/` (NOT from API)
- [ ] Section padding: `var(--section-padding-y)` and `var(--section-padding-x)`

**Files to create:**
- `components/public/sections/BrandStorySection.tsx`

---

### Section 12 — Acceptance Criteria

- [ ] `useTextReveal()` on heading, `useFadeUp()` on paragraph
- [ ] `useParallax()` on image
- [ ] Responsive: stacks on mobile
- [ ] Static image from `/public/images/` (not API)
- [ ] Respects `prefers-reduced-motion`

---

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TICKET ID: FE-7-LP-05
TITLE: Build Landing Projects section (tabs + cards + hover effects)
WAVE: Wave 7 — Guest App
DOMAIN: GuestApp / Landing Page
PRIORITY: Critical
DEPENDS ON: FE-7-INFRA-01, FE-7-INFRA-02
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section 1 — Walkthrough

**What is this ticket about?**
A section showing available projects with tabs for filtering (All / Coastal / Mountain / etc.). Each project is a card with a background image, the project name overlaid, and the unit count. On hover, the overlay darkens and the count slides up. The cards link to `/units?projectId=...`.

---

### Section 4 — In Scope

- [ ] `components/public/sections/ProjectsSection.tsx`
- [ ] `GET /api/projects` — fetch projects list
- [ ] Project card: `components/public/cards/ProjectCard.tsx`
  - Full-bleed background image (each project needs an image — use project.id to map to `/public/images/projects/{id}.jpg` or a placeholder)
  - Gradient overlay on card
  - Project name: `font-display text-white`
  - Unit count: `text-white/70`
  - On hover: overlay `opacity` increases, count slides up (`transform: translateY`)
  - Click: navigate to `/units?projectId={project.id}`
- [ ] Card grid: `grid-cols-2 lg:grid-cols-3 gap-4`
- [ ] Section heading + subheading (static copy)
- [ ] `useStaggerCards()` on the grid

**Files to create:**
- `components/public/sections/ProjectsSection.tsx`
- `components/public/cards/ProjectCard.tsx`

---

### Section 7 — API Integration

| Method | Endpoint | Response | When |
|---|---|---|---|
| GET | `/api/projects` | `ProjectResponse[]` | on section mount |

---

### Section 12 — Acceptance Criteria

- [ ] Project cards from real API (no hardcoded projects)
- [ ] Hover effects: overlay + count slide using pure CSS/Tailwind transitions
- [ ] Cards link to units list with `projectId` filter
- [ ] `useStaggerCards()` entrance animation
- [ ] Loading: skeleton card placeholders
- [ ] Empty: if 0 projects → section hidden (not empty state)
- [ ] No mock data

---

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TICKET ID: FE-7-LP-06
TITLE: Build Landing Featured Units carousel (Swiper)
WAVE: Wave 7 — Guest App
DOMAIN: GuestApp / Landing Page
PRIORITY: Critical
DEPENDS ON: FE-7-INFRA-01, FE-7-INFRA-03
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section 1 — Walkthrough

**What is this ticket about?**
A horizontal Swiper carousel showing the platform's units. Uses `GET /api/units?page=1&pageSize=8` for the first page. Each unit card in the carousel has a hover lift effect, a zoom on the image, and a CTA that appears on hover. Loaded via `dynamic({ ssr: false })`.

---

### Section 4 — In Scope

- [ ] `components/public/sections/FeaturedUnitsSection.tsx`
- [ ] `components/public/cards/UnitCard.tsx` — reusable unit card (used on listing page too)
- [ ] `GET /api/units?page=1&pageSize=8` — first 8 units
- [ ] popular/featured sorting is Backend Gap until documented.
- [ ] Swiper config: `slidesPerView: 1.2` (mobile), `2.5` (tablet), `3.5` (desktop), `spaceBetween: 20`, loop, navigation arrows
- [ ] Swiper loaded via `dynamic({ ssr: false })`
- [ ] `UnitCard` hover effects:
  - Card lifts: `hover:-translate-y-2 hover:shadow-card-hover` (Tailwind)
  - Image zooms: `transition-transform duration-500 group-hover:scale-110`
  - CTA button appears: `opacity-0 group-hover:opacity-100 transition-opacity`

**Files to create:**
- `components/public/sections/FeaturedUnitsSection.tsx`
- `components/public/cards/UnitCard.tsx`

---

### Section 7 — API Integration

| Method | Endpoint | Query | Response | When |
|---|---|---|---|---|
| GET | `/api/units` | `{ page: 1, pageSize: 8 }` | `PaginatedPublicUnits` | on section mount |

---

### Section 9 — UnitCard Component Spec

```typescript
interface UnitCardProps {
  unit:      PublicUnitListItem
  className?: string
}

// UnitCard renders:
// - Primary image with zoom on hover (next/image, fill, object-cover)
// - Unit name (font-display)
// - Unit type badge (Badge component)
// - Max guests (X guests)
// - Price: "from {formatCurrency(basePricePerNight)} / night"
// - Rating/count only when loaded from `/api/public/units/{unitId}/reviews/summary`
// - Image only when loaded from `/api/units/{unitId}/images` (or backend includes it explicitly)
// - CTA on hover: "View Details" button
// - Clicking anywhere → ROUTES.public.unitDetail(unit.id)
```

**Backend gap note:** `GET /api/units` should not be assumed to include rating/review-count/image fields for `UnitCard`.

---

### Section 12 — Acceptance Criteria

- [ ] Swiper loaded via `dynamic({ ssr: false })` with skeleton loading
- [ ] Units from real API (no hardcoded properties)
- [ ] `unit.id` used for navigation (public API uses `id`)
- [ ] `next/image` with `fill` + `object-cover` for unit images
- [ ] Hover effects: lift + zoom + CTA appear
- [ ] Skeleton: 3 card skeletons while loading
- [ ] No mock data

---

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TICKET ID: FE-7-LP-07
TITLE: Build Landing Map section (Mapbox markers)
WAVE: Wave 7 — Guest App
DOMAIN: GuestApp / Landing Page
PRIORITY: High
DEPENDS ON: FE-7-INFRA-01, FE-7-LP-05
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section 1 — Walkthrough

**What is this ticket about?**
An interactive Mapbox map showing where the platform's units are located. Each project is a cluster marker. Clicking a marker opens a popup with the project name and unit count, with a "Browse Units" link. Loaded via `dynamic({ ssr: false })` because Mapbox is client-only.

**Prerequisites:**
- `NEXT_PUBLIC_MAPBOX_TOKEN` must be set in `.env.local`
- Mapbox style: `mapbox://styles/mapbox/streets-v12` or custom warm style

---

### Section 4 — In Scope

- [ ] `components/public/sections/MapSection.tsx` — section wrapper
- [ ] `components/public/map/UnitsMap.tsx` — Mapbox GL component (dynamic loaded)
- [ ] Map centered on Egypt: `{ lng: 30.8025, lat: 26.8206 }`, zoom 5
- [ ] Markers per project (use project coordinates — hardcoded or from project data)
- [ ] Marker: custom terracotta circle pin (`bg-primary-500`)
- [ ] Click marker → popup: project name, unit count, "Browse {Project}" link → `/units?projectId=...`
- [ ] Map style: warm/muted (not satellite) — `mapbox://styles/mapbox/light-v11` as default

**Files to create:**
- `components/public/sections/MapSection.tsx`
- `components/public/map/UnitsMap.tsx`

---

### Section 7 — API Integration

| Method | Endpoint | Response | When |
|---|---|---|---|
| GET | `/api/projects` | `ProjectResponse[]` | on map mount |

**Project coordinates:**
Project data from API does NOT include lat/lng. The map section uses either:
1. A hardcoded coordinate mapping: `const AREA_COORDINATES: Record<string, [number, number]> = { ... }` keyed by project ID
2. OR geocoding — out of scope for MVP

For MVP: use option 1. This is acceptable because projects are admin-managed and rarely change.

---

### Section 12 — Acceptance Criteria

- [ ] Mapbox loaded via `dynamic({ ssr: false })` with skeleton loading
- [ ] `NEXT_PUBLIC_MAPBOX_TOKEN` used (not hardcoded token)
- [ ] Projects from real API (no hardcoded project names)
- [ ] Marker popup links to `/units?projectId=...` using real project IDs
- [ ] Skeleton: rectangular `<Skeleton height={400}>` while loading
- [ ] No mock data (projects from API, coordinates from hardcoded mapping)

---

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TICKET ID: FE-7-LP-08
TITLE: Build Landing How It Works section
WAVE: Wave 7 — Guest App
DOMAIN: GuestApp / Landing Page
PRIORITY: High
DEPENDS ON: FE-7-INFRA-02, FE-7-INFRA-03
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section 1 — Walkthrough

**What is this ticket about?**
A 4-step process section explaining how the platform works: Browse → Contact → Confirm → Check In. Each step has a numbered icon, heading, and description. `useStaggerCards()` entrance animation.

---

### Section 4 — In Scope

- [ ] `components/public/sections/HowItWorksSection.tsx`
- [ ] 4 steps (static content):
  1. **Browse** — "Explore our curated selection of premium properties"
  2. **Inquire** — "Submit your dates and our team will confirm availability"
  3. **Confirm** — "Secure your booking with a deposit"
  4. **Check In** — "Arrive and enjoy your stay"
- [ ] Each step: numbered circle icon, heading, description
- [ ] `useStaggerCards()` — steps stagger in on scroll
- [ ] Layout: `grid-cols-2 lg:grid-cols-4`

**Files to create:**
- `components/public/sections/HowItWorksSection.tsx`
- `components/public/sections/ProcessStep.tsx`

---

### Section 12 — Acceptance Criteria

- [ ] 4 steps with `useStaggerCards()` entrance
- [ ] Responsive: 2 cols on tablet, 4 on desktop
- [ ] Static content (no API needed)
- [ ] `prefers-reduced-motion` respected

---

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TICKET ID: FE-7-LP-09
TITLE: Build Landing Testimonials/Reviews carousel
WAVE: Wave 7 — Guest App
DOMAIN: GuestApp / Landing Page
PRIORITY: High
DEPENDS ON: FE-7-INFRA-01, FE-7-LP-06 (UnitCard + Swiper already set up)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section 1 — Walkthrough

**What is this ticket about?**
A reviews carousel on the landing page showing real published reviews from the platform — giving social proof to new visitors. Loads published reviews from multiple units (or a curated selection). Displayed as quote cards in a Swiper carousel.

---

### Section 4 — In Scope

- [ ] `components/public/sections/TestimonialsSection.tsx`
- [ ] `components/public/cards/TestimonialCard.tsx`
- [ ] Strategy: fetch reviews from the first few active units (no global reviews endpoint)
  - Fetch first 4-6 active units → then fetch reviews for each → take first review per unit
  - OR: Use a curated hardcoded set of unit IDs to always show good reviews
  - **MVP approach:** Hardcode 3-4 unit IDs (from the demo/seed data) to always show their reviews. This is acceptable because the goal is social proof, not real-time data. Document this limitation.
- [ ] Each card: rating stars, review title, comment (truncated 120 chars), unit reference
- [ ] Client name is Backend Gap unless public reviews endpoint documents it.
- [ ] Swiper: `autoplay: { delay: 4000 }`, loop, no navigation arrows (just dots)
- [ ] `useFadeUp()` on section heading

**Files to create:**
- `components/public/sections/TestimonialsSection.tsx`
- `components/public/cards/TestimonialCard.tsx`

---

### Section 7 — API Integration

| Method | Endpoint | Response | When |
|---|---|---|---|
| GET | `/api/public/units/{unitId}/reviews` | `PublishedReviewListItemResponse[]` | on mount, for each curated unit |

**Note on strategy:** If no reviews exist yet (early launch), section shows a `useFadeUp()` placeholder message "Be the first to experience our properties" instead of an empty carousel.

---

### Section 12 — Acceptance Criteria

- [ ] Reviews from real API (NOT hardcoded review text)
- [ ] Graceful empty state if no reviews exist
- [ ] `review.title` shown (reviews have titles!)
- [ ] No client identity assumption in testimonials unless backend documents it
- [ ] Swiper autoplay with loop
- [ ] No mock data for the actual review content

---

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TICKET ID: FE-7-LP-10
TITLE: Build Landing Newsletter CTA section
WAVE: Wave 7 — Guest App
DOMAIN: GuestApp / Landing Page
PRIORITY: Medium
DEPENDS ON: FE-7-INFRA-02, FE-7-INFRA-03
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section 1 — Walkthrough

**What is this ticket about?**
The final section before the footer — a full-width CTA with a parallax background image, a heading ("Start Your Journey"), a subtitle, and an email input for newsletter signup. Since there's no newsletter API in the platform, the form collects the email and shows a success message (no backend submission in MVP).

---

### Section 4 — In Scope

- [ ] `components/public/sections/NewsletterCtaSection.tsx`
- [ ] Full-width, dark background with a parallax background image (`useParallax(0.3)`)
- [ ] Heading with `useTextReveal()`
- [ ] Email input + "Subscribe" button
- [ ] On submit: validate email format → show success message "Thank you! We'll be in touch."
- [ ] No backend submission (newsletter is Phase 2 per PRD)
- [ ] CTA button: "Browse Properties" → `ROUTES.public.unitsList`

**Files to create:**
- `components/public/sections/NewsletterCtaSection.tsx`

---

### Section 12 — Acceptance Criteria

- [ ] Parallax background image
- [ ] Email validation (no empty, no invalid format)
- [ ] Success message on submit (no API call)
- [ ] "Browse Properties" CTA links correctly
- [ ] `useTextReveal()` on heading
- [ ] No mock data

---

---

# Continued in Wave_7_Part2_Units_Booking_Account.md

> The remaining 11 tickets (FE-7-UNITS-01..03, FE-7-BOOK-01..04, FE-7-ACC-01..04) + QA Prompt + PM Sign-off are in the companion file.
