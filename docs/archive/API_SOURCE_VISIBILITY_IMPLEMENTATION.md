# API Source Visibility - Implementation Summary

**Branch:** `feature/api-source-visibility`  
**Date:** 2026-05-10  
**Status:** ✅ Complete - Ready for Testing

---

## 🎯 Problem Statement

Users asked: **"If we keep scope global, won't it be difficult for devs to know which API is called in which tab?"**

**Initial proposal:** Per-API scope override (let each API have its own tab/domain visibility)

**Final decision:** Keep global scope system, add **visibility features** instead:
- Visual badges showing API source
- Filters to focus on relevant APIs  
- Clickable badges to switch to source tab

---

## 🏗️ Architecture Decision

### ❌ Rejected: Per-API Scope Override
**Why rejected:**
1. **Cognitive load:** Two scope systems (global + per-API) would confuse users
2. **Orphaned state:** If source tab closes, per-API scope becomes meaningless
3. **Complexity:** Managing per-API state adds 200+ LOC with minimal value

### ✅ Accepted: Global Scope + Source Visibility
**Why accepted:**
1. **Separation of concerns:** Scope controls *when* APIs fire, badges show *where* they came from
2. **Progressive disclosure:** Simple by default, powerful when needed
3. **Elegant data model:** Recording captures source once, scope filters at runtime

---

## 📊 Implementation Details

### Backend Changes (`extension/background.js`)

#### 1. Add `getTabInfo()` Helper
```javascript
async function getTabInfo(tabId) {
  if (tabId === null) return { exists: false, title: 'Imported', url: '' };
  try {
    const tab = await chrome.tabs.get(tabId);
    return { exists: true, title: tab.title || 'Untitled', url: tab.url || '' };
  } catch {
    return { exists: false, title: `Tab #${tabId}`, url: '' };
  }
}
```

#### 2. Enrich `echokit:getState` Response
```javascript
const enriched = await Promise.all(all.filter(i => visibleInContext(i, ctx)).map(async (i) => {
  const tabInfo = await getTabInfo(i.tabId);
  return {
    ...i,
    sourceTabExists: tabInfo.exists,
    sourceTabTitle: tabInfo.title,
    sourceTabUrl: tabInfo.url
  };
}));
```

**New fields:**
- `sourceTabExists` (boolean): Is the source tab still open?
- `sourceTabTitle` (string): Tab title or fallback
- `sourceTabUrl` (string): Source tab URL

---

### Frontend Changes (`extension/shared/app.js`)

#### 1. Source Classification
```javascript
function classifySource(interaction, currentTabId) {
  if (interaction.tabId === null) return 'imported';
  if (interaction.tabId === currentTabId) return 'this-tab';
  if (!interaction.sourceTabExists) return 'closed-tab';
  return 'other-tab';
}
```

#### 2. Badge Rendering
```javascript
function renderSourceBadge(interaction, currentTabId) {
  const source = classifySource(interaction, currentTabId);
  // Returns HTML with color-coded badge + optional click handler
}
```

**Badge variants:**
- `this-tab`: Green ✓, non-clickable
- `other-tab`: Blue →, clickable (switches to tab)
- `closed-tab`: Gray ✗, non-clickable
- `imported`: Amber ↓, non-clickable

#### 3. Source Filters (DevTools Only)
```javascript
state.filters.sources = {
  thisTab: true,       // Show current tab APIs
  otherTabs: true,     // Show other open tabs
  closedTabs: false,   // Hide closed tab APIs (default)
  imported: true       // Show imported APIs
};
```

#### 4. Event Handlers
```javascript
// Click badge to switch to source tab
el.addEventListener('click', async (e) => {
  const tabId = parseInt(el.getAttribute('data-tab-id'), 10);
  await chrome.tabs.update(tabId, { active: true });
});

// Filter toggle
el.addEventListener('change', (e) => {
  const source = el.getAttribute('data-source');
  state.filters.sources[source] = e.target.checked;
  softRenderList();
});
```

---

### UI Changes (`extension/shared/styles.css`)

Added `.ek-source-badge` with four color-coded variants:

```css
.ek-source-badge.this-tab {
  background: rgba(16, 185, 129, 0.12);
  border-color: var(--emerald);
  color: var(--emerald);
}

.ek-source-badge.other-tab {
  background: rgba(96, 165, 250, 0.12);
  border-color: var(--blue);
  color: var(--blue);
}

.ek-source-badge.other-tab:hover {
  /* Hover effect for clickable badges */
}
```

---

## ✅ Feature Summary

| Feature | Popup | DevTools | Notes |
|---------|-------|----------|-------|
| Source badges | ✅ | ✅ | Color-coded, shows origin |
| Clickable badges | ❌ | ✅ | Switch to source tab |
| Source filters | ❌ | ✅ | Advanced filter panel |
| Default behavior | — | Hide closed tabs | Reduces noise |

---

## 🧪 Testing

**Manual test plan:** `tests/test-source-visibility.md`

**Key scenarios:**
1. Badge display (current tab, other tab, closed tab, imported)
2. Click-to-switch functionality
3. Source filter toggles
4. Scope interaction (tab/domain/global)
5. Performance with 100+ APIs
6. Regression: existing features still work

---

## 📝 Files Modified

```
extension/background.js     (+45 lines)  - getTabInfo, enriched state
extension/shared/app.js     (+167 lines) - badges, filters, handlers
extension/shared/styles.css (+55 lines)  - badge styling
tests/test-source-visibility.md (new)   - test plan
```

**Total:** +267 lines, 0 breaking changes

---

## 🚀 Next Steps

1. **Load extension in Chrome** → Test manually with test plan
2. **Run regression tests** → Verify no breakage
3. **Merge to main** → After testing passes
4. **Deploy** → Increment version, publish to Chrome Web Store

---

## 💡 Design Principles Applied

✅ **Progressive disclosure:** Simple by default, advanced in DevTools  
✅ **Visual clarity:** Color-coded badges with icons  
✅ **Affordance:** Clickable badges have hover states  
✅ **Sensible defaults:** Hide closed-tab noise  
✅ **Backward compat:** No breaking changes  

**Result:** Elegant solution that solves "which tab?" problem without adding complexity to scope system.
