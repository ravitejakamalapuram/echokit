// Worker tests — run with `node /app/worker/test.js`.
// Covers: issueKey + verifyKey round-trip, expiry, signature tampering,
// /v1/config, and Gumroad license verification (fetch mocked).

// Polyfill `crypto.subtle` from Node's webcrypto for the worker module.
import { webcrypto } from 'crypto';
if (!globalThis.crypto) globalThis.crypto = webcrypto;

import worker, {
  issueKey, verifyKey, buildConfig,
  isGumroadKey, parseGumroadProducts, evaluateGumroadPurchase, verifyGumroadKey, clearGumroadCache
} from './worker.js';

const SECRET = 'test-secret-do-not-use-in-prod';
let pass = 0, fail = 0;
const expect = (name, ok, detail = '') => {
  if (ok) { pass++; console.log(`[OK ] ${name}`); }
  else { fail++; console.log(`[FAIL] ${name}  ${detail}`); }
};

// 1. Issue + verify a PRO key for far-future expiry
const future = Math.floor(Date.now() / 1000) + 365 * 86400;
const proKey = await issueKey('PRO', future, SECRET);
expect('proKey has expected shape', /^EK-PRO-\d+-[a-f0-9]{16}$/.test(proKey), proKey);
const v1 = await verifyKey(proKey, SECRET);
expect('PRO key validates', v1.valid && v1.plan === 'PRO' && v1.expiresAt === future, JSON.stringify(v1));

// 2. LTD key (expiresAt = 0 → never expires)
const ltdKey = await issueKey('LTD', 0, SECRET);
const v2 = await verifyKey(ltdKey, SECRET);
expect('LTD key validates with null expiry', v2.valid && v2.plan === 'LTD' && v2.expiresAt === null, JSON.stringify(v2));

// 3. Expired key
const past = Math.floor(Date.now() / 1000) - 60;
const expiredKey = await issueKey('YEAR', past, SECRET);
const v3 = await verifyKey(expiredKey, SECRET);
expect('expired key rejected', !v3.valid && v3.error === 'expired', JSON.stringify(v3));

// 4. Tampered signature
const tampered = proKey.slice(0, -4) + '0000';
const v4 = await verifyKey(tampered, SECRET);
expect('tampered signature rejected', !v4.valid && v4.error === 'invalid signature', JSON.stringify(v4));

// 5. Unknown plan
const v5 = await verifyKey('EK-FREE-9999999999-' + 'a'.repeat(16), SECRET);
expect('unknown plan rejected', !v5.valid && /unknown plan/.test(v5.error), JSON.stringify(v5));

// 6. Wrong secret rejects
const v6 = await verifyKey(proKey, SECRET + 'x');
expect('wrong secret rejects key', !v6.valid && v6.error === 'invalid signature', JSON.stringify(v6));

// 7. Malformed key
const v7 = await verifyKey('not-a-key', SECRET);
expect('malformed key rejected', !v7.valid && v7.error === 'malformed key', JSON.stringify(v7));

// 8. /v1/config defaults to paywall off
const c1 = buildConfig({});
expect('config defaults to paywall off', c1.paywallEnabled === false && c1.grandfatherUntil === null && c1.checkoutUrls === null, JSON.stringify(c1));

// 9. /v1/config reads vars
const c2 = buildConfig({
  PAYWALL_ENABLED: 'true',
  GRANDFATHER_UNTIL: '2026-12-31',
  CHECKOUT_URL_MONTHLY: 'https://pay.example/m',
  CHECKOUT_URL_LIFETIME: 'https://pay.example/l'
});
expect('config reads PAYWALL_ENABLED/GRANDFATHER_UNTIL/checkout vars',
  c2.paywallEnabled === true && c2.grandfatherUntil === '2026-12-31T00:00:00.000Z' &&
  c2.checkoutUrls.monthly === 'https://pay.example/m' && c2.checkoutUrls.annual === null &&
  c2.checkoutUrls.lifetime === 'https://pay.example/l', JSON.stringify(c2));

// 10. Only the literal "true" enables the paywall; bad dates are ignored
const c3 = buildConfig({ PAYWALL_ENABLED: 'yes', GRANDFATHER_UNTIL: 'not-a-date' });
expect('non-"true" PAYWALL_ENABLED stays off, invalid date → null', c3.paywallEnabled === false && c3.grandfatherUntil === null, JSON.stringify(c3));

// 11. GET /v1/config over the fetch handler: JSON + cache + CORS headers
const r11 = await worker.fetch(new Request('https://api.example/v1/config'), { PAYWALL_ENABLED: 'false' });
const j11 = await r11.json();
expect('GET /v1/config returns 200 JSON with paywall off',
  r11.status === 200 && j11.paywallEnabled === false && 'grandfatherUntil' in j11 && 'checkoutUrls' in j11, JSON.stringify(j11));
expect('GET /v1/config sets cache-control and CORS',
  r11.headers.get('cache-control') === 'public, max-age=3600' && r11.headers.get('access-control-allow-origin') === '*',
  `${r11.headers.get('cache-control')} / ${r11.headers.get('access-control-allow-origin')}`);

// 12. POST /v1/config is not routed
const r12 = await worker.fetch(new Request('https://api.example/v1/config', { method: 'POST' }), {});
expect('POST /v1/config → 404', r12.status === 404, String(r12.status));

// ---------- Gumroad licenses ----------
const MEMBERSHIP_ID = 'memb3rsh1pID==';
const LIFETIME_ID = 'l1fet1meID==';
const GENV = { GUMROAD_PRODUCT_IDS: JSON.stringify({ [MEMBERSHIP_ID]: 'MEMBERSHIP', [LIFETIME_ID]: 'LTD' }) };
const GKEY = '6F0E4C97-B72A4E69-A11BF6C4-AF6517E7';

const purchase = (over = {}) => ({
  refunded: false, chargebacked: false, disputed: false, dispute_won: false,
  subscription_ended_at: null, subscription_cancelled_at: null, subscription_failed_at: null,
  recurrence: 'monthly', ...over
});
// Mock Gumroad: `owned` maps product_id → purchase for GKEY. Records calls.
function mockGumroad(owned, { status } = {}) {
  const calls = [];
  const fn = async (url, init) => {
    const form = new URLSearchParams(init.body);
    calls.push({ url, product_id: form.get('product_id'), license_key: form.get('license_key'), increment: form.get('increment_uses_count') });
    if (status) return new Response('{}', { status });
    const p = form.get('license_key') === GKEY ? owned[form.get('product_id')] : null;
    return p
      ? Response.json({ success: true, uses: 0, purchase: p })
      : Response.json({ success: false, message: 'That license does not exist for the provided product.' }, { status: 404 });
  };
  fn.calls = calls;
  return fn;
}

expect('isGumroadKey accepts Gumroad format (any case)', isGumroadKey(GKEY) && isGumroadKey(GKEY.toLowerCase()));
expect('isGumroadKey rejects EK-* and junk', !isGumroadKey(proKey) && !isGumroadKey('not-a-key') && !isGumroadKey(null));

const pj = parseGumroadProducts(GENV.GUMROAD_PRODUCT_IDS);
expect('parseGumroadProducts reads JSON', pj.length === 2 && pj[0].id === MEMBERSHIP_ID && pj[0].plan === 'MEMBERSHIP' && pj[1].plan === 'LTD', JSON.stringify(pj));
const pc = parseGumroadProducts('abc==:membership, def=:LTD, bad:FREE, :PRO');
expect('parseGumroadProducts reads comma list (ids ending in =) and drops bad plans',
  pc.length === 2 && pc[0].id === 'abc==' && pc[0].plan === 'MEMBERSHIP' && pc[1].id === 'def=' && pc[1].plan === 'LTD', JSON.stringify(pc));
expect('parseGumroadProducts: empty / broken JSON → []', parseGumroadProducts('').length === 0 && parseGumroadProducts('{oops').length === 0);

expect('evaluateGumroadPurchase: yearly membership → YEAR',
  evaluateGumroadPurchase({ success: true, purchase: purchase({ recurrence: 'yearly' }) }, 'MEMBERSHIP').plan === 'YEAR');
expect('evaluateGumroadPurchase: failed subscription payment → invalid',
  evaluateGumroadPurchase({ success: true, purchase: purchase({ subscription_failed_at: '2026-09-01T00:00:00Z' }) }, 'MEMBERSHIP').valid === false);
expect('evaluateGumroadPurchase: chargeback → invalid',
  evaluateGumroadPurchase({ success: true, purchase: purchase({ chargebacked: true }) }, 'LTD').error === 'chargebacked');

// Valid monthly membership
clearGumroadCache();
let gf = mockGumroad({ [MEMBERSHIP_ID]: purchase() });
let g1 = await verifyGumroadKey(GKEY, GENV, { fetchFn: gf });
expect('Gumroad: valid monthly membership → PRO', g1.valid && g1.plan === 'PRO' && g1.source === 'gumroad', JSON.stringify(g1));
expect('Gumroad: sends product_id, license_key, increment_uses_count=false',
  gf.calls[0].url === 'https://api.gumroad.com/v2/licenses/verify' && gf.calls[0].product_id === MEMBERSHIP_ID &&
  gf.calls[0].license_key === GKEY && gf.calls[0].increment === 'false', JSON.stringify(gf.calls[0]));
const g1b = await verifyGumroadKey(GKEY, GENV, { fetchFn: gf });
expect('Gumroad: second check served from cache', g1b.valid && gf.calls.length === 1, String(gf.calls.length));

// Valid lifetime (tries membership first, then lifetime)
clearGumroadCache();
gf = mockGumroad({ [LIFETIME_ID]: purchase({ recurrence: null }) });
const g2 = await verifyGumroadKey(GKEY.toLowerCase(), GENV, { fetchFn: gf });
expect('Gumroad: lifetime key → LTD (lower-case input normalised)', g2.valid && g2.plan === 'LTD' && gf.calls.length === 2, JSON.stringify(g2));

// Refunded
clearGumroadCache();
gf = mockGumroad({ [LIFETIME_ID]: purchase({ refunded: true }) });
const g3 = await verifyGumroadKey(GKEY, GENV, { fetchFn: gf });
expect('Gumroad: refunded purchase rejected', !g3.valid && g3.error === 'refunded', JSON.stringify(g3));

// Cancelled subscription
clearGumroadCache();
gf = mockGumroad({ [MEMBERSHIP_ID]: purchase({ subscription_cancelled_at: '2026-09-01T00:00:00Z' }) });
const g4 = await verifyGumroadKey(GKEY, GENV, { fetchFn: gf });
expect('Gumroad: cancelled subscription rejected', !g4.valid && g4.error === 'subscription cancelled', JSON.stringify(g4));

// Cancelled membership but also owns lifetime → still valid
clearGumroadCache();
gf = mockGumroad({ [MEMBERSHIP_ID]: purchase({ subscription_ended_at: '2026-09-01T00:00:00Z' }), [LIFETIME_ID]: purchase() });
const g5 = await verifyGumroadKey(GKEY, GENV, { fetchFn: gf });
expect('Gumroad: ended membership + lifetime → LTD', g5.valid && g5.plan === 'LTD', JSON.stringify(g5));

// Unknown key
clearGumroadCache();
gf = mockGumroad({});
const g6 = await verifyGumroadKey('AAAAAAAA-BBBBBBBB-CCCCCCCC-DDDDDDDD', GENV, { fetchFn: gf });
expect('Gumroad: unknown key rejected after trying every product', !g6.valid && g6.error === 'unknown license key' && gf.calls.length === 2, JSON.stringify(g6));

// Gumroad down → unavailable, not cached
clearGumroadCache();
gf = mockGumroad({}, { status: 502 });
const g7 = await verifyGumroadKey(GKEY, GENV, { fetchFn: gf });
expect('Gumroad: 5xx → unavailable', !g7.valid && g7.unavailable === true, JSON.stringify(g7));
const netErr = async () => { throw new Error('network down'); };
clearGumroadCache();
const g7b = await verifyGumroadKey(GKEY, GENV, { fetchFn: netErr });
expect('Gumroad: network error → unavailable', g7b.unavailable === true, JSON.stringify(g7b));

// Not configured
clearGumroadCache();
const g8 = await verifyGumroadKey(GKEY, {}, { fetchFn: mockGumroad({}) });
expect('Gumroad: no GUMROAD_PRODUCT_IDS → not configured', !g8.valid && /not configured/.test(g8.error), JSON.stringify(g8));

// /v1/validate routes Gumroad keys through Gumroad (global fetch mocked)
const realFetch = globalThis.fetch;
try {
  clearGumroadCache();
  globalThis.fetch = mockGumroad({ [MEMBERSHIP_ID]: purchase({ recurrence: 'yearly' }) });
  const r13 = await worker.fetch(new Request('https://api.example/v1/validate', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ key: GKEY })
  }), { ...GENV, ECHOKIT_HMAC_SECRET: SECRET });
  const j13 = await r13.json();
  expect('POST /v1/validate: Gumroad yearly key → valid YEAR', r13.status === 200 && j13.valid && j13.plan === 'YEAR', JSON.stringify(j13));

  clearGumroadCache();
  globalThis.fetch = mockGumroad({}, { status: 503 });
  const r14 = await worker.fetch(new Request('https://api.example/v1/validate', {
    method: 'POST', body: JSON.stringify({ key: GKEY })
  }), GENV);
  const j14 = await r14.json();
  expect('POST /v1/validate: Gumroad down → 503 without internal flag', r14.status === 503 && !j14.valid && !('unavailable' in j14), `${r14.status} ${JSON.stringify(j14)}`);

  globalThis.fetch = async () => { throw new Error('must not call Gumroad for EK keys'); };
  const r15 = await worker.fetch(new Request('https://api.example/v1/validate', {
    method: 'POST', body: JSON.stringify({ key: proKey })
  }), { ...GENV, ECHOKIT_HMAC_SECRET: SECRET });
  const j15 = await r15.json();
  expect('POST /v1/validate: legacy EK key still verified via HMAC', j15.valid && j15.plan === 'PRO', JSON.stringify(j15));
} finally {
  globalThis.fetch = realFetch;
}

console.log(`\nPassed: ${pass}  Failed: ${fail}`);
process.exit(fail ? 1 : 0);
