// Worker tests — run with `node /app/worker/test.js`.
// Covers: issueKey + verifyKey round-trip, expiry, signature tampering.

// Polyfill `crypto.subtle` from Node's webcrypto for the worker module.
import { webcrypto } from 'crypto';
if (!globalThis.crypto) globalThis.crypto = webcrypto;

import worker, { issueKey, verifyKey, buildConfig } from './worker.js';

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

console.log(`\nPassed: ${pass}  Failed: ${fail}`);
process.exit(fail ? 1 : 0);
