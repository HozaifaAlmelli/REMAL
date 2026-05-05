# Test script to create and complete a booking for finance testing
# This script will create a booking, confirm it, check in, complete it, 
# then create an invoice and payment

$ErrorActionPreference = "Stop"

$API_BASE = if ($env:API_BASE) { $env:API_BASE } else { "http://localhost:5000" }
Write-Host "Using API: $API_BASE" -ForegroundColor Cyan

Write-Host ""
Write-Host "========================================" -ForegroundColor Blue
Write-Host "  Complete Booking Test Script" -ForegroundColor Blue
Write-Host "========================================" -ForegroundColor Blue
Write-Host ""

# Step 1: Login as Sales Admin
Write-Host "Step 1: Logging in as Sales Admin..." -ForegroundColor Yellow
$loginBody = @{
    email = "sales.dev@rental.local"
    password = "Admin@1234"
} | ConvertTo-Json

$loginResponse = Invoke-RestMethod -Uri "$API_BASE/api/auth/admin/login" `
    -Method Post `
    -ContentType "application/json" `
    -Body $loginBody

$ADMIN_TOKEN = $loginResponse.data.token

if (-not $ADMIN_TOKEN) {
    Write-Host "❌ Login failed!" -ForegroundColor Red
    Write-Host ($loginResponse | ConvertTo-Json)
    exit 1
}

Write-Host "✓ Logged in successfully" -ForegroundColor Green
Write-Host ""

# Step 2: Create a booking
Write-Host "Step 2: Creating a new booking..." -ForegroundColor Yellow
$bookingBody = @{
    clientId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
    unitId = "00000000-0000-0000-0000-000000000001"
    checkInDate = "2026-06-01"
    checkOutDate = "2026-06-07"
    guestCount = 2
    source = "direct"
    baseAmount = 10800.00
    finalAmount = 10800.00
} | ConvertTo-Json

$headers = @{
    "Authorization" = "Bearer $ADMIN_TOKEN"
    "Content-Type" = "application/json"
}

$bookingResponse = Invoke-RestMethod -Uri "$API_BASE/api/internal/bookings" `
    -Method Post `
    -Headers $headers `
    -Body $bookingBody

$BOOKING_ID = $bookingResponse.data.id

if (-not $BOOKING_ID) {
    Write-Host "❌ Booking creation failed!" -ForegroundColor Red
    Write-Host ($bookingResponse | ConvertTo-Json)
    exit 1
}

Write-Host "✓ Booking created: $BOOKING_ID" -ForegroundColor Green
Write-Host ""

# Step 3: Confirm the booking
Write-Host "Step 3: Confirming booking..." -ForegroundColor Yellow
$confirmBody = @{ notes = "Confirmed for testing" } | ConvertTo-Json
Invoke-RestMethod -Uri "$API_BASE/api/internal/bookings/$BOOKING_ID/confirm" `
    -Method Post `
    -Headers $headers `
    -Body $confirmBody | Out-Null

Write-Host "✓ Booking confirmed" -ForegroundColor Green
Write-Host ""

# Step 4: Check in the booking
Write-Host "Step 4: Checking in guest..." -ForegroundColor Yellow
$checkInBody = @{ notes = "Guest checked in" } | ConvertTo-Json
Invoke-RestMethod -Uri "$API_BASE/api/internal/bookings/$BOOKING_ID/check-in" `
    -Method Post `
    -Headers $headers `
    -Body $checkInBody | Out-Null

Write-Host "✓ Guest checked in" -ForegroundColor Green
Write-Host ""

# Step 5: Complete the booking
Write-Host "Step 5: Completing booking..." -ForegroundColor Yellow
$completeBody = @{ notes = "Guest checked out successfully" } | ConvertTo-Json
Invoke-RestMethod -Uri "$API_BASE/api/internal/bookings/$BOOKING_ID/complete" `
    -Method Post `
    -Headers $headers `
    -Body $completeBody | Out-Null

Write-Host "✓ Booking completed" -ForegroundColor Green
Write-Host ""

# Step 6: Create invoice
Write-Host "Step 6: Creating invoice..." -ForegroundColor Yellow
$timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$invoiceBody = @{
    bookingId = $BOOKING_ID
    invoiceNumber = "INV-TEST-$timestamp"
} | ConvertTo-Json

$invoiceResponse = Invoke-RestMethod -Uri "$API_BASE/api/internal/invoices/drafts" `
    -Method Post `
    -Headers $headers `
    -Body $invoiceBody

$INVOICE_ID = $invoiceResponse.data.id

if (-not $INVOICE_ID) {
    Write-Host "❌ Invoice creation failed!" -ForegroundColor Red
    Write-Host ($invoiceResponse | ConvertTo-Json)
    exit 1
}

Write-Host "✓ Invoice created: $INVOICE_ID" -ForegroundColor Green
Write-Host ""

# Step 7: Issue invoice
Write-Host "Step 7: Issuing invoice..." -ForegroundColor Yellow
Invoke-RestMethod -Uri "$API_BASE/api/internal/invoices/$INVOICE_ID/issue" `
    -Method Post `
    -Headers $headers | Out-Null

Write-Host "✓ Invoice issued" -ForegroundColor Green
Write-Host ""

# Step 8: Create payment
Write-Host "Step 8: Creating payment..." -ForegroundColor Yellow
$paymentBody = @{
    bookingId = $BOOKING_ID
    invoiceId = $INVOICE_ID
    paymentMethod = "bank_transfer"
    amount = 10800.00
    referenceNumber = "TEST-REF-$timestamp"
} | ConvertTo-Json

$paymentResponse = Invoke-RestMethod -Uri "$API_BASE/api/internal/payments" `
    -Method Post `
    -Headers $headers `
    -Body $paymentBody

$PAYMENT_ID = $paymentResponse.data.id

if (-not $PAYMENT_ID) {
    Write-Host "❌ Payment creation failed!" -ForegroundColor Red
    Write-Host ($paymentResponse | ConvertTo-Json)
    exit 1
}

Write-Host "✓ Payment created: $PAYMENT_ID" -ForegroundColor Green
Write-Host ""

# Step 9: Mark payment as paid
Write-Host "Step 9: Marking payment as paid..." -ForegroundColor Yellow
$markPaidBody = @{} | ConvertTo-Json
Invoke-RestMethod -Uri "$API_BASE/api/internal/payments/$PAYMENT_ID/mark-paid" `
    -Method Post `
    -Headers $headers `
    -Body $markPaidBody | Out-Null

Write-Host "✓ Payment marked as paid" -ForegroundColor Green
Write-Host ""

# Summary
Write-Host "========================================" -ForegroundColor Blue
Write-Host "✅ SUCCESS! All steps completed" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Blue
Write-Host ""
Write-Host "📋 Summary:"
Write-Host "  Booking ID:  $BOOKING_ID"
Write-Host "  Invoice ID:  $INVOICE_ID"
Write-Host "  Payment ID:  $PAYMENT_ID"
Write-Host "  Amount:      10,800.00 EGP"
Write-Host ""
Write-Host "🔍 Next Steps:"
Write-Host "  1. Login to Owner Portal:"
Write-Host "     Phone: +201001234567"
Write-Host "     Password: Admin@1234"
Write-Host ""
Write-Host "  2. Go to: http://localhost:3000/owner/finance"
Write-Host ""
Write-Host "  3. You should see:"
Write-Host "     - Invoice Status: 'paid'"
Write-Host "     - Paid Amount: 10,800.00 EGP"
Write-Host "     - Remaining: 0.00 EGP"
Write-Host ""
