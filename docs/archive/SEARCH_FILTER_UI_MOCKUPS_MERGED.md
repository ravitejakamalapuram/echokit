# Search, Filter & Sort UI Mockups

## Current UI (Before)

```
┌─────────────────────────────────────────────────────────────────┐
│ 🔴 REC  ⚡ MOCK                                    example.com  │
├─────────────────────────────────────────────────────────────────┤
│ [Search URL...                           ] [GET][POST][PUT]    │
│                                             [Status: all ▼]     │
├─────────────────────────────────────────────────────────────────┤
│ API List (15 interactions)                                      │
│                                                                 │
│ 📦 api.example.com                                              │
│   GET  /users           200  ⚡                                 │
│   POST /auth            401  ⚡                                 │
│   GET  /products        200                                     │
└─────────────────────────────────────────────────────────────────┘
```

**Limitations**:
- Can only search URL
- Can only filter ONE method at a time
- Can only filter status by range (2xx, 3xx, etc.)
- Cannot search request/response bodies
- Cannot sort by anything except timestamp
- No saved filters or presets

---

## Proposed UI (After) - Collapsed State

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
│ │ ⚡  │ POST /login      │  403   │  8ms     │ 5 mins ago  │   │
│ │     │ POST /refresh    │  400   │  15ms    │ 8 mins ago  │   │
│ │ ⚡  │ POST /register   │  409   │  22ms    │ 10 mins ago │   │
│ └─────┴──────────────────┴────────┴──────────┴─────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

**Key Changes**:
1. ✅ Smart search input with syntax support
2. ✅ Advanced filters toggle
3. ✅ Active filter chips (dismissible)
4. ✅ Result count indicator
5. ✅ Sortable column headers
6. ✅ Multi-column layout for better scanability

---

## Proposed UI (After) - Expanded Advanced Filters

```
┌─────────────────────────────────────────────────────────────────┐
│ 🔴 REC  ⚡ MOCK                                    example.com  │
├─────────────────────────────────────────────────────────────────┤
│ [Search...                              ] [🔍 Advanced ▲] [Clear]│
├─────────────────────────────────────────────────────────────────┤
│ ┌─ Advanced Filters ─────────────────────────────────────────┐ │
│ │                                                             │ │
│ │ HTTP Method (multi-select)                                  │ │
│ │ [✓] GET    [✓] POST    [ ] PUT    [ ] PATCH    [ ] DELETE  │ │
│ │                                                             │ │
│ │ Response Status (multi-select)                              │ │
│ │ [✓] 2xx Success    [ ] 3xx Redirect    [✓] 4xx Client Error │ │
│ │ [ ] 5xx Server Error    [ ] Failed / Timeout                │ │
│ │ Or specific: [404          ] [Add Status Code]              │ │
│ │                                                             │ │
│ │ ──────────────────────────────────────────────────────────  │ │
│ │                                                             │ │
│ │ Search Body Content                                         │ │
│ │ Request contains:  [userId                             ]    │ │
│ │ Response contains: [error                              ]    │ │
│ │                                                             │ │
│ │ ──────────────────────────────────────────────────────────  │ │
│ │                                                             │ │
│ │ Search Headers                                              │ │
│ │ Request Header:  [authorization      ] = [Bearer           ]│ │
│ │ Response Header: [content-type       ] = [application/json ]│ │
│ │                                                             │ │
│ │ ──────────────────────────────────────────────────────────  │ │
│ │                                                             │ │
│ │ Time Range                                                  │ │
│ │ From: [2026-05-01 10:00] To: [2026-05-07 18:30]            │ │
│ │ Quick: [Last Hour] [Last 24h] [Last 7 days] [Custom]       │ │
│ │                                                             │ │
│ │ ──────────────────────────────────────────────────────────  │ │
│ │                                                             │ │
│ │ Other Filters                                               │ │
│ │ [ ] Mock enabled only                                       │ │
│ │ [ ] Blocked requests only                                   │ │
│ │ [ ] Has notes                                               │ │
│ │ [ ] GraphQL operations only                                 │ │
│ │                                                             │ │
│ │                          [Apply Filters] [Reset All]        │ │
│ └─────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│ Showing 12 of 247 interactions                                  │
│ [× GET] [× POST] [× 4xx] [× request:"userId"]                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Sort Interaction - Column Header Click

```
┌───────────────────────────────────────────────────────────────┐
│ ┌─────┬──────────────────┬────────┬──────────┬─────────────┐ │
│ │ ☑   │ URL ↓ (sorted)  │ Status │ Duration │ Time        │ │  ← Click URL header
│ ├─────┼──────────────────┼────────┼──────────┼─────────────┤ │
│ │ ⚡  │ GET  /api/auth   │  200   │  45ms    │ 2 mins ago  │ │
│ │ ⚡  │ GET  /api/products│ 200   │  120ms   │ 1 min ago   │ │
│ │     │ GET  /api/users  │  200   │  32ms    │ 5 mins ago  │ │
│ │ ⚡  │ POST /api/auth   │  401   │  12ms    │ 3 mins ago  │ │
│ └─────┴──────────────────┴────────┴──────────┴─────────────┘ │
└───────────────────────────────────────────────────────────────┘

Click again → URL ↑ (reversed)
Click Duration → Duration ↓ (slowest first)
```

**Visual Indicators**:
- `↓` = Descending (Z→A, 9→0, Newest→Oldest)
- `↑` = Ascending (A→Z, 0→9, Oldest→Newest)
- No arrow = Not currently sorted by this column
- Bold column name = Active sort

---

## Advanced Search Syntax Examples

### Example 1: Find failed authentication attempts
```
Input: method:POST url:/auth status:401

Result:
  POST /api/auth/login       401  12ms  2 mins ago
  POST /api/auth/refresh     401  8ms   5 mins ago
```

### Example 2: Find APIs with specific error message
```
Input: response:"User not found"

Result:
  GET /api/users/12345      404  22ms  1 min ago
  Response body: {"error": "User not found", "code": 404}
```

### Example 3: Find slow APIs (future enhancement)
```
Input: duration:>1000

Result:
  GET /api/reports/export   200  2.3s  10 mins ago
  POST /api/upload          201  1.8s  15 mins ago
```

### Example 4: Combine multiple criteria
```
Input: method:GET status:2xx header:cache-control

Result: All successful GET requests with cache-control header
```

---

## Mobile / Small Screen Adaptation

```
┌──────────────────────────┐
│ 🔴 REC  ⚡ MOCK          │
│ example.com              │
├──────────────────────────┤
│ [Search...         ]     │
│ [🔍 Filters (3)] [Clear] │
├──────────────────────────┤
│ ┌──────────────────────┐ │
│ │ POST /auth       401 │ │
│ │ ⚡ 12ms • 2 mins ago │ │
│ └──────────────────────┘ │
│ ┌──────────────────────┐ │
│ │ GET  /users      200 │ │
│ │ ⚡ 45ms • 5 mins ago │ │
│ └──────────────────────┘ │
└──────────────────────────┘

Tap [🔍 Filters] → Full-screen filter panel
```

