-- Verifies HB-05 objects using PostgreSQL catalogs and executable invariants.
DO $$
DECLARE
    constraint_count INT;
    restrictive_fk_count INT;
    supporting_index_count INT;
    chain_index RECORD;
    idempotency_index RECORD;
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
          AND table_name = 'historical_owner_correction_idempotency_keys') <> 8 THEN
        RAISE EXCEPTION '0062 verify: HB-05 tables contain missing or unexpected columns';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.historical_owner_attribution_corrections'::regclass
          AND conname = 'pk_historical_owner_attribution_corrections'
          AND contype = 'p'
    ) THEN
        RAISE EXCEPTION '0062 verify: correction audit primary key is missing';
    END IF;

    IF (SELECT count(*) FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'historical_owner_attribution_corrections'
          AND column_name IN (
              'id', 'booking_id', 'previous_owner_id', 'target_owner_id',
              'corrected_by_admin_user_id')
          AND data_type = 'uuid' AND is_nullable = 'NO') <> 5
       OR (SELECT count(*) FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'historical_owner_correction_idempotency_keys'
          AND column_name IN ('actor_admin_user_id', 'key')
          AND data_type = 'uuid' AND is_nullable = 'NO') <> 2 THEN
        RAISE EXCEPTION '0062 verify: HB-05 identity columns are incompatible';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'historical_owner_attribution_corrections'
          AND column_name = 'reason'
          AND data_type = 'character varying'
          AND character_maximum_length = 50
          AND is_nullable = 'NO'
    ) OR NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'historical_owner_attribution_corrections'
          AND column_name = 'note'
          AND data_type = 'character varying'
          AND character_maximum_length = 500
          AND is_nullable = 'YES'
    ) THEN
        RAISE EXCEPTION '0062 verify: correction reason/note columns are incompatible';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'historical_owner_attribution_corrections'
          AND column_name = 'corrected_at'
          AND data_type = 'timestamp with time zone'
          AND is_nullable = 'NO'
    ) OR NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'historical_owner_correction_idempotency_keys'
          AND column_name = 'created_at'
          AND data_type = 'timestamp with time zone'
          AND is_nullable = 'NO'
    ) OR NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'historical_owner_correction_idempotency_keys'
          AND column_name = 'completed_at'
          AND data_type = 'timestamp with time zone'
          AND is_nullable = 'YES'
    ) THEN
        RAISE EXCEPTION '0062 verify: HB-05 transaction timestamps are incompatible';
    END IF;

    SELECT count(*) INTO restrictive_fk_count
    FROM pg_constraint
    WHERE conrelid = 'public.historical_owner_attribution_corrections'::regclass
      AND contype = 'f' AND convalidated AND confdeltype = 'r'
      AND (
          (conname = 'fk_historical_owner_corrections_booking'
              AND confrelid = 'public.bookings'::regclass)
          OR (conname IN (
                  'fk_historical_owner_corrections_previous_owner',
                  'fk_historical_owner_corrections_target_owner')
              AND confrelid = 'public.owners'::regclass)
          OR (conname = 'fk_historical_owner_corrections_actor'
              AND confrelid = 'public.admin_users'::regclass)
      );
    IF restrictive_fk_count <> 4 THEN
        RAISE EXCEPTION '0062 verify: correction audit FKs are incomplete, unvalidated, or not RESTRICT';
    END IF;

    SELECT count(*) INTO constraint_count
    FROM pg_constraint
    WHERE conrelid = 'public.historical_owner_attribution_corrections'::regclass
      AND conname IN (
          'ck_historical_owner_correction_owner_change',
          'ck_historical_owner_correction_reason',
          'ck_historical_owner_correction_note',
          'ck_historical_owner_correction_other_note')
      AND contype = 'c' AND convalidated;
    IF constraint_count <> 4 THEN
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

    SELECT count(*) INTO supporting_index_count
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
      );
    IF supporting_index_count <> 3 THEN
        RAISE EXCEPTION '0062 verify: correction supporting indexes are incomplete or invalid';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger trigger
        JOIN pg_proc function ON function.oid = trigger.tgfoid
        WHERE trigger.tgrelid = 'public.historical_owner_attribution_corrections'::regclass
          AND trigger.tgname = 'trg_historical_owner_corrections_immutable'
          AND NOT trigger.tgisinternal
          AND trigger.tgenabled = 'O'
          AND trigger.tgtype = 27
          AND function.proname = 'reject_historical_owner_correction_mutation'
    ) THEN
        RAISE EXCEPTION '0062 verify: immutable correction trigger is missing or disabled';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.historical_owner_correction_idempotency_keys'::regclass
          AND conname = 'pk_historical_owner_correction_idempotency_keys'
          AND contype = 'p'
    ) THEN
        RAISE EXCEPTION '0062 verify: idempotency scope primary key is missing';
    END IF;

    IF (SELECT count(*) FROM information_schema.columns
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
            AND column_name = 'correction_id'
            AND data_type = 'uuid' AND is_nullable = 'YES'
       ) OR NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'historical_owner_correction_idempotency_keys'
            AND column_name = 'response_status'
            AND data_type = 'integer' AND is_nullable = 'YES'
       ) THEN
        RAISE EXCEPTION '0062 verify: idempotency command columns are incompatible';
    END IF;

    SELECT count(*) INTO restrictive_fk_count
    FROM pg_constraint
    WHERE conrelid = 'public.historical_owner_correction_idempotency_keys'::regclass
      AND contype = 'f' AND convalidated AND confdeltype = 'r'
      AND (
          (conname = 'fk_historical_owner_correction_idempotency_actor'
              AND confrelid = 'public.admin_users'::regclass)
          OR (conname = 'fk_historical_owner_correction_idempotency_correction'
              AND confrelid = 'public.historical_owner_attribution_corrections'::regclass)
      );
    SELECT count(*) INTO constraint_count
    FROM pg_constraint
    WHERE conrelid = 'public.historical_owner_correction_idempotency_keys'::regclass
      AND conname IN (
          'ck_historical_owner_correction_idempotency_hash',
          'ck_historical_owner_correction_idempotency_completion')
      AND contype = 'c' AND convalidated;
    IF restrictive_fk_count <> 2 OR constraint_count <> 2 THEN
        RAISE EXCEPTION '0062 verify: idempotency constraints are incomplete or unvalidated';
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

    IF EXISTS (
        SELECT 1 FROM rbac_role_template_permissions
        WHERE permission_key = 'bookings:correct_owner_attribution'
    ) THEN
        RAISE EXCEPTION '0062 verify: owner-correction permission was assigned to a broad role template';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM historical_owner_attribution_corrections AS correction
        WHERE correction.previous_owner_id = correction.target_owner_id
           OR correction.reason NOT IN (
               'ownership_changed_after_stay',
               'booking_belonged_to_previous_owner_agreement',
               'accounting_reconciliation',
               'other')
           OR (correction.reason = 'other' AND correction.note IS NULL)
    ) THEN
        RAISE EXCEPTION '0062 verify: incoherent owner-correction audit rows exist';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM (
            SELECT DISTINCT ON (booking_id) booking_id, target_owner_id
            FROM historical_owner_attribution_corrections
            ORDER BY booking_id, corrected_at DESC, id DESC
        ) AS latest
        JOIN bookings ON bookings.id = latest.booking_id
        WHERE bookings.owner_id <> latest.target_owner_id
    ) THEN
        RAISE EXCEPTION '0062 verify: latest correction does not match persisted booking attribution';
    END IF;
END $$;
