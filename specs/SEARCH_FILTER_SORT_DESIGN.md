# Advanced Search, Filter & Sort Design

## Product Requirements (PRD)

### User Stories
1. **As a developer**, I want to search recorded APIs by URL, method, status code, request body, and response body so I can quickly find specific API calls
2. **As a developer**, I want to filter recorded APIs using the same criteria so I can narrow down large sets of recordings
3. **As a developer**, I want to sort recorded APIs by various attributes so I can analyze patterns and prioritize my work

### Success Metrics
- Users can find any API interaction within 3 seconds
- Advanced filters reduce visible results by 80%+ when needed
- Sort functionality provides clear visual feedback

---

## Current State Analysis

### Existing Infrastructure
**Data Model** (from `extension/background.js:318-339`):
```javascript
{
  id, hash, matchKeys, matchMode,
  url, method,                          // ✅ Already filterable
  requestHeaders, requestBody,          // 🆕 Need search capability
  responseStatus,                       // ✅ Already filterable
  responseHeaders, responseBody,        // 🆕 Need search capability
  timestamp, tabId, sessionId,
  tabUrl, host,
  mockEnabled, mockLatency, mockErrorMode,
  overrideStatus, overrideBody, overrideHeaders,
  activeVersionId, notes, gqlOperation,
  durationMs, blocked, wsLoop,
  mockMaxCount, mockCallCount
}
```

**Current IndexedDB Indexes** (from `extension/shared/store.js:15-19`):
```javascript
- hash (non-unique)
- tabId (non-unique)
- sessionId (non-unique)
- timestamp (non-unique)
```

**Current Filtering** (from `extension/shared/app.js:1606-1618`):
- Simple URL substring search
- Method filter (GET/POST/PUT/PATCH/DELETE)
- Status code bucket filter (2xx, 3xx, 4xx, 5xx, failed)
- Sort: timestamp DESC only

**UI State** (from `extension/shared/app.js:8-27`):
```javascript
search: '',           // Current: URL substring only
methodFilter: null,   // Current: single method
statusFilter: null,   // Current: status bucket
```

---

## Design Specification

### 1. Search Capabilities

#### 1.1 Enhanced Search Query Parser
**Approach**: Support Google-style advanced search syntax

**Examples**:
```
url:/api/users                    // URL contains
method:POST                        // Exact method match
status:404                         // Exact status
status:4xx                         // Status range
request:"userId"                   // Request body contains
response:"error"                   // Response body contains
request.header:authorization       // Request header exists
response.header:content-type:json  // Response header value contains
```

**Implementation Strategy**:
- Add `parseSearchQuery(query)` function to extract search tokens
- Support both simple (current) and advanced syntax
- Graceful fallback: if no prefix, search URL only (backward compatible)

#### 1.2 Full-Text Search Fields
**Searchable Fields**:
- ✅ `url` (already implemented)
- 🆕 `method` (exact or starts-with match)
- 🆕 `responseStatus` (exact or range match)
- 🆕 `requestBody` (JSON path or substring)
- 🆕 `responseBody` (JSON path or substring)
- 🆕 `requestHeaders.*` (header name or value)
- 🆕 `responseHeaders.*` (header name or value)
- 🆕 `notes` (substring match)
- 🆕 `gqlOperation` (GraphQL operation name)

**Performance Consideration**:
- Body search is expensive (not indexed in IndexedDB)
- Solution: Search in-memory after loading (acceptable for <1000 interactions)
- Future: Add FTS index if dataset grows beyond 5000 interactions

---

### 2. Filter UI/UX Design

#### 2.1 Filter Panel Enhancement
**Current UI** (Toolbar):
```
[Search Input] [GET] [POST] [PUT] [PATCH] [DELETE] [Status Dropdown ▼]
```

**Proposed UI** (Expandable Advanced Filters):
```
[Search Input] [🔍 Advanced Filters ▼] [Clear All]

┌─ Advanced Filters Panel (Collapsible) ─────────────────────┐
│ Method:     [✓ GET] [✓ POST] [ PUT] [ PATCH] [ DELETE]    │
│ Status:     [✓ 2xx] [ 3xx] [✓ 4xx] [ 5xx] [ Failed]       │
│                                                             │
│ Request Body contains:  [___________________]               │
│ Response Body contains: [___________________]               │
│                                                             │
│ Request Header:  [Name: ______] [Value: ______]            │
│ Response Header: [Name: ______] [Value: ______]            │
│                                                             │
│ Timestamp Range:                                            │
│   From: [2026-05-01 00:00] To: [2026-05-07 23:59]          │
│                                                             │
│ [Apply Filters] [Reset]                                    │
└─────────────────────────────────────────────────────────────┘
```

#### 2.2 State Management
**New State Properties** (add to `extension/shared/app.js:state`):
```javascript
state = {
  // ... existing properties

  // Enhanced search/filter state
  advancedFilterOpen: false,

  filters: {
    // Multi-select instead of single
    methods: [],                    // ['GET', 'POST']
    statusCodes: [],                // ['2xx', '404', '5xx']

    // New filter types
    requestBodyContains: '',        // Substring match
    responseBodyContains: '',       // Substring match

    requestHeader: {
      name: '',
      value: ''
    },
    responseHeader: {
      name: '',
      value: ''
    },

    timestampRange: {
      from: null,                   // Date timestamp
      to: null                      // Date timestamp
    },

    // Additional filters
    mockEnabled: null,              // true | false | null (all)
    blocked: null,                  // true | false | null (all)
    hasNotes: null,                 // true | false | null (all)
  },

  // Sort configuration
  sortBy: 'timestamp',              // 'timestamp' | 'url' | 'method' | 'status' | 'duration'
  sortOrder: 'desc'                 // 'asc' | 'desc'
}
```

---

### 3. Sort Functionality

#### 3.1 Sortable Columns
**Priority Columns**:
1. ✅ **Timestamp** (default, DESC) - Most recent first
2. 🆕 **URL** (alphabetical) - Group similar endpoints
3. 🆕 **Method** - Organize by HTTP verb
4. 🆕 **Status** - Find errors/success patterns
5. 🆕 **Duration** - Performance analysis
6. 🆕 **Request Size** - Payload analysis
7. 🆕 **Response Size** - Payload analysis

#### 3.2 Sort UI Pattern
**List View Header** (clickable columns):
```
┌────────────────────────────────────────────────────────────┐
│ Method ▼ │ URL ▲ │ Status │ Duration │ Timestamp ▼        │
├────────────────────────────────────────────────────────────┤
│ GET      │ /api/users │ 200 │ 45ms │ 2 mins ago          │
│ POST     │ /api/auth  │ 401 │ 12ms │ 5 mins ago          │
└────────────────────────────────────────────────────────────┘
```

**Indicators**:
- ▲ = Ascending sort active
- ▼ = Descending sort active
- No arrow = Not sorted by this column

#### 3.3 Sort Implementation
```javascript
function sortInteractions(interactions, sortBy, sortOrder) {
  const sorted = [...interactions];

  const comparators = {
    timestamp: (a, b) => a.timestamp - b.timestamp,
    url: (a, b) => a.url.localeCompare(b.url),
    method: (a, b) => a.method.localeCompare(b.method),
    status: (a, b) => (a.responseStatus || 0) - (b.responseStatus || 0),
    duration: (a, b) => (a.durationMs || 0) - (b.durationMs || 0),
    requestSize: (a, b) => {
      const aSize = a.requestBody ? JSON.stringify(a.requestBody).length : 0;
      const bSize = b.requestBody ? JSON.stringify(b.requestBody).length : 0;
      return aSize - bSize;
    },
    responseSize: (a, b) => {
      const aSize = (a.responseBody || '').length;
      const bSize = (b.responseBody || '').length;
      return aSize - bSize;
    }
  };

  sorted.sort(comparators[sortBy] || comparators.timestamp);

  if (sortOrder === 'desc') {
    sorted.reverse();
  }

  return sorted;
}
```

---

### 4. Performance Optimization Strategy

#### 4.1 IndexedDB Index Additions
**New Indexes to Add** (in `extension/shared/store.js`):
```javascript
// Current: hash, tabId, sessionId, timestamp
// Add:
os.createIndex('method', 'method', { unique: false });
os.createIndex('responseStatus', 'responseStatus', { unique: false });
os.createIndex('mockEnabled', 'mockEnabled', { unique: false });
```

**Rationale**:
- Method & status are frequently filtered → Index for fast retrieval
- mockEnabled is a common filter → Index helps
- Body content is NOT indexed (too large, not needed for IndexedDB query)

#### 4.2 Client-Side Filtering Pipeline
```javascript
function filteredInteractions() {
  let results = state.interactions;

  // Phase 1: IndexedDB-backed filters (fast)
  // Already loaded via getAllInteractions(), now filter in-memory

  // Phase 2: Multi-select filters
  if (state.filters.methods.length > 0) {
    results = results.filter(i =>
      state.filters.methods.includes(i.method)
    );
  }

  if (state.filters.statusCodes.length > 0) {
    results = results.filter(i =>
      matchesStatusFilter(i.responseStatus, state.filters.statusCodes)
    );
  }

  // Phase 3: Body content search (expensive - run last)
  if (state.filters.requestBodyContains) {
    const q = state.filters.requestBodyContains.toLowerCase();
    results = results.filter(i => {
      const body = typeof i.requestBody === 'string'
        ? i.requestBody
        : JSON.stringify(i.requestBody || '');
      return body.toLowerCase().includes(q);
    });
  }

  // Phase 4: Sort
  results = sortInteractions(results, state.sortBy, state.sortOrder);

  return results;
}
```

#### 4.3 Debouncing & Virtualization
- **Search Input**: 300ms debounce (already at 80ms, increase for body search)
- **Filter Panel**: Apply on button click, not on every keystroke
- **Large Lists**: Consider virtual scrolling if >500 results shown

---

### 5. Implementation Phases

#### Phase 1: Enhanced Multi-Filter (Week 1)
**Scope**:
- ✅ Multi-select method filter (checkbox group)
- ✅ Multi-select status filter (checkbox group)
- ✅ Timestamp range filter
- ✅ mockEnabled/blocked boolean filters
- ✅ Update `filteredInteractions()` logic
- ✅ Add "Clear All Filters" button

**UI Changes**:
- Convert method chips to checkboxes (multi-select)
- Convert status dropdown to checkbox group
- Add collapsible "Advanced Filters" panel
- Show active filter count badge

**Files to Modify**:
- `extension/shared/app.js` (state + rendering + filtering logic)
- `extension/shared/style.css` (filter panel styles)

#### Phase 2: Body Content Search (Week 2)
**Scope**:
- 🆕 Request body substring search
- 🆕 Response body substring search
- 🆕 Request header name/value search
- 🆕 Response header name/value search
- 🆕 Advanced search query parser (optional, phase 2b)

**Performance**:
- Body search runs in-memory (no IndexedDB change)
- Add loading indicator for large datasets
- Consider web worker for body search if >1000 items

**Files to Modify**:
- `extension/shared/app.js` (search logic)
- Update `filteredInteractions()` function

#### Phase 3: Sort Functionality (Week 3)
**Scope**:
- 🆕 Sortable column headers
- 🆕 Sort by: timestamp, URL, method, status, duration, sizes
- 🆕 Toggle ASC/DESC order
- 🆕 Visual sort indicators (▲/▼)

**UI Changes**:
- Add clickable column headers in list view
- Show sort direction arrows
- Persist sort preference in state

**Files to Modify**:
- `extension/shared/app.js` (sort logic + UI)
- `extension/shared/style.css` (sortable header styles)

#### Phase 4: IndexedDB Optimization (Week 4 - Optional)
**Scope**:
- 🔧 Add method, responseStatus, mockEnabled indexes
- 🔧 Bump DB_VERSION to 2
- 🔧 Add migration logic for existing users
- 🔧 Update query functions to use indexes

**Files to Modify**:
- `extension/shared/store.js` (index definitions + migration)

---

### 6. User Experience Considerations

#### 6.1 Filter Discoverability
**Problem**: Users may not know advanced filters exist

**Solutions**:
1. **Filter Hint Icon**: Show `🔍 Advanced` button prominently in toolbar
2. **Active Filter Badge**: Display count of active filters (e.g., "Filters: 3 active")
3. **Filter Chips**: Show active filters as dismissible chips below toolbar
4. **Empty State**: When 0 results, suggest "Try adjusting filters"

#### 6.2 Filter Persistence
**Behavior**:
- ✅ Persist filters in session (not across extension reload)
- ✅ "Clear All" button resets to defaults
- ✅ Individual filter removal via chip close button

**State Storage**:
```javascript
// Don't persist in IndexedDB (too chatty)
// Use component state only
// Reset on page refresh (acceptable UX)
```

#### 6.3 Performance Feedback
**Loading States**:
```javascript
// Show loading overlay when filtering takes >200ms
if (bodySearchActive && interactions.length > 500) {
  showLoadingOverlay('Searching request/response bodies...');
}
```

**Result Count**:
```
Showing 15 of 247 interactions
[Clear Filters]
```

---

### 7. Testing Plan

#### 7.1 Unit Tests
**Filter Logic** (test cases):
```javascript
describe('filteredInteractions', () => {
  it('filters by single method', () => { ... });
  it('filters by multiple methods', () => { ... });
  it('filters by status code range (4xx)', () => { ... });
  it('filters by request body substring', () => { ... });
  it('filters by response body JSON path', () => { ... });
  it('filters by header name and value', () => { ... });
  it('combines multiple filters with AND logic', () => { ... });
  it('handles empty filter state', () => { ... });
});

describe('sortInteractions', () => {
  it('sorts by timestamp descending', () => { ... });
  it('sorts by URL alphabetically', () => { ... });
  it('sorts by status code ascending', () => { ... });
  it('sorts by duration (performance analysis)', () => { ... });
});
```

#### 7.2 Integration Tests
**Smoke Tests** (via Playwright):
1. Record 20 different API calls
2. Apply method filter → verify count
3. Apply status filter → verify count
4. Search request body → verify results
5. Search response body → verify results
6. Sort by each column → verify order
7. Combine filters → verify AND logic
8. Clear filters → verify reset

#### 7.3 Performance Tests
**Benchmarks**:
- Filter 1000 interactions by method: <50ms
- Filter 1000 interactions by body content: <500ms
- Sort 1000 interactions: <100ms
- Combined filter + sort: <600ms

---

### 8. Edge Cases & Error Handling

#### 8.1 Large Payloads
**Problem**: Searching 10MB response body freezes UI

**Solution**:
- Truncate search to first 100KB of body content
- Show warning: "⚠️ Large response body - search limited to first 100KB"

#### 8.2 Invalid JSON in Bodies
**Problem**: Body content may not be valid JSON

**Solution**:
- Graceful fallback: treat as string if JSON.parse fails
- Support both JSON and plain text search

#### 8.3 Special Characters in Search
**Problem**: User searches for regex special chars

**Solution**:
- Escape regex chars by default
- Add "Use Regex" checkbox for advanced users (phase 2b)

#### 8.4 No Results Found
**Problem**: User applies too many filters, gets 0 results

**Solution**:
```
┌─────────────────────────────────────┐
│  No interactions match your filters │
│                                     │
│  Active filters (3):                │
│  • Method: POST                     │
│  • Status: 4xx                      │
│  • Request body contains: "token"   │
│                                     │
│  [Remove Filters One by One]        │
│  [Clear All Filters]                │
└─────────────────────────────────────┘
```

---

### 9. Accessibility & Keyboard Navigation

#### 9.1 Keyboard Shortcuts
```
Ctrl/Cmd + F     → Focus search input
Ctrl/Cmd + K     → Toggle advanced filters
Esc              → Close advanced filters panel
Tab              → Navigate through filter fields
Enter            → Apply filters
Ctrl/Cmd + \     → Clear all filters
```

#### 9.2 Screen Reader Support
- Add ARIA labels to all filter inputs
- Announce filter results count change
- Add role="search" to search container

---

### 10. Migration & Rollout Strategy

#### 10.1 Backward Compatibility
**Data**: No schema changes to interaction objects (✅ safe)

**UI**: Graceful degradation
- Old search behavior: URL substring → still works
- New filters: Additive, optional

#### 10.2 Feature Flag
```javascript
const FEATURES = {
  advancedFilters: true,    // Enable for all users
  bodySearch: true,         // Enable for all users
  sortColumns: true,        // Enable for all users
  regexSearch: false        // Phase 2b - keep disabled
};
```

#### 10.3 User Communication
**Changelog Entry**:
```markdown
## v1.8.0 - Advanced Search & Filters

### ✨ New Features
- 🔍 **Advanced Filters**: Multi-select methods, status codes, and more
- 📝 **Body Search**: Search within request/response bodies
- 🏷️ **Header Filters**: Filter by request/response headers
- ⏱️ **Time Range**: Filter by timestamp range
- 🔄 **Sortable Columns**: Sort by URL, method, status, duration, etc.

### 🎯 Use Cases
- Find all failed POST requests from last hour
- Search for specific error messages in responses
- Analyze API performance by sorting by duration
- Filter mocked vs real API calls
```

---

## Summary & Next Steps

### What We're Building
A comprehensive search, filter, and sort system that transforms EchoKit from a simple API recorder into a powerful debugging and analysis tool.

### Key Decisions
1. ✅ **In-memory filtering** - No IndexedDB query changes needed (good for MVP)
2. ✅ **Progressive enhancement** - Backward compatible with current search
3. ✅ **Phase approach** - Ship value incrementally (3-4 week timeline)
4. ✅ **Performance-aware** - Debouncing, loading states, truncation for large data

### Success Criteria
- [ ] Users can filter 1000+ interactions in <500ms
- [ ] Advanced filters reduce cognitive load (fewer clicks to find APIs)
- [ ] Zero breaking changes to existing functionality
- [ ] Keyboard accessible (WCAG 2.1 AA compliant)

### Open Questions
1. Should we add saved filter presets? (e.g., "Failed APIs", "Slow Responses")
2. Do we need export filtered results to HAR/CSV?
3. Should sort preference persist across sessions?

---

## Appendix: API Reference

### New Functions (to be added to `extension/shared/app.js`)

```javascript
// Parse advanced search query
function parseSearchQuery(query) { ... }

// Enhanced filtering with all criteria
function filteredInteractions() { ... }

// Sort interactions by column
function sortInteractions(interactions, sortBy, sortOrder) { ... }

// Match status filter (handles ranges like "4xx")
function matchesStatusFilter(status, filters) { ... }

// Search within JSON bodies
function searchJSONBody(body, query) { ... }

// Search within headers
function searchHeaders(headers, name, value) { ... }
```

### State Schema Changes
```javascript
// Before
state = {
  search: '',
  methodFilter: null,    // Single value
  statusFilter: null     // Single value
}

// After
state = {
  search: '',            // Kept for backward compat
  advancedFilterOpen: false,
  filters: {
    methods: [],         // Multi-select
    statusCodes: [],     // Multi-select
    requestBodyContains: '',
    responseBodyContains: '',
    // ... (see section 2.2)
  },
  sortBy: 'timestamp',
  sortOrder: 'desc'
}
```

---

## UI Mockups

### Current UI (Before)

```
┌─────────────────────────────────────────────────────────────────┐
│ 🔴 REC  ⚡ MOCK                                    example.com  │
├─────────────────────────────────────────────────────────────────┤
│ [Search URL...                           ] [GET][POST][PUT]    │
│                                             [Status: all ▼]     │
├─────────────────────────────────────────────────────────────────┤
│ API List (15 interactions)                                      │
│ 📦 api.example.com                                              │
│   GET  /users           200  ⚡                                 │
│   POST /auth            401  ⚡                                 │
└─────────────────────────────────────────────────────────────────┘
```

Limitations: URL-only search, single method filter, no body search, no sorting.

### Proposed UI — Collapsed State

```
┌─────────────────────────────────────────────────────────────────┐
│ 🔴 REC  ⚡ MOCK                                    example.com  │
├─────────────────────────────────────────────────────────────────┤
│ [Search: url, method:POST, status:4xx ] [🔍 Advanced ▼] [Clear]│
├─────────────────────────────────────────────────────────────────┤
│ Filters: 3 active                                   Showing 4/15│
│ [× method:POST] [× status:4xx] [× request:"token"]              │
├─────────────────────────────────────────────────────────────────┤
│ ┌─────┬──────────────────┬────────┬──────────┬─────────────┐   │
│ │ ☑   │ URL ▼           │ Status │ Duration │ Time        │   │
│ ├─────┼──────────────────┼────────┼──────────┼─────────────┤   │
│ │ ⚡  │ POST /auth       │  401   │  12ms    │ 2 mins ago  │   │
│ └─────┴──────────────────┴────────┴──────────┴─────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Proposed UI — Expanded Advanced Filters

```
┌─────────────────────────────────────────────────────────────────┐
│ ┌─ Advanced Filters ────────────────────────────────────────┐   │
│ │ HTTP Method: [✓] GET  [✓] POST  [ ] PUT  [ ] PATCH  [ ] DELETE│
│ │ Status:      [✓] 2xx  [ ] 3xx  [✓] 4xx  [ ] 5xx  [ ] Failed │
│ │ Request contains:  [userId                             ]   │   │
│ │ Response contains: [error                              ]   │   │
│ │ Request Header:  [authorization  ] = [Bearer           ]   │   │
│ │ Time Range: From [2026-05-01] To [2026-05-07]              │   │
│ │ [ ] Mock enabled only  [ ] Blocked only  [ ] Has notes     │   │
│ │                              [Apply Filters] [Reset All]   │   │
│ └───────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Advanced Search Syntax Examples

| Query | Finds |
|-------|-------|
| `method:POST url:/auth status:401` | Failed POST auth attempts |
| `response:"User not found"` | Responses containing that string |
| `method:GET status:2xx header:cache-control` | Successful GETs with cache headers |
