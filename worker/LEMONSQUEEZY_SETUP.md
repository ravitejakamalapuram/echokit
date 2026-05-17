# LemonSqueezy Integration Setup Guide

Complete guide for setting up automated license key delivery via LemonSqueezy payments.

---

## Overview

This integration automatically issues license keys when customers purchase EchoKit Pro through LemonSqueezy:

```text
Customer Purchase → LemonSqueezy → Webhook → Worker → License Key → Email
```

**Features:**
- ✅ Automatic license key generation (HMAC-signed, no database needed)
- ✅ Email delivery via Resend
- ✅ Threshold-based plan detection (≥$199→LTD, ≥$49→YEAR, <$49→PRO)
- ✅ Support for subscriptions and one-time payments
- ✅ 24-hour license validation caching in extension

---

## Prerequisites

1. **LemonSqueezy Account**: https://app.lemonsqueezy.com
2. **Resend Account**: https://resend.com (for email delivery)
3. **Cloudflare Account**: For Workers deployment
4. **Custom Domain**: Required for production email delivery

---

## Step 1: Create LemonSqueezy Products

### 1.1 Create Store
1. Go to: https://app.lemonsqueezy.com/settings/stores
2. Set **Store Currency**: USD
3. Enable **Test Mode** for testing

### 1.2 Create Product with Variants

Create one product: **EchoKit Pro**

**Add 3 Variants:**

| Variant | Type | Price | Billing Cycle |
|---------|------|-------|---------------|
| Monthly | Subscription | $5.00 | Monthly |
| Annual | Subscription | $49.00 | Yearly |
| Lifetime | One-time | $199.00 | - |

### 1.3 Get Checkout URLs

1. Click product → **Share** button
2. For each variant:
   - Enable **only that variant**
   - Copy the checkout URL
   - Format: `https://echokit.lemonsqueezy.com/checkout/buy/{variant-id}?enabled={variant-id}`

**Save these URLs** - you'll need them for the pricing page.

---

## Step 2: Deploy Worker

### 2.1 Install Dependencies
```bash
cd worker
npm install
```

### 2.2 Configure Secrets

Generate a random signing secret:
```bash
openssl rand -hex 32
```

Set all required secrets:
```bash
# License signing secret (use generated value above)
wrangler secret put ECHOKIT_HMAC_SECRET

# Admin API token (create your own secure token)
wrangler secret put ECHOKIT_ADMIN_TOKEN

# LemonSqueezy webhook secret (create your own - see Step 3)
wrangler secret put LEMONSQUEEZY_WEBHOOK_SECRET

# Resend API key (get from https://resend.com/api-keys)
wrangler secret put RESEND_API_KEY
```

### 2.3 Deploy
```bash
wrangler deploy
```

**Note the deployed URL**: `https://echokit-license.{your-subdomain}.workers.dev`

---

## Step 3: Configure LemonSqueezy Webhook

### 3.1 Create Signing Secret

Generate a secret for webhook verification:
```bash
openssl rand -hex 32
```

### 3.2 Add Webhook in LemonSqueezy

1. Go to: https://app.lemonsqueezy.com/settings/webhooks
2. Click **"Add Endpoint"**
3. Fill in:
   - **Callback URL**: `https://echokit-license.{your-subdomain}.workers.dev/v1/lemonsqueezy-webhook`
   - **Signing Secret**: Paste the secret you generated in 3.1
   - **Events**: Select:
     - ✅ `order_created`
     - ✅ `subscription_created`
4. Click **"Save Webhook"**

### 3.3 Set Webhook Secret in Worker

Use the **same secret** from step 3.1:
```bash
wrangler secret put LEMONSQUEEZY_WEBHOOK_SECRET
# Paste the same secret you entered in LemonSqueezy

wrangler deploy
```

---

## Step 4: Configure Email Delivery

### 4.1 Get Resend API Key

1. Go to: https://resend.com/api-keys
2. Click **"Create API Key"**
3. Name: `EchoKit License Emails`
4. Copy the API key (starts with `re_`)

### 4.2 Set API Key in Worker

```bash
wrangler secret put RESEND_API_KEY
# Paste your Resend API key

wrangler deploy
```

### 4.3 Current Email Behavior

**With `no-reply@resend.dev` (current setup):**
- ⚠️ Emails only go to YOUR verified email
- ✅ Works for testing
- ❌ **Won't work for customers in production**

**To send to customers, you MUST add a custom domain (see Step 5)**

---

## Step 5: Add Custom Domain (Required for Production)

### 5.1 Verify Domain in Resend

1. Go to: https://resend.com/domains
2. Click **"Add Domain"**
3. Enter your domain (e.g., `echokit.com` or `mail.echokit.com`)
4. Add DNS records shown by Resend to your domain registrar:
   - **SPF** (TXT): `v=spf1 include:resend.com ~all`
   - **DKIM** (TXT): Long string provided by Resend
   - **DMARC** (TXT): `v=DMARC1; p=none`
5. Wait for verification (5-15 minutes)

### 5.2 Update Worker

Edit `worker/worker.js` line ~376:

**Before:**
```javascript
from: 'EchoKit <no-reply@resend.dev>',
```

**After:**
```javascript
from: 'EchoKit <no-reply@yourdomain.com>',
```

Deploy:
```bash
wrangler deploy
```

---

## Step 6: Update Pricing Page

Edit `docs/pricing.html` with your checkout URLs from Step 1.3.

The pricing page should link to your LemonSqueezy checkout URLs.

---

## Testing

### Test in LemonSqueezy Test Mode

1. **Enable Test Mode** in LemonSqueezy (toggle in top right)
2. **Make a test purchase**:
   - Use card: `4242 4242 4242 4242`
   - Expiry: Any future date
   - CVV: Any 3 digits
3. **Check webhook deliveries**:
   - Go to: Settings → Webhooks → Your webhook → Recent deliveries
   - Should show: `200 OK`
4. **Check your email** for the license key

### Monitor Logs

```bash
cd worker
wrangler tail
```

You should see:
```text
LemonSqueezy: Issued {PLAN} license for {email}: EK-{PLAN}-{EXPIRY}-{SIGNATURE}
LemonSqueezy: Email sent to {email}
```

### Verify License Key

Test the generated key:
```bash
curl -X POST https://echokit-license.{your-subdomain}.workers.dev/v1/validate \
  -H "Content-Type: application/json" \
  -d '{"key":"EK-PRO-1234567890-abc123def456"}'
```

---

## How It Works

### Plan Detection (Threshold-Based)

The worker automatically detects the plan from the payment amount using thresholds:

```text
// Line 268-295 in worker.js
< $49 (< 4900 cents)        → PRO plan   (30-day license)
$49-$198 (4900-19899 cents) → YEAR plan  (365-day license)
≥ $199 (≥ 19900 cents)      → LTD plan   (lifetime license)
```

This threshold-based detection allows for price variations (discounts, regional pricing, etc.) while still correctly mapping to the appropriate plan tier.

### License Key Format

```text
EK-{PLAN}-{EXPIRY}-{SIGNATURE}
```

Example: `EK-PRO-1747123456-abc123def456`

- **PLAN**: PRO, YEAR, or LTD
- **EXPIRY**: Unix timestamp (or 0 for lifetime)
- **SIGNATURE**: HMAC-SHA256 signature (first 16 hex chars)

### Extension Validation

1. User enters key in extension settings
2. Extension validates format locally
3. Extension calls `/v1/validate` endpoint
4. Worker verifies HMAC signature
5. Result cached for 24 hours
6. Pro features unlock

---

## Going Live

### Before Switching to Live Mode

- [ ] Custom domain verified in Resend
- [ ] Worker updated to use custom domain
- [ ] Test purchase completed successfully
- [ ] Email delivered to test customer
- [ ] License key validated in extension
- [ ] Webhook logs show no errors

### Switch to Live Mode

1. Toggle **Test Mode OFF** in LemonSqueezy
2. Real payments will be processed
3. Real customers will receive license keys
4. Monitor webhook logs for first few purchases

---

## Troubleshooting

### No Email Received

**Check:**
1. Is `RESEND_API_KEY` set? Run `wrangler secret list`
2. Is domain verified? Check Resend dashboard
3. Check Resend logs: https://resend.com/emails
4. Check worker logs: `wrangler tail`

### Webhook Returns 401

**Issue**: Signing secret mismatch

**Fix**:
```bash
wrangler secret put LEMONSQUEEZY_WEBHOOK_SECRET
# Paste the EXACT secret from LemonSqueezy webhook settings
wrangler deploy
```

### Wrong Plan Assigned

**Issue**: Price detection logic

**Check**: Webhook payload shows correct `total_usd` value?

**Fix**: Update price thresholds in `worker.js` lines 280-288

---

## Secrets Reference

| Secret | Purpose | Get From |
|--------|---------|----------|
| `ECHOKIT_HMAC_SECRET` | License key signing | Generate: `openssl rand -hex 32` |
| `ECHOKIT_ADMIN_TOKEN` | Admin API auth | Create your own secure token |
| `LEMONSQUEEZY_WEBHOOK_SECRET` | Webhook verification | You create it, use same in LS & Worker |
| `RESEND_API_KEY` | Email delivery | https://resend.com/api-keys |

---

## Support

For issues or questions:
- **Worker logs**: `wrangler tail`
- **Webhook deliveries**: LemonSqueezy dashboard → Settings → Webhooks
- **Email logs**: https://resend.com/emails
- **GitHub Issues**: https://github.com/ravitejakamalapuram/echokit
