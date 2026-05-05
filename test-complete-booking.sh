#!/bin/bash

# Test script to create and complete a booking for finance testing
# This script will create a booking, confirm it, check in, complete it, 
# then create an invoice and payment

set -e  # Exit on error

API_BASE="${API_BASE:-http://localhost:5000}"
echo "Using API: $API_BASE"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Complete Booking Test Script${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Step 1: Login as Sales Admin
echo -e "${YELLOW}Step 1: Logging in as Sales Admin...${NC}"
LOGIN_RESPONSE=$(curl -s -X POST "$API_BASE/api/auth/admin/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "sales.dev@rental.local",
    "password": "Admin@1234"
  }')

ADMIN_TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.data.token')

if [ "$ADMIN_TOKEN" == "null" ] || [ -z "$ADMIN_TOKEN" ]; then
  echo "❌ Login failed!"
  echo $LOGIN_RESPONSE | jq
  exit 1
fi

echo -e "${GREEN}✓ Logged in successfully${NC}"
echo ""

# Step 2: Create a booking
echo -e "${YELLOW}Step 2: Creating a new booking...${NC}"
BOOKING_RESPONSE=$(curl -s -X POST "$API_BASE/api/internal/bookings" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    "unitId": "00000000-0000-0000-0000-000000000001",
    "checkInDate": "2026-06-01",
    "checkOutDate": "2026-06-07",
    "guestCount": 2,
    "source": "direct",
    "baseAmount": 10800.00,
    "finalAmount": 10800.00
  }')

BOOKING_ID=$(echo $BOOKING_RESPONSE | jq -r '.data.id')

if [ "$BOOKING_ID" == "null" ] || [ -z "$BOOKING_ID" ]; then
  echo "❌ Booking creation failed!"
  echo $BOOKING_RESPONSE | jq
  exit 1
fi

echo -e "${GREEN}✓ Booking created: $BOOKING_ID${NC}"
echo ""

# Step 3: Confirm the booking
echo -e "${YELLOW}Step 3: Confirming booking...${NC}"
curl -s -X POST "$API_BASE/api/internal/bookings/$BOOKING_ID/confirm" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"notes": "Confirmed for testing"}' > /dev/null

echo -e "${GREEN}✓ Booking confirmed${NC}"
echo ""

# Step 4: Check in the booking
echo -e "${YELLOW}Step 4: Checking in guest...${NC}"
curl -s -X POST "$API_BASE/api/internal/bookings/$BOOKING_ID/check-in" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"notes": "Guest checked in"}' > /dev/null

echo -e "${GREEN}✓ Guest checked in${NC}"
echo ""

# Step 5: Complete the booking
echo -e "${YELLOW}Step 5: Completing booking...${NC}"
curl -s -X POST "$API_BASE/api/internal/bookings/$BOOKING_ID/complete" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"notes": "Guest checked out successfully"}' > /dev/null

echo -e "${GREEN}✓ Booking completed${NC}"
echo ""

# Step 6: Create invoice
echo -e "${YELLOW}Step 6: Creating invoice...${NC}"
INVOICE_NUMBER="INV-TEST-$(date +%s)"
INVOICE_RESPONSE=$(curl -s -X POST "$API_BASE/api/internal/invoices/drafts" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"bookingId\": \"$BOOKING_ID\",
    \"invoiceNumber\": \"$INVOICE_NUMBER\"
  }")

INVOICE_ID=$(echo $INVOICE_RESPONSE | jq -r '.data.id')

if [ "$INVOICE_ID" == "null" ] || [ -z "$INVOICE_ID" ]; then
  echo "❌ Invoice creation failed!"
  echo $INVOICE_RESPONSE | jq
  exit 1
fi

echo -e "${GREEN}✓ Invoice created: $INVOICE_ID${NC}"
echo ""

# Step 7: Issue invoice
echo -e "${YELLOW}Step 7: Issuing invoice...${NC}"
curl -s -X POST "$API_BASE/api/internal/invoices/$INVOICE_ID/issue" \
  -H "Authorization: Bearer $ADMIN_TOKEN" > /dev/null

echo -e "${GREEN}✓ Invoice issued${NC}"
echo ""

# Step 8: Create payment
echo -e "${YELLOW}Step 8: Creating payment...${NC}"
PAYMENT_RESPONSE=$(curl -s -X POST "$API_BASE/api/internal/payments" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"bookingId\": \"$BOOKING_ID\",
    \"invoiceId\": \"$INVOICE_ID\",
    \"paymentMethod\": \"bank_transfer\",
    \"amount\": 10800.00,
    \"referenceNumber\": \"TEST-REF-$(date +%s)\"
  }")

PAYMENT_ID=$(echo $PAYMENT_RESPONSE | jq -r '.data.id')

if [ "$PAYMENT_ID" == "null" ] || [ -z "$PAYMENT_ID" ]; then
  echo "❌ Payment creation failed!"
  echo $PAYMENT_RESPONSE | jq
  exit 1
fi

echo -e "${GREEN}✓ Payment created: $PAYMENT_ID${NC}"
echo ""

# Step 9: Mark payment as paid
echo -e "${YELLOW}Step 9: Marking payment as paid...${NC}"
curl -s -X POST "$API_BASE/api/internal/payments/$PAYMENT_ID/mark-paid" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}' > /dev/null

echo -e "${GREEN}✓ Payment marked as paid${NC}"
echo ""

# Summary
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✅ SUCCESS! All steps completed${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo "📋 Summary:"
echo "  Booking ID:  $BOOKING_ID"
echo "  Invoice ID:  $INVOICE_ID"
echo "  Payment ID:  $PAYMENT_ID"
echo "  Amount:      10,800.00 EGP"
echo ""
echo "🔍 Next Steps:"
echo "  1. Login to Owner Portal:"
echo "     Phone: +201001234567"
echo "     Password: Admin@1234"
echo ""
echo "  2. Go to: http://localhost:3000/owner/finance"
echo ""
echo "  3. You should see:"
echo "     - Invoice Status: 'paid'"
echo "     - Paid Amount: 10,800.00 EGP"
echo "     - Remaining: 0.00 EGP"
echo ""
