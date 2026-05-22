# UI Reconciliation Strategy
## Making It IMPOSSIBLE to Make Mistakes

> **Problem**: Two rendering paths = inevitable drift and bugs  
> **Solution**: Force 100% unification through a single configuration object

---

## Critical Analysis

### Current State: Why Mistakes Are INEVITABLE

```javascript
// POPUP renders status as a BADGE with CSS class:
<span class="ek-status s2">200</span>

// DEVTOOLS renders status as INLINE COLOR:
<div class="ek-col" style="color:var(--emerald)">200</div>
```

**This CANNOT be the same source of truth!** They're fundamentally different:
- Popup = badge with background, border, padding
- DevTools = plain text with color

### The Only Solution: **NORMALIZE TO DEVTOOLS APPROACH**

**Why?**
1. DevTools approach is simpler (no badge overhead)
2. Easier to make responsive
3. Less CSS to maintain
4. **BUT** - we must ensure visual IDENTITY is preserved

---

## Reconciliation Plan: Make Them IDENTICAL

### Option A: **Normalize Popup to Match DevTools** ⭐ RECOMMENDED

**Change popup status from badge to colored text:**

```javascript
// BEFORE (popup):
<span class="ek-status s2">200</span>  // Badge with background

// AFTER (popup - unified):
<span style="color:var(--emerald)">200</span>  // Same as DevTools
```

**Pros:**
- ✅ Single source of truth for status rendering
- ✅ Identical logic in both modes
- ✅ Less CSS to maintain
- ✅ Future changes apply everywhere automatically

**Cons:**
- ⚠️ Visual change in popup (badge → plain text)
- ⚠️ User might notice the difference

**Mitigation:**
- Keep the exact same color palette
- Add subtle styling to make it still look good
- Test with users before deploying

---

### Option B: **Normalize DevTools to Match Popup**

**Change DevTools status from inline color to badge:**

```javascript
// BEFORE (DevTools):
<div class="ek-col" style="color:var(--emerald)">200</div>

// AFTER (DevTools - unified):
<span class="ek-status s2">200</span>  // Same as popup
```

**Pros:**
- ✅ Single source of truth
- ✅ More visual emphasis on status

**Cons:**
- ⚠️ More CSS required
- ⚠️ Takes up more space in table
- ⚠️ May not fit well in narrow columns

---

### Option C: **Hybrid - Single Renderer with Mode Flag** ⭐⭐ BEST

**Create a unified status renderer that adapts:**

```javascript
function renderStatusCell(interaction, mode) {
  const status = interaction.overrideStatus ?? interaction.responseStatus;
  const color = getStatusColor(status); // Single source!
  
  if (mode === 'popup') {
    // Render as badge (preserves current popup UX)
    const cssClass = 's' + Math.floor(status / 100);
    return `<span class="ek-status ${cssClass}">${status}</span>`;
  } else {
    // Render as inline color (preserves current DevTools UX)
    return `<span style="color:${color}">${status ?? '—'}</span>`;
  }
}

function getStatusColor(status) {
  // SINGLE SOURCE OF TRUTH for color logic
  if (status >= 500) return 'var(--red)';
  if (status >= 400) return 'var(--amber)';
  return 'var(--emerald)';
}
```

**Pros:**
- ✅ ✅ ✅ Single function to maintain
- ✅ ✅ ✅ Zero visual changes (preserves both UX)
- ✅ ✅ ✅ Color logic defined ONCE
- ✅ ✅ ✅ Impossible to have divergent colors
- ✅ ✅ ✅ Easy to test

**Cons:**
- None! This is the perfect solution.

---

## Decision Matrix

| Aspect | Current (2 paths) | Option A (normalize to text) | Option B (normalize to badge) | **Option C (unified renderer)** |
|--------|-------------------|------------------------------|-------------------------------|--------------------------------|
| **Mistakes possible?** | ❌ YES (inevitable) | ✅ No | ✅ No | ✅✅ **No** |
| **Visual changes?** | N/A | ⚠️ Popup changes | ⚠️ DevTools changes | ✅✅ **None** |
| **Code to maintain** | 2 functions | 1 function | 1 function | ✅✅ **1 function** |
| **Single source of truth?** | ❌ No | ✅ Yes | ✅ Yes | ✅✅ **Yes** |
| **Easy to extend?** | ❌ No | ✅ Yes | ⚠️ More CSS | ✅✅ **Yes** |
| **Risk** | High | Medium | Medium | ✅✅ **Low** |

---

## Implementation: Option C Applied to ALL Cells

### Unified Cell Renderers

```javascript
// extension/shared/columns.js

export const INTERACTION_COLUMNS = {
  method: {
    key: 'method',
    label: 'Method',
    sortable: false,
    visible: { popup: true, devtools: true },
    render: (i, mode) => {
      const method = (i.method || 'GET').toUpperCase();
      
      if (mode === 'popup') {
        // Popup: uses .ek-method class
        return `<span class="ek-method ${method}">${method}</span>`;
      } else {
        // DevTools: uses .ek-method-badge class + mock indicator
        const mockBadge = i.mockEnabled 
          ? '<span class="ek-mock-badge" title="Mock enabled">⚡</span>' 
          : '';
        return `
          <span class="ek-method-badge ek-method-${method.toLowerCase()}">${method}</span>
          ${mockBadge}
        `;
      }
    }
  },
  
  status: {
    key: 'status',
    label: 'Status',
    sortable: true,
    visible: { popup: true, devtools: true },
    render: (i, mode) => {
      const status = i.overrideStatus ?? i.responseStatus;
      
      if (mode === 'popup') {
        // Popup: badge with CSS class
        const cssClass = 's' + Math.floor((status || 0) / 100);
        return `<span class="ek-status ${cssClass}">${status || 'ERR'}</span>`;
      } else {
        // DevTools: inline color
        const color = getStatusColor(status);
        return `<span style="color:${color}">${status ?? '—'}</span>`;
      }
    }
  },
  
  actions: {
    key: 'actions',
    label: 'Actions',
    sortable: false,
    visible: { popup: true, devtools: true },
    render: (i, mode) => {
      if (mode === 'popup') {
        // Popup: toggle + block button
        return `
          <button class="ek-mock-toggle ${i.mockEnabled ? 'on' : ''}" 
                  data-action="toggle-mock" 
                  data-id="${i.id}" 
                  title="${i.mockEnabled ? 'Mock ON' : 'Mock OFF'}" 
                  data-testid="mock-toggle"></button>
          <button class="ek-block-btn ${i.blocked ? 'on' : ''}" 
                  data-action="toggle-block" 
                  data-id="${i.id}" 
                  title="${i.blocked ? 'BLOCKED' : 'Block'}" 
                  data-testid="block-btn">⊘</button>
        `;
      } else {
        // DevTools: icon buttons
        return `
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
        `;
      }
    }
  }
};

// SINGLE SOURCE OF TRUTH HELPER
function getStatusColor(status) {
  if (!status) return 'var(--text-muted)';
  if (status >= 500) return 'var(--red)';
  if (status >= 400) return 'var(--amber)';
  return 'var(--emerald)';
}
```

---

## The KEY Insight

**The renderers CAN be different HTML, but the LOGIC must be identical:**

1. **Color logic** → Defined ONCE in helper function
2. **Mock state** → Checked ONCE, rendered differently
3. **Visibility rules** → Defined ONCE in column config
4. **Data extraction** → Same logic, different wrapper

**This makes it IMPOSSIBLE to have:**
- ❌ Different status colors between modes
- ❌ Different mock state logic
- ❌ Missing columns in one mode
- ❌ Inconsistent badge behavior

---

## Next Steps

1. ✅ Accept that visual differences MUST exist (toggle vs icon buttons)
2. ✅ Create unified column config with mode-aware renderers
3. ✅ Extract ALL shared logic to helper functions
4. ✅ Test that both modes produce correct output
5. ✅ Document which differences are INTENTIONAL vs accidental

**Recommendation**: Proceed with **Option C** - it preserves UX while making mistakes impossible.
