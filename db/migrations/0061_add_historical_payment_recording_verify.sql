-- Verifies HB-04B objects using PostgreSQL catalogs and executable invariants.
DO $$
DECLARE
    actor_delete_action "char";
    canonical_index RECORD;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'payments'
          AND column_name = 'is_historical_record' AND data_type = 'boolean'
          AND is_nullable = 'NO' AND column_default = 'false'
    ) THEN
        RAISE EXCEPTION '0061 verify: payments.is_historical_record is missing or incompatible';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'payments'
          AND column_name = 'recorded_reason' AND data_type = 'character varying'
          AND character_maximum_length = 500 AND is_nullable = 'YES'
    ) THEN
        RAISE EXCEPTION '0061 verify: payments.recorded_reason is missing or incompatible';
    END IF;

    SELECT confdeltype INTO actor_delete_action
    FROM pg_constraint
    WHERE conname = 'fk_payments_created_by_admin_user_id'
      AND conrelid = 'public.payments'::regclass
      AND contype = 'f' AND convalidated;
    IF actor_delete_action IS DISTINCT FROM 'r' THEN
        RAISE EXCEPTION '0061 verify: payment actor FK is missing, unvalidated, or not RESTRICT';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'ck_payments_historical_record_coherent'
          AND conrelid = 'public.payments'::regclass
          AND contype = 'c' AND convalidated
    ) THEN
        RAISE EXCEPTION '0061 verify: historical payment coherence CHECK is not validated';
    END IF;

    SELECT i.indisunique, i.indisvalid, i.indisready, am.amname,
           i.indnkeyatts, i.indnatts,
           pg_get_indexdef(i.indexrelid, 1, true) AS first_key,
           pg_get_indexdef(i.indexrelid, 2, true) AS second_key,
           pg_get_expr(i.indpred, i.indrelid) AS predicate
    INTO canonical_index
    FROM pg_index i
    JOIN pg_class c ON c.oid = i.indexrelid
    JOIN pg_class t ON t.oid = i.indrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_am am ON am.oid = c.relam
    WHERE n.nspname = 'public' AND t.relname = 'payments'
      AND c.relname = 'ux_payments_historical_reference';
    IF NOT FOUND OR NOT canonical_index.indisunique OR NOT canonical_index.indisvalid
       OR NOT canonical_index.indisready OR canonical_index.amname <> 'btree'
       OR canonical_index.indnkeyatts <> 2 OR canonical_index.indnatts <> 2
       OR canonical_index.first_key <> 'booking_id'
       OR canonical_index.second_key <> 'lower(btrim(reference_number::text))'
       OR canonical_index.predicate <> '(is_historical_record AND (reference_number IS NOT NULL))'
    THEN
        RAISE EXCEPTION '0061 verify: canonical historical reference index is not fully enforcing';
    END IF;

    IF to_regclass('public.historical_payment_idempotency_keys') IS NULL THEN
        RAISE EXCEPTION '0061 verify: dedicated idempotency table is missing';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'pk_historical_payment_idempotency_keys'
          AND conrelid = 'public.historical_payment_idempotency_keys'::regclass
          AND contype = 'p'
    ) OR NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname IN (
            'fk_historical_payment_idempotency_actor',
            'fk_historical_payment_idempotency_payment',
            'ck_historical_payment_idempotency_hash',
            'ck_historical_payment_idempotency_completion')
          AND conrelid = 'public.historical_payment_idempotency_keys'::regclass
          AND convalidated
        GROUP BY conrelid HAVING count(*) = 4
    ) THEN
        RAISE EXCEPTION '0061 verify: idempotency constraints are incomplete or unvalidated';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM rbac_role_template_permissions
        WHERE role_template_id = '10000000-0000-0000-0000-000000000001'
          AND permission_key = 'payments:record_historical'
    ) THEN
        RAISE EXCEPTION '0061 verify: SuperAdmin historical-payment permission is missing';
    END IF;

    IF EXISTS (SELECT 1 FROM payments WHERE is_historical_record AND
        (created_by_admin_user_id IS NULL OR paid_at IS NULL OR
         recorded_reason IS NULL OR btrim(recorded_reason) = '')) THEN
        RAISE EXCEPTION '0061 verify: incoherent historical payment rows exist';
    END IF;
END $$;
