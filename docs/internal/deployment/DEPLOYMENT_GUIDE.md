# EchoKit v1.6.0 Deployment Guide

## 🎯 Mission: Complete P0 Ship Blockers

This guide walks you through the critical deployment tasks to launch EchoKit v1.6.0.

---

## ✅ What's Been Completed

All code changes from emergent.sh have been committed:
- ✅ CLI coverage reporting (`--report` flag, `/__coverage` endpoint)
- ✅ WebSocket/SSE replay support (zero-dep implementation)
- ✅ GitHub Actions workflow with PR coverage comments
- ✅ npm publish preparation (LICENSE, .npmignore)
- ✅ All 17 CLI tests passing
- ✅ All 8 Worker tests passing
- ✅ Committed in: `e41b865`

---

## 🔴 P0: Critical Deployment Tasks (Do These Next)

### Task 1: Deploy Cloudflare Worker (30 min)

**Purpose**: License validation service for Pro/LTD customers

**Steps**:
```bash
cd /Users/rkamalapuram/git-personal/echokit/worker
./deploy.sh
```

The script will:
1. Authenticate you with Cloudflare (opens browser)
2. Generate and set ECHOKIT_HMAC_SECRET (save this!)
3. Generate and set ECHOKIT_ADMIN_TOKEN (save this!)
4. Deploy the worker

**Expected Output**:
```
Published echokit-license (X.XX sec)
  https://echokit-license.<YOUR_SUBDOMAIN>.workers.dev
```

**Save**:
- Worker URL → needed for extension Settings UI
- ECHOKIT_HMAC_SECRET → password manager (never lose this!)
- ECHOKIT_ADMIN_TOKEN → password manager (for minting keys)

**Verification**:
```bash
curl https://echokit-license.<YOUR_SUBDOMAIN>.workers.dev/__health
# Should return: {"ok":true,"name":"EchoKit License API"}
```

See: `../../../worker/DEPLOY.md` for detailed instructions

---

### Task 2: Publish echokit-server to npm (15 min)

**Purpose**: Make CLI available via `npx echokit-server` for CI/testing

**Prerequisites**: npm account with verified email

**Steps**:
```bash
# 1. Login to npm
npm login
# Enter: username, password, email, OTP (if 2FA enabled)

# 2. Verify login
npm whoami

# 3. Publish
cd /Users/rkamalapuram/git-personal/echokit/cli
npm publish --access=public
```

**Expected Output**:
```
+ echokit-server@1.0.0
```

**Verification**:
```bash
npx echokit-server --help
# Should show CLI help text
```

**Post-Publish**:
- Update repo README to reference `npx echokit-server`
- Test: `npx echokit-server <export.json>`

See: `../../../cli/PUBLISH.md` for detailed instructions

---

### Task 3: Upload to Chrome Web Store (45 min)

**Purpose**: Make extension available for public download

**Prerequisites**: 
- Chrome Web Store developer account ($5 one-time fee)
- Screenshots (see `../../../store/screenshot-guide.md`)

**Package**: `store/echokit-api-recorder-mocker-v1.6.0.zip` (ready to upload)

**Steps**:
1. Go to: https://chrome.google.com/webstore/devconsole
2. Click **New Item**
3. Upload `store/echokit-api-recorder-mocker-v1.6.0.zip`
4. Fill listing fields from `../../../store/chrome-web-store.md`:
   - Name: `EchoKit — API Recorder & Mocker`
   - Summary: (copy from chrome-web-store.md)
   - Description: (copy from chrome-web-store.md)
   - Category: `Developer Tools`
5. Upload icon: `extension/icons/icon128.png`
6. Upload promo tiles: `store/promo-*.png`
7. Upload screenshots: `store/screenshots/*.png`
8. Privacy Policy URL: (host `../../../store/privacy-policy.md` on GitHub Pages)
9. Declare permissions (see chrome-web-store.md)
10. Submit for review (1-7 days)

See: `../../../store/chrome-web-store.md` for listing copy

---

## 🟠 P1: High-Value Features (After P0)

### License Endpoint UI in Extension

**File**: `extension/shared/app.js`
**Location**: `showSettingsDialog()` function

Add input field after License Key row:
```javascript
// After license key input, add:
const endpoint = await BG({ type: 'echokit:settings:get', key: 'licenseEndpoint' }) || '';
html += `
  <div class="settings-row">
    <label for="license-endpoint">License Endpoint</label>
    <div style="display: flex; gap: 8px;">
      <input type="text" id="license-endpoint" value="${endpoint}" 
             placeholder="https://echokit-license.your-subdomain.workers.dev"
             style="flex: 1;">
      <button id="test-endpoint" class="secondary">Test</button>
    </div>
    <div class="help-text">Custom license validation endpoint. Leave blank to use default.</div>
  </div>
`;

// In event handlers:
dialog.querySelector('#license-endpoint').addEventListener('change', async (e) => {
  await BG({ type: 'echokit:license:setEndpoint', endpoint: e.target.value.trim() });
});

dialog.querySelector('#test-endpoint').addEventListener('click', async () => {
  const ep = dialog.querySelector('#license-endpoint').value.trim();
  if (!ep) return alert('Enter an endpoint URL first');
  try {
    const res = await fetch(ep + '/__health');
    const data = await res.json();
    if (data.ok) alert('✓ Endpoint is healthy: ' + data.name);
    else alert('✗ Unexpected response: ' + JSON.stringify(data));
  } catch (e) {
    alert('✗ Connection failed: ' + e.message);
  }
});
```

**Background handler** (`extension/background.js`):
```javascript
case 'echokit:license:setEndpoint':
  await chrome.storage.sync.set({ echokit_license_endpoint: msg.endpoint });
  return { ok: true };
```

**Update validation function** to use custom endpoint if set.

---

## 📋 Post-Deployment Checklist

After completing P0 tasks:

- [ ] Cloudflare Worker deployed and tested
- [ ] Worker URL saved securely
- [ ] HMAC_SECRET saved in password manager
- [ ] ADMIN_TOKEN saved in password manager
- [ ] npm package published and verified
- [ ] Chrome Web Store submission complete
- [ ] Extension docs updated with npm/worker URLs
- [ ] Test end-to-end: extension → worker → license validation
- [ ] Update `../../../TODO.md` to mark P0 tasks complete

---

## 🔧 Quick Reference

**Test CLI locally**:
```bash
node cli/test/test.js  # All tests should pass
```

**Test Worker locally**:
```bash
node worker/test.js    # All tests should pass
```

**Mint a test license key** (after worker deployment):
```bash
curl -X POST https://echokit-license.<YOUR_SUBDOMAIN>.workers.dev/v1/issue \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"plan":"LTD","expiresAt":0}'
```

**Test license validation**:
```bash
curl -X POST https://echokit-license.<YOUR_SUBDOMAIN>.workers.dev/v1/validate \
  -H "Content-Type: application/json" \
  -d '{"key":"<KEY_FROM_PREVIOUS_STEP>"}'
```

---

## 📞 Need Help?

- Cloudflare Worker: `../../../worker/DEPLOY.md`
- npm Publishing: `../../../cli/PUBLISH.md`
- Chrome Web Store: `../../../store/chrome-web-store.md`
- Full roadmap: `../../../TODO.md`

---

**Current Status**: Ready for P0 deployment. All code complete ✅
**Next Action**: Run `../../../worker/deploy.sh` to deploy the license worker
