# CORS Troubleshooting Guide

## Quick Start

### Enable CORS Override
1. Open EchoKit (click extension icon or open DevTools panel)
2. Click ⚙️ **Settings**
3. Set **Scope** based on your needs:
   - **Domain** (recommended) - Only affects current domain
   - **Tab** - Only affects current tab
   - **Global** - Affects all tabs (use sparingly)
4. Toggle **CORS Override** to **ON**
5. Refresh your page to apply changes

### Verify It's Working
1. In Settings, click **🔍 Run Diagnostics** button
2. Check the dialog for:
   - ✅ CORS Enabled: true
   - ✅ Rule Installed: true
3. Open browser console (F12)
4. Look for: `[EchoKit CORS] Installed ... rule for ...`

---

## Common Issues

### Issue 1: "CORS is ON but still getting CORS errors"

**Symptoms:**
- CORS toggle shows ON
- Still seeing CORS errors in console
- Diagnostics shows "Rule Installed: false"

**Solutions:**

1. **Check Your Scope Setting**
   ```
   Problem: You're on scope=Tab but the tab ID changed
   Fix: Switch to scope=Domain or scope=Global
   ```

2. **Refresh the Page**
   ```
   CORS rules apply to NEW requests
   Refresh the page after enabling CORS
   ```

3. **Check Browser Console for Errors**
   ```
   Look for: [EchoKit CORS] Failed to apply CORS rules: ...
   This indicates a permission or rule installation issue
   ```

4. **Run Diagnostics**
   ```
   Settings → CORS Override → 🔍 Run Diagnostics
   Copy the output and check:
   - corsEnabled: should be true
   - ruleInstalled: should be true
   - scope: should match your setting
   ```

---

### Issue 2: "Diagnostics shows 'Rule Installed: true' but CORS still failing"

**Possible Causes:**

1. **Server is explicitly rejecting requests**
   - Some servers check origin and reject wildcard CORS
   - CORS override can't fix server-side rejections

2. **Request includes credentials but CORS doesn't allow**
   - We removed `Access-Control-Allow-Credentials: true` to comply with spec
   - If your request sends cookies/auth, CORS override won't help
   - Solution: Test without credentials or use a proxy

3. **Preflight request is being blocked**
   - OPTIONS requests might be blocked by other extensions
   - Solution: Disable other extensions temporarily

---

### Issue 3: "CORS works in some tabs but not others"

**Cause:** You're using scope=Tab

**Solution:**
1. Switch to scope=Domain in Settings
2. Reload all affected tabs
3. OR keep scope=Tab and enable CORS after opening each new tab

---

### Issue 4: "CORS stops working after browser restart"

**Cause:** You're using scope=Tab or scope=Domain

**Explanation:**
- Tab/Domain scopes use **session rules** (cleared on restart)
- Global scope uses **dynamic rules** (persist across restarts)

**Solution:**
1. Use scope=Global if you need persistence
2. OR re-enable CORS after each browser restart

---

## Understanding Scopes

### 🌐 Global Scope
**When to use:** Testing across multiple domains/tabs simultaneously

**How it works:**
- Browser-wide CORS override
- Affects ALL tabs
- Persists across extension reloads
- Uses `declarativeNetRequest` dynamic rules

**Pros:**
- ✅ Works everywhere
- ✅ Persists across restarts

**Cons:**
- ⚠️ Can interfere with other sites
- ⚠️ May mask real CORS issues

---

### 🌍 Domain Scope (RECOMMENDED)
**When to use:** Local development on specific domain

**How it works:**
- Only affects requests to current domain(s)
- Updates automatically when you navigate
- Session-scoped (cleared on extension reload)
- Uses `declarativeNetRequest` session rules with domain filter

**Pros:**
- ✅ Isolated to your dev domain
- ✅ Won't affect other sites
- ✅ Auto-updates on navigation

**Cons:**
- ⚠️ Cleared on extension reload

---

### 📑 Tab Scope
**When to use:** Testing multiple environments in different tabs

**How it works:**
- Only affects requests from specific tab(s)
- Updates when tabs are created/closed
- Session-scoped (cleared on extension reload)
- Uses `declarativeNetRequest` session rules with tab ID filter

**Pros:**
- ✅ Maximum isolation
- ✅ Different tabs can have different CORS settings

**Cons:**
- ⚠️ Must enable in each tab separately
- ⚠️ Tab IDs can change

---

## Advanced Debugging

### Check Chrome's Network Tab
1. Open DevTools → Network
2. Look for the failed request
3. Click it → Headers tab
4. Check **Response Headers** section
5. You should see:
   - `Access-Control-Allow-Origin: *`
   - `Access-Control-Allow-Methods: *`
   - `Access-Control-Allow-Headers: *`

### Check Installed Rules
Open console and run:
```javascript
// Check dynamic rules (global scope)
chrome.declarativeNetRequest.getDynamicRules().then(rules => {
  console.log('Dynamic rules:', rules.filter(r => r.id === 1001));
});

// Check session rules (tab/domain scope)
chrome.declarativeNetRequest.getSessionRules().then(rules => {
  console.log('Session rules:', rules.filter(r => r.id === 1001));
});
```

---

## When CORS Override Won't Help

1. **Server explicitly blocks wildcard origins**
   - Server checks `Origin` header and rejects `*`
   - Solution: Use a proxy or configure server

2. **Credentialed requests with wildcard origin**
   - Spec requires exact origin when credentials=true
   - Solution: Remove credentials or use proxy

3. **CSP (Content Security Policy) blocking requests**
   - CSP is separate from CORS
   - Solution: Disable CSP or adjust policy

4. **HTTPS → HTTP requests**
   - Mixed content is blocked by browser
   - CORS can't fix this
   - Solution: Use HTTPS for all requests

---

## Need More Help?

1. Run diagnostics and copy output
2. Check browser console for `[EchoKit CORS]` logs
3. Open an issue on GitHub with:
   - Diagnostics output
   - Console logs
   - Steps to reproduce
