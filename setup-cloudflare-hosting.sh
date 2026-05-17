#!/bin/bash
# EchoKit - Cloudflare Hosting Setup Script
# This script automates the setup of Cloudflare hosting and CI/CD

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  EchoKit - Cloudflare Hosting & CI/CD Setup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if we're in the right directory
if [ ! -f "worker/worker.js" ]; then
  echo -e "${RED}❌ Error: Run this script from the project root directory${NC}"
  exit 1
fi

# Step 1: Update extension to use custom domain
echo -e "${BLUE}Step 1/5: Updating extension to use custom domain...${NC}"
echo ""

if grep -q "api.echo-kit.com" extension/background.js; then
  echo -e "${GREEN}✓ Extension already configured for custom domain${NC}"
else
  # Update default worker URL
  sed -i.bak "s|https://echokit-license.echokit-rk.workers.dev|https://api.echo-kit.com|g" extension/background.js
  echo -e "${GREEN}✓ Updated extension/background.js${NC}"
fi

# Step 2: Update pricing page
echo ""
echo -e "${BLUE}Step 2/5: Updating pricing page...${NC}"
echo ""

if grep -q "api.echo-kit.com" docs/pricing.html; then
  echo -e "${GREEN}✓ Pricing page already configured${NC}"
else
  sed -i.bak "s|https://echokit-license.echokit-rk.workers.dev|https://api.echo-kit.com|g" docs/pricing.html
  echo -e "${GREEN}✓ Updated docs/pricing.html${NC}"
fi

# Step 3: Verify wrangler.toml has custom domain
echo ""
echo -e "${BLUE}Step 3/5: Verifying worker configuration...${NC}"
echo ""

if grep -q "api.echo-kit.com" worker/wrangler.toml; then
  echo -e "${GREEN}✓ Worker already configured for custom domain${NC}"
else
  echo -e "${YELLOW}⚠ Worker configuration not updated${NC}"
  echo -e "${YELLOW}  Please update worker/wrangler.toml manually${NC}"
fi

# Step 4: Check for GitHub secrets
echo ""
echo -e "${BLUE}Step 4/5: Checking GitHub configuration...${NC}"
echo ""

echo -e "${YELLOW}📋 Required GitHub Secrets:${NC}"
echo "   1. CLOUDFLARE_API_TOKEN"
echo "   2. CLOUDFLARE_ACCOUNT_ID"
echo ""
echo "   Setup at: https://github.com/ravitejakamalapuram/echokit/settings/secrets/actions"
echo ""

read -p "Have you added these secrets to GitHub? (yes/no): " secrets_added
if [ "$secrets_added" != "yes" ]; then
  echo ""
  echo -e "${YELLOW}⚠ Please add GitHub secrets before continuing:${NC}"
  echo ""
  echo "1. Go to: https://dash.cloudflare.com/profile/api-tokens"
  echo "2. Create Token → Edit Cloudflare Workers template"
  echo "3. Copy the token"
  echo "4. Add as CLOUDFLARE_API_TOKEN in GitHub secrets"
  echo "5. Find Account ID in Cloudflare Dashboard → Workers & Pages"
  echo "6. Add as CLOUDFLARE_ACCOUNT_ID in GitHub secrets"
  echo ""
  echo -e "${BLUE}Run this script again after adding secrets.${NC}"
  exit 1
fi

# Step 5: Commit and push changes
echo ""
echo -e "${BLUE}Step 5/5: Committing changes...${NC}"
echo ""

# Clean up backup files
rm -f extension/background.js.bak docs/pricing.html.bak

# Check if there are changes to commit
if git diff --quiet extension/background.js docs/pricing.html; then
  echo -e "${GREEN}✓ No changes to commit${NC}"
else
  echo -e "${YELLOW}Changes detected:${NC}"
  git diff --stat extension/background.js docs/pricing.html
  echo ""
  
  read -p "Commit and push these changes? (yes/no): " commit_changes
  if [ "$commit_changes" == "yes" ]; then
    git add extension/background.js docs/pricing.html worker/wrangler.toml .github/workflows/deploy-worker.yml
    git commit -m "feat: Setup Cloudflare hosting with custom domain

- Update extension to use api.echo-kit.com
- Update pricing page API endpoint
- Configure worker custom domain routing
- Add automated CI/CD workflow for worker deployment

The worker will now be accessible at:
- https://api.echo-kit.com (custom domain)
- https://echokit-license.echokit-rk.workers.dev (workers.dev)"
    
    echo ""
    echo -e "${GREEN}✓ Changes committed${NC}"
    echo ""
    
    read -p "Push to GitHub now? (yes/no): " push_changes
    if [ "$push_changes" == "yes" ]; then
      git push origin main
      echo ""
      echo -e "${GREEN}✓ Changes pushed!${NC}"
    fi
  fi
fi

# Final instructions
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✅ Setup Complete!${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${BLUE}Next Steps:${NC}"
echo ""
echo "1. 🌐 Setup Cloudflare Pages:"
echo "   → https://dash.cloudflare.com → Pages → Connect GitHub"
echo "   → Select: ravitejakamalapuram/echokit"
echo "   → Build directory: docs"
echo "   → Add custom domain: echo-kit.com"
echo ""
echo "2. 🔗 Setup DNS (if not done):"
echo "   → Cloudflare Dashboard → echo-kit.com → DNS"
echo "   → Add CNAME: api → echokit-license.workers.dev"
echo ""
echo "3. 🚀 Deploy Worker:"
echo "   cd worker && wrangler deploy"
echo ""
echo "4. ✅ Verify deployment:"
echo "   curl https://api.echo-kit.com/__health"
echo "   curl https://echo-kit.com"
echo ""
echo "📖 Full guide: CLOUDFLARE_HOSTING_CI_CD_PLAN.md"
echo ""
