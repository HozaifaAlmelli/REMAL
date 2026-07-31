-- Migration: 0059_add_historical_booking_external_reference_index
-- CREATE INDEX CONCURRENTLY cannot run inside the transactional 0058 migration.
--
-- Retry behavior:
-- - A failed concurrent build may leave only the __build index invalid/not-ready.
-- - Re-running this file removes that build artifact and retries from repository data.
-- - The canonical index is replaced only after the temporary build is complete.
-- - The migration ledger must be written only after this file and its verifier succeed.

DROP INDEX CONCURRENTLY IF EXISTS public.ux_bookings_external_reference__build;

-- migration-statement-break
CREATE UNIQUE INDEX CONCURRENTLY ux_bookings_external_reference__build
    ON public.bookings USING btree (external_reference)
    WHERE external_reference IS NOT NULL;

-- migration-statement-break
BEGIN;

DROP INDEX IF EXISTS public.ux_bookings_external_reference;
ALTER INDEX public.ux_bookings_external_reference__build
    RENAME TO ux_bookings_external_reference;

COMMIT;
