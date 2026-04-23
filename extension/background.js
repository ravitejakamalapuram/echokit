// EchoKit — Background service worker.
// Owns: IndexedDB, per-tab recording/mocking state, scope-aware mock index broadcast,
// CORS DNR, keyboard commands, action badge, auto-open on refresh while recording.

import { computeHash, computeMatchKeys } from './shared/matcher.js';
import {
  putInteraction,
  getInteraction,
  deleteInteraction,
  getAllInteractions,
  clearAllInteractions,
  getMeta,
  setMeta
} from './shared/store.js';

const SESSION_KEY = 'echokit_tab_state';
const SETTINGS_KEY = 'echokit_settings';
const CORS_RULESET_ID = 1001;

// tabId -> { recording, mocking, sessionId, host }
const tabState = new Map();
let settings = {
  corsOverride: false,
  scope: 'domain',         // 'domain' | 'tab' | 'global'
  theme: 'dark',           // 'dark' | 'light' | 'auto'
  autoOpenOnRefresh: true
};

// ---------- Persistence ----------
async function hydrate() {
  try {
    const s = await chrome.storage.session.get(SESSION_KEY);
    const raw = s[SESSION_KEY];
    if (raw && typeof raw === 'object') {
      for (const [tid, v] of Object.entries(raw)) tabState.set(Number(tid), v);
    }
  } catch {}
  const stored = await getMeta(SETTINGS_KEY, null);
  if (stored) settings = { ...settings, ...stored };
  await applyCorsRules();
}

async function persistTabState() {
  try {
    const obj = {};
    for (const [k, v] of tabState.entries()) obj[k] = v;
    await chrome.storage.session.set({ [SESSION_KEY]: obj });
  } catch {}
}

function getTab(tabId) {
  if (!tabState.has(tabId)) tabState.set(tabId, { recording: false, mocking: false, sessionId: null, host: '' });
  return tabState.get(tabId);
}

// ---------- Host helpers ----------
function hostOf(url) {
  try { return new URL(url).host; } catch { return ''; }
}

// ---------- Scope-aware visibility + mock index ----------
function visibleInContext(interaction, ctx) {
  if (ctx.scope === 'global') return true;
  if (ctx.scope === 'tab') return interaction.tabId === ctx.tabId;
  // default: domain
  return hostOf(interaction.tabUrl || interaction.url) === ctx.host;
}

function buildMockIndexFor(interactions, ctx) {
  // Per-mode index: { mode -> { key -> [versions...] } }
  const index = { strict: {}, 'ignore-query': {}, 'ignore-body': {}, 'path-wildcard': {} };
  for (const it of interactions) {
    if (!it.mockEnabled) continue;
    if (!visibleInContext(it, ctx)) continue;
    const mode = it.matchMode || 'strict';
    const keys = it.matchKeys || { strict: it.hash };
    const key = keys[mode] || keys.strict;
    if (!key) continue;
    const bucket = index[mode] || (index[mode] = {});
    if (!bucket[key]) bucket[key] = [];
    bucket[key].push({
      id: it.id,
      status: it.overrideStatus != null ? it.overrideStatus : it.responseStatus,
      body: it.overrideBody != null ? it.overrideBody : it.responseBody,
      headers: it.overrideHeaders || it.responseHeaders || {},
      latency: it.mockLatency || 0,
      errorMode: it.mockErrorMode || 'none',
      timestamp: it.timestamp,
      activeVersionId: it.activeVersionId || null
    });
  }
  for (const m of Object.keys(index)) {
    for (const k of Object.keys(index[m])) {
      index[m][k].sort((a, b) => b.timestamp - a.timestamp);
    }
  }
  return index;
}

async function pushTabMeta(tabId) {
  const st = getTab(tabId);
  let tab;
  try { tab = await chrome.tabs.get(tabId); } catch { return; }
  if (!tab) return;
  st.host = hostOf(tab.url || '');
  const ctx = { tabId, host: st.host, scope: settings.scope };
  const all = await getAllInteractions();
  const mockIndex = buildMockIndexFor(all, ctx);
  safeSend(tabId, { type: 'echokit:tabState', payload: { ...st, corsOverride: settings.corsOverride, scope: settings.scope } });
  safeSend(tabId, { type: 'echokit:mockIndex', payload: mockIndex });
  await updateBadge(tabId);
}

async function pushAllTabs() {
  const tabs = await chrome.tabs.query({});
  for (const t of tabs) if (t.id != null) pushTabMeta(t.id).catch(() => {});
}

function safeSend(tabId, msg) {
  chrome.tabs.sendMessage(tabId, msg).catch(() => {});
}

// ---------- Action badge ----------
async function updateBadge(tabId) {
  const st = getTab(tabId);
  try {
    if (st.recording) {
      await chrome.action.setBadgeBackgroundColor({ color: '#ef4444', tabId });
      await chrome.action.setBadgeText({ tabId, text: 'REC' });
    } else if (st.mocking) {
      await chrome.action.setBadgeBackgroundColor({ color: '#fbbf24', tabId });
      await chrome.action.setBadgeText({ tabId, text: 'MOCK' });
    } else {
      await chrome.action.setBadgeText({ tabId, text: '' });
    }
  } catch {}
}

// ---------- CORS override via DNR ----------
async function applyCorsRules() {
  const current = (await chrome.declarativeNetRequest.getDynamicRules()).map(r => r.id);
  if (current.length) await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: current });
  if (!settings.corsOverride) return;
  await chrome.declarativeNetRequest.updateDynamicRules({
    addRules: [{
      id: CORS_RULESET_ID,
      priority: 1,
      action: {
        type: 'modifyHeaders',
        responseHeaders: [
          { header: 'Access-Control-Allow-Origin', operation: 'set', value: '*' },
          { header: 'Access-Control-Allow-Methods', operation: 'set', value: '*' },
          { header: 'Access-Control-Allow-Headers', operation: 'set', value: '*' },
          { header: 'Access-Control-Allow-Credentials', operation: 'set', value: 'true' }
        ]
      },
      condition: { urlFilter: '|http', resourceTypes: ['xmlhttprequest', 'sub_frame', 'main_frame', 'script', 'stylesheet', 'image', 'font', 'media', 'websocket', 'other'] }
    }]
  });
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
      const visible = all.filter(i => visibleInContext(i, ctx));
      return {
        tab: tabId != null ? { tabId, host, ...getTab(tabId) } : null,
        settings,
        interactions: visible,
        allCount: all.length,
        mockIndex: buildMockIndexFor(all, ctx)
      };
    }
    case 'echokit:recording:start': {
      const tabId = msg.tabId;
      const st = getTab(tabId);
      st.recording = true;
      st.sessionId = `sess_${tabId}_${Date.now()}`;
      try { const t = await chrome.tabs.get(tabId); st.host = hostOf(t?.url || ''); } catch {}
      await persistTabState();
      await pushTabMeta(tabId);
      return { ok: true, sessionId: st.sessionId };
    }
    case 'echokit:recording:stop': {
      const tabId = msg.tabId;
      const st = getTab(tabId);
      st.recording = false;
      await persistTabState();
      await pushTabMeta(tabId);
      return { ok: true };
    }
    case 'echokit:mocking:toggle': {
      const tabId = msg.tabId;
      const st = getTab(tabId);
      st.mocking = !!msg.enabled;
      await persistTabState();
      await pushTabMeta(tabId);
      return { ok: true };
    }
    case 'echokit:clear:scoped': {
      // Clear what the user currently sees (scope-filtered).
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
      const matchKeys = data.matchKeys || computeMatchKeys(data.method, data.url, data.requestBody);
      const hash = matchKeys.strict;
      // Upsert by hash within same tab.
      const all = await getAllInteractions();
      const existing = all.find(i => i.hash === hash && i.tabId === tabId) || null;
      const interaction = {
        id: existing ? existing.id : `int_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        hash,
        matchKeys,
        matchMode: existing ? (existing.matchMode || 'strict') : 'strict',
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
        notes: existing ? existing.notes : ''
      };
      await putInteraction(interaction);
      await pushAllTabs();
      return { ok: true, id: interaction.id };
    }
    case 'echokit:interaction:update': {
      const existing = await getInteraction(msg.id);
      if (!existing) return { ok: false };
      const updated = { ...existing, ...msg.patch };
      await putInteraction(updated);
      await pushAllTabs();
      return { ok: true };
    }
    case 'echokit:interaction:delete': {
      await deleteInteraction(msg.id);
      await pushAllTabs();
      return { ok: true };
    }
    case 'echokit:interactions:clearAll': {
      await clearAllInteractions();
      await pushAllTabs();
      return { ok: true };
    }
    case 'echokit:interaction:setActiveVersion': {
      const target = await getInteraction(msg.id);
      if (!target) return { ok: false };
      const all = await getAllInteractions();
      for (const it of all) {
        if (it.hash === target.hash) await putInteraction({ ...it, activeVersionId: msg.id });
      }
      await pushAllTabs();
      return { ok: true };
    }
    case 'echokit:export': {
      const all = await getAllInteractions();
      return { ok: true, data: { version: 2, exportedAt: new Date().toISOString(), interactions: all } };
    }
    case 'echokit:import': {
      const { data, strategy } = msg;
      if (!data || !Array.isArray(data.interactions)) return { ok: false, error: 'invalid payload' };
      if (strategy === 'override') await clearAllInteractions();
      for (const it of data.interactions) {
        if (!it.id || !it.hash) continue;
        // Backfill matchKeys if missing (v1 exports).
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
      await pushAllTabs();
      return { ok: true, settings };
    }
    case 'echokit:contentReady': {
      if (fromTabId != null) await pushTabMeta(fromTabId);
      return { ok: true };
    }
    default:
      return { ok: false, error: `unknown message: ${msg?.type}` };
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
chrome.tabs.onRemoved.addListener((tabId) => {
  tabState.delete(tabId);
  persistTabState();
});

chrome.tabs.onUpdated.addListener(async (tabId, info, tab) => {
  if (info.status === 'loading') {
    // A fresh document starts — re-push state so the injected script rehydrates.
    setTimeout(() => pushTabMeta(tabId).catch(() => {}), 100);
  }
  if (info.status === 'complete') {
    const st = getTab(tabId);
    if (st.recording && settings.autoOpenOnRefresh) {
      try { await chrome.action.openPopup({ windowId: tab.windowId }); }
      catch { /* openPopup requires focus; badge is our fallback */ }
    }
    await updateBadge(tabId);
  }
});

chrome.tabs.onActivated.addListener(({ tabId }) => updateBadge(tabId).catch(() => {}));

// ---------- Init ----------
chrome.runtime.onInstalled.addListener(async () => { await hydrate(); await pushAllTabs(); });
chrome.runtime.onStartup.addListener(async () => { await hydrate(); await pushAllTabs(); });
hydrate().then(pushAllTabs).catch(() => {});
