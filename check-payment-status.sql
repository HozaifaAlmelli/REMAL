-- Check payment status for the booking
SELECT 
    p.id as payment_id,
    p.booking_id,
    p.invoice_id,
    p.amount,
    p.payment_status,
    p.payment_status = 'paid' as matches_lowercase_paid,
    p.payment_status = 'Paid' as matches_capitalized_paid,
    i.invoice_status,
    b.booking_status
FROM payments p
LEFT JOIN invoices i ON i.id = p.invoice_id
LEFT JOIN bookings b ON b.id = p.booking_id
WHERE p.amount = 5500
ORDER BY p.created_at DESC
LIMIT 5;

-- Check what the view returns
SELECT *
FROM owner_portal_finance_overview
WHERE invoiced_amount = 5500
LIMIT 5;
