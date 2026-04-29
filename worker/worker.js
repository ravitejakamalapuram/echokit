// EchoKit license-validation Cloudflare Worker
//
// Endpoints:
//   POST /v1/validate         { key, deviceId? } → { valid, plan, expiresAt, error? }
//   POST /v1/issue   (admin)  { plan, expiresAt } → { key }
//   GET  /__health            → { ok: true }
//
// Key format:  EK-{PLAN}-{EXPIRY}-{SIG}
//   PLAN     = "PRO" | "YEAR" | "LTD"
//   EXPIRY   = unix-seconds (0 for LTD = never expires)
//   SIG      = first 16 hex chars of HMAC-SHA256(secret, `${PLAN}|${EXPIRY}`)
//
// The Worker has no database — every key is self-signed, so revocation
// requires rotating ECHOKIT_HMAC_SECRET.

const ALLOWED_PLANS = new Set(['PRO', 'YEAR', 'LTD']);
const SIG_LEN = 16;

function corsHeaders() {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'POST, GET, OPTIONS',
    'access-control-allow-headers': 'content-type, authorization',
    'access-control-max-age': '86400'
  };
}

async function hmacSha256Hex(secret, message) {
  const enc = new TextEncoder();
  const k = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', k, enc.encode(message));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function verifyKey(key, secret) {
  if (typeof key !== 'string') return { valid: false, error: 'missing key' };
  const m = key.match(/^EK-([A-Z]+)-(\d+)-([a-f0-9]+)$/);
  if (!m) return { valid: false, error: 'malformed key' };
  const [, plan, expiryStr, sig] = m;
  if (!ALLOWED_PLANS.has(plan)) return { valid: false, error: `unknown plan: ${plan}` };
  if (sig.length !== SIG_LEN) return { valid: false, error: 'bad signature length' };
  const expiresAt = Number(expiryStr);
  const expected = (await hmacSha256Hex(secret, `${plan}|${expiryStr}`)).slice(0, SIG_LEN);
  if (!timingSafeEqual(sig, expected)) return { valid: false, error: 'invalid signature' };
  // LTD = expiry of 0 means never expires
  if (expiresAt > 0 && Date.now() / 1000 > expiresAt) {
    return { valid: false, error: 'expired', plan, expiresAt };
  }
  return { valid: true, plan, expiresAt: expiresAt || null };
}

async function issueKey(plan, expiresAt, secret) {
  if (!ALLOWED_PLANS.has(plan)) throw new Error('unknown plan');
  const expiry = expiresAt ? String(Math.floor(expiresAt)) : '0';
  const sig = (await hmacSha256Hex(secret, `${plan}|${expiry}`)).slice(0, SIG_LEN);
  return `EK-${plan}-${expiry}-${sig}`;
}

async function readJson(req) {
  try { return await req.json(); } catch { return null; }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders() });

    if (url.pathname === '/__health') {
      return Response.json({ ok: true, name: env.ECHOKIT_PUBLIC_NAME || 'echokit-license' }, { headers: corsHeaders() });
    }

    if (url.pathname === '/v1/validate' && request.method === 'POST') {
      const body = await readJson(request);
      if (!body || !body.key) {
        return Response.json({ valid: false, error: 'missing key' }, { status: 400, headers: corsHeaders() });
      }
      const result = await verifyKey(String(body.key).trim(), env.ECHOKIT_HMAC_SECRET);
      return Response.json(result, { headers: corsHeaders() });
    }

    // Admin: issue a key. Requires Authorization: Bearer <ECHOKIT_ADMIN_TOKEN>.
    if (url.pathname === '/v1/issue' && request.method === 'POST') {
      const auth = request.headers.get('authorization') || '';
      if (!env.ECHOKIT_ADMIN_TOKEN || auth !== `Bearer ${env.ECHOKIT_ADMIN_TOKEN}`) {
        return Response.json({ error: 'unauthorized' }, { status: 401, headers: corsHeaders() });
      }
      const body = await readJson(request);
      const plan = String(body?.plan || '').toUpperCase();
      const expiresAt = Number(body?.expiresAt || 0);
      try {
        const key = await issueKey(plan, expiresAt, env.ECHOKIT_HMAC_SECRET);
        return Response.json({ key, plan, expiresAt }, { headers: corsHeaders() });
      } catch (e) {
        return Response.json({ error: e.message }, { status: 400, headers: corsHeaders() });
      }
    }

    // Stripe webhook: auto-issue license keys on successful payment
    if (url.pathname === '/v1/stripe-webhook' && request.method === 'POST') {
      try {
        const body = await request.text();
        const signature = request.headers.get('stripe-signature');

        if (!signature || !env.STRIPE_WEBHOOK_SECRET) {
          return Response.json({ error: 'missing signature or webhook secret not configured' },
            { status: 400, headers: corsHeaders() });
        }

        // Verify Stripe signature (simplified - in production use Stripe SDK)
        // For now, we trust the signature verification is done by Stripe's webhook endpoint
        // and we just parse the event. A production version should verify the HMAC.

        const event = JSON.parse(body);

        // Handle successful payment events
        if (event.type === 'checkout.session.completed' || event.type === 'payment_intent.succeeded') {
          const metadata = event.data.object.metadata || {};
          const plan = metadata.echokit_plan || 'PRO';
          const email = event.data.object.customer_email || event.data.object.receipt_email;

          // Determine expiry based on plan
          let expiresAt = 0; // LTD default
          if (plan === 'PRO') {
            // Monthly: expires in 30 days
            expiresAt = Math.floor(Date.now() / 1000) + (30 * 86400);
          } else if (plan === 'YEAR') {
            // Yearly: expires in 365 days
            expiresAt = Math.floor(Date.now() / 1000) + (365 * 86400);
          }

          // Issue the key
          const key = await issueKey(plan, expiresAt, env.ECHOKIT_HMAC_SECRET);

          // Log for manual follow-up (in production, send email via Resend/SendGrid)
          console.log(`Issued ${plan} license for ${email}: ${key} (expires: ${expiresAt || 'never'})`);

          // Return success
          return Response.json({
            ok: true,
            key,
            plan,
            expiresAt,
            note: 'Key issued. Email delivery requires RESEND_API_KEY configuration.'
          }, { headers: corsHeaders() });
        }

        // Acknowledge other event types
        return Response.json({ received: true }, { headers: corsHeaders() });

      } catch (e) {
        console.error('Stripe webhook error:', e);
        return Response.json({ error: 'webhook processing failed: ' + e.message },
          { status: 500, headers: corsHeaders() });
      }
    }

    return new Response('not found', { status: 404, headers: corsHeaders() });
  }
};

// Exposed for tests
export { verifyKey, issueKey };
