# Implementation Checklist - Advanced Search, Filter & Sort

## Phase 1: Multi-Filter Foundation (Week 1)

### Backend/State Changes
- [ ] Update state schema in `extension/shared/app.js`
  ```javascript
  // Add to state object (line ~8-27)
  advancedFilterOpen: false,
  filters: {
    methods: [],           // Replace methodFilter
    statusCodes: [],       // Replace statusFilter
    mockEnabled: null,
    blocked: null,
    hasNotes: null
  },
  sortBy: 'timestamp',
  sortOrder: 'desc'
  ```

- [ ] Create `initFilterState()` helper function
  ```javascript
  function initFilterState() {
    return {
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
  }
  ```

### Filtering Logic
- [ ] Refactor `filteredInteractions()` function (line ~1606-1618)
  - [ ] Replace single `methodFilter` with `filters.methods[]` array
  - [ ] Replace single `statusFilter` with `filters.statusCodes[]` array
  - [ ] Add support for `mockEnabled`, `blocked`, `hasNotes` filters
  - [ ] Keep URL search as fallback (backward compat)

- [ ] Create `matchesStatusFilter(status, filterArray)` helper
  ```javascript
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
  ```

### UI Components
- [ ] Create `renderAdvancedFilterPanel()` function
  - [ ] Method checkboxes (GET, POST, PUT, PATCH, DELETE)
  - [ ] Status code checkboxes (2xx, 3xx, 4xx, 5xx, Failed)
  - [ ] Boolean toggles (Mock Enabled, Blocked, Has Notes)
  - [ ] Apply button
  - [ ] Reset button

- [ ] Update `renderToolbar()` function (line ~559-577)
  - [ ] Add "Advanced Filters" toggle button
  - [ ] Add "Clear All" button
  - [ ] Show active filter count badge

- [ ] Create `renderFilterChips()` function
  ```javascript
  function renderFilterChips() {
    const chips = [];
    state.filters.methods.forEach(m => {
      chips.push(`<span class="ek-filter-chip" data-action="remove-filter" data-type="method" data-value="${m}">× method:${m}</span>`);
    });
    // ... repeat for other filter types
    return chips.length ? `<div class="ek-filter-chips">${chips.join('')}</div>` : '';
  }
  ```

### Event Handlers
- [ ] Add event handler for "Advanced Filters" toggle
  ```javascript
  else if (action === 'toggle-advanced-filters') {
    state.advancedFilterOpen = !state.advancedFilterOpen;
    render();
  }
  ```

- [ ] Add event handlers for filter checkboxes
  ```javascript
  else if (action === 'filter-method-multi') {
    const method = el.getAttribute('data-method');
    const checked = el.checked;
    if (checked) {
      if (!state.filters.methods.includes(method)) {
        state.filters.methods.push(method);
      }
    } else {
      state.filters.methods = state.filters.methods.filter(m => m !== method);
    }
    softRenderList();
  }
  ```

- [ ] Add event handler for "Remove Filter" chips
  ```javascript
  else if (action === 'remove-filter') {
    const type = el.getAttribute('data-type');
    const value = el.getAttribute('data-value');
    if (type === 'method') {
      state.filters.methods = state.filters.methods.filter(m => m !== value);
    }
    // ... handle other filter types
    softRenderList();
  }
  ```

- [ ] Add event handler for "Clear All Filters"
  ```javascript
  else if (action === 'clear-filters') {
    state.filters = initFilterState();
    state.search = '';
    render();
  }
  ```

### Styling
- [ ] Add CSS for advanced filter panel in `extension/shared/style.css`
  ```css
  .ek-advanced-filters {
    background: var(--bg-secondary);
    border-radius: 8px;
    padding: 16px;
    margin-bottom: 12px;
  }
  
  .ek-filter-section {
    margin-bottom: 16px;
  }
  
  .ek-filter-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 8px;
  }
  
  .ek-filter-chip {
    display: inline-block;
    background: var(--accent);
    color: white;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 11px;
    margin-right: 6px;
    cursor: pointer;
  }
  
  .ek-filter-chip:hover {
    background: var(--accent-hover);
  }
  ```

---

## Phase 2: Body & Header Search (Week 2)

### State Updates
- [ ] Add body/header search fields to filters state (already in Phase 1)

### Search Logic
- [ ] Create `searchBodyContent(body, query)` helper
  ```javascript
  function searchBodyContent(body, query) {
    if (!query) return true;
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
  ```

- [ ] Create `searchHeaders(headers, nameQuery, valueQuery)` helper
  ```javascript
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
  ```

- [ ] Update `filteredInteractions()` to include body/header search
  ```javascript
  // Add after method/status filters

  // Request body search
  if (state.filters.requestBodyContains) {
    results = results.filter(i =>
      searchBodyContent(i.requestBody, state.filters.requestBodyContains)
    );
  }

  // Response body search
  if (state.filters.responseBodyContains) {
    results = results.filter(i =>
      searchBodyContent(i.responseBody, state.filters.responseBodyContains)
    );
  }

  // Request header search
  if (state.filters.requestHeader.name || state.filters.requestHeader.value) {
    results = results.filter(i =>
      searchHeaders(
        i.requestHeaders,
        state.filters.requestHeader.name,
        state.filters.requestHeader.value
      )
    );
  }

  // Response header search
  if (state.filters.responseHeader.name || state.filters.responseHeader.value) {
    results = results.filter(i =>
      searchHeaders(
        i.responseHeaders,
        state.filters.responseHeader.name,
        state.filters.responseHeader.value
      )
    );
  }
  ```

### UI Updates
- [ ] Add body search inputs to advanced filter panel
  ```javascript
  <div class="ek-filter-section">
    <label class="ek-filter-label">Search Body Content</label>
    <input class="ek-input"
           placeholder="Request contains..."
           value="${escapeHtml(state.filters.requestBodyContains)}"
           data-action="filter-request-body"
           data-testid="filter-request-body"/>
    <input class="ek-input"
           placeholder="Response contains..."
           value="${escapeHtml(state.filters.responseBodyContains)}"
           data-action="filter-response-body"
           data-testid="filter-response-body"/>
  </div>
  ```

- [ ] Add header search inputs to advanced filter panel
  ```javascript
  <div class="ek-filter-section">
    <label class="ek-filter-label">Search Headers</label>
    <div class="ek-row-inline">
      <input class="ek-input" placeholder="Request header name"
             value="${escapeHtml(state.filters.requestHeader.name)}"
             data-action="filter-req-header-name" style="flex:1"/>
      <input class="ek-input" placeholder="value"
             value="${escapeHtml(state.filters.requestHeader.value)}"
             data-action="filter-req-header-value" style="flex:1"/>
    </div>
    <div class="ek-row-inline">
      <input class="ek-input" placeholder="Response header name"
             value="${escapeHtml(state.filters.responseHeader.name)}"
             data-action="filter-res-header-name" style="flex:1"/>
      <input class="ek-input" placeholder="value"
             value="${escapeHtml(state.filters.responseHeader.value)}"
             data-action="filter-res-header-value" style="flex:1"/>
    </div>
  </div>
  ```

### Event Handlers
- [ ] Add input handlers for body/header search fields (debounced)
  ```javascript
  else if (action === 'filter-request-body') {
    let t;
    el.addEventListener('input', (e) => {
      state.filters.requestBodyContains = e.target.value;
      clearTimeout(t);
      t = setTimeout(() => softRenderList(), 300);  // Longer debounce for body search
    });
  }

  // Repeat for other body/header inputs
  ```

### Performance Optimization
- [ ] Add loading indicator for expensive body searches
  ```javascript
  async function filteredInteractions() {
    const hasBodySearch = state.filters.requestBodyContains ||
                          state.filters.responseBodyContains;
    const isLargeDataset = state.interactions.length > 500;

    if (hasBodySearch && isLargeDataset) {
      showLoadingOverlay('Searching body content...');
    }

    // Run filtering logic...

    hideLoadingOverlay();
    return results;
  }
  ```

---

## Phase 3: Sort Functionality (Week 3)

### State Updates
- [ ] Already added in Phase 1: `sortBy`, `sortOrder`

### Sort Logic
- [ ] Create `sortInteractions(interactions, sortBy, sortOrder)` function
  ```javascript
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

- [ ] Update `filteredInteractions()` to apply sort
  ```javascript
  function filteredInteractions() {
    let results = state.interactions.filter(/* ... filtering logic ... */);

    // Apply sort at the end
    results = sortInteractions(results, state.sortBy, state.sortOrder);

    return results;
  }
  ```

### UI Updates
- [ ] Create `renderSortableListHeader()` function
  ```javascript
  function renderSortableListHeader() {
    const cols = [
      { key: 'method', label: 'Method' },
      { key: 'url', label: 'URL', flex: 2 },
      { key: 'status', label: 'Status' },
      { key: 'duration', label: 'Time' },
      { key: 'timestamp', label: 'Recorded' }
    ];

    return `
      <div class="ek-list-header">
        ${cols.map(col => {
          const active = state.sortBy === col.key;
          const arrow = !active ? '' : state.sortOrder === 'asc' ? ' ↑' : ' ↓';
          return `
            <div class="ek-col ${active ? 'active' : ''}"
                 style="flex:${col.flex || 1}"
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

- [ ] Update list item rendering to use columns
  ```javascript
  function renderInteractionRow(i) {
    return `
      <div class="ek-row" data-action="select" data-id="${i.id}">
        <div class="ek-col">${i.method}</div>
        <div class="ek-col ek-url" style="flex:2">${prettyUrl(i.url).path}</div>
        <div class="ek-col">${i.responseStatus || '—'}</div>
        <div class="ek-col">${i.durationMs ? i.durationMs + 'ms' : '—'}</div>
        <div class="ek-col">${formatTimestamp(i.timestamp)}</div>
      </div>
    `;
  }
  ```

### Event Handlers
- [ ] Add click handler for sortable columns
  ```javascript
  else if (action === 'sort-by') {
    const column = el.getAttribute('data-column');
    if (state.sortBy === column) {
      // Toggle order if clicking same column
      state.sortOrder = state.sortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      // New column: default to descending (most common use case)
      state.sortBy = column;
      state.sortOrder = 'desc';
    }
    render();
  }
  ```

### Styling
- [ ] Add CSS for sortable list header
  ```css
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
  }

  .ek-list-header .ek-col {
    cursor: pointer;
    user-select: none;
  }

  .ek-list-header .ek-col:hover {
    color: var(--text-primary);
  }

  .ek-list-header .ek-col.active {
    color: var(--accent);
  }

  .ek-row {
    display: flex;
    gap: 8px;
    padding: 8px 12px;
    align-items: center;
  }

  .ek-col {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  ```

---

## Phase 4: IndexedDB Optimization (Optional - Week 4)

### Database Migration
- [ ] Update `DB_VERSION` to 2 in `extension/shared/store.js`
- [ ] Add migration logic in `onupgradeneeded` handler
  ```javascript
  req.onupgradeneeded = (event) => {
    const db = req.result;
    const oldVersion = event.oldVersion;

    // V1 → V2 migration
    if (oldVersion < 2) {
      if (db.objectStoreNames.contains(STORE_INTERACTIONS)) {
        const tx = event.target.transaction;
        const store = tx.objectStore(STORE_INTERACTIONS);

        // Add new indexes
        if (!store.indexNames.contains('method')) {
          store.createIndex('method', 'method', { unique: false });
        }
        if (!store.indexNames.contains('responseStatus')) {
          store.createIndex('responseStatus', 'responseStatus', { unique: false });
        }
        if (!store.indexNames.contains('mockEnabled')) {
          store.createIndex('mockEnabled', 'mockEnabled', { unique: false });
        }
      }
    }
  };
  ```

### Query Optimization (Future)
- [ ] Add index-based query functions (only if performance becomes issue)
  ```javascript
  export async function getInteractionsByMethod(method) {
    const store = await tx(STORE_INTERACTIONS);
    const idx = store.index('method');
    return req2promise(idx.getAll(method));
  }

  export async function getInteractionsByStatus(status) {
    const store = await tx(STORE_INTERACTIONS);
    const idx = store.index('responseStatus');
    return req2promise(idx.getAll(status));
  }
  ```

---

## Testing Checklist

### Unit Tests (Add to test suite)
- [ ] `matchesStatusFilter()` with various inputs
- [ ] `searchBodyContent()` with JSON and string bodies
- [ ] `searchHeaders()` with name/value combinations
- [ ] `sortInteractions()` for each sort key
- [ ] Filter combination logic (AND semantics)

### Integration Tests (Playwright)
- [ ] Apply single filter → verify count
- [ ] Apply multiple filters → verify AND logic
- [ ] Search request body → verify results
- [ ] Search response body → verify results
- [ ] Click sort header → verify order
- [ ] Toggle sort direction → verify reverse
- [ ] Remove filter chip → verify update
- [ ] Clear all filters → verify reset

### Performance Tests
- [ ] Filter 1000 interactions by method: <50ms
- [ ] Filter 1000 interactions by body: <500ms
- [ ] Sort 1000 interactions: <100ms
- [ ] Combined filter + sort: <600ms

---

## Documentation Updates

- [ ] Update README.md with search syntax examples
- [ ] Update CHANGELOG.md with new features
- [ ] Add screenshots to docs showing advanced filters
- [ ] Update FAQ with common search patterns

---

## Final Checklist

- [ ] All event handlers properly bound
- [ ] No memory leaks (remove event listeners on cleanup)
- [ ] Accessibility: ARIA labels, keyboard navigation
- [ ] Mobile responsive (collapsible filters)
- [ ] Dark/light theme support
- [ ] Backward compatibility tested
- [ ] Performance benchmarks met
- [ ] User documentation complete
