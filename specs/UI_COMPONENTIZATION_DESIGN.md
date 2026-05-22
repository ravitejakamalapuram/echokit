# EchoKit UI Componentization Architecture

## Problem Statement

Currently, the popup and DevTools panel have **duplicate rendering logic** for interactions with different structures:
- **Popup**: Uses `renderDomainGroup()` → `renderRow()` (grouped list with domain headers)
- **DevTools**: Uses `renderSortableTable()` → `renderInteractionRow()` (table with sortable columns)

This creates:
- ❌ **Code duplication** — same data rendered twice with different markup
- ❌ **Maintenance burden** — changes must be applied to both renderers
- ❌ **Inconsistent UX** — badges, columns, and styling drift between modes
- ❌ **Hard to add features** — new fields require updates in multiple places

## Design Goals

1. **Single source of truth** for interaction rendering
2. **Column-based configuration** — define once, render anywhere
3. **Zero duplication** — shared components with mode-specific adaptors
4. **Easy extensibility** — add/remove columns without touching multiple functions
5. **Professional architecture** — clean separation of concerns

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│  Column Configuration (INTERACTION_COLUMNS)             │
│  - Defines all available columns                        │
│  - Each column has: key, label, render, width/flex     │
│  - Mode-specific visibility rules                       │
└─────────────────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────┐
│  Core Rendering Components                              │
│  - renderInteractionCell(interaction, column, config)   │
│  - renderInteraction(interaction, columns, layout)      │
│  - renderInteractionList(interactions, layout)          │
└─────────────────────────────────────────────────────────┘
                            ▼
┌──────────────────────┬──────────────────────────────────┐
│  Layout Adaptors     │  Layout Adaptors                 │
│  - Popup Layout      │  - DevTools Layout               │
│  - Grouped by domain │  - Sortable table                │
│  - Compact styling   │  - Wide columns                  │
└──────────────────────┴──────────────────────────────────┘
```

---

## Column Configuration Schema

```javascript
const INTERACTION_COLUMNS = {
  method: {
    key: 'method',
    label: 'Method',
    width: '80px',
    flex: null,
    sortable: true,
    visibleIn: ['popup', 'devtools'],
    render: (i) => {
      const method = (i.method || 'GET').toUpperCase();
      return `
        <span class="ek-method-badge ek-method-${escapeHtml(method.toLowerCase())}">
          ${escapeHtml(method)}
        </span>
        ${i.mockEnabled ? '<span class="ek-mock-badge" title="Mock enabled">⚡</span>' : ''}
      `;
    }
  },
  
  url: {
    key: 'url',
    label: 'URL',
    width: null,
    flex: 2,
    sortable: true,
    visibleIn: ['popup', 'devtools'],
    render: (i, config) => {
      const urlPretty = config.mode === 'popup' ? prettyUrl(i.url) : new URL(i.url).pathname;
      return config.mode === 'popup'
        ? `<span class="ek-url-path">${escapeHtml(urlPretty.path)}</span><span class="ek-url-query">${escapeHtml(urlPretty.query)}</span>`
        : escapeHtml(urlPretty);
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
      return `<span style="color:${stColor}">${st ?? '—'}</span>`;
    }
  },
  
  duration: {
    key: 'duration',
    label: 'Duration',
    width: '90px',
    sortable: true,
    visibleIn: ['devtools'], // Only show in DevTools table
    render: (i) => i.durationMs ? `${i.durationMs}ms` : '—'
  },
  
  timestamp: {
    key: 'timestamp',
    label: 'Time',
    width: '100px',
    sortable: true,
    visibleIn: ['devtools'], // Only show in DevTools table
    render: (i) => formatTimestamp(i.timestamp)
  },
  
  source: {
    key: 'source',
    label: 'Source',
    width: '120px',
    sortable: false,
    visibleIn: (features) => features.sourceBadges ? ['popup', 'devtools'] : [],
    render: (i, config) => renderSourceBadge(i, config.tabId)
  },
  
  badges: {
    key: 'badges',
    label: '',
    width: 'auto',
    sortable: false,
    visibleIn: ['popup'], // Only in popup grouped view
    render: (i) => {
      const versionCount = state.interactions.filter(x => x.hash === i.hash).length;
      const conflict = versionCount > 1;
      const mode = i.matchMode || 'strict';
      return `
        ${mode !== 'strict' ? `<span class="ek-mode-badge" title="match mode: ${mode}">${modeBadge(mode)}</span>` : ''}
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
    render: (i) => `
      <button class="ek-icon-btn ${i.mockEnabled ? 'on' : ''}"
              data-action="toggle-mock"
              data-id="${i.id}"
              title="${i.mockEnabled ? 'Mock ON' : 'Mock OFF'}"
              data-testid="mock-toggle">
        ${i.mockEnabled ? '✓' : '○'}
      </button>
      <button class="ek-icon-btn ${i.blocked ? 'on' : ''}"
              data-action="toggle-block"
              data-id="${i.id}"
              title="${i.blocked ? 'Blocked' : 'Block'}"
              data-testid="block-btn">
        ⊘
      </button>
    `
  }
};
```

---

## Core Component Implementation

See `UI_COMPONENTIZATION_IMPLEMENTATION.md` for the full refactoring plan.

---

## Migration Strategy

1. ✅ Define column configuration schema
2. ✅ Extract shared rendering logic
3. ✅ Create layout adaptors
4. ✅ Implement feature flag compatibility
5. ✅ Replace existing renderers
6. ✅ Remove duplicate code
7. ✅ Add comprehensive tests

---

## Benefits

✅ **Single source of truth** — add a column once, appears in both modes  
✅ **Mode-specific visibility** — control which columns show where  
✅ **No duplication** — shared cell rendering  
✅ **Easy maintenance** — change styling in one place  
✅ **Type safety ready** — column config can be strongly typed  
✅ **Professional architecture** — follows component-based design patterns
