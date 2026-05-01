# Chrome Web Store - First Time Upload Guide

## ✅ Package Ready

**File:** `/Users/rkamalapuram/git-personal/echokit/store/echokit-api-recorder-mocker-v1.6.0.zip` (56K)

---

## Step 1: Create Developer Account

1. Go to: **https://chrome.google.com/webstore/devconsole**
2. Sign in with your Google account
3. **Pay the one-time $5 developer registration fee**
   - Click "Pay this fee now"
   - This is a one-time payment, never charged again
4. Wait for payment confirmation (usually instant)

---

## Step 2: Upload Extension

1. Click **"New Item"** button
2. **Upload your package:**
   - Click "Choose file" or drag and drop
   - Select: `store/echokit-api-recorder-mocker-v1.6.0.zip`
   - Click "Upload"
3. Wait for upload to complete (~10 seconds)

---

## Step 3: Store Listing

### Product Details

**Extension Name:**
```
EchoKit — API Recorder & Mocker
```

**Summary (132 chars max):**
```
Record real API interactions and instantly mock them. Zero setup. Built for frontend devs & QA. Record once. Mock reliably.
```

**Description (full):**
```
EchoKit is a Chrome extension that records your real API interactions and lets you instantly mock them for testing and development.

🎯 BUILT FOR DEVELOPERS & QA

• Record fetch/XHR/WebSocket/SSE traffic with one click
• Mock responses instantly — no proxy, no code changes
• Export recordings as JSON for CLI/CI integration
• Per-tab mock toggle — work on new features while mocking legacy APIs
• Coverage tracking to see which mocks are actually used

⚡ ZERO SETUP REQUIRED

1. Click Record
2. Use your app normally
3. Click Mock
4. Replay your recordings instantly

No configuration files. No webpack plugins. No backend setup.

🚀 POWERFUL FEATURES

• URL matching modes: strict, fuzzy, regex, custom rules
• Chain mocks for multi-step workflows (login → dashboard → data)
• Transform rules to modify requests/responses on the fly
• WebSocket & Server-Sent Events support
• Export to Postman, HAR, or EchoKit JSON
• GitHub Gist sync for team collaboration (Pro)
• Headless CLI server for CI/CD pipelines

💼 USE CASES

• Frontend development without waiting for backend APIs
• E2E testing with reliable, repeatable API mocks
• Demo presentations with offline data
• Debugging production issues with recorded traffic
• QA automation with consistent test data

🔐 PRIVACY FIRST

• All data stays local in your browser
• No analytics, no tracking, no telemetry
• Open source: github.com/ravitejakamalapuram/echokit

📦 CLI INTEGRATION

Install the headless server for CI/CD:
npm install -g echokit-server

Run in GitHub Actions, Jenkins, or any CI pipeline.

---

FREE TIER: Unlimited recordings, basic features
PRO: Advanced matching, GitHub sync, priority support

Get started in seconds. No signup required.
```

**Category:**
```
Developer Tools
```

**Language:**
```
English (United States)
```

---

## Step 4: Graphics

### Icon (128x128)
- Upload: `extension/icons/icon128.png`

### Screenshots (1280x800 or 640x400)
Use these files from `store/screenshots/`:
1. `cap-01-record-mock-loop.png` - Recording UI
2. `cap-02-detail-editor.png` - Mock editor
3. `cap-03-settings.png` - Settings panel
4. `cap-04-light-theme.png` - Light theme view

### Promotional Images (optional but recommended)
- Small tile (440x280): `store/promo-tile-440x280.png`
- Marquee (1400x560): `store/promo-marquee-1400x560.png`

---

## Step 5: Additional Info

**Official URL:**
```
https://github.com/ravitejakamalapuram/echokit
```

**Homepage URL:**
```
https://github.com/ravitejakamalapuram/echokit
```

**Support URL:**
```
https://github.com/ravitejakamalapuram/echokit/issues
```

---

## Step 6: Privacy & Permissions

**Single Purpose:**
```
This extension records and mocks HTTP/WebSocket API traffic for development and testing purposes.
```

**Permission Justifications:**

- **storage**: Store recorded API interactions locally
- **tabs**: Inject mock scripts into web pages
- **activeTab**: Access current tab to record/mock traffic
- **scripting**: Inject content scripts for API interception
- **declarativeNetRequest**: Block real API calls when mocking is enabled
- **unlimitedStorage**: Store large API recordings without quota limits
- **clipboardRead/Write**: Copy/paste API mocks
- **cookies**: Include cookies in recorded interactions
- **host_permissions (all_urls)**: Record traffic from any website

**Remote Code:** No

**Data Usage:**
- Check: "This extension does NOT collect user data"

---

## Step 7: Submit for Review

1. Review all information carefully
2. Click **"Submit for Review"**
3. Wait 1-7 days for Google review (usually 2-3 days)
4. You'll get an email when approved or if changes are needed

---

## After Approval

Once approved, your extension will be live at:
```
https://chrome.google.com/webstore/detail/YOUR_EXTENSION_ID
```

You can then:
- Share the link with users
- Add it to your GitHub README
- Update it by uploading new versions

---

## Tips

✅ Use clear, professional screenshots
✅ Write accurate permission justifications
✅ Test the extension locally first
✅ Respond quickly to any review feedback
✅ Keep version numbers consistent with manifest.json

---

## Common Issues & Fixes

**Issue: "Description too long"**
- Solution: Already fixed in v1.6.0 (123 chars, under 132 limit)

**Issue: "Missing required fields"**
- Solution: All required fields are included in the guide above

**Issue: "Invalid permissions"**
- Solution: All permissions have justifications above
