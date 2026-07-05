# STOREFRONT-INTEGRATION — Execution Tickets

Wire the public storefront (`demo`, port 3000) to the live Kaza platform (`rental-platform`, port 3001) and the `.NET 10` backend API (port 5001), with a full cross-persona booking lifecycle. This document is self-contained — an implementing agent should be able to execute it without re-reading `integration.md`.

---

## 0. Context & ground truth

`integration.md` bundles two tickets: **INTEGRATION** (connect the storefront to the platform + API) and **GLOBAL-QA-FRAMEWORK** (a testing/standards protocol).

- **Storefront** = a **separate Next.js 16 app** at `D:\Remal\REMAL\demo` (port 3000). Today it is **100% mock**: no API client, no `.env`, hardcoded `MOCK_UNITS`/`MOCK_PROJECTS`, fake auth via a `kaza_booking_role` cookie, and form submits that only open WhatsApp.
- **Platform** = `D:\Remal\REMAL\rental-platform` (port 3001): real admin/owner/client app. Axios with `withCredentials:true`, Zustand auth store (access token in memory, `refresh_token` HttpOnly cookie), TanStack Query.
- **Backend** = `RentalPlatform.{API,Business,Data,Shared}` (.NET 10), Postgres. API in dev = **`http://localhost:5001`** (Docker, container 8080 → host 5001).

### Confirmed scope (from the requester)
- **Full cross-persona**: the storefront creates **real** leads/bookings against the live API, and we run the full end-to-end lifecycle (client → admin CRM → owner payouts → global lockout).
- **GLOBAL-QA = verification gate only**: apply its rules (zero-mock, `.00` currency, `YYYY-MM-DD` dates, phone regex, ≥40px targets, design tokens) to the **new storefront work** and use its checklist as the smoke test. **No platform-wide refactor.**

### Standing constraints (do not violate)
- **No DB / schema changes.** No EF or SQL migration. (Slug mapping is client-side; all required endpoints already exist.)
- **Local dev only.** Never touch staging/production DB, CORS, or cookies. No prod test accounts. **Do not commit or push** unless explicitly asked.
- **No mock data on the integrated surfaces** — drive everything from live endpoints with safe fallbacks (`?? []`, `?? 0`).
- Never print secrets/tokens/connection strings — reference env-var **names** only.

### Ticket corrections (verified against the actual code — the ticket text is wrong here)
| Ticket claims | Reality |
|---|---|
| `.NET 8` | **.NET 10** (`<TargetFramework>net10.0`). |
| Add CORS for `:3000` in `Program.cs` | **Already done.** `Cors:AllowedOrigins` (appsettings + docker-compose env) lists `:3000`, `:3001`, `127.0.0.1` variants; `AllowAnyHeader().AllowAnyMethod().AllowCredentials()`; `UseCors()` before auth. **No dev change.** |
| `GET /api/areas?includeInactive=false` | Areas renamed to **projects** (migration 0054): **`GET /api/projects?includeInactive=false`**. No slug column. |
| `GET /api/units?...&isActive=true` | `GET /api/units` already returns **active units only** server-side; `isActive` is not a param (ignored if passed). |
| Client registers with Full Name + Email + Password | Client auth is **phone-based**: `ClientRegisterRequest { Name, Phone, Email?, Password }`; login `{ Phone, Password }`. |
| Cross-port cookies need special handling | `:3000`/`:3001`/`:5001` are the **same site** (`localhost`); `refresh_token` (`SameSite=Strict`) is sent on the credentialed `:3000 → :5001` refresh XHR. **No dev cookie change expected.** |

---

## 1. Architecture: the handoff + data flow

```
Storefront (:3000, demo)                 Platform (:3001, rental-platform)         API (:5001)
─────────────────────────                ─────────────────────────────────        ───────────
guest pages ──GET /api/units, /api/projects, /availability/operational-check (anon) ───────────►
LeadForm  ───POST /api/crm/leads (anon, Prospecting) ──────────────────────────────────────────►
"Sign in" ──► http://localhost:3001/auth/client/login?returnUrl=http://localhost:3000/checkout?…
                                          login form ──POST /api/auth/client/login──► sets refresh_token cookie
                                          onSuccess ──window.location.assign(returnUrl)──► back to :3000
on load / after return: AuthProvider ──POST /api/auth/refresh (cookie) ──► access token in memory
checkout (authed) ──POST /api/client/bookings (Bearer, Prospecting) ───────────────────────────►
   admin (:3001) CRM: Prospecting→Relevant→Booked→Confirmed(+deposit/receipt) ─► holding status
   owner (:3001): payout rows show real Unit/Client names
storefront unit page ──operational-check──► booked range now returns isAvailable=false (locked out)
```

**Why this works without backend changes:** the storefront never reimplements auth — it redirects to the platform's existing login. The platform/API set the `refresh_token` cookie (scoped to `localhost`, sent to any `localhost:*`). On return, the storefront bootstraps its own in-memory session by calling `/api/auth/refresh` with the cookie. Booking POSTs use the in-memory Bearer token; CORS already allows credentialed cross-origin calls from `:3000`.

---

## 2. API contract (verified — these all exist)

All responses use the envelope `ApiResponse<T> = { success, data, message, errors, pagination }`, with `pagination = { totalCount, page, pageSize, totalPages }`.

### Public (anonymous)
- **`GET /api/units?page=1&pageSize=6`** → `UnitListItemResponse[]` (active-only). Fields:
  `id, ownerId, ownerName, projectId, projectName, name, unitType, bedrooms, bathrooms, maxGuests, basePricePerNight, isActive, createdAt, images: UnitImageResponse[]`.
  Other filters: `projectId, unitType, minGuests, minPrice, maxPrice, search, sortBy, amenityIds[]`.
- **`UnitImageResponse`** = `{ id, unitId, fileKey, isCover, displayOrder, createdAt }`. **`fileKey` is a storage key, not a URL** — resolve it the way `rental-platform` already renders unit images (find that helper; likely `${NEXT_PUBLIC_STORAGE_URL}/<fileKey>` or `GET /api/units/{unitId}/images`).
- **`GET /api/projects?includeInactive=false`** → `ProjectResponse[] = { id, name, description?, isActive, createdAt, updatedAt }`. Seed includes **"Abraj Al Alamein"** and **"Palm Hills"**.
- **`POST /api/crm/leads`** (`PublicCreateCrmLeadRequest`):
  `{ clientId?, targetUnitId?, contactName, contactPhone, contactEmail?, desiredCheckInDate?, desiredCheckOutDate?, guestCount?, source, notes? }` → lead, status **Prospecting**. Dates are `DateOnly` (`YYYY-MM-DD`).
- **`POST /api/units/{unitId}/availability/operational-check`** `{ startDate, endDate }` → `{ unitId, startDate, endDate, isAvailable, reason, blockedDates: DateOnly[] }`. `reason ∈ {"date_blocked","date_booked"}`. Only **Booked/Confirmed/CheckIn** block; Prospecting does **not**.

### Auth
- **`POST /api/auth/client/register`** `ClientRegisterRequest { Name, Phone, Email?, Password }` → profile (no token).
- **`POST /api/auth/client/login`** `{ Phone, Password }` → `AuthResponse` + sets `refresh_token` cookie.
- **`POST /api/auth/refresh`** (uses cookie) → `AuthResponse`.
- **`POST /api/auth/logout`** → clears cookie.
- `AuthResponse = { accessToken, expiresInSeconds, subjectType, adminRole, roleName, user, permissions }`.

### Client-authenticated
- **`POST /api/client/bookings`** (`Policy=ClientOnly`, Bearer) `CreateClientBookingRequest { unitId, checkInDate, checkOutDate, guestCount }` (`DateOnly`) → booking, status **Prospecting**, `source:"website"`.

### Booking status machine (for the admin smoke steps)
`Prospecting → {Relevant, NoAnswer, NotRelevant}`, `Relevant → {Booked, NoAnswer, NotRelevant}`, `Booked → {Confirmed, NotRelevant}`, `Confirmed → {CheckIn, Cancelled}`, `CheckIn → {Completed, LeftEarly}`. Holding (blocks availability): `{Booked, Confirmed, CheckIn}`.

---

## 3. Tickets

### TICKET 0 — Storefront infrastructure (`demo`)
Build the missing data/auth foundation, mirroring `rental-platform`. Deps already present: `react-hook-form`, `zod`, `date-fns`, `react-day-picker`, `framer-motion`, `lucide-react`. **Add `axios`.**

- [ ] **`demo/.env.local`** + **`demo/.env.example`**:
  - `NEXT_PUBLIC_API_URL=http://localhost:5001`
  - `NEXT_PUBLIC_STORAGE_URL=http://localhost:5001`
  - `NEXT_PUBLIC_PLATFORM_URL=http://localhost:3001`
- [ ] **`demo/src/lib/api/axios.ts`** — axios instance: `baseURL=NEXT_PUBLIC_API_URL`, `withCredentials:true`, `Content-Type/Accept: application/json`; request interceptor injects `Authorization: Bearer <token>` from the auth store; response handling unwraps `ApiResponse` and throws on `success:false`. Mirror `rental-platform/lib/api/axios.ts`.
- [ ] **`demo/src/lib/api/types.ts`** — `ApiResponse<T>`, `PaginationMeta`, `UnitListItem`, `UnitImage`, `Project`, `OperationalAvailability`, request DTOs (field-for-field from §2).
- [ ] **`demo/src/lib/api/services.ts`** — `unitsService.list(params)`, `projectsService.list()`, `availabilityService.check(unitId, range)`, `leadsService.create(payload)`, `bookingsService.createOwn(payload)`, `authService.refresh()`, `authService.logout()`.
- [ ] **`demo/src/lib/utils/format.ts`** — copy from `rental-platform/lib/utils/format.ts`:
  ```ts
  export function formatCurrency(amount: number | null | undefined): string {
    if (amount == null || Number.isNaN(amount)) return "—";
    return `${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EGP`;
  }
  export function formatDateForApi(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`; // local Y-M-D, no tz shift
  }
  export function parseDateOnly(value: string): Date {
    const [y, m, d] = value.split("-").map(Number);
    return new Date(y!, m! - 1, d);
  }
  ```
  Plus `resolveImageUrl(fileKey)` (see §2; confirm the platform's pattern).
- [ ] **`demo/src/lib/constants/project-slugs.ts`**:
  ```ts
  export const PROJECT_SLUG_ALIASES: Record<string, string> = {
    abraj: "Abraj Al Alamein", palm: "Palm Hills", mazarine: "Mazarine", gate: "The Gate",
  };
  export function resolveProjectId(slug: string | null, projects: Project[]): string | null {
    if (!slug) return null;
    const target = (PROJECT_SLUG_ALIASES[slug] ?? slug).toLowerCase();
    return projects.find(p => p.name.toLowerCase().includes(target))?.id ?? null;
  }
  ```
- [ ] **`demo/src/lib/validation.ts`** — phone regex `^\+?\d{10,15}$` + `sanitizePhoneInput` (copy from `rental-platform/lib/validations/auth.ts`); zod schemas for lead + booking forms.
- [ ] **Data hooks** (lightweight, no TanStack): `useUnits`, `useProjects`, `useUnit(id)`, `useAvailability(unitId, range)` using `useEffect`+state with loading/error/empty.

**Acceptance:** `npm --prefix demo run type-check` and `lint` clean; axios calls hit `:5001` and unwrap the envelope.

---

### TICKET 1 — Auth handoff + session bootstrap

**Storefront (`demo`):**
- [ ] **`demo/src/lib/auth/store.ts` + `AuthProvider`** (React context). Access token **in memory only**; user profile in state. On mount → `POST /api/auth/refresh`; if it returns an `AuthResponse`, populate the store. Expose `useAuth() → { isAuthenticated, user, accessToken, logout }`. Mount in `demo/src/app/(guest)/layout.tsx`. (This is what makes the session survive hard reload — the cookie is the durable carrier.)
- [ ] **`platformAuthUrl(kind: 'login'|'register', returnTo: string)`** → `${NEXT_PUBLIC_PLATFORM_URL}/auth/client/${kind}?returnUrl=${encodeURIComponent(returnTo)}`.
- [ ] **Repoint auth links** as external `<a>`: `demo/src/components/layout/Navbar.tsx` (`تسجيل الدخول`), `demo/src/app/(guest)/layout.tsx` (footer), `demo/src/components/ui/BottomNav.tsx`. Use `platformAuthUrl('login', window.location.href)`.
- [ ] **Make the demo's own auth pages redirect**: `demo/src/app/auth/client/login/page.tsx` + `register/page.tsx` → immediate redirect to `platformAuthUrl(...)`. Stop calling `setDemoRoleCookie('client')`.
- [ ] **Logout**: `useAuth().logout()` → `POST /api/auth/logout` + clear store. On any 401, clear store and show a "session expired — sign in" prompt (handles the "cookie cleared on :3001" edge case).

**Platform (`rental-platform`) — surgical:**
- [ ] **`lib/utils/return-url.ts`** — `isAllowedReturnUrl(url)` against an allowlist of origins (`["http://localhost:3000"]`, env-configurable) to prevent open redirect.
- [ ] **`app/(auth)/client/login/page.tsx`** — read `useSearchParams().get('returnUrl')`; pass to `useClientLogin`; in the already-authenticated `useEffect`, if returnUrl is allowlisted → `window.location.assign(returnUrl)` instead of `/account`.
- [ ] **`lib/hooks/useAuth.ts`** — extend `useClientLogin(returnUrl?)` and `useClientRegister(returnUrl?)`: in `onSuccess`, `isAllowedReturnUrl(returnUrl) ? window.location.assign(returnUrl) : router.push(ROUTES.client.account)`. (External origin needs `window.location.assign`, not `router.push`.)
- [ ] **`app/(auth)/client/register/page.tsx`** — thread `returnUrl` likewise.

**Acceptance:** From `:3000`, Sign in → `:3001/auth/client/login?returnUrl=http://localhost:3000/...` → after login, back on `:3000` and `useAuth().isAuthenticated === true`; hard reload preserves it. Invalid/foreign `returnUrl` falls back to `/account` (no open redirect).

---

### TICKET 2 — Live data: featured grid + search

- [ ] **Featured grid** — `demo/src/app/(guest)/page.tsx`, section "وحدات مختارة وجاهزة للحجز": replace `MOCK_UNITS.map` with `useUnits({ page:1, pageSize:6 })`. Map to the existing `UnitCard`: project label ← `projectName`; price ← `formatCurrency(basePricePerNight)`; images ← `images.map(resolveImageUrl)`. Drop `unit.rating`/`unit.description` (not in the list DTO) or default them. **Empty-images edge case:** render the existing `bg-gray-100` CSS placeholder instead of a broken `<img>`. Add loading skeletons + empty/error states.
- [ ] **Search** — `demo/src/app/(guest)/search/page.tsx`:
  - Read `?project=<slug>` via `useSearchParams`; `useProjects()`; `resolveProjectId(slug, projects)`.
  - Populate the project `<select>` from live projects (replace `MOCK_PROJECTS`); preselect the resolved project.
  - `useUnits({ projectId, page, pageSize })` for results (replace `MOCK_UNITS`); tie the skeleton to the real request (remove the fake 800ms timer). Empty state: "لا توجد وحدات متاحة في هذا المشروع حالياً".
  - Map markers/price badges use `formatCurrency`; positions stay decorative (no geo seed).
- [ ] **Unit detail** — `demo/src/app/(guest)/units/[id]/page.tsx`: fetch the unit live (by id) instead of `MOCK_UNITS`; price via `formatCurrency`; pass `unitId` + dates downstream.

**Acceptance:** Home shows real active units; `:3000/search?project=abraj` → only **Abraj Al Alamein** units; unmapped slug → graceful empty; no `MOCK_*` in guest bundle.

---

### TICKET 3 — Lead capture + booking submission (cross-persona core)

- [ ] **LeadForm** — `demo/src/components/sections/LeadForm.tsx` → `POST /api/crm/leads` (anon). Map `contactName←name`, `contactPhone←phone` (validate `^\+?\d{10,15}$`), `desiredCheckInDate/Out←checkIn/checkOut` (already `YYYY-MM-DD`), `guestCount←guests`, `source:"website"`; fold `tripType/budget/project` into `notes`. Add zod validation + double-submit guard. Keep the success screen. Lead lands in admin CRM as **Prospecting**.
- [ ] **Booking date selection** — `demo/src/components/ui/UnitBookingWidget.tsx`: replace the **mock calendar** with `react-day-picker`; serialize via `formatDateForApi` (no tz shift). Carry dates to checkout: `/checkout?unitId=…&checkIn=YYYY-MM-DD&checkOut=YYYY-MM-DD&guests=…`. Call `operational-check` and **disable `blockedDates`** so a confirmed range can't be re-picked. Keep the UX rule: calendar stays open through check-in selection, closes only after check-out is locked.
- [ ] **Checkout** — `demo/src/app/(guest)/checkout/page.tsx` → authenticated booking:
  - Read `unitId, checkIn, checkOut, guests` from query.
  - If `!useAuth().isAuthenticated`: show "سجّل الدخول لتأكيد الحجز" → `platformAuthUrl('login', currentCheckoutUrl)`.
  - If authenticated: `POST /api/client/bookings { unitId, checkInDate, checkOutDate, guestCount }` → **Prospecting**. Replace the WhatsApp fake with a real success confirmation (WhatsApp CTA optional/secondary). Double-click guard (disable + single in-flight request).
  - Totals via `formatCurrency`, `tabular-nums`.

**Acceptance:** LeadForm creates a real Prospecting lead; a 20-night booking from checkout creates a real Prospecting booking; rapid double-click sends one request.

---

### TICKET 4 — Formatting & design conformance (verification gate)

- [ ] **Currency:** grep `demo` for `.toLocaleString()` / `EGP ` — replace every price (home card, search card + map badges, unit detail, checkout totals) with `formatCurrency` (always `…,….00 EGP`) + `font-variant-numeric: tabular-nums`.
- [ ] **Dates:** all date payloads are raw `YYYY-MM-DD` via `formatDateForApi` (never `toISOString()`).
- [ ] **Phone:** all phone inputs enforce `^\+?\d{10,15}$`.
- [ ] **Identity preserved:** keep the storefront's distinctive Arabic marketing aesthetic (brand/accent palette, large radii, video hero). **Do not** impose the admin 8px/hairline tokens on the marketing site — the 8px/terracotta-spotlight audit applies to the **platform** portals (already compliant). Touch targets already ≥40px.

---

### TICKET 5 — Backend (verify only, no code expected)
- [ ] Confirm CORS already allows credentialed `:3000` calls (it does). No dev change.
- [ ] **Conditional:** only if the live `:3000 → :5001` `/api/auth/refresh` fails to send the cookie, relax `SetRefreshTokenCookie` in `RentalPlatform.API/Controllers/AuthController.cs` to `SameSite=None; Secure=true` (dev-safe on `localhost`). **Verify with a live test first** — expected to be unnecessary. **No prod change.**

---

## 4. Critical files

**Storefront (`demo`) — new:** `.env.local`, `src/lib/api/{axios,types,services}.ts`, `src/lib/utils/format.ts`, `src/lib/constants/project-slugs.ts`, `src/lib/validation.ts`, `src/lib/auth/{store.ts,AuthProvider.tsx}`, data hooks.
**Storefront — modified:** `src/app/(guest)/{page.tsx,search/page.tsx,units/[id]/page.tsx,checkout/page.tsx,layout.tsx}`, `src/components/sections/LeadForm.tsx`, `src/components/ui/UnitBookingWidget.tsx`, `src/components/layout/Navbar.tsx`, `src/components/ui/BottomNav.tsx`, `src/app/auth/client/{login,register}/page.tsx`. Remove guest-facing `MOCK_UNITS`/`MOCK_PROJECTS` (delete from `src/lib/mock-data/index.ts` if unreferenced).
**Platform (`rental-platform`) — modified:** `app/(auth)/client/login/page.tsx`, `app/(auth)/client/register/page.tsx`, `lib/hooks/useAuth.ts`, new `lib/utils/return-url.ts`.
**Backend — verify (likely no change):** `RentalPlatform.API/Program.cs`, `Controllers/AuthController.cs`.

---

## 5. Verification — end-to-end smoke test (= GLOBAL-QA checklist)

Run **local dev only**; never prod; nothing pushed. Bring up API (`docker compose up -d api`, `:5001`), platform (`:3001`), storefront (`:3000`). `npm --prefix demo run type-check && lint && build` clean; platform likewise.

1. [ ] **Live grid** — `:3000` featured section: real active units, images (or CSS fallback), prices `…,….00 EGP`. No `MOCK_*` in bundle.
2. [ ] **Live search** — `:3000/search?project=abraj` → only **Abraj Al Alamein** active units; unmapped slug → graceful empty.
3. [ ] **Auth handoff** — Sign in → `:3001/auth/client/login?returnUrl=http://localhost:3000/...`; register/login **Hozaifa Almelli** (phone-based) → back on `:3000`; `Ctrl+F5` keeps the session. No console errors.
4. [ ] **Booking** — pick a 20-night range (calendar stays open until check-out locked; totals `…,….00 EGP`) → `POST /api/client/bookings` creates **Prospecting**; double-click sends one request.
5. [ ] **Admin (incognito, `:3001`)** — lead/booking for Hozaifa shows in CRM as Prospecting (no empty fields); Prospecting→Relevant→Booked, Confirm (deposit form + receipt upload), re-issue invoice; persists on reload; no server errors.
6. [ ] **Owner (`:3001`)** — payout/transaction rows show real **Unit** + **Client** names (not UUIDs); strict multi-tenant isolation in payloads.
7. [ ] **Global lockout** — after the booking hits a holding status, `:3000` unit `operational-check` returns the range unavailable across channels.
8. [ ] **Conformance** — whole-integer totals still render `19,000.00`; dates carry as `YYYY-MM-DD` with zero day-shift across tz; phone inputs reject invalid formats; targets ≥40px; storefront keeps its identity.
9. [ ] **Playwright** (`mcp__plugin_playwright`) — script steps 1–4 + 7; assert prices, returnUrl handoff, session persistence, console clean.

---

## 6. Out of scope
- No DB/schema changes; no migration. No production deploys, CORS, cookies, or test accounts. No commit/push unless asked.
- No platform-wide design-token / zero-mock audit (GLOBAL-QA is a verification gate). The demo's internal mock admin/owner dashboards stay as-is — the real flow uses the platform (`:3001`).
- Storefront does not reimplement auth forms; it redirects to the platform.
