-- Safe only while every agreed_amount remains exactly reconstructable from the
-- pre-0060 HB-02 base_amount/final_amount truth. Refuse rather than discard an
-- independent or incoherent financial fact.
DO $$
DECLARE
    unsafe_count BIGINT;
BEGIN
    SELECT count(*)
    INTO unsafe_count
    FROM bookings
    WHERE agreed_amount IS NOT NULL
      AND (
          NOT is_historical
          OR base_amount IS NULL
          OR final_amount IS NULL
          OR agreed_amount <> base_amount
          OR base_amount <> final_amount
          OR actual_booked_at IS NULL
          OR historical_entry_reason IS NULL
          OR original_source IS NULL
          OR booking_status <> 'completed'
          OR source <> 'admin'
      );

    IF unsafe_count > 0 THEN
        RAISE EXCEPTION
            'Unsafe rollback refused: % agreed-amount snapshot row(s) are not reconstructable from the HB-02 amount truth',
            unsafe_count;
    END IF;
END $$;

BEGIN;

ALTER TABLE bookings
    DROP CONSTRAINT ck_bookings_historical_agreed_amount_coherent,
    DROP CONSTRAINT ck_bookings_agreed_amount_non_negative,
    DROP COLUMN agreed_amount;

COMMIT;
