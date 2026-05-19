# Add Global Request Headers Feature

## 🎯 Summary

This PR introduces **Global Request Headers**, a powerful new feature that allows developers to inject, override, or remove HTTP headers on all outgoing requests without modifying code. This addresses a common pain point where developers need to test with different auth tokens, tenant IDs, feature flags, or API keys.

## ✨ What's New

### Settings Panel: Global Request Headers
- **Three Modes**:
  - `add` - Add header only if it doesn't already exist
  - `override` - Set header value (replace or add) - *DEFAULT*
  - `remove` - Delete the header from the request
  
- **URL Pattern Filtering**: Apply headers only to specific URLs (blank = all)
- **Enable/Disable Toggle**: Quickly turn rules on/off without deleting
- **Scope Aware**: Respects existing Tab/Domain scope setting

### UI Screenshot
```
┌─────────────────────────────────────────────────────────────┐
│  Global Request Headers                                     │
│  Inject, override, or remove headers on all outgoing...     │
│                                                              │
│  [Header Name] [Value] [Mode ▼] [URL] [✓] [×]             │
│  Authorization  Bearer... override  /api  ✓  ×              │
│  X-Tenant-ID    tenant-42 add       -     ✓  ×              │
│                                                              │
│  [+ Add request header]                                     │
└─────────────────────────────────────────────────────────────┘
```

## 🔧 Implementation Details

### Architecture
```
Settings UI → Background Worker → Injected Script → fetch/XHR Hooks → Network
```

### Files Changed
- `extension/background.js` - Added `requestHeaders` to settings, push to tabs
- `extension/shared/app.js` - UI panel + event handlers
- `extension/injected.js` - Header application logic for fetch/XHR
- `tests/smoke_echokit.py` - Added test coverage
- `memory/PRD.md` - Updated documentation

### Key Functions
- `applyRequestHeaders(headers, url)` - Core logic in `injected.js`
- URL filtering with substring match
- Case-insensitive header handling for 'remove' mode
- Headers applied before network request, captured in recordings

## 📊 Use Cases

### 1. Auth Token Testing
```json
{
  "key": "Authorization",
  "value": "Bearer test-token-123",
  "mode": "override",
  "urlPattern": "/api"
}
```
**Benefit**: Switch between user tokens with one click

### 2. Multi-Tenant Testing
```json
{
  "key": "X-Tenant-ID",
  "value": "tenant-a",
  "mode": "override"
}
```
**Benefit**: Test different tenants without login/logout

### 3. Feature Flags
```json
{
  "key": "X-Feature-Flags",
  "value": "new-checkout,beta-ui",
  "mode": "add"
}
```
**Benefit**: Test unreleased features client-side

### 4. Clean Testing
```json
{
  "key": "X-Analytics-ID",
  "mode": "remove"
}
```
**Benefit**: Remove tracking headers for cleaner logs

## ✅ Testing

### Manual Testing
- ✅ Syntax validation (all JS files pass `node -c`)
- ✅ UI renders correctly in settings panel
- ✅ Headers applied to fetch requests
- ✅ Headers applied to XHR requests
- ✅ URL pattern filtering works
- ✅ Enable/disable toggle works
- ✅ Mode switching works (add/override/remove)
- ✅ Export/import includes requestHeaders

### Automated Testing
- ✅ Added smoke test for request headers persistence
- Test validates settings CRUD operations

## 📚 Documentation

Comprehensive documentation included in `/memory/`:
- `FEATURE_GLOBAL_REQUEST_HEADERS.md` - Full technical spec
- `IMPLEMENTATION_GUIDE_REQUEST_HEADERS.md` - Code guide
- `DEVELOPER_CONFIG_EXAMPLES.md` - 10+ real-world templates
- `PRODUCT_STRATEGY_ROLLOUT.md` - Product strategy
- `QUICK_REFERENCE.md` - User quick start guide
- `CHANGELOG_GLOBAL_REQUEST_HEADERS.md` - Feature changelog

## 🔄 Backward Compatibility

- ✅ **100% Backward Compatible**
- `requestHeaders` defaults to empty array `[]`
- No migration needed for existing users
- Older exports import cleanly
- Feature is opt-in, zero impact on existing workflows

## 🚀 What's Next

Future enhancements (not in this PR):
- Variable substitution (`{{ENV_VAR}}`)
- Header presets/templates
- Header profiles (save/load sets)
- CLI support (`echokit-server --request-headers`)

## 📝 Checklist

- [x] Code implemented and tested
- [x] UI matches design philosophy
- [x] All JS files pass syntax check
- [x] Tests added
- [x] Documentation written
- [x] PRD updated
- [x] Backward compatible
- [x] No breaking changes
- [x] Ready for review

## 🎓 How to Review

1. **UI Review**: Load extension unpacked, open Settings → Global Request Headers
2. **Functional Test**: 
   - Add a header like `Authorization: Bearer test`
   - Open DevTools Network tab
   - Make an API call
   - Verify header appears in request
3. **Code Review**: Check implementation in the 3 main files listed above

## 💬 Notes

- This feature complements existing URL Rewrite Rules and Response Transform Rules
- Together they form a complete "Request/Response Manipulation" suite
- Header application respects the existing Scope setting (Tab vs Domain)
- Headers are applied client-side before network, so they appear in recordings

---

**Related Issues**: N/A (new feature)  
**Breaking Changes**: None  
**Version**: 1.7.0 (suggested)
