# Feature: Global Request Headers

## 🎯 Product Vision

Allow developers to inject custom headers into **all outgoing requests** (both real traffic and mocked responses) without modifying per-API configurations. This empowers developers to:

- Add authentication headers globally during testing (e.g., `Authorization: Bearer <token>`)
- Override headers like `User-Agent`, `X-API-Key`, `X-Tenant-ID` across all APIs
- Inject feature flags or environment-specific headers (e.g., `X-Feature-Flag: new-checkout`)
- Test backend behavior with different client contexts
- Remove headers they don't want to send (e.g., tracking headers)

---

## 📊 User Stories

1. **As a frontend developer**, I want to add a global `Authorization` header so I can test with different user tokens without editing each API individually.

2. **As a QA engineer**, I want to override the `X-Tenant-ID` header globally to test multi-tenant scenarios without changing application code.

3. **As a backend developer**, I want to inject custom headers to simulate feature flags or A/B test cohorts.

4. **As a security tester**, I want to remove certain headers (like cookies or tracking IDs) globally to test auth fallback mechanisms.

---

## 🏗️ Technical Design

### Data Structure

Add a new `requestHeaders` array to settings:

```javascript
settings = {
  corsOverride: false,
  scope: 'domain',
  theme: 'dark',
  autoOpenOnRefresh: true,
  blocklist: [],
  rewriteRules: [],
  transformRules: [],
  requestHeaders: [  // NEW
    {
      key: 'Authorization',
      value: 'Bearer abc123...',
      mode: 'add',      // 'add' | 'override' | 'remove'
      enabled: true,
      urlPattern: '',   // blank = apply to all URLs, or substring match
    }
  ]
}
```

### Header Modes

1. **`add`** — Add header if it doesn't exist (leave existing values untouched)
2. **`override`** — Set header value (replace if exists, add if doesn't)
3. **`remove`** — Delete the header from the request

### Application Points

**Real Requests (fetch/XHR):**
- Apply in `injected.js` before calling `origFetch()` or `origSend()`
- Modify the `Headers` object or XHR's `setRequestHeader()`

**Mocked Responses (when mocking is on):**
- Apply transformations to the mock's request headers for matching purposes
- This ensures headers are consistent whether hitting real API or mock

**Recording:**
- Headers should be captured **after** global headers are applied
- This ensures recorded interactions reflect the modified request state

---

## 🎨 UI/UX Design

### Settings Panel Addition

Add a new section: **"Global Request Headers"**

```
┌─────────────────────────────────────────────────────────┐
│ Global Request Headers                                  │
│ Inject, override, or remove headers on ALL requests    │
│                                                          │
│ ┌─────────────┬──────────────┬──────────┬─────┬────┐  │
│ │ Header Name │ Value        │ Mode     │ URL │ ✓  │  │
│ ├─────────────┼──────────────┼──────────┼─────┼────┤  │
│ │ Authorization│ Bearer abc123│ override │     │ ✓  │  │
│ │ X-Tenant-ID │ tenant-42    │ add      │ /api│ ✓  │  │
│ │ X-Debug     │              │ remove   │     │ ✓  │  │
│ └─────────────┴──────────────┴──────────┴─────┴────┘  │
│                                                          │
│ [+ Add Request Header]                                  │
└─────────────────────────────────────────────────────────┘
```

**Columns:**
- **Header Name**: Text input (e.g., `Authorization`)
- **Value**: Text input (not needed for `remove` mode)
- **Mode**: Dropdown (`add`, `override`, `remove`)
- **URL Filter**: Optional substring match (blank = all URLs)
- **Toggle**: Enable/disable this rule
- **Delete**: Remove rule entirely

---

## 🔧 Implementation Plan

### Phase 1: Backend Logic (injected.js)

1. **Add `state.requestHeaders`** to the injected script state
2. **Create `applyRequestHeaders(headers, url)` function**
   - Similar pattern to `applyResponseTransforms()`
   - Takes existing headers object, applies rules, returns modified headers
3. **Apply in fetch hook**:
   ```javascript
   // Before: res = await origFetch(input, init);
   // After:
   const modifiedHeaders = applyRequestHeaders(reqHeaders, url);
   const modifiedInit = { ...init, headers: modifiedHeaders };
   res = await origFetch(input, modifiedInit);
   ```
4. **Apply in XHR hook**:
   - Override `XHR.prototype.send` to inject headers before calling `origSend()`

### Phase 2: Settings Storage & Sync

1. **Update default settings** in `background.js`:
   ```javascript
   let settings = {
     // ... existing
     requestHeaders: []
   };
   ```
2. **Push to tabs** in `pushTabMeta()`:
   ```javascript
   safeSend(tabId, { 
     type: 'echokit:tabState', 
     payload: { 
       ...st, 
       requestHeaders: settings.requestHeaders || [] 
     } 
   });
   ```

### Phase 3: UI (shared/app.js)

1. **Add settings section** in `renderSettings()`
2. **Add event handlers** for:
   - `rh-key`, `rh-value`, `rh-mode`, `rh-url`, `rh-toggle`, `rh-remove`, `rh-add`
3. **Validation**:
   - Warn if header name is empty
   - Show hint that `remove` mode doesn't need a value

### Phase 4: Testing & Documentation

1. **Smoke test** in `tests/smoke_echokit.py`:
   - Add request header via settings
   - Trigger a real request
   - Verify header is present in the recorded interaction
2. **Update README.md** and **PRD.md**
3. **CLI support** (optional): Add `--request-headers` flag to `echokit-server`

---

## 🚀 Developer Benefits

### ✅ Why This Is Super Helpful

1. **No Code Changes**: Add headers without touching app code or environment variables
2. **Fast Iteration**: Toggle headers on/off instantly via UI
3. **Per-Environment Testing**: Different header sets for dev/staging/prod
4. **Multi-Tenant Testing**: Switch tenant IDs with one click
5. **Security Testing**: Remove auth headers to test fallback behavior
6. **Feature Flag Simulation**: Inject `X-Feature-Flag` to test unreleased features
7. **URL-Scoped Rules**: Apply headers only to specific API paths
8. **Export/Import**: Share header configurations with teammates via JSON export

---

## 🎓 Example Use Cases

### Use Case 1: Testing with Different User Tokens
```javascript
// Add global header
{ key: 'Authorization', value: 'Bearer user-123-token', mode: 'override', enabled: true }

// All requests now include this header
// Switch to different user by changing value to 'Bearer user-456-token'
```

### Use Case 2: Multi-Tenant Testing
```javascript
// Switch between tenants instantly
{ key: 'X-Tenant-ID', value: 'tenant-A', mode: 'override', urlPattern: '/api', enabled: true }

// Disable rule, enable a different one for tenant-B
{ key: 'X-Tenant-ID', value: 'tenant-B', mode: 'override', urlPattern: '/api', enabled: false }
```

### Use Case 3: Remove Tracking Headers
```javascript
// Remove analytics headers for cleaner testing
{ key: 'X-Client-ID', mode: 'remove', enabled: true }
{ key: 'X-Session-ID', mode: 'remove', enabled: true }
```

---

## 📈 Success Metrics

- **Adoption**: % of users who create at least one request header rule
- **Use Frequency**: Average # of request header rules per user
- **Time Saved**: Reduction in manual header configuration time
- **Feature Requests**: Reduction in requests for per-API header overrides

---

## 🔮 Future Enhancements

1. **Variables/Templating**: Support `{{ENV_VAR}}` syntax in header values
2. **Header Presets**: Save/load common header sets (e.g., "Mobile User", "Admin User")
3. **Conditional Headers**: Apply headers based on request method or response status
4. **Request Body Modification**: Similar global rules for modifying request bodies
5. **Import from `.env`**: Auto-populate headers from environment files
