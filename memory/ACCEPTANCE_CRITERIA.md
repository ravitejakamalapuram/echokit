# Acceptance Criteria & User Scenarios

## Feature: Advanced Search, Filter & Sort for Recorded APIs

---

## 1. Multi-Select Method Filter

### User Story
**As a developer**, I want to filter by multiple HTTP methods simultaneously so I can analyze related API patterns (e.g., all POST and PUT requests together).

### Acceptance Criteria
✅ **GIVEN** I have recorded APIs with GET, POST, PUT methods  
✅ **WHEN** I select both POST and PUT filters  
✅ **THEN** I see only POST and PUT requests (GET is hidden)  

✅ **GIVEN** I have 3 filters active  
✅ **WHEN** I click "Clear All Filters"  
✅ **THEN** All filters are removed and full list is shown  

✅ **GIVEN** Method filter is applied  
✅ **WHEN** I click a filter chip to remove it  
✅ **THEN** That filter is removed, others remain active  

### Test Scenario
```
Setup: Record 10 GET, 5 POST, 3 PUT requests

1. Click POST checkbox
   → Expected: 5 results shown, "Filters: 1 active" badge
   
2. Additionally click PUT checkbox
   → Expected: 8 results (5 POST + 3 PUT), "Filters: 1 active" becomes "Filters: 2 active"
   
3. Click filter chip "× method:POST"
   → Expected: 3 results (only PUT), "Filters: 1 active"
   
4. Click "Clear All"
   → Expected: 18 results, no active filters
```

---

## 2. Multi-Select Status Code Filter

### User Story
**As a developer**, I want to filter by specific status codes or ranges so I can focus on errors or successful responses.

### Acceptance Criteria
✅ **GIVEN** I have recorded APIs with 200, 404, 500 status codes  
✅ **WHEN** I select "4xx Client Errors" and "5xx Server Errors"  
✅ **THEN** I see only 404 and 500 responses (200 is hidden)  

✅ **GIVEN** I need to find a specific error  
✅ **WHEN** I type "404" in the specific status code field  
✅ **THEN** Only 404 responses are shown  

✅ **GIVEN** Mixed status codes in results  
✅ **WHEN** I select "2xx Success"  
✅ **THEN** All 200, 201, 204, etc. responses are shown  

### Test Scenario
```
Setup: Record 10 × 200, 5 × 404, 3 × 500 responses

1. Select "4xx" checkbox
   → Expected: 5 results (404 only)
   
2. Additionally select "5xx" checkbox
   → Expected: 8 results (404 + 500)
   
3. Deselect "4xx", keep "5xx"
   → Expected: 3 results (500 only)
   
4. Type "500" in specific status input
   → Expected: Same 3 results (exact match)
```

---

## 3. Request Body Search

### User Story
**As a developer**, I want to search within request bodies so I can find APIs that send specific data.

### Acceptance Criteria
✅ **GIVEN** I have recorded APIs with JSON request bodies  
✅ **WHEN** I search for "userId" in request body  
✅ **THEN** I see only APIs whose request contains "userId" field or value  

✅ **GIVEN** Large request bodies (>100KB)  
✅ **WHEN** I search body content  
✅ **THEN** Search is performed within first 100KB only (with warning shown)  

✅ **GIVEN** Non-JSON request bodies (plain text, XML)  
✅ **WHEN** I search for a substring  
✅ **THEN** Plain text search works correctly  

### Test Scenario
```
Setup: Record 3 APIs:
  - POST /auth with body: {"username": "alice", "password": "***"}
  - POST /users with body: {"userId": 123, "name": "Bob"}
  - POST /products with body: {"sku": "ABC", "price": 99}

1. Type "userId" in "Request contains" field
   → Expected: 1 result (POST /users)
   
2. Type "alice" in "Request contains" field
   → Expected: 1 result (POST /auth)
   
3. Type "ABC" in "Request contains" field
   → Expected: 1 result (POST /products)
   
4. Type "xyz" (non-existent)
   → Expected: 0 results, "No interactions match your filters" message
```

---

## 4. Response Body Search

### User Story
**As a developer**, I want to search within response bodies so I can find APIs that return specific error messages or data.

### Acceptance Criteria
✅ **GIVEN** I have recorded APIs with various responses  
✅ **WHEN** I search for "error" in response body  
✅ **THEN** I see only APIs whose response contains the word "error"  

✅ **GIVEN** JSON response with nested objects  
✅ **WHEN** I search for a deeply nested value  
✅ **THEN** Search traverses full JSON structure  

✅ **GIVEN** Failed API with no response body  
✅ **WHEN** I search response body  
✅ **THEN** Failed APIs are excluded from results (gracefully handled)  

### Test Scenario
```
Setup: Record 3 APIs:
  - GET /users → 200 {"users": [...]}
  - GET /auth → 401 {"error": "Unauthorized", "message": "Invalid token"}
  - GET /missing → 404 {"error": "Not found"}

1. Type "error" in "Response contains" field
   → Expected: 2 results (401 and 404 responses)
   
2. Type "Unauthorized" in "Response contains" field
   → Expected: 1 result (401 response)
   
3. Type "users" in "Response contains" field
   → Expected: 1 result (200 response with users array)
```

---

## 5. Header Search

### User Story
**As a developer**, I want to filter by request/response headers so I can analyze authentication, caching, or content-type patterns.

### Acceptance Criteria
✅ **GIVEN** I have recorded APIs with various headers  
✅ **WHEN** I search for header name "authorization"  
✅ **THEN** I see only APIs that have authorization request header  

✅ **GIVEN** I want to find APIs with specific header values  
✅ **WHEN** I search for header "content-type" with value "json"  
✅ **THEN** I see APIs where content-type contains "json"  

✅ **GIVEN** Header search is case-insensitive  
✅ **WHEN** I search for "Content-Type" or "content-type"  
✅ **THEN** Both return same results  

### Test Scenario
```
Setup: Record 3 APIs:
  - GET /auth with headers: {authorization: "Bearer xyz", accept: "application/json"}
  - GET /public with headers: {accept: "text/html"}
  - POST /data with headers: {authorization: "Basic abc", content-type: "application/json"}

1. Request header name = "authorization"
   → Expected: 2 results (GET /auth, POST /data)
   
2. Request header name = "authorization", value = "Bearer"
   → Expected: 1 result (GET /auth only)
   
3. Request header name = "accept", value = "json"
   → Expected: 1 result (GET /auth with application/json)
```

---

## 6. Sort by Column

### User Story
**As a developer**, I want to sort recorded APIs by different attributes so I can analyze patterns and prioritize my work.

### Acceptance Criteria
✅ **GIVEN** I click on the "URL" column header  
✅ **WHEN** The list re-renders  
✅ **THEN** APIs are sorted alphabetically by URL (ascending)  

✅ **GIVEN** I click the same column header again  
✅ **WHEN** The list re-renders  
✅ **THEN** Sort order is reversed (descending)  

✅ **GIVEN** I click "Duration" column  
✅ **WHEN** The list re-renders  
✅ **THEN** APIs are sorted by duration with slowest first (descending)  

✅ **GIVEN** Sort is applied  
✅ **WHEN** I apply a filter  
✅ **THEN** Filtered results maintain the current sort order  

### Test Scenario
```
Setup: Record mixed APIs with different URLs, statuses, durations

1. Click "URL" header
   → Expected: List sorted A→Z by URL path
   → Visual: "URL ↑" indicator shown
   
2. Click "URL" header again
   → Expected: List sorted Z→A
   → Visual: "URL ↓" indicator shown
   
3. Click "Duration" header
   → Expected: List sorted by duration (slowest first)
   → Visual: "Duration ↓" indicator, "URL" indicator removed
   
4. Apply method filter (POST only)
   → Expected: Filtered results remain sorted by duration
```

---

## 7. Combined Filters (AND Logic)

### User Story
**As a developer**, I want to combine multiple filters to create precise queries.

### Acceptance Criteria
✅ **GIVEN** I select method:POST AND status:4xx filters  
✅ **WHEN** The list updates  
✅ **THEN** I see only POST requests that returned 4xx errors  

✅ **GIVEN** I add body search on top of existing filters  
✅ **WHEN** I type in body search field  
✅ **THEN** Results are further narrowed (all filters are ANDed)  

✅ **GIVEN** Multiple filters are active  
✅ **WHEN** I remove one filter chip  
✅ **THEN** Results update to reflect remaining filters only  

### Test Scenario
```
Setup: Record 20 mixed APIs

1. Select POST method
   → 8 results
   
2. Add 4xx status filter
   → 3 results (POST + 4xx)
   
3. Add request body contains "token"
   → 1 result (POST + 4xx + body has "token")
   
4. Remove "4xx" filter chip
   → 2 results (POST + body has "token", any status)
```

---

## 8. Performance Requirements

### Acceptance Criteria
✅ **GIVEN** 1000 recorded interactions loaded  
✅ **WHEN** I apply method/status filters  
✅ **THEN** Filtering completes in <50ms  

✅ **GIVEN** 1000 recorded interactions with large bodies  
✅ **WHEN** I search request/response body  
✅ **THEN** Search completes in <500ms  

✅ **GIVEN** 1000 interactions  
✅ **WHEN** I sort by any column  
✅ **THEN** Sorting completes in <100ms  

✅ **GIVEN** Body search takes >200ms
✅ **WHEN** Search is running
✅ **THEN** Loading indicator is shown

### Benchmark Test
```javascript
// Performance test script
const interactions = generateMockInteractions(1000);

console.time('Method Filter');
const filtered = filteredInteractions(); // method:POST
console.timeEnd('Method Filter');
// Expected: < 50ms

console.time('Body Search');
const bodyResults = filteredInteractions(); // request body contains "token"
console.timeEnd('Body Search');
// Expected: < 500ms

console.time('Sort');
const sorted = sortInteractions(interactions, 'url', 'asc');
console.timeEnd('Sort');
// Expected: < 100ms
```

---

## 9. Accessibility

### Acceptance Criteria
✅ **GIVEN** I use keyboard only (no mouse)
✅ **WHEN** I press Tab key
✅ **THEN** Focus moves through all interactive elements in logical order

✅ **GIVEN** I use screen reader
✅ **WHEN** I navigate to filter panel
✅ **THEN** All labels and controls are announced correctly

✅ **GIVEN** I press Ctrl/Cmd+F
✅ **WHEN** Focus moves to search input
✅ **THEN** I can immediately start typing

✅ **GIVEN** I press Esc key
✅ **WHEN** Advanced filter panel is open
✅ **THEN** Panel closes and focus returns to toggle button

### ARIA Requirements
```html
<div role="search" aria-label="Filter recorded APIs">
  <input aria-label="Search URL" />

  <div role="group" aria-labelledby="method-filter-label">
    <span id="method-filter-label">HTTP Method</span>
    <input type="checkbox" aria-label="GET" />
    <input type="checkbox" aria-label="POST" />
  </div>

  <button aria-expanded="false" aria-controls="advanced-filters">
    Advanced Filters
  </button>

  <div id="advanced-filters" aria-hidden="true">
    <!-- filter inputs -->
  </div>
</div>
```

---

## 10. Edge Cases

### Empty State
✅ **GIVEN** No interactions recorded
✅ **WHEN** User opens filter panel
✅ **THEN** Appropriate empty state message is shown
✅ **AND** Filter controls are disabled or hidden

### No Results After Filter
✅ **GIVEN** Filters applied result in 0 matches
✅ **WHEN** Results list updates
✅ **THEN** Helpful message shown: "No interactions match your filters"
✅ **AND** Active filter chips are displayed
✅ **AND** "Clear Filters" button is prominent

### Large Body Truncation
✅ **GIVEN** Response body is >100KB
✅ **WHEN** User searches body content
✅ **THEN** Search operates on first 100KB only
✅ **AND** Warning message shown: "⚠️ Large body - search limited to first 100KB"

### Invalid JSON in Body
✅ **GIVEN** Response body is not valid JSON
✅ **WHEN** User searches body content
✅ **THEN** String search works correctly (fallback)
✅ **AND** No error is thrown

### Special Characters in Search
✅ **GIVEN** User searches for `[test]` or `user@email`
✅ **WHEN** Search executes
✅ **THEN** Special regex characters are escaped
✅ **AND** Literal match is performed

---

## 11. User Scenarios (End-to-End)

### Scenario A: Debugging Failed Authentication
```
Story: Developer notices login failures in their app

1. Open EchoKit popup
2. Click "Advanced Filters"
3. Select filters:
   - Method: POST
   - Status: 401, 403
   - URL contains: "auth"
4. Click "Apply Filters"
5. Results show: 3 failed auth attempts
6. Click first result to view details
7. Review request body → Notice incorrect "grant_type" value
8. Fix code, re-test
9. Clear filters to verify new requests succeed
```

### Scenario B: Finding Slow API Calls
```
Story: Developer wants to optimize performance

1. Open EchoKit popup
2. Click "Duration" column header (sort by slowest first)
3. Review top 5 slowest APIs
4. Notice: GET /reports/export takes 3.2s
5. Apply filter: URL contains "reports"
6. See all report-related APIs sorted by duration
7. Identify pattern: All report APIs are slow
8. Document findings for optimization ticket
```

### Scenario C: Searching for Error Messages
```
Story: User reports "insufficient permissions" error

1. Open EchoKit popup
2. Click "Advanced Filters"
3. Type in "Response contains": "insufficient permissions"
4. Apply filter
5. Results: 2 APIs return this error
6. Review first result:
   - POST /api/documents/123/share
   - Response: {"error": "insufficient permissions", "required": "owner"}
7. Identify root cause: Missing role check
8. Export filtered results to HAR for team
```

### Scenario D: Analyzing API Pattern
```
Story: QA wants to verify all mutations are authenticated

1. Open EchoKit
2. Apply filters:
   - Methods: POST, PUT, PATCH, DELETE
3. Sort by URL (alphabetically)
4. Add header filter:
   - Request header name: "authorization"
   - Value: "" (empty = just check if exists)
5. Count: 45 mutations, all have auth header ✓
6. Remove header filter
7. Notice: Now shows 47 mutations
8. Identify 2 unprotected endpoints → File bug
```

---

## 12. Regression Prevention

### Must NOT Break
✅ Simple URL search continues to work (backward compat)
✅ Existing single-select method chips work if user doesn't open advanced
✅ Current status dropdown works in fallback mode
✅ Recording/mocking functionality unaffected
✅ HAR export includes filtered results correctly
✅ Settings panel unaffected
✅ Detail view for selected interaction unaffected

### Migration Path
```javascript
// Old state structure
state = {
  methodFilter: 'POST',      // Single value
  statusFilter: '4'          // Single value (4xx)
}

// New state structure (backward compatible)
state = {
  methodFilter: null,        // Deprecated but kept for old code paths
  statusFilter: null,        // Deprecated but kept for old code paths

  filters: {
    methods: [],             // New multi-select
    statusCodes: []          // New multi-select
  }
}

// Migration on first load
if (state.methodFilter && state.filters.methods.length === 0) {
  state.filters.methods = [state.methodFilter];
  state.methodFilter = null;
}
```

---

## 13. Success Metrics (Post-Launch)

### Quantitative Metrics
- [ ] 80%+ of users discover advanced filters within first week
- [ ] Average time to find specific API reduced from 45s → 8s
- [ ] Filter usage: 60%+ of sessions use at least one filter
- [ ] Body search usage: 30%+ of sessions search body content
- [ ] Sort feature usage: 50%+ of sessions change sort order

### Qualitative Metrics
- [ ] User feedback: "Much easier to find specific APIs"
- [ ] Support tickets: Reduction in "can't find API" questions
- [ ] Feature requests: Users ask for filter presets (positive signal)

---

## Summary

This specification covers:
✅ **5 core features**: Method filter, Status filter, Body search, Header search, Sort
✅ **8 detailed acceptance criteria** with test scenarios
✅ **4 end-to-end user scenarios** for common workflows
✅ **Performance benchmarks** for all operations
✅ **Accessibility requirements** (WCAG 2.1 AA)
✅ **Edge cases** and error handling
✅ **Regression prevention** checklist
✅ **Success metrics** for post-launch evaluation

**Ready for Implementation** ✅
