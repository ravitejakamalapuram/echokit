#!/bin/bash
# EchoKit Worker Deployment Script
# Run this script to deploy the license validation worker to Cloudflare

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "EchoKit License Worker Deployment"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if we're in the right directory
if [ ! -f "worker.js" ]; then
  echo "❌ Error: worker.js not found. Run this script from the /worker directory."
  exit 1
fi

# Step 1: Login to Cloudflare
echo "Step 1/4: Cloudflare Authentication"
echo "────────────────────────────────────"
if wrangler whoami 2>&1 | grep -q "not authenticated"; then
  echo "You need to login to Cloudflare..."
  echo "This will open a browser window for OAuth authentication."
  read -p "Press Enter to continue..."
  wrangler login
else
  echo "✓ Already authenticated"
  wrangler whoami
fi
echo ""

# Step 2: Set ECHOKIT_HMAC_SECRET
echo "Step 2/4: Set ECHOKIT_HMAC_SECRET"
echo "────────────────────────────────────"
echo "This is a 256-bit secret used to sign all license keys."
echo "⚠️  CRITICAL: Do NOT lose this value. Rotating it invalidates ALL existing keys."
echo ""

# Check if secret exists
if wrangler secret list 2>/dev/null | grep -q ECHOKIT_HMAC_SECRET; then
  echo "⚠️  ECHOKIT_HMAC_SECRET already exists in this worker."
  read -p "Do you want to replace it? (yes/no): " replace_hmac
  if [ "$replace_hmac" != "yes" ]; then
    echo "Skipping ECHOKIT_HMAC_SECRET..."
  else
    echo "Generating a new 256-bit secret..."
    SECRET=$(openssl rand -hex 32)
    echo "Generated: $SECRET"
    echo "⚠️  SAVE THIS VALUE IN YOUR PASSWORD MANAGER NOW!"
    read -p "Press Enter after you've saved it..."
    echo "$SECRET" | wrangler secret put ECHOKIT_HMAC_SECRET
    echo "✓ ECHOKIT_HMAC_SECRET updated"
  fi
else
  echo "Generating a new 256-bit secret..."
  SECRET=$(openssl rand -hex 32)
  echo ""
  echo "Generated secret:"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "$SECRET"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo "⚠️  CRITICAL: Copy this value to your password manager NOW!"
  echo "If you lose it, all existing license keys will be invalidated."
  read -p "Press Enter after you've saved it..."
  echo "$SECRET" | wrangler secret put ECHOKIT_HMAC_SECRET
  echo "✓ ECHOKIT_HMAC_SECRET set"
fi
echo ""

# Step 3: Set ECHOKIT_ADMIN_TOKEN
echo "Step 3/4: Set ECHOKIT_ADMIN_TOKEN"
echo "────────────────────────────────────"
echo "This token is used to authorize license key minting via the API."
echo ""

if wrangler secret list 2>/dev/null | grep -q ECHOKIT_ADMIN_TOKEN; then
  echo "⚠️  ECHOKIT_ADMIN_TOKEN already exists in this worker."
  read -p "Do you want to replace it? (yes/no): " replace_admin
  if [ "$replace_admin" != "yes" ]; then
    echo "Skipping ECHOKIT_ADMIN_TOKEN..."
  else
    echo "Generating a new admin token..."
    ADMIN_TOKEN=$(openssl rand -base64 32)
    echo "Generated: $ADMIN_TOKEN"
    echo "⚠️  SAVE THIS VALUE IN YOUR PASSWORD MANAGER NOW!"
    read -p "Press Enter after you've saved it..."
    echo "$ADMIN_TOKEN" | wrangler secret put ECHOKIT_ADMIN_TOKEN
    echo "✓ ECHOKIT_ADMIN_TOKEN updated"
  fi
else
  echo "Generating a new admin token..."
  ADMIN_TOKEN=$(openssl rand -base64 32)
  echo ""
  echo "Generated token:"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "$ADMIN_TOKEN"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo "⚠️  SAVE THIS VALUE! You'll need it to mint license keys."
  read -p "Press Enter after you've saved it..."
  echo "$ADMIN_TOKEN" | wrangler secret put ECHOKIT_ADMIN_TOKEN
  echo "✓ ECHOKIT_ADMIN_TOKEN set"
fi
echo ""

# Step 4: Deploy
echo "Step 4/4: Deploy Worker"
echo "────────────────────────────────────"
echo "Deploying to Cloudflare..."
wrangler deploy

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Deployment Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Your worker is now live. Test it:"
echo ""
echo "# Health check"
echo "curl https://echokit-license.<YOUR_SUBDOMAIN>.workers.dev/__health"
echo ""
echo "See worker/DEPLOY.md for full testing instructions and next steps."
