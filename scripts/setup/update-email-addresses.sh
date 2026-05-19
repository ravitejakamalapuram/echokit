#!/bin/bash
# EchoKit - Update Personal Email to Professional Addresses
# This script replaces raviteja369.k@gmail.com with professional @echo-kit.com addresses

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  EchoKit - Professional Email Migration"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if we're in the right directory
if [ ! -f "extension/manifest.json" ]; then
  echo -e "${RED}❌ Error: Run this script from the project root directory${NC}"
  exit 1
fi

echo -e "${BLUE}📧 Updating email addresses in codebase...${NC}"
echo ""

# Counter for changes
CHANGES=0

# Update extension/manifest.json
if [ -f "extension/manifest.json" ]; then
  if grep -q "raviteja369.k@gmail.com" extension/manifest.json; then
    sed -i.bak 's/raviteja369.k@gmail.com/support@echo-kit.com/g' extension/manifest.json
    echo -e "${GREEN}✓ Updated extension/manifest.json${NC}"
    CHANGES=$((CHANGES + 1))
  else
    echo -e "${YELLOW}○ extension/manifest.json already updated${NC}"
  fi
fi

# Update README.md
if [ -f "README.md" ]; then
  if grep -q "raviteja369.k@gmail.com" README.md; then
    sed -i.bak 's/raviteja369.k@gmail.com/support@echo-kit.com/g' README.md
    echo -e "${GREEN}✓ Updated README.md${NC}"
    CHANGES=$((CHANGES + 1))
  else
    echo -e "${YELLOW}○ README.md already updated${NC}"
  fi
fi

# Update package.json if it exists
if [ -f "package.json" ]; then
  if grep -q "raviteja369.k@gmail.com" package.json 2>/dev/null; then
    sed -i.bak 's/raviteja369.k@gmail.com/support@echo-kit.com/g' package.json
    echo -e "${GREEN}✓ Updated package.json${NC}"
    CHANGES=$((CHANGES + 1))
  else
    echo -e "${YELLOW}○ package.json already updated or doesn't contain email${NC}"
  fi
fi

# Update docs/privacy.html
if [ -f "docs/privacy.html" ]; then
  if grep -q "raviteja369.k@gmail.com" docs/privacy.html; then
    sed -i.bak 's/raviteja369.k@gmail.com/support@echo-kit.com/g' docs/privacy.html
    echo -e "${GREEN}✓ Updated docs/privacy.html${NC}"
    CHANGES=$((CHANGES + 1))
  else
    echo -e "${YELLOW}○ docs/privacy.html already updated${NC}"
  fi
fi

# Update any other HTML files in docs/
for file in docs/*.html; do
  if [ "$file" != "docs/privacy.html" ] && [ -f "$file" ]; then
    if grep -q "raviteja369.k@gmail.com" "$file"; then
      sed -i.bak 's/raviteja369.k@gmail.com/support@echo-kit.com/g' "$file"
      echo -e "${GREEN}✓ Updated $(basename "$file")${NC}"
      CHANGES=$((CHANGES + 1))
    fi
  fi
done

# Clean up backup files
rm -f extension/manifest.json.bak README.md.bak package.json.bak docs/*.bak 2>/dev/null || true

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ $CHANGES -gt 0 ]; then
  echo -e "${GREEN}✅ Updated $CHANGES file(s)${NC}"
else
  echo -e "${YELLOW}ℹ All files already up-to-date${NC}"
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Show what changed
if [ $CHANGES -gt 0 ]; then
  echo -e "${BLUE}📊 Changes summary:${NC}"
  git diff --stat extension/manifest.json README.md package.json docs/*.html 2>/dev/null || echo "No git changes to display"
  echo ""
fi

echo -e "${YELLOW}📝 Manual Updates Still Needed:${NC}"
echo ""
echo "1. Chrome Web Store Listing:"
echo "   → https://chrome.google.com/webstore/devconsole"
echo "   → Update support email to: support@echo-kit.com"
echo ""
echo "2. LemonSqueezy Store Settings:"
echo "   → https://app.lemonsqueezy.com/settings/stores"
echo "   → Update support email to: support@echo-kit.com"
echo ""
echo "3. Cloudflare Email Routing:"
echo "   → https://dash.cloudflare.com (echo-kit.com → Email)"
echo "   → Setup forwarding: support@echo-kit.com → raviteja369.k@gmail.com"
echo ""
echo "4. Gmail 'Send As' Configuration:"
echo "   → Gmail Settings → Accounts and Import"
echo "   → Add: support@echo-kit.com, billing@echo-kit.com"
echo ""

if [ $CHANGES -gt 0 ]; then
  echo -e "${BLUE}💾 Ready to commit changes?${NC}"
  echo ""
  read -p "Commit these changes? (yes/no): " commit_changes
  
  if [ "$commit_changes" == "yes" ]; then
    git add extension/manifest.json README.md package.json docs/*.html 2>/dev/null || true
    git commit -m "feat: Replace personal email with professional addresses

- Update all references from raviteja369.k@gmail.com to support@echo-kit.com
- Affects: extension manifest, README, docs, package.json

Next steps:
- Update Chrome Web Store listing
- Update LemonSqueezy store settings
- Configure Cloudflare Email Routing
- Setup Gmail 'Send As' feature"
    
    echo ""
    echo -e "${GREEN}✓ Changes committed${NC}"
    echo ""
    
    read -p "Push to GitHub? (yes/no): " push_changes
    if [ "$push_changes" == "yes" ]; then
      git push origin main
      echo ""
      echo -e "${GREEN}✓ Changes pushed!${NC}"
    fi
  fi
fi

echo ""
echo -e "${GREEN}🎯 Next: Follow PROFESSIONAL_EMAIL_SETUP_PLAN.md for complete setup${NC}"
echo ""
