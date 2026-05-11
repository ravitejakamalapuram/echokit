# Implementation Guide: Global Request Headers

## 📋 Overview
This guide provides step-by-step instructions for implementing the Global Request Headers feature in EchoKit.

---

## 🛠️ Step 1: Update Data Structures

### 1.1 Background Service Worker (`extension/background.js`)

```javascript
// Line ~18-26: Update default settings
let settings = {
  corsOverride: false,
  scope: 'tab',
  theme: 'dark',
  autoOpenOnRefresh: true,
  blocklist: [],
  rewriteRules: [],
  transformRules: [],
  requestHeaders: []  // ADD THIS
};
```

### 1.2 Shared App State (`extension/shared/app.js`)

```javascript
// Line ~58-62: Update state initialization
let state = {
  mode: 'popup',
  tabId: null,
  tab: { recording: false, mocking: false, sessionId: null, host: '' },
  settings: { 
    corsOverride: false, 
    scope: 'domain', 
    theme: 'dark', 
    autoOpenOnRefresh: true, 
    blocklist: [], 
    rewriteRules: [], 
    transformRules: [],
    requestHeaders: []  // ADD THIS
  },
  // ... rest of state
};
```

---

## 🛠️ Step 2: Implement Header Application Logic

### 2.1 Injected Script (`extension/injected.js`)

Add the `applyRequestHeaders` function after `applyResponseTransforms`:

```javascript
// After line ~167, add this function:
function applyRequestHeaders(headers, url) {
  const rules = (state.requestHeaders || []).filter(r => r.enabled);
  if (!rules.length) return headers;
  
  let modified = { ...headers };
  
  for (const rule of rules) {
    try {
      // URL pattern filtering (blank = apply to all)
      if (rule.urlPattern && !url.includes(rule.urlPattern)) continue;
      
      const key = rule.key || '';
      if (!key) continue;
      
      if (rule.mode === 'add') {
        // Only add if header doesn't exist
        if (!(key in modified)) {
          modified[key] = rule.value || '';
        }
      } else if (rule.mode === 'override') {
        // Set header (replace or add)
        modified[key] = rule.value || '';
      } else if (rule.mode === 'remove') {
        // Delete header
        delete modified[key];
      }
    } catch (e) {
      console.warn('[EchoKit] Request header rule error:', e);
    }
  }
  
  return modified;
}
```

### 2.2 Update State Listener (`extension/injected.js`)

```javascript
// Line ~124-130: Add requestHeaders to state
window.addEventListener('message', (e) => {
  if (e.origin !== window.origin || !e.data) return;
  const d = e.data;
  if (d.type === 'echokit:mockIndex') {
    // ... existing code
  }
  else if (d.type === 'echokit:tabState') {
    const p = d.payload || {};
    state.recording = !!p.recording;
    state.mocking = !!p.mocking;
    state.rewriteRules = p.rewriteRules || [];
    state.transformRules = p.transformRules || [];
    state.requestHeaders = p.requestHeaders || [];  // ADD THIS
  }
}, false);
```

---

## 🛠️ Step 3: Apply Headers in Fetch Hook

### 3.1 Modify Fetch Hook (`extension/injected.js`)

```javascript
// Around line ~255-262: Apply headers before fetch
const rewrittenUrl = applyRewriteRules(url);
const started = Date.now();
let res, err;

// Apply request headers
const modifiedReqHeaders = applyRequestHeaders(reqHeaders, url);

try {
  // Use rewritten URL if different
  const fetchTarget = rewrittenUrl !== url ? rewrittenUrl : input;
  
  // Create modified init with updated headers
  const modifiedInit = init ? { ...init } : {};
  modifiedInit.headers = modifiedReqHeaders;
  
  res = await origFetch(fetchTarget, modifiedInit);
} catch (e) { err = e; }
```

---

## 🛠️ Step 4: Apply Headers in XHR Hook

### 4.1 Modify XHR Send (`extension/injected.js`)

```javascript
// Around line ~324: Apply headers before send
XHR.prototype.send = function (body) {
  const ctx = this.__echokit || {};
  ctx.body = body != null ? (typeof body === 'string' ? body : 
    (body instanceof URLSearchParams ? body.toString() : '[binary]')) : null;
  
  // Apply request headers BEFORE matching/blocking
  const url = ctx.url || '';
  ctx.headers = applyRequestHeaders(ctx.headers || {}, url);
  
  // Now re-set all headers on the XHR object
  for (const [key, value] of Object.entries(ctx.headers)) {
    try {
      origSetHeader.call(this, key, value);
    } catch (e) {
      console.warn('[EchoKit] Failed to set header:', key, e);
    }
  }
  
  const matchKeys = computeMatchKeys(ctx.method, url, ctx.body);
  // ... rest of existing code
};
```

---

## 🛠️ Step 5: Push Headers to Tabs

### 5.1 Update `pushTabMeta` (`extension/background.js`)

```javascript
// Line ~194: Add requestHeaders to payload
safeSend(tabId, { 
  type: 'echokit:tabState', 
  payload: { 
    ...st, 
    corsOverride: settings.corsOverride, 
    scope: settings.scope, 
    blocklist: settings.blocklist, 
    rewriteRules: settings.rewriteRules || [], 
    transformRules: settings.transformRules || [],
    requestHeaders: settings.requestHeaders || []  // ADD THIS
  } 
});
```

---

## 🛠️ Step 6: Build Settings UI

### 6.1 Render Settings Section (`extension/shared/app.js`)

Add after the Transform Rules section (around line ~2190):

```javascript
<div class="ek-settings-row">
  <div style="flex:1">
    <div class="ek-settings-title">Global Request Headers</div>
    <div class="ek-settings-hint">
      Inject, override, or remove headers on all outgoing requests. 
      Useful for auth tokens, tenant IDs, feature flags, etc.
    </div>
    <div id="ek-requestheaders" style="margin-top:8px" data-testid="requestheaders">
      ${(s.requestHeaders || []).map((r, idx) => `
        <div style="border:1px solid var(--border);border-radius:6px;padding:8px;margin-bottom:6px" 
             data-testid="requestheader-row">
          <div class="ek-row-inline" style="gap:6px;margin-bottom:6px">
            <input class="ek-input" 
                   value="${escapeHtml(r.key || '')}" 
                   data-a="rh-key" 
                   data-idx="${idx}" 
                   placeholder="Header name (e.g., Authorization)" 
                   style="flex:1" 
                   data-testid="requestheader-key-${idx}"/>
            <select class="ek-input" 
                    data-a="rh-mode" 
                    data-idx="${idx}" 
                    style="width:120px" 
                    data-testid="requestheader-mode-${idx}">
              <option value="add" ${r.mode === 'add' ? 'selected' : ''}>Add</option>
              <option value="override" ${r.mode === 'override' ? 'selected' : ''}>Override</option>
              <option value="remove" ${r.mode === 'remove' ? 'selected' : ''}>Remove</option>
            </select>
            <input type="checkbox" 
                   ${r.enabled ? 'checked' : ''} 
                   data-a="rh-toggle" 
                   data-idx="${idx}" 
                   data-testid="requestheader-toggle-${idx}"/>
            <button class="ek-kv-remove" 
                    data-a="rh-remove" 
                    data-idx="${idx}" 
                    aria-label="remove" 
                    data-testid="requestheader-remove-${idx}">×</button>
          </div>
          <div class="ek-row-inline" style="gap:6px">
            <input class="ek-input"
                   value="${escapeHtml(r.value || '')}"
                   data-a="rh-value"
                   data-idx="${idx}"
                   placeholder="${r.mode === 'remove' ? '(not needed for remove)' : 'Header value'}"
                   ${r.mode === 'remove' ? 'disabled' : ''}
                   style="flex:1"
                   data-testid="requestheader-value-${idx}"/>
            <input class="ek-input"
                   value="${escapeHtml(r.urlPattern || '')}"
                   data-a="rh-url"
                   data-idx="${idx}"
                   placeholder="URL contains... (blank = all)"
                   style="flex:1"
                   data-testid="requestheader-url-${idx}"/>
          </div>
        </div>
      `).join('')}
    </div>
    <button class="ek-btn ek-btn-ghost"
            data-a="rh-add"
            style="margin-top:6px"
            data-testid="requestheader-add">＋ Add Request Header</button>
  </div>
</div>
```

### 6.2 Add Event Handlers (`extension/shared/app.js`)

Add after Transform Rules handlers (around line ~2345):

```javascript
// --- Request Headers handlers ---
const rhUpdate = async (idx, patch) => {
  const headers = [...(state.settings.requestHeaders || [])];
  headers[idx] = { mode: 'override', enabled: true, ...(headers[idx] || {}), ...patch };
  await BG({ type: 'echokit:settings:update', patch: { requestHeaders: headers } });
  await refresh();
};

overlay.querySelectorAll('[data-a="rh-key"]').forEach(el =>
  el.addEventListener('change', async (e) => {
    await rhUpdate(Number(el.getAttribute('data-idx')), { key: e.target.value });
  }));

overlay.querySelectorAll('[data-a="rh-value"]').forEach(el =>
  el.addEventListener('change', async (e) => {
    await rhUpdate(Number(el.getAttribute('data-idx')), { value: e.target.value });
  }));

overlay.querySelectorAll('[data-a="rh-mode"]').forEach(el =>
  el.addEventListener('change', async (e) => {
    await rhUpdate(Number(el.getAttribute('data-idx')), { mode: e.target.value });
    reopen();  // Re-render to show/hide value field
  }));

overlay.querySelectorAll('[data-a="rh-url"]').forEach(el =>
  el.addEventListener('change', async (e) => {
    await rhUpdate(Number(el.getAttribute('data-idx')), { urlPattern: e.target.value });
  }));

overlay.querySelectorAll('[data-a="rh-toggle"]').forEach(el =>
  el.addEventListener('change', async (e) => {
    await rhUpdate(Number(el.getAttribute('data-idx')), { enabled: e.target.checked });
    reopen();
  }));

overlay.querySelectorAll('[data-a="rh-remove"]').forEach(el =>
  el.addEventListener('click', async () => {
    const idx = Number(el.getAttribute('data-idx'));
    const headers = [...(state.settings.requestHeaders || [])];
    headers.splice(idx, 1);
    await BG({ type: 'echokit:settings:update', patch: { requestHeaders: headers } });
    await refresh();
    reopen();
  }));

overlay.querySelector('[data-a="rh-add"]')?.addEventListener('click', async () => {
  const headers = [...(state.settings.requestHeaders || []),
    { key: '', value: '', mode: 'override', urlPattern: '', enabled: true }];
  await BG({ type: 'echokit:settings:update', patch: { requestHeaders: headers } });
  await refresh();
  reopen();
});
```

---

## 🧪 Step 7: Add Tests

### 7.1 Smoke Test (`tests/smoke_echokit.py`)

Add after Transform Rules tests (around line ~662):

```python
# === NEW: Request Headers CRUD via settings:update ===
sw_send(sw, {'type': 'echokit:settings:update',
             'patch': {'requestHeaders': [
                 {'key': 'Authorization', 'value': 'Bearer test-token',
                  'mode': 'override', 'urlPattern': '', 'enabled': True}
             ]}})
rh_state = sw_send(sw, {'type': 'echokit:getState', 'tabId': tab_id})
rh_headers = rh_state.get('settings', {}).get('requestHeaders', [])
step('request_header_persists',
     len(rh_headers) == 1 and
     rh_headers[0].get('key') == 'Authorization' and
     rh_headers[0].get('mode') == 'override',
     rh_headers)
sw_send(sw, {'type': 'echokit:settings:update', 'patch': {'requestHeaders': []}})
```

---

## 📚 Step 8: Update Documentation

### 8.1 Update PRD (`memory/PRD.md`)

Add to the "What's Been Implemented" section:

```markdown
- ✅ **Global Request Headers** (Settings → Global Request Headers) —
  add/override/remove headers on all outgoing requests; supports URL pattern
  filtering; useful for auth tokens, tenant IDs, feature flags
```

### 8.2 Update README (`README.md`)

Add to features section:

```markdown
- **Global Request Headers**: Inject custom headers into all requests
  without code changes. Perfect for testing with different auth tokens,
  tenant IDs, or feature flags.
```

---

## 🎯 Testing Checklist

- [ ] Add a request header with `mode: 'override'` → verify header appears in recorded request
- [ ] Add a request header with `mode: 'add'` → verify header only added if not present
- [ ] Add a request header with `mode: 'remove'` → verify header is stripped
- [ ] Add URL pattern filter → verify header only applies to matching URLs
- [ ] Toggle enabled/disabled → verify header stops applying when disabled
- [ ] Export JSON → verify requestHeaders are included
- [ ] Import JSON → verify requestHeaders are restored
- [ ] Refresh page → verify headers persist across sessions
- [ ] Test with both fetch and XHR → verify both hooks work

---

## 🚨 Edge Cases to Handle

1. **Case-insensitive header matching**: HTTP headers are case-insensitive, ensure proper handling
2. **Multiple rules for same header**: Later rules should take precedence
3. **Empty header values**: Allow empty strings for headers that don't need values
4. **Special characters in header values**: Ensure proper escaping/encoding
5. **Conflict with per-API headers**: Global headers should apply first, then per-API overrides
6. **CORS preflight**: Don't modify OPTIONS requests (or make it configurable)

---

## 🎨 UI Polish Ideas

1. **Preset Templates**: Quick-add buttons for common patterns:
   - "Add Auth Token"
   - "Add Tenant ID"
   - "Remove Tracking Headers"

2. **Header Value Autocomplete**: Suggest common header names as user types

3. **Visual Feedback**: Show a badge count of active request header rules in settings tab

4. **Validation**: Warn if header name contains invalid characters

5. **Test Mode**: "Dry run" button to preview which requests would be affected

---

## 📦 CLI Support (Optional)

Add `--request-headers` flag to `echokit-server`:

```bash
echokit-server export.json --request-headers "Authorization:Bearer abc123,X-Tenant-ID:tenant-42"
```

Implementation in `cli/lib/server.js` would parse the flag and apply headers to all outgoing requests.
