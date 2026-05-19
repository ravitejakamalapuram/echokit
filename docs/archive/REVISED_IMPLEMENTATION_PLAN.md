# Revised Implementation Plan - Dual Interface Strategy

## 🎯 Executive Summary

**Change from Original Plan**: Instead of adding all advanced features to the popup (causing clutter), we'll implement a **dual interface strategy**:

- **Popup**: Simple, fast interface for casual users (unchanged)
- **DevTools Panel**: Full-featured interface for power users (add all advanced features here)

**Why**: Popup space is limited (480x600px), DevTools panel has unlimited space. You already have both implemented!

---

## 📋 Original Plan vs Revised Plan

### Original Plan (Now Rejected ❌)
```
Week 1-4: Add advanced features to popup
- Multi-select filters → popup
- Body search → popup  
- Sortable columns → popup
- Result: 1,035px height needed, only 600px available
- Problem: Cluttered, terrible UX
```

### Revised Plan (Approved ✅)
```
Week 1: Infrastructure (feature flags, popup simplification)
Week 2-3: Advanced features (DevTools panel only)
Week 4: Polish, testing, documentation
Result: Clean popup + powerful DevTools panel
```

---

## 🗓 Phase-by-Phase Implementation

### **Phase 1: Dual Interface Infrastructure** (Week 1 - 3 days)

#### Goal
Set up feature flags and simplify popup to prepare for dual interface

#### Tasks

**1.1 Add Feature Flags to `shared/app.js`** (1 hour)
```javascript
// Add at top of file after imports
const FEATURES = {
  popup: {
    advancedFilters: false,
    bodySearch: false,
    headerSearch: false,
    sortableColumns: false,
    waterfallView: false,
    resizablePanes: false,
    filterChips: false,
    multiSelect: false
  },
  devtools: {
    advancedFilters: true,
    bodySearch: true,
    headerSearch: true,
    sortableColumns: true,
    waterfallView: true,
    resizablePanes: true,
    filterChips: true,
    multiSelect: true
  }
};

// Add helper function
function getFeatures() {
  return FEATURES[state.mode] || FEATURES.popup;
}
```

**1.2 Simplify Popup Toolbar** (2 hours)

Update `renderToolbar()` function:
```javascript
function renderToolbar() {
  const features = getFeatures();
  
  if (!features.advancedFilters) {
    // POPUP: Simple toolbar (keep current implementation)
    return `
      <div class="ek-toolbar">
        <input class="ek-search" type="text" placeholder="search url…" 
               value="${escapeHtml(state.search)}" 
               data-action="search" 
               data-testid="search-input"/>
        <div class="ek-method-chips">
          ${['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map(m => 
            `<button class="ek-chip ${state.methodFilter === m ? 'active' : ''}" 
                     data-action="filter-method" 
                     data-method="${m}">${m}</button>`
          ).join('')}
        </div>
        <select class="ek-select" data-action="filter-status">
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
    // DEVTOOLS: Advanced toolbar (will implement in Phase 2)
    return renderAdvancedToolbar();
  }
}
```

**1.3 Update Popup Footer with DevTools Link** (1 hour)

Update `renderFooter()` function:
```javascript
function renderFooter(count) {
  const isPopup = state.mode === 'popup';
  
  return `
    <div class="ek-footer" data-testid="footer">
      <span class="ek-count">${count} interaction${count !== 1 ? 's' : ''}</span>
      ${isPopup ? `
        <a href="#" 
           class="ek-devtools-link" 
           data-action="open-devtools-guide" 
           data-testid="devtools-link"
           title="Access advanced features in DevTools">
          🔧 Advanced tools in DevTools →
        </a>
      ` : ''}
      <button class="ek-icon-btn" data-action="menu" data-testid="menu-button">⋮</button>
    </div>
  `;
}
```

**1.4 Add DevTools Guide Modal** (2 hours)

Create modal component:
```javascript
function showDevToolsGuide() {
  const modal = document.createElement('div');
  modal.className = 'ek-modal';
  modal.innerHTML = `
    <div class="ek-modal-overlay" data-action="close-modal"></div>
    <div class="ek-modal-content">
      <div class="ek-modal-header">
        <h3>🔧 Advanced Tools in DevTools</h3>
        <button class="ek-close-btn" data-action="close-modal">×</button>
      </div>
      <div class="ek-modal-body">
        <p>For advanced filtering, body search, and performance analysis:</p>
        <ol>
          <li>Press <kbd>F12</kbd> or <kbd>Cmd+Opt+I</kbd> to open Chrome DevTools</li>
          <li>Click the <strong>EchoKit</strong> tab (next to Console, Network, etc.)</li>
          <li>Access all professional features with unlimited space!</li>
        </ol>
        <div class="ek-feature-preview">
          <strong>Available in DevTools:</strong>
          <ul>
            <li>✅ Multi-select filters (method + status)</li>
            <li>✅ Search request/response bodies</li>
            <li>✅ Search headers</li>
            <li>✅ Sort by URL, duration, status</li>
            <li>✅ Waterfall view for performance</li>
            <li>✅ Filter chips & result count</li>
          </ul>
        </div>
        <p class="ek-tip">
          <strong>💡 Tip:</strong> The DevTools panel stays open while you browse and never gets in the way!
        </p>
      </div>
      <div class="ek-modal-footer">
        <button class="ek-btn-primary" data-action="close-modal">Got it!</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Bind close handlers
  modal.querySelectorAll('[data-action="close-modal"]').forEach(el => {
    el.addEventListener('click', () => modal.remove());
  });
}

// Add to event handler
else if (action === 'open-devtools-guide') {
  e.preventDefault();
  showDevToolsGuide();
}
```

**1.5 Add Modal Styles to `shared/styles.css`** (1 hour)

```css
/* Modal Overlay */
.ek-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ek-modal-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
}

.ek-modal-content {
  position: relative;
  background: var(--bg-primary);
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  max-width: 500px;
  width: 90%;
  max-height: 80vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.ek-modal-header {
  padding: 20px 24px;
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.ek-modal-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
}

.ek-close-btn {
  background: none;
  border: none;
  font-size: 24px;
  color: var(--text-dim);
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
}

.ek-close-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.ek-modal-body {
  padding: 24px;
  overflow-y: auto;
  flex: 1;
}

.ek-modal-body p {
  margin: 0 0 16px;
  line-height: 1.6;
  color: var(--text-secondary);
}

.ek-modal-body ol {
  margin: 0 0 20px;
  padding-left: 24px;
}

.ek-modal-body li {
  margin: 8px 0;
  line-height: 1.6;
  color: var(--text-primary);
}

.ek-modal-body kbd {
  display: inline-block;
  padding: 2px 8px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 4px;
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 600;
}

.ek-feature-preview {
  background: var(--bg-secondary);
  border-radius: 8px;
  padding: 16px;
  margin: 16px 0;
}

.ek-feature-preview strong {
  display: block;
  margin-bottom: 12px;
  color: var(--accent);
}

.ek-feature-preview ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.ek-feature-preview li {
  padding: 4px 0;
  color: var(--text-secondary);
  font-size: 14px;
}

.ek-tip {
  background: rgba(96, 165, 250, 0.1);
  border-left: 3px solid var(--accent);
  padding: 12px 16px;
  border-radius: 4px;
  font-size: 14px;
}

.ek-modal-footer {
  padding: 16px 24px;
  border-top: 1px solid var(--border);
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.ek-devtools-link {
  color: var(--accent);
  text-decoration: none;
  font-size: 13px;
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.2s;
}

.ek-devtools-link:hover {
  background: rgba(96, 165, 250, 0.1);
  text-decoration: none;
}
```

**Deliverable**:
- ✅ Feature flags in place
- ✅ Popup stays simple (no changes to current UX)
- ✅ DevTools link added to popup footer
- ✅ Modal guides users to DevTools panel
- ✅ CSS for modal component

**Testing**:
- [ ] Popup loads normally
- [ ] Click DevTools link → modal appears
- [ ] Modal displays instructions clearly
- [ ] Close modal works (X button, overlay click)

---

### **Phase 2: DevTools Panel - Advanced Features** (Week 2-3 - 10 days)

#### Goal
Implement all advanced search, filter, and sort features in DevTools panel only

#### 2.1 Multi-Select Filters (3 days)

**State Schema Updates** (in `shared/app.js`):
```javascript
let state = {
  // ... existing properties

  // NEW: Enhanced filter state (DevTools only)
  filters: {
    methods: [],                    // ['GET', 'POST']
    statusCodes: [],                // ['2xx', '404', '5xx']
    requestBodyContains: '',
    responseBodyContains: '',
    requestHeader: { name: '', value: '' },
    responseHeader: { name: '', value: '' },
    timestampRange: { from: null, to: null },
    mockEnabled: null,
    blocked: null,
    hasNotes: null
  },

  // Keep old properties for backward compat (popup uses these)
  methodFilter: null,               // Single-select for popup
  statusFilter: null,               // Single-select for popup

  // Advanced UI state
  advancedFilterOpen: false,
  sortBy: 'timestamp',
  sortOrder: 'desc'
};
```

**Create `renderAdvancedToolbar()` Function**:
```javascript
function renderAdvancedToolbar() {
  const features = getFeatures();

  return `
    <div class="ek-toolbar ek-toolbar-advanced">
      <div class="ek-toolbar-row">
        <input class="ek-search"
               type="text"
               placeholder="search url, method, status…"
               value="${escapeHtml(state.search)}"
               data-action="search"
               data-testid="search-input"/>
        <button class="ek-btn ${state.advancedFilterOpen ? 'active' : ''}"
                data-action="toggle-advanced-filters"
                data-testid="toggle-advanced-filters">
          🔍 Advanced ${state.advancedFilterOpen ? '▲' : '▼'}
        </button>
        ${getActiveFilterCount() > 0 ? `
          <button class="ek-btn" data-action="clear-all-filters" data-testid="clear-filters">
            Clear All
          </button>
        ` : ''}
        ${features.waterfallView ? `
          <button class="ek-btn ${state.waterfall ? 'active' : ''}"
                  data-action="toggle-waterfall"
                  data-testid="toggle-waterfall">
            💧 Waterfall
          </button>
        ` : ''}
      </div>

      ${state.advancedFilterOpen ? renderAdvancedFilterPanel() : ''}
      ${features.filterChips ? renderFilterChips() : ''}
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
```

**Create `renderAdvancedFilterPanel()` Function**:
```javascript
function renderAdvancedFilterPanel() {
  return `
    <div class="ek-advanced-filters" data-testid="advanced-filters">
      <!-- Method Filter -->
      <div class="ek-filter-section">
        <label class="ek-filter-label">HTTP Method</label>
        <div class="ek-checkbox-group">
          ${['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map(method => `
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

      <!-- Status Filter -->
      <div class="ek-filter-section">
        <label class="ek-filter-label">Response Status</label>
        <div class="ek-checkbox-group">
          ${['2xx', '3xx', '4xx', '5xx', '0'].map(status => `
            <label class="ek-checkbox">
              <input type="checkbox"
                     data-action="filter-status-toggle"
                     data-status="${status}"
                     ${state.filters.statusCodes.includes(status) ? 'checked' : ''}/>
              <span>${status === '0' ? 'Failed' : status + ' (' + getStatusLabel(status) + ')'}</span>
            </label>
          `).join('')}
        </div>
      </div>

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

      <!-- Boolean Filters -->
      <div class="ek-filter-section">
        <label class="ek-filter-label">Other Filters</label>
        <div class="ek-checkbox-group">
          <label class="ek-checkbox">
            <input type="checkbox"
                   data-action="filter-mock-enabled"
                   ${state.filters.mockEnabled === true ? 'checked' : ''}/>
            <span>Mock enabled only</span>
          </label>
          <label class="ek-checkbox">
            <input type="checkbox"
                   data-action="filter-blocked"
                   ${state.filters.blocked === true ? 'checked' : ''}/>
            <span>Blocked requests only</span>
          </label>
          <label class="ek-checkbox">
            <input type="checkbox"
                   data-action="filter-has-notes"
                   ${state.filters.hasNotes === true ? 'checked' : ''}/>
            <span>Has notes</span>
          </label>
        </div>
      </div>
    </div>
  `;
}

function getStatusLabel(status) {
  const labels = {
    '2xx': 'Success',
    '3xx': 'Redirect',
    '4xx': 'Client Error',
    '5xx': 'Server Error',
    '0': 'Network/Timeout'
  };
  return labels[status] || '';
}
```

**Create `renderFilterChips()` Function**:
```javascript
function renderFilterChips() {
  const chips = [];

  // Method chips
  state.filters.methods.forEach(m => {
    chips.push(`
      <span class="ek-filter-chip"
            data-action="remove-filter"
            data-type="method"
            data-value="${m}"
            data-testid="chip-method-${m.toLowerCase()}">
        × method:${m}
      </span>
    `);
  });

  // Status chips
  state.filters.statusCodes.forEach(s => {
    chips.push(`
      <span class="ek-filter-chip"
            data-action="remove-filter"
            data-type="status"
            data-value="${s}">
        × status:${s}
      </span>
    `);
  });

  // Body search chips
  if (state.filters.requestBodyContains) {
    chips.push(`
      <span class="ek-filter-chip"
            data-action="remove-filter"
            data-type="request-body">
        × request:"${escapeHtml(state.filters.requestBodyContains.slice(0, 20))}"
      </span>
    `);
  }

  if (state.filters.responseBodyContains) {
    chips.push(`
      <span class="ek-filter-chip"
            data-action="remove-filter"
            data-type="response-body">
        × response:"${escapeHtml(state.filters.responseBodyContains.slice(0, 20))}"
      </span>
    `);
  }

  if (chips.length === 0) return '';

  const count = chips.length;
  return `
    <div class="ek-filter-chips-row" data-testid="filter-chips">
      <span class="ek-filter-count">Filters: ${count} active</span>
      <div class="ek-filter-chips">${chips.join('')}</div>
      <span class="ek-result-count">Showing ${filteredInteractions().length} of ${state.interactions.length}</span>
    </div>
  `;
}
```

**Event Handlers for Filters**:
```javascript
// Add to bindEvents() function

// Toggle advanced filter panel
else if (action === 'toggle-advanced-filters') {
  state.advancedFilterOpen = !state.advancedFilterOpen;
  render();
}

// Method filter toggle
else if (action === 'filter-method-toggle') {
  const method = el.getAttribute('data-method');
  if (el.checked) {
    if (!state.filters.methods.includes(method)) {
      state.filters.methods.push(method);
    }
  } else {
    state.filters.methods = state.filters.methods.filter(m => m !== method);
  }
  softRenderList();
}

// Status filter toggle
else if (action === 'filter-status-toggle') {
  const status = el.getAttribute('data-status');
  if (el.checked) {
    if (!state.filters.statusCodes.includes(status)) {
      state.filters.statusCodes.push(status);
    }
  } else {
    state.filters.statusCodes = state.filters.statusCodes.filter(s => s !== status);
  }
  softRenderList();
}

// Body search filters (debounced)
else if (action === 'filter-request-body' || action === 'filter-response-body') {
  el.addEventListener('input', debounce((e) => {
    if (action === 'filter-request-body') {
      state.filters.requestBodyContains = e.target.value;
    } else {
      state.filters.responseBodyContains = e.target.value;
    }
    softRenderList();
  }, 300));
}

// Header search filters (debounced)
else if (action.startsWith('filter-req-header') || action.startsWith('filter-res-header')) {
  el.addEventListener('input', debounce((e) => {
    const isRequest = action.includes('req');
    const isName = action.includes('name');

    if (isRequest) {
      if (isName) {
        state.filters.requestHeader.name = e.target.value;
      } else {
        state.filters.requestHeader.value = e.target.value;
      }
    } else {
      if (isName) {
        state.filters.responseHeader.name = e.target.value;
      } else {
        state.filters.responseHeader.value = e.target.value;
      }
    }
    softRenderList();
  }, 300));
}

// Remove filter chip
else if (action === 'remove-filter') {
  const type = el.getAttribute('data-type');
  const value = el.getAttribute('data-value');

  if (type === 'method') {
    state.filters.methods = state.filters.methods.filter(m => m !== value);
  } else if (type === 'status') {
    state.filters.statusCodes = state.filters.statusCodes.filter(s => s !== value);
  } else if (type === 'request-body') {
    state.filters.requestBodyContains = '';
  } else if (type === 'response-body') {
    state.filters.responseBodyContains = '';
  }

  softRenderList();
}

// Clear all filters
else if (action === 'clear-all-filters') {
  state.filters = {
    methods: [],
    statusCodes: [],
    requestBodyContains: '',
    responseBodyContains: '',
    requestHeader: { name: '', value: '' },
    responseHeader: { name: '', value: '' },
    timestampRange: { from: null, to: null },
    mockEnabled: null,
    blocked: null,
    hasNotes: null
  };
  state.search = '';
  render();
}

// Helper: debounce function
function debounce(fn, delay) {
  let timer;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}
```

**Update `filteredInteractions()` Function**:
```javascript
function filteredInteractions() {
  const features = getFeatures();
  let results = state.interactions;

  // PHASE 1: Method filter
  if (features.multiSelect && state.filters.methods.length > 0) {
    results = results.filter(i => state.filters.methods.includes(i.method));
  } else if (state.methodFilter) {
    // Popup mode: single-select (backward compat)
    results = results.filter(i => i.method === state.methodFilter);
  }

  // PHASE 2: Status filter
  if (features.multiSelect && state.filters.statusCodes.length > 0) {
    results = results.filter(i => matchesStatusFilter(i.responseStatus, state.filters.statusCodes));
  } else if (state.statusFilter != null) {
    // Popup mode: single-select (backward compat)
    const bucket = String(Math.floor((i.responseStatus || 0) / 100));
    if (state.statusFilter === '0') {
      results = results.filter(i => (i.responseStatus || 0) === 0);
    } else {
      results = results.filter(i => bucket === state.statusFilter);
    }
  }

  // PHASE 3: URL search (both modes)
  const q = state.search.trim().toLowerCase();
  if (q) {
    results = results.filter(i => i.url.toLowerCase().includes(q));
  }

  // PHASE 4: Body search (DevTools only)
  if (features.bodySearch) {
    if (state.filters.requestBodyContains) {
      const query = state.filters.requestBodyContains.toLowerCase();
      results = results.filter(i => searchBodyContent(i.requestBody, query));
    }

    if (state.filters.responseBodyContains) {
      const query = state.filters.responseBodyContains.toLowerCase();
      results = results.filter(i => searchBodyContent(i.responseBody, query));
    }
  }

  // PHASE 5: Header search (DevTools only)
  if (features.headerSearch) {
    if (state.filters.requestHeader.name || state.filters.requestHeader.value) {
      results = results.filter(i =>
        searchHeaders(
          i.requestHeaders,
          state.filters.requestHeader.name,
          state.filters.requestHeader.value
        )
      );
    }

    if (state.filters.responseHeader.name || state.filters.responseHeader.value) {
      results = results.filter(i =>
        searchHeaders(
          i.responseHeaders,
          state.filters.responseHeader.name,
          state.filters.responseHeader.value
        )
      );
    }
  }

  // PHASE 6: Boolean filters (DevTools only)
  if (state.filters.mockEnabled !== null) {
    results = results.filter(i => i.mockEnabled === state.filters.mockEnabled);
  }
  if (state.filters.blocked !== null) {
    results = results.filter(i => i.blocked === state.filters.blocked);
  }
  if (state.filters.hasNotes !== null) {
    results = results.filter(i => state.filters.hasNotes ? (i.notes && i.notes.trim()) : !i.notes);
  }

  // PHASE 7: Sort (DevTools only)
  if (features.sortableColumns) {
    results = sortInteractions(results, state.sortBy, state.sortOrder);
  } else {
    // Popup mode: simple timestamp DESC
    results.sort((a, b) => b.timestamp - a.timestamp);
  }

  return results;
}

// Helper functions
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

function searchBodyContent(body, query) {
  if (!query) return true;
  if (!body) return false;

  const q = query.toLowerCase();

  // Handle JSON bodies
  if (typeof body === 'object') {
    const str = JSON.stringify(body).toLowerCase();
    return str.includes(q);
  }

  // Handle string bodies
  if (typeof body === 'string') {
    return body.toLowerCase().includes(q);
  }

  return false;
}

function searchHeaders(headers, nameQuery, valueQuery) {
  if (!nameQuery && !valueQuery) return true;
  if (!headers || typeof headers !== 'object') return false;

  const nq = nameQuery.toLowerCase();
  const vq = valueQuery.toLowerCase();

  for (const [name, value] of Object.entries(headers)) {
    const nameMatch = !nq || name.toLowerCase().includes(nq);
    const valueMatch = !vq || String(value).toLowerCase().includes(vq);
    if (nameMatch && valueMatch) return true;
  }
  return false;
}

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
```

**Deliverable (Phase 2.1)**:
- ✅ Advanced filter panel (DevTools only)
- ✅ Multi-select method/status filters
- ✅ Body search (request + response)
- ✅ Header search
- ✅ Boolean filters
- ✅ Filter chips with remove
- ✅ Clear all filters button
- ✅ Active filter count

---

#### 2.2 Sortable Columns (2 days)

**Create `renderSortableListHeader()` Function**:
```javascript
function renderSortableListHeader() {
  const cols = [
    { key: 'method', label: 'Method', width: '80px' },
    { key: 'url', label: 'URL', flex: 2 },
    { key: 'status', label: 'Status', width: '80px' },
    { key: 'duration', label: 'Duration', width: '90px' },
    { key: 'timestamp', label: 'Time', width: '100px' }
  ];

  return `
    <div class="ek-list-header" data-testid="list-header">
      ${cols.map(col => {
        const active = state.sortBy === col.key;
        const arrow = !active ? '' : state.sortOrder === 'asc' ? ' ↑' : ' ↓';
        const style = col.flex ? `flex:${col.flex}` : `width:${col.width}`;

        return `
          <div class="ek-col ${active ? 'active' : ''}"
               style="${style}"
               data-action="sort-by"
               data-column="${col.key}"
               data-testid="sort-${col.key}">
            ${col.label}${arrow}
          </div>
        `;
      }).join('')}
    </div>
  `;
}
```

**Update List Rendering to Use Table Format**:
```javascript
function renderList(interactions) {
  const features = getFeatures();

  if (!features.sortableColumns) {
    // Popup: Simple grouped list (current implementation)
    return interactions.length === 0
      ? renderEmpty()
      : groupByDomain(interactions).map(renderDomainGroup).join('');
  }

  // DevTools: Table format with sortable headers
  if (interactions.length === 0) return renderEmpty();

  return `
    ${renderSortableListHeader()}
    <div class="ek-list-body" data-testid="list-body">
      ${interactions.map(renderInteractionRow).join('')}
    </div>
  `;
}

function renderInteractionRow(i) {
  const st = i.overrideStatus ?? i.responseStatus;
  const stColor = st >= 500 ? '#ef4444' : st >= 400 ? '#f97316' : '#34d399';
  const path = (() => { try { return new URL(i.url).pathname; } catch { return i.url; } })();

  return `
    <div class="ek-row ${i.id === state.selectedId ? 'selected' : ''}"
         data-action="select"
         data-id="${i.id}"
         data-testid="interaction-row">
      <div class="ek-col" style="width:80px">
        <span class="ek-method-badge ek-method-${i.method.toLowerCase()}">${i.method}</span>
        ${i.mockEnabled ? '<span class="ek-mock-badge">⚡</span>' : ''}
      </div>
      <div class="ek-col ek-url" style="flex:2" title="${escapeHtml(i.url)}">
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
    </div>
  `;
}

function formatTimestamp(ts) {
  const now = Date.now();
  const diff = now - ts;

  if (diff < 60000) return Math.floor(diff / 1000) + 's ago';
  if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
  if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
  return new Date(ts).toLocaleDateString();
}
```

**Add Sort Event Handler**:
```javascript
else if (action === 'sort-by') {
  const column = el.getAttribute('data-column');
  if (state.sortBy === column) {
    // Toggle order if same column
    state.sortOrder = state.sortOrder === 'asc' ? 'desc' : 'asc';
  } else {
    // New column: default descending
    state.sortBy = column;
    state.sortOrder = 'desc';
  }
  softRenderList();
}
```

**Deliverable (Phase 2.2)**:
- ✅ Sortable column headers (clickable)
- ✅ Visual sort indicators (↑/↓)
- ✅ Table format list view
- ✅ Sort by: timestamp, URL, method, status, duration
- ✅ Toggle ASC/DESC

---

#### 2.3 Styling (2 days)

Add CSS for all new components to `shared/styles.css`:

```css
/* Advanced Toolbar */
.ek-toolbar-advanced {
  flex-direction: column;
  gap: 12px;
}

.ek-toolbar-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

/* Advanced Filter Panel */
.ek-advanced-filters {
  background: var(--bg-secondary);
  border-radius: 8px;
  padding: 16px;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
}

.ek-filter-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ek-filter-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--text-dim);
  letter-spacing: 0.5px;
}

.ek-checkbox-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ek-checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: background 0.2s;
}

.ek-checkbox:hover {
  background: var(--bg-hover);
}

.ek-checkbox input[type="checkbox"] {
  width: 16px;
  height: 16px;
  cursor: pointer;
}

.ek-row-inline {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}

/* Filter Chips */
.ek-filter-chips-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  background: var(--bg-secondary);
  border-radius: 6px;
}

.ek-filter-count {
  font-size: 12px;
  font-weight: 600;
  color: var(--accent);
  white-space: nowrap;
}

.ek-filter-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  flex: 1;
}

.ek-filter-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: var(--accent);
  color: white;
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.ek-filter-chip:hover {
  background: var(--accent-hover);
  transform: translateY(-1px);
}

.ek-result-count {
  font-size: 12px;
  color: var(--text-dim);
  white-space: nowrap;
}

/* Sortable List */
.ek-list-header {
  display: flex;
  gap: 8px;
  padding: 8px 12px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
  font-size: 11px;
  font-weight: 600;
  color: var(--text-dim);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  position: sticky;
  top: 0;
  z-index: 10;
}

.ek-list-header .ek-col {
  cursor: pointer;
  user-select: none;
  transition: color 0.2s;
}

.ek-list-header .ek-col:hover {
  color: var(--text-primary);
}

.ek-list-header .ek-col.active {
  color: var(--accent);
}

.ek-list-body {
  flex: 1;
  overflow-y: auto;
}

.ek-row {
  display: flex;
  gap: 8px;
  padding: 10px 12px;
  align-items: center;
  border-bottom: 1px solid var(--border);
  cursor: pointer;
  transition: background 0.15s;
}

.ek-row:hover {
  background: var(--bg-hover);
}

.ek-row.selected {
  background: rgba(96, 165, 250, 0.1);
  border-left: 3px solid var(--accent);
  padding-left: 9px;
}

.ek-col {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ek-url {
  font-family: var(--font-mono);
  font-size: 13px;
}

.ek-timestamp {
  font-size: 12px;
  color: var(--text-dim);
}

.ek-mock-badge {
  font-size: 10px;
  margin-left: 4px;
}
```

**Deliverable (Phase 2.3)**:
- ✅ All new components styled
- ✅ Responsive layout for filters
- ✅ Dark/light theme support
- ✅ Hover states and transitions

---

### **Phase 3: Testing & Documentation** (Week 4 - 3 days)

#### 3.1 Testing Checklist

**Popup Mode (Simple)**:
- [ ] Loads in <100ms
- [ ] REC/MOCK toggles work
- [ ] Simple URL search works
- [ ] Method filter (single-select) works
- [ ] Status dropdown works
- [ ] Click API → detail slides in
- [ ] Footer shows "Advanced tools in DevTools" link
- [ ] Click DevTools link → modal appears
- [ ] Modal has clear instructions

**DevTools Mode (Advanced)**:
- [ ] All popup features work
- [ ] Advanced filter panel toggles
- [ ] Multi-select method checkboxes work
- [ ] Multi-select status checkboxes work
- [ ] Request body search works
- [ ] Response body search works
- [ ] Header search works
- [ ] Boolean filters work
- [ ] Filter chips appear when filters applied
- [ ] Remove filter chip works
- [ ] Clear all filters works
- [ ] Active filter count accurate
- [ ] Result count accurate
- [ ] Sortable column headers work
- [ ] Sort direction toggles
- [ ] Sort indicators (↑/↓) show correctly
- [ ] Waterfall view works
- [ ] Resizable panes work

**Performance**:
- [ ] Filter 1000 interactions by method: <50ms
- [ ] Filter 1000 interactions by body: <500ms
- [ ] Sort 1000 interactions: <100ms
- [ ] Combined filter + sort: <600ms

#### 3.2 Documentation Updates

**Update README.md**:
```markdown
## Two Ways to Use EchoKit

### 🚀 Quick Start (Popup)
Perfect for quick recording and basic mocking.

1. Click the EchoKit extension icon
2. Click REC to start recording
3. Interact with your app
4. Search and filter recorded APIs
5. Click any API to view details

### 🔧 Advanced Tools (DevTools Panel)
For professional debugging, filtering, and performance analysis.

1. Press **F12** to open Chrome DevTools
2. Click the **EchoKit** tab
3. Access advanced features:
   - ✅ Multi-select filters (method + status)
   - ✅ Search request/response bodies
   - ✅ Search headers by name/value
   - ✅ Sort by URL, duration, status
   - ✅ Waterfall view for performance
   - ✅ Filter chips with result count
   - ✅ Export filtered results

**Tip**: Click "Advanced tools in DevTools →" in the popup footer for instructions.
```

**Create DUAL_INTERFACE_GUIDE.md**:
Document explaining when to use popup vs DevTools, with screenshots and examples.

---

## 📊 Summary Table

| Phase | Week | Days | Deliverable | Status |
|-------|------|------|-------------|--------|
| **1: Infrastructure** | 1 | 3 | Feature flags, simplified popup, DevTools link | 🔵 Ready |
| **2.1: Multi-Select Filters** | 2 | 3 | Advanced filters (DevTools only) | 🔵 Ready |
| **2.2: Sortable Columns** | 2 | 2 | Table view with sort (DevTools only) | 🔵 Ready |
| **2.3: Styling** | 3 | 2 | CSS for all components | 🔵 Ready |
| **3: Testing & Docs** | 4 | 3 | Tests, documentation, polish | 🔵 Ready |

**Total**: 13 days (~3 weeks)

---

## ✅ Final Checklist

Before launching:

- [ ] All Phase 1 tasks complete
- [ ] All Phase 2 tasks complete
- [ ] All Phase 3 tasks complete
- [ ] Popup loads <100ms
- [ ] DevTools panel loads <100ms
- [ ] Performance benchmarks met
- [ ] Zero breaking changes verified
- [ ] Documentation updated
- [ ] Demo video recorded (popup vs DevTools)
- [ ] Changelog updated

---

## 🎉 What You Get

**Popup (Simple)**:
- Clean, fast, uncluttered
- Perfect for casual users
- Zero learning curve
- Guides users to DevTools when needed

**DevTools Panel (Advanced)**:
- All advanced features fit comfortably
- Professional debugging tools
- Natural developer workflow
- Unlimited space for future features

**Shared Codebase**:
- Single `app.js` with feature flags
- Easy to maintain
- Test both modes independently
- No code duplication

**Competitive Advantage**:
- Redux DevTools: DevTools only (no popup) ❌
- React DevTools: DevTools only (no popup) ❌
- **EchoKit**: BOTH! ✅✅

---

**Ready to start implementation?** 🚀

Let me know if you want me to create the first PR with Phase 1 implementation!
