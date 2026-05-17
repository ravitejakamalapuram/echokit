#!/bin/bash
# LemonSqueezy Webhook Setup Script

echo "🍋 LemonSqueezy Webhook Setup"
echo "============================="
echo ""

WORKER_URL="https://echokit-license.echokit-rk.workers.dev"

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
wrangler secret put LEMONSQUEEZY_WEBHOOK_SECRET

echo ""
echo "🚀 STEP 3: Deploy Worker"
echo "----------------------"
echo ""
wrangler deploy

echo ""
echo "✅ STEP 4: Verify Setup"
echo "---------------------"
echo ""
echo "Checking worker health..."
HEALTH=$(curl -s "$WORKER_URL/__health")
echo "Response: $HEALTH"
echo ""

if echo "$HEALTH" | grep -q '"ok":true'; then
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
echo "  2. Open: file:///Users/rkamalapuram/git-personal/echokit/docs/pricing.html"
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
