# Global Request Headers - Changelog

## Feature Overview

**Global Request Headers** allows developers to inject, override, or remove HTTP headers on **all outgoing requests** without code changes. This feature is perfect for:

- Testing with different auth tokens
- Multi-tenant scenarios
- Feature flag injection
- Removing tracking headers
- API key testing

---

## What's New

### 🎯 Core Functionality

**Settings Panel: Global Request Headers**
- Add/edit/remove header rules
- Three modes: `add`, `override`, `remove`
- URL pattern filtering (blank = all URLs)
- Enable/disable toggle per rule
- Respects existing Scope setting (Tab vs Domain)

### 📝 Data Structure

```javascript
{
  key: 'Authorization',           // Header name
  value: 'Bearer token-123',      // Header value (not needed for 'remove')
  mode: 'override',               // 'add' | 'override' | 'remove'
  urlPattern: '/api',             // Optional URL filter (blank = all)
  enabled: true                   // Enable/disable toggle
}
```

### 🔧 Header Modes

1. **add** - Add header only if it doesn't already exist
2. **override** - Set header value (replace if exists, add if doesn't) - *DEFAULT*
3. **remove** - Delete the header from the request

### 🎯 URL Filtering

- **Blank** - Applies to ALL requests
- **Substring** - Only applies to URLs containing the pattern
  - Example: `/api` matches `/api/users`, `/api/products`, etc.
  - Example: `.com/v2` matches `api.example.com/v2/endpoint`

---

## Files Modified

### 1. `extension/background.js`
- Added `requestHeaders: []` to default settings
- Updated `pushTabMeta()` to send requestHeaders to tabs

### 2. `extension/shared/app.js`
- Added `requestHeaders: []` to state initialization
- Added UI section "Global Request Headers" in settings panel
- Added event handlers for header CRUD operations

### 3. `extension/injected.js`
- Added `state.requestHeaders` to receive rules from background
- Implemented `applyRequestHeaders(headers, url)` function
- Applied headers in fetch hook before network request
- Applied headers in XHR hook before send
- Updated recording to capture modified headers

### 4. `tests/smoke_echokit.py`
- Added test for request headers persistence

### 5. `memory/PRD.md`
- Updated "What's Been Implemented" section

---

## How It Works

### Architecture Flow

```
User configures in Settings
         ↓
Background service worker stores in chrome.storage.local
         ↓
Injected script receives state update via postMessage
         ↓
applyRequestHeaders() modifies headers
         ↓
fetch/XHR executes with modified headers
         ↓
Modified headers are recorded in interactions
```

### Application Logic

```javascript
// In injected.js
function applyRequestHeaders(headers, url) {
  const rules = (state.requestHeaders || []).filter(r => r.enabled !== false);
  if (!rules.length) return headers;
  
  let modified = { ...headers };
  
  for (const rule of rules) {
    // URL pattern filtering
    if (rule.urlPattern && !url.includes(rule.urlPattern)) continue;
    
    const key = rule.key || '';
    if (!key) continue;
    
    if (rule.mode === 'add') {
      // Only add if header doesn't exist
      if (!(key in modified)) {
        modified[key] = rule.value || '';
      }
    } else if (rule.mode === 'override' || !rule.mode) {
      // Set header (default mode)
      modified[key] = rule.value || '';
    } else if (rule.mode === 'remove') {
      // Delete header
      delete modified[key];
    }
  }
  
  return modified;
}
```

---

## Usage Examples

### Example 1: Add Auth Token
```json
{
  "key": "Authorization",
  "value": "Bearer eyJhbGciOiJIUzI1NiIs...",
  "mode": "override",
  "urlPattern": "/api",
  "enabled": true
}
```
**Result**: All requests to URLs containing "/api" will have this Authorization header.

### Example 2: Multi-Tenant Testing
```json
[
  {
    "key": "X-Tenant-ID",
    "value": "tenant-a",
    "mode": "override",
    "urlPattern": "",
    "enabled": true
  },
  {
    "key": "X-Tenant-ID",
    "value": "tenant-b",
    "mode": "override",
    "urlPattern": "",
    "enabled": false
  }
]
```
**Usage**: Toggle between tenants by enabling/disabling rules.

### Example 3: Feature Flags
```json
{
  "key": "X-Feature-Flags",
  "value": "new-checkout,beta-ui",
  "mode": "add",
  "urlPattern": "",
  "enabled": true
}
```
**Result**: Adds feature flag header to all requests (only if app doesn't already send it).

### Example 4: Remove Tracking Headers
```json
[
  {
    "key": "X-Client-ID",
    "mode": "remove",
    "enabled": true
  },
  {
    "key": "X-Session-ID",
    "mode": "remove",
    "enabled": true
  }
]
```
**Result**: Strips tracking headers from all requests for clean testing.

---

## Testing

### Manual Testing Checklist
- [ ] Add a header with `mode: 'override'` → Verify it appears in DevTools Network tab
- [ ] Add a header with `mode: 'add'` → Verify it only adds if not present
- [ ] Add a header with `mode: 'remove'` → Verify header is stripped
- [ ] Add URL pattern filter → Verify header only applies to matching URLs
- [ ] Toggle enabled/disabled → Verify header stops applying
- [ ] Export JSON → Verify requestHeaders are included
- [ ] Import JSON → Verify requestHeaders are restored
- [ ] Refresh page → Verify headers persist
- [ ] Test with both fetch and XHR → Verify both work

### Automated Test
Run: `python3 tests/smoke_echokit.py`

Test validates:
- Request headers persist in settings
- Values are correctly stored and retrieved

---

## Migration Notes

### Existing Users
- No migration needed
- `requestHeaders` defaults to empty array `[]`
- Feature is opt-in, no impact on existing workflows

### Export/Import Compatibility
- Older exports (without `requestHeaders`) import cleanly
- Newer exports (with `requestHeaders`) are backward-compatible

---

## Future Enhancements

1. **Variable Substitution**: Support `{{ENV_VAR}}` in header values
2. **Header Presets**: Save/load common header sets
3. **Conditional Rules**: Apply headers based on method, status, etc.
4. **Header Profiles**: "Mobile User", "Admin User", etc.
5. **CLI Support**: `echokit-server --request-headers`

---

## Troubleshooting

### Headers not applying?
- [ ] Is the rule enabled (checkbox is checked)?
- [ ] Does the URL pattern match (or is it blank)?
- [ ] Did you refresh the page after adding the rule?
- [ ] Are you in mocking mode? (Headers apply to real requests, not mocks)

### Header has wrong value?
- Check mode is `override` (not `add`)
- No conflicting rules later in the list
- No typos/spaces in value field

---

## Documentation

See additional documentation in `/memory/`:
- `FEATURE_GLOBAL_REQUEST_HEADERS.md` - Full technical spec
- `IMPLEMENTATION_GUIDE_REQUEST_HEADERS.md` - Code implementation guide
- `DEVELOPER_CONFIG_EXAMPLES.md` - Real-world examples
- `PRODUCT_STRATEGY_ROLLOUT.md` - Product strategy
- `QUICK_REFERENCE.md` - User quick start guide

---

**Version**: 1.7.0  
**Released**: [Date TBD]  
**Status**: ✅ Ready for PR
