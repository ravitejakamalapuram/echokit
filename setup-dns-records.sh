#!/bin/bash
# Setup DNS records for echo-kit.com in Cloudflare
# This script adds the necessary DNS records for the Worker and Pages

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  EchoKit - DNS Setup for echo-kit.com"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if we're in the right directory
if [ ! -f "worker/worker.js" ]; then
  echo -e "${RED}❌ Error: Run this script from the project root directory${NC}"
  exit 1
fi

echo -e "${BLUE}Checking domain status...${NC}"
echo ""

# Check nameservers
NS=$(dig echo-kit.com NS +short | head -1)
if [[ "$NS" != *"cloudflare.com"* ]]; then
  echo -e "${RED}❌ Domain not on Cloudflare nameservers${NC}"
  echo "Current nameserver: $NS"
  echo ""
  echo "Please add echo-kit.com to your Cloudflare account first:"
  echo "https://dash.cloudflare.com"
  exit 1
fi

echo -e "${GREEN}✓ Domain is on Cloudflare (${NS})${NC}"
echo ""

# Check current DNS
echo -e "${BLUE}Current DNS records:${NC}"
dig echo-kit.com +short
dig api.echo-kit.com +short
dig www.echo-kit.com +short
echo ""

echo -e "${YELLOW}⚠️  DNS records need to be added manually in Cloudflare Dashboard${NC}"
echo ""
echo "Please add these records at:"
echo "https://dash.cloudflare.com → echo-kit.com → DNS"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${BLUE}Required DNS Records:${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1. CNAME for Worker API:"
echo "   Type:    CNAME"
echo "   Name:    api"
echo "   Target:  echokit-license.echokit-rk.workers.dev"
echo "   Proxy:   ON (orange cloud)"
echo "   TTL:     Auto"
echo ""
echo "2. CNAME for www subdomain:"
echo "   Type:    CNAME"
echo "   Name:    www"
echo "   Target:  echo-kit.com"
echo "   Proxy:   ON (orange cloud)"
echo "   TTL:     Auto"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

read -p "Have you added these DNS records? (yes/no): " dns_added

if [ "$dns_added" != "yes" ]; then
  echo ""
  echo -e "${YELLOW}Please add the DNS records and run this script again.${NC}"
  exit 0
fi

echo ""
echo -e "${BLUE}Waiting for DNS propagation...${NC}"
sleep 5

# Test DNS
echo ""
echo "Testing DNS records..."
API_DNS=$(dig api.echo-kit.com +short | head -1)

if [ -z "$API_DNS" ]; then
  echo -e "${YELLOW}⚠️  api.echo-kit.com DNS not yet propagated${NC}"
  echo "This can take 1-5 minutes. Try again shortly."
else
  echo -e "${GREEN}✓ api.echo-kit.com DNS active: $API_DNS${NC}"
fi

echo ""
echo -e "${BLUE}Re-deploying Worker with custom domain...${NC}"
cd worker
wrangler deploy

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✅ DNS setup complete!${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Test your Worker:"
echo "  curl https://api.echo-kit.com/__health"
echo ""
echo "Next: Setup Cloudflare Pages for the main website"
echo "  ./setup-cloudflare-pages.sh"
echo ""
