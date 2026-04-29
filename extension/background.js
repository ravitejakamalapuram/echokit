// EchoKit — Background service worker.
// Adds in v1.2: GraphQL match mode, URL blocklist, localStorage copy/paste bridge, onboarding welcome tab.

import { computeHash, computeMatchKeys } from './shared/matcher.js';
import {
  putInteraction, getInteraction, deleteInteraction, getAllInteractions,
  clearAllInteractions, getMeta, setMeta
} from './shared/store.js';

const SESSION_KEY = 'echokit_tab_state';
const SETTINGS_KEY = 'echokit_settings';
const CORS_RULESET_ID = 1001;
const BLOCKLIST_RULESET_BASE = 2000; // rules 2000..2099 reserved for blocklist

const tabState = new Map();
let settings = {
  corsOverride: false,
  scope: 'tab',
  theme: 'dark',
  autoOpenOnRefresh: true,
  blocklist: [],
  rewriteRules: [],
  transformRules: []
};

async function hydrate() {
  try {
    const s = await chrome.storage.session.get(SESSION_KEY);
    const raw = s[SESSION_KEY];
    if (raw && typeof raw === 'object') for (const [tid, v] of Object.entries(raw)) tabState.set(Number(tid), v);
  } catch {}
  const stored = await getMeta(SETTINGS_KEY, null);
  if (stored) settings = { ...settings, ...stored };
  await applyCorsRules();
  await applyBlocklistRules();
}

async function persistTabState() {
  try { const obj = {}; for (const [k, v] of tabState.entries()) obj[k] = v; await chrome.storage.session.set({ [SESSION_KEY]: obj }); } catch {}
}

function getTab(tabId) {
  if (!tabState.has(tabId)) tabState.set(tabId, { recording: false, mocking: false, sessionId: null, host: '' });
  return tabState.get(tabId);
}
function hostOf(url) { try { return new URL(url).host; } catch { return ''; } }

function visibleInContext(interaction, ctx) {
  if (ctx.scope === 'global') return true;
  if (ctx.scope === 'tab') return interaction.tabId === ctx.tabId;
  return hostOf(interaction.tabUrl || interaction.url) === ctx.host;
}

// ---------- License key validation (Phase 1: format-only; Phase 2: Cloudflare Worker HMAC) ----------
function validateLicenseKey(key) {
  if (!key || typeof key !== 'string') return false;
  const k = key.trim().toUpperCase();
  return k.startsWith('EK-PRO-') || k.startsWith('EK-YEAR-') || k.startsWith('EK-LTD-');
}

// Checks license key OR active trial. Returns { pro, trial, trialDaysLeft }.
async function getProStatus() {
  const stored = await chrome.storage.sync.get(['echokit_license', 'echokit_trial_expiry']);
  if (validateLicenseKey(stored['echokit_license'] || '')) return { pro: true, trial: false, trialDaysLeft: 0 };
  const expiry = stored['echokit_trial_expiry'] || 0;
  const now = Date.now();
  if (expiry > now) {
    const trialDaysLeft = Math.ceil((expiry - now) / 86400000);
    return { pro: true, trial: true, trialDaysLeft };
  }
  return { pro: false, trial: false, trialDaysLeft: 0 };
}

function buildMockIndexFor(interactions, ctx) {
  const index = { strict: {}, 'ignore-query': {}, 'ignore-body': {}, 'path-wildcard': {}, graphql: {}, 'graphql-op': {} };
  // blockedKeys: same per-mode shape but only contains keys that are unconditionally blocked.
  const blockedKeys = { strict: {}, 'ignore-query': {}, 'ignore-body': {}, 'path-wildcard': {}, graphql: {}, 'graphql-op': {} };
  for (const it of interactions) {
    if (!visibleInContext(it, ctx)) continue;
    const mode = it.matchMode || 'strict';
    const keys = it.matchKeys || { strict: it.hash };
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
      const idx = it.mockChainLoop !== false
        ? (it.mockChainCursor || 0) % it.mockChain.length
        : Math.min(it.mockChainCursor || 0, it.mockChain.length - 1);
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
  return { index, blockedKeys };
}

async function pushTabMeta(tabId) {
  const st = getTab(tabId);
  let tab;
  try { tab = await chrome.tabs.get(tabId); } catch { return; }
  if (!tab) return;
  st.host = hostOf(tab.url || '');
  const ctx = { tabId, host: st.host, scope: settings.scope };
  const all = await getAllInteractions();
  const { index, blockedKeys } = buildMockIndexFor(all, ctx);
  safeSend(tabId, { type: 'echokit:tabState', payload: { ...st, corsOverride: settings.corsOverride, scope: settings.scope, blocklist: settings.blocklist, rewriteRules: settings.rewriteRules || [], transformRules: settings.transformRules || [] } });
  safeSend(tabId, { type: 'echokit:mockIndex', payload: { mocks: index, blocked: blockedKeys } });
  await updateBadge(tabId);
}

async function pushAllTabs() {
  const tabs = await chrome.tabs.query({});
  for (const t of tabs) if (t.id != null) pushTabMeta(t.id).catch(() => {});
}

function safeSend(tabId, msg) { chrome.tabs.sendMessage(tabId, msg).catch(() => {}); }

async function updateBadge(tabId) {
  const st = getTab(tabId);
  try {
    if (st.recording) { await chrome.action.setBadgeBackgroundColor({ color: '#ef4444', tabId }); await chrome.action.setBadgeText({ tabId, text: 'REC' }); }
    else if (st.mocking) { await chrome.action.setBadgeBackgroundColor({ color: '#fbbf24', tabId }); await chrome.action.setBadgeText({ tabId, text: 'MOCK' }); }
    else { await chrome.action.setBadgeText({ tabId, text: '' }); }
  } catch {}
}

async function applyCorsRules() {
  const current = await chrome.declarativeNetRequest.getDynamicRules();
  const corsIds = current.filter(r => r.id === CORS_RULESET_ID).map(r => r.id);
  if (corsIds.length) await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: corsIds });
  if (!settings.corsOverride) return;
  await chrome.declarativeNetRequest.updateDynamicRules({
    addRules: [{
      id: CORS_RULESET_ID, priority: 1,
      action: { type: 'modifyHeaders', responseHeaders: [
        { header: 'Access-Control-Allow-Origin', operation: 'set', value: '*' },
        { header: 'Access-Control-Allow-Methods', operation: 'set', value: '*' },
        { header: 'Access-Control-Allow-Headers', operation: 'set', value: '*' },
        { header: 'Access-Control-Allow-Credentials', operation: 'set', value: 'true' }
      ]},
      condition: { urlFilter: '|http', resourceTypes: ['xmlhttprequest','sub_frame','main_frame','script','stylesheet','image','font','media','websocket','other'] }
    }]
  });
}

async function applyBlocklistRules() {
  const current = await chrome.declarativeNetRequest.getDynamicRules();
  const oldIds = current.filter(r => r.id >= BLOCKLIST_RULESET_BASE && r.id < BLOCKLIST_RULESET_BASE + 100).map(r => r.id);
  if (oldIds.length) await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: oldIds });
  const active = (settings.blocklist || []).filter(b => b.enabled && b.pattern);
  if (!active.length) return;
  const rules = active.slice(0, 100).map((b, i) => ({
    id: BLOCKLIST_RULESET_BASE + i,
    priority: 2,
    action: { type: 'block' },
    condition: { urlFilter: b.pattern, resourceTypes: ['xmlhttprequest','sub_frame','main_frame','script','stylesheet','image','font','media','websocket','other'] }
  }));
  await chrome.declarativeNetRequest.updateDynamicRules({ addRules: rules });
}

// ---------- Messaging ----------
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  handleMessage(msg, sender).then(sendResponse).catch(err => sendResponse({ error: String(err) }));
  return true;
});
globalThis.__echokitHandle = handleMessage;

async function handleMessage(msg, sender) {
  const fromTabId = sender?.tab?.id ?? msg?.tabId ?? null;
  switch (msg?.type) {
    case 'echokit:getState': {
      const tabId = msg.tabId ?? fromTabId;
      const all = await getAllInteractions();
      let host = '';
      try { if (tabId != null) { const t = await chrome.tabs.get(tabId); host = hostOf(t?.url || ''); } } catch {}
      const ctx = { tabId, host, scope: settings.scope };
      const { index, blockedKeys } = buildMockIndexFor(all, ctx);
      const proStatus = await getProStatus();
      return {
        tab: tabId != null ? { tabId, host, ...getTab(tabId) } : null,
        settings,
        interactions: all.filter(i => visibleInContext(i, ctx)),
        allCount: all.length,
        isPro: proStatus.pro,
        trial: proStatus.trial,
        trialDaysLeft: proStatus.trialDaysLeft,
        mockIndex: index,
        blockedKeys
      };
    }
    case 'echokit:recording:start': {
      const tabId = msg.tabId; const st = getTab(tabId);
      st.recording = true; st.sessionId = `sess_${tabId}_${Date.now()}`;
      try { const t = await chrome.tabs.get(tabId); st.host = hostOf(t?.url || ''); } catch {}
      await persistTabState(); await pushTabMeta(tabId);
      return { ok: true, sessionId: st.sessionId };
    }
    case 'echokit:recording:stop': {
      const tabId = msg.tabId; const st = getTab(tabId); st.recording = false;
      await persistTabState(); await pushTabMeta(tabId);
      return { ok: true };
    }
    case 'echokit:mocking:toggle': {
      const tabId = msg.tabId; const st = getTab(tabId); st.mocking = !!msg.enabled;
      await persistTabState(); await pushTabMeta(tabId);
      return { ok: true };
    }
    case 'echokit:clear:scoped': {
      const tabId = msg.tabId;
      let host = '';
      try { const t = await chrome.tabs.get(tabId); host = hostOf(t?.url || ''); } catch {}
      const ctx = { tabId, host, scope: settings.scope };
      const all = await getAllInteractions();
      let deleted = 0;
      for (const it of all) if (visibleInContext(it, ctx)) { await deleteInteraction(it.id); deleted++; }
      await pushAllTabs();
      return { ok: true, deleted };
    }
    case 'echokit:interaction:record': {
      const { data } = msg;
      if (!data || !data.method || !data.url) return { ok: false };
      const tabId = fromTabId;
      const st = getTab(tabId);
      if (!st.recording) return { ok: false, reason: 'not-recording' };
      // Free tier: max 50 unique interactions. Check before recording.
      const proStatus = await getProStatus();
      const all = await getAllInteractions();
      if (!proStatus.pro && all.length >= 50) return { ok: false, reason: 'free_limit' };
      const matchKeys = data.matchKeys || computeMatchKeys(data.method, data.url, data.requestBody);
      const hash = matchKeys.strict;
      const existing = all.find(i => i.hash === hash && i.tabId === tabId) || null;
      const interaction = {
        id: existing ? existing.id : `int_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        hash, matchKeys,
        matchMode: existing ? (existing.matchMode || 'strict') : 'strict',
        url: data.url, method: String(data.method).toUpperCase(),
        requestHeaders: data.requestHeaders || {}, requestBody: data.requestBody ?? null,
        responseStatus: data.responseStatus ?? 0,
        responseHeaders: data.responseHeaders || {},
        responseBody: data.responseBody ?? '',
        timestamp: Date.now(), tabId, sessionId: st.sessionId,
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
      return { ok: true, id: interaction.id };
    }
    case 'echokit:interaction:update': {
      const existing = await getInteraction(msg.id);
      if (!existing) return { ok: false };
      await putInteraction({ ...existing, ...msg.patch });
      await pushAllTabs();
      return { ok: true };
    }
    case 'echokit:interaction:delete': { await deleteInteraction(msg.id); await pushAllTabs(); return { ok: true }; }
    case 'echokit:interactions:clearAll': { await clearAllInteractions(); await pushAllTabs(); return { ok: true }; }
    case 'echokit:interaction:setActiveVersion': {
      const target = await getInteraction(msg.id);
      if (!target) return { ok: false };
      const all = await getAllInteractions();
      for (const it of all) if (it.hash === target.hash) await putInteraction({ ...it, activeVersionId: msg.id });
      await pushAllTabs();
      return { ok: true };
    }
    case 'echokit:export': { return { ok: true, data: { version: 2, exportedAt: new Date().toISOString(), interactions: await getAllInteractions() } }; }
    case 'echokit:export:har': {
      const all = await getAllInteractions();
      const har = {
        log: {
          version: '1.2',
          creator: { name: 'EchoKit', version: '1.4.0' },
          entries: all.filter(i => i.method && i.method !== 'WS' && i.method !== 'SSE').map(i => ({
            startedDateTime: new Date(i.timestamp).toISOString(),
            time: i.durationMs || 0,
            request: {
              method: i.method, url: i.url, httpVersion: 'HTTP/1.1',
              headers: Object.entries(i.requestHeaders || {}).map(([k, v]) => ({ name: k, value: String(v) })),
              queryString: [], cookies: [],
              headersSize: -1, bodySize: i.requestBody ? i.requestBody.length : 0,
              postData: i.requestBody ? { mimeType: 'application/json', text: typeof i.requestBody === 'string' ? i.requestBody : JSON.stringify(i.requestBody) } : undefined
            },
            response: {
              status: i.responseStatus || 0, statusText: '', httpVersion: 'HTTP/1.1',
              headers: Object.entries(i.responseHeaders || {}).map(([k, v]) => ({ name: k, value: String(v) })),
              cookies: [], content: { size: (i.responseBody || '').length, mimeType: 'application/json', text: i.responseBody || '' },
              redirectURL: '', headersSize: -1, bodySize: (i.responseBody || '').length
            },
            cache: {}, timings: { send: 0, wait: i.durationMs || 0, receive: 0 }
          }))
        }
      };
      return { ok: true, data: har };
    }
    case 'echokit:import': {
      const { data, strategy } = msg;
      if (!data || !Array.isArray(data.interactions)) return { ok: false, error: 'invalid payload' };
      if (strategy === 'override') await clearAllInteractions();
      for (const it of data.interactions) {
        if (!it.id || !it.hash) continue;
        if (!it.matchKeys) it.matchKeys = computeMatchKeys(it.method, it.url, it.requestBody);
        if (!it.matchMode) it.matchMode = 'strict';
        await putInteraction(it);
      }
      await pushAllTabs();
      return { ok: true, imported: data.interactions.length };
    }
    case 'echokit:settings:update': {
      settings = { ...settings, ...msg.patch };
      await setMeta(SETTINGS_KEY, settings);
      await applyCorsRules();
      await applyBlocklistRules();
      await pushAllTabs();
      return { ok: true, settings };
    }
    // --- Cookies copy/paste ---
    case 'echokit:cookies:read': {
      const tabId = msg.tabId;
      try {
        const t = await chrome.tabs.get(tabId);
        const cookies = await chrome.cookies.getAll({ url: t.url });
        return { ok: true, cookies, origin: new URL(t.url).origin, count: cookies.length };
      } catch (e) { return { ok: false, error: String(e) }; }
    }
    case 'echokit:cookies:write': {
      const tabId = msg.tabId; const cookies = msg.cookies || [];
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
        return { ok: true, written, origin: url.origin };
      } catch (e) { return { ok: false, error: String(e) }; }
    }

    // --- localStorage copy/paste bridge ---
    case 'echokit:localStorage:read': {
      const tabId = msg.tabId;
      try {
        const r = await chrome.scripting.executeScript({
          target: { tabId, allFrames: false },
          func: () => {
            const o = {};
            for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o[k] = localStorage.getItem(k); }
            return { keys: o, origin: location.origin, href: location.href, count: localStorage.length };
          }
        });
        return { ok: true, ...(r?.[0]?.result || {}) };
      } catch (e) { return { ok: false, error: String(e) }; }
    }
    case 'echokit:localStorage:write': {
      const tabId = msg.tabId; const keys = msg.keys || {}; const clearFirst = !!msg.clearFirst;
      try {
        const r = await chrome.scripting.executeScript({
          target: { tabId, allFrames: false },
          args: [keys, clearFirst],
          func: (keys, clearFirst) => {
            if (clearFirst) localStorage.clear();
            let written = 0;
            for (const [k, v] of Object.entries(keys)) { localStorage.setItem(k, v); written++; }
            return { written, origin: location.origin };
          }
        });
        return { ok: true, ...(r?.[0]?.result || {}) };
      } catch (e) { return { ok: false, error: String(e) }; }
    }

    // --- Gist sync ---
    case 'echokit:gist:upload': {
      const { token, description, public: isPublic } = msg;
      if (!token) return { ok: false, error: 'missing github token' };
      const all = await getAllInteractions();
      const payload = { version: 2, exportedAt: new Date().toISOString(), interactions: all };
      try {
        const res = await fetch('https://api.github.com/gists', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github+json', 'Content-Type': 'application/json' },
          body: JSON.stringify({
            description: description || 'EchoKit mock set',
            public: !!isPublic,
            files: { 'echokit-mocks.json': { content: JSON.stringify(payload, null, 2) } }
          })
        });
        const j = await res.json();
        if (!res.ok) return { ok: false, error: j.message || `HTTP ${res.status}` };
        return { ok: true, url: j.html_url, rawUrl: j.files?.['echokit-mocks.json']?.raw_url, id: j.id };
      } catch (e) { return { ok: false, error: String(e) }; }
    }
    case 'echokit:gist:import': {
      const { url, strategy } = msg;
      if (!url) return { ok: false, error: 'missing gist url' };
      try {
        let rawUrl = url.trim();
        // Accept gist HTML URLs + extract id.
        const m = rawUrl.match(/gist\.github\.com\/(?:[^/]+\/)?([a-f0-9]+)/i);
        if (m) {
          const r = await fetch(`https://api.github.com/gists/${m[1]}`);
          if (!r.ok) return { ok: false, error: `gist fetch failed: ${r.status}` };
          const j = await r.json();
          const file = j.files['echokit-mocks.json'] || Object.values(j.files).find(f => f.filename.endsWith('.json'));
          if (!file) return { ok: false, error: 'no JSON file in gist' };
          rawUrl = file.raw_url;
        }
        const r = await fetch(rawUrl);
        if (!r.ok) return { ok: false, error: `fetch failed: ${r.status}` };
        const data = await r.json();
        if (!Array.isArray(data?.interactions)) return { ok: false, error: 'invalid payload' };
        if (strategy === 'override') await clearAllInteractions();
        for (const it of data.interactions) {
          if (!it.id || !it.hash) continue;
          if (!it.matchKeys) it.matchKeys = computeMatchKeys(it.method, it.url, it.requestBody);
          if (!it.matchMode) it.matchMode = 'strict';
          await putInteraction(it);
        }
        await pushAllTabs();
        return { ok: true, imported: data.interactions.length };
      } catch (e) { return { ok: false, error: String(e) }; }
    }

    case 'echokit:contentReady': { if (fromTabId != null) await pushTabMeta(fromTabId); return { ok: true }; }

    // --- License ---
    case 'echokit:license:check': {
      const proStatus = await getProStatus();
      const stored = await chrome.storage.sync.get('echokit_license');
      return { ok: true, pro: proStatus.pro, trial: proStatus.trial, trialDaysLeft: proStatus.trialDaysLeft, key: stored['echokit_license'] || '' };
    }
    case 'echokit:license:set': {
      const { key } = msg;
      if (!key) { await chrome.storage.sync.remove('echokit_license'); return { ok: true, pro: false }; }
      if (!validateLicenseKey(key.trim())) return { ok: false, error: 'Invalid license key. Expected EK-PRO-…, EK-YEAR-…, or EK-LTD-…' };
      await chrome.storage.sync.set({ echokit_license: key.trim() });
      return { ok: true, pro: true };
    }

    // --- Conditional mock hit tracking + mock chain advancement ---
    case 'echokit:mock:hit': {
      const { id } = msg.data || {};
      if (!id) return { ok: true };
      const existing = await getInteraction(id);
      if (!existing) return { ok: true };
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
        await putInteraction({ ...existing, ...updates });
        await pushAllTabs();
      }
      return { ok: true };
    }

    // --- HAR import ---
    case 'echokit:import:har': {
      const { data, strategy } = msg;
      if (!data?.log?.entries) return { ok: false, error: 'Invalid HAR — missing log.entries' };
      if (strategy === 'override') await clearAllInteractions();
      let imported = 0;
      for (const entry of data.log.entries) {
        try {
          const req = entry.request, res = entry.response;
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
            hash: mk.strict, matchKeys: mk, matchMode: 'strict',
            url, method, requestHeaders: reqHeaders, requestBody: reqBody,
            responseStatus: resStatus, responseHeaders: resHeaders, responseBody: resBody,
            timestamp: new Date(entry.startedDateTime || Date.now()).getTime(),
            durationMs: entry.time || 0, tabId: null, tabUrl: '', host: '',
            mockEnabled: true, mockLatency: 0, mockErrorMode: 'none',
            overrideStatus: null, overrideBody: null, overrideHeaders: null,
            activeVersionId: null, notes: 'HAR import', gqlOperation: '',
            mockMaxCount: null, mockCallCount: 0, wsLoop: false, blocked: false
          });
          imported++;
        } catch {}
      }
      await pushAllTabs();
      return { ok: true, imported };
    }

    // --- OpenAPI / Swagger import ---
    case 'echokit:import:openapi': {
      const { data, baseUrl: customBase } = msg;
      if (!data || (!data.openapi && !data.swagger && !data.paths)) return { ok: false, error: 'Not a valid OpenAPI / Swagger spec' };
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
          let resStatus = parseInt(successCode, 10) || 200;
          if (isSwagger2) {
            const ex = resp.examples?.['application/json'];
            resBody = ex ? JSON.stringify(ex) : (resp.schema?.example ? JSON.stringify(resp.schema.example) : '');
          } else {
            const c = resp.content?.['application/json'];
            resBody = c?.example ? JSON.stringify(c.example) : (c?.schema?.example ? JSON.stringify(c.schema.example) : '');
          }
          if (!resBody) resBody = `{"status":"${resp.description || 'ok'}"}`;
          const mk = computeMatchKeys(method, url, reqBody);
          await putInteraction({
            id: `int_oas_${Date.now()}_${imported}_${Math.random().toString(36).slice(2, 6)}`,
            hash: mk.strict, matchKeys: mk, matchMode: 'strict',
            url, method, requestHeaders: {}, requestBody: reqBody,
            responseStatus: resStatus, responseHeaders: { 'content-type': 'application/json' }, responseBody: resBody,
            timestamp: Date.now(), durationMs: 0, tabId: null, tabUrl: '', host: '',
            mockEnabled: true, mockLatency: 0, mockErrorMode: 'none',
            overrideStatus: null, overrideBody: null, overrideHeaders: null,
            activeVersionId: null, notes: `OpenAPI: ${op.summary || op.operationId || `${method} ${path}`}`, gqlOperation: '',
            mockMaxCount: null, mockCallCount: 0, wsLoop: false, blocked: false,
            mockChain: null, mockChainCursor: 0, mockChainLoop: true
          });
          imported++;
        }
      }
      await pushAllTabs();
      return { ok: true, imported };
    }

    // --- Postman collection export ---
    case 'echokit:export:postman': {
      const all = await getAllInteractions();
      const items = all.filter(i => i.method !== 'WS' && i.method !== 'SSE').map(i => {
        let urlObj; try { urlObj = new URL(i.url); } catch { urlObj = null; }
        return {
          name: `${i.method} ${urlObj?.pathname || i.url}`,
          request: {
            method: i.method,
            url: {
              raw: i.url,
              protocol: urlObj?.protocol?.replace(':', '') || 'https',
              host: urlObj ? urlObj.hostname.split('.') : [i.url],
              path: urlObj ? urlObj.pathname.split('/').filter(Boolean) : [],
              query: urlObj ? [...urlObj.searchParams.entries()].map(([k, v]) => ({ key: k, value: v })) : []
            },
            header: Object.entries(i.requestHeaders || {}).map(([k, v]) => ({ key: k, value: String(v) })),
            body: i.requestBody ? { mode: 'raw', raw: typeof i.requestBody === 'string' ? i.requestBody : JSON.stringify(i.requestBody), options: { raw: { language: 'json' } } } : undefined
          },
          response: [{
            name: 'Recorded Response',
            originalRequest: { method: i.method, url: { raw: i.url } },
            status: String(i.overrideStatus ?? i.responseStatus ?? 200),
            code: i.overrideStatus ?? i.responseStatus ?? 200,
            header: Object.entries(i.overrideHeaders || i.responseHeaders || {}).map(([k, v]) => ({ key: k, value: String(v) })),
            body: i.overrideBody ?? i.responseBody ?? ''
          }]
        };
      });
      return { ok: true, data: { info: { name: `EchoKit — ${new Date().toLocaleDateString()}`, description: 'Exported from EchoKit v1.5', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' }, item: items } };
    }

    default: return { ok: false, error: `unknown message: ${msg?.type}` };
  }
}

// ---------- Keyboard commands ----------
chrome.commands?.onCommand.addListener(async (cmd) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  const st = getTab(tab.id);
  if (cmd === 'toggle-recording') {
    if (st.recording) await handleMessage({ type: 'echokit:recording:stop', tabId: tab.id }, {});
    else await handleMessage({ type: 'echokit:recording:start', tabId: tab.id }, {});
  } else if (cmd === 'toggle-mocking') {
    await handleMessage({ type: 'echokit:mocking:toggle', tabId: tab.id, enabled: !st.mocking }, {});
  }
});

// ---------- Tab lifecycle ----------
chrome.tabs.onRemoved.addListener((tabId) => { tabState.delete(tabId); persistTabState(); });
chrome.tabs.onUpdated.addListener(async (tabId, info, tab) => {
  if (info.status === 'loading') setTimeout(() => pushTabMeta(tabId).catch(() => {}), 100);
  if (info.status === 'complete') {
    const st = getTab(tabId);
    if (st.recording && settings.autoOpenOnRefresh) { try { await chrome.action.openPopup({ windowId: tab.windowId }); } catch {} }
    await updateBadge(tabId);
  }
});
chrome.tabs.onActivated.addListener(({ tabId }) => updateBadge(tabId).catch(() => {}));

// ---------- Install / Startup ----------
chrome.runtime.onInstalled.addListener(async (info) => {
  await hydrate();
  await pushAllTabs();
  if (info.reason === 'install') {
    // Grant 7-day Pro trial automatically
    const trialExpiry = Date.now() + 7 * 24 * 60 * 60 * 1000;
    await chrome.storage.sync.set({ echokit_trial_expiry: trialExpiry });
    try { await chrome.tabs.create({ url: chrome.runtime.getURL('onboarding/welcome.html') }); } catch {}
  }
});
chrome.runtime.onStartup.addListener(async () => { await hydrate(); await pushAllTabs(); });
hydrate().then(pushAllTabs).catch(() => {});
