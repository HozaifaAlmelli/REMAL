-- ============================================================================
-- Migration:   0050_fix_owner_portal_finance_view_case_sensitivity
-- Title:       Fix case sensitivity in owner_portal_finance_overview view
-- Database:    PostgreSQL 16
-- Created:     2026-05-06
-- ============================================================================
--
-- PURPOSE:
--   Fix the paid_amount calculation in owner_portal_finance_overview view
--   to handle case-insensitive payment status comparison.
--   Database stores payment_status as lowercase ('paid'), but the view
--   needs to match regardless of case.
--
-- CHANGES:
--   - Update paid_amount subquery to use LOWER() for case-insensitive match
--   - Ensures payments with status 'paid', 'Paid', or 'PAID' are all counted
-- ============================================================================

CREATE OR REPLACE VIEW owner_portal_finance_overview AS
WITH booking_finance AS (
    SELECT
        b.owner_id                                          AS owner_id,
        b.id                                                AS booking_id,
        b.unit_id                                           AS unit_id,
        i.id                                                AS invoice_id,
        i.invoice_status                                    AS invoice_status,
        COALESCE(i.total_amount, 0)                         AS invoiced_amount,
        COALESCE((
            SELECT SUM(p.amount)
            FROM payments p
            WHERE p.invoice_id = i.id
              AND LOWER(p.payment_status) = 'paid'  -- Case-insensitive comparison
        ), 0)                                               AS paid_amount,
        op.id                                               AS payout_id,
        op.payout_status                                    AS payout_status,
        op.payout_amount                                    AS payout_amount,
        op.scheduled_at                                     AS payout_scheduled_at,
        op.paid_at                                          AS payout_paid_at
    FROM bookings b
    LEFT JOIN invoices i
        ON i.booking_id = b.id
        AND LOWER(i.invoice_status) <> 'cancelled'  -- Case-insensitive comparison
    LEFT JOIN owner_payouts op
        ON op.booking_id = b.id
)
SELECT
    owner_id,
    booking_id,
    unit_id,
    invoice_id,
    invoice_status,
    invoiced_amount,
    paid_amount,
    invoiced_amount - paid_amount           AS remaining_amount,
    payout_id,
    payout_status,
    payout_amount,
    payout_scheduled_at,
    payout_paid_at
FROM booking_finance;

COMMENT ON VIEW owner_portal_finance_overview IS
    'Owner Portal read model: booking-level finance snapshot per owner. '
    'paid_amount = SUM of paid payments (case-insensitive) linked to active invoice. '
    'Cancelled invoices excluded (case-insensitive). No refund/tax/bank fields. '
    'Source: bookings + invoices + payments + owner_payouts. '
    'Updated: 2026-05-06 - Added case-insensitive status matching.';
