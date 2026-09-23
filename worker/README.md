# EchoKit License Worker

Cloudflare Worker that validates EchoKit Pro licenses and serves the remote
paywall switch.

**Features:**
- Gumroad license keys verified with Gumroad's license API (EchoKit Pro is sold on Gumroad)
- Legacy self-signed HMAC-SHA256 `EK-*` keys still accepted (no database)
- 3 pricing tiers: PRO ($5/month), YEAR ($49/year), LTD ($199 lifetime)
- Admin API for manual `EK-*` key issuance
- `GET /v1/config` paywall switch with Gumroad checkout links

## Quick Start

```bash
cd worker
npm install
wrangler deploy
```

Configure secrets:
```bash
wrangler secret put ECHOKIT_HMAC_SECRET        # Legacy EK-* key signing (openssl rand -hex 32)
wrangler secret put ECHOKIT_ADMIN_TOKEN        # Admin API auth
```

Gumroad needs no secret: license verification only uses the public product
ids in `GUMROAD_PRODUCT_IDS` (`wrangler.toml` `[vars]`).

Your worker URL: `https://echokit-license.<your-account>.workers.dev`

## Endpoints

### `POST /v1/validate`

```json
{ "key": "6F0E4C97-B72A4E69-A11BF6C4-AF6517E7", "deviceId": "optional" }
```

`key` is either a Gumroad license key or a legacy `EK-*` key.

- **Gumroad key** (`XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX`): the worker calls
  `POST https://api.gumroad.com/v2/licenses/verify` (`increment_uses_count=false`)
  for each product in `GUMROAD_PRODUCT_IDS` until one accepts it. The key is
  valid unless the purchase was refunded, charged back, lost a dispute, or (for
  the membership) the subscription was cancelled, ended or failed to charge.
  Answers are cached per worker isolate (10 min valid, 2 min invalid). If
  Gumroad is unreachable the worker answers **503**, and the extension treats
  that as "couldn't check" rather than "rejected".
- **`EK-*` key**: HMAC signature and expiry check, as below.

Response:

```json
{ "valid": true, "plan": "PRO", "expiresAt": null, "source": "gumroad" }
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

### `GET /v1/config`

The remote paywall switch the extension reads (cached 6h client-side,
`Cache-Control: public, max-age=3600` at the edge). Driven by `[vars]` in
`wrangler.toml`:

| Var | Default | Meaning |
|-----|---------|---------|
| `PAYWALL_ENABLED` | `"false"` | Only the literal `"true"` enforces licenses |
| `GRANDFATHER_UNTIL` | `""` | ISO date; early adopters keep Pro until then (`""` → `null`) |
| `CHECKOUT_URL_MONTHLY` / `_ANNUAL` / `_LIFETIME` | Gumroad links | Checkout links (all empty → `null`) |
| `GUMROAD_PRODUCT_IDS` | both products | JSON `{"<product_id>": PLAN}` or `id:PLAN,id:PLAN`. PLAN = `MEMBERSHIP` (PRO/YEAR from the purchase recurrence), `PRO`, `YEAR` or `LTD` |

```json
{ "paywallEnabled": false, "grandfatherUntil": null, "checkoutUrls": null }
```

If the extension can't reach this endpoint and has no cached copy it assumes
`paywallEnabled: false`, so an outage never locks users out. Go-live steps:
[`docs/PAYWALL_SWITCH.md`](../docs/PAYWALL_SWITCH.md).

### `GET /__health`

Returns `{ ok: true }` — useful for monitoring.

## Legacy `EK-*` key format

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
2. Extension checks the format: a Gumroad key or `EK-{PLAN}-{EXPIRY}-{SIG}`
3. Extension calls `/v1/validate` (Gumroad API or HMAC check)
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

EchoKit Pro is sold on Gumroad (seller `raviteja852`):

| Product | Checkout | `product_id` | Plan |
|---------|----------|--------------|------|
| EchoKit Pro (membership, $5/month or $49/year) | https://raviteja852.gumroad.com/l/echokit-pro | `21jW8YdWBWjVy8EmcKEgMQ==` | `MEMBERSHIP` → PRO / YEAR |
| EchoKit Pro Lifetime ($199) | https://raviteja852.gumroad.com/l/echokit-lifetime | `nPgt8NsB8fkhPFtt61SR8w==` | `LTD` |

Both products have "License key" enabled on their Content tab, so Gumroad
emails the buyer a key. No webhook is needed: the worker checks keys live.

The earlier LemonSqueezy webhook was removed; its setup guide and scripts are in
`docs/archive/*LEMONSQUEEZY*` / `docs/archive/*lemonsqueezy*`.
