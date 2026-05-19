# Global Request Headers - Quick Reference

## 🚀 5-Minute Quick Start

### Step 1: Open Settings
1. Click EchoKit extension icon
2. Click ⚙️ Settings icon (top-right)
3. Scroll to **"Global Request Headers"** section

### Step 2: Add Your First Header
1. Click **[+ Add Request Header]**
2. Fill in:
   - **Header Name**: `Authorization`
   - **Value**: `Bearer your-token-here`
   - **Mode**: `override`
   - **URL**: Leave blank (applies to all requests)
   - **Toggle**: ✓ Enabled
3. Click outside to save

### Step 3: Test It
1. Refresh your web app
2. Open DevTools → Network tab
3. Make an API request
4. Check Request Headers → You'll see your `Authorization` header!

**That's it!** The header is now injected into all requests automatically.

---

## 📖 Header Modes Cheat Sheet

| Mode | When to Use | Example |
|------|-------------|---------|
| **add** | Add header only if app doesn't send it | Default API key |
| **override** | Replace existing header or add if missing | Force specific auth token |
| **remove** | Delete header from request | Strip tracking headers |

### Visual Guide

```
Original Request: { "Authorization": "Bearer old", "Content-Type": "json" }

Mode: add       → { "Authorization": "Bearer old", "Content-Type": "json", "X-New": "value" }
Mode: override  → { "Authorization": "Bearer NEW", "Content-Type": "json" }
Mode: remove    → { "Content-Type": "json" }
```

---

## 🎯 Common Patterns

### Pattern 1: Switch Auth Tokens
```
Header: Authorization
Value:  Bearer user-123-token
Mode:   override
URL:    /api
```
**Result**: All `/api` requests use this token

### Pattern 2: Multi-Tenant Testing
```
# Tenant A (enabled)
Header: X-Tenant-ID
Value:  tenant-a
Mode:   override

# Tenant B (disabled)
Header: X-Tenant-ID
Value:  tenant-b
Mode:   override
```
**Result**: Toggle between tenants by enabling/disabling

### Pattern 3: Feature Flags
```
Header: X-Feature-Flags
Value:  new-checkout,beta-ui
Mode:   add
```
**Result**: Backend sees these flags, enables features

### Pattern 4: Clean Testing
```
Header: X-Client-ID
Mode:   remove

Header: X-Session-ID
Mode:   remove
```
**Result**: Tracking headers stripped from all requests

---

## 🔧 Troubleshooting

### Issue: Headers not applying

**Checklist**:
- [ ] Rule is enabled (toggle is ✓)
- [ ] URL pattern matches (or is blank)
- [ ] Page refreshed after adding rule
- [ ] Not in mocking mode (headers apply to real requests)

### Issue: Header has wrong value

**Check**:
- Mode is `override` (not `add`)
- No conflicting rules later in the list
- Value field doesn't have typos/spaces

### Issue: Can't see header in DevTools

**Remember**:
- Some headers are browser-managed (e.g., `Host`, `Connection`)
- CORS may strip custom headers (use EchoKit's CORS override)
- Check "Request Headers" section, not "Provisional Headers"

---

## 💡 Pro Tips

### Tip 1: URL Patterns
```
Blank      → Applies to ALL requests
/api       → Only requests containing "/api"
.com/v2    → Only requests to ".com/v2" endpoints
```

### Tip 2: Multiple Rules for Same Header
```
Rule 1: Authorization = "Bearer default" | URL: (blank)
Rule 2: Authorization = "Bearer admin"   | URL: /admin
```
**Result**: Admin token for `/admin`, default token elsewhere

### Tip 3: Export & Share
1. Configure headers
2. Menu → Export JSON
3. Share file with team
4. They import → Same config instantly!

### Tip 4: Toggle Instead of Delete
- Disable rules you might need later
- Keep common patterns ready to enable
- Faster than recreating from scratch

---

## 📊 Feature Comparison

| Need | Use This Feature | Alternative |
|------|------------------|-------------|
| Same header on all APIs | ✅ Global Request Headers | Per-API headers (tedious) |
| Different header per API | Per-API Override Headers | Global + URL patterns |
| Modify response headers | Response Transform Rules | N/A |
| Modify URLs | URL Rewrite Rules | N/A |

**Best Practice**: Combine features for powerful workflows!

---

## ⌨️ Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Open Settings | Click ⚙️ icon |
| Add New Rule | Tab to button, Enter |
| Toggle Enabled | Click checkbox |
| Delete Rule | Click × |

---

## 🎓 Real-World Examples

### Example 1: E-Commerce Testing
```json
[
  { "key": "X-Currency", "value": "USD", "mode": "override" },
  { "key": "X-Region", "value": "US-WEST", "mode": "override" },
  { "key": "X-Promo-Code", "value": "SAVE20", "mode": "add" }
]
```

### Example 2: Mobile App API
```json
[
  { "key": "X-App-Version", "value": "2.5.0", "mode": "override" },
  { "key": "X-Platform", "value": "iOS", "mode": "add" },
  { "key": "User-Agent", "value": "MyApp/2.5.0 (iPhone)", "mode": "override" }
]
```

### Example 3: Admin Impersonation
```json
[
  { "key": "X-Impersonate-User", "value": "customer-12345", "mode": "add", "url": "/api" },
  { "key": "X-Admin-Session", "value": "admin-token", "mode": "add", "url": "/api" }
]
```

---

## 🚨 Security Best Practices

1. **Don't Commit Secrets**: Never check in exported JSON with tokens
2. **Use Test Tokens**: Only use dev/staging tokens, not production
3. **Rotate Regularly**: Change tokens after sharing or exporting
4. **HTTPS Only**: Be cautious adding auth headers on HTTP sites
5. **Clear After Testing**: Disable or delete rules when done

---

## 📚 Related Documentation

- **Full Feature Spec**: `docs/archive/FEATURE_GLOBAL_REQUEST_HEADERS.md`
- **Implementation Guide**: `docs/archive/IMPLEMENTATION_GUIDE_REQUEST_HEADERS.md`
- **Config Examples**: `specs/DEVELOPER_CONFIG_EXAMPLES.md`
- **Rollout Plan**: `specs/PRODUCT_STRATEGY_ROLLOUT.md`

---

## 🆘 Need Help?

**Can't find what you need?**
- Check the full documentation (links above)
- Open an issue on GitHub
- Ask in the EchoKit community

**Found a bug?**
- Report it with: What you did, what happened, what you expected
- Include your header configuration (redact sensitive values!)

---

## ✅ Quick Checklist

Before asking for help, verify:
- [ ] EchoKit extension is enabled
- [ ] Page was refreshed after adding headers
- [ ] Rule is toggled ON (checkbox is checked)
- [ ] URL pattern matches the request (or is blank)
- [ ] No browser console errors
- [ ] Using latest version of EchoKit

---

**Happy Testing! 🚀**
