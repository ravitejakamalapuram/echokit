# EchoKit UI Componentization — Implementation Plan

## Phase 1: Column Configuration Module

### File: `extension/shared/columns.js`

```javascript
/**
 * Column configuration for interaction list rendering.
 * Defines all available columns, their rendering logic, and mode-specific visibility.
 */

import { escapeHtml } from './app.js';

/**
 * Column definition type:
 * - key: unique column identifier
 * - label: column header text
 * - width: fixed width CSS value (e.g., '80px') or null for flex
 * - flex: flex grow value if width is null
 * - sortable: whether this column can be sorted
 * - visibleIn: array of modes ['popup', 'devtools'] or function(features) => modes[]
 * - render: (interaction, config) => string HTML
 * - className: optional additional CSS class for the column
 */

export const INTERACTION_COLUMNS = {
  method: {
    key: 'method',
    label: 'Method',
    width: '80px',
    sortable: true,
    visibleIn: ['popup', 'devtools'],
    render: (i, config) => {
      const method = (i.method || 'GET').toUpperCase();
      const badge = `<span class="ek-method-badge ek-method-${escapeHtml(method.toLowerCase())}">${escapeHtml(method)}</span>`;
      const mock = i.mockEnabled ? '<span class="ek-mock-badge" title="Mock enabled">⚡</span>' : '';
      
      // In popup grouped view, show inline; in table, show stacked
      return config.layout === 'table' 
        ? `<div style="display:flex;flex-direction:column;gap:2px;align-items:flex-start">${badge}${mock}</div>`
        : `${badge}${mock}`;
    }
  },

  url: {
    key: 'url',
    label: 'URL',
    flex: 2,
    sortable: true,
    visibleIn: ['popup', 'devtools'],
    className: 'ek-url-col',
    render: (i, config) => {
      if (config.layout === 'grouped') {
        const urlPretty = config.prettyUrl(i.url);
        return `<span class="ek-url-path">${escapeHtml(urlPretty.path)}</span><span class="ek-url-query">${escapeHtml(urlPretty.query)}</span>`;
      } else {
        const path = (() => { try { return new URL(i.url).pathname; } catch { return i.url; } })();
        return escapeHtml(path);
      }
    }
  },

  status: {
    key: 'status',
    label: 'Status',
    width: '80px',
    sortable: true,
    visibleIn: ['popup', 'devtools'],
    render: (i) => {
      const st = i.overrideStatus ?? i.responseStatus;
      const stColor = st >= 500 ? 'var(--red)' : st >= 400 ? 'var(--amber)' : 'var(--emerald)';
      const statusClass = st ? `s${Math.floor(st / 100)}` : '';
      return config.layout === 'grouped'
        ? `<span class="ek-status ${statusClass}">${st || 'ERR'}</span>`
        : `<span style="color:${stColor}">${st ?? '—'}</span>`;
    }
  },

  duration: {
    key: 'duration',
    label: 'Duration',
    width: '90px',
    sortable: true,
    visibleIn: ['devtools'],
    render: (i) => i.durationMs ? `${i.durationMs}ms` : '—'
  },

  timestamp: {
    key: 'timestamp',
    label: 'Time',
    width: '100px',
    sortable: true,
    visibleIn: ['devtools'],
    className: 'ek-timestamp',
    render: (i, config) => config.formatTimestamp(i.timestamp)
  },

  source: {
    key: 'source',
    label: 'Source',
    width: '120px',
    sortable: false,
    visibleIn: (features) => features.sourceBadges ? ['popup', 'devtools'] : [],
    render: (i, config) => config.renderSourceBadge(i, config.tabId)
  },

  badges: {
    key: 'badges',
    label: '',
    width: 'auto',
    sortable: false,
    visibleIn: ['popup'],
    render: (i, config) => {
      const versionCount = config.interactions.filter(x => x.hash === i.hash).length;
      const conflict = versionCount > 1;
      const mode = i.matchMode || 'strict';
      const modeBadgeMap = { 'ignore-query': 'NOQ', 'ignore-body': 'NOB', 'path-wildcard': 'PATH' };
      return `
        ${mode !== 'strict' ? `<span class="ek-mode-badge" title="match mode: ${mode}">${modeBadgeMap[mode] || mode}</span>` : ''}
        ${conflict ? `<span class="ek-conflict-badge" title="${versionCount} versions">×${versionCount}</span>` : ''}
      `;
    }
  },

  actions: {
    key: 'actions',
    label: '',
    width: '80px',
    sortable: false,
    visibleIn: ['popup', 'devtools'],
    render: (i, config) => {
      const mockBtn = config.layout === 'grouped'
        ? `<button class="ek-mock-toggle ${i.mockEnabled ? 'on' : ''}" 
                    data-action="toggle-mock" data-id="${i.id}" 
                    title="${i.mockEnabled ? 'Mock ON' : 'Mock OFF'}" 
                    data-testid="mock-toggle"></button>`
        : `<button class="ek-icon-btn ${i.mockEnabled ? 'on' : ''}" 
                    data-action="toggle-mock" data-id="${i.id}" 
                    title="${i.mockEnabled ? 'Mock ON' : 'Mock OFF'}" 
                    data-testid="mock-toggle">${i.mockEnabled ? '✓' : '○'}</button>`;
      
      const blockBtn = config.layout === 'grouped'
        ? `<button class="ek-block-btn ${i.blocked ? 'on' : ''}" 
                    data-action="toggle-block" data-id="${i.id}" 
                    title="${i.blocked ? 'BLOCKED — click to unblock' : 'Block this API at network level'}" 
                    data-testid="block-btn">⊘</button>`
        : `<button class="ek-icon-btn ${i.blocked ? 'on' : ''}" 
                    data-action="toggle-block" data-id="${i.id}" 
                    title="${i.blocked ? 'Blocked' : 'Block'}" 
                    data-testid="block-btn">⊘</button>`;
      
      return config.layout === 'table'
        ? `<div style="display:flex;gap:4px;justify-content:flex-end">${mockBtn}${blockBtn}</div>`
        : `${mockBtn}${blockBtn}`;
    }
  }
};

/**
 * Get visible columns for the current mode and features.
 */
export function getVisibleColumns(mode, features) {
  return Object.values(INTERACTION_COLUMNS).filter(col => {
    const visibleIn = typeof col.visibleIn === 'function' 
      ? col.visibleIn(features) 
      : col.visibleIn;
    return visibleIn.includes(mode);
  });
}

/**
 * Get column by key.
 */
export function getColumn(key) {
  return INTERACTION_COLUMNS[key];
}
```

---

## Phase 2: Core Rendering Components

### File: `extension/shared/interaction-renderer.js`

```javascript
/**
 * Core interaction rendering components.
 * Layout-agnostic rendering logic that adapts to popup or devtools mode.
 */

import { getVisibleColumns } from './columns.js';
import { escapeHtml } from './app.js';

/**
 * Render a single cell for an interaction.
 */
export function renderInteractionCell(interaction, column, config) {
  try {
    return column.render(interaction, config);
  } catch (err) {
    console.error(`Error rendering column ${column.key}:`, err);
    return '—';
  }
}

// Continued in next file due to 150 line limit...
```

---

## Phase 2B: Core Rendering Components (continued)

```javascript
/**
 * Render an interaction row in table layout (DevTools).
 */
export function renderInteractionTableRow(interaction, columns, config) {
  const active = interaction.id === config.selectedId ? 'selected' : '';

  return `
    <div class="ek-table-row ${active}"
         data-action="select"
         data-id="${interaction.id}"
         data-testid="interaction-row">
      ${columns.map(col => {
        const style = col.flex ? `flex:${col.flex}` : `width:${col.width || 'auto'}`;
        const className = `ek-col ${col.className || ''}`;
        return `
          <div class="${className}" style="${style}">
            ${renderInteractionCell(interaction, col, { ...config, layout: 'table' })}
          </div>
        `;
      }).join('')}
    </div>
  `;
}

/**
 * Render an interaction row in grouped layout (Popup).
 */
export function renderInteractionGroupedRow(interaction, columns, config) {
  const active = config.selectedId === interaction.id ? 'active' : '';

  return `
    <div class="ek-row ${active}"
         data-id="${interaction.id}"
         data-action="select"
         data-testid="api-row">
      ${columns.map(col =>
        renderInteractionCell(interaction, col, { ...config, layout: 'grouped' })
      ).join('')}
    </div>
  `;
}

/**
 * Render table header (DevTools).
 */
export function renderTableHeader(columns, config) {
  return `
    <div class="ek-list-header" data-testid="list-header">
      ${columns.map(col => {
        const active = config.sortBy === col.key;
        const arrow = !active ? '' : config.sortOrder === 'asc' ? ' ↑' : ' ↓';
        const style = col.flex ? `flex:${col.flex}` : `width:${col.width || 'auto'}`;
        const clickable = col.sortable;
        const className = `ek-col ${active ? 'active' : ''} ${clickable ? 'clickable' : ''} ${col.className || ''}`;

        return `
          <div class="${className}"
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

/**
 * Render domain group header (Popup).
 */
export function renderDomainGroupHeader(domain, count) {
  return `
    <div class="ek-domain" data-testid="domain-group">
      <span class="ek-domain-icon"></span>
      <span class="ek-domain-name">${escapeHtml(domain)}</span>
      <span class="ek-domain-count">${count}</span>
    </div>
  `;
}
```

---

## Phase 3: Layout Adaptors

### File: `extension/shared/layouts.js`

```javascript
/**
 * Layout adaptors — convert interactions to rendered HTML.
 */

import { getVisibleColumns } from './columns.js';
import {
  renderInteractionTableRow,
  renderInteractionGroupedRow,
  renderTableHeader,
  renderDomainGroupHeader
} from './interaction-renderer.js';

/**
 * Render interactions in table layout (DevTools).
 */
export function renderTableLayout(interactions, config) {
  const columns = getVisibleColumns('devtools', config.features);

  return `
    ${renderTableHeader(columns, config)}
    <div class="ek-list-body" data-testid="list-body">
      ${interactions.map(i => renderInteractionTableRow(i, columns, config)).join('')}
    </div>
  `;
}

/**
 * Render interactions in grouped layout (Popup).
 */
export function renderGroupedLayout(interactions, config) {
  const columns = getVisibleColumns('popup', config.features);
  const grouped = groupByDomain(interactions);

  return grouped.map(group => `
    ${renderDomainGroupHeader(group.domain, group.items.length)}
    ${group.items.map(i => renderInteractionGroupedRow(i, columns, config)).join('')}
  `).join('');
}

function groupByDomain(interactions) {
  const byDomain = {};
  interactions.forEach(i => {
    let domain;
    try {
      domain = new URL(i.url).hostname;
    } catch {
      domain = 'unknown';
    }
    if (!byDomain[domain]) byDomain[domain] = [];
    byDomain[domain].push(i);
  });
  return Object.entries(byDomain).map(([domain, items]) => ({ domain, items }));
}
```

---

## Phase 4: Integration into app.js

### Changes to `extension/shared/app.js`

1. **Import new modules**:
```javascript
import { renderTableLayout, renderGroupedLayout } from './layouts.js';
```

2. **Replace `renderListView()`**:
```javascript
function renderListView(interactions, isPopup) {
  if (interactions.length === 0) return renderEmpty();

  const features = getFeatures();
  const config = {
    features,
    selectedId: state.selectedId,
    sortBy: state.sortBy,
    sortOrder: state.sortOrder,
    tabId: state.tabId,
    interactions: state.interactions,
    // Helper functions
    formatTimestamp,
    prettyUrl,
    renderSourceBadge
  };

  return isPopup || !features.sortableColumns
    ? renderGroupedLayout(interactions, config)
    : renderTableLayout(interactions, config);
}
```

3. **Remove old functions**:
   - ❌ `renderDomainGroup()`
   - ❌ `renderRow()`
   - ❌ `renderSortableTable()`
   - ❌ `renderSortableListHeader()`
   - ❌ `renderInteractionRow()`

---

## Phase 5: Benefits & Testing

### ✅ Single Source of Truth
```javascript
// Add a new column in ONE place:
export const INTERACTION_COLUMNS = {
  // ... existing columns ...

  requestSize: {
    key: 'requestSize',
    label: 'Req Size',
    width: '90px',
    sortable: true,
    visibleIn: ['devtools'], // Only show in DevTools
    render: (i) => formatBytes(i.requestBody?.length || 0)
  }
};

// ✅ Automatically appears in DevTools table
// ✅ Automatically hidden in popup
// ✅ No duplicate code
```

### 🧪 Testing Strategy

1. **Unit tests** for column rendering:
   - Each column renders correctly
   - Mode-specific visibility works
   - Helper functions are called correctly

2. **Integration tests**:
   - Popup shows grouped layout
   - DevTools shows table layout
   - Sorting works
   - Column visibility respects features

3. **Visual regression**:
   - Screenshots before/after refactor
   - Ensure pixel-perfect match

---

## Migration Checklist

- [ ] Create `extension/shared/columns.js`
- [ ] Create `extension/shared/interaction-renderer.js`
- [ ] Create `extension/shared/layouts.js`
- [ ] Update `extension/shared/app.js` imports
- [ ] Replace `renderListView()` implementation
- [ ] Remove deprecated rendering functions
- [ ] Test popup mode
- [ ] Test DevTools mode
- [ ] Test sorting in DevTools
- [ ] Test filtering in both modes
- [ ] Test source badges visibility
- [ ] Update `extension/README.md` with new architecture
- [ ] Run smoke tests: `python3 tests/smoke_echokit.py`
- [ ] Commit with message: "refactor: componentize interaction list rendering"
