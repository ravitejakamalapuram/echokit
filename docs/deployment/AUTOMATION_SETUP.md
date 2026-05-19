# 🤖 Complete Automation Setup Guide

**Goal:** Auto-deploy everything on `git push origin main`

---

## ✅ **Current Auto-Deploy Status**

| Component | Files Watched | Auto-Deploy | Status |
|-----------|---------------|-------------|--------|
| **Website** | `docs/*` | ✅ Yes | Cloudflare Pages |
| **Worker** | `worker/*` | ⚠️ Needs secrets | GitHub Actions |

---

## 🔐 **Step 1: Add GitHub Secrets** (2 minutes)

### **Go to GitHub Secrets Page:**

**URL:** https://github.com/ravitejakamalapuram/echokit/settings/secrets/actions

### **Add Secret #1:**
1. Click: **"New repository secret"**
2. Fill in:
   ```
   Name:  CLOUDFLARE_API_TOKEN
   Value: [paste your Cloudflare API token here]
   ```
   **Use the token you created:** `cfut_tjMzT...6e486197` (the one you just provided)
3. Click: **"Add secret"**

### **Add Secret #2:**
1. Click: **"New repository secret"** again
2. Fill in:
   ```
   Name:  CLOUDFLARE_ACCOUNT_ID
   Value: e08ac904468d19ea525b3005cc54888b
   ```
3. Click: **"Add secret"**

---

## ✅ **Step 2: Test Auto-Deploy** (1 minute)

After adding secrets, let's test that auto-deploy works:

```bash
# Make a small change to trigger deployment
echo "// Auto-deploy test" >> worker/worker.js
git add worker/worker.js
git commit -m "test: Verify auto-deploy works"
git push origin main
```

**What happens:**
1. GitHub detects changes in `worker/` folder
2. GitHub Actions runs `.github/workflows/deploy-worker.yml`
3. Workflow deploys Worker to Cloudflare
4. Worker updates at `api.echo-kit.com` in ~30 seconds

**Check deployment:**
- Go to: https://github.com/ravitejakamalapuram/echokit/actions
- You should see: "Deploy Worker to Cloudflare" workflow running
- Status should turn green ✅ after ~30 seconds

---

## 🎯 **How Auto-Deploy Works**

### **Cloudflare Pages (Website) - Already Active ✅**

**Triggers:**
- Any change to `docs/` folder
- Push to `main` branch

**Example:**
```bash
vim docs/index.html
git add docs/index.html
git commit -m "Update homepage"
git push origin main
# ✅ Auto-deploys to echo-kit.com in ~30 seconds
```

**Monitor:**
- Go to: https://dash.cloudflare.com
- Click: Workers & Pages → echokit-website
- See live deployments

---

### **Cloudflare Worker (API) - Will Be Active After Adding Secrets ✅**

**Triggers:**
- Any change to `worker/` folder
- Push to `main` branch

**Example:**
```bash
vim worker/worker.js
git add worker/worker.js
git commit -m "Update API logic"
git push origin main
# ✅ GitHub Actions auto-deploys to api.echo-kit.com in ~30 seconds
```

**Monitor:**
- Go to: https://github.com/ravitejakamalapuram/echokit/actions
- See deployment logs in real-time
- Check: "Deploy Worker to Cloudflare" workflow

---

## 📂 **Complete File Change → Auto-Deploy Map**

| File Changed | What Happens | Deploy Time | Live URL |
|--------------|--------------|-------------|----------|
| `docs/index.html` | Cloudflare Pages deploys | ~30s | https://echo-kit.com |
| `docs/privacy.html` | Cloudflare Pages deploys | ~30s | https://echo-kit.com |
| `docs/faq.html` | Cloudflare Pages deploys | ~30s | https://echo-kit.com |
| `docs/*.html` | Cloudflare Pages deploys | ~30s | https://echo-kit.com |
| `worker/worker.js` | GitHub Actions → Worker | ~30s | https://api.echo-kit.com |
| `worker/wrangler.toml` | GitHub Actions → Worker | ~30s | https://api.echo-kit.com |
| `worker/package.json` | GitHub Actions → Worker | ~30s | https://api.echo-kit.com |
| `README.md` | No deployment | - | GitHub only |
| `*.sh` scripts | No deployment | - | Local only |

---

## 🚀 **Workflow Details**

### **GitHub Actions Workflow**

**File:** `.github/workflows/deploy-worker.yml`

**What it does:**
1. Watches `worker/` folder for changes
2. On push to `main`, triggers deployment
3. Uses `cloudflare/wrangler-action@v3`
4. Authenticates with your API token
5. Runs `wrangler deploy`
6. Verifies deployment with health check

**Manual trigger:**
- Go to: https://github.com/ravitejakamalapuram/echokit/actions
- Click: "Deploy Worker to Cloudflare"
- Click: "Run workflow" → "Run workflow"

---

## ✅ **After Setup Checklist**

Once you've added the GitHub secrets:

- [ ] Go to: https://github.com/ravitejakamalapuram/echokit/settings/secrets/actions
- [ ] Verify you see `CLOUDFLARE_API_TOKEN` secret
- [ ] Verify you see `CLOUDFLARE_ACCOUNT_ID` secret
- [ ] Make a test change to `worker/worker.js`
- [ ] Push to `main` branch
- [ ] Watch deployment at: https://github.com/ravitejakamalapuram/echokit/actions
- [ ] Verify deployment succeeds (green checkmark ✅)
- [ ] Test Worker: `curl https://api.echo-kit.com/__health`

---

## 🎊 **Success Criteria**

**You'll know automation is working when:**

1. **Website changes:**
   - Edit any file in `docs/`
   - Push to `main`
   - See changes live at `echo-kit.com` in ~30 seconds
   - No manual steps needed ✅

2. **Worker changes:**
   - Edit any file in `worker/`
   - Push to `main`
   - See changes live at `api.echo-kit.com` in ~30 seconds
   - No manual `wrangler deploy` needed ✅

3. **Both work simultaneously:**
   - Edit files in both `docs/` AND `worker/`
   - Push to `main`
   - Both deploy automatically
   - Total hands-off deployment ✅

---

## 🔧 **Troubleshooting**

### **Problem: GitHub Actions fails with "Authentication error"**

**Solution:**
1. Check secrets are added correctly
2. Verify API token has "Edit Cloudflare Workers" permission
3. Re-create token if needed: https://dash.cloudflare.com/profile/api-tokens

### **Problem: Workflow doesn't trigger**

**Solution:**
1. Verify changes are in `worker/` folder
2. Check workflow file exists: `.github/workflows/deploy-worker.yml`
3. Try manual trigger in GitHub Actions tab

### **Problem: Deployment succeeds but changes not live**

**Solution:**
1. Wait 1-2 minutes for CDN cache to clear
2. Try in incognito/private browsing mode
3. Check Cloudflare dashboard for deployment status

---

## 📊 **Deployment Monitoring**

**GitHub Actions:**
- URL: https://github.com/ravitejakamalapuram/echokit/actions
- See: Real-time deployment logs
- Status: Green ✅ = success, Red ❌ = failed

**Cloudflare Pages:**
- URL: https://dash.cloudflare.com → Workers & Pages → echokit-website
- See: Deployment history, build logs

**Cloudflare Worker:**
- URL: https://dash.cloudflare.com → Workers & Pages → echokit-license
- See: Deployment history, analytics

---

## 🎯 **Next Steps**

After adding the secrets:

1. **Test the automation** (see Step 2 above)
2. **Monitor first deployment** in GitHub Actions
3. **Verify both URLs** work after deploy
4. **Celebrate** 🎉 - You now have complete CI/CD!

---

**Total Setup Time:** 2 minutes  
**Monthly Cost:** $0  
**Automation Level:** 100% ✨
