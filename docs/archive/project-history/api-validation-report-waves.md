# 🔴 API Validation Report — Cross-Check Against KAZA_BOOKING_API_Reference.md
## تقرير التصحيح الكامل لجميع الـ Waves

---

## ⚡ Executive Summary

بعد قراءة `KAZA_BOOKING_API_Reference.md` كاملاً وتقاطعه مع كل الـ tickets:
**15 تصحيح حرج** يجب تطبيقها قبل أي تنفيذ.
الأخطاء تتركز في: أسماء الـ fields، الـ request bodies، وشكل الـ responses.

---

## 🔴 CRITICAL #1 — Unit Field Names (يأثر على Wave 2, 4, 6, 7)

### الخطأ:
كل الـ tickets كتبت `type`, `capacity`, `status` للـ units.

### الصح من API:
```typescript
// Public & Internal Units API response:
{
  id:                "uuid",
  name:              "string",      // ✅ صح
  unitType:          "string",      // ❌ كنا بنكتب "type"
  maxGuests:         0,             // ❌ كنا بنكتب "capacity"
  bedrooms:          0,             // ❌ مش موجود في tickets
  bathrooms:         0,             // ❌ مش موجود في tickets
  basePricePerNight: 0,             // ✅ صح
  isActive:          true,          // ❌ كنا بنكتب status: 'active'|'inactive'
}

// PATCH /api/internal/units/{id}/status:
{ "isActive": false }              // ❌ كنا بنكتب { status: 'active' }

// POST /api/internal/units (create):
{
  ownerId:           "uuid",
  projectId:            "uuid",
  name:              "string",
  unitType:          "villa | chalet | studio",  // ❌ كنا بنكتب "type"
  bedrooms:          2,
  bathrooms:         1,
  maxGuests:         4,            // ❌ كنا بنكتب "capacity"
  basePricePerNight: 0,
  isActive:          true
}
```

### التعديل المطلوب في:
- `lib/types/unit.types.ts` — تغيير type → unitType, capacity → maxGuests, status → isActive
- `FE-2-UNITS-01` — تعديل الـ types
- `FE-2-UNITS-03` — تعديل Create form schema وfields
- `FE-2-UNITS-05` — تعديل Edit form
- `FE-6-OWN-01` — تعديل OwnerPortalUnitResponse

---

## 🔴 CRITICAL #2 — Commission Rate: Percentage NOT Decimal (يأثر على Wave 4)

### الخطأ:
الـ Wave 4 tickets قالت إن `commissionRate` بيتخزن كـ decimal (0.20) وإحنا محتاجين نقسم/نضرب في 100.

### الصح من API:
```json
// GET /api/owners response:
{ "commissionRate": 20.00 }   ← API بيخزن كـ PERCENTAGE (20 for 20%)

// POST /api/owners request:
{ "commissionRate": 20.00 }   ← بنبعت 20, مش 0.20
```

### التعديل المطلوب:
- **مفيش حاجة اسمها ÷ 100 أو × 100** — الـ API بيستخدم الـ percentage مباشرةً
- `FE-4-OWN-03` — إزالة `commissionRate / 100` قبل الـ API call
- `FE-4-OWN-05` — إزالة `commissionRate * 100` من الـ pre-fill
- Labels في UI تعرض القيمة كما هي مع % علامة فقط: `20%` مش `(0.20 * 100)%`

---

## 🔴 CRITICAL #3 — CRM Lead Field Names (يأثر على Wave 3)

### الخطأ:
الـ tickets كتبت `leadId`, `unitId`, `numberOfGuests`, `checkInDate`, `checkOutDate`.

### الصح من API:
```typescript
// CRM Lead Response (GET /api/internal/crm/leads):
{
  id:                  "uuid",       // ❌ كنا بنكتب "leadId"
  clientId:            "uuid | null",
  targetUnitId:        "uuid | null",// ❌ كنا بنكتب "unitId"
  assignedAdminUserId: "uuid | null",// ❌ كنا بنكتب "assignedToName"
  contactName:         "string",     // ✅
  contactPhone:        "string",     // ✅
  contactEmail:        "string | null", // ✅
  desiredCheckInDate:  "2026-06-01", // ❌ كنا بنكتب "checkInDate"
  desiredCheckOutDate: "2026-06-05", // ❌ كنا بنكتب "checkOutDate"
  guestCount:          2,            // ❌ كنا بنكتب "numberOfGuests"
  leadStatus:          "Prospecting",// ✅ (PascalCase صح)
  source:              "Website",    // ✅
}
```

### التعديل المطلوب:
- `lib/types/crm.types.ts` — تغيير كل الـ field names
- `FE-3-CRM-01` — تصحيح types
- `FE-3-CRM-02` — Pipeline board: `lead.id` مش `lead.leadId`
- `FE-3-CRM-03` — LeadCard: `lead.id` للـ navigation
- `FE-3-CRM-04` — Lead Detail page

---

## 🔴 CRITICAL #4 — CRM Status Transition Request Body (يأثر على Wave 3)

### الخطأ:
الـ tickets كتبت `{ newStatus: "Relevant" }`.

### الصح من API:
```json
// PATCH /api/internal/crm/leads/{id}/status:
{ "leadStatus": "Relevant" }    // ❌ كنا بنكتب "newStatus"
```

### التعديل المطلوب:
- `FE-3-CRM-05` — تغيير request body field من `newStatus` إلى `leadStatus`
- `crmService.updateLeadStatus()` — تصحيح الـ request shape

---

## 🔴 CRITICAL #5 — Convert Lead to Booking: Different Request (يأثر على Wave 3)

### الخطأ:
الـ tickets كتبت `{ depositAmount, notes }`.

### الصح من API:
```json
// POST /api/internal/crm/leads/{id}/convert-to-booking:
{
  "clientId":       "uuid",         // required
  "unitId":         "uuid",         // required — confirmed unit
  "checkInDate":    "2026-06-01",
  "checkOutDate":   "2026-06-05",
  "guestCount":     2,
  "internalNotes":  "string"        // optional
}
```

**ملاحظة مهمة:** `depositAmount` مش جزء من الـ convert request. الـ payment يتسجل بعدين منفصلاً.

### التعديل المطلوب:
- `FE-3-CRM-09` — تعديل form ليطلب `clientId`, `unitId`, `checkInDate`, `checkOutDate`, `guestCount`
- حذف `depositAmount` من الـ convert form
- `ConvertToBookingRequest` type — تعديل كامل

---

## 🔴 CRITICAL #6 — Availability & Pricing: Wrong Date Fields (يأثر على Wave 2, 7)

### الخطأ:
الـ tickets كتبت `{ checkInDate, checkOutDate }`.

### الصح من API:
```json
// POST /api/units/{unitId}/availability/operational-check:
{ "startDate": "2026-06-01", "endDate": "2026-06-05" }    // ❌ مش checkInDate/checkOutDate

// POST /api/units/{unitId}/pricing/calculate:
{ "startDate": "2026-06-01", "endDate": "2026-06-05" }    // ❌ نفس المشكلة
```

**Availability Response:**
```json
{
  "unitId": "uuid",
  "startDate": "2026-06-01",
  "endDate": "2026-06-05",
  "isAvailable": false,
  "reason": "string",
  "blockedDates": ["2026-06-03"]    // ❌ كنا بنكتب conflictingBookings/blockedDates objects
}
```

**Pricing Response:**
```json
{
  "unitId": "uuid",
  "startDate": "2026-06-01",
  "endDate": "2026-06-05",
  "totalPrice": 2400.00,           // ❌ كنا بنكتب "totalAmount"
  "nights": [                      // ❌ كنا بنكتب "nightlyBreakdown"
    {
      "date": "2026-06-01",
      "pricePerNight": 600.00,
      "priceSource": "SeasonalPricing | BasePrice"
    }
  ]
}
```

### التعديل المطلوب:
- `FE-2-UNITS-10` — availability calendar request
- `FE-7-BOOK-01` — booking form date fields
- `FE-7-UNITS-02` — unit detail pricing panel
- Type definitions: `totalPrice` مش `totalAmount`, `nights` مش `nightlyBreakdown`

---

## 🔴 CRITICAL #7 — CRM Notes: Field Names (يأثر على Wave 3)

### الخطأ:
الـ tickets كتبت `{ content }` للـ request و `content` في الـ response.

### الصح من API:
```json
// POST /api/internal/crm/leads/{leadId}/notes:
{ "noteText": "string" }           // ❌ كنا بنكتب "content"

// Note response:
{
  "id": "uuid",
  "bookingId": "uuid | null",
  "crmLeadId": "uuid",             // ❌ كنا بنكتب "leadId"
  "createdByAdminUserId": "uuid",  // ❌ كنا بنكتب "createdByName"
  "noteText": "string",            // ❌ كنا بنكتب "content"
  "createdAt": "...",
  "updatedAt": "..."
}
```

### التعديل المطلوب:
- `FE-3-CRM-06` — notes form وdisplay
- `lib/types/crm.types.ts` — CrmNoteResponse fields

---

## 🔴 CRITICAL #8 — Payments: No Type Field + Different Shape (يأثر على Wave 3, 4)

### الخطأ:
الـ tickets كتبت إن الـ payment عنده `type: 'Deposit' | 'Remaining' | 'Refund'` وإن الـ create request يتضمن `type`, `paymentDate`, `proofImageUrl`.

### الصح من API:
```json
// POST /api/internal/payments (create):
{
  "bookingId":       "uuid",        // required
  "invoiceId":       "uuid",        // optional
  "paymentMethod":   "string",      // required: InstaPay|VodafoneCash|Cash|BankTransfer
  "amount":          500.00,        // required
  "referenceNumber": "string",      // optional ← مش proofImageUrl
  "notes":           "string"       // optional
}
// ❌ مفيش "type" field (Deposit/Remaining/Refund مش موجودين في payments API)
// ❌ مفيش "paymentDate"

// Payment response:
{
  "id":              "uuid",
  "bookingId":       "uuid",
  "invoiceId":       "uuid | null",
  "paymentStatus":   "Pending | Paid | Failed | Cancelled",
  "paymentMethod":   "InstaPay | ...",
  "amount":          500.00,
  "referenceNumber": "string | null",  // ❌ كنا بنكتب proofImageUrl
  "paidAt":          "...",            // ❌ كنا بنكتب paymentDate
}

// POST /api/internal/payments/{id}/mark-paid:
// NO REQUEST BODY — ❌ كنا بنكتب { paymentDate, notes }

// POST /api/internal/payments/{id}/mark-failed:
{ "notes": "string" }    // optional only, ❌ كنا بنكتب { reason, notes }

// POST /api/internal/payments/{id}/cancel:
{ "notes": "string" }    // optional
```

### التعديل المطلوب:
- `lib/types/booking.types.ts` — PaymentResponse fields
- `FE-3-BOOK-05` — Record Payment form: حذف type field، تغيير proofImageUrl → referenceNumber
- `FE-4-FIN-04` — Payments list

---

## 🔴 CRITICAL #9 — Owner Payouts: Completely Different Shape (يأثر على Wave 4)

### الخطأ:
الـ tickets كتبت `{ ownerId, amount, paymentMethod, paymentDate, ... }` للـ create request.

### الصح من API:
```json
// POST /api/internal/owner-payouts (create):
{
  "bookingId":      "uuid",         // required ← مش ownerId!
  "commissionRate": 20.00,          // required — override rate
  "notes":          "string"        // optional
}
// الـ API بيحسب الـ amount تلقائياً من الـ commissionRate

// Payout response:
{
  "id":                 "uuid",
  "bookingId":          "uuid",
  "ownerId":            "uuid",
  "payoutStatus":       "Pending | Scheduled | Paid | Cancelled",
  "grossBookingAmount": 2400.00,
  "commissionRate":     20.00,
  "commissionAmount":   480.00,
  "payoutAmount":       1920.00,    // ← الـ amount اللي الـ owner بياخده
  "scheduledAt":        "... | null",
  "paidAt":             "... | null",
  "notes":              "string | null"
}

// POST /api/internal/owner-payouts/{id}/schedule:
{ "notes": "string" }              // optional only

// POST /api/internal/owner-payouts/{id}/mark-paid:
{ "notes": "string" }              // optional only — ❌ مفيش paymentMethod required

// POST /api/internal/owner-payouts/{id}/cancel:
{ "notes": "string" }              // optional
```

### التعديل المطلوب:
- `FE-4-FIN-01` — كل الـ payout types
- `FE-4-FIN-03` — Payout management: form يطلب `bookingId` مش `ownerId + amount`
- `FE-4-OWN-06` — Owner Payouts Tab

---

## 🔴 CRITICAL #10 — Payout Summary: Wrong Field Names (يأثر على Wave 4)

### الخطأ:
الـ tickets كتبت `{ totalEarnings, totalPaidOut, pendingAmount }`.

### الصح من API:
```json
// GET /api/internal/owners/{ownerId}/payout-summary:
{
  "ownerId":         "uuid",
  "totalPending":    5000.00,    // ❌ كنا بنكتب "pendingAmount"
  "totalScheduled":  2000.00,   // ❌ كنا بنكتب مش موجود
  "totalPaid":       12000.00   // ❌ كنا بنكتب "totalPaidOut"
}
// ❌ مفيش "totalEarnings"
```

---

## 🔴 CRITICAL #11 — Finance Snapshot: Wrong Field Names (يأثر على Wave 3)

### الخطأ:
الـ tickets كتبت `{ outstandingAmount, platformCommission, ownerEarnings, payments[] }`.

### الصح من API:
```json
// GET /api/internal/bookings/{bookingId}/finance-snapshot:
{
  "bookingId":           "uuid",
  "invoiceId":           "uuid | null",
  "invoiceStatus":       "Draft | Issued | Cancelled | null",
  "invoicedAmount":      2400.00,     // ❌ كنا مش بنكتبه
  "paidAmount":          500.00,      // ❌ كنا بنكتب "totalPaid"
  "remainingAmount":     1900.00,     // ✅ موجود لكن بـ context مختلف
  "ownerPayoutStatus":   "Pending | ..."  // ❌ مش موجود في tickets
}
// ❌ مفيش "outstandingAmount", "platformCommission", "ownerEarnings", "payments[]"
```

---

## 🔴 CRITICAL #12 — Invoice Balance: Wrong Field Names (يأثر على Wave 3)

### الخطأ:
الـ tickets كتبت `{ totalPaid, outstandingAmount, isFullyPaid }`.

### الصح من API:
```json
// GET /api/internal/invoices/{invoiceId}/balance:
{
  "invoiceId":       "uuid",
  "totalAmount":     2400.00,
  "paidAmount":      500.00,     // ❌ كنا بنكتب "totalPaid"
  "remainingAmount": 1900.00,   // ❌ كنا بنكتب "outstandingAmount"
  "isFullyPaid":     false       // ✅ صح
}
```

---

## 🔴 CRITICAL #13 — Notification Dispatch: Template-based NOT text (يأثر على Wave 5)

### الخطأ:
الـ tickets كتبت `{ title, body, channel }`.

### الصح من API:
```json
// POST /api/internal/notifications/admins/{adminUserId}:
{
  "templateCode": "string",     // required ← مش title/body
  "channel":      "Email | InApp",
  "variables": { "key": "value" },  // optional — template substitutions
  "scheduledAt":  "2026-04-26T10:00:00Z"  // optional
}
```

الـ notification system يعمل بـ templates، مش free-text. الـ admin يختار template ويملأ الـ variables.

### التعديل المطلوب:
- `FE-5-NOT-05` — Dispatch form: يطلب `templateCode` + `variables` مش `title`+`body`
- `FE-5-NOT-01` — Notification dispatch types

---

## 🔴 CRITICAL #14 — Notification Preferences: Field Name (يأثر على Wave 5, 6)

### الخطأ:
الـ tickets كتبت `{ channel, type, isEnabled }`.

### الصح من API:
```json
// PUT /{prefix}/notification-preferences:
{
  "channel":       "Email",
  "preferenceKey": "BookingConfirmed",  // ❌ كنا بنكتب "type"
  "isEnabled":     false
}
```

### التعديل المطلوب:
- `FE-5-NOT-04` و `FE-6-OWN-08` — `type` → `preferenceKey`

---

## 🔴 CRITICAL #15 — Unit Images: fileKey NOT imageUrl (يأثر على Wave 2, 6)

### الخطأ:
الـ tickets كتبت `imageUrl` للـ image field.

### الصح من API:
```json
// Unit Image response:
{
  "id":           "uuid",
  "unitId":       "uuid",
  "fileKey":      "string",   // ← الـ cloud storage key (مش URL كامل)
  "isCover":      true,
  "displayOrder": 0
}

// POST /api/internal/units/{unitId}/images:
{
  "fileKey":      "string",   // ← مش "imageUrl"
  "isCover":      false,
  "displayOrder": 0
}

// PUT /api/internal/units/{unitId}/images/reorder:
{
  "items": [
    { "imageId": "uuid", "displayOrder": 1 }  // ← "imageId" مش "id"
  ]
}
// ❌ كنا بنكتب { "images": [{ "id": ..., "displayOrder": ... }] }
```

**ملاحظة:** الـ frontend لازم يبني الـ full URL من الـ `fileKey` (مثلاً `https://cdn.example.com/{fileKey}`). لازم يتاخد من الـ backend team الـ base URL.

---

## 🟠 HIGH #16 — Booking Cancel: Notes Only (No Required Reason) (يأثر على Wave 3)

### الخطأ:
الـ tickets قالت إن Cancel يتطلب `reason` field مطلوب.

### الصح من API:
```json
// POST /api/internal/bookings/{id}/cancel:
{ "notes": "string" }    // optional only — ❌ مفيش "reason" required
```

---

## 🟠 HIGH #17 — Seasonal Pricing: No Label Field (يأثر على Wave 2)

### الخطأ:
الـ tickets كتبت `{ label, startDate, endDate, pricePerNight }`.

### الصح من API:
```json
// POST /api/internal/units/{unitId}/seasonal-pricing:
{
  "startDate":     "2026-06-01",
  "endDate":       "2026-08-31",
  "pricePerNight": 800.00
}
// ❌ مفيش "label" field في الـ API
```

---

## 🟠 HIGH #18 — Invoice Manual Adjustment: Different Shape (يأثر على Wave 3)

### الخطأ:
الـ tickets كتبت `{ description, amount, adjustmentType: 'addition'|'deduction' }`.

### الصح من API:
```json
// POST /api/internal/invoices/{id}/items/manual-adjustment:
{
  "description": "string",    // required
  "quantity":    1,           // required
  "unitAmount":  -200.00      // required — negative for discounts
}
// ❌ مفيش "amount" مباشرة ولا "adjustmentType"
```

---

## 🟠 HIGH #19 — Reporting Response Fields: All Wrong (يأثر على Wave 4, 5)

### Bookings Daily Response:
```json
// ❌ كنا بنكتب: { date, totalLeads, confirmedBookings, conversionRate }
// ✅ الصح:
{
  "metricDate":               "2026-04-26",
  "bookingSource":            "Website",
  "bookingsCreatedCount":     5,
  "pendingBookingsCount":     2,
  "confirmedBookingsCount":   2,
  "cancelledBookingsCount":   0,
  "completedBookingsCount":   1,
  "totalFinalAmount":         12000.00
}
```

### Bookings Summary Response:
```json
// ❌ كنا بنكتب: { totalRevenue, totalBookings, conversionRate }
// ✅ الصح:
{
  "dateFrom":                       "2026-04-01",
  "dateTo":                         "2026-04-30",
  "totalBookingsCreatedCount":      42,
  "totalPendingBookingsCount":      3,
  "totalConfirmedBookingsCount":    12,
  "totalCancelledBookingsCount":    2,
  "totalCompletedBookingsCount":    25,
  "totalFinalAmount":               201600.00
}
```

### Finance Daily Response:
```json
// ❌ كنا بنكتب: { date, totalRevenue, depositsCollected, remainingCollected }
// ✅ الصح:
{
  "metricDate":                  "2026-04-26",
  "bookingsWithInvoiceCount":    3,
  "totalInvoicedAmount":         7200.00,
  "totalPaidAmount":             3600.00,
  "totalRemainingAmount":        3600.00,
  "totalPendingPayoutAmount":    2880.00,
  "totalScheduledPayoutAmount":  0.00,
  "totalPaidPayoutAmount":       0.00
}
```

### Finance Summary Response:
```json
// ❌ كنا بنكتب: { totalRevenue, platformEarnings, totalOwnerPayouts }
// ✅ الصح:
{
  "dateFrom":                        "2026-04-01",
  "dateTo":                          "2026-04-30",
  "totalBookingsWithInvoiceCount":   38,
  "totalInvoicedAmount":             91200.00,
  "totalPaidAmount":                 81600.00,
  "totalRemainingAmount":            9600.00,
  "totalPendingPayoutAmount":        20160.00,
  "totalScheduledPayoutAmount":      0.00,
  "totalPaidPayoutAmount":           45120.00
}
```

---

## 🟠 HIGH #20 — Public Review Summary: Wrong Fields (يأثر على Wave 7)

### الخطأ:
الـ tickets كتبت `{ totalReviews, averageRating, ratingBreakdown }`.

### الصح من API:
```json
// GET /api/public/units/{unitId}/reviews/summary:
{
  "unitId":                    "uuid",
  "publishedReviewCount":      24,    // ❌ كنا بنكتب "totalReviews"
  "averageRating":             4.7,   // ✅ صح
  "lastReviewPublishedAt":     "..."  // ❌ مش في tickets
}
// ❌ مفيش "ratingBreakdown"
```

---

## 🟠 HIGH #21 — Owner Portal Dashboard: Wrong Fields (يأثر على Wave 6)

### الخطأ:
الـ tickets كتبت `{ totalBookings, confirmedBookings, paidOut, pendingPayout }`.

### الصح من API:
```json
// GET /api/owner/dashboard:
{
  "ownerId":                    "uuid",
  "totalUnits":                 3,
  "activeUnits":                3,
  "totalBookings":              45,            // ✅
  "confirmedBookings":          5,             // ✅
  "completedBookings":          38,            // ❌ مش في tickets
  "totalPaidAmount":            86400.00,      // ❌ كنا بنكتب "paidOut"
  "totalPendingPayoutAmount":   7200.00,       // ❌ كنا بنكتب "pendingPayout"
  "totalPaidPayoutAmount":      69120.00       // ❌ مش في tickets
}
```

---

## 🟠 HIGH #22 — Owner Portal Finance Summary: Wrong Fields (يأثر على Wave 6)

### الصح من API:
```json
// GET /api/owner/finance/summary:
{
  "ownerId":                      "uuid",
  "totalInvoicedAmount":          96000.00,
  "totalPaidAmount":              86400.00,
  "totalRemainingAmount":         9600.00,
  "totalPendingPayoutAmount":     7200.00,
  "totalScheduledPayoutAmount":   0.00,
  "totalPaidPayoutAmount":        69120.00
}
// ❌ كل الـ field names في tickets كانت مختلفة
```

---

## 🟠 HIGH #23 — Owner Portal Bookings: clientId فقط (No Anonymized Name) (يأثر على Wave 6)

### الخطأ:
الـ tickets افترضت إن الـ API بيرجع `clientDisplayName` anonymized.

### الصح من API:
```json
// GET /api/owner/bookings response:
{
  "bookingId":             "uuid",      // ✅
  "unitId":                "uuid",
  "clientId":              "uuid",      // ← clientId فقط، مفيش اسم
  "assignedAdminUserId":   "uuid | null",
  "bookingStatus":         "string",
  "checkInDate":           "2026-06-01",
  "checkOutDate":          "2026-06-05",
  "guestCount":            2,            // ❌ كنا بنكتب "numberOfGuests"
  "finalAmount":           2400.00,     // ❌ كنا بنكتب "totalAmount" + "ownerEarnings"
  "source":                "string"
}
// ❌ مفيش "ownerEarnings" في booking list
// ❌ مفيش "clientDisplayName"
```

الـ owner يشوف `clientId` بس — ومش هيقدر يشوف اسمه لأن مفيش endpoint يرجع client details للـ owner.

---

## 🟡 MEDIUM #24 — CRM Assignment Response: Wrong Fields (يأثر على Wave 3)

### الصح من API:
```json
// CRM Assignment response:
{
  "id":                    "uuid",
  "bookingId":             "uuid | null",
  "crmLeadId":             "uuid",         // ❌ كنا بنكتب "leadId"
  "assignedAdminUserId":   "uuid",         // ❌ كنا بنكتب "assignedToUserId"
  "isActive":              true,
  "assignedAt":            "..."           // ❌ كنا بنكتب "assignedAt" ✅ صح
}
```

---

## 🟡 MEDIUM #25 — Public Units: No Filter Parameters Documented (يأثر على Wave 7)

### الملاحظة:
`GET /api/units` في الـ API Reference يذكر فقط `page` و `pageSize` كـ query parameters. لا يوجد `projectId`, `type`, `minGuests`, `minPrice`, `maxPrice`, `sortBy` documented.

**السؤال:** هل الـ backend يدعم الـ filters دي؟ لازم يتأكد من الـ backend team قبل بناء الـ filter UI في Wave 7.

---

## 🟡 MEDIUM #26 — CRM Lead Filter Params: Wrong Names (يأثر على Wave 3)

### الصح من API:
```
GET /api/internal/crm/leads:
?leadStatus=Prospecting        // ❌ كنا بنكتب "status"
?assignedAdminUserId={uuid}    // ❌ كنا بنكتب "assignedTo"
```

---

## 🟡 MEDIUM #27 — Booking List Filter Params: Wrong Names (يأثر على Wave 3)

### الصح من API:
```
GET /api/internal/bookings:
?bookingStatus=Confirmed       // ❌ كنا بنكتب "status"
?assignedAdminUserId={uuid}    // ❌ كنا بنكتب "assignedTo"
```

---

## 🟡 MEDIUM #28 — Public Review: clientName مش موجود (يأثر على Wave 7)

### الصح من API:
```json
// GET /api/public/units/{unitId}/reviews:
{
  "reviewId":            "uuid",
  "unitId":              "uuid",
  "rating":              5,
  "title":               "string",
  "comment":             "string | null",
  "publishedAt":         "...",
  "ownerReplyText":      "string | null",
  "ownerReplyUpdatedAt": "..."
}
// ❌ مفيش "clientName" في الـ public reviews response
// الـ client اسمه مش موجود في الـ public reviews endpoint (privacy)
```

---

## ✅ ما هو صح 100% في الـ Tickets

| الجانب | الحكم |
|--------|-------|
| Auth shapes: accessToken, expiresInSeconds, userId, identifier, subjectType | ✅ صح |
| Admin roles: 'SuperAdmin'\|'Sales'\|'Finance'\|'Tech' | ✅ صح |
| Booking statuses: 'Pending'\|'Confirmed'\|'CheckIn'\|'Completed'\|'Cancelled'\|'LeftEarly' | ✅ صح |
| CRM lead statuses: 10 values PascalCase | ✅ صح |
| Payment statuses: 'Pending'\|'Paid'\|'Failed'\|'Cancelled' | ✅ صح |
| Payment methods: 'InstaPay'\|'VodafoneCash'\|'Cash'\|'BankTransfer' | ✅ صح |
| Date block reasons: 'Maintenance'\|'OwnerUse'\|'Other' | ✅ صح |
| Payout statuses: 'Pending'\|'Scheduled'\|'Paid'\|'Cancelled' | ✅ صح |
| Review statuses: 'Pending'\|'Published'\|'Rejected'\|'Hidden' | ✅ صح |
| Invoice statuses: 'Draft'\|'Issued'\|'Cancelled' | ✅ صح |
| Notification channels: 'Email'\|'SMS'\|'InApp' | ✅ صح |
| Pagination: totalCount + totalPages | ✅ صح |
| Client login: phone not email | ✅ صح |
| Admin login: email not phone | ✅ صح |
| Review: title field required | ✅ صح |
| Owner portal: /api/owner/* endpoints | ✅ صح |
| CRM lead status transition PascalCase | ✅ صح |
| VALID_TRANSITIONS values | ✅ صح |
| Booking lifecycle: /confirm, /cancel, /complete | ✅ صح |
| Invoice lifecycle: /drafts, /issue, /cancel | ✅ صح |
| Notification inbox: notificationId, subject, body | ✅ صح |

---

## 📋 Prioritized Action Plan

### Wave Corrections Prompt (للـ LLM)

يجب إنشاء **Fix Prompt** لكل Wave يصحح الـ types والـ service files:

| # | الملف المتأثر | الـ Corrections |
|---|---|---|
| 1 | `lib/types/unit.types.ts` | unitType, maxGuests, isActive, bedrooms, bathrooms |
| 2 | `lib/types/crm.types.ts` | id (not leadId), targetUnitId, guestCount, desiredCheckInDate/Out |
| 3 | `lib/types/booking.types.ts` | PaymentResponse fields, no payment type field |
| 4 | `lib/types/finance.types.ts` | Payout shapes, availability/pricing date fields |
| 5 | `lib/types/report.types.ts` | All reporting field names |
| 6 | `lib/types/owner-portal.types.ts` | Dashboard, bookings, finance fields |
| 7 | `lib/types/public.types.ts` | Availability/pricing date fields |
| 8 | `lib/api/services/units.service.ts` | isActive toggle, reorder items format, fileKey |
| 9 | `lib/api/services/crm.service.ts` | leadStatus (not newStatus), convert request shape |
| 10 | `lib/api/services/bookings.service.ts` | Payment create shape, cancel no-reason |
| 11 | `lib/api/services/payouts.service.ts` | Payout create shape (bookingId, commissionRate) |

---

*هذا التقرير مبني على قراءة كاملة لـ KAZA_BOOKING_API_Reference.md*
*كل تصحيح مصحوب بالـ JSON الفعلي من الـ API Reference*