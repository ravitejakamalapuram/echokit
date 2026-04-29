# EchoKit License Worker

Cloudflare Worker that signs and validates EchoKit Pro license keys with
HMAC-SHA256. No database — every key is self-signed by `ECHOKIT_HMAC_SECRET`,
so the worker is stateless and free-tier friendly.

## Deploy

```bash
cd /app/worker
npm i -g wrangler
wrangler login

# 1. Generate a strong secret (paste into the prompt)
openssl rand -hex 32 | xargs -I{} bash -c 'echo {}; wrangler secret put ECHOKIT_HMAC_SECRET'

# 2. (optional) Set an admin token so you can mint new keys via /v1/issue
wrangler secret put ECHOKIT_ADMIN_TOKEN

wrangler deploy
```

You'll get a URL like `https://echokit-license.<your-account>.workers.dev`.
Configure that URL into the extension via `chrome.storage.sync` key
`echokit_license_endpoint` (the extension reads it on every license check).

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
