// EchoKit license-validation Cloudflare Worker
//
// Endpoints:
//   POST /v1/validate              { key, deviceId? } → { valid, plan, expiresAt, source?, error? }
//   POST /v1/issue        (admin)  { plan, expiresAt } → { key }
//   GET  /v1/config                → { paywallEnabled, grandfatherUntil, checkoutUrls }
//   GET  /__health                 → { ok: true }
//
// /v1/validate accepts two kinds of key:
//
// 1. Gumroad license keys (XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX), the key a
//    customer receives when buying EchoKit Pro on Gumroad. The Worker checks
//    them with Gumroad's POST /v2/licenses/verify against every product id in
//    GUMROAD_PRODUCT_IDS (see parseGumroadProducts).
//
// 2. Self-signed HMAC keys (issued via /v1/issue), kept for backward compat:
//    Key format:  EK-{PLAN}-{EXPIRY}-{SIG}
//      PLAN     = "PRO" | "YEAR" | "LTD"
//      EXPIRY   = unix-seconds (0 for LTD = never expires)
//      SIG      = first 16 hex chars of HMAC-SHA256(secret, `${PLAN}|${EXPIRY}`)
//    Revoking an HMAC key requires rotating ECHOKIT_HMAC_SECRET.

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

// ---------- Gumroad licenses ----------

const GUMROAD_VERIFY_URL = 'https://api.gumroad.com/v2/licenses/verify';
const GUMROAD_KEY_RE = /^[0-9A-F]{8}-[0-9A-F]{8}-[0-9A-F]{8}-[0-9A-F]{8}$/;
// Plan label meaning "a membership: derive PRO/YEAR from purchase.recurrence".
const MEMBERSHIP_PLAN = 'MEMBERSHIP';
const GUMROAD_TIMEOUT_MS = 8000;
// Per-isolate cache of Gumroad answers, so a burst of validations for the same
// key doesn't hit Gumroad each time. The extension also caches for 24h.
const GUMROAD_CACHE_VALID_MS = 10 * 60 * 1000;
const GUMROAD_CACHE_INVALID_MS = 2 * 60 * 1000;
const GUMROAD_CACHE_MAX = 500;
const gumroadCache = new Map();

/** True when `key` looks like a Gumroad license key. */
export function isGumroadKey(key) {
  return typeof key === 'string' && GUMROAD_KEY_RE.test(key.trim().toUpperCase());
}

/**
 * Parse the GUMROAD_PRODUCT_IDS var into [{ id, plan }].
 *
 * Accepts either JSON ({"<product_id>": "MEMBERSHIP" | "PRO" | "YEAR" | "LTD"})
 * or a comma list of `<product_id>:<PLAN>` pairs. Gumroad product ids are
 * base64 and can end in "=", so the plan is taken after the LAST colon.
 * MEMBERSHIP means the plan comes from the purchase's recurrence
 * (yearly → YEAR, anything else → PRO).
 */
export function parseGumroadProducts(raw) {
  const text = String(raw || '').trim();
  if (!text) return [];
  const valid = new Set([...ALLOWED_PLANS, MEMBERSHIP_PLAN]);
  const out = [];
  const push = (id, plan) => {
    const pid = String(id || '').trim();
    const p = String(plan || '').trim().toUpperCase();
    if (pid && valid.has(p)) out.push({ id: pid, plan: p });
  };
  if (text.startsWith('{')) {
    try {
      const obj = JSON.parse(text);
      for (const [id, plan] of Object.entries(obj || {})) push(id, plan);
    } catch {
      return [];
    }
    return out;
  }
  for (const part of text.split(',')) {
    const i = part.lastIndexOf(':');
    if (i > 0) push(part.slice(0, i), part.slice(i + 1));
  }
  return out;
}

/**
 * Decide whether a Gumroad verify response grants Pro.
 * Invalid when refunded, charged back, an unresolved dispute, or (for
 * memberships) the subscription was cancelled, ended or failed to charge.
 */
export function evaluateGumroadPurchase(json, productPlan) {
  if (!json || json.success !== true || !json.purchase) {
    return { valid: false, error: 'unknown license key' };
  }
  const p = json.purchase;
  if (p.refunded) return { valid: false, error: 'refunded' };
  if (p.chargebacked) return { valid: false, error: 'chargebacked' };
  if (p.disputed && !p.dispute_won) return { valid: false, error: 'disputed' };
  if (p.subscription_ended_at) return { valid: false, error: 'subscription ended' };
  if (p.subscription_cancelled_at) return { valid: false, error: 'subscription cancelled' };
  if (p.subscription_failed_at) return { valid: false, error: 'subscription payment failed' };

  let plan = productPlan;
  if (plan === MEMBERSHIP_PLAN) {
    plan = String(p.recurrence || '').toLowerCase() === 'yearly' ? 'YEAR' : 'PRO';
  }
  return { valid: true, plan, expiresAt: null, source: 'gumroad' };
}

/**
 * Verify a Gumroad license key against every configured product.
 * Returns { valid, plan?, expiresAt?, source?, error? }. When Gumroad can't be
 * reached (network error, timeout, 429 or 5xx) and no product accepted the key,
 * returns { valid: false, error, unavailable: true }; that answer isn't cached.
 */
export async function verifyGumroadKey(key, env = {}, { fetchFn = fetch, now = Date.now() } = {}) {
  const products = parseGumroadProducts(env.GUMROAD_PRODUCT_IDS);
  if (!products.length) return { valid: false, error: 'gumroad licensing not configured' };
  const licenseKey = String(key).trim().toUpperCase();

  const cached = gumroadCache.get(licenseKey);
  if (cached && cached.until > now) return cached.result;

  let firstFailure = null;
  let unavailable = false;
  for (const { id, plan } of products) {
    let json = null;
    try {
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timer = controller ? setTimeout(() => controller.abort(), GUMROAD_TIMEOUT_MS) : null;
      let res;
      try {
        res = await fetchFn(GUMROAD_VERIFY_URL, {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            product_id: id,
            license_key: licenseKey,
            increment_uses_count: 'false'
          }).toString(),
          signal: controller ? controller.signal : undefined
        });
      } finally {
        if (timer) clearTimeout(timer);
      }
      // Gumroad answers 404 + { success: false } for a key that isn't for
      // this product. 5xx / 429 mean Gumroad itself is unhappy.
      if (res.status >= 500 || res.status === 429) {
        unavailable = true;
        continue;
      }
      json = await res.json();
    } catch {
      unavailable = true;
      continue;
    }
    if (json && json.success === true) {
      const result = evaluateGumroadPurchase(json, plan);
      if (result.valid) return remember(licenseKey, result, now);
      // Key belongs to this product but is no longer entitled. Keep looking
      // in case the customer also owns another plan (e.g. upgraded to LTD).
      firstFailure = firstFailure || result;
    }
  }

  if (firstFailure) return remember(licenseKey, firstFailure, now);
  if (unavailable) return { valid: false, error: 'license server unavailable', unavailable: true };
  return remember(licenseKey, { valid: false, error: 'unknown license key' }, now);
}

function remember(key, result, now) {
  if (gumroadCache.size >= GUMROAD_CACHE_MAX) gumroadCache.delete(gumroadCache.keys().next().value);
  const ttl = result.valid ? GUMROAD_CACHE_VALID_MS : GUMROAD_CACHE_INVALID_MS;
  gumroadCache.set(key, { result, until: now + ttl });
  return result;
}

/** Test hook: forget cached Gumroad answers. */
export function clearGumroadCache() {
  gumroadCache.clear();
}

// Remote paywall switch. Driven entirely by wrangler vars so the owner can
// turn paid Pro on/off (and set the grandfather window) without shipping a
// new Chrome Web Store release. Defaults are "paywall off".
//   PAYWALL_ENABLED       "true" to enforce licenses; anything else = off
//   GRANDFATHER_UNTIL     ISO date; early adopters keep Pro until then ("" = none)
//   CHECKOUT_URL_MONTHLY / CHECKOUT_URL_ANNUAL / CHECKOUT_URL_LIFETIME
export function buildConfig(env = {}) {
  const paywallEnabled = String(env.PAYWALL_ENABLED || '').trim().toLowerCase() === 'true';

  let grandfatherUntil = null;
  const rawGrandfather = String(env.GRANDFATHER_UNTIL || '').trim();
  if (rawGrandfather) {
    const t = Date.parse(rawGrandfather);
    if (!Number.isNaN(t)) grandfatherUntil = new Date(t).toISOString();
  }

  const monthly = String(env.CHECKOUT_URL_MONTHLY || '').trim();
  const annual = String(env.CHECKOUT_URL_ANNUAL || '').trim();
  const lifetime = String(env.CHECKOUT_URL_LIFETIME || '').trim();
  const checkoutUrls = monthly || annual || lifetime
    ? { monthly: monthly || null, annual: annual || null, lifetime: lifetime || null }
    : null;

  return { paywallEnabled, grandfatherUntil, checkoutUrls };
}

async function readJson(req) {
  try { return await req.json(); } catch { return null; }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders() });

    if (url.pathname === '/__health') {
      return Response.json({
        ok: true,
        name: env.ECHOKIT_PUBLIC_NAME || 'echokit-license',
        version: '1.0.0',
        timestamp: new Date().toISOString()
      }, { headers: corsHeaders() });
    }

    if (url.pathname === '/v1/config' && (request.method === 'GET' || request.method === 'HEAD')) {
      return Response.json(buildConfig(env), {
        headers: { ...corsHeaders(), 'cache-control': 'public, max-age=3600' }
      });
    }

    if (url.pathname === '/v1/validate' && request.method === 'POST') {
      const body = await readJson(request);
      if (!body || !body.key) {
        return Response.json({ valid: false, error: 'missing key' }, { status: 400, headers: corsHeaders() });
      }
      const key = String(body.key).trim();
      if (isGumroadKey(key)) {
        const result = await verifyGumroadKey(key, env);
        // 503 when Gumroad is down, so the extension treats it as "couldn't
        // check" (keeps the user working) rather than "key rejected".
        const { unavailable, ...payload } = result;
        return Response.json(payload, { status: unavailable ? 503 : 200, headers: corsHeaders() });
      }
      const result = await verifyKey(key, env.ECHOKIT_HMAC_SECRET);
      return Response.json(result, { headers: corsHeaders() });
    }

    // Admin: issue a key. Requires Authorization: Bearer <ECHOKIT_ADMIN_TOKEN>.
    if (url.pathname === '/v1/issue' && request.method === 'POST') {
      const auth = request.headers.get('authorization') || '';
      if (!env.ECHOKIT_ADMIN_TOKEN || !timingSafeEqual(auth, `Bearer ${env.ECHOKIT_ADMIN_TOKEN}`)) {
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

    return new Response('not found', { status: 404, headers: corsHeaders() });
  }
};

// Exposed for tests
export { verifyKey, issueKey };
