-- Migration: 0060_add_historical_financial_snapshot
-- HB-04A immutable agreed-amount snapshot and deterministic HB-02 backfill.
--
-- Coordinated rollout is required: historical writes must be quiesced, or the API
-- deployment and this migration must be coordinated, because pre-HB-04A code does
-- not populate agreed_amount.

BEGIN;

ALTER TABLE bookings
    ADD COLUMN agreed_amount DECIMAL(12,2) NULL;

DO $$
DECLARE
    violation_count BIGINT;
BEGIN
    SELECT count(*)
    INTO violation_count
    FROM bookings AS booking
    LEFT JOIN booking_original_sources AS original_source
        ON original_source.code = booking.original_source
    WHERE booking.is_historical
      AND (
          booking.base_amount IS NULL
          OR booking.final_amount IS NULL
          OR booking.base_amount < 0
          OR booking.final_amount < 0
          OR booking.base_amount <> booking.final_amount
          OR booking.actual_booked_at IS NULL
          OR booking.historical_entry_reason IS NULL
          OR booking.original_source IS NULL
          OR original_source.code IS NULL
          OR booking.booking_status <> 'completed'
          OR booking.source <> 'admin'
      );

    IF violation_count > 0 THEN
        RAISE EXCEPTION
            'Migration 0060 refused: % historical booking row(s) violate the HB-02 financial or provenance invariants',
            violation_count;
    END IF;
END $$;

UPDATE bookings
SET agreed_amount = final_amount
WHERE is_historical;

ALTER TABLE bookings
    ADD CONSTRAINT ck_bookings_agreed_amount_non_negative
        CHECK (agreed_amount IS NULL OR agreed_amount >= 0) NOT VALID,
    ADD CONSTRAINT ck_bookings_historical_agreed_amount_coherent
        CHECK (
            (is_historical
                AND agreed_amount IS NOT NULL
                AND agreed_amount = base_amount
                AND base_amount = final_amount)
            OR (NOT is_historical AND agreed_amount IS NULL)
        ) NOT VALID;

ALTER TABLE bookings
    VALIDATE CONSTRAINT ck_bookings_agreed_amount_non_negative;
ALTER TABLE bookings
    VALIDATE CONSTRAINT ck_bookings_historical_agreed_amount_coherent;

COMMIT;
