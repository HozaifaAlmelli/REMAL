FE-QA-CLIENT-SMOKE-03: Implementation of Comprehensive End-to-End Integrated Smoke Testing Suite and Project Workspace Sanitization for Client Portal (Public Guest App)
========================================================================================================================================================================

Priority
--------

Critical

Type
----

Integrated Test Engineering, Cross-Portal Sync Validation & Workspace Sanitization

Scope
-----

Full End-to-End (E2E) automated verification of the Client Portal Web Application (Public Guest App), covering Homepage Discovery, Advanced Search & Filters, Unit Details Page, Seamless Booking/Signup Flow, Client Dashboard (my-bookings and my-reviews sections), dynamic Axios wrapper tracking, and automated environment/workspace teardown blocks\[cite: 1, 2, 4, 5\].

Objective
---------

Design, implement, and deploy a hyper-detailed, multi-portal automated E2E testing architecture using Playwright or Cypress. The suite must evaluate unauthenticated guest behaviors, validate the seamless registration state machine during checkout, assure programmatic API schema adherence, test simultaneous synchronization across Admin and Owner portal environments, and conclude with an ironclad project-level cleanup loop that auto-purges temporary test files, media log clutter, and generated testing database entities cleanly.

Part I: Deep Analysis of Client Portal Component Architecture
=============================================================

The Client Portal manages the entry funnel of the platform, processing unauthenticated contexts and transitioning them to authenticated JWT states through automated layout actions.

Plain textANTLR4BashCC#CSSCoffeeScriptCMakeDartDjangoDockerEJSErlangGitGoGraphQLGroovyHTMLJavaJavaScriptJSONJSXKotlinLaTeXLessLuaMakefileMarkdownMATLABMarkupObjective-CPerlPHPPowerShell.propertiesProtocol BuffersPythonRRubySass (Sass)Sass (Scss)SchemeSQLShellSwiftSVGTSXTypeScriptWebAssemblyYAMLXML                     `+---------------------------------------+                       |         Unauthenticated Guest         |                       +---------------------------------------+                                           |                                           v                        +---------------------------------------+                        |       Homepage Search & Discovery     |                        |   - Area Cards Filter & Guest Count   |                        |   - Instant Pricing Computation       |                        +---------------------------------------+                                           |                                           v                        +---------------------------------------+                        |         Seamless Booking Form         |                        |   - Auto-Signup (Name, Phone, Pass)   |                        |   - Instant JWT Cookie Hydration      |                        +---------------------------------------+                                           |                                           v                        +---------------------------------------+                        |      Authenticated Client Dashboard   |                        |   - My Bookings Ledger (finalAmount)  |                        |   - Write/Edit Review Form Modals     |                        +---------------------------------------+`

### 1\. Tab-by-Tab Layout Mapping & Specification Assertions

*   **Homepage & Search Grid:** Displays responsive Area cards, Featured units, and an operational search bar matching input parameters: Area, date windows, and guest limits. Enforces instant price calculation logic incorporating documented seasonal overrides (BasePrice vs SeasonalPricing schemas).
    
*   **Search Results View:** Integrates core frontend filtering models (unitType mapping via strict lowercase arrays like villa, chalet, studio) alongside amenities checkboxes, sorting items by Cheapest, Top Rated, and Most Booked.
    
*   **Unit Details Interface:** Renders continuous asset image galleries powered by fileKey paths, explicit capacity indicators (maxGuests, bedrooms, bathrooms), dynamic public review metrics summaries (averageRating, publishedReviewCount), and nested owner responses text boxes.
    
*   **Seamless Checkout Form:** Houses the primary registration pipeline block. Submitting an order seamlessly processes an automatic signup workflow utilizing form variables: contactName, contactPhone, and account password configurations.
    
*   **Dashboard Stays Ledger (my-bookings):** Lists past or current reservation metrics rows. Enforces strict display mappings to ensure the total column displays finalAmount precision values cleanly instead of defaulting to a broken 0 integer variable\[cite: 1, 4, 11\].
    
*   **Feedback History Section (my-reviews):** Manages user-generated content\[cite: 2, 5\]. Displays creation fields for active Completed rows and allows the editing of entries that preserve a state status of Pending exclusively\[cite: 2, 5\].
    

Part II: Comprehensive E2E Integrated Test Plan Matrix
======================================================

The framework breaks up testing routines into three strategic operational validation targets: Segment Isolation Checks, Combined Intra-Portal Journeys, and Cross-Portal Ecosystem Loops.

1\. Section-by-Section Isolated Automated Verifications
-------------------------------------------------------

### A. Search, Discovery & Filtering Flow

*   **Test Sequence:** Launch the homepage wrapper layout. Set the destination parameters to a known seeded region, provide check-in windows, and set a specific guest count. Click Search.
    
*   **Filter Assertions:** Apply filters matching unitType: 'chalet'. Assert that the rendered product grid instantly strips out villas or studios from view. Execute sorting by "Cheapest" and programmatically scan the card price nodes to verify strict ascending numeric currency sorting behaviors\[cite: 2, 4, 8\].
    

### B. Unit Details Analytics & Media Verification

*   **Test Sequence:** Direct the browser agent path to open a specific unit page via its route UUID parameter.
    
*   **Media & Meta Verification:** Assert that image elements possess functional src components utilizing the cloud-storage storage mapping key fileKey.
    
*   **Reviews Sync Assertion:** Verify that top rating highlights show accurate text parameters matching the server's summary tracking payload (publishedReviewCount and averageRating variables). Assert that any raw text values inside customer cards are bounded by HTML attributes to completely block BiDi language layout crowding glitches.
    

### C. Booking Flow & Seamless Sign-up Integration Loop

*   **Test Sequence:** Open an available property card window, click "Book Now", and populate the booking form fields. Input a dynamically compiled, unique mobile phone number tag (e.g., generating phone seeds per test execution loop) and supply an account password block. Submit the form.
    
*   **State Mutation Assertions:** Assert that the backend returns a successful response wrapped inside the standard system envelope. Confirm that a fresh client database entity is created, an authentication session token is securely stowed inside the browser HttpOnly cookie repository, and the workflow immediately redirects the active user context into their secure client dashboard panel.
    

### D. Dashboard Stays Ledger Verification (my-bookings)

*   **Test Sequence:** Load the my-bookings component route panel.
    
*   **Calculated Pricing Verification:** Assert that individual transaction entries calculate billing rows accurately. Verify that the "Total Amount" string component binds securely to finalAmount variables, displaying strict DECIMAL(12,2) precision formatting layouts instead of crashing or falling back to a dummy 0 placeholder\[cite: 1, 3, 4, 11\]. Confirm that values persist accurately after triggering a hard page refresh action (F5).
    

### E. Feedback Submission & History View Module (my-reviews)\[cite: 2, 5\]

*   **Test Sequence:** Isolate a past booking displaying an active lifecycle parameter state of Completed\[cite: 2, 5\]. Click the item card to launch the interactive evaluation modal form container.
    
*   **Form Submission Check:** Input an integer rating score (5), append an explicit string title text string, and write a text review comment\[cite: 3, 5\]. Click Submit.
    
*   **State Synchronization Audit:** Assert that the record transitions immediately out of the "Awaiting Review" folder array and populates the "My Feedback History" grid ledger displaying an active status badge reading Pending. Confirm that clicking "Edit Review" successfully updates fields while the moderation phase locks remain active.
    

2\. Multi-Portal Cross-Ecosystem Synchronization Test Loops
-----------------------------------------------------------

Plain textANTLR4BashCC#CSSCoffeeScriptCMakeDartDjangoDockerEJSErlangGitGoGraphQLGroovyHTMLJavaJavaScriptJSONJSXKotlinLaTeXLessLuaMakefileMarkdownMATLABMarkupObjective-CPerlPHPPowerShell.propertiesProtocol BuffersPythonRRubySass (Sass)Sass (Scss)SchemeSQLShellSwiftSVGTSXTypeScriptWebAssemblyYAMLXML`   [Client Portal App]  -> Seamlessly Books Unit     -> Shifts Lead Status to Prospecting                                                                 |                                                                 v  [Admin Dash Portal]  <- Updates Owner Portal Logs <- Admin Confirms & Records Deposit                                                                 |                                                                 v  [Client Portal App]  <- Reflects Confirmed State  <- Dynamic Remaining Balance Update   `

*   **The Cross-Portal Full Ecosystem Loop Verification:**
    
    *   **Phase 1 (Client Action Input):** As an unauthenticated public guest, execute the seamless signup checkout flow for a specified property asset across a distinct datetime window. Verify that the system automatically drops a case record matching leadStatus === 'Prospecting' directly onto the Admin CRM Board data indexes.
        
    *   **Phase 2 (Admin Processing Interception):** Authenticate a parallel browser context as an Admin/Sales operator. Query the CRM pipeline, locate the generated lead UUID, inject a manual deposit payment action payload via POST /api/internal/payments, and invoke the confirmation pipeline path /api/internal/bookings/{id}/confirm\[cite: 1, 4, 11\].
        
    *   **Phase 3 (Owner Portal Propagation Sync):** Open a third parallel session authenticated as the unit's respective property Owner asset partner. Query their private portfolio dashboard calendar framework. Assert that the targeted date selection window is programmatically locked out and flagged as un-reservable based on the confirmed status transaction rules\[cite: 2, 5\].
        
    *   **Phase 4 (Client Dashboard Real-Time Propagation):** Return the browser agent focus context back to the original client dashboard view page. Execute an async data revalidation hook. Assert that the client's booking listing item card component updates its state badge dynamically to display a confirmed tracking text, and recalculates remaining balance parameters (finalAmount - deposit\_amount) cleanly down to precise decimal balances without needing hard page reloads\[cite: 1, 2, 3, 4, 6, 11\].
        

Part III: Project-Level Workspace Sanitization & Automated Teardown Framework
=============================================================================

To guarantee continuous deployment stability and maintain pristine repository architecture parameters, a strict cleanup orchestrator tool must intercept the pipeline the moment the testing runner finishes execution operations.

Plain textANTLR4BashCC#CSSCoffeeScriptCMakeDartDjangoDockerEJSErlangGitGoGraphQLGroovyHTMLJavaJavaScriptJSONJSXKotlinLaTeXLessLuaMakefileMarkdownMATLABMarkupObjective-CPerlPHPPowerShell.propertiesProtocol BuffersPythonRRubySass (Sass)Sass (Scss)SchemeSQLShellSwiftSVGTSXTypeScriptWebAssemblyYAMLXML                 `+----------------------------------------+                   |    E2E Test Suites Run Concluded       |                   +----------------------------------------+                                        |         +------------------------------+------------------------------+         | (Success or Failure State Gate Execution)                   |         v                                                             v  +----------------------------------------+     +----------------------------------------+  |      Database Teardown Cascade         |     |     Workspace System File Purge        |  |  - Drop temporary generated client UUID |    |  - Delete orphaned test media files    |  |  - Drop dummy booking rows & review logs|    |  - Wipe *.tmp.spec.ts cached binaries  |  |  - Reopen tested unit calendar slots   |     |  - Scrub unreferenced artifact logs    |  +----------------------------------------+     +----------------------------------------+`

### 1\. Automated Project Workspace File-Scrub Cleanup Rules

*   **Orphaned Media Asset Purge:** Programmatically query the staging storage bucket directories. Cross-analyze stored files against active relational base keys (fileKey attributes inside database records). Permanently erase any orphaned testing image uploads, placeholder assets bundles, or broken mock media assets left over from uploading execution paths\[cite: 1, 11\].
    
*   **Obsolete Spec and Script Scraping:** Target project file directories recursively. Detect, un-link, and completely remove any generated temporary testing specs profiles (\*.tmp.spec.ts), local artifact bundle cache records, or duplicate test configuration duplicates spawned to handle parallel browser context parameters.
    
*   **The Structural Directory Whitelist Lock:** Enforce a hard whitelisting check statement inside the file sanitization function context. Any script instruction attempting to delete or alter code framework files, base frontend components stylesheets, unified constants repositories, or valid production infrastructure paths must be instantly aborted, throwing an active deployment security alert notification\[cite: 1, 9\].
    

### 2\. Database State Sanitization Sequence (Teardown Hooks)

*   **Transactional Deletion Cascade:** Incorporate a comprehensive cleaning sequence inside the root testing framework afterAll global lifecycle hook context block:
    
    1.  Extract all generated test account client UUID identifiers, booking tracking parameters, and review entity logs.
        
    2.  Execute a direct backend database transactional block to safely drop the generated test records from reviews, payments, invoices, and bookings schemas, ensuring zero data pollution remains inside accounting ledgers.
        
    3.  Purge the temporary test account record row from the clients primary registry roster database table.
        
    4.  Force the AvailabilityService engine to execute an inventory reset, clearing out the tested date slots completely to open the asset calendars back up for baseline verification runs.
        

Part IV: Edge Cases & Operational Production Safety Gates
=========================================================

### 1\. Key Edge Cases to Secure

*   **The Interrupted Suite Error Trapping:** If an integration script assertion errors out mid-run, the project-level cleaning routines and database teardown blocks _must still trigger_ successfully through an un-skippable global finally or afterAll hook wrapper to block test resource leakage cascades.
    
*   **The Rapid Concurrency Click Double-Submit:** Simulate multi-clicking triggers on the checkout checkout action item container. Assert that component elements switch values to an explicit isPending state configuration instantly, blocking subsequent payload duplicates to shield database layers from duplicate record risks.
    
*   **The Midnight Boundary Date Offset Check:** Pass scheduling timestamps falling precisely on midnight hour shifts. Verify that temporal parsers interpret the boundaries accurately matching browser local locales, preventing date values from drifting backward into past calendar slot arrays unexpectedly.
    

### 2\. Acceptance Criteria

*   \[ \] The automated test framework executes all segment test workflows and multi-portal cross-synchronization paths securely without crashing or throwing script timeouts.
    
*   \[ \] Client identity registrations and booking mutations cascade correct matching parameter data pools into Admin and Owner dashboards flawlessly\[cite: 2, 6\].
    
*   \[ \] Under no conditions are client phone numbers or email strings exposed inside any retrieved owner portal payloads or user interface blocks.
    
*   \[ \] The project workspace sanitization function safely removes all generated testing files, cache logs, and orphaned media assets upon conclusion.
    
*   \[ \] Absolutely zero operational production source code files, database schema tables structures, or primary application configurations are deleted or modified\[cite: 1, 9\].
    

### 3\. QA Checklist

*   **What to verify:** Ensure that clicking the seamless booking button triggers successful client creation, passes correct JSON values parameters into global tracking contexts, updates cross-portal endpoints instantly, and is completely cleaned out of project directories and DB tables by the sanitization wrapper after execution finishes\[cite: 1, 2, 6, 11\].
    
*   **What could fail:** The file scrubbing cleanups script could fail or throw runtime folder locked violations if the runner attempts to delete cached asset binaries while active browser server processes are still detaching. Enforce strict cleanup execution delays.
    
*   **What must not break:** Primary shared web components classes, centralized utility routers, production-level configurations data configurations, and the transactional database schema integrity boundaries\[cite: 1, 6, 9\].
    
*   **How to confirm success:** The testing terminal executes headless runner checks successfully, outputs a 100% green validation track report, carries out workspace sanitization scripts, and leaves exactly zero redundant disk files or test artifacts behind inside the repository tree.
    

### 4\. Production Safety Notes

*   **Live System Isolation Directive:** This test package mutates customer profiles datasets, locks calendar frames, and creates user accounts. It must remain completely restricted from executing against the live production infrastructure domains.
    
*   **Staging Infrastructure Validation Gate:** This full-scope integration testing suite and repository file cleaner configuration must pass verification builds completely within the isolated Staging sandbox terminal before receiving pull request approval into master development lines.
    
*   **Environment Rollback Readiness:** Confirm database initialization seed files can reset parameters back to known baselines instantly, ensuring clean environment states before every continuous integration check run\[cite: 3, 10\].