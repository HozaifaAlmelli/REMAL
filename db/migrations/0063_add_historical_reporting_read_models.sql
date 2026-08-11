-- Migration: 0063_add_historical_reporting_read_models
-- HB-08A2 recorded/stay reporting axes and per-booking reconciliation.
-- Read-only views only; no write-side historical domain changes.
-- Finance aggregation by booking intentionally prevents invoice fan-out from
-- multiplying one owner payout across multiple active invoices.

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
                                                                     AS historical_agreed_amount,
    COUNT(*) FILTER (
        WHERE b.is_historical AND b.original_source = 'legacy_system'
    )::INT                                                           AS historical_legacy_system_bookings_count,
    COUNT(*) FILTER (
        WHERE b.is_historical AND b.original_source = 'external_platform'
    )::INT                                                           AS historical_external_platform_bookings_count,
    COUNT(*) FILTER (
        WHERE b.is_historical AND b.original_source = 'offline_record'
    )::INT                                                           AS historical_offline_record_bookings_count,
    COUNT(*) FILTER (
        WHERE b.is_historical
          AND (b.original_source IS NULL OR b.original_source NOT IN (
              'legacy_system', 'external_platform', 'offline_record'
          ))
    )::INT                                                           AS historical_other_source_bookings_count
FROM bookings b
GROUP BY DATE(b.created_at), b.source;

COMMENT ON VIEW reporting_booking_daily_summary IS
    'Recorded booking axis keyed by DATE(bookings.created_at). The original '
    'eight-column prefix is preserved; historical provenance uses original_source.';

CREATE VIEW reporting_booking_stay_daily_summary AS
SELECT
    b.check_in_date                                                  AS metric_date,
    b.source                                                         AS booking_source,
    COUNT(*)::INT                                                    AS bookings_count,
    COUNT(*) FILTER (WHERE b.booking_status = 'prospecting')::INT    AS prospecting_bookings_count,
    COUNT(*) FILTER (WHERE b.booking_status = 'confirmed')::INT      AS confirmed_bookings_count,
    COUNT(*) FILTER (WHERE b.booking_status = 'cancelled')::INT      AS cancelled_bookings_count,
    COUNT(*) FILTER (WHERE b.booking_status = 'completed')::INT      AS completed_bookings_count,
    COALESCE(SUM(b.final_amount), 0)::DECIMAL(14,2)                  AS total_final_amount,
    COUNT(*) FILTER (WHERE b.is_historical)::INT                     AS historical_bookings_count,
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
GROUP BY b.check_in_date, b.source;

COMMENT ON VIEW reporting_booking_stay_daily_summary IS
    'Stay-start booking axis keyed by check_in_date and booking source. Historical '
    'components are additive measures; no per-night allocation is made.';

CREATE OR REPLACE VIEW reporting_finance_daily_summary AS
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
),
historical_evidence AS (
    SELECT
        p.booking_id,
        COUNT(*)::INT                                                AS evidence_count,
        COALESCE(SUM(p.amount), 0)::DECIMAL(14,2)                    AS evidence_amount
    FROM payments p
    WHERE p.payment_status = 'paid'
      AND p.is_historical_record
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
)
SELECT
    DATE(b.created_at)                                               AS metric_date,
    COUNT(*) FILTER (WHERE COALESCE(it.invoice_count, 0) > 0)::INT   AS bookings_with_invoice_count,
    COALESCE(SUM(it.invoiced_amount), 0)::DECIMAL(14,2)              AS total_invoiced_amount,
    COALESCE(SUM(ilp.paid_amount), 0)::DECIMAL(14,2)                 AS total_paid_amount,
    (COALESCE(SUM(it.invoiced_amount), 0)
     - COALESCE(SUM(ilp.paid_amount), 0))::DECIMAL(14,2)             AS total_remaining_amount,
    COALESCE(SUM(pt.pending_payout_amount), 0)::DECIMAL(14,2)        AS total_pending_payout_amount,
    COALESCE(SUM(pt.scheduled_payout_amount), 0)::DECIMAL(14,2)      AS total_scheduled_payout_amount,
    COALESCE(SUM(pt.paid_payout_amount), 0)::DECIMAL(14,2)           AS total_paid_payout_amount,
    COUNT(*) FILTER (
        WHERE b.is_historical AND COALESCE(it.invoice_count, 0) > 0
    )::INT                                                           AS historical_bookings_with_invoice_count,
    COALESCE(SUM(it.invoiced_amount) FILTER (WHERE b.is_historical), 0)::DECIMAL(14,2)
                                                                      AS historical_invoiced_amount,
    COALESCE(SUM(ilp.paid_amount) FILTER (WHERE b.is_historical), 0)::DECIMAL(14,2)
                                                                      AS historical_invoice_linked_paid_amount,
    (COALESCE(SUM(it.invoiced_amount) FILTER (WHERE b.is_historical), 0)
     - COALESCE(SUM(ilp.paid_amount) FILTER (WHERE b.is_historical), 0))::DECIMAL(14,2)
                                                                      AS historical_remaining_amount,
    COALESCE(SUM(oop.payment_count), 0)::INT                         AS ordinary_orphan_payment_count,
    COALESCE(SUM(oop.paid_amount), 0)::DECIMAL(14,2)                AS ordinary_orphan_payment_amount,
    COALESCE(SUM(oop.payment_count) FILTER (WHERE b.is_historical), 0)::INT
                                                                      AS historical_booking_ordinary_orphan_payment_count,
    COALESCE(SUM(oop.paid_amount) FILTER (WHERE b.is_historical), 0)::DECIMAL(14,2)
                                                                      AS historical_booking_ordinary_orphan_payment_amount,
    COALESCE(SUM(he.evidence_count), 0)::INT                         AS historical_payment_evidence_count,
    COALESCE(SUM(he.evidence_amount), 0)::DECIMAL(14,2)             AS historical_payment_evidence_amount,
    COALESCE(SUM(b.agreed_amount) FILTER (WHERE b.is_historical), 0)::DECIMAL(14,2)
                                                                      AS historical_agreed_amount
FROM bookings b
LEFT JOIN invoice_totals it ON it.booking_id = b.id
LEFT JOIN invoice_linked_paid ilp ON ilp.booking_id = b.id
LEFT JOIN ordinary_orphan_paid oop ON oop.booking_id = b.id
LEFT JOIN historical_evidence he ON he.booking_id = b.id
LEFT JOIN payout_totals pt ON pt.booking_id = b.id
GROUP BY DATE(b.created_at);

COMMENT ON VIEW reporting_finance_daily_summary IS
    'Recorded finance axis keyed only by DATE(bookings.created_at). The original '
    'eight-column prefix is preserved. Evidence is associated through its booking '
    'recorded bucket and never creates a payment-date row. Payouts are pre-aggregated '
    'per booking to prevent invoice fan-out multiplication.';

CREATE VIEW reporting_finance_stay_daily_summary AS
WITH active_invoice_totals AS (
    SELECT
        i.booking_id,
        COUNT(*)::INT                                                AS invoice_count,
        COALESCE(SUM(i.total_amount), 0)::DECIMAL(14,2)              AS invoiced_amount
    FROM invoices i
    WHERE i.invoice_status NOT IN ('cancelled', 'superseded')
    GROUP BY i.booking_id
)
SELECT
    b.check_in_date                                                   AS metric_date,
    b.source                                                          AS booking_source,
    COUNT(*) FILTER (WHERE COALESCE(ait.invoice_count, 0) > 0)::INT   AS bookings_with_invoice_count,
    COALESCE(SUM(ait.invoiced_amount), 0)::DECIMAL(14,2)              AS total_invoiced_amount,
    COALESCE(SUM(b.final_amount), 0)::DECIMAL(14,2)                   AS total_final_amount,
    COUNT(*) FILTER (WHERE b.is_historical)::INT                      AS historical_bookings_count,
    COALESCE(SUM(b.agreed_amount) FILTER (WHERE b.is_historical), 0)::DECIMAL(14,2)
                                                                       AS historical_agreed_amount,
    COALESCE(SUM(ait.invoiced_amount) FILTER (WHERE b.is_historical), 0)::DECIMAL(14,2)
                                                                       AS historical_invoiced_amount,
    COUNT(*) FILTER (
        WHERE b.is_historical AND COALESCE(ait.invoice_count, 0) > 0
    )::INT                                                            AS historical_bookings_with_invoice_count
FROM bookings b
LEFT JOIN active_invoice_totals ait ON ait.booking_id = b.id
GROUP BY b.check_in_date, b.source;

COMMENT ON VIEW reporting_finance_stay_daily_summary IS
    'Stay-period contracted and invoiced value keyed by check_in_date and booking '
    'source. Cash, settlement, remaining balance and evidence measures are excluded.';

CREATE VIEW reporting_historical_entry_reconciliation AS
WITH active_invoice_totals AS (
    SELECT
        i.booking_id,
        COALESCE(SUM(i.total_amount), 0)::DECIMAL(14,2)              AS invoiced_amount
    FROM invoices i
    WHERE i.invoice_status NOT IN ('cancelled', 'superseded')
    GROUP BY i.booking_id
),
ordinary_invoice_linked_paid AS (
    SELECT
        p.booking_id,
        COALESCE(SUM(p.amount), 0)::DECIMAL(14,2)                    AS paid_amount
    FROM payments p
    JOIN invoices i ON i.id = p.invoice_id
    WHERE p.payment_status = 'paid'
      AND NOT p.is_historical_record
      AND i.invoice_status NOT IN ('cancelled', 'superseded')
    GROUP BY p.booking_id
),
ordinary_unlinked_paid AS (
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
),
owner_corrections AS (
    SELECT
        c.booking_id,
        COUNT(*)::INT                                                AS correction_count,
        MAX(c.corrected_at)                                          AS last_corrected_at
    FROM historical_owner_attribution_corrections c
    GROUP BY c.booking_id
)
SELECT
    b.id                                                              AS booking_id,
    b.created_at                                                      AS recorded_at,
    b.actual_booked_at                                                AS actual_booked_at,
    (DATE(b.created_at) - b.actual_booked_at)::INT                    AS entry_lag_days,
    b.check_in_date                                                   AS stay_start,
    b.check_out_date                                                  AS stay_end,
    (b.check_out_date - b.check_in_date)::INT                         AS stay_nights,
    b.source                                                          AS booking_source,
    b.original_source                                                 AS original_source,
    b.historical_entry_reason                                         AS historical_entry_reason,
    b.booking_status                                                  AS booking_status,
    b.unit_id                                                         AS unit_id,
    b.owner_id                                                        AS owner_id,
    b.agreed_amount::DECIMAL(14,2)                                   AS agreed_amount,
    COALESCE(ait.invoiced_amount, 0)::DECIMAL(14,2)                  AS active_invoice_amount,
    COALESCE(oilp.paid_amount, 0)::DECIMAL(14,2)                     AS ordinary_invoice_linked_paid_amount,
    COALESCE(oup.payment_count, 0)::INT                              AS ordinary_unlinked_paid_count,
    COALESCE(oup.paid_amount, 0)::DECIMAL(14,2)                     AS ordinary_unlinked_paid_amount,
    COALESCE(he.evidence_count, 0)::INT                              AS historical_payment_evidence_count,
    COALESCE(he.evidence_amount, 0)::DECIMAL(14,2)                  AS historical_payment_evidence_amount,
    he.first_paid_date                                                AS first_evidence_paid_date,
    he.last_paid_date                                                 AS last_evidence_paid_date,
    COALESCE(oc.correction_count, 0)::INT                            AS owner_attribution_correction_count,
    oc.last_corrected_at                                              AS last_owner_attribution_corrected_at
FROM bookings b
LEFT JOIN active_invoice_totals ait ON ait.booking_id = b.id
LEFT JOIN ordinary_invoice_linked_paid oilp ON oilp.booking_id = b.id
LEFT JOIN ordinary_unlinked_paid oup ON oup.booking_id = b.id
LEFT JOIN historical_evidence he ON he.booking_id = b.id
LEFT JOIN owner_corrections oc ON oc.booking_id = b.id
WHERE b.is_historical;

COMMENT ON VIEW reporting_historical_entry_reconciliation IS
    'One PII-free audit row per historical booking with record, stay, finance, '
    'evidence and owner-attribution correction facts.';

COMMIT;
