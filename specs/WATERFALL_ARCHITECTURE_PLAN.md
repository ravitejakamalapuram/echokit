# Waterfall Mode Architecture - Match Chrome Network Tab

> **Mission**: Make EchoKit waterfall so good that developers prefer it over Chrome Network tab  
> **Approach**: Apply same single-source architecture pattern from UI refactor

---

## 🎯 Design Principles

1. **Single Source of Truth** - All timing logic in helpers
2. **Componentized** - Reusable renderer functions
3. **Chrome Parity** - Match native Network tab features
4. **EchoKit Advantages** - Add mock integration & replay

---

## 🏗️ Architecture Layers

### **Layer 1: Timing Helpers** (`interaction-helpers.js`)

New functions to add:

```javascript
// Timing calculations
export function calculateTimingPhases(interaction) {
  // Parse timing data, return phases object
}

export function getTotalDuration(interaction) {
  // Get total request duration
}

export function getTimingColor(phase) {
  // Return color for timing phase (TTFB, Download, etc.)
}

export function formatBytes(bytes) {
  // Format size (1.2 KB, 3.4 MB)
}

export function formatTimingTooltip(interaction) {
  // Generate timing breakdown HTML for tooltip
}
```

### **Layer 2: Waterfall Renderer** (`waterfall-renderer.js`)

NEW FILE - Componentized waterfall rendering:

```javascript
/**
 * Render waterfall timeline bars with timing phases
 */
export function renderWaterfallBars(interactions, options = {}) {
  // Calculate timeline scale
  // Render each bar with timing phases
  // Add hover tooltips
}

/**
 * Render waterfall header with time markers
 */
export function renderWaterfallHeader(timeScale) {
  // Grid lines
  // Time markers (0ms, 100ms, 200ms, etc.)
}

/**
 * Render single waterfall row
 */
export function renderWaterfallRow(interaction, timeScale) {
  // Method badge
  // Path
  // Status
  // Timing bar with phases
  // Tooltips
}
```

### **Layer 3: Waterfall Layout** (`waterfall-layout.js`)

NEW FILE - Event handling & state:

```javascript
export class WaterfallLayout {
  constructor(container) {
    this.container = container;
    this.interactions = [];
    this.timeScale = null;
    this.zoomLevel = 1.0;
  }
  
  setInteractions(interactions) {
    // Update data & re-render
  }
  
  setZoom(level) {
    // Zoom timeline in/out
  }
  
  exportHAR() {
    // Export as HAR file
  }
  
  copyAsCurl(interaction) {
    // Copy request as cURL command
  }
}
```

### **Layer 4: Integration** (`app.js`)

Modify existing waterfall toggle to use new system:

```javascript
// Replace: renderWaterfall(list)
// With: waterfallLayout.render(list)
```

---

## 📊 Data Enrichment Strategy

Current interaction object:
```javascript
{
  id, url, method, responseStatus, durationMs, timestamp, hash, ...
}
```

Need to ADD (from Performance API):

```javascript
{
  timing: {
    queueing: 0,
    dns: 0,
    connect: 0,
    ssl: 0,
    send: 0,
    wait: 0,        // TTFB
    receive: 0      // Download
  },
  size: {
    headers: 0,
    body: 0,
    total: 0
  },
  type: 'xhr',      // fetch, xhr, script, etc.
  initiator: null   // Optional: what triggered this
}
```

**Where to get this**:
- `performance.getEntriesByType('resource')`
- Match by URL & timestamp
- Fallback to `durationMs` if no perf entry

---

## 🎨 Visual Enhancements

### **Timing Phase Colors** (Chrome-inspired)

- Queueing: `#e4e4e7` (light gray)
- DNS: `#10b981` (emerald)
- Connect: `#f59e0b` (amber)
- SSL: `#a78bfa` (purple)
- Send: `#60a5fa` (blue)
- Wait (TTFB): `#34d399` (green) ← Most important
- Receive: `#3b82f6` (blue) ← Most important

### **Tooltip Design**

```text
┌─────────────────────────────────┐
│ GET /api/users                  │
│ Status: 200                     │
│ ─────────────────────────────── │
│ Queueing:        0.5 ms         │
│ DNS Lookup:      2.1 ms         │
│ Initial Conn:    15.3 ms        │
│ SSL:             8.2 ms         │
│ Request Sent:    0.3 ms         │
│ Waiting (TTFB):  42.1 ms  ★     │
│ Content Down:    18.5 ms  ★     │
│ ─────────────────────────────── │
│ Total:           87.0 ms        │
│ Size:            2.3 KB         │
└─────────────────────────────────┘
```

### **Grid Lines & Markers**

```text
0ms     100ms    200ms    300ms    400ms    500ms
│        │        │        │        │        │
├────────┼────────┼────────┼────────┼────────┤
[==TTFB==][Download]                          GET /fast
         [====TTFB=====][==Download==]        POST /slow
```

---

## 🚀 Implementation Plan

### **Phase 1: Foundation** (Today)
- ✅ Analyze Chrome Network tab
- ✅ Design architecture
- ⏳ Add timing helpers to `interaction-helpers.js`
- ⏳ Create `waterfall-renderer.js`
- ⏳ Test timing calculations

### **Phase 2: Visual** (Next)
- Create `waterfall-layout.js`
- Implement timing phase bars
- Add hover tooltips
- Add grid lines & time markers

### **Phase 3: Polish** (Final)
- Copy as cURL
- HAR export
- Timeline zoom
- Performance optimizations

---

## 💪 EchoKit Advantages Over Chrome

**Chrome Network Tab Limitations**:
- Can't modify responses
- Can't replay requests
- Clears on page reload
- No mock integration

**EchoKit Will Have**:
- ✅ Mock toggle from waterfall
- ✅ Edit responses inline
- ✅ Persistent across reloads
- ✅ Replay recorded sequences
- ✅ Professional timing visualization (Chrome parity)

**Result**: Best of both worlds!

---

**Next**: Start implementing timing helpers & waterfall renderer.
