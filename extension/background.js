// EchoKit — Background service worker.
// Adds in v1.2: GraphQL match mode, URL blocklist, localStorage copy/paste bridge, onboarding welcome tab.
// v1.6.0: API Source Visibility with badges and filters

// Set to true locally to see CORS / rule installation diagnostics in the SW console.
// Must be false in production builds (verbose logging has a measurable overhead in SW).
const DEBUG = false;
/** @type {(...args: unknown[]) => void} */
// eslint-disable-next-line no-console
const dbg = DEBUG ? console.log.bind(console) : () => {};
import { computeMatchKeys } from './shared/matcher.js';
import {
  putInteraction, getInteraction, deleteInteraction, getAllInteractions,
  clearAllInteractions, getMeta, setMeta
} from './shared/store.js';
const SESSION_KEY = 'echokit_tab_state';
const SETTINGS_KEY = 'echokit_settings';
const CORS_RULESET_ID = 1001;
const BLOCKLIST_RULESET_BASE = 2000; // rules 2000..2099 reserved for blocklist

const tabState = new Map();
// Default settings. 'domain' scope is the documented default (matches app.js).
// NOTE: any change here must also be reflected in the default state in shared/app.js.
let settings = {
  corsOverride: false,
  scope: 'domain',
  theme: 'dark',
  autoOpenOnRefresh: true,
  blocklist: [],
  rewriteRules: [],
  transformRules: [],
  requestHeaders: []
};
async function hydrate() {
  try {
    const s = await chrome.storage.session.get(SESSION_KEY);
    const raw = s[SESSION_KEY];
    if (raw && typeof raw === 'object') for (const [tid, v] of Object.entries(raw)) tabState.set(Number(tid), v);
  } catch (err) {
    // Edge case fix: Log session storage errors but don't fail hydration
    console.warn('[EchoKit] Failed to restore tab state from session storage:', err);
  }

  try {
    const stored = await getMeta(SETTINGS_KEY, null);
    if (stored) settings = {
      ...settings,
      ...stored
    };
  } catch (err) {
    // Edge case fix: Fall back to defaults if IndexedDB fails
    console.warn('[EchoKit] Failed to load settings from IndexedDB, using defaults:', err);
  }

  try {
    await applyCorsRules();
  } catch (err) {
    console.error('[EchoKit] Failed to apply CORS rules during hydration:', err);
  }

  try {
    await applyBlocklistRules();
  } catch (err) {
    console.error('[EchoKit] Failed to apply blocklist rules during hydration:', err);
  }
}
async function persistTabState() {
  try {
    const obj = {};
    for (const [k, v] of tabState.entries()) obj[k] = v;
    await chrome.storage.session.set({
      [SESSION_KEY]: obj
    });
  } catch {}
}
function getTab(tabId) {
  if (!tabState.has(tabId)) tabState.set(tabId, {
    recording: false,
    mocking: false,
    sessionId: null,
    host: ''
  });
  return tabState.get(tabId);
}
const MAX_URL_HOST_CACHE_SIZE = 1000;
const urlHostCache = new Map();

function hostOf(url) {
  if (!url) return '';
  if (urlHostCache.has(url)) return urlHostCache.get(url);
  try {
    const host = new URL(url).host;
    if (urlHostCache.size >= MAX_URL_HOST_CACHE_SIZE) {
      const firstKey = urlHostCache.keys().next().value;
      urlHostCache.delete(firstKey);
    }
    urlHostCache.set(url, host);
    return host;
  } catch {
    return '';
  }
}
function visibleInContext(interaction, ctx) {
  if (ctx.scope === 'global') return true;
  if (ctx.scope === 'tab') return interaction.tabId === ctx.tabId;
  return hostOf(interaction.tabUrl || interaction.url) === ctx.host;
}

// ---------- License key validation ----------
// Two-layer check:
//   1. Format check (offline) — accepts EK-{PLAN}-{EXPIRY?}-{SIG?} keys.
//   2. Server check via Cloudflare Worker (HMAC-SHA256) — when an endpoint is
//      configured. Result is cached in chrome.storage.local for 24h so the
//      extension keeps working offline once a key has been validated.
const LICENSE_CACHE_KEY = 'echokit_license_cache';
const _LICENSE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_LICENSE_WORKER_URL = 'https://echokit-license.echokit-rk.workers.dev';

/**
 * Determine whether a license key matches the accepted offline formats.
 *
 * @param {string|null|undefined} key - The license key to validate; may be null/undefined.
 * @returns {boolean} `true` if the key begins with `EK-PRO-`, `EK-YEAR-`, or `EK-LTD-` (case-insensitive, trimmed), `false` otherwise.
 */
function validateLicenseKey(key) {
  if (!key || typeof key !== 'string') return false;
  const k = key.trim().toUpperCase();
  // Legacy short form (EK-PRO-xxxx) and signed long form both accepted at format level.
  return /^EK-(PRO|YEAR|LTD)-/.test(k);
}

/**
 * Validate a license key against the remote license validation endpoint.
 * @param {string} key - License key to validate.
 * @returns {{ok:true, valid:boolean, plan:string|null, expiresAt:string|null, error?:string|null} | {ok:false, error:string}} Result object: on success (`ok: true`) includes `valid`, optional `plan` and `expiresAt`, and optional `error` details; on failure (`ok: false`) includes an `error` message.
 */
// Allowlist of valid license validation endpoints.
// Custom endpoints must start with one of these prefixes.
// This prevents a compromised chrome.storage.sync account from redirecting
// validation to an attacker-controlled worker.
const LICENSE_ENDPOINT_ALLOWLIST = ['https://echokit-license.echokit-rk.workers.dev', 'https://echokit-license.echokit.dev', 'http://localhost' // dev/self-hosted only
];

/**
 * Validate a license key against the remote license validation endpoint.
 * The endpoint is read from chrome.storage.sync but restricted to the allowlist
 * to prevent SSRF via a compromised sync account.
 */
async function validateLicenseRemote(key) {
  // Returns { ok: true, valid, plan, expiresAt } or { ok: false, error }.
  if (!key) return {
    ok: true,
    valid: false
  };
  let endpoint;
  try {
    const cfg = await chrome.storage.sync.get('echokit_license_endpoint');
    const stored = cfg.echokit_license_endpoint;
    // Only accept the stored endpoint if it matches the allowlist.
    if (stored && LICENSE_ENDPOINT_ALLOWLIST.some(prefix => stored.startsWith(prefix))) {
      endpoint = stored;
    } else {
      if (stored) dbg('[EchoKit license] Ignoring non-allowlisted endpoint:', stored);
      endpoint = DEFAULT_LICENSE_WORKER_URL;
    }
  } catch (e) {
    // Storage read failed - propagate error instead of falling back
    return {
      ok: false,
      error: 'storage error: ' + (e.message || e)
    };
  }

  // Add timeout to prevent hanging on slow networks
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

  try {
    const r = await fetch(endpoint.replace(/\/$/, '') + '/v1/validate', {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        key
      }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (!r.ok) return {
      ok: false,
      error: `http ${r.status}`
    };
    const j = await r.json();
    return {
      ok: true,
      valid: !!j.valid,
      plan: j.plan || null,
      expiresAt: j.expiresAt || null,
      error: j.error || null
    };
  } catch (e) {
    clearTimeout(timeoutId);
    return {
      ok: false,
      error: String(e.message || e)
    };
  }
}
// NOTE: isLicenseValid() function temporarily disabled during free access period
// See the commented version below after getProStatus() - will be restored with LemonSqueezy

// Checks license key OR active trial. Returns { pro, trial, trialDaysLeft }.
async function getProStatus() {
  // TODO: Temporary free access during LemonSqueezy payment integration
  // This bypasses license validation and grants Pro access to all users.
  // REVERT THIS once LemonSqueezy integration is complete and payment flow is live.
  // Expected completion: When LemonSqueezy merchant verification completes
  // Original implementation: Check git history for license validation logic
  return {
    pro: true,
    trial: false,
    trialDaysLeft: 0
  };
}

// NOTE: isLicenseValid() function temporarily unused during free access period
// The function below will be re-enabled when license validation is restored
/* TEMPORARILY DISABLED - Will be restored with LemonSqueezy integration
async function isLicenseValid(key) {
  // Format gate first — short-circuits for empty / obviously bad keys.
  if (!validateLicenseKey(key)) return false;

  // Try cached server result.
  try {
    const cached = (await chrome.storage.local.get(LICENSE_CACHE_KEY))[LICENSE_CACHE_KEY];
    if (cached && cached.key === key && Date.now() - cached.ts < _LICENSE_CACHE_TTL_MS) {
      return !!cached.valid;
    }
  } catch {}

  // Hit the Worker if configured.
  const remote = await validateLicenseRemote(key);
  if (remote.ok) {
    try {
      await chrome.storage.local.set({
        [LICENSE_CACHE_KEY]: {
          key,
          valid: remote.valid,
          plan: remote.plan,
          expiresAt: remote.expiresAt,
          ts: Date.now()
        }
      });
    } catch {}
    return !!remote.valid;
  }

  // Worker unreachable — fall back to format-only validation so users keep
  // working offline / on flaky networks. Cache a short-lived "tentative"
  // result so we retry on the next call.
  //
  // SECURITY NOTE: This means any string matching `EK-{PRO|YEAR|LTD}-*` will
  // pass as a valid Pro key while the validation worker is down. This is an
  // intentional UX trade-off (better to let real customers keep working than
  // to lock everyone out during an outage). The HMAC server check runs again
  // on the next extension restart / after the 24h cache expires.
  return true;
}
END TEMPORARILY DISABLED */
function buildMockIndexFor(interactions, ctx) {
  const index = {
    strict: {},
    'ignore-query': {},
    'ignore-body': {},
    'path-wildcard': {},
    graphql: {},
    'graphql-op': {}
  };
  // blockedKeys: same per-mode shape but only contains keys that are unconditionally blocked.
  const blockedKeys = {
    strict: {},
    'ignore-query': {},
    'ignore-body': {},
    'path-wildcard': {},
    graphql: {},
    'graphql-op': {}
  };
  for (const it of interactions) {
    if (!visibleInContext(it, ctx)) continue;
    const mode = it.matchMode || 'strict';
    const keys = it.matchKeys || {
      strict: it.hash
    };
    const key = keys[mode] || keys.strict;
    if (!key) continue;
    if (it.blocked) {
      const b = blockedKeys[mode] || (blockedKeys[mode] = {});
      b[key] = true;
    }
    if (!it.mockEnabled) continue;
    // Skip if conditional mock has hit its limit
    if (it.mockMaxCount != null && (it.mockCallCount || 0) >= it.mockMaxCount) continue;
    const bucket = index[mode] || (index[mode] = {});
    if (!bucket[key]) bucket[key] = [];
    // Resolve mock chain: pick current chain step if chain is defined
    let chainStep = null;
    if (it.mockChain && it.mockChain.length > 0) {
      const idx = it.mockChainLoop !== false ? (it.mockChainCursor || 0) % it.mockChain.length : Math.min(it.mockChainCursor || 0, it.mockChain.length - 1);
      chainStep = it.mockChain[idx];
    }
    bucket[key].push({
      id: it.id,
      status: chainStep?.status ?? (it.overrideStatus != null ? it.overrideStatus : it.responseStatus),
      body: chainStep?.body ?? (it.overrideBody != null ? it.overrideBody : it.responseBody),
      headers: chainStep?.headers ?? (it.overrideHeaders || it.responseHeaders || {}),
      latency: it.mockLatency || 0,
      errorMode: it.mockErrorMode || 'none',
      timestamp: it.timestamp,
      activeVersionId: it.activeVersionId || null,
      method: it.method,
      wsLoop: it.wsLoop || false,
      mockMaxCount: it.mockMaxCount || null,
      mockCallCount: it.mockCallCount || 0,
      hasChain: !!(it.mockChain && it.mockChain.length > 0),
      mockChainLen: it.mockChain ? it.mockChain.length : 0,
      mockChainCursor: it.mockChainCursor || 0
    });
  }
  for (const m of Object.keys(index)) for (const k of Object.keys(index[m])) index[m][k].sort((a, b) => b.timestamp - a.timestamp);
  return {
    index,
    blockedKeys
  };
}

/**
 * Push current tab state + mock index to a single tab.
 * Pass a pre-loaded interactions array when calling from pushAllTabs to avoid
 * an IDB scan per tab (N×getAllInteractions problem).
 *
 * @param {number} tabId
 * @param {Array|null} [cachedInteractions] - Pre-loaded interactions, or null to load fresh.
 */
// Edge case fix: Track in-flight pushes to prevent race conditions
const pushInFlight = new Map(); // tabId -> Promise

async function pushTabMeta(tabId, cachedInteractions = null) {
  // Edge case fix: Debounce concurrent pushes for the same tab
  if (pushInFlight.has(tabId)) {
    dbg('[EchoKit] Push already in flight for tab', tabId, '— waiting');
    await pushInFlight.get(tabId);
    return;
  }

  const pushPromise = (async () => {
    try {
      const st = getTab(tabId);
      let tab;
      try {
        tab = await chrome.tabs.get(tabId);
      } catch {
        return;
      }
      if (!tab) return;
      st.host = hostOf(tab.url || '');
      const ctx = {
        tabId,
        host: st.host,
        scope: settings.scope
      };
      // Use the caller-supplied snapshot if available; otherwise load from IDB.
      const all = cachedInteractions ?? (await getAllInteractions());
      const {
        index,
        blockedKeys
      } = buildMockIndexFor(all, ctx);
      safeSend(tabId, {
        type: 'echokit:tabState',
        payload: {
          ...st,
          corsOverride: settings.corsOverride,
          scope: settings.scope,
          blocklist: settings.blocklist,
          rewriteRules: settings.rewriteRules || [],
          transformRules: settings.transformRules || [],
          requestHeaders: settings.requestHeaders || []
        }
      });
      safeSend(tabId, {
        type: 'echokit:mockIndex',
        payload: {
          mocks: index,
          blocked: blockedKeys
        }
      });
      await updateBadge(tabId);
    } finally {
      pushInFlight.delete(tabId);
    }
  })();

  pushInFlight.set(tabId, pushPromise);
  return pushPromise;
}

/**
 * Push state to all open tabs.
 * Loads interactions ONCE and reuses the snapshot for every tab push,
 * avoiding an N×IDB scan where N is the number of open tabs.
 */
async function pushAllTabs() {
  const [tabs, interactions] = await Promise.all([chrome.tabs.query({}), getAllInteractions()]);
  for (const t of tabs) {
    if (t.id != null) pushTabMeta(t.id, interactions).catch(() => {});
  }
}
function safeSend(tabId, msg) {
  chrome.tabs.sendMessage(tabId, msg).catch(() => {});
}
async function updateBadge(tabId) {
  const st = getTab(tabId);
  try {
    if (st.recording) {
      await chrome.action.setBadgeBackgroundColor({
        color: '#ef4444',
        tabId
      });
      await chrome.action.setBadgeText({
        tabId,
        text: 'REC'
      });
    } else if (st.mocking) {
      await chrome.action.setBadgeBackgroundColor({
        color: '#fbbf24',
        tabId
      });
      await chrome.action.setBadgeText({
        tabId,
        text: 'MOCK'
      });
    } else {
      await chrome.action.setBadgeText({
        tabId,
        text: ''
      });
    }
  } catch {}
}

/**
 * Apply CORS override rules based on current scope setting.
 *
 * Scope behavior:
 * - 'global': Uses dynamic rules (browser-wide, persists across restarts)
 * - 'domain': Uses session rules with requestDomains filter (domain-specific)
 * - 'tab': Uses session rules with tabIds filter (tab-specific)
 *
 * Note: We use Access-Control-Allow-Origin: * without credentials=true
 * because these are mutually exclusive per CORS spec. For credentialed
 * requests, the server must specify an exact origin, not wildcard.
 */
// Debounce CORS rule updates to prevent rapid-fire calls during tab navigation storms
let corsUpdateTimeout = null;
let corsUpdatePending = false;

async function applyCorsRules() {
  // Edge case fix: Debounce rapid updates (e.g., many tabs navigating simultaneously)
  if (corsUpdatePending) {
    dbg('[EchoKit CORS] Update already pending, skipping duplicate call');
    return;
  }

  corsUpdatePending = true;
  try {
    // Clear existing CORS rules (both dynamic and session)
    const currentDynamic = await chrome.declarativeNetRequest.getDynamicRules();
    const corsIds = currentDynamic.filter(r => r.id === CORS_RULESET_ID).map(r => r.id);
    if (corsIds.length) {
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: corsIds
      });
      dbg('[EchoKit CORS] Removed', corsIds.length, 'dynamic CORS rule(s)');
    }
    const currentSession = await chrome.declarativeNetRequest.getSessionRules();
    const sessionCorsIds = currentSession.filter(r => r.id === CORS_RULESET_ID).map(r => r.id);
    if (sessionCorsIds.length) {
      await chrome.declarativeNetRequest.updateSessionRules({
        removeRuleIds: sessionCorsIds
      });
      dbg('[EchoKit CORS] Removed', sessionCorsIds.length, 'session CORS rule(s)');
    }

    // If CORS override is disabled, we're done
    if (!settings.corsOverride) {
      dbg('[EchoKit CORS] CORS override disabled');
      corsUpdatePending = false;
      return;
    }

    // Build the base CORS action (without credentials to avoid conflict)
    const corsAction = {
      type: 'modifyHeaders',
      responseHeaders: [{
        header: 'Access-Control-Allow-Origin',
        operation: 'set',
        value: '*'
      }, {
        header: 'Access-Control-Allow-Methods',
        operation: 'set',
        value: '*'
      }, {
        header: 'Access-Control-Allow-Headers',
        operation: 'set',
        value: '*'
      }]
    };
    const resourceTypes = ['xmlhttprequest', 'sub_frame', 'main_frame', 'script', 'stylesheet', 'image', 'font', 'media', 'websocket', 'other'];
    const scope = settings.scope || 'domain';
    if (scope === 'global') {
      // Global scope: use dynamic rules (browser-wide)
      await chrome.declarativeNetRequest.updateDynamicRules({
        addRules: [{
          id: CORS_RULESET_ID,
          priority: 1,
          action: corsAction,
          condition: {
            urlFilter: '|http',
            resourceTypes
          }
        }]
      });
      dbg('[EchoKit CORS] Installed GLOBAL dynamic rule (browser-wide)');
    } else if (scope === 'domain') {
      // Domain scope: we need to collect all current tab domains and update rules
      await applyCorsRulesForAllTabs();
    } else if (scope === 'tab') {
      // Tab scope: we need to collect all tab IDs and update rules
      await applyCorsRulesForAllTabs();
    }
  } catch (error) {
    console.error('[EchoKit CORS] Failed to apply CORS rules:', error);
    // Try to notify user through any open tabs
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (tab.id) {
        safeSend(tab.id, {
          type: 'echokit:error',
          payload: {
            message: `CORS rule installation failed: ${error.message}`
          }
        });
      }
    }
  } finally {
    // Edge case fix: Always clear pending flag even if error occurs
    corsUpdatePending = false;
  }
}

/**
 * Apply CORS rules for all open tabs when using domain or tab scope.
 * This is called when scope is 'domain' or 'tab'.
 */
async function applyCorsRulesForAllTabs() {
  try {
    const tabs = await chrome.tabs.query({});
    const scope = settings.scope || 'domain';
    const corsAction = {
      type: 'modifyHeaders',
      responseHeaders: [{
        header: 'Access-Control-Allow-Origin',
        operation: 'set',
        value: '*'
      }, {
        header: 'Access-Control-Allow-Methods',
        operation: 'set',
        value: '*'
      }, {
        header: 'Access-Control-Allow-Headers',
        operation: 'set',
        value: '*'
      }]
    };
    const resourceTypes = ['xmlhttprequest', 'sub_frame', 'main_frame', 'script', 'stylesheet', 'image', 'font', 'media', 'websocket', 'other'];
    if (scope === 'tab') {
      // Tab scope: create rules for each tab ID
      const validTabIds = tabs.map(t => t.id).filter(id => id != null);
      if (validTabIds.length === 0) {
        dbg('[EchoKit CORS] No valid tabs for tab-scoped CORS');
        return;
      }

      // Session rules support tabIds array
      await chrome.declarativeNetRequest.updateSessionRules({
        addRules: [{
          id: CORS_RULESET_ID,
          priority: 1,
          action: corsAction,
          condition: {
            tabIds: validTabIds,
            urlFilter: '|http',
            resourceTypes
          }
        }]
      });
      dbg('[EchoKit CORS] Installed TAB-scoped session rule for', validTabIds.length, 'tabs:', validTabIds);
    } else if (scope === 'domain') {
      // Domain scope: create rules for unique domains
      const domains = new Set();
      for (const tab of tabs) {
        if (tab.url) {
          const host = hostOf(tab.url);
          if (host) domains.add(host);
        }
      }
      const domainList = Array.from(domains);
      if (domainList.length === 0) {
        dbg('[EchoKit CORS] No valid domains for domain-scoped CORS');
        return;
      }

      // Session rules support requestDomains
      await chrome.declarativeNetRequest.updateSessionRules({
        addRules: [{
          id: CORS_RULESET_ID,
          priority: 1,
          action: corsAction,
          condition: {
            requestDomains: domainList,
            resourceTypes
          }
        }]
      });
      dbg('[EchoKit CORS] Installed DOMAIN-scoped session rule for', domainList.length, 'domains:', domainList);
    }
  } catch (error) {
    console.error('[EchoKit CORS] Failed to apply scoped CORS rules:', error);
    throw error;
  }
}
async function applyBlocklistRules() {
  const current = await chrome.declarativeNetRequest.getDynamicRules();
  const oldIds = current.filter(r => r.id >= BLOCKLIST_RULESET_BASE && r.id < BLOCKLIST_RULESET_BASE + 100).map(r => r.id);
  if (oldIds.length) await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: oldIds
  });
  const active = (settings.blocklist || []).filter(b => b.enabled && b.pattern);
  if (!active.length) return;
  const rules = active.slice(0, 100).map((b, i) => ({
    id: BLOCKLIST_RULESET_BASE + i,
    priority: 2,
    action: {
      type: 'block'
    },
    condition: {
      urlFilter: b.pattern,
      resourceTypes: ['xmlhttprequest', 'sub_frame', 'main_frame', 'script', 'stylesheet', 'image', 'font', 'media', 'websocket', 'other']
    }
  }));
  await chrome.declarativeNetRequest.updateDynamicRules({
    addRules: rules
  });
}

// ---------- Messaging ----------
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  dbg('[BG] Received message:', msg?.type);
  handleMessage(msg, sender).then(result => {
    dbg('[BG] Sending response for', msg?.type, ':', result);
    sendResponse(result);
  }).catch(err => {
    console.error('[BG] Error handling', msg?.type, ':', err);
    sendResponse({
      error: String(err)
    });
  });
  return true;
});

/**
 * Get tab info for source tracking (checks if tab still exists)
 * @param {number|null} tabId - The tab ID to check
 * @returns {Promise<{exists: boolean, title: string, url: string}>} Tab metadata
 */
async function getTabInfo(tabId) {
  if (tabId === null) return {
    exists: false,
    title: 'Imported',
    url: ''
  };
  try {
    const tab = await chrome.tabs.get(tabId);
    return {
      exists: true,
      title: tab.title || 'Untitled',
      url: tab.url || ''
    };
  } catch {
    return {
      exists: false,
      title: `Tab #${tabId}`,
      url: ''
    };
  }
}

/**
 * Handle incoming runtime messages from extension UI pages and content scripts, executing the requested command and returning an operation-specific result.
 *
 * This function dispatches on `msg.type` to perform state queries, recording/mocking controls, interaction CRUD, import/export operations, settings and license management, cookie/localStorage bridges, gist sync, and other background tasks. It enriches and persists state as needed and notifies tabs of updates.
 *
 * @param {object} msg - Message payload containing a `type` field and any command-specific properties.
 * @param {chrome.runtime.MessageSender} sender - Message sender info (may include `tab` for tab-scoped requests).
 * @returns {object} An object whose shape depends on the handled message; most responses include `{ ok: boolean }` and may include additional fields such as `settings`, `interactions`, `id`, `imported`, `deleted`, `sessionId`, `stoppedCount`, `data`, or `error` for failures. Unknown message types return `{ ok: false, error: string }`.
 */
async function handleEchokitGetState(msg, sender, fromTabId) {
  const tabId = msg.tabId ?? fromTabId;
  const all = await getAllInteractions();
  let host = '';
  try {
    if (tabId != null) {
      const t = await chrome.tabs.get(tabId);
      host = hostOf(t?.url || '');
    }
  } catch {}
  const ctx = {
    tabId,
    host,
    scope: settings.scope
  };
  const {
    index,
    blockedKeys
  } = buildMockIndexFor(all, ctx);
  const proStatus = await getProStatus();

  // Enrich interactions with source metadata for visibility features
  const visible = all.filter(i => visibleInContext(i, ctx));
  const uniqueTabIds = [...new Set(visible.map(i => i.tabId))];
  const tabInfoCache = new Map();
  await Promise.all(uniqueTabIds.map(async tabId => {
    const info = await getTabInfo(tabId);
    tabInfoCache.set(tabId, info);
  }));
  const enriched = visible.map(i => {
    const tabInfo = tabInfoCache.get(i.tabId) || {
      exists: false,
      title: 'Unknown',
      url: ''
    };
    return {
      ...i,
      sourceTabExists: tabInfo.exists,
      sourceTabTitle: tabInfo.title,
      sourceTabUrl: tabInfo.url
    };
  });
  return {
    tab: tabId != null ? {
      tabId,
      host,
      ...getTab(tabId)
    } : null,
    settings,
    interactions: enriched,
    allCount: all.length,
    isPro: proStatus.pro,
    trial: proStatus.trial,
    trialDaysLeft: proStatus.trialDaysLeft,
    mockIndex: index,
    blockedKeys
  };
}
async function handleEchokitRecordingStart(msg) {
  const tabId = msg.tabId;
  const st = getTab(tabId);
  st.recording = true;
  st.sessionId = `sess_${tabId}_${Date.now()}`;
  try {
    const t = await chrome.tabs.get(tabId);
    st.host = hostOf(t?.url || '');
  } catch {}
  await persistTabState();
  await pushTabMeta(tabId);
  return {
    ok: true,
    sessionId: st.sessionId
  };
}
async function handleEchokitRecordingStop(msg) {
  const tabId = msg.tabId;
  const st = getTab(tabId);
  st.recording = false;
  await persistTabState();
  await pushTabMeta(tabId);
  return {
    ok: true
  };
}
async function handleEchokitRecordingStopAll() {
  let stoppedCount = 0;
  for (const [tabId, st] of tabState.entries()) {
    if (st.recording) {
      st.recording = false;
      stoppedCount++;
      await updateBadge(tabId);
    }
  }
  await persistTabState();
  await pushAllTabs();
  return {
    ok: true,
    stoppedCount
  };
}
async function handleEchokitMockingToggle(msg) {
  const tabId = msg.tabId;
  const st = getTab(tabId);
  st.mocking = !!msg.enabled;
  await persistTabState();
  await pushTabMeta(tabId);
  return {
    ok: true
  };
}
async function handleEchokitClearScoped(msg) {
  const tabId = msg.tabId;
  let host = '';
  try {
    const t = await chrome.tabs.get(tabId);
    host = hostOf(t?.url || '');
  } catch {}
  const ctx = {
    tabId,
    host,
    scope: settings.scope
  };
  const all = await getAllInteractions();
  let deleted = 0;
  for (const it of all) if (visibleInContext(it, ctx)) {
    await deleteInteraction(it.id);
    deleted++;
  }
  await pushAllTabs();
  return {
    ok: true,
    deleted
  };
}
async function handleEchokitInteractionRecord(msg, sender, fromTabId) {
  const {
    data
  } = msg;
  if (!data || !data.method || !data.url) return {
    ok: false
  };
  const tabId = fromTabId;
  const st = getTab(tabId);
  if (!st.recording) return {
    ok: false,
    reason: 'not-recording'
  };
  // Free tier: max 50 unique interactions. Check before recording.
  const proStatus = await getProStatus();
  const all = await getAllInteractions();
  if (!proStatus.pro && all.length >= 50) return {
    ok: false,
    reason: 'free_limit'
  };
  const matchKeys = data.matchKeys || computeMatchKeys(data.method, data.url, data.requestBody);
  const hash = matchKeys.strict;
  const existing = all.find(i => i.hash === hash && i.tabId === tabId) || null;
  const interaction = {
    id: existing ? existing.id : `int_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    hash,
    matchKeys,
    matchMode: existing ? existing.matchMode || 'strict' : 'strict',
    url: data.url,
    method: String(data.method).toUpperCase(),
    requestHeaders: data.requestHeaders || {},
    requestBody: data.requestBody ?? null,
    responseStatus: data.responseStatus ?? 0,
    responseHeaders: data.responseHeaders || {},
    responseBody: data.responseBody ?? '',
    timestamp: Date.now(),
    tabId,
    sessionId: st.sessionId,
    tabUrl: sender?.tab?.url || '',
    host: hostOf(sender?.tab?.url || ''),
    mockEnabled: existing ? existing.mockEnabled : false,
    mockLatency: existing ? existing.mockLatency : 0,
    mockErrorMode: existing ? existing.mockErrorMode : 'none',
    overrideStatus: existing ? existing.overrideStatus : null,
    overrideBody: existing ? existing.overrideBody : null,
    overrideHeaders: existing ? existing.overrideHeaders : null,
    activeVersionId: existing ? existing.activeVersionId : null,
    notes: existing ? existing.notes : '',
    gqlOperation: data.gqlOperation || (existing ? existing.gqlOperation : '')
  };
  await putInteraction(interaction);
  await pushAllTabs();
  return {
    ok: true,
    id: interaction.id
  };
}
async function handleEchokitInteractionUpdate(msg) {
  const existing = await getInteraction(msg.id);
  if (!existing) return {
    ok: false
  };
  await putInteraction({
    ...existing,
    ...msg.patch
  });
  await pushAllTabs();
  return {
    ok: true
  };
}
async function handleEchokitInteractionDelete(msg) {
  await deleteInteraction(msg.id);
  await pushAllTabs();
  return {
    ok: true
  };
}
async function handleEchokitInteractionsClearAll() {
  await clearAllInteractions();
  await pushAllTabs();
  return {
    ok: true
  };
}
async function handleEchokitInteractionSetActiveVersion(msg) {
  const target = await getInteraction(msg.id);
  if (!target) return {
    ok: false
  };
  const all = await getAllInteractions();
  for (const it of all) if (it.hash === target.hash) await putInteraction({
    ...it,
    activeVersionId: msg.id
  });
  await pushAllTabs();
  return {
    ok: true
  };
}
async function handleEchokitExport() {
  return {
    ok: true,
    data: {
      version: 2,
      exportedAt: new Date().toISOString(),
      interactions: await getAllInteractions()
    }
  };
}
async function handleEchokitExportHar() {
  const all = await getAllInteractions();
  const har = {
    log: {
      version: '1.2',
      creator: {
        name: 'EchoKit',
        version: '1.4.0'
      },
      entries: all.filter(i => i.method && i.method !== 'WS' && i.method !== 'SSE').map(i => ({
        startedDateTime: new Date(i.timestamp).toISOString(),
        time: i.durationMs || 0,
        request: {
          method: i.method,
          url: i.url,
          httpVersion: 'HTTP/1.1',
          headers: Object.entries(i.requestHeaders || {}).map(([k, v]) => ({
            name: k,
            value: String(v)
          })),
          queryString: [],
          cookies: [],
          headersSize: -1,
          bodySize: i.requestBody ? i.requestBody.length : 0,
          postData: i.requestBody ? {
            mimeType: 'application/json',
            text: typeof i.requestBody === 'string' ? i.requestBody : JSON.stringify(i.requestBody)
          } : undefined
        },
        response: {
          status: i.responseStatus || 0,
          statusText: '',
          httpVersion: 'HTTP/1.1',
          headers: Object.entries(i.responseHeaders || {}).map(([k, v]) => ({
            name: k,
            value: String(v)
          })),
          cookies: [],
          content: {
            size: (i.responseBody || '').length,
            mimeType: 'application/json',
            text: i.responseBody || ''
          },
          redirectURL: '',
          headersSize: -1,
          bodySize: (i.responseBody || '').length
        },
        cache: {},
        timings: {
          send: 0,
          wait: i.durationMs || 0,
          receive: 0
        }
      }))
    }
  };
  return {
    ok: true,
    data: har
  };
}
async function handleEchokitImport(msg) {
  const {
    data,
    strategy
  } = msg;
  if (!data || !Array.isArray(data.interactions)) return {
    ok: false,
    error: 'invalid payload'
  };
  if (strategy === 'override') await clearAllInteractions();
  for (const it of data.interactions) {
    if (!it.id || !it.hash) continue;
    if (!it.matchKeys) it.matchKeys = computeMatchKeys(it.method, it.url, it.requestBody);
    if (!it.matchMode) it.matchMode = 'strict';
    await putInteraction(it);
  }
  await pushAllTabs();
  return {
    ok: true,
    imported: data.interactions.length
  };
}
async function handleEchokitSettingsUpdate(msg) {
  settings = {
    ...settings,
    ...msg.patch
  };
  await setMeta(SETTINGS_KEY, settings);
  await applyCorsRules();
  await applyBlocklistRules();
  await pushAllTabs();
  return {
    ok: true,
    settings
  };
}
async function handleEchokitCookiesRead(msg) {
  const tabId = msg.tabId;
  try {
    const t = await chrome.tabs.get(tabId);
    const cookies = await chrome.cookies.getAll({
      url: t.url
    });
    return {
      ok: true,
      cookies,
      origin: new URL(t.url).origin,
      count: cookies.length
    };
  } catch (e) {
    return {
      ok: false,
      error: String(e)
    };
  }
}
async function handleEchokitCookiesWrite(msg) {
  const tabId = msg.tabId;
  const cookies = msg.cookies || [];
  try {
    const t = await chrome.tabs.get(tabId);
    const url = new URL(t.url);
    let written = 0;
    for (const c of cookies) {
      try {
        const set = {
          url: t.url,
          name: c.name,
          value: c.value || '',
          path: c.path || '/',
          secure: !!c.secure,
          httpOnly: !!c.httpOnly,
          sameSite: c.sameSite || 'lax'
        };
        if (c.expirationDate) set.expirationDate = c.expirationDate;
        if (c.domain && c.domain.includes(url.hostname)) set.domain = c.domain;
        await chrome.cookies.set(set);
        written++;
      } catch {}
    }
    return {
      ok: true,
      written,
      origin: url.origin
    };
  } catch (e) {
    return {
      ok: false,
      error: String(e)
    };
  }
}
async function handleEchokitLocalStorageRead(msg) {
  const tabId = msg.tabId;
  try {
    const r = await chrome.scripting.executeScript({
      target: {
        tabId,
        allFrames: false
      },
      func: () => {
        const o = {};
        const ls = globalThis.localStorage;
        for (let i = 0; i < ls.length; i++) {
          const k = ls.key(i);
          o[k] = ls.getItem(k);
        }
        return {
          keys: o,
          origin: location.origin,
          href: location.href,
          count: ls.length
        };
      }
    });
    return {
      ok: true,
      ...(r?.[0]?.result || {})
    };
  } catch (e) {
    return {
      ok: false,
      error: String(e)
    };
  }
}
async function handleEchokitLocalStorageWrite(msg) {
  const tabId = msg.tabId;
  const keys = msg.keys || {};
  const clearFirst = !!msg.clearFirst;
  try {
    const r = await chrome.scripting.executeScript({
      target: {
        tabId,
        allFrames: false
      },
      args: [keys, clearFirst],
      func: (keys, clearFirst) => {
        const ls = globalThis.localStorage;
        if (clearFirst) ls.clear();
        let written = 0;
        for (const [k, v] of Object.entries(keys)) {
          ls.setItem(k, v);
          written++;
        }
        return {
          written,
          origin: location.origin
        };
      }
    });
    return {
      ok: true,
      ...(r?.[0]?.result || {})
    };
  } catch (e) {
    return {
      ok: false,
      error: String(e)
    };
  }
}
async function handleEchokitGistUpload(msg) {
  const {
    token,
    description,
    public: isPublic
  } = msg;
  if (!token) return {
    ok: false,
    error: 'missing github token'
  };
  const all = await getAllInteractions();
  const payload = {
    version: 2,
    exportedAt: new Date().toISOString(),
    interactions: all
  };
  try {
    const res = await fetch('https://api.github.com/gists', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        description: description || 'EchoKit mock set',
        public: !!isPublic,
        files: {
          'echokit-mocks.json': {
            content: JSON.stringify(payload, null, 2)
          }
        }
      })
    });
    const j = await res.json();
    if (!res.ok) return {
      ok: false,
      error: j.message || `HTTP ${res.status}`
    };
    return {
      ok: true,
      url: j.html_url,
      rawUrl: j.files?.['echokit-mocks.json']?.raw_url,
      id: j.id
    };
  } catch (e) {
    return {
      ok: false,
      error: String(e)
    };
  }
}
async function handleEchokitGistImport(msg) {
  const {
    url,
    strategy
  } = msg;
  if (!url) return {
    ok: false,
    error: 'missing gist url'
  };
  try {
    let rawUrl = url.trim();
    // Accept gist HTML URLs + extract id.
    const m = rawUrl.match(/gist\.github\.com\/(?:[^/]+\/)?([a-f0-9]+)/i);
    if (m) {
      const r = await fetch(`https://api.github.com/gists/${m[1]}`);
      if (!r.ok) return {
        ok: false,
        error: `gist fetch failed: ${r.status}`
      };
      const j = await r.json();
      const file = j.files['echokit-mocks.json'] || Object.values(j.files).find(f => f.filename.endsWith('.json'));
      if (!file) return {
        ok: false,
        error: 'no JSON file in gist'
      };
      rawUrl = file.raw_url;
    }
    const r = await fetch(rawUrl);
    if (!r.ok) return {
      ok: false,
      error: `fetch failed: ${r.status}`
    };
    const data = await r.json();
    if (!Array.isArray(data?.interactions)) return {
      ok: false,
      error: 'invalid payload'
    };
    if (strategy === 'override') await clearAllInteractions();
    for (const it of data.interactions) {
      if (!it.id || !it.hash) continue;
      if (!it.matchKeys) it.matchKeys = computeMatchKeys(it.method, it.url, it.requestBody);
      if (!it.matchMode) it.matchMode = 'strict';
      await putInteraction(it);
    }
    await pushAllTabs();
    return {
      ok: true,
      imported: data.interactions.length
    };
  } catch (e) {
    return {
      ok: false,
      error: String(e)
    };
  }
}
async function handleEchokitContentReady(msg, sender, fromTabId) {
  if (fromTabId != null) await pushTabMeta(fromTabId);
  return {
    ok: true
  };
}
async function handleEchokitLicenseCheck() {
  const proStatus = await getProStatus();
  const stored = await chrome.storage.sync.get('echokit_license');
  return {
    ok: true,
    pro: proStatus.pro,
    trial: proStatus.trial,
    trialDaysLeft: proStatus.trialDaysLeft,
    key: stored['echokit_license'] || ''
  };
}
async function handleEchokitLicenseSet(msg) {
  const {
    key
  } = msg;
  // Clear cached validation result whenever the key changes.
  try {
    await chrome.storage.local.remove(LICENSE_CACHE_KEY);
  } catch {}
  if (!key) {
    await chrome.storage.sync.remove('echokit_license');
    return {
      ok: true,
      pro: false
    };
  }
  const trimmed = key.trim();
  if (!validateLicenseKey(trimmed)) return {
    ok: false,
    error: 'Invalid license key. Expected EK-PRO-…, EK-YEAR-…, or EK-LTD-…'
  };
  await chrome.storage.sync.set({
    echokit_license: trimmed
  });
  // Best-effort remote validation. We accept the key locally even if the
  // worker rejects it, so users with a misconfigured endpoint can still
  // use the extension; getProStatus() will re-check on the next call.
  const remote = await validateLicenseRemote(trimmed);
  if (remote.ok && remote.valid === false) {
    // Worker said no — remove the key and surface the error.
    await chrome.storage.sync.remove('echokit_license');
    return {
      ok: false,
      error: remote.error || 'license rejected by server'
    };
  }
  return {
    ok: true,
    pro: true,
    plan: remote.plan || null,
    expiresAt: remote.expiresAt || null
  };
}
async function handleEchokitLicenseSetEndpoint(msg) {
  const {
    endpoint
  } = msg;
  if (!endpoint) await chrome.storage.sync.remove('echokit_license_endpoint');else await chrome.storage.sync.set({
    echokit_license_endpoint: String(endpoint)
  });
  // Force re-validation by clearing cache.
  try {
    await chrome.storage.local.remove(LICENSE_CACHE_KEY);
  } catch {}
  return {
    ok: true
  };
}
async function handleEchokitMockHit(msg) {
  const {
    id
  } = msg.data || {};
  if (!id) return {
    ok: true
  };
  const existing = await getInteraction(id);
  if (!existing) return {
    ok: true
  };
  const updates = {};
  // Conditional mock count
  if (existing.mockMaxCount != null) {
    const newCount = (existing.mockCallCount || 0) + 1;
    updates.mockCallCount = newCount;
  }
  // Mock chain advancement
  if (existing.mockChain && existing.mockChain.length > 0) {
    updates.mockChainCursor = (existing.mockChainCursor || 0) + 1;
  }
  if (Object.keys(updates).length > 0) {
    await putInteraction({
      ...existing,
      ...updates
    });
    await pushAllTabs();
  }
  return {
    ok: true
  };
}
async function handleEchokitImportHar(msg) {
  const {
    data,
    strategy
  } = msg;
  if (!data?.log?.entries) return {
    ok: false,
    error: 'Invalid HAR — missing log.entries'
  };
  if (strategy === 'override') await clearAllInteractions();
  let imported = 0;
  for (const entry of data.log.entries) {
    try {
      const req = entry.request,
        res = entry.response;
      const method = (req.method || 'GET').toUpperCase();
      const url = req.url || '';
      const reqBody = req.postData?.text || null;
      const reqHeaders = Object.fromEntries((req.headers || []).map(h => [h.name, h.value]));
      const resStatus = res.status || 200;
      const resHeaders = Object.fromEntries((res.headers || []).map(h => [h.name, h.value]));
      const resBody = res.content?.text || '';
      const mk = computeMatchKeys(method, url, reqBody);
      await putInteraction({
        id: `int_har_${Date.now()}_${imported}_${Math.random().toString(36).slice(2, 6)}`,
        hash: mk.strict,
        matchKeys: mk,
        matchMode: 'strict',
        url,
        method,
        requestHeaders: reqHeaders,
        requestBody: reqBody,
        responseStatus: resStatus,
        responseHeaders: resHeaders,
        responseBody: resBody,
        timestamp: new Date(entry.startedDateTime || Date.now()).getTime(),
        durationMs: entry.time || 0,
        tabId: null,
        tabUrl: '',
        host: '',
        mockEnabled: true,
        mockLatency: 0,
        mockErrorMode: 'none',
        overrideStatus: null,
        overrideBody: null,
        overrideHeaders: null,
        activeVersionId: null,
        notes: 'HAR import',
        gqlOperation: '',
        mockMaxCount: null,
        mockCallCount: 0,
        wsLoop: false,
        blocked: false
      });
      imported++;
    } catch {}
  }
  await pushAllTabs();
  return {
    ok: true,
    imported
  };
}
async function handleEchokitImportOpenapi(msg) {
  const {
    data,
    baseUrl: customBase
  } = msg;
  if (!data || !data.openapi && !data.swagger && !data.paths) return {
    ok: false,
    error: 'Not a valid OpenAPI / Swagger spec'
  };
  const isSwagger2 = !!data.swagger;
  // Resolve base URL
  let base = customBase || '';
  if (!base) {
    if (isSwagger2) {
      const proto = (data.schemes || ['https'])[0];
      base = `${proto}://${data.host || 'localhost'}${data.basePath || '/'}`;
    } else {
      base = data.servers?.[0]?.url || 'https://localhost';
    }
  }
  base = base.replace(/\/$/, '');
  const paths = data.paths || {};
  let imported = 0;
  const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'];
  for (const [path, pathItem] of Object.entries(paths)) {
    for (const httpMethod of HTTP_METHODS) {
      const op = pathItem[httpMethod];
      if (!op) continue;
      const method = httpMethod.toUpperCase();
      // Build URL — replace path params with example values
      const url = base + path.replace(/{([^}]+)}/g, (_, p) => `${p}_example`);
      // Extract request body example
      let reqBody = null;
      if (isSwagger2 && op.parameters) {
        const bodyParam = op.parameters.find(p => p.in === 'body');
        if (bodyParam?.schema?.example) reqBody = JSON.stringify(bodyParam.schema.example);
      } else if (op.requestBody?.content?.['application/json']?.example) {
        reqBody = JSON.stringify(op.requestBody.content['application/json'].example);
      }
      // Extract response
      const responses = op.responses || {};
      const successCode = ['200', '201', '204'].find(c => responses[c]) || Object.keys(responses)[0] || '200';
      const resp = responses[successCode] || {};
      let resBody = '';
      const resStatus = parseInt(successCode, 10) || 200;
      if (isSwagger2) {
        const ex = resp.examples?.['application/json'];
        resBody = ex ? JSON.stringify(ex) : resp.schema?.example ? JSON.stringify(resp.schema.example) : '';
      } else {
        const c = resp.content?.['application/json'];
        resBody = c?.example ? JSON.stringify(c.example) : c?.schema?.example ? JSON.stringify(c.schema.example) : '';
      }
      if (!resBody) resBody = `{"status":"${resp.description || 'ok'}"}`;
      const mk = computeMatchKeys(method, url, reqBody);
      await putInteraction({
        id: `int_oas_${Date.now()}_${imported}_${Math.random().toString(36).slice(2, 6)}`,
        hash: mk.strict,
        matchKeys: mk,
        matchMode: 'strict',
        url,
        method,
        requestHeaders: {},
        requestBody: reqBody,
        responseStatus: resStatus,
        responseHeaders: {
          'content-type': 'application/json'
        },
        responseBody: resBody,
        timestamp: Date.now(),
        durationMs: 0,
        tabId: null,
        tabUrl: '',
        host: '',
        mockEnabled: true,
        mockLatency: 0,
        mockErrorMode: 'none',
        overrideStatus: null,
        overrideBody: null,
        overrideHeaders: null,
        activeVersionId: null,
        notes: `OpenAPI: ${op.summary || op.operationId || `${method} ${path}`}`,
        gqlOperation: '',
        mockMaxCount: null,
        mockCallCount: 0,
        wsLoop: false,
        blocked: false,
        mockChain: null,
        mockChainCursor: 0,
        mockChainLoop: true
      });
      imported++;
    }
  }
  await pushAllTabs();
  return {
    ok: true,
    imported
  };
}
async function handleEchokitExportPostman() {
  const all = await getAllInteractions();
  const items = all.filter(i => i.method !== 'WS' && i.method !== 'SSE').map(i => {
    let urlObj;
    try {
      urlObj = new URL(i.url);
    } catch {
      urlObj = null;
    }
    return {
      name: `${i.method} ${urlObj?.pathname || i.url}`,
      request: {
        method: i.method,
        url: {
          raw: i.url,
          protocol: urlObj?.protocol?.replace(':', '') || 'https',
          host: urlObj ? urlObj.hostname.split('.') : [i.url],
          path: urlObj ? urlObj.pathname.split('/').filter(Boolean) : [],
          query: urlObj ? [...urlObj.searchParams.entries()].map(([k, v]) => ({
            key: k,
            value: v
          })) : []
        },
        header: Object.entries(i.requestHeaders || {}).map(([k, v]) => ({
          key: k,
          value: String(v)
        })),
        body: i.requestBody ? {
          mode: 'raw',
          raw: typeof i.requestBody === 'string' ? i.requestBody : JSON.stringify(i.requestBody),
          options: {
            raw: {
              language: 'json'
            }
          }
        } : undefined
      },
      response: [{
        name: 'Recorded Response',
        originalRequest: {
          method: i.method,
          url: {
            raw: i.url
          }
        },
        status: String(i.overrideStatus ?? i.responseStatus ?? 200),
        code: i.overrideStatus ?? i.responseStatus ?? 200,
        header: Object.entries(i.overrideHeaders || i.responseHeaders || {}).map(([k, v]) => ({
          key: k,
          value: String(v)
        })),
        body: i.overrideBody ?? i.responseBody ?? ''
      }]
    };
  });
  return {
    ok: true,
    data: {
      info: {
        name: `EchoKit — ${new Date().toLocaleDateString()}`,
        description: 'Exported from EchoKit v1.5',
        schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
      },
      item: items
    }
  };
}
async function handleEchokitCorsDiagnostics() {
  try {
    const dynamicRules = await chrome.declarativeNetRequest.getDynamicRules();
    const sessionRules = await chrome.declarativeNetRequest.getSessionRules();
    const corsRule = [...dynamicRules, ...sessionRules].find(r => r.id === CORS_RULESET_ID);
    const tabs = await chrome.tabs.query({});
    const tabInfo = tabs.map(t => ({
      id: t.id,
      url: t.url,
      host: hostOf(t.url || '')
    }));
    return {
      ok: true,
      corsEnabled: settings.corsOverride,
      scope: settings.scope,
      ruleInstalled: !!corsRule,
      rule: corsRule || null,
      dynamicRulesCount: dynamicRules.length,
      sessionRulesCount: sessionRules.length,
      tabs: tabInfo,
      allDynamicRules: dynamicRules,
      allSessionRules: sessionRules
    };
  } catch (error) {
    return {
      ok: false,
      error: error.message,
      stack: error.stack
    };
  }
}
const messageHandlers = {
  "echokit:getState": handleEchokitGetState,
  "echokit:recording:start": handleEchokitRecordingStart,
  "echokit:recording:stop": handleEchokitRecordingStop,
  "echokit:recording:stopAll": handleEchokitRecordingStopAll,
  "echokit:mocking:toggle": handleEchokitMockingToggle,
  "echokit:clear:scoped": handleEchokitClearScoped,
  "echokit:interaction:record": handleEchokitInteractionRecord,
  "echokit:interaction:update": handleEchokitInteractionUpdate,
  "echokit:interaction:delete": handleEchokitInteractionDelete,
  "echokit:interactions:clearAll": handleEchokitInteractionsClearAll,
  "echokit:interaction:setActiveVersion": handleEchokitInteractionSetActiveVersion,
  "echokit:export": handleEchokitExport,
  "echokit:export:har": handleEchokitExportHar,
  "echokit:import": handleEchokitImport,
  "echokit:settings:update": handleEchokitSettingsUpdate,
  "echokit:cookies:read": handleEchokitCookiesRead,
  "echokit:cookies:write": handleEchokitCookiesWrite,
  "echokit:localStorage:read": handleEchokitLocalStorageRead,
  "echokit:localStorage:write": handleEchokitLocalStorageWrite,
  "echokit:gist:upload": handleEchokitGistUpload,
  "echokit:gist:import": handleEchokitGistImport,
  "echokit:contentReady": handleEchokitContentReady,
  "echokit:license:check": handleEchokitLicenseCheck,
  "echokit:license:set": handleEchokitLicenseSet,
  "echokit:license:setEndpoint": handleEchokitLicenseSetEndpoint,
  "echokit:mock:hit": handleEchokitMockHit,
  "echokit:import:har": handleEchokitImportHar,
  "echokit:import:openapi": handleEchokitImportOpenapi,
  "echokit:export:postman": handleEchokitExportPostman,
  "echokit:cors:diagnostics": handleEchokitCorsDiagnostics
};
async function handleMessage(msg, sender) {
  const fromTabId = sender?.tab?.id ?? msg?.tabId ?? null;
  const handler = messageHandlers[msg?.type];
  if (handler) return await handler(msg, sender, fromTabId);
  return {
    ok: false,
    error: `unknown message: ${msg?.type}`
  };
}

// ---------- Keyboard commands ----------
chrome.commands?.onCommand.addListener(async cmd => {
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true
  });
  if (!tab?.id) return;
  const st = getTab(tab.id);
  if (cmd === 'toggle-recording') {
    if (st.recording) await handleMessage({
      type: 'echokit:recording:stop',
      tabId: tab.id
    }, {});else await handleMessage({
      type: 'echokit:recording:start',
      tabId: tab.id
    }, {});
  } else if (cmd === 'toggle-mocking') {
    await handleMessage({
      type: 'echokit:mocking:toggle',
      tabId: tab.id,
      enabled: !st.mocking
    }, {});
  }
});

// ---------- Tab lifecycle ----------
chrome.tabs.onRemoved.addListener(tabId => {
  tabState.delete(tabId);
  persistTabState();
  // Update CORS rules if we're in tab/domain scope
  if (settings.corsOverride && (settings.scope === 'tab' || settings.scope === 'domain')) {
    applyCorsRules().catch(err => console.error('[EchoKit] Failed to update CORS rules on tab removal:', err));
  }
});
chrome.tabs.onUpdated.addListener(async (tabId, info, tab) => {
  if (info.status === 'loading') setTimeout(() => pushTabMeta(tabId).catch(() => {}), 100);
  if (info.status === 'complete') {
    const st = getTab(tabId);
    if (st.recording && settings.autoOpenOnRefresh) {
      try {
        await chrome.action.openPopup({
          windowId: tab.windowId
        });
      } catch {}
    }
    await updateBadge(tabId);
  }
  // Edge case fix: Debounce CORS updates to prevent rapid-fire during tab storms
  if (info.url && settings.corsOverride && settings.scope === 'domain') {
    if (corsUpdateTimeout) clearTimeout(corsUpdateTimeout);
    corsUpdateTimeout = setTimeout(() => {
      applyCorsRules().catch(err => console.error('[EchoKit] Failed to update CORS rules on navigation:', err));
    }, 150); // Debounce 150ms
  }
});
chrome.tabs.onActivated.addListener(({
  tabId
}) => updateBadge(tabId).catch(() => {}));
chrome.tabs.onCreated.addListener(_tab => {
  // Edge case fix: Debounce CORS updates for new tab creation
  if (settings.corsOverride && (settings.scope === 'tab' || settings.scope === 'domain')) {
    if (corsUpdateTimeout) clearTimeout(corsUpdateTimeout);
    corsUpdateTimeout = setTimeout(() => {
      applyCorsRules().catch(err => console.error('[EchoKit] Failed to update CORS rules on tab creation:', err));
    }, 150); // Debounce 150ms
  }
});

// Edge case fix: Clean up state for closed tabs to prevent memory leaks
chrome.tabs.onRemoved.addListener(async (tabId) => {
  // Remove from in-memory state
  if (tabState.has(tabId)) {
    tabState.delete(tabId);
    await persistTabState();
  }

  // Remove from in-flight push tracking
  if (pushInFlight.has(tabId)) {
    pushInFlight.delete(tabId);
  }

  // Update CORS rules if tab-scoped (tab no longer exists in tabIds array)
  if (settings.corsOverride && settings.scope === 'tab') {
    if (corsUpdateTimeout) clearTimeout(corsUpdateTimeout);
    corsUpdateTimeout = setTimeout(() => {
      applyCorsRules().catch(err => console.error('[EchoKit] Failed to update CORS rules on tab close:', err));
    }, 150);
  }
});

// ---------- Install / Startup ----------
chrome.runtime.onInstalled.addListener(async info => {
  await hydrate();
  await pushAllTabs();
  if (info.reason === 'install') {
    // Grant 7-day Pro trial automatically
    const trialExpiry = Date.now() + 7 * 24 * 60 * 60 * 1000;
    await chrome.storage.sync.set({
      echokit_trial_expiry: trialExpiry
    });
    try {
      await chrome.tabs.create({
        url: chrome.runtime.getURL('onboarding/welcome.html')
      });
    } catch {}
  }
});
chrome.runtime.onStartup.addListener(async () => {
  await hydrate();
  await pushAllTabs();
});
hydrate().then(pushAllTabs).catch(() => {});

// Expose handleMessage for automated testing
// This allows test scripts to call handleMessage directly without going through chrome.runtime.sendMessage
if (typeof self !== 'undefined') {
  self.__echokitHandle = handleMessage;
}
