# EchoKit Payment Automation Setup Guide

Complete guide to set up automated payment → license delivery flow.

## Overview

When a customer pays via Stripe, the system will:
1. ✅ Receive payment confirmation via Stripe webhook
2. ✅ Generate a license key automatically
3. ✅ Send a branded email with the license key
4. ✅ Log the transaction for monitoring

---

## Prerequisites

- ✅ Cloudflare Worker deployed (already done)
- ✅ Worker code updated with email functionality (already done)
- ❌ Stripe account with products configured
- ❌ Resend account with API key
- ❌ Pricing page updated with real payment links

---

## Step 1: Stripe Setup

### 1.1 Create Stripe Account

1. Go to: https://stripe.com
2. Sign up / Sign in
3. Complete account verification

### 1.2 Create Three Products

**Product #1: Monthly Pro ($5/month)**
- Navigate to: **Products** → **Add product**
- Name: `EchoKit Pro Monthly`
- Description: `Full power API mocking with unlimited recordings, WebSocket/SSE replay, and team sync`
- Pricing: `$5.00` / `Monthly` / `USD`
- **IMPORTANT**: Add Metadata
  - Key: `echokit_plan`
  - Value: `PRO`
- Save → **Create payment link** → Copy URL

**Product #2: Annual Pro ($49/year)**
- Name: `EchoKit Pro Annual`
- Description: `Annual billing - save 18%`
- Pricing: `$49.00` / `Yearly` / `USD`
- Metadata:
  - Key: `echokit_plan`
  - Value: `YEAR`
- Save → **Create payment link** → Copy URL

**Product #3: Lifetime ($199 one-time)**
- Name: `EchoKit Lifetime`
- Description: `Pay once, own forever. All future updates included.`
- Pricing: `$199.00` / `One time` / `USD`
- Metadata:
  - Key: `echokit_plan`
  - Value: `LTD`
- Save → **Create payment link** → Copy URL

### 1.3 Configure Webhook

1. Go to: **Developers** → **Webhooks**
2. Click **Add endpoint**
3. Endpoint URL: `https://echokit-license.echokit-rk.workers.dev/v1/stripe-webhook`
4. Description: `EchoKit license auto-issue`
5. Select events:
   - ☑️ `checkout.session.completed`
   - ☑️ `payment_intent.succeeded`
6. **Save** → Copy the **Signing secret** (starts with `whsec_...`)

### 1.4 Add Webhook Secret to Worker

```bash
cd /Users/rkamalapuram/git-personal/echokit/worker
wrangler secret put STRIPE_WEBHOOK_SECRET
# Paste the whsec_... secret when prompted
```

---

## Step 2: Resend Email Setup

### 2.1 Create Resend Account

1. Go to: https://resend.com
2. Sign up with GitHub or email
3. Verify email

### 2.2 Choose Email Domain

**Option A: Use onboarding domain (quick, for testing)**
- Resend gives you `onboarding@resend.dev` immediately
- Good for testing, has "via resend.dev" in email clients
- Skip to Step 2.3

**Option B: Use your own domain (production)**
1. **Domains** → **Add Domain**
2. Enter: `echokit.dev` (or your domain)
3. Add DNS records shown (SPF, DKIM, DMARC)
4. Wait 5-10 minutes for verification
5. Update `from` field in `worker.js` line 174:
   ```javascript
   from: 'EchoKit <licenses@echokit.dev>',
   ```

### 2.3 Generate API Key

1. Go to: **API Keys**
2. Click **Create API Key**
3. Name: `EchoKit License Delivery`
4. Permissions: **Sending access**
5. **Create** → Copy the key (starts with `re_...`)

### 2.4 Add API Key to Worker

```bash
cd /Users/rkamalapuram/git-personal/echokit/worker
wrangler secret put RESEND_API_KEY
# Paste the re_... key when prompted
```

---

## Step 3: Deploy Updated Worker

```bash
cd /Users/rkamalapuram/git-personal/echokit/worker
wrangler deploy
```

Expected output:
```
Total Upload: xx.xx KiB / gzip: xx.xx KiB
Uploaded echokit-license (x.xx sec)
Published echokit-license (x.xx sec)
  https://echokit-license.echokit-rk.workers.dev
```

---

## Step 4: Update Pricing Page

Replace the placeholder Stripe links in `docs/pricing.html`:

```javascript
// Line 264-268 in docs/pricing.html
const LINKS = {
  monthly: 'PASTE_MONTHLY_PAYMENT_LINK_HERE',
  annual:  'PASTE_ANNUAL_PAYMENT_LINK_HERE',
  lifetime:'PASTE_LIFETIME_PAYMENT_LINK_HERE'
};
```

**Example:**
```javascript
const LINKS = {
  monthly: 'https://buy.stripe.com/xxxxx',
  annual:  'https://buy.stripe.com/yyyyy',
  lifetime:'https://buy.stripe.com/zzzzz'
};
```

---

## Step 5: Test End-to-End

### 5.1 Enable Stripe Test Mode

1. In Stripe Dashboard, toggle to **Test mode** (top right)
2. Use test credit card: `4242 4242 4242 4242`
3. Any future expiry date, any CVC

### 5.2 Make a Test Purchase

1. Open your pricing page: `docs/pricing.html` (in browser)
2. Click one of the "Get Pro" buttons
3. Complete checkout with test card
4. Check your email for the license key

### 5.3 Verify License Key

```bash
curl -X POST https://echokit-license.echokit-rk.workers.dev/v1/validate \
  -H "Content-Type: application/json" \
  -d '{"key":"EK-PRO-..."}'
```

Expected response:
```json
{"valid": true, "plan": "PRO", "expiresAt": 1234567890}
```

---

## Monitoring & Troubleshooting

### Check Worker Logs

```bash
cd /Users/rkamalapuram/git-personal/echokit/worker
wrangler tail
```

### Stripe Webhook Logs

1. **Developers** → **Webhooks**
2. Click your endpoint
3. View **Logs** tab for delivery status

### Common Issues

**❌ Email not received**
- Check Resend dashboard for delivery status
- Verify `RESEND_API_KEY` is set correctly
- Check spam folder

**❌ Webhook not called**
- Verify webhook URL is correct
- Check Stripe webhook logs for errors
- Ensure events are selected: `checkout.session.completed`

**❌ Wrong license expiry**
- Check product metadata: `echokit_plan` = `PRO` | `YEAR` | `LTD`
- Metadata is case-sensitive

---

## Production Checklist

Before going live:

- [ ] Switch Stripe to **Live mode**
- [ ] Update payment links in pricing page (live mode links)
- [ ] Use custom domain for Resend (not onboarding@resend.dev)
- [ ] Test one real payment
- [ ] Add rate limiting in Cloudflare Dashboard
- [ ] Monitor logs for first 24 hours

---

## Summary

**Infrastructure:**
✅ Worker endpoint: `/v1/stripe-webhook`  
✅ Email delivery: Resend API integration  
✅ License generation: HMAC-SHA256 signatures  

**Customer Journey:**
1. Customer clicks "Get Pro" → Stripe checkout
2. Payment successful → Stripe sends webhook
3. Worker generates license key
4. Worker emails key to customer
5. Customer pastes key in extension → Unlocked!

**Next:** Update `docs/pricing.html` with your Stripe Payment Links!
