-- Verifier: 0063_add_historical_reporting_read_models
-- Catalog-only and seed-independent.

DO $$
DECLARE
    actual_columns TEXT[];
    actual_types TEXT[];
    definition TEXT;
BEGIN
    SELECT
        ARRAY_AGG(a.attname ORDER BY a.attnum),
        ARRAY_AGG(pg_catalog.format_type(a.atttypid, a.atttypmod) ORDER BY a.attnum)
    INTO actual_columns, actual_types
    FROM pg_catalog.pg_attribute a
    JOIN pg_catalog.pg_class c ON c.oid = a.attrelid
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = current_schema()
      AND c.relname = 'reporting_booking_daily_summary'
      AND c.relkind = 'v'
      AND a.attnum > 0
      AND NOT a.attisdropped;

    IF actual_columns[1:8] IS DISTINCT FROM ARRAY[
        'metric_date',
        'booking_source',
        'bookings_created_count',
        'prospecting_bookings_count',
        'confirmed_bookings_count',
        'cancelled_bookings_count',
        'completed_bookings_count',
        'total_final_amount'
    ]::TEXT[] THEN
        RAISE EXCEPTION '0063 verifier: booking recorded-view prefix changed: %', actual_columns[1:8];
    END IF;

    IF actual_types[1:8] IS DISTINCT FROM ARRAY[
        'date', 'character varying(50)', 'bigint', 'bigint', 'bigint', 'bigint', 'bigint', 'numeric(14,2)'
    ]::TEXT[] THEN
        RAISE EXCEPTION '0063 verifier: booking recorded-view prefix types changed: %', actual_types[1:8];
    END IF;

    IF actual_columns[9:15] IS DISTINCT FROM ARRAY[
        'historical_bookings_count',
        'historical_prospecting_bookings_count',
        'historical_confirmed_bookings_count',
        'historical_cancelled_bookings_count',
        'historical_completed_bookings_count',
        'historical_final_amount',
        'historical_agreed_amount'
    ]::TEXT[] THEN
        RAISE EXCEPTION '0063 verifier: booking recorded-view appended dictionary is invalid: %', actual_columns[9:15];
    END IF;

    SELECT
        ARRAY_AGG(a.attname ORDER BY a.attnum),
        ARRAY_AGG(pg_catalog.format_type(a.atttypid, a.atttypmod) ORDER BY a.attnum)
    INTO actual_columns, actual_types
    FROM pg_catalog.pg_attribute a
    JOIN pg_catalog.pg_class c ON c.oid = a.attrelid
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = current_schema()
      AND c.relname = 'reporting_finance_daily_summary'
      AND c.relkind = 'v'
      AND a.attnum > 0
      AND NOT a.attisdropped;

    IF actual_columns[1:8] IS DISTINCT FROM ARRAY[
        'metric_date',
        'bookings_with_invoice_count',
        'total_invoiced_amount',
        'total_paid_amount',
        'total_remaining_amount',
        'total_pending_payout_amount',
        'total_scheduled_payout_amount',
        'total_paid_payout_amount'
    ]::TEXT[] THEN
        RAISE EXCEPTION '0063 verifier: finance recorded-view prefix changed: %', actual_columns[1:8];
    END IF;

    IF actual_types[1:8] IS DISTINCT FROM ARRAY[
        'date', 'integer', 'numeric(14,2)', 'numeric(14,2)', 'numeric(14,2)',
        'numeric(14,2)', 'numeric(14,2)', 'numeric(14,2)'
    ]::TEXT[] THEN
        RAISE EXCEPTION '0063 verifier: finance recorded-view prefix types changed: %', actual_types[1:8];
    END IF;

    IF actual_columns[9:19] IS DISTINCT FROM ARRAY[
        'historical_bookings_with_invoice_count',
        'historical_invoiced_amount',
        'historical_invoice_linked_paid_amount',
        'historical_remaining_amount',
        'ordinary_orphan_payment_count',
        'ordinary_orphan_payment_amount',
        'historical_booking_ordinary_orphan_payment_count',
        'historical_booking_ordinary_orphan_payment_amount',
        'historical_payment_evidence_count',
        'historical_payment_evidence_amount',
        'historical_agreed_amount'
    ]::TEXT[] THEN
        RAISE EXCEPTION '0063 verifier: finance recorded-view appended dictionary is invalid: %', actual_columns[9:19];
    END IF;

    PERFORM 1
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = current_schema()
      AND c.relkind = 'v'
      AND c.relname IN (
          'reporting_booking_stay_daily_summary',
          'reporting_finance_stay_daily_summary',
          'reporting_historical_entry_reconciliation'
      )
    GROUP BY n.nspname
    HAVING COUNT(*) = 3;

    IF NOT FOUND THEN
        RAISE EXCEPTION '0063 verifier: one or more HB-08A2 views are missing or not views';
    END IF;

    SELECT
        ARRAY_AGG(a.attname ORDER BY a.attnum),
        ARRAY_AGG(pg_catalog.format_type(a.atttypid, a.atttypmod) ORDER BY a.attnum)
    INTO actual_columns, actual_types
    FROM pg_catalog.pg_attribute a
    WHERE a.attrelid = 'reporting_booking_stay_daily_summary'::regclass
      AND a.attnum > 0
      AND NOT a.attisdropped;

    IF actual_columns IS DISTINCT FROM ARRAY[
        'metric_date', 'is_historical', 'reporting_source', 'bookings_count',
        'prospecting_bookings_count', 'confirmed_bookings_count',
        'cancelled_bookings_count', 'completed_bookings_count', 'total_final_amount',
        'historical_bookings_count', 'historical_agreed_amount'
    ]::TEXT[] OR actual_types IS DISTINCT FROM ARRAY[
        'date', 'boolean', 'character varying(50)', 'integer', 'integer', 'integer',
        'integer', 'integer', 'numeric(14,2)', 'integer', 'numeric(14,2)'
    ]::TEXT[] THEN
        RAISE EXCEPTION '0063 verifier: booking stay-view dictionary is invalid: % / %',
            actual_columns, actual_types;
    END IF;

    SELECT
        ARRAY_AGG(a.attname ORDER BY a.attnum),
        ARRAY_AGG(pg_catalog.format_type(a.atttypid, a.atttypmod) ORDER BY a.attnum)
    INTO actual_columns, actual_types
    FROM pg_catalog.pg_attribute a
    WHERE a.attrelid = 'reporting_finance_stay_daily_summary'::regclass
      AND a.attnum > 0
      AND NOT a.attisdropped;

    IF actual_columns IS DISTINCT FROM ARRAY[
        'metric_date', 'is_historical', 'reporting_source', 'bookings_count',
        'bookings_with_invoice_count', 'total_invoiced_amount',
        'invoice_linked_paid_amount', 'total_remaining_amount',
        'ordinary_orphan_payment_count', 'ordinary_orphan_payment_amount',
        'historical_bookings_count', 'historical_agreed_amount'
    ]::TEXT[] OR actual_types IS DISTINCT FROM ARRAY[
        'date', 'boolean', 'character varying(50)', 'integer', 'integer',
        'numeric(14,2)', 'numeric(14,2)', 'numeric(14,2)', 'integer',
        'numeric(14,2)', 'integer', 'numeric(14,2)'
    ]::TEXT[] THEN
        RAISE EXCEPTION '0063 verifier: finance stay-view dictionary is invalid: % / %',
            actual_columns, actual_types;
    END IF;

    SELECT
        ARRAY_AGG(a.attname ORDER BY a.attnum),
        ARRAY_AGG(pg_catalog.format_type(a.atttypid, a.atttypmod) ORDER BY a.attnum)
    INTO actual_columns, actual_types
    FROM pg_catalog.pg_attribute a
    WHERE a.attrelid = 'reporting_historical_entry_reconciliation'::regclass
      AND a.attnum > 0
      AND NOT a.attisdropped;

    IF actual_columns IS DISTINCT FROM ARRAY[
        'stay_month', 'recorded_month', 'actual_booked_month', 'original_source',
        'historical_bookings_count', 'historical_agreed_amount', 'entry_lag_days_p50',
        'entry_lag_days_max', 'invoice_count', 'invoiced_amount',
        'invoice_linked_paid_amount', 'historical_payment_evidence_count',
        'historical_payment_evidence_amount',
        'historical_payment_evidence_first_paid_date',
        'historical_payment_evidence_last_paid_date'
    ]::TEXT[] OR actual_types IS DISTINCT FROM ARRAY[
        'date', 'date', 'date', 'character varying(50)', 'integer', 'numeric(14,2)',
        'numeric(10,2)', 'integer', 'integer', 'numeric(14,2)', 'numeric(14,2)',
        'integer', 'numeric(14,2)', 'date', 'date'
    ]::TEXT[] THEN
        RAISE EXCEPTION '0063 verifier: reconciliation-view dictionary is invalid: % / %',
            actual_columns, actual_types;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM pg_catalog.pg_class c
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = current_schema()
          AND c.relkind IN ('r', 'p')
          AND c.relname IN (
              'reporting_booking_stay_daily_summary',
              'reporting_finance_stay_daily_summary',
              'reporting_historical_entry_reconciliation'
          )
    ) THEN
        RAISE EXCEPTION '0063 verifier: HB-08A2 created a write-side relation';
    END IF;

    SELECT pg_get_viewdef('reporting_finance_daily_summary'::regclass, TRUE)
    INTO definition;

    IF definition !~* 'NOT (p\.)?is_historical_record'
       OR definition !~* 'is_historical_record'
       OR definition !~* '(p\.)?invoice_id IS NULL'
       OR definition !~* 'date\((p\.)?paid_at\)' THEN
        RAISE EXCEPTION '0063 verifier: finance evidence/settlement predicates are missing';
    END IF;

    SELECT pg_get_viewdef('reporting_booking_stay_daily_summary'::regclass, TRUE)
    INTO definition;

    IF definition !~* 'check_in_date'
       OR definition !~* 'original_source'
       OR definition !~* 'is_historical' THEN
        RAISE EXCEPTION '0063 verifier: stay-axis/provenance expression is invalid';
    END IF;

    SELECT pg_get_viewdef('reporting_historical_entry_reconciliation'::regclass, TRUE)
    INTO definition;

    IF definition !~* 'actual_booked_at'
       OR definition !~* 'original_source'
       OR definition !~* 'is_historical_record'
       OR definition !~* 'invoice_id IS NULL' THEN
        RAISE EXCEPTION '0063 verifier: reconciliation dictionary or evidence predicate is invalid';
    END IF;
END $$;

SELECT '0063 historical reporting read-model verification passed' AS verification_result;
