#!/bin/bash
# EchoKit License Key Issuer
# Quick helper script to issue license keys manually

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   EchoKit License Key Issuer          ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

# Check if worker URL and admin token are set
if [ -z "$ECHOKIT_WORKER_URL" ]; then
  echo -e "${YELLOW}ℹ ECHOKIT_WORKER_URL not set${NC}"
  echo -e "Please enter your worker URL (e.g., https://echokit-license.xxx.workers.dev):"
  read -r WORKER_URL
else
  WORKER_URL="$ECHOKIT_WORKER_URL"
  echo -e "${GREEN}✓ Using worker URL: $WORKER_URL${NC}"
fi

if [ -z "$ECHOKIT_ADMIN_TOKEN" ]; then
  echo -e "${YELLOW}ℹ ECHOKIT_ADMIN_TOKEN not set${NC}"
  echo -e "Please enter your admin token:"
  read -rs ADMIN_TOKEN
  echo ""
else
  ADMIN_TOKEN="$ECHOKIT_ADMIN_TOKEN"
  echo -e "${GREEN}✓ Admin token found${NC}"
fi

echo ""
echo -e "${BLUE}Select plan type:${NC}"
echo "  1) PRO   - Monthly (30 days)"
echo "  2) YEAR  - Annual (365 days)"
echo "  3) LTD   - Lifetime (never expires)"
echo "  4) Custom expiry"
echo ""
read -p "Enter choice [1-4]: " choice

case $choice in
  1)
    PLAN="PRO"
    EXPIRY=0
    DESCRIPTION="Monthly Pro (30 days)"
    ;;
  2)
    PLAN="YEAR"
    EXPIRY=0
    DESCRIPTION="Annual (365 days)"
    ;;
  3)
    PLAN="LTD"
    EXPIRY=0
    DESCRIPTION="Lifetime (never expires)"
    ;;
  4)
    echo ""
    echo "Select plan for custom expiry:"
    echo "  1) PRO"
    echo "  2) YEAR"
    echo "  3) LTD"
    read -p "Enter plan [1-3]: " plan_choice
    
    case $plan_choice in
      1) PLAN="PRO" ;;
      2) PLAN="YEAR" ;;
      3) PLAN="LTD" ;;
      *) echo -e "${RED}✗ Invalid choice${NC}"; exit 1 ;;
    esac
    
    echo ""
    echo "Enter number of days until expiry (0 for never):"
    read -r days
    
    if [ "$days" -eq 0 ]; then
      EXPIRY=0
      DESCRIPTION="$PLAN plan (never expires)"
    else
      EXPIRY=$(($(date +%s) + (days * 86400)))
      EXPIRY_DATE=$(date -r "$EXPIRY" "+%Y-%m-%d")
      DESCRIPTION="$PLAN plan (expires $EXPIRY_DATE)"
    fi
    ;;
  *)
    echo -e "${RED}✗ Invalid choice${NC}"
    exit 1
    ;;
esac

echo ""
echo -e "${BLUE}Issuing key...${NC}"
echo -e "  Plan: ${YELLOW}$PLAN${NC}"
echo -e "  Description: ${YELLOW}$DESCRIPTION${NC}"
echo ""

# Issue the key
RESPONSE=$(curl -s -X POST "$WORKER_URL/v1/issue" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"plan\": \"$PLAN\", \"expiresAt\": $EXPIRY}")

# Check if successful
if echo "$RESPONSE" | grep -q '"ok":true'; then
  KEY=$(echo "$RESPONSE" | grep -o '"key":"[^"]*"' | cut -d'"' -f4)
  PLAN_RETURNED=$(echo "$RESPONSE" | grep -o '"plan":"[^"]*"' | cut -d'"' -f4)
  EXPIRES_AT=$(echo "$RESPONSE" | grep -o '"expiresAt":[0-9]*' | cut -d':' -f2)
  
  echo -e "${GREEN}╔════════════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║                    ✓ License Key Issued                            ║${NC}"
  echo -e "${GREEN}╚════════════════════════════════════════════════════════════════════╝${NC}"
  echo ""
  echo -e "${YELLOW}$KEY${NC}"
  echo ""
  echo -e "${BLUE}Details:${NC}"
  echo -e "  Plan: $PLAN_RETURNED"
  
  if [ "$EXPIRES_AT" -eq 0 ]; then
    echo -e "  Expiry: ${GREEN}Never${NC}"
  else
    EXPIRY_HUMAN=$(date -r "$EXPIRES_AT" "+%Y-%m-%d %H:%M:%S")
    echo -e "  Expiry: $EXPIRY_HUMAN"
  fi
  
  echo ""
  echo -e "${BLUE}Give this key to your customer!${NC}"
  echo ""
  
  # Offer to verify
  read -p "Verify this key now? [y/N]: " verify
  if [[ "$verify" =~ ^[Yy]$ ]]; then
    echo ""
    echo -e "${BLUE}Verifying...${NC}"
    VERIFY_RESPONSE=$(curl -s "$WORKER_URL/v1/verify?key=$KEY")
    echo "$VERIFY_RESPONSE" | jq . || echo "$VERIFY_RESPONSE"
  fi
  
else
  echo -e "${RED}╔════════════════════════════════════════╗${NC}"
  echo -e "${RED}║         ✗ Failed to issue key          ║${NC}"
  echo -e "${RED}╚════════════════════════════════════════╝${NC}"
  echo ""
  echo -e "${RED}Error:${NC}"
  echo "$RESPONSE" | jq . || echo "$RESPONSE"
  exit 1
fi
