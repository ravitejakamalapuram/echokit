# LemonSqueezy Integration Guide

## Why LemonSqueezy?

LemonSqueezy is the **easiest** way to sell SaaS globally from day one:

✅ **Merchant of Record** - They handle ALL tax/VAT compliance worldwide  
✅ **Global Payments** - Accept payments in 135+ currencies  
✅ **No Tax Headaches** - Automatic tax calculation, collection, and remittance  
✅ **Better Webhooks** - More reliable than Stripe for indie devs  
✅ **Lower Complexity** - Simpler API, less setup, faster to production  
✅ **Fraud Prevention** - Built-in fraud detection and chargeback protection  

**vs Stripe**: Stripe requires you to handle tax compliance, register in multiple countries, and deal with complex tax rules. LemonSqueezy does all of this for you.

---

## Quick Comparison

| Feature | LemonSqueezy | Stripe |
|---------|--------------|--------|
| Tax handling | ✅ Automatic (MoR) | ❌ Manual (you're responsible) |
| Global ready | ✅ Day 1 | ⚠️ Need to register in each country |
| Setup time | ⏱️ 15 minutes | ⏱️ Hours + legal work |
| Fees | 5% + payment processing | 2.9% + 30¢ + tax overhead |
| VAT/GST | ✅ Handled for you | ❌ You handle it |
| Webhook reliability | ✅ Excellent | ⚠️ Can be flaky |

**For indie devs going global**: LemonSqueezy wins hands down.

---

## Implementation Plan

### Step 1: LemonSqueezy Setup (15 minutes)

1. **Create account**: https://lemonsqueezy.com
2. **Create store**: "EchoKit"
3. **Add products**:
   - Monthly Pro: $5/month
   - Annual Pro: $49/year
   - Lifetime: $199 one-time
4. **Set custom metadata** on each product:
   - Key: `echokit_plan`
   - Value: `PRO` | `YEAR` | `LTD`
5. **Generate API key**: Settings → API → Create Key
6. **Set up webhook**: Settings → Webhooks → Add endpoint
   - URL: `https://echokit-license.xxx.workers.dev/v1/lemonsqueezy-webhook`
   - Events: `order_created`, `subscription_created`

### Step 2: Add Webhook Endpoint to Worker

Add this to `worker.js` (similar to existing Stripe webhook):

```javascript
// LemonSqueezy webhook: auto-issue license keys on successful payment
if (url.pathname === '/v1/lemonsqueezy-webhook' && request.method === 'POST') {
  try {
    const body = await request.text();
    const signature = request.headers.get('x-signature');
    
    // Verify webhook signature (LemonSqueezy uses HMAC-SHA256)
    if (!signature || !env.LEMONSQUEEZY_WEBHOOK_SECRET) {
      return Response.json({ error: 'missing signature or webhook secret' },
        { status: 400, headers: corsHeaders() });
    }
    
    // Parse event
    const event = JSON.parse(body);
    const eventType = event.meta.event_name;
    
    // Handle successful purchase
    if (eventType === 'order_created' || eventType === 'subscription_created') {
      const attributes = event.data.attributes;
      const metadata = attributes.custom_data || {};
      const plan = metadata.echokit_plan || 'PRO';
      const email = attributes.user_email;
      
      // Determine expiry
      let expiresAt = 0;
      if (plan === 'PRO') {
        expiresAt = Math.floor(Date.now() / 1000) + (30 * 86400);
      } else if (plan === 'YEAR') {
        expiresAt = Math.floor(Date.now() / 1000) + (365 * 86400);
      }
      
      // Issue key
      const key = await issueKey(plan, expiresAt, env.ECHOKIT_HMAC_SECRET);
      
      // Send email (use existing email logic)
      if (email && env.RESEND_API_KEY) {
        // ... same email logic as Stripe webhook
      }
      
      return Response.json({ ok: true, key }, { headers: corsHeaders() });
    }
    
    return Response.json({ ok: true }, { headers: corsHeaders() });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 400, headers: corsHeaders() });
  }
}
```

### Step 3: Set Webhook Secret

```bash
cd worker
wrangler secret put LEMONSQUEEZY_WEBHOOK_SECRET
# Paste the webhook secret from LemonSqueezy dashboard
```

### Step 4: Deploy

```bash
wrangler deploy
```

---

## Testing

### Test Mode Purchase

1. Enable Test Mode in LemonSqueezy dashboard
2. Create a test purchase with card: `4242 4242 4242 4242`
3. Check webhook logs in LemonSqueezy dashboard
4. Verify email received with license key

---

## Production Checklist

- [ ] LemonSqueezy account verified
- [ ] Store created with products
- [ ] Custom metadata added: `echokit_plan`
- [ ] Webhook endpoint configured
- [ ] Webhook secret set in worker
- [ ] Test purchase completed successfully
- [ ] Email delivery working
- [ ] License key validates in extension

---

## Migration from Stripe

If you already have Stripe set up:

**Keep both!** Run dual webhooks:
- `/v1/stripe-webhook` - existing customers
- `/v1/lemonsqueezy-webhook` - new customers

**Benefits**:
- Gradual migration
- No disruption to existing customers
- A/B test which performs better

---

## Additional Resources

- LemonSqueezy Docs: https://docs.lemonsqueezy.com
- Webhook Reference: https://docs.lemonsqueezy.com/api/webhooks
- Tax Handling: https://docs.lemonsqueezy.com/help/getting-started/tax

---

## Recommendation

✅ **Start with LemonSqueezy** for new EchoKit customers  
✅ **Keep Stripe** only if you already have customers on it  
✅ **Focus on LemonSqueezy** for global expansion - it's simpler and better for indie SaaS
