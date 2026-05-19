# API Source Visibility - Manual Test Plan

## Test Setup
1. Load the extension in Chrome (chrome://extensions → Load unpacked → select `/extension`)
2. Open 3 tabs:
   - Tab A: https://jsonplaceholder.typicode.com
   - Tab B: https://jsonplaceholder.typicode.com/posts
   - Tab C: https://httpbin.org

## Test 1: Badge Display - Current Tab
**Steps:**
1. On Tab A, open DevTools → EchoKit
2. Click REC to start recording
3. Make API call: `fetch('https://jsonplaceholder.typicode.com/posts/1').then(r=>r.json())`
4. Stop recording

**Expected:**
- ✅ API row shows green badge with "✓ THIS TAB"
- ✅ Badge tooltip: "Recorded on this tab"

## Test 2: Badge Display - Other Tab
**Steps:**
1. Switch to Tab B, open DevTools → EchoKit
2. Verify Tab A's API is visible (assuming scope=domain)

**Expected:**
- ✅ API row shows blue badge with "→ TAB #{A}"
- ✅ Badge tooltip shows "Click to switch to {tab title}"
- ✅ Badge is clickable (cursor: pointer)

## Test 3: Badge Click - Switch to Tab
**Steps:**
1. On Tab B, click the blue "Tab #{A}" badge

**Expected:**
- ✅ Chrome switches focus to Tab A
- ✅ No errors in console

## Test 4: Badge Display - Closed Tab
**Steps:**
1. Close Tab A (that recorded the API)
2. On Tab B, refresh EchoKit list

**Expected:**
- ✅ Badge changes to gray "✗ CLOSED"
- ✅ Tooltip: "Source tab is no longer open"
- ✅ Badge is NOT clickable

## Test 5: Badge Display - Imported APIs
**Steps:**
1. Export APIs from Tab B
2. Clear all APIs
3. Import the exported JSON

**Expected:**
- ✅ APIs show amber badge "↓ IMPORTED"
- ✅ Tooltip: "Imported from external source"

## Test 6: Source Filters - DevTools Only
**Steps:**
1. Open Tab B DevTools → EchoKit
2. Click "🔍 Advanced Filters"
3. Verify "API Source" section exists

**Expected:**
- ✅ Four checkboxes visible:
  - ✅ "This tab" (checked by default)
  - ✅ "Other tabs" (checked by default)
  - ✅ "Closed tabs" (unchecked by default)
  - ✅ "Imported" (checked by default)

## Test 7: Source Filter - Hide Closed Tabs (Default)
**Steps:**
1. Ensure Tab A is closed
2. Open Tab B DevTools
3. Note: "Closed tabs" filter is unchecked by default

**Expected:**
- ✅ APIs from closed Tab A are NOT visible
- ✅ Check "Closed tabs" → they appear
- ✅ Uncheck again → they disappear

## Test 8: Source Filter - This Tab Only
**Steps:**
1. On Tab B, record a new API
2. In filters, uncheck "Other tabs" and "Closed tabs"
3. Keep only "This tab" checked

**Expected:**
- ✅ Only APIs recorded on Tab B are visible
- ✅ APIs from other tabs are hidden

## Test 9: Popup Mode - Badges Visible, Filters Hidden
**Steps:**
1. Click EchoKit popup icon (not DevTools)

**Expected:**
- ✅ Source badges ARE visible in list
- ✅ Advanced filter panel does NOT exist (popup doesn't have it)
- ✅ Badges are NOT clickable in popup

## Test 10: Scope Interaction - Tab Scope
**Steps:**
1. Set scope to "tab" (Settings → Scope → Tab)
2. On Tab B, verify API visibility

**Expected:**
- ✅ Only Tab B's APIs are visible (scope filtering takes precedence)
- ✅ Badges still show source classification
- ✅ Source filters don't override scope logic

## Test 11: Performance - Large Dataset
**Steps:**
1. Import HAR with 100+ APIs
2. Open DevTools → EchoKit

**Expected:**
- ✅ Render completes in <500ms
- ✅ No lag when toggling filters
- ✅ Badges render correctly for all APIs

## Regression Tests
- ✅ Existing filters (method, status, search) still work
- ✅ Mock toggle still works
- ✅ Block toggle still works (Pro)
- ✅ Detail panel opens correctly
- ✅ Export/Import still works
- ✅ CORS toggle still works
- ✅ Recording still works

## Browser Console - No Errors
Throughout all tests:
- ✅ No JavaScript errors in console
- ✅ No network errors
- ✅ Extension background page has no errors

## Success Criteria
All tests pass ✅
