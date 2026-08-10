# HB-07 — Notifications, Automations and Integrations

> Navigation: [README](README.md) · [Master](00_MASTER_PLAN.md) · [Scenarios](99_RELIABILITY_TEST_SCENARIOS.md)

## 1. Ticket metadata

| Field | Value |
|---|---|
| Ticket | HB-07 |
| Status | **IMPLEMENTED ON FEATURE BRANCH — DRAFT REVIEW REQUIRED** |
| Depends on | HB-02 historical identity and HB-04B payment evidence identity |
| Migration ownership | None |
| v1 notification policy | No automatic internal or external notification |

## 2. Binding v1 policy

Historical booking creation, historical payment recording, and owner-attribution correction send no
automatic guest, owner, administrator or finance notification. They create no reminder, delivery-log, outbox,
webhook, analytics event or scheduled job. The HB-06 wizard must warn the operator before submission.

Manual notification tools remain human-governed and are not changed by this ticket. Their existence is not an
automatic side effect and does not authorize this feature to call them.

## 3. Side-effect matrix

| Side effect | Historical booking | Historical payment | Owner correction | Enforcement |
|---|---|---|---|---|
| Guest confirmation/status notification | Suppressed | Not applicable | Not applicable | Historical commands do not call lifecycle notification paths |
| Owner notification | Suppressed | Suppressed | Suppressed | No automatic invocation |
| Payment reminder | Suppressed | Suppressed | Not applicable | No reminder scheduling |
| Check-in/check-out reminders | Suppressed | Not applicable | Not applicable | Completed state and explicit exclusion |
| Automatic completion | Not applicable | Not applicable | Not applicable | Historical booking starts Completed |
| Availability update | Allowed as persisted occupancy | Not applicable | Not applicable | Booking write only |
| Invoice auto-create/issue | Suppressed | Not applicable | Not applicable | Manual invoice remains separately allowed |
| Payout creation/correction | Suppressed | Suppressed | Suppressed | Separate accounting commands only |
| Analytics emission | Suppressed in v1 | Suppressed | Suppressed | No browser/runtime analytics added |
| Webhook/third-party integration | Suppressed | Suppressed | Suppressed | No call site |
| Booking/payment/correction audit | Required | Required | Required | Durable domain records, not notifications |

Historical payment evidence is standalone external-payment evidence. It remains `invoice_id = NULL`, is never
attached during invoice issue/reissue/orphan linking, and is not an invoice-linked notification trigger.

## 4. Future integration rule

Any future dispatcher, outbox, webhook, reminder, analytics or delivery implementation must exclude persisted
historical records by default. Inclusion requires an explicit, separately reviewed `historical-safe` contract
and focused tests. A request flag can never opt in.

Every PR that introduces or changes a side effect must review this matrix. The matrix is the canonical HB-07
integration checklist and should be linked from the PR template when that template is next changed; HB-07
does not modify CI or repository templates itself.

## 5. Integration audit

HB-07 performs one repository-wide positive audit of all known notification, automation and integration call
sites. It records each path as unreachable, explicitly excluded, or historical-safe. The audit must include
booking lifecycle notifications, `AutoCompleteBookingsJob`, invoice notifications, payment/live-collection
paths, owner notifications, delivery logs, hosted services, HTTP clients, webhooks, outbox/domain events and
browser analytics.

The audit is repeated only when a relevant integration changes; it is not a per-request database query.

## 6. Runtime verification

Do not add a post-commit query that counts notification rows for every command. The v1 proof is:

1. structural call-graph exclusion;
2. PostgreSQL tests asserting unchanged notification/delivery/outbox-related rows;
3. pilot reconciliation against durable booking/payment/history records;
4. bounded, PII-free structured logs only if HB-08 introduces them.

No metrics platform is assumed or introduced by HB-07.

## 7. Failure and transaction behavior

Because no automatic side effect is invoked, there is no notification failure to include in the domain
transaction. Domain command rollback remains owned by HB-02/HB-04B/HB-05. HB-07 must not add a post-commit
delivery whose failure could make a successful financial command appear failed.

## 8. Acceptance criteria

| ID | Criterion |
|---|---|
| AC-HB07-01 | Historical booking creation adds zero notification rows. |
| AC-HB07-02 | Historical payment recording adds zero notification rows. |
| AC-HB07-03 | Owner correction adds zero notification rows. |
| AC-HB07-04 | No outbound email, SMS, WhatsApp, webhook or HTTP delivery is invoked. |
| AC-HB07-05 | The wizard explicitly warns that no automatic notification is sent. |
| AC-HB07-06 | Historical booking remains outside automatic completion and reminder jobs. |
| AC-HB07-07 | No invoice is auto-created or issued by a historical command. |
| AC-HB07-08 | Manual invoice creation/issuance remains available under existing policy. |
| AC-HB07-09 | Historical payment remains standalone and invoice-unlinked. |
| AC-HB07-10 | The positive integration audit enumerates every current side-effect call site. |
| AC-HB07-11 | Future dispatchers exclude historical records by default. |
| AC-HB07-12 | Any future inclusion requires an explicit historical-safe contract and tests. |
| AC-HB07-13 | PostgreSQL tests prove notification, delivery and outbox row counts unchanged. |
| AC-HB07-14 | Pilot reconciliation checks durable records without a per-request post-commit query. |
| AC-HB07-15 | Normal nonhistorical notification and automation behavior remains unchanged. |

## 9. Negative acceptance criteria

| ID | Prohibited outcome |
|---|---|
| NAC-HB07-01 | No guest, owner, admin or finance automatic notification. |
| NAC-HB07-02 | No reminder or scheduled job created for a historical command. |
| NAC-HB07-03 | No lifecycle transition replay to obtain side effects. |
| NAC-HB07-04 | No invoice notification or payment link. |
| NAC-HB07-05 | No payout or accounting command invoked. |
| NAC-HB07-06 | No outbox, webhook, domain event or analytics event added. |
| NAC-HB07-07 | No request-controlled notification suppression or opt-in flag. |
| NAC-HB07-08 | No future dispatcher treats historical records as ordinary by default. |
| NAC-HB07-09 | No per-request post-commit notification-count query. |
| NAC-HB07-10 | No metrics platform or telemetry redesign. |
| NAC-HB07-11 | No mutation of manual notification tools. |
| NAC-HB07-12 | No historical payment attached to an invoice. |
| NAC-HB07-13 | No production polling or external integration test. |
| NAC-HB07-14 | No schema, migration, CI or runtime configuration change owned by HB-07. |

## 10. Testing and readiness

Fast tests prove structural exclusions and future-dispatch default behavior. PostgreSQL tests assert absence of
notification/delivery/outbox rows for booking, payment, replay, correction and failure paths while normal-flow
regressions remain green. HB-07 is **IMPLEMENTED ON FEATURE BRANCH** and remains subject to Draft PR review and
owner merge.

## 11. Implementation evidence

### 11.1 Repository census and enforcement

| Mechanism | Source | Historical eligibility | HB-07 enforcement/evidence |
|---|---|---|---|
| Booking lifecycle client notification | `RentalPlatform.Business/Services/BookingLifecycleService.cs` | Excluded | Central `HistoricalBookingAutomationPolicy` short-circuit; ordinary notification regression remains green |
| Confirmation-time automatic invoice | `RentalPlatform.Business/Services/BookingLifecycleService.cs` | Excluded | The same persisted-history policy gates automatic invoice creation; manual `InvoiceService` behavior is unchanged |
| Automatic completion and finance notification sweep | `RentalPlatform.API/Services/AutoCompleteBookingsJob.cs` | Excluded | Database selector applies the shared policy expression; a defensive notification guard remains at dispatch |
| Manual notification and delivery | `NotificationService`, `NotificationDispatchService`, notification controllers | Human-governed only | No historical command dependency or invocation; no manual tool was changed |
| Historical booking, payment and owner-correction commands | `HistoricalBookingService`, `HistoricalPaymentService`, `HistoricalOwnerAttributionService` | No automatic side effects | Constructor/call-graph tests reject notification, invoice and payout writer dependencies |
| Browser orchestration | `historical-bookings.service.ts`, `HistoricalBookingWizard.tsx` | Ratified command routes only | Browser request interception proves booking, owner-review and payment calls only |
| Outbox, message bus, webhook, email, SMS, Telegram and external-accounting clients | Repository-wide census | Not implemented | No writer, publisher, queue or external client exists to invoke |
| CRM persistence | CRM services/controllers | Explicit CRM operations only | PostgreSQL inventories prove historical commands add no CRM lead, note or assignment rows |

The canonical guard is `RentalPlatform.Business/Services/HistoricalBookingAutomationPolicy.cs`. It uses the
persisted `Booking.IsHistorical` identity both as an EF-translatable selector and as an in-memory defensive
check. It introduces no request-controlled bypass. Audit and authorized reporting reads remain unaffected.

The source tripwire `EveryAutomaticBookingSideEffectCallSiteUsesTheHistoricalPolicy` protects the currently
known lifecycle and automatic-completion call sites. It is not a complete architectural discovery mechanism:
a future automatic writer in a new service could omit the helper without matching that test. Extending the
central eligibility boundary to any future writer remains a non-blocking architectural follow-up requirement.

### 11.2 Verification evidence

- Release build: passed with zero errors.
- Fast tests: **110 passed, 0 failed, 0 skipped**.
- PostgreSQL 16.13 tests: **50 passed, 0 failed, 0 skipped** against an isolated disposable database.
- Full backend suite: **160 passed, 0 failed, 0 skipped**.
- HB-06 state/parser tests: **34 passed, 0 failed, 0 skipped**.
- Historical wizard browser suite: **54 passed** across desktop and mobile; the added request-surface test passed
  in both projects.
- Headed Chromium smoke: **7 desktop and 1 mobile passed** for booking, post-commit owner review, payment,
  unknown outcomes, conflicts and unauthorized entry. Network inspection found no notification, invoice,
  payout, correction, CRM, accounting, webhook or analytics write.
- The test-assurance follow-up reran the booking-list entry and complete booking/owner-review/payment smoke in
  headed Chromium on both desktop and mobile. Its inventory contained authentication refresh, the read-only
  inbox summary, unit/client reference reads and only the three ratified historical command/read routes.
- CRM regression: **15 passed**; booking-history regression: **2 passed**.
- Production portal build and API container image build: passed.
- Database inventories assert unchanged notification, delivery-log, invoice, invoice-item, payout and CRM row
  counts for historical command paths. The repository has no outbox or integration queue table.
- A real-service confirmation regression proves an ordinary `Booked` booking becomes `Confirmed` with one
  issued invoice and one booking-stay item, while an equivalent historical `Booked` fault-injection fixture
  creates no invoice or invoice item. The historical state is deliberate fault injection; the supported
  historical creation path writes `Completed` directly.
- The automatic-completion PostgreSQL regression now uses a positive ordinary outstanding balance, proves the
  ordinary admin notification is persisted once, proves the historical row is excluded by the generated SQL
  predicate, and exercises the defensive dispatch guard directly.
- Mutation sensitivity was demonstrated locally by temporarily neutralizing only the confirmation-invoice
  historical guard: the focused test failed because the historical fixture received an invoice. Restoring the
  guard returned the suite to green, and no production-source mutation remains in the branch diff.
- No production, staging, shared-development or existing local database was accessed, and no deployment ran.
