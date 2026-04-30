# Manual License Key Issuance

Guide for manually issuing EchoKit license keys via the Cloudflare Worker API.

## Prerequisites

1. Worker must be deployed: `cd worker && ./deploy.sh`
2. You need the `ECHOKIT_ADMIN_TOKEN` secret value you set during deployment

## Issuing a License Key

### Using cURL

```bash
# Replace with your worker URL and admin token
WORKER_URL="https://echokit-license.YOUR_ACCOUNT.workers.dev"
ADMIN_TOKEN="your-secret-admin-token"

# Issue a PRO (monthly) license - expires in 30 days
curl -X POST "$WORKER_URL/v1/issue" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "plan": "PRO",
    "expiresAt": 0
  }'

# Issue a YEAR (annual) license - expires in 365 days
curl -X POST "$WORKER_URL/v1/issue" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "plan": "YEAR",
    "expiresAt": 0
  }'

# Issue a LTD (lifetime) license - never expires
curl -X POST "$WORKER_URL/v1/issue" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "plan": "LTD",
    "expiresAt": 0
  }'
```

### Response Format

Success response:
```json
{
  "ok": true,
  "key": "EK-PRO-1738281600-a1b2c3d4e5f6...",
  "plan": "PRO",
  "expiresAt": 1738281600
}
```

Error response:
```json
{
  "error": "unauthorized"
}
```

## Plan Types and Expiry Logic

The Worker automatically calculates `expiresAt` based on the plan:

| Plan | Auto Expiry | Manual Override |
|------|-------------|-----------------|
| `PRO` | 30 days from issue | Pass specific unix timestamp |
| `YEAR` | 365 days from issue | Pass specific unix timestamp |
| `LTD` | Never (0) | Always 0 |

### Custom Expiry Example

Issue a 90-day trial key:
```bash
# Calculate expiry: current unix time + 90 days
EXPIRY_90_DAYS=$(($(date +%s) + (90 * 86400)))

curl -X POST "$WORKER_URL/v1/issue" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"plan\": \"PRO\",
    \"expiresAt\": $EXPIRY_90_DAYS
  }"
```

## Verifying a License Key

Test that a key validates correctly:

```bash
# Verify the key
KEY="EK-PRO-1738281600-a1b2c3d4e5f6..."

curl "$WORKER_URL/v1/verify?key=$KEY"
```

Success response:
```json
{
  "ok": true,
  "pro": true,
  "plan": "PRO",
  "expiresAt": 1738281600
}
```

## Common Use Cases

### 1. Beta Tester Keys
Issue 90-day PRO keys for beta testers:
```bash
curl -X POST "$WORKER_URL/v1/issue" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"plan\": \"PRO\", \"expiresAt\": $(($(date +%s) + 7776000))}"
```

### 2. Partner/Influencer LTD Keys
```bash
curl -X POST "$WORKER_URL/v1/issue" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"plan": "LTD", "expiresAt": 0}'
```

### 3. Yearly Subscription
Standard 365-day key:
```bash
curl -X POST "$WORKER_URL/v1/issue" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"plan": "YEAR", "expiresAt": 0}'
```

## Security Notes

- **Never commit** the `ECHOKIT_ADMIN_TOKEN` to version control
- Store it in a password manager or encrypted vault
- The token is only used server-side; never expose it to clients
- Keys issued via `/v1/issue` are cryptographically signed with `ECHOKIT_HMAC_SECRET`
- Anyone with a valid key can use it, so treat keys as sensitive

## Automation with Stripe

For automated key issuance on payment, the Stripe webhook handles this:
- Customer pays → Stripe sends webhook to `/v1/stripe-webhook`
- Worker parses event and calls `issueKey()` internally
- Key is logged for manual email follow-up

To send keys via email, integrate with Resend:
```javascript
// In worker.js, after issuing key:
await fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${env.RESEND_API_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    from: 'EchoKit <keys@echokit.dev>',
    to: email,
    subject: 'Your EchoKit Pro License',
    html: `Your license key: <code>${key}</code>`
  })
});
```

## Troubleshooting

**"unauthorized" error**: Check that `Authorization: Bearer <token>` matches `ECHOKIT_ADMIN_TOKEN`

**Invalid signature**: Ensure `ECHOKIT_HMAC_SECRET` hasn't changed since deployment

**Key won't validate**: Verify the key format is `EK-{PLAN}-{EXPIRY}-{SIG}` with no extra spaces
