# Paywall switch: turning on paid Pro without a store release

EchoKit Pro is currently **free for everyone**. The extension (from the release
that includes `extension/shared/pro-status.js`) asks the license worker whether
the paywall is on, so going live is a **worker deploy**, not a Chrome Web Store
release.

## How it works

```
extension getProStatus()
  └─ GET <license worker>/v1/config   (cached 6h in chrome.storage.local)
       { paywallEnabled, grandfatherUntil, checkoutUrls }
```

| `paywallEnabled` | Result |
|------------------|--------|
| `false` (default) | Everyone is Pro (`reason: 'free-period'`). Anyone who uses the extension now is marked `earlyAdopter: true`. |
| `true` | Pro if: valid license key → `'license'`; else early adopter and now < `grandfatherUntil` → `'grandfathered'`; else active 7-day install trial → `'trial'`; else not Pro (`'none'`). |

Safety defaults:

- If `/v1/config` can't be reached, the extension uses its last cached config.
  If nothing was ever cached it assumes **paywall off**, so a worker outage
  never locks anyone out. A failed fetch is retried after 10 minutes.
- Only the JSON boolean `true` turns the paywall on. Anything else counts as off.
- Early adopters: people who already had EchoKit when the release carrying this
  code updated them (`onInstalled` reason `update` with no `installedAt`), and
  anyone who opens EchoKit while the paywall is still off.

## Prerequisites (do these first)

1. **Ship the extension release that contains this code, and wait for it to spread.**
   Older builds (≤ v1.13.28) hardcode `pro: true` and ignore the switch. Check
   the store's install-version stats before you flip.
2. LemonSqueezy merchant verification is done and the three products exist.
3. The LemonSqueezy webhook issues keys end to end
   (`worker/LEMONSQUEEZY_SETUP.md`, `worker/test-lemonsqueezy.sh`).

## Going live

1. **Announce first.** `website/pricing.html` promises advance notice before
   pricing changes. Email users and post the announcement with the go-live
   date and the grandfather date **before** you flip.
2. Edit `worker/wrangler.toml` `[vars]`:

   ```toml
   PAYWALL_ENABLED = "true"
   GRANDFATHER_UNTIL = "2027-01-15T00:00:00Z"   # about 60 days after the flip
   CHECKOUT_URL_MONTHLY  = "https://<store>.lemonsqueezy.com/buy/<monthly-variant>"
   CHECKOUT_URL_ANNUAL   = "https://<store>.lemonsqueezy.com/buy/<annual-variant>"
   CHECKOUT_URL_LIFETIME = "https://<store>.lemonsqueezy.com/buy/<lifetime-variant>"
   ```

   Checkout URLs must be `https://`. The extension drops anything else.
   These are public values, so plain `[vars]` are fine. You can also set them in
   the Cloudflare dashboard (Workers → echokit-license → Settings → Variables).
   Note that a later `wrangler deploy` from the repo overwrites dashboard
   values with what's in `wrangler.toml`, so keep the file as the source of truth.
3. Deploy the worker. Merge to `main` (CD deploys on `worker/**` changes) or run
   **Actions → Continuous Delivery (website + worker) → Run workflow** with
   `deploy_target=worker`. No extension release is needed.
4. Verify:

   ```bash
   curl -s https://api.echo-kit.com/v1/config
   # {"paywallEnabled":true,"grandfatherUntil":"2027-01-15T00:00:00.000Z","checkoutUrls":{...}}
   ```

   Clients pick up the change within about 7 hours (1h edge cache plus a 6h
   client cache).

## Recommended grandfather window

Set `GRANDFATHER_UNTIL` about **60 days after the flip**. That gives existing
users time to see the announcement and decide, keeps the pricing-page promise,
and doesn't give Pro away forever. You can move the date later with another
worker deploy.

## Rolling back

Set `PAYWALL_ENABLED = "false"` and redeploy the worker. Everyone is Pro again
once their cached config expires (up to about 7 hours).

## Do not

- Commit `PAYWALL_ENABLED = "true"` before the announcement has gone out.
- Put secrets in `[vars]`. `ECHOKIT_HMAC_SECRET` and the admin token stay in
  `wrangler secret`.
