# EchoKit Engineering Review

## Executive Summary

- **Overall repo health score**: 8/10
- **Biggest risks**:
  - O(N^2) array filtering in UI render loops (e.g. `extension/shared/app.js`)
  - DOM XSS risks due to direct `innerHTML` assignment without `sanitizeHTML`
  - High duplication of core business logic (e.g. `new URL()` instantiation)
- **Highest ROI improvements**:
  - Implement a centralized `parseUrl(url, base)` with LRU caching.
  - Consolidate layout string generation into `interaction-renderer.js` and wrap DOM mutations in a safe HTML setter.
- **Architecture concerns**:
  - `extension/shared/app.js` is acting as a "god component" (>3200 lines), intertwining state management, UI rendering, and business logic.
  - Lack of a comprehensive State Management pattern.

## Critical Issues

1. **O(N) URL Parsing Bottleneck**: Direct calls to `new URL()` inside loops (like `renderRow`) cause severe rendering performance degradation.
2. **XSS Risk**: HTML templates are assigned to `innerHTML`. While some parts use `sanitizeHTML`, it needs to be globally enforced and must correctly sanitize control characters before checking for `javascript:` prefixes.
3. **God Object Anti-Pattern**: `extension/shared/app.js` is over 3200 lines, severely reducing maintainability and readability.

## Duplication Report

1. **URL Parsing Logic**: Found multiple instances of `new URL()` spread across the codebase.
   - *Impact*: Inconsistent resolution logic and missed caching opportunities.
   - *Fix*: Abstract into a centralized `parseUrl` utility.
2. **Filtering Logic**: Multiple chained `.filter()` calls.
   - *Impact*: Creates unnecessary intermediate arrays and high garbage collection overhead.
   - *Fix*: Abstract into a single pass O(N) array filter utility.

## Reusability Opportunities

1. **Shared URL Parser Hook**: Reuse parsed `URL` instances without mutating them.
2. **Unified Filter Selector**: Extract filter logic into a pure function.
3. **Safe DOM Wrapper**: Automatically sanitizes HTML on `innerHTML` assignments.
4. **Event Delegation Utility**: Centralize global event listeners to prevent leaks.

## Architecture Review

- **Scalability**: Vanilla JS architecture is struggling with the monolithic `app.js`. Implement Component-Based Architecture (see `specs/UI_COMPONENTIZATION_IMPLEMENTATION.md`).
- **Maintainability**: Low for `app.js`, high for standalone files like `cli` or `background`.
- **Dependency Management**: Excellent. Zero external runtime dependencies.
- **Resiliency**: Good, but manual URL instantiation and JSON parsing need rigorous `try/catch` wrapping.

## Performance Findings

- **Frontend Bottlenecks**: Array filtering and sorting happen inside render loops rather than being pre-computed.
- **Redundant URL instantiation**: `new URL` is repeatedly invoked rather than using an O(1) LRU map cache.
- **Memory Pressure**: Un-paginated request/response bodies may consume extensive memory.

## Security & Reliability Findings

- **Unsafe Data Handling**: Some `innerHTML` uses do not explicitly pipe through `sanitizeHTML`.
- **Injection Risks**: Control character bypass in `sanitizeHTML` could allow DOM XSS.
- **Console Output**: Multiple instances of `console.log` in production files.

## Testing Gaps

- Missing DOM XSS test cases testing bypass mechanisms (e.g. `javascript:` URIs with control characters).
- Missing performance benchmarks for `app.js` render loop.
- No End-to-End integration tests for UI state and filtering.

## Rules Compliance Findings

- **Violation**: `console.log` statements in production paths without explanation. Violates `DEVELOPMENT_RULES.md` Code Quality section. Needs to be removed or wrapped in a `DEBUG` flag.
- **Violation**: Uncached `new URL()` in tight loops. Violates `DEVELOPMENT_RULES.md` Performance section.
- **Violation**: Potential bypass of DOM sanitization rules. Violates `DEVELOPMENT_RULES.md` Security section.
- **Violation**: File size limits. `extension/shared/app.js` exceeds 2000 lines. Violates `DEVELOPMENT_RULES.md` Code Quality section.

## Recommended Refactor Plan

### Quick Wins
1. Update `sanitizeHTML` to robustly strip control characters.
2. Replace chained `.filter()` calls with a single `O(N)` pass.
3. Implement `try/catch` wrapping around all `new URL()` calls.

### Medium Effort
1. Implement LRU cache for URL parsing in shared utilities.
2. Create a safe HTML DOM setter utility to wrap all `innerHTML` assignments.
3. Eliminate production `console.log`s.

### Long-Term
1. Split `extension/shared/app.js` into modular components.
2. Implement a unified state management layer to avoid unnecessary re-renders.

---
## Top 10 High-Value Metrics

1. **Top 10 highest-value fixes**:
   - Strip control characters in `sanitizeHTML`
   - Cache `new URL()` allocations
   - Combine chained `.filter()` calls
   - Centralize DOM updates through a safe setter
   - Wrap all `JSON.parse` in try/catch
   - Remove production `console.log`s
   - Implement UI state pre-computation
   - Extract filter logic to pure functions
   - Remove duplicated URL resolving logic
   - Add missing `title` attributes on interactive elements

2. **Top 10 duplication-removal opportunities**:
   - `new URL()` instantiation logic
   - DOM element template strings assigned to `innerHTML`
   - `chrome.runtime.sendMessage` event dispatchers
   - Multi-condition Array filter loops
   - Event listener attachment/detachment
   - Object cloning logic
   - Status code color mapping logic
   - Timestamp formatting logic
   - HTTP Header parsing/normalization
   - LocalStorage getter/setter logic

3. **Top reusable abstractions worth introducing**:
   - `parseUrl(url, base)` with LRU cache
   - `setSafeHTML(element, rawHTML)`
   - `applyFilters(data, rules)`
   - `createDelegatedListener(selector, handler)`
   - `useMemoizedState(initial)`

4. **Files with highest technical debt**:
   - `extension/shared/app.js` (>3200 lines)
   - `extension/background.js`
   - `extension/shared/layouts.js`
   - `extension/injected.js`
   - `extension/shared/matcher.js`

5. **Suggested engineering standards missing**:
   - Strict Content Security Policy (CSP) enforcement guidelines
   - Componentization boundaries (No file > 1000 lines)
   - Centralized caching utility patterns
   - Standardized error boundary wrappers
   - Performance budgeting (Max render time limits)
