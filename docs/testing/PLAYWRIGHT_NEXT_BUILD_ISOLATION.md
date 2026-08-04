# Playwright Next Build Isolation

`NEXT_PUBLIC_*` values are compiled into Next.js browser bundles. A Playwright server that writes a fixture
API host into the normal `rental-platform/.next` directory can therefore replace chunks used by a long-running
developer server. The result can be failed authentication refresh, missing permissions, stale chunk errors and
incorrect route redirects.

Self-hosted Playwright suites set `PLAYWRIGHT_NEXT_DIST_DIR` through the shared
`rental-platform/playwright.next-server.ts` helper:

| Suite              | Port | API fixture                     | Private build directory               |
| ------------------ | ---: | ------------------------------- | ------------------------------------- |
| CRM                | 3102 | `crm-fixture.local`             | `.next-playwright-crm`                |
| Historical booking | 3103 | `historical-fixture.local`      | `.next-playwright-historical-booking` |
| Booking history    | 3104 | `booking-history-fixture.local` | `.next-playwright-booking-history`    |

The variable accepts only the relative `.next-playwright-<suite>` naming convention. Absolute paths, traversal,
the normal `.next` name and other directory shapes fail configuration. With the variable absent, ordinary
`npm run dev`, `npm run build` and production images continue to use `.next`.

Each suite also owns a private `test-results/<suite>` directory and an existing suite-specific HTML report.
Private build directories are generated, ignored and disposable. They may be removed after a run when no server
for that suite is active. Unique ports, fixture hosts, build directories and result directories allow the
self-hosted suites to run sequentially or concurrently without rewriting another suite or developer bundle.
Admin, client and owner smoke configs continue to consume an explicitly started server on port 3001; they do
not launch or rebuild Next. Their result directories are isolated as well.
