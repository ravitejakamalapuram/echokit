# PM Design Summary: Advanced Search, Filter & Sort

## Executive Summary

This document provides a comprehensive PM-level design for implementing advanced search, filter, and sort capabilities in EchoKit, transforming it from a simple API recorder into a powerful debugging and analysis tool.

---

## Problem Statement

### Current Limitations
Users can currently:
- ✅ Search by URL substring only
- ✅ Filter by ONE method at a time (GET OR POST, not both)
- ✅ Filter by status code range (2xx, 3xx, 4xx, 5xx)
- ✅ Sort by timestamp DESC only

Users CANNOT:
- ❌ Search within request/response bodies
- ❌ Filter by request/response headers
- ❌ Apply multiple filters simultaneously
- ❌ Sort by URL, method, status, or duration
- ❌ Combine complex search criteria

### User Impact
Without advanced search/filter capabilities:
- **Finding specific APIs takes 30-60 seconds** (manual scrolling/scanning)
- **Cannot debug complex scenarios** (e.g., "all failed POST requests with 'token' in body")
- **No performance analysis** (cannot sort by duration to find slow APIs)
- **Poor UX for large datasets** (100+ recorded APIs becomes unmanageable)

---

## Proposed Solution

### Core Features (Priority Order)

#### 1. Multi-Select Filters ⭐⭐⭐ (P0 - Week 1)
**What**: Allow selecting multiple methods/status codes simultaneously
**Why**: Most common use case - developers often need to see "all mutations" (POST+PUT+PATCH+DELETE)
**Effort**: Medium (2-3 days)
**Impact**: High (solves 60% of user pain)

#### 2. Body Content Search ⭐⭐⭐ (P0 - Week 2)
**What**: Search within request/response JSON/text bodies
**Why**: Critical for debugging - "find all APIs that send userId" or "find error message in response"
**Effort**: Medium (2-3 days)
**Impact**: High (solves 30% of user pain)

#### 3. Sort by Column ⭐⭐ (P1 - Week 3)
**What**: Click column headers to sort by URL, method, status, duration
**Why**: Enables performance analysis and pattern recognition
**Effort**: Medium (2-3 days)
**Impact**: Medium (enables new workflows)

#### 4. Header Search ⭐ (P2 - Week 2)
**What**: Filter by request/response header name/value
**Why**: Useful for auth/caching analysis
**Effort**: Low (1 day)
**Impact**: Low-Medium (power user feature)

#### 5. Advanced Search Syntax 🔮 (P3 - Future)
**What**: Google-style search (e.g., `method:POST status:4xx body:"error"`)
**Why**: Power users love keyboard-driven workflows
**Effort**: High (4-5 days)
**Impact**: Low (nice-to-have)

---

## Design Philosophy

### 1. Progressive Disclosure
- Simple search input visible by default (current behavior)
- "Advanced Filters" panel collapsed by default
- Power users can expand to access full capabilities
- Casual users aren't overwhelmed

### 2. Immediate Feedback
- Filter changes update list instantly (no "Apply" button for checkboxes)
- Active filter count badge shows "Filters: 3 active"
- Dismissible filter chips for quick removal
- Result count: "Showing 15 of 247 interactions"

### 3. Performance-First
- In-memory filtering (no IndexedDB schema changes needed)
- Debounced body search (300ms delay to avoid expensive operations)
- Loading overlay for searches >200ms
- Truncate body search to first 100KB for large payloads

### 4. Backward Compatible
- Old URL search still works
- No breaking changes to existing functionality
- Graceful migration from single-select to multi-select
- Old state structure supported

---

## Technical Architecture

### Data Flow
```
User Input (UI)
    ↓
State Update (state.filters)
    ↓
filteredInteractions() function
    ↓
  Phase 1: Method/Status filter (fast, indexed)
  Phase 2: Header search (medium)
  Phase 3: Body search (slow, runs last)
    ↓
sortInteractions() function
    ↓
Render updated list
```

### State Schema
```javascript
state = {
  // Enhanced filters (replaces single methodFilter/statusFilter)
  filters: {
    methods: ['POST', 'PUT'],        // Multi-select
    statusCodes: ['4xx', '500'],     // Multi-select + specific
    requestBodyContains: 'userId',    // Substring
    responseBodyContains: 'error',    // Substring
    requestHeader: { name: 'auth', value: 'Bearer' },
    responseHeader: { name: 'content-type', value: 'json' },
    timestampRange: { from: Date, to: Date },
    mockEnabled: true,                // Boolean
    blocked: false,                   // Boolean
    hasNotes: null                    // null = all
  },
  
  // Sort configuration
  sortBy: 'timestamp',                // Column key
  sortOrder: 'desc',                  // 'asc' | 'desc'
  
  // UI state
  advancedFilterOpen: false           // Panel visibility
}
```

### No Database Changes Needed ✅
- Current IndexedDB indexes: `hash`, `tabId`, `sessionId`, `timestamp`
- All filtering happens **in-memory** after loading interactions
- Optional Phase 4: Add `method`, `responseStatus` indexes for future optimization
- No migration required for MVP (v1.8.0)

---

## User Experience

### Before (Current)
```
[Search URL...] [GET] [POST] [Status: all ▼]

Problems:
- Only 1 method at a time
- No body search
- No sort options
```

### After (Phase 1-3)
```
[Search...] [🔍 Advanced Filters ▼] [Clear All]

Filters: 3 active                    Showing 12 of 247
[× POST] [× 4xx] [× request:"token"]

┌─────┬──────────────────┬────────┬──────────┬─────────────┐
│ ☑   │ URL ↓           │ Status │ Duration │ Time        │
├─────┼──────────────────┼────────┼──────────┼─────────────┤
│ ⚡  │ POST /auth       │  401   │  12ms    │ 2 mins ago  │
└─────┴──────────────────┴────────┴──────────┴─────────────┘

Benefits:
✓ Multi-select filters
✓ Visual filter chips
✓ Sortable columns
✓ Result count
```

---

## Implementation Plan

### Phase 1: Multi-Filter (Week 1) - 2-3 days
**Files**: `extension/shared/app.js`, `extension/shared/style.css`
- [ ] Update state schema with `filters` object
- [ ] Create `renderAdvancedFilterPanel()` function
- [ ] Refactor `filteredInteractions()` for multi-select
- [ ] Add filter chips UI
- [ ] Add "Clear All" button

**Deliverable**: Users can select multiple methods/statuses

### Phase 2: Body Search (Week 2) - 2-3 days
**Files**: `extension/shared/app.js`
- [ ] Add body search inputs to filter panel
- [ ] Create `searchBodyContent()` helper function
- [ ] Create `searchHeaders()` helper function
- [ ] Update `filteredInteractions()` with body/header search
- [ ] Add loading indicator for slow searches

**Deliverable**: Users can search request/response bodies and headers

### Phase 3: Sort (Week 3) - 2-3 days
**Files**: `extension/shared/app.js`, `extension/shared/style.css`
- [ ] Create `sortInteractions()` function
- [ ] Add sortable column headers to list view
- [ ] Add click handlers for column sort
- [ ] Add visual sort indicators (▲/▼)
- [ ] Update `filteredInteractions()` to apply sort

**Deliverable**: Users can sort by URL, method, status, duration, timestamp

### Phase 4: Optimization (Week 4) - Optional
**Files**: `extension/shared/store.js`
- [ ] Bump DB_VERSION to 2
- [ ] Add migration logic for new indexes
- [ ] Add indexes: `method`, `responseStatus`, `mockEnabled`
- [ ] Optimize queries to use indexes

**Deliverable**: Faster filtering for large datasets (>1000 interactions)

---

## Success Metrics

### Performance Benchmarks
- ✅ Filter 1000 interactions by method: **<50ms**
- ✅ Filter 1000 interactions by body: **<500ms**
- ✅ Sort 1000 interactions: **<100ms**
- ✅ Combined filter + sort: **<600ms**

### User Adoption (Post-Launch)
- **Target**: 60% of users use advanced filters within first week
- **Target**: Average time to find API reduced from 45s → 8s
- **Target**: 50% of users change sort order at least once

### Quality Metrics
- ✅ Zero breaking changes to existing features
- ✅ WCAG 2.1 AA accessible (keyboard nav, screen reader)
- ✅ Works on mobile (responsive collapsible filters)
- ✅ <3 support tickets related to filter confusion

---

## Risk Assessment

### Technical Risks

#### Risk: Body search performance
**Probability**: Medium  
**Impact**: High  
**Mitigation**: 
- Debounce 300ms
- Show loading indicator
- Truncate to 100KB
- Consider web worker if needed

#### Risk: State management complexity
**Probability**: Low  
**Impact**: Medium  
**Mitigation**:
- Well-documented state schema
- Unit tests for filter logic
- Gradual rollout (phase by phase)

### UX Risks

#### Risk: Users don't discover advanced filters
**Probability**: Medium  
**Impact**: Medium  
**Mitigation**:
- Prominent "🔍 Advanced" button in toolbar
- Onboarding tooltip on first use
- Active filter badge draws attention

#### Risk: Too many filters = confusion
**Probability**: Low  
**Impact**: Low  
**Mitigation**:
- Progressive disclosure (collapsed by default)
- Clear filter chips show what's active
- "Clear All" button for easy reset

---

## Open Questions

1. **Should we add saved filter presets?**
   - Example: "Failed APIs", "Slow Responses", "My Custom Filter"
   - **Decision**: Defer to v1.9.0 (wait for user feedback)

2. **Should we export filtered results?**
   - Export currently visible results to HAR/CSV
   - **Decision**: Yes, low effort - add in Phase 3

3. **Should sort preference persist across sessions?**
   - Remember user's last sort choice
   - **Decision**: No for MVP (acceptable UX without persistence)

4. **Do we need regex search support?**
   - Allow `/pattern/` syntax in search
   - **Decision**: Defer to Phase 5 (power user feature)

---

## Appendix: Related Documents

- 📄 **SEARCH_FILTER_SORT_DESIGN.md** - Full technical specification (629 lines)
- 🎨 **SEARCH_FILTER_UI_MOCKUPS.md** - Visual mockups and UI states
- ✅ **IMPLEMENTATION_CHECKLIST.md** - Detailed implementation steps (582 lines)
- 🎯 **ACCEPTANCE_CRITERIA.md** - User stories and test scenarios (532 lines)

---

## Approval & Sign-Off

**Product Owner**: ___________________ Date: ___________

**Engineering Lead**: ___________________ Date: ___________

**QA Lead**: ___________________ Date: ___________

---

**Status**: ✅ Ready for Implementation  
**Target Release**: v1.8.0  
**Estimated Effort**: 3-4 weeks (12-16 eng days)  
**Expected Impact**: High (solves major user pain point)
