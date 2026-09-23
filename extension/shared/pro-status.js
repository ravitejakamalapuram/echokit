// EchoKit — Pro status resolution with a remote paywall switch.
//
// The license worker serves GET /v1/config:
//   { paywallEnabled: boolean, grandfatherUntil: ISO string | null,
//     checkoutUrls: { monthly, annual, lifetime } | null }
// so the owner can turn paid Pro on (and set a grandfather window for early
// adopters) by redeploying the worker — no Chrome Web Store release needed.
//
// Fail-open by design: if the config can't be fetched and nothing is cached,
// the paywall is treated as OFF so an outage never locks users out.
//
// Everything here takes its dependencies (storage areas, fetch, clock) as
// arguments so it can be unit-tested in Node without a chrome.* runtime.

export const PAYWALL_CONFIG_CACHE_KEY = 'echokit_paywall_config';
export const PAYWALL_CONFIG_TTL_MS = 6 * 60 * 60 * 1000;
export const PAYWALL_CONFIG_TIMEOUT_MS = 5000;
// After a failed fetch, don't retry for this long (keeps offline / slow
// networks from paying the fetch timeout on every recorded request).
export const PAYWALL_CONFIG_RETRY_MS = 10 * 60 * 1000;
export const INSTALLED_AT_KEY = 'installedAt';
export const EARLY_ADOPTER_KEY = 'earlyAdopter';
export const TRIAL_EXPIRY_KEY = 'echokit_trial_expiry';
export const LICENSE_KEY = 'echokit_license';

const DEFAULT_CONFIG = Object.freeze({
  paywallEnabled: false,
  grandfatherUntil: null,
  checkoutUrls: null
});

/** Coerce an untrusted /v1/config payload into a safe config object. */
export function normalizeConfig(raw) {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_CONFIG };
  const grandfatherUntil = typeof raw.grandfatherUntil === 'string' && !Number.isNaN(Date.parse(raw.grandfatherUntil))
    ? raw.grandfatherUntil
    : null;
  let checkoutUrls = null;
  if (raw.checkoutUrls && typeof raw.checkoutUrls === 'object') {
    const pick = v => (typeof v === 'string' && /^https:\/\//.test(v) ? v : null);
    checkoutUrls = {
      monthly: pick(raw.checkoutUrls.monthly),
      annual: pick(raw.checkoutUrls.annual),
      lifetime: pick(raw.checkoutUrls.lifetime)
    };
  }
  return {
    // Strict `=== true`: anything unexpected keeps the paywall off.
    paywallEnabled: raw.paywallEnabled === true,
    grandfatherUntil,
    checkoutUrls
  };
}

/**
 * Read the paywall config: fresh cache → network → stale cache → default (off).
 * A failed fetch is remembered for PAYWALL_CONFIG_RETRY_MS before retrying.
 * @param {{ localStorage: chrome.storage.StorageArea, fetchFn: typeof fetch, endpoint: string, now?: number }} deps
 */
export async function getPaywallConfig({ localStorage, fetchFn, endpoint, now = Date.now() }) {
  let cached = null;
  try {
    cached = (await localStorage.get(PAYWALL_CONFIG_CACHE_KEY))[PAYWALL_CONFIG_CACHE_KEY] || null;
  } catch {}
  if (cached && typeof cached.ts === 'number') {
    const freshUntil = typeof cached.nextFetchAt === 'number' ? cached.nextFetchAt : cached.ts + PAYWALL_CONFIG_TTL_MS;
    if (now < freshUntil) return normalizeConfig(cached.config);
  }

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutId = controller ? setTimeout(() => controller.abort(), PAYWALL_CONFIG_TIMEOUT_MS) : null;
  try {
    const r = await fetchFn(String(endpoint).replace(/\/$/, '') + '/v1/config', {
      method: 'GET',
      signal: controller ? controller.signal : undefined
    });
    if (!r || !r.ok) throw new Error(`http ${r && r.status}`);
    const config = normalizeConfig(await r.json());
    try {
      await localStorage.set({
        [PAYWALL_CONFIG_CACHE_KEY]: { config, ts: now, nextFetchAt: now + PAYWALL_CONFIG_TTL_MS }
      });
    } catch {}
    return config;
  } catch {
    // Network / parse failure: stale cache if we have one, else paywall off.
    // Remember the failure so we back off instead of refetching every call.
    const config = cached && cached.config ? normalizeConfig(cached.config) : { ...DEFAULT_CONFIG };
    try {
      await localStorage.set({
        [PAYWALL_CONFIG_CACHE_KEY]: {
          config,
          ts: cached && typeof cached.ts === 'number' ? cached.ts : 0,
          nextFetchAt: now + PAYWALL_CONFIG_RETRY_MS
        }
      });
    } catch {}
    return config;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

/**
 * Resolve the user's Pro status.
 *
 * Always returns { pro, trial, trialDaysLeft, reason } (the historical shape
 * plus `reason`); `paywallEnabled`, `checkoutUrls` and `grandfatherUntil` are
 * optional extras for UI that wants them.
 *
 * reason: 'free-period' | 'license' | 'grandfathered' | 'trial' | 'none'
 */
export async function computeProStatus({
  localStorage,
  syncStorage,
  fetchFn,
  endpoint,
  isLicenseValid,
  now = Date.now()
}) {
  const config = await getPaywallConfig({ localStorage, fetchFn, endpoint, now });
  const extras = {
    paywallEnabled: config.paywallEnabled,
    checkoutUrls: config.checkoutUrls,
    grandfatherUntil: config.grandfatherUntil
  };

  let local = {};
  try {
    local = (await localStorage.get([EARLY_ADOPTER_KEY, INSTALLED_AT_KEY])) || {};
  } catch {}

  if (!config.paywallEnabled) {
    // Anyone who uses EchoKit while Pro is free is an early adopter, so the
    // grandfather window also covers people who install after this release
    // but before the paywall is switched on.
    if (local[EARLY_ADOPTER_KEY] !== true) {
      try {
        await localStorage.set({ [EARLY_ADOPTER_KEY]: true });
      } catch {}
    }
    return { pro: true, trial: false, trialDaysLeft: 0, reason: 'free-period', ...extras };
  }

  let sync = {};
  try {
    sync = (await syncStorage.get([LICENSE_KEY, TRIAL_EXPIRY_KEY])) || {};
  } catch {}

  const key = sync[LICENSE_KEY] || '';
  if (key && (await isLicenseValid(key))) {
    return { pro: true, trial: false, trialDaysLeft: 0, reason: 'license', ...extras };
  }

  const grandfatherTs = config.grandfatherUntil ? Date.parse(config.grandfatherUntil) : NaN;
  if (local[EARLY_ADOPTER_KEY] === true && Number.isFinite(grandfatherTs) && now < grandfatherTs) {
    return { pro: true, trial: false, trialDaysLeft: 0, reason: 'grandfathered', ...extras };
  }

  const expiry = Number(sync[TRIAL_EXPIRY_KEY]) || 0;
  if (expiry > now) {
    const trialDaysLeft = Math.ceil((expiry - now) / 86400000);
    return { pro: true, trial: true, trialDaysLeft, reason: 'trial', ...extras };
  }

  return { pro: false, trial: false, trialDaysLeft: 0, reason: 'none', ...extras };
}

/**
 * chrome.runtime.onInstalled bookkeeping.
 * - 'install': record installedAt, earlyAdopter false.
 * - 'update' with no installedAt: an existing user from the free period →
 *   earlyAdopter true, installedAt now.
 */
export async function recordInstall(reason, localStorage, now = Date.now()) {
  if (reason === 'install') {
    await localStorage.set({ [INSTALLED_AT_KEY]: now, [EARLY_ADOPTER_KEY]: false });
    return;
  }
  if (reason === 'update') {
    const existing = (await localStorage.get(INSTALLED_AT_KEY)) || {};
    if (existing[INSTALLED_AT_KEY] == null) {
      await localStorage.set({ [INSTALLED_AT_KEY]: now, [EARLY_ADOPTER_KEY]: true });
    }
  }
}
