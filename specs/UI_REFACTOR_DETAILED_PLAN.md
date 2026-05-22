# EchoKit UI Componentization — Detailed Architectural Plan
## Senior UI/UX Architect's Implementation Guide

> **Goal**: Zero UI/UX issues, zero code duplication, professional component architecture

---

## Phase 0: Deep Analysis & Design Validation

### 0.1 Current State Audit (DO NOT SKIP)

**Objective**: Document EVERY UI difference between popup and DevTools

#### 0.1.1 Visual Inventory Checklist
- [ ] Screenshot popup in light theme
- [ ] Screenshot popup in dark theme
- [ ] Screenshot DevTools panel in light theme
- [ ] Screenshot DevTools panel in dark theme
- [ ] List ALL visible columns in popup grouped view
- [ ] List ALL visible columns in DevTools table view
- [ ] Document badge positions (mock badge, source badge, conflict badge, mode badge)
- [ ] Document button styles (ek-mock-toggle vs ek-icon-btn)
- [ ] Document spacing differences (gaps, padding, margins)
- [ ] Document font sizes for each mode
- [ ] Document color usage for status codes
- [ ] Document hover states for each interactive element

#### 0.1.2 Behavioral Inventory Checklist
- [ ] How does selection work in popup? (click row → detail slides in)
- [ ] How does selection work in DevTools? (click row → detail shows in right pane)
- [ ] What happens when you click method badge in popup?
- [ ] What happens when you click method badge in DevTools?
- [ ] What happens when you click status in popup?
- [ ] What happens when you click status in DevTools?
- [ ] How does sorting work in DevTools? (click header)
- [ ] Does sorting exist in popup? (NO - grouped by domain)
- [ ] How do filters affect popup vs DevTools?

#### 0.1.3 Data Flow Audit
- [ ] Trace `filteredInteractions()` output
- [ ] Trace `groupByDomain()` input/output
- [ ] Trace `state.selectedId` usage
- [ ] Trace `state.sortBy` and `state.sortOrder` usage
- [ ] Trace feature flags (`FEATURES.popup` vs `FEATURES.devtools`)
- [ ] Identify all helper functions used in rendering (prettyUrl, formatTimestamp, renderSourceBadge, modeBadge)

#### 0.1.4 CSS Audit
- [ ] Document `.ek-row` styles (popup grouped view)
- [ ] Document `.ek-table-row` styles (DevTools table)
- [ ] Document `.ek-col` styles and flex/width rules
- [ ] Document `.ek-domain` group header styles
- [ ] Document `.ek-list-header` table header styles
- [ ] Identify ALL CSS classes used in both renderers
- [ ] Check for CSS that might break if we change markup

#### 0.1.5 Accessibility Audit
- [ ] Are all interactive elements keyboard accessible?
- [ ] Do all buttons have proper aria-labels?
- [ ] Are data-testid attributes consistent?
- [ ] Is there proper focus management?
- [ ] Are there any ARIA violations?

### 0.2 Component Boundaries Definition

**Objective**: Define EXACT component hierarchy and responsibilities

#### 0.2.1 Component Tree Structure
```
InteractionList
├── Layout: Popup Grouped
│   ├── DomainGroup (header)
│   └── InteractionRow
│       ├── MethodCell
│       ├── UrlCell
│       ├── BadgesCell (mode badge, conflict badge)
│       ├── StatusCell
│       ├── SourceBadgeCell (conditional)
│       └── ActionsCell (mock toggle, block button)
│
└── Layout: DevTools Table
    ├── TableHeader
    │   └── ColumnHeader (sortable)
    └── TableRow
        ├── MethodCell
        ├── UrlCell
        ├── StatusCell
        ├── DurationCell
        ├── TimestampCell
        ├── SourceBadgeCell (conditional)
        └── ActionsCell (mock toggle, block button)
```

#### 0.2.2 Component Contracts (Input/Output)

**MethodCell**
- Input: `{ interaction, layout: 'grouped'|'table' }`
- Output: HTML string with method badge + optional mock indicator
- Variants: 
  - Popup: inline badge with spark emoji
  - DevTools: stacked badge in flex column

**UrlCell**
- Input: `{ interaction, layout: 'grouped'|'table', prettyUrl() }`
- Output: HTML string with URL
- Variants:
  - Popup: `<span class="ek-url-path">` + `<span class="ek-url-query">`
  - DevTools: just pathname with ellipsis

**StatusCell**
- Input: `{ interaction, layout: 'grouped'|'table' }`
- Output: HTML string with status code
- Variants:
  - Popup: `<span class="ek-status s2">` with class-based color
  - DevTools: inline style with CSS variable color

**ActionsCell**
- Input: `{ interaction, layout: 'grouped'|'table' }`
- Output: HTML string with mock toggle + block button
- Variants:
  - Popup: `.ek-mock-toggle` + `.ek-block-btn` (no text, icon buttons)
  - DevTools: `.ek-icon-btn` wrapped in flex container with gap

### 0.3 Design Decisions Documentation

**Objective**: Lock in architectural decisions BEFORE coding

#### 0.3.1 Column Visibility Strategy
Decision: Use `visibleIn` array or function
```javascript
visibleIn: ['popup', 'devtools']           // Show in both
visibleIn: ['devtools']                    // DevTools only
visibleIn: (features) => features.sourceBadges ? ['popup', 'devtools'] : []
```

#### 0.3.2 Layout Detection Strategy
Decision: Pass `layout` in config object to render functions
```javascript
const config = {
  layout: 'grouped' | 'table',
  mode: 'popup' | 'devtools',
  features: getFeatures(),
  // ... other context
};
```

#### 0.3.3 CSS Strategy
Decision: Keep existing CSS classes, add new ones only when needed
- NO breaking changes to `.ek-row`, `.ek-table-row`, `.ek-col`
- Component render functions output the SAME markup as before
- If we need layout-specific styling, use layout class: `.ek-cell-grouped` vs `.ek-cell-table`

#### 0.3.4 Error Handling Strategy
```javascript
function renderInteractionCell(interaction, column, config) {
  try {
    return column.render(interaction, config);
  } catch (err) {
    console.error(`[EchoKit] Error rendering column ${column.key}:`, err, { interaction, column, config });
    return '<span class="ek-error" title="Render error">—</span>';
  }
}
```

#### 0.3.5 Testing Strategy
- **Unit tests**: Each column render function in isolation
- **Integration tests**: Full layout rendering with real data
- **Visual regression**: Playwright screenshots before/after
- **Manual testing checklist**: 20+ scenarios across both modes

---

## Deliverables for Phase 0

- [ ] `specs/CURRENT_STATE_AUDIT.md` — screenshots, measurements, behavior docs
- [ ] `specs/COMPONENT_CONTRACTS.md` — input/output specs for every component
- [ ] `specs/CSS_IMPACT_ANALYSIS.md` — which styles might break, mitigation plan
- [ ] `specs/MIGRATION_RISK_MATRIX.md` — every risk identified with mitigation

**DO NOT PROCEED TO PHASE 1 UNTIL PHASE 0 IS COMPLETE**

---

## Phase 0.9: Create Helper Functions (FOUNDATION) ⭐ NEW PHASE

**⚠️ CRITICAL: This phase is REQUIRED before Phase 1**

### Why This Phase Exists

Your requirement: *"Cannot afford to make issues in future if there are 2 sources it is inevitable"*

**Solution**: Extract ALL business logic to pure functions FIRST, then build column config on top.

**This guarantees**: Changes in ONE place automatically apply to BOTH popup and DevTools.

### 0.9.1 Create Helper Functions File

**File**: `extension/shared/interaction-helpers.js`

```javascript
/**
 * EchoKit Interaction Helpers
 * SINGLE SOURCE OF TRUTH for all interaction data processing.
 */

/** Get color for HTTP status code */
export function getStatusColor(status) {
  if (!status) return 'var(--text-muted)';
  if (status >= 500) return 'var(--red)';
  if (status >= 400) return 'var(--amber)';
  if (status >= 300) return 'var(--blue)';
  return 'var(--emerald)';
}

/** Get CSS class for status (popup only) */
export function getStatusClass(status) {
  return 's' + Math.floor((status || 0) / 100);
}

/** Get final status value (respects overrides) */
export function getStatusValue(interaction) {
  return interaction.overrideStatus ?? interaction.responseStatus;
}

/** Normalize HTTP method to uppercase */
export function normalizeMethod(method) {
  return (method || 'GET').toUpperCase();
}

/** Format duration for display */
export function formatDuration(ms) {
  return ms ? ms + 'ms' : '—';
}

/** Format timestamp relative to now */
export function formatTimestamp(timestamp) {
  const now = Date.now();
  const diff = now - timestamp;
  if (diff < 60_000) return Math.floor(diff / 1000) + 's ago';
  if (diff < 3600_000) return Math.floor(diff / 60_000) + 'm ago';
  if (diff < 86400_000) return Math.floor(diff / 3600_000) + 'h ago';
  return Math.floor(diff / 86400_000) + 'd ago';
}

/** Pretty-print URL */
export function prettyUrl(url) {
  try {
    const u = new URL(url);
    return { path: u.pathname, query: u.search };
  } catch {
    return { path: url, query: '' };
  }
}

/** Get match mode badge text */
export function getModeBadgeText(mode) {
  const mapping = {
    'ignore-query': 'NOQ',
    'ignore-body': 'NOB',
    'path-wildcard': 'PATH'
  };
  return mapping[mode] || mode;
}

/** Check if interaction has conflict */
export function hasConflict(interaction, allInteractions) {
  return allInteractions.filter(x => x.hash === interaction.hash).length > 1;
}

/** Get conflict version count */
export function getConflictCount(interaction, allInteractions) {
  return allInteractions.filter(x => x.hash === interaction.hash).length;
}

/** Escape HTML */
export function escapeHtml(str) {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
```

### 0.9.2 Create Consistency Tests

**File**: `tests/consistency/single-source-enforcement.test.js`

```javascript
import { getStatusColor, normalizeMethod } from '../../extension/shared/interaction-helpers.js';

describe('SINGLE SOURCE ENFORCEMENT', () => {
  test('status colors are deterministic', () => {
    expect(getStatusColor(200)).toBe('var(--emerald)');
    expect(getStatusColor(404)).toBe('var(--amber)');
    expect(getStatusColor(500)).toBe('var(--red)');
  });

  test('method normalization is consistent', () => {
    expect(normalizeMethod('get')).toBe('GET');
    expect(normalizeMethod(null)).toBe('GET');
  });
});
```

### 0.9.3 Deliverables

- [ ] `extension/shared/interaction-helpers.js` created with 12+ functions
- [ ] Each function has JSDoc comment
- [ ] Consistency tests created
- [ ] All tests pass

**⛔ DO NOT PROCEED TO PHASE 1 UNTIL PHASE 0.9 COMPLETE**

---

## Phase 1: Foundation - Column Configuration System

**CRITICAL RULE**: Column renderers MUST use helpers from Phase 0.9. NO inline logic.

### 1.1 Column Metadata Schema Design

**Objective**: Define the complete column specification that covers ALL use cases

```typescript
interface Column {
  key: string;                    // Unique identifier
  label: string;                  // Header text
  width?: string;                 // Fixed width (e.g., '80px') or null
  flex?: number;                  // Flex grow value if width is null
  sortable: boolean;              // Can this column be sorted?
  visibleIn: string[] | ((features: Features) => string[]); // Mode visibility
  className?: string;             // Additional CSS class
  align?: 'left' | 'center' | 'right'; // Cell alignment

  // Rendering function
  render: (interaction: Interaction, config: RenderConfig) => string;

  // Optional: custom sort comparator
  sortFn?: (a: Interaction, b: Interaction) => number;

  // Optional: filter predicate
  filterFn?: (interaction: Interaction, filterValue: string) => boolean;
}

interface RenderConfig {
  layout: 'grouped' | 'table';
  mode: 'popup' | 'devtools';
  features: Features;
  selectedId: string | null;
  sortBy: string | null;
  sortOrder: 'asc' | 'desc';
  tabId: number;
  interactions: Interaction[];

  // Helper functions
  formatTimestamp: (ts: number) => string;
  prettyUrl: (url: string) => { path: string; query: string };
  renderSourceBadge: (i: Interaction, tabId: number) => string;
  escapeHtml: (str: string) => string;
}
```

### 1.2 Column Definitions Implementation Plan

**File**: `extension/shared/columns.js`

#### 1.2.1 Method Column
```javascript
method: {
  key: 'method',
  label: 'Method',
  width: '80px',
  sortable: true,
  align: 'left',
  visibleIn: ['popup', 'devtools'],

  render: (i, config) => {
    const method = (i.method || 'GET').toUpperCase();
    const badge = `<span class="ek-method-badge ek-method-${config.escapeHtml(method.toLowerCase())}">${config.escapeHtml(method)}</span>`;
    const mockIndicator = i.mockEnabled ? '<span class="ek-mock-badge" title="Mock enabled">⚡</span>' : '';

    if (config.layout === 'table') {
      // DevTools: stack vertically
      return `<div style="display:flex;flex-direction:column;gap:2px;align-items:flex-start">${badge}${mockIndicator}</div>`;
    } else {
      // Popup: inline
      return `${badge}${mockIndicator}`;
    }
  },

  sortFn: (a, b) => {
    const aMethod = (a.method || 'GET').toUpperCase();
    const bMethod = (b.method || 'GET').toUpperCase();
    return aMethod.localeCompare(bMethod);
  }
}
```

#### 1.2.2 URL Column
```javascript
url: {
  key: 'url',
  label: 'URL',
  flex: 2,
  sortable: true,
  align: 'left',
  visibleIn: ['popup', 'devtools'],
  className: 'ek-url-col',

  render: (i, config) => {
    if (config.layout === 'grouped') {
      // Popup: show path + query separately
      const urlPretty = config.prettyUrl(i.url);
      return `<span class="ek-url-path">${config.escapeHtml(urlPretty.path)}</span><span class="ek-url-query">${config.escapeHtml(urlPretty.query)}</span>`;
    } else {
      // DevTools: pathname only
      const path = (() => {
        try { return new URL(i.url).pathname; }
        catch { return i.url; }
      })();
      return config.escapeHtml(path);
    }
  },

  sortFn: (a, b) => {
    try {
      const aPath = new URL(a.url).pathname;
      const bPath = new URL(b.url).pathname;
      return aPath.localeCompare(bPath);
    } catch {
      return a.url.localeCompare(b.url);
    }
  }
}
```

#### 1.2.3 Status Column
```javascript
status: {
  key: 'status',
  label: 'Status',
  width: '80px',
  sortable: true,
  align: 'center',
  visibleIn: ['popup', 'devtools'],

  render: (i, config) => {
    const st = i.overrideStatus ?? i.responseStatus;

    if (config.layout === 'grouped') {
      // Popup: use class-based styling
      const statusClass = st ? `s${Math.floor(st / 100)}` : '';
      return `<span class="ek-status ${statusClass}">${st || 'ERR'}</span>`;
    } else {
      // DevTools: inline CSS variable colors
      const stColor = st >= 500 ? 'var(--red)' : st >= 400 ? 'var(--amber)' : 'var(--emerald)';
      return `<span style="color:${stColor}">${st ?? '—'}</span>`;
    }
  },

  sortFn: (a, b) => {
    const aSt = a.overrideStatus ?? a.responseStatus ?? 0;
    const bSt = b.overrideStatus ?? b.responseStatus ?? 0;
    return aSt - bSt;
  }
}
```

### 1.3 Column Registry & Helper Functions

```javascript
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

/**
 * Sort interactions by column.
 */
export function sortInteractions(interactions, sortBy, sortOrder) {
  const col = getColumn(sortBy);
  if (!col || !col.sortable) return interactions;

  const sorted = [...interactions].sort(col.sortFn || ((a, b) => 0));
  return sortOrder === 'desc' ? sorted.reverse() : sorted;
}

/**
 * Validate column configuration (throws on error).
 */
export function validateColumnConfig() {
  Object.entries(INTERACTION_COLUMNS).forEach(([key, col]) => {
    if (!col.key) throw new Error(`Column ${key} missing 'key'`);
    if (!col.label) throw new Error(`Column ${key} missing 'label'`);
    if (typeof col.render !== 'function') throw new Error(`Column ${key} missing 'render' function`);
    if (!Array.isArray(col.visibleIn) && typeof col.visibleIn !== 'function') {
      throw new Error(`Column ${key} 'visibleIn' must be array or function`);
    }
  });
}
```

### 1.4 Testing Plan for Phase 1

**File**: `tests/unit/columns.test.js`

```javascript
import { INTERACTION_COLUMNS, getVisibleColumns, sortInteractions, validateColumnConfig } from '../../extension/shared/columns.js';

describe('Column Configuration', () => {
  test('validates column config on import', () => {
    expect(() => validateColumnConfig()).not.toThrow();
  });

  test('method column renders correctly in popup', () => {
    const i = { method: 'GET', mockEnabled: true };
    const config = { layout: 'grouped', escapeHtml: (s) => s };
    const html = INTERACTION_COLUMNS.method.render(i, config);
    expect(html).toContain('GET');
    expect(html).toContain('⚡');
  });

  test('status column uses correct color in devtools', () => {
    const i = { responseStatus: 404 };
    const config = { layout: 'table' };
    const html = INTERACTION_COLUMNS.status.render(i, config);
    expect(html).toContain('var(--amber)');
    expect(html).toContain('404');
  });

  test('getVisibleColumns filters by mode', () => {
    const popupCols = getVisibleColumns('popup', {});
    const devtoolsCols = getVisibleColumns('devtools', {});

    expect(popupCols.length).toBeGreaterThan(0);
    expect(devtoolsCols.length).toBeGreaterThan(0);

    // Duration should only be in devtools
    expect(popupCols.find(c => c.key === 'duration')).toBeUndefined();
    expect(devtoolsCols.find(c => c.key === 'duration')).toBeDefined();
  });
});
```

### 1.5 Deliverables for Phase 1

- [ ] `extension/shared/columns.js` — complete column configuration
- [ ] All 8 columns defined: method, url, status, duration, timestamp, source, badges, actions
- [ ] Helper functions: getVisibleColumns, getColumn, sortInteractions, validateColumnConfig
- [ ] `tests/unit/columns.test.js` — 15+ unit tests covering all columns
- [ ] Documentation comments for every column and function

**DO NOT PROCEED TO PHASE 2 UNTIL PHASE 1 TESTS PASS**

---

## Phase 2: Core Rendering Components

### 2.1 Cell Renderer Implementation

**File**: `extension/shared/interaction-renderer.js`

```javascript
import { escapeHtml } from './app.js';

/**
 * Render a single cell for an interaction.
 * Wraps column.render() with error handling and logging.
 */
export function renderInteractionCell(interaction, column, config) {
  try {
    const html = column.render(interaction, config);

    // Validate output
    if (typeof html !== 'string') {
      throw new Error(`Column ${column.key} render() must return string, got ${typeof html}`);
    }

    return html;
  } catch (err) {
    console.error(`[EchoKit] Error rendering column ${column.key}:`, err, {
      interaction,
      column: column.key,
      config: { layout: config.layout, mode: config.mode }
    });

    // Graceful degradation
    return `<span class="ek-error" title="Render error: ${escapeHtml(err.message)}">—</span>`;
  }
}
```

### 2.2 Table Row Renderer (DevTools)

```javascript
/**
 * Render an interaction as a table row (DevTools mode).
 */
export function renderInteractionTableRow(interaction, columns, config) {
  const active = interaction.id === config.selectedId ? 'selected' : '';

  // Build cells
  const cells = columns.map(col => {
    const style = col.flex ? `flex:${col.flex}` : `width:${col.width || 'auto'}`;
    const className = `ek-col ${col.className || ''}`;
    const align = col.align ? `text-align:${col.align}` : '';
    const cellStyle = [style, align].filter(Boolean).join(';');

    const cellHtml = renderInteractionCell(interaction, col, { ...config, layout: 'table' });

    return `<div class="${className}" style="${cellStyle}">${cellHtml}</div>`;
  }).join('');

  return `
    <div class="ek-table-row ${active}"
         data-action="select"
         data-id="${interaction.id}"
         data-testid="interaction-row">
      ${cells}
    </div>
  `;
}
```

### 2.3 Grouped Row Renderer (Popup)

```javascript
/**
 * Render an interaction as a grouped row (Popup mode).
 */
export function renderInteractionGroupedRow(interaction, columns, config) {
  const active = config.selectedId === interaction.id ? 'active' : '';

  // Build cells - popup uses simpler markup
  const cells = columns.map(col => {
    return renderInteractionCell(interaction, col, { ...config, layout: 'grouped' });
  }).join('');

  return `
    <div class="ek-row ${active}"
         data-id="${interaction.id}"
         data-action="select"
         data-testid="api-row">
      ${cells}
    </div>
  `;
}
```

### 2.4 Header Renderers

```javascript
/**
 * Render table header (DevTools).
 */
export function renderTableHeader(columns, config) {
  const headerCells = columns.map(col => {
    const active = config.sortBy === col.key;
    const arrow = !active ? '' : config.sortOrder === 'asc' ? ' ↑' : ' ↓';
    const style = col.flex ? `flex:${col.flex}` : `width:${col.width || 'auto'}`;
    const clickable = col.sortable;
    const className = `ek-col ${active ? 'active' : ''} ${clickable ? 'clickable' : ''} ${col.className || ''}`;
    const align = col.align ? `text-align:${col.align}` : '';
    const cellStyle = [style, align].filter(Boolean).join(';');

    return `
      <div class="${className}"
           style="${cellStyle}"
           ${clickable ? `data-action="sort-by" data-column="${col.key}"` : ''}
           data-testid="sort-${col.key}">
        ${col.label}${arrow}
      </div>
    `;
  }).join('');

  return `
    <div class="ek-list-header" data-testid="list-header">
      ${headerCells}
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

### 2.5 Testing Plan for Phase 2

**File**: `tests/unit/interaction-renderer.test.js`

```javascript
describe('Core Rendering Components', () => {
  test('renderInteractionCell handles errors gracefully', () => {
    const badColumn = {
      key: 'bad',
      render: () => { throw new Error('Test error'); }
    };
    const html = renderInteractionCell({}, badColumn, {});
    expect(html).toContain('ek-error');
    expect(html).toContain('—');
  });

  test('renderInteractionTableRow generates correct markup', () => {
    const interaction = { id: 'test-123', method: 'GET', url: 'http://test.com' };
    const columns = [
      { key: 'method', width: '80px', render: () => 'GET' },
      { key: 'url', flex: 2, render: () => '/test' }
    ];
    const config = { selectedId: null, layout: 'table' };

    const html = renderInteractionTableRow(interaction, columns, config);

    expect(html).toContain('ek-table-row');
    expect(html).toContain('data-id="test-123"');
    expect(html).toContain('ek-col');
    expect(html).toContain('width:80px');
    expect(html).toContain('flex:2');
  });

  test('renderTableHeader includes sort arrows', () => {
    const columns = [
      { key: 'method', label: 'Method', width: '80px', sortable: true }
    ];
    const config = { sortBy: 'method', sortOrder: 'asc' };

    const html = renderTableHeader(columns, config);

    expect(html).toContain('Method ↑');
    expect(html).toContain('data-action="sort-by"');
    expect(html).toContain('active');
  });
});
```

### 2.6 Deliverables for Phase 2

- [ ] `extension/shared/interaction-renderer.js` — 5 core rendering functions
- [ ] Error handling in every render function
- [ ] Proper escaping of all user-generated content
- [ ] `tests/unit/interaction-renderer.test.js` — 20+ tests
- [ ] JSDoc comments for every function

**DO NOT PROCEED TO PHASE 3 UNTIL PHASE 2 TESTS PASS**

---

## Phase 3: Layout Adaptors

### 3.1 Table Layout (DevTools)

**File**: `extension/shared/layouts.js`

```javascript
import { getVisibleColumns } from './columns.js';
import {
  renderInteractionTableRow,
  renderTableHeader
} from './interaction-renderer.js';

/**
 * Render interactions in table layout (DevTools).
 */
export function renderTableLayout(interactions, config) {
  const columns = getVisibleColumns('devtools', config.features);

  if (interactions.length === 0) {
    return '<div class="ek-empty"><div class="ek-empty-mark">·</div><div class="ek-empty-title">No requests</div></div>';
  }

  const header = renderTableHeader(columns, config);
  const rows = interactions.map(i => renderInteractionTableRow(i, columns, config)).join('');

  return `
    ${header}
    <div class="ek-list-body" data-testid="list-body">
      ${rows}
    </div>
  `;
}
```

### 3.2 Grouped Layout (Popup)

```javascript
import { renderInteractionGroupedRow, renderDomainGroupHeader } from './interaction-renderer.js';

/**
 * Group interactions by domain.
 */
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

  return Object.entries(byDomain)
    .map(([domain, items]) => ({ domain, items }))
    .sort((a, b) => a.domain.localeCompare(b.domain));
}

/**
 * Render interactions in grouped layout (Popup).
 */
export function renderGroupedLayout(interactions, config) {
  const columns = getVisibleColumns('popup', config.features);

  if (interactions.length === 0) {
    return '<div class="ek-empty"><div class="ek-empty-mark">·</div><div class="ek-empty-title">No requests</div></div>';
  }

  const grouped = groupByDomain(interactions);

  return grouped.map(group => {
    const header = renderDomainGroupHeader(group.domain, group.items.length);
    const rows = group.items.map(i => renderInteractionGroupedRow(i, columns, config)).join('');
    return header + rows;
  }).join('');
}
```

### 3.3 Deliverables for Phase 3

- [ ] `extension/shared/layouts.js` — 2 layout functions
- [ ] Empty state handling in both layouts
- [ ] Proper domain grouping logic
- [ ] `tests/unit/layouts.test.js` — 10+ integration tests
- [ ] Test with real interaction data from smoke tests

**DO NOT PROCEED TO PHASE 4 UNTIL PHASE 3 TESTS PASS**

---

## Phase 4: Integration & Migration

### 4.1 Feature Flag Strategy

**Objective**: Allow gradual rollout with instant rollback capability

```javascript
// In extension/shared/app.js
const ENABLE_COMPONENTIZED_RENDERING = true; // Feature flag

function renderListView(interactions, isPopup) {
  if (!ENABLE_COMPONENTIZED_RENDERING) {
    // OLD CODE PATH (keep temporarily)
    return renderListViewLegacy(interactions, isPopup);
  }

  // NEW CODE PATH
  if (interactions.length === 0) return renderEmpty();

  const features = getFeatures();
  const config = buildRenderConfig();

  return isPopup || !features.sortableColumns
    ? renderGroupedLayout(interactions, config)
    : renderTableLayout(interactions, config);
}
```

### 4.2 Config Builder Function

```javascript
/**
 * Build render configuration object.
 * Centralizes all context needed for rendering.
 */
function buildRenderConfig() {
  return {
    // Layout info
    layout: state.mode === 'popup' ? 'grouped' : 'table',
    mode: state.mode,
    features: getFeatures(),

    // Selection & sorting
    selectedId: state.selectedId,
    sortBy: state.sortBy,
    sortOrder: state.sortOrder,

    // Data context
    tabId: state.tabId,
    interactions: state.interactions,

    // Helper functions
    formatTimestamp,
    prettyUrl,
    renderSourceBadge,
    escapeHtml,

    // Debug info
    _timestamp: Date.now(),
    _version: '2.0-componentized'
  };
}
```

### 4.3 Import Statements

```javascript
// At top of extension/shared/app.js
import { renderTableLayout, renderGroupedLayout } from './layouts.js';
import { INTERACTION_COLUMNS, getVisibleColumns, sortInteractions } from './columns.js';
```

### 4.4 Integration Checklist

- [ ] Add imports to app.js
- [ ] Add buildRenderConfig() function
- [ ] Add feature flag ENABLE_COMPONENTIZED_RENDERING
- [ ] Rename old renderListView to renderListViewLegacy
- [ ] Implement new renderListView using layouts
- [ ] Test with feature flag OFF (old code path)
- [ ] Test with feature flag ON (new code path)
- [ ] Verify identical output in both modes
- [ ] Check all data-testid attributes match
- [ ] Verify all event handlers still work

### 4.5 Soft Render Update

```javascript
// Update softRenderList() to use new system
function softRenderList() {
  const list = root.querySelector('[data-testid="api-list"]');
  if (!list) return render();

  const items = filteredInteractions();
  const scrollTop = list.scrollTop;

  const features = getFeatures();
  const config = buildRenderConfig();

  if (ENABLE_COMPONENTIZED_RENDERING) {
    // NEW: Use layouts
    const isPopup = state.mode === 'popup';
    list.innerHTML = isPopup || !features.sortableColumns
      ? renderGroupedLayout(items, config)
      : renderTableLayout(items, config);
  } else {
    // OLD: Legacy code
    const isPopup = state.mode === 'popup';
    if (isPopup || !features.sortableColumns) {
      const grouped = groupByDomain(items);
      list.innerHTML = items.length === 0 ? renderEmpty() : grouped.map(renderDomainGroup).join('');
    } else {
      list.innerHTML = renderSortableTable(items);
    }
  }

  list.scrollTop = scrollTop;
  renderAllCodeEditors();
}
```

### 4.6 Migration Validation Tests

**File**: `tests/integration/migration.test.js`

```javascript
describe('Component Migration', () => {
  test('old and new render identical HTML for popup', () => {
    const interactions = loadFixture('sample-interactions.json');

    ENABLE_COMPONENTIZED_RENDERING = false;
    const oldHtml = renderListView(interactions, true);

    ENABLE_COMPONENTIZED_RENDERING = true;
    const newHtml = renderListView(interactions, true);

    // Normalize whitespace for comparison
    expect(normalize(newHtml)).toBe(normalize(oldHtml));
  });

  test('old and new render identical HTML for devtools', () => {
    const interactions = loadFixture('sample-interactions.json');

    ENABLE_COMPONENTIZED_RENDERING = false;
    const oldHtml = renderListView(interactions, false);

    ENABLE_COMPONENTIZED_RENDERING = true;
    const newHtml = renderListView(interactions, false);

    expect(normalize(newHtml)).toBe(normalize(oldHtml));
  });

  test('all data-testid attributes preserved', () => {
    ENABLE_COMPONENTIZED_RENDERING = true;
    const html = renderListView([sampleInteraction], false);

    expect(html).toContain('data-testid="list-header"');
    expect(html).toContain('data-testid="list-body"');
    expect(html).toContain('data-testid="interaction-row"');
    expect(html).toContain('data-testid="mock-toggle"');
  });
});
```

### 4.7 Deliverables for Phase 4

- [ ] Feature flag added to app.js
- [ ] buildRenderConfig() function implemented
- [ ] New renderListView() using layouts
- [ ] Old code preserved as renderListViewLegacy()
- [ ] softRenderList() updated
- [ ] Migration tests pass (HTML comparison)
- [ ] All existing smoke tests pass with flag ON
- [ ] All existing smoke tests pass with flag OFF

**DO NOT PROCEED TO PHASE 5 UNTIL PHASE 4 MIGRATION TESTS PASS**

---

## Phase 5: Testing & Validation

### 5.1 Visual Regression Testing

**Tool**: Playwright with screenshot comparison

```javascript
// tests/visual/popup-regression.spec.js
test('popup appearance unchanged', async ({ page }) => {
  await page.goto('chrome-extension://<ID>/popup/popup.html');
  await page.waitForSelector('[data-testid="api-list"]');

  const screenshot = await page.screenshot();
  expect(screenshot).toMatchSnapshot('popup-with-interactions.png');
});

test('devtools appearance unchanged', async ({ page }) => {
  await page.goto('chrome-extension://<ID>/devtools/panel.html');
  await page.waitForSelector('[data-testid="list-header"]');

  const screenshot = await page.screenshot();
  expect(screenshot).toMatchSnapshot('devtools-table-view.png');
});
```

### 5.2 Comprehensive Manual Testing Checklist

#### 5.2.1 Popup Mode Testing
- [ ] Open popup, verify grouped layout appears
- [ ] Verify domain headers show correct counts
- [ ] Click interaction, verify detail slide-in animation
- [ ] Verify method badges render correctly
- [ ] Verify status codes show correct colors
- [ ] Verify mock toggle works (click → mocking state changes)
- [ ] Verify block button works
- [ ] Verify source badge appears when enabled
- [ ] Verify conflict badge shows for duplicates
- [ ] Verify mode badge shows for non-strict matches
- [ ] Test with 0 interactions (empty state)
- [ ] Test with 1 interaction
- [ ] Test with 100+ interactions (scroll performance)
- [ ] Test light theme
- [ ] Test dark theme

#### 5.2.2 DevTools Mode Testing
- [ ] Open DevTools panel, verify table layout
- [ ] Verify table header with sortable columns
- [ ] Click column header, verify sort ascending
- [ ] Click again, verify sort descending
- [ ] Click third time, verify sort cleared
- [ ] Verify all columns align correctly
- [ ] Verify duration column shows
- [ ] Verify timestamp column shows
- [ ] Click interaction, verify detail pane updates
- [ ] Resize pane, verify list width changes
- [ ] Test with filters active
- [ ] Test with advanced filters panel open
- [ ] Test search while table is visible
- [ ] Test with 0 interactions (empty state)
- [ ] Test with 500+ interactions (performance)
- [ ] Test light theme
- [ ] Test dark theme

#### 5.2.3 Cross-Mode Testing
- [ ] Record in popup, open DevTools → verify same data
- [ ] Record in DevTools, open popup → verify same data
- [ ] Toggle mock in popup, check in DevTools → verify synced
- [ ] Toggle mock in DevTools, check in popup → verify synced
- [ ] Delete interaction in popup → verify removed in DevTools
- [ ] Delete interaction in DevTools → verify removed in popup
- [ ] Export from popup, import in DevTools → verify works
- [ ] Change theme in popup → verify reflected in DevTools

### 5.3 Performance Benchmarks

```javascript
// tests/performance/render-benchmark.js
test('render 1000 interactions in < 100ms', () => {
  const interactions = generateInteractions(1000);
  const start = performance.now();

  renderTableLayout(interactions, config);

  const duration = performance.now() - start;
  expect(duration).toBeLessThan(100);
});

test('sorting 1000 interactions in < 50ms', () => {
  const interactions = generateInteractions(1000);
  const start = performance.now();

  sortInteractions(interactions, 'url', 'asc');

  const duration = performance.now() - start;
  expect(duration).toBeLessThan(50);
});
```

### 5.4 Accessibility Audit

- [ ] Run Chrome Lighthouse accessibility audit (score > 95)
- [ ] Verify all interactive elements have aria-labels
- [ ] Tab through all elements, verify focus order
- [ ] Test with screen reader (VoiceOver on Mac)
- [ ] Verify color contrast meets WCAG AA
- [ ] Verify keyboard shortcuts still work

### 5.5 Deliverables for Phase 5

- [ ] Visual regression tests pass
- [ ] All 50+ manual test cases pass
- [ ] Performance benchmarks pass
- [ ] Accessibility audit score > 95
- [ ] No console errors in either mode
- [ ] No memory leaks detected
- [ ] Document any known issues/limitations

**DO NOT PROCEED TO PHASE 6 UNTIL ALL TESTS PASS**

---

## Phase 6: Cleanup & Documentation

### 6.1 Remove Legacy Code

**ONLY AFTER Phase 5 is 100% green:**

```javascript
// Delete these functions from app.js:
// - renderDomainGroup()
// - renderRow()
// - renderSortableTable()
// - renderSortableListHeader()
// - renderInteractionRow()
// - groupByDomain() (moved to layouts.js)
// - renderListViewLegacy() (temporary migration code)

// Remove feature flag:
// const ENABLE_COMPONENTIZED_RENDERING = true; // DELETE THIS LINE
```

### 6.2 Documentation Updates

#### 6.2.1 Update extension/README.md
```markdown
## Architecture

... (existing content) ...

### UI Rendering Architecture (v2.0)

The interaction list UI uses a componentized architecture:

- **Column Configuration** (`shared/columns.js`) — single source of truth for all columns
- **Core Rendering** (`shared/interaction-renderer.js`) — reusable cell/row renderers
- **Layout Adaptors** (`shared/layouts.js`) — popup grouped view & DevTools table view
- **Integration** (`shared/app.js`) — main render loop

Benefits:
- Zero code duplication between popup and DevTools
- Easy to add/remove columns
- Consistent UX across modes
- Professional component-based architecture

See `specs/UI_COMPONENTIZATION_SUMMARY.md` for details.
```

#### 6.2.2 Add ADR (Architecture Decision Record)
**File**: `docs/ADR_002_COMPONENTIZED_UI.md`

```markdown
# ADR 002: Componentized UI Rendering

## Status
Accepted (2025-01-XX)

## Context
The popup and DevTools panel had duplicate rendering logic causing:
- 5 separate rendering functions
- ~200 lines of duplicated code
- Inconsistent UX when features diverged
- High maintenance burden

## Decision
Implement a 3-layer component architecture:
1. Column configuration (single source of truth)
2. Core rendering components (reusable functions)
3. Layout adaptors (mode-specific)

## Consequences

### Positive
- 40% code reduction
- Single source of truth for columns
- Easy to add/remove columns
- Consistent UX
- Better testability

### Negative
- Initial migration effort (~6 hours)
- Slightly more abstraction
- Team needs to learn new patterns

## Implementation
See `specs/UI_REFACTOR_DETAILED_PLAN.md`
```

### 6.3 Final Validation

- [ ] Run full smoke test suite: `python3 tests/smoke_echokit.py`
- [ ] Test in Chrome, Edge, Brave
- [ ] Test on Mac, Windows
- [ ] Verify Chrome Web Store zip builds correctly
- [ ] Update CHANGELOG.md with componentization notes
- [ ] Create PR with detailed description
- [ ] Request code review from team

### 6.4 Deliverables for Phase 6

- [ ] All legacy code removed
- [ ] README.md updated
- [ ] ADR document created
- [ ] CHANGELOG.md updated
- [ ] All tests still passing
- [ ] PR created and reviewed
- [ ] Merged to main branch

---

## Success Criteria

✅ **Zero UI/UX differences** between old and new system
✅ **All tests pass** (unit, integration, visual, smoke)
✅ **Performance maintained** or improved
✅ **Code reduced by 40%**
✅ **No console errors or warnings**
✅ **Team approves architecture**
✅ **Documentation complete**

---

## Rollback Plan

If critical issues discovered:

1. Set `ENABLE_COMPONENTIZED_RENDERING = false` in app.js
2. Redeploy previous version
3. Debug new system in separate branch
4. Re-run all phases with fixes
5. Re-test before re-enabling

---

## Timeline Estimate

| Phase | Estimated Time | Dependencies |
|-------|----------------|--------------|
| Phase 0: Analysis | 2-3 hours | None |
| Phase 1: Columns | 2-3 hours | Phase 0 |
| Phase 2: Core Rendering | 2-3 hours | Phase 1 |
| Phase 3: Layouts | 1-2 hours | Phase 2 |
| Phase 4: Integration | 2-3 hours | Phase 3 |
| Phase 5: Testing | 3-4 hours | Phase 4 |
| Phase 6: Cleanup | 1-2 hours | Phase 5 |
| **TOTAL** | **13-20 hours** | Sequential |

---

## Next Steps

1. **START WITH PHASE 0** — do NOT skip the analysis phase
2. Create `specs/CURRENT_STATE_AUDIT.md` with screenshots and measurements
3. Get stakeholder sign-off on the plan
4. Begin Phase 1 implementation

**Remember**: Quality over speed. Each phase must be 100% complete before moving to the next.
