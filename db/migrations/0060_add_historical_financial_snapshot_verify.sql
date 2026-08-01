DO $$
DECLARE
    constraint_definition TEXT;
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'bookings'
          AND column_name = 'agreed_amount'
          AND data_type = 'numeric'
          AND numeric_precision = 12
          AND numeric_scale = 2
          AND is_nullable = 'YES'
          AND column_default IS NULL
    ) THEN
        RAISE EXCEPTION 'bookings.agreed_amount has unexpected type, precision, nullability, or default';
    END IF;

    SELECT pg_get_constraintdef(oid, TRUE)
    INTO constraint_definition
    FROM pg_constraint
    WHERE conrelid = 'public.bookings'::regclass
      AND conname = 'ck_bookings_agreed_amount_non_negative'
      AND contype = 'c'
      AND convalidated;

    IF constraint_definition IS NULL
       OR constraint_definition NOT LIKE '%agreed_amount IS NULL%'
       OR constraint_definition NOT LIKE '%agreed_amount >= 0%' THEN
        RAISE EXCEPTION 'Missing, unvalidated, or unexpected agreed-amount non-negative constraint';
    END IF;

    SELECT pg_get_constraintdef(oid, TRUE)
    INTO constraint_definition
    FROM pg_constraint
    WHERE conrelid = 'public.bookings'::regclass
      AND conname = 'ck_bookings_historical_agreed_amount_coherent'
      AND contype = 'c'
      AND convalidated;

    IF constraint_definition IS NULL
       OR constraint_definition NOT LIKE '%is_historical%'
       OR constraint_definition NOT LIKE '%agreed_amount = base_amount%'
       OR constraint_definition NOT LIKE '%base_amount = final_amount%'
       OR constraint_definition NOT LIKE '%NOT is_historical%'
       OR constraint_definition NOT LIKE '%agreed_amount IS NULL%' THEN
        RAISE EXCEPTION 'Missing, unvalidated, or unexpected historical agreed-amount coherence constraint';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM bookings
        WHERE (is_historical AND (
                agreed_amount IS NULL
                OR agreed_amount <> base_amount
                OR base_amount <> final_amount))
           OR (NOT is_historical AND agreed_amount IS NOT NULL)
    ) THEN
        RAISE EXCEPTION 'Existing booking rows violate the HB-04A snapshot contract';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'payments'
          AND column_name IN ('recorded_by_admin_user_id', 'historical_payment_reason')
    ) THEN
        RAISE EXCEPTION 'HB-04A must not install HB-04B payment actor objects';
    END IF;
END $$;
