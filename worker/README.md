# EchoKit License Worker

Cloudflare Worker for license key validation, issuance, and automated delivery via LemonSqueezy payments.

**Features:**
- ✅ Self-signed HMAC-SHA256 keys (no database required)
- ✅ Automated LemonSqueezy payment integration
- ✅ Email delivery via Resend
- ✅ 3 pricing tiers: PRO ($5/month), YEAR ($49/year), LTD ($199 lifetime)
- ✅ Admin API for manual key issuance

## Quick Start

```bash
cd worker
npm install
wrangler deploy
```

Configure secrets:
```bash
wrangler secret put ECHOKIT_HMAC_SECRET        # License signing (openssl rand -hex 32)
wrangler secret put ECHOKIT_ADMIN_TOKEN        # Admin API auth
wrangler secret put LEMONSQUEEZY_WEBHOOK_SECRET # LemonSqueezy webhook verification
wrangler secret put RESEND_API_KEY             # Email delivery
```

**📖 Full Setup Guide**: See `LEMONSQUEEZY_SETUP.md`

Your worker URL: `https://echokit-license.<your-account>.workers.dev`

## Endpoints

### `POST /v1/validate`

```json
{ "key": "EK-PRO-1769904000-7c8a44eb37c12d61", "deviceId": "optional" }
```

Response:

```json
{ "valid": true, "plan": "PRO", "expiresAt": 1769904000 }
```

or

```json
{ "valid": false, "error": "expired" }
```

### `POST /v1/issue`  *(admin)*

```bash
curl -X POST https://echokit-license.example.workers.dev/v1/issue \
  -H "Authorization: Bearer $ECHOKIT_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"plan":"PRO","expiresAt":1769904000}'
```

Returns `{ "key": "EK-PRO-1769904000-…", … }`.

For a Lifetime (LTD) key, set `expiresAt: 0`.

### `GET /__health`

Returns `{ ok: true }` — useful for monitoring.

## Key format

```
EK-{PLAN}-{EXPIRY}-{SIG}
  PLAN   = PRO | YEAR | LTD
  EXPIRY = unix-seconds (0 = never expires, used for LTD)
  SIG    = first 16 hex chars of HMAC-SHA256(secret, `${PLAN}|${EXPIRY}`)
```

## Rotating the secret

`wrangler secret put ECHOKIT_HMAC_SECRET` and redeploy. **All previously issued
keys become invalid** — this is the revocation mechanism.

---

## Extension Integration

### Free Trial
- **7-day Pro trial** automatically granted on extension install
- All Pro features unlocked during trial
- Trial tracked in `chrome.storage.sync.echokit_trial_expiry`

### License Validation Flow
1. User enters license key in extension settings
2. Extension validates format: `EK-{PLAN}-{EXPIRY}-{SIG}`
3. Extension calls `/v1/validate` for cryptographic verification
4. Result cached for 24 hours
5. Pro features unlock

### PRO Features (Gated)
- **API Blocking**: Block specific API requests
- **HAR/Postman Export**: Export recordings
- **GitHub Gist Sync**: Backup/share recordings
- **Advanced Matching**: More powerful mocking rules

**Free features** (always available):
- Basic API recording and replay
- Request/response inspection
- Simple URL-based mocking
- DevTools integration

---

## Payment Integration

See `LEMONSQUEEZY_SETUP.md` for complete LemonSqueezy integration guide.
