#!/bin/bash
# LemonSqueezy Integration Test Script

echo "🍋 LemonSqueezy Integration Test"
echo "================================"
echo ""

# Auto-detect worker URL from wrangler.toml
WORKER_NAME=$(grep "name" wrangler.toml | head -1 | cut -d'"' -f2)
if [ -z "$WORKER_NAME" ]; then
  echo "Error: Could not detect worker name from wrangler.toml"
  exit 1
fi

# Prompt for worker URL
echo "Enter your Worker URL (or press Enter to use default):"
echo "Format: https://$WORKER_NAME.your-subdomain.workers.dev"
read -r WORKER_URL_INPUT

if [ -n "$WORKER_URL_INPUT" ]; then
  WORKER_URL="$WORKER_URL_INPUT"
else
  # Try to get from wrangler
  WORKER_URL=$(wrangler deployments list 2>/dev/null | grep "https://" | head -1 | awk '{print $NF}')
  if [ -z "$WORKER_URL" ]; then
    echo "Error: Could not auto-detect Worker URL. Please enter it manually."
    exit 1
  fi
fi

echo "Using Worker URL: $WORKER_URL"
echo ""

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
echo "  Replace these with YOUR checkout URLs from LemonSqueezy:"
echo "  (Get them from: Product → Share → Copy checkout URL for each variant)"
echo ""
echo "  Monthly (\$5):  <YOUR_MONTHLY_CHECKOUT_URL>"
echo "  Annual (\$49):  <YOUR_ANNUAL_CHECKOUT_URL>"
echo "  Lifetime (\$199): <YOUR_LIFETIME_CHECKOUT_URL>"
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
