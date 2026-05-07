# Quick Start: Manual License Key Issuance

## Prerequisites Check

First, verify your worker is deployed:

```bash
# Install wrangler if needed
npm install -g wrangler

# Check deployment status
cd worker
wrangler deployments list

# If not deployed, deploy now:
./deploy.sh
```

## Step 1: Get Your Worker URL and Admin Token

After deployment, you'll have:
- Worker URL: `https://echokit-license.YOUR_ACCOUNT.workers.dev`
- Admin Token: The value you set for `ECHOKIT_ADMIN_TOKEN` during deployment

## Step 2: Issue License Keys

### Quick Commands

```bash
# Set your credentials (replace with your actual values)
export WORKER_URL="https://echokit-license.YOUR_ACCOUNT.workers.dev"
export ADMIN_TOKEN="your-secret-admin-token-here"

# Issue Monthly Pro (30 days)
curl -X POST "$WORKER_URL/v1/issue" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"plan": "PRO", "expiresAt": 0}'

# Issue Annual (365 days)
curl -X POST "$WORKER_URL/v1/issue" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"plan": "YEAR", "expiresAt": 0}'

# Issue Lifetime (never expires)
curl -X POST "$WORKER_URL/v1/issue" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"plan": "LTD", "expiresAt": 0}'
```

### Response Example

```json
{
  "ok": true,
  "key": "EK-PRO-1738281600-a1b2c3d4e5f6a7b8",
  "plan": "PRO",
  "expiresAt": 1738281600
}
```

**Give this key to your customer!**

## Step 3: Verify the Key Works

Test the key in the extension or via API:

```bash
curl "$WORKER_URL/v1/verify?key=EK-PRO-1738281600-a1b2c3d4e5f6a7b8"
```

Expected response:
```json
{
  "ok": true,
  "pro": true,
  "plan": "PRO",
  "expiresAt": 1738281600
}
```

## Common Use Cases

### Beta Testers (90-day trial)
```bash
curl -X POST "$WORKER_URL/v1/issue" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"plan\": \"PRO\", \"expiresAt\": $(($(date +%s) + 7776000))}"
```

### Partner/Influencer (Lifetime)
```bash
curl -X POST "$WORKER_URL/v1/issue" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"plan": "LTD", "expiresAt": 0}'
```

## Troubleshooting

**401 Unauthorized**: Check your `ADMIN_TOKEN` matches what you set during deployment

**Worker not found**: Run `wrangler deployments list` to verify deployment

**Invalid key format**: The response should have format `EK-{PLAN}-{TIMESTAMP}-{SIGNATURE}`

---

## Next: Automate with Stripe

For fully automated payment → license delivery, see:
- `PAYMENT_AUTOMATION_SETUP.md` - Full Stripe + Resend integration
