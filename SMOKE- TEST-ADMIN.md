Title
=====

FE-QA-ADMIN-SMOKE-01: Implementation of Comprehensive End-to-End Integrated Smoke Testing Suite for Admin Dashboard Portal

Priority
========

Critical

Type
====

Integrated Test Engineering / QA Architecture

Scope
=====

Full End-to-End (E2E) automated verification of the REMAL Admin Dashboard Portal, covering all 8 functional segments (Dashboard Overview, Areas, Units, CRM Pipeline, Owners Profiles, Clients Profiles, Finance Ledger, and System Settings), role authorization boundaries, contract schema compliance, and cross-portal operational state sync loops.

Objective
=========

Design, construct, and execute an ironclad, hyper-detailed automated integrated smoke testing suite (using Playwright or Cypress) for the Admin Dashboard. The framework must evaluate every modular view independently, stress-test inter-module transitions, validate contract payloads against the rigid system specifications, log structural gaps, and simulate administrative operations across all 4 system roles without altering production data pools\[cite: 2, 9\].

Part I: Deep Analysis of the Admin Portal Component Architecture
================================================================

The REMAL Admin Dashboard handles critical cross-module dependencies where a state shift in one workflow instantly causes structural transformations across the system schema. Below is a deep component breakdown mapping the functional states, backend integrations, and operations under validation:

Plain textANTLR4BashCC#CSSCoffeeScriptCMakeDartDjangoDockerEJSErlangGitGoGraphQLGroovyHTMLJavaJavaScriptJSONJSXKotlinLaTeXLessLuaMakefileMarkdownMATLABMarkupObjective-CPerlPHPPowerShell.propertiesProtocol BuffersPythonRRubySass (Sass)Sass (Scss)SchemeSQLShellSwiftSVGTSXTypeScriptWebAssemblyYAMLXML                  `+---------------------------------------+                    |         Admin Auth Controller         |                    +---------------------------------------+                                        |         +------------------------------+------------------------------+         | (SuperAdmin)                 | (Sales)                      | (Finance)         v                              v                              v  +-----------------------+      +-----------------------+      +-----------------------+  |  Settings & Matrix    |      |  CRM Pipeline View    |      |  Finance Module       |  |  - System Config      |      |  - Lead Tracking      |      |  - Revenue Dashboard  |  |  - Role Management    |      |  - Stage Transitions  |      |  - Transaction Log    |  |  - Admin Registration |      |  - Booking Conversion |      |  - Owner Payout batch |  +-----------------------+      +-----------------------+      +-----------------------+         |                              |                              |         +------------------------------+------------------------------+                                        |                                        v                         +------------------------------+                         |  Units Inventory & Calendar  |                         |  - Base & Seasonal Pricing   |                         |  - Dynamic Date Blocks       |                         |  - Image Meta Sync           |                         +------------------------------+`

### 1\. Tab-by-Tab Functional Map & State Triggers

*   **Dashboard Overview:** Aggregates multi-module metrics (Occupancy Rate, Revenue metrics, Top Performing Areas/Owners)\[cite: 2, 12\]. Validates dynamic chart scaling based on datetime filter queries.
    
*   **Areas Management:** Controls regional structural scopes. Operations include Area creation, configuration edits, and toggle shifts (isActive: boolean) impacting down-stream unit discovery.
    
*   **Units Inventory:** Manages property data blocks. Tracks base parameters (unitType, maxGuests, bedrooms, bathrooms, basePricePerNight, isActive), image arrays (fileKey, isCover, displayOrder), seasonal modifications, and dynamic schedule closures (DateBlocks).
    
*   **CRM Pipeline:** Operates on an explicit 7-stage state machine (Prospecting, Relevant, NoAnswer, NotRelevant, Booked, Confirmed, CheckIn, Completed) and exit routes (Cancelled, Left Early). Triggers SoftHold parameters and switches to hard Booked status upon booking conversion.
    
*   **Owners Profiles:** Manages business parameters for asset partners. Binds dynamic commissionRate numbers as direct percentages (e.g., 20.00) and acts as the interface for manual Instapay/Vodafone Cash payout tracking log fields.
    
*   **Clients Profiles:** Tracks user activity vectors. Houses transaction logs, historic booking items, retention metrics, and automatic invoice associations.
    
*   **Finance Ledger:** The global monetary ledger. Processes Total Revenue aggregates, Collected Commissions, Paid to Owners pools, and Outstanding balances. Manages structural manual adjustments, adjustments tracking, and stowed refund balances.
    
*   **Settings & Access Config:** Implements role constraints (SuperAdmin, Sales, Finance, Tech). Maps precise UI view visibility rules to backend validation middleware gates.
    

Part II: Comprehensive E2E Integrated Test Plan Matrix
======================================================

This plan isolates test operations into three distinct horizons: Sectional Validation, Cross-Sectional Workflows, and Global Portal Integration loops.

1\. Section-by-Section Isolated Testing Specifications
------------------------------------------------------

### A. Dashboard Overview Section

*   **Test Case Details:** Load explicit metrics values via seed files. Confirm cards display Revenue sums, Occupancy counts, and Area indexes perfectly\[cite: 2, 12\].
    
*   **UI/UX Scan Assertion:** Ensure no values display as empty, blank code strings, or truncated metrics parameters.
    
*   **Interaction Verification:** Shift date filters from daily to monthly scopes\[cite: 2, 12\]. Assert that TanStack Query fetches fresh envelopes and charts re-render cleanly without component unmounting\[cite: 1, 8\].
    

### B. Areas Module Section

*   **Test Case Details:** Create a new region structure. Assert that the POST payload strictly matches unique alphanumeric constraints.
    
*   **State Mutation Audit:** Toggle the status property (isActive: false).
    
*   **Data Integrity Verification:** Perform a hard browser reload (F5). Assert that the state remains persistently disabled on the frontend view and matches backend truth.
    

### C. Units Module Section

*   **Test Case Details:** Create an asset record mapping all contract specifications: lowercase unitType: 'villa' | 'chalet' | 'studio', integer rules (bedrooms, bathrooms, maxGuests), and basePricePerNight using strict decimals.
    
*   **Media Meta Validation:** Add images. Verify that the frontend references the storage key parameters using fileKey, isCover, and displayOrder fields exclusively, with no legacy string placeholders.
    
*   **Dynamic Schedules Check:** Insert an active DateBlock schedule closure for maintenance reasons. Assert that the calendar component highlights the dates as un-reservable blocks instantly\[cite: 2, 8\].
    

### D. CRM Pipeline Section

*   **Test Case Details:** Load the Kanban layout interface. Group row data vectors strictly according to documented status variables: Prospecting, Relevant, NoAnswer, NotRelevant, Booked, Confirmed, CheckIn, Completed, Cancelled, LeftEarly.
    
*   **State Machine Assertions:** Move a card from Prospecting to Relevant. Check that the UI updates mutation triggers seamlessly. Attempt an illegal transition (e.g., bypassing confirmation to check-in directly). Assert that the backend rejects the payload via the envelope error block, and the frontend resets the card position gracefully with clear user warning alerts\[cite: 1, 4, 8\].
    

### E. Owners Section

*   **Test Case Details:** Query owner dashboard collections.
    
*   **Contract Specification Assertion:** Verify that individual list bindings capture commissionRate accurately as a full percentage property float (e.g., 20.00 representing 20.00%) with no frontend divisions or floating point truncations.
    
*   **Financial Ledger Check:** Manually log an owner payout batch record. Assert that the numeric deduction instantly scales outstanding balances correctly.
    

### F. Clients Section

*   **Test Case Details:** Select a client card view to load historical records.
    
*   **Aggregation Alignment:** Check total payment sums, total reservation count integers, and retention tags.
    
*   **Attachment Audit:** Verify that clicking generated invoice elements opens target documents cleanly from cloud buckets.
    

### G. Finance Module Section

*   **Test Case Details:** Audit the transactional log board. Ensure row properties map precision currencies (DECIMAL(12,2)) for baseAmount, finalAmount, and net shares.
    
*   **Manual Entry Validations:** Create manual invoice adjustments or refund logs. Verify that aggregates compute deductions across total commission earnings dynamically.
    

### H. Settings & Access Management Section

*   **Test Case Details:** Query system administrators registry rosters via GET /api/admin-users.
    
*   **Authorization Matrix Verification:** Test interface elements iteratively using all 4 role variables:
    
    *   Log in as Sales: Assert CRM pipeline write visibility; assert total UI removal or route exclusion locks for the Finance Ledger tab views\[cite: 2, 8\].
        
    *   Log in as Finance: Assert write access to payout inputs; assert total UI lockouts on CRM lead tracking actions.
        
    *   Log in as Tech: Assert full access to Area/Unit parameter setup forms; assert complete restriction from all financial records.
        
    *   Log in as SuperAdmin: Assert unfettered structural read/write execution across all system segments.
        

2\. Multi-Module Cross-Sectional Workflows
------------------------------------------

Plain textANTLR4BashCC#CSSCoffeeScriptCMakeDartDjangoDockerEJSErlangGitGoGraphQLGroovyHTMLJavaJavaScriptJSONJSXKotlinLaTeXLessLuaMakefileMarkdownMATLABMarkupObjective-CPerlPHPPowerShell.propertiesProtocol BuffersPythonRRubySass (Sass)Sass (Scss)SchemeSQLShellSwiftSVGTSXTypeScriptWebAssemblyYAMLXML`   [Sales Converts Lead] -> [Units Calendar: Soft Hold] -> [Deposit Injected] -> [Finance Ledger Updates]                                                                                     |                                                                                     v                                                                         [Invoice Generated (PDF)]   `

*   **The Core CRM-to-Finance Pipeline Loop:**
    
    *   **Phase 1 (CRM & Units Sync):** Convert an active Prospecting lead record into a formal booking case via /api/internal/crm/leads/{id}/convert-to-booking using parameter identifiers: targetUnitId, desiredCheckInDate, desiredCheckOutDate, and guestCount. Assert that the dynamic availability tracker immediately registers the selected calendar slot as an un-reservable Soft Hold across public and internal channels.
        
    *   **Phase 2 (Lifecycle & Finance Sync):** Post a dynamic payment payload via POST /api/internal/payments recording the initial deposit tracking parameters (paymentStatus, paymentMethod, amount, referenceNumber, paidAt). Progress status to Confirmed via /api/internal/bookings/{id}/confirm.
        
    *   **Phase 3 (Ledger & Document Sync):** Intercept the automated invoicing execution engine. Assert that the InvoiceNumber pattern compiles cleanly as INV-{YEAR}{MONTH}-, that line items resolve values matching finalAmount, and that the financial aggregates ledger recalculates Collected Revenue and Outstanding Owner Net shares securely using absolute DECIMAL(12,2) formatting standards.
        

3\. Global Integration Testing Protocols
----------------------------------------

*   **Multi-Tab Session Continuity Checks:** Open multiple active admin sections concurrently across browser context tabs. Trigger mutations on one tab (e.g., disabling a Unit) and assert that adjacent tabs handle the change without state corruption, stale memory overlays, or session context dropping.
    
*   **Network Interceptor Structural Sanity Check:** Force standard network failures (e.g., dropping database connectivity temporarily). Assert that the application's central Axios wrapper securely intercepts the raw network error, isolates the wrapper envelope properties, prevents partial model updates, and displays clear, scannable user warning messages without template crash breakages\[cite: 1, 4, 8, 11\].
    

Part III: API Validation & Historical Gaps/Errors Registry
==========================================================

The E2E smoke framework must integrate automated assertions specifically written to guard against historical contract gaps and failure patterns discovered during initial portal manual testing cycles.

**Error / Gap Identified known-bugs.mdBackend Root Cause Source known-bugs.mdAutomated Framework Assertion Fix Strategy**

**finalAmount Displaying as 0**

Property mapping mismatch or missing central unwrapping logic\[cite: 1, 11\].

Assert that finalAmount reads directly from the unwrapped envelope property response.data.data.finalAmount. Enforce strict validation that values evaluate above zero and follow correct decimal layouts.

**409 Conflict on Booking Confirmation**

Overlapping reservation timelines or illegal state machine jumps\[cite: 2, 3, 11\].

Intercept POST /api/internal/bookings/{id}/confirm under simulated overlap scenarios. Assert that the API securely fails the transition, wraps errors within the envelope, and the UI modal disables double-submission hooks\[cite: 1, 4, 8\].

**404 Not Found on Admin Notification Dispatch**

Controller path typos or raw un-wrapped model exceptions.

Enforce strict automation testing against POST /api/internal/notifications/admins/{adminUserId}\[cite: 4, 5\]. Validate that any missing identity inputs return standard bad request envelopes with clear messages instead of breaking the browser loop.

**Notification Template Variable Failures**

Incomplete string token replacements inside service layers.

Execute a DOM parameter text scan on the notification details container. Assert that no template parameter tags (e.g., {unitName}) bypass interpolation filters, and layout containers use elements to prevent RTL text distortion.

**Timezone Offset Drift Gap**

Server-side localized clock capture without explicit UTC kind attributes.

Verify that timestamps return with unambiguous trailing string indicators (Z). Assert that relative timeline text elements (e.g., "Just now") interpret bounds within current browser locales flawlessly.

**Client Name Fallback Errors**

Brittle space-splitting string operators dropping multi-word configurations.

Seed test accounts with explicit multi-part names (e.g., "Mona Ali"). Verify that cards render strings natively instead of loading the generic fallback text layout "عميل المنصة".

**Reviews Analytics Summary Stale Records**

Missing query cache invalidations across shifting boundary states\[cite: 1, 11\].

Intercept review approval triggers. Assert that the analytics summaries endpoint (GET /api/public/units/{unitId}/reviews/summary) updates metrics calculations completely upon next page revalidation hooks.

Part IV: Technical Specifications & Execution Paths
===================================================

### 1\. Required Investigation

*   Trace out all route constants matching the administrative schemas inside REMAL\_API\_Reference.md to ensure zero endpoint path mutations occurred during recent deployment cycles.
    
*   Audit the application's global state provider profiles (Zustand configuration targets) to map which client-side variables require isolation resets between individual test execution blocks.
    

### 2\. Required Implementation

*   Setup a dedicated configuration schema path (playwright.admin.config.ts) isolating the administration smoke suite operations from guest application tracks.
    
*   Write atomic baseline seed scripts (admin.seed.sql) containing controlled multi-role user credentials, fixed property layouts, and historical transaction datasets to ensure deterministic test execution states\[cite: 3, 9\].
    
*   Implement a structured programmatic reporter mechanism to output clean, visual test logs documenting exactly zero unresolved payload or data property mismatches.
    

### 3\. Edge Cases to Guard Against

*   **The Rapid Concurrency Click Double-Submit:** The automation suite must simulate fast double-clicking behaviors on transactional submit actions. Assert that the front-end components seamlessly toggle loading/disabled frameworks to drop duplicate request payloads.
    
*   **The Midnight Boundary Skew:** Pass check-in dates falling precisely at midnight parameters. Assert that local timezone processing adjustments do not accidentally push dates backward into matching previous calendar slots.
    

### 4\. Acceptance Criteria

*   \[ \] The automated administration suite successfully runs all sectional and cross-module test workflows without runtime crashes or timeouts.
    
*   \[ \] Multi-role permission checks correctly enforce system security rules, preventing unauthorized view penetrations programmatically\[cite: 2, 6\].
    
*   \[ \] Every assertion explicitly validates parameter labels (unitType, fileKey, isActive, targetUnitId) matching documented contract blueprints.
    
*   \[ \] Test executions maintain data integrity, creating zero orphaned database entries or duplicate records.
    

### 5\. QA Checklist

*   **What to verify:** Ensure that modifying data states inside the CRM pipelines immediately cascades all downstream ledger calculations, calendar blocks, and document generation snapshots accurately.
    
*   **What could fail:** Test workflows could hang if frontend systems fail to cleanly unwrap standard envelope responses containing multi-layered nested values arrays\[cite: 1, 4, 11\].
    
*   **What must not break:** Production data storage assets, active guest reservation records, and operational customer communication systems must be kept isolated.
    
*   **How to confirm success:** The test framework runs completely headless, confirms all system constraints pass cleanly, and prints zero contract or timezone discrepancies\[cite: 1, 6, 11\].
    

### 6\. Production Safety Notes

*   **Live System Isolation Requirement:** This integrated testing script writes and modifies heavy monetary ledgers and state variables; executing it directly inside the production instance will corrupt data tracking profiles.
    
*   **Staging Gate Verification Enforcements:** This suite must run exclusively within a completely sandboxed Staging cluster environment using dedicated dummy database configurations before deployment approval.
    
*   **Rollback Readiness:** Ensure automated system setup hooks can drop and re-instantiate mock testing structures instantly to ensure a dependable, pristine testing baseline prior to release reviews\[cite: 3, 10\].