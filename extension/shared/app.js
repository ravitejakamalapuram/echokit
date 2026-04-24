// EchoKit — shared UI module.
// Used by both popup + devtools panel. Mode-switches layout, preserves scroll & cursor.

import { highlightJSON, isValidJSON } from './json-highlight.js';

const BG = (msg) => new Promise((resolve) => chrome.runtime.sendMessage(msg, resolve));

let state = {
  mode: 'popup',
  tabId: null,
  tab: { recording: false, mocking: false, sessionId: null, host: '' },
  settings: { corsOverride: false, scope: 'domain', theme: 'dark', autoOpenOnRefresh: true, blocklist: [] },
  interactions: [],
  allCount: 0,
  search: '',
  methodFilter: null,
  statusFilter: null,
  selectedId: null,
  detailOpen: false,
  menuOpen: false,
  listWidth: 360,
  clipboardPreview: null,
};

let root;

export async function initEchoKitUI({ mode, root: r, tabId }) {
  state.mode = mode;
  root = r;
  state.tabId = tabId ?? (await resolveTabId());

  await refresh();
  applyTheme();
  render();

  // Smart polling — only re-render when the user isn't interacting with an editable
  // field (preserves cursor), and preserve scroll positions of list + detail panes.
  setInterval(async () => {
    if (document.hidden) return;
    const ae = document.activeElement;
    const isEditing = ae && root.contains(ae) && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName);
    await refresh();
    if (!isEditing) render();
  }, 1500);

  // React instantly to pushes from the service worker (tabState, mockIndex, settings)
  chrome.runtime.onMessage.addListener((msg) => {
    if (!msg) return;
    if (msg.type === 'echokit:tabState' || msg.type === 'echokit:settings') {
      refresh().then(() => {
        const ae = document.activeElement;
        const isEditing = ae && root.contains(ae) && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName);
        if (!isEditing) render();
      });
    }
  });
}

async function resolveTabId() {
  if (typeof chrome !== 'undefined' && chrome.devtools?.inspectedWindow) {
    return chrome.devtools.inspectedWindow.tabId;
  }
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id ?? null;
}

async function refresh() {
  const resp = await BG({ type: 'echokit:getState', tabId: state.tabId });
  if (!resp) return;
  state.tab = resp.tab || state.tab;
  state.settings = { ...state.settings, ...(resp.settings || {}) };
  state.interactions = resp.interactions || [];
  state.allCount = resp.allCount || 0;
}

function applyTheme() {
  let theme = state.settings.theme || 'dark';
  if (theme === 'auto') {
    theme = window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  document.documentElement.setAttribute('data-theme', theme);
}

// ---------- render ----------
function render() {
  applyTheme();
  const snapshot = snapshotUIState();

  const isPopup = state.mode === 'popup';
  const list = filteredInteractions();
  const grouped = groupByDomain(list);
  const selected = state.selectedId ? state.interactions.find(i => i.id === state.selectedId) : null;
  const conflicts = selected ? state.interactions.filter(i => i.hash === selected.hash) : [];

  const appCls = `ek-app ${state.mode} ${state.detailOpen && isPopup ? 'detail-open' : ''}`;

  root.innerHTML = `
    <div class="${appCls}" data-testid="echokit-app" style="${isPopup ? '' : `--list-width:${state.listWidth}px`}">
      ${state.tab.mocking ? `<div class="ek-banner" data-testid="mock-active-banner"><span>Mocking Active — responses may be faked</span></div>` : ''}
      ${renderHeader()}
      ${renderToolbar()}
      <div class="ek-main">
        <div class="ek-list" data-testid="api-list">
          ${list.length === 0 ? renderEmpty() : grouped.map(renderDomainGroup).join('')}
        </div>
        ${isPopup ? '' : '<div class="ek-resizer" data-action="resize" data-testid="pane-resizer"></div>'}
        <div class="ek-detail" data-testid="api-detail">
          ${selected ? renderDetail(selected, conflicts) : renderDetailEmpty()}
        </div>
      </div>
      ${renderFooter(list.length)}
    </div>
  `;

  bindEvents();
  restoreUIState(snapshot);
  renderMenu();
  renderAllCodeEditors();
}

// Snapshot focus, selection, and scroll positions so we can restore after innerHTML wipe.
function snapshotUIState() {
  const list = root.querySelector('[data-testid="api-list"]');
  const detailBody = root.querySelector('[data-testid="api-detail"] .ek-detail-body');
  const ae = document.activeElement;
  let focus = null;
  if (ae && root.contains(ae)) {
    const testId = ae.getAttribute('data-testid');
    const action = ae.getAttribute('data-action');
    const id = ae.getAttribute('data-id');
    const key = ae.getAttribute('data-key');
    focus = {
      testId, action, id, key,
      selStart: ae.selectionStart ?? null,
      selEnd: ae.selectionEnd ?? null,
      scrollTop: ae.scrollTop ?? 0
    };
  }
  return {
    listScroll: list?.scrollTop ?? 0,
    detailScroll: detailBody?.scrollTop ?? 0,
    focus
  };
}

function restoreUIState(snap) {
  const list = root.querySelector('[data-testid="api-list"]');
  const detailBody = root.querySelector('[data-testid="api-detail"] .ek-detail-body');
  if (list) list.scrollTop = snap.listScroll;
  if (detailBody) detailBody.scrollTop = snap.detailScroll;
  if (!snap.focus) return;
  const { testId, action, id, key, selStart, selEnd, scrollTop } = snap.focus;
  let sel = '';
  if (testId) sel = `[data-testid="${testId}"]`;
  else if (action && id && key) sel = `[data-action="${action}"][data-id="${id}"][data-key="${key}"]`;
  else if (action && id) sel = `[data-action="${action}"][data-id="${id}"]`;
  else if (action) sel = `[data-action="${action}"]`;
  if (!sel) return;
  const el = root.querySelector(sel);
  if (!el) return;
  el.focus({ preventScroll: true });
  try { if (selStart != null && 'selectionStart' in el) el.setSelectionRange(selStart, selEnd ?? selStart); } catch {}
  if (scrollTop && 'scrollTop' in el) el.scrollTop = scrollTop;
}

function renderHeader() {
  const { recording, mocking } = state.tab;
  return `
    <div class="ek-header">
      <div class="ek-logo"><span class="ek-logo-mark">EK</span><span>ECHOKIT</span></div>
      <div class="ek-header-spacer"></div>
      ${recording
        ? `<button class="ek-btn ek-btn-record" data-action="stop-recording" data-testid="stop-recording-btn">STOP</button>`
        : `<button class="ek-btn" data-action="start-recording" data-testid="start-recording-btn">● REC</button>`}
      <label class="ek-switch ${mocking ? 'on' : ''}" data-testid="mock-master-toggle" title="Toggle mocking for this tab (Alt+Shift+M)">
        <input type="checkbox" ${mocking ? 'checked' : ''} data-action="toggle-mocking">
        <span class="ek-switch-track"></span>
        <span class="ek-switch-label">MOCK</span>
      </label>
      <div class="ek-menu">
        <button class="ek-btn ek-btn-ghost ek-btn-icon" data-action="toggle-menu" title="More actions" data-testid="menu-btn" aria-label="menu">
          <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><circle cx="4" cy="10" r="1.6"/><circle cx="10" cy="10" r="1.6"/><circle cx="16" cy="10" r="1.6"/></svg>
        </button>
      </div>
    </div>
  `;
}

function renderMenu() {
  // Remove any existing menu panel
  document.querySelectorAll('.ek-menu-panel').forEach(n => n.remove());
  if (!state.menuOpen) return;
  const anchor = root.querySelector('[data-testid="menu-btn"]');
  if (!anchor) return;
  const panel = document.createElement('div');
  panel.className = 'ek-menu-panel';
  panel.setAttribute('data-testid', 'menu-panel');
  const pasteHint = state.clipboardPreview
    ? `<span class="ek-subtle">${state.clipboardPreview.count} keys · ${escapeHtml(state.clipboardPreview.origin || '')}</span>`
    : `<span class="ek-subtle">nothing in clipboard</span>`;
  panel.innerHTML = `
    <button class="ek-menu-item" data-menu="clear" data-testid="menu-clear">Clear recordings <span class="ek-subtle">${state.interactions.length}</span></button>
    <button class="ek-menu-item" data-menu="export" data-testid="menu-export">Export JSON</button>
    <button class="ek-menu-item" data-menu="import" data-testid="menu-import">Import JSON</button>
    <div class="ek-menu-sep"></div>
    <button class="ek-menu-item" data-menu="ls-copy" data-testid="menu-ls-copy">Copy localStorage <span class="ek-subtle">active tab</span></button>
    <button class="ek-menu-item" data-menu="ls-paste" data-testid="menu-ls-paste" ${state.clipboardPreview ? 'style="border:1px solid rgba(251,191,36,0.4);background:rgba(251,191,36,0.06)"' : ''}>Paste localStorage ${pasteHint}</button>
    <div class="ek-menu-sep"></div>
    <button class="ek-menu-item" data-menu="gist-upload" data-testid="menu-gist-upload">Upload to GitHub Gist <span class="ek-subtle">share w/ team</span></button>
    <button class="ek-menu-item" data-menu="gist-import" data-testid="menu-gist-import">Import from Gist URL</button>
    <div class="ek-menu-sep"></div>
    <button class="ek-menu-item" data-menu="settings" data-testid="menu-settings">Settings <span class="ek-subtle">theme · scope · cors · blocklist</span></button>
    <button class="ek-menu-item" data-menu="shortcuts" data-testid="menu-shortcuts">Keyboard shortcuts</button>
  `;
  document.body.appendChild(panel);
  const rect = anchor.getBoundingClientRect();
  panel.style.position = 'fixed';
  panel.style.top = `${rect.bottom + 6}px`;
  panel.style.right = `${Math.max(8, window.innerWidth - rect.right)}px`;

  panel.querySelectorAll('[data-menu]').forEach(el => el.addEventListener('click', () => {
    const which = el.getAttribute('data-menu');
    state.menuOpen = false;
    if (which === 'clear') onClearSession();
    else if (which === 'export') onExport();
    else if (which === 'import') showImportDialog();
    else if (which === 'ls-copy') onCopyLocalStorage();
    else if (which === 'ls-paste') onPasteLocalStorage();
    else if (which === 'gist-upload') showGistUploadDialog();
    else if (which === 'gist-import') showGistImportDialog();
    else if (which === 'settings') showSettingsDialog();
    else if (which === 'shortcuts') showShortcutsDialog();
    document.querySelectorAll('.ek-menu-panel').forEach(n => n.remove());
  }));

  setTimeout(() => {
    const close = (ev) => {
      if (panel.contains(ev.target)) return;
      if (ev.target.closest('[data-testid="menu-btn"]')) return;
      state.menuOpen = false;
      panel.remove();
      document.removeEventListener('click', close, true);
    };
    document.addEventListener('click', close, true);
  }, 0);
}

async function tryReadClipboardPreview() {
  try {
    const text = await navigator.clipboard.readText();
    const j = JSON.parse(text);
    if (j && j.__echokit === 'localStorage' && j.keys && typeof j.keys === 'object') {
      state.clipboardPreview = { count: Object.keys(j.keys).length, origin: j.origin || '', payload: j };
    } else {
      state.clipboardPreview = null;
    }
  } catch { state.clipboardPreview = null; }
}

async function onCopyLocalStorage() {
  if (state.tabId == null) { alert('No active tab'); return; }
  const r = await BG({ type: 'echokit:localStorage:read', tabId: state.tabId });
  if (!r?.ok) { alert('Failed to read localStorage: ' + (r?.error || 'unknown — tab may not be http(s)')); return; }
  const payload = { __echokit: 'localStorage', version: 1, origin: r.origin, href: r.href, copiedAt: new Date().toISOString(), keys: r.keys };
  try {
    await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    await tryReadClipboardPreview();
    render();
    toast(`Copied ${r.count} localStorage keys from ${r.origin}`);
  } catch (e) { alert('Clipboard write failed: ' + e.message); }
}

async function onPasteLocalStorage() {
  await tryReadClipboardPreview();
  if (!state.clipboardPreview) { alert('Clipboard has no EchoKit localStorage payload.\nCopy from another tab first via Menu → Copy localStorage.'); return; }
  const { count, origin, payload } = state.clipboardPreview;
  showPasteDialog(count, origin, payload);
}

function showPasteDialog(count, origin, payload) {
  const overlay = document.createElement('div');
  overlay.className = 'ek-modal-overlay';
  const preview = Object.entries(payload.keys || {}).slice(0, 10).map(([k, v]) => `<div class="ek-kv-row"><span class="ek-tag" style="font-family:var(--font-mono)">${escapeHtml(k)}</span><span class="ek-subtle" style="font-family:var(--font-mono);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(String(v).slice(0, 80))}</span><span></span></div>`).join('');
  const more = Object.keys(payload.keys || {}).length > 10 ? `<div class="ek-subtle">…and ${Object.keys(payload.keys).length - 10} more</div>` : '';
  overlay.innerHTML = `
    <div class="ek-modal" data-testid="paste-modal">
      <div class="ek-modal-title">Paste localStorage</div>
      <div class="ek-subtle">${count} keys · from <span class="ek-tag">${escapeHtml(origin)}</span> → into <span class="ek-tag">${escapeHtml(state.tab.host || 'active tab')}</span></div>
      ${origin && state.tab.host && !origin.includes(state.tab.host) ? `<div class="ek-subtle" style="color:var(--amber)">⚠ Origins differ — paste will write into the current tab's origin, which may overwrite unrelated data.</div>` : ''}
      <div style="max-height:220px;overflow:auto">${preview}${more}</div>
      <label class="ek-row-inline" style="gap:6px;margin-top:4px">
        <input type="checkbox" data-a="clear-first" data-testid="paste-clear-first"/> <span>Clear existing localStorage before pasting</span>
      </label>
      <div class="ek-modal-actions">
        <button class="ek-btn ek-btn-ghost" data-a="cancel">Cancel</button>
        <button class="ek-btn ek-btn-primary" data-a="confirm" data-testid="paste-confirm">Apply</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  overlay.querySelector('[data-a="cancel"]').addEventListener('click', () => overlay.remove());
  overlay.querySelector('[data-a="confirm"]').addEventListener('click', async () => {
    const clearFirst = overlay.querySelector('[data-a="clear-first"]').checked;
    const r = await BG({ type: 'echokit:localStorage:write', tabId: state.tabId, keys: payload.keys, clearFirst });
    overlay.remove();
    if (r?.ok) toast(`Wrote ${r.written} keys to ${r.origin}. Reload the tab to apply.`);
    else alert('Paste failed: ' + (r?.error || 'unknown'));
  });
}

function toast(text) {
  const t = document.createElement('div');
  t.textContent = text;
  t.style.cssText = 'position:fixed;bottom:16px;left:50%;transform:translateX(-50%);background:var(--surface);color:var(--text);border:1px solid var(--border-strong);border-radius:8px;padding:10px 16px;font-size:12px;z-index:200;box-shadow:0 6px 24px rgba(0,0,0,0.4)';
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

// ---------- Gist sync ----------
function showGistUploadDialog() {
  const lastToken = localStorage.getItem('ek_gist_token') || '';
  const overlay = document.createElement('div');
  overlay.className = 'ek-modal-overlay';
  overlay.innerHTML = `
    <div class="ek-modal" data-testid="gist-upload-modal">
      <div class="ek-modal-title">Share mocks via GitHub Gist</div>
      <div class="ek-subtle">Uploads your full mock set as a JSON file to a new gist. Teammates can import from the URL.</div>
      <div class="ek-field">
        <div class="ek-label">GitHub Personal Access Token <span class="ek-subtle">(gist scope)</span></div>
        <input class="ek-input" type="password" value="${lastToken}" placeholder="ghp_..." data-a="token" data-testid="gist-token" autocomplete="off"/>
        <div class="ek-subtle" style="margin-top:4px">Create at <span class="ek-tag">github.com/settings/tokens</span> with just <span class="ek-tag">gist</span> scope. Stored locally in this extension only.</div>
      </div>
      <div class="ek-field">
        <div class="ek-label">Description</div>
        <input class="ek-input" type="text" value="EchoKit mock set — ${state.tab.host || ''}" data-a="desc" data-testid="gist-desc"/>
      </div>
      <label class="ek-row-inline" style="gap:6px"><input type="checkbox" data-a="public"/> <span>Public gist</span></label>
      <div class="ek-modal-actions">
        <button class="ek-btn ek-btn-ghost" data-a="cancel">Cancel</button>
        <button class="ek-btn ek-btn-primary" data-a="upload" data-testid="gist-upload-confirm">Upload</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  overlay.querySelector('[data-a="cancel"]').addEventListener('click', () => overlay.remove());
  overlay.querySelector('[data-a="upload"]').addEventListener('click', async (e) => {
    const token = overlay.querySelector('[data-a="token"]').value.trim();
    const desc = overlay.querySelector('[data-a="desc"]').value;
    const pub = overlay.querySelector('[data-a="public"]').checked;
    if (!token) return alert('Paste a GitHub token with gist scope first.');
    localStorage.setItem('ek_gist_token', token);
    e.target.disabled = true; e.target.textContent = 'Uploading…';
    const r = await BG({ type: 'echokit:gist:upload', token, description: desc, public: pub });
    overlay.remove();
    if (r?.ok) {
      try { await navigator.clipboard.writeText(r.url); } catch {}
      toast(`Uploaded — gist URL copied: ${r.url}`);
    } else alert('Gist upload failed: ' + (r?.error || 'unknown'));
  });
}

function showGistImportDialog() {
  const overlay = document.createElement('div');
  overlay.className = 'ek-modal-overlay';
  overlay.innerHTML = `
    <div class="ek-modal" data-testid="gist-import-modal">
      <div class="ek-modal-title">Import mocks from Gist</div>
      <div class="ek-subtle">Paste a public gist URL or a raw file URL. No token needed for public gists.</div>
      <input class="ek-input" type="text" placeholder="https://gist.github.com/user/abc123..." data-a="url" data-testid="gist-url"/>
      <label class="ek-row-inline" style="gap:6px"><input type="radio" name="ek-gst" value="merge" checked/> <span>Merge (replace by id)</span></label>
      <label class="ek-row-inline" style="gap:6px"><input type="radio" name="ek-gst" value="override"/> <span>Override (wipe existing)</span></label>
      <div class="ek-modal-actions">
        <button class="ek-btn ek-btn-ghost" data-a="cancel">Cancel</button>
        <button class="ek-btn ek-btn-primary" data-a="import" data-testid="gist-import-confirm">Import</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  overlay.querySelector('[data-a="cancel"]').addEventListener('click', () => overlay.remove());
  overlay.querySelector('[data-a="import"]').addEventListener('click', async (e) => {
    const url = overlay.querySelector('[data-a="url"]').value.trim();
    const strategy = overlay.querySelector('input[name="ek-gst"]:checked').value;
    if (!url) return alert('Paste a gist URL first.');
    e.target.disabled = true; e.target.textContent = 'Importing…';
    const r = await BG({ type: 'echokit:gist:import', url, strategy });
    overlay.remove();
    if (r?.ok) { await refresh(); render(); toast(`Imported ${r.imported} mocks from gist`); }
    else alert('Gist import failed: ' + (r?.error || 'unknown'));
  });
}

function renderToolbar() {
  const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
  return `
    <div class="ek-toolbar">
      <input class="ek-search" type="text" placeholder="search url…" value="${escapeHtml(state.search)}" data-action="search" data-testid="search-input" autocomplete="off" spellcheck="false"/>
      <div class="ek-method-chips">
        ${methods.map(m => `<button class="ek-chip ${state.methodFilter === m ? 'active' : ''}" data-action="filter-method" data-method="${m}" data-testid="filter-${m.toLowerCase()}">${m}</button>`).join('')}
      </div>
      <select class="ek-select" data-action="filter-status" style="max-width: 110px" data-testid="filter-status">
        <option value="">status: all</option>
        <option value="2" ${state.statusFilter === '2' ? 'selected' : ''}>2xx</option>
        <option value="3" ${state.statusFilter === '3' ? 'selected' : ''}>3xx</option>
        <option value="4" ${state.statusFilter === '4' ? 'selected' : ''}>4xx</option>
        <option value="5" ${state.statusFilter === '5' ? 'selected' : ''}>5xx</option>
        <option value="0" ${state.statusFilter === '0' ? 'selected' : ''}>failed</option>
      </select>
    </div>
  `;
}

function renderEmpty() {
  return `
    <div class="ek-empty" data-testid="empty-state">
      <div class="ek-empty-mark">[ EK ]</div>
      <div class="ek-empty-title">${state.tab.recording ? 'Listening for API calls…' : 'No requests recorded yet'}</div>
      <div class="ek-empty-hint">${state.tab.recording
        ? `Trigger some fetch or XHR calls on <span class="ek-tag">${escapeHtml(state.tab.host || 'this page')}</span> — they'll appear here instantly.`
        : 'Hit the ● REC button above (or press <span class="ek-kbd">Alt+Shift+R</span>) to start capturing fetch/XHR on this tab.'}</div>
      ${state.allCount > 0 ? `<div class="ek-subtle">${state.allCount} recordings exist in other scopes — change <em>Scope</em> in Settings to see them.</div>` : ''}
    </div>
  `;
}

function renderDomainGroup(g) {
  return `
    <div class="ek-domain" data-testid="domain-group">${escapeHtml(g.domain)} <span class="ek-domain-count">· ${g.items.length}</span></div>
    ${g.items.map(renderRow).join('')}
  `;
}

function renderRow(i) {
  const versionCount = state.interactions.filter(x => x.hash === i.hash).length;
  const conflict = versionCount > 1;
  const active = state.selectedId === i.id ? 'active' : '';
  const method = (i.method || 'GET').toUpperCase();
  const urlPretty = prettyUrl(i.url);
  const statusClass = 's' + String(Math.floor((i.responseStatus || 0) / 100));
  const mode = i.matchMode || 'strict';
  return `
    <div class="ek-row ${active}" data-id="${i.id}" data-action="select" data-testid="api-row">
      <span class="ek-method ${method}">${method}</span>
      <div class="ek-url" title="${escapeHtml(i.url)}"><span class="ek-url-path">${escapeHtml(urlPretty.path)}</span><span class="ek-url-query">${escapeHtml(urlPretty.query)}</span></div>
      ${mode !== 'strict' ? `<span class="ek-mode-badge" title="match mode: ${mode}">${modeBadge(mode)}</span>` : ''}
      ${conflict ? `<span class="ek-conflict-badge" title="${versionCount} versions">×${versionCount}</span>` : ''}
      <span class="ek-status ${statusClass}">${i.responseStatus || 'ERR'}</span>
      <button class="ek-mock-toggle ${i.mockEnabled ? 'on' : ''}" data-action="toggle-mock" data-id="${i.id}" title="${i.mockEnabled ? 'Mock ON' : 'Mock OFF'}" data-testid="mock-toggle"></button>
    </div>
  `;
}
function modeBadge(mode) {
  return { 'ignore-query': 'NOQ', 'ignore-body': 'NOB', 'path-wildcard': 'PATH' }[mode] || mode;
}

function renderDetailEmpty() {
  if (state.mode === 'popup' && !state.detailOpen) {
    return `<div class="ek-empty"><div class="ek-empty-hint ek-subtle">Tap a request to edit its mock.</div></div>`;
  }
  return `<div class="ek-empty"><div class="ek-empty-mark">·</div><div class="ek-empty-title">Select a request</div><div class="ek-empty-hint">Click any API call on the left to inspect + edit its mocked response.</div></div>`;
}

function renderDetail(i, conflicts) {
  const activeId = conflicts.length > 1 ? (i.activeVersionId || conflicts.sort((a,b)=>b.timestamp-a.timestamp)[0].id) : i.id;
  const overrideBody = i.overrideBody ?? i.responseBody ?? '';
  const overrideStatus = i.overrideStatus ?? i.responseStatus ?? 200;
  const overrideHeaders = i.overrideHeaders || i.responseHeaders || {};
  const matchMode = i.matchMode || 'strict';

  return `
    <div class="ek-detail-head">
      <span class="ek-method ${(i.method||'GET').toUpperCase()}">${(i.method||'GET').toUpperCase()}</span>
      <div class="ek-detail-title">${escapeHtml(i.url)}</div>
      <button class="ek-close" data-action="close-detail" data-testid="close-detail" aria-label="close">✕</button>
    </div>
    <div class="ek-detail-body">
      ${conflicts.length > 1 ? `
      <div class="ek-section" data-testid="conflict-picker">
        <div class="ek-section-head">
          <span>Multiple Versions</span>
          <span class="ek-conflict-badge">${conflicts.length}</span>
          <div class="ek-row-inline-end ek-version-picker">
            <select class="ek-select" data-action="set-active-version" data-testid="version-select">
              ${conflicts.sort((a,b)=>b.timestamp-a.timestamp).map(c =>
                `<option value="${c.id}" ${c.id === activeId ? 'selected' : ''}>${new Date(c.timestamp).toLocaleString()} — ${c.responseStatus}</option>`
              ).join('')}
            </select>
          </div>
        </div>
        <div class="ek-section-body ek-subtle">Latest version is used by default. Pick another to force it active when mocking.</div>
      </div>` : ''}

      <div class="ek-section">
        <div class="ek-section-head">
          <span>Mock Behaviour</span>
          <div class="ek-row-inline-end">
            <label class="ek-switch ${i.mockEnabled ? 'on' : ''}">
              <input type="checkbox" ${i.mockEnabled ? 'checked' : ''} data-action="toggle-mock" data-id="${i.id}"/>
              <span class="ek-switch-track"></span>
              <span class="ek-switch-label">${i.mockEnabled ? 'ON' : 'OFF'}</span>
            </label>
          </div>
        </div>
        <div class="ek-section-body">
          <div class="ek-sim-grid">
            <div class="ek-field">
              <div class="ek-label">Match Mode</div>
              <select class="ek-select" data-action="update-match-mode" data-id="${i.id}" data-testid="match-mode-select">
                <option value="strict" ${matchMode==='strict'?'selected':''}>strict — method + url + body</option>
                <option value="ignore-query" ${matchMode==='ignore-query'?'selected':''}>ignore query params</option>
                <option value="ignore-body" ${matchMode==='ignore-body'?'selected':''}>ignore body</option>
                <option value="path-wildcard" ${matchMode==='path-wildcard'?'selected':''}>path only (wildcard)</option>
                <option value="graphql" ${matchMode==='graphql'?'selected':''}>graphql — op + query + vars</option>
                <option value="graphql-op" ${matchMode==='graphql-op'?'selected':''}>graphql — op + query (any vars)</option>
              </select>
            </div>
            <div class="ek-field">
              <div class="ek-label">Latency (ms)</div>
              <div class="ek-row-inline">
                <input class="ek-slider" type="range" min="0" max="10000" step="50" value="${i.mockLatency || 0}" data-action="update-latency" data-id="${i.id}" data-testid="latency-slider"/>
                <input class="ek-input" type="number" min="0" style="max-width: 88px" value="${i.mockLatency || 0}" data-action="update-latency-input" data-id="${i.id}"/>
              </div>
            </div>
          </div>
          <div class="ek-field">
            <div class="ek-label">Error Simulation</div>
            <select class="ek-select" data-action="update-error-mode" data-id="${i.id}" data-testid="error-mode-select">
              <option value="none" ${i.mockErrorMode === 'none' || !i.mockErrorMode ? 'selected' : ''}>none</option>
              <option value="4xx" ${i.mockErrorMode === '4xx' ? 'selected' : ''}>force 4xx (400)</option>
              <option value="5xx" ${i.mockErrorMode === '5xx' ? 'selected' : ''}>force 5xx (500)</option>
              <option value="network" ${i.mockErrorMode === 'network' ? 'selected' : ''}>block / network failure</option>
              <option value="timeout" ${i.mockErrorMode === 'timeout' ? 'selected' : ''}>timeout (hang)</option>
            </select>
          </div>
        </div>
      </div>

      <div class="ek-section">
        <div class="ek-section-head"><span>Response</span></div>
        <div class="ek-section-body">
          <div class="ek-field">
            <div class="ek-label">Status Code</div>
            <input class="ek-input" type="number" value="${overrideStatus}" data-action="update-status" data-id="${i.id}" data-testid="status-input"/>
          </div>
          <div class="ek-field">
            <div class="ek-label">Body (raw JSON or text)</div>
            <div class="ek-code-editor" data-testid="body-editor-wrap">
              <pre class="ek-code-mirror" data-mirror-for="body-${i.id}" aria-hidden="true"></pre>
              <textarea class="ek-code-input" spellcheck="false" data-action="update-body" data-id="${i.id}" data-testid="body-editor" data-ce-id="body-${i.id}">${escapeHtml(typeof overrideBody === 'string' ? overrideBody : JSON.stringify(overrideBody))}</textarea>
            </div>
            <div class="ek-row-inline" style="margin-top:6px;gap:6px">
              <button class="ek-btn ek-btn-ghost" data-action="format-json" data-id="${i.id}" data-testid="format-json-btn">Format JSON</button>
              <button class="ek-btn ek-btn-ghost" data-action="reset-body" data-id="${i.id}">Reset</button>
              <span class="ek-subtle ek-row-inline-end" data-testid="body-save-status">saved</span>
            </div>
          </div>
          <div class="ek-field">
            <div class="ek-label">Headers</div>
            <div data-testid="headers-list">
              ${Object.entries(overrideHeaders).map(([k, v], idx) => `
                <div class="ek-kv-row">
                  <input class="ek-input" value="${escapeHtml(k)}" data-action="header-key" data-id="${i.id}" data-idx="${idx}" data-orig="${escapeHtml(k)}"/>
                  <input class="ek-input" value="${escapeHtml(String(v))}" data-action="header-val" data-id="${i.id}" data-key="${escapeHtml(k)}"/>
                  <button class="ek-kv-remove" data-action="header-remove" data-id="${i.id}" data-key="${escapeHtml(k)}" aria-label="remove">×</button>
                </div>
              `).join('')}
            </div>
            <button class="ek-btn ek-btn-ghost" data-action="header-add" data-id="${i.id}" style="margin-top: 4px">＋ Add header</button>
          </div>
        </div>
      </div>

      <div class="ek-section">
        <div class="ek-section-head"><span>Request</span></div>
        <div class="ek-section-body">
          <div class="ek-field">
            <div class="ek-label">Body</div>
            <div class="ek-code-editor">
              <pre class="ek-code-mirror" data-mirror-for="req-${i.id}" aria-hidden="true"></pre>
              <textarea class="ek-code-input" readonly spellcheck="false" data-ce-id="req-${i.id}">${escapeHtml(typeof i.requestBody === 'string' ? i.requestBody : (i.requestBody == null ? '' : JSON.stringify(i.requestBody)))}</textarea>
            </div>
          </div>
          <div class="ek-field">
            <div class="ek-label">Headers</div>
            <pre class="ek-textarea" style="min-height: 60px">${escapeHtml(Object.entries(i.requestHeaders || {}).map(([k, v]) => `${k}: ${v}`).join('\n'))}</pre>
          </div>
        </div>
      </div>

      <div class="ek-row-inline">
        <button class="ek-btn ek-btn-danger" data-action="delete-interaction" data-id="${i.id}" data-testid="delete-btn">Delete this mock</button>
        <div class="ek-row-inline-end ek-subtle">hash <span class="ek-tag">${i.hash}</span></div>
      </div>
    </div>
  `;
}

function renderFooter(count) {
  const recTag = state.tab.recording ? `<span class="ek-tag on">REC</span>` : `<span class="ek-tag">idle</span>`;
  const mockTag = state.tab.mocking ? `<span class="ek-tag amber">MOCK ON</span>` : '';
  const corsTag = state.settings.corsOverride ? `<span class="ek-tag amber" data-action="toggle-cors" data-testid="cors-chip" title="CORS override is ON — click to open settings">CORS</span>` : '';
  const scope = state.settings.scope || 'domain';
  return `
    <div class="ek-footer">
      ${recTag} ${mockTag} ${corsTag}
      <span class="ek-subtle">${count} request${count === 1 ? '' : 's'}</span>
      <span class="ek-subtle">· scope: <span class="ek-tag" data-action="cycle-scope" data-testid="scope-chip" title="click to change scope">${scope}</span></span>
      <span class="ek-row-inline-end ek-subtle">${state.tab.host ? escapeHtml(state.tab.host) : `tab #${state.tabId ?? '—'}`}</span>
    </div>
  `;
}

// ---------- code-editor wiring (syntax highlighting overlay) ----------
function renderAllCodeEditors() {
  root.querySelectorAll('textarea[data-ce-id]').forEach(ta => {
    const id = ta.getAttribute('data-ce-id');
    const mirror = root.querySelector(`.ek-code-mirror[data-mirror-for="${id}"]`);
    if (!mirror) return;
    const sync = () => {
      mirror.innerHTML = highlightJSON(ta.value) + '\n'; // trailing NL so last line aligns
      mirror.scrollTop = ta.scrollTop;
      mirror.scrollLeft = ta.scrollLeft;
      const wrap = ta.closest('.ek-code-editor');
      if (wrap) wrap.classList.toggle('invalid', !!(ta.value.trim() && !isValidJSON(ta.value)));
    };
    sync();
    ta.addEventListener('input', sync);
    ta.addEventListener('scroll', () => { mirror.scrollTop = ta.scrollTop; mirror.scrollLeft = ta.scrollLeft; });
  });
}

// ---------- events ----------
function bindEvents() {
  root.querySelectorAll('[data-action]').forEach(el => {
    const action = el.getAttribute('data-action');
    const id = el.getAttribute('data-id');

    if (action === 'select') el.addEventListener('click', (e) => {
      if (e.target.closest('[data-action="toggle-mock"]')) return;
      state.selectedId = el.getAttribute('data-id');
      state.detailOpen = true; render();
    });
    else if (action === 'start-recording') el.addEventListener('click', onStartRecording);
    else if (action === 'stop-recording') el.addEventListener('click', onStopRecording);
    else if (action === 'toggle-mocking') el.addEventListener('change', onToggleMocking);
    else if (action === 'toggle-menu') el.addEventListener('click', async (e) => { e.stopPropagation(); state.menuOpen = !state.menuOpen; if (state.menuOpen) await tryReadClipboardPreview(); renderMenu(); });
    else if (action === 'toggle-cors') el.addEventListener('click', () => { state.menuOpen = false; showSettingsDialog(); });
    else if (action === 'cycle-scope') el.addEventListener('click', async () => {
      const order = ['domain', 'tab', 'global'];
      const next = order[(order.indexOf(state.settings.scope || 'domain') + 1) % order.length];
      await BG({ type: 'echokit:settings:update', patch: { scope: next } });
      await refresh(); render();
    });
    else if (action === 'search') {
      // Soft update: do not full-render on every keystroke. Update state + only
      // re-render the list/footer so the search input itself is untouched.
      let t;
      el.addEventListener('input', (e) => {
        state.search = e.target.value;
        clearTimeout(t);
        t = setTimeout(() => softRenderList(), 80);
      });
    }
    else if (action === 'filter-method') el.addEventListener('click', () => {
      const m = el.getAttribute('data-method');
      state.methodFilter = state.methodFilter === m ? null : m;
      render();
    });
    else if (action === 'filter-status') el.addEventListener('change', (e) => { state.statusFilter = e.target.value || null; render(); });
    else if (action === 'toggle-mock') {
      const handler = async () => {
        const current = state.interactions.find(x => x.id === id);
        if (!current) return;
        await BG({ type: 'echokit:interaction:update', id, patch: { mockEnabled: !current.mockEnabled } });
        await refresh(); render();
      };
      if (el.tagName === 'INPUT') el.addEventListener('change', handler);
      else el.addEventListener('click', (e) => { e.stopPropagation(); handler(); });
    }
    else if (action === 'update-latency' || action === 'update-latency-input') el.addEventListener('change', async (e) => {
      await BG({ type: 'echokit:interaction:update', id, patch: { mockLatency: Number(e.target.value) || 0 } });
      await refresh(); render();
    });
    else if (action === 'update-error-mode') el.addEventListener('change', async (e) => {
      await BG({ type: 'echokit:interaction:update', id, patch: { mockErrorMode: e.target.value } });
      await refresh(); render();
    });
    else if (action === 'update-match-mode') el.addEventListener('change', async (e) => {
      await BG({ type: 'echokit:interaction:update', id, patch: { matchMode: e.target.value } });
      await refresh(); render();
    });
    else if (action === 'update-status') el.addEventListener('change', async (e) => {
      await BG({ type: 'echokit:interaction:update', id, patch: { overrideStatus: Number(e.target.value) || 200 } });
      await refresh(); render();
    });
    else if (action === 'update-body') {
      let t;
      el.addEventListener('input', (e) => {
        const v = e.target.value;
        const saveStatus = root.querySelector('[data-testid="body-save-status"]');
        if (saveStatus) saveStatus.textContent = 'saving…';
        clearTimeout(t);
        t = setTimeout(async () => {
          await BG({ type: 'echokit:interaction:update', id, patch: { overrideBody: v } });
          await refresh();
          if (saveStatus) saveStatus.textContent = 'saved';
        }, 400);
      });
    }
    else if (action === 'format-json') el.addEventListener('click', async () => {
      const ta = root.querySelector('textarea[data-action="update-body"]');
      if (!ta) return;
      try {
        const p = JSON.parse(ta.value);
        const pretty = JSON.stringify(p, null, 2);
        ta.value = pretty;
        await BG({ type: 'echokit:interaction:update', id, patch: { overrideBody: pretty } });
        await refresh(); render();
      } catch {}
    });
    else if (action === 'reset-body') el.addEventListener('click', async () => {
      await BG({ type: 'echokit:interaction:update', id, patch: { overrideBody: null } });
      await refresh(); render();
    });
    else if (action === 'header-add') el.addEventListener('click', async () => {
      const curr = state.interactions.find(x => x.id === id);
      const headers = { ...(curr.overrideHeaders || curr.responseHeaders || {}) };
      let k = 'x-custom-header', i2 = 1;
      while (headers[k]) k = `x-custom-header-${i2++}`;
      headers[k] = '';
      await BG({ type: 'echokit:interaction:update', id, patch: { overrideHeaders: headers } });
      await refresh(); render();
    });
    else if (action === 'header-remove') el.addEventListener('click', async () => {
      const key = el.getAttribute('data-key');
      const curr = state.interactions.find(x => x.id === id);
      const headers = { ...(curr.overrideHeaders || curr.responseHeaders || {}) };
      delete headers[key];
      await BG({ type: 'echokit:interaction:update', id, patch: { overrideHeaders: headers } });
      await refresh(); render();
    });
    else if (action === 'header-key') el.addEventListener('change', async (e) => {
      const orig = el.getAttribute('data-orig');
      const next = e.target.value.trim();
      if (!next || next === orig) return;
      const curr = state.interactions.find(x => x.id === id);
      const headers = { ...(curr.overrideHeaders || curr.responseHeaders || {}) };
      headers[next] = headers[orig]; delete headers[orig];
      await BG({ type: 'echokit:interaction:update', id, patch: { overrideHeaders: headers } });
      await refresh(); render();
    });
    else if (action === 'header-val') el.addEventListener('change', async (e) => {
      const key = el.getAttribute('data-key');
      const curr = state.interactions.find(x => x.id === id);
      const headers = { ...(curr.overrideHeaders || curr.responseHeaders || {}) };
      headers[key] = e.target.value;
      await BG({ type: 'echokit:interaction:update', id, patch: { overrideHeaders: headers } });
      await refresh();
    });
    else if (action === 'delete-interaction') el.addEventListener('click', async () => {
      if (!confirm('Delete this recorded API? This cannot be undone.')) return;
      await BG({ type: 'echokit:interaction:delete', id });
      state.selectedId = null; state.detailOpen = false;
      await refresh(); render();
    });
    else if (action === 'set-active-version') el.addEventListener('change', async (e) => {
      await BG({ type: 'echokit:interaction:setActiveVersion', id: e.target.value });
      await refresh(); render();
    });
    else if (action === 'close-detail') el.addEventListener('click', () => { state.detailOpen = false; state.selectedId = null; render(); });
    else if (action === 'resize') bindResizer(el);
  });
}

function bindResizer(el) {
  let startX = 0, startW = state.listWidth;
  const onMove = (ev) => {
    const dx = ev.clientX - startX;
    state.listWidth = Math.max(260, Math.min(window.innerWidth * 0.6, startW + dx));
    const app = root.querySelector('.ek-app');
    if (app) app.style.setProperty('--list-width', `${state.listWidth}px`);
  };
  const onUp = () => {
    el.classList.remove('dragging');
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
  };
  el.addEventListener('mousedown', (ev) => {
    startX = ev.clientX; startW = state.listWidth;
    el.classList.add('dragging');
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    ev.preventDefault();
  });
}

// Update just the list + footer without touching the toolbar/search (avoids cursor reset)
function softRenderList() {
  const list = root.querySelector('[data-testid="api-list"]');
  if (!list) return render();
  const items = filteredInteractions();
  const grouped = groupByDomain(items);
  const scrollTop = list.scrollTop;
  list.innerHTML = items.length === 0 ? renderEmpty() : grouped.map(renderDomainGroup).join('');
  list.scrollTop = scrollTop;
  // rebind list-level events
  list.querySelectorAll('[data-action="select"]').forEach(el => el.addEventListener('click', (e) => {
    if (e.target.closest('[data-action="toggle-mock"]')) return;
    state.selectedId = el.getAttribute('data-id'); state.detailOpen = true; render();
  }));
  list.querySelectorAll('[data-action="toggle-mock"]').forEach(el => {
    el.addEventListener('click', async (e) => {
      e.stopPropagation();
      const tid = el.getAttribute('data-id');
      const current = state.interactions.find(x => x.id === tid);
      if (!current) return;
      await BG({ type: 'echokit:interaction:update', id: tid, patch: { mockEnabled: !current.mockEnabled } });
      await refresh(); render();
    });
  });
  // Update footer count
  const footer = root.querySelector('.ek-footer');
  if (footer) footer.outerHTML = renderFooter(items.length);
}

// ---------- actions ----------
async function onStartRecording() {
  if (state.tabId == null) return;
  await BG({ type: 'echokit:recording:start', tabId: state.tabId });
  await refresh(); render();
}
async function onStopRecording() {
  await BG({ type: 'echokit:recording:stop', tabId: state.tabId });
  await refresh(); render();
}
async function onToggleMocking(e) {
  await BG({ type: 'echokit:mocking:toggle', tabId: state.tabId, enabled: e.target.checked });
  await refresh(); render();
}
async function onClearSession() {
  if (!confirm(`Clear ${state.interactions.length} recordings visible in the current scope (${state.settings.scope})?`)) return;
  await BG({ type: 'echokit:clear:scoped', tabId: state.tabId });
  state.selectedId = null; state.detailOpen = false;
  await refresh(); render();
}
async function onExport() {
  const res = await BG({ type: 'echokit:export' });
  const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `echokit-export-${Date.now()}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}
function showImportDialog() {
  const overlay = document.createElement('div');
  overlay.className = 'ek-modal-overlay';
  overlay.innerHTML = `
    <div class="ek-modal" data-testid="import-modal">
      <div class="ek-modal-title">Import mocks</div>
      <div class="ek-subtle">Paste an EchoKit export JSON, or choose a file.</div>
      <textarea class="ek-textarea" style="min-height:120px" placeholder='{"version":2,"interactions":[…]}'></textarea>
      <input type="file" accept="application/json,.json" data-testid="import-file"/>
      <label class="ek-row-inline" style="gap:6px">
        <input type="radio" name="ek-strategy" value="merge" checked/> <span>Merge (replace by id)</span>
      </label>
      <label class="ek-row-inline" style="gap:6px">
        <input type="radio" name="ek-strategy" value="override"/> <span>Override (wipe existing)</span>
      </label>
      <div class="ek-modal-actions">
        <button class="ek-btn ek-btn-ghost" data-a="cancel">Cancel</button>
        <button class="ek-btn ek-btn-primary" data-a="confirm" data-testid="import-confirm">Import</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  const fileInput = overlay.querySelector('input[type="file"]');
  const ta = overlay.querySelector('textarea');
  fileInput.addEventListener('change', async () => { const f = fileInput.files?.[0]; if (f) ta.value = await f.text(); });
  overlay.querySelector('[data-a="cancel"]').addEventListener('click', () => overlay.remove());
  overlay.querySelector('[data-a="confirm"]').addEventListener('click', async () => {
    try {
      const data = JSON.parse(ta.value);
      const strategy = overlay.querySelector('input[name="ek-strategy"]:checked').value;
      const r = await BG({ type: 'echokit:import', data, strategy });
      overlay.remove();
      if (r?.ok) { await refresh(); render(); } else alert('Import failed: ' + (r?.error || 'unknown'));
    } catch (e) { alert('Invalid JSON: ' + e.message); }
  });
}

function showSettingsDialog() {
  const s = state.settings;
  const overlay = document.createElement('div');
  overlay.className = 'ek-modal-overlay';
  overlay.innerHTML = `
    <div class="ek-modal" data-testid="settings-modal">
      <div class="ek-modal-title">Settings</div>

      <div class="ek-settings-row">
        <div>
          <div class="ek-settings-title">Scope</div>
          <div class="ek-settings-hint">Which recordings are visible + which mocks can fire on the current tab.</div>
        </div>
        <select class="ek-select" data-a="scope" data-testid="settings-scope" style="max-width:160px">
          <option value="domain" ${s.scope==='domain'?'selected':''}>Domain (default)</option>
          <option value="tab" ${s.scope==='tab'?'selected':''}>Tab (strict)</option>
          <option value="global" ${s.scope==='global'?'selected':''}>Global</option>
        </select>
      </div>

      <div class="ek-settings-row">
        <div>
          <div class="ek-settings-title">Theme</div>
          <div class="ek-settings-hint">UI appearance for popup + DevTools panel.</div>
        </div>
        <select class="ek-select" data-a="theme" data-testid="settings-theme" style="max-width:160px">
          <option value="dark" ${s.theme==='dark'?'selected':''}>Dark</option>
          <option value="light" ${s.theme==='light'?'selected':''}>Light</option>
          <option value="auto" ${s.theme==='auto'?'selected':''}>Auto (follow OS)</option>
        </select>
      </div>

      <div class="ek-settings-row">
        <div>
          <div class="ek-settings-title">CORS Override</div>
          <div class="ek-settings-hint">Inject <span class="ek-tag">Access-Control-Allow-*</span> headers into real responses.</div>
        </div>
        <label class="ek-switch ${s.corsOverride?'on':''}">
          <input type="checkbox" ${s.corsOverride?'checked':''} data-a="cors" data-testid="cors-toggle"/>
          <span class="ek-switch-track"></span>
          <span class="ek-switch-label">${s.corsOverride?'ON':'OFF'}</span>
        </label>
      </div>

      <div class="ek-settings-row">
        <div>
          <div class="ek-settings-title">Auto-open popup on refresh</div>
          <div class="ek-settings-hint">When a tab reloads while recording, pop this panel back open.</div>
        </div>
        <label class="ek-switch ${s.autoOpenOnRefresh?'on':''}">
          <input type="checkbox" ${s.autoOpenOnRefresh?'checked':''} data-a="auto-open" data-testid="auto-open-toggle"/>
          <span class="ek-switch-track"></span>
          <span class="ek-switch-label">${s.autoOpenOnRefresh?'ON':'OFF'}</span>
        </label>
      </div>

      <div class="ek-settings-row">
        <div style="flex:1">
          <div class="ek-settings-title">URL Blocklist</div>
          <div class="ek-settings-hint">Block any network request whose URL matches. Uses Chrome's <span class="ek-tag">urlFilter</span> syntax (substring or <span class="ek-tag">||domain.com</span> / <span class="ek-tag">^</span> / <span class="ek-tag">*</span>).</div>
          <div id="ek-blocklist" style="margin-top:8px" data-testid="blocklist">
            ${(s.blocklist || []).map((b, idx) => `
              <div class="ek-kv-row">
                <input class="ek-input" value="${escapeHtml(b.pattern)}" data-a="bl-pattern" data-idx="${idx}" placeholder="e.g. ||tracking.example.com^"/>
                <label class="ek-row-inline" style="gap:6px"><input type="checkbox" ${b.enabled?'checked':''} data-a="bl-toggle" data-idx="${idx}"/> <span class="ek-subtle">${b.enabled ? 'ON' : 'off'}</span></label>
                <button class="ek-kv-remove" data-a="bl-remove" data-idx="${idx}" aria-label="remove">×</button>
              </div>
            `).join('')}
          </div>
          <button class="ek-btn ek-btn-ghost" data-a="bl-add" style="margin-top:6px" data-testid="blocklist-add">＋ Add blocklist pattern</button>
        </div>
      </div>

      <div class="ek-settings-row">
        <div>
          <div class="ek-settings-title">Wipe ALL recordings</div>
          <div class="ek-settings-hint">Delete every recorded interaction across every scope, tab, and domain.</div>
        </div>
        <button class="ek-btn ek-btn-danger" data-a="clear-all" data-testid="clear-all-btn">Wipe</button>
      </div>

      <div class="ek-modal-actions">
        <button class="ek-btn ek-btn-primary" data-a="close">Done</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  overlay.querySelector('[data-a="close"]').addEventListener('click', () => overlay.remove());
  overlay.querySelector('[data-a="scope"]').addEventListener('change', async (e) => {
    await BG({ type: 'echokit:settings:update', patch: { scope: e.target.value } });
    await refresh(); render();
  });
  overlay.querySelector('[data-a="theme"]').addEventListener('change', async (e) => {
    await BG({ type: 'echokit:settings:update', patch: { theme: e.target.value } });
    await refresh(); applyTheme(); render();
  });
  overlay.querySelector('[data-a="cors"]').addEventListener('change', async (e) => {
    await BG({ type: 'echokit:settings:update', patch: { corsOverride: e.target.checked } });
    await refresh(); overlay.remove(); render(); showSettingsDialog();
  });
  overlay.querySelector('[data-a="auto-open"]').addEventListener('change', async (e) => {
    await BG({ type: 'echokit:settings:update', patch: { autoOpenOnRefresh: e.target.checked } });
    await refresh(); overlay.remove(); render(); showSettingsDialog();
  });
  overlay.querySelector('[data-a="clear-all"]').addEventListener('click', async () => {
    if (!confirm('Delete ALL recordings, every scope, every tab, every domain. Cannot be undone.')) return;
    await BG({ type: 'echokit:interactions:clearAll' });
    overlay.remove();
    state.selectedId = null; state.detailOpen = false;
    await refresh(); render();
  });

  // --- Blocklist handlers ---
  const reopen = () => { overlay.remove(); showSettingsDialog(); };
  overlay.querySelectorAll('[data-a="bl-pattern"]').forEach(el => el.addEventListener('change', async (e) => {
    const idx = Number(el.getAttribute('data-idx'));
    const bl = [...(state.settings.blocklist || [])];
    bl[idx] = { ...(bl[idx] || {}), pattern: e.target.value };
    await BG({ type: 'echokit:settings:update', patch: { blocklist: bl } });
    await refresh();
  }));
  overlay.querySelectorAll('[data-a="bl-toggle"]').forEach(el => el.addEventListener('change', async (e) => {
    const idx = Number(el.getAttribute('data-idx'));
    const bl = [...(state.settings.blocklist || [])];
    bl[idx] = { ...(bl[idx] || {}), enabled: e.target.checked };
    await BG({ type: 'echokit:settings:update', patch: { blocklist: bl } });
    await refresh(); reopen();
  }));
  overlay.querySelectorAll('[data-a="bl-remove"]').forEach(el => el.addEventListener('click', async () => {
    const idx = Number(el.getAttribute('data-idx'));
    const bl = [...(state.settings.blocklist || [])];
    bl.splice(idx, 1);
    await BG({ type: 'echokit:settings:update', patch: { blocklist: bl } });
    await refresh(); reopen();
  }));
  overlay.querySelector('[data-a="bl-add"]')?.addEventListener('click', async () => {
    const bl = [...(state.settings.blocklist || []), { pattern: '', enabled: true }];
    await BG({ type: 'echokit:settings:update', patch: { blocklist: bl } });
    await refresh(); reopen();
  });
}

function showShortcutsDialog() {
  const overlay = document.createElement('div');
  overlay.className = 'ek-modal-overlay';
  overlay.innerHTML = `
    <div class="ek-modal" data-testid="shortcuts-modal">
      <div class="ek-modal-title">Keyboard shortcuts</div>
      <div class="ek-settings-row"><div class="ek-settings-title">Toggle recording</div><span class="ek-kbd">Alt+Shift+R</span></div>
      <div class="ek-settings-row"><div class="ek-settings-title">Toggle mock mode</div><span class="ek-kbd">Alt+Shift+M</span></div>
      <div class="ek-settings-row"><div class="ek-settings-title">Open popup</div><span class="ek-kbd">Alt+Shift+E</span></div>
      <div class="ek-subtle">Customize these at <span class="ek-tag">chrome://extensions/shortcuts</span>.</div>
      <div class="ek-modal-actions"><button class="ek-btn ek-btn-primary" data-a="close">Done</button></div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  overlay.querySelector('[data-a="close"]').addEventListener('click', () => overlay.remove());
}

// ---------- filters & helpers ----------
function filteredInteractions() {
  const q = state.search.trim().toLowerCase();
  return state.interactions.filter(i => {
    if (state.methodFilter && (i.method || '').toUpperCase() !== state.methodFilter) return false;
    if (state.statusFilter != null) {
      const bucket = String(Math.floor((i.responseStatus || 0) / 100));
      if (state.statusFilter === '0') { if ((i.responseStatus || 0) !== 0) return false; }
      else if (bucket !== state.statusFilter) return false;
    }
    if (q && !i.url.toLowerCase().includes(q)) return false;
    return true;
  }).sort((a, b) => b.timestamp - a.timestamp);
}
function groupByDomain(list) {
  const map = new Map();
  for (const i of list) {
    const d = domainOf(i.url);
    if (!map.has(d)) map.set(d, []);
    map.get(d).push(i);
  }
  return [...map.entries()].map(([domain, items]) => ({ domain, items }));
}
function domainOf(url) { try { return new URL(url, location.href).host || '(local)'; } catch { return '(unknown)'; } }
function prettyUrl(url) {
  try { const u = new URL(url, location.href); return { path: u.pathname, query: u.search }; }
  catch { return { path: url, query: '' }; }
}
function escapeHtml(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
