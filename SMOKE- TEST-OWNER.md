FE-QA-OWNER-SMOKE-02: Implementation of Comprehensive End-to-End Integrated Smoke Testing Suite and Automated Codebase/Database Sanitization for Owner Portal
=============================================================================================================================================================

Priority
========

Critical

Type
====

Integrated Test Engineering, Cross-Portal Sync Validation & Codebase Sanitization

Scope
=====

Full End-to-End (E2E) automated verification of the REMAL Owner Portal Web Application, covering all 5 functional modules (Dashboard Metrics, Owned Units View, Bookings Roster, Finance Breakdown, and Notification Inbox). Includes validation of data isolation boundaries, client PII privacy masks, real-time synchronization loops with the Admin Dashboard Portal, and a post-execution project-level cleanup routine to purge unused files, obsolete test modules, and database artifacts.

Objective
=========

Construct a robust, multi-tenant automated testing framework that executes individual and combined section workflows inside the Owner Portal, validates tight data alignment against the .NET API contracts, detects cross-portal architectural synchronization gaps, and completely sanitizes the project workspace by auto-purging redundant assets, obsolete code files, and transactional test logs upon a successful run.

Part I: Deep Analysis & Structural Mapping of Owner Portal Architecture
=======================================================================

The REMAL Owner Portal acts as a highly specialized, restricted projection of the underlying multi-tenant database layer. Unlike the Admin Portal, its design requires data isolation walls and strict data masking rules to ensure zero permission leakages between independent asset partners.

Plain textANTLR4BashCC#CSSCoffeeScriptCMakeDartDjangoDockerEJSErlangGitGoGraphQLGroovyHTMLJavaJavaScriptJSONJSXKotlinLaTeXLessLuaMakefileMarkdownMATLABMarkupObjective-CPerlPHPPowerShell.propertiesProtocol BuffersPythonRRubySass (Sass)Sass (Scss)SchemeSQLShellSwiftSVGTSXTypeScriptWebAssemblyYAMLXML                `+---------------------------------------+                  |         Owner Portal APIs             |                  +---------------------------------------+                                      |        +-----------------------------+-----------------------------+        |                             |                             |        v                             v                             v  +-----------------------+     +-----------------------+     +-----------------------+  |   Portfolio Metrics   |     |   Inventory Calendar  |     |   Financial Summary   |  |   - Portfolio Totals  |     |   - View-Only Slots   |     |   - Payout Invoices   |  |   - Multi-Tenant Isolation| |   - Dynamic Bookings  |     |   - Net Calculations  |  +-----------------------+     +-----------------------+     +-----------------------+        |                             |                             |        +-----------------------------+-----------------------------+                                      |                                      v                       +------------------------------+                       |   Polymorphic Inbox          |                       |   - Channel Routing          |                       |   - Preference Keys          |                       |   - UTC Temporal Drift Caps  |                       +------------------------------+`

### 1\. Module-by-Module Layout Mapping & API Contracts

*   **Dashboard Summary Metrics (GET /api/owner/dashboard):** Compiles portfolio aggregates: totalUnits, activeUnits, totalBookings, confirmedBookings, completedBookings, totalPaidAmount, totalPendingPayoutAmount, and totalPaidPayoutAmount\[cite: 4, 5\].
    
*   **Owned Units View (GET /api/owner/units):** Lists authorized rows belonging exclusively to the authenticated partner session\[cite: 2, 4, 5\]. Renders view-only attributes (unitId, areaId, unitName, unitType as lowercase string enums, isActive, bedrooms, bathrooms, maxGuests, basePricePerNight)\[cite: 1, 4, 5\]. Modifying units is barred from this channel.
    
*   **Bookings Roster (GET /api/owner/bookings):** Lists past or incoming stays matching the owner's unit IDs (bookingId, unitId, clientId, assignedAdminUserId, bookingStatus, checkInDate, checkOutDate, guestCount, finalAmount, source)\[cite: 1, 4, 5\]. Critically restricts visibility of raw user communication nodes (phone, email).
    
*   **Financial Summary Ledger (GET /api/owner/finance/summary):** Aggregates numeric values using absolute decimal precision (totalInvoicedAmount, totalPaidAmount, totalRemainingAmount, totalPendingPayoutAmount, totalScheduledPayoutAmount, totalPaidPayoutAmount)\[cite: 3, 4, 5\]. Triggers detailed splits per reservation via /api/owner/finance/bookings/{bookingId}\[cite: 4, 5\].
    
*   **Notification Inbox (GET /api/owner/me/notifications/inbox):** Operates an inbox collection model capturing real-time automated alerts (notificationId, channel, notificationStatus, subject, body, createdAt, sentAt, readAt)\[cite: 4, 5\].
    

Part II: Integrated Testing Matrix & Cross-Portal Workflows
===========================================================

This testing architecture is split into three execution phases: Section-by-Section Isolated Testing, Intra-Portal Component Testing, and Multi-Role Cross-Portal Admin Integration loops.

1\. Section-by-Section Isolated Automated Verifications
-------------------------------------------------------

### A. Authentication & Multitenancy Boundaries

*   **Test Step:** Authenticate browser contexts as two separate asset partners: Owner A and Owner B via /api/auth/owner/login.
    
*   **Data Isolation Assertion:** Intercept network layers using Owner A's context tokens. Attempt a programmatic GET request to fetch data for a unitId or bookingId known to belong exclusively to Owner B\[cite: 2, 11\]. Assert that the server safely aborts the operation returning a strict HTTP 403 Forbidden or 404 Not Found response wrapper envelope.
    

### B. Dashboard Metrics Module

*   **Test Step:** Navigate to the main summary board.
    
*   **Contract Verification:** Assert that summary counters map values directly from the data wrapper envelope property matching the required camelCase fields (totalPendingPayoutAmount, totalPaidPayoutAmount)\[cite: 1, 4, 5\]. Validate that empty data profiles default safely to 0 or 0.0 elements without triggering rendering component exceptions.
    

### C. Owned Units View Module

*   **Test Step:** Open the portfolio data grid.
    
*   **Constraint Review:** Confirm that the UI handles parameters strictly using lowercase text markers for unitType: 'villa' | 'chalet' | 'studio'. Verify that no editing forms, action items, or delete triggers are rendered or accessible anywhere in the workspace layout.
    

### D. Bookings Roster Module

*   **Test Step:** Query the incoming reservation lists grid.
    
*   **PII Privacy Protection Scan:** Scan the page DOM and underlying intercepted network packets natively. Enforce a strict regex check verifying that client phone strings or @ email notation identifiers are completely stripped from the context layout to eliminate personal data leakages.
    

### E. Financial Summary Ledger Module

*   **Test Step:** Launch the accounting balance board view.
    
*   **Precision Audit Assertion:** Confirm that values for totalRemainingAmount and totalPaidPayoutAmount render using two-place decimal notation formats matching database DECIMAL(12,2) parameters\[cite: 3, 4, 5\]. Ensure no conversion metrics divide or scale calculations unnecessarily.
    

### F. Notification Inbox Module

*   **Test Step:** Click the system alert notification icon component\[cite: 4, 8\].
    
*   **Timezone Offset Guard:** Inject a check-in alert entry with an explicit trailing UTC Z timestamp format string. Assert that relative time layout calculations render descriptions like "Just now" dynamically inside the view browser context, avoiding unhandled 3-hour time offsets.
    
*   **Interpolation Token Scan:** Scan text content fields dynamically. Assert that variable substitution algorithms successfully clean text blocks, replacing fields like {unitName} with actual text labels.
    
*   **Modal View Expansion Check:** Click the card container element. Confirm that a Dialog modal panel populates dynamically, safely loading the complete unwrapped message text body without stripping line heights or layout text balances\[cite: 4, 8, 11\].
    

2\. Combined Intra-Portal Functional Testing
--------------------------------------------

*   **Test Step:** Simulate an integrated workflow purely inside the Owner Portal view.
    
*   **Workflow Loop:** Filter the Bookings Roster by a dynamic datetime selector window\[cite: 4, 5\]. Select a reservation item, cross-reference its identifier code (bookingId), and navigate directly to the specific Financial breakdown view /api/owner/finance/bookings/{bookingId}\[cite: 4, 5\]. Assert that data metrics, associated pricing blocks, and net commissions align perfectly across screens without triggering layout breaks, loading hangs, or state mismatches.
    

3\. Multi-Portal Cross-Role Synchronization Test Loop
-----------------------------------------------------

Plain textANTLR4BashCC#CSSCoffeeScriptCMakeDartDjangoDockerEJSErlangGitGoGraphQLGroovyHTMLJavaJavaScriptJSONJSXKotlinLaTeXLessLuaMakefileMarkdownMATLABMarkupObjective-CPerlPHPPowerShell.propertiesProtocol BuffersPythonRRubySass (Sass)Sass (Scss)SchemeSQLShellSwiftSVGTSXTypeScriptWebAssemblyYAMLXML`   [Admin Dash Portal] -> Records Deposit & Confirms -> Triggers Invoice Snapshots                                                                 |                                                                 v  [Owner Portal App]  <- Recalculates Aggregates   <- Recalculates Portfolio Balances   `

*   **The Cross-Portal Admin-to-Owner Integration Loop:**
    
    *   **Phase 1 (Admin Trigger Action):** Authenticate a distinct context session as an Admin/Sales operator. Select a matching Pending reservation case inside the CRM board. Process an active deposit payment payload (POST /api/internal/payments) and click the "Confirm" trigger to advance status variables cleanly to Confirmed.
        
    *   **Phase 2 (Calculations Engine Processing):** The backend platform interceptor automatically creates an accounting record, deducting the owner's distinct percentage commissionRate (e.g., 20.00) directly from the booking's finalAmount.
        
    *   **Phase 3 (Owner Portal Propagation Validation):** Switch the automated browser testing agent context immediately to the authenticated Owner A session.
        
    *   **Phase 4 (Aggregate & Layout Verification):** Request the Owner Portal endpoints. Assert that:
        
        1.  The target unit's calendar interface removes the date window from free availability indices instantly\[cite: 2, 5\].
            
        2.  The Dashboard Overview metrics and Financial Summary ledger automatically recalculate data, incrementing totalInvoicedAmount and adding the precise net share into the totalPendingPayoutAmount balances using proper currency notation formatting rules without necessitating manual browser webpage reload cycles\[cite: 4, 5, 6\].
            

Part III: Project Codebase Sanitization & Automated Environment Teardown Framework
==================================================================================

To maintain a clean testing pipeline and prevent repository bloat, the testing framework must execute a comprehensive cleanup protocol immediately following the completion of the integration loop.

Plain textANTLR4BashCC#CSSCoffeeScriptCMakeDartDjangoDockerEJSErlangGitGoGraphQLGroovyHTMLJavaJavaScriptJSONJSXKotlinLaTeXLessLuaMakefileMarkdownMATLABMarkupObjective-CPerlPHPPowerShell.propertiesProtocol BuffersPythonRRubySass (Sass)Sass (Scss)SchemeSQLShellSwiftSVGTSXTypeScriptWebAssemblyYAMLXML                  `+---------------------------------------+                    |         E2E Test Runner Finished      |                    +---------------------------------------+                                        |         +------------------------------+------------------------------+         | (Success or Failure)                                        |         v                                                             v  +---------------------------------------+     +---------------------------------------+  |      Database Teardown Cascade        |     |      Project Workspace Cleaner        |  |  - Drop generated test bookings rows  |     |  - Purge orphaned/unused temp images |  |  - Revert calendar status locks       |     |  - Delete temporary test bundle outputs|  |  - Sanitize financial transactional logs|   |  - Remove unreferenced spec files     |  +---------------------------------------+     +---------------------------------------+`

### 1\. Automated Project Workspace Cleanup Rules (Code-Level)

*   **Unused/Orphaned Assets Purge:** Scan media directory routes programmatically. Compare active database image keys (fileKey) against local testing directories. Completely delete any orphaned image placeholders, temporary file upload bundles, or duplicate test image file entities left over from media reordering verification checks\[cite: 1, 11\].
    
*   **Obsolete Test Files Removal:** Programmatically isolate, un-link, and delete duplicate test profile copies, temporary test configurations (\*.tmp.spec.ts), or redundant test bundle files generated during the multi-tenant context simulations.
    
*   **Strict Whitelisting Guardrail:** Define a rigid lookup whitelist blocking the file sanitization runner from mutating or deleting core framework configurations, project source code, shared entities wrappers, or valid production application assets under any circumstances\[cite: 1, 9\].
    

### 2\. Database Layer Sanitization Sequence (Teardown Hooks)

*   **Cascade Delete Constraints Execution:** Implement an automated database script cascade within the testing afterAll framework context block:
    
    1.  Locates all dummy rows generated using specific verification identifiers (e.g., matching test name rules or dedicated test UUID bounds).
        
    2.  Permanently deletes simulated transactional records inside payments, invoices, and owner\_payouts to prevent memory leakage anomalies.
        
    3.  Reverts all operational date locks inside bookings and date\_blocks to safely release the tested calendar windows back to an available status tier.
        
*   **Aggregates Restorations Verification:** Verify that deleting test records forces the underlying service repositories to cleanly recalculate portfolio data states back to pre-test values.
    

Part IV: Critical Constraints & Operational Safety Gates
========================================================

### 1\. Key Edge Cases to Shield

*   **The Fragmented Teardown State:** If a test assertion fails mid-process, the cleanup orchestrator hooks must _still_ trigger successfully via a global execution block (finally or afterAll), preventing orphaned test data entries from polluting testing databases or leaking into CRM view frameworks.
    
*   **The Variable Percentage Precision Break:** Owners are configured with custom percentages (e.g., 20.00). The testing logic must pass diverse numerical rates to verify that cross-portal financial data propagation remains structurally immune to floating-point rounding drifts or math truncation bugs\[cite: 3, 11\].
    

### 2\. Acceptance Criteria

*   \[ \] The automated testing runner runs all individual and cross-portal synchronization loops successfully across all 3 portals (Admin, Owner, Client)\[cite: 2, 5\].
    
*   \[ \] Personal customer contact credentials (phones and emails) remain 100% hidden and filtered away from all retrieved Owner Portal views or backend payloads.
    
*   \[ \] Admin portal state adjustments propagate to owner tracking counters within explicit time thresholds without requiring browser page refreshes.
    
*   \[ \] The project workspace cleanup programmatically deletes all temporary file inputs, unused testing media logs, and testing database entries successfully, leaving zero orphaned files behind.
    
*   \[ \] No server production files, valid database tables, or primary codebase repositories are modified or degraded during the file sanitization loop\[cite: 1, 9\].
    

### 3\. QA Checklist

*   **What must be verified:** Verify that triggering confirmation updates on the administrative workspace cascades correct numerical adjustments down to owner portfolio balances, while the sanitization suite cleanly erases all temporary workspace clutter afterward\[cite: 2, 6, 11\].
    
*   **What could fail:** The script cleanups loop could throw folder permission exception blocks or abort early if testing media files remain locked by active browser testing processes. Ensure explicit process detach statements run before asset unlinking.
    
*   **What must not break:** Real historical database properties records, live platform user sessions, and primary frontend component stylesheet codes must be kept completely secure.
    
*   **How to confirm success:** The headless pipeline terminal logs report a 100% test completion track score, runs the cleanup sequence, and confirms zero residual disk clutter or test artifacts are left in the directory trees.
    

### 4\. Production Safety Notes

*   **Strict Sandboxing Directives:** This integrated suite manipulates cross-role authentication sessions and financial ledger records. It is strictly forbidden from executing inside the live production ecosystem.
    
*   **Staging Verification Guard:** This full-scope integration suite and workspace file cleaner must compile and execute successfully on localized Staging environments before receiving authorization deployment clearance into main release streams