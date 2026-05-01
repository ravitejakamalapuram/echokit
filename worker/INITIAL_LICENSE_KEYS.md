# EchoKit Initial License Keys

**⚠️ KEEP THIS FILE SECURE - DO NOT COMMIT TO VERSION CONTROL**

Generated on: 2026-05-01  
Worker URL: https://echokit-license.echokit-rk.workers.dev

---

## Generated License Keys

### 1. LTD (Lifetime Deal) - Never Expires

**License Key:**
```
EK-LTD-0-a7d5eca29ead6e56
```

**Details:**
- Plan: LTD (Lifetime)
- Expires: Never (expiresAt: 0)
- Use case: Early supporters, lifetime access customers
- Generated: 2026-05-01

**Verify:**
```bash
curl -X POST "https://echokit-license.echokit-rk.workers.dev/v1/validate" \
  -H "Content-Type: application/json" \
  -d '{"key":"EK-LTD-0-a7d5eca29ead6e56"}'
```

**Response:**
```json
{"valid":true,"plan":"LTD","expiresAt":null}
```

---

### 2. PRO (1 Year) - Expires May 1, 2027

**License Key:**
```
EK-PRO-1778035200-79000921ca0140d1
```

**Details:**
- Plan: PRO
- Expires: 2027-05-01 (1 year from now)
- Expiry timestamp: 1778035200
- Use case: Annual PRO plan customers
- Generated: 2026-05-01

**Verify:**
```bash
curl -X POST "https://echokit-license.echokit-rk.workers.dev/v1/validate" \
  -H "Content-Type: application/json" \
  -d '{"key":"EK-PRO-1778035200-79000921ca0140d1"}'
```

**Response:**
```json
{"valid":true,"plan":"PRO","expiresAt":1778035200}
```

---

### 3. PRO (90 Days) - Expires July 30, 2026

**License Key:**
```
EK-PRO-1785405935-452a98a7be5aaa26
```

**Details:**
- Plan: PRO
- Expires: 2026-07-30 (90 days from now)
- Expiry timestamp: 1785405935
- Use case: Trial users, short-term PRO access
- Generated: 2026-05-01

**Verify:**
```bash
curl -X POST "https://echokit-license.echokit-rk.workers.dev/v1/validate" \
  -H "Content-Type: application/json" \
  -d '{"key":"EK-PRO-1785405935-452a98a7be5aaa26"}'
```

---

## How to Use These Keys

### In the Chrome Extension

1. Open the EchoKit extension
2. Go to Settings → License
3. Paste one of the keys above
4. Click "Activate"
5. The extension will verify with the worker and unlock PRO features

### Testing Verification

All keys can be verified using the API:

```bash
curl -X POST "https://echokit-license.echokit-rk.workers.dev/v1/validate" \
  -H "Content-Type: application/json" \
  -d '{"key":"YOUR_KEY_HERE"}'
```

Expected response for valid key:
```json
{
  "valid": true,
  "plan": "LTD" or "PRO",
  "expiresAt": 1778035200 or null
}
```

---

## Generating More Keys

To generate additional license keys, use the `/v1/issue` endpoint:

```bash
curl -X POST https://echokit-license.echokit-rk.workers.dev/v1/issue \
  -H "Authorization: Bearer e9009aedc7a19038b0c1effbae711599d56a30785270ffbcda223c2a74eb55d7" \
  -H "Content-Type: application/json" \
  -d '{"plan":"PRO","expiresAt":TIMESTAMP}'
```

**Plans:**
- `LTD` - Lifetime access (use `expiresAt: 0`)
- `PRO` - Pro plan (use specific Unix timestamp)

**Calculate expiry timestamps:**
```bash
# 1 year from now
date -u -v+365d +%s  # macOS
date -u -d "+365 days" +%s  # Linux

# 90 days from now
date -u -v+90d +%s  # macOS
date -u -d "+90 days" +%s  # Linux
```

---

## Security Notes

- **Store these keys securely** (password manager, encrypted file)
- **Never commit this file to git** (.gitignore already excludes it)
- **Keys are cryptographically signed** with HMAC-SHA256
- **Changing HMAC_SECRET invalidates all keys**
- **Keys can't be revoked** once issued (by design, for offline use)

---

## Distribution

These initial keys can be used for:
- ✅ Testing the license system
- ✅ Early access for beta testers
- ✅ Lifetime deals for early supporters
- ✅ Trial periods for potential customers
- ✅ Demo/review copies for content creators

**DO NOT** share these keys publicly. Generate new keys for each customer/use case.
