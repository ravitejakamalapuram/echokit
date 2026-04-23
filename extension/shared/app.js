// EchoKit — shared UI module (vanilla JS, no framework).
// Used by both the popup and the devtools panel. Decides layout via `mode`.

const BG = (msg) => new Promise((resolve) => chrome.runtime.sendMessage(msg, resolve));

let state = {
  mode: 'popup', // 'popup' | 'devtools'
  tabId: null,
  tab: { recording: false, mocking: false, sessionId: null },
  settings: { corsOverride: false },
  interactions: [],
  search: '',
  methodFilter: null,
  statusFilter: null,
  selectedId: null,
  detailOpen: false
};

let root;

export async function initEchoKitUI({ mode, root: r, tabId }) {
  state.mode = mode;
  root = r;
  state.tabId = tabId ?? (await resolveTabId());

  // Subscribe to state changes via chrome.runtime messages.
  chrome.runtime.onMessage.addListener((msg) => {
    if (!msg) return;
    if (msg.type === 'echokit:tabState' && state.tabId != null) {
      // ignored here — we always refetch full state after any action
    }
  });

  await refresh();
  render();

  // Poll every 1500ms for live updates while recording (simpler than streaming).
  setInterval(async () => {
    if (document.hidden) return;
    // Don't re-render while the user is interacting with any editable field
    // (otherwise we wipe typing / cursor position).
    const ae = document.activeElement;
    const isEditing = ae && root.contains(ae) && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName);
    await refresh();
    if (!isEditing) render();
  }, 1500);
}

async function resolveTabId() {
  // Popup: chrome.tabs.query({active, currentWindow}).
  // DevTools panel: chrome.devtools.inspectedWindow.tabId.
  if (typeof chrome !== 'undefined' && chrome.devtools && chrome.devtools.inspectedWindow) {
    return chrome.devtools.inspectedWindow.tabId;
  }
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id ?? null;
}

async function refresh() {
  const resp = await BG({ type: 'echokit:getState', tabId: state.tabId });
  if (!resp) return;
  state.tab = resp.tab ? { recording: resp.tab.recording, mocking: resp.tab.mocking, sessionId: resp.tab.sessionId } : state.tab;
  state.settings = resp.settings || state.settings;
  state.interactions = resp.interactions || [];
}

// ---------- rendering ----------
function render() {
  const isPopup = state.mode === 'popup';
  const list = filteredInteractions();
  const grouped = groupByDomain(list);
  const selected = state.selectedId ? state.interactions.find(i => i.id === state.selectedId) : null;
  const conflicts = selected ? state.interactions.filter(i => i.hash === selected.hash) : [];

  const appCls = `ek-app ${state.mode} ${state.detailOpen && isPopup ? 'detail-open' : ''}`;

  root.innerHTML = `
    <div class="${appCls}" data-testid="echokit-app">
      ${state.tab.mocking ? `<div class="ek-banner" data-testid="mock-active-banner"><span>Mocking Active — responses may be faked</span></div>` : ''}
      ${renderHeader()}
      ${renderToolbar()}
      <div class="ek-main">
        <div class="ek-list" data-testid="api-list">
          ${list.length === 0 ? renderEmpty() : grouped.map(renderDomainGroup).join('')}
        </div>
        <div class="ek-detail" data-testid="api-detail">
          ${selected ? renderDetail(selected, conflicts) : renderDetailEmpty()}
        </div>
      </div>
      ${renderFooter(list.length)}
    </div>
  `;

  bindEvents();
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
      <label class="ek-switch ${mocking ? 'on' : ''}" data-testid="mock-master-toggle" title="Toggle mocking for this tab">
        <input type="checkbox" ${mocking ? 'checked' : ''} data-action="toggle-mocking">
        <span class="ek-switch-track"></span>
        <span class="ek-switch-label">MOCK</span>
      </label>
      <button class="ek-btn ek-btn-ghost" data-action="clear-session" title="Clear this session's recordings" data-testid="clear-session-btn">CLEAR</button>
      <button class="ek-btn ek-btn-ghost" data-action="export" title="Export mocks as JSON" data-testid="export-btn">EXPORT</button>
      <button class="ek-btn ek-btn-ghost" data-action="import" title="Import mocks from JSON" data-testid="import-btn">IMPORT</button>
      <button class="ek-btn ek-btn-ghost" data-action="toggle-settings" title="Settings" data-testid="settings-btn">⚙</button>
    </div>
  `;
}

function renderToolbar() {
  const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
  return `
    <div class="ek-toolbar">
      <input class="ek-search" type="text" placeholder="search url…" value="${escapeHtml(state.search)}" data-action="search" data-testid="search-input"/>
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
        ? 'Trigger some fetch or XHR calls in the page — they\'ll appear here instantly.'
        : 'Hit the ● REC button above to start capturing fetch/XHR on this tab.'}</div>
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
  return `
    <div class="ek-row ${active}" data-id="${i.id}" data-action="select" data-testid="api-row">
      <span class="ek-method ${method}">${method}</span>
      <div class="ek-url" title="${escapeHtml(i.url)}"><span class="ek-url-path">${escapeHtml(urlPretty.path)}</span><span class="ek-url-query">${escapeHtml(urlPretty.query)}</span></div>
      ${conflict ? `<span class="ek-conflict-badge" title="${versionCount} versions">×${versionCount}</span>` : ''}
      <span class="ek-status ${statusClass}">${i.responseStatus || 'ERR'}</span>
      <button class="ek-mock-toggle ${i.mockEnabled ? 'on' : ''}" data-action="toggle-mock" data-id="${i.id}" title="${i.mockEnabled ? 'Mock ON' : 'Mock OFF'}" data-testid="mock-toggle"></button>
    </div>
  `;
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

  return `
    <div class="ek-detail-head">
      <span class="ek-method ${(i.method||'GET').toUpperCase()}">${(i.method||'GET').toUpperCase()}</span>
      <div class="ek-detail-title">${escapeHtml(i.url)}</div>
      <button class="ek-close" data-action="close-detail" data-testid="close-detail">✕</button>
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
              <div class="ek-label">Latency (ms)</div>
              <div class="ek-row-inline">
                <input class="ek-slider" type="range" min="0" max="10000" step="50" value="${i.mockLatency || 0}" data-action="update-latency" data-id="${i.id}" data-testid="latency-slider"/>
                <input class="ek-input" type="number" min="0" style="max-width: 88px" value="${i.mockLatency || 0}" data-action="update-latency-input" data-id="${i.id}"/>
              </div>
            </div>
            <div class="ek-field">
              <div class="ek-label">Error Simulation</div>
              <select class="ek-select" data-action="update-error-mode" data-id="${i.id}" data-testid="error-mode-select">
                <option value="none" ${i.mockErrorMode === 'none' || !i.mockErrorMode ? 'selected' : ''}>none</option>
                <option value="4xx" ${i.mockErrorMode === '4xx' ? 'selected' : ''}>force 4xx (400)</option>
                <option value="5xx" ${i.mockErrorMode === '5xx' ? 'selected' : ''}>force 5xx (500)</option>
                <option value="network" ${i.mockErrorMode === 'network' ? 'selected' : ''}>network failure</option>
                <option value="timeout" ${i.mockErrorMode === 'timeout' ? 'selected' : ''}>timeout (hang)</option>
              </select>
            </div>
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
            <textarea class="ek-textarea" spellcheck="false" data-action="update-body" data-id="${i.id}" data-testid="body-editor">${escapeHtml(typeof overrideBody === 'string' ? overrideBody : JSON.stringify(overrideBody))}</textarea>
            <div class="ek-row-inline" style="margin-top:6px;gap:6px">
              <button class="ek-btn ek-btn-ghost" data-action="format-json" data-id="${i.id}">Format JSON</button>
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
                  <button class="ek-kv-remove" data-action="header-remove" data-id="${i.id}" data-key="${escapeHtml(k)}">×</button>
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
            <textarea class="ek-textarea" spellcheck="false" readonly>${escapeHtml(typeof i.requestBody === 'string' ? i.requestBody : (i.requestBody == null ? '' : JSON.stringify(i.requestBody)))}</textarea>
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
  const corsTag = state.settings.corsOverride ? `<span class="ek-tag amber">CORS</span>` : '';
  return `
    <div class="ek-footer">
      ${recTag} ${mockTag} ${corsTag}
      <span class="ek-subtle">${count} request${count === 1 ? '' : 's'}</span>
      <span class="ek-row-inline-end ek-subtle">tab #${state.tabId ?? '—'}</span>
    </div>
  `;
}

// ---------- event binding ----------
function bindEvents() {
  root.querySelectorAll('[data-action]').forEach(el => {
    const action = el.getAttribute('data-action');
    const id = el.getAttribute('data-id');

    if (action === 'select') {
      el.addEventListener('click', (e) => {
        if (e.target.closest('[data-action="toggle-mock"]')) return;
        state.selectedId = el.getAttribute('data-id');
        state.detailOpen = true;
        render();
      });
    }
    else if (action === 'start-recording') el.addEventListener('click', onStartRecording);
    else if (action === 'stop-recording') el.addEventListener('click', onStopRecording);
    else if (action === 'toggle-mocking') el.addEventListener('change', onToggleMocking);
    else if (action === 'clear-session') el.addEventListener('click', onClearSession);
    else if (action === 'export') el.addEventListener('click', onExport);
    else if (action === 'import') el.addEventListener('click', onImport);
    else if (action === 'toggle-settings') el.addEventListener('click', onToggleSettings);
    else if (action === 'search') el.addEventListener('input', (e) => { state.search = e.target.value; render(); requestAnimationFrame(() => root.querySelector('[data-testid="search-input"]')?.focus()); });
    else if (action === 'filter-method') el.addEventListener('click', () => { const m = el.getAttribute('data-method'); state.methodFilter = state.methodFilter === m ? null : m; render(); });
    else if (action === 'filter-status') el.addEventListener('change', (e) => { state.statusFilter = e.target.value || null; render(); });
    else if (action === 'toggle-mock') {
      const handler = async () => {
        const current = state.interactions.find(x => x.id === id);
        if (!current) return;
        await BG({ type: 'echokit:interaction:update', id, patch: { mockEnabled: !current.mockEnabled } });
        await refresh(); render();
      };
      // Button: click; checkbox: change
      if (el.tagName === 'INPUT') el.addEventListener('change', handler);
      else el.addEventListener('click', (e) => { e.stopPropagation(); handler(); });
    }
    else if (action === 'update-latency' || action === 'update-latency-input') {
      el.addEventListener('change', async (e) => {
        await BG({ type: 'echokit:interaction:update', id, patch: { mockLatency: Number(e.target.value) || 0 } });
        await refresh(); render();
      });
    }
    else if (action === 'update-error-mode') {
      el.addEventListener('change', async (e) => {
        await BG({ type: 'echokit:interaction:update', id, patch: { mockErrorMode: e.target.value } });
        await refresh(); render();
      });
    }
    else if (action === 'update-status') {
      el.addEventListener('change', async (e) => {
        await BG({ type: 'echokit:interaction:update', id, patch: { overrideStatus: Number(e.target.value) || 200 } });
        await refresh(); render();
      });
    }
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
    else if (action === 'format-json') {
      el.addEventListener('click', async () => {
        const ta = root.querySelector('textarea[data-action="update-body"]');
        if (!ta) return;
        try {
          const p = JSON.parse(ta.value);
          const pretty = JSON.stringify(p, null, 2);
          ta.value = pretty;
          await BG({ type: 'echokit:interaction:update', id, patch: { overrideBody: pretty } });
          await refresh(); render();
        } catch { /* invalid json, do nothing */ }
      });
    }
    else if (action === 'reset-body') {
      el.addEventListener('click', async () => {
        await BG({ type: 'echokit:interaction:update', id, patch: { overrideBody: null } });
        await refresh(); render();
      });
    }
    else if (action === 'header-add') {
      el.addEventListener('click', async () => {
        const curr = state.interactions.find(x => x.id === id);
        const headers = { ...(curr.overrideHeaders || curr.responseHeaders || {}) };
        let k = 'x-custom-header', i = 1;
        while (headers[k]) { k = `x-custom-header-${i++}`; }
        headers[k] = '';
        await BG({ type: 'echokit:interaction:update', id, patch: { overrideHeaders: headers } });
        await refresh(); render();
      });
    }
    else if (action === 'header-remove') {
      el.addEventListener('click', async () => {
        const key = el.getAttribute('data-key');
        const curr = state.interactions.find(x => x.id === id);
        const headers = { ...(curr.overrideHeaders || curr.responseHeaders || {}) };
        delete headers[key];
        await BG({ type: 'echokit:interaction:update', id, patch: { overrideHeaders: headers } });
        await refresh(); render();
      });
    }
    else if (action === 'header-key') {
      el.addEventListener('change', async (e) => {
        const orig = el.getAttribute('data-orig');
        const next = e.target.value.trim();
        if (!next || next === orig) return;
        const curr = state.interactions.find(x => x.id === id);
        const headers = { ...(curr.overrideHeaders || curr.responseHeaders || {}) };
        headers[next] = headers[orig];
        delete headers[orig];
        await BG({ type: 'echokit:interaction:update', id, patch: { overrideHeaders: headers } });
        await refresh(); render();
      });
    }
    else if (action === 'header-val') {
      el.addEventListener('change', async (e) => {
        const key = el.getAttribute('data-key');
        const curr = state.interactions.find(x => x.id === id);
        const headers = { ...(curr.overrideHeaders || curr.responseHeaders || {}) };
        headers[key] = e.target.value;
        await BG({ type: 'echokit:interaction:update', id, patch: { overrideHeaders: headers } });
        await refresh(); // no full re-render (keeps focus)
      });
    }
    else if (action === 'delete-interaction') {
      el.addEventListener('click', async () => {
        if (!confirm('Delete this recorded API? This cannot be undone.')) return;
        await BG({ type: 'echokit:interaction:delete', id });
        state.selectedId = null; state.detailOpen = false;
        await refresh(); render();
      });
    }
    else if (action === 'set-active-version') {
      el.addEventListener('change', async (e) => {
        await BG({ type: 'echokit:interaction:setActiveVersion', id: e.target.value });
        await refresh(); render();
      });
    }
    else if (action === 'close-detail') {
      el.addEventListener('click', () => { state.detailOpen = false; state.selectedId = null; render(); });
    }
  });
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
  if (!confirm('Clear this session\'s recordings?')) return;
  await BG({ type: 'echokit:session:clear', tabId: state.tabId });
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
function onImport() {
  showImportDialog();
}
function showImportDialog() {
  const overlay = document.createElement('div');
  overlay.className = 'ek-modal-overlay';
  overlay.innerHTML = `
    <div class="ek-modal" data-testid="import-modal">
      <div class="ek-modal-title">Import mocks</div>
      <div class="ek-subtle">Paste an EchoKit export JSON, or choose a file.</div>
      <textarea class="ek-textarea" style="min-height:120px" placeholder='{"version":1,"interactions":[…]}'></textarea>
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
  fileInput.addEventListener('change', async () => {
    const f = fileInput.files?.[0]; if (!f) return;
    ta.value = await f.text();
  });
  overlay.querySelector('[data-a="cancel"]').addEventListener('click', () => overlay.remove());
  overlay.querySelector('[data-a="confirm"]').addEventListener('click', async () => {
    try {
      const data = JSON.parse(ta.value);
      const strategy = overlay.querySelector('input[name="ek-strategy"]:checked').value;
      const r = await BG({ type: 'echokit:import', data, strategy });
      overlay.remove();
      if (r?.ok) { await refresh(); render(); }
      else alert('Import failed: ' + (r?.error || 'unknown'));
    } catch (e) { alert('Invalid JSON: ' + e.message); }
  });
}
function onToggleSettings() {
  const overlay = document.createElement('div');
  overlay.className = 'ek-modal-overlay';
  overlay.innerHTML = `
    <div class="ek-modal" data-testid="settings-modal">
      <div class="ek-modal-title">Settings</div>
      <div class="ek-settings-row">
        <div>
          <div class="ek-settings-title">CORS Override</div>
          <div class="ek-settings-hint">Inject <span class="ek-tag">Access-Control-Allow-*</span> headers into real responses (global, all tabs).</div>
        </div>
        <label class="ek-switch ${state.settings.corsOverride ? 'on' : ''}">
          <input type="checkbox" ${state.settings.corsOverride ? 'checked' : ''} data-a="cors" data-testid="cors-toggle"/>
          <span class="ek-switch-track"></span>
          <span class="ek-switch-label">${state.settings.corsOverride ? 'ON' : 'OFF'}</span>
        </label>
      </div>
      <div class="ek-settings-row">
        <div>
          <div class="ek-settings-title">Clear ALL recordings</div>
          <div class="ek-settings-hint">Delete every recorded interaction across all tabs and sessions.</div>
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
  overlay.querySelector('[data-a="cors"]').addEventListener('change', async (e) => {
    await BG({ type: 'echokit:settings:update', patch: { corsOverride: e.target.checked } });
    await refresh();
    overlay.remove(); onToggleSettings();
  });
  overlay.querySelector('[data-a="clear-all"]').addEventListener('click', async () => {
    if (!confirm('Delete ALL recorded interactions across every tab? Cannot be undone.')) return;
    await BG({ type: 'echokit:interactions:clearAll' });
    overlay.remove();
    state.selectedId = null; state.detailOpen = false;
    await refresh(); render();
  });
}

// ---------- filtering + grouping ----------
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

function domainOf(url) {
  try { return new URL(url, location.href).host || '(local)'; }
  catch { return '(unknown)'; }
}

function prettyUrl(url) {
  try {
    const u = new URL(url, location.href);
    return { path: u.pathname, query: u.search };
  } catch {
    return { path: url, query: '' };
  }
}

function escapeHtml(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
