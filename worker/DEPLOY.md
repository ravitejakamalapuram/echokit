# Cloudflare Worker Deployment Guide

## Prerequisites
- Cloudflare account (free tier works)
- Wrangler CLI installed ✅ (done)

## Step-by-Step Deployment

### 1. Login to Cloudflare
```bash
cd /Users/rkamalapuram/git-personal/echokit/worker
wrangler login
```
This will open a browser window for OAuth authentication. Follow the prompts.

### 2. Generate and Set Secrets

#### ECHOKIT_HMAC_SECRET (required)
Generate a secure 256-bit hex string:
```bash
openssl rand -hex 32
```
Copy the output and run:
```bash
wrangler secret put ECHOKIT_HMAC_SECRET
# Paste the generated hex string when prompted
```

#### ECHOKIT_ADMIN_TOKEN (required)
Generate a secure admin token:
```bash
openssl rand -base64 32
```
Copy the output and run:
```bash
wrangler secret put ECHOKIT_ADMIN_TOKEN
# Paste the generated token when prompted
```

**IMPORTANT**: Save both values securely! You'll need:
- ECHOKIT_HMAC_SECRET: Never changes (rotating it invalidates all existing license keys)
- ECHOKIT_ADMIN_TOKEN: Used to mint new license keys via API

### 3. Deploy the Worker
```bash
wrangler deploy
```

Expected output:
```
 ⛅️ wrangler 3.x.x
-------------------
Total Upload: XX.XX KiB / gzip: XX.XX KiB
Uploaded echokit-license (X.XX sec)
Published echokit-license (X.XX sec)
  https://echokit-license.<YOUR_SUBDOMAIN>.workers.dev
Current Deployment ID: <some-uuid>
```

**Save this URL!** You'll need it for:
1. Extension configuration (license endpoint setting)
2. Minting license keys for customers

### 4. Test the Deployment
```bash
# Health check
curl https://echokit-license.<YOUR_SUBDOMAIN>.workers.dev/__health
# Should return: {"ok":true,"name":"EchoKit License API"}

# Test key minting (replace <YOUR_ADMIN_TOKEN> with the value from step 2)
curl -X POST https://echokit-license.<YOUR_SUBDOMAIN>.workers.dev/v1/issue \
  -H "Authorization: Bearer <YOUR_ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"plan":"PRO","expiresAt":0}'
# Should return: {"key":"EK-PRO-0-xxxxxxxxxxxx","plan":"PRO","expiresAt":0}

# Test key validation
curl -X POST https://echokit-license.<YOUR_SUBDOMAIN>.workers.dev/v1/validate \
  -H "Content-Type: application/json" \
  -d '{"key":"<KEY_FROM_PREVIOUS_STEP>"}'
# Should return: {"valid":true,"plan":"PRO","expiresAt":null}
```

### 5. (Optional) Add Custom Domain
If you want to use `license.echokit.dev` instead of `*.workers.dev`:

1. Go to your Cloudflare dashboard
2. Navigate to Workers & Pages → echokit-license → Settings → Domains & Routes
3. Add Custom Domain → `license.echokit.dev`
4. Update `wrangler.toml`:
   ```toml
   routes = ["license.echokit.dev/*"]
   ```
5. Redeploy: `wrangler deploy`

## Post-Deployment Checklist

- [ ] Worker deployed successfully
- [ ] Health endpoint responding
- [ ] Test license key minted and validated
- [ ] Worker URL saved in secure location
- [ ] HMAC_SECRET saved in password manager
- [ ] ADMIN_TOKEN saved in password manager
- [ ] Ready to integrate with extension Settings UI (next P1 task)

## Troubleshooting

**Error: "Authentication required"**
→ Run `wrangler login` again

**Error: "Secret already exists"**
→ Use `wrangler secret delete <NAME>` then re-add, or leave existing if you're sure it's correct

**Error: "Invalid signature" when validating**
→ The HMAC_SECRET used to mint the key doesn't match the one in the worker. Redeploy or check secrets.

**Worker returns 404**
→ Check the deployment URL is correct, wait 30 seconds for propagation

## Next Steps
After deployment:
1. Update extension Settings UI to add license endpoint input (P1 task)
2. Set up Stripe webhook to auto-issue keys (P1 task)
3. Add worker URL to extension docs/README
