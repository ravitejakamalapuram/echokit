# EchoKit Engineering Review

## Executive Summary

Overall Repo Health: Good (8/10)

Biggest risks:
- O(N^2) array filtering in UI render loops
- DOM XSS risks due to innerHTML and javascript: URIs
- Tight coupling of URL parsing inside render cycles
- Component logic duplication in vanilla JS architecture

Highest ROI improvements:
- Implement LRU cache for `new URL()` in `app.js` and `background.js`
- Centralize `sanitizeHTML` usage across all innerHTML assignments
- Extract repeated array filter logic into single-pass O(N) functions
- Adopt a unified `render()` helper for DOM assignments

Architecture concerns:
- Over-reliance on monolithic vanilla JS file (`app.js` is 3.2k lines)
- Mixing state management, DOM events, and string rendering
- Syncing logic manually between `matcher.js` and `injected.js`

## Critical Issues

1. **O(N) URL Parsing Bottleneck**: `new URL()` is called inside `renderRow` and array filtering loops, severely degrading UI rendering performance with many interactions.
2. **XSS Risk**: HTML templates are assigned to `innerHTML` in `app.js`. While `sanitizeHTML` exists, its prefix checks can be bypassed by control characters.
3. **Event Listener Leaks**: Re-rendering DOM lists without unbinding previous event listeners can cause memory leaks.

## Duplication Report

1. **URL Parsing**: `new URL()` and `new URL(url, base)` are duplicated across `app.js`, `matcher.js`, `background.js`, and `injected.js`.
   - *Impact*: Inconsistent URL resolution logic and duplicated error handling.
   - *Fix*: Abstract into a shared `parseUrl(url, base)` utility in `interaction-helpers.js`.
2. **Filtering Logic**: Multiple `.filter()` calls are chained in `app.js`.
   - *Impact*: High GC overhead and unnecessary intermediate arrays.
   - *Fix*: Combine into a single `O(N)` `.filter()` or `.reduce()`.
3. **DOM Updates**: Repeated `overlay.innerHTML = sanitizeHTML(...)` across 10+ places in `app.js`.
   - *Impact*: Error-prone; developers might forget `sanitizeHTML`.
   - *Fix*: Create a `setSafeHTML(element, template)` helper.
4. **HTML String Rendering**: Similar list/row rendering logic scattered in `app.js` and `interaction-renderer.js`.
   - *Impact*: UI inconsistency.
   - *Fix*: Move all layout string generation to `interaction-renderer.js`.

## Reusability Opportunities

1. **Shared URL Parser Hook**: Create a cached `getParsedUrl(url, base)` to reuse parsed `URL` instances without mutating them.
2. **Unified Filter Selector**: Extract the multi-condition filter logic out of `app.js` into a pure function `applyInteractionFilters(interactions, filters)`.
3. **Event Delegation Utility**: Create a helper to manage global event listeners instead of attaching many inline listeners.
4. **Safe DOM Wrapper**: A small class/proxy for DOM nodes that automatically sanitizes `innerHTML`.

## Architecture Review

- **Scalability**: The vanilla JS architecture is straining under the weight of `app.js` (3200+ lines). It needs componentization as outlined in `specs/UI_COMPONENTIZATION_IMPLEMENTATION.md`.
- **Maintainability**: High. Separation of concerns between `shared`, `background`, and `cli` is good, but `app.js` is a god component.
- **Dependency Management**: Excellent. Zero external runtime dependencies in the extension.
- **Resiliency**: Good, but error handling around JSON parsing and URL parsing needs to be universally wrapped in try/catch.

## Performance Findings

- **Expensive Renders**: Array filtering and sorting happen inside the render cycle. They should be pre-computed at the top level.
- **Unnecessary Recomputations**: `new URL()` inside loops.
- **Memory Usage**: Storing large request/response bodies in memory without pagination can lead to memory pressure.

## Security & Reliability Findings

- **XSS**: `sanitizeHTML` in `shared/sanitize.js` must strip ASCII control characters (e.g., `\x00-\x20`) before checking `javascript:` prefixes to prevent bypasses.
- **Injection**: Avoid `innerHTML` where `textContent` suffices.
- **Reliability**: Modifying cached `URL` objects causes cross-request data corruption.

## Testing Gaps

- Missing DOM XSS test cases with control characters in `javascript:` URIs.
- Missing performance benchmarks for `app.js` render loop with 10k+ interactions.
- End-to-end integration tests for UI state management and filtering.

## Rules Compliance Findings

- **Rule Violation**: `console.log` statements in production paths (e.g., `background.js`, `app.js`). *Fix*: Remove or wrap in `DEBUG` flag.
- **Rule Violation**: Uncached `new URL()` in tight loops. *Fix*: Implement LRU caching.
- **Rule Violation**: Potential `innerHTML` usage without sanitization. *Fix*: Enforce `sanitizeHTML` globally.

## Recommended Refactor Plan

### Quick Wins
1. Update `sanitizeHTML` to strip control characters.
2. Replace chained `.filter()` calls with a single pass in `app.js`.
3. Add try/catch blocks around all `new URL()` calls.

### Medium Effort
1. Implement LRU Cache for `parseUrl` in shared helpers.
2. Extract DOM rendering logic from `app.js` to `interaction-renderer.js`.
3. Remove `console.log` statements from production code.

### Long-Term
1. Split `app.js` into modular components (`FilterBar`, `InteractionList`, `DetailView`).
2. Adopt a lightweight reactive state management pattern to prevent unnecessary re-renders.
3. Unify duplicated matcher logic between `matcher.js` and `injected.js`.

---
## Top 10 High-Value Metrics

1. **Top 10 highest-value fixes**:
   - Strip control characters in `sanitizeHTML`
   - Cache `new URL()` allocations
   - Combine chained `.filter()` calls
   - Wrap all `JSON.parse` in try/catch
   - Remove production `console.log`s
   - Centralize DOM updates through a safe setter
   - Fix missing `title` attributes on interactive elements
   - Implement UI state pre-computation
   - Abstract filter logic
   - Remove duplicated URL resolving logic

2. **Top 10 duplication-removal opportunities**:
   - `new URL()` logic across 4 files
   - `overlay.innerHTML` string templates in `app.js`
   - `chrome.runtime.sendMessage` wrappers
   - Array filter logic
   - Matcher hashing in `matcher.js` vs `injected.js`
   - Event listener attachment
   - Status code color mapping
   - Timestamp formatting
   - Body serialization (`normalizeBody`)
   - Object cloning logic

3. **Top reusable abstractions worth introducing**:
   - `parseUrl(url, base)` with LRU cache
   - `setSafeHTML(element, rawHTML)`
   - `applyFilters(data, rules)`
   - `createDelegatedListener(selector, handler)`
   - `useMemoizedState(initial)`

4. **Files with highest technical debt**:
   - `extension/shared/app.js` (3200+ lines, god file)
   - `extension/shared/matcher.js` (duplicated with injected.js)
   - `extension/background.js` (large background script)
   - `extension/injected.js`
   - `extension/shared/layouts.js`

5. **Suggested engineering standards missing**:
   - Strict Content Security Policy (CSP) enforcement guidelines
   - Performance budgeting (Max render times)
   - Componentization boundaries (No file > 1000 lines)
   - Standardized error boundary wrappers
   - Centralized caching utility patterns
