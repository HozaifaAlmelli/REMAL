# 🔬 API Reference Analysis — Pre-Wave 1 Report
## الملاحظات الحرجة قبل البدء في Wave 1

**المصدر:** KAZA_BOOKING_API_Reference.md (الـ Swagger الفعلي)
**الأثر:** يتطلب تصحيح بعض ما كُتب في Wave 0 + يحدد كل الـ contracts لـ Wave 1

---

## 🚨 Critical Corrections — يجب تطبيقها BEFORE Wave 1

---

### Correction #1 — كل الـ Enum values في Wave 0 غلط (PascalCase vs snake_case)

الـ Backend يستخدم **PascalCase** للـ enum values. الـ Wave 0 كتبها بـ **snake_case**. ده معناه إن كل `status` comparison في الـ Frontend هتفشل صامتة.

#### الجدول الكامل للتصحيح:

| Constant | Wave 0 (خطأ) | API Actual (صح) |
|---|---|---|
| `BOOKING_STATUSES.prospecting` | `'prospecting'` | `'Prospecting'` |
| `BOOKING_STATUSES.relevant` | `'relevant'` | `'Relevant'` |
| `BOOKING_STATUSES.no_answer` | `'no_answer'` | `'NoAnswer'` |
| `BOOKING_STATUSES.not_relevant` | `'not_relevant'` | `'NotRelevant'` |
| `BOOKING_STATUSES.booked` | `'booked'` | `'Booked'` |
| `BOOKING_STATUSES.confirmed` | `'confirmed'` | `'Confirmed'` |
| `BOOKING_STATUSES.check_in` | `'check_in'` | `'CheckIn'` |
| `BOOKING_STATUSES.completed` | `'completed'` | `'Completed'` |
| `BOOKING_STATUSES.cancelled` | `'cancelled'` | `'Cancelled'` |
| `BOOKING_STATUSES.left_early` | `'left_early'` | `'LeftEarly'` |
| `ADMIN_ROLES.super_admin` | `'super_admin'` | `'SuperAdmin'` |
| `ADMIN_ROLES.sales` | `'sales'` | `'Sales'` |
| `ADMIN_ROLES.finance` | `'finance'` | `'Finance'` |
| `ADMIN_ROLES.tech` | `'tech'` | `'Tech'` |
| `PAYMENT_STATUSES.pending` | `'pending'` | `'Pending'` |
| `PAYMENT_STATUSES.paid` | `'paid'` | `'Paid'` |
| `PAYMENT_STATUSES.failed` | `'failed'` | `'Failed'` |
| `PAYMENT_STATUSES.cancelled` | `'cancelled'` | `'Cancelled'` |
| `BOOKING_SOURCES.website` | `'website'` | `'Website'` |
| `BOOKING_SOURCES.app` | `'app'` | `'App'` |
| `BOOKING_SOURCES.whatsapp` | `'whatsapp'` | `'WhatsApp'` |
| `BOOKING_SOURCES.phone` | `'phone'` | `'PhoneCall'` ← اسم مختلف |
| `BOOKING_SOURCES.referral` | `'referral'` | `'Referral'` |
| `DATE_BLOCK_REASONS.maintenance` | `'maintenance'` | `'Maintenance'` |
| `DATE_BLOCK_REASONS.owner_use` | `'owner_use'` | `'OwnerUse'` ← underscore اتحذف |
| `DATE_BLOCK_REASONS.other` | `'other'` | `'Other'` |
| `NOTIFICATION_CHANNELS.email` | `'email'` | `'Email'` |
| `NOTIFICATION_CHANNELS.sms` | `'sms'` | `'SMS'` |
| `NOTIFICATION_CHANNELS.in_app` | `'in_app'` | `'InApp'` ← اسم مختلف |
| `UNIT_TYPES.villa` | `'villa'` | `'villa'` ✅ صح — lowercase |
| `UNIT_TYPES.chalet` | `'chalet'` | `'chalet'` ✅ صح |
| `UNIT_TYPES.studio` | `'studio'` | `'studio'` ✅ صح |

#### الكود الصح لـ `lib/constants/booking-statuses.ts`:

```typescript
export const BOOKING_STATUSES = {
  prospecting:  'Prospecting',
  relevant:     'Relevant',
  no_answer:    'NoAnswer',
  not_relevant: 'NotRelevant',
  booked:       'Booked',
  confirmed:    'Confirmed',
  check_in:     'CheckIn',
  completed:    'Completed',
  cancelled:    'Cancelled',
  left_early:   'LeftEarly',
} as const

export type BookingStatus = (typeof BOOKING_STATUSES)[keyof typeof BOOKING_STATUSES]
// = 'Prospecting' | 'Relevant' | 'NoAnswer' | 'NotRelevant' | 'Booked' | 'Confirmed' | 'CheckIn' | 'Completed' | 'Cancelled' | 'LeftEarly'

export const VALID_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  Prospecting:  ['Relevant', 'NoAnswer', 'NotRelevant'],
  Relevant:     ['Booked', 'NoAnswer', 'NotRelevant'],
  NoAnswer:     ['Relevant', 'NotRelevant'],
  NotRelevant:  [],
  Booked:       ['Confirmed', 'NotRelevant'],
  Confirmed:    ['CheckIn', 'Cancelled'],
  CheckIn:      ['Completed', 'LeftEarly'],
  Completed:    [],
  Cancelled:    [],
  LeftEarly:    [],
}

export const CRM_PIPELINE_COLUMNS: BookingStatus[] = [
  'Prospecting', 'Relevant', 'NoAnswer',
  'Booked', 'Confirmed', 'CheckIn', 'Completed',
]

export const CRM_CLOSED_STATUSES: BookingStatus[] = [
  'NotRelevant', 'Cancelled', 'LeftEarly',
]
```

---

### Correction #2 — Booking vs CRM Lead: نوعان مختلفان بـ status sets مختلفة

هذا اكتشاف مهم — الـ API يفرق بينهم:

| | CRM Lead (`leadStatus`) | Booking (`bookingStatus`) |
|---|---|---|
| الـ statuses | `Prospecting → ... → LeftEarly` (10 statuses) | `Pending → ... → LeftEarly` (6 statuses) |
| التخزين | `crm/leads` endpoint | `internal/bookings` endpoint |
| الإنشاء | Public form + internal | من convert-to-booking أو مباشرة |
| العلاقة | Lead → يتحول لـ Booking عند `convert-to-booking` | |

```typescript
// إضافة جديدة في lib/constants/booking-statuses.ts:
export const BOOKING_STATUSES_FORMAL = {
  pending:   'Pending',
  confirmed: 'Confirmed',
  check_in:  'CheckIn',
  completed: 'Completed',
  cancelled: 'Cancelled',
  left_early: 'LeftEarly',
} as const

export type FormalBookingStatus = (typeof BOOKING_STATUSES_FORMAL)[keyof typeof BOOKING_STATUSES_FORMAL]
```

---

### Correction #3 — Pagination Object: حقل مختلف

| | Wave 0 (خطأ) | API Actual (صح) |
|---|---|---|
| الإجمالي | `total` | `totalCount` |
| إضافي | — | `totalPages` |

```typescript
// lib/api/types.ts — يُصحح:
export interface PaginationMeta {
  page: number
  pageSize: number
  totalCount: number   // ← كان "total"
  totalPages: number   // ← جديد
}
```

---

### Correction #4 — Auth Response Shape: حقول مختلفة تماماً

الـ `AuthenticatedUser` في Wave 0 كان خطأ. الـ API يرجع:

```typescript
// الشكل الفعلي من API:
interface AuthResponse {
  accessToken: string
  expiresInSeconds: number      // ← جديد — 900 = 15 دقيقة
  subjectType: 'Admin' | 'Owner' | 'Client'
  adminRole: 'SuperAdmin' | 'Sales' | 'Finance' | 'Tech' | null
  user: {
    userId: string              // ← "userId" مش "id"
    identifier: string          // ← مش "name" أو "email" — identifier فقط
    subjectType: string
    adminRole: string | null
  }
}
```

**الأثر على `lib/stores/auth.store.ts`:**

```typescript
// يُصحح AuthenticatedUser:
export interface AuthenticatedUser {
  userId: string        // ← كان "id"
  identifier: string    // ← كان "name", "email", "phone"
  subjectType: 'Admin' | 'Owner' | 'Client'
  adminRole: 'SuperAdmin' | 'Sales' | 'Finance' | 'Tech' | null
}

// يُضاف لـ AuthState:
interface AuthState {
  accessToken: string | null
  expiresInSeconds: number | null  // ← جديد
  subjectType: 'Admin' | 'Owner' | 'Client' | null  // ← جديد
  user: AuthenticatedUser | null
  role: AuthRole
  // ...actions
}
```

---

### Correction #5 — Constants ناقصة من Wave 0

الـ Constants دي موجودة في الـ API لكن مش موجودة في `lib/constants/`:

```typescript
// ← يُضاف: lib/constants/payment-methods.ts
export const PAYMENT_METHODS = {
  instapay:      'InstaPay',
  vodafoneCash:  'VodafoneCash',
  cash:          'Cash',
  bankTransfer:  'BankTransfer',
} as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[keyof typeof PAYMENT_METHODS]
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  InstaPay:     'InstaPay',
  VodafoneCash: 'Vodafone Cash',
  Cash:         'Cash',
  BankTransfer: 'Bank Transfer',
}

// ← يُضاف: lib/constants/review-statuses.ts
export const REVIEW_STATUSES = {
  pending:   'Pending',
  published: 'Published',
  rejected:  'Rejected',
  hidden:    'Hidden',
} as const
export type ReviewStatus = (typeof REVIEW_STATUSES)[keyof typeof REVIEW_STATUSES]
export const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  Pending:   'Pending Review',
  Published: 'Published',
  Rejected:  'Rejected',
  Hidden:    'Hidden',
}

// ← يُضاف: lib/constants/payout-statuses.ts
export const PAYOUT_STATUSES = {
  pending:   'Pending',
  scheduled: 'Scheduled',
  paid:      'Paid',
  cancelled: 'Cancelled',
} as const
export type PayoutStatus = (typeof PAYOUT_STATUSES)[keyof typeof PAYOUT_STATUSES]
export const PAYOUT_STATUS_LABELS: Record<PayoutStatus, string> = {
  Pending:   'Pending',
  Scheduled: 'Scheduled',
  Paid:      'Paid',
  Cancelled: 'Cancelled',
}

// ← يُضاف: lib/constants/invoice-statuses.ts
export const INVOICE_STATUSES = {
  draft:     'Draft',
  issued:    'Issued',
  cancelled: 'Cancelled',
} as const
export type InvoiceStatus = (typeof INVOICE_STATUSES)[keyof typeof INVOICE_STATUSES]
export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  Draft:     'Draft',
  Issued:    'Issued',
  Cancelled: 'Cancelled',
}

// ← يُضاف: lib/constants/notification-statuses.ts
export const NOTIFICATION_STATUSES = {
  pending:   'Pending',
  queued:    'Queued',
  sent:      'Sent',
  delivered: 'Delivered',
  failed:    'Failed',
  cancelled: 'Cancelled',
} as const
export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[keyof typeof NOTIFICATION_STATUSES]
```

---

## 📋 Wave 1 — Full API Contracts Reference

هذا القسم يوثق كل الـ requests والـ responses اللي Wave 1 هيستخدمها، مأخوذة مباشرة من الـ API Reference.

---

### AUTH Contracts (يستخدمها FE-1-AUTH-01 → 04)

#### Admin Login
```
POST /api/auth/admin/login

Request:
{ "email": string, "password": string }

Response data:
{
  "accessToken": string,
  "expiresInSeconds": 900,
  "subjectType": "Admin",
  "adminRole": "SuperAdmin" | "Sales" | "Finance" | "Tech",
  "user": {
    "userId": string (uuid),
    "identifier": string,   // the email used to login
    "subjectType": "Admin",
    "adminRole": "SuperAdmin" | "Sales" | "Finance" | "Tech"
  }
}
```

#### Owner Login
```
POST /api/auth/owner/login

Request:
{ "phone": string, "password": string }   ← phone, NOT email

Response data: same shape, subjectType = "Owner", adminRole = null
```

#### Client Login
```
POST /api/auth/client/login

Request:
{ "phone": string, "password": string }   ← phone, NOT email

Response data: same shape, subjectType = "Client", adminRole = null
```

#### Client Register
```
POST /api/auth/client/register

Request:
{
  "name": string,       // required
  "phone": string,      // required, unique
  "email": string,      // optional
  "password": string    // required, min 8 chars
}

Response data:   ← CLIENT PROFILE, NOT a token!
{
  "id": uuid,
  "name": string,
  "phone": string,
  "email": string | null,
  "isActive": true,
  "createdAt": ISO string,
  "updatedAt": ISO string
}

⚠️ IMPORTANT: No token returned — must call client/login after register
```

#### Refresh Token
```
POST /api/auth/refresh
No body — uses HttpOnly cookie

Response data: same as login response with new accessToken
```

#### Logout
```
POST /api/auth/logout
No body

Response data: "string" (success message)
```

---

### TYPE DEFINITIONS for Wave 1

```typescript
// lib/types/auth.types.ts  (NEW FILE — يُنشأ في Wave 1)

export type SubjectType = 'Admin' | 'Owner' | 'Client'
export type AdminRole = 'SuperAdmin' | 'Sales' | 'Finance' | 'Tech'

export interface AuthUserPayload {
  userId: string
  identifier: string
  subjectType: SubjectType
  adminRole: AdminRole | null
}

export interface AuthResponse {
  accessToken: string
  expiresInSeconds: number
  subjectType: SubjectType
  adminRole: AdminRole | null
  user: AuthUserPayload
}

// For Admin login specifically:
export interface AdminLoginRequest {
  email: string
  password: string
}

// For Owner and Client login:
export interface PhoneLoginRequest {
  phone: string
  password: string
}

// For Client register:
export interface ClientRegisterRequest {
  name: string
  phone: string
  email?: string
  password: string
}

// Client profile returned by register:
export interface ClientProfileResponse {
  id: string
  name: string
  phone: string
  email: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

// Admin login Zod schema:
const adminLoginSchema = z.object({
  email: z.string().email('Valid email required'),
  password: z.string().min(1, 'Password is required'),
})

// Owner/Client login Zod schema:
const phoneLoginSchema = z.object({
  phone: z.string().min(1, 'Phone number is required'),
  password: z.string().min(1, 'Password is required'),
})

// Client register Zod schema:
const clientRegisterSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().min(1, 'Phone number is required'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})
```

---

### usePermissions Hook — Role-based rules (يستخدمها FE-1-UI-10)

مبنية على Access Matrix في نهاية الـ API Reference:

```typescript
// lib/hooks/usePermissions.ts — الـ rules المستخرجة من الـ API

interface Permissions {
  // CRM & Leads
  canViewCRM: boolean           // SuperAdmin, Sales
  canManageCRM: boolean         // SuperAdmin, Sales

  // Bookings
  canViewBookings: boolean      // SuperAdmin, Sales, Finance (view only)
  canManageBookings: boolean    // SuperAdmin, Sales

  // Finance
  canViewFinance: boolean       // SuperAdmin, Finance
  canManageFinance: boolean     // SuperAdmin, Finance

  // Units
  canViewUnits: boolean         // All admin roles
  canManageUnits: boolean       // SuperAdmin, Tech

  // Owners
  canViewOwners: boolean        // SuperAdmin, Sales, Finance
  canManageOwners: boolean      // SuperAdmin

  // Clients
  canViewClients: boolean       // SuperAdmin, Sales

  // Admin Users
  canManageAdminUsers: boolean  // SuperAdmin only

  // Reports
  canViewReports: boolean       // SuperAdmin, Finance

  // Review Moderation
  canModerateReviews: boolean   // SuperAdmin only

  // Projects & Amenities (write)
  canManageProjects: boolean       // SuperAdmin only
  canManageAmenities: boolean   // SuperAdmin only
}

// Role mapping:
const ROLE_PERMISSIONS: Record<AdminRole, Permissions> = {
  SuperAdmin: {
    canViewCRM: true, canManageCRM: true,
    canViewBookings: true, canManageBookings: true,
    canViewFinance: true, canManageFinance: true,
    canViewUnits: true, canManageUnits: true,
    canViewOwners: true, canManageOwners: true,
    canViewClients: true,
    canManageAdminUsers: true,
    canViewReports: true,
    canModerateReviews: true,
    canManageProjects: true, canManageAmenities: true,
  },
  Sales: {
    canViewCRM: true, canManageCRM: true,
    canViewBookings: true, canManageBookings: true,
    canViewFinance: false, canManageFinance: false,
    canViewUnits: true, canManageUnits: false,
    canViewOwners: true, canManageOwners: false,
    canViewClients: true,
    canManageAdminUsers: false,
    canViewReports: false,
    canModerateReviews: false,
    canManageProjects: false, canManageAmenities: false,
  },
  Finance: {
    canViewCRM: false, canManageCRM: false,
    canViewBookings: true, canManageBookings: false,
    canViewFinance: true, canManageFinance: true,
    canViewUnits: true, canManageUnits: false,
    canViewOwners: true, canManageOwners: false,
    canViewClients: false,
    canManageAdminUsers: false,
    canViewReports: true,
    canModerateReviews: false,
    canManageProjects: false, canManageAmenities: false,
  },
  Tech: {
    canViewCRM: false, canManageCRM: false,
    canViewBookings: false, canManageBookings: false,
    canViewFinance: false, canManageFinance: false,
    canViewUnits: true, canManageUnits: true,
    canViewOwners: false, canManageOwners: false,
    canViewClients: false,
    canManageAdminUsers: false,
    canViewReports: false,
    canModerateReviews: false,
    canManageProjects: false, canManageAmenities: false,
  },
}
```

---

### Projects API (يُستخدم في Wave 1 لـ select dropdowns في forms)

```typescript
// GET /api/projects
// Query: { includeInactive?: boolean }
// Response array item:
interface ProjectResponse {
  id: string
  name: string
  description: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

// GET /api/amenities
// No query params
// Response array item:
interface AmenityResponse {
  id: string
  name: string
  icon: string | null
  createdAt: string
  updatedAt: string
}
```

---

## 📊 Impact Summary — ما يجب تصحيحه قبل Wave 1

### الـ Files المتأثرة من Wave 0:

| File | المشكلة | الحل |
|------|---------|------|
| `lib/constants/booking-statuses.ts` | كل الـ values بـ snake_case بدل PascalCase | إعادة كتابة كاملة |
| `lib/constants/roles.ts` | `super_admin` بدل `SuperAdmin` | إعادة كتابة |
| `lib/constants/payment-statuses.ts` | `pending` بدل `Pending` | إعادة كتابة |
| `lib/constants/booking-sources.ts` | `phone` بدل `PhoneCall`، lowercase | إعادة كتابة |
| `lib/constants/date-block-reasons.ts` | `maintenance` بدل `Maintenance` | إعادة كتابة |
| `lib/constants/notification-channels.ts` | `in_app` بدل `InApp` | إعادة كتابة |
| `lib/api/types.ts` | `total` بدل `totalCount`، missing `totalPages` | تصحيح |
| `lib/stores/auth.store.ts` | `AuthenticatedUser` fields غلطة | تصحيح |
| `lib/constants/index.ts` | ناقص 5 constants جديدة | إضافة exports |

### الـ Files الجديدة المطلوبة:

| File | المحتوى |
|------|---------|
| `lib/constants/payment-methods.ts` | InstaPay / VodafoneCash / Cash / BankTransfer |
| `lib/constants/review-statuses.ts` | Pending / Published / Rejected / Hidden |
| `lib/constants/payout-statuses.ts` | Pending / Scheduled / Paid / Cancelled |
| `lib/constants/invoice-statuses.ts` | Draft / Issued / Cancelled |
| `lib/constants/notification-statuses.ts` | Pending / Queued / Sent / Delivered / Failed / Cancelled |
| `lib/types/auth.types.ts` | Full auth type definitions |

---

## ✅ ما هو صح في Wave 0 ولا يحتاج تغيير

- الـ Axios instance setup ✅
- الـ Endpoints constants ✅ (paths صح)
- الـ Zustand stores structure ✅ (فقط AuthenticatedUser fields تتصحح)
- الـ TanStack Query setup ✅
- الـ Design System (fonts, colors, shadows) ✅
- الـ Smooth Scroll Provider ✅
- الـ Unit Types (villa/chalet/studio lowercase) ✅
- الـ Unit active state (`isActive` boolean) ✅

---

## ℹ️ PaymentType Clarification

- `PaymentType` غير موجود كـ frontend contract موثق في الـ API الحالي.
- لا يُوصى بإضافة constants لتصنيف نوع الدفعة ضمن الـ contract الحالي.
- أي payment classification إضافي (مثل Deposit/Remaining/Refund) إذا احتاجه الـ business لاحقًا فهو **Backend/API gap** يحتاج توثيق endpoint/field رسمي أولًا، وليس عقد frontend حالي.
- الـ ROUTES constants ✅
- الـ `cn()`, `formatCurrency()`, `formatDate()` ✅

---

## 🎯 خطوات ما قبل Wave 1

### الخطوة 1 — تصحيح Wave 0 Constants (BLOCKER)
يجب تنفيذ الـ corrections أعلاه في Wave 0 codebase قبل ما Wave 1 يبدأ.
هذه يمكن إضافتها كـ fix ticket: `FE-0-INFRA-07-FIX`

### الخطوة 2 — إضافة 5 ملفات constants جديدة
الملفات اللي اكتشفنا إنها ناقصة من Wave 0.

### الخطوة 3 — تصحيح `lib/api/types.ts`
`total` → `totalCount` + إضافة `totalPages`

### الخطوة 4 — تصحيح `lib/stores/auth.store.ts`
`AuthenticatedUser` fields

### الخطوة 5 — إنشاء `lib/types/auth.types.ts`
الـ type definitions الكاملة للـ auth responses.

بعد كل ده — Wave 1 يبدأ بقاعدة صح.

---

*هذا الملف يُستخدم كـ reference مع كل ticket في Wave 1 وما بعده.*
*المصدر: KAZA_BOOKING_API_Reference.md — تحليل شامل لجميع الـ 35 section.*
