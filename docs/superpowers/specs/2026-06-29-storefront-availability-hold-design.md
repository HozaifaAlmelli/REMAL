# Design Spec — Storefront ↔ Portal Availability Correspondence (Soft Holds for Pipeline Bookings)

**Date:** 2026-06-29
**Status:** Design — awaiting user review before implementation plan
**Scope:** `demo` (public storefront, :3000), `rental-platform` (portals, :3001), `RentalPlatform.*` (.NET API, :5001)

---

## 1. Problem

A customer who completes the storefront booking flow (`POST /api/client/bookings`) creates a `Booking` born at status **`Prospecting`**. The availability endpoint that every calendar reads only treats **firm** statuses as occupied:

```
BookingStatusTransitions.HoldingStatuses = { Booked, Confirmed, CheckIn }
```

`Prospecting` and `Relevant` are **not** in that set, so:

1. A customer's own booking request does **not** make the dates show as unavailable anywhere.
2. **Two customers can book the exact same nights** — the creation-time overlap guard (`EnsureNoConfirmedOverlap`) also checks only `HoldingStatuses`, so the second Prospecting booking is accepted.
3. The nights become unavailable only once an admin manually walks the booking to `Booked`/`Confirmed`.

The user's requirement: **a storefront booking request must hold (occupy) the dates across all calendars, double-booking at the request stage must be impossible, and releasing the request (→ `NotRelevant`) must reopen the dates everywhere.**

## 2. Root cause (verified in code)

The system **already distinguishes soft vs. firm holds — but only in one layer.** `DateBlockApprovalService` carries:

```csharp
private static readonly BookingStatus[] HardBookingStatuses = { Booked, Confirmed, CheckIn };
private static readonly BookingStatus[] SoftBookingStatuses = { Prospecting, Relevant };
```

Owner-block preflight already classifies a `Prospecting`/`Relevant` overlap as `requires_approval` ("overlaps an active inquiry"). But `UnitAvailabilityService.CheckOperationalAvailabilityAsync` — the single endpoint every calendar reads (`POST /api/units/{unitId}/availability/operational-check`) — **ignores the soft set entirely**, so the calendar shows those nights as free.

**That asymmetry is the bug.** The calendar disagrees with the preflight. The fix is to make availability honor the soft set the backend already recognizes.

### Two mechanics that shape the solution (verified)

- **Portal release is already wired.** Every booking transition hook (`lib/hooks/useBookings.ts`) calls `invalidateUnitAvailability()`, invalidating **both** `["units", id, "availability"]` and `["ownerPortal", "unitAvailability", id]`. The owner calendar also polls every 30s. So once soft holds block, moving a booking to `NotRelevant`/`Cancelled` reopens the **portal** calendars automatically. No change needed here.
- **The storefront does NOT auto-refresh.** `demo`'s `useAvailability` (`src/lib/hooks/useCatalog.ts`) is a bare `useEffect` keyed only on `[unitId, startDate, endDate]` — **no poll, no focus-refetch.** A separate process can't share the portal's cache, so the storefront will show stale availability until we add a refresh. This must be fixed regardless of the hold model.

## 3. Design

### 3.1 Principle: additive soft-hold layer, no behavior change for existing consumers

We **do not** change `HoldingStatuses` (it has firm/finance semantics across ~7 call sites). Instead we add a soft-hold concept that is **additive** to the availability response, so existing consumers of `isAvailable`/`blockedDates` are untouched, and new behavior is opt-in per caller.

### 3.2 Backend

**a. Centralize the soft/firm sets** (`RentalPlatform.Shared/Constants/BookingStatusTransitions.cs`)
- Keep `HoldingStatuses = { Booked, Confirmed, CheckIn }` (firm — unchanged).
- Add `SoftHoldStatuses = { Prospecting, Relevant }`.
- Refactor `DateBlockApprovalService` to consume these shared constants instead of its private duplicates (single source of truth).

**b. Availability endpoint** (`UnitAvailabilityService.CheckOperationalAvailabilityAsync`)
- Keep `blockedDates` = firm bookings (`HoldingStatuses`) ∪ approved/pending date blocks. **Unchanged.**
- Keep `isAvailable` / `reason` **firm-only and unchanged** — so the **CRM lead-date guard** (`EnsureDesiredDatesAvailableAsync`), which throws on `!isAvailable`, is **not** made stricter (a phone inquiry must not be blocked by a soft web hold).
- **Add** a new response field `heldDates: string[]` = nights occupied by `SoftHoldStatuses` bookings overlapping the range.
- DTO/response (`OperationalAvailabilityResponse`) gains `heldDates`; this is purely additive.

**c. Client self-service creation guard**
- The storefront endpoint (`ClientBookingsController` → client booking create path) gets a guard that rejects creation when the requested range overlaps **any active booking** (`SoftHoldStatuses ∪ HoldingStatuses`), excluding self → prevents double-Prospecting. Returns a clean `409 Conflict` with a "those dates were just requested/booked" message.
- **Admin/CRM creation paths (quick-booking, lead→booking conversion) keep the firm-only overlap check** so an operator can deliberately override a soft web hold (the portal calendar will show them the held state). This preserves the brokerage's ability to choose between competing demand.
- *Implementation note:* confirm the exact method the client endpoint uses (`CreateAsync` vs `CreateQuickAsync`) and where `EnsureNoConfirmedOverlap` runs; add the soft-aware check on the client path only.

### 3.3 Storefront (`demo`)

- `src/lib/api/types.ts`: add `heldDates: string[]` to `OperationalAvailability`.
- `src/components/ui/UnitBookingWidget.tsx`: disable `blockedDates ∪ heldDates` in the DayPicker; render held nights with a distinct muted style + label ("requested") so they read differently from firm-booked.
- `src/lib/hooks/useCatalog.ts` (`useAvailability`): add **window-focus refetch + a light interval poll (~60s)** while mounted, so an open page reopens nights after an admin releases them. Keep it lightweight (no new heavy dep).
- `src/app/(guest)/checkout/page.tsx`: re-run `availabilityService.check()` for the selected range immediately before `createOwn()`; treat the range as unselectable if it intersects `blockedDates ∪ heldDates` (not just the firm-only `isAvailable`), and abort with a clear message. The backend `409` from the client creation guard is the authoritative backstop — handle it gracefully ("those dates were just taken — pick again").

### 3.4 Portal (`rental-platform`)

- `lib/types/unit.types.ts`: add `heldDates: string[]` to `OperationalAvailabilityResponse`.
- **Owner calendar** (`components/owner/units/OwnerAvailabilityCalendar.tsx`): add a **4th category** `requested`/`held` (today it has `cal-booked` / `cal-owner` / `cal-pending`) rendered distinctly, plus a legend dot "Requested". Held nights keep preflight `requires_approval` (owner may still request an override) — calendar and preflight now agree.
- **Admin calendar** (`components/admin/units/AvailabilityCalendar.tsx`): render held nights distinctly from firm-blocked (today everything occupied is one red), with a reason.
- Query invalidation: **no change** — booking transitions already invalidate both availability keys. Storefront-created bookings reach the portal on its next poll/focus (owner 30s; admin on focus/mount) — acceptable; cross-app push is not possible.

### 3.5 Stale-hold safety (admin)

- `app/(admin)/bookings/page.tsx`: add a filter/badge surfacing **aged** `Prospecting`/`Relevant` bookings (e.g. held > N days), computed from existing `CreatedAt` + status, so the manual-release model never silently locks a unit. No new data required.

## 4. Behavior after the change (scenario summary)

| Scenario | Result |
|---|---|
| A books available nights | Held everywhere (Prospecting). Portal instant on its refetch; storefront on its next poll/focus. |
| B picks same nights | Picker disables them; if bypassed, client creation guard returns 409. No double-Prospecting. |
| Sales → `NotRelevant` | Booking leaves held set; portal calendars reopen instantly (invalidation + 30s poll); storefront reopens on next poll/focus. |
| Sales → `Relevant` | Stays held (Relevant is in the soft set) — no mid-pipeline reopen. |
| Sales → `Booked`/`Confirmed` | Becomes firm hold (existing behavior). |
| Owner blocks held nights | Calendar shows occupied; preflight `requires_approval` (overridable) — now consistent. |
| Admin quick-book / lead conversion over a soft web hold | Allowed (firm-only guard); operator deliberately overrides; stale-hold view helps them decide. |
| A abandons request | Stays held until a human declines it; stale-hold filter mitigates. (Auto-expiry deferred — see §6.) |

## 5. Non-goals / constraints

- **No DB schema change.** All changes are an additive response field + computed queries + frontend rendering. No migration.
- **No new booking statuses.** Reuse `Prospecting`/`Relevant`.
- **CRM leads (`CrmLead`) are untouched** — they are a separate table the availability endpoint never queries; the soft-inquiry funnel stays soft.
- **Local dev only.** No production deploy, no prod CORS/cookie change. Nothing committed/pushed unless explicitly requested.
- WCAG 2.1 AA: the new "requested/held" calendar color is graphical/large → ≥3:1; verify against its background.

## 6. Deferred (not in this spec)

- **48h auto-expiry of soft holds** (computed `CreatedAt > now − window`, still no schema). Cheap to add later; deferred because it introduces "booking still reads Prospecting in CRM after its hold expired," which can silently displace a customer who believes they hold the dates. Revisit if abandonment becomes an operational problem.

## 7. Verification plan

- **Backend unit tests:** `CheckOperationalAvailabilityAsync` returns correct `heldDates`; client creation guard rejects soft overlaps with 409; lead-date guard unaffected by soft holds; admin/quick-booking still overrides soft holds.
- **E2E (Playwright, local dev):** A books → storefront + owner + admin show held → B blocked (picker + 409) → admin `NotRelevant` → portal reopens immediately, storefront reopens within the poll/focus window.
- **Contrast:** new calendar category meets AA.
- **Build:** `demo` and `rental-platform` type-check + lint + build clean.
