-- Migration: 0063_add_historical_reporting_read_models
-- HB-08A2 recorded/stay reporting axes and historical reconciliation.
-- Read-only views only; no write-side table or historical domain data changes.

BEGIN;

CREATE OR REPLACE VIEW reporting_booking_daily_summary AS
SELECT
    DATE(b.created_at)                                              AS metric_date,
    b.source                                                        AS booking_source,
    COUNT(*)                                                        AS bookings_created_count,
    COUNT(*) FILTER (WHERE b.booking_status = 'prospecting')        AS prospecting_bookings_count,
    COUNT(*) FILTER (WHERE b.booking_status = 'confirmed')          AS confirmed_bookings_count,
    COUNT(*) FILTER (WHERE b.booking_status = 'cancelled')          AS cancelled_bookings_count,
    COUNT(*) FILTER (WHERE b.booking_status = 'completed')          AS completed_bookings_count,
    COALESCE(SUM(b.final_amount), 0)::DECIMAL(14,2)                 AS total_final_amount,
    COUNT(*) FILTER (WHERE b.is_historical)::INT                    AS historical_bookings_count,
    COUNT(*) FILTER (WHERE b.is_historical AND b.booking_status = 'prospecting')::INT
                                                                     AS historical_prospecting_bookings_count,
    COUNT(*) FILTER (WHERE b.is_historical AND b.booking_status = 'confirmed')::INT
                                                                     AS historical_confirmed_bookings_count,
    COUNT(*) FILTER (WHERE b.is_historical AND b.booking_status = 'cancelled')::INT
                                                                     AS historical_cancelled_bookings_count,
    COUNT(*) FILTER (WHERE b.is_historical AND b.booking_status = 'completed')::INT
                                                                     AS historical_completed_bookings_count,
    COALESCE(SUM(b.final_amount) FILTER (WHERE b.is_historical), 0)::DECIMAL(14,2)
                                                                     AS historical_final_amount,
    COALESCE(SUM(b.agreed_amount) FILTER (WHERE b.is_historical), 0)::DECIMAL(14,2)
                                                                     AS historical_agreed_amount
FROM bookings b
GROUP BY
    DATE(b.created_at),
    b.source;

COMMENT ON VIEW reporting_booking_daily_summary IS
    'Recorded-axis booking analytics keyed by DATE(bookings.created_at). '
    'The original eight-column prefix is preserved; appended columns expose '
    'the historical component without redefining created_at.';

CREATE VIEW reporting_booking_stay_daily_summary AS
SELECT
    b.check_in_date                                                  AS metric_date,
    b.is_historical                                                  AS is_historical,
    CASE
        WHEN b.is_historical THEN b.original_source
        ELSE b.source
    END                                                              AS reporting_source,
    COUNT(*)::INT                                                    AS bookings_count,
    COUNT(*) FILTER (WHERE b.booking_status = 'prospecting')::INT    AS prospecting_bookings_count,
    COUNT(*) FILTER (WHERE b.booking_status = 'confirmed')::INT      AS confirmed_bookings_count,
    COUNT(*) FILTER (WHERE b.booking_status = 'cancelled')::INT      AS cancelled_bookings_count,
    COUNT(*) FILTER (WHERE b.booking_status = 'completed')::INT      AS completed_bookings_count,
    COALESCE(SUM(b.final_amount), 0)::DECIMAL(14,2)                  AS total_final_amount,
    COUNT(*) FILTER (WHERE b.is_historical)::INT                     AS historical_bookings_count,
    COALESCE(SUM(b.agreed_amount) FILTER (WHERE b.is_historical), 0)::DECIMAL(14,2)
                                                                      AS historical_agreed_amount
FROM bookings b
GROUP BY
    b.check_in_date,
    b.is_historical,
    CASE
        WHEN b.is_historical THEN b.original_source
        ELSE b.source
    END;

COMMENT ON VIEW reporting_booking_stay_daily_summary IS
    'Stay-start booking analytics keyed once by bookings.check_in_date. '
    'Historical provenance uses original_source; no per-night allocation is made.';

CREATE OR REPLACE VIEW reporting_finance_daily_summary AS
WITH active_invoices AS (
    SELECT
        i.id,
        i.booking_id,
        i.total_amount
    FROM invoices i
    WHERE i.invoice_status NOT IN ('cancelled', 'superseded')
),
invoice_totals AS (
    SELECT
        ai.booking_id,
        COUNT(*)::INT                                                AS invoice_count,
        COALESCE(SUM(ai.total_amount), 0)::DECIMAL(14,2)             AS invoiced_amount
    FROM active_invoices ai
    GROUP BY ai.booking_id
),
invoice_linked_paid AS (
    SELECT
        ai.booking_id,
        COALESCE(SUM(p.amount), 0)::DECIMAL(14,2)                    AS paid_amount
    FROM active_invoices ai
    JOIN payments p
      ON p.invoice_id = ai.id
     AND p.payment_status = 'paid'
     AND NOT p.is_historical_record
    GROUP BY ai.booking_id
),
ordinary_orphan_paid AS (
    SELECT
        p.booking_id,
        COUNT(*)::INT                                                AS payment_count,
        COALESCE(SUM(p.amount), 0)::DECIMAL(14,2)                    AS paid_amount
    FROM payments p
    WHERE p.payment_status = 'paid'
      AND NOT p.is_historical_record
      AND p.invoice_id IS NULL
    GROUP BY p.booking_id
),
payout_totals AS (
    SELECT
        op.booking_id,
        COALESCE(SUM(op.payout_amount) FILTER (WHERE op.payout_status = 'pending'), 0)::DECIMAL(14,2)
                                                                      AS pending_payout_amount,
        COALESCE(SUM(op.payout_amount) FILTER (WHERE op.payout_status = 'scheduled'), 0)::DECIMAL(14,2)
                                                                      AS scheduled_payout_amount,
        COALESCE(SUM(op.payout_amount) FILTER (WHERE op.payout_status = 'paid'), 0)::DECIMAL(14,2)
                                                                      AS paid_payout_amount
    FROM owner_payouts op
    GROUP BY op.booking_id
),
recorded_finance AS (
    SELECT
        DATE(b.created_at)                                           AS metric_date,
        COUNT(*) FILTER (WHERE COALESCE(it.invoice_count, 0) > 0)::INT
                                                                      AS bookings_with_invoice_count,
        COALESCE(SUM(it.invoiced_amount), 0)::DECIMAL(14,2)          AS total_invoiced_amount,
        COALESCE(SUM(ilp.paid_amount), 0)::DECIMAL(14,2)             AS total_paid_amount,
        (COALESCE(SUM(it.invoiced_amount), 0)
         - COALESCE(SUM(ilp.paid_amount), 0))::DECIMAL(14,2)         AS total_remaining_amount,
        COALESCE(SUM(pt.pending_payout_amount), 0)::DECIMAL(14,2)   AS total_pending_payout_amount,
        COALESCE(SUM(pt.scheduled_payout_amount), 0)::DECIMAL(14,2) AS total_scheduled_payout_amount,
        COALESCE(SUM(pt.paid_payout_amount), 0)::DECIMAL(14,2)      AS total_paid_payout_amount,
        COUNT(*) FILTER (
            WHERE b.is_historical AND COALESCE(it.invoice_count, 0) > 0
        )::INT                                                       AS historical_bookings_with_invoice_count,
        COALESCE(SUM(it.invoiced_amount) FILTER (WHERE b.is_historical), 0)::DECIMAL(14,2)
                                                                      AS historical_invoiced_amount,
        COALESCE(SUM(ilp.paid_amount) FILTER (WHERE b.is_historical), 0)::DECIMAL(14,2)
                                                                      AS historical_invoice_linked_paid_amount,
        (COALESCE(SUM(it.invoiced_amount) FILTER (WHERE b.is_historical), 0)
         - COALESCE(SUM(ilp.paid_amount) FILTER (WHERE b.is_historical), 0))::DECIMAL(14,2)
                                                                      AS historical_remaining_amount,
        COALESCE(SUM(oop.payment_count), 0)::INT                     AS ordinary_orphan_payment_count,
        COALESCE(SUM(oop.paid_amount), 0)::DECIMAL(14,2)            AS ordinary_orphan_payment_amount,
        COALESCE(SUM(oop.payment_count) FILTER (WHERE b.is_historical), 0)::INT
                                                                      AS historical_booking_ordinary_orphan_payment_count,
        COALESCE(SUM(oop.paid_amount) FILTER (WHERE b.is_historical), 0)::DECIMAL(14,2)
                                                                      AS historical_booking_ordinary_orphan_payment_amount,
        COALESCE(SUM(b.agreed_amount) FILTER (WHERE b.is_historical), 0)::DECIMAL(14,2)
                                                                      AS historical_agreed_amount
    FROM bookings b
    LEFT JOIN invoice_totals it ON it.booking_id = b.id
    LEFT JOIN invoice_linked_paid ilp ON ilp.booking_id = b.id
    LEFT JOIN ordinary_orphan_paid oop ON oop.booking_id = b.id
    LEFT JOIN payout_totals pt ON pt.booking_id = b.id
    GROUP BY DATE(b.created_at)
),
historical_evidence AS (
    SELECT
        DATE(p.paid_at)                                              AS metric_date,
        COUNT(*)::INT                                                AS evidence_count,
        COALESCE(SUM(p.amount), 0)::DECIMAL(14,2)                    AS evidence_amount
    FROM payments p
    WHERE p.payment_status = 'paid'
      AND p.is_historical_record
      AND p.invoice_id IS NULL
    GROUP BY DATE(p.paid_at)
)
SELECT
    COALESCE(rf.metric_date, he.metric_date)                          AS metric_date,
    COALESCE(rf.bookings_with_invoice_count, 0)::INT                 AS bookings_with_invoice_count,
    COALESCE(rf.total_invoiced_amount, 0)::DECIMAL(14,2)             AS total_invoiced_amount,
    COALESCE(rf.total_paid_amount, 0)::DECIMAL(14,2)                 AS total_paid_amount,
    COALESCE(rf.total_remaining_amount, 0)::DECIMAL(14,2)            AS total_remaining_amount,
    COALESCE(rf.total_pending_payout_amount, 0)::DECIMAL(14,2)       AS total_pending_payout_amount,
    COALESCE(rf.total_scheduled_payout_amount, 0)::DECIMAL(14,2)     AS total_scheduled_payout_amount,
    COALESCE(rf.total_paid_payout_amount, 0)::DECIMAL(14,2)          AS total_paid_payout_amount,
    COALESCE(rf.historical_bookings_with_invoice_count, 0)::INT      AS historical_bookings_with_invoice_count,
    COALESCE(rf.historical_invoiced_amount, 0)::DECIMAL(14,2)        AS historical_invoiced_amount,
    COALESCE(rf.historical_invoice_linked_paid_amount, 0)::DECIMAL(14,2)
                                                                      AS historical_invoice_linked_paid_amount,
    COALESCE(rf.historical_remaining_amount, 0)::DECIMAL(14,2)       AS historical_remaining_amount,
    COALESCE(rf.ordinary_orphan_payment_count, 0)::INT               AS ordinary_orphan_payment_count,
    COALESCE(rf.ordinary_orphan_payment_amount, 0)::DECIMAL(14,2)    AS ordinary_orphan_payment_amount,
    COALESCE(rf.historical_booking_ordinary_orphan_payment_count, 0)::INT
                                                                      AS historical_booking_ordinary_orphan_payment_count,
    COALESCE(rf.historical_booking_ordinary_orphan_payment_amount, 0)::DECIMAL(14,2)
                                                                      AS historical_booking_ordinary_orphan_payment_amount,
    COALESCE(he.evidence_count, 0)::INT                              AS historical_payment_evidence_count,
    COALESCE(he.evidence_amount, 0)::DECIMAL(14,2)                   AS historical_payment_evidence_amount,
    COALESCE(rf.historical_agreed_amount, 0)::DECIMAL(14,2)          AS historical_agreed_amount
FROM recorded_finance rf
FULL OUTER JOIN historical_evidence he
    ON he.metric_date = rf.metric_date;

COMMENT ON VIEW reporting_finance_daily_summary IS
    'Recorded-axis finance analytics. The original eight-column prefix is preserved. '
    'Invoice-linked nonhistorical payments remain platform paid truth; standalone '
    'historical evidence is appended and bucketed independently by payments.paid_at.';

CREATE VIEW reporting_finance_stay_daily_summary AS
WITH active_invoices AS (
    SELECT i.id, i.booking_id, i.total_amount
    FROM invoices i
    WHERE i.invoice_status NOT IN ('cancelled', 'superseded')
),
invoice_totals AS (
    SELECT
        ai.booking_id,
        COUNT(*)::INT                                                AS invoice_count,
        COALESCE(SUM(ai.total_amount), 0)::DECIMAL(14,2)             AS invoiced_amount
    FROM active_invoices ai
    GROUP BY ai.booking_id
),
invoice_linked_paid AS (
    SELECT
        ai.booking_id,
        COALESCE(SUM(p.amount), 0)::DECIMAL(14,2)                    AS paid_amount
    FROM active_invoices ai
    JOIN payments p
      ON p.invoice_id = ai.id
     AND p.payment_status = 'paid'
     AND NOT p.is_historical_record
    GROUP BY ai.booking_id
),
ordinary_orphan_paid AS (
    SELECT
        p.booking_id,
        COUNT(*)::INT                                                AS payment_count,
        COALESCE(SUM(p.amount), 0)::DECIMAL(14,2)                    AS paid_amount
    FROM payments p
    WHERE p.payment_status = 'paid'
      AND NOT p.is_historical_record
      AND p.invoice_id IS NULL
    GROUP BY p.booking_id
)
SELECT
    b.check_in_date                                                   AS metric_date,
    b.is_historical                                                   AS is_historical,
    CASE
        WHEN b.is_historical THEN b.original_source
        ELSE b.source
    END                                                               AS reporting_source,
    COUNT(*)::INT                                                     AS bookings_count,
    COUNT(*) FILTER (WHERE COALESCE(it.invoice_count, 0) > 0)::INT    AS bookings_with_invoice_count,
    COALESCE(SUM(it.invoiced_amount), 0)::DECIMAL(14,2)               AS total_invoiced_amount,
    COALESCE(SUM(ilp.paid_amount), 0)::DECIMAL(14,2)                  AS invoice_linked_paid_amount,
    (COALESCE(SUM(it.invoiced_amount), 0)
     - COALESCE(SUM(ilp.paid_amount), 0))::DECIMAL(14,2)              AS total_remaining_amount,
    COALESCE(SUM(oop.payment_count), 0)::INT                          AS ordinary_orphan_payment_count,
    COALESCE(SUM(oop.paid_amount), 0)::DECIMAL(14,2)                 AS ordinary_orphan_payment_amount,
    COUNT(*) FILTER (WHERE b.is_historical)::INT                      AS historical_bookings_count,
    COALESCE(SUM(b.agreed_amount) FILTER (WHERE b.is_historical), 0)::DECIMAL(14,2)
                                                                       AS historical_agreed_amount
FROM bookings b
LEFT JOIN invoice_totals it ON it.booking_id = b.id
LEFT JOIN invoice_linked_paid ilp ON ilp.booking_id = b.id
LEFT JOIN ordinary_orphan_paid oop ON oop.booking_id = b.id
GROUP BY
    b.check_in_date,
    b.is_historical,
    CASE
        WHEN b.is_historical THEN b.original_source
        ELSE b.source
    END;

COMMENT ON VIEW reporting_finance_stay_daily_summary IS
    'Stay-start finance analytics keyed once by bookings.check_in_date. '
    'Historical agreed value is not allocated per night. Historical payment '
    'evidence is intentionally absent because its business date is payments.paid_at.';

CREATE VIEW reporting_historical_entry_reconciliation AS
WITH active_invoices AS (
    SELECT i.id, i.booking_id, i.total_amount
    FROM invoices i
    WHERE i.invoice_status NOT IN ('cancelled', 'superseded')
),
invoice_totals AS (
    SELECT
        ai.booking_id,
        COUNT(*)::INT                                                AS invoice_count,
        COALESCE(SUM(ai.total_amount), 0)::DECIMAL(14,2)             AS invoiced_amount
    FROM active_invoices ai
    GROUP BY ai.booking_id
),
invoice_linked_paid AS (
    SELECT
        ai.booking_id,
        COALESCE(SUM(p.amount), 0)::DECIMAL(14,2)                    AS paid_amount
    FROM active_invoices ai
    JOIN payments p
      ON p.invoice_id = ai.id
     AND p.payment_status = 'paid'
     AND NOT p.is_historical_record
    GROUP BY ai.booking_id
),
historical_evidence AS (
    SELECT
        p.booking_id,
        COUNT(*)::INT                                                AS evidence_count,
        COALESCE(SUM(p.amount), 0)::DECIMAL(14,2)                    AS evidence_amount,
        MIN(DATE(p.paid_at))                                         AS first_paid_date,
        MAX(DATE(p.paid_at))                                         AS last_paid_date
    FROM payments p
    WHERE p.payment_status = 'paid'
      AND p.is_historical_record
      AND p.invoice_id IS NULL
    GROUP BY p.booking_id
)
SELECT
    DATE_TRUNC('month', b.check_in_date)::DATE                        AS stay_month,
    DATE_TRUNC('month', b.created_at)::DATE                           AS recorded_month,
    DATE_TRUNC('month', b.actual_booked_at)::DATE                     AS actual_booked_month,
    b.original_source                                                 AS original_source,
    COUNT(*)::INT                                                     AS historical_bookings_count,
    COALESCE(SUM(b.agreed_amount), 0)::DECIMAL(14,2)                 AS historical_agreed_amount,
    PERCENTILE_CONT(0.5) WITHIN GROUP (
        ORDER BY (DATE(b.created_at) - b.actual_booked_at)
    )::DECIMAL(10,2)                                                  AS entry_lag_days_p50,
    MAX(DATE(b.created_at) - b.actual_booked_at)::INT                 AS entry_lag_days_max,
    COALESCE(SUM(it.invoice_count), 0)::INT                           AS invoice_count,
    COALESCE(SUM(it.invoiced_amount), 0)::DECIMAL(14,2)              AS invoiced_amount,
    COALESCE(SUM(ilp.paid_amount), 0)::DECIMAL(14,2)                 AS invoice_linked_paid_amount,
    COALESCE(SUM(he.evidence_count), 0)::INT                          AS historical_payment_evidence_count,
    COALESCE(SUM(he.evidence_amount), 0)::DECIMAL(14,2)              AS historical_payment_evidence_amount,
    MIN(he.first_paid_date)                                           AS historical_payment_evidence_first_paid_date,
    MAX(he.last_paid_date)                                            AS historical_payment_evidence_last_paid_date
FROM bookings b
LEFT JOIN invoice_totals it ON it.booking_id = b.id
LEFT JOIN invoice_linked_paid ilp ON ilp.booking_id = b.id
LEFT JOIN historical_evidence he ON he.booking_id = b.id
WHERE b.is_historical
GROUP BY
    DATE_TRUNC('month', b.check_in_date)::DATE,
    DATE_TRUNC('month', b.created_at)::DATE,
    DATE_TRUNC('month', b.actual_booked_at)::DATE,
    b.original_source;

COMMENT ON VIEW reporting_historical_entry_reconciliation IS
    'PII-free historical entry reconciliation by stay, recorded and original '
    'agreement months. Entry lag is recorded date minus actual_booked_at. '
    'Invoice-linked platform settlement and historical evidence remain separate.';

COMMIT;
