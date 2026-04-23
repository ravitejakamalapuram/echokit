// EchoKit — Background service worker.
// Coordinates recording + mocking state, owns IndexedDB, pushes mock-cache updates to tabs.

import { computeHash } from './shared/matcher.js';
import {
  putInteraction,
  getInteraction,
  deleteInteraction,
  getAllInteractions,
  clearSessionInteractions,
  clearAllInteractions,
  getMeta,
  setMeta
} from './shared/store.js';

const SESSION_KEY = 'echokit_tab_state';
const SETTINGS_KEY = 'echokit_settings';
const CORS_RULESET_ID = 1001;

// tabId -> { recording, mocking, sessionId }
const tabState = new Map();
let settings = { corsOverride: false };

// ---------- Tab state persistence ----------
async function hydrate() {
  try {
    const s = await chrome.storage.session.get(SESSION_KEY);
    const raw = s[SESSION_KEY];
    if (raw && typeof raw === 'object') {
      for (const [tid, v] of Object.entries(raw)) tabState.set(Number(tid), v);
    }
  } catch (e) { /* chrome.storage.session may not exist on older Chrome */ }
  const stored = await getMeta(SETTINGS_KEY, null);
  if (stored) settings = { ...settings, ...stored };
  await applyCorsRules();
}

async function persistTabState() {
  try {
    const obj = {};
    for (const [k, v] of tabState.entries()) obj[k] = v;
    await chrome.storage.session.set({ [SESSION_KEY]: obj });
  } catch (e) { /* ignore */ }
}

function getTab(tabId) {
  if (!tabState.has(tabId)) {
    tabState.set(tabId, { recording: false, mocking: false, sessionId: null });
  }
  return tabState.get(tabId);
}

// ---------- Mock cache management ----------
// We push a compact per-hash index of active mocks to tabs for synchronous lookup.
function buildMockIndex(interactions) {
  const index = {};
  for (const it of interactions) {
    if (!it.mockEnabled) continue;
    if (!index[it.hash]) index[it.hash] = [];
    index[it.hash].push({
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
  // Within each hash, sort by timestamp desc so latest is index [0].
  for (const h of Object.keys(index)) {
    index[h].sort((a, b) => b.timestamp - a.timestamp);
  }
  return index;
}

let mockIndexCache = {};
async function refreshMockIndex() {
  const all = await getAllInteractions();
  mockIndexCache = buildMockIndex(all);
  await broadcastToContentScripts({ type: 'echokit:mockIndex', payload: mockIndexCache });
}

async function broadcastToContentScripts(msg) {
  const tabs = await chrome.tabs.query({});
  for (const t of tabs) {
    if (!t.id) continue;
    chrome.tabs.sendMessage(t.id, msg).catch(() => {});
  }
}

async function sendToTab(tabId, msg) {
  try { await chrome.tabs.sendMessage(tabId, msg); } catch { /* tab may not have content script */ }
}

async function pushTabMeta(tabId) {
  const st = getTab(tabId);
  await sendToTab(tabId, { type: 'echokit:tabState', payload: { ...st, corsOverride: settings.corsOverride } });
  await sendToTab(tabId, { type: 'echokit:mockIndex', payload: mockIndexCache });
}

// ---------- CORS override via declarativeNetRequest ----------
async function applyCorsRules() {
  const ids = (await chrome.declarativeNetRequest.getDynamicRules()).map(r => r.id);
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: ids.length ? ids : [CORS_RULESET_ID]
  });
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
  return true; // async
});

// Exposed so that tests / other SW-context callers can invoke the handler directly
// (chrome.runtime.sendMessage from the SW itself is not delivered back to the SW).
globalThis.__echokitHandle = handleMessage;

async function handleMessage(msg, sender) {
  const fromTabId = sender?.tab?.id ?? msg?.tabId ?? null;
  switch (msg?.type) {
    case 'echokit:getState': {
      // Used by popup/panel.
      const tabId = msg.tabId ?? fromTabId;
      const all = await getAllInteractions();
      return {
        tab: tabId != null ? { tabId, ...getTab(tabId) } : null,
        settings,
        interactions: all,
        mockIndex: mockIndexCache
      };
    }
    case 'echokit:recording:start': {
      const tabId = msg.tabId;
      const st = getTab(tabId);
      st.recording = true;
      st.sessionId = `sess_${tabId}_${Date.now()}`;
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
    case 'echokit:session:clear': {
      const tabId = msg.tabId;
      const st = getTab(tabId);
      if (st.sessionId) await clearSessionInteractions(st.sessionId);
      await refreshMockIndex();
      return { ok: true };
    }
    case 'echokit:interaction:record': {
      // From content script (via injected hook).
      const { data } = msg;
      if (!data || !data.method || !data.url) return { ok: false };
      const tabId = fromTabId;
      const st = getTab(tabId);
      if (!st.recording) return { ok: false, reason: 'not-recording' };
      // Prefer the hash computed by the injected script (it's what will be used
      // for matching at replay time, so the two must be byte-identical).
      const hash = data.hash || computeHash(data.method, data.url, data.requestBody);
      const existing = await findInteractionByHashInSession(hash, st.sessionId);
      const interaction = {
        id: existing ? existing.id : `int_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        hash,
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
        // Editable overrides (default unset):
        mockEnabled: existing ? existing.mockEnabled : false,
        mockLatency: existing ? existing.mockLatency : 0,
        mockErrorMode: existing ? existing.mockErrorMode : 'none',
        overrideStatus: existing ? existing.overrideStatus : null,
        overrideBody: existing ? existing.overrideBody : null,
        overrideHeaders: existing ? existing.overrideHeaders : null,
        activeVersionId: existing ? existing.activeVersionId : null
      };
      await putInteraction(interaction);
      await refreshMockIndex();
      return { ok: true, id: interaction.id };
    }
    case 'echokit:interaction:update': {
      const existing = await getInteraction(msg.id);
      if (!existing) return { ok: false };
      const patch = msg.patch || {};
      const updated = { ...existing, ...patch };
      await putInteraction(updated);
      await refreshMockIndex();
      return { ok: true };
    }
    case 'echokit:interaction:delete': {
      await deleteInteraction(msg.id);
      await refreshMockIndex();
      return { ok: true };
    }
    case 'echokit:interactions:clearAll': {
      await clearAllInteractions();
      await refreshMockIndex();
      return { ok: true };
    }
    case 'echokit:interaction:setActiveVersion': {
      // Among all interactions sharing the same hash, mark one as active.
      const target = await getInteraction(msg.id);
      if (!target) return { ok: false };
      const all = await getAllInteractions();
      for (const it of all) {
        if (it.hash === target.hash) {
          await putInteraction({ ...it, activeVersionId: msg.id });
        }
      }
      await refreshMockIndex();
      return { ok: true };
    }
    case 'echokit:export': {
      const all = await getAllInteractions();
      return { ok: true, data: { version: 1, exportedAt: new Date().toISOString(), interactions: all } };
    }
    case 'echokit:import': {
      const { data, strategy } = msg; // strategy: 'override' | 'merge'
      if (!data || !Array.isArray(data.interactions)) return { ok: false, error: 'invalid payload' };
      if (strategy === 'override') await clearAllInteractions();
      for (const it of data.interactions) {
        if (!it.id || !it.hash) continue;
        await putInteraction(it);
      }
      await refreshMockIndex();
      return { ok: true, imported: data.interactions.length };
    }
    case 'echokit:settings:update': {
      settings = { ...settings, ...msg.patch };
      await setMeta(SETTINGS_KEY, settings);
      await applyCorsRules();
      await broadcastToContentScripts({ type: 'echokit:settings', payload: settings });
      return { ok: true, settings };
    }
    case 'echokit:contentReady': {
      // Content script announces itself after load — push current state.
      if (fromTabId != null) await pushTabMeta(fromTabId);
      return { ok: true };
    }
    default:
      return { ok: false, error: `unknown message: ${msg?.type}` };
  }
}

async function findInteractionByHashInSession(hash, sessionId) {
  if (!sessionId) return null;
  const all = await getAllInteractions();
  return all.find(i => i.hash === hash && i.sessionId === sessionId) || null;
}

// ---------- Tab lifecycle ----------
chrome.tabs.onRemoved.addListener((tabId) => {
  tabState.delete(tabId);
  persistTabState();
});

chrome.tabs.onUpdated.addListener((tabId, info) => {
  if (info.status === 'loading') {
    // Keep recording flag, but re-push state to freshly-loaded page.
    setTimeout(() => pushTabMeta(tabId), 50);
  }
});

// ---------- Init ----------
chrome.runtime.onInstalled.addListener(async () => {
  await hydrate();
  await refreshMockIndex();
});

chrome.runtime.onStartup.addListener(async () => {
  await hydrate();
  await refreshMockIndex();
});

// Top-level init (also covers SW restarts).
hydrate().then(refreshMockIndex).catch(() => {});
