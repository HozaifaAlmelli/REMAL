-- Verifies HB-05 objects using PostgreSQL catalogs and executable invariants.
DO $$
DECLARE
    chain_index RECORD;
    idempotency_index RECORD;
    idempotency_pk_columns TEXT[];
    hash_definition TEXT;
    completion_definition TEXT;
    warning_definition TEXT;
    trigger_function_source TEXT;
BEGIN
    IF to_regclass('public.historical_owner_attribution_corrections') IS NULL
       OR to_regclass('public.historical_owner_correction_idempotency_keys') IS NULL THEN
        RAISE EXCEPTION '0062 verify: HB-05 tables are missing';
    END IF;

    IF (SELECT count(*) FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'historical_owner_attribution_corrections') <> 8
       OR (SELECT count(*) FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'historical_owner_correction_idempotency_keys') <> 9 THEN
        RAISE EXCEPTION '0062 verify: HB-05 tables contain missing or unexpected columns';
    END IF;

    IF (SELECT count(*) FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'historical_owner_attribution_corrections'
          AND column_name IN (
              'id', 'booking_id', 'previous_owner_id', 'target_owner_id',
              'corrected_by_admin_user_id')
          AND data_type = 'uuid' AND is_nullable = 'NO') <> 5
       OR NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'historical_owner_attribution_corrections'
            AND column_name = 'reason' AND data_type = 'character varying'
            AND character_maximum_length = 50 AND is_nullable = 'NO')
       OR NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'historical_owner_attribution_corrections'
            AND column_name = 'note' AND data_type = 'character varying'
            AND character_maximum_length = 500 AND is_nullable = 'YES')
       OR NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'historical_owner_attribution_corrections'
            AND column_name = 'corrected_at'
            AND data_type = 'timestamp with time zone' AND is_nullable = 'NO') THEN
        RAISE EXCEPTION '0062 verify: correction audit columns are incompatible';
    END IF;

    IF (SELECT count(*)
        FROM pg_constraint
        WHERE conrelid = 'public.historical_owner_attribution_corrections'::regclass
          AND contype = 'f' AND convalidated AND confdeltype = 'r'
          AND (
              (conname = 'fk_historical_owner_corrections_booking'
                  AND confrelid = 'public.bookings'::regclass
                  AND array_length(conkey, 1) = 1
                  AND (SELECT attname FROM pg_attribute
                       WHERE attrelid = conrelid AND attnum = conkey[1]) = 'booking_id'
                  AND (SELECT attname FROM pg_attribute
                       WHERE attrelid = confrelid AND attnum = confkey[1]) = 'id')
              OR (conname IN (
                      'fk_historical_owner_corrections_previous_owner',
                      'fk_historical_owner_corrections_target_owner')
                  AND confrelid = 'public.owners'::regclass
                  AND array_length(conkey, 1) = 1
                  AND (SELECT attname FROM pg_attribute
                       WHERE attrelid = conrelid AND attnum = conkey[1]) = CASE conname
                      WHEN 'fk_historical_owner_corrections_previous_owner' THEN 'previous_owner_id'
                      ELSE 'target_owner_id' END
                  AND (SELECT attname FROM pg_attribute
                       WHERE attrelid = confrelid AND attnum = confkey[1]) = 'id')
              OR (conname = 'fk_historical_owner_corrections_actor'
                  AND confrelid = 'public.admin_users'::regclass
                  AND array_length(conkey, 1) = 1
                  AND (SELECT attname FROM pg_attribute
                       WHERE attrelid = conrelid AND attnum = conkey[1]) = 'corrected_by_admin_user_id'
                  AND (SELECT attname FROM pg_attribute
                       WHERE attrelid = confrelid AND attnum = confkey[1]) = 'id')
          )) <> 4 THEN
        RAISE EXCEPTION '0062 verify: correction audit FKs are incomplete, unvalidated, or not RESTRICT';
    END IF;

    IF (SELECT count(*) FROM pg_constraint
        WHERE conrelid = 'public.historical_owner_attribution_corrections'::regclass
          AND conname IN (
              'ck_historical_owner_correction_owner_change',
              'ck_historical_owner_correction_reason',
              'ck_historical_owner_correction_note',
              'ck_historical_owner_correction_other_note')
          AND contype = 'c' AND convalidated) <> 4 THEN
        RAISE EXCEPTION '0062 verify: correction audit checks are incomplete or unvalidated';
    END IF;

    SELECT i.indisunique, i.indisvalid, i.indisready, am.amname,
           i.indnkeyatts, i.indnatts,
           pg_get_indexdef(i.indexrelid, 1, true) AS first_key,
           pg_get_indexdef(i.indexrelid, 2, true) AS second_key,
           pg_get_indexdef(i.indexrelid, 3, true) AS third_key
    INTO chain_index
    FROM pg_index i
    JOIN pg_class c ON c.oid = i.indexrelid
    JOIN pg_class t ON t.oid = i.indrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_am am ON am.oid = c.relam
    WHERE n.nspname = 'public'
      AND t.relname = 'historical_owner_attribution_corrections'
      AND c.relname = 'ix_historical_owner_corrections_booking_chain';
    IF NOT FOUND OR chain_index.indisunique OR NOT chain_index.indisvalid
       OR NOT chain_index.indisready OR chain_index.amname <> 'btree'
       OR chain_index.indnkeyatts <> 3 OR chain_index.indnatts <> 3
       OR chain_index.first_key <> 'booking_id'
       OR chain_index.second_key <> 'corrected_at'
       OR chain_index.third_key <> 'id' THEN
        RAISE EXCEPTION '0062 verify: correction chain index is not fully operational';
    END IF;

    IF (SELECT count(*)
        FROM pg_index i
        JOIN pg_class c ON c.oid = i.indexrelid
        JOIN pg_class t ON t.oid = i.indrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        JOIN pg_am am ON am.oid = c.relam
        WHERE n.nspname = 'public'
          AND t.relname = 'historical_owner_attribution_corrections'
          AND i.indisvalid AND i.indisready AND NOT i.indisunique
          AND am.amname = 'btree' AND i.indnkeyatts = 1 AND i.indnatts = 1
          AND (
              (c.relname = 'ix_historical_owner_corrections_previous_owner_id'
                  AND pg_get_indexdef(i.indexrelid, 1, true) = 'previous_owner_id')
              OR (c.relname = 'ix_historical_owner_corrections_target_owner_id'
                  AND pg_get_indexdef(i.indexrelid, 1, true) = 'target_owner_id')
              OR (c.relname = 'ix_historical_owner_corrections_actor_id'
                  AND pg_get_indexdef(i.indexrelid, 1, true) = 'corrected_by_admin_user_id')
          )) <> 3 THEN
        RAISE EXCEPTION '0062 verify: correction supporting indexes are incomplete or invalid';
    END IF;

    SELECT p.prosrc INTO trigger_function_source
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'reject_historical_owner_correction_mutation'
      AND pg_get_function_identity_arguments(p.oid) = '';
    IF trigger_function_source IS NULL
       OR trigger_function_source !~* 'RAISE[[:space:]]+EXCEPTION'
       OR trigger_function_source NOT LIKE '%ck_historical_owner_corrections_immutable%' THEN
        RAISE EXCEPTION '0062 verify: immutable trigger function does not reject mutation';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger t
        JOIN pg_proc p ON p.oid = t.tgfoid
        WHERE t.tgrelid = 'public.historical_owner_attribution_corrections'::regclass
          AND t.tgname = 'trg_historical_owner_corrections_immutable'
          AND NOT t.tgisinternal AND t.tgenabled = 'O' AND t.tgtype = 27
          AND p.proname = 'reject_historical_owner_correction_mutation')
       OR NOT EXISTS (
        SELECT 1 FROM pg_trigger t
        JOIN pg_proc p ON p.oid = t.tgfoid
        WHERE t.tgrelid = 'public.historical_owner_attribution_corrections'::regclass
          AND t.tgname = 'trg_historical_owner_corrections_immutable_truncate'
          AND NOT t.tgisinternal AND t.tgenabled = 'O' AND t.tgtype = 34
          AND p.proname = 'reject_historical_owner_correction_mutation') THEN
        RAISE EXCEPTION '0062 verify: immutable UPDATE/DELETE or TRUNCATE trigger is missing or disabled';
    END IF;

    SELECT array_agg(a.attname ORDER BY key_column.ordinality)
    INTO idempotency_pk_columns
    FROM pg_constraint c
    CROSS JOIN LATERAL unnest(c.conkey) WITH ORDINALITY AS key_column(attnum, ordinality)
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = key_column.attnum
    WHERE c.conrelid = 'public.historical_owner_correction_idempotency_keys'::regclass
      AND c.conname = 'pk_historical_owner_correction_idempotency_keys'
      AND c.contype = 'p';
    IF idempotency_pk_columns IS DISTINCT FROM
       ARRAY['actor_admin_user_id', 'endpoint', 'key']::TEXT[] THEN
        RAISE EXCEPTION '0062 verify: idempotency primary-key scope or column order is incorrect';
    END IF;

    IF (SELECT count(*) FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'historical_owner_correction_idempotency_keys'
          AND column_name IN ('actor_admin_user_id', 'key')
          AND data_type = 'uuid' AND is_nullable = 'NO') <> 2
       OR (SELECT count(*) FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'historical_owner_correction_idempotency_keys'
          AND column_name IN ('endpoint', 'request_hash')
          AND data_type = 'character varying' AND is_nullable = 'NO'
          AND ((column_name = 'endpoint' AND character_maximum_length = 200)
            OR (column_name = 'request_hash' AND character_maximum_length = 64))) <> 2
       OR NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'historical_owner_correction_idempotency_keys'
            AND column_name = 'response_warning_codes'
            AND data_type = 'ARRAY' AND udt_name = '_text' AND is_nullable = 'NO'
            AND column_default IS NOT NULL)
       OR NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'historical_owner_correction_idempotency_keys'
            AND column_name = 'created_at'
            AND data_type = 'timestamp with time zone' AND is_nullable = 'NO')
       OR NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'historical_owner_correction_idempotency_keys'
            AND column_name = 'completed_at'
            AND data_type = 'timestamp with time zone' AND is_nullable = 'YES') THEN
        RAISE EXCEPTION '0062 verify: idempotency columns are incompatible';
    END IF;

    IF (SELECT count(*) FROM pg_constraint
        WHERE conrelid = 'public.historical_owner_correction_idempotency_keys'::regclass
          AND contype = 'f' AND convalidated AND confdeltype = 'r'
          AND (
              (conname = 'fk_historical_owner_correction_idempotency_actor'
                  AND confrelid = 'public.admin_users'::regclass
                  AND array_length(conkey, 1) = 1
                  AND (SELECT attname FROM pg_attribute
                       WHERE attrelid = conrelid AND attnum = conkey[1]) = 'actor_admin_user_id'
                  AND (SELECT attname FROM pg_attribute
                       WHERE attrelid = confrelid AND attnum = confkey[1]) = 'id')
              OR (conname = 'fk_historical_owner_correction_idempotency_correction'
                  AND confrelid = 'public.historical_owner_attribution_corrections'::regclass
                  AND array_length(conkey, 1) = 1
                  AND (SELECT attname FROM pg_attribute
                       WHERE attrelid = conrelid AND attnum = conkey[1]) = 'correction_id'
                  AND (SELECT attname FROM pg_attribute
                       WHERE attrelid = confrelid AND attnum = confkey[1]) = 'id')
          )) <> 2 THEN
        RAISE EXCEPTION '0062 verify: idempotency FKs are incomplete, unvalidated, or not RESTRICT';
    END IF;

    SELECT pg_get_constraintdef(oid, true) INTO hash_definition
    FROM pg_constraint
    WHERE conrelid = 'public.historical_owner_correction_idempotency_keys'::regclass
      AND conname = 'ck_historical_owner_correction_idempotency_hash'
      AND contype = 'c' AND convalidated;
    SELECT pg_get_constraintdef(oid, true) INTO completion_definition
    FROM pg_constraint
    WHERE conrelid = 'public.historical_owner_correction_idempotency_keys'::regclass
      AND conname = 'ck_historical_owner_correction_idempotency_completion'
      AND contype = 'c' AND convalidated;
    SELECT pg_get_constraintdef(oid, true) INTO warning_definition
    FROM pg_constraint
    WHERE conrelid = 'public.historical_owner_correction_idempotency_keys'::regclass
      AND conname = 'ck_historical_owner_correction_idempotency_warnings'
      AND contype = 'c' AND convalidated;
    IF hash_definition IS NULL OR hash_definition NOT LIKE '%request_hash%^[0-9a-f]{64}$%'
       OR completion_definition IS NULL
       OR completion_definition NOT LIKE '%response_status = 200%'
       OR completion_definition NOT LIKE '%cardinality(response_warning_codes) = 0%'
       OR warning_definition IS NULL
       OR warning_definition NOT LIKE '%TARGET_OWNER_INACTIVE%'
       OR warning_definition NOT LIKE '%array_position(response_warning_codes, NULL::text)%'
       OR warning_definition NOT LIKE '%cardinality(response_warning_codes) <= 1%' THEN
        RAISE EXCEPTION '0062 verify: idempotency hash, completion, or warning coherence is weakened';
    END IF;

    SELECT i.indisunique, i.indisvalid, i.indisready, am.amname,
           i.indnkeyatts, i.indnatts,
           pg_get_indexdef(i.indexrelid, 1, true) AS first_key,
           pg_get_expr(i.indpred, i.indrelid) AS predicate
    INTO idempotency_index
    FROM pg_index i
    JOIN pg_class c ON c.oid = i.indexrelid
    JOIN pg_class t ON t.oid = i.indrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_am am ON am.oid = c.relam
    WHERE n.nspname = 'public'
      AND t.relname = 'historical_owner_correction_idempotency_keys'
      AND c.relname = 'ux_historical_owner_correction_idempotency_correction_id';
    IF NOT FOUND OR NOT idempotency_index.indisunique
       OR NOT idempotency_index.indisvalid OR NOT idempotency_index.indisready
       OR idempotency_index.amname <> 'btree'
       OR idempotency_index.indnkeyatts <> 1 OR idempotency_index.indnatts <> 1
       OR idempotency_index.first_key <> 'correction_id'
       OR idempotency_index.predicate <> '(correction_id IS NOT NULL)' THEN
        RAISE EXCEPTION '0062 verify: idempotency correction index is not fully enforcing';
    END IF;

    IF (SELECT count(*) FROM rbac_role_template_permissions
        WHERE permission_key = 'bookings:correct_owner_attribution') <> 1
       OR NOT EXISTS (
          SELECT 1 FROM rbac_role_template_permissions
          WHERE role_template_id = '10000000-0000-0000-0000-000000000001'
            AND permission_key = 'bookings:correct_owner_attribution') THEN
        RAISE EXCEPTION '0062 verify: owner-correction permission is not SuperAdmin-only';
    END IF;

    IF EXISTS (
        SELECT 1 FROM historical_owner_attribution_corrections
        WHERE previous_owner_id = target_owner_id
           OR reason NOT IN (
               'ownership_changed_after_stay',
               'booking_belonged_to_previous_owner_agreement',
               'accounting_reconciliation',
               'other')
           OR (reason = 'other' AND note IS NULL)) THEN
        RAISE EXCEPTION '0062 verify: incoherent owner-correction audit rows exist';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM (
            SELECT DISTINCT ON (booking_id) booking_id, target_owner_id
            FROM historical_owner_attribution_corrections
            ORDER BY booking_id, corrected_at DESC, id DESC
        ) latest
        JOIN bookings ON bookings.id = latest.booking_id
        WHERE bookings.owner_id <> latest.target_owner_id) THEN
        RAISE EXCEPTION '0062 verify: latest correction does not match persisted booking attribution';
    END IF;
END $$;
