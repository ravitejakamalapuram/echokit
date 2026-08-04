// EchoKit — shared UI module.
// Used by both popup + devtools panel. Mode-switches layout, preserves scroll & cursor.

import { sanitizeHTML } from './sanitize.js';
import { highlightJSON, isValidJSON } from './json-highlight.js';
import { createLayout } from './layouts.js';
import { renderWaterfall as renderWaterfallNew } from './waterfall-renderer.js';
import { getConflictCount, getConflicts, parseUrl } from './interaction-helpers.js';

const BG = (msg) => new Promise((resolve) => chrome.runtime.sendMessage(msg, resolve));

// Constants
const DEBOUNCE_DELAY = 300; // ms - Delay for debounced text inputs
const SOFT_RENDER_DEBOUNCE = 80; // ms - Delay for soft rendering on search

// Feature flags for dual interface strategy
const FEATURES = {
  popup: {
    advancedFilters: false,
    bodySearch: false,
    headerSearch: false,
    sortableColumns: false,
    waterfallView: true,  // Keep waterfall in both
    resizablePanes: false,
    filterChips: false,
    multiSelect: false,
    sourceBadges: true,      // Show source badges in both popup and devtools
    sourceFilters: false,    // Filters only in devtools
    sourceGrouping: false    // Grouping only in devtools
  },
  devtools: {
    advancedFilters: true,
    bodySearch: true,
    headerSearch: true,
    sortableColumns: true,
    waterfallView: true,
    resizablePanes: true,
    filterChips: true,
    multiSelect: true,
    sourceBadges: true,      // Show source badges in both popup and devtools
    sourceFilters: true,     // Advanced filters in devtools
    sourceGrouping: true     // Group-by-source in devtools
  }
};

// Helper function to get features for current mode
function getFeatures() {
  return FEATURES[state.mode] || FEATURES.popup;
}

// Helper function to escape HTML to prevent XSS
function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const state = {
  mode: 'popup',
  tabId: null,
  tab: { recording: false, mocking: false, sessionId: null, host: '' },
  settings: { corsOverride: false, scope: 'domain', theme: 'dark', autoOpenOnRefresh: true, blocklist: [], rewriteRules: [], transformRules: [], requestHeaders: [] },
  interactions: [],
  allCount: 0,
  isPro: false,
  trial: false,
  trialDaysLeft: 0,
  waterfall: false,
  search: '',
  // OLD filters (kept for popup backward compatibility)
  methodFilter: null,
  statusFilter: null,
  // NEW filters (DevTools only)
  filters: {
    methods: [],                    // ['GET', 'POST']
    statusCodes: [],                // ['2xx', '404', '5xx']
    requestBodyContains: '',
    responseBodyContains: '',
    requestHeader: { name: '', value: '' },
    responseHeader: { name: '', value: '' },
    mockEnabled: null,
    blocked: null,
    hasNotes: null,
    // Source filters (NEW)
    sources: {
      thisTab: true,
      otherTabs: true,
      closedTabs: false,            // Default: hide noise from closed tabs
      imported: true
    }
  },
  // Advanced UI state
  advancedFilterOpen: false,
  sortBy: 'timestamp',
  sortOrder: 'desc',
  // Existing state
  selectedId: null,
  detailOpen: false,
  menuOpen: false,
  listWidth: 360,
  clipboardPreview: null,
};

// Layout instance for new componentized rendering (Phase 4)
let layoutInstance = null;

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
  state.isPro = resp.isPro || false;
  state.trial = resp.trial || false;
  state.trialDaysLeft = resp.trialDaysLeft || 0;
}

/**
 * Classify API source for visibility badges
 * @param {Object} interaction - The interaction object with tabId and sourceTabExists
 * @param {number|null} currentTabId - The ID of the currently active tab
 * @returns {string} Source type: 'this-tab' | 'other-tab' | 'closed-tab' | 'imported'
 */
function classifySource(interaction, currentTabId) {
  if (interaction.tabId === null) return 'imported';
  if (interaction.tabId === currentTabId) return 'this-tab';
  if (!interaction.sourceTabExists) return 'closed-tab';
  return 'other-tab';
}

/**
 * Render source badge with optional click-to-switch functionality
 * @param {Object} interaction - The interaction object
 * @param {number|null} currentTabId - The ID of the currently active tab
 * @returns {string} HTML string for the source badge
 */
function renderSourceBadge(interaction, currentTabId) {
  const source = classifySource(interaction, currentTabId);
  const sourceTabTitle = escapeHtml(interaction.sourceTabTitle || 'this tab');
  const tabId = escapeHtml(interaction.tabId);

  const config = {
    'this-tab': {
      label: 'This Tab',
      icon: '✓',
      title: 'Recorded on this tab',
      clickable: false
    },
    'other-tab': {
      label: `Other Tab`,
      icon: '⇄',
      title: `Click to switch to tab: ${sourceTabTitle}`,
      clickable: true
    },
    'closed-tab': {
      label: 'Closed',
      icon: '✗',
      title: 'Source tab is no longer open',
      clickable: false
    },
    'imported': {
      label: 'Imported',
      icon: '↓',
      title: 'Imported from external source',
      clickable: false
    }
  };

  const c = config[source];
  const escapedLabel = escapeHtml(c.label);
  const escapedTitle = escapeHtml(c.title);
  const tag = c.clickable ? 'button' : 'span';
  const clickAttr = c.clickable
    ? `data-action="switch-to-tab" data-tab-id="${tabId}" style="cursor:pointer"`
    : '';

  const typeAttr = c.clickable ? ' type="button"' : '';

  return `
    <${tag}${typeAttr} class="ek-source-badge ${source}"
          title="${escapedTitle}"
          data-testid="source-badge-${source}"
          ${clickAttr}>
      ${c.icon} ${escapedLabel}
    </${tag}>
  `;
}

function applyTheme() {
  let theme = state.settings.theme || 'dark';
  if (theme === 'auto') {
    theme = window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  document.documentElement.setAttribute('data-theme', theme);
}

// ---------- New Componentized Rendering (Phase 4) ----------

/**
 * Render interaction list using new componentized system.
 * Uses layout classes from Phase 3 that delegate to rendering functions from Phase 2.
 */
function renderInteractionListNew() {
  const container = root.querySelector('[data-testid="api-list"]');
  if (!container) return;

  // Create layout instance if it doesn't exist, mode changed, or container detached
  if (!layoutInstance ||
      layoutInstance.mode !== state.mode ||
      layoutInstance.container !== container) {
    // Cleanup old instance
    if (layoutInstance) {
      layoutInstance.destroy();
    }

    // Create new instance for current mode
    layoutInstance = createLayout(container, state.mode);

    // Wire up event handlers
    container.addEventListener('interaction-selected', (e) => {
      state.selectedId = e.detail.id;
      state.detailOpen = true;
      render(); // Re-render to show detail panel
    });

    if (state.mode === 'popup') {
      container.addEventListener('mock-toggled', async (e) => {
        const { id, enabled } = e.detail;
        try {
          await BG({ type: 'echokit:mock:toggle', id, enabled });
          await refresh();
        } catch (error) {
          console.error('[EchoKit] Mock toggle failed:', error);
          // Refresh anyway to restore consistent state
          await refresh().catch(err => console.error('[EchoKit] Refresh failed:', err));
        }
      });
    } else {
      container.addEventListener('interaction-action', async (e) => {
        const { action, id } = e.detail;
        if (action === 'edit') {
          state.selectedId = id;
          state.detailOpen = true;
          render();
        } else if (action === 'delete') {
          try {
            await BG({ type: 'echokit:interaction:delete', id });
            await refresh();
          } catch (error) {
            console.error('[EchoKit] Delete failed:', error);
            // Restore previous state if delete failed
            await refresh().catch(err => console.error('[EchoKit] Refresh failed:', err));
          }
        }
      });
    }

    // Both modes need block button handler
    container.addEventListener('interaction-action', async (e) => {
      const { action, id } = e.detail;
      if (action === 'toggle-block') {
        if (!state.isPro) {
          showProGate('API Blocking');
          return;
        }
        try {
          const current = state.interactions.find(x => x.id === id);
          if (!current) return;
          await BG({ type: 'echokit:interaction:update', id, patch: { blocked: !current.blocked } });
          await refresh();
        } catch (error) {
          console.error('[EchoKit] Block toggle failed:', error);
          await refresh().catch(err => console.error('[EchoKit] Refresh failed:', err));
        }
      }
    });
  }

  // Update layout with current data
  const filtered = filteredInteractions();
  layoutInstance.setInteractions(filtered);
  layoutInstance.setSearchTerm(state.search);

  if (state.mode === 'devtools' && layoutInstance.setSorting) {
    layoutInstance.setSorting(state.sortBy, state.sortOrder);
  }

  if (state.mode === 'popup' && layoutInstance.setGroupByDomain) {
    layoutInstance.setGroupByDomain(true); // Always grouped in popup for now
  }
}

/**
 * Render the EchoKit UI into the configured root element using the current application state.
 *
 * Updates the document theme, captures and later restores focus/scroll snapshot, builds the main
 * app markup (header, toolbar, list or waterfall, detail pane, footer), applies layout classes
 * and list width, initializes the componentized list when not in waterfall mode, binds UI event
 * handlers, and refreshes menus and embedded code editors.
 */
function render() {
  applyTheme();
  const snapshot = snapshotUIState();

  const isPopup = state.mode === 'popup';
  const list = filteredInteractions();
  const selected = state.selectedId ? state.interactions.find(i => i.id === state.selectedId) : null;
  const conflicts = selected ? getConflicts(selected, state.interactions) : [];

  const safeMode = state.mode === 'devtools' ? 'devtools' : 'popup';
  const appCls = `ek-app ${safeMode} ${state.detailOpen && isPopup ? 'detail-open' : ''}`;

  root.innerHTML = sanitizeHTML(`
    <div class="ek-app" data-testid="echokit-app">
      ${renderHeader()}
      ${renderToolbar(list.length)}
      <div class="ek-main">
        <div class="ek-list" data-testid="api-list">
          ${state.waterfall ? renderWaterfallNew(list, { selectedId: state.selectedId }) : ''}
        </div>
        ${isPopup ? '' : '<div class="ek-resizer" data-action="resize" data-testid="pane-resizer"></div>'}
        <div class="ek-detail" data-testid="api-detail">
          ${selected ? renderDetail(selected, conflicts) : renderDetailEmpty()}
        </div>
      </div>
      ${renderFooter(list.length)}
    </div>
  `);

  const appEl = root.querySelector('[data-testid="echokit-app"]');
  if (appEl) {
    appEl.className = appCls;
    if (!isPopup) {
      appEl.style.setProperty('--list-width', `${Number(state.listWidth)}px`);
    }
  }

  // Use new componentized rendering for list view (not waterfall)
  if (!state.waterfall) {
    renderInteractionListNew();
  }

  bindEvents();
  restoreUIState(snapshot);
  renderMenu();
  renderAllCodeEditors();
}

// Snapshot focus, selection, and scroll positions so we can restore after innerHTML wipe.
function snapshotUIState() {
  const list = root.querySelector('[data-testid="api-list"]');
  const waterfall = root.querySelector('.ek-waterfall');
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
    waterfallScroll: waterfall?.scrollTop ?? 0,
    detailScroll: detailBody?.scrollTop ?? 0,
    focus
  };
}

function restoreUIState(snap) {
  const list = root.querySelector('[data-testid="api-list"]');
  const waterfall = root.querySelector('.ek-waterfall');
  const detailBody = root.querySelector('[data-testid="api-detail"] .ek-detail-body');
  if (list) list.scrollTop = snap.listScroll;
  if (waterfall) waterfall.scrollTop = snap.waterfallScroll ?? 0;
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

/**
 * Build the top header HTML reflecting the current UI and tab state.
 *
 * The returned markup includes recording and mocking controls, a global CORS toggle,
 * a waterfall view toggle, an Advanced Settings button, a menu toggle, a trial badge
 * when applicable, and a compact stats bar showing the number of recorded interactions.
 *
 * @returns {string} The header HTML string. Contains interactive elements with `data-action` attributes such as `start-recording`, `stop-recording`, `toggle-mocking`, `toggle-cors-master`, `toggle-waterfall`, `open-settings`, and `toggle-menu`.
 */
function renderHeader() {
  const { recording, mocking } = state.tab;
  const cors = state.settings.corsOverride;
  const trialBadge = state.trial && state.trialDaysLeft > 0
    ? `<span class="ek-trial-badge" title="Pro trial: ${state.trialDaysLeft} day${state.trialDaysLeft === 1 ? '' : 's'} left">${state.trialDaysLeft}d trial</span>` : '';

  // Stats bar matching design mockup
  const statsBar = `
    <div class="ek-stats-bar">
      <div class="ek-stat-item">
        <div class="ek-stat-value">${state.interactions.length}</div>
        <div class="ek-stat-label">REQS</div>
      </div>
    </div>
  `;

  return `
    <div class="ek-header">
      <div class="ek-header-top">
        <div class="ek-logo"><span class="ek-logo-mark">EK</span><span>ECHOKIT</span></div>
        ${trialBadge}
        <div class="ek-header-spacer"></div>
        ${recording
          ? `<button class="ek-btn ek-btn-record" data-action="stop-recording" data-testid="stop-recording-btn">STOP</button>`
          : `<button class="ek-btn" data-action="start-recording" data-testid="start-recording-btn">● REC</button>`}
        <label class="ek-switch ${mocking ? 'on' : ''}" data-testid="mock-master-toggle" title="Toggle mocking for this tab (Alt+Shift+M)">
          <input type="checkbox" ${mocking ? 'checked' : ''} data-action="toggle-mocking">
          <span class="ek-switch-track"></span>
          <span class="ek-switch-label">MOCK</span>
        </label>
        <label class="ek-switch ${cors ? 'on' : ''}" data-testid="cors-master-toggle" title="Inject permissive Access-Control-Allow-* on real responses (global)">
          <input type="checkbox" ${cors ? 'checked' : ''} data-action="toggle-cors-master">
          <span class="ek-switch-track"></span>
          <span class="ek-switch-label">CORS</span>
        </label>
        <button class="ek-btn ek-btn-ghost ek-btn-icon ${state.waterfall ? 'active' : ''}" data-action="toggle-waterfall"
          title="Toggle network waterfall view" data-testid="waterfall-toggle-btn" aria-label="Toggle network waterfall view"
          aria-pressed="${state.waterfall ? 'true' : 'false'}">
          <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><rect x="2" y="4" width="8" height="2.5" rx="1"/><rect x="2" y="8.75" width="12" height="2.5" rx="1"/><rect x="2" y="13.5" width="6" height="2.5" rx="1"/></svg>
        </button>
        <button class="ek-btn ek-btn-ghost ek-btn-icon" data-action="open-settings" title="Advanced Settings (CORS, Headers, Blocklist, etc.)" data-testid="settings-btn" aria-label="Advanced Settings (CORS, Headers, Blocklist, etc.)">
          <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd"/></svg>
        </button>
        <div class="ek-menu">
          <button class="ek-btn ek-btn-ghost ek-btn-icon" data-action="toggle-menu" title="More actions" data-testid="menu-btn" aria-label="More actions"
            aria-expanded="${state.menuOpen ? 'true' : 'false'}" aria-haspopup="menu">
            <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><circle cx="4" cy="10" r="1.6"/><circle cx="10" cy="10" r="1.6"/><circle cx="16" cy="10" r="1.6"/></svg>
          </button>
        </div>
      </div>
      ${statsBar}
    </div>
  `;
}

/**
 * Render the floating options menu anchored to the header menu button when the menu is open.
 *
 * Builds and inserts a fixed-position menu panel near the menu button, populates menu items
 * (including pro-gated actions and clipboard preview indicators), attaches click handlers that
 * invoke the appropriate action (e.g., export/import, copy/paste cookies/localStorage, gist,
 * settings, stop all recordings), and installs an outside-click listener to close and remove the panel.
 */
function renderMenu() {
  // Remove any existing menu panel
  document.querySelectorAll('.ek-menu-panel').forEach(n => n.remove());
  if (!state.menuOpen) return;
  const anchor = root.querySelector('[data-testid="menu-btn"]');
  if (!anchor) return;
  const panel = document.createElement('div');
  panel.className = 'ek-menu-panel';
  panel.setAttribute('data-testid', 'menu-panel');
  const addSep = () => {
    const sep = document.createElement('div');
    sep.className = 'ek-menu-sep';
    panel.appendChild(sep);
  };

  const addBtn = (menu, testId, text, highlight, ...suffixNodes) => {
    const b = document.createElement('button');
    b.className = 'ek-menu-item';
    b.setAttribute('data-menu', menu);
    b.setAttribute('data-testid', testId);
    if (highlight) {
      b.style.border = '1px solid rgba(251,191,36,0.4)';
      b.style.background = 'rgba(251,191,36,0.06)';
    }
    b.textContent = text;
    for (const node of suffixNodes) {
      if (!node) continue;
      b.appendChild(document.createTextNode(' '));
      b.appendChild(node);
    }
    panel.appendChild(b);
  };

  const createSubtle = (text) => {
    const s = document.createElement('span');
    s.className = 'ek-subtle';
    s.textContent = text;
    return s;
  };

  const createProTag = () => {
    const s = document.createElement('span');
    s.className = 'ek-pro-tag';
    s.textContent = 'PRO';
    return s;
  };

  let pasteHintNode;
  if (state.clipboardPreview) {
    pasteHintNode = createSubtle(`${state.clipboardPreview.count} keys · ${state.clipboardPreview.origin || ''}`);
  } else {
    pasteHintNode = createSubtle('nothing in clipboard');
  }

  addBtn('stop-all', 'menu-stop-all', 'Stop all recordings', false, createSubtle('across all tabs'));
  addSep();
  addBtn('clear', 'menu-clear', 'Clear recordings', false, createSubtle(String(state.interactions.length)));
  addBtn('export', 'menu-export', 'Export JSON', false);
  addBtn('import', 'menu-import', 'Import JSON', false);
  addBtn('import-har', 'menu-import-har', 'Import HAR', false, state.isPro ? null : createProTag());
  addBtn('export-har', 'menu-export-har', 'Export HAR', false, createSubtle('DevTools-compatible'), state.isPro ? null : createProTag());
  addBtn('export-postman', 'menu-export-postman', 'Export Postman Collection', false, state.isPro ? null : createProTag());
  addBtn('import-openapi', 'menu-import-openapi', 'Import OpenAPI / Swagger JSON', false);
  addSep();
  addBtn('ls-copy', 'menu-ls-copy', 'Copy localStorage', false, state.isPro ? createSubtle('active tab') : createProTag());
  addBtn('ls-paste', 'menu-ls-paste', 'Paste localStorage', state.clipboardPreview && state.clipboardPreview.kind === 'localStorage', state.isPro ? pasteHintNode : createProTag());
  addBtn('ck-copy', 'menu-ck-copy', 'Copy cookies', false, state.isPro ? createSubtle('active tab') : createProTag());
  addBtn('ck-paste', 'menu-ck-paste', 'Paste cookies', state.clipboardPreview && state.clipboardPreview.kind === 'cookies', state.isPro ? null : createProTag());
  addSep();
  addBtn('gist-upload', 'menu-gist-upload', 'Upload to GitHub Gist', false, state.isPro ? createSubtle('share w/ team') : createProTag());
  addBtn('gist-import', 'menu-gist-import', 'Import from Gist URL', false, state.isPro ? null : createProTag());
  addSep();
  addBtn('settings', 'menu-settings', 'Settings', false, createSubtle('theme · scope · cors · headers'));
  addBtn('shortcuts', 'menu-shortcuts', 'Keyboard shortcuts', false);
  document.body.appendChild(panel);
  const rect = anchor.getBoundingClientRect();
  panel.style.position = 'fixed';
  panel.style.top = `${rect.bottom + 6}px`;
  panel.style.right = `${Math.max(8, window.innerWidth - rect.right)}px`;

  panel.querySelectorAll('[data-menu]').forEach(el => el.addEventListener('click', () => {
    const which = el.getAttribute('data-menu');
    state.menuOpen = false;
    if (which === 'stop-all') onStopAllRecordings();
    else if (which === 'clear') onClearSession();
    else if (which === 'export') onExport();
    else if (which === 'export-har') onExportHar();
    else if (which === 'export-postman') onExportPostman();
    else if (which === 'import') showImportDialog();
    else if (which === 'import-har') onImportHar();
    else if (which === 'import-openapi') onImportOpenAPI();
    else if (which === 'ls-copy') onCopyLocalStorage();
    else if (which === 'ls-paste') onPasteLocalStorage();
    else if (which === 'ck-copy') onCopyCookies();
    else if (which === 'ck-paste') onPasteCookies();
    else if (which === 'gist-upload') { if (!state.isPro) { showProGate('GitHub Gist Sync'); } else { showGistUploadDialog(); } }
    else if (which === 'gist-import') { if (!state.isPro) { showProGate('GitHub Gist Sync'); } else { showGistImportDialog(); } }
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
      state.clipboardPreview = { kind: 'localStorage', count: Object.keys(j.keys).length, origin: j.origin || '', payload: j };
    } else if (j && j.__echokit === 'cookies' && Array.isArray(j.cookies)) {
      state.clipboardPreview = { kind: 'cookies', count: j.cookies.length, origin: j.origin || '', payload: j };
    } else {
      state.clipboardPreview = null;
    }
  } catch { state.clipboardPreview = null; }
}

async function onExportHar() {
  if (!state.isPro) { showProGate('HAR Export'); return; }
  const res = await BG({ type: 'echokit:export:har' });
  if (!res?.ok) { alert('HAR export failed'); return; }
  const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `echokit-${Date.now()}.har`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
  toast('HAR file downloaded');
}

async function onExportPostman() {
  if (!state.isPro) { showProGate('Postman Export'); return; }
  const res = await BG({ type: 'echokit:export:postman' });
  if (!res?.ok) { alert('Postman export failed'); return; }
  const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `echokit-collection-${Date.now()}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
  toast('Postman collection downloaded');
}

function onImportHar() {
  if (!state.isPro) { showProGate('HAR Import'); return; }
  const input = document.createElement('input');
  input.type = 'file'; input.accept = '.har,application/json';
  input.onchange = async () => {
    const file = input.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data?.log?.entries) { alert('Invalid HAR file — missing log.entries'); return; }
      const strategy = confirm('Override existing recordings?\nOK = Replace all\nCancel = Merge') ? 'override' : 'merge';
      const res = await BG({ type: 'echokit:import:har', data, strategy });
      if (res?.ok) { toast(`Imported ${res.imported} entries from HAR`); await refresh(); render(); }
      else alert('HAR import failed: ' + (res?.error || 'unknown'));
    } catch (e) { alert('Failed to parse HAR: ' + e.message); }
  };
  input.click();
}

function onImportOpenAPI() {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = '.json,application/json';
  input.onchange = async () => {
    const file = input.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const baseUrl = prompt('Override base URL? (leave blank to use spec servers[])', '') || '';
      const res = await BG({ type: 'echokit:import:openapi', data, baseUrl });
      if (res?.ok) { toast(`Imported ${res.imported} mock${res.imported === 1 ? '' : 's'} from OpenAPI spec`); await refresh(); render(); }
      else alert('OpenAPI import failed: ' + (res?.error || 'unknown'));
    } catch (e) { alert('Failed to parse spec: ' + e.message); }
  };
  input.click();
}

function showProGate(feature) {
  const overlay = document.createElement('div');
  overlay.className = 'ek-modal-overlay';
  overlay.innerHTML = sanitizeHTML(`
    <div class="ek-modal ek-pro-gate" data-testid="pro-gate-modal">
      <div class="ek-pro-badge">PRO</div>
      <div class="ek-modal-title">${escapeHtml(feature)}</div>
      <div class="ek-subtle" style="margin:8px 0 16px">Upgrade to <strong>EchoKit Pro</strong> to unlock this feature plus unlimited recordings, WebSocket mocking, advanced matching, HAR/Postman export, GitHub Gist sync, and more.</div>
      <div class="ek-modal-actions">
        <button class="ek-btn ek-btn-ghost" data-a="later">Maybe later</button>
        <button class="ek-btn ek-btn-primary" data-a="upgrade" data-testid="pro-gate-upgrade-btn">Upgrade to Pro →</button>
      </div>
    </div>
  `);
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  overlay.querySelector('[data-a="later"]').addEventListener('click', () => overlay.remove());
  overlay.querySelector('[data-a="upgrade"]').addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://echokit.dev/pricing' }).catch(() => window.open('https://echokit.dev/pricing', '_blank'));
    overlay.remove();
  });
}

function showDevToolsGuide() {
  const overlay = document.createElement('div');
  overlay.className = 'ek-modal-overlay';
  overlay.innerHTML = sanitizeHTML(`
    <div class="ek-modal" data-testid="devtools-guide-modal">
      <div class="ek-modal-title">⚙️ Advanced Settings in DevTools</div>
      <div style="margin:16px 0">
        <p style="margin:0 0 12px;line-height:1.6;color:var(--text-secondary)">
          For the best settings experience with advanced features and unlimited space:
        </p>
        <ol style="margin:0 0 16px;padding-left:24px">
          <li style="margin:8px 0;line-height:1.6">Press <kbd style="display:inline-block;padding:2px 8px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:4px;font-family:var(--font-mono);font-size:12px;font-weight:600">F12</kbd> or <kbd style="display:inline-block;padding:2px 8px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:4px;font-family:var(--font-mono);font-size:12px;font-weight:600">Cmd+Opt+I</kbd> to open Chrome DevTools</li>
          <li style="margin:8px 0;line-height:1.6">Click the <strong>EchoKit</strong> tab (next to Console, Network, etc.)</li>
          <li style="margin:8px 0;line-height:1.6">Click the ⚙️ <strong>Settings</strong> button in the header to access all configuration options</li>
        </ol>
        <div style="background:var(--bg-secondary);border-radius:8px;padding:16px;margin:16px 0">
          <strong style="display:block;margin-bottom:12px;color:var(--accent)">Available in DevTools Settings:</strong>
          <ul style="list-style:none;padding:0;margin:0">
            <li style="padding:4px 0;font-size:14px">🔑 <strong>Global Request Headers</strong> - Inject custom headers on all requests</li>
            <li style="padding:4px 0;font-size:14px">🚫 <strong>Blocklist</strong> - Block specific requests by pattern</li>
            <li style="padding:4px 0;font-size:14px">🔄 <strong>Rewrite Rules</strong> - Transform URLs before sending</li>
            <li style="padding:4px 0;font-size:14px">✏️ <strong>Response Transforms</strong> - Modify response bodies</li>
            <li style="padding:4px 0;font-size:14px">⚡ <strong>CORS Override</strong> - Bypass CORS restrictions</li>
            <li style="padding:4px 0;font-size:14px">🎨 <strong>Theme & Scope</strong> - Customize appearance and data scope</li>
          </ul>
        </div>
        <p style="background:rgba(96,165,250,0.1);border-left:3px solid var(--accent);padding:12px 16px;border-radius:4px;font-size:14px;margin:0">
          <strong>💡 Tip:</strong> The DevTools panel provides unlimited space for managing complex configurations!
        </p>
      </div>
      <div class="ek-modal-actions">
        <button class="ek-btn ek-btn-primary" data-a="close">Got it!</button>
      </div>
    </div>
  `);
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  overlay.querySelector('[data-a="close"]').addEventListener('click', () => overlay.remove());
}

async function onCopyCookies() {
  if (!state.isPro) { showProGate('Cookies Copy'); return; }
  if (state.tabId == null) { alert('No active tab'); return; }
  const r = await BG({ type: 'echokit:cookies:read', tabId: state.tabId });
  if (!r?.ok) { alert('Failed to read cookies: ' + (r?.error || 'unknown')); return; }
  const payload = { __echokit: 'cookies', version: 1, origin: r.origin, copiedAt: new Date().toISOString(), cookies: r.cookies };
  try {
    await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    await tryReadClipboardPreview(); render();
    toast(`Copied ${r.count} cookies from ${r.origin}`);
  } catch (e) { alert('Clipboard write failed: ' + e.message); }
}

async function onPasteCookies() {
  if (!state.isPro) { showProGate('Cookies Paste'); return; }
  await tryReadClipboardPreview();
  if (!state.clipboardPreview || state.clipboardPreview.kind !== 'cookies') {
    alert('Clipboard has no EchoKit cookies payload.\nCopy from another tab first via Menu → Copy cookies.');
    return;
  }
  const { count, origin, payload } = state.clipboardPreview;
  if (!confirm(`Write ${count} cookies from ${origin} into ${state.tab.host || 'active tab'}?`)) return;
  const r = await BG({ type: 'echokit:cookies:write', tabId: state.tabId, cookies: payload.cookies });
  if (r?.ok) toast(`Wrote ${r.written} cookies. Reload the tab.`);
  else alert('Paste failed: ' + (r?.error || 'unknown'));
}

async function onCopyLocalStorage() {
  if (!state.isPro) { showProGate('LocalStorage Copy'); return; }
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
  if (!state.isPro) { showProGate('LocalStorage Paste'); return; }
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
  overlay.innerHTML = sanitizeHTML(`
    <div class="ek-modal" data-testid="paste-modal">
      <div class="ek-modal-title">Paste localStorage</div>
      <div class="ek-subtle">${escapeHtml(count)} keys · from <span class="ek-tag">${escapeHtml(origin)}</span> → into <span class="ek-tag">${escapeHtml(state.tab.host || 'active tab')}</span></div>
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
  `);
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
  t.setAttribute('role', 'status');
  t.setAttribute('aria-live', 'polite');
  t.style.cssText = 'position:fixed;bottom:16px;left:50%;transform:translateX(-50%);background:var(--surface);color:var(--text);border:1px solid var(--border-strong);border-radius:8px;padding:10px 16px;font-size:12px;z-index:200;box-shadow:0 6px 24px rgba(0,0,0,0.4)';
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

// ---------- Gist sync ----------
function showGistUploadDialog() {
  const lastToken = localStorage.getItem('ek_gist_token') || '';
  const overlay = document.createElement('div');
  overlay.className = 'ek-modal-overlay';
  overlay.innerHTML = sanitizeHTML(`
    <div class="ek-modal" data-testid="gist-upload-modal">
      <div class="ek-modal-title">Share mocks via GitHub Gist</div>
      <div class="ek-subtle">Uploads your full mock set as a JSON file to a new gist. Teammates can import from the URL.</div>
      <div class="ek-field">
        <div class="ek-label">GitHub Personal Access Token <span class="ek-subtle">(gist scope)</span></div>
        <input class="ek-input" type="password" value="${escapeHtml(lastToken)}" placeholder="ghp_..." data-a="token" data-testid="gist-token" autocomplete="off"/>
        <div class="ek-subtle" style="margin-top:4px">Create at <span class="ek-tag">github.com/settings/tokens</span> with just <span class="ek-tag">gist</span> scope. Stored locally in this extension only.</div>
      </div>
      <div class="ek-field">
        <div class="ek-label">Description</div>
        <input class="ek-input" type="text" value="EchoKit mock set — ${escapeHtml(state.tab.host || '')}" data-a="desc" data-testid="gist-desc"/>
      </div>
      <label class="ek-row-inline" style="gap:6px"><input type="checkbox" data-a="public"/> <span>Public gist</span></label>
      <div class="ek-modal-actions">
        <button class="ek-btn ek-btn-ghost" data-a="cancel">Cancel</button>
        <button class="ek-btn ek-btn-primary" data-a="upload" data-testid="gist-upload-confirm">Upload</button>
      </div>
    </div>
  `);
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
  overlay.innerHTML = sanitizeHTML(`
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
  `);
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

function renderToolbar(filteredCount) {
  const features = getFeatures();
  const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

  if (!features.advancedFilters) {
    // POPUP: Simple toolbar (current implementation)
    return `
      <div class="ek-toolbar">
        <input class="ek-search" type="text" placeholder="search url…" value="${escapeHtml(state.search)}" data-action="search" data-testid="search-input" autocomplete="off" spellcheck="false"/>
        <div class="ek-method-chips">
          ${methods.map(m => `<button type="button" class="ek-chip ${state.methodFilter === m ? 'active' : ''}" data-action="filter-method" data-method="${m}" data-testid="filter-${m.toLowerCase()}" title="Filter by ${m}" aria-label="Filter by ${m}" aria-pressed="${state.methodFilter === m ? 'true' : 'false'}">${m}</button>`).join('')}
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
  } else {
    // DEVTOOLS: Advanced toolbar with filter panel
    return renderAdvancedToolbar(filteredCount);
  }
}

function renderAdvancedToolbar(filteredCount) {
  const features = getFeatures();
  const activeCount = getActiveFilterCount();

  return `
    <div class="ek-toolbar ek-toolbar-advanced">
      <div class="ek-toolbar-row">
        <input class="ek-search"
               type="text"
               placeholder="search url, method, status…"
               value="${escapeHtml(state.search)}"
               data-action="search"
               data-testid="search-input"
               autocomplete="off"
               spellcheck="false"/>
        <button type="button"
                class="ek-btn ${state.advancedFilterOpen ? 'active' : ''}"
                data-action="toggle-advanced-filters"
                data-testid="toggle-advanced-filters"
                title="Toggle advanced filters"
                aria-label="Toggle advanced filters"
                aria-expanded="${state.advancedFilterOpen ? 'true' : 'false'}"
                aria-controls="advanced-filters-panel">
          🔍 Advanced ${state.advancedFilterOpen ? '▲' : '▼'}
        </button>
        ${activeCount > 0 ? `
          <button type="button"
                  class="ek-btn" data-action="clear-all-filters" data-testid="clear-filters"
                  title="Clear all active filters" aria-label="Clear all active filters">
            Clear All
          </button>
        ` : ''}
      </div>

      ${state.advancedFilterOpen ? renderAdvancedFilterPanel() : ''}
      ${features.filterChips ? renderFilterChips(filteredCount) : ''}
    </div>
  `;
}

function getActiveFilterCount() {
  let count = 0;
  if (state.filters.methods.length > 0) count++;
  if (state.filters.statusCodes.length > 0) count++;
  if (state.filters.requestBodyContains) count++;
  if (state.filters.responseBodyContains) count++;
  if (state.filters.requestHeader.name || state.filters.requestHeader.value) count++;
  if (state.filters.responseHeader.name || state.filters.responseHeader.value) count++;
  if (state.filters.mockEnabled !== null) count++;
  if (state.filters.blocked !== null) count++;
  if (state.filters.hasNotes !== null) count++;
  return count;
}

function renderMethodFilter() {
  const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
  return `
    <!-- Method Filter -->
    <div class="ek-filter-section">
      <label class="ek-filter-label">HTTP Method</label>
      <div class="ek-checkbox-group">
        ${methods.map(method => `
          <label class="ek-checkbox">
            <input type="checkbox"
                   data-action="filter-method-toggle"
                   data-method="${method}"
                   ${state.filters.methods.includes(method) ? 'checked' : ''}/>
            <span>${method}</span>
          </label>
        `).join('')}
      </div>
    </div>
  `;
}

function renderStatusFilter() {
  const statusOptions = [
    { value: '2xx', label: '2xx (Success)' },
    { value: '3xx', label: '3xx (Redirect)' },
    { value: '4xx', label: '4xx (Client Error)' },
    { value: '5xx', label: '5xx (Server Error)' },
    { value: '0', label: 'Failed (Network/Timeout)' }
  ];
  return `
    <!-- Status Filter -->
    <div class="ek-filter-section">
      <label class="ek-filter-label">Response Status</label>
      <div class="ek-checkbox-group">
        ${statusOptions.map(({ value, label }) => `
          <label class="ek-checkbox">
            <input type="checkbox"
                   data-action="filter-status-toggle"
                   data-status="${value}"
                   ${state.filters.statusCodes.includes(value) ? 'checked' : ''}/>
            <span>${label}</span>
          </label>
        `).join('')}
      </div>
    </div>
  `;
}

function renderBodySearchFilter() {
  return `
    <!-- Body Search -->
    <div class="ek-filter-section">
      <label class="ek-filter-label">Search Body Content</label>
      <input class="ek-input"
             type="text"
             placeholder="Request body contains…"
             value="${escapeHtml(state.filters.requestBodyContains)}"
             data-action="filter-request-body"
             data-testid="filter-request-body"/>
      <input class="ek-input"
             type="text"
             placeholder="Response body contains…"
             value="${escapeHtml(state.filters.responseBodyContains)}"
             data-action="filter-response-body"
             data-testid="filter-response-body"/>
    </div>
  `;
}

function renderHeaderSearchFilter() {
  return `
    <!-- Header Search -->
    <div class="ek-filter-section">
      <label class="ek-filter-label">Search Headers</label>
      <div class="ek-header-filters">
        <div class="ek-row-inline">
          <input class="ek-input"
                 placeholder="Request header name"
                 value="${escapeHtml(state.filters.requestHeader.name)}"
                 data-action="filter-req-header-name"
                 style="flex:1"/>
          <input class="ek-input"
                 placeholder="value"
                 value="${escapeHtml(state.filters.requestHeader.value)}"
                 data-action="filter-req-header-value"
                 style="flex:1"/>
        </div>
        <div class="ek-row-inline">
          <input class="ek-input"
                 placeholder="Response header name"
                 value="${escapeHtml(state.filters.responseHeader.name)}"
                 data-action="filter-res-header-name"
                 style="flex:1"/>
          <input class="ek-input"
                 placeholder="value"
                 value="${escapeHtml(state.filters.responseHeader.value)}"
                 data-action="filter-res-header-value"
                 style="flex:1"/>
        </div>
      </div>
    </div>
  `;
}

function renderSourceFilter() {
  return `
    <!-- Source Filter (NEW) -->
    <div class="ek-filter-section">
      <label class="ek-filter-label">API Source</label>
      <div class="ek-checkbox-group">
        <label class="ek-checkbox">
          <input type="checkbox"
                 data-action="filter-source-toggle"
                 data-source="thisTab"
                 ${state.filters.sources.thisTab ? 'checked' : ''}/>
          <span>This tab</span>
        </label>
        <label class="ek-checkbox">
          <input type="checkbox"
                 data-action="filter-source-toggle"
                 data-source="otherTabs"
                 ${state.filters.sources.otherTabs ? 'checked' : ''}/>
          <span>Other tabs</span>
        </label>
        <label class="ek-checkbox">
          <input type="checkbox"
                 data-action="filter-source-toggle"
                 data-source="closedTabs"
                 ${state.filters.sources.closedTabs ? 'checked' : ''}/>
          <span>Closed tabs</span>
        </label>
        <label class="ek-checkbox">
          <input type="checkbox"
                 data-action="filter-source-toggle"
                 data-source="imported"
                 ${state.filters.sources.imported ? 'checked' : ''}/>
          <span>Imported</span>
        </label>
      </div>
    </div>
  `;
}

function renderAdvancedFilterPanel() {
  return `
    <div id="advanced-filters-panel" class="ek-advanced-filters" data-testid="advanced-filters">
      ${renderMethodFilter()}
      ${renderStatusFilter()}
      ${renderBodySearchFilter()}
      ${renderHeaderSearchFilter()}
      ${renderSourceFilter()}
    </div>
  `;
}

/**
 * Render the active filter chips row as an HTML string.
 *
 * Builds a compact row of removable filter "chips" for each active advanced filter
 * (methods, status codes, body/header contains) and includes counts showing how
 * many filters are active and how many interactions are shown vs total.
 *
 * @returns {string} An HTML snippet with the filter chips and summary counts, or an empty string when no filters are active.
 */
function renderFilterChips(filteredCount) {
  const chips = [];

  // Method chips
  state.filters.methods.forEach(m => {
    chips.push(`
      <button type="button" class="ek-filter-chip"
            data-action="remove-filter"
            data-type="method"
            data-value="${m}"
            data-testid="chip-method-${m.toLowerCase()}"
            title="Remove method filter ${m}" aria-label="Remove method filter ${m}">
        × method:${m}
      </button>
    `);
  });

  // Status chips
  state.filters.statusCodes.forEach(s => {
    chips.push(`
      <button type="button" class="ek-filter-chip"
            data-action="remove-filter"
            data-type="status"
            data-value="${s}"
            title="Remove status filter ${s}" aria-label="Remove status filter ${s}">
        × status:${s}
      </button>
    `);
  });

  // Body search chips
  if (state.filters.requestBodyContains) {
    chips.push(`
      <button type="button" class="ek-filter-chip"
            data-action="remove-filter"
            data-type="request-body"
            title="Remove request body filter" aria-label="Remove request body filter">
        × request:"${escapeHtml(state.filters.requestBodyContains.slice(0, 20))}"
      </button>
    `);
  }

  if (state.filters.responseBodyContains) {
    chips.push(`
      <button type="button" class="ek-filter-chip"
            data-action="remove-filter"
            data-type="response-body"
            title="Remove response body filter" aria-label="Remove response body filter">
        × response:"${escapeHtml(state.filters.responseBodyContains.slice(0, 20))}"
      </button>
    `);
  }

  // Header search chips (new)
  if (state.filters.requestHeader.name) {
    chips.push(`
      <button type="button" class="ek-filter-chip"
            data-action="remove-filter"
            data-type="request-header-name"
            title="Remove request header name filter" aria-label="Remove request header name filter">
        × req-header:"${escapeHtml(state.filters.requestHeader.name.slice(0, 20))}"
      </button>
    `);
  }

  if (state.filters.requestHeader.value) {
    chips.push(`
      <button type="button" class="ek-filter-chip"
            data-action="remove-filter"
            data-type="request-header-value"
            title="Remove request header value filter" aria-label="Remove request header value filter">
        × req-header-val:"${escapeHtml(state.filters.requestHeader.value.slice(0, 20))}"
      </button>
    `);
  }

  if (state.filters.responseHeader.name) {
    chips.push(`
      <button type="button" class="ek-filter-chip"
            data-action="remove-filter"
            data-type="response-header-name"
            title="Remove response header name filter" aria-label="Remove response header name filter">
        × res-header:"${escapeHtml(state.filters.responseHeader.name.slice(0, 20))}"
      </button>
    `);
  }

  if (state.filters.responseHeader.value) {
    chips.push(`
      <button type="button" class="ek-filter-chip"
            data-action="remove-filter"
            data-type="response-header-value"
            title="Remove response header value filter" aria-label="Remove response header value filter">
        × res-header-val:"${escapeHtml(state.filters.responseHeader.value.slice(0, 20))}"
      </button>
    `);
  }

  if (chips.length === 0) return '';

  const count = chips.length;

  const totalCount = state.interactions.length;

  return `
    <div class="ek-filter-chips-row" data-testid="filter-chips">
      <span class="ek-filter-count">Filters: ${count} active</span>
      <div class="ek-filter-chips">${chips.join('')}</div>
      <span class="ek-result-count">Showing ${filteredCount} of ${totalCount}</span>
    </div>
  `;
}

/**
 * Render an HTML waterfall timeline view representing the timing of the provided interactions.
 * @param {Array<Object>} interactions - List of interaction objects to render; each item is expected to include `id`, `url`, `method`, `timestamp`, optional `durationMs`, `responseStatus`, and optional `overrideStatus`.
 * @returns {string} An HTML string containing the waterfall view (or the empty view when no interactions are provided).
 */
function _renderWaterfall(interactions) {
  if (!interactions.length) return renderEmpty();

  // Sort by start time
  const rows = interactions.map(i => ({
    ...i,
    startAt: i.timestamp - (i.durationMs || 0)
  })).sort((a, b) => a.startAt - b.startAt);

  const minT = rows[0].startAt;
  let maxT = rows[0].startAt + (rows[0].durationMs || 1);
  for (let i = 1; i < rows.length; i++) {
    const endT = rows[i].startAt + (rows[i].durationMs || 1);
    if (endT > maxT) {
      maxT = endT;
    }
  }
  const totalSpan = Math.max(maxT - minT, 1);

  const METHOD_COLORS = {
    GET: '#60a5fa',
    POST: '#34d399',
    PUT: '#f59e0b',
    PATCH: '#a78bfa',
    DELETE: '#ef4444',
    WS: '#f97316',
    SSE: '#f97316'
  };

  // Format timeline duration
  const timelineLabel = totalSpan < 1000
    ? `${totalSpan}ms`
    : totalSpan < 60000
      ? `${(totalSpan / 1000).toFixed(2)}s`
      : `${(totalSpan / 60000).toFixed(1)}min`;

  return `
    <div class="ek-waterfall" data-testid="waterfall-view">
      <div class="ek-waterfall-header">
        <span class="ek-waterfall-col-method">Method</span>
        <span class="ek-waterfall-col-path">Path</span>
        <span class="ek-waterfall-col-status">Status</span>
        <span class="ek-waterfall-col-bar">Timeline (${timelineLabel})</span>
      </div>
      ${rows.map(r => {
        const relStart = ((r.startAt - minT) / totalSpan) * 100;
        const relWidth = Math.max((r.durationMs || 1) / totalSpan * 100, 0.5);
        const color = METHOD_COLORS[r.method] || '#8b8fa8';
        const st = r.overrideStatus ?? r.responseStatus;
        const stColor = st >= 500 ? '#ef4444' : st >= 400 ? '#f97316' : '#34d399';

        // Extract path from URL
        const path = (() => {
          try {
            const url = parseUrl(r.url);
            if (url) {
              return url.pathname + (url.search ? '?' + url.search.slice(1, 20) + (url.search.length > 20 ? '...' : '') : '');
            }
            return r.url;
          } catch {
            return r.url;
          }
        })();

        // Show duration label only if bar is wide enough
        const showDuration = relWidth > 5 && r.durationMs;

        return `
          <div class="ek-waterfall-row ${r.id === state.selectedId ? 'selected' : ''}"
               data-action="select" data-id="${r.id}" data-testid="waterfall-row"
               title="${escapeHtml(r.url)}\nDuration: ${r.durationMs || 0}ms\nStatus: ${st || 'pending'}">
            <span class="ek-waterfall-col-method">
              <span class="ek-method-badge" style="background:${color}22;color:${color};border-color:${color}44">${r.method}</span>
            </span>
            <span class="ek-waterfall-col-path ek-mono" title="${escapeHtml(r.url)}">${escapeHtml(path)}</span>
            <span class="ek-waterfall-col-status" style="color:${stColor}">${st ?? '—'}</span>
            <span class="ek-waterfall-col-bar">
              <span class="ek-waterfall-bar" style="left:${relStart.toFixed(2)}%;width:${relWidth.toFixed(2)}%;background:${color}"></span>
              ${showDuration ? `<span class="ek-waterfall-bar-label">${r.durationMs}ms</span>` : ''}
            </span>
          </div>
        `;
      }).join('')}
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
    <div class="ek-domain" data-testid="domain-group">
      <span class="ek-domain-icon"></span>
      <span class="ek-domain-name">${escapeHtml(g.domain)}</span>
      <span class="ek-domain-count">${g.items.length}</span>
    </div>
    ${g.items.map(renderRow).join('')}
  `;
}

function renderRow(i) {
  const versionCount = getConflictCount(i, state.interactions);
  const conflict = versionCount > 1;
  const active = state.selectedId === i.id ? 'active' : '';
  const method = (i.method || 'GET').toUpperCase();
  const urlPretty = prettyUrl(i.url);
  const statusClass = 's' + String(Math.floor((i.responseStatus || 0) / 100));
  const mode = i.matchMode || 'strict';
  const features = getFeatures();
  const showBadge = features.sourceBadges;

  return `
    <div class="ek-row ${active}" data-id="${i.id}" data-action="select" data-testid="api-row">
      <span class="ek-method ${method}">${method}</span>
      <div class="ek-url" title="${escapeHtml(i.url)}"><span class="ek-url-path">${escapeHtml(urlPretty.path)}</span><span class="ek-url-query">${escapeHtml(urlPretty.query)}</span></div>
      ${mode !== 'strict' ? `<span class="ek-mode-badge" title="match mode: ${mode}">${modeBadge(mode)}</span>` : ''}
      ${conflict ? `<span class="ek-conflict-badge" title="${versionCount} versions">×${versionCount}</span>` : ''}
      ${showBadge ? renderSourceBadge(i, state.tabId) : ''}
      <span class="ek-status ${statusClass}">${i.responseStatus || 'ERR'}</span>
      <button class="ek-mock-toggle ${i.mockEnabled ? 'on' : ''}" data-action="toggle-mock" data-id="${i.id}" title="${i.mockEnabled ? 'Disable mock' : 'Enable mock'}" data-testid="mock-toggle" aria-label="${i.mockEnabled ? 'Disable mock' : 'Enable mock'}"></button>
      <button class="ek-block-btn ${i.blocked ? 'on' : ''}" data-action="toggle-block" data-id="${i.id}" title="${i.blocked ? 'Unblock API' : 'Block API'}" data-testid="block-btn" aria-label="${i.blocked ? 'Unblock API' : 'Block API'}">⊘</button>
    </div>
  `;
}
/**
 * Map an internal match mode key to its short badge label.
 * @param {string} mode - Match mode key (e.g. 'ignore-query', 'ignore-body', 'path-wildcard').
 * @returns {string} The short badge label for the mode ('NOQ', 'NOB', 'PATH'), or the original mode string if no mapping exists.
 */
function modeBadge(mode) {
  return { 'ignore-query': 'NOQ', 'ignore-body': 'NOB', 'path-wildcard': 'PATH' }[mode] || mode;
}

/**
 * Render the interactions list as either a grouped-by-domain list or a sortable table based on UI mode and enabled features.
 * @param {Array<Object>} interactions - Array of interaction objects to render.
 * @param {boolean} isPopup - True when rendering the compact popup UI; false for the devtools panel.
 * @returns {string} The HTML for the list view; when `interactions` is empty returns the empty-list HTML.
 */
function _renderListView(interactions, isPopup) {
  if (interactions.length === 0) return renderEmpty();

  const features = getFeatures();

  // Popup or DevTools without sortable columns: use grouped list
  if (isPopup || !features.sortableColumns) {
    const grouped = groupByDomain(interactions);
    return grouped.map(renderDomainGroup).join('');
  }

  // DevTools with sortable columns: use table view
  return renderSortableTable(interactions);
}

// Renders sortable table view (DevTools only)
function renderSortableTable(interactions) {
  return `
    ${renderSortableListHeader()}
    <div class="ek-list-body" data-testid="list-body">
      ${interactions.map(renderInteractionRow).join('')}
    </div>
  `;
}

// Renders sortable table header
function renderSortableListHeader() {
  const features = getFeatures();
  const cols = [
    { key: 'method', label: 'Method', width: '80px' },
    { key: 'url', label: 'URL', flex: 2 },
    { key: 'status', label: 'Status', width: '80px' },
    { key: 'duration', label: 'Duration', width: '90px' },
    { key: 'timestamp', label: 'Time', width: '100px' },
    ...(features.sourceBadges ? [{ key: 'source', label: 'Source', width: '120px' }] : []),
    { key: 'actions', label: '', width: '80px' }
  ];

  return `
    <div class="ek-list-header" data-testid="list-header">
      ${cols.map(col => {
        const active = state.sortBy === col.key;
        const arrow = !active ? '' : state.sortOrder === 'asc' ? ' ↑' : ' ↓';
        const style = col.flex ? `flex:${col.flex}` : `width:${col.width}`;
        const clickable = col.key !== 'actions';

        return `
          <div class="ek-col ${active ? 'active' : ''} ${clickable ? 'clickable' : ''}"
               style="${style}"
               ${clickable ? `data-action="sort-by" data-column="${col.key}"` : ''}
               data-testid="sort-${col.key}">
            ${col.label}${arrow}
          </div>
        `;
      }).join('')}
    </div>
  `;
}

// Renders individual interaction row for table
function renderInteractionRow(i) {
  const st = i.overrideStatus ?? i.responseStatus;
  const stColor = st >= 500 ? 'var(--red)' : st >= 400 ? 'var(--amber)' : 'var(--emerald)';
  const path = (() => { try { const u = parseUrl(i.url); return u ? u.pathname : i.url; } catch { return i.url; } })();
  const active = i.id === state.selectedId ? 'selected' : '';
  const method = (i.method || 'GET').toUpperCase();
  const features = getFeatures();

  return `
    <div class="ek-table-row ${active}"
         data-action="select"
         data-id="${i.id}"
         data-testid="interaction-row">
      <div class="ek-col" style="width:80px">
        <span class="ek-method-badge ek-method-${escapeHtml(method.toLowerCase())}">${escapeHtml(method)}</span>
        ${i.mockEnabled ? '<span class="ek-mock-badge" title="Mock enabled">⚡</span>' : ''}
      </div>
      <div class="ek-col ek-url-col" style="flex:2" title="${escapeHtml(i.url)}">
        ${escapeHtml(path)}
      </div>
      <div class="ek-col" style="width:80px;color:${stColor}">
        ${st ?? '—'}
      </div>
      <div class="ek-col" style="width:90px">
        ${i.durationMs ? i.durationMs + 'ms' : '—'}
      </div>
      <div class="ek-col ek-timestamp" style="width:100px">
        ${formatTimestamp(i.timestamp)}
      </div>
      ${features.sourceBadges ? `
      <div class="ek-col" style="width:120px">
        ${renderSourceBadge(i, state.tabId)}
      </div>
      ` : ''}
      <div class="ek-col" style="width:80px;display:flex;gap:4px;justify-content:flex-end">
        <button class="ek-icon-btn ${i.mockEnabled ? 'on' : ''}"
                data-action="toggle-mock"
                data-id="${i.id}"
                title="${i.mockEnabled ? 'Disable mock' : 'Enable mock'}"
                data-testid="mock-toggle"
                aria-label="${i.mockEnabled ? 'Disable mock' : 'Enable mock'}">
          ${i.mockEnabled ? '✓' : '○'}
        </button>
        <button class="ek-icon-btn ${i.blocked ? 'on' : ''}"
                data-action="toggle-block"
                data-id="${i.id}"
                title="${i.blocked ? 'Unblock API' : 'Block API'}"
                data-testid="block-btn"
                aria-label="${i.blocked ? 'Unblock API' : 'Block API'}">
          ⊘
        </button>
      </div>
    </div>
  `;
}

// Helper: Format timestamp for display
function formatTimestamp(ts) {
  const now = Date.now();
  const diff = now - ts;

  if (diff < 60000) return Math.floor(diff / 1000) + 's ago';
  if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
  if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
  return new Date(ts).toLocaleDateString();
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
      <button class="ek-close" data-action="close-detail" data-testid="close-detail" title="close" aria-label="close">✕</button>
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
                `<option value="${escapeHtml(c.id)}" ${c.id === activeId ? 'selected' : ''}>${escapeHtml(new Date(c.timestamp).toLocaleString())} — ${escapeHtml(String(c.responseStatus))}</option>`
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
                <input class="ek-slider" type="range" min="0" max="10000" step="50" value="${i.mockLatency || 0}" data-action="update-latency" data-id="${i.id}" data-testid="latency-slider" aria-label="Mock latency in milliseconds" title="Mock latency in milliseconds"/>
                <input class="ek-input" type="number" min="0" style="max-width: 88px" value="${i.mockLatency || 0}" data-action="update-latency-input" data-id="${i.id}" aria-label="Mock latency in milliseconds input" title="Mock latency in milliseconds input"/>
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
            <input class="ek-input" type="number" value="${overrideStatus}" data-action="update-status" data-id="${i.id}" data-testid="status-input" aria-label="Mock response status code" title="Mock response status code"/>
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
                  <button class="ek-kv-remove" data-action="header-remove" data-id="${i.id}" data-key="${escapeHtml(k)}" title="remove" aria-label="remove">×</button>
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

      ${(i.method === 'WS' || i.method === 'SSE') ? `
      <div class="ek-section" data-testid="ws-frames-section">
        <div class="ek-section-head">
          <span>${i.method === 'WS' ? 'WebSocket Frames' : 'SSE Events'}</span>
          <div class="ek-row-inline-end">
            <label class="ek-switch ${i.wsLoop ? 'on' : ''}" title="Loop replay">
              <input type="checkbox" ${i.wsLoop ? 'checked' : ''} data-action="update-ws-loop" data-id="${i.id}"/>
              <span class="ek-switch-track"></span>
              <span class="ek-switch-label">Loop</span>
            </label>
          </div>
        </div>
        <div class="ek-section-body">
          ${(() => {
            try {
              const b = JSON.parse(i.responseBody || '{}');
              const frames = b.frames || [];
              if (!frames.length) return '<div class="ek-subtle">No frames recorded yet.</div>';
              return frames.slice(0, 30).map(f => `
                <div class="ek-ws-frame ek-ws-frame-${f.dir}">
                  <span class="ek-ws-dir">${f.dir === 'in' ? '▼ IN' : '▲ OUT'}</span>
                  <span class="ek-ws-t ek-subtle">+${f.t}ms</span>
                  <span class="ek-ws-data">${escapeHtml(String(f.data || '').slice(0, 120))}${String(f.data || '').length > 120 ? '…' : ''}</span>
                </div>
              `).join('') + (frames.length > 30 ? `<div class="ek-subtle">…${frames.length - 30} more frames</div>` : '');
            } catch { return '<div class="ek-subtle">Could not parse frame data.</div>'; }
          })()}
        </div>
      </div>` : ''}

      <div class="ek-section">
        <div class="ek-section-head"><span>Conditional Mock</span><span class="ek-subtle" style="font-size:10px">Fire N times then pass-through</span></div>
        <div class="ek-section-body">
          <div class="ek-field ek-row-inline" style="gap:8px;align-items:center">
            <div class="ek-label" style="min-width:60px">Max uses</div>
            <input class="ek-input" type="number" min="0" placeholder="∞ unlimited" style="max-width:120px"
              value="${i.mockMaxCount ?? ''}" data-action="update-max-count" data-id="${i.id}" data-testid="max-count-input"/>
            <span class="ek-subtle">${i.mockCallCount ? `${i.mockCallCount} hit${i.mockCallCount === 1 ? '' : 's'}` : ''}</span>
            ${i.mockCallCount ? `<button class="ek-btn ek-btn-ghost" data-action="reset-mock-count" data-id="${i.id}" style="font-size:10px">Reset</button>` : ''}
          </div>
        </div>
      </div>

      <div class="ek-section" data-testid="mock-chain-section">
        <div class="ek-section-head">
          <span>Mock Chain</span>
          <span class="ek-subtle" style="font-size:10px">Cycle through responses on each call</span>
          <div class="ek-row-inline-end">
            ${(i.mockChain && i.mockChain.length > 0) ? `
              <span class="ek-subtle" data-testid="mock-chain-cursor">step ${((i.mockChainCursor || 0) % i.mockChain.length) + 1}/${i.mockChain.length}</span>
              <label class="ek-row-inline" style="gap:4px;margin-left:8px">
                <input type="checkbox" ${i.mockChainLoop !== false ? 'checked' : ''} data-action="update-chain-loop" data-id="${i.id}" data-testid="chain-loop-toggle"/>
                <span class="ek-subtle">loop</span>
              </label>
              <button class="ek-btn ek-btn-ghost" data-action="reset-chain-cursor" data-id="${i.id}" style="font-size:10px;margin-left:6px" data-testid="chain-reset-btn">Reset cursor</button>
            ` : ''}
          </div>
        </div>
        <div class="ek-section-body">
          ${(i.mockChain && i.mockChain.length > 0) ? i.mockChain.map((step, sIdx) => {
            const active = (((i.mockChainCursor || 0) % i.mockChain.length) === sIdx);
            return `
              <div style="border:1px solid ${active ? 'var(--amber)' : 'var(--border)'};border-radius:6px;padding:6px;margin-bottom:6px" data-testid="chain-step-${sIdx}">
                <div class="ek-row-inline" style="gap:6px;margin-bottom:4px">
                  <span class="ek-subtle" style="min-width:60px">step ${sIdx + 1}${active ? ' • next' : ''}</span>
                  <input class="ek-input" type="number" value="${step.status || 200}" data-action="chain-status" data-id="${i.id}" data-step="${sIdx}" style="max-width:80px" data-testid="chain-status-${sIdx}" placeholder="status"/>
                  <button class="ek-kv-remove ek-row-inline-end" data-action="chain-remove" data-id="${i.id}" data-step="${sIdx}" data-testid="chain-remove-${sIdx}" title="remove" aria-label="remove">×</button>
                </div>
                <textarea class="ek-textarea" style="min-height:50px;font-size:11px" data-action="chain-body" data-id="${i.id}" data-step="${sIdx}" data-testid="chain-body-${sIdx}" placeholder="response body (string or JSON)">${escapeHtml(typeof step.body === 'string' ? step.body : JSON.stringify(step.body || ''))}</textarea>
              </div>
            `;
          }).join('') : '<div class="ek-subtle">No chain steps. Add one to cycle responses on each call.</div>'}
          <button class="ek-btn ek-btn-ghost" data-action="chain-add" data-id="${i.id}" style="margin-top:4px" data-testid="chain-add-btn">＋ Add chain step</button>
        </div>
      </div>
    </div>
  `;
}

function renderFooter(count) {
  const isPopup = state.mode === 'popup';
  const recTag = state.tab.recording ? `<span class="ek-tag on">REC</span>` : `<span class="ek-tag">idle</span>`;
  const mockTag = state.tab.mocking ? `<span class="ek-tag amber">MOCK ON</span>` : '';
  const corsTag = state.settings.corsOverride ? `<button type="button" class="ek-tag amber" data-action="toggle-cors" data-testid="cors-chip" title="Open settings for CORS override" aria-label="Open settings for CORS override">CORS</button>` : '';
  const scope = state.settings.scope || 'domain';
  const freeLimit = !state.isPro ? `<span class="ek-subtle ${state.allCount >= 50 ? 'ek-limit-warn' : ''}" title="Free tier: 50 recordings max. Upgrade for unlimited.">${state.allCount}/50</span>` : '';

  const devToolsLink = isPopup ? `
    <a href="#"
       class="ek-devtools-link"
       data-action="open-devtools-guide"
       data-testid="devtools-link"
       title="Access advanced features in DevTools">
      🔧 Advanced tools in DevTools →
    </a>
  ` : '';

  return `
    <div class="ek-footer">
      ${recTag} ${mockTag} ${corsTag}
      <span class="ek-subtle">${count} request${count === 1 ? '' : 's'}</span>
      <span class="ek-subtle">· scope: <button type="button" class="ek-tag" data-action="cycle-scope" data-testid="scope-chip" title="Change scope: currently ${scope}" aria-label="Change scope: currently ${scope}">${scope}</button></span>
      ${freeLimit}
      ${devToolsLink}
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
      mirror.innerHTML = sanitizeHTML(highlightJSON(ta.value) + '\n'); // trailing NL so last line aligns
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

/**
 * Bind a UI action handler to an element that declares a `data-action`.
 *
 * Attaches the appropriate event listener for the given action, updates UI state,
 * invokes background RPCs, opens dialogs/menus, and triggers selective or full re-renders.
 * @param {Element} el - The DOM element whose `data-action` should be bound.
 * @param {string} action - The action name from `data-action`.
 * @param {string|number|null} id - Optional interaction identifier used by some actions.
 * @returns {boolean} `true` if a handler was attached for the provided action, `false` otherwise.
 */
function bindGlobalEvents(el, action, id) {
  if (action === 'select') {
    el.addEventListener('click', (e) => {
      if (e.target.closest('[data-action="toggle-mock"]')) return;
      state.selectedId = id;
      state.detailOpen = true; render();
    });
    return true;
  }
  if (action === 'start-recording') { el.addEventListener('click', onStartRecording); return true; }
  if (action === 'stop-recording') { el.addEventListener('click', onStopRecording); return true; }
  if (action === 'toggle-mocking') { el.addEventListener('change', onToggleMocking); return true; }
  if (action === 'toggle-cors-master') {
    el.addEventListener('change', async (e) => {
      await BG({ type: 'echokit:settings:update', patch: { corsOverride: e.target.checked } });
      await refresh(); render();
    });
    return true;
  }
  if (action === 'toggle-waterfall') {
    el.addEventListener('click', () => { state.waterfall = !state.waterfall; render(); });
    return true;
  }
  if (action === 'toggle-block') {
    el.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!state.isPro) { showProGate('API Blocking'); return; }
      const current = state.interactions.find(x => x.id === id);
      if (!current) return;
      await BG({ type: 'echokit:interaction:update', id, patch: { blocked: !current.blocked } });
      await refresh(); render();
    });
    return true;
  }
  if (action === 'toggle-menu') {
    el.addEventListener('click', async (e) => { e.stopPropagation(); state.menuOpen = !state.menuOpen; if (state.menuOpen) await tryReadClipboardPreview(); renderMenu(); });
    return true;
  }
  if (action === 'toggle-cors') { el.addEventListener('click', () => { state.menuOpen = false; showSettingsDialog(); }); return true; }
  if (action === 'open-settings') {
    el.addEventListener('click', () => {
      if (state.mode === 'popup') showDevToolsGuide(); else showSettingsDialog();
    });
    return true;
  }
  if (action === 'cycle-scope') {
    el.addEventListener('click', async () => {
      const order = ['domain', 'tab', 'global'];
      const next = order[(order.indexOf(state.settings.scope || 'domain') + 1) % order.length];
      await BG({ type: 'echokit:settings:update', patch: { scope: next } });
      await refresh(); render();
    });
    return true;
  }
  if (action === 'switch-to-tab') {
    el.addEventListener('click', async (e) => {
      e.stopPropagation();
      const tabId = parseInt(el.getAttribute('data-tab-id'), 10);
      if (Number.isNaN(tabId)) return;
      try { await chrome.tabs.update(tabId, { active: true }); } catch (err) { console.error('Failed to switch to tab:', err); }
    });
    return true;
  }
  if (action === 'delete-interaction') {
    el.addEventListener('click', async () => {
      if (!confirm('Delete this recorded API? This cannot be undone.')) return;
      await BG({ type: 'echokit:interaction:delete', id });
      state.selectedId = null; state.detailOpen = false;
      await refresh(); render();
    });
    return true;
  }
  if (action === 'open-devtools-guide') { el.addEventListener('click', (e) => { e.preventDefault(); showDevToolsGuide(); }); return true; }
  if (action === 'set-active-version') {
    el.addEventListener('change', async (e) => {
      await BG({ type: 'echokit:interaction:setActiveVersion', id: e.target.value });
      await refresh(); render();
    });
    return true;
  }
  if (action === 'close-detail') { el.addEventListener('click', () => { state.detailOpen = false; state.selectedId = null; render(); }); return true; }
  if (action === 'resize') { bindResizer(el); return true; }
  return false;
}

/**
 * Attach filter-related event handlers to an element based on a filter/action key.
 *
 * Binds the appropriate event listener(s) for toolbar and advanced filter controls (search, method/status toggles,
 * body/header contains inputs, source toggles, remove/clear actions, and sorting) and updates `state` then triggers
 * list refreshes via `softRenderList()` or `render()` as required.
 *
 * @param {Element} el - The element to bind the handler to.
 * @param {string} action - Action key that selects which handler to bind. Supported values:
 *   - 'search'
 *   - 'filter-method'
 *   - 'filter-status'
 *   - 'toggle-advanced-filters'
 *   - 'filter-method-toggle'
 *   - 'filter-status-toggle'
 *   - 'filter-source-toggle'
 *   - 'filter-request-body'
 *   - 'filter-response-body'
 *   - 'filter-req-header-name'
 *   - 'filter-req-header-value'
 *   - 'filter-res-header-name'
 *   - 'filter-res-header-value'
 *   - 'remove-filter'
 *   - 'sort-by'
 *   - 'clear-all-filters'
 * @param {string|number} _id - Unused identifier (present for API consistency).
 * @returns {boolean} `true` if a handler was bound for the given action, `false` otherwise.
 */
function bindFilterEvents(el, action, _id) {
  if (action === 'search') {
    let t;
    el.addEventListener('input', (e) => {
      state.search = e.target.value;
      clearTimeout(t);
      t = setTimeout(() => softRenderList(), SOFT_RENDER_DEBOUNCE);
    });
    return true;
  }
  if (action === 'filter-method') {
    el.addEventListener('click', () => {
      const m = el.getAttribute('data-method');
      state.methodFilter = state.methodFilter === m ? null : m;
      render();
    });
    return true;
  }
  if (action === 'filter-status') { el.addEventListener('change', (e) => { state.statusFilter = e.target.value || null; render(); }); return true; }
  if (action === 'toggle-advanced-filters') { el.addEventListener('click', () => { state.advancedFilterOpen = !state.advancedFilterOpen; render(); }); return true; }
  if (action === 'filter-method-toggle') {
    el.addEventListener('change', (e) => {
      const method = el.getAttribute('data-method');
      if (e.target.checked) {
        if (!state.filters.methods.includes(method)) state.filters.methods.push(method);
      } else {
        state.filters.methods = state.filters.methods.filter(m => m !== method);
      }
      softRenderList();
    });
    return true;
  }
  if (action === 'filter-status-toggle') {
    el.addEventListener('change', (e) => {
      const status = el.getAttribute('data-status');
      if (e.target.checked) {
        if (!state.filters.statusCodes.includes(status)) state.filters.statusCodes.push(status);
      } else {
        state.filters.statusCodes = state.filters.statusCodes.filter(s => s !== status);
      }
      softRenderList();
    });
    return true;
  }
  if (action === 'filter-source-toggle') {
    el.addEventListener('change', (e) => {
      const source = el.getAttribute('data-source');
      state.filters.sources[source] = e.target.checked;
      softRenderList();
    });
    return true;
  }
  if (action === 'filter-request-body') { debounceInput(el, (value) => { state.filters.requestBodyContains = value; softRenderList(); }, DEBOUNCE_DELAY); return true; }
  if (action === 'filter-response-body') { debounceInput(el, (value) => { state.filters.responseBodyContains = value; softRenderList(); }, DEBOUNCE_DELAY); return true; }
  if (action === 'filter-req-header-name') { debounceInput(el, (value) => { state.filters.requestHeader.name = value; softRenderList(); }, DEBOUNCE_DELAY); return true; }
  if (action === 'filter-req-header-value') { debounceInput(el, (value) => { state.filters.requestHeader.value = value; softRenderList(); }, DEBOUNCE_DELAY); return true; }
  if (action === 'filter-res-header-name') { debounceInput(el, (value) => { state.filters.responseHeader.name = value; softRenderList(); }, DEBOUNCE_DELAY); return true; }
  if (action === 'filter-res-header-value') { debounceInput(el, (value) => { state.filters.responseHeader.value = value; softRenderList(); }, DEBOUNCE_DELAY); return true; }
  if (action === 'remove-filter') {
    el.addEventListener('click', () => {
      const type = el.getAttribute('data-type');
      const value = el.getAttribute('data-value');
      if (type === 'method') { state.filters.methods = state.filters.methods.filter(m => m !== value); }
      else if (type === 'status') { state.filters.statusCodes = state.filters.statusCodes.filter(s => s !== value); }
      else if (type === 'request-body') { state.filters.requestBodyContains = ''; }
      else if (type === 'response-body') { state.filters.responseBodyContains = ''; }
      else if (type === 'request-header-name') { state.filters.requestHeader.name = ''; }
      else if (type === 'request-header-value') { state.filters.requestHeader.value = ''; }
      else if (type === 'response-header-name') { state.filters.responseHeader.name = ''; }
      else if (type === 'response-header-value') { state.filters.responseHeader.value = ''; }
      render();
    });
    return true;
  }
  if (action === 'sort-by') { el.addEventListener('click', () => { applySort(el.getAttribute('data-column')); }); return true; }
  if (action === 'clear-all-filters') {
    el.addEventListener('click', () => {
      state.filters = {
        methods: [], statusCodes: [], requestBodyContains: '', responseBodyContains: '',
        requestHeader: { name: '', value: '' }, responseHeader: { name: '', value: '' },
        mockEnabled: null, blocked: null, hasNotes: null,
        sources: { thisTab: true, otherTabs: true, closedTabs: false, imported: true }
      };
      state.search = '';
      render();
    });
    return true;
  }
  return false;
}

function bindMockEvents(el, action, id) {
  if (action === 'toggle-mock') {
    const handler = async () => {
      const current = state.interactions.find(x => x.id === id);
      if (!current) return;
      await BG({ type: 'echokit:interaction:update', id, patch: { mockEnabled: !current.mockEnabled } });
      await refresh(); render();
    };
    if (el.tagName === 'INPUT') el.addEventListener('change', handler);
    else el.addEventListener('click', (e) => { e.stopPropagation(); handler(); });
    return true;
  }
  if (action === 'update-latency' || action === 'update-latency-input') {
    el.addEventListener('change', async (e) => {
      await BG({ type: 'echokit:interaction:update', id, patch: { mockLatency: Number(e.target.value) || 0 } });
      await refresh(); render();
    });
    return true;
  }
  if (action === 'update-error-mode') {
    el.addEventListener('change', async (e) => {
      await BG({ type: 'echokit:interaction:update', id, patch: { mockErrorMode: e.target.value } });
      await refresh(); render();
    });
    return true;
  }
  if (action === 'update-match-mode') {
    el.addEventListener('change', async (e) => {
      if (e.target.value !== 'strict' && !state.isPro) { showProGate('Advanced Match Modes'); e.target.value = 'strict'; return; }
      await BG({ type: 'echokit:interaction:update', id, patch: { matchMode: e.target.value } });
      await refresh(); render();
    });
    return true;
  }
  if (action === 'update-status') {
    el.addEventListener('change', async (e) => {
      await BG({ type: 'echokit:interaction:update', id, patch: { overrideStatus: Number(e.target.value) || 200 } });
      await refresh(); render();
    });
    return true;
  }
  if (action === 'update-body') {
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
    return true;
  }
  if (action === 'format-json') {
    el.addEventListener('click', async () => {
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
    return true;
  }
  if (action === 'reset-body') {
    el.addEventListener('click', async () => {
      await BG({ type: 'echokit:interaction:update', id, patch: { overrideBody: null } });
      await refresh(); render();
    });
    return true;
  }
  if (action === 'update-max-count') {
    el.addEventListener('change', async (e) => {
      const v = e.target.value.trim();
      await BG({ type: 'echokit:interaction:update', id, patch: { mockMaxCount: v === '' ? null : (Number(v) || 0) } });
      await refresh(); render();
    });
    return true;
  }
  if (action === 'update-ws-loop') {
    el.addEventListener('change', async (e) => {
      await BG({ type: 'echokit:interaction:update', id, patch: { wsLoop: e.target.checked } });
      await refresh(); render();
    });
    return true;
  }
  if (action === 'reset-mock-count') {
    el.addEventListener('click', async () => {
      await BG({ type: 'echokit:interaction:update', id, patch: { mockCallCount: 0 } });
      await refresh(); render();
    });
    return true;
  }
  return false;
}

function bindChainEvents(el, action, id) {
  if (action === 'chain-add') {
    el.addEventListener('click', async () => {
      const curr = state.interactions.find(x => x.id === id);
      const chain = [...(curr?.mockChain || []), { status: 200, body: '', headers: {} }];
      await BG({ type: 'echokit:interaction:update', id, patch: { mockChain: chain } });
      await refresh(); render();
    });
    return true;
  }
  if (action === 'chain-remove') {
    el.addEventListener('click', async () => {
      const sIdx = Number(el.getAttribute('data-step'));
      const curr = state.interactions.find(x => x.id === id);
      const chain = [...(curr?.mockChain || [])];
      chain.splice(sIdx, 1);
      const cursor = chain.length ? Math.min(curr.mockChainCursor || 0, chain.length - 1) : 0;
      await BG({ type: 'echokit:interaction:update', id, patch: { mockChain: chain.length ? chain : null, mockChainCursor: cursor } });
      await refresh(); render();
    });
    return true;
  }
  if (action === 'chain-status') {
    el.addEventListener('change', async (e) => {
      const sIdx = Number(el.getAttribute('data-step'));
      const curr = state.interactions.find(x => x.id === id);
      const chain = [...(curr?.mockChain || [])];
      chain[sIdx] = { ...(chain[sIdx] || {}), status: Number(e.target.value) || 200 };
      await BG({ type: 'echokit:interaction:update', id, patch: { mockChain: chain } });
      await refresh();
    });
    return true;
  }
  if (action === 'chain-body') {
    el.addEventListener('change', async (e) => {
      const sIdx = Number(el.getAttribute('data-step'));
      const curr = state.interactions.find(x => x.id === id);
      const chain = [...(curr?.mockChain || [])];
      chain[sIdx] = { ...(chain[sIdx] || {}), body: e.target.value };
      await BG({ type: 'echokit:interaction:update', id, patch: { mockChain: chain } });
      await refresh();
    });
    return true;
  }
  if (action === 'update-chain-loop') {
    el.addEventListener('change', async (e) => {
      await BG({ type: 'echokit:interaction:update', id, patch: { mockChainLoop: e.target.checked } });
      await refresh(); render();
    });
    return true;
  }
  if (action === 'reset-chain-cursor') {
    el.addEventListener('click', async () => {
      await BG({ type: 'echokit:interaction:update', id, patch: { mockChainCursor: 0 } });
      await refresh(); render();
    });
    return true;
  }
  return false;
}

function bindHeaderEvents(el, action, id) {
  if (action === 'header-add') {
    el.addEventListener('click', async () => {
      const curr = state.interactions.find(x => x.id === id);
      const headers = { ...(curr.overrideHeaders || curr.responseHeaders || {}) };
      let k = 'x-custom-header', i2 = 1;
      while (headers[k]) k = `x-custom-header-${i2++}`;
      headers[k] = '';
      await BG({ type: 'echokit:interaction:update', id, patch: { overrideHeaders: headers } });
      await refresh(); render();
    });
    return true;
  }
  if (action === 'header-remove') {
    el.addEventListener('click', async () => {
      const key = el.getAttribute('data-key');
      const curr = state.interactions.find(x => x.id === id);
      const headers = { ...(curr.overrideHeaders || curr.responseHeaders || {}) };
      delete headers[key];
      await BG({ type: 'echokit:interaction:update', id, patch: { overrideHeaders: headers } });
      await refresh(); render();
    });
    return true;
  }
  if (action === 'header-key') {
    el.addEventListener('change', async (e) => {
      const orig = el.getAttribute('data-orig');
      const next = e.target.value.trim();
      if (!next || next === orig) return;
      const curr = state.interactions.find(x => x.id === id);
      const headers = { ...(curr.overrideHeaders || curr.responseHeaders || {}) };
      headers[next] = headers[orig]; delete headers[orig];
      await BG({ type: 'echokit:interaction:update', id, patch: { overrideHeaders: headers } });
      await refresh(); render();
    });
    return true;
  }
  if (action === 'header-val') {
    el.addEventListener('change', async (e) => {
      const key = el.getAttribute('data-key');
      const curr = state.interactions.find(x => x.id === id);
      const headers = { ...(curr.overrideHeaders || curr.responseHeaders || {}) };
      headers[key] = e.target.value;
      await BG({ type: 'echokit:interaction:update', id, patch: { overrideHeaders: headers } });
      await refresh();
    });
    return true;
  }
  return false;
}

function bindEvents() {
  root.querySelectorAll('[data-action]').forEach(el => {
    const action = el.getAttribute('data-action');
    const id = el.getAttribute('data-id');

    if (bindGlobalEvents(el, action, id)) return;
    if (bindFilterEvents(el, action, id)) return;
    if (bindMockEvents(el, action, id)) return;
    if (bindChainEvents(el, action, id)) return;
    if (bindHeaderEvents(el, action, id)) return;
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

// Default sort order per column (desc for time-based, asc for text)
const DEFAULT_SORT_ORDER = {
  timestamp: 'desc',  // Newest first
  duration: 'desc',   // Slowest first
  status: 'desc',     // 5xx first
  method: 'asc',      // GET, POST, PUT, ...
  url: 'asc'          // Alphabetical
};

// Helper: Apply sort and re-render
function applySort(column) {
  if (state.sortBy === column) {
    // Toggle order for same column
    state.sortOrder = state.sortOrder === 'asc' ? 'desc' : 'asc';
  } else {
    // New column: use its default order
    state.sortBy = column;
    state.sortOrder = DEFAULT_SORT_ORDER[column] || 'desc';
  }
  softRenderList();
}

// Update just the list + footer without touching the toolbar/search (avoids cursor reset)
function softRenderList() {
  const list = root.querySelector('[data-testid="api-list"]');
  if (!list) return render();
  const items = filteredInteractions();
  const scrollTop = list.scrollTop;
  const isPopup = state.mode === 'popup';
  const features = getFeatures();

  // Render based on view mode
  if (isPopup || !features.sortableColumns) {
    // Grouped list view
    const grouped = groupByDomain(items);
    list.innerHTML = items.length === 0 ? sanitizeHTML(renderEmpty()) : sanitizeHTML(grouped.map(renderDomainGroup).join(''));
  } else {
    // Table view
    list.innerHTML = sanitizeHTML(renderSortableTable(items));
  }

  list.scrollTop = scrollTop;

  // Rebind list-level events
  list.querySelectorAll('[data-action="select"]').forEach(el => el.addEventListener('click', (e) => {
    if (e.target.closest('[data-action="toggle-mock"]') || e.target.closest('[data-action="toggle-block"]')) return;
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

  // CRITICAL: Rebind toggle-block handler (fixes CodeRabbit issue)
  list.querySelectorAll('[data-action="toggle-block"]').forEach(el => {
    el.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!state.isPro) { showProGate('API Blocking'); return; }
      const tid = el.getAttribute('data-id');
      const current = state.interactions.find(x => x.id === tid);
      if (!current) return;
      await BG({ type: 'echokit:interaction:update', id: tid, patch: { blocked: !current.blocked } });
      await refresh(); render();
    });
  });

  // Rebind sort handlers for table view
  if (!isPopup && features.sortableColumns) {
    list.querySelectorAll('[data-action="sort-by"]').forEach(el => {
      el.addEventListener('click', () => {
        const column = el.getAttribute('data-column');
        applySort(column);
      });
    });
  }

  // Rebind switch-to-tab handlers for source badges (NEW)
  list.querySelectorAll('[data-action="switch-to-tab"]').forEach(el => {
    el.addEventListener('click', async (e) => {
      e.stopPropagation();
      const tabId = parseInt(el.getAttribute('data-tab-id'), 10);
      if (!tabId) return;
      try {
        await chrome.tabs.update(tabId, { active: true });
      } catch (err) {
        console.error('Failed to switch to tab:', err);
      }
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
/**
 * Stop recording for the current tab, refresh the stored state, and re-render the UI.
 */
async function onStopRecording() {
  await BG({ type: 'echokit:recording:stop', tabId: state.tabId });
  await refresh(); render();
}
/**
 * Prompt the user to stop recording on every open tab, perform the stop action, refresh state, and update the UI.
 *
 * If the user confirms, sends a stop-all-recordings request to the background, displays an alert with the number of tabs stopped, then refreshes state and re-renders the UI.
 */
async function onStopAllRecordings() {
  if (!confirm('Stop recording on ALL open tabs?')) return;
  const res = await BG({ type: 'echokit:recording:stopAll' });
  if (res?.ok) {
    const count = res.stoppedCount || 0;
    alert(`Stopped recording on ${count} tab${count === 1 ? '' : 's'}.`);
  } else {
    const errorMsg = res?.error || 'Unknown error occurred';
    alert(`Failed to stop recordings: ${errorMsg}`);
  }
  await refresh(); render();
}
/**
 * Toggle mocking for the current tab based on the checkbox state and refresh the UI.
 * @param {Event} e - Change event from the mocking toggle checkbox; the checkbox's `checked` state determines whether mocking is enabled for the current tab.
 */
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
  overlay.innerHTML = sanitizeHTML(`
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
  `);
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

function renderRequestHeaderRule(r, idx) {
  return `
              <div style="border:1px solid var(--border);border-radius:6px;padding:8px;margin-bottom:6px;background:var(--bg-secondary)" data-testid="requestheader-row">
                <div class="ek-row-inline" style="gap:6px;margin-bottom:6px">
                  <input class="ek-input" value="${escapeHtml(r.key || '')}" data-a="rh-key" data-idx="${idx}" placeholder="Header name (e.g., Authorization)" style="flex:2" data-testid="requestheader-key-${idx}"/>
                  <select class="ek-select" data-a="rh-mode" data-idx="${idx}" style="max-width:120px" data-testid="requestheader-mode-${idx}">
                    <option value="add" ${r.mode==='add'?'selected':''}>Add</option>
                    <option value="override" ${(!r.mode || r.mode==='override')?'selected':''}>Override</option>
                    <option value="remove" ${r.mode==='remove'?'selected':''}>Remove</option>
                  </select>
                  <label class="ek-row-inline" style="gap:4px"><input type="checkbox" ${r.enabled!==false?'checked':''} data-a="rh-toggle" data-idx="${idx}" data-testid="requestheader-toggle-${idx}"/><span class="ek-subtle">${r.enabled!==false?'ON':'off'}</span></label>
                  <button class="ek-kv-remove" data-a="rh-remove" data-idx="${idx}" data-testid="requestheader-remove-${idx}" title="remove" aria-label="remove">×</button>
                </div>
                <div class="ek-row-inline" style="gap:6px">
                  <input class="ek-input" value="${escapeHtml(r.value || '')}" data-a="rh-value" data-idx="${idx}" placeholder="${r.mode === 'remove' ? '(not needed for remove)' : 'Header value'}" ${r.mode === 'remove' ? 'disabled' : ''} style="flex:2" data-testid="requestheader-value-${idx}"/>
                  <input class="ek-input" value="${escapeHtml(r.urlPattern || '')}" data-a="rh-url" data-idx="${idx}" placeholder="URL contains… (blank = all)" style="flex:1" data-testid="requestheader-url-${idx}"/>
                </div>
              </div>
            `;
}

function renderBlocklistRule(b, idx) {
  return `
              <div class="ek-kv-row">
                <input class="ek-input" value="${escapeHtml(b.pattern)}" data-a="bl-pattern" data-idx="${idx}" placeholder="e.g. ||tracking.example.com^"/>
                <label class="ek-row-inline" style="gap:6px"><input type="checkbox" ${b.enabled?'checked':''} data-a="bl-toggle" data-idx="${idx}"/> <span class="ek-subtle">${b.enabled ? 'ON' : 'off'}</span></label>
                <button class="ek-kv-remove" data-a="bl-remove" data-idx="${idx}" title="remove" aria-label="remove">×</button>
              </div>
            `;
}

function renderRewriteRule(r, idx) {
  return `
              <div class="ek-kv-row" data-testid="rewrite-row">
                <input class="ek-input" value="${escapeHtml(r.from || '')}" data-a="rw-from" data-idx="${idx}" placeholder="from (substring or /regex/flags)" data-testid="rewrite-from-${idx}"/>
                <input class="ek-input" value="${escapeHtml(r.to || '')}" data-a="rw-to" data-idx="${idx}" placeholder="to (replacement)" data-testid="rewrite-to-${idx}"/>
                <div style="display:flex;gap:6px;align-items:center">
                  <label class="ek-row-inline" style="gap:4px"><input type="checkbox" ${r.enabled?'checked':''} data-a="rw-toggle" data-idx="${idx}" data-testid="rewrite-toggle-${idx}"/><span class="ek-subtle">${r.enabled?'ON':'off'}</span></label>
                  <button class="ek-kv-remove" data-a="rw-remove" data-idx="${idx}" data-testid="rewrite-remove-${idx}" title="remove" aria-label="remove">×</button>
                </div>
              </div>
            `;
}

function renderTransformRule(r, idx) {
  return `
              <div style="border:1px solid var(--border);border-radius:6px;padding:8px;margin-bottom:6px" data-testid="transform-row">
                <div class="ek-row-inline" style="gap:6px;margin-bottom:6px">
                  <input class="ek-input" value="${escapeHtml(r.urlPattern || '')}" data-a="tr-url" data-idx="${idx}" placeholder="url contains… (blank = all)" style="flex:1" data-testid="transform-url-${idx}"/>
                  <select class="ek-select" data-a="tr-action" data-idx="${idx}" style="max-width:160px" data-testid="transform-action-${idx}">
                    <option value="add-header" ${r.action==='add-header'?'selected':''}>add header</option>
                    <option value="remove-header" ${r.action==='remove-header'?'selected':''}>remove header</option>
                    <option value="set-body" ${r.action==='set-body'?'selected':''}>set body</option>
                    <option value="regex-replace-body" ${r.action==='regex-replace-body'?'selected':''}>regex replace body</option>
                  </select>
                  <label class="ek-row-inline" style="gap:4px"><input type="checkbox" ${r.enabled?'checked':''} data-a="tr-toggle" data-idx="${idx}" data-testid="transform-toggle-${idx}"/><span class="ek-subtle">${r.enabled?'ON':'off'}</span></label>
                  <button class="ek-kv-remove" data-a="tr-remove" data-idx="${idx}" data-testid="transform-remove-${idx}" title="remove" aria-label="remove">×</button>
                </div>
                <div class="ek-row-inline" style="gap:6px">
                  <input class="ek-input" value="${escapeHtml(r.key || '')}" data-a="tr-key" data-idx="${idx}" placeholder="${r.action === 'set-body' ? '(unused)' : (r.action === 'regex-replace-body' ? 'regex pattern' : 'header name')}" style="flex:1" data-testid="transform-key-${idx}"/>
                  <input class="ek-input" value="${escapeHtml(r.value || '')}" data-a="tr-value" data-idx="${idx}" placeholder="${r.action === 'remove-header' ? '(unused)' : (r.action === 'set-body' ? 'new body (string/JSON)' : (r.action === 'regex-replace-body' ? 'replacement' : 'header value'))}" style="flex:2" data-testid="transform-value-${idx}"/>
                </div>
              </div>
            `;
}

/**
 * Open a settings modal that lets the user view and edit EchoKit configuration.
 *
 * The dialog exposes scope, theme, CORS override, auto-open behavior, advanced features
 * (global request headers, blocklist, rewrite rules, response transforms), license key
 * management, and other settings. When running in the DevTools panel a DevTools-specific
 * informational callout is shown indicating changes apply across all tabs.
 *
 * User changes are persisted by sending background messages and the UI is refreshed after updates.
 * The modal can be closed with the Done button or by clicking the overlay.
 */

function renderSettingsGeneral(s, isDevTools) {
  return `
      ${isDevTools ? `
        <div style="background: rgba(59,130,246,0.1); border: 1px solid rgba(59,130,246,0.3); border-radius: 8px; padding: 12px; margin-bottom: 16px; display: flex; align-items: center; gap: 12px;">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" style="color: #3b82f6; flex-shrink: 0;">
            <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/>
          </svg>
          <div style="flex: 1;">
            <div style="font-weight: 600; color: #3b82f6; margin-bottom: 4px;">💡 DevTools Tip</div>
            <div style="font-size: 12px; color: var(--text-secondary);">
              You're viewing settings from the DevTools panel. Changes here apply to <strong>all tabs</strong> in this browser.
              Close this dialog to return to the EchoKit panel.
            </div>
          </div>
        </div>
      ` : ''}

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
        <div style="flex: 1">
          <div class="ek-settings-title">CORS Override</div>
          <div class="ek-settings-hint">
            Inject <span class="ek-tag">Access-Control-Allow-*</span> headers into responses.
            <br>
            <strong>Scope:</strong> ${s.scope === 'global' ? 'Browser-wide (all tabs)' : s.scope === 'domain' ? 'Current domain only' : 'Current tab only'}
            <br>
            <button class="ek-btn ek-btn-ghost" data-a="cors-diagnostics" style="margin-top: 4px; padding: 2px 8px; font-size: 11px;">
              🔍 Run Diagnostics
            </button>
          </div>
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

      <div style="margin: 24px 0 12px; padding-bottom: 8px; border-bottom: 2px solid var(--border); font-weight: 600; color: var(--text-primary);">
        🔧 Advanced Features
      </div>
  `;
}

function renderSettingsRequestHeaders(s) {
  return `
      <div class="ek-settings-row" style="background: rgba(251,191,36,0.06); border: 1px solid rgba(251,191,36,0.3); border-radius: 8px; padding: 16px;">
        <div style="flex:1">
          <div class="ek-settings-title" style="display: flex; align-items: center; gap: 8px;">
            <span>🔑 Global Request Headers</span>
            <span class="ek-tag amber" style="font-size: 10px;">FEATURED</span>
          </div>
          <div class="ek-settings-hint">Inject, override, or remove headers on <strong>all outgoing requests</strong>. Perfect for auth tokens, tenant IDs, API keys, feature flags, etc.</div>
          <div id="ek-requestheaders" style="margin-top:12px" data-testid="requestheaders">
            ${(s.requestHeaders || []).map(renderRequestHeaderRule).join('')}
          </div>
          <button class="ek-btn ek-btn-primary" data-a="rh-add" style="margin-top:6px" data-testid="requestheader-add">＋ Add request header</button>
        </div>
      </div>
  `;
}

function renderSettingsBlocklist(s) {
  return `
      <div class="ek-settings-row">
        <div style="flex:1">
          <div class="ek-settings-title">URL Blocklist</div>
          <div class="ek-settings-hint">Block any network request whose URL matches. Uses Chrome's <span class="ek-tag">urlFilter</span> syntax (substring or <span class="ek-tag">||domain.com</span> / <span class="ek-tag">^</span> / <span class="ek-tag">*</span>).</div>
          <div id="ek-blocklist" style="margin-top:8px" data-testid="blocklist">
            ${(s.blocklist || []).map(renderBlocklistRule).join('')}
          </div>
          <button class="ek-btn ek-btn-ghost" data-a="bl-add" style="margin-top:6px" data-testid="blocklist-add">＋ Add blocklist pattern</button>
        </div>
      </div>
  `;
}

function renderSettingsRewriteRules(s) {
  return `
      <div class="ek-settings-row">
        <div style="flex:1">
          <div class="ek-settings-title">URL Rewrite Rules</div>
          <div class="ek-settings-hint">Rewrite outgoing URLs before they hit the network. <span class="ek-tag">From</span> can be a substring or a JS regex like <span class="ek-tag">/api\\/v1/g</span>.</div>
          <div id="ek-rewritelist" style="margin-top:8px" data-testid="rewritelist">
            ${(s.rewriteRules || []).map(renderRewriteRule).join('')}
          </div>
          <button class="ek-btn ek-btn-ghost" data-a="rw-add" style="margin-top:6px" data-testid="rewrite-add">＋ Add rewrite rule</button>
        </div>
      </div>
  `;
}

function renderSettingsTransformRules(s) {
  return `
      <div class="ek-settings-row">
        <div style="flex:1">
          <div class="ek-settings-title">Response Transform Rules</div>
          <div class="ek-settings-hint">Mutate mocked responses on the fly: add/remove headers, replace body, or run a regex over the body.</div>
          <div id="ek-transformlist" style="margin-top:8px" data-testid="transformlist">
            ${(s.transformRules || []).map(renderTransformRule).join('')}
          </div>
          <button class="ek-btn ek-btn-ghost" data-a="tr-add" style="margin-top:6px" data-testid="transform-add">＋ Add transform rule</button>
        </div>
      </div>
  `;
}

function renderSettingsLicense() {
  return `
      <div class="ek-settings-row">
        <div>
          <div class="ek-settings-title">Wipe ALL recordings</div>
          <div class="ek-settings-hint">Delete every recorded interaction across every scope, tab, and domain.</div>
        </div>
        <button class="ek-btn ek-btn-danger" data-a="clear-all" data-testid="clear-all-btn">Wipe</button>
      </div>

      <div class="ek-settings-row" style="background: rgba(52,211,153,0.06); border: 1px solid rgba(52,211,153,0.3); border-radius: 8px; padding: 16px;">
        <div style="flex:1">
          <div class="ek-settings-title" style="display: flex; align-items: center; gap: 8px; color: var(--green); font-weight: 600;">
            <span>🎉 EchoKit Pro (Free Access)</span>
          </div>
          <div class="ek-settings-hint" style="margin-top: 4px; color: var(--text-secondary); line-height: 1.5;">
            All Pro features are fully enabled and free for everyone for now. Enjoy unlimited recordings, advanced matching, export tools, and more!
          </div>
        </div>
      </div>
  `;
}

/**
 * Attach event listeners to the settings overlay controls to persist user changes and update the UI.
 *
 * Binds handlers for scope, theme, CORS override, CORS diagnostics, auto-open-on-refresh, and the
 * irreversible "clear all recordings" action; persisted changes trigger a state refresh and re-render,
 * diagnostics shows an alert with results, and clear-all prompts for confirmation before deleting data.
 *
 * @param {HTMLElement} overlay - The settings modal root element containing the controls.
 */
function bindSettingsGeneralEvents(overlay) {
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
  overlay.querySelector('[data-a="cors-diagnostics"]').addEventListener('click', async () => {
    try {
      const diag = await BG({ type: 'echokit:cors:diagnostics' });
      if (!diag || typeof diag.ok === 'undefined') {
        throw new Error('No diagnostics response from background');
      }
      const msg = diag.ok
        ? `✅ CORS Diagnostics:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CORS Enabled: ${diag.corsEnabled}
Scope: ${diag.scope}
Rule Installed: ${diag.ruleInstalled}

Active Tabs: ${diag.tabs ? diag.tabs.length : 0}
Dynamic Rules: ${diag.dynamicRulesCount}
Session Rules: ${diag.sessionRulesCount}

${diag.rule ? `Current CORS Rule (ID ${diag.rule.id}):
  Priority: ${diag.rule.priority}
  Condition: ${JSON.stringify(diag.rule.condition, null, 2)}
  Action: ${JSON.stringify(diag.rule.action, null, 2)}` : 'No CORS rule active'}

Open browser console for full details.`
        : `❌ CORS Diagnostics Failed:
${diag.error}`;

      // eslint-disable-next-line no-console
      if (diag.ok) console.log('[EchoKit CORS Diagnostics]', diag);
      alert(msg);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[EchoKit CORS Diagnostics Error]', error);
      alert(`❌ CORS Diagnostics Failed:\n${error?.message || 'Unknown error'}`);
    }
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
}

function bindSettingsBlocklistEvents(overlay, reopen) {
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

function bindSettingsRewriteRulesEvents(overlay, reopen) {
  overlay.querySelectorAll('[data-a="rw-from"]').forEach(el => el.addEventListener('change', async (e) => {
    const idx = Number(el.getAttribute('data-idx'));
    const rules = [...(state.settings.rewriteRules || [])];
    rules[idx] = { ...(rules[idx] || {}), from: e.target.value };
    await BG({ type: 'echokit:settings:update', patch: { rewriteRules: rules } });
    await refresh();
  }));
  overlay.querySelectorAll('[data-a="rw-to"]').forEach(el => el.addEventListener('change', async (e) => {
    const idx = Number(el.getAttribute('data-idx'));
    const rules = [...(state.settings.rewriteRules || [])];
    rules[idx] = { ...(rules[idx] || {}), to: e.target.value };
    await BG({ type: 'echokit:settings:update', patch: { rewriteRules: rules } });
    await refresh();
  }));
  overlay.querySelectorAll('[data-a="rw-toggle"]').forEach(el => el.addEventListener('change', async (e) => {
    const idx = Number(el.getAttribute('data-idx'));
    const rules = [...(state.settings.rewriteRules || [])];
    rules[idx] = { ...(rules[idx] || {}), enabled: e.target.checked };
    await BG({ type: 'echokit:settings:update', patch: { rewriteRules: rules } });
    await refresh(); reopen();
  }));
  overlay.querySelectorAll('[data-a="rw-remove"]').forEach(el => el.addEventListener('click', async () => {
    const idx = Number(el.getAttribute('data-idx'));
    const rules = [...(state.settings.rewriteRules || [])];
    rules.splice(idx, 1);
    await BG({ type: 'echokit:settings:update', patch: { rewriteRules: rules } });
    await refresh(); reopen();
  }));
  overlay.querySelector('[data-a="rw-add"]')?.addEventListener('click', async () => {
    const rules = [...(state.settings.rewriteRules || []), { from: '', to: '', enabled: true }];
    await BG({ type: 'echokit:settings:update', patch: { rewriteRules: rules } });
    await refresh(); reopen();
  });
}

function bindSettingsTransformRulesEvents(overlay, reopen) {
  const trUpdate = async (idx, patch) => {
    const rules = [...(state.settings.transformRules || [])];
    rules[idx] = { phase: 'response', ...(rules[idx] || {}), ...patch };
    await BG({ type: 'echokit:settings:update', patch: { transformRules: rules } });
    await refresh();
  };
  overlay.querySelectorAll('[data-a="tr-url"]').forEach(el => el.addEventListener('change', (e) => trUpdate(Number(el.getAttribute('data-idx')), { urlPattern: e.target.value })));
  overlay.querySelectorAll('[data-a="tr-key"]').forEach(el => el.addEventListener('change', (e) => trUpdate(Number(el.getAttribute('data-idx')), { key: e.target.value })));
  overlay.querySelectorAll('[data-a="tr-value"]').forEach(el => el.addEventListener('change', (e) => trUpdate(Number(el.getAttribute('data-idx')), { value: e.target.value })));
  overlay.querySelectorAll('[data-a="tr-action"]').forEach(el => el.addEventListener('change', async (e) => {
    await trUpdate(Number(el.getAttribute('data-idx')), { action: e.target.value });
    reopen();
  }));
  overlay.querySelectorAll('[data-a="tr-toggle"]').forEach(el => el.addEventListener('change', async (e) => {
    await trUpdate(Number(el.getAttribute('data-idx')), { enabled: e.target.checked });
    reopen();
  }));
  overlay.querySelectorAll('[data-a="tr-remove"]').forEach(el => el.addEventListener('click', async () => {
    const idx = Number(el.getAttribute('data-idx'));
    const rules = [...(state.settings.transformRules || [])];
    rules.splice(idx, 1);
    await BG({ type: 'echokit:settings:update', patch: { transformRules: rules } });
    await refresh(); reopen();
  }));
  overlay.querySelector('[data-a="tr-add"]')?.addEventListener('click', async () => {
    const rules = [...(state.settings.transformRules || []), { phase: 'response', urlPattern: '', action: 'add-header', key: '', value: '', enabled: true }];
    await BG({ type: 'echokit:settings:update', patch: { transformRules: rules } });
    await refresh(); reopen();
  });
}

function bindSettingsRequestHeadersEvents(overlay, reopen) {
  const rhUpdate = async (idx, patch) => {
    const headers = [...(state.settings.requestHeaders || [])];
    headers[idx] = { mode: 'override', enabled: true, ...(headers[idx] || {}), ...patch };
    await BG({ type: 'echokit:settings:update', patch: { requestHeaders: headers } });
    await refresh();
  };
  overlay.querySelectorAll('[data-a="rh-key"]').forEach(el => el.addEventListener('change', (e) => rhUpdate(Number(el.getAttribute('data-idx')), { key: e.target.value })));
  overlay.querySelectorAll('[data-a="rh-value"]').forEach(el => el.addEventListener('change', (e) => rhUpdate(Number(el.getAttribute('data-idx')), { value: e.target.value })));
  overlay.querySelectorAll('[data-a="rh-mode"]').forEach(el => el.addEventListener('change', async (e) => {
    await rhUpdate(Number(el.getAttribute('data-idx')), { mode: e.target.value });
    reopen();
  }));
  overlay.querySelectorAll('[data-a="rh-url"]').forEach(el => el.addEventListener('change', (e) => rhUpdate(Number(el.getAttribute('data-idx')), { urlPattern: e.target.value })));
  overlay.querySelectorAll('[data-a="rh-toggle"]').forEach(el => el.addEventListener('change', async (e) => {
    await rhUpdate(Number(el.getAttribute('data-idx')), { enabled: e.target.checked });
    reopen();
  }));
  overlay.querySelectorAll('[data-a="rh-remove"]').forEach(el => el.addEventListener('click', async () => {
    const idx = Number(el.getAttribute('data-idx'));
    const headers = [...(state.settings.requestHeaders || [])];
    headers.splice(idx, 1);
    await BG({ type: 'echokit:settings:update', patch: { requestHeaders: headers } });
    await refresh(); reopen();
  }));
  overlay.querySelector('[data-a="rh-add"]')?.addEventListener('click', async () => {
    const headers = [...(state.settings.requestHeaders || []), { key: '', value: '', mode: 'override', urlPattern: '', enabled: true }];
    await BG({ type: 'echokit:settings:update', patch: { requestHeaders: headers } });
    await refresh(); reopen();
  });
}

function bindSettingsLicenseEvents(overlay) {
  BG({ type: 'echokit:license:check' }).then(res => {
    const input = overlay.querySelector('#ek-license-input');
    if (input && res?.key) input.value = res.key;
  });
  chrome.storage.sync.get('echokit_license_endpoint').then(res => {
    const input = overlay.querySelector('#ek-license-endpoint-input');
    if (input && res?.echokit_license_endpoint) input.value = res.echokit_license_endpoint;
  });
  overlay.querySelector('[data-a="license-activate"]')?.addEventListener('click', async () => {
    const keyInput = overlay.querySelector('#ek-license-input');
    const key = keyInput?.value?.trim() || '';
    if (!key) { toast('Enter a license key first'); return; }
    const res = await BG({ type: 'echokit:license:set', key });
    if (res?.ok && res.pro) { toast('Pro license activated!'); state.isPro = true; await refresh(); render(); overlay.remove(); showSettingsDialog(); }
    else toast('Invalid key: ' + (res?.error || 'format not recognized'), 4000);
  });
  overlay.querySelector('[data-a="license-remove"]')?.addEventListener('click', async () => {
    if (!confirm('Remove your Pro license from this device?')) return;
    await BG({ type: 'echokit:license:set', key: '' });
    state.isPro = false; await refresh(); render(); overlay.remove(); showSettingsDialog();
  });
  overlay.querySelector('[data-a="get-pro"]')?.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: 'https://echokit.dev/pricing' }).catch(() => window.open('https://echokit.dev/pricing', '_blank'));
  });
  overlay.querySelector('#ek-license-endpoint-input')?.addEventListener('change', async (e) => {
    const endpoint = e.target.value.trim();
    await BG({ type: 'echokit:license:setEndpoint', endpoint });
    toast('License endpoint updated');
  });
  overlay.querySelector('[data-a="test-endpoint"]')?.addEventListener('click', async () => {
    const input = overlay.querySelector('#ek-license-endpoint-input');
    const endpoint = input?.value?.trim();
    if (!endpoint) { toast('Enter an endpoint URL first', 3000); return; }
    try {
      const res = await fetch(endpoint + '/__health');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.ok) toast(`✓ Endpoint healthy: ${data.name || 'OK'}`, 3000);
      else toast('✗ Unexpected response: ' + JSON.stringify(data), 4000);
    } catch (e) {
      toast('✗ Connection failed: ' + e.message, 4000);
    }
  });
}

/**
 * Shows the settings dialog.
 * Features: theme selection, CORS override, scope selector, blocklist, rewrite rules, etc.
 * The modal can be closed with the Done button or by clicking the overlay.
 */
function showSettingsDialog() {
  const s = state.settings;
  const isDevTools = state.mode === 'devtools';
  const overlay = document.createElement('div');
  overlay.className = 'ek-modal-overlay';
  overlay.innerHTML = sanitizeHTML(`
    <div class="ek-modal" data-testid="settings-modal">
      <div class="ek-modal-title">Settings</div>
      ${renderSettingsGeneral(s, isDevTools)}
      ${renderSettingsRequestHeaders(s)}
      ${renderSettingsBlocklist(s)}
      ${renderSettingsRewriteRules(s)}
      ${renderSettingsTransformRules(s)}
      ${renderSettingsLicense()}
      <div class="ek-modal-actions">
        <button class="ek-btn ek-btn-primary" data-a="close">Done</button>
      </div>
    </div>
  `);
  document.body.appendChild(overlay);

  const reopen = () => { overlay.remove(); showSettingsDialog(); };

  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  overlay.querySelector('[data-a="close"]').addEventListener('click', () => overlay.remove());

  bindSettingsGeneralEvents(overlay);
  bindSettingsBlocklistEvents(overlay, reopen);
  bindSettingsRewriteRulesEvents(overlay, reopen);
  bindSettingsTransformRulesEvents(overlay, reopen);
  bindSettingsRequestHeadersEvents(overlay, reopen);
  bindSettingsLicenseEvents(overlay);
}


function showShortcutsDialog() {
  const overlay = document.createElement('div');
  overlay.className = 'ek-modal-overlay';

  const modal = document.createElement('div');
  modal.className = 'ek-modal';
  modal.setAttribute('data-testid', 'shortcuts-modal');

  const title = document.createElement('div');
  title.className = 'ek-modal-title';
  title.textContent = 'Keyboard shortcuts';
  modal.appendChild(title);

  const shortcuts = [
    { label: 'Toggle recording', kbd: 'Alt+Shift+R' },
    { label: 'Toggle mock mode', kbd: 'Alt+Shift+M' },
    { label: 'Open popup', kbd: 'Alt+Shift+E' }
  ];

  for (const sc of shortcuts) {
    const row = document.createElement('div');
    row.className = 'ek-settings-row';
    const scTitle = document.createElement('div');
    scTitle.className = 'ek-settings-title';
    scTitle.textContent = sc.label;
    const scKbd = document.createElement('span');
    scKbd.className = 'ek-kbd';
    scKbd.textContent = sc.kbd;
    row.appendChild(scTitle);
    row.appendChild(scKbd);
    modal.appendChild(row);
  }

  const subtle = document.createElement('div');
  subtle.className = 'ek-subtle';
  subtle.appendChild(document.createTextNode('Customize these at '));
  const tag = document.createElement('span');
  tag.className = 'ek-tag';
  tag.textContent = 'chrome://extensions/shortcuts';
  subtle.appendChild(tag);
  subtle.appendChild(document.createTextNode('.'));
  modal.appendChild(subtle);

  const actions = document.createElement('div');
  actions.className = 'ek-modal-actions';
  const closeBtn = document.createElement('button');
  closeBtn.className = 'ek-btn ek-btn-primary';
  closeBtn.setAttribute('data-a', 'close');
  closeBtn.textContent = 'Done';
  actions.appendChild(closeBtn);
  modal.appendChild(actions);

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  closeBtn.addEventListener('click', () => overlay.remove());
}

// ---------- filters & helpers ----------
// Helper: debounce input handler
function debounceInput(el, callback, delay) {
  let timer;
  el.addEventListener('input', (e) => {
    clearTimeout(timer);
    timer = setTimeout(() => callback(e.target.value), delay);
  });
}

function filteredInteractions() {
  const features = getFeatures();
  let results = state.interactions;

  const q = state.search.trim().toLowerCase();

  // Pre-compute query preparations to avoid doing it per-item
  const reqBodyQuery = features.bodySearch && state.filters.requestBodyContains ? state.filters.requestBodyContains.toLowerCase() : null;
  const resBodyQuery = features.bodySearch && state.filters.responseBodyContains ? state.filters.responseBodyContains.toLowerCase() : null;
  const hasReqHeaderFilter = features.headerSearch && (state.filters.requestHeader.name || state.filters.requestHeader.value);
  const hasResHeaderFilter = features.headerSearch && (state.filters.responseHeader.name || state.filters.responseHeader.value);

  // Single pass filtering
  results = results.filter(i => {
    // PHASE 1: Method filter
    if (features.multiSelect && state.filters.methods.length > 0) {
      if (!state.filters.methods.includes(i.method)) return false;
    } else if (state.methodFilter) {
      if (i.method !== state.methodFilter) return false;
    }

    // PHASE 2: Status filter
    if (features.multiSelect && state.filters.statusCodes.length > 0) {
      if (!matchesStatusFilter(i.responseStatus, state.filters.statusCodes)) return false;
    } else if (state.statusFilter != null) {
      const bucket = String(Math.floor((i.responseStatus || 0) / 100));
      if (state.statusFilter === '0') {
        if ((i.responseStatus || 0) !== 0) return false;
      } else {
        if (bucket !== state.statusFilter) return false;
      }
    }

    // PHASE 3: URL search
    if (q && !i.url.toLowerCase().includes(q)) return false;

    // PHASE 4: Body search
    if (reqBodyQuery && !searchBodyContent(i.requestBody, reqBodyQuery)) return false;
    if (resBodyQuery && !searchBodyContent(i.responseBody, resBodyQuery)) return false;

    // PHASE 5: Header search
    if (hasReqHeaderFilter && !searchHeaders(i.requestHeaders, state.filters.requestHeader.name, state.filters.requestHeader.value)) return false;
    if (hasResHeaderFilter && !searchHeaders(i.responseHeaders, state.filters.responseHeader.name, state.filters.responseHeader.value)) return false;

    // PHASE 6: Boolean filters
    if (state.filters.mockEnabled !== null && i.mockEnabled !== state.filters.mockEnabled) return false;
    if (state.filters.blocked !== null && i.blocked !== state.filters.blocked) return false;
    if (state.filters.hasNotes !== null) {
      const pass = state.filters.hasNotes ? (i.notes && i.notes.trim()) : !i.notes;
      if (!pass) return false;
    }

    // PHASE 6.5: Source filters
    if (features.sourceFilters) {
      const source = classifySource(i, state.tabId);
      if (source === 'this-tab' && !state.filters.sources.thisTab) return false;
      if (source === 'other-tab' && !state.filters.sources.otherTabs) return false;
      if (source === 'closed-tab' && !state.filters.sources.closedTabs) return false;
      if (source === 'imported' && !state.filters.sources.imported) return false;
    }

    return true;
  });

  // PHASE 7: Sort (DevTools only)
  if (features.sortableColumns) {
    results = sortInteractions(results, state.sortBy, state.sortOrder);
  } else {
    // Popup mode: simple timestamp DESC
    results.sort((a, b) => b.timestamp - a.timestamp);
  }

  return results;
}

// Helper: Match status filter
function matchesStatusFilter(status, filters) {
  if (!filters || filters.length === 0) return true;
  for (const f of filters) {
    if (f === '0' && status === 0) return true;
    if (f.endsWith('xx')) {
      const bucket = Math.floor(status / 100);
      if (String(bucket) === f.charAt(0)) return true;
    } else if (String(status) === f) {
      return true;
    }
  }
  return false;
}

// Cache for stringified JSON bodies to avoid O(N) re-stringification during filtering
const stringifiedBodyCache = new WeakMap();

// Helper: Search body content
function searchBodyContent(body, query) {
  if (!query) return true;
  if (!body) return false;

  const q = query.toLowerCase();

  // Handle JSON bodies
  if (typeof body === 'object') {
    let str = stringifiedBodyCache.get(body);
    if (str === undefined) {
      str = JSON.stringify(body).toLowerCase();
      stringifiedBodyCache.set(body, str);
    }
    return str.includes(q);
  }

  // Handle string bodies
  if (typeof body === 'string') {
    return body.toLowerCase().includes(q);
  }

  return false;
}

// Helper: Search headers
function searchHeaders(headers, nameQuery, valueQuery) {
  if (!nameQuery && !valueQuery) return true;
  if (!headers || typeof headers !== 'object') return false;

  const nq = nameQuery.toLowerCase();
  const vq = valueQuery.toLowerCase();

  for (const name in headers) {
    if (!Object.prototype.hasOwnProperty.call(headers, name)) continue;
    const value = headers[name];
    const nameMatch = !nq || name.toLowerCase().includes(nq);
    const valueMatch = !vq || String(value).toLowerCase().includes(vq);
    if (nameMatch && valueMatch) return true;
  }
  return false;
}

// Helper: Sort interactions
function sortInteractions(interactions, sortBy, sortOrder) {
  const sorted = [...interactions];

  const comparators = {
    timestamp: (a, b) => a.timestamp - b.timestamp,
    url: (a, b) => a.url.localeCompare(b.url),
    method: (a, b) => a.method.localeCompare(b.method),
    status: (a, b) => (a.responseStatus || 0) - (b.responseStatus || 0),
    duration: (a, b) => (a.durationMs || 0) - (b.durationMs || 0)
  };

  sorted.sort(comparators[sortBy] || comparators.timestamp);

  if (sortOrder === 'desc') {
    sorted.reverse();
  }

  return sorted;
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
function domainOf(url) { try { const u = parseUrl(url, location.href); return u ? (u.host || '(local)') : '(local)'; } catch { return '(unknown)'; } }
function prettyUrl(url) {
  try { const u = parseUrl(url, location.href); if (u) return { path: u.pathname, query: u.search }; }
  catch {}
  return { path: url, query: '' };
}
// escapeHtml is defined at line 48 - removed duplicate declaration
