-- Verifier: 0063_add_historical_reporting_read_models
-- Catalog and data invariants; independent of development seed data.

DO $$
DECLARE
    actual_columns TEXT[];
    actual_types TEXT[];
    definition TEXT;
    historical_count BIGINT;
    reconciliation_count BIGINT;
    reconciliation_distinct BIGINT;
BEGIN
    IF (
        SELECT COUNT(*)
        FROM pg_catalog.pg_class c
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = current_schema()
          AND c.relkind = 'v'
          AND c.relname IN (
              'reporting_booking_daily_summary',
              'reporting_booking_stay_daily_summary',
              'reporting_finance_daily_summary',
              'reporting_finance_stay_daily_summary',
              'reporting_historical_entry_reconciliation'
          )
    ) <> 5 THEN
        RAISE EXCEPTION '0063 verifier: one or more owned reporting views are missing';
    END IF;

    SELECT ARRAY_AGG(a.attname ORDER BY a.attnum),
           ARRAY_AGG(pg_catalog.format_type(a.atttypid, a.atttypmod) ORDER BY a.attnum)
    INTO actual_columns, actual_types
    FROM pg_catalog.pg_attribute a
    WHERE a.attrelid = 'reporting_booking_daily_summary'::regclass
      AND a.attnum > 0 AND NOT a.attisdropped;

    IF actual_columns IS DISTINCT FROM ARRAY[
        'metric_date', 'booking_source', 'bookings_created_count',
        'prospecting_bookings_count', 'confirmed_bookings_count',
        'cancelled_bookings_count', 'completed_bookings_count', 'total_final_amount',
        'historical_bookings_count', 'historical_prospecting_bookings_count',
        'historical_confirmed_bookings_count', 'historical_cancelled_bookings_count',
        'historical_completed_bookings_count', 'historical_final_amount',
        'historical_agreed_amount', 'historical_legacy_system_bookings_count',
        'historical_external_platform_bookings_count',
        'historical_offline_record_bookings_count',
        'historical_other_source_bookings_count'
    ]::TEXT[] OR actual_types IS DISTINCT FROM ARRAY[
        'date', 'character varying(50)', 'bigint', 'bigint', 'bigint', 'bigint',
        'bigint', 'numeric(14,2)', 'integer', 'integer', 'integer', 'integer',
        'integer', 'numeric(14,2)', 'numeric(14,2)', 'integer', 'integer',
        'integer', 'integer'
    ]::TEXT[] THEN
        RAISE EXCEPTION '0063 verifier: recorded booking dictionary is invalid: % / %',
            actual_columns, actual_types;
    END IF;

    IF actual_columns[1:8] IS DISTINCT FROM ARRAY[
        'metric_date', 'booking_source', 'bookings_created_count',
        'prospecting_bookings_count', 'confirmed_bookings_count',
        'cancelled_bookings_count', 'completed_bookings_count', 'total_final_amount'
    ]::TEXT[] THEN
        RAISE EXCEPTION '0063 verifier: recorded booking prefix changed';
    END IF;

    SELECT pg_get_viewdef('reporting_booking_daily_summary'::regclass, TRUE) INTO definition;
    IF POSITION('original_source' IN definition) = 0
       OR POSITION('legacy_system' IN definition) = 0
       OR POSITION('external_platform' IN definition) = 0
       OR POSITION('offline_record' IN definition) = 0
       OR definition !~* 'original_source[[:space:]]+IS[[:space:]]+NULL' THEN
        RAISE EXCEPTION '0063 verifier: recorded provenance remainder is not catch-all';
    END IF;

    IF EXISTS (
        SELECT 1 FROM reporting_booking_daily_summary
        WHERE historical_legacy_system_bookings_count
            + historical_external_platform_bookings_count
            + historical_offline_record_bookings_count
            + historical_other_source_bookings_count
            <> historical_bookings_count
    ) THEN
        RAISE EXCEPTION '0063 verifier: recorded provenance components do not reconcile';
    END IF;

    SELECT ARRAY_AGG(a.attname ORDER BY a.attnum),
           ARRAY_AGG(pg_catalog.format_type(a.atttypid, a.atttypmod) ORDER BY a.attnum)
    INTO actual_columns, actual_types
    FROM pg_catalog.pg_attribute a
    WHERE a.attrelid = 'reporting_booking_stay_daily_summary'::regclass
      AND a.attnum > 0 AND NOT a.attisdropped;

    IF actual_columns IS DISTINCT FROM ARRAY[
        'metric_date', 'booking_source', 'bookings_count', 'prospecting_bookings_count',
        'confirmed_bookings_count', 'cancelled_bookings_count',
        'completed_bookings_count', 'total_final_amount', 'historical_bookings_count',
        'historical_prospecting_bookings_count', 'historical_confirmed_bookings_count',
        'historical_cancelled_bookings_count', 'historical_completed_bookings_count',
        'historical_final_amount', 'historical_agreed_amount'
    ]::TEXT[] OR actual_types IS DISTINCT FROM ARRAY[
        'date', 'character varying(50)', 'integer', 'integer', 'integer', 'integer',
        'integer', 'numeric(14,2)', 'integer', 'integer', 'integer', 'integer',
        'integer', 'numeric(14,2)', 'numeric(14,2)'
    ]::TEXT[] THEN
        RAISE EXCEPTION '0063 verifier: stay booking dictionary is invalid: % / %',
            actual_columns, actual_types;
    END IF;

    SELECT ARRAY_AGG(a.attname ORDER BY a.attnum),
           ARRAY_AGG(pg_catalog.format_type(a.atttypid, a.atttypmod) ORDER BY a.attnum)
    INTO actual_columns, actual_types
    FROM pg_catalog.pg_attribute a
    WHERE a.attrelid = 'reporting_finance_daily_summary'::regclass
      AND a.attnum > 0 AND NOT a.attisdropped;

    IF actual_columns IS DISTINCT FROM ARRAY[
        'metric_date', 'bookings_with_invoice_count', 'total_invoiced_amount',
        'total_paid_amount', 'total_remaining_amount', 'total_pending_payout_amount',
        'total_scheduled_payout_amount', 'total_paid_payout_amount',
        'historical_bookings_with_invoice_count', 'historical_invoiced_amount',
        'historical_invoice_linked_paid_amount', 'historical_remaining_amount',
        'ordinary_orphan_payment_count', 'ordinary_orphan_payment_amount',
        'historical_booking_ordinary_orphan_payment_count',
        'historical_booking_ordinary_orphan_payment_amount',
        'historical_payment_evidence_count', 'historical_payment_evidence_amount',
        'historical_agreed_amount'
    ]::TEXT[] OR actual_types IS DISTINCT FROM ARRAY[
        'date', 'integer', 'numeric(14,2)', 'numeric(14,2)', 'numeric(14,2)',
        'numeric(14,2)', 'numeric(14,2)', 'numeric(14,2)', 'integer',
        'numeric(14,2)', 'numeric(14,2)', 'numeric(14,2)', 'integer',
        'numeric(14,2)', 'integer', 'numeric(14,2)', 'integer', 'numeric(14,2)',
        'numeric(14,2)'
    ]::TEXT[] THEN
        RAISE EXCEPTION '0063 verifier: recorded finance dictionary is invalid: % / %',
            actual_columns, actual_types;
    END IF;

    IF actual_columns[1:8] IS DISTINCT FROM ARRAY[
        'metric_date', 'bookings_with_invoice_count', 'total_invoiced_amount',
        'total_paid_amount', 'total_remaining_amount', 'total_pending_payout_amount',
        'total_scheduled_payout_amount', 'total_paid_payout_amount'
    ]::TEXT[] THEN
        RAISE EXCEPTION '0063 verifier: recorded finance prefix changed';
    END IF;

    SELECT pg_get_viewdef('reporting_finance_daily_summary'::regclass, TRUE) INTO definition;
    IF definition ~* 'paid_at'
       OR definition ~* 'FULL[[:space:]]+(OUTER[[:space:]]+)?JOIN'
       OR definition !~* 'NOT (p\.)?is_historical_record'
       OR definition !~* '(p\.)?is_historical_record'
       OR definition !~* '(p\.)?invoice_id IS NULL' THEN
        RAISE EXCEPTION '0063 verifier: recorded finance axis or evidence isolation is invalid';
    END IF;

    SELECT ARRAY_AGG(a.attname ORDER BY a.attnum),
           ARRAY_AGG(pg_catalog.format_type(a.atttypid, a.atttypmod) ORDER BY a.attnum)
    INTO actual_columns, actual_types
    FROM pg_catalog.pg_attribute a
    WHERE a.attrelid = 'reporting_finance_stay_daily_summary'::regclass
      AND a.attnum > 0 AND NOT a.attisdropped;

    IF actual_columns IS DISTINCT FROM ARRAY[
        'metric_date', 'booking_source', 'bookings_with_invoice_count',
        'total_invoiced_amount', 'total_final_amount', 'historical_bookings_count',
        'historical_agreed_amount', 'historical_invoiced_amount',
        'historical_bookings_with_invoice_count'
    ]::TEXT[] OR actual_types IS DISTINCT FROM ARRAY[
        'date', 'character varying(50)', 'integer', 'numeric(14,2)', 'numeric(14,2)',
        'integer', 'numeric(14,2)', 'numeric(14,2)', 'integer'
    ]::TEXT[] THEN
        RAISE EXCEPTION '0063 verifier: stay finance dictionary is invalid: % / %',
            actual_columns, actual_types;
    END IF;

    IF actual_columns && ARRAY[
        'paid_amount', 'invoice_linked_paid_amount', 'total_remaining_amount',
        'ordinary_orphan_payment_count', 'ordinary_orphan_payment_amount',
        'historical_payment_evidence_count', 'historical_payment_evidence_amount'
    ]::TEXT[] THEN
        RAISE EXCEPTION '0063 verifier: cash or remaining measure exists on stay finance';
    END IF;

    SELECT ARRAY_AGG(a.attname ORDER BY a.attnum),
           ARRAY_AGG(pg_catalog.format_type(a.atttypid, a.atttypmod) ORDER BY a.attnum)
    INTO actual_columns, actual_types
    FROM pg_catalog.pg_attribute a
    WHERE a.attrelid = 'reporting_historical_entry_reconciliation'::regclass
      AND a.attnum > 0 AND NOT a.attisdropped;

    IF actual_columns IS DISTINCT FROM ARRAY[
        'booking_id', 'recorded_at', 'actual_booked_at', 'entry_lag_days',
        'stay_start', 'stay_end', 'stay_nights', 'booking_source', 'original_source',
        'historical_entry_reason', 'booking_status', 'unit_id', 'owner_id',
        'agreed_amount', 'active_invoice_amount', 'ordinary_invoice_linked_paid_amount',
        'ordinary_unlinked_paid_count', 'ordinary_unlinked_paid_amount',
        'historical_payment_evidence_count', 'historical_payment_evidence_amount',
        'first_evidence_paid_date', 'last_evidence_paid_date',
        'owner_attribution_correction_count', 'last_owner_attribution_corrected_at'
    ]::TEXT[] OR actual_types IS DISTINCT FROM ARRAY[
        'uuid', 'timestamp without time zone', 'date', 'integer', 'date', 'date',
        'integer', 'character varying(50)', 'character varying(50)',
        'character varying(50)', 'character varying(50)', 'uuid', 'uuid',
        'numeric(14,2)', 'numeric(14,2)', 'numeric(14,2)', 'integer',
        'numeric(14,2)', 'integer', 'numeric(14,2)', 'date', 'date', 'integer',
        'timestamp with time zone'
    ]::TEXT[] THEN
        RAISE EXCEPTION '0063 verifier: reconciliation dictionary is invalid: % / %',
            actual_columns, actual_types;
    END IF;

    SELECT COUNT(*) INTO historical_count FROM bookings WHERE is_historical;
    SELECT COUNT(*), COUNT(DISTINCT booking_id)
    INTO reconciliation_count, reconciliation_distinct
    FROM reporting_historical_entry_reconciliation;

    IF reconciliation_count <> historical_count
       OR reconciliation_distinct <> historical_count THEN
        RAISE EXCEPTION '0063 verifier: reconciliation is not one row per historical booking';
    END IF;

    IF EXISTS (
        SELECT 1 FROM reporting_historical_entry_reconciliation
        WHERE entry_lag_days < -1
    ) THEN
        RAISE EXCEPTION '0063 verifier: reconciliation entry lag is below -1';
    END IF;

    IF EXISTS (
        SELECT 1 FROM payments
        WHERE is_historical_record AND invoice_id IS NOT NULL
    ) THEN
        RAISE EXCEPTION '0063 verifier: historical evidence is invoice-linked';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name IN (
              'reporting_booking_daily_summary',
              'reporting_booking_stay_daily_summary',
              'reporting_finance_daily_summary',
              'reporting_finance_stay_daily_summary',
              'reporting_historical_entry_reconciliation'
          )
          AND column_name ~* '(client|phone|email|note|reference|bank)'
    ) THEN
        RAISE EXCEPTION '0063 verifier: reporting dictionary exposes a forbidden PII field';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM pg_catalog.pg_class c
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = current_schema()
          AND c.relname IN (
              'reporting_booking_stay_daily_summary',
              'reporting_finance_stay_daily_summary',
              'reporting_historical_entry_reconciliation'
          )
          AND c.relkind <> 'v'
    ) OR EXISTS (
        SELECT 1
        FROM pg_catalog.pg_trigger t
        WHERE t.tgrelid IN (
            'reporting_booking_stay_daily_summary'::regclass,
            'reporting_finance_stay_daily_summary'::regclass,
            'reporting_historical_entry_reconciliation'::regclass
        ) AND NOT t.tgisinternal
    ) THEN
        RAISE EXCEPTION '0063 verifier: an owned relation has write-side behavior';
    END IF;
END $$;

SELECT '0063 historical reporting read-model verification passed' AS verification_result;
