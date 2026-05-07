#!/bin/bash
# EchoKit Worker Deployment Verification Script

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  EchoKit Worker Deployment Check      ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

# Check if wrangler is installed
echo -e "${BLUE}[1/5] Checking wrangler installation...${NC}"
if command -v wrangler &> /dev/null; then
  WRANGLER_VERSION=$(wrangler --version 2>&1 | head -1)
  echo -e "${GREEN}✓ Wrangler installed: $WRANGLER_VERSION${NC}"
else
  echo -e "${RED}✗ Wrangler not found${NC}"
  echo -e "${YELLOW}Installing wrangler...${NC}"
  npm install -g wrangler
  echo -e "${GREEN}✓ Wrangler installed${NC}"
fi

echo ""

# Check authentication
echo -e "${BLUE}[2/5] Checking Cloudflare authentication...${NC}"
if wrangler whoami &> /dev/null; then
  ACCOUNT=$(wrangler whoami 2>&1 | grep "Account Name:" | cut -d: -f2 | xargs)
  echo -e "${GREEN}✓ Authenticated as: $ACCOUNT${NC}"
else
  echo -e "${YELLOW}⚠ Not authenticated${NC}"
  echo -e "${YELLOW}Run: wrangler login${NC}"
  exit 1
fi

echo ""

# Check deployment status
echo -e "${BLUE}[3/5] Checking deployment status...${NC}"
DEPLOYMENTS=$(wrangler deployments list 2>&1)

if echo "$DEPLOYMENTS" | grep -q "echokit-license"; then
  echo -e "${GREEN}✓ Worker is deployed${NC}"
  echo ""
  
  # Get the most recent deployment
  LATEST=$(echo "$DEPLOYMENTS" | grep "echokit-license" | head -1)
  echo -e "${BLUE}Latest deployment:${NC}"
  echo "$LATEST"
  
  # Try to extract worker URL
  WORKER_URL="https://echokit-license.$(echo "$ACCOUNT" | tr '[:upper:]' '[:lower:]' | tr ' ' '-').workers.dev"
  
else
  echo -e "${YELLOW}⚠ Worker not deployed yet${NC}"
  echo -e "${YELLOW}Run: ./deploy.sh${NC}"
  exit 1
fi

echo ""

# Check health endpoint
echo -e "${BLUE}[4/5] Testing worker health endpoint...${NC}"
echo -e "${BLUE}Trying: $WORKER_URL/__health${NC}"

HEALTH_RESPONSE=$(curl -s "$WORKER_URL/__health" || echo "failed")

if echo "$HEALTH_RESPONSE" | grep -q '"ok":true'; then
  echo -e "${GREEN}✓ Worker is healthy${NC}"
  echo -e "Response: $HEALTH_RESPONSE"
else
  echo -e "${RED}✗ Health check failed${NC}"
  echo -e "Response: $HEALTH_RESPONSE"
  echo ""
  echo -e "${YELLOW}If the URL is wrong, check your Cloudflare dashboard:${NC}"
  echo -e "${YELLOW}https://dash.cloudflare.com/workers${NC}"
  exit 1
fi

echo ""

# Check secrets
echo -e "${BLUE}[5/5] Checking secrets configuration...${NC}"
SECRET_LIST=$(wrangler secret list 2>&1)

if echo "$SECRET_LIST" | grep -q "ECHOKIT_HMAC_SECRET"; then
  echo -e "${GREEN}✓ ECHOKIT_HMAC_SECRET is set${NC}"
else
  echo -e "${RED}✗ ECHOKIT_HMAC_SECRET not set${NC}"
  echo -e "${YELLOW}Run: wrangler secret put ECHOKIT_HMAC_SECRET${NC}"
fi

if echo "$SECRET_LIST" | grep -q "ECHOKIT_ADMIN_TOKEN"; then
  echo -e "${GREEN}✓ ECHOKIT_ADMIN_TOKEN is set${NC}"
else
  echo -e "${RED}✗ ECHOKIT_ADMIN_TOKEN not set${NC}"
  echo -e "${YELLOW}Run: wrangler secret put ECHOKIT_ADMIN_TOKEN${NC}"
fi

# Optional secrets for payment automation
if echo "$SECRET_LIST" | grep -q "STRIPE_WEBHOOK_SECRET"; then
  echo -e "${GREEN}✓ STRIPE_WEBHOOK_SECRET is set (optional)${NC}"
else
  echo -e "${YELLOW}⚠ STRIPE_WEBHOOK_SECRET not set (needed for Stripe automation)${NC}"
fi

if echo "$SECRET_LIST" | grep -q "RESEND_API_KEY"; then
  echo -e "${GREEN}✓ RESEND_API_KEY is set (optional)${NC}"
else
  echo -e "${YELLOW}⚠ RESEND_API_KEY not set (needed for email delivery)${NC}"
fi

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                    ✓ Deployment Verified                           ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}Your Worker URL:${NC} ${YELLOW}$WORKER_URL${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo -e "  1. Set environment variables:"
echo -e "     ${YELLOW}export ECHOKIT_WORKER_URL=\"$WORKER_URL\"${NC}"
echo -e "     ${YELLOW}export ECHOKIT_ADMIN_TOKEN=\"your-admin-token-here\"${NC}"
echo ""
echo -e "  2. Issue your first license key:"
echo -e "     ${YELLOW}./issue-license.sh${NC}"
echo ""
