# Global Request Headers - Executive Summary

## 📋 Feature Overview

**What**: A new settings panel that allows developers to inject, override, or remove HTTP headers on ALL outgoing requests without modifying code.

**Why**: Developers frequently need to test with different auth tokens, tenant IDs, feature flags, or API keys. Currently, they must either:
- Edit code and redeploy
- Manually configure each API individually
- Use external proxy tools

**How**: A simple UI in Settings where users can add header rules that are automatically applied to all fetch/XHR requests in the browser.

---

## 🎯 Key Benefits for Developers

### 1. **Zero Code Changes**
```text
Before: Change environment variable → Rebuild → Redeploy → Test
After:  Add header in EchoKit UI → Refresh page → Test
```
**Time Saved**: 5-30 minutes per test iteration

### 2. **Instant Switching**
```text
Toggle between different auth tokens/tenants with ONE CLICK
Perfect for multi-tenant testing, role-based access testing, etc.
```

### 3. **Team Collaboration**
```text
Export header configuration → Share JSON with team → Import → Everyone has same setup
No more "it works on my machine" issues related to headers
```

### 4. **URL-Scoped Control**
```text
Apply headers only to specific APIs:
- /api/v1/* → Add X-API-Version: 1.0
- /admin/* → Add Authorization: Bearer admin-token
- /graphql → Add X-GraphQL-Context: {...}
```

---

## 🏗️ Architecture

```text
User adds header in Settings UI
         ↓
Background service worker stores in chrome.storage
         ↓
Injected script receives updated state
         ↓
fetch/XHR hooks apply headers before network request
         ↓
Headers are included in recorded interactions
```

**Key Components**:
1. **Settings UI** (`extension/shared/app.js`) - User configuration
2. **Background Worker** (`extension/background.js`) - State management
3. **Injected Script** (`extension/injected.js`) - Header application
4. **Storage** (`chrome.storage.local`) - Persistence

---

## 💡 Use Cases

### Use Case 1: Multi-Tenant Testing
**Scenario**: SaaS app with tenant isolation  
**Problem**: Need to test tenant A, B, C without switching accounts  
**Solution**:
```json
{ "key": "X-Tenant-ID", "value": "tenant-a", "mode": "override", "enabled": true }
{ "key": "X-Tenant-ID", "value": "tenant-b", "mode": "override", "enabled": false }
{ "key": "X-Tenant-ID", "value": "tenant-c", "mode": "override", "enabled": false }
```
Toggle between tenants instantly.

### Use Case 2: Bearer Token Testing
**Scenario**: Test with different user roles/permissions  
**Problem**: Login/logout cycles are slow and break flow  
**Solution**:
```json
{ "key": "Authorization", "value": "Bearer user-token", "mode": "override" }
```
Swap tokens without re-authenticating.

### Use Case 3: Feature Flag Injection
**Scenario**: Test unreleased features  
**Problem**: Feature flags controlled by backend, need code deploy to test  
**Solution**:
```json
{ "key": "X-Feature-Flags", "value": "new-checkout,beta-ui", "mode": "add" }
```
Enable flags client-side for testing.

### Use Case 4: Remove Tracking Headers
**Scenario**: Clean testing without analytics noise  
**Problem**: Tracking headers pollute logs and metrics during dev  
**Solution**:
```json
{ "key": "X-Client-ID", "mode": "remove" }
{ "key": "X-Session-ID", "mode": "remove" }
```
Strip headers before requests are sent.

---

## 🎨 UI Design

### Settings Panel Layout
```text
┌─────────────────────────────────────────────────────────────────┐
│  Global Request Headers                                         │
│  Inject, override, or remove headers on all outgoing requests   │
│                                                                  │
│  ┌───────────────┬──────────────┬──────────┬────────┬───┬───┐ │
│  │ Header Name   │ Value        │ Mode     │ URL    │ ✓ │ × │ │
│  ├───────────────┼──────────────┼──────────┼────────┼───┼───┤ │
│  │ Authorization │ Bearer abc.. │ override │ /api   │ ✓ │ × │ │
│  │ X-Tenant-ID   │ tenant-42    │ add      │        │ ✓ │ × │ │
│  │ X-Debug       │              │ remove   │        │   │ × │ │
│  └───────────────┴──────────────┴──────────┴────────┴───┴───┘ │
│                                                                  │
│  [+ Add Request Header]                                         │
└─────────────────────────────────────────────────────────────────┘
```

**Columns**:
- **Header Name**: Text input (e.g., `Authorization`)
- **Value**: Text input (disabled for `remove` mode)
- **Mode**: Dropdown (`add`, `override`, `remove`)
- **URL**: Optional substring filter (blank = all URLs)
- **✓**: Enable/disable toggle
- **×**: Delete rule

---

## 🔧 Header Modes

### Mode 1: `add`
**Behavior**: Add header if it doesn't exist (skip if already present)  
**Use Case**: Default headers that app might already send

```javascript
Original: { "Content-Type": "application/json" }
Rule: { "key": "X-Custom", "value": "test", "mode": "add" }
Result: { "Content-Type": "application/json", "X-Custom": "test" }
```

### Mode 2: `override`
**Behavior**: Set header value (replace if exists, add if doesn't)  
**Use Case**: Force specific header value

```javascript
Original: { "Authorization": "Bearer old-token" }
Rule: { "key": "Authorization", "value": "Bearer new-token", "mode": "override" }
Result: { "Authorization": "Bearer new-token" }
```

### Mode 3: `remove`
**Behavior**: Delete header from request  
**Use Case**: Strip tracking/analytics headers

```javascript
Original: { "Authorization": "Bearer token", "X-Track": "123" }
Rule: { "key": "X-Track", "mode": "remove" }
Result: { "Authorization": "Bearer token" }
```

---

## 📊 Comparison: Global vs Per-API Headers

| Aspect | Global Request Headers | Per-API Override Headers |
|--------|------------------------|--------------------------|
| **Scope** | All matching requests | Single API interaction |
| **Setup** | One-time in Settings | Manual per API |
| **URL Filtering** | ✅ Yes | ❌ No |
| **Persistence** | Survives refresh | Tied to recording |
| **Best For** | Auth, tenant IDs, flags | Mock-specific responses |

**Can both be used?** Yes! Global headers apply first, then per-API overrides.

---

## 🚀 Implementation Plan

### Phase 1: Core Feature (Week 1-2)
- [ ] Data structure (`requestHeaders` in settings)
- [ ] `applyRequestHeaders()` function
- [ ] Apply in fetch/XHR hooks
- [ ] Settings UI panel
- [ ] Event handlers
- [ ] Storage/sync
- [ ] Basic tests

### Phase 2: Polish (Week 3)
- [ ] Header presets/templates
- [ ] Validation & error handling
- [ ] Export/import support
- [ ] Documentation
- [ ] Tutorial video

### Phase 3: Advanced (Future)
- [ ] Variable substitution (`{{ENV_VAR}}`)
- [ ] Header profiles (save/load sets)
- [ ] CLI support
- [ ] Header diff view

---

## 📈 Success Metrics

- **Adoption**: 15% of users create at least one rule within 2 weeks
- **Engagement**: Average 2.5 rules per user
- **Retention**: 70% of users reuse the feature within 7 days
- **NPS Impact**: +5 points among feature users

---

## 🎓 Documentation Artifacts

1. ✅ **Feature Spec** (`FEATURE_GLOBAL_REQUEST_HEADERS.md`) - Full technical design
2. ✅ **Implementation Guide** (`IMPLEMENTATION_GUIDE_REQUEST_HEADERS.md`) - Step-by-step code changes
3. ✅ **Config Examples** (`DEVELOPER_CONFIG_EXAMPLES.md`) - 10+ real-world templates
4. ✅ **Rollout Plan** (`PRODUCT_STRATEGY_ROLLOUT.md`) - GTM strategy and timeline
5. ✅ **Architecture Diagrams** - Flow charts and comparisons
6. ✅ **This Summary** - Executive overview

---

## 🔗 Related Features

- **URL Rewrite Rules**: Modify request URLs before network
- **Response Transform Rules**: Modify mock response headers/body
- **Per-API Override Headers**: Custom headers for specific mocks
- **CORS Override**: Bypass CORS during development

**Vision**: Complete Request/Response manipulation suite for developers.

---

## ✅ Next Steps

1. **Review** this plan with engineering team
2. **Prioritize** in next sprint planning
3. **Assign** development tasks
4. **Kickoff** with design review meeting
5. **Target Launch**: 2-3 weeks from start

---

**Questions? See the detailed docs in `/memory/FEATURE_*.md`**
