# PowerShell script to issue an invoice

# Replace these with your actual values
$invoiceId = "YOUR_INVOICE_ID_HERE"  # Get this from the invoice section
$apiUrl = "http://localhost:5000"

# Get auth token from browser
# 1. Open browser DevTools (F12)
# 2. Go to Application tab → Cookies → http://localhost:3000
# 3. Copy the value of 'auth_token' cookie
$authToken = "YOUR_AUTH_TOKEN_HERE"

Write-Host "Issuing invoice: $invoiceId" -ForegroundColor Cyan

$headers = @{
    "Authorization" = "Bearer $authToken"
    "Content-Type" = "application/json"
}

try {
    $response = Invoke-RestMethod `
        -Uri "$apiUrl/api/internal/invoices/$invoiceId/issue" `
        -Method POST `
        -Headers $headers
    
    Write-Host "✅ Invoice issued successfully!" -ForegroundColor Green
    Write-Host "Invoice Number: $($response.data.invoiceNumber)" -ForegroundColor Green
    Write-Host "Status: $($response.data.invoiceStatus)" -ForegroundColor Green
    Write-Host "Total: $($response.data.totalAmount) EGP" -ForegroundColor Green
}
catch {
    Write-Host "❌ Error issuing invoice:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
}
