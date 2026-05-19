# 🚀 EchoKit - Cloudflare Hosting & CI/CD Plan

**Domain:** `echo-kit.com`  
**Current Setup:**
- ✅ Custom email domain: `mail.echo-kit.com` (Resend)
- ✅ Worker deployed: `https://echokit-license.echokit-rk.workers.dev`
- ✅ GitHub repo with Actions

---

## 🎯 **Goal: Complete Cloudflare Hosting Setup**

Host everything on `echo-kit.com` with automated CI/CD:

1. **Main Website** → `https://echo-kit.com`
2. **Docs/Pricing** → `https://echo-kit.com/docs`, `/pricing`
3. **License API** → `https://api.echo-kit.com`
4. **Email** → `mail.echo-kit.com` (already configured)

---

## 📋 **Phase 1: DNS & Domain Setup (5 minutes)**

### 1.1 Configure DNS in Cloudflare Dashboard

**Login:** https://dash.cloudflare.com

1. **Add echo-kit.com to Cloudflare** (if not already)
   - Click "Add a Site"
   - Enter: `echo-kit.com`
   - Select Free plan
   - Copy nameservers and update at your domain registrar

2. **Verify DNS Records**
   ```
   Type  Name              Value                                     Proxy
   ─────────────────────────────────────────────────────────────────────────
   A     echo-kit.com      192.0.2.1 (placeholder, Cloudflare proxy) ✅ ON
   CNAME www               echo-kit.com                              ✅ ON
   CNAME api               echokit-license.workers.dev              ✅ ON
   ```

---

## 📋 **Phase 2: Cloudflare Pages Setup (10 minutes)**

### 2.1 Create Pages Project

1. **Go to:** https://dash.cloudflare.com → Pages
2. **Click:** "Create a project" → "Connect to Git"
3. **Select:** `ravitejakamalapuram/echokit`
4. **Configure:**
   ```
   Project name: echokit-website
   Production branch: main
   Build command: (leave empty - static files)
   Build output directory: docs
   ```

### 2.2 Custom Domain Setup

**After deployment completes:**

1. Go to: Pages project → Custom domains
2. Click: "Set up a custom domain"
3. Add: `echo-kit.com`
4. Add: `www.echo-kit.com`
5. Cloudflare auto-configures DNS

**Result:**
- ✅ `https://echo-kit.com` → serves `/docs/index.html`
- ✅ `https://echo-kit.com/pricing.html` → pricing page
- ✅ Auto-deploys on every push to `main`

---

## 📋 **Phase 3: Worker Custom Domain (5 minutes)**

### 3.1 Add Custom Route to Worker

**Update `worker/wrangler.toml`:**

```toml
name = "echokit-license"
main = "worker.js"
compatibility_date = "2025-01-01"

[vars]
ECHOKIT_PUBLIC_NAME = "EchoKit License API"

# Custom domain routing
routes = [
  { pattern = "api.echo-kit.com/*", zone_name = "echo-kit.com" }
]
```

### 3.2 Deploy Worker

```bash
cd worker
wrangler deploy
```

**Result:**
- ✅ `https://api.echo-kit.com/v1/validate` → license validation
- ✅ `https://api.echo-kit.com/__health` → health check
- ✅ Old URL still works: `https://echokit-license.echokit-rk.workers.dev`

---

## 📋 **Phase 4: Automated CI/CD Pipeline (15 minutes)**

### 4.1 Create Cloudflare API Token

1. **Go to:** https://dash.cloudflare.com/profile/api-tokens
2. **Click:** "Create Token"
3. **Template:** "Edit Cloudflare Workers"
4. **Permissions:**
   ```
   Account → Workers Scripts → Edit
   Zone → Workers Routes → Edit
   Zone → DNS → Edit
   ```
5. **Copy token** → Save for GitHub Secrets

### 4.2 Add GitHub Secrets

**Go to:** https://github.com/ravitejakamalapuram/echokit/settings/secrets/actions

Add these secrets:
```
CLOUDFLARE_API_TOKEN = <token from 4.1>
CLOUDFLARE_ACCOUNT_ID = <your account ID from dashboard>
```

### 4.3 Create Worker Deployment Workflow

Create `.github/workflows/deploy-worker.yml`:

```yaml
name: Deploy Worker

on:
  push:
    branches: [main]
    paths:
      - 'worker/**'
      - '.github/workflows/deploy-worker.yml'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Deploy to Cloudflare Workers
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          workingDirectory: worker
          command: deploy
```

**Result:**
- ✅ Auto-deploys worker on every push to `main` that changes `worker/` files
- ✅ Deploys to both `api.echo-kit.com` and workers.dev URL

---

## 📋 **Phase 5: Update Extension to Use Custom Domain (5 minutes)**

### 5.1 Update Default Worker URL

**Edit `extension/background.js`:**

```javascript
// Line 64: Update default URL
const DEFAULT_LICENSE_WORKER_URL = 'https://api.echo-kit.com';
```

### 5.2 Update Pricing Page

**Edit `docs/pricing.html`:**

```javascript
// Line ~283: Update fetch URL
const res = await fetch('https://api.echo-kit.com/v1/validate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ key: k })
});
```

### 5.3 Commit & Push

```bash
git add extension/background.js docs/pricing.html
git commit -m "feat: Use custom domain for license API (api.echo-kit.com)"
git push origin main
```

**Result:**
- ✅ Extension uses professional domain
- ✅ Pricing page uses custom domain
- ✅ Both auto-deploy via existing workflows

---

## 📋 **Phase 6: Monitoring & Analytics (Optional - 10 minutes)**

### 6.1 Enable Cloudflare Web Analytics

1. **Go to:** Cloudflare Dashboard → echo-kit.com → Analytics
2. **Click:** "Enable Web Analytics"
3. **Add beacon** to `docs/index.html`:

```html
<!-- Before </head> -->
<script defer src='https://static.cloudflareinsights.com/beacon.min.js'
        data-cf-beacon='{"token": "YOUR_TOKEN_HERE"}'></script>
```

### 6.2 Enable Worker Analytics

**Already included!** Workers auto-track:
- ✅ Request count
- ✅ Response times
- ✅ Error rates
- ✅ Geographic distribution

**View at:** Cloudflare Dashboard → Workers & Pages → echokit-license → Metrics

---

## 📋 **Phase 7: Testing & Verification (10 minutes)**

### 7.1 DNS Propagation Check

```bash
# Wait 5-10 minutes after DNS changes, then test:
dig echo-kit.com
dig api.echo-kit.com
dig www.echo-kit.com
```

### 7.2 Test All Endpoints

```bash
# Main website
curl -I https://echo-kit.com

# Pricing page
curl -I https://echo-kit.com/pricing.html

# API health check
curl https://api.echo-kit.com/__health

# License validation (with test key)
curl -X POST https://api.echo-kit.com/v1/validate \
  -H "Content-Type: application/json" \
  -d '{"key":"EK-PRO-1234567890-abcd1234"}'
```

### 7.3 Test CI/CD Pipeline

```bash
# Make a small change to worker
echo "// CI/CD test" >> worker/worker.js
git add worker/worker.js
git commit -m "test: Verify CI/CD pipeline"
git push origin main

# Watch deployment: https://github.com/ravitejakamalapuram/echokit/actions
```

---

## 🎯 **Complete Architecture After Setup**

```
┌─────────────────────────────────────────────────────────┐
│                    echo-kit.com (Cloudflare)            │
│                                                         │
│  ┌─────────────────┐      ┌──────────────────────┐    │
│  │ Cloudflare Pages│      │ Cloudflare Workers   │    │
│  │                 │      │                      │    │
│  │ echo-kit.com    │      │ api.echo-kit.com     │    │
│  │ ├─ /           │      │ ├─ /v1/validate     │    │
│  │ ├─ /pricing    │      │ ├─ /v1/issue        │    │
│  │ ├─ /docs       │      │ ├─ /v1/lemonsqueezy │    │
│  │ └─ /privacy    │      │ └─ /__health        │    │
│  └─────────────────┘      └──────────────────────┘    │
│         ▲                          ▲                   │
│         │                          │                   │
└─────────┼──────────────────────────┼───────────────────┘
          │                          │
          │                          │
   ┌──────┴────────┐        ┌───────┴────────┐
   │  GitHub       │        │   LemonSqueezy │
   │  Actions      │        │   Webhooks     │
   │               │        │                │
   │  Auto-deploy  │        │  Payment →     │
   │  on push      │        │  License       │
   └───────────────┘        └────────────────┘
```

---

## ✅ **Success Criteria Checklist**

After completing all phases, verify:

- [ ] **DNS:** `echo-kit.com` points to Cloudflare
- [ ] **Website:** `https://echo-kit.com` loads homepage
- [ ] **Pricing:** `https://echo-kit.com/pricing.html` works
- [ ] **API:** `https://api.echo-kit.com/__health` returns `{"ok":true}`
- [ ] **Worker CI/CD:** Push to `worker/` auto-deploys
- [ ] **Pages CI/CD:** Push to `docs/` auto-deploys
- [ ] **Extension:** Uses `https://api.echo-kit.com`
- [ ] **SSL:** All endpoints have valid HTTPS
- [ ] **Email:** Still works via `mail.echo-kit.com`

---

## 🚀 **Quick Start Commands**

**Fastest path to get everything running:**

```bash
# 1. Update worker with custom domain
cd worker
# Edit wrangler.toml (add routes section from Phase 3)
wrangler deploy

# 2. Update extension to use custom domain
# Edit extension/background.js (line 64)
# Edit docs/pricing.html (line ~283)

# 3. Commit and push
git add .
git commit -m "feat: Complete Cloudflare hosting setup"
git push origin main

# 4. Setup Cloudflare Pages
# Go to dash.cloudflare.com → Pages → Connect GitHub → echokit

# 5. Add GitHub secrets
# Go to GitHub → Settings → Secrets → Add CLOUDFLARE_API_TOKEN

# Done! Everything auto-deploys on next push.
```

---

## 📞 **Need Help?**

- **Cloudflare Docs:** https://developers.cloudflare.com
- **Pages Setup:** https://developers.cloudflare.com/pages
- **Workers Custom Domains:** https://developers.cloudflare.com/workers/configuration/routing/routes
- **GitHub Actions:** https://docs.github.com/en/actions

---

**Estimated Total Time:** 60 minutes
**Cost:** $0 (all on Cloudflare Free tier)
**Maintenance:** Zero (fully automated CI/CD)

