// Unit tests for the remote paywall switch (extension/shared/pro-status.js).
// Run with: node tests/test-pro-status.js
import assert from 'assert';
import {
  computeProStatus, getPaywallConfig, recordInstall,
  PAYWALL_CONFIG_CACHE_KEY, PAYWALL_CONFIG_TTL_MS
} from '../extension/shared/pro-status.js';

// Minimal chrome.storage.StorageArea fake.
function fakeArea(initial = {}) {
  const data = { ...initial };
  return {
    data,
    async get(keys) {
      if (keys == null) return { ...data };
      const list = Array.isArray(keys) ? keys : [keys];
      const out = {};
      for (const k of list) if (k in data) out[k] = data[k];
      return out;
    },
    async set(obj) { Object.assign(data, obj); },
    async remove(k) { delete data[k]; }
  };
}

// fetch fake returning a config (or failing).
function fakeFetch(config, { fail = false } = {}) {
  const fn = async (url) => {
    fn.calls.push(url);
    if (fail) throw new Error('network down');
    return { ok: true, status: 200, json: async () => config };
  };
  fn.calls = [];
  return fn;
}

const NOW = Date.parse('2026-10-01T00:00:00Z');
const ENDPOINT = 'https://license.example';
const validLicense = async key => key === 'EK-PRO-good';

function deps(overrides = {}) {
  return {
    localStorage: fakeArea(),
    syncStorage: fakeArea(),
    fetchFn: fakeFetch({ paywallEnabled: false, grandfatherUntil: null, checkoutUrls: null }),
    endpoint: ENDPOINT,
    isLicenseValid: validLicense,
    now: NOW,
    ...overrides
  };
}

let passed = 0;
let failed = 0;
async function test(name, fn) {
  try {
    await fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (e) {
    console.error(`❌ ${name}`);
    console.error(`   ${e.message}`);
    failed++;
  }
}

console.log('Running pro-status tests...\n');

await test('paywall off → pro (free-period)', async () => {
  const d = deps();
  const s = await computeProStatus(d);
  assert.strictEqual(s.pro, true);
  assert.strictEqual(s.reason, 'free-period');
  assert.strictEqual(s.trial, false);
  assert.strictEqual(s.trialDaysLeft, 0);
  assert.strictEqual(d.fetchFn.calls[0], ENDPOINT + '/v1/config');
});

await test('paywall off marks the user as an early adopter', async () => {
  const d = deps({ localStorage: fakeArea({ earlyAdopter: false }) });
  await computeProStatus(d);
  assert.strictEqual(d.localStorage.data.earlyAdopter, true);
});

await test('paywall on + valid license → pro (license)', async () => {
  const d = deps({
    fetchFn: fakeFetch({ paywallEnabled: true, grandfatherUntil: null, checkoutUrls: null }),
    syncStorage: fakeArea({ echokit_license: 'EK-PRO-good' })
  });
  const s = await computeProStatus(d);
  assert.strictEqual(s.pro, true);
  assert.strictEqual(s.reason, 'license');
  assert.strictEqual(s.paywallEnabled, true);
});

await test('paywall on + early adopter before grandfatherUntil → pro (grandfathered)', async () => {
  const d = deps({
    fetchFn: fakeFetch({ paywallEnabled: true, grandfatherUntil: '2026-12-01T00:00:00Z', checkoutUrls: null }),
    localStorage: fakeArea({ earlyAdopter: true, installedAt: NOW - 86400000 })
  });
  const s = await computeProStatus(d);
  assert.strictEqual(s.pro, true);
  assert.strictEqual(s.reason, 'grandfathered');
});

await test('paywall on + early adopter after grandfatherUntil → not pro', async () => {
  const d = deps({
    fetchFn: fakeFetch({ paywallEnabled: true, grandfatherUntil: '2026-09-01T00:00:00Z', checkoutUrls: null }),
    localStorage: fakeArea({ earlyAdopter: true })
  });
  const s = await computeProStatus(d);
  assert.strictEqual(s.pro, false);
});

await test('paywall on + no license + not early adopter → not pro', async () => {
  const checkoutUrls = { monthly: 'https://pay.example/m', annual: null, lifetime: null };
  const d = deps({
    fetchFn: fakeFetch({ paywallEnabled: true, grandfatherUntil: '2026-12-01T00:00:00Z', checkoutUrls }),
    localStorage: fakeArea({ earlyAdopter: false }),
    syncStorage: fakeArea({ echokit_license: 'EK-PRO-bad' })
  });
  const s = await computeProStatus(d);
  assert.strictEqual(s.pro, false);
  assert.strictEqual(s.reason, 'none');
  assert.strictEqual(s.trial, false);
  assert.deepStrictEqual(s.checkoutUrls, checkoutUrls);
});

await test('paywall on + active trial → pro (trial) with days left', async () => {
  const d = deps({
    fetchFn: fakeFetch({ paywallEnabled: true, grandfatherUntil: null, checkoutUrls: null }),
    syncStorage: fakeArea({ echokit_trial_expiry: NOW + 3 * 86400000 })
  });
  const s = await computeProStatus(d);
  assert.strictEqual(s.pro, true);
  assert.strictEqual(s.trial, true);
  assert.strictEqual(s.trialDaysLeft, 3);
});

await test('config fetch failure with no cache → pro (fail open)', async () => {
  const d = deps({ fetchFn: fakeFetch(null, { fail: true }) });
  const s = await computeProStatus(d);
  assert.strictEqual(s.pro, true);
  assert.strictEqual(s.reason, 'free-period');
});

await test('config fetch failure uses stale cached config', async () => {
  const localStorage = fakeArea({
    [PAYWALL_CONFIG_CACHE_KEY]: {
      config: { paywallEnabled: true, grandfatherUntil: null, checkoutUrls: null },
      ts: NOW - PAYWALL_CONFIG_TTL_MS - 1
    }
  });
  const d = deps({ localStorage, fetchFn: fakeFetch(null, { fail: true }) });
  const s = await computeProStatus(d);
  assert.strictEqual(s.pro, false);
  assert.strictEqual(d.fetchFn.calls.length, 1);
});

await test('fresh cached config is used without a network call', async () => {
  const localStorage = fakeArea({
    [PAYWALL_CONFIG_CACHE_KEY]: {
      config: { paywallEnabled: false, grandfatherUntil: null, checkoutUrls: null },
      ts: NOW - 60000
    }
  });
  const fetchFn = fakeFetch({ paywallEnabled: true });
  const cfg = await getPaywallConfig({ localStorage, fetchFn, endpoint: ENDPOINT, now: NOW });
  assert.strictEqual(cfg.paywallEnabled, false);
  assert.strictEqual(fetchFn.calls.length, 0);
});

await test('failed fetch backs off instead of refetching every call', async () => {
  const localStorage = fakeArea();
  const fetchFn = fakeFetch(null, { fail: true });
  await getPaywallConfig({ localStorage, fetchFn, endpoint: ENDPOINT, now: NOW });
  await getPaywallConfig({ localStorage, fetchFn, endpoint: ENDPOINT, now: NOW + 1000 });
  assert.strictEqual(fetchFn.calls.length, 1);
});

await test('non-boolean paywallEnabled is treated as off', async () => {
  const d = deps({ fetchFn: fakeFetch({ paywallEnabled: 'true' }) });
  const s = await computeProStatus(d);
  assert.strictEqual(s.pro, true);
  assert.strictEqual(s.reason, 'free-period');
});

await test('recordInstall: install → installedAt, earlyAdopter false', async () => {
  const area = fakeArea();
  await recordInstall('install', area, NOW);
  assert.strictEqual(area.data.installedAt, NOW);
  assert.strictEqual(area.data.earlyAdopter, false);
});

await test('recordInstall: update without installedAt → early adopter', async () => {
  const area = fakeArea();
  await recordInstall('update', area, NOW);
  assert.strictEqual(area.data.installedAt, NOW);
  assert.strictEqual(area.data.earlyAdopter, true);
});

await test('recordInstall: update with installedAt → unchanged', async () => {
  const area = fakeArea({ installedAt: 123, earlyAdopter: false });
  await recordInstall('update', area, NOW);
  assert.strictEqual(area.data.installedAt, 123);
  assert.strictEqual(area.data.earlyAdopter, false);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
