# EchoKit Engineering Review Report
**Date**: 2026-07-06

## Executive Summary
- **Overall Repo Health Score**: 85/100
- **Biggest Risks**:
  - Massive god objects in frontend (`app.js`) and background worker (`background.js`).
  - DOM XSS and DOM Clobbering vulnerabilities.
  - O(N^2) filtering loops and `new URL()` instantiation bottlenecks.
- **Highest ROI Improvements**:
  - Implement caching (LRU Cache) for `new URL()`.
  - Fix high-severity Sentinel DOM vulnerabilities.
  - Optimize the array filtering loops.
- **Architecture Concerns**:
  - Tight coupling of UI logic and state.
  - Lack of test coverage for frontend components.
  - Lack of functional abstraction in vanilla JavaScript UI.

## Critical Issues
- **God Component (app.js)**: `extension/shared/app.js` is extremely large and handles too many responsibilities (layout, rendering, state).
- **Performance Bottleneck (`new URL()`)**: Inside `extension/background.js` and `extension/injected.js`, `new URL()` is instantiated frequently inside loops, causing major GC overhead.
- **Security (DOM Clobbering & XSS)**: Using element properties instead of `Element.prototype` methods opens up DOM Clobbering vulnerabilities. Unsanitized strings in `.innerHTML` introduce XSS vectors.
- **Development Rules Violations**: `console.log` statements are present in production code (`extension/background.js` and `extension/shared/app.js`), violating `DEVELOPMENT_RULES.md`. (Note: CLI server logs are excluded from this finding as they are intended behavior).

## Duplication Report
- **URL Parsing**: Repeated normalization logic across `matcher.js`, `injected.js`, and `background.js`.
- **Filtering Operations**: Sequential `.filter().filter()` operations exist in `app.js` and `background.js`, creating O(K*N) complexity.
- **Event Listeners**: Scattered `addEventListener` blocks in `app.js` instead of a central event delegation system.

## Reusability Opportunities
- **State Manager**: Extract a centralized Store to handle UI state, interactions, and settings symmetrically.
- **URL Utility**: Introduce `parseUrl` with an LRU cache in a shared module.
- **Safe HTML Templating**: Create an `html` tagged template literal to automatically sanitize interpolated strings.
- **UI Components**: Decompose `app.js` into modular components (e.g., Toolbar, DataGrid, Header).

## Architecture Review
- **Scalability**: The procedural vanilla JS structure is reaching its limits. Transitioning to a component-driven architecture is required.
- **Maintainability**: Files over 1,000 lines (`app.js`, `background.js`) are extremely difficult to navigate and maintain.
- **Extensibility**: Adding new features requires modifying monolithic files, increasing the risk of regressions.

## Performance Findings
- **Array Filtering Overhead**: Iteratively filtering the `interactions` array on every keystroke without caching or WeakMaps is slow.
- **Unnecessary Re-renders**: Frequent use of `innerHTML` for minor state changes causes layout trashing.
- **URL Instantiation**: Redundant `new URL()` calls inside critical interception paths.

## Security & Reliability Findings
- **DOM Clobbering**: Insecure interaction with `el.attributes` instead of `Element.prototype.getAttribute.call(el)`.
- **Validation Bypasses**: Missing stripping of ASCII control characters in URI validation (`sanitize.js`).
- **PostMessage Validation**: Insufficient validation of `ev.source === window` in message listeners.

## Testing Gaps
- **Frontend Components**: Core UI rendering logic lacks unit tests.
- **Load Testing**: The mock server's resilience under heavy load is unverified.
- **Integration Tests**: Need more comprehensive E2E tests mocking `window.chrome` APIs.

## Rules Compliance Findings
- **DEVELOPMENT_RULES.md**: Fails "No unnecessary full re-renders".
- **DEVELOPMENT_RULES.md**: Fails "No `console.log` in production paths".
- **DEVELOPMENT_RULES.md**: Fails "File size within limits — no file > 2000 lines" (`app.js`).

## Recommended Refactor Plan

### Quick Wins
1. Remove all `console.log` statements from production code.
2. Fix DOM Clobbering vulnerabilities using `Element.prototype` methods.
3. Add `ev.source === window` validation to all `postMessage` listeners.

### Medium Effort Improvements
1. Implement an LRU cache for URL parsing to eliminate `new URL()` overhead.
2. Optimize array filtering using WeakMaps for object bodies.
3. Replace raw `innerHTML` usage with a secure tagged template literal.

### Long-term Architecture Improvements
1. Refactor `app.js` into focused, reusable UI components.
2. Implement a centralized state management service.
3. Split `background.js` into modular services (Storage, Network, DNR).

## Top 10 highest-value fixes
1. Eliminate `new URL()` calls in request interception loops using an LRU cache.
2. Fix DOM Clobbering vulnerabilities by using `Element.prototype` methods.
3. Validate `ev.source === window` on all `postMessage` receivers.
4. Remove all `console.log` output from production paths.
5. Fix O(N^2) array filtering overhead in `app.js` UI updates.
6. Strip ASCII control characters before scheme validation in `sanitize.js`.
7. Wrap unhandled `JSON.parse` blocks in `app.js` with try-catch.
8. Centralize and sanitize `innerHTML` assignments using a safer template literal tag.
9. Enforce proper debounce wrappers around rapid UI inputs.
10. Explicitly set UTF-8 encoding in Python documentation generators.

## Top 10 duplication-removal opportunities
1. URL parsing and domain extraction logic across multiple scripts.
2. Match hash computation in network hooks.
3. Row rendering templates for DevTools and Popup modes.
4. UI DOM event listener attachment logic across overlay modals.
5. Error toast notification instantiation logic.
6. Form data serialization loops in request handlers.
7. Sequential array filters (`filter(method).filter(status)`).
8. State synchronization listeners.
9. Message passing boilerplate (`chrome.runtime.sendMessage`).
10. `chrome.storage.session` read/write blocks.

## Top reusable abstractions worth introducing
1. `parseUrl` - Centralized, memoized URL parser with an LRU cache.
2. `SafeHTML` - Template tag function for auto-escaping DOM injections.
3. `StoreDispatcher` - Central state mutation event bus.
4. `UIComponent` - Base class for rendering detached DOM chunks.
5. `StorageService` - Abstracted wrapper over IndexedDB and `chrome.storage`.
6. `DOMDelegate` - Global event delegation registry.
7. `Debounce` / `Throttle` utility module.

## Files/components with highest technical debt
1. `extension/shared/app.js`
2. `extension/background.js`
3. `extension/injected.js`
4. `extension/shared/matcher.js`

## Suggested engineering standards missing from the repository
1. **Strict Content Security Policy (CSP)**: Disallow raw `.innerHTML` usage.
2. **State Immutability Standard**: Mandate immutable state updates.
3. **Event Delegation Policy**: Require a unified global event dispatcher.
4. **URL & Parsing Efficiency Standards**: Forbid `new URL()` in tight loops.
5. **Component Size Limits**: Hard limits on file sizes to enforce modularity.
