# Phase 4 Integration Plan
## Integrating New Components into app.js

> **Strategy**: Incremental, non-breaking migration
> **Goal**: Replace duplicate rendering logic with componentized system

---

## Current State Analysis

### Existing Functions in app.js

1. **`filteredInteractions()`** (line 2893)
   - Applies method filter
   - Applies status filter
   - Applies URL search
   - Returns filtered array

2. **`renderListView(interactions, isPopup)`** (line 1283)
   - Routes to grouped list (popup) or table (DevTools)
   - Calls `groupByDomain()` for popup
   - Calls `renderSortableTable()` for DevTools

3. **`renderSortableTable(interactions)`** (line 1299)
   - Renders DevTools table with header
   - Calls `renderInteractionRow()` for each

4. **`render()`** (line 235)
   - Main render function
   - Calls `renderListView()`
   - Binds events via `bindEvents()`

---

## Integration Strategy

### Step 1: Add Imports (Non-breaking)

Add at top of app.js:
```javascript
import { createLayout } from './layouts.js';
```

### Step 2: Initialize Layout Instance (Non-breaking)

Add after state declaration:
```javascript
let layoutInstance = null;
```

### Step 3: Create Wrapper Function (Non-breaking)

Add new function that uses our components:
```javascript
function renderWithLayout() {
  const container = root.querySelector('[data-testid="api-list"]');
  if (!container) return;
  
  if (!layoutInstance) {
    layoutInstance = createLayout(container, state.mode);
    
    // Wire up events
    container.addEventListener('interaction-selected', (e) => {
      state.selectedId = e.detail.id;
      renderDetail(); // Existing function
    });
    
    container.addEventListener('mock-toggled', (e) => {
      // Call existing mock toggle logic
    });
    
    container.addEventListener('interaction-action', (e) => {
      if (e.detail.action === 'edit') {
        // Call existing edit logic
      } else if (e.detail.action === 'delete') {
        // Call existing delete logic
      }
    });
  }
  
  // Update layout with current data
  const filtered = filteredInteractions(); // Keep existing filter logic
  layoutInstance.setInteractions(filtered);
  layoutInstance.setSearchTerm(state.search);
  
  if (state.mode === 'devtools') {
    layoutInstance.setSorting(state.sortBy, state.sortOrder);
  }
}
```

### Step 4: Gradual Migration in render()

Option A - Side-by-side (safest):
```javascript
function render() {
  // ... existing header/toolbar rendering ...
  
  if (USE_NEW_RENDERER) {
    renderWithLayout();
  } else {
    // Original logic
    renderListView(list, isPopup);
  }
}
```

Option B - Direct replacement:
```javascript
function render() {
  applyTheme();
  const snapshot = snapshotUIState();
  
  root.innerHTML = `
    <div class="ek-app">
      ${renderHeader()}
      ${renderToolbar()}
      <div class="ek-main">
        <div class="ek-list" data-testid="api-list"></div>
        ...
      </div>
    </div>
  `;
  
  // Use new layout system
  renderWithLayout();
  
  restoreUIState(snapshot);
}
```

---

## Challenges & Solutions

### Challenge 1: Full Page Re-render

**Current**: `render()` wipes `root.innerHTML` entirely

**Problem**: Layout instance gets destroyed

**Solution**: Either:
- A) Don't wipe the list container, only re-render it
- B) Recreate layout instance after innerHTML wipe
- C) Move to partial DOM updates (Phase 5)

**Recommended**: Option B for Phase 4

---

### Challenge 2: Event Binding

**Current**: `bindEvents()` binds all events after render

**New**: Layout classes handle their own events

**Solution**: Layout events are internal, parent listens to custom events

---

### Challenge 3: State Sync

**Current**: State scattered across `state` object

**New**: Layout has internal state

**Solution**: Layout state is derived from global state

```javascript
layoutInstance.setInteractions(filteredInteractions());
layoutInstance.setSearchTerm(state.search);
layoutInstance.setSorting(state.sortBy, state.sortOrder);
```

---

## Implementation Steps

1. ✅ Phase 0.9: Helper functions
2. ✅ Phase 1: Column configuration
3. ✅ Phase 2: Core rendering
4. ✅ Phase 3: Layout adaptors
5. ⏳ **Phase 4: Integration** (current)
   - [ ] 4.1: Add imports
   - [ ] 4.2: Create layout wrapper function
   - [ ] 4.3: Wire up events
   - [ ] 4.4: Test in popup mode
   - [ ] 4.5: Test in DevTools mode
   - [ ] 4.6: Feature parity check

---

## Testing Checklist

Before marking Phase 4 complete:

- [ ] Popup renders correctly
- [ ] DevTools renders correctly
- [ ] Row selection works
- [ ] Mock toggle works (popup)
- [ ] Edit/delete buttons work (DevTools)
- [ ] Sorting works (DevTools)
- [ ] Search filtering works
- [ ] Domain grouping works (popup)
- [ ] No console errors
- [ ] No visual regressions

---

## Rollback Plan

If issues arise:

1. Comment out new code
2. Restore original `renderListView()` call
3. Remove layout imports
4. Git revert if needed

---

**Phase 4 is a CRITICAL integration step. Proceed carefully!**
