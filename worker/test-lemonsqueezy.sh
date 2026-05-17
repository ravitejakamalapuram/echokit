#!/bin/bash
# LemonSqueezy Integration Test Script

echo "🍋 LemonSqueezy Integration Test"
echo "================================"
echo ""

WORKER_URL="https://echokit-license.echokit-rk.workers.dev"

# Test 1: Health Check
echo "✓ Test 1: Health Check"
echo "  Endpoint: $WORKER_URL/__health"
HEALTH=$(curl -s "$WORKER_URL/__health")
echo "  Response: $HEALTH"
echo ""

# Test 2: Validate a license key (you'll need a real key from a test purchase)
echo "✓ Test 2: Validate License Key"
echo "  Paste a license key to test (or press Enter to skip):"
read -r LICENSE_KEY

if [ -n "$LICENSE_KEY" ]; then
  echo "  Testing key: $LICENSE_KEY"
  RESULT=$(curl -s -X POST "$WORKER_URL/v1/validate" \
    -H "Content-Type: application/json" \
    -d "{\"key\":\"$LICENSE_KEY\"}")
  echo "  Response: $RESULT"
else
  echo "  Skipped"
fi
echo ""

# Test 3: Show checkout URLs
echo "✓ Test 3: Your Checkout URLs"
echo "  Open these URLs in Test Mode to make test purchases:"
echo ""
echo "  Monthly ($5):  https://echokit.lemonsqueezy.com/checkout/buy/a10eaa5e-ce99-4c84-aff6-900405e87880?enabled=1662237"
echo "  Annual ($49):  https://echokit.lemonsqueezy.com/checkout/buy/371e5a4f-2096-4ea0-9197-322ffb41702c?enabled=1662250"
echo "  Lifetime ($199): https://echokit.lemonsqueezy.com/checkout/buy/8d78047a-ba2b-49cf-ae30-2c107f60754d?enabled=1662254"
echo ""

# Test 4: Show webhook logs
echo "✓ Test 4: Monitor Webhook Logs (Real-time)"
echo "  Run this command to see live webhook activity:"
echo "  $ wrangler tail"
echo ""

echo "================================"
echo "✅ Setup Complete!"
echo ""
echo "Next Steps:"
echo "1. Enable Test Mode in LemonSqueezy"
echo "2. Make a test purchase using one of the URLs above"
echo "3. Check your email for the license key"
echo "4. Run this script again and paste the key to validate"
echo ""
