# Developer Configuration Examples: Global Request Headers

## 🎯 Quick Start Templates

### Template 1: Bearer Token Authentication
```json
{
  "requestHeaders": [
    {
      "key": "Authorization",
      "value": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "mode": "override",
      "urlPattern": "/api",
      "enabled": true
    }
  ]
}
```

**Use Case**: Test your app with different user tokens without logging in/out

**How to Use**:
1. Open EchoKit settings → Global Request Headers
2. Add new header with name `Authorization`
3. Paste your JWT token in the value field
4. Set mode to `override` (replaces existing auth headers)
5. Set URL pattern to `/api` (only affects API calls)
6. Toggle on/off to switch between authenticated/unauthenticated states

---

### Template 2: Multi-Tenant Testing
```json
{
  "requestHeaders": [
    {
      "key": "X-Tenant-ID",
      "value": "tenant-acme-corp",
      "mode": "override",
      "urlPattern": "",
      "enabled": true
    },
    {
      "key": "X-Tenant-ID",
      "value": "tenant-widgets-inc",
      "mode": "override",
      "urlPattern": "",
      "enabled": false
    }
  ]
}
```

**Use Case**: Quickly switch between tenant contexts

**How to Use**:
1. Create multiple rules for the same header with different values
2. Enable one tenant, disable others
3. Toggle between them to test multi-tenant scenarios
4. No need to change environment variables or configs

---

### Template 3: Feature Flag Injection
```json
{
  "requestHeaders": [
    {
      "key": "X-Feature-Flags",
      "value": "new-checkout,beta-dashboard,experimental-search",
      "mode": "add",
      "urlPattern": "",
      "enabled": true
    },
    {
      "key": "X-Enable-Beta",
      "value": "true",
      "mode": "add",
      "urlPattern": "",
      "enabled": true
    }
  ]
}
```

**Use Case**: Test unreleased features without backend changes

**Why `mode: 'add'`**: Only adds the header if the app doesn't already send it

---

### Template 4: API Key Override
```json
{
  "requestHeaders": [
    {
      "key": "X-API-Key",
      "value": "dev-api-key-12345",
      "mode": "override",
      "urlPattern": "api.example.com",
      "enabled": true
    }
  ]
}
```

**Use Case**: Test against different API keys (dev/staging/prod)

**URL Filtering**: Only applies to requests containing `api.example.com`

---

### Template 5: Remove Tracking Headers
```json
{
  "requestHeaders": [
    {
      "key": "X-Client-ID",
      "mode": "remove",
      "enabled": true
    },
    {
      "key": "X-Session-ID",
      "mode": "remove",
      "enabled": true
    },
    {
      "key": "X-Analytics-Token",
      "mode": "remove",
      "enabled": true
    }
  ]
}
```

**Use Case**: Clean testing without tracking/analytics noise

**Note**: `mode: 'remove'` doesn't require a `value` field

---

### Template 6: Mobile User-Agent Simulation
```json
{
  "requestHeaders": [
    {
      "key": "User-Agent",
      "value": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15",
      "mode": "override",
      "urlPattern": "",
      "enabled": true
    },
    {
      "key": "X-Device-Type",
      "value": "mobile",
      "mode": "add",
      "urlPattern": "",
      "enabled": true
    }
  ]
}
```

**Use Case**: Test mobile-specific API behavior

---

### Template 7: CORS Testing
```json
{
  "requestHeaders": [
    {
      "key": "Origin",
      "value": "https://different-domain.com",
      "mode": "override",
      "urlPattern": "",
      "enabled": true
    }
  ]
}
```

**Use Case**: Test CORS policies from different origins

**Note**: Combine with EchoKit's built-in CORS override for full control

---

### Template 8: GraphQL Context Headers
```json
{
  "requestHeaders": [
    {
      "key": "X-GraphQL-Context",
      "value": "{\"userId\":\"123\",\"role\":\"admin\"}",
      "mode": "add",
      "urlPattern": "/graphql",
      "enabled": true
    }
  ]
}
```

**Use Case**: Inject context for GraphQL requests

**JSON Values**: Encode JSON as a string in the value field

---

### Template 9: Rate Limit Bypass (Dev/Test)
```json
{
  "requestHeaders": [
    {
      "key": "X-Rate-Limit-Bypass",
      "value": "dev-secret-token",
      "mode": "add",
      "urlPattern": "/api",
      "enabled": true
    }
  ]
}
```

**Use Case**: Bypass rate limits during development/testing

**Security**: Only use with test tokens, never production secrets

---

### Template 10: Version Header Override
```json
{
  "requestHeaders": [
    {
      "key": "X-API-Version",
      "value": "v2-beta",
      "mode": "override",
      "urlPattern": "",
      "enabled": true
    }
  ]
}
```

**Use Case**: Test against different API versions

---

## 🔧 Advanced Patterns

### Pattern 1: Layered Headers (Multiple Rules)
```json
{
  "requestHeaders": [
    {
      "key": "Authorization",
      "value": "Bearer base-token",
      "mode": "add",
      "urlPattern": "",
      "enabled": true
    },
    {
      "key": "Authorization",
      "value": "Bearer admin-token",
      "mode": "override",
      "urlPattern": "/admin",
      "enabled": true
    }
  ]
}
```

**How It Works**:
1. First rule adds base auth to all requests
2. Second rule overrides auth for `/admin` routes
3. Rules are applied in order, last matching rule wins

---

### Pattern 2: Environment-Specific Headers
```json
{
  "requestHeaders": [
    {
      "key": "X-Environment",
      "value": "development",
      "mode": "override",
      "urlPattern": "",
      "enabled": true
    },
    {
      "key": "X-Debug-Mode",
      "value": "true",
      "mode": "add",
      "urlPattern": "",
      "enabled": true
    }
  ]
}
```

**Use Case**: Identify requests from your dev environment

---

## 💡 Pro Tips

### Tip 1: Export & Share Configurations
1. Configure your request headers in EchoKit
2. Click menu → Export JSON
3. Share the JSON file with your team
4. Team members can import it to get the same header setup instantly

### Tip 2: Use Descriptive URL Patterns
Instead of leaving URL pattern blank, use specific patterns:
- `/api/v1` for v1 endpoints only
- `auth` for authentication-related requests
- `.com/graphql` for GraphQL endpoints

This prevents accidental header injection into unrelated requests.

### Tip 3: Toggle Instead of Delete
- Use the enable/disable toggle to switch headers on/off
- Keep disabled rules for quick re-activation later
- Useful for A/B testing different configurations

### Tip 4: Layer Headers for Complex Scenarios
```json
{
  "requestHeaders": [
    // Base headers for all requests
    { "key": "X-Client-Version", "value": "1.0.0", "mode": "add", "enabled": true },

    // Specific overrides for admin routes
    { "key": "X-Role", "value": "admin", "mode": "add", "urlPattern": "/admin", "enabled": true },

    // Specific overrides for API v2
    { "key": "X-API-Version", "value": "2.0", "mode": "add", "urlPattern": "/api/v2", "enabled": true }
  ]
}
```

### Tip 5: Combine with Mock Responses
1. Set global request headers
2. Record interactions with those headers
3. Mock responses will automatically include the modified headers
4. Perfect for testing backend logic that depends on specific headers

---

## 🧪 Testing Scenarios

### Scenario 1: Test Auth Expiration
```json
{
  "requestHeaders": [
    {
      "key": "Authorization",
      "value": "Bearer expired-token-abc123",
      "mode": "override",
      "enabled": true
    }
  ]
}
```
**Expected**: Backend returns 401 Unauthorized
**Verify**: Your app handles token refresh correctly

---

### Scenario 2: Test Missing Auth
```json
{
  "requestHeaders": [
    {
      "key": "Authorization",
      "mode": "remove",
      "enabled": true
    }
  ]
}
```
**Expected**: Backend returns 401 or redirects to login
**Verify**: Your app gracefully handles unauthenticated state

---

### Scenario 3: Test Different User Roles
```json
{
  "requestHeaders": [
    { "key": "X-User-Role", "value": "viewer", "mode": "override", "enabled": true },
    { "key": "X-User-Role", "value": "editor", "mode": "override", "enabled": false },
    { "key": "X-User-Role", "value": "admin", "mode": "override", "enabled": false }
  ]
}
```
**How to Test**:
1. Enable "viewer" → verify limited permissions
2. Disable "viewer", enable "editor" → verify edit capabilities
3. Disable "editor", enable "admin" → verify full access

---

### Scenario 4: Test Rate Limiting
```json
{
  "requestHeaders": [
    {
      "key": "X-Rate-Limit-Remaining",
      "value": "0",
      "mode": "override",
      "enabled": true
    }
  ]
}
```
**Expected**: Backend returns 429 Too Many Requests
**Verify**: Your app shows appropriate error message

---

## 📊 Comparison: Global vs Per-API Headers

| Feature | Global Request Headers | Per-API Override Headers |
|---------|------------------------|--------------------------|
| **Scope** | All matching requests | Single API interaction |
| **Use Case** | Auth tokens, tenant IDs | Custom mock responses |
| **Setup Time** | One-time configuration | Per-API manual edit |
| **Persistence** | Survives page refresh | Tied to specific recording |
| **URL Filtering** | ✅ Yes (urlPattern) | ❌ No |
| **Export/Import** | ✅ Yes (in settings) | ✅ Yes (per interaction) |
| **Best For** | Testing, dev workflows | Mocking, edge cases |

**When to Use Which**:
- **Global**: When you need the same header(s) across many/all APIs
- **Per-API**: When you need different response headers for specific mocks

**Can You Use Both?**: Yes! Global headers apply first, then per-API overrides.

---

## 🚨 Common Pitfalls & Solutions

### Pitfall 1: Headers Not Applying
**Symptom**: Added header but don't see it in requests

**Checklist**:
- ✅ Is the rule enabled?
- ✅ Does the URL pattern match? (blank = all URLs)
- ✅ Did you refresh the page after adding the rule?
- ✅ Are you in mocking mode? (Global headers apply to real requests, not mocks by default)

---

### Pitfall 2: Headers Applied to Wrong Requests
**Symptom**: Header showing up in unexpected requests

**Solution**: Add a URL pattern filter
```json
{
  "key": "X-Custom",
  "value": "test",
  "urlPattern": "/api/users",  // Only match /api/users
  "enabled": true
}
```

---

### Pitfall 3: Case Sensitivity Issues
**Symptom**: Header works in DevTools but not in code

**Solution**: HTTP headers are case-insensitive
- `Authorization` = `authorization` = `AUTHORIZATION`
- Use standard casing for consistency: `Authorization`, `Content-Type`, etc.

---

### Pitfall 4: Special Characters in Values
**Symptom**: Header value gets corrupted

**Solution**: URL-encode special characters or use base64 for complex values
```json
{
  "key": "X-Data",
  "value": "eyJuYW1lIjoiSm9obiIsImFnZSI6MzB9",  // Base64: {"name":"John","age":30}
  "enabled": true
}
```

---

## 🎓 Real-World Examples

### Example 1: E-Commerce Multi-Region Testing
```json
{
  "requestHeaders": [
    { "key": "X-Region", "value": "US-WEST", "mode": "override", "enabled": true },
    { "key": "X-Currency", "value": "USD", "mode": "add", "enabled": true },
    { "key": "Accept-Language", "value": "en-US", "mode": "override", "enabled": true }
  ]
}
```

### Example 2: SaaS Account Impersonation (Support Tool)
```json
{
  "requestHeaders": [
    { "key": "X-Impersonate-User", "value": "customer-12345", "mode": "add", "enabled": true },
    { "key": "X-Support-Session", "value": "support-token-xyz", "mode": "add", "enabled": true }
  ]
}
```

### Example 3: Mobile App API Testing
```json
{
  "requestHeaders": [
    { "key": "X-App-Version", "value": "2.5.0", "mode": "override", "enabled": true },
    { "key": "X-Platform", "value": "iOS", "mode": "add", "enabled": true },
    { "key": "X-Device-ID", "value": "simulator-test-001", "mode": "add", "enabled": true }
  ]
}
```

---

## 📚 Related Features

- **URL Rewrite Rules**: Modify request URLs before they hit the network
- **Response Transform Rules**: Modify mock response headers/body
- **Per-API Override Headers**: Custom headers for specific mocked APIs
- **CORS Override**: Bypass CORS restrictions during development

**Combine Them**: Use global request headers + response transforms for powerful testing scenarios!
