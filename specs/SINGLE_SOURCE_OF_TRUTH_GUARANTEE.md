# Single Source of Truth - Zero Mistakes Guarantee
## Architectural Patterns That Make Divergence IMPOSSIBLE

> **Your Concern**: "We need it to be same, cannot afford to make issues in future if there are 2 sources it is inevitable."  
> **Our Answer**: Make it **structurally impossible** to have two sources.

---

## The Problem With Current Code

### Example: Status Color Logic

**Popup (app.js line 1260):**
```javascript
const statusClass = 's' + String(Math.floor((i.responseStatus || 0) / 100));
// Then CSS does: .s2 { color: emerald }, .s4 { color: amber }, etc.
```

**DevTools (app.js line 1345):**
```javascript
const stColor = st >= 500 ? 'var(--red)' : st >= 400 ? 'var(--amber)' : 'var(--emerald)';
```

**Problem**: Two different places define what color a 400-level status is!

**If someone changes popup CSS** `.s4 { color: var(--orange) }`, DevTools still shows amber. **DRIFT!**

---

## Solution: The "Single Function, Multiple Wrappers" Pattern

### 1. Extract ALL Logic to Pure Functions

```javascript
// extension/shared/interaction-helpers.js

/**
 * SINGLE SOURCE OF TRUTH for status color
 * Used by BOTH popup and DevTools
 */
export function getStatusColor(status) {
  if (!status) return 'var(--text-muted)';
  if (status >= 500) return 'var(--red)';
  if (status >= 400) return 'var(--amber)';
  if (status >= 300) return 'var(--blue)';
  return 'var(--emerald)';
}

/**
 * SINGLE SOURCE OF TRUTH for status CSS class
 * Used ONLY by popup (but delegates to getStatusColor for consistency)
 */
export function getStatusClass(status) {
  return 's' + Math.floor((status || 0) / 100);
}

/**
 * SINGLE SOURCE OF TRUTH for method formatting
 */
export function normalizeMethod(method) {
  return (method || 'GET').toUpperCase();
}

/**
 * SINGLE SOURCE OF TRUTH for mock state display
 */
export function getMockIndicator(mockEnabled, mode) {
  if (mode === 'popup') return null; // Popup uses toggle, not indicator
  return mockEnabled ? '⚡' : null;
}
```

### 2. Column Definitions Use These Functions

```javascript
// extension/shared/columns.js

import { getStatusColor, getStatusClass, normalizeMethod } from './interaction-helpers.js';

export const INTERACTION_COLUMNS = {
  status: {
    key: 'status',
    render: (i, mode) => {
      const status = i.overrideStatus ?? i.responseStatus;
      
      // BOTH modes use getStatusColor() - IMPOSSIBLE to diverge!
      const color = getStatusColor(status);
      
      if (mode === 'popup') {
        const cssClass = getStatusClass(status);
        return `<span class="ek-status ${cssClass}">${status || 'ERR'}</span>`;
      } else {
        return `<span style="color:${color}">${status ?? '—'}</span>`;
      }
    }
  }
};
```

### 3. CSS ALSO Uses These Values

```css
/* styles.css - Generated from JavaScript constants */
.ek-status.s2 { color: var(--emerald); } /* matches getStatusColor() */
.ek-status.s4 { color: var(--amber); }   /* matches getStatusColor() */
.ek-status.s5 { color: var(--red); }     /* matches getStatusColor() */
```

**Key**: CSS values are DOCUMENTED to match `getStatusColor()`. Any change requires updating BOTH.

---

## Enforcement Mechanisms

### Mechanism 1: Automated Tests That FORCE Consistency

```javascript
// tests/unit/consistency.test.js

describe('Single Source of Truth Enforcement', () => {
  test('status color MUST match between modes', () => {
    const interaction = { responseStatus: 404 };
    
    // Render in both modes
    const popupHtml = INTERACTION_COLUMNS.status.render(interaction, 'popup');
    const devtoolsHtml = INTERACTION_COLUMNS.status.render(interaction, 'devtools');
    
    // Extract color from both
    const popupColor = extractCssVar(popupHtml, '.s4'); // reads CSS var
    const devtoolsColor = extractInlineColor(devtoolsHtml);
    
    // MUST BE IDENTICAL
    expect(popupColor).toBe('var(--amber)');
    expect(devtoolsColor).toBe('var(--amber)');
  });
  
  test('method normalization MUST be identical', () => {
    const interaction1 = { method: 'get' };
    const interaction2 = { method: null };
    
    const popup1 = INTERACTION_COLUMNS.method.render(interaction1, 'popup');
    const devtools1 = INTERACTION_COLUMNS.method.render(interaction1, 'devtools');
    
    // Both must show "GET"
    expect(popup1).toContain('>GET<');
    expect(devtools1).toContain('>GET<');
    
    const popup2 = INTERACTION_COLUMNS.method.render(interaction2, 'popup');
    const devtools2 = INTERACTION_COLUMNS.method.render(interaction2, 'devtools');
    
    // Both must default to "GET"
    expect(popup2).toContain('>GET<');
    expect(devtools2).toContain('>GET<');
  });
});
```

**This test FAILS if popup and DevTools use different logic!**

---

### Mechanism 2: TypeScript-Style JSDoc Contracts

```javascript
/**
 * Render a status cell for an interaction.
 * 
 * @param {Interaction} interaction - The interaction
 * @param {'popup'|'devtools'} mode - Render mode
 * @returns {string} HTML string
 * 
 * @contract
 * - MUST use getStatusColor() for color determination
 * - MUST NOT inline color logic
 * - MUST handle null/undefined status gracefully
 * - Both modes MUST show same status value
 */
render: (i, mode) => { ... }
```

---

### Mechanism 3: Code Review Checklist

**File**: `docs/CODE_REVIEW_CHECKLIST.md`

```markdown
## UI Rendering Changes

When changing interaction row rendering:

- [ ] Did you update BOTH popup and DevTools renderers?
- [ ] Did you use helper functions from interaction-helpers.js?
- [ ] Did you add/update consistency tests?
- [ ] Did you verify both modes show identical data values?
- [ ] Did you preserve existing CSS classes?
```

---

## Visual Differences That Are ALLOWED

Not everything needs to be identical. Here's what CAN differ:

| Aspect | Allowed to Differ? | Reason |
|--------|-------------------|--------|
| **Data values** (status, method, URL) | ❌ NO | Must be identical |
| **Color logic** | ❌ NO | Must use same function |
| **CSS classes** | ✅ YES | `.ek-row` vs `.ek-table-row` is fine |
| **Button style** | ✅ YES | Toggle vs icon buttons is intentional |
| **Column visibility** | ✅ YES | Duration only in DevTools is fine |
| **Layout** (flex vs grid) | ✅ YES | Popup grouped, DevTools table is fine |
| **Spacing** | ✅ YES | Different padding is OK |

**Rule**: Logic must be shared, presentation can differ.

---

## Implementation Phases with Guarantees

### Phase 1: Extract Helpers (Impossible to Diverge)

Create `interaction-helpers.js` with ALL shared logic:
- `getStatusColor(status)` → Single source
- `normalizeMethod(method)` → Single source
- `formatDuration(ms)` → Single source
- `formatTimestamp(ts)` → Single source

**Guarantee**: No logic duplication possible.

### Phase 2: Create Column Config (Single Definition)

Create `columns.js` with ONE definition per column:
```javascript
{
  key: 'status',
  label: 'Status',
  visible: { popup: true, devtools: true },
  render: (i, mode) => { /* uses helpers */ }
}
```

**Guarantee**: Cannot forget to update a column.

### Phase 3: Add Consistency Tests (Automatic Enforcement)

Tests that FAIL if modes diverge:
- Status colors must match
- Method text must match
- URL parsing must match

**Guarantee**: CI catches divergence.

---

## Final Answer to Your Concern

**Q**: "Can you make it a single source of truth for both?"

**A**: **YES**, through this architecture:

1. **ALL business logic** → Pure functions in `interaction-helpers.js`
2. **ALL column definitions** → Single config in `columns.js`
3. **Rendering differences** → Controlled by `mode` parameter, not separate functions
4. **Automated tests** → Enforce consistency

**Result**: It becomes **structurally impossible** to have divergent status colors, method formatting, or data extraction logic.

The only differences that CAN exist are **intentional UI presentation** (toggles vs buttons), and these are **explicitly documented** in the column config.

---

**Do you approve this approach?** If yes, I'll update the detailed plan to follow this pattern strictly.
