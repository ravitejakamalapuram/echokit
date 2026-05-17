#!/bin/bash
# LemonSqueezy Webhook Setup Script
set -euo pipefail

echo "🍋 LemonSqueezy Webhook Setup"
echo "============================="
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

echo "📋 STEP 1: Configure Webhook in LemonSqueezy"
echo "-------------------------------------------"
echo ""
echo "1. Go to: https://app.lemonsqueezy.com/settings/webhooks"
echo "2. Click 'Add Endpoint' or 'Create Webhook'"
echo "3. Fill in the following:"
echo ""
echo "   Webhook URL:"
echo "   $WORKER_URL/v1/lemonsqueezy-webhook"
echo ""
echo "   Events (select these):"
echo "   ✅ order_created"
echo "   ✅ subscription_created"
echo ""
echo "4. Click 'Save' and COPY the Signing Secret"
echo ""
echo "Press Enter when you've created the webhook and copied the secret..."
read -r

echo ""
echo "🔐 STEP 2: Set the Signing Secret in Worker"
echo "-------------------------------------------"
echo ""
echo "Now we'll set the signing secret you just copied."
echo ""

# Set the webhook secret
if ! wrangler secret put LEMONSQUEEZY_WEBHOOK_SECRET; then
  echo "❌ Failed to set LEMONSQUEEZY_WEBHOOK_SECRET"
  exit 1
fi

echo ""
echo "🚀 STEP 3: Deploy Worker"
echo "----------------------"
echo ""
if ! wrangler deploy; then
  echo "❌ Worker deployment failed"
  exit 1
fi

echo ""
echo "✅ STEP 4: Verify Setup"
echo "---------------------"
echo ""
echo "Checking worker health..."
if ! HEALTH=$(curl -fsS --max-time 10 "$WORKER_URL/__health"); then
  echo "❌ Health endpoint request failed"
  exit 1
fi
echo "Response: $HEALTH"
echo ""

if echo "$HEALTH" | grep -Eq '"ok"[[:space:]]*:[[:space:]]*true'; then
  echo "✅ Worker is healthy!"
else
  echo "❌ Worker health check failed!"
  exit 1
fi

echo ""
echo "📝 STEP 5: Test the Webhook"
echo "--------------------------"
echo ""
echo "Option A: Send Test Event from LemonSqueezy"
echo "  1. Go to: https://app.lemonsqueezy.com/settings/webhooks"
echo "  2. Click your webhook"
echo "  3. Click 'Send test event' or 'Test webhook'"
echo "  4. Check 'Recent deliveries' tab for 200 OK"
echo ""
echo "Option B: Make a Test Purchase"
echo "  1. Enable Test Mode in LemonSqueezy"
echo "  2. Open your pricing page (docs/pricing.html)"
echo "  3. Click 'Get Pro Monthly'"
echo "  4. Use test card: 4242 4242 4242 4242"
echo "  5. Check your email for license key!"
echo ""
echo "================================"
echo "✅ Setup Complete!"
echo ""
echo "Your webhook is now configured at:"
echo "$WORKER_URL/v1/lemonsqueezy-webhook"
echo ""
echo "To monitor webhook activity in real-time:"
echo "  $ wrangler tail"
echo ""
