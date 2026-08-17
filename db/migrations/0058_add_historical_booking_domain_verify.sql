DO $$
DECLARE
    required_column TEXT;
    required_constraint TEXT;
    expected_sources TEXT[] := ARRAY[
        'external_platform',
        'legacy_system',
        'offline_record',
        'other'
    ];
    actual_sources TEXT[];
BEGIN
    FOREACH required_column IN ARRAY ARRAY[
        'is_historical',
        'actual_booked_at',
        'historical_entry_reason',
        'original_source',
        'external_reference'
    ] LOOP
        IF NOT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'bookings'
              AND column_name = required_column
        ) THEN
            RAISE EXCEPTION 'Missing bookings.% column', required_column;
        END IF;
    END LOOP;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'bookings'
          AND column_name = 'is_historical'
          AND data_type = 'boolean'
          AND is_nullable = 'NO'
          AND column_default = 'false'
    ) THEN
        RAISE EXCEPTION 'bookings.is_historical has unexpected type, nullability, or default';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'bookings'
          AND column_name IN (
              'actual_booked_at',
              'historical_entry_reason',
              'original_source',
              'external_reference'
          )
          AND (is_nullable <> 'YES' OR column_default IS NOT NULL)
    ) THEN
        RAISE EXCEPTION 'Nullable historical booking provenance columns have unexpected defaults or nullability';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'bookings'
          AND column_name = 'actual_booked_at'
          AND data_type = 'date'
    ) OR NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'bookings'
          AND column_name = 'historical_entry_reason'
          AND data_type = 'character varying'
          AND character_maximum_length = 50
    ) OR NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'bookings'
          AND column_name = 'original_source'
          AND data_type = 'character varying'
          AND character_maximum_length = 50
    ) OR NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'bookings'
          AND column_name = 'external_reference'
          AND data_type = 'character varying'
          AND character_maximum_length = 100
    ) THEN
        RAISE EXCEPTION 'Historical booking provenance column types do not match HB-02';
    END IF;

    FOREACH required_constraint IN ARRAY ARRAY[
        'ck_bookings_actual_booked_at_requires_historical',
        'ck_bookings_historical_entry_reason',
        'ck_bookings_historical_fields_coherent',
        'fk_bookings_original_source'
    ] LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conname = required_constraint AND convalidated
        ) THEN
            RAISE EXCEPTION 'Missing or unvalidated constraint %', required_constraint;
        END IF;
    END LOOP;

    SELECT array_agg(code ORDER BY code)
    INTO actual_sources
    FROM booking_original_sources;

    IF actual_sources IS DISTINCT FROM expected_sources THEN
        RAISE EXCEPTION 'Unexpected original-source seed set: %', actual_sources;
    END IF;

    IF EXISTS (
        SELECT 1 FROM booking_original_sources
        WHERE NOT is_active OR btrim(label) = ''
    ) THEN
        RAISE EXCEPTION 'Seeded original sources must be active and labelled';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public' AND indexname = 'ix_bookings_is_historical'
    ) THEN
        RAISE EXCEPTION 'Missing ix_bookings_is_historical';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'pk_idempotency_keys' AND contype = 'p'
    ) THEN
        RAISE EXCEPTION 'Missing idempotency_keys primary key';
    END IF;

    IF (
        SELECT count(*)
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'idempotency_keys'
          AND column_name IN (
              'actor_admin_user_id', 'endpoint', 'key', 'request_hash',
              'response_status', 'booking_id', 'created_at', 'completed_at'
          )
    ) <> 8 THEN
        RAISE EXCEPTION 'idempotency_keys does not have the complete HB-02 column set';
    END IF;

    FOREACH required_constraint IN ARRAY ARRAY[
        'fk_idempotency_keys_actor_admin_user_id',
        'fk_idempotency_keys_booking_id'
    ] LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conname = required_constraint
              AND contype = 'f'
              AND convalidated
        ) THEN
            RAISE EXCEPTION 'Missing or unvalidated idempotency constraint %', required_constraint;
        END IF;
    END LOOP;

    IF NOT EXISTS (
        SELECT 1 FROM rbac_role_template_permissions
        WHERE role_template_id = '10000000-0000-0000-0000-000000000001'
          AND permission_key = 'bookings:record_historical'
    ) THEN
        RAISE EXCEPTION 'SuperAdmin is missing bookings:record_historical';
    END IF;

    IF EXISTS (
        SELECT 1 FROM rbac_role_template_permissions
        WHERE permission_key = 'bookings:override_owner'
    ) THEN
        RAISE EXCEPTION 'HB-02 must not seed bookings:override_owner';
    END IF;

END $$;
