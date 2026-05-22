# EchoKit UI Current State Audit
## Phase 0.1: Visual Inventory - Complete Documentation

> **Date**: Generated during Phase 0 Analysis  
> **Purpose**: Document EXACT current UI state before refactoring  
> **Use**: Reference during implementation to ensure pixel-perfect preservation

---

## Executive Summary

### Two Rendering Paths Identified

1. **Popup Mode (Grouped List)** - `renderRow()` + `renderDomainGroup()`
2. **DevTools Mode (Sortable Table)** - `renderInteractionRow()` + `renderSortableListHeader()`

### Key Findings

- **Code Duplication**: ~80% overlap in logic, but different markup/classes
- **Style Drift**: 2 sets of classes (`.ek-row` vs `.ek-table-row`), different button styles
- **Badge Inconsistency**: Badges positioned/styled differently in each mode
- **Status Rendering**: Popup uses CSS classes (`.s2`, `.s4`), DevTools uses inline styles

---

## 1. Popup Mode (Grouped List)

### 1.1 Layout Structure

```html
<div class="ek-domain">          ← Domain group header (sticky)
  <span class="ek-domain-icon">  ← Amber square icon
  <span class="ek-domain-name">  ← e.g., "api.example.com"
  <span class="ek-domain-count"> ← e.g., "3"
</div>

<div class="ek-row [active]">    ← Interaction row (repeats)
  <span class="ek-method">        ← Method badge (GET/POST/etc.)
  <div class="ek-url">            ← URL with path+query
  [badges: mode, conflict, source]
  <span class="ek-status">        ← Status code badge
  <button class="ek-mock-toggle"> ← Toggle-style button
  <button class="ek-block-btn">   ← Block button (⊘)
</div>
```

### 1.2 Visible Columns (Left to Right)

| Column | Element | Width | Description |
|--------|---------|-------|-------------|
| 1. Method | `.ek-method` | 48px min | Badge: GET/POST/PUT/DELETE/PATCH |
| 2. URL | `.ek-url` | flex:1 | Path + query (separate spans) |
| 3. Badges | Various | auto | Mode/conflict/source badges (conditional) |
| 4. Status | `.ek-status` | 36px min | HTTP status code |
| 5. Mock Toggle | `.ek-mock-toggle` | 30px × 16px | iOS-style toggle switch |
| 6. Block | `.ek-block-btn` | auto | Block button (⊘ symbol) |

### 1.3 Row Styles (`.ek-row`)

```css
.ek-row {
  display: flex;
  align-items: center;
  gap: var(--space-md);           /* 12px */
  padding: var(--space-md) var(--space-lg); /* 12px 16px */
  border-bottom: 1px solid var(--border);
  cursor: pointer;
  transition: background var(--transition-fast);
  background: var(--bg);
}

.ek-row:hover {
  background: var(--surface);
}

.ek-row.active {
  background: var(--surface-2);
  border-left: 2px solid var(--amber);
  padding-left: calc(var(--space-lg) - 2px); /* 14px */
}
```text

### 1.4 Method Badge (`.ek-method`)

```css
.ek-method {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: var(--fw-bold);    /* 700 */
  letter-spacing: 0.03em;
  padding: 3px 8px;
  border-radius: var(--radius-sm); /* 4px */
  border: 1px solid;
  min-width: 48px;
  text-transform: uppercase;
}

/* Per-method colors */
.ek-method.GET    { color: var(--blue);   background: var(--blue-dim); }
.ek-method.POST   { color: var(--emerald); background: var(--emerald-dim); }
.ek-method.PUT    { color: var(--amber);  background: var(--amber-dim); }
.ek-method.DELETE { color: var(--red);    background: var(--red-dim); }
.ek-method.PATCH  { color: var(--purple); background: var(--purple-dim); }
```text

### 1.5 Status Badge (`.ek-status`)

**Popup uses CSS classes based on status range:**

```javascript
const statusClass = 's' + String(Math.floor((i.responseStatus || 0) / 100));
// Returns: 's2' (200s), 's3' (300s), 's4' (400s), 's5' (500s)
```text

```css
.ek-status {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: var(--fw-semibold); /* 600 */
  padding: 3px 7px;
  border-radius: var(--radius-sm); /* 4px */
  min-width: 36px;
}

.ek-status.s2 { color: var(--emerald); background: var(--emerald-dim); border: 1px solid var(--emerald-border); }
.ek-status.s3 { color: var(--blue);    background: var(--blue-dim);    border: 1px solid var(--blue-border); }
.ek-status.s4 { color: var(--amber);   background: var(--amber-dim);   border: 1px solid rgba(251,191,36,0.3); }
.ek-status.s5 { color: var(--red);     background: var(--red-dim);     border: 1px solid var(--red-border); }
```text

### 1.6 Mock Toggle Button (`.ek-mock-toggle`)

**iOS-style toggle switch:**

```css
.ek-mock-toggle {
  width: 30px;
  height: 16px;
  border-radius: 999px;
  background: var(--surface-2);
  border: 1px solid var(--border-strong);
  position: relative;
  transition: background 160ms ease;
}

.ek-mock-toggle::after {
  content: '';
  position: absolute;
  top: 1px;
  left: 1px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--text-dim);
  transition: transform 160ms ease, background 160ms ease;
}

.ek-mock-toggle.on {
  background: var(--amber);
  border-color: var(--amber);
}

.ek-mock-toggle.on::after {
  transform: translateX(14px);
  background: #000;
}
```text

### 1.7 Additional Badges (Conditional)

**Mode Badge** (appears when `matchMode !== 'strict'`):
```html
<span class="ek-mode-badge" title="match mode: ignore-query">NOQ</span>
```text
```css
.ek-mode-badge {
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.02em;
  padding: 2px 5px;
  border-radius: 3px;
  background: var(--surface-2);
  border: 1px solid var(--border);
  color: var(--text-muted);
  text-transform: uppercase;
}
```text
Mapping: `{'ignore-query': 'NOQ', 'ignore-body': 'NOB', 'path-wildcard': 'PATH'}`

**Conflict Badge** (appears when `versionCount > 1`):
```html
<span class="ek-conflict-badge" title="3 versions">×3</span>
```text
```css
.ek-conflict-badge {
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.05em;
  padding: 2px 6px;
  border-radius: 3px;
  color: var(--amber);
  background: var(--amber-dim);
  border: 1px solid rgba(251,191,36,0.3);
  text-transform: uppercase;
}
```text

**Source Badge** (conditional - when `features.sourceBadges` enabled):
- Rendered by `renderSourceBadge(i, state.tabId)`
- Types: "this-tab", "other-tab", "closed-tab", "other-window"
- Shows origin of the recorded interaction

### 1.8 Domain Group Header (`.ek-domain`)

```css
.ek-domain {
  padding: var(--space-md) var(--space-lg); /* 12px 16px */
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  border-top: 1px solid var(--border);
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: var(--fw-semibold); /* 600 */
  letter-spacing: 0.05em;
  color: var(--text-muted);
  position: sticky;
  top: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: var(--space-sm); /* 8px */
}

.ek-domain-icon {
  width: 14px;
  height: 14px;
  border-radius: 3px;
  background: var(--amber);
}
```text

---

## 2. DevTools Mode (Sortable Table)

### 2.1 Layout Structure

```
<div class="ek-list-header">      ← Table header (sticky)
  <div class="ek-header-col">     ← Method column header
  <div class="ek-header-col">     ← URL column header (sortable)
  <div class="ek-header-col">     ← Status column header (sortable)
  <div class="ek-header-col">     ← Duration column header (sortable)
  <div class="ek-header-col">     ← Timestamp column header (sortable)
  [optional: source column]
  <div class="ek-header-col">     ← Actions column header
</div>

<div class="ek-table-row [selected]"> ← Interaction row (repeats)
  <div class="ek-col">            ← Method badge + mock badge
  <div class="ek-col ek-url-col"> ← URL path
  <div class="ek-col">            ← Status (inline color)
  <div class="ek-col">            ← Duration (ms)
  <div class="ek-col ek-timestamp"> ← Timestamp (relative)
  [optional: source badge]
  <div class="ek-col">            ← Action buttons (icon style)
</div>
```text

### 2.2 Visible Columns (Left to Right)

| Column | Element | Width | Description |
|--------|---------|-------|-------------|
| 1. Method | `.ek-col` | 80px | Method badge + mock indicator (⚡) |
| 2. URL | `.ek-col.ek-url-col` | flex:2 | Pathname only |
| 3. Status | `.ek-col` | 80px | **Inline color** (not badge) |
| 4. Duration | `.ek-col` | 90px | Duration in ms or "—" |
| 5. Timestamp | `.ek-col.ek-timestamp` | 100px | Relative time |
| 6. Source | `.ek-col` | 120px | Source badge (conditional) |
| 7. Actions | `.ek-col` | 80px | Icon buttons (✓ / ○ for mock, ⊘ for block) |

### 2.3 Row Styles (`.ek-table-row`)

```css
.ek-table-row {
  display: flex;
  align-items: center;
  padding: 8px 16px;
  border-bottom: 1px solid var(--border-subtle);
  cursor: pointer;
  transition: background 0.12s ease;
  min-height: 44px;
}

.ek-table-row:hover {
  background: var(--surface-hover);
}

.ek-table-row.selected {
  background: var(--amber-dim);
  border-left: 3px solid var(--amber);
  padding-left: 13px;
}

.ek-table-row .ek-col {
  padding: 0 8px;
  font-size: 13px;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```text

### 2.4 Method Badge (`.ek-method-badge`)

**DevTools uses a different class than popup:**

```css
.ek-method-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.3px;
  font-family: var(--font-mono);
  background: var(--surface-3);
  color: var(--text-muted);
}

.ek-method-badge.ek-method-get { background: var(--blue-dim); color: var(--blue); }
.ek-method-badge.ek-method-post { background: var(--emerald-dim); color: var(--emerald); }
.ek-method-badge.ek-method-put { background: var(--amber-dim); color: var(--amber); }
.ek-method-badge.ek-method-patch { background: var(--amber-dim); color: var(--amber-light); }
.ek-method-badge.ek-method-delete { background: var(--red-dim); color: var(--red); }
```html

**Mock Indicator Badge** (appears next to method when `mockEnabled`):
```html
<span class="ek-mock-badge" title="Mock enabled">⚡</span>
```text
```css
.ek-mock-badge {
  margin-left: 4px;
  font-size: 12px;
  color: var(--amber);
  filter: drop-shadow(0 0 2px var(--amber-glow));
}
```text

### 2.5 Status Display (INLINE STYLES, NOT BADGE)

**❗ KEY DIFFERENCE: DevTools uses inline styles, not CSS classes**

```javascript
const st = i.overrideStatus ?? i.responseStatus;
const stColor = st >= 500 ? 'var(--red)' : st >= 400 ? 'var(--amber)' : 'var(--emerald)';

// Rendered as:
<div class="ek-col" style="width:80px;color:${stColor}">
  ${st ?? '—'}
</div>
```text

**This is a MAJOR difference from popup!**

### 2.6 Icon Buttons (`.ek-icon-btn`)

**DevTools uses square icon buttons, not toggle switches:**

```css
.ek-icon-btn {
  width: 28px;
  height: 28px;
  border-radius: 4px;
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.15s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
}

.ek-icon-btn:hover {
  background: var(--surface-hover);
  border-color: var(--border-strong);
  color: var(--text-secondary);
}

.ek-icon-btn.on {
  background: var(--amber-dim);
  border-color: var(--amber);
  color: var(--amber);
}
```text

**Mock button content:**
- OFF: `○` (empty circle)
- ON: `✓` (checkmark)

**Block button content:**
- Both states: `⊘` (prohibition symbol)

### 2.7 Duration & Timestamp Columns

**Duration:**
```javascript
${i.durationMs ? i.durationMs + 'ms' : '—'}
```text

**Timestamp:**
```javascript
function formatTimestamp(ts) {
  const now = Date.now();
  const diff = now - ts;
  if (diff < 60_000) return Math.floor(diff / 1000) + 's ago';
  if (diff < 3600_000) return Math.floor(diff / 60_000) + 'm ago';
  if (diff < 86400_000) return Math.floor(diff / 3600_000) + 'h ago';
  return Math.floor(diff / 86400_000) + 'd ago';
}
```text

---

## 3. Key Differences Between Modes

### 3.1 Structural Differences

| Aspect | Popup | DevTools |
|--------|-------|----------|
| **Row class** | `.ek-row` | `.ek-table-row` |
| **Active class** | `.active` | `.selected` |
| **Layout** | Grouped by domain | Flat table |
| **Grouping** | Yes (sticky headers) | No |
| **Sorting** | No | Yes (sortable columns) |
| **Gap** | 12px (var(--space-md)) | 0 (cols have padding) |
| **Padding** | 12px 16px | 8px 16px |
| **Border-left on active** | 2px | 3px |
| **Min height** | auto | 44px |

### 3.2 Method Badge Differences

| Aspect | Popup (`.ek-method`) | DevTools (`.ek-method-badge`) |
|--------|----------------------|-------------------------------|
| **Class strategy** | Direct class (.GET, .POST) | Modifier class (.ek-method-get) |
| **Padding** | 3px 8px | 2px 6px |
| **Min width** | 48px | none |
| **Border** | 1px solid | none |
| **Letter spacing** | 0.03em | 0.3px |

### 3.3 Status Rendering Differences

| Aspect | Popup | DevTools |
|--------|-------|----------|
| **Rendering** | Badge with CSS class | Inline color style |
| **Class approach** | `.ek-status.s2`, `.s4`, etc. | No status class |
| **Color logic** | CSS classes | JavaScript ternary |
| **Border** | Yes (1px solid) | No |
| **Background** | Yes (colored dim) | No |
| **Padding** | 3px 7px | 0 8px (column padding) |

**Popup:**
```html
<span class="ek-status s2">200</span>
```html

**DevTools:**
```html
<div class="ek-col" style="width:80px;color:var(--emerald)">200</div>
```text

### 3.4 Action Button Differences

| Aspect | Popup | DevTools |
|--------|-------|----------|
| **Mock button class** | `.ek-mock-toggle` | `.ek-icon-btn` |
| **Mock button style** | iOS toggle switch | Square icon button |
| **Mock button size** | 30px × 16px | 28px × 28px |
| **Mock indicator** | Background + slide | Content: ○ / ✓ |
| **Block button class** | `.ek-block-btn` | `.ek-icon-btn` |
| **Badges next to method** | Separate spans | Mock badge only (⚡) |

### 3.5 Badge Position Differences

**Popup:** Badges appear AFTER the URL:
```
[METHOD] [URL------] [MODE?] [CONFLICT?] [SOURCE?] [STATUS] [TOGGLE] [BLOCK]
```text

**DevTools:** Mock badge appears NEXT TO method:
```
[METHOD ⚡?] [URL------] [STATUS] [DURATION] [TIMESTAMP] [SOURCE?] [BUTTONS]
```text

### 3.6 Columns Unique to DevTools

- **Duration** - Not shown in popup
- **Timestamp** - Not shown in popup
- **Sortable headers** - Not in popup

### 3.7 Features Unique to Popup

- **Domain grouping** - Not in DevTools
- **Mode badge** - Not shown in DevTools (no `renderInteractionRow` includes it)
- **Conflict badge** - Not shown in DevTools (no `renderInteractionRow` includes it)

---

## 4. CSS Variables Used

### 4.1 Spacing

```css
--space-sm: 8px
--space-md: 12px
--space-lg: 16px
```text

### 4.2 Colors

```css
--bg: Background
--surface: Elevated surface
--surface-2: More elevated
--surface-hover: Hover state
--amber-dim: Amber translucent background
--amber: Amber solid
--emerald, --blue, --red: Status colors
--text-muted, --text-secondary: Text shades
--border, --border-strong, --border-subtle: Border shades
```text

### 4.3 Typography

```css
--font-mono: Monospace font
--fw-bold: 700
--fw-semibold: 600
```text

### 4.4 Timing

```css
--transition-fast: 120ms ease
```text

---

## 5. Data-TestID Attributes

### 5.1 Popup Mode

- `data-testid="domain-group"` - Domain header
- `data-testid="api-row"` - Interaction row
- `data-testid="mock-toggle"` - Mock button
- `data-testid="block-btn"` - Block button

### 5.2 DevTools Mode

- `data-testid="list-header"` - Table header
- `data-testid="interaction-row"` - Table row
- `data-testid="mock-toggle"` - Mock button
- `data-testid="block-btn"` - Block button

---

## 6. Conclusion & Impact Analysis

### 6.1 Root Causes of Duplication

1. **Two complete rendering functions** - `renderRow()` and `renderInteractionRow()`
2. **Different CSS class systems** - `.ek-row` vs `.ek-table-row`, `.ek-method` vs `.ek-method-badge`
3. **Different badge strategies** - CSS classes vs inline styles for status
4. **Different button styles** - Toggle vs icon buttons

### 6.2 Maintenance Impact

- **Adding a column**: Must update 2 functions + 2 CSS rulesets
- **Changing a badge**: Must update 2 rendering paths
- **Styling drift**: Inevitable as changes are made independently

### 6.3 Refactoring Goals

✅ **Single source of truth** for column definitions
✅ **Reusable cell renderers** that work in both layouts
✅ **Layout-agnostic core** with mode-specific adaptors
✅ **Zero CSS changes** - preserve existing classes
✅ **Zero visual changes** - pixel-perfect preservation

---

**Phase 0.1 Complete ✅**

Next: Phase 0.2 - Behavioral Inventory
