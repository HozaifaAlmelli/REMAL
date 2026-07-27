'

markdown

# Wave 0 — Foundation & Infrastructure
## Rental Platform Frontend — Complete Ticket Pack
**Wave Number:** 0
**Wave Name:** Foundation & Infrastructure
**Total Tickets:** 9
**Estimated Days (1 dev):** 4
**Parallel Tracks:** No — fully serial. Every ticket blocks the next ones.
**Critical Path:** Yes — blocks ALL other waves.

---

## Wave 0 Overview

This wave creates the foundation that every other wave depends on. Nothing here ships visible features — but everything here MUST be in place before the first user-facing page can be built. Skipping or shortcutting any ticket here will cause cascading rework in later waves.

**What this wave produces:**
- A working Next.js 14 project with strict TypeScript
- The complete folder structure for all future code
- A configured Axios instance ready to talk to the backend
- Zustand stores for auth and UI state (no server data ever)
- TanStack Query configured globally with query keys factory
- A complete Design System (CSS variables + Tailwind + fonts) — required by Wave 7
- Lenis smooth scroll + Framer Motion page transitions — required by Wave 7
- Shared utilities, types, and constants ready to import

**Dependencies on this wave:**
- Wave 1 cannot start until ALL Wave 0 tickets are merged
- The Guest App (Wave 7) specifically depends on tickets 8 and 9 for animation infrastructure

---

---

## Ticket List

| # | Ticket ID | Title | Priority |
|---|-----------|-------|----------|
| 1 | FE-0-INFRA-01 | Initialize Next.js project with full dependency setup | Critical |
| 2 | FE-0-INFRA-02 | Create complete folder structure scaffold | Critical |
| 3 | FE-0-INFRA-03 | Create Axios instance with interceptors | Critical |
| 4 | FE-0-INFRA-04 | Create endpoints constants file (all 139 endpoints) | Critical |
| 5 | FE-0-INFRA-05 | Create Zustand stores (auth + UI) | Critical |
| 6 | FE-0-INFRA-06 | Configure TanStack Query and query keys factory | Critical |
| 7 | FE-0-INFRA-07 | Create shared utilities, types, and constants scaffold | Critical |
| 8 | FE-0-INFRA-08 | Build Design System (CSS variables + Tailwind config + fonts) | Critical |
| 9 | FE-0-INFRA-09 | Build Smooth Scroll Provider and Page Transitions setup | Critical |

---

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TICKET ID: FE-0-INFRA-01
TITLE: Initialize Next.js project with full dependency setup
WAVE: Wave 0 — Foundation & Infrastructure
DOMAIN: INFRA
PRIORITY: Critical
DEPENDS ON: None
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section 1 — Walkthrough

**What is this ticket about?**
Before any code can be written, we need a working Next.js 14 project with every dependency the entire Frontend Plan will use over the next 8 waves. This includes the framework itself (Next.js, React, TypeScript, Tailwind), the data layer (Axios, TanStack Query, Zustand), forms (React Hook Form, Zod), the entire animation stack the Guest App needs (GSAP, Lenis, Framer Motion, split-type), the UI utilities (lucide-react, date-fns, clsx, tailwind-merge), and the heavy libraries that Wave 7 needs (Mapbox, Swiper, Recharts). All of these must be installed and configured at the very start so no later ticket has to stop and install something mid-implementation.

**Why does this ticket exist NOW (in this wave)?**
Without this, no other ticket can start. Every other Wave 0 ticket depends on a working `npm run dev` and the dependencies being available. If we discover mid-Wave-7 that we forgot to install GSAP, the entire Guest App work pauses while dependencies are added — that's why the full list goes in NOW.

**What does success look like?**
A developer (or AI implementer) can clone the repo, run `pnpm install`, run `pnpm dev`, and see the default Next.js page rendering. Running `pnpm build` succeeds with zero TypeScript errors. Every package required by the entire 117-ticket plan is already in `package.json`.

---

### Section 2 — Objective

Create a fully configured Next.js 14 project with TypeScript strict mode, App Router, Tailwind CSS, and every dependency required for the 117-ticket Frontend Plan installed and working, so no future ticket has to stop to install a missing package.

---

### Section 3 — User-Facing Outcome

This ticket has no end-user outcome — it is pure infrastructure. The developer/AI implementer can:
- Run `pnpm install` without errors
- Run `pnpm dev` and see the Next.js dev server running on port 3000
- Run `pnpm build` and complete a clean production build
- Import any of the planned dependencies (axios, gsap, mapbox-gl, etc.) without "module not found" errors
- Use the `@/` path alias to import from anywhere in the project

---

### Section 4 — In Scope

- [ ] Initialize Next.js project: `pnpm create next-app@latest rental-platform --typescript --tailwind --app --src-dir=false --import-alias="@/*"`
- [ ] Configure `tsconfig.json` with strict mode enabled
- [ ] Configure `next.config.ts` with image domains for the API server
- [ ] Configure `tailwind.config.ts` with default content paths (Design System config goes in FE-0-INFRA-08, NOT here)
- [ ] Create `.env.example` template
- [ ] Create `.env.local` (gitignored)
- [ ] Update `.gitignore` to include `.env.local`, `.next`, `node_modules`, etc.
- [ ] Install ALL dependencies listed in section 6d below
- [ ] Configure `package.json` scripts: `dev`, `build`, `start`, `lint`, `type-check`
- [ ] Add Prettier config + Prettier Tailwind plugin
- [ ] Verify `pnpm dev` starts cleanly
- [ ] Verify `pnpm build` succeeds with zero errors

**Files to create:**
- `package.json` — full dependency list (see section 6d)
- `tsconfig.json` — strict TypeScript config
- `next.config.ts` — Next.js configuration with image domains
- `tailwind.config.ts` — base Tailwind config (Design System tokens added in FE-0-INFRA-08)
- `postcss.config.mjs` — PostCSS for Tailwind
- `.env.example` — environment variable template
- `.env.local` — local environment (gitignored)
- `.gitignore` — git ignore rules
- `.prettierrc` — Prettier config
- `.prettierignore` — Prettier ignore patterns
- `app/layout.tsx` — root layout (placeholder, populated by FE-0-INFRA-08)
- `app/page.tsx` — placeholder homepage (replaced in Wave 7)
- `app/globals.css` — empty CSS file (populated by FE-0-INFRA-08)

**Files to modify:** None — this is the project initialization.

---

### Section 5 — Out of Scope

- Do NOT add any folder structure beyond what `create-next-app` creates by default — folder scaffold is a separate ticket (FE-0-INFRA-02)
- Do NOT configure the Axios instance here — that is FE-0-INFRA-03
- Do NOT set up Zustand stores — that is FE-0-INFRA-05
- Do NOT configure TanStack Query — that is FE-0-INFRA-06
- Do NOT add any Design System tokens (colors, fonts, shadows) to `tailwind.config.ts` — that is FE-0-INFRA-08
- Do NOT load custom fonts in `app/layout.tsx` — that is FE-0-INFRA-08
- Do NOT add Lenis Smooth Scroll Provider — that is FE-0-INFRA-09
- Do NOT add `template.tsx` for page transitions — that is FE-0-INFRA-09
- Do NOT create any UI components — Wave 1
- Do NOT create any pages beyond the placeholder home — Wave 1+
- Do NOT install `@types/*` packages for libraries that ship their own types (axios, zustand, etc.)

---

### Section 6 — Technical Contract

#### 6a. Component Props Interface

N/A — no components in this ticket.

#### 6b. Hook Return Type

N/A — no hooks in this ticket.

#### 6c. Zod Schema

N/A — no forms in this ticket.

#### 6d. Key Enums / Constants Used

The following must appear in `package.json` `dependencies` (production):

```json
{
  "next": "^14.2.0",
  "react": "^18.3.0",
  "react-dom": "^18.3.0",
  "typescript": "^5.4.0",
  "axios": "^1.6.0",
  "@tanstack/react-query": "^5.51.0",
  "@tanstack/react-query-devtools": "^5.51.0",
  "@tanstack/react-table": "^8.17.0",
  "zustand": "^5.0.0",
  "react-hook-form": "^7.52.0",
  "@hookform/resolvers": "^3.9.0",
  "zod": "^3.23.0",
  "react-day-picker": "^9.0.0",
  "date-fns": "^3.6.0",
  "clsx": "^2.1.0",
  "tailwind-merge": "^2.3.0",
  "lucide-react": "^0.400.0",
  "react-hot-toast": "^2.4.0",
  "recharts": "^2.12.0",
  "swiper": "^11.1.0",
  "mapbox-gl": "^3.4.0",
  "gsap": "^3.12.5",
  "@gsap/react": "^2.1.1",
  "lenis": "^1.1.0",
  "framer-motion": "^11.2.0",
  "split-type": "^0.3.4",
  "next-view-transitions": "^0.3.0"
}
```

The following must appear in `package.json` `devDependencies`:

```json
{
  "@types/node": "^20.11.0",
  "@types/react": "^18.2.0",
  "@types/react-dom": "^18.2.0",
  "@types/mapbox-gl": "^3.4.0",
  "tailwindcss": "^3.4.0",
  "@tailwindcss/forms": "^0.5.7",
  "@tailwindcss/typography": "^0.5.10",
  "postcss": "^8.4.0",
  "autoprefixer": "^10.4.0",
  "eslint": "^8.57.0",
  "eslint-config-next": "^14.2.0",
  "prettier": "^3.2.0",
  "prettier-plugin-tailwindcss": "^0.5.0"
}
```

`tsconfig.json` must include:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "baseUrl": ".",
    "paths": { "@/*": ["./*"] },
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

`.env.example` must include:

```
# API
NEXT_PUBLIC_API_URL=http://localhost:8080
NEXT_PUBLIC_APP_ENV=development

# Mapbox (for FE-7-PUB Map Section)
NEXT_PUBLIC_MAPBOX_TOKEN=
```

`package.json` scripts:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "type-check": "tsc --noEmit",
    "format": "prettier --write ."
  }
}
```

---

### Section 7 — API Integration

N/A — no API calls in this ticket.

---

### Section 8 — State & Data Management Rules

N/A — no state management in this ticket. The state infrastructure (Zustand, TanStack Query) is set up in FE-0-INFRA-05 and FE-0-INFRA-06 respectively.

**Rules for this ticket:**
- [x] No state management code in this ticket
- [x] No data fetching code in this ticket
- [x] No `localStorage` or `sessionStorage` introduced

---

### Section 9 — Component & File Deliverables

#### Files to CREATE:

```
package.json                  ← all dependencies + scripts
pnpm-lock.yaml                ← generated by pnpm install
tsconfig.json                 ← strict TypeScript config
next.config.ts                ← Next.js config with image domains
tailwind.config.ts            ← base Tailwind config (no design tokens yet)
postcss.config.mjs            ← PostCSS config
next-env.d.ts                 ← auto-generated by Next.js
.env.example                  ← environment template
.env.local                    ← local env (gitignored, empty/placeholder values)
.gitignore                    ← git ignore patterns
.prettierrc                   ← Prettier config
.prettierignore               ← Prettier ignore patterns
README.md                     ← minimal — project name + setup commands

app/
  layout.tsx                  ← root layout — minimal placeholder
  page.tsx                    ← homepage placeholder (will be replaced in Wave 7)
  globals.css                 ← empty CSS file (populated by FE-0-INFRA-08)
```

#### Files to MODIFY:

None — this is project initialization.

#### Files NOT to touch:

```
Any file under app/ beyond layout.tsx, page.tsx, globals.css   ← later wave responsibility
```

---

### Section 10 — UX & Loading State Rules

| State | Required? | Behavior |
|---|---|---|
| Loading | N/A | No UI yet |
| Empty | N/A | No UI yet |
| Error | N/A | No UI yet |
| Success | N/A | No UI yet |

**Note:** UX state rules apply starting from Wave 1 onwards. Wave 0 has no user-facing UI.

---

### Section 11 — Verification Steps

**Setup:**
1. Ensure Node.js 20.x or higher is installed: `node -v`
2. Ensure pnpm is installed: `pnpm -v` (install via `npm install -g pnpm` if missing)

**Happy path:**
1. From an empty directory, run the project init command → expected: project files generated
2. Run `pnpm install` → expected: all dependencies install without errors, `pnpm-lock.yaml` is created
3. Run `pnpm dev` → expected: Next.js dev server starts on http://localhost:3000 with no errors in terminal
4. Open http://localhost:3000 in browser → expected: default Next.js placeholder page renders
5. Run `pnpm build` → expected: production build succeeds with zero TypeScript errors
6. Run `pnpm type-check` → expected: zero output (means zero errors)
7. Run `pnpm lint` → expected: zero ESLint errors
8. In any TS file, type `import { x } from '@/lib/...'` → expected: VS Code recognizes the `@/` alias

**Edge cases:**
1. Try to import `gsap` in a test file → expected: imports successfully
2. Try to import `mapbox-gl` in a test file → expected: imports successfully (warns about being client-only — that's normal)
3. Try to import `lenis` in a test file → expected: imports successfully
4. Try to use a TypeScript `any` type → expected: ESLint or `noUncheckedIndexedAccess` flags it

**Permission test:**
N/A — no auth or permissions in this ticket.

---

### Section 12 — Acceptance Criteria

**Functionality:**
- [ ] `pnpm install` completes without errors
- [ ] `pnpm dev` starts the dev server on port 3000
- [ ] `pnpm build` completes without errors
- [ ] `pnpm type-check` returns zero TypeScript errors
- [ ] `pnpm lint` returns zero errors
- [ ] Default homepage renders at http://localhost:3000

**Data & State:**
- [x] N/A — no state in this ticket

**UX States:**
- [x] N/A — no UI in this ticket

**TypeScript:**
- [ ] `tsconfig.json` has `strict: true`
- [ ] `tsconfig.json` has `noUncheckedIndexedAccess: true`
- [ ] `tsconfig.json` has `noImplicitReturns: true`
- [ ] `tsconfig.json` has `noFallthroughCasesInSwitch: true`
- [ ] `@/*` path alias resolves correctly
- [ ] Zero TypeScript errors when running `pnpm type-check`

**Architecture:**
- [ ] Project uses App Router (not Pages Router)
- [ ] Tailwind is configured (will receive design tokens in FE-0-INFRA-08)
- [ ] All dependencies listed in section 6d are installed at the specified version ranges
- [ ] `.env.example` documents `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_APP_ENV`, `NEXT_PUBLIC_MAPBOX_TOKEN`
- [ ] `.env.local` is in `.gitignore`

**Performance:**
- [x] N/A — no rendering optimizations in this ticket

**Role-based access:**
- [x] N/A — no auth in this ticket

---

### Section 13 — Notes for AI / Common Mistakes

**DO:**
- Use `pnpm` as the package manager — not npm or yarn
- Install ALL packages listed in section 6d, even if no current ticket uses them — every package is needed by some later ticket
- Use exact version ranges (`^x.y.z`) as specified — not `latest` or `*`
- Run `pnpm install` after editing `package.json` to update the lockfile
- Verify `pnpm build` succeeds at the end — this catches type errors early
- Use Next.js 14 App Router — NOT Pages Router

**DO NOT:**
- ⛔ DO NOT USE ANY MOCK DATA. This is an infrastructure ticket, but for ALL future tickets in this project: never use hardcoded arrays, JSON files with fake data, faker.js, MSW, or any mock data libraries. Every piece of data must come from the real backend API. Even during local development, the dev server must connect to a running backend instance.
- Do NOT install `@types/axios`, `@types/zustand`, `@types/zod` — these libraries ship their own TypeScript types
- Do NOT use `npm install` — use `pnpm install` exclusively
- Do NOT use `create-react-app` — this is a Next.js project
- Do NOT add any TypeScript override flags (`// @ts-ignore`, `// @ts-nocheck`)
- Do NOT add `"strict": false` to `tsconfig.json` even if errors appear — fix the errors instead
- Do NOT create folders beyond what `create-next-app` creates — that is FE-0-INFRA-02's job
- Do NOT initialize Zustand stores in this ticket — that is FE-0-INFRA-05
- Do NOT add Design System tokens to `tailwind.config.ts` here — that is FE-0-INFRA-08
- Do NOT use `localStorage` anywhere in any ticket of this project
- Do NOT skip `noUncheckedIndexedAccess` — it catches real bugs
- Do NOT remove the `@types/mapbox-gl` package — Mapbox does not ship its own types

**WATCH OUT FOR:**
- The Next.js `--src-dir=false` flag is critical: we use `app/` at the root, not `src/app/`
- Some packages (like `@studio-freight/react-lenis`) are deprecated. The plan uses `lenis@1.1.0` directly — do NOT install the deprecated wrapper
- `next-view-transitions` is small but separate from `framer-motion` — both are installed
- If `pnpm install` fails on `mapbox-gl` due to native dependencies, that's a system-level issue and must be flagged, not worked around
- Some libraries (Recharts, Mapbox, GSAP) trigger SSR warnings — these are handled in later tickets via `dynamic()` imports, not here

**REFERENCES:**
- TravelSensations-Clone-FINAL.md Section 2 — full tech stack rationale
- Backend Swagger — confirms `NEXT_PUBLIC_API_URL` will point to the .NET 8 API at port 8080
- Implementation Plan Wave 0 — original ticket FE-0-INFRA-01 (this ticket extends it with full dependency list)
- Related: FE-0-INFRA-08 (Design System config in Tailwind), FE-0-INFRA-09 (Smooth Scroll Provider)

---

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TICKET ID: FE-0-INFRA-02
TITLE: Create complete folder structure scaffold
WAVE: Wave 0 — Foundation & Infrastructure
DOMAIN: INFRA
PRIORITY: Critical
DEPENDS ON: FE-0-INFRA-01
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section 1 — Walkthrough

**What is this ticket about?**
A 117-ticket plan splits work across many domains (Auth, UI, CRM, Bookings, Finance, Owner Portal, Guest App, etc.). Without a predefined folder structure, every ticket would invent its own paths — leading to duplicate folders, inconsistent imports, and refactor pain. This ticket creates every folder the entire plan will need, with placeholder `index.ts` barrel files where appropriate, so every future ticket simply drops files into already-existing locations.

**Why does this ticket exist NOW (in this wave)?**
Once Wave 1 starts, multiple developers/AI implementers will be creating files across many domains in parallel. Without a pre-built structure, paths will conflict (e.g., one creates `lib/api/services/`, another creates `lib/services/api/`). The structure is set ONCE here, then everything snaps into place.

**What does success look like?**
A developer (or AI implementer) opens the project tree and sees every domain folder already exists: `app/(admin)/`, `app/(owner)/`, `app/(public)/`, `app/(auth)/`, plus `components/admin/crm/`, `components/admin/bookings/`, `components/owner/`, `components/public/`, `lib/api/services/`, `lib/hooks/`, `lib/types/`, `lib/utils/`, `lib/constants/`, `lib/stores/`. They never have to ask "where does this file go?"

---

### Section 2 — Objective

Create the complete folder structure for the entire 117-ticket plan with placeholder files where needed, so every future ticket has a clear, conflict-free location to drop its files.

---

### Section 3 — User-Facing Outcome

This ticket has no end-user outcome — it is structural. The developer/AI implementer can:
- Open the file tree and find every folder needed for any ticket already created
- Know exactly where to place new files based on domain naming conventions
- Run `pnpm dev` after this ticket without any folder-related errors

---

### Section 4 — In Scope

- [ ] Create all `app/` route groups: `(admin)`, `(owner)`, `(public)`, `(auth)`
- [ ] Create all `components/` subfolders by domain
- [ ] Create all `lib/` subfolders: `api`, `hooks`, `stores`, `types`, `utils`, `constants`, `providers`
- [ ] Add a `.gitkeep` file in every empty folder so git tracks them
- [ ] Add empty `index.ts` barrel files where folders will export multiple symbols (e.g., `lib/types/index.ts`, `lib/constants/index.ts`)
- [ ] Verify the structure matches the documented tree exactly
- [ ] Verify `pnpm dev` and `pnpm build` still succeed

**Files to create:** See section 9 for the full tree.

**Files to modify:** None.

---

### Section 5 — Out of Scope

- Do NOT create any actual TypeScript code in any of these folders — only `.gitkeep` and empty `index.ts` files
- Do NOT create the Axios instance, stores, or any utility — those are separate tickets in this wave
- Do NOT create page files (`page.tsx`) for any route group — those are wave-specific tickets
- Do NOT create layout files (`layout.tsx`) for route groups — those are wave-specific tickets
- Do NOT add components to any `components/` folder — Wave 1+

---

### Section 6 — Technical Contract

#### 6a. Component Props Interface

N/A.

#### 6b. Hook Return Type

N/A.

#### 6c. Zod Schema

N/A.

#### 6d. Key Enums / Constants Used

N/A — this ticket only creates folders.

---

### Section 7 — API Integration

N/A.

---

### Section 8 — State & Data Management Rules

N/A.

---

### Section 9 — Component & File Deliverables

#### Files to CREATE:

The complete folder tree:

```
app/
  (admin)/
    .gitkeep                            ← will hold admin route group
  (owner)/
    .gitkeep
  (public)/
    .gitkeep
  (auth)/
    .gitkeep
  api/
    .gitkeep                            ← reserved for Next.js API routes if needed
  not-found.tsx                         ← placeholder, real one in FE-8-QA-07
  error.tsx                             ← placeholder, real one in FE-8-QA-07

components/
  ui/
    index.ts                            ← empty barrel (will export Button, Input, Modal, etc.)
  admin/
    layout/.gitkeep
    crm/.gitkeep
    bookings/.gitkeep
    units/.gitkeep
    finance/.gitkeep
    owners/.gitkeep
    clients/.gitkeep
    reviews/.gitkeep
    notifications/.gitkeep
    dashboard/.gitkeep
    settings/.gitkeep
  owner/
    layout/.gitkeep
    units/.gitkeep
    bookings/.gitkeep
    finance/.gitkeep
    dashboard/.gitkeep
    notifications/.gitkeep
    reviews/.gitkeep
  public/
    layout/.gitkeep
    hero/.gitkeep
    sections/.gitkeep
    cards/.gitkeep
    search/.gitkeep
    unit/.gitkeep
    account/.gitkeep
    booking/.gitkeep
    animations/.gitkeep
  auth/
    .gitkeep                            ← shared auth UI components

lib/
  api/
    .gitkeep                            ← will hold axios.ts, endpoints.ts
    services/
      .gitkeep                          ← will hold per-domain service files
  hooks/
    .gitkeep                            ← will hold useXxx custom hooks
  stores/
    .gitkeep                            ← will hold Zustand stores
  types/
    index.ts                            ← empty barrel for re-exports
  utils/
    index.ts                            ← empty barrel
  constants/
    index.ts                            ← empty barrel
  providers/
    .gitkeep                            ← will hold context providers (Query, SmoothScroll)

styles/
  .gitkeep                              ← reserved for module CSS if needed

public/
  images/
    .gitkeep
  videos/
    .gitkeep
  fonts/
    .gitkeep                            ← only if self-hosted fonts are added later
```

Empty barrel files (literally `export {}`):

```typescript
// components/ui/index.ts
export {}

// lib/types/index.ts
export {}

// lib/utils/index.ts
export {}

// lib/constants/index.ts
export {}
```

Placeholder pages:

```tsx
// app/not-found.tsx — placeholder, replaced in FE-8-QA-07
export default function NotFound() {
  return 404 — Not Found
}

// app/error.tsx — placeholder, replaced in FE-8-QA-07
'use client'
export default function Error() {
  return Something went wrong
}
```

#### Files to MODIFY:

None.

#### Files NOT to touch:

```
package.json                            ← FE-0-INFRA-01 owns it
tsconfig.json                           ← FE-0-INFRA-01 owns it
tailwind.config.ts                      ← FE-0-INFRA-08 will populate it
app/layout.tsx                          ← FE-0-INFRA-08 will populate it
app/globals.css                         ← FE-0-INFRA-08 will populate it
app/page.tsx                            ← Wave 7 will replace it
```

---

### Section 10 — UX & Loading State Rules

N/A — no UI in this ticket.

---

### Section 11 — Verification Steps

**Setup:**
1. FE-0-INFRA-01 must be merged
2. Run `pnpm install` in case dependencies are needed

**Happy path:**
1. Open the file tree → expected: every folder listed in section 9 exists
2. Check that empty folders contain `.gitkeep` so git tracks them
3. Check that `index.ts` barrels contain `export {}` (not empty file — TypeScript needs the export)
4. Run `pnpm dev` → expected: dev server starts without errors
5. Run `pnpm build` → expected: build succeeds (the placeholder `not-found.tsx` and `error.tsx` are valid)
6. Run `pnpm type-check` → expected: zero errors

**Edge cases:**
1. Try to commit folder changes → expected: git tracks all `.gitkeep` files
2. Run `git status` → expected: shows the new files staged

**Permission test:**
N/A.

---

### Section 12 — Acceptance Criteria

**Functionality:**
- [ ] Every folder listed in section 9 exists
- [ ] Every empty folder contains a `.gitkeep` file
- [ ] Every barrel `index.ts` file contains `export {}`
- [ ] `pnpm dev` runs without errors
- [ ] `pnpm build` completes successfully
- [ ] `pnpm type-check` returns zero errors

**Data & State:**
- [x] N/A

**UX States:**
- [x] N/A

**TypeScript:**
- [ ] All `index.ts` files compile without errors
- [ ] `app/not-found.tsx` and `app/error.tsx` placeholders compile

**Architecture:**
- [ ] Folder structure matches the documented tree exactly
- [ ] No actual implementation code in any of the new folders (only placeholders)
- [ ] All `app/(group)/` route groups created with the correct parenthesis syntax

**Performance:**
- [x] N/A

**Role-based access:**
- [x] N/A

---

### Section 13 — Notes for AI / Common Mistakes

**DO:**
- Create folders even if a corresponding ticket doesn't exist yet — the structure must be complete
- Use route groups syntax: `(admin)`, `(owner)`, `(public)`, `(auth)` — these don't show up in the URL
- Add `.gitkeep` to truly empty folders so git tracks them
- Add `export {}` to barrel `index.ts` files so TypeScript treats them as modules

**DO NOT:**
- ⛔ DO NOT USE ANY MOCK DATA in any file you create. This rule applies to every ticket in the project.
- Do NOT add any actual code logic in any folder — only placeholders
- Do NOT create page.tsx or layout.tsx files for route groups — those are later wave responsibilities
- Do NOT skip the placeholder `not-found.tsx` and `error.tsx` — they prevent build errors
- Do NOT remove the parentheses from route group names — `(admin)` not `admin`
- Do NOT use `src/` — this project has `app/` at the root level
- Do NOT create a `pages/` folder — this is App Router, not Pages Router

**WATCH OUT FOR:**
- Some operating systems hide `.gitkeep` files — use `ls -la` to verify they exist
- Empty `index.ts` files (zero bytes) cause TypeScript "is not a module" errors — always add `export {}`
- The `app/api/` folder is reserved for Next.js API routes if we ever need server actions — keep the `.gitkeep` even if unused

**REFERENCES:**
- Implementation Plan — folder structure derived from ticket file paths across all 8 waves
- Related: FE-0-INFRA-03 (Axios → `lib/api/`), FE-0-INFRA-05 (stores → `lib/stores/`), FE-0-INFRA-06 (TanStack Query → `lib/providers/`)

---

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TICKET ID: FE-0-INFRA-03
TITLE: Create Axios instance with interceptors and error handling
WAVE: Wave 0 — Foundation & Infrastructure
DOMAIN: INFRA
PRIORITY: Critical
DEPENDS ON: FE-0-INFRA-01, FE-0-INFRA-02
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section 1 — Walkthrough

**What is this ticket about?**
Every API call across all 117 tickets goes through ONE Axios instance. That instance must do four things automatically: attach the auth token to every request, handle 401 responses by refreshing the token (once) and retrying, unwrap the standardized backend response envelope (`{ success, data, message, errors, pagination }`), and show toasts for global errors (403, 500). Building this once, here, means every service file and hook in later waves stays clean — they just call `api.get(...)` and get typed data back.

**Why does this ticket exist NOW (in this wave)?**
The Axios instance is imported by every service file (in Waves 2-7). It must exist before those services are written. The auth interceptor specifically depends on the auth store (FE-0-INFRA-05), so this ticket includes a TODO marker that gets wired up in FE-1-AUTH-05.

**What does success look like?**
A developer can write `await api.get<UnitResponse>('/api/units/123')` in any file and get back the typed `data` field directly (already unwrapped from the envelope), with the auth token automatically attached, with 401 errors automatically triggering a refresh attempt, and with 500 errors automatically showing a toast.

---

### Section 2 — Objective

Build the single Axios instance in `lib/api/axios.ts` with request/response interceptors that attach the auth token, refresh on 401, unwrap the standard response envelope, and show toasts for global errors — so every future API call in the project goes through a consistent, hardened HTTP layer.

---

### Section 3 — User-Facing Outcome

The developer/AI implementer can:
- Import `api` from `@/lib/api/axios` in any file
- Call `api.get<T>(...)`, `api.post<T>(...)` and receive the unwrapped `data` field as type `T`
- Trust that auth tokens are attached automatically
- Trust that 401 errors trigger a refresh flow
- Trust that 5xx errors show a toast without per-call boilerplate

---

### Section 4 — In Scope

- [ ] Create `lib/api/axios.ts` with a configured Axios instance
- [ ] `baseURL: process.env.NEXT_PUBLIC_API_URL`
- [ ] `withCredentials: true` on every request (refresh token is in HttpOnly cookie)
- [ ] `timeout: 30000` (30s)
- [ ] Default headers: `{ 'Content-Type': 'application/json', 'Accept': 'application/json' }`
- [ ] Request interceptor: attach `Authorization: Bearer {accessToken}` from auth store (TODO marker — actual store wiring is in FE-1-AUTH-05)
- [ ] Response interceptor:
      - On success → unwrap `response.data.data` and return it
      - On `success: false` → throw a typed `ApiError`
      - On 401 → call `/api/auth/refresh` once, then retry the original request. If refresh fails → call `clearAuth()` and redirect to appropriate login (TODO marker)
      - On 403 → show toast "You don't have permission to perform this action"
      - On 422 → throw `ApiError` with field-level errors (so forms can display them)
      - On 500+ → show toast "Something went wrong. Please try again."
      - On network error (no response) → show toast "Cannot reach the server. Check your connection."
- [ ] Define a typed `ApiError` class with: `status`, `message`, `errors[]`
- [ ] Export the configured `api` instance as the default export
- [ ] Export `ApiError` as a named export

**Files to create:**
- `lib/api/axios.ts` — the configured Axios instance
- `lib/api/api-error.ts` — the `ApiError` class
- `lib/api/types.ts` — `ApiResponse<T>`, `PaginationMeta` types matching backend envelope

**Files to modify:** None — this is the first ticket creating these files.

---

### Section 5 — Out of Scope

- Do NOT create any service files (`lib/api/services/*.service.ts`) — those are per-domain in later waves
- Do NOT create `lib/api/endpoints.ts` — that is FE-0-INFRA-04
- Do NOT wire the auth store into the request interceptor — leave a TODO comment; this is wired in FE-1-AUTH-05 (because the auth store is created in FE-0-INFRA-05 but the refresh logic depends on the auth flow)
- Do NOT actually call `react-hot-toast` here — toasts are configured in FE-1-UI-09. Leave a TODO marker for now (or use `console.error` as placeholder, replaced in FE-1-UI-09)
- Do NOT add per-endpoint logic — interceptors are global only
- Do NOT add request/response logging — that is debugging, not production code
- Do NOT add retry logic for any status other than 401 (no automatic retries on 500)

---

### Section 6 — Technical Contract

#### 6a. Component Props Interface

N/A — no components.

#### 6b. Hook Return Type

N/A — this ticket creates an instance, not a hook.

#### 6c. Zod Schema

N/A.

#### 6d. Key Enums / Constants Used

```typescript
// Backend response envelope (from technical_req.md Section 10):
interface ApiResponse {
  success: boolean
  data: T | null
  message: string | null
  errors: string[] | null
  pagination: PaginationMeta | null
}

interface PaginationMeta {
  page: number
  pageSize: number
  total: number
}

// Custom error class:
class ApiError extends Error {
  status: number
  message: string
  errors: string[]

  constructor(status: number, message: string, errors: string[] = []) {
    super(message)
    this.status = status
    this.errors = errors
  }
}
```

---

### Section 7 — API Integration

#### 7a. Endpoints Used

| Method | Endpoint | Request Type | Response Type | When Called |
|---|---|---|---|---|
| POST | `/api/auth/refresh` | (none — uses cookie) | `AuthResponse` | only inside response interceptor on 401 |

This is the ONLY endpoint the Axios instance itself calls directly. Every other endpoint is called by service files in later waves.

#### 7b. TanStack Query Keys

N/A — TanStack Query is configured separately in FE-0-INFRA-06.

#### 7c. Query Configuration

N/A.

#### 7d. Mutation Side Effects

N/A.

#### 7e. Error Handling

The instance handles errors GLOBALLY. Per-call handling (e.g., specific 404 messages) happens in services and components, not here.

| Status | Action |
|---|---|
| 200/201/204 | Unwrap `data.data`, return |
| 400 | Throw `ApiError` — let the caller handle |
| 401 | Try refresh → retry original. On refresh fail → clearAuth + redirect |
| 403 | Toast "Permission denied" + throw `ApiError` |
| 404 | Throw `ApiError` — let the caller handle (some pages need custom 404 UI) |
| 422 | Throw `ApiError` with field errors — let forms render inline |
| 500+ | Toast "Something went wrong" + throw `ApiError` |
| Network error | Toast "Cannot reach server" + throw `ApiError(0, ...)` |

---

### Section 8 — State & Data Management Rules

| State | Where it lives | Why |
|---|---|---|
| Access token | Zustand auth store (read at request time) | global, in-memory only |
| Refresh state (preventing refresh loop) | Module-level boolean in axios.ts | prevents infinite refresh |
| Pending requests during refresh | Module-level array in axios.ts | classic refresh-queue pattern |

**Rules for this ticket:**
- [x] No server data in Zustand (this ticket reads token from Zustand, but doesn't write server data to it)
- [x] No `useEffect` (no React in this file)
- [x] No `localStorage` for the access token — read from Zustand only
- [x] No direct `fetch()` calls — only Axios

---

### Section 9 — Component & File Deliverables

#### Files to CREATE:

```
lib/
  api/
    axios.ts              ← the configured Axios instance (default export: api)
    api-error.ts          ← ApiError class
    types.ts              ← ApiResponse<T>, PaginationMeta types
```

#### File contents (the spec, NOT implementation — AI implements):

```typescript
// lib/api/types.ts
export interface ApiResponse {
  success: boolean
  data: T | null
  message: string | null
  errors: string[] | null
  pagination: PaginationMeta | null
}

export interface PaginationMeta {
  page: number
  pageSize: number
  total: number
}
```

```typescript
// lib/api/api-error.ts
export class ApiError extends Error {
  public readonly status: number
  public readonly errors: string[]

  constructor(status: number, message: string, errors: string[] = []) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.errors = errors
  }

  // helper: is this a validation error with field details?
  hasFieldErrors(): boolean {
    return this.status === 422 && this.errors.length > 0
  }
}
```

```typescript
// lib/api/axios.ts
import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios'
import { ApiError } from './api-error'
import type { ApiResponse } from './types'

const API_URL = process.env.NEXT_PUBLIC_API_URL
if (!API_URL) {
  throw new Error('NEXT_PUBLIC_API_URL is not defined')
}

const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
})

// ───── Request Interceptor ─────
api.interceptors.request.use((config) => {
  // TODO (FE-1-AUTH-05): import useAuthStore from '@/lib/stores/auth.store'
  //                      const token = useAuthStore.getState().accessToken
  //                      if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// ───── Refresh state ─────
let isRefreshing = false
let refreshQueue: Array<(token: string | null) => void> = []

// ───── Response Interceptor ─────
api.interceptors.response.use(
  (response) => {
    const envelope = response.data as ApiResponse
    if (envelope?.success === false) {
      throw new ApiError(response.status, envelope.message ?? 'Request failed', envelope.errors ?? [])
    }
    // Unwrap: return the inner `data` field directly
    return envelope.data
  },
  async (error: AxiosError<ApiResponse>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean }

    // ── No response (network error) ──
    if (!error.response) {
      // TODO (FE-1-UI-09): toast.error('Cannot reach the server. Check your connection.')
      throw new ApiError(0, 'Cannot reach the server')
    }

    const { status, data } = error.response
    const message = data?.message ?? 'Request failed'
    const errors = data?.errors ?? []

    // ── 401: try refresh once ──
    if (status === 401 && !originalRequest._retry) {
      originalRequest._retry = true

      if (isRefreshing) {
        // queue this request until the in-flight refresh completes
        return new Promise((resolve, reject) => {
          refreshQueue.push((newToken) => {
            if (newToken) {
              originalRequest.headers.Authorization = `Bearer ${newToken}`
              resolve(api(originalRequest))
            } else {
              reject(new ApiError(401, 'Session expired'))
            }
          })
        })
      }

      isRefreshing = true
      try {
        const refreshResponse = await axios.post(
          `${API_URL}/api/auth/refresh`,
          {},
          { withCredentials: true }
        )
        const newToken = (refreshResponse.data as ApiResponse).data?.accessToken ?? null

        // TODO (FE-1-AUTH-05): useAuthStore.getState().setAccessToken(newToken)

        refreshQueue.forEach((cb) => cb(newToken))
        refreshQueue = []
        isRefreshing = false

        if (newToken) {
          originalRequest.headers.Authorization = `Bearer ${newToken}`
          return api(originalRequest)
        }
        throw new ApiError(401, 'Session expired')
      } catch (refreshError) {
        refreshQueue.forEach((cb) => cb(null))
        refreshQueue = []
        isRefreshing = false

        // TODO (FE-1-AUTH-05): useAuthStore.getState().clearAuth()
        //                      router.push('/auth/...login') — depends on which app

        throw new ApiError(401, 'Session expired')
      }
    }

    // ── 403 ──
    if (status === 403) {
      // TODO (FE-1-UI-09): toast.error('You don\'t have permission to perform this action')
      throw new ApiError(403, message, errors)
    }

    // ── 500+ ──
    if (status >= 500) {
      // TODO (FE-1-UI-09): toast.error('Something went wrong. Please try again.')
      throw new ApiError(status, message, errors)
    }

    // ── 400 / 404 / 422 / others — let caller handle ──
    throw new ApiError(status, message, errors)
  }
)

export default api
```

#### Files to MODIFY:

None.

#### Files NOT to touch:

```
lib/api/services/*                      ← Wave 2+ ticket responsibility
lib/api/endpoints.ts                    ← FE-0-INFRA-04 owns this
lib/stores/auth.store.ts                ← FE-0-INFRA-05 owns this
```

---

### Section 10 — UX & Loading State Rules

The Axios instance does NOT render UI. The only "UX" it triggers is toasts (which are TODO until FE-1-UI-09).

| State | Required? | Behavior |
|---|---|---|
| Loading | N/A | TanStack Query handles loading state at the hook level (FE-0-INFRA-06) |
| Empty | N/A | Components handle empty state |
| Error | ✓ REQUIRED | Toasts on 403/500/network. Throws `ApiError` for caller |
| Success | N/A | Returns unwrapped data |

---

### Section 11 — Verification Steps

**Setup:**
1. FE-0-INFRA-01 and FE-0-INFRA-02 must be merged
2. The backend API must be running at `NEXT_PUBLIC_API_URL` (or use a placeholder URL for unit testing)

**Happy path:**
1. In a temporary test file, import `api` and call `api.get<{projects: any[]}>('/api/projects')` → expected: returns the unwrapped `data` field, not the full envelope
2. Call any endpoint requiring auth without a token → expected: 401 response triggers refresh attempt
3. Call an endpoint with a valid token → expected: token is attached to the request header
4. Call an endpoint that returns 500 → expected: `ApiError(500, ...)` is thrown
5. Call an endpoint with the API server down → expected: `ApiError(0, 'Cannot reach the server')` is thrown

**Edge cases:**
1. Two simultaneous calls both return 401 → expected: only ONE refresh request fires; both original calls retry with the new token
2. Refresh token is also expired → expected: the second 401 from `/api/auth/refresh` clears auth and redirects (TODO behavior — verify the TODO is correctly placed for FE-1-AUTH-05)
3. Backend returns `{ success: false, message: "...", errors: [...] }` with a 200 status → expected: `ApiError` is still thrown
4. Backend returns 422 with field errors → expected: `ApiError` is thrown with `errors[]` populated; `apiError.hasFieldErrors()` returns `true`
5. The `NEXT_PUBLIC_API_URL` env var is not set → expected: the module throws on import (fail fast)

**Permission test:**
N/A — auth wiring is in FE-1-AUTH-05.

---

### Section 12 — Acceptance Criteria

**Functionality:**
- [ ] `api.get/post/put/patch/delete<T>(...)` returns unwrapped `data` field as type `T`
- [ ] `withCredentials: true` is set so cookies are sent
- [ ] Request interceptor structure exists for token attachment (TODO marker present)
- [ ] Response interceptor unwraps the `ApiResponse<T>` envelope
- [ ] `success: false` envelopes throw `ApiError`
- [ ] 401 triggers a refresh attempt exactly once per original request (`_retry` flag prevents loops)
- [ ] Concurrent 401s share a single refresh call via the refresh queue
- [ ] 403 triggers a toast (TODO marker for FE-1-UI-09)
- [ ] 500+ triggers a toast (TODO marker for FE-1-UI-09)
- [ ] Network errors throw `ApiError(0, ...)`
- [ ] `ApiError` class exposes `status`, `message`, `errors[]`
- [ ] `ApiError.hasFieldErrors()` returns true only for 422 with non-empty errors

**Data & State:**
- [ ] No server data is written to Zustand (only token is read from it)
- [ ] No `localStorage` access anywhere
- [ ] Refresh queue is module-level, not React state

**UX States:**
- [ ] TODO comments mark every place where toasts will be added (in FE-1-UI-09)
- [ ] TODO comments mark every place where the auth store will be wired in (in FE-1-AUTH-05)

**TypeScript:**
- [ ] `ApiResponse<T>` and `PaginationMeta` are typed
- [ ] `ApiError` extends native `Error`
- [ ] No `any` type used (use `unknown` where the type isn't yet known)
- [ ] Zero TypeScript errors

**Architecture:**
- [ ] `lib/api/axios.ts` exports the instance as default
- [ ] `lib/api/api-error.ts` exports `ApiError` as named
- [ ] `lib/api/types.ts` exports `ApiResponse` and `PaginationMeta`
- [ ] No service files created (those are later wave responsibility)
- [ ] No endpoint strings hardcoded inside this file (other than `/api/auth/refresh` which is the only one this file owns)

**Performance:**
- [ ] Refresh queue prevents N parallel refresh requests when N requests fail simultaneously
- [ ] `_retry` flag prevents infinite refresh loops

**Role-based access:**
- [x] N/A in this ticket — auth wiring is in FE-1-AUTH-05

---

### Section 13 — Notes for AI / Common Mistakes

**DO:**
- Use `axios.create({...})` to make a configured instance — never call `axios.get` directly
- Use TypeScript generics on the response unwrap so callers get typed data: `api.get<T>` returns `T`, not `AxiosResponse<T>`
- Use the `_retry` flag on the original request config to prevent refresh loops
- Use the refresh queue pattern (array of callbacks) to handle concurrent 401s with a single refresh
- Throw `ApiError` consistently — never throw raw axios errors out of the interceptor
- Mark all TODO points with the exact ticket ID that will resolve them (e.g., `// TODO (FE-1-AUTH-05): ...`)

**DO NOT:**
- ⛔ DO NOT USE ANY MOCK DATA. All API calls must hit the real backend at `NEXT_PUBLIC_API_URL`. Do NOT add fake response simulators, MSW handlers, or any mock layer.
- Do NOT use `localStorage` or `sessionStorage` to store the access token — it must come from the Zustand store
- Do NOT use `fetch()` anywhere — Axios is the single HTTP client
- Do NOT put per-endpoint logic in the interceptors — interceptors are GLOBAL
- Do NOT hardcode the `baseURL` — use `process.env.NEXT_PUBLIC_API_URL`
- Do NOT skip the `withCredentials: true` flag — refresh token is in HttpOnly cookie and won't be sent without it
- Do NOT call `react-hot-toast` directly here — it isn't configured yet (FE-1-UI-09)
- Do NOT import the auth store yet — it doesn't exist (FE-0-INFRA-05). Use TODO markers
- Do NOT swallow errors silently — always rethrow as `ApiError`
- Do NOT log full request/response objects in production — security risk
- Do NOT use the `any` type — use `unknown` where types aren't known yet, or define a proper generic
- Do NOT add automatic retry on non-401 errors — that hides real backend bugs

**WATCH OUT FOR:**
- The `_retry` flag is custom — TypeScript needs the cast: `originalRequest as InternalAxiosRequestConfig & { _retry?: boolean }`
- Axios response interceptors receive `AxiosResponse<T>` where `T` is the BACKEND's full envelope `ApiResponse<X>`. The unwrap happens HERE, not in callers
- The refresh call uses raw `axios.post()` (not the configured instance) to avoid recursive interceptor loops
- The refresh queue must be cleared whether the refresh succeeds or fails — both paths must reset state
- `withCredentials` must be set on BOTH the main instance AND the raw refresh call
- If `NEXT_PUBLIC_API_URL` is missing, fail at module load — not silently fall back to localhost (which masks deployment issues)

**REFERENCES:**
- technical_req.md Section 10 — API response format standard (the envelope this unwraps)
- Backend Swagger — `POST /api/auth/refresh` returns `AuthResponse` envelope
- Backend Swagger — `AuthResponse` schema (will need this exact shape in FE-1-AUTH-01)
- Related: FE-0-INFRA-05 (auth store), FE-1-AUTH-05 (wiring), FE-1-UI-09 (toasts)

---

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TICKET ID: FE-0-INFRA-04
TITLE: Create endpoints constants file (all 139 backend endpoints)
WAVE: Wave 0 — Foundation & Infrastructure
DOMAIN: INFRA
PRIORITY: Critical
DEPENDS ON: FE-0-INFRA-02
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section 1 — Walkthrough

**What is this ticket about?**
Every API call across all 117 tickets needs an endpoint string. Hardcoding strings ("`/api/units/${id}`") in service files leads to typos, broken refactors when backend renames endpoints, and unfindable callers when reviewing what hits a given endpoint. This ticket creates ONE file (`lib/api/endpoints.ts`) that contains every one of the 139 backend endpoints as typed constants. Every service file in later waves imports from here. Every refactor finds all callers in seconds.

**Why does this ticket exist NOW (in this wave)?**
The endpoints file is imported by every service in Waves 2–7. It must exist before those services are written. Building it once, fully, here means later tickets just `import { endpoints } from '@/lib/api/endpoints'` and pick the right string.

**What does success look like?**
Any developer/AI implementer can write `endpoints.units.byId('abc-123')` and get back `'/api/units/abc-123'`, with autocomplete listing every endpoint group. If the backend renames an endpoint, ONE file changes; the type-checker finds every caller.

---

### Section 2 — Objective

Create `lib/api/endpoints.ts` containing every backend endpoint (all 139 from Swagger) as typed nested constants and dynamic helper functions, so no service file or component ever hardcodes an endpoint string.

---

### Section 3 — User-Facing Outcome

The developer/AI implementer can:
- Import `endpoints` from `@/lib/api/endpoints` in any file
- Use autocomplete to find any endpoint by domain (e.g., `endpoints.bookings.confirm(id)`)
- Refactor endpoint paths in ONE place if the backend changes
- Trust that no inline `/api/...` strings exist anywhere else in the codebase

---

### Section 4 — In Scope

- [ ] Create `lib/api/endpoints.ts` with all 139 endpoints organized by domain
- [ ] Use a nested const object structure: `endpoints.{domain}.{action}`
- [ ] Use functions for endpoints with path parameters: `endpoints.units.byId(id: string) => '/api/units/${id}'`
- [ ] Use plain strings for endpoints without parameters: `endpoints.projects.list = '/api/projects'`
- [ ] Cover ALL 30 domains from the Swagger
- [ ] Use `as const` to ensure literal string types where helpful
- [ ] Export `endpoints` as a named export

**Files to create:**
- `lib/api/endpoints.ts` — the endpoints registry

**Files to modify:** None.

---

### Section 5 — Out of Scope

- Do NOT create service files — those are domain-specific in later waves
- Do NOT create types for request/response payloads — those are per-domain in later waves (e.g., `lib/types/booking.types.ts`)
- Do NOT call any of these endpoints — this is just the constants file
- Do NOT add baseURL prefix — endpoints are paths only (the Axios instance has the baseURL)
- Do NOT add deprecated, removed, or planned-future endpoints — only what exists in Swagger right now
- Do NOT add Swagger schema types here — schemas go in `lib/types/` per domain

---

### Section 6 — Technical Contract

#### 6a. Component Props Interface

N/A.

#### 6b. Hook Return Type

N/A.

#### 6c. Zod Schema

N/A.

#### 6d. Key Enums / Constants Used

The full structure (paths from Swagger):

```typescript
export const endpoints = {
  // ──────────── AUTH ────────────
  auth: {
    clientRegister: '/api/auth/client/register',
    clientLogin: '/api/auth/client/login',
    adminLogin: '/api/auth/admin/login',
    ownerLogin: '/api/auth/owner/login',
    refresh: '/api/auth/refresh',
    logout: '/api/auth/logout',
  },

  // ──────────── ADMIN USERS ────────────
  adminUsers: {
    list: '/api/admin-users',
    create: '/api/admin-users',
    role: (id: string) => `/api/admin-users/${id}/role`,
    status: (id: string) => `/api/admin-users/${id}/status`,
  },

  // ──────────── AMENITIES ────────────
  amenities: {
    list: '/api/amenities',
    create: '/api/amenities',
  },

  // ──────────── PROJECTS ────────────
  projects: {
    list: '/api/projects',
    create: '/api/projects',
    byId: (id: string) => `/api/projects/${id}`,
    update: (id: string) => `/api/projects/${id}`,
    status: (id: string) => `/api/projects/${id}/status`,
  },

  // ──────────── UNITS (PUBLIC) ────────────
  units: {
    publicList: '/api/units',
    publicById: (id: string) => `/api/units/${id}`,
    images: (unitId: string) => `/api/units/${unitId}/images`,
    amenities: (unitId: string) => `/api/units/${unitId}/amenities`,
    operationalCheck: (unitId: string) => `/api/units/${unitId}/availability/operational-check`,
    pricingCalculate: (unitId: string) => `/api/units/${unitId}/pricing/calculate`,
  },

  // ──────────── UNITS (INTERNAL) ────────────
  internalUnits: {
    list: '/api/internal/units',
    create: '/api/internal/units',
    byId: (id: string) => `/api/internal/units/${id}`,
    update: (id: string) => `/api/internal/units/${id}`,
    delete: (id: string) => `/api/internal/units/${id}`,
    status: (id: string) => `/api/internal/units/${id}/status`,
  },

  // ──────────── UNIT IMAGES ────────────
  internalUnitImages: {
    create: (unitId: string) => `/api/internal/units/${unitId}/images`,
    reorder: (unitId: string) => `/api/internal/units/${unitId}/images/reorder`,
    cover: (unitId: string, imageId: string) => `/api/internal/units/${unitId}/images/${imageId}/cover`,
    delete: (unitId: string, imageId: string) => `/api/internal/units/${unitId}/images/${imageId}`,
  },

  // ──────────── UNIT AMENITIES ────────────
  internalUnitAmenities: {
    add: (unitId: string) => `/api/internal/units/${unitId}/amenities`,
    replace: (unitId: string) => `/api/internal/units/${unitId}/amenities`,
    remove: (unitId: string, amenityId: string) => `/api/internal/units/${unitId}/amenities/${amenityId}`,
  },

  // ──────────── SEASONAL PRICING ────────────
  seasonalPricing: {
    list: (unitId: string) => `/api/internal/units/${unitId}/seasonal-pricing`,
    create: (unitId: string) => `/api/internal/units/${unitId}/seasonal-pricing`,
    update: (id: string) => `/api/internal/seasonal-pricing/${id}`,
    delete: (id: string) => `/api/internal/seasonal-pricing/${id}`,
  },

  // ──────────── DATE BLOCKS ────────────
  dateBlocks: {
    list: (unitId: string) => `/api/internal/units/${unitId}/date-blocks`,
    create: (unitId: string) => `/api/internal/units/${unitId}/date-blocks`,
    update: (id: string) => `/api/internal/date-blocks/${id}`,
    delete: (id: string) => `/api/internal/date-blocks/${id}`,
  },

  // ──────────── BOOKINGS (INTERNAL) ────────────
  internalBookings: {
    list: '/api/internal/bookings',
    create: '/api/internal/bookings',
    byId: (id: string) => `/api/internal/bookings/${id}`,
    update: (id: string) => `/api/internal/bookings/${id}`,
    statusHistory: (id: string) => `/api/internal/bookings/${id}/status-history`,
  },

  // ──────────── BOOKING LIFECYCLE ────────────
  bookingLifecycle: {
    confirm: (id: string) => `/api/internal/bookings/${id}/confirm`,
    cancel: (id: string) => `/api/internal/bookings/${id}/cancel`,
    complete: (id: string) => `/api/internal/bookings/${id}/complete`,
  },

  // ──────────── CRM LEADS ────────────
  crmLeads: {
    create: '/api/crm/leads',  // PUBLIC — public lead creation
    list: '/api/internal/crm/leads',
    byId: (id: string) => `/api/internal/crm/leads/${id}`,
    update: (id: string) => `/api/internal/crm/leads/${id}`,
    status: (id: string) => `/api/internal/crm/leads/${id}/status`,
    convertToBooking: (id: string) => `/api/internal/crm/leads/${id}/convert-to-booking`,
  },

  // ──────────── CRM NOTES ────────────
  crmNotes: {
    bookingNotesList: (bookingId: string) => `/api/internal/bookings/${bookingId}/notes`,
    bookingNotesCreate: (bookingId: string) => `/api/internal/bookings/${bookingId}/notes`,
    leadNotesList: (leadId: string) => `/api/internal/crm/leads/${leadId}/notes`,
    leadNotesCreate: (leadId: string) => `/api/internal/crm/leads/${leadId}/notes`,
    update: (id: string) => `/api/internal/crm/notes/${id}`,
    delete: (id: string) => `/api/internal/crm/notes/${id}`,
  },

  // ──────────── CRM ASSIGNMENTS ────────────
  crmAssignments: {
    bookingGet: (bookingId: string) => `/api/internal/bookings/${bookingId}/assignment`,
    bookingSet: (bookingId: string) => `/api/internal/bookings/${bookingId}/assignment`,
    bookingDelete: (bookingId: string) => `/api/internal/bookings/${bookingId}/assignment`,
    leadGet: (leadId: string) => `/api/internal/crm/leads/${leadId}/assignment`,
    leadSet: (leadId: string) => `/api/internal/crm/leads/${leadId}/assignment`,
    leadDelete: (leadId: string) => `/api/internal/crm/leads/${leadId}/assignment`,
  },

  // ──────────── PAYMENTS ────────────
  payments: {
    list: '/api/internal/payments',
    create: '/api/internal/payments',
    byId: (id: string) => `/api/internal/payments/${id}`,
    markPaid: (id: string) => `/api/internal/payments/${id}/mark-paid`,
    markFailed: (id: string) => `/api/internal/payments/${id}/mark-failed`,
    cancel: (id: string) => `/api/internal/payments/${id}/cancel`,
  },

  // ──────────── INVOICES ────────────
  invoices: {
    list: '/api/internal/invoices',
    byId: (id: string) => `/api/internal/invoices/${id}`,
    createDraft: '/api/internal/invoices/drafts',
    addAdjustment: (id: string) => `/api/internal/invoices/${id}/items/manual-adjustment`,
    issue: (id: string) => `/api/internal/invoices/${id}/issue`,
    cancel: (id: string) => `/api/internal/invoices/${id}/cancel`,
    balance: (id: string) => `/api/internal/invoices/${id}/balance`,
  },

  // ──────────── FINANCE SUMMARY ────────────
  financeSummary: {
    bookingFinanceSnapshot: (bookingId: string) => `/api/internal/bookings/${bookingId}/finance-snapshot`,
    ownerPayoutSummary: (ownerId: string) => `/api/internal/owners/${ownerId}/payout-summary`,
  },

  // ──────────── OWNER PAYOUTS ────────────
  ownerPayouts: {
    byBooking: (bookingId: string) => `/api/internal/owner-payouts/by-booking/${bookingId}`,
    byOwner: (ownerId: string) => `/api/internal/owners/${ownerId}/payouts`,
    create: '/api/internal/owner-payouts',
    schedule: (id: string) => `/api/internal/owner-payouts/${id}/schedule`,
    markPaid: (id: string) => `/api/internal/owner-payouts/${id}/mark-paid`,
    cancel: (id: string) => `/api/internal/owner-payouts/${id}/cancel`,
  },

  // ──────────── REPORTS — BOOKINGS ────────────
  reportsBookings: {
    daily: '/api/internal/reports/bookings/daily',
    summary: '/api/internal/reports/bookings/summary',
  },

  // ──────────── REPORTS — FINANCE ────────────
  reportsFinance: {
    daily: '/api/internal/reports/finance/daily',
    summary: '/api/internal/reports/finance/summary',
  },

  // ──────────── OWNERS ────────────
  owners: {
    list: '/api/owners',
    create: '/api/owners',
    byId: (id: string) => `/api/owners/${id}`,
    update: (id: string) => `/api/owners/${id}`,
    status: (id: string) => `/api/owners/${id}/status`,
  },

  // ──────────── CLIENTS ────────────
  clients: {
    list: '/api/clients',
    byId: (id: string) => `/api/clients/${id}`,
  },

  // ──────────── REVIEWS — PUBLIC ────────────
  publicReviews: {
    byUnitSummary: (unitId: string) => `/api/public/units/${unitId}/reviews/summary`,
    byUnitList: (unitId: string) => `/api/public/units/${unitId}/reviews`,
    byUnitDetail: (unitId: string, reviewId: string) => `/api/public/units/${unitId}/reviews/${reviewId}`,
  },

  // ──────────── REVIEWS — CLIENT ────────────
  clientReviews: {
    create: '/api/client/reviews',
    update: (reviewId: string) => `/api/client/reviews/${reviewId}`,
    byBooking: (bookingId: string) => `/api/client/reviews/by-booking/${bookingId}`,
  },

  // ──────────── REVIEW MODERATION ────────────
  reviewModeration: {
    publish: (reviewId: string) => `/api/internal/reviews/${reviewId}/publish`,
    reject: (reviewId: string) => `/api/internal/reviews/${reviewId}/reject`,
    hide: (reviewId: string) => `/api/internal/reviews/${reviewId}/hide`,
    statusHistory: (reviewId: string) => `/api/internal/reviews/${reviewId}/status-history`,
  },

  // ──────────── REVIEW REPLIES (Owner) ────────────
  reviewReplies: {
    get: (reviewId: string) => `/api/owner/reviews/${reviewId}/reply`,
    upsert: (reviewId: string) => `/api/owner/reviews/${reviewId}/reply`,
    delete: (reviewId: string) => `/api/owner/reviews/${reviewId}/reply`,
    visibility: (reviewId: string) => `/api/owner/reviews/${reviewId}/reply/visibility`,
  },

  // ──────────── NOTIFICATION INBOX (3 personas) ────────────
  notifications: {
    admin: {
      inbox: '/api/internal/me/notifications/inbox',
      summary: '/api/internal/me/notifications/inbox/summary',
      read: (id: string) => `/api/internal/me/notifications/inbox/${id}/read`,
    },
    client: {
      inbox: '/api/client/me/notifications/inbox',
      summary: '/api/client/me/notifications/inbox/summary',
      read: (id: string) => `/api/client/me/notifications/inbox/${id}/read`,
    },
    owner: {
      inbox: '/api/owner/me/notifications/inbox',
      summary: '/api/owner/me/notifications/inbox/summary',
      read: (id: string) => `/api/owner/me/notifications/inbox/${id}/read`,
    },
  },

  // ──────────── NOTIFICATION PREFERENCES (3 personas) ────────────
  notificationPreferences: {
    adminGet: '/api/internal/me/notification-preferences',
    adminUpdate: '/api/internal/me/notification-preferences',
    clientGet: '/api/client/me/notification-preferences',
    clientUpdate: '/api/client/me/notification-preferences',
    ownerGet: '/api/owner/me/notification-preferences',
    ownerUpdate: '/api/owner/me/notification-preferences',
  },

  // ──────────── OWNER PORTAL ────────────
  ownerPortal: {
    dashboard: '/api/owner/dashboard',
    bookings: '/api/owner/bookings',
    bookingById: (id: string) => `/api/owner/bookings/${id}`,
    finance: '/api/owner/finance',
    financeBooking: (bookingId: string) => `/api/owner/finance/bookings/${bookingId}`,
    financeSummary: '/api/owner/finance/summary',
    units: '/api/owner/units',
    unitById: (unitId: string) => `/api/owner/units/${unitId}`,
  },
} as const
```

---

### Section 7 — API Integration

N/A — this is the constants registry, not callers.

---

### Section 8 — State & Data Management Rules

N/A — pure constants.

---

### Section 9 — Component & File Deliverables

#### Files to CREATE:

```
lib/
  api/
    endpoints.ts         ← all 139 endpoints as a typed const tree
```

#### Files to MODIFY:

None.

#### Files NOT to touch:

```
lib/api/axios.ts         ← FE-0-INFRA-03 owns it
lib/api/services/*       ← Wave 2+ ticket responsibility
```

---

### Section 10 — UX & Loading State Rules

N/A.

---

### Section 11 — Verification Steps

**Setup:**
1. FE-0-INFRA-02 must be merged

**Happy path:**
1. Import `endpoints` in any file → expected: type-checks correctly
2. Use `endpoints.units.publicById('abc')` → expected: returns `'/api/units/abc'`
3. Use `endpoints.projects.list` → expected: returns `'/api/projects'`
4. Use `endpoints.notifications.admin.read('xyz')` → expected: returns `'/api/internal/me/notifications/inbox/xyz/read'`
5. Run `pnpm type-check` → expected: zero errors

**Edge cases:**
1. Try to use a non-existent endpoint like `endpoints.foo.bar` → expected: TypeScript compile error
2. Pass a number where a string ID is expected → expected: TypeScript compile error

**Permission test:**
N/A — endpoint constants don't enforce permissions; the backend does.

---

### Section 12 — Acceptance Criteria

**Functionality:**
- [ ] All 139 endpoints from Swagger are present
- [ ] Endpoints with path parameters use functions, not strings
- [ ] Endpoints without parameters use plain strings
- [ ] Endpoints are organized by domain (matches Swagger groupings)
- [ ] Public endpoints clearly grouped vs internal endpoints (e.g., `units` for public, `internalUnits` for internal)
- [ ] `as const` is applied to ensure literal types

**Data & State:**
- [x] N/A

**UX States:**
- [x] N/A

**TypeScript:**
- [ ] Zero TypeScript errors when running `pnpm type-check`
- [ ] Path parameter functions are typed `(id: string) => string`
- [ ] Multi-param functions are typed correctly: `(unitId: string, imageId: string) => string`
- [ ] No `any` type used

**Architecture:**
- [ ] File is `lib/api/endpoints.ts` (not anywhere else)
- [ ] Single named export: `endpoints`
- [ ] No imports from other modules (this file is dependency-free)
- [ ] No string concatenation outside the helper functions (no `'/api/' + thing` elsewhere)

**Performance:**
- [x] N/A

**Role-based access:**
- [x] N/A

---

### Section 13 — Notes for AI / Common Mistakes

**DO:**
- Follow the exact structure shown in section 6d — every domain group must be present
- Use template literals in functions: `` `/api/units/${id}` ``, not string concatenation
- Use `as const` at the end of the object so all string values become literal types
- Group public vs internal endpoints into different sub-objects when both exist for the same domain (units vs internalUnits, bookings vs internalBookings)
- Keep the file alphabetically organized within each group OR organized exactly per Swagger — pick one and be consistent

**DO NOT:**
- ⛔ DO NOT USE ANY MOCK DATA. This file is endpoints only — but for ALL future tickets, no mock data anywhere.
- Do NOT add `baseURL` to any endpoint — Axios handles that
- Do NOT add the `https://...` prefix — endpoints are paths only
- Do NOT add query string parameters here — those go in service files (e.g., `?status=confirmed` is added at call time)
- Do NOT include endpoints that aren't in the Swagger
- Do NOT skip endpoints because "we won't use them in MVP" — every endpoint that exists must be here for completeness
- Do NOT use `any` type for path parameter functions
- Do NOT export individual endpoints — only the single `endpoints` object
- Do NOT create separate files per domain (one file is intentional — easier to grep)

**WATCH OUT FOR:**
- Some endpoints share URLs but different methods (e.g., `POST /api/projects` create vs `GET /api/projects` list) — both go in the registry under different keys (`create` vs `list`)
- Some endpoints have DOUBLE path parameters (e.g., `/api/internal/units/{unitId}/images/{imageId}/cover`) — make sure the function takes both params in the right order
- The CRM domain has BOTH `crm/leads` and `bookings` endpoints for similar concepts — keep them separate. The frontend uses leads endpoints in CRM context, bookings endpoints in admin booking management
- The `/api/crm/leads` POST endpoint is PUBLIC (anonymous lead creation from the website) — clearly mark it
- Notification endpoints split into 3 sub-trees (admin/client/owner) — use nested objects for clarity
- Some endpoints don't have an HTTP verb in their name (e.g., `/api/units/{id}/availability/operational-check` is POST despite "check" sounding like GET) — the registry doesn't carry the verb; that's the service layer's job

**REFERENCES:**
- The full Swagger endpoint list provided in user's message (139 endpoints)
- technical_req.md Section 4 — original (incomplete) endpoint map; superseded by Swagger
- Related: FE-0-INFRA-03 (Axios uses these endpoints), Wave 2+ services (consume these)

---

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TICKET ID: FE-0-INFRA-05
TITLE: Create Zustand stores (auth + UI)
WAVE: Wave 0 — Foundation & Infrastructure
DOMAIN: INFRA
PRIORITY: Critical
DEPENDS ON: FE-0-INFRA-02
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section 1 — Walkthrough

**What is this ticket about?**
Two pieces of state in this app are GLOBAL but NOT server data: (1) the current authenticated user + their access token, and (2) the global UI state (sidebar collapsed, currently-open modal, theme, etc.). Server data (units, bookings, leads) lives in TanStack Query, not here. These two stores are the only Zustand stores in the entire app.

**Why does this ticket exist NOW (in this wave)?**
The auth store is needed by:
- The Axios request interceptor (FE-0-INFRA-03 left a TODO for this)
- The middleware route guards (FE-1-AUTH-05)
- Every login page (FE-1-AUTH-01 through FE-1-AUTH-04)
- The `usePermissions` hook (FE-1-UI-10)

The UI store is needed by:
- The sidebar toggle in admin shell (FE-2-ADMIN-01)
- Modal management throughout the app

Both must exist before Wave 1 starts.

**What does success look like?**
A developer can call `useAuthStore.getState().accessToken` to read the current token (synchronously), or `useAuthStore((state) => state.accessToken)` inside a React component (reactively). Setting the auth state via `setAuth(payload)` updates everything atomically.

---

### Section 2 — Objective

Build `lib/stores/auth.store.ts` and `lib/stores/ui.store.ts` as Zustand stores with strict types, no persistence (token must be memory-only), and atomic setter actions, so every other ticket can consume global UI/auth state cleanly.

---

### Section 3 — User-Facing Outcome

The developer/AI implementer can:
- Read auth state from any component or service file
- Update auth state atomically via `setAuth({user, accessToken, role})`
- Clear auth via `clearAuth()`
- Toggle the sidebar from anywhere
- Open/close any modal globally

---

### Section 4 — In Scope

- [ ] Create `lib/stores/auth.store.ts` with Zustand
- [ ] Define `AuthState` interface
- [ ] Implement `setAuth(payload)`, `setAccessToken(token)`, `clearAuth()` actions
- [ ] **Memory only** — no `persist` middleware on the auth store
- [ ] Create `lib/stores/ui.store.ts` with Zustand
- [ ] Define `UIState` interface
- [ ] Implement `toggleSidebar()`, `setSidebarOpen(open)`, `openModal(name)`, `closeModal()` actions
- [ ] (Optional) Allow UI store to use `persist` middleware for sidebar collapsed state ONLY (not auth-related)
- [ ] Both stores must be SSR-safe (Zustand v5 is by default, but verify)

**Files to create:**
- `lib/stores/auth.store.ts` — auth state + actions
- `lib/stores/ui.store.ts` — UI state + actions
- `lib/stores/index.ts` — barrel export

**Files to modify:** None.

---

### Section 5 — Out of Scope

- Do NOT add server data to either store (units, bookings, leads — all go in TanStack Query, not here)
- Do NOT add a "form state" store — forms use React Hook Form, not Zustand
- Do NOT persist the auth store — tokens must be memory-only for security
- Do NOT add devtools middleware in production builds (use `process.env.NODE_ENV === 'development'` guard if added)
- Do NOT wire the auth store into the Axios interceptor here — that is FE-1-AUTH-05's job (the interceptor file already has TODO markers)
- Do NOT add notification or toast state to the UI store — `react-hot-toast` manages its own state

---

### Section 6 — Technical Contract

#### 6a. Component Props Interface

N/A — stores, not components.

#### 6b. Hook Return Type

```typescript
// useAuthStore — Zustand hook signature
type AuthRole = 'SuperAdmin' | 'Sales' | 'Finance' | 'Tech' | 'Owner' | 'Client' | null

interface AuthenticatedUser {
  id: string
  name: string
  email?: string
  phone?: string
  // ... other fields per AuthenticatedUserResponse from Swagger
}

interface AuthState {
  // state
  accessToken: string | null
  user: AuthenticatedUser | null
  role: AuthRole

  // actions
  setAuth: (payload: { accessToken: string; user: AuthenticatedUser; role: AuthRole }) => void
  setAccessToken: (token: string | null) => void
  clearAuth: () => void
}

// Usage:
// const accessToken = useAuthStore((s) => s.accessToken)
// useAuthStore.getState().setAuth({ ... })
```

```typescript
// useUIStore — Zustand hook signature
type ModalName =
  | 'create-project'
  | 'edit-project'
  | 'create-unit'
  | 'create-owner'
  | 'create-payment'
  | 'create-payout'
  | 'confirm'
  // ... more modals added per ticket as needed
  | null

interface UIState {
  // state
  isSidebarOpen: boolean
  activeModal: ModalName

  // actions
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
  openModal: (name: NonNullable) => void
  closeModal: () => void
}
```

#### 6c. Zod Schema

N/A.

#### 6d. Key Enums / Constants Used

```typescript
// AuthRole values match API AdminRole enum + 'Owner' + 'Client'
// Defined here, but the canonical list is in lib/constants/roles.ts (FE-0-INFRA-07)
```

---

### Section 7 — API Integration

N/A — stores don't call APIs. The auth store is FILLED by login mutations (in FE-1-AUTH-01..04), not by calling APIs from the store itself.

---

### Section 8 — State & Data Management Rules

| State | Where it lives | Why |
|---|---|---|
| Access token | Zustand auth store | global, in-memory only |
| User profile | Zustand auth store | global auth context |
| Role | Zustand auth store | drives `usePermissions` |
| Sidebar open/closed | Zustand UI store | global UI state |
| Currently-open modal | Zustand UI store | global UI state |
| Refresh token | HttpOnly cookie (browser) | security — never JavaScript-accessible |
| Server data | TanStack Query | NOT in any store |
| Form values | React Hook Form | NOT in any store |

**Rules for this ticket:**
- [x] No server data in Zustand
- [x] No `useEffect` to populate the store
- [x] No `localStorage` for the auth store
- [ ] OPTIONAL: `localStorage` allowed for the `isSidebarOpen` field of the UI store (low security risk, improves UX) — use `persist` middleware with `partialize` to ONLY persist that one field

---

### Section 9 — Component & File Deliverables

#### Files to CREATE:

```typescript
// lib/stores/auth.store.ts
import { create } from 'zustand'

export type AuthRole = 'SuperAdmin' | 'Sales' | 'Finance' | 'Tech' | 'Owner' | 'Client' | null

export interface AuthenticatedUser {
  id: string
  name: string
  email?: string
  phone?: string
}

interface AuthState {
  accessToken: string | null
  user: AuthenticatedUser | null
  role: AuthRole

  setAuth: (payload: { accessToken: string; user: AuthenticatedUser; role: AuthRole }) => void
  setAccessToken: (token: string | null) => void
  clearAuth: () => void
}

export const useAuthStore = create((set) => ({
  accessToken: null,
  user: null,
  role: null,

  setAuth: ({ accessToken, user, role }) => set({ accessToken, user, role }),
  setAccessToken: (token) => set({ accessToken: token }),
  clearAuth: () => set({ accessToken: null, user: null, role: null }),
}))
```

```typescript
// lib/stores/ui.store.ts
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export type ModalName =
  | 'create-project'
  | 'edit-project'
  | 'create-unit'
  | 'create-owner'
  | 'create-payment'
  | 'create-payout'
  | 'confirm'
  | null

interface UIState {
  isSidebarOpen: boolean
  activeModal: ModalName

  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
  openModal: (name: NonNullable) => void
  closeModal: () => void
}

export const useUIStore = create()(
  persist(
    (set) => ({
      isSidebarOpen: true,
      activeModal: null,

      toggleSidebar: () => set((s) => ({ isSidebarOpen: !s.isSidebarOpen })),
      setSidebarOpen: (open) => set({ isSidebarOpen: open }),
      openModal: (name) => set({ activeModal: name }),
      closeModal: () => set({ activeModal: null }),
    }),
    {
      name: 'rental-ui-store',
      storage: createJSONStorage(() => localStorage),
      // ONLY persist sidebar state — never the modal state
      partialize: (state) => ({ isSidebarOpen: state.isSidebarOpen }),
    }
  )
)
```

```typescript
// lib/stores/index.ts
export { useAuthStore } from './auth.store'
export type { AuthRole, AuthenticatedUser } from './auth.store'
export { useUIStore } from './ui.store'
export type { ModalName } from './ui.store'
```

#### Files to MODIFY:

None.

#### Files NOT to touch:

```
lib/api/axios.ts                    ← FE-1-AUTH-05 will wire the auth store in
lib/hooks/usePermissions.ts         ← FE-1-UI-10 will read from this store
```

---

### Section 10 — UX & Loading State Rules

N/A — stores have no UI directly.

---

### Section 11 — Verification Steps

**Setup:**
1. FE-0-INFRA-02 must be merged

**Happy path:**
1. In a temporary test component, call `const token = useAuthStore((s) => s.accessToken)` → expected: returns `null` initially
2. Call `useAuthStore.getState().setAuth({ accessToken: 'abc', user: {...}, role: 'sales' })` → expected: state updates
3. Re-render component → expected: `token` now equals `'abc'`
4. Call `useAuthStore.getState().clearAuth()` → expected: all fields back to `null`
5. Test UI store: call `useUIStore.getState().toggleSidebar()` → expected: `isSidebarOpen` flips
6. Refresh the page → expected: `isSidebarOpen` is restored from localStorage; `accessToken` is back to `null` (NOT persisted, by design)

**Edge cases:**
1. Open dev tools, run `localStorage.getItem('rental-ui-store')` → expected: only `isSidebarOpen` is in there, NEVER the access token or user
2. Try `useUIStore.getState().openModal('confirm')` → expected: `activeModal === 'confirm'`
3. Try `useUIStore.getState().openModal('non-existent' as any)` → expected: TypeScript compile error

**Permission test:**
N/A — stores don't enforce permissions; consumers do.

---

### Section 12 — Acceptance Criteria

**Functionality:**
- [ ] `useAuthStore` exposes `accessToken`, `user`, `role`, `setAuth`, `setAccessToken`, `clearAuth`
- [ ] `useUIStore` exposes `isSidebarOpen`, `activeModal`, `toggleSidebar`, `setSidebarOpen`, `openModal`, `closeModal`
- [ ] Auth store has NO persist middleware
- [ ] UI store has persist middleware that ONLY persists `isSidebarOpen`
- [ ] `clearAuth()` resets all auth fields atomically
- [ ] `setAuth()` updates all fields atomically (no partial updates)

**Data & State:**
- [ ] No server data is stored in either store
- [ ] No `localStorage` access for the auth store
- [ ] No `localStorage` access for `activeModal` or `accessToken` (only `isSidebarOpen` persists)
- [ ] No imports from `lib/api/services/` — stores don't call APIs

**UX States:**
- [x] N/A

**TypeScript:**
- [ ] All types exported alongside the hooks
- [ ] `AuthRole` type matches the backend's `AdminRole` enum + `owner` + `client`
- [ ] `ModalName` is a typed union (not `string`)
- [ ] No `any` type used
- [ ] Zero TypeScript errors

**Architecture:**
- [ ] Auth store is in `lib/stores/auth.store.ts`
- [ ] UI store is in `lib/stores/ui.store.ts`
- [ ] Barrel export exists in `lib/stores/index.ts`
- [ ] Stores have no dependencies other than `zustand` and `zustand/middleware`

**Performance:**
- [ ] Selective subscriptions work: `useAuthStore((s) => s.accessToken)` only re-renders when token changes (not on user/role changes)

**Role-based access:**
- [x] N/A

---

### Section 13 — Notes for AI / Common Mistakes

**DO:**
- Use Zustand v5 syntax: `create<State>()(...)` — note the second parens for type inference
- Use selectors when reading from stores in components: `useAuthStore((s) => s.accessToken)` — NOT `useAuthStore().accessToken` (causes unnecessary re-renders)
- Use `getState()` for reading outside React (e.g., in the Axios interceptor)
- Use `partialize` to limit what gets persisted in the UI store
- Atomically reset all fields in `clearAuth` — never leave partial state

**DO NOT:**
- ⛔ DO NOT USE ANY MOCK DATA. The stores are filled by REAL login API responses in FE-1-AUTH-01..04. Do NOT seed them with fake users for "testing" — use the real auth flow.
- Do NOT add `persist` middleware to the auth store — tokens must be memory-only
- Do NOT store the refresh token here — it lives in the HttpOnly cookie set by the backend
- Do NOT add any server data fields (no `units`, `bookings`, `leads` here)
- Do NOT use Zustand for form state — that is React Hook Form
- Do NOT use `useEffect` to sync stores with each other — use selectors and actions instead
- Do NOT export the raw `set` function — only export action methods
- Do NOT skip `createJSONStorage(() => localStorage)` — direct `localStorage` references break SSR
- Do NOT add a dev-tools middleware unconditionally — wrap in `NODE_ENV === 'development'` if added at all

**WATCH OUT FOR:**
- Zustand v5 dropped some legacy APIs from v4 — verify you're using the v5 patterns (the second parens after `create<T>()`)
- The `activeModal` field MUST NOT be persisted — if a user closes the browser with a modal open, it shouldn't reopen on next visit
- The `isSidebarOpen` persist key (`rental-ui-store`) must be unique to avoid collisions if other Zustand stores are added later
- SSR: `persist` middleware can cause hydration mismatches if `isSidebarOpen` differs between server and client. Zustand v5 handles this via `skipHydration` option if needed — flag if hydration warnings appear
- Selective subscriptions: `useAuthStore((s) => s.user)` returns a new object reference on every set, even if user didn't change. If this becomes a perf issue, use `useShallow` from `zustand/react/shallow`

**REFERENCES:**
- Zustand v5 docs: https://zustand-demo.pmnd.rs/
- Backend Swagger — `AuthenticatedUserResponse` schema (matches `AuthenticatedUser` interface here)
- API Reference — `AdminRole` enum (SuperAdmin / Sales / Finance / Tech)
- Related: FE-0-INFRA-03 (Axios interceptor reads from auth store), FE-1-AUTH-05 (wires interceptor + middleware), FE-1-UI-10 (`usePermissions` reads `role`)

---

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TICKET ID: FE-0-INFRA-06
TITLE: Configure TanStack Query and create query keys factory
WAVE: Wave 0 — Foundation & Infrastructure
DOMAIN: INFRA
PRIORITY: Critical
DEPENDS ON: FE-0-INFRA-02
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section 1 — Walkthrough

**What is this ticket about?**
Every piece of server data in the entire app — units, bookings, leads, notifications, payouts, reports — is fetched and cached by TanStack Query. This ticket sets up the QueryClient with sensible defaults (so individual queries don't have to repeat config), wraps the app in `QueryClientProvider`, and creates a centralized "query keys factory" that every hook in later waves uses to identify their queries. Without the factory, query keys end up as inline arrays scattered across hundreds of files — causing typos, miscached invalidations, and unfindable bugs.

**Why does this ticket exist NOW (in this wave)?**
Every Wave 2-7 hook calls `useQuery` and uses query keys. The QueryClient and the keys factory must exist before those hooks are written. Establishing the factory ONCE here also enforces a consistent invalidation pattern: when a booking is updated, the hook invalidates `queryKeys.bookings.all` — never an inline `['bookings']` that might not match elsewhere.

**What does success look like?**
A developer/AI implementer can write `useQuery({ queryKey: queryKeys.units.byId(id), queryFn: () => unitsService.getById(id) })` and trust that it shares cache with every other call to that same key. Invalidating `queryKeys.units.all` reliably refetches every unit-related query.

---

### Section 2 — Objective

Configure a single `QueryClient` instance with project-wide defaults, wrap the root layout in `QueryClientProvider`, and build the typed `queryKeys` factory in `lib/utils/query-keys.ts` so every Wave 2-7 hook uses consistent cache identifiers and invalidations work predictably.

---

### Section 3 — User-Facing Outcome

The developer/AI implementer can:
- Use `useQuery({ queryKey: queryKeys.X.Y, queryFn: ... })` in any hook with confidence the cache key matches across the app
- Call `queryClient.invalidateQueries({ queryKey: queryKeys.X.all })` and refetch every query under that domain
- See queries in the React Query DevTools (in development only)
- Trust that queries don't refetch on every window focus (`refetchOnWindowFocus: false`)

---

### Section 4 — In Scope

- [ ] Create `lib/providers/query-provider.tsx` — `'use client'` component that provides QueryClient
- [ ] Configure `QueryClient` with defaults from the Frontend Plan:
      - `staleTime: 1000 * 60 * 2` (2 minutes)
      - `gcTime: 1000 * 60 * 10` (10 minutes)
      - `retry: 1`
      - `refetchOnWindowFocus: false`
      - `refetchOnReconnect: true`
- [ ] Wrap the root `app/layout.tsx` in `<QueryProvider>`
- [ ] Conditionally include `<ReactQueryDevtools />` only when `NODE_ENV === 'development'`
- [ ] Create `lib/utils/query-keys.ts` with the full key factory for every domain
- [ ] Use the canonical hierarchical pattern: `[domain] → [domain, 'list'] → [domain, 'list', filters] → [domain, 'detail', id]`
- [ ] Cover ALL domains that will need queries: projects, units, bookings, crm, owners, clients, payments, invoices, finance, reports, reviews, notifications, ownerPortal, amenities

**Files to create:**
- `lib/providers/query-provider.tsx` — client component wrapping `QueryClientProvider`
- `lib/utils/query-keys.ts` — typed query keys factory

**Files to modify:**
- `app/layout.tsx` — add `<QueryProvider>` wrapper

---

### Section 5 — Out of Scope

- Do NOT create any service files or hooks — those are domain-specific in later waves
- Do NOT pre-populate the cache with any seed data
- Do NOT add a custom `queryFn` default — every query brings its own
- Do NOT add devtools to production builds — only when `NODE_ENV === 'development'`
- Do NOT add suspense mode globally — opt-in per query
- Do NOT add error boundaries here — that is FE-1-UI-09

---

### Section 6 — Technical Contract

#### 6a. Component Props Interface

```typescript
// QueryProvider component
interface QueryProviderProps {
  children: ReactNode
}
```

#### 6b. Hook Return Type

N/A — this ticket creates a provider, not a hook. Hooks use `useQuery` from `@tanstack/react-query` directly with the keys from this file.

#### 6c. Zod Schema

N/A.

#### 6d. Key Enums / Constants Used

The full `queryKeys` factory:

```typescript
export const queryKeys = {
  // ──────────── PROJECTS ────────────
  projects: {
    all: ['projects'] as const,
    list: () => [...queryKeys.projects.all, 'list'] as const,
    detail: (id: string) => [...queryKeys.projects.all, 'detail', id] as const,
  },

  // ──────────── UNITS ────────────
  units: {
    all: ['units'] as const,
    publicList: (filters?: object) => [...queryKeys.units.all, 'public', 'list', filters ?? {}] as const,
    publicDetail: (id: string) => [...queryKeys.units.all, 'public', 'detail', id] as const,
    internalList: (filters?: object) => [...queryKeys.units.all, 'internal', 'list', filters ?? {}] as const,
    internalDetail: (id: string) => [...queryKeys.units.all, 'internal', 'detail', id] as const,
    images: (unitId: string) => [...queryKeys.units.all, unitId, 'images'] as const,
    amenities: (unitId: string) => [...queryKeys.units.all, unitId, 'amenities'] as const,
    seasonalPricing: (unitId: string) => [...queryKeys.units.all, unitId, 'seasonal-pricing'] as const,
    dateBlocks: (unitId: string) => [...queryKeys.units.all, unitId, 'date-blocks'] as const,
    availability: (unitId: string, range?: object) => [...queryKeys.units.all, unitId, 'availability', range ?? {}] as const,
    pricing: (unitId: string, range?: object) => [...queryKeys.units.all, unitId, 'pricing', range ?? {}] as const,
  },

  // ──────────── AMENITIES ────────────
  amenities: {
    all: ['amenities'] as const,
    list: () => [...queryKeys.amenities.all, 'list'] as const,
  },

  // ──────────── BOOKINGS ────────────
  bookings: {
    all: ['bookings'] as const,
    list: (filters?: object) => [...queryKeys.bookings.all, 'list', filters ?? {}] as const,
    detail: (id: string) => [...queryKeys.bookings.all, 'detail', id] as const,
    statusHistory: (id: string) => [...queryKeys.bookings.all, id, 'status-history'] as const,
    notes: (id: string) => [...queryKeys.bookings.all, id, 'notes'] as const,
    assignment: (id: string) => [...queryKeys.bookings.all, id, 'assignment'] as const,
    financeSnapshot: (id: string) => [...queryKeys.bookings.all, id, 'finance-snapshot'] as const,
  },

  // ──────────── CRM LEADS ────────────
  crm: {
    all: ['crm'] as const,
    leads: (filters?: object) => [...queryKeys.crm.all, 'leads', filters ?? {}] as const,
    leadDetail: (id: string) => [...queryKeys.crm.all, 'lead', id] as const,
    leadNotes: (leadId: string) => [...queryKeys.crm.all, leadId, 'notes'] as const,
    leadAssignment: (leadId: string) => [...queryKeys.crm.all, leadId, 'assignment'] as const,
  },

  // ──────────── OWNERS ────────────
  owners: {
    all: ['owners'] as const,
    list: (filters?: object) => [...queryKeys.owners.all, 'list', filters ?? {}] as const,
    detail: (id: string) => [...queryKeys.owners.all, 'detail', id] as const,
    payouts: (id: string) => [...queryKeys.owners.all, id, 'payouts'] as const,
    payoutSummary: (id: string) => [...queryKeys.owners.all, id, 'payout-summary'] as const,
  },

  // ──────────── CLIENTS ────────────
  clients: {
    all: ['clients'] as const,
    list: (filters?: object) => [...queryKeys.clients.all, 'list', filters ?? {}] as const,
    detail: (id: string) => [...queryKeys.clients.all, 'detail', id] as const,
  },

  // ──────────── PAYMENTS ────────────
  payments: {
    all: ['payments'] as const,
    list: (filters?: object) => [...queryKeys.payments.all, 'list', filters ?? {}] as const,
    detail: (id: string) => [...queryKeys.payments.all, 'detail', id] as const,
    byBooking: (bookingId: string) => [...queryKeys.payments.all, 'booking', bookingId] as const,
  },

  // ──────────── INVOICES ────────────
  invoices: {
    all: ['invoices'] as const,
    list: (filters?: object) => [...queryKeys.invoices.all, 'list', filters ?? {}] as const,
    detail: (id: string) => [...queryKeys.invoices.all, 'detail', id] as const,
    balance: (id: string) => [...queryKeys.invoices.all, id, 'balance'] as const,
  },

  // ──────────── OWNER PAYOUTS ────────────
  ownerPayouts: {
    all: ['owner-payouts'] as const,
    byOwner: (ownerId: string) => [...queryKeys.ownerPayouts.all, 'owner', ownerId] as const,
    byBooking: (bookingId: string) => [...queryKeys.ownerPayouts.all, 'booking', bookingId] as const,
  },

  // ──────────── REPORTS ────────────
  reports: {
    all: ['reports'] as const,
    bookingsSummary: (filters?: object) => [...queryKeys.reports.all, 'bookings', 'summary', filters ?? {}] as const,
    bookingsDaily: (filters?: object) => [...queryKeys.reports.all, 'bookings', 'daily', filters ?? {}] as const,
    financeSummary: (filters?: object) => [...queryKeys.reports.all, 'finance', 'summary', filters ?? {}] as const,
    financeDaily: (filters?: object) => [...queryKeys.reports.all, 'finance', 'daily', filters ?? {}] as const,
  },

  // ──────────── REVIEWS ────────────
  reviews: {
    all: ['reviews'] as const,
    publicByUnit: (unitId: string, filters?: object) => [...queryKeys.reviews.all, 'public', unitId, filters ?? {}] as const,
    publicByUnitSummary: (unitId: string) => [...queryKeys.reviews.all, 'public', unitId, 'summary'] as const,
    moderationList: (filters?: object) => [...queryKeys.reviews.all, 'moderation', filters ?? {}] as const,
    statusHistory: (reviewId: string) => [...queryKeys.reviews.all, reviewId, 'status-history'] as const,
    byBooking: (bookingId: string) => [...queryKeys.reviews.all, 'booking', bookingId] as const,
    reply: (reviewId: string) => [...queryKeys.reviews.all, reviewId, 'reply'] as const,
  },

  // ──────────── NOTIFICATIONS ────────────
  notifications: {
    all: ['notifications'] as const,
    adminInbox: () => [...queryKeys.notifications.all, 'admin', 'inbox'] as const,
    adminInboxSummary: () => [...queryKeys.notifications.all, 'admin', 'inbox', 'summary'] as const,
    clientInbox: () => [...queryKeys.notifications.all, 'client', 'inbox'] as const,
    clientInboxSummary: () => [...queryKeys.notifications.all, 'client', 'inbox', 'summary'] as const,
    ownerInbox: () => [...queryKeys.notifications.all, 'owner', 'inbox'] as const,
    ownerInboxSummary: () => [...queryKeys.notifications.all, 'owner', 'inbox', 'summary'] as const,
    adminPreferences: () => [...queryKeys.notifications.all, 'admin', 'preferences'] as const,
    clientPreferences: () => [...queryKeys.notifications.all, 'client', 'preferences'] as const,
    ownerPreferences: () => [...queryKeys.notifications.all, 'owner', 'preferences'] as const,
  },

  // ──────────── OWNER PORTAL ────────────
  ownerPortal: {
    all: ['owner-portal'] as const,
    dashboard: () => [...queryKeys.ownerPortal.all, 'dashboard'] as const,
    units: () => [...queryKeys.ownerPortal.all, 'units'] as const,
    unitDetail: (unitId: string) => [...queryKeys.ownerPortal.all, 'unit', unitId] as const,
    bookings: () => [...queryKeys.ownerPortal.all, 'bookings'] as const,
    bookingDetail: (id: string) => [...queryKeys.ownerPortal.all, 'booking', id] as const,
    finance: () => [...queryKeys.ownerPortal.all, 'finance'] as const,
    financeSummary: () => [...queryKeys.ownerPortal.all, 'finance', 'summary'] as const,
    financeBooking: (bookingId: string) => [...queryKeys.ownerPortal.all, 'finance', 'booking', bookingId] as const,
  },

  // ──────────── ADMIN USERS ────────────
  adminUsers: {
    all: ['admin-users'] as const,
    list: () => [...queryKeys.adminUsers.all, 'list'] as const,
  },
} as const
```

---

### Section 7 — API Integration

N/A — query keys are local; the actual API calls are in service files and hooks.

---

### Section 8 — State & Data Management Rules

| State | Where it lives | Why |
|---|---|---|
| Server data cache | TanStack Query (managed by QueryClient) | the entire purpose |
| Query keys | `lib/utils/query-keys.ts` | centralized identifiers |
| Refetch state | TanStack Query | not custom |

**Rules for this ticket:**
- [x] No server data in Zustand
- [x] No `useEffect` for fetching
- [x] No inline query keys (every key MUST come from `queryKeys`)

---

### Section 9 — Component & File Deliverables

#### Files to CREATE:

```typescript
// lib/providers/query-provider.tsx
'use client'

import { ReactNode, useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'

export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 2,    // 2 minutes
            gcTime: 1000 * 60 * 10,      // 10 minutes
            retry: 1,
            refetchOnWindowFocus: false,
            refetchOnReconnect: true,
          },
          mutations: {
            retry: 0,
          },
        },
      })
  )

  return (
    
      {children}
      {process.env.NODE_ENV === 'development' && }
    
  )
}
```

```typescript
// lib/utils/query-keys.ts
// (full content shown in section 6d)
```

#### Files to MODIFY:

```tsx
// app/layout.tsx — add QueryProvider wrapper
// (Note: design system tokens, fonts, etc. are added in FE-0-INFRA-08)
import { QueryProvider } from '@/lib/providers/query-provider'
// ...
return (
  
    
      
        {children}
      
    
  
)
```

#### Files NOT to touch:

```
lib/api/axios.ts              ← FE-0-INFRA-03 owns it
lib/stores/*                  ← FE-0-INFRA-05 owns them
```

---

### Section 10 — UX & Loading State Rules

N/A — UX state is per-query in consumer hooks (Wave 2+).

---

### Section 11 — Verification Steps

**Setup:**
1. FE-0-INFRA-02 must be merged

**Happy path:**
1. Run `pnpm dev` → expected: dev server starts
2. Open the app in browser → expected: a small floating React Query DevTools button appears (only in dev)
3. In a temporary test component, write `useQuery({ queryKey: queryKeys.projects.list(), queryFn: async () => [] })` → expected: query appears in DevTools panel
4. Run `pnpm build` → expected: production build succeeds and DevTools is NOT in the bundle

**Edge cases:**
1. Try to use an inline query key like `['units']` → expected: should be flagged in code review (no automatic enforcement)
2. Set `NODE_ENV=production` and run `pnpm build` → expected: bundle does not include DevTools
3. Use `queryClient.invalidateQueries({ queryKey: queryKeys.units.all })` → expected: invalidates ALL unit-related queries (publicList, internalList, detail, images, etc.)

**Permission test:**
N/A.

---

### Section 12 — Acceptance Criteria

**Functionality:**
- [ ] `QueryClient` is created with the documented defaults
- [ ] `QueryProvider` is a `'use client'` component
- [ ] `app/layout.tsx` is wrapped in `<QueryProvider>`
- [ ] React Query DevTools renders only in development
- [ ] `queryKeys` factory covers every domain listed in section 6d
- [ ] Every domain has an `all` key that broader invalidations can target

**Data & State:**
- [ ] No server data is fetched in this ticket — only the infrastructure
- [ ] Query client uses `useState` to avoid re-creation on re-renders
- [ ] No `useEffect` introduced anywhere

**UX States:**
- [x] N/A

**TypeScript:**
- [ ] `queryKeys` uses `as const` so keys are literal types
- [ ] All keys return `readonly` arrays (via `as const`)
- [ ] No `any` type used
- [ ] Zero TypeScript errors

**Architecture:**
- [ ] `QueryProvider` is in `lib/providers/query-provider.tsx`
- [ ] `queryKeys` is in `lib/utils/query-keys.ts`
- [ ] No alternate query key patterns used (no inline arrays anywhere)
- [ ] DevTools import is gated by `process.env.NODE_ENV` check

**Performance:**
- [ ] `staleTime: 2min` reduces redundant network requests
- [ ] `gcTime: 10min` keeps recently-used data cached
- [ ] `refetchOnWindowFocus: false` prevents unnecessary refetches when alt-tabbing

**Role-based access:**
- [x] N/A

---

### Section 13 — Notes for AI / Common Mistakes

**DO:**
- Use `useState(() => new QueryClient({...}))` to memoize the client across re-renders
- Use the hierarchical key pattern: `all > list/detail > sub-resource`
- Always use `as const` on keys so TypeScript narrows the literal types
- Build dynamic keys with the spread pattern: `[...queryKeys.X.all, ...]` so `invalidateQueries({ queryKey: queryKeys.X.all })` matches everything underneath
- Wrap DevTools in `NODE_ENV === 'development'` check

**DO NOT:**
- ⛔ DO NOT USE ANY MOCK DATA. The QueryClient is the cache for REAL backend data only. Do NOT seed the cache with fake data, do NOT use `setQueryData` in any test/dev scenario with mock objects.
- Do NOT create the QueryClient inside the component body without `useState` — every re-render would make a new client and lose the cache
- Do NOT add a global `queryFn` default — every query brings its own
- Do NOT add `suspense: true` globally — that requires Suspense boundaries that don't exist yet
- Do NOT export DevTools from this provider — let Next.js tree-shake it out
- Do NOT use inline query keys anywhere in later waves — always import from `queryKeys`
- Do NOT make query keys too granular: a key per filter combination is fine; a key per render is not
- Do NOT skip the `as const` — without it, TypeScript widens to `string[]` and invalidation patterns become fragile

**WATCH OUT FOR:**
- The `gcTime` setting (formerly `cacheTime` in v4) controls how long unused data stays in memory. 10 minutes is generous; lower if memory pressure becomes an issue
- `refetchOnReconnect: true` is intentional — the broker has flaky internet, and reconnect should fetch fresh data
- The DevTools button position can clash with Lenis smooth scroll cursor — that's cosmetic, ignore unless reported
- Do not put the `QueryProvider` inside `template.tsx` — that re-creates the client on every navigation
- The empty filter object `{}` in dynamic keys is intentional: `queryKeys.units.publicList()` and `queryKeys.units.publicList({})` should produce the same key

**REFERENCES:**
- TanStack Query v5 docs: https://tanstack.com/query/latest
- Frontend Plan Section 7.5 (referenced indirectly) — staleTime/gcTime/retry defaults
- Related: FE-0-INFRA-03 (Axios — used by service layer that hooks call), FE-0-INFRA-05 (Zustand stores for non-server state)

---

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TICKET ID: FE-0-INFRA-07
TITLE: Create shared utilities, types, and constants scaffold
WAVE: Wave 0 — Foundation & Infrastructure
DOMAIN: INFRA
PRIORITY: Critical
DEPENDS ON: FE-0-INFRA-02
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section 1 — Walkthrough

**What is this ticket about?**
Across 117 tickets, the same handful of things will be needed everywhere: formatting Egyptian Pound currency, formatting dates, calculating night counts, mapping booking statuses to display labels, mapping admin roles to display labels, and a `cn()` Tailwind class merger. Built once, used hundreds of times. Without these centralized utilities, every component would reinvent its own date formatter — leading to inconsistent display ("April 15" vs "15/04/2026" vs "Apr 15, 2026").

**Why does this ticket exist NOW (in this wave)?**
Every Wave 1+ ticket uses these. The very first UI ticket (FE-1-UI-01 Button) already uses `cn()`. Forms use `formatDate`. Status badges use the `BOOKING_STATUSES` constant. They all must exist before Wave 1 starts.

**What does success look like?**
A developer/AI implementer can write `formatCurrency(1500)` → `"1,500 EGP"`, `formatDate('2026-04-15')` → `"15 Apr 2026"`, `getNights('2026-04-15', '2026-04-20')` → `5`, `cn('px-4', condition && 'bg-red-500')` for class merging, and import status enums from a single canonical location.

---

### Section 2 — Objective

Create the shared utility functions, TypeScript common types, and label/color constants that the rest of the project will import from, eliminating per-ticket reinvention and ensuring consistent display across the app.

---

### Section 3 — User-Facing Outcome

The developer/AI implementer can:
- Format currency with `formatCurrency(amount)`
- Format dates and date ranges with `formatDate()`, `formatDateRange()`
- Calculate night count with `getNights()`
- Merge Tailwind classes safely with `cn()`
- Import canonical booking statuses, admin roles, payment types, etc. from constants files
- Use `ApiResponse<T>` and `PaginationMeta` types from a single source

---

### Section 4 — In Scope

- [ ] Create `lib/utils/cn.ts` — merges Tailwind classes using `clsx` + `tailwind-merge`
- [ ] Create `lib/utils/format.ts` — currency, date, date range, night counter formatters
- [ ] Create `lib/types/common.types.ts` — re-export `ApiResponse<T>`, `PaginationMeta`; add common shared types
- [ ] Create `lib/constants/booking-statuses.ts` — full enum + label + color + ordered pipeline columns
- [ ] Create `lib/constants/roles.ts` — admin roles enum + labels
- [ ] Create `lib/constants/payment-statuses.ts` — payment lifecycle statuses
- [ ] Create `lib/constants/booking-sources.ts` — Website / App / WhatsApp / PhoneCall / Referral
- [ ] Create `lib/constants/unit-types.ts` — villa / chalet / studio + labels
- [ ] Create `lib/constants/unit-activity.ts` — boolean helper labels for `isActive`
- [ ] Create `lib/constants/notification-channels.ts` — Email / SMS / InApp + labels
- [ ] Create `lib/constants/date-block-reasons.ts` — Maintenance / OwnerUse / Other + labels
- [ ] Create `lib/constants/routes.ts` — every URL the app navigates to as constants
- [ ] Update barrel `index.ts` files

**Files to create:** See section 9.

**Files to modify:**
- `lib/utils/index.ts` — barrel re-exports
- `lib/types/index.ts` — barrel re-exports
- `lib/constants/index.ts` — barrel re-exports

---

### Section 5 — Out of Scope

- Do NOT create domain-specific types here (`Booking`, `Unit`, `Owner`) — those go in per-domain `lib/types/booking.types.ts`, etc., in their respective waves
- Do NOT create form schemas — those are per-ticket Zod schemas in later waves
- Do NOT add language/i18n — Arabic/English support is Phase 2
- Do NOT add complex date math (timezone conversions, recurring patterns) — only what the MVP needs
- Do NOT include RTL handling utilities — Phase 2 per Clone.md Fix #14
- Do NOT add a generic `useDebounce` or `useThrottle` hook — those go in `lib/hooks/` per ticket that needs them
- Do NOT include English/Arabic dual labels — display labels are English in MVP per Clone.md Section 11

---

### Section 6 — Technical Contract

#### 6a. Component Props Interface

N/A — utility module.

#### 6b. Hook Return Type

N/A.

#### 6c. Zod Schema

N/A.

#### 6d. Key Enums / Constants Used

```typescript
// lib/constants/crm-and-booking-statuses.ts
export const CRM_LEAD_STATUSES = {
  Prospecting: 'Prospecting',
  Relevant: 'Relevant',
  NoAnswer: 'NoAnswer',
  NotRelevant: 'NotRelevant',
  Booked: 'Booked',
  Confirmed: 'Confirmed',
  CheckIn: 'CheckIn',
  Completed: 'Completed',
  Cancelled: 'Cancelled',
  LeftEarly: 'LeftEarly',
} as const

export type CrmLeadStatus = (typeof CRM_LEAD_STATUSES)[keyof typeof CRM_LEAD_STATUSES]

export const BOOKING_STATUSES = {
  Pending: 'Pending',
  Confirmed: 'Confirmed',
  CheckIn: 'CheckIn',
  Completed: 'Completed',
  Cancelled: 'Cancelled',
  LeftEarly: 'LeftEarly',
} as const

export type BookingStatus = (typeof BOOKING_STATUSES)[keyof typeof BOOKING_STATUSES]

export const CRM_STATUS_LABELS: Record<CrmLeadStatus, string> = {
  Prospecting: 'Prospecting',
  Relevant: 'Relevant',
  NoAnswer: 'No Answer',
  NotRelevant: 'Not Relevant',
  Booked: 'Booked',
  Confirmed: 'Confirmed',
  CheckIn: 'Check In',
  Completed: 'Completed',
  Cancelled: 'Cancelled',
  LeftEarly: 'Left Early',
}

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  Pending: 'Pending',
  Confirmed: 'Confirmed',
  CheckIn: 'Check In',
  Completed: 'Completed',
  Cancelled: 'Cancelled',
  LeftEarly: 'Left Early',
}

export const CRM_PIPELINE_COLUMNS: CrmLeadStatus[] = [
  'Prospecting',
  'Relevant',
  'NoAnswer',
  'Booked',
  'Confirmed',
  'CheckIn',
  'Completed',
]

export const CRM_CLOSED_STATUSES: CrmLeadStatus[] = [
  'NotRelevant',
  'Cancelled',
  'LeftEarly',
]

export const CRM_VALID_TRANSITIONS: Record<CrmLeadStatus, CrmLeadStatus[]> = {
  Prospecting: ['Relevant', 'NoAnswer', 'NotRelevant'],
  Relevant: ['Booked', 'NoAnswer', 'NotRelevant'],
  NoAnswer: ['Relevant', 'NotRelevant'],
  Booked: ['Confirmed', 'NotRelevant'],
  Confirmed: ['CheckIn', 'Cancelled'],
  CheckIn: ['Completed', 'LeftEarly'],
  Completed: [],
  Cancelled: [],
  LeftEarly: [],
  NotRelevant: [],
}
```

```typescript
// lib/constants/roles.ts
export const ADMIN_ROLES = {
  SuperAdmin: 'SuperAdmin',
  Sales: 'Sales',
  Finance: 'Finance',
  Tech: 'Tech',
} as const

export type AdminRole = (typeof ADMIN_ROLES)[keyof typeof ADMIN_ROLES]

export const ADMIN_ROLE_LABELS: Record<AdminRole, string> = {
  SuperAdmin: 'Super Admin',
  Sales: 'Sales',
  Finance: 'Finance',
  Tech: 'Tech',
}
```

```typescript
// lib/constants/payment-statuses.ts
export const PAYMENT_STATUSES = {
  Pending: 'Pending',
  Paid: 'Paid',
  Failed: 'Failed',
  Cancelled: 'Cancelled',
} as const

export type PaymentStatus = (typeof PAYMENT_STATUSES)[keyof typeof PAYMENT_STATUSES]

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  Pending: 'Pending',
  Paid: 'Paid',
  Failed: 'Failed',
  Cancelled: 'Cancelled',
}
```

```typescript
// lib/constants/booking-sources.ts
export const BOOKING_SOURCES = {
  Website: 'Website',
  App: 'App',
  WhatsApp: 'WhatsApp',
  PhoneCall: 'PhoneCall',
  Referral: 'Referral',
} as const

export type BookingSource = (typeof BOOKING_SOURCES)[keyof typeof BOOKING_SOURCES]

export const BOOKING_SOURCE_LABELS: Record<BookingSource, string> = {
  Website: 'Website',
  App: 'App',
  WhatsApp: 'WhatsApp',
  PhoneCall: 'Phone Call',
  Referral: 'Referral',
}
```

```typescript
// lib/constants/unit-types.ts
export const UNIT_TYPES = {
  villa:   'villa',
  chalet:  'chalet',
  studio:  'studio',
} as const

export type UnitType = (typeof UNIT_TYPES)[keyof typeof UNIT_TYPES]

export const UNIT_TYPE_LABELS: Record = {
  villa:  'Villa',
  chalet: 'Chalet',
  studio: 'Studio',
}
```

```typescript
// lib/constants/unit-activity.ts
export const UNIT_ACTIVITY_LABELS: Record<'true' | 'false', string> = {
  true: 'Active',
  false: 'Inactive',
}

export function getUnitActivityLabel(isActive: boolean): string {
  return UNIT_ACTIVITY_LABELS[String(isActive) as 'true' | 'false']
}
```

```typescript
// lib/constants/notification-channels.ts
export const NOTIFICATION_CHANNELS = {
  Email: 'Email',
  SMS: 'SMS',
  InApp: 'InApp',
} as const

export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[keyof typeof NOTIFICATION_CHANNELS]

export const NOTIFICATION_CHANNEL_LABELS: Record<NotificationChannel, string> = {
  Email: 'Email',
  SMS: 'SMS',
  InApp: 'In App',
}
```

```typescript
// lib/constants/date-block-reasons.ts
export const DATE_BLOCK_REASONS = {
  Maintenance: 'Maintenance',
  OwnerUse: 'OwnerUse',
  Other: 'Other',
} as const

export type DateBlockReason = (typeof DATE_BLOCK_REASONS)[keyof typeof DATE_BLOCK_REASONS]

export const DATE_BLOCK_REASON_LABELS: Record<DateBlockReason, string> = {
  Maintenance: 'Maintenance',
  OwnerUse: "Owner's Personal Use",
  Other: 'Other',
}
```

```typescript
// lib/constants/routes.ts
export const ROUTES = {
  // Public
  home: '/',
  unitsList: '/units',
  unitDetail: (id: string) => `/units/${id}`,
  bookingConfirmation: (id: string) => `/bookings/${id}`,

  // Auth
  auth: {
    adminLogin:  '/auth/admin/login',
    ownerLogin:  '/auth/owner/login',
    clientLogin: '/auth/client/login',
    register:    '/auth/client/register',
  },

  // Admin
  admin: {
    root:     '/admin',
    dashboard:'/admin/dashboard',
    projects:    '/admin/projects',
    units: {
      list:   '/admin/units',
      detail: (id: string) => `/admin/units/${id}`,
      create: '/admin/units/new',
    },
    crm: {
      index: '/admin/crm',
    },
    bookings: {
      list:   '/admin/bookings',
      detail: (id: string) => `/admin/bookings/${id}`,
    },
    finance: '/admin/finance',
    owners: {
      list:   '/admin/owners',
      detail: (id: string) => `/admin/owners/${id}`,
      create: '/admin/owners/new',
    },
    clients: {
      list:   '/admin/clients',
      detail: (id: string) => `/admin/clients/${id}`,
    },
    reviews:  '/admin/reviews',
    settings: '/admin/settings',
  },

  // Owner Portal
  owner: {
    root:        '/owner',
    dashboard:   '/owner/dashboard',
    units:       '/owner/units',
    unitDetail:  (id: string) => `/owner/units/${id}`,
    bookings:    '/owner/bookings',
    bookingDetail: (id: string) => `/owner/bookings/${id}`,
    finance:     '/owner/finance',
    notifications: '/owner/notifications',
  },

  // Client / Account
  client: {
    account:     '/account',
    bookings:    '/account/bookings',
    bookingReview: (id: string) => `/account/bookings/${id}/review`,
    notifications: '/account/notifications',
  },
} as const
```

---

### Section 7 — API Integration

N/A.

---

### Section 8 — State & Data Management Rules

N/A — pure utilities and constants.

---

### Section 9 — Component & File Deliverables

#### Files to CREATE:

```typescript
// lib/utils/cn.ts
import clsx, { ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
```

```typescript
// lib/utils/format.ts
import { differenceInDays, format, parseISO } from 'date-fns'

export function formatCurrency(amount: number): string {
  // Egyptian Pound — no decimals for whole numbers, comma thousand separators
  if (Number.isNaN(amount) || amount === null || amount === undefined) return '—'
  return `${amount.toLocaleString('en-US', { maximumFractionDigits: 2 })} EGP`
}

export function formatDate(input: string | Date): string {
  if (!input) return '—'
  const date = typeof input === 'string' ? parseISO(input) : input
  return format(date, 'd MMM yyyy')   // e.g., "15 Apr 2026"
}

export function formatDateLong(input: string | Date): string {
  if (!input) return '—'
  const date = typeof input === 'string' ? parseISO(input) : input
  return format(date, 'EEEE, d MMMM yyyy')  // e.g., "Wednesday, 15 April 2026"
}

export function formatDateRange(start: string | Date, end: string | Date): string {
  if (!start || !end) return '—'
  return `${formatDate(start)} → ${formatDate(end)}`
}

export function getNights(checkIn: string | Date, checkOut: string | Date): number {
  if (!checkIn || !checkOut) return 0
  const a = typeof checkIn === 'string' ? parseISO(checkIn) : checkIn
  const b = typeof checkOut === 'string' ? parseISO(checkOut) : checkOut
  return Math.max(0, differenceInDays(b, a))
}

export function formatRelativeTime(input: string | Date): string {
  // Quick relative time: "2 days ago", "3 hours ago"
  // Imports formatDistanceToNow from date-fns at call time
  if (!input) return '—'
  const date = typeof input === 'string' ? parseISO(input) : input
  const now = new Date()
  const diffDays = differenceInDays(now, date)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  return formatDate(date)
}
```

```typescript
// lib/types/common.types.ts
export type { ApiResponse, PaginationMeta } from '@/lib/api/types'

export type Maybe = T | null | undefined

// Standard list query filters base type
export interface ListFilters {
  page?: number
  pageSize?: number
  search?: string
}

// Used for select dropdowns
export interface SelectOption {
  value: T
  label: string
}
```

```typescript
// lib/utils/index.ts (barrel)
export * from './cn'
export * from './format'
export * from './query-keys'
```

```typescript
// lib/types/index.ts (barrel)
export * from './common.types'
```

```typescript
// lib/constants/index.ts (barrel)
export * from './booking-statuses'
export * from './booking-sources'
export * from './roles'
export * from './payment-statuses'
export * from './unit-types'
export * from './unit-statuses'
export * from './notification-channels'
export * from './date-block-reasons'
export * from './routes'
```

#### Files to MODIFY:

None beyond the barrel files listed above.

#### Files NOT to touch:

```
lib/types/booking.types.ts     ← Wave 3 ticket
lib/types/unit.types.ts        ← Wave 2 ticket
lib/types/owner.types.ts       ← Wave 4 ticket
lib/types/client.types.ts      ← Wave 4 ticket
```

---

### Section 10 — UX & Loading State Rules

| State | Required? | Behavior |
|---|---|---|
| Empty / null amounts | ✓ REQUIRED | `formatCurrency(null)` returns `'—'` |
| Empty / null dates | ✓ REQUIRED | `formatDate(null)` returns `'—'` |
| Invalid date strings | ✓ REQUIRED | `formatDate('garbage')` should not crash; returns `'—'` or throws caught error |

---

### Section 11 — Verification Steps

**Setup:**
1. FE-0-INFRA-02 must be merged

**Happy path:**
1. `formatCurrency(1500)` → expected: `"1,500 EGP"`
2. `formatCurrency(1234.56)` → expected: `"1,234.56 EGP"`
3. `formatCurrency(0)` → expected: `"0 EGP"`
4. `formatDate('2026-04-15')` → expected: `"15 Apr 2026"`
5. `formatDateRange('2026-04-15', '2026-04-20')` → expected: `"15 Apr 2026 → 20 Apr 2026"`
6. `getNights('2026-04-15', '2026-04-20')` → expected: `5`
7. `cn('px-4', false && 'bg-red', 'px-2')` → expected: `"px-2"` (twMerge resolves px conflict)
8. `BOOKING_STATUS_LABELS.confirmed` → expected: `"Confirmed"`
9. `ROUTES.admin.bookings.detail('abc-123')` → expected: `"/admin/bookings/abc-123"`

**Edge cases:**
1. `formatCurrency(NaN)` → expected: `"—"`, no crash
2. `formatCurrency(null as any)` → expected: `"—"`, no crash
3. `formatDate(null as any)` → expected: `"—"`, no crash
4. `formatDate('not-a-date')` → expected: `"—"` (or graceful error, never crash)
5. `getNights('2026-04-20', '2026-04-15')` → expected: `0` (negative days clamped to 0)
6. `cn('text-sm', undefined, null, false, 'text-base')` → expected: `"text-base"` (twMerge resolves)

**Permission test:**
N/A.

---

### Section 12 — Acceptance Criteria

**Functionality:**
- [ ] `cn()` correctly merges Tailwind classes including conflict resolution (twMerge)
- [ ] `formatCurrency(amount)` produces "X,XXX EGP" for all valid numbers, "—" for null/undefined/NaN
- [ ] `formatDate()` produces a consistent format across the app
- [ ] `formatDateRange()` produces "DATE → DATE"
- [ ] `getNights()` correctly counts nights between two dates, clamping negative results to 0
- [ ] All status/role/type constants exist with `as const` typing
- [ ] All `*_LABELS` records cover every enum value
- [ ] `VALID_TRANSITIONS` map matches the backend's state machine exactly
- [ ] `ROUTES` covers every URL the app navigates to

**Data & State:**
- [x] N/A — pure utilities

**UX States:**
- [ ] Null/undefined inputs to formatters return `"—"` instead of "null" or crashing

**TypeScript:**
- [ ] `BookingStatus`, `AdminRole`, `PaymentStatus`, etc., are union literal types (not `string`)
- [ ] `as const` is applied to every constant object
- [ ] No `any` type used
- [ ] Zero TypeScript errors

**Architecture:**
- [ ] Each constant lives in its own file (one concern per file)
- [ ] Barrel `index.ts` re-exports everything from each subdirectory
- [ ] `routes.ts` is the single source of truth for URLs
- [ ] No constants/utilities duplicated elsewhere in the project

**Performance:**
- [x] N/A

**Role-based access:**
- [x] N/A

---

### Section 13 — Notes for AI / Common Mistakes

**DO:**
- Use `as const` on every enum-like constant object so values become literal types
- Use `Record<EnumType, string>` for label maps so missing keys are caught at compile time
- Use `parseISO` from date-fns for parsing ISO date strings (not `new Date(string)`)
- Always handle null/undefined/NaN gracefully in formatters — the API CAN return null
- Centralize the state machine (`VALID_TRANSITIONS`) here so frontend never lets users click invalid transitions

**DO NOT:**
- ⛔ DO NOT USE ANY MOCK DATA. The constants here ARE real (they match the backend enums). For ALL future tickets, no fake data.
- Do NOT use `Date.parse()` or `new Date(string)` — locale-dependent and unreliable. Use `parseISO`.
- Do NOT hardcode currency symbol "EGP" or labels in any consumer file — always import from constants
- Do NOT inline any route string anywhere outside `ROUTES` — `<Link href="/admin/units">` is BANNED, use `<Link href={ROUTES.admin.units.list}>`
- Do NOT add Arabic labels — MVP is English (per Clone.md Section 11)
- Do NOT add timezone math — backend stores UTC, frontend displays in browser locale, that's it for MVP
- Do NOT use `any` type for the parsed date — use the date-fns return type
- Do NOT skip the `Record<T, ...>` typing on label maps — without it, missing keys silently break

**WATCH OUT FOR:**
- Constants must follow documented API casing (`SuperAdmin`, `CheckIn`, `LeftEarly`, `InApp`, `OwnerUse`) to avoid contract drift
- date-fns is tree-shakable — import named functions individually, not the whole library
- `tailwind-merge` updates with each Tailwind version — pin to a compatible version (^2.3.0 with Tailwind 3.4)
- The `formatCurrency` function uses `toLocaleString('en-US')` for thousand separators — Arabic locale would use `'ar-EG'`. MVP is English, but this is the line to change in Phase 2
- `VALID_TRANSITIONS` MUST match the backend's `BookingStatusTransitions.cs` exactly — any drift causes 422 errors when the user clicks a status the frontend allowed but the backend rejects
- The `cn()` function order matters: later classes win, so put conditional/dynamic classes LAST: `cn('px-4', condition && 'px-8')` correctly applies `px-8` if condition is true

**REFERENCES:**
- technical_req.md — full enum definitions (BookingStatus, AdminRole, etc.)
- Backend Swagger — exact enum values match these constants
- date-fns docs: https://date-fns.org/
- tailwind-merge docs: https://github.com/dcastil/tailwind-merge
- Related: every Wave 1+ ticket imports from this scaffold

---

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TICKET ID: FE-0-INFRA-08
TITLE: Build Design System (CSS variables + Tailwind config + fonts)
WAVE: Wave 0 — Foundation & Infrastructure
DOMAIN: INFRA
PRIORITY: Critical
DEPENDS ON: FE-0-INFRA-01, FE-0-INFRA-02
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section 1 — Walkthrough

**What is this ticket about?**
The Guest App in Wave 7 needs to deliver a luxury, cinematic experience (per Clone.md): warm terracotta colors, Playfair Display headlines, Inter body text, soft warm-toned shadows, generous spacing, and a full set of design tokens. Setting these up ONCE here in `tailwind.config.ts`, `globals.css`, and `app/layout.tsx` (font loading) means every component in every wave instantly inherits the right look, and the Guest App in Wave 7 can focus on cinematic motion instead of color hex codes.

The original Implementation Plan was missing this ticket — it had infra setup but no Design System. That gap would have blocked the Guest App in Wave 7. This ticket fills it.

**Why does this ticket exist NOW (in this wave)?**
Without the Design System, every Wave 1 UI component (Button, Input, Modal, etc.) would use Tailwind's default colors — which are wrong (cool grays, generic blue). They would all need to be reskinned later. Building the system NOW means Wave 1+ components are visually correct from day one.

**What does success look like?**
Run `pnpm dev`, look at any Tailwind class (`bg-primary-500`, `text-neutral-700`, `font-display`), and see the warm terracotta + serif aesthetic from Clone.md. CSS variables are accessible from every CSS module. Fonts are preloaded by Next.js. No FOIT (flash of invisible text) on page load.

---

### Section 2 — Objective

Configure the project's complete Design System — CSS variables, Tailwind theme extensions, font loading, easing functions, shadows, radii, breakpoints, and global resets — so every component built in Waves 1-7 inherits the correct luxury hospitality aesthetic without per-ticket reinvention.

---

### Section 3 — User-Facing Outcome

The developer/AI implementer can:
- Use `bg-primary-500` and get warm terracotta (#E87651), not Tailwind's default purple
- Use `text-neutral-700` and get warm-toned gray, not cool/cold gray
- Use `font-display` for serif headlines (Playfair Display)
- Use `font-body` for body text (Inter)
- Use `shadow-card`, `shadow-card-hover`, `shadow-nav` for warm-toned shadows
- Use `rounded-card` (12px) for consistent card corners
- Use easing functions: `ease-out-expo`, `ease-out-quart` via Tailwind utility classes

---

### Section 4 — In Scope

- [ ] Configure `app/layout.tsx` with `next/font/google` for Playfair Display, Inter, DM Sans, Montserrat
- [ ] Apply font CSS variables to the `<html>` element via `className`
- [ ] Configure `app/globals.css` with all CSS variables from Clone.md Section 3.1-3.5
- [ ] Configure `tailwind.config.ts` to extend the theme with:
      - `colors`: primary, neutral, accent palettes from CSS vars
      - `fontFamily`: display, body, ui, accent, mono
      - `fontSize`: clamp-based responsive scale
      - `spacing`: 8px-base scale
      - `boxShadow`: warm-toned shadows
      - `borderRadius`: 6/8/12/16/24/9999 + `card: 12px`
      - `transitionTimingFunction`: ease-out-expo, ease-out-quart, ease-in-out-quart, ease-out-back, ease-out-quint
      - `maxWidth`: container = 1440px
      - `screens`: standard breakpoints
- [ ] Add `@tailwindcss/forms` and `@tailwindcss/typography` plugins
- [ ] Add a CSS reset / base layer for: body background, default text color, scrollbar, selection color
- [ ] Verify the design system loads correctly — visit `/` and inspect

**Files to create:** None new — this ticket modifies existing files from FE-0-INFRA-01.

**Files to modify:**
- `app/layout.tsx` — add font loading + apply CSS variable classes
- `app/globals.css` — add ALL CSS variables, base resets, font fallbacks
- `tailwind.config.ts` — extend theme to consume CSS variables

---

### Section 5 — Out of Scope

- Do NOT build any UI components (Button, Input, etc.) — those are Wave 1
- Do NOT create custom Tailwind plugins — only the official `forms` and `typography` plugins
- Do NOT load icon fonts — `lucide-react` provides all icons
- Do NOT load self-hosted fonts via `@font-face` — use `next/font/google` exclusively
- Do NOT add a dark mode theme — MVP is light only (Clone.md doesn't specify dark mode)
- Do NOT add Arabic-supporting fonts — MVP is English (Phase 2)
- Do NOT add the smooth scroll provider here — that is FE-0-INFRA-09
- Do NOT add page transitions (template.tsx) — that is FE-0-INFRA-09

---

### Section 6 — Technical Contract

#### 6a. Component Props Interface

N/A — config only.

#### 6b. Hook Return Type

N/A.

#### 6c. Zod Schema

N/A.

#### 6d. Key Enums / Constants Used

`globals.css` `:root` block (full content from Clone.md Section 3):

```css
:root {
  /* Primary — Warm Terracotta */
  --color-primary-50:   #FFF8F5;
  --color-primary-100:  #FFE8DF;
  --color-primary-200:  #FFD4C2;
  --color-primary-300:  #FFB895;
  --color-primary-400:  #FF9768;
  --color-primary-500:  #E87651;
  --color-primary-600:  #C75D3E;
  --color-primary-700:  #A54832;
  --color-primary-800:  #7D3625;
  --color-primary-900:  #5A2618;

  /* Warm Neutrals */
  --color-neutral-50:   #FAF9F7;
  --color-neutral-100:  #F2F0ED;
  --color-neutral-200:  #E5E2DD;
  --color-neutral-300:  #CCC7BF;
  --color-neutral-400:  #A39D93;
  --color-neutral-500:  #7A746A;
  --color-neutral-600:  #5A544C;
  --color-neutral-700:  #3D3832;
  --color-neutral-800:  #2A251F;
  --color-neutral-900:  #1A1614;

  /* Functional Accents */
  --color-accent-gold:   #D4A574;
  --color-accent-blue:   #4A8BA5;
  --color-accent-green:  #6B9B7F;
  --color-accent-amber:  #E8A962;

  /* Semantic */
  --color-success:  #6B9B7F;
  --color-warning:  #E8A962;
  --color-error:    #D85C4A;
  --color-info:     #4A8BA5;

  /* Backgrounds */
  --color-bg-primary:    #FFFFFF;
  --color-bg-secondary:  #FAF9F7;
  --color-bg-dark:       #1A1614;
  --color-bg-hero:       #0D0B0A;

  /* Overlays */
  --overlay-dark:        rgba(13, 11, 10, 0.45);
  --overlay-gradient:    linear-gradient(180deg, rgba(13,11,10,0.15) 0%, rgba(13,11,10,0.65) 100%);
  --overlay-card:        linear-gradient(0deg, rgba(13,11,10,0.7) 0%, transparent 60%);

  /* Shadows — Warm-toned */
  --shadow-sm:     0 1px 2px rgba(26, 22, 20, 0.05);
  --shadow-md:     0 4px 8px rgba(26, 22, 20, 0.07), 0 2px 4px rgba(26, 22, 20, 0.04);
  --shadow-lg:     0 12px 24px rgba(26, 22, 20, 0.09), 0 4px 8px rgba(26, 22, 20, 0.05);
  --shadow-xl:     0 20px 40px rgba(26, 22, 20, 0.12), 0 8px 16px rgba(26, 22, 20, 0.06);
  --shadow-2xl:    0 32px 60px rgba(26, 22, 20, 0.16);
  --shadow-card:       var(--shadow-md);
  --shadow-card-hover: 0 16px 32px rgba(26, 22, 20, 0.13), 0 6px 12px rgba(26, 22, 20, 0.07);
  --shadow-nav:    0 4px 12px rgba(26, 22, 20, 0.08);

  /* Easings */
  --ease-out-expo:     cubic-bezier(0.16, 1, 0.3, 1);
  --ease-out-quart:    cubic-bezier(0.25, 1, 0.5, 1);
  --ease-in-out-quart: cubic-bezier(0.76, 0, 0.24, 1);
  --ease-out-back:     cubic-bezier(0.34, 1.56, 0.64, 1);
  --ease-out-quint:    cubic-bezier(0.23, 1, 0.32, 1);

  /* Spacing */
  --section-padding-x:   clamp(20px, 5vw, 80px);
  --section-padding-y:   clamp(64px, 12vh, 160px);
  --section-gap:         clamp(80px, 15vh, 200px);
  --container-max-width: 1440px;
  --container-padding:   clamp(20px, 5vw, 80px);
}

/* Reduced motion accessibility */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}

/* Base resets */
@layer base {
  html {
    color: var(--color-neutral-700);
    background: var(--color-bg-primary);
  }
  body {
    font-family: var(--font-body, 'Inter', system-ui, sans-serif);
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
  ::selection {
    background: var(--color-primary-200);
    color: var(--color-neutral-900);
  }
  /* Subtle scrollbar */
  ::-webkit-scrollbar { width: 10px; height: 10px; }
  ::-webkit-scrollbar-thumb { background: var(--color-neutral-300); border-radius: 9999px; }
  ::-webkit-scrollbar-thumb:hover { background: var(--color-neutral-400); }
}
```

`tailwind.config.ts` extension:

```typescript
import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50:  'var(--color-primary-50)',
          100: 'var(--color-primary-100)',
          200: 'var(--color-primary-200)',
          300: 'var(--color-primary-300)',
          400: 'var(--color-primary-400)',
          500: 'var(--color-primary-500)',
          600: 'var(--color-primary-600)',
          700: 'var(--color-primary-700)',
          800: 'var(--color-primary-800)',
          900: 'var(--color-primary-900)',
        },
        neutral: {
          50:  'var(--color-neutral-50)',
          100: 'var(--color-neutral-100)',
          200: 'var(--color-neutral-200)',
          300: 'var(--color-neutral-300)',
          400: 'var(--color-neutral-400)',
          500: 'var(--color-neutral-500)',
          600: 'var(--color-neutral-600)',
          700: 'var(--color-neutral-700)',
          800: 'var(--color-neutral-800)',
          900: 'var(--color-neutral-900)',
        },
        accent: {
          gold:  'var(--color-accent-gold)',
          blue:  'var(--color-accent-blue)',
          green: 'var(--color-accent-green)',
          amber: 'var(--color-accent-amber)',
        },
        success: 'var(--color-success)',
        warning: 'var(--color-warning)',
        error:   'var(--color-error)',
        info:    'var(--color-info)',
      },
      fontFamily: {
        display:  ['var(--font-display)', 'Georgia', 'serif'],
        body:     ['var(--font-body)', 'system-ui', 'sans-serif'],
        ui:       ['var(--font-ui)', 'system-ui', 'sans-serif'],
        accent:   ['var(--font-accent)', 'system-ui', 'sans-serif'],
        mono:     ['ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      fontSize: {
        hero:    ['clamp(48px, 8vw, 96px)',   { lineHeight: '1.1' }],
        display: ['clamp(36px, 5vw, 72px)',   { lineHeight: '1.1' }],
        h1:      ['clamp(30px, 3.5vw, 48px)', { lineHeight: '1.2' }],
        h2:      ['clamp(24px, 2.5vw, 36px)', { lineHeight: '1.25' }],
        h3:      ['clamp(20px, 2vw, 28px)',   { lineHeight: '1.3' }],
        h4:      ['clamp(18px, 1.5vw, 24px)', { lineHeight: '1.4' }],
      },
      boxShadow: {
        sm:           'var(--shadow-sm)',
        md:           'var(--shadow-md)',
        lg:           'var(--shadow-lg)',
        xl:           'var(--shadow-xl)',
        '2xl':        'var(--shadow-2xl)',
        card:         'var(--shadow-card)',
        'card-hover': 'var(--shadow-card-hover)',
        nav:          'var(--shadow-nav)',
      },
      borderRadius: {
        card: '12px',
      },
      transitionTimingFunction: {
        'out-expo':     'var(--ease-out-expo)',
        'out-quart':    'var(--ease-out-quart)',
        'in-out-quart': 'var(--ease-in-out-quart)',
        'out-back':     'var(--ease-out-back)',
        'out-quint':    'var(--ease-out-quint)',
      },
      maxWidth: {
        container: '1440px',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
  ],
}

export default config
```

---

### Section 7 — API Integration

N/A.

---

### Section 8 — State & Data Management Rules

N/A — design tokens.

---

### Section 9 — Component & File Deliverables

#### Files to CREATE:

None — only modifications.

#### Files to MODIFY:

```typescript
// app/layout.tsx
import { Playfair_Display, Inter, DM_Sans, Montserrat } from 'next/font/google'
import './globals.css'
import { QueryProvider } from '@/lib/providers/query-provider'

const playfair = Playfair_Display({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-display',
  weight: ['400', '500', '600', '700'],
})
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-body',
})
const dmSans = DM_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-ui',
  weight: ['400', '500', '600', '700'],
})
const montserrat = Montserrat({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-accent',
  weight: ['400', '500', '600', '700'],
})

export const metadata = {
  title: 'Rental Platform',
  description: 'Discover luxury rental properties on the Egyptian coast.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    
      
        {children}
      
    
  )
}
```

```css
/* app/globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

/* (full :root block from section 6d goes here) */

/* (reduced motion media query from section 6d) */

/* (base layer resets from section 6d) */
```

```typescript
// tailwind.config.ts (full content from section 6d)
```

#### Files NOT to touch:

```
package.json                        ← FE-0-INFRA-01 owns
app/page.tsx                        ← Wave 7 will replace
components/                         ← Wave 1+ creates components
```

---

### Section 10 — UX & Loading State Rules

| State | Required? | Behavior |
|---|---|---|
| Font loading | ✓ REQUIRED | `display: 'swap'` on every font — system font shows first, swap when loaded |
| FOUT/FOIT | ✓ REQUIRED | No flash of invisible text — `display: swap` prevents FOIT |
| Reduced motion | ✓ REQUIRED | Global `prefers-reduced-motion` media query reduces animation duration to ~0 |

---

### Section 11 — Verification Steps

**Setup:**
1. FE-0-INFRA-01, FE-0-INFRA-02 must be merged

**Happy path:**
1. Run `pnpm dev` → expected: dev server starts cleanly
2. Open http://localhost:3000 → expected: page background is `#FAF9F7` (warm off-white), text is `#3D3832` (warm dark gray)
3. Inspect a heading style: it should use Playfair Display (serif)
4. Inspect body text: it should use Inter (sans-serif)
5. In any test component, type `<div className="bg-primary-500">` → expected: background renders as terracotta `#E87651`
6. Type `<div className="shadow-card">` → expected: warm-toned shadow, NOT cold gray
7. Run `pnpm build` → expected: build succeeds, fonts are preloaded in HTML head

**Edge cases:**
1. Set browser preference "Reduce motion" on → expected: any future animations slow to ~0ms
2. Slow 3G throttle → expected: page renders with system font first, swaps to web fonts when loaded (no invisible text)
3. Disable JavaScript → expected: page still renders with correct colors and fonts (CSS works without JS)
4. Inspect HTML → expected: `<html>` tag has `--font-display`, `--font-body`, `--font-ui`, `--font-accent` CSS variables set via Next.js classNames

**Permission test:**
N/A.

---

### Section 12 — Acceptance Criteria

**Functionality:**
- [ ] All 4 fonts load via `next/font/google` with `display: 'swap'`
- [ ] CSS variables from `:root` are set and accessible
- [ ] Tailwind utility classes (`bg-primary-500`, `font-display`, `shadow-card`, etc.) produce correct values
- [ ] Color palette matches Clone.md Section 3.1 EXACTLY (warm terracotta, warm neutrals — NOT cold gray, NOT default Tailwind blue)
- [ ] Shadows are warm-toned `rgba(26, 22, 20, ...)`, NOT cold `rgba(0, 0, 0, ...)`
- [ ] Container max-width is 1440px (NOT Tailwind's default 1280px)
- [ ] `prefers-reduced-motion` media query is in `globals.css`
- [ ] `@tailwindcss/forms` and `@tailwindcss/typography` plugins are loaded

**Data & State:**
- [x] N/A

**UX States:**
- [ ] No FOIT — text remains visible during font load via `display: swap`
- [ ] Reduced motion respected globally
- [ ] Custom scrollbar matches the warm aesthetic
- [ ] Selection highlight uses primary-200

**TypeScript:**
- [ ] `tailwind.config.ts` is fully typed (exports `Config` type)
- [ ] No TypeScript errors after the changes

**Architecture:**
- [ ] CSS variables in `globals.css` are the SINGLE source of truth for design tokens
- [ ] `tailwind.config.ts` references CSS variables (not hardcoded hex values)
- [ ] Fonts loaded via `next/font/google` only (NOT `<link>` tags or `@font-face`)
- [ ] No design tokens duplicated in `tailwind.config.ts` and `globals.css` separately — Tailwind reads from CSS vars

**Performance:**
- [ ] Fonts use `display: 'swap'` (prevents FOIT)
- [ ] Only Latin subset loaded (smaller payload)
- [ ] Tailwind purge content paths are correct

**Role-based access:**
- [x] N/A

---

### Section 13 — Notes for AI / Common Mistakes

**DO:**
- Use `next/font/google` with the variable approach so CSS variables are available globally
- Apply ALL font CSS variables to the `<html>` element via the Next.js className pattern
- Use `display: 'swap'` for every font weight loaded
- Reference CSS variables in `tailwind.config.ts` instead of hardcoding hex values — this lets us theme later without touching Tailwind config
- Match the EXACT colors from Clone.md Section 3.1 (the report flagged that wrong colors would convert this to a "generic SaaS" look)

**DO NOT:**
- ⛔ DO NOT USE ANY MOCK DATA. This is a design system ticket with no data, but for ALL tickets in this project: never mock anything.
- Do NOT use Tailwind's default colors (`bg-blue-500`, `bg-gray-700`) anywhere in the project after this ticket — use `primary`, `neutral`, `accent`
- Do NOT load fonts via `<link href="https://fonts.googleapis.com/...">` — use `next/font/google` for performance
- Do NOT load Roboto, Poppins, or Arial — those produce generic AI aesthetics (Clone.md fix #1)
- Do NOT use the Tailwind default `1280px` container — Clone.md uses `1440px`
- Do NOT use cold `rgba(0, 0, 0, ...)` shadows — use warm `rgba(26, 22, 20, ...)` (Clone.md fix #15)
- Do NOT add hover states, transitions, or animations here — those are per-component (Wave 1+)
- Do NOT add the smooth scroll provider here — that is FE-0-INFRA-09
- Do NOT load fonts you won't use — only load weights actually needed (400, 500, 600, 700)
- Do NOT add a dark mode `[data-theme="dark"]` block — MVP is light only
- Do NOT add Arabic-supporting fonts (Cairo, Tajawal) — Phase 2 (Clone.md fix #14)

**WATCH OUT FOR:**
- Next.js font variables MUST be applied to `<html>` (or `<body>`) via className — CSS variables defined elsewhere won't work
- The `:root` in `globals.css` and the Next.js font CSS variables must combine — Next.js sets the `--font-*` vars via classes; `globals.css` `:root` defines colors/shadows. Both coexist
- `tailwindcss/forms` and `tailwindcss/typography` are large — verify they're not bloating the bundle (Tailwind's purge should handle this)
- The clamp() font sizes scale across viewports — verify on a phone (32px hero) and a 4K display (96px hero)
- Some warm grays (`#A39D93`) can look pinkish on certain monitors — verify on a calibrated display before approving
- The `Playfair Display` weights 400/500/600/700 are loaded — that's 4 font files. Don't add italic unless specifically needed (italic doubles the count)
- `next/font/google` requires internet during the BUILD process to fetch fonts; offline builds fail. Make sure CI/CD has internet access.

**REFERENCES:**
- Clone.md Section 3.1 — exact color values
- Clone.md Section 3.2 — exact font specs
- Clone.md Section 3.4 — warm-toned shadows
- Clone.md Section 3.5 — easing functions
- Clone.md Fix #1 — why NOT Roboto/Poppins
- Clone.md Fix #2 — why NOT #BA1408 (the source site's red)
- Clone.md Fix #12 — why 1440px container
- Clone.md Fix #15 — why warm shadows
- Related: FE-0-INFRA-01 (font packages), FE-0-INFRA-09 (smooth scroll + transitions)

---

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TICKET ID: FE-0-INFRA-09
TITLE: Build Smooth Scroll Provider and Page Transitions setup
WAVE: Wave 0 — Foundation & Infrastructure
DOMAIN: INFRA
PRIORITY: Critical
DEPENDS ON: FE-0-INFRA-01, FE-0-INFRA-02, FE-0-INFRA-08
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section 1 — Walkthrough

**What is this ticket about?**
The Guest App in Wave 7 must deliver a cinematic feel — that's not just hero animations, it's the FEEL of the entire scroll. Lenis (smooth scroll library) makes scrolling glide instead of jerk. Framer Motion `template.tsx` fades pages in/out on navigation instead of the harsh swap default. Both must be set up project-wide BEFORE Wave 7 starts so every page in the Guest App inherits the smooth scroll for free, and every navigation is animated. They also detect touch devices and disable themselves on mobile (where smooth scroll feels broken).

This ticket was missing from the original Implementation Plan — Wave 7 would have shipped without it and looked stilted. This ticket fixes that.

**Why does this ticket exist NOW (in this wave)?**
Adding smooth scroll AFTER Wave 7 components are built means GSAP ScrollTriggers calibrated against native scroll suddenly drift when Lenis is enabled. Adding `template.tsx` AFTER pages exist means every existing page's transitions break. Both must be in from day one.

**What does success look like?**
On desktop, scrolling on any page (even the placeholder home in `/`) feels noticeably smoother — momentum, no jitter. Navigating between pages produces a soft fade-in (300-500ms). On touch devices, native scroll is preserved (no Lenis interference). Reduced motion preference is respected (no transitions or smooth scroll for those users).

---

### Section 2 — Objective

Build the `SmoothScrollProvider` (Lenis) and `template.tsx` (Framer Motion page transitions) at the root of the app, with touch-device detection and `prefers-reduced-motion` respect, so every page in every wave inherits smooth scrolling and animated navigation transitions.

---

### Section 3 — User-Facing Outcome

The end user can:
- Scroll any page on desktop with smooth easing instead of OS-jerky scroll
- Navigate between pages with a soft fade transition instead of harsh swap
- See native scroll behavior on touch devices (smooth scroll feels wrong there)
- Have all motion disabled if their OS preference is "reduce motion"

The developer/AI implementer can:
- Trust that all pages already inherit smooth scroll — no per-page setup needed
- Trust that GSAP ScrollTriggers (Wave 7) work with Lenis correctly via the registered RAF integration

---

### Section 4 — In Scope

- [ ] Create `lib/providers/smooth-scroll-provider.tsx` — `'use client'` component
- [ ] Initialize Lenis with project config: `duration: 1.2`, `easing: easeOutExpo`, `smoothWheel: true`
- [ ] Detect touch devices and skip Lenis init on touch
- [ ] Detect `prefers-reduced-motion` and skip Lenis init for those users
- [ ] Expose Lenis instance globally for GSAP ScrollTrigger integration: `(window as any).__lenis = lenis`
- [ ] Cleanup Lenis on unmount (destroy)
- [ ] Wrap children of root layout
- [ ] Create `app/template.tsx` — Framer Motion fade-in page transition
- [ ] Use `motion.div` with `initial`, `animate` (not `exit` — App Router exit doesn't work reliably)
- [ ] Respect `prefers-reduced-motion` in template
- [ ] Wrap the root layout's `<QueryProvider>` block with `<SmoothScrollProvider>`

**Files to create:**
- `lib/providers/smooth-scroll-provider.tsx` — Lenis wrapper
- `app/template.tsx` — page transition wrapper

**Files to modify:**
- `app/layout.tsx` — add `<SmoothScrollProvider>` around children

---

### Section 5 — Out of Scope

- Do NOT add per-page custom scroll behavior — only the global Lenis instance
- Do NOT add a custom cursor — that is purely cosmetic and not in Clone.md MVP
- Do NOT add page-level scroll-triggered animations — those go in Wave 7 components using GSAP
- Do NOT register GSAP ScrollTrigger plugin here — that is Wave 7's responsibility (it's a feature concern, not infrastructure)
- Do NOT add `next-view-transitions` — only `framer-motion` is used here. (Clone.md mentions both as alternatives — pick framer-motion per the original plan)
- Do NOT add scroll progress indicators — Wave 7 if needed
- Do NOT use the deprecated `@studio-freight/react-lenis` package — use `lenis` directly

---

### Section 6 — Technical Contract

#### 6a. Component Props Interface

```typescript
interface SmoothScrollProviderProps {
  children: ReactNode
}

interface TemplateProps {
  children: ReactNode
}
```

#### 6b. Hook Return Type

N/A — providers, no exposed hooks. Wave 7 will add a `useLenis()` hook that reads the global instance.

#### 6c. Zod Schema

N/A.

#### 6d. Key Enums / Constants Used

```typescript
// SmoothScrollProvider config:
const LENIS_CONFIG = {
  duration: 1.2,
  easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // easeOutExpo
  orientation: 'vertical' as const,
  smoothWheel: true,
  wheelMultiplier: 1,
  touchMultiplier: 2,
}

// Template config:
const PAGE_TRANSITION = {
  initial: { opacity: 0, y: 16, filter: 'blur(4px)' },
  animate: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.5, ease: [0.25, 0.1, 0.25, 1] as const },
  },
}
```

---

### Section 7 — API Integration

N/A.

---

### Section 8 — State & Data Management Rules

| State | Where it lives | Why |
|---|---|---|
| Lenis instance | Local ref + `window.__lenis` global | needed by GSAP integration in Wave 7 |
| Touch device detection | Inline `useEffect` check | one-shot detection, not state |
| Reduced motion preference | `window.matchMedia` check | one-shot detection |

**Rules for this ticket:**
- [x] No server data
- [x] No `useState` for things that should be refs
- [x] No `useEffect` for data fetching

---

### Section 9 — Component & File Deliverables

#### Files to CREATE:

```typescript
// lib/providers/smooth-scroll-provider.tsx
'use client'

import { ReactNode, useEffect, useRef } from 'react'
import Lenis from 'lenis'

declare global {
  
Claude's response could not be fully generated

Usage limit reached ∙ Resets 4:10 AM ∙ limits shared with Claude Code




# Wave 0 — Continuation
## Completing FE-0-INFRA-09 + Wave QA Prompt + PM Sign-off Checklist

> **Note:** This file continues from where the previous Wave 0 file was cut off (mid-FE-0-INFRA-09, Section 9). Append everything below to the original file.

---

```typescript
// lib/providers/smooth-scroll-provider.tsx (continued)
'use client'

import { ReactNode, useEffect, useRef } from 'react'
import Lenis from 'lenis'

declare global {
  interface Window {
    __lenis?: Lenis
  }
}

interface SmoothScrollProviderProps {
  children: ReactNode
}

export function SmoothScrollProvider({ children }: SmoothScrollProviderProps) {
  const lenisRef = useRef<Lenis | null>(null)

  useEffect(() => {
    // ── Skip on touch devices: native scroll is better there ──
    const isTouchDevice =
      typeof window !== 'undefined' &&
      ('ontouchstart' in window || navigator.maxTouchPoints > 0)
    if (isTouchDevice) return

    // ── Skip if user prefers reduced motion ──
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReducedMotion) return

    // ── Initialize Lenis ──
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 2,
    })

    lenisRef.current = lenis
    window.__lenis = lenis

    // ── RAF loop ──
    let rafId: number
    function raf(time: number) {
      lenis.raf(time)
      rafId = requestAnimationFrame(raf)
    }
    rafId = requestAnimationFrame(raf)

    // ── Cleanup ──
    return () => {
      cancelAnimationFrame(rafId)
      lenis.destroy()
      lenisRef.current = null
      delete window.__lenis
    }
  }, [])

  return <>{children}</>
}
```

```typescript
// app/template.tsx
'use client'

import { motion } from 'framer-motion'
import { ReactNode, useEffect, useState } from 'react'

interface TemplateProps {
  children: ReactNode
}

export default function Template({ children }: TemplateProps) {
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mq.matches)
  }, [])

  if (reducedMotion) {
    return <>{children}</>
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, filter: 'blur(4px)' }}
      animate={{
        opacity: 1,
        y: 0,
        filter: 'blur(0px)',
      }}
      transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
    >
      {children}
    </motion.div>
  )
}
```

#### Files to MODIFY:

```tsx
// app/layout.tsx — wrap children in SmoothScrollProvider
import { QueryProvider } from '@/lib/providers/query-provider'
import { SmoothScrollProvider } from '@/lib/providers/smooth-scroll-provider'
// ... font imports from FE-0-INFRA-08

return (
  <html lang="en" className={`${playfair.variable} ${inter.variable} ${dmSans.variable} ${montserrat.variable}`}>
    <body>
      <QueryProvider>
        <SmoothScrollProvider>
          {children}
        </SmoothScrollProvider>
      </QueryProvider>
    </body>
  </html>
)
```

#### Files NOT to touch:

```
app/page.tsx                          ← Wave 7 will replace
components/                           ← Wave 1+ creates components
lib/api/axios.ts                      ← FE-0-INFRA-03 owns
```

---

### Section 10 — UX & Loading State Rules

| State | Required? | Behavior |
|---|---|---|
| Touch devices | ✓ REQUIRED | Lenis NOT initialized — native scroll preserved |
| Reduced motion preference | ✓ REQUIRED | Lenis NOT initialized + Template renders without animation |
| Page navigation | ✓ REQUIRED | Soft fade-in (500ms) on mount |
| First paint | ✓ REQUIRED | Template animation starts from `opacity: 0`, NOT mid-fade (avoid jank) |

---

### Section 11 — Verification Steps

**Setup:**
1. FE-0-INFRA-01, FE-0-INFRA-02, FE-0-INFRA-08 must be merged

**Happy path (Desktop):**
1. Run `pnpm dev` → expected: dev server starts
2. Open http://localhost:3000 in a desktop browser → expected: page fades in over ~500ms
3. Scroll the page using mouse wheel → expected: smooth easing, not jerky native scroll
4. Open dev tools console, type `window.__lenis` → expected: returns the Lenis instance
5. Navigate to a different route → expected: page fades in again

**Happy path (Mobile/Touch):**
1. Open the same URL on a touch device (or use Chrome DevTools mobile emulation with touch enabled)
2. Scroll the page → expected: native scroll behavior, NOT Lenis (Lenis can feel laggy on touch)
3. Type `window.__lenis` in console → expected: `undefined`

**Edge cases:**
1. Enable "Reduce motion" in OS accessibility settings → expected: `window.__lenis` is `undefined`, page does NOT fade in (renders instantly)
2. Run `pnpm build` → expected: build succeeds, Lenis bundle is included
3. Navigate rapidly between pages → expected: transitions don't stack or jitter
4. Resize the window during scroll → expected: Lenis adjusts cleanly

**Permission test:**
N/A.

---

### Section 12 — Acceptance Criteria

**Functionality:**
- [ ] `SmoothScrollProvider` is a `'use client'` component
- [ ] Lenis initializes ONLY on non-touch, non-reduced-motion devices
- [ ] Lenis instance is exposed at `window.__lenis` for GSAP integration in Wave 7
- [ ] Lenis cleanup runs on unmount (`destroy()` + RAF cancellation)
- [ ] `app/template.tsx` exists and provides fade-in transition
- [ ] Template respects `prefers-reduced-motion` (renders without animation)
- [ ] Root layout wraps children in `<SmoothScrollProvider>` inside `<QueryProvider>`

**Data & State:**
- [ ] Lenis instance stored in a `useRef`, not `useState`
- [ ] Reduced motion stored in `useState` for the template (because it must trigger re-render)
- [ ] No server data, no Zustand changes

**UX States:**
- [ ] Touch device → native scroll
- [ ] Reduced motion → no animation, no Lenis
- [ ] Desktop standard → smooth scroll + page fade

**TypeScript:**
- [ ] Global `window.__lenis` typed via `declare global`
- [ ] No `any` type used (the function param `t: number` is properly typed)
- [ ] Zero TypeScript errors

**Architecture:**
- [ ] Provider in `lib/providers/smooth-scroll-provider.tsx`
- [ ] Template in `app/template.tsx` (App Router conventions)
- [ ] No GSAP imports in this ticket (that's Wave 7)
- [ ] `lenis` package used (NOT the deprecated `@studio-freight/react-lenis` wrapper)

**Performance:**
- [ ] RAF loop properly cancelled on unmount
- [ ] Lenis destroyed on unmount
- [ ] Touch detection runs once on mount, not on every render

**Role-based access:**
- [x] N/A

---

### Section 13 — Notes for AI / Common Mistakes

**DO:**
- Use `useRef` for the Lenis instance — `useState` would trigger re-renders on every assignment
- Use `requestAnimationFrame` (not `setInterval`) — that's how Lenis is designed
- Cancel the RAF and destroy Lenis on unmount — leaks RAF callbacks otherwise
- Expose Lenis at `window.__lenis` so Wave 7 GSAP ScrollTrigger can integrate via this global
- Use `'use client'` directive on both `SmoothScrollProvider` and `template.tsx` — Lenis touches `window`

**DO NOT:**
- ⛔ DO NOT USE ANY MOCK DATA. This ticket has no data, but the global rule applies to all future tickets.
- Do NOT use `@studio-freight/react-lenis` — it's deprecated. Use `lenis` directly.
- Do NOT initialize Lenis on touch devices — feels broken there
- Do NOT skip the reduced motion check — accessibility requirement
- Do NOT use `exit` animation in `template.tsx` — App Router doesn't support exit animations reliably (use `AnimatePresence` per-component if exit is ever needed in a specific page)
- Do NOT put `template.tsx` inside a route group — it must be at `app/template.tsx` to apply globally
- Do NOT add `template.tsx` files in subdirectories — having multiple templates causes layered transitions
- Do NOT register GSAP ScrollTrigger here — it's not used yet (Wave 7)
- Do NOT add scroll progress bars, custom cursors, or other "nice-to-have" features — out of scope
- Do NOT use `useLayoutEffect` instead of `useEffect` — Lenis must mount AFTER paint to read DOM correctly

**WATCH OUT FOR:**
- Lenis manipulates `document.documentElement` scroll behavior. If a Wave 7 component needs to programmatically scroll (e.g., scroll-to-top button), it MUST use `window.__lenis.scrollTo(0)` instead of `window.scrollTo(0, 0)` — otherwise Lenis fights the native call
- The `template.tsx` runs on EVERY navigation including soft navigation (Link clicks). This means even tab switches inside a layout may animate. If that becomes annoying, scope `template.tsx` to specific route groups via per-folder templates
- Reduced motion is a USER preference at OS level — there's no in-app toggle. If product wants one, it's a future ticket
- Hydration warning: the template's `useState(false)` may differ between SSR (false) and client first paint (true if user prefers reduced motion) — that's why the animation is rendered ONLY after the `useEffect` runs on the client
- Some browser extensions (smooth scroll plugins) conflict with Lenis. Document this as known limitation, not a bug.
- The `easeOutExpo` cubic bezier `(0.16, 1, 0.3, 1)` is also defined as a CSS variable in FE-0-INFRA-08 — keep them in sync if either changes

**REFERENCES:**
- Clone.md Section 5.1 — Lenis configuration
- Clone.md Section 5.6 — Page transitions via template.tsx
- Clone.md Fix #16 — touch device handling for Lenis
- Lenis docs: https://github.com/darkroomengineering/lenis
- Framer Motion docs: https://motion.dev
- Related: FE-0-INFRA-08 (CSS easing variables), Wave 7 (uses `window.__lenis` + builds scroll animations on top)

---

---

# Wave 0 — QA Prompt

**Send this prompt to the QA agent ONLY after all 9 Wave 0 tickets are marked "Done" by developers and merged to the main branch.**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WAVE QA REVIEW PROMPT
Wave: 0 — Foundation & Infrastructure
Tickets completed: FE-0-INFRA-01, FE-0-INFRA-02, FE-0-INFRA-03, FE-0-INFRA-04,
                   FE-0-INFRA-05, FE-0-INFRA-06, FE-0-INFRA-07, FE-0-INFRA-08, FE-0-INFRA-09
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You are a senior QA engineer reviewing completed frontend work for the Rental Platform project.

## Context
This is a Next.js 14 + TypeScript + TanStack Query + Zustand project.
The codebase must conform to the Frontend TRD and the ticket-specific Acceptance Criteria.

## Your Role
You will review the completed Wave 0 tickets and produce a structured QA report.
You do NOT fix code. You REPORT findings.

## ⛔ CRITICAL GLOBAL RULE TO ENFORCE

The project has a strict NO MOCK DATA policy. In this wave specifically, verify:
- No file contains hardcoded arrays of fake data (e.g., `const sampleUnits = [...]`)
- No file imports `faker`, `msw`, `@faker-js/faker`, `json-server`, or any mock library
- No file uses `setQueryData()` to seed the cache with placeholder objects
- No service file (if any exists prematurely) returns hardcoded responses
- The `package.json` does NOT include `faker`, `msw`, or any mock library
- Even commented-out mock data must be removed (e.g., `// const sampleProjects = [...]`)

If you find ANY mock data, list it as a BLOCKER.

## What to Review

For EACH of the 9 tickets, verify the following:

### 1. Acceptance Criteria Check
Go through every checkbox in the ticket's Section 12 (Acceptance Criteria).
Mark each as: ✅ PASS | ❌ FAIL | ⚠️ PARTIAL | 🔍 NEEDS MANUAL TEST

### 2. Wave 0 Specific Verifications

**FE-0-INFRA-01 (Project Init):**
- [ ] `pnpm install`, `pnpm dev`, `pnpm build`, `pnpm type-check`, `pnpm lint` all pass
- [ ] All packages from section 6d are installed at correct version ranges
- [ ] `tsconfig.json` has `strict: true`, `noUncheckedIndexedAccess: true`, `noImplicitReturns: true`
- [ ] `.env.example` documents all required env vars including `NEXT_PUBLIC_MAPBOX_TOKEN`
- [ ] No `localStorage` usage anywhere

**FE-0-INFRA-02 (Folder Structure):**
- [ ] All folders from section 9 exist
- [ ] `.gitkeep` files in empty folders
- [ ] Barrel `index.ts` files contain `export {}`
- [ ] Placeholder `not-found.tsx` and `error.tsx` exist
- [ ] Route groups use parentheses syntax: `(admin)`, `(owner)`, `(public)`, `(auth)`

**FE-0-INFRA-03 (Axios):**
- [ ] `lib/api/axios.ts` exports configured instance
- [ ] `withCredentials: true` set
- [ ] Response interceptor unwraps `ApiResponse<T>`
- [ ] 401 triggers refresh attempt with `_retry` flag (no infinite loops)
- [ ] Refresh queue handles concurrent 401s
- [ ] TODO markers present for FE-1-AUTH-05 and FE-1-UI-09 wiring
- [ ] `ApiError` class exposes `status`, `message`, `errors[]`, `hasFieldErrors()`

**FE-0-INFRA-04 (Endpoints):**
- [ ] All 139 endpoints from Swagger present in `lib/api/endpoints.ts`
- [ ] Path-parameter endpoints use functions: `(id: string) => string`
- [ ] No baseURL in any endpoint string
- [ ] `as const` applied
- [ ] Public vs internal endpoints clearly separated (e.g., `units` vs `internalUnits`)
- [ ] All 6 auth endpoints including `/api/auth/logout` are present

**FE-0-INFRA-05 (Zustand Stores):**
- [ ] Auth store has NO persist middleware (memory-only)
- [ ] UI store persists ONLY `isSidebarOpen` via `partialize`
- [ ] No server data in either store
- [ ] `clearAuth()` resets all auth fields atomically
- [ ] Run in browser: `localStorage.getItem('rental-ui-store')` shows ONLY sidebar state

**FE-0-INFRA-06 (TanStack Query):**
- [ ] `QueryClient` created via `useState(() => new QueryClient(...))`
- [ ] Defaults match: staleTime 2min, gcTime 10min, retry 1, refetchOnWindowFocus false
- [ ] DevTools rendered ONLY in development
- [ ] `queryKeys` factory covers EVERY domain in the project
- [ ] `as const` applied to keys
- [ ] Hierarchical pattern: `[domain] → [domain, 'list'] → [domain, 'detail', id]`

**FE-0-INFRA-07 (Utilities, Types, Constants):**
- [ ] `cn()` correctly merges Tailwind classes (verify with twMerge conflict test)
- [ ] `formatCurrency()` returns "X,XXX EGP" format; "—" for null/NaN
- [ ] `formatDate()` returns "15 Apr 2026" format; "—" for null
- [ ] `getNights()` clamps negative results to 0
- [ ] All status/role/type constants use `as const`
- [ ] `VALID_TRANSITIONS` matches the backend state machine
- [ ] `ROUTES` covers every URL the project will navigate to
- [ ] No Arabic labels (English only in MVP)

**FE-0-INFRA-08 (Design System):**
- [ ] All 4 fonts loaded via `next/font/google` with `display: 'swap'`
- [ ] CSS variables in `globals.css` `:root` match Clone.md Section 3 EXACTLY
- [ ] `--color-primary-500` is `#E87651` (warm terracotta), NOT `#BA1408` or default Tailwind blue
- [ ] Shadows use warm RGBA `rgba(26, 22, 20, ...)`, NOT cold `rgba(0, 0, 0, ...)`
- [ ] Container max-width is `1440px`, NOT Tailwind's default `1280px`
- [ ] `prefers-reduced-motion` media query in `globals.css`
- [ ] No dark mode block, no Arabic-supporting fonts (Phase 2 features)

**FE-0-INFRA-09 (Smooth Scroll + Transitions):**
- [ ] `lib/providers/smooth-scroll-provider.tsx` exists and is `'use client'`
- [ ] Lenis NOT initialized on touch devices
- [ ] Lenis NOT initialized when `prefers-reduced-motion: reduce`
- [ ] Lenis instance exposed at `window.__lenis`
- [ ] RAF loop cancelled and Lenis destroyed on unmount
- [ ] `app/template.tsx` exists with Framer Motion fade-in
- [ ] Template renders WITHOUT animation when reduced motion is enabled
- [ ] Uses `lenis` package, NOT deprecated `@studio-freight/react-lenis`
- [ ] Root layout wraps children: `<QueryProvider><SmoothScrollProvider>{children}</SmoothScrollProvider></QueryProvider>`

### 3. Architecture Compliance
Check these rules apply to every file in the wave:
- No direct axios calls in components (only `lib/api/axios.ts` defines axios)
- No server data in Zustand stores
- No `useEffect` for data fetching (no fetching exists yet, but verify)
- No inline endpoint strings outside `lib/api/endpoints.ts`
- No inline route strings outside `lib/constants/routes.ts`
- No inline status/role strings outside `lib/constants/`
- No `any` TypeScript type
- No `localStorage` or `sessionStorage` (except the partialized `isSidebarOpen` field in UI store)

### 4. UX State Completeness
Wave 0 is infrastructure — the only user-visible state is:
- [ ] Page fade-in works on desktop
- [ ] Smooth scroll feels smooth on desktop
- [ ] Native scroll preserved on mobile/touch
- [ ] Reduced motion users see no animation
- [ ] Fonts load with `swap` (no flash of invisible text)
- [ ] Default page background is warm off-white `#FAF9F7`, NOT pure white or cool gray

### 5. Performance Check
- [ ] DevTools NOT in production bundle (verify by inspecting `pnpm build` output)
- [ ] Fonts subset to Latin only
- [ ] Tailwind purge content paths correct
- [ ] No `useLayoutEffect` where `useEffect` should be used (SSR safety)
- [ ] Heavy libraries (Mapbox, GSAP, Recharts) NOT imported anywhere yet (only installed)

### 6. TypeScript Check
Run: `pnpm type-check`
- [ ] Zero TypeScript errors
- [ ] No `any` types in any file
- [ ] All type exports work via barrels

### 7. Cross-ticket Integration
- [ ] Axios instance has TODO markers that match the ticket IDs (FE-1-AUTH-05, FE-1-UI-09)
- [ ] Auth store types compatible with eventual login response shape (FE-1-AUTH-01)
- [ ] Query keys factory covers all domains needed by Waves 2-7
- [ ] Design system tokens consumable by Wave 1 UI components
- [ ] Smooth scroll + template don't break the QueryProvider

## Output Format

Produce the following report:

---
## Wave 0 QA Report

### Summary
- Tickets reviewed: FE-0-INFRA-01 through FE-0-INFRA-09 (9 total)
- Overall status: PASS | FAIL | PARTIAL
- Blocker count: {number}
- Warning count: {number}

### Per-Ticket Results

#### FE-0-INFRA-01 — Initialize Next.js project with full dependency setup
Status: ✅ PASS | ❌ FAIL | ⚠️ PARTIAL

**Acceptance Criteria:**
| Criteria | Status | Note |
|---|---|---|
| pnpm install completes | ✅ | — |
| All section 6d dependencies installed | ... | ... |

**Blockers (must fix before sign-off):**
- [issue] — [file] — [expected vs found]

**Warnings (should fix, not blocking):**
- [issue]

**Notes:**
- [observation]

---
[repeat for each of the 9 tickets]

### Mock Data Audit
- [ ] No mock data libraries in `package.json`
- [ ] No hardcoded fake data arrays in any file
- [ ] No `setQueryData()` with placeholder objects
- [ ] No commented-out mock data

If violations found:
| File | Line | Violation |
|---|---|---|
| ... | ... | ... |

### Architecture Violations Found
| Violation | File | Rule Broken | Severity |
|---|---|---|---|
| [description] | [file path] | [which rule] | Blocker / Warning |

### Cross-Cutting Issues
- [ ] All TODO markers in `lib/api/axios.ts` reference correct future ticket IDs
- [ ] Folder structure matches the ticket spec
- [ ] No premature implementation (e.g., service files created before Wave 2)

### Wave 0 Sign-off Recommendation
[ ] APPROVED — All blockers resolved. Wave 0 is complete. PM may sign off.
[ ] CONDITIONAL — Minor warnings only. PM to decide.
[ ] BLOCKED — {N} blocker(s) must be resolved before sign-off.

Blockers to resolve: {list}
---
```

---

---

# Wave 0 — PM Sign-off Checklist

**The human PM completes this AFTER the QA agent's report comes back APPROVED or CONDITIONAL.**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PM WAVE SIGN-OFF CHECKLIST
Wave: 0 — Foundation & Infrastructure
Date: _______________
Reviewed by: _______________
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### A. QA Report Review

- [ ] QA report has been received for Wave 0
- [ ] All BLOCKER items from QA report are resolved (attach evidence or PR links): __________
- [ ] All WARNING items are either resolved or explicitly accepted with documented reason
- [ ] QA agent marked Wave 0 as "APPROVED" or "CONDITIONAL"
- [ ] **MOCK DATA AUDIT PASSED** — no mock data found anywhere in the codebase

If CONDITIONAL → reason accepted: ______________________

---

### B. Business Requirements Validation

Wave 0 has no direct business outcomes (it's pure infrastructure). However, validate:

- [ ] The infrastructure choices align with the agreed tech stack (Next.js 14, TypeScript, Tailwind, TanStack Query, Zustand, Axios)
- [ ] The Design System matches Clone.md aesthetic — warm terracotta + serif headlines, NOT generic SaaS look
- [ ] The folder structure supports the 117-ticket plan without rework
- [ ] All 139 backend endpoints from Swagger are accounted for in `lib/api/endpoints.ts`

**Inspection notes:** ______________________

---

### C. Definition of Done — Full Wave Audit

For Wave 0 specifically:

- [ ] `pnpm dev` produces a running app at http://localhost:3000
- [ ] `pnpm build` succeeds with zero errors
- [ ] `pnpm type-check` returns zero errors
- [ ] `pnpm lint` returns zero errors
- [ ] The default page renders with the WARM aesthetic (background `#FAF9F7`, terracotta accents, serif font available)
- [ ] Smooth scroll noticeably smoother than native on desktop
- [ ] Page fade-in transition visible on navigation
- [ ] Touch devices use native scroll
- [ ] Reduced motion users see no animation
- [ ] React Query DevTools button visible in dev, not in production build
- [ ] No errors in browser console on first load
- [ ] No hydration warnings in Next.js dev console

---

### D. Architecture Compliance Sign-off

- [ ] No `any` TypeScript types introduced
- [ ] No `localStorage` / `sessionStorage` used (except `isSidebarOpen` partialized field in UI store)
- [ ] No inline endpoint strings (all from `endpoints.ts`)
- [ ] No inline route strings (all from `routes.ts`)
- [ ] No inline status/role strings (all from `lib/constants/`)
- [ ] No direct axios in components (no components exist yet — verify by `grep`)
- [ ] No `useEffect` for data fetching (no fetching yet — verify)
- [ ] No server data in Zustand stores
- [ ] **NO MOCK DATA ANYWHERE** — confirmed by mock data audit
- [ ] No deprecated packages used (e.g., `@studio-freight/react-lenis`)

---

### E. Integration with Future Waves — Pre-flight Checks

Wave 0 is the foundation for Waves 1-8. Verify it can support what's coming:

- [ ] Wave 1 Auth tickets can wire `setAuth()` from the auth store directly
- [ ] Wave 1 UI tickets can use `cn()`, design tokens, and lucide-react
- [ ] Wave 2-7 service files can import `endpoints` and call `api.get<T>(...)`
- [ ] Wave 7 Guest App can register GSAP ScrollTrigger against `window.__lenis`
- [ ] All 4 fonts (Playfair, Inter, DM Sans, Montserrat) accessible via `var(--font-*)` everywhere
- [ ] Mapbox, Recharts, Swiper, GSAP installed and importable (verified by attempting `import` in a temp file)

**Pre-flight notes:** ______________________

---

### F. Mock Data Final Audit (HARD GATE)

This wave establishes the foundation. ANY mock data introduced now will pollute every subsequent wave. Verify with these grep commands:

```bash
# Must return zero results:
grep -ri "faker" --include="*.ts" --include="*.tsx" --include="package.json" .
grep -ri "msw" --include="*.ts" --include="*.tsx" --include="package.json" .
grep -ri "json-server" --include="*.ts" --include="*.tsx" --include="package.json" .
grep -ri "mockData" --include="*.ts" --include="*.tsx" .
grep -ri "sampleData" --include="*.ts" --include="*.tsx" .
grep -ri "fakeUsers" --include="*.ts" --include="*.tsx" .
grep -ri "dummyData" --include="*.ts" --include="*.tsx" .
grep -rn "const \w* = \[\s*{" --include="*.ts" --include="*.tsx" lib/ | grep -v "queryKeys" | grep -v "endpoints" | grep -v "ROUTES" | grep -v "BOOKING_STATUS" | grep -v "ADMIN_ROLES" | grep -v "_LABELS" | grep -v "VALID_TRANSITIONS"
```

- [ ] All grep commands return zero results (or only legitimate constants)
- [ ] No file in `lib/api/services/` exists yet (services come in Wave 2+)
- [ ] No hooks in `lib/hooks/` yet (hooks come in Wave 1+)

**Audit performed by:** ______________________
**Date:** ______________________

---

### G. Lessons Learned & Hand-off Notes for Wave 1

- [ ] All 9 Wave 0 tickets merged to main branch
- [ ] Wave 1 dependencies satisfied:
      - FE-1-AUTH-* needs: auth store ✓, axios ✓, endpoints ✓, routes ✓
      - FE-1-UI-* needs: design system ✓, cn() ✓, lucide-react ✓
- [ ] Developers briefed on Wave 1 scope and template format
- [ ] Any infrastructure issues uncovered are documented:

```
Wave 0 lessons learned:
- ____________________________
- ____________________________
- ____________________________
```

---

### H. Sign-off Decision

```
[ ] WAVE 0 APPROVED
    All checks passed. Wave 1 may begin.
    Foundation is solid; no rework expected.

[ ] WAVE 0 APPROVED WITH CONDITIONS
    Conditions: _______________________
    Must be resolved by: _______________
    These conditions do NOT block Wave 1 from starting.

[ ] WAVE 0 NOT APPROVED
    Blockers: _________________________
    Re-review date: ___________________
    Wave 1 BLOCKED until re-approval.
```

**Signed off by (PM name):** ______________________
**Date:** ______________________
**Signature / approval reference:** ______________________

---

---

# Wave 0 — Final Summary

| # | Ticket | Outcome | Blocks |
|---|--------|---------|--------|
| 1 | FE-0-INFRA-01 | Project initialized with all 30+ packages | All other tickets |
| 2 | FE-0-INFRA-02 | Folder structure scaffolded | All file-creating tickets |
| 3 | FE-0-INFRA-03 | Axios instance with full interceptor logic | All API consumers |
| 4 | FE-0-INFRA-04 | All 139 endpoints typed & centralized | All service files |
| 5 | FE-0-INFRA-05 | Auth + UI Zustand stores | Wave 1 auth, sidebar, modals |
| 6 | FE-0-INFRA-06 | TanStack Query + queryKeys factory | All hooks |
| 7 | FE-0-INFRA-07 | Utilities, types, constants | Every component & page |
| 8 | FE-0-INFRA-08 | Design System (CSS vars + Tailwind + fonts) | Every UI ticket |
| 9 | FE-0-INFRA-09 | Lenis smooth scroll + page transitions | Wave 7 Guest App cinematic feel |

**Wave 0 Status:** Ready for hand-off to Wave 1 once PM signs off.

**Next Wave:** Wave 1 — Auth Flows + UI Component Library (16 tickets, 5 days, 2 parallel tracks).

---

*End of Wave 0 ticket pack.*
