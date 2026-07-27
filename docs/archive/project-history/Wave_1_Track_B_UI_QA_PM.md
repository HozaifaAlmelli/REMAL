# Wave 1 — Track B: UI Component Library
## Tickets FE-1-UI-01 through FE-1-UI-10

> **Parallel with Track A.** These tickets can start simultaneously with FE-1-AUTH-01. The only dependency is Wave 0 being fully merged.

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TICKET ID: FE-1-UI-01
TITLE: Build Button component
WAVE: Wave 1 — Auth Flows + UI Component Library
DOMAIN: UI
PRIORITY: Critical
DEPENDS ON: FE-0-INFRA-07 (cn utility, design tokens)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section 1 — Walkthrough

**What is this ticket about?**
Every interactive element across all three apps (Admin, Owner, Guest) will use this Button component. It needs to handle 4 variants (primary, secondary, outline, ghost), 3 sizes, loading state with spinner, and disabled state. Getting this right once means zero inconsistency across 100+ future usages.

**Why does this ticket exist NOW?**
Every Wave 2–7 ticket uses buttons. Auth pages (Track A) use buttons. The component library must be built before feature work.

**What does success look like?**
`<Button variant="primary" isLoading>Saving...</Button>` renders a terracotta button with a spinner, disabled, matching the Clone.md design system.

---

### Section 2 — Objective

Build a fully typed, accessible `<Button>` component with all variants, sizes, loading state, and icon support — using the Wave 0 design system tokens — that every other ticket in the project imports from `components/ui/`.

---

### Section 3 — User-Facing Outcome

Any developer/AI implementer in later waves can:
- Import `Button` from `@/components/ui`
- Render any combination of variant, size, and loading state
- Trust the styling matches the design system exactly

---

### Section 4 — In Scope

- [ ] Create `components/ui/Button.tsx`
- [ ] Variants: `primary` (terracotta filled), `secondary` (neutral filled), `outline` (border only), `ghost` (text only), `danger` (red filled)
- [ ] Sizes: `sm`, `md` (default), `lg`
- [ ] Props: `isLoading` (shows spinner + disables), `leftIcon`, `rightIcon`, `disabled`, `fullWidth`, all native button attrs
- [ ] Loading state: shows `<Loader2>` spinner from lucide-react, replaces icon if present, disables button
- [ ] Uses `cn()` from `@/lib/utils/cn` for class merging
- [ ] Uses design system colors: `bg-primary-500`, `hover:bg-primary-600`, `text-white`, etc.
- [ ] Export from `components/ui/index.ts`

**Files to create:**
- `components/ui/Button.tsx`

**Files to modify:**
- `components/ui/index.ts` — add `export { Button } from './Button'`

---

### Section 5 — Out of Scope

- Do NOT build IconButton as a separate component — use `Button` with only an icon child
- Do NOT build LinkButton — use Next.js `<Link>` wrapping `<Button>` in consumer code
- Do NOT add animations beyond Tailwind transitions

---

### Section 6 — Technical Contract

#### 6a. Component Props Interface

```typescript
import { ButtonHTMLAttributes, ReactNode } from 'react'
import { LucideIcon } from 'lucide-react'

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
type ButtonSize    = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:   ButtonVariant   // default: 'primary'
  size?:      ButtonSize      // default: 'md'
  isLoading?: boolean         // shows spinner, disables button
  leftIcon?:  ReactNode       // rendered before children
  rightIcon?: ReactNode       // rendered after children
  fullWidth?: boolean         // width: 100%
  children:   ReactNode
}
```

#### 6b–6d: N/A — pure UI component.

---

### Section 7 — API Integration

N/A — UI component.

---

### Section 8 — State & Data Management Rules

No state. Pure presentational component.

---

### Section 9 — Component & File Deliverables

```typescript
// components/ui/Button.tsx
'use client'
import { ButtonHTMLAttributes, ReactNode, forwardRef } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
type ButtonSize    = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:   ButtonVariant
  size?:      ButtonSize
  isLoading?: boolean
  leftIcon?:  ReactNode
  rightIcon?: ReactNode
  fullWidth?: boolean
  children:   ReactNode
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:   'bg-primary-500 text-white hover:bg-primary-600 active:bg-primary-700 disabled:bg-primary-200',
  secondary: 'bg-neutral-800 text-white hover:bg-neutral-900 active:bg-neutral-900 disabled:bg-neutral-300',
  outline:   'border border-neutral-300 text-neutral-700 hover:bg-neutral-50 active:bg-neutral-100 disabled:opacity-50',
  ghost:     'text-neutral-600 hover:bg-neutral-100 active:bg-neutral-200 disabled:opacity-50',
  danger:    'bg-error text-white hover:opacity-90 active:opacity-80 disabled:opacity-50',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-8  px-3  text-xs  gap-1.5',
  md: 'h-10 px-4  text-sm  gap-2',
  lg: 'h-12 px-6  text-base gap-2.5',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', isLoading = false, leftIcon, rightIcon,
     fullWidth = false, disabled, className, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(
          'inline-flex items-center justify-center font-medium rounded-lg',
          'transition-colors duration-150 ease-out-quart',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2',
          'disabled:cursor-not-allowed',
          variantClasses[variant],
          sizeClasses[size],
          fullWidth && 'w-full',
          className
        )}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="animate-spin" size={size === 'sm' ? 14 : size === 'lg' ? 18 : 16} />
        ) : (
          leftIcon
        )}
        <span>{children}</span>
        {!isLoading && rightIcon}
      </button>
    )
  }
)

Button.displayName = 'Button'
```

---

### Section 10 — UX & Loading State Rules

| State | Required? | Behavior |
|---|---|---|
| Loading | ✓ REQUIRED | Spinner replaces left icon, button disabled |
| Disabled | ✓ REQUIRED | Muted appearance, cursor-not-allowed |

---

### Section 11 — Verification Steps

1. Import `<Button>` and render each variant → expected: correct colors per design system
2. `<Button isLoading>Submit</Button>` → expected: spinner visible, button disabled
3. `<Button disabled>Disabled</Button>` → expected: muted, non-clickable
4. `<Button size="lg">Large</Button>` → expected: larger height and padding
5. `<Button fullWidth>Full</Button>` → expected: 100% width
6. Check all hover/active states → correct color transitions

---

### Section 12 — Acceptance Criteria

- [ ] 5 variants render with correct colors from the design system (`primary-500`, `neutral-800`, etc.)
- [ ] 3 sizes render correctly
- [ ] `isLoading` shows spinner and disables the button
- [ ] `leftIcon` and `rightIcon` render correctly
- [ ] `fullWidth` works
- [ ] `forwardRef` implemented correctly
- [ ] Focus ring visible and accessible
- [ ] Exported from `components/ui/index.ts`
- [ ] No mock data, no hardcoded data

---

### Section 13 — Notes for AI / Common Mistakes

**DO NOT:**
- ⛔ NO MOCK DATA.
- Do NOT use Tailwind's default `blue-500` — use `primary-500` (from our design system)
- Do NOT use `bg-red-500` for danger — use `bg-error` (CSS variable)
- Do NOT use generic `gray` — use `neutral` palette
- Do NOT skip `forwardRef` — forms and other components need to ref buttons

---

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TICKET ID: FE-1-UI-02
TITLE: Build Input and Textarea components
WAVE: Wave 1 — Auth Flows + UI Component Library
DOMAIN: UI
PRIORITY: Critical
DEPENDS ON: FE-0-INFRA-07, FE-1-UI-01
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section 1 — Walkthrough

**What is this ticket about?**
Every form across all three apps uses text inputs. This ticket builds a shared `<Input>` component that handles labels, error messages, helper text, left/right addons (for icons like phone or search), and all native input types. It also builds `<Textarea>` for multi-line inputs like booking notes and review comments. Both are designed to work seamlessly with React Hook Form's `register()`.

**Why NOW?**
Auth forms (Track A) and every feature form in Waves 2–7 depend on these.

**What does success look like?**
`<Input label="Phone" error={errors.phone?.message} {...register('phone')} />` renders a labeled input with red border and error text underneath when there's a validation error.

---

### Section 2 — Objective

Build `<Input>` and `<Textarea>` components that are fully compatible with React Hook Form `register()`, support labels, error/helper text, left/right icons, and the project design system.

---

### Section 4 — In Scope

- [ ] `components/ui/Input.tsx`
- [ ] Props: `label?`, `error?` (string — shows red border + error text), `helperText?`, `leftAddon?` (ReactNode), `rightAddon?` (ReactNode), all native `<input>` attrs
- [ ] `components/ui/Textarea.tsx`
- [ ] Props: same as Input plus `rows?`
- [ ] Both use `forwardRef` for RHF compatibility
- [ ] Error state: red border (`border-error`), red error text below
- [ ] Normal state: `border-neutral-300`, focus `ring-primary-500`
- [ ] Export both from `components/ui/index.ts`

**Files to create:**
- `components/ui/Input.tsx`
- `components/ui/Textarea.tsx`

**Files to modify:**
- `components/ui/index.ts`

---

### Section 6 — Technical Contract

#### 6a. Component Props Interface

```typescript
import { InputHTMLAttributes, TextareaHTMLAttributes, ReactNode } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?:      string
  error?:      string      // from RHF: errors.fieldName?.message
  helperText?: string
  leftAddon?:  ReactNode   // e.g., <Phone size={16} />
  rightAddon?: ReactNode   // e.g., <Eye size={16} /> for password toggle
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?:      string
  error?:      string
  helperText?: string
  rows?:       number      // default: 4
}
```

---

### Section 9 — Component & File Deliverables

```typescript
// components/ui/Input.tsx (abbreviated spec — AI implements full)
'use client'
import { InputHTMLAttributes, ReactNode, forwardRef, useId } from 'react'
import { cn } from '@/lib/utils/cn'

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, leftAddon, rightAddon, className, ...props }, ref) => {
    const id = useId()
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={id} className="block text-sm font-medium text-neutral-700 mb-1.5">
            {label}
            {props.required && <span className="text-error ml-1">*</span>}
          </label>
        )}
        <div className="relative flex items-center">
          {leftAddon && (
            <div className="absolute left-3 text-neutral-400 pointer-events-none">
              {leftAddon}
            </div>
          )}
          <input
            ref={ref}
            id={id}
            className={cn(
              'w-full rounded-lg border bg-white text-neutral-800 text-sm',
              'h-10 px-3.5',
              'placeholder:text-neutral-400',
              'transition-colors duration-150',
              'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent',
              'disabled:bg-neutral-50 disabled:text-neutral-400 disabled:cursor-not-allowed',
              error ? 'border-error focus:ring-error' : 'border-neutral-300',
              leftAddon && 'pl-10',
              rightAddon && 'pr-10',
              className
            )}
            {...props}
          />
          {rightAddon && (
            <div className="absolute right-3 text-neutral-400">
              {rightAddon}
            </div>
          )}
        </div>
        {error && <p className="mt-1.5 text-xs text-error">{error}</p>}
        {!error && helperText && <p className="mt-1.5 text-xs text-neutral-500">{helperText}</p>}
      </div>
    )
  }
)
Input.displayName = 'Input'
```

---

### Section 12 — Acceptance Criteria

- [ ] `error` prop shows red border and error message below input
- [ ] `label` with `required` shows asterisk
- [ ] `leftAddon` / `rightAddon` correctly positioned inside the input
- [ ] `forwardRef` works with RHF `register()` (verify: `{...register('field')}` spreads correctly)
- [ ] `Textarea` auto-ids with `useId()` (no hardcoded IDs)
- [ ] Both exported from `components/ui/index.ts`
- [ ] Design system colors used (no Tailwind defaults)
- [ ] No mock data

---

### Section 13 — Notes for AI / Common Mistakes

**DO NOT:**
- ⛔ NO MOCK DATA.
- Do NOT use `border-red-500` — use `border-error` (CSS variable from design system)
- Do NOT use `border-blue-500` for focus — use `ring-primary-500`
- Do NOT hardcode `id` — use `useId()` for accessibility
- Do NOT skip `forwardRef` — RHF needs ref access to inputs

---

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TICKET ID: FE-1-UI-03
TITLE: Build Select and Combobox components
WAVE: Wave 1 — Auth Flows + UI Component Library
DOMAIN: UI
PRIORITY: Critical
DEPENDS ON: FE-0-INFRA-07, FE-1-UI-02
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section 1 — Walkthrough

**What is this ticket about?**
Dropdown selects appear throughout the admin panel — booking source, unit type, owner assignment, project filter, status filter. Two variants: `<Select>` (native HTML select, simpler, for forms) and `<Combobox>` (searchable dropdown, for long lists like owners or units). Both work with RHF.

**Why NOW?**
Admin forms in Wave 2 (create unit — needs owner dropdown, project dropdown) depend on these.

---

### Section 4 — In Scope

- [ ] `components/ui/Select.tsx` — native `<select>` with consistent styling, label, error, options array
- [ ] `components/ui/Combobox.tsx` — custom searchable dropdown for long lists (built with `useState`, no heavy library)
- [ ] Both: `label?`, `error?`, `options: SelectOption<T>[]`, `placeholder?`, `disabled?`
- [ ] `Select` uses `forwardRef` for RHF
- [ ] `Combobox` manages its own open/close state, filters options as user types
- [ ] Export from `components/ui/index.ts`

**Files to create:**
- `components/ui/Select.tsx`
- `components/ui/Combobox.tsx`

---

### Section 6 — Technical Contract

```typescript
// From lib/types/common.types.ts (created in FE-0-INFRA-07):
interface SelectOption<T = string> {
  value: T
  label: string
  disabled?: boolean
}

interface SelectProps<T = string> extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
  label?:       string
  error?:       string
  options:      SelectOption<T>[]
  placeholder?: string           // shown as first disabled option
  onChange?:    (value: T) => void
}

interface ComboboxProps<T = string> {
  label?:        string
  error?:        string
  options:       SelectOption<T>[]
  value?:        T | null
  onChange:      (value: T | null) => void
  placeholder?:  string
  disabled?:     boolean
  searchable?:   boolean         // default: true
}
```

---

### Section 12 — Acceptance Criteria

- [ ] `Select` renders all options, shows placeholder, fires `onChange` with typed value
- [ ] `Select` shows error state correctly
- [ ] `Combobox` opens on click, filters options as user types, closes on selection or outside click
- [ ] Both exported from `components/ui/index.ts`
- [ ] No mock data (options come from consumer — this is a pure UI component)

---

### Section 13 — Notes for AI / Common Mistakes

**DO NOT:**
- ⛔ NO MOCK DATA in the component. Consumer passes options from API data.
- Do NOT use a third-party select library (no `react-select`, no `downshift`) — custom implementation only
- Do NOT hardcode any options inside the component

---

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TICKET ID: FE-1-UI-04
TITLE: Build Modal and Dialog components
WAVE: Wave 1 — Auth Flows + UI Component Library
DOMAIN: UI
PRIORITY: Critical
DEPENDS ON: FE-0-INFRA-05 (UIStore for modal management), FE-1-UI-01
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section 1 — Walkthrough

**What is this ticket about?**
The admin panel opens modals for Create/Edit forms (create unit, create owner, record payment). This ticket builds the `<Modal>` component — a portal-based overlay with header, scrollable body, and footer slot. It integrates with the Zustand UIStore's `activeModal` field for global modal management.

**Why NOW?**
Every create/edit form in Waves 2–5 uses this modal pattern.

---

### Section 4 — In Scope

- [ ] `components/ui/Modal.tsx` — portal-based modal with backdrop, header, body, footer
- [ ] Props: `isOpen`, `onClose`, `title?`, `size?` (sm/md/lg/xl), `children`
- [ ] Click outside to close, Escape key to close
- [ ] Scroll lock on body when open (`overflow-hidden` on document.body)
- [ ] Footer slot via `Modal.Footer` compound component pattern
- [ ] Framer Motion fade-in/scale entrance animation
- [ ] Export from `components/ui/index.ts`

**Files to create:**
- `components/ui/Modal.tsx`

---

### Section 6 — Technical Contract

```typescript
interface ModalProps {
  isOpen:    boolean
  onClose:   () => void
  title?:    string
  size?:     'sm' | 'md' | 'lg' | 'xl'   // default: 'md'
  children:  ReactNode
}

interface ModalFooterProps {
  children: ReactNode
}
```

---

### Section 12 — Acceptance Criteria

- [ ] Modal renders in a portal (outside the React tree root)
- [ ] Backdrop click closes modal
- [ ] Escape key closes modal
- [ ] Body scroll locked when modal is open
- [ ] `Modal.Footer` renders in the footer region
- [ ] Framer Motion entrance animation works (respects `prefers-reduced-motion`)
- [ ] No mock data

---

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TICKET ID: FE-1-UI-05
TITLE: Build Skeleton loading components
WAVE: Wave 1 — Auth Flows + UI Component Library
DOMAIN: UI
PRIORITY: Critical
DEPENDS ON: FE-0-INFRA-07
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section 1 — Walkthrough

**What is this ticket about?**
Every page in every wave shows a loading state using Skeleton placeholders (not spinners). This ticket builds a versatile `<Skeleton>` base component and domain-specific skeleton shapes: `<SkeletonCard>`, `<SkeletonTable>`, `<SkeletonText>`, `<SkeletonAvatar>`. All page-level loading states across 100+ pages will compose from these.

---

### Section 4 — In Scope

- [ ] `components/ui/Skeleton.tsx` — base skeleton with `width`, `height`, `rounded`, `className` props
- [ ] `components/ui/SkeletonCard.tsx` — card-shaped skeleton (image placeholder + 3 text lines)
- [ ] `components/ui/SkeletonTable.tsx` — table skeleton (header + N rows) — takes `rows` prop
- [ ] `components/ui/SkeletonText.tsx` — inline text skeleton (variable widths)
- [ ] CSS: pulsing animation using Tailwind `animate-pulse` with warm neutral color
- [ ] Export all from `components/ui/index.ts`

**Files to create:**
- `components/ui/Skeleton.tsx`
- `components/ui/SkeletonCard.tsx`
- `components/ui/SkeletonTable.tsx`
- `components/ui/SkeletonText.tsx`

---

### Section 6 — Technical Contract

```typescript
interface SkeletonProps {
  width?:    string | number   // e.g., '100%', 200
  height?:   string | number   // e.g., 40, '1rem'
  rounded?:  'sm' | 'md' | 'lg' | 'full'  // default: 'md'
  className?: string
}

interface SkeletonTableProps {
  rows?:    number   // default: 5
  columns?: number   // default: 4
}
```

---

### Section 12 — Acceptance Criteria

- [ ] `Skeleton` pulsing animation uses `bg-neutral-200 animate-pulse` (warm neutral, not gray)
- [ ] `SkeletonTable` renders correct number of rows and columns
- [ ] All exported from `components/ui/index.ts`
- [ ] No mock data

---

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TICKET ID: FE-1-UI-06
TITLE: Build Table component with TanStack Table
WAVE: Wave 1 — Auth Flows + UI Component Library
DOMAIN: UI
PRIORITY: High
DEPENDS ON: FE-0-INFRA-01 (@tanstack/react-table installed), FE-1-UI-05
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section 1 — Walkthrough

**What is this ticket about?**
Admin data tables (bookings list, owners list, clients list, payments list) all need sorting, column configuration, and pagination. This ticket builds a generic `<DataTable>` component powered by TanStack Table v8 that every list page imports. It includes: column definitions, sort headers, loading state (SkeletonTable), empty state, and a pagination control.

**Why NOW?**
Every Wave 3–5 list page uses this table. Building it once with the right abstraction saves 10+ reimplementations.

---

### Section 4 — In Scope

- [ ] `components/ui/DataTable.tsx` — generic table with TanStack Table v8
- [ ] Generic typing: `DataTable<T>` accepts `columns: ColumnDef<T>[]`, `data: T[]`
- [ ] Props: `columns`, `data`, `isLoading`, `emptyMessage?`, `pagination?` (PaginationMeta)
- [ ] Loading state: renders `<SkeletonTable>` (from FE-1-UI-05)
- [ ] Empty state: renders `<EmptyState>` (FE-1-UI-10 — use a prop-based fallback for now)
- [ ] Sorting: click column header to sort (TanStack Table handles the logic)
- [ ] `components/ui/Pagination.tsx` — prev/next/page numbers control
- [ ] Pagination uses `PaginationMeta` from API: `{ page, pageSize, totalCount, totalPages }`
- [ ] Export both from `components/ui/index.ts`

**Files to create:**
- `components/ui/DataTable.tsx`
- `components/ui/Pagination.tsx`

---

### Section 6 — Technical Contract

```typescript
import { ColumnDef } from '@tanstack/react-table'
import { PaginationMeta } from '@/lib/api/types'

interface DataTableProps<T> {
  columns:       ColumnDef<T>[]
  data:          T[]
  isLoading?:    boolean
  emptyMessage?: string           // shown when data.length === 0
  pagination?:   PaginationMeta   // { page, pageSize, totalCount, totalPages }
  onPageChange?: (page: number) => void
}

interface PaginationProps {
  meta:         PaginationMeta
  onPageChange: (page: number) => void
  isLoading?:   boolean
}
```

**CRITICAL: PaginationMeta from API uses `totalCount` and `totalPages` (not `total`):**

```typescript
// From KAZA_BOOKING_API_Reference.md — Shared Response Envelope:
// pagination: { totalCount, page, pageSize, totalPages }
// Use totalCount for "showing X of Y results"
// Use totalPages for calculating page range
```

---

### Section 12 — Acceptance Criteria

- [ ] `DataTable<T>` correctly typed with generics
- [ ] Loading state shows `<SkeletonTable>`
- [ ] Sorting works on click of sortable column headers
- [ ] `Pagination` uses `totalCount` and `totalPages` from API (not `total`)
- [ ] "Showing X–Y of totalCount results" displays correctly
- [ ] No mock data (component accepts real data from props)

---

### Section 13 — Notes for AI / Common Mistakes

**DO NOT:**
- ⛔ NO MOCK DATA. DataTable is a generic component — pass real API data from consumer.
- Do NOT use `pagination.total` — API uses `pagination.totalCount`
- Do NOT import `@tanstack/react-query` here — only `@tanstack/react-table`

---

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TICKET ID: FE-1-UI-07
TITLE: Build Badge and StatusBadge components
WAVE: Wave 1 — Auth Flows + UI Component Library
DOMAIN: UI
PRIORITY: Critical
DEPENDS ON: FE-0-INFRA-07 (constants for status colors)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section 1 — Walkthrough

**What is this ticket about?**
Status badges appear everywhere: booking status in the CRM pipeline, payment status in finance, unit status in the units list, review status in moderation. This ticket builds a generic `<Badge>` and a smart `<StatusBadge>` that automatically maps API status values to colors using the constants from Wave 0.

**Why NOW?**
CRM kanban cards (Wave 3) need status badges. Unit list (Wave 2) needs status badges.

---

### Section 4 — In Scope

- [ ] `components/ui/Badge.tsx` — generic badge: text, variant (success/warning/danger/info/neutral), size
- [ ] `components/ui/StatusBadge.tsx` — smart badge that accepts a `BookingStatus` or `PaymentStatus` etc. and auto-maps to color using constants
- [ ] Variants map to design system colors: success=`accent-green`, warning=`accent-amber`, danger=`error`, info=`accent-blue`, neutral=`neutral-400`
- [ ] Export from `components/ui/index.ts`

**Files to create:**
- `components/ui/Badge.tsx`
- `components/ui/StatusBadge.tsx`

---

### Section 6 — Technical Contract

```typescript
type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral'
type BadgeSize    = 'sm' | 'md'

interface BadgeProps {
  variant?:  BadgeVariant   // default: 'neutral'
  size?:     BadgeSize      // default: 'md'
  children:  ReactNode
  className?: string
}

interface StatusBadgeProps {
  // Accepts any status string — looks up color from BOOKING_STATUS_COLORS
  status: BookingStatus | FormalBookingStatus | PaymentStatus | ReviewStatus | PayoutStatus | InvoiceStatus
  // Optional label override — uses label constants if not provided
  label?: string
}
```

**CRITICAL — Status values are PascalCase:**
```typescript
// From KAZA_BOOKING_API_Reference.md:
// booking.leadStatus = 'Prospecting' | 'Relevant' | 'NoAnswer' etc.
// payment.paymentStatus = 'Pending' | 'Paid' | 'Failed' | 'Cancelled'
// These MUST match the constants from lib/constants/
// e.g., BOOKING_STATUS_COLORS['Confirmed'] → 'success' (NOT 'confirmed')
```

---

### Section 12 — Acceptance Criteria

- [ ] `Badge` renders with all 5 variants using design system colors
- [ ] `StatusBadge` correctly maps `'Confirmed'` → green, `'Cancelled'` → red, `'NoAnswer'` → amber
- [ ] `StatusBadge` uses `BOOKING_STATUS_LABELS['Confirmed']` for display text
- [ ] No hardcoded status strings — all from `lib/constants/`
- [ ] No mock data

---

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TICKET ID: FE-1-UI-08
TITLE: Build DatePicker and DateRangePicker components
WAVE: Wave 1 — Auth Flows + UI Component Library
DOMAIN: UI
PRIORITY: High
DEPENDS ON: FE-0-INFRA-01 (react-day-picker installed), FE-1-UI-02
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section 1 — Walkthrough

**What is this ticket about?**
Date inputs appear in: blocking unit dates, creating seasonal pricing, filtering bookings by date, the guest booking form. This ticket wraps `react-day-picker` in a styled component that matches the design system and integrates with React Hook Form.

---

### Section 4 — In Scope

- [ ] `components/ui/DatePicker.tsx` — single date selection with popup calendar
- [ ] `components/ui/DateRangePicker.tsx` — start/end date range with single calendar popup
- [ ] Both: trigger button (shows formatted date), popup via Popover pattern, close on outside click
- [ ] Both: integrate with RHF via `value` + `onChange` props
- [ ] Formatting uses `formatDate()` from `@/lib/utils/format`
- [ ] Disabled dates support (for availability calendar)
- [ ] Export from `components/ui/index.ts`

**Files to create:**
- `components/ui/DatePicker.tsx`
- `components/ui/DateRangePicker.tsx`

---

### Section 6 — Technical Contract

```typescript
interface DatePickerProps {
  label?:          string
  error?:          string
  value?:          Date | null
  onChange:        (date: Date | null) => void
  placeholder?:    string
  disabled?:       boolean
  disabledDates?:  Date[]
  minDate?:        Date
  maxDate?:        Date
}

interface DateRangePickerProps {
  label?:       string
  error?:       string
  from?:        Date | null
  to?:          Date | null
  onChange:     (range: { from: Date | null; to: Date | null }) => void
  placeholder?: string
  disabled?:    boolean
  minDate?:     Date
}
```

---

### Section 12 — Acceptance Criteria

- [ ] DatePicker shows formatted date in trigger button using `formatDate()`
- [ ] DateRangePicker shows formatted range
- [ ] Popup closes on outside click and on selection
- [ ] `disabledDates` visually prevents selection of blocked dates
- [ ] Design system colors used for selected day highlight
- [ ] No mock data

---

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TICKET ID: FE-1-UI-09
TITLE: Setup Toast notifications + wire into Axios interceptor
WAVE: Wave 1 — Auth Flows + UI Component Library
DOMAIN: UI
PRIORITY: Critical
DEPENDS ON: FE-0-INFRA-01 (react-hot-toast installed), FE-0-INFRA-03 (Axios TODO markers)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section 1 — Walkthrough

**What is this ticket about?**
The Axios interceptor in FE-0-INFRA-03 has TODO markers where toasts should appear on 403, 500, and network errors. This ticket configures `react-hot-toast` globally and resolves those TODOs so every API error automatically shows a toast. It also provides a `toast` utility that every mutation's `onError` can call for per-mutation success messages.

**Why NOW?**
Auth mutations (Track A) and every Wave 2–5 mutation need toast feedback. The Axios interceptor TODOs must be resolved before any real API call testing.

---

### Section 4 — In Scope

- [ ] Add `<Toaster>` to `app/layout.tsx` with project-specific config (warm position, design system colors)
- [ ] Resolve ALL remaining TODO markers in `lib/api/axios.ts` for toast calls:
  - 403 → `toast.error("You don't have permission to perform this action")`
  - 500+ → `toast.error("Something went wrong. Please try again.")`
  - Network error → `toast.error("Cannot reach the server. Check your connection.")`
- [ ] Create `lib/utils/toast.ts` — typed toast helpers: `toastSuccess()`, `toastError()`, `toastLoading()`
- [ ] Style toasts using design system: warm background, correct font
- [ ] Export toast helpers from `lib/utils/index.ts`

**Files to create:**
- `lib/utils/toast.ts`

**Files to modify:**
- `app/layout.tsx` — add `<Toaster>` (after `<SmoothScrollProvider>`)
- `lib/api/axios.ts` — resolve remaining TODO markers

---

### Section 6 — Technical Contract

```typescript
// lib/utils/toast.ts
import toast from 'react-hot-toast'

export const toastSuccess = (message: string) =>
  toast.success(message, {
    duration: 3000,
    style: {
      background: 'var(--color-neutral-800)',
      color: '#fff',
      fontFamily: 'var(--font-body)',
      fontSize: '14px',
      borderRadius: '8px',
    },
  })

export const toastError = (message: string) =>
  toast.error(message, {
    duration: 4000,
    style: { /* same */ },
  })

export const toastLoading = (message: string) =>
  toast.loading(message)
```

---

### Section 11 — Verification Steps

1. Make an API call that returns 403 → expected: red toast "You don't have permission..."
2. Make an API call that returns 500 → expected: red toast "Something went wrong..."
3. Kill backend server, make any call → expected: toast "Cannot reach the server..."
4. Call `toastSuccess("Saved!")` manually → expected: green-ish toast with correct font and border radius
5. Run `grep -r "// TODO (FE-1-UI-09)" lib/api/axios.ts` → expected: zero results (all TODOs resolved)

---

### Section 12 — Acceptance Criteria

- [ ] `<Toaster>` present in `app/layout.tsx`
- [ ] 403 API responses automatically show permission error toast
- [ ] 500+ API responses automatically show generic error toast
- [ ] Network errors automatically show server unreachable toast
- [ ] All `// TODO (FE-1-UI-09)` markers in `axios.ts` resolved
- [ ] `toastSuccess()`, `toastError()`, `toastLoading()` exported from `lib/utils/`
- [ ] Toast styling uses design system CSS variables

---

### Section 13 — Notes for AI / Common Mistakes

**DO NOT:**
- ⛔ NO MOCK DATA.
- Do NOT call `alert()` or `console.error()` as a fallback — always toast
- Do NOT use plain `toast()` directly in components — use the typed helpers from `lib/utils/toast.ts`
- Do NOT put the `<Toaster>` inside a route group layout — it must be in the ROOT layout so it works across all apps

---

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TICKET ID: FE-1-UI-10
TITLE: Build usePermissions hook + EmptyState + ConfirmDialog
WAVE: Wave 1 — Auth Flows + UI Component Library
DOMAIN: UI
PRIORITY: Critical
DEPENDS ON: FE-0-INFRA-05 (auth store), FE-0-INFRA-07 (roles constants), FE-1-UI-01, FE-1-UI-04
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section 1 — Walkthrough

**What is this ticket about?**
Three critical utilities that every feature wave uses: (1) `usePermissions()` — reads the current user's role from Zustand and returns a typed permissions object (canViewCRM, canManageFinance, etc.); (2) `<EmptyState>` — the component shown when a list/page has no data; (3) `<ConfirmDialog>` — the modal shown before any destructive action (delete, cancel booking, etc.).

**Why NOW?**
These are the most cross-cutting utilities in the project. Wave 2's unit list needs EmptyState. Wave 3's booking status transitions need ConfirmDialog. Every admin page needs usePermissions for access control.

---

### Section 2 — Objective

Build the `usePermissions()` hook based on the API access matrix, the `<EmptyState>` component for zero-data states, and the `<ConfirmDialog>` component for destructive action confirmation — so every feature wave can immediately guard pages and handle edge cases.

---

### Section 4 — In Scope

- [ ] Create `lib/hooks/usePermissions.ts` — reads `role` from auth store, returns typed Permissions object
- [ ] The permissions matrix must match the Access Matrix from `KAZA_BOOKING_API_Reference.md` (Section: Access Matrix Summary)
- [ ] Create `components/ui/EmptyState.tsx` — icon + title + description + optional CTA button
- [ ] Create `components/ui/ConfirmDialog.tsx` — uses `<Modal>` from FE-1-UI-04, shows message, Confirm/Cancel buttons
- [ ] Export all from their respective barrels

**Files to create:**
- `lib/hooks/usePermissions.ts`
- `components/ui/EmptyState.tsx`
- `components/ui/ConfirmDialog.tsx`

**Files to modify:**
- `components/ui/index.ts`
- `lib/hooks/` barrel (if exists)

---

### Section 6 — Technical Contract

#### 6a. usePermissions

```typescript
// Based directly on KAZA_BOOKING_API_Reference.md Access Matrix Summary:
interface Permissions {
  canViewCRM:             boolean  // SuperAdmin, Sales
  canManageCRM:           boolean  // SuperAdmin, Sales
  canViewBookings:        boolean  // SuperAdmin, Sales, Finance (view)
  canManageBookings:      boolean  // SuperAdmin, Sales
  canViewFinance:         boolean  // SuperAdmin, Finance
  canManageFinance:       boolean  // SuperAdmin, Finance
  canViewUnits:           boolean  // All admin roles
  canManageUnits:         boolean  // SuperAdmin, Tech
  canViewOwners:          boolean  // SuperAdmin, Sales, Finance
  canManageOwners:        boolean  // SuperAdmin only
  canViewClients:         boolean  // SuperAdmin, Sales
  canManageAdminUsers:    boolean  // SuperAdmin only
  canViewReports:         boolean  // SuperAdmin, Finance
  canModerateReviews:     boolean  // SuperAdmin only
  canManageProjects:         boolean  // SuperAdmin only
  canManageAmenities:     boolean  // SuperAdmin only
  isOwner:                boolean  // subjectType === 'Owner'
  isClient:               boolean  // subjectType === 'Client'
  isAdmin:                boolean  // subjectType === 'Admin'
}

export function usePermissions(): Permissions {
  const role = useAuthStore((s) => s.role)           // AdminRole | null
  const subjectType = useAuthStore((s) => s.subjectType)  // 'Admin'|'Owner'|'Client'|null

  return useMemo(() => {
    const isSuperAdmin = role === 'SuperAdmin'
    const isSales      = role === 'Sales'
    const isFinance    = role === 'Finance'
    const isTech       = role === 'Tech'

    return {
      canViewCRM:          isSuperAdmin || isSales,
      canManageCRM:        isSuperAdmin || isSales,
      canViewBookings:     isSuperAdmin || isSales || isFinance,
      canManageBookings:   isSuperAdmin || isSales,
      canViewFinance:      isSuperAdmin || isFinance,
      canManageFinance:    isSuperAdmin || isFinance,
      canViewUnits:        isSuperAdmin || isSales || isFinance || isTech,
      canManageUnits:      isSuperAdmin || isTech,
      canViewOwners:       isSuperAdmin || isSales || isFinance,
      canManageOwners:     isSuperAdmin,
      canViewClients:      isSuperAdmin || isSales,
      canManageAdminUsers: isSuperAdmin,
      canViewReports:      isSuperAdmin || isFinance,
      canModerateReviews:  isSuperAdmin,
      canManageProjects:      isSuperAdmin,
      canManageAmenities:  isSuperAdmin,
      isOwner:             subjectType === 'Owner',
      isClient:            subjectType === 'Client',
      isAdmin:             subjectType === 'Admin',
    }
  }, [role, subjectType])
}
```

#### 6a. EmptyState Props

```typescript
interface EmptyStateProps {
  icon?:        LucideIcon    // from lucide-react
  title:        string
  description?: string
  action?: {
    label:    string
    onClick:  () => void
  }
  className?: string
}
```

#### 6a. ConfirmDialog Props

```typescript
interface ConfirmDialogProps {
  isOpen:       boolean
  onClose:      () => void
  onConfirm:    () => void
  title:        string
  description?: string
  confirmLabel?: string       // default: 'Confirm'
  cancelLabel?:  string       // default: 'Cancel'
  variant?:      'danger' | 'warning'  // default: 'danger'
  isLoading?:    boolean      // shows spinner on confirm button while action runs
}
```

---

### Section 7 — API Integration

`usePermissions` reads from Zustand, not the API. No API calls.

---

### Section 11 — Verification Steps

1. Log in as `Sales` role → call `usePermissions()` → expected: `canViewCRM: true`, `canViewFinance: false`, `canManageOwners: false`
2. Log in as `Finance` → expected: `canViewFinance: true`, `canViewCRM: false`
3. Log in as `Tech` → expected: `canManageUnits: true`, `canViewCRM: false`, `canViewClients: false`
4. Log in as `SuperAdmin` → expected: ALL `can*` permissions are `true`
5. `<EmptyState title="No bookings" description="..." action={{label: 'Create', onClick: fn}}>` → renders correctly
6. `<ConfirmDialog isOpen onConfirm={fn} title="Delete unit?">` → shows modal, confirm fires fn, cancel closes

---

### Section 12 — Acceptance Criteria

- [ ] `usePermissions()` permissions matrix matches KAZA_BOOKING_API_Reference.md Access Matrix exactly
- [ ] `AdminRole` values are PascalCase: `'SuperAdmin'`, `'Sales'`, `'Finance'`, `'Tech'`
- [ ] `subjectType` values are PascalCase: `'Admin'`, `'Owner'`, `'Client'`
- [ ] `usePermissions()` uses `useMemo` to avoid recalculation on every render
- [ ] `EmptyState` renders icon, title, description, optional CTA button
- [ ] `ConfirmDialog` shows loading state on confirm button while `isLoading` is true
- [ ] `ConfirmDialog` uses `<Modal>` from FE-1-UI-04 (not a custom overlay)
- [ ] All 3 exported correctly from their barrels
- [ ] No mock data anywhere

---

### Section 13 — Notes for AI / Common Mistakes

**DO NOT:**
- ⛔ NO MOCK DATA. `usePermissions` reads from the real auth store populated by real login.
- Do NOT use string comparisons like `role === 'super_admin'` — roles are `'SuperAdmin'` (PascalCase)
- Do NOT use string comparisons like `subjectType === 'admin'` — it's `'Admin'` (PascalCase)
- Do NOT hardcode permissions in page components — always use `usePermissions()` hook
- Do NOT skip `useMemo` — without it, the permissions object re-creates on every render, causing re-renders in every consuming component
- Do NOT use the UIStore's `activeModal` for ConfirmDialog — ConfirmDialog manages its own `isOpen` via props from the parent

**WATCH OUT FOR:**
- Finance role has `canViewBookings: true` but `canManageBookings: false` — they can see but not edit
- SuperAdmin has ALL permissions including `canManageOwners`, `canModerateReviews`, `canManageAdminUsers` — make sure these are `true` for SuperAdmin
- `isOwner`, `isClient`, `isAdmin` check `subjectType`, not `role` — an owner has no `role` (it's null)

**REFERENCES:**
- KAZA_BOOKING_API_Reference.md — Access Matrix Summary (last section) — the definitive permissions source
- FE-0-INFRA-05 — auth store (role + subjectType live here)
- Every Wave 2–5 page ticket — they all import `usePermissions()` to guard access

---

---

# Wave 1 — QA Prompt

**Send this prompt to the QA agent ONLY after all 16 Wave 1 tickets are marked "Done" and merged.**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WAVE QA REVIEW PROMPT
Wave: 1 — Auth Flows + UI Component Library
Tickets: FE-1-AUTH-01, FE-1-AUTH-02, FE-1-AUTH-03, FE-1-AUTH-04,
         FE-1-AUTH-05, FE-1-AUTH-06,
         FE-1-UI-01, FE-1-UI-02, FE-1-UI-03, FE-1-UI-04, FE-1-UI-05,
         FE-1-UI-06, FE-1-UI-07, FE-1-UI-08, FE-1-UI-09, FE-1-UI-10
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You are a senior QA engineer reviewing completed Wave 1 work for the Rental Platform project.

## API CONTRACT VERIFICATION (CRITICAL — check before anything else)

The backend API uses PascalCase for all enum values. Verify these are correct throughout all Wave 1 files:

### Auth-specific:
- [ ] Admin login uses `{ email, password }` — NOT phone
- [ ] Owner and Client login use `{ phone, password }` — NOT email
- [ ] `POST /api/auth/client/register` returns a ClientProfile (no token) — frontend auto-calls login after
- [ ] `POST /api/auth/logout` is called BEFORE clearing local state (not skipped)
- [ ] AuthResponse.user has `userId` field (not `id`), `identifier` field (not `name/email/phone`)
- [ ] Auth store populated with `expiresInSeconds` and `subjectType` after login
- [ ] `subjectType` is 'Admin' | 'Owner' | 'Client' (PascalCase, never lowercase)
- [ ] `adminRole` is 'SuperAdmin' | 'Sales' | 'Finance' | 'Tech' (PascalCase)

### Middleware:
- [ ] `middleware.ts` exists at project root (not inside `app/`)
- [ ] Protects `/admin/*`, `/owner/*`, `/account/*`
- [ ] Uses refresh token COOKIE for check (not Zustand — inaccessible in Edge)
- [ ] Correct cookie name (matches backend's actual cookie name — confirm with backend)

### Axios TODO resolution:
- [ ] `grep "// TODO (FE-1-AUTH-05)" lib/api/axios.ts` → zero results
- [ ] `grep "// TODO (FE-1-UI-09)" lib/api/axios.ts` → zero results
- [ ] Authorization header attached to all post-login requests (verify in Network tab)

### UI Components — API contract:
- [ ] `DataTable` pagination uses `totalCount` (not `total`) from PaginationMeta
- [ ] `DataTable` pagination uses `totalPages` (not calculated manually)
- [ ] `StatusBadge` accepts PascalCase status values: 'Confirmed', 'Pending', 'NoAnswer'
- [ ] `usePermissions` role checks use PascalCase: `role === 'SuperAdmin'` (not 'super_admin')
- [ ] `usePermissions` subjectType checks: `subjectType === 'Admin'` (not 'admin')

## MOCK DATA AUDIT (HARD GATE)

Run these commands — ALL must return zero results:

```bash
grep -rn "mockData\|fakeUser\|sampleData\|dummyData\|faker\|json-server\|msw" --include="*.ts" --include="*.tsx" .
grep -rn "const \w*User = {" --include="*.ts" --include="*.tsx" lib/ components/auth/
grep -rn "const \w*Admin = {" --include="*.ts" --include="*.tsx" lib/ components/auth/
grep -rn "email.*test\|phone.*123\|password.*pass" --include="*.ts" --include="*.tsx" components/ lib/
grep -rn "// TODO (FE-1-AUTH-05)\|// TODO (FE-1-UI-09)" lib/api/axios.ts
```

If ANY grep returns results → BLOCKER.

## PER-TICKET ACCEPTANCE CRITERIA CHECKS

### FE-1-AUTH-01 — Admin Login
- [ ] Page exists at `/auth/admin/login`
- [ ] Form has email field (NOT phone), password field
- [ ] `POST /api/auth/admin/login` called with `{ email, password }`
- [ ] Successful login → auth store has accessToken, expiresInSeconds, subjectType: 'Admin'
- [ ] Successful login → redirect to `/admin/dashboard`
- [ ] Wrong credentials (401) → inline error below form (NOT a toast)
- [ ] Already logged in → redirect to dashboard without showing form
- [ ] No localStorage for token (verify: `localStorage.getItem('accessToken')` → null)
- [ ] Refresh token cookie set by server (check DevTools → Application → Cookies)

### FE-1-AUTH-02 — Owner Login
- [ ] Page exists at `/auth/owner/login`
- [ ] Form has PHONE field (NOT email)
- [ ] `POST /api/auth/owner/login` called with `{ phone, password }`
- [ ] Successful login → subjectType: 'Owner', role: null in auth store
- [ ] Successful login → redirect to `/owner/dashboard`
- [ ] "Admin? Sign in here" link goes to admin login

### FE-1-AUTH-03 — Client Login
- [ ] Page exists at `/auth/client/login`
- [ ] Form has PHONE field
- [ ] `POST /api/auth/client/login` called with `{ phone, password }`
- [ ] Successful login → subjectType: 'Client', role: null
- [ ] Redirect to `/account`
- [ ] "Register" link goes to `/auth/client/register`

### FE-1-AUTH-04 — Client Register
- [ ] Page at `/auth/client/register`
- [ ] `POST /api/auth/client/register` called FIRST (returns profile, not token)
- [ ] `POST /api/auth/client/login` called AUTOMATICALLY after register success
- [ ] No intermediate "now log in" screen
- [ ] Email field is optional — form submits without it
- [ ] Empty string email sent as undefined (not empty string) to API
- [ ] 422 phone already taken → field error on phone field
- [ ] Loading state covers BOTH API calls

### FE-1-AUTH-05 — Axios Wiring + Middleware
- [ ] All post-login API calls include Authorization Bearer header
- [ ] `/admin/*` without cookie → redirects to admin login
- [ ] `/owner/*` without cookie → redirects to owner login
- [ ] `/account/*` without cookie → redirects to client login
- [ ] Expired token triggers refresh (test by shortening expiry)
- [ ] Refresh failure → clearAuth() + redirect to login

### FE-1-AUTH-06 — Logout
- [ ] `POST /api/auth/logout` called before clearing store
- [ ] Auth store cleared even if logout API fails
- [ ] Redirect to correct login based on subjectType
- [ ] Refresh token cookie gone after logout (DevTools check)
- [ ] `<LogoutButton>` component exists in `components/auth/LogoutButton.tsx`

### FE-1-UI-01 — Button
- [ ] 5 variants: primary (terracotta), secondary, outline, ghost, danger
- [ ] isLoading shows spinner and disables button
- [ ] Uses `bg-primary-500` NOT `bg-blue-500`
- [ ] forwardRef implemented

### FE-1-UI-02 — Input/Textarea
- [ ] error prop → red border (`border-error`) + red message below
- [ ] label with required → asterisk shown
- [ ] leftAddon/rightAddon correctly positioned
- [ ] forwardRef works with RHF register()
- [ ] useId() used (no hardcoded id attributes)

### FE-1-UI-03 — Select/Combobox
- [ ] No third-party select library used
- [ ] Combobox filters options as user types
- [ ] Combobox closes on outside click

### FE-1-UI-04 — Modal
- [ ] Portal-based (renders outside root div)
- [ ] Escape key closes modal
- [ ] Backdrop click closes modal
- [ ] Body scroll locked when open
- [ ] Framer Motion animation respects prefers-reduced-motion

### FE-1-UI-05 — Skeleton
- [ ] Uses `bg-neutral-200 animate-pulse` (warm, not cold gray)
- [ ] SkeletonTable takes rows and columns props

### FE-1-UI-06 — DataTable
- [ ] Generic typed: DataTable<T> with ColumnDef<T>[]
- [ ] Pagination uses `pagination.totalCount` (not `.total`)
- [ ] Pagination uses `pagination.totalPages`
- [ ] Sorting works via TanStack Table
- [ ] Loading state shows SkeletonTable

### FE-1-UI-07 — Badge/StatusBadge
- [ ] StatusBadge maps 'Confirmed' → success color (not 'confirmed')
- [ ] StatusBadge maps 'NoAnswer' → warning (not 'no_answer')
- [ ] StatusBadge maps 'Cancelled' → danger
- [ ] Uses BOOKING_STATUS_LABELS for display text (from constants)

### FE-1-UI-08 — DatePicker
- [ ] Formatted date shown using formatDate() from utils
- [ ] disabledDates prevents selection visually
- [ ] Popup closes on selection

### FE-1-UI-09 — Toast
- [ ] `<Toaster>` in root layout
- [ ] 403 → permission denied toast (automatic, from Axios interceptor)
- [ ] 500+ → generic error toast (automatic)
- [ ] Network error → server unreachable toast (automatic)
- [ ] All TODO markers in axios.ts resolved

### FE-1-UI-10 — usePermissions + EmptyState + ConfirmDialog
- [ ] SuperAdmin: ALL permissions true
- [ ] Sales: canViewCRM true, canViewFinance false, canManageOwners false
- [ ] Finance: canViewFinance true, canViewCRM false, canViewClients false
- [ ] Tech: canManageUnits true, canViewCRM false, canViewFinance false
- [ ] Role comparisons use PascalCase ('SuperAdmin' not 'super_admin')
- [ ] SubjectType comparisons use PascalCase ('Admin' not 'admin')
- [ ] useMemo used in usePermissions
- [ ] EmptyState renders with icon, title, description, optional CTA
- [ ] ConfirmDialog uses Modal from FE-1-UI-04

## ARCHITECTURE VIOLATIONS

Check all new files in Wave 1:
- [ ] No direct axios calls in components (must use auth.service.ts)
- [ ] No server data in Zustand
- [ ] No inline endpoint strings (e.g., '/api/auth/admin/login' in component) — must use endpoints constants
- [ ] No inline route strings — must use ROUTES constants
- [ ] No any TypeScript type
- [ ] No localStorage for tokens

## TYPESCRIPT CHECK

Run: `pnpm type-check`
- [ ] Zero TypeScript errors

## Cross-track integration:
- [ ] Auth service (auth.service.ts) has all 6 methods: adminLogin, ownerLogin, clientLogin, clientRegister, refresh, logout
- [ ] Auth types (auth.types.ts) are imported consistently across all auth components
- [ ] UI components export correctly from components/ui/index.ts
- [ ] usePermissions imports role from Zustand auth store (populated by auth mutations)

## OUTPUT FORMAT

Produce report:

---
## Wave 1 QA Report

### Summary
- Tickets reviewed: [16]
- Overall status: PASS | FAIL | PARTIAL
- Blocker count: {N}
- Warning count: {N}

### Mock Data Audit
- [ ] All grep commands returned zero results
Violations (if any):
| File | Line | Violation |
|---|---|---|

### API Contract Violations
| Violation | File | Expected | Found |
|---|---|---|---|

### Per-Ticket Results
[For each of the 16 tickets:]
#### FE-1-AUTH-01 — Admin Login
Status: ✅ PASS | ❌ FAIL | ⚠️ PARTIAL
Blockers: ...
Warnings: ...

### Architecture Violations
| Violation | File | Rule | Severity |
|---|---|---|---|

### Wave 1 Sign-off Recommendation
[ ] APPROVED
[ ] CONDITIONAL — conditions: ...
[ ] BLOCKED — blockers: ...
---
```

---

---

# Wave 1 — PM Sign-off Checklist

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PM WAVE SIGN-OFF CHECKLIST
Wave: 1 — Auth Flows + UI Component Library
Date: _______________
Reviewed by: _______________
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### A. QA Report Review

- [ ] QA report received for Wave 1
- [ ] All BLOCKER items resolved (attach PR links): ________________
- [ ] All WARNING items resolved or documented with accepted reason
- [ ] QA agent marked Wave 1 as APPROVED or CONDITIONAL
- [ ] **MOCK DATA AUDIT PASSED** — all grep commands returned zero

If CONDITIONAL → reason accepted: ______________________

---

### B. Business Requirements Validation

**Auth flows — test manually with each user type:**

| Scenario | Tested | Pass/Fail |
|---|---|---|
| Admin (SuperAdmin) logs in with email+password → lands on `/admin/dashboard` | | |
| Admin (Sales) logs in → same flow, `role: 'Sales'` in store | | |
| Owner logs in with phone+password → lands on `/owner/dashboard` | | |
| Client logs in with phone+password → lands on `/account` | | |
| New client registers → auto-logged in → lands on `/account` (no "now log in" step) | | |
| Admin logs out → refresh token cookie cleared → `/admin/crm` redirects to login | | |
| Wait 15 minutes → make API call → token silently refreshed (no visible interruption) | | |

**UI Library — cross-functional verification:**

- [ ] Button variants visually match the warm terracotta design system (NOT generic blue/gray)
- [ ] Input error states show red border and error text correctly with RHF
- [ ] Modal opens and closes correctly (backdrop, Escape key, body scroll lock)
- [ ] Toast appears for 403, 500, and network errors automatically
- [ ] `usePermissions` correctly restricts what different roles can do (tested with 4 role types)

---

### C. Definition of Done — Full Wave Audit

For every file in Wave 1:

- [ ] Zero TypeScript errors (`pnpm type-check` clean)
- [ ] Zero ESLint errors (`pnpm lint` clean)
- [ ] No mock data anywhere (all grep audit commands return zero)
- [ ] Tokens in memory only (localStorage clean for access token)
- [ ] Refresh token in HttpOnly cookie (not in any JS variable)
- [ ] All API enum values PascalCase (AdminRole, SubjectType, etc.)
- [ ] `pagination.totalCount` used (not `.total`) in DataTable
- [ ] All auth TODO markers in `axios.ts` resolved

---

### D. API Contract Sign-off

- [ ] Admin login uses email (not phone) ✓
- [ ] Owner and client login use phone (not email) ✓
- [ ] Client register → auto-login flow (2 API calls, no intermediate screen) ✓
- [ ] Logout calls `POST /api/auth/logout` before clearing state ✓
- [ ] AuthResponse.user.userId stored correctly (not .id) ✓
- [ ] subjectType stored as 'Admin'/'Owner'/'Client' (PascalCase) ✓
- [ ] adminRole stored as 'SuperAdmin'/'Sales'/'Finance'/'Tech' (PascalCase) ✓
- [ ] PaginationMeta uses totalCount + totalPages (not total) ✓

---

### E. Integration with Wave 0

- [ ] Wave 0 constants (PascalCase corrections from Wave0_Fix_Prompt) were applied before Wave 1 started
- [ ] auth.store.ts has the corrected AuthenticatedUser shape (userId, identifier, subjectType, adminRole)
- [ ] PaginationMeta in lib/api/types.ts uses totalCount + totalPages

---

### F. Next Wave Readiness

- [ ] All 16 tickets merged to main branch
- [ ] Wave 2 dependencies satisfied:
      - Admin login flow works → admin can authenticate ✓
      - Button, Input, Select, Modal, Skeleton, DataTable, Badge exist ✓
      - Toast notifications active ✓
      - usePermissions hook available ✓
      - EmptyState + ConfirmDialog available ✓
- [ ] Developers briefed on Wave 2 scope
- [ ] auth.service.ts has all 6 methods ready for Wave 2+ services to model from

**Lessons learned this wave:** ______________________

---

### G. Mock Data Final Audit (HARD GATE)

```bash
# All must return zero results:
grep -rn "faker\|msw\|json-server\|mockData\|fakeUser\|sampleData\|dummyData" \
  --include="*.ts" --include="*.tsx" \
  components/auth/ lib/hooks/useAuth.ts lib/api/services/auth.service.ts

grep -rn "// TODO (FE-1-AUTH-05)\|// TODO (FE-1-UI-09)" lib/api/axios.ts

grep -rn "'super_admin'\|'no_answer'\|'check_in'\|'not_relevant'\|'left_early'" \
  --include="*.ts" --include="*.tsx" .

grep -rn "pagination\.total[^C]" --include="*.ts" --include="*.tsx" .

grep -rn "user\.id[^e]" lib/stores/ components/auth/
```

- [ ] All above commands return zero results
- [ ] Audit performed by: ________________
- [ ] Date: ________________

---

### H. Sign-off Decision

```
[ ] WAVE 1 APPROVED
    All checks passed. Wave 2 may begin.
    Auth system verified with real backend.
    UI library verified visually and functionally.

[ ] WAVE 1 APPROVED WITH CONDITIONS
    Conditions: _______________________
    Must resolve by: ___________________
    Wave 2 may begin with these conditions accepted.

[ ] WAVE 1 NOT APPROVED
    Blockers: _________________________
    Re-review date: ___________________
    Wave 2 BLOCKED.
```

**Signed off by (PM name):** ______________________
**Date:** ______________________
**Reference (PR/commit):** ______________________

---

---

# Wave 1 — Final Summary

| Track | # | Ticket | Key Deliverable |
|---|---|---|---|
| A | 1 | FE-1-AUTH-01 | Admin login (email+password) → auth store |
| A | 2 | FE-1-AUTH-02 | Owner login (phone+password) → owner portal |
| A | 3 | FE-1-AUTH-03 | Client login (phone+password) → account |
| A | 4 | FE-1-AUTH-04 | Client register → auto-login (2 API calls) |
| A | 5 | FE-1-AUTH-05 | Axios auth wiring + middleware route protection |
| A | 6 | FE-1-AUTH-06 | Logout (server revoke + local clear) |
| B | 7 | FE-1-UI-01 | Button (5 variants, loading state) |
| B | 8 | FE-1-UI-02 | Input + Textarea (RHF compatible) |
| B | 9 | FE-1-UI-03 | Select + Combobox (searchable) |
| B | 10 | FE-1-UI-04 | Modal (portal, Escape, scroll lock) |
| B | 11 | FE-1-UI-05 | Skeleton (Skeleton, SkeletonCard, SkeletonTable) |
| B | 12 | FE-1-UI-06 | DataTable (TanStack Table + Pagination) |
| B | 13 | FE-1-UI-07 | Badge + StatusBadge (PascalCase status values) |
| B | 14 | FE-1-UI-08 | DatePicker + DateRangePicker |
| B | 15 | FE-1-UI-09 | Toast setup + Axios TODO resolution |
| B | 16 | FE-1-UI-10 | usePermissions + EmptyState + ConfirmDialog |

**Wave 1 Status:** Ready for hand-off once Wave 0 corrections are applied.
**Next Wave:** Wave 2 — Admin Shell + Units Domain (14 tickets).

*End of Wave 1 ticket pack.*
