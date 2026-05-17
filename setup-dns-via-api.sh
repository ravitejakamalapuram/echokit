#!/bin/bash
# Setup DNS records for echo-kit.com using Cloudflare API
# This script uses wrangler's authentication to add DNS records programmatically

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  EchoKit - Automated DNS Setup via Cloudflare API"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

ACCOUNT_ID="e08ac904468d19ea525b3005cc54888b"

echo -e "${BLUE}Step 1: Finding zone ID for echo-kit.com...${NC}"

# We need to use wrangler to make API calls since it has OAuth token
# Create a temporary worker to call the API
cat > /tmp/cloudflare-api-helper.js << 'EOF'
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.searchParams.get('path');
    const method = url.searchParams.get('method') || 'GET';
    
    const apiUrl = `https://api.cloudflare.com/client/v4${path}`;
    
    const response = await fetch(apiUrl, {
      method,
      headers: {
        'Content-Type': 'application/json',
        // Wrangler will inject the OAuth token
      },
      body: method !== 'GET' ? url.searchParams.get('body') : undefined
    });
    
    return response;
  }
}
EOF

echo ""
echo -e "${YELLOW}⚠️  Unfortunately, wrangler doesn't expose the OAuth token for direct API calls.${NC}"
echo ""
echo -e "${BLUE}To use the Cloudflare API, we need to create an API Token.${NC}"
echo ""
echo "Option 1: Create API Token (Recommended)"
echo "  1. Open: https://dash.cloudflare.com/profile/api-tokens"
echo "  2. Click: 'Create Token'"
echo "  3. Use template: 'Edit zone DNS'"
echo "  4. Zone Resources: Include → Specific zone → echo-kit.com"
echo "  5. Copy the token"
echo ""
echo "Option 2: Manual DNS setup (5 minutes)"
echo "  1. Open: https://dash.cloudflare.com"
echo "  2. Click: echo-kit.com → DNS"
echo "  3. Add 2 CNAME records (see guide below)"
echo ""

read -p "Do you want to create an API token now? (yes/no): " create_token

if [ "$create_token" == "yes" ]; then
  echo ""
  echo -e "${BLUE}Opening Cloudflare API Tokens page...${NC}"
  open "https://dash.cloudflare.com/profile/api-tokens/create" || xdg-open "https://dash.cloudflare.com/profile/api-tokens/create" || echo "Please open: https://dash.cloudflare.com/profile/api-tokens/create"
  echo ""
  echo "Steps to create token:"
  echo "  1. Click: 'Create Custom Token'"
  echo "  2. Token name: 'EchoKit DNS Management'"
  echo "  3. Permissions:"
  echo "     - Zone → DNS → Edit"
  echo "     - Zone → Zone → Read"
  echo "  4. Zone Resources:"
  echo "     - Include → Specific zone → echo-kit.com"
  echo "  5. Click: 'Continue to summary' → 'Create Token'"
  echo "  6. Copy the token (you won't see it again!)"
  echo ""
  read -p "Paste your API token here: " CF_API_TOKEN
  
  if [ -z "$CF_API_TOKEN" ]; then
    echo -e "${RED}No token provided. Exiting.${NC}"
    exit 1
  fi
  
  echo ""
  echo -e "${BLUE}Step 2: Getting zone ID for echo-kit.com...${NC}"
  
  ZONE_RESPONSE=$(curl -s -X GET "https://api.cloudflare.com/client/v4/zones?name=echo-kit.com" \
    -H "Authorization: Bearer $CF_API_TOKEN" \
    -H "Content-Type: application/json")
  
  ZONE_ID=$(echo "$ZONE_RESPONSE" | jq -r '.result[0].id')
  
  if [ "$ZONE_ID" == "null" ] || [ -z "$ZONE_ID" ]; then
    echo -e "${RED}❌ Could not find zone ID. Response:${NC}"
    echo "$ZONE_RESPONSE" | jq .
    exit 1
  fi
  
  echo -e "${GREEN}✓ Found zone ID: $ZONE_ID${NC}"
  
  echo ""
  echo -e "${BLUE}Step 3: Adding DNS record for api.echo-kit.com...${NC}"
  
  API_RECORD=$(curl -s -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records" \
    -H "Authorization: Bearer $CF_API_TOKEN" \
    -H "Content-Type: application/json" \
    --data '{
      "type": "CNAME",
      "name": "api",
      "content": "echokit-license.echokit-rk.workers.dev",
      "ttl": 1,
      "proxied": true
    }')
  
  API_SUCCESS=$(echo "$API_RECORD" | jq -r '.success')
  
  if [ "$API_SUCCESS" == "true" ]; then
    echo -e "${GREEN}✓ Added api.echo-kit.com CNAME record${NC}"
  else
    echo -e "${YELLOW}⚠️  API record may already exist or error occurred${NC}"
    echo "$API_RECORD" | jq .
  fi
  
  echo ""
  echo -e "${BLUE}Step 4: Adding DNS record for www.echo-kit.com...${NC}"
  
  WWW_RECORD=$(curl -s -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records" \
    -H "Authorization: Bearer $CF_API_TOKEN" \
    -H "Content-Type: application/json" \
    --data '{
      "type": "CNAME",
      "name": "www",
      "content": "echo-kit.com",
      "ttl": 1,
      "proxied": true
    }')
  
  WWW_SUCCESS=$(echo "$WWW_RECORD" | jq -r '.success')
  
  if [ "$WWW_SUCCESS" == "true" ]; then
    echo -e "${GREEN}✓ Added www.echo-kit.com CNAME record${NC}"
  else
    echo -e "${YELLOW}⚠️  WWW record may already exist or error occurred${NC}"
    echo "$WWW_RECORD" | jq .
  fi
  
  echo ""
  echo -e "${GREEN}✅ DNS records added!${NC}"
  echo ""
  echo "Waiting 10 seconds for DNS propagation..."
  sleep 10
  
  echo ""
  echo "Testing DNS..."
  dig api.echo-kit.com +short
  
else
  echo ""
  echo -e "${BLUE}Manual DNS Setup Instructions:${NC}"
  echo ""
  echo "Add these 2 records at: https://dash.cloudflare.com → echo-kit.com → DNS"
  echo ""
  echo "Record 1 - Worker API:"
  echo "  Type:    CNAME"
  echo "  Name:    api"
  echo "  Target:  echokit-license.echokit-rk.workers.dev"
  echo "  Proxy:   ON (orange cloud)"
  echo ""
  echo "Record 2 - WWW subdomain:"
  echo "  Type:    CNAME"
  echo "  Name:    www"
  echo "  Target:  echo-kit.com"
  echo "  Proxy:   ON (orange cloud)"
  echo ""
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}Next: Test the Worker${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "After DNS propagates (1-5 minutes), test:"
echo "  curl https://api.echo-kit.com/__health"
echo ""
