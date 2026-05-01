# EchoKit Worker Deployment Credentials

**⚠️ KEEP THIS FILE SECURE - DO NOT COMMIT TO VERSION CONTROL**

## Deployment Information

**Worker URL:** `https://echokit-license.echokit-rk.workers.dev`

**Cloudflare Account:** raviteja369.k@gmail.com  
**Account ID:** e08ac904468d19ea525b3005cc54888b  
**Worker Name:** echokit-license  
**Subdomain:** echokit-rk.workers.dev

**Deployment Date:** 2026-05-01  
**Version ID:** 88cb9d76-0071-4859-ad51-ec39642b082b

---

## Secrets (Environment Variables)

### ECHOKIT_HMAC_SECRET
```
86fc670d3be6f63947e6b6e1890d59955752201e0189e45116ea3e8c1b51e40d
```
**Purpose:** Used to sign and verify license keys cryptographically  
**Usage:** Never change this once deployed, or all existing license keys will become invalid

### ECHOKIT_ADMIN_TOKEN
```
e9009aedc7a19038b0c1effbae711599d56a30785270ffbcda223c2a74eb55d7
```
**Purpose:** Authorization token for `/v1/issue` endpoint to manually mint license keys  
**Usage:** Include in `Authorization: Bearer <token>` header when calling the issue endpoint

---

## API Endpoints

### Health Check
```bash
curl https://echokit-license.echokit-rk.workers.dev/__health
```
Response: `{"ok":true,"name":"EchoKit License API","version":1}`

### Verify License Key
```bash
curl "https://echokit-license.echokit-rk.workers.dev/v1/verify?key=EK-PRO-..."
```

### Issue License Key (Admin Only)
```bash
curl -X POST https://echokit-license.echokit-rk.workers.dev/v1/issue \
  -H "Authorization: Bearer e9009aedc7a19038b0c1effbae711599d56a30785270ffbcda223c2a74eb55d7" \
  -H "Content-Type: application/json" \
  -d '{"plan":"PRO","expiresAt":0}'
```

### Stripe Webhook (Automatic Key Issuance)
```bash
# Configured in Stripe Dashboard
POST https://echokit-license.echokit-rk.workers.dev/v1/stripe-webhook
```

---

## Next Steps

1. **Test the deployment** (wait ~5 min for DNS propagation):
   ```bash
   curl https://echokit-license.echokit-rk.workers.dev/__health
   ```

2. **Issue a test license key**:
   ```bash
   curl -X POST https://echokit-license.echokit-rk.workers.dev/v1/issue \
     -H "Authorization: Bearer e9009aedc7a19038b0c1effbae711599d56a30785270ffbcda223c2a74eb55d7" \
     -H "Content-Type: application/json" \
     -d '{"plan":"LTD","expiresAt":0}'
   ```

3. **Update extension** to use this endpoint (optional - built-in validation works too)

4. **Configure Stripe webhook** (for automated key issuance):
   - Go to Stripe Dashboard → Developers → Webhooks
   - Add endpoint: `https://echokit-license.echokit-rk.workers.dev/v1/stripe-webhook`
   - Select events: `checkout.session.completed`, `payment_intent.succeeded`

---

## Security Notes

- **NEVER** commit this file to git (.gitignore already excludes it)
- Store these secrets in a password manager (1Password, LastPass, etc.)
- The HMAC secret is permanent - changing it invalidates all existing keys
- The admin token can be rotated if compromised (re-run `wrangler secret put ECHOKIT_ADMIN_TOKEN`)
