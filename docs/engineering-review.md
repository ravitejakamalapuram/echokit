# Engineering Review Report

## Executive Summary
* Overall repo health score: 7/10
* Biggest risks: Inconsistent UI architecture, XSS risks in DOM manipulation, missing error boundaries, lack of test coverage for edge cases.
* Highest ROI improvements: Complete UI componentization, implement strict DOM sanitization policy, consolidate state management.
* Architecture concerns: Leaking DOM logic, fragmented module system, potential memory leaks in caching.

## Critical Issues
1. **XSS Risk in `extension/shared/app.js`**: Multiple instances of assigning unsanitized strings to `innerHTML`. All such assignments must use `sanitizeHTML()`.
2. **Missing Input Validation in Worker**: The Cloudflare worker lacks robust validation on incoming requests.
3. **Performance Bottlenecks**: Creating `new URL()` in tight rendering loops (e.g., in `extension/shared/interaction-helpers.js`).

## Duplication Report
1. **Interaction Rendering**: Duplicated rendering logic across `app.js`, `layouts.js`, and `interaction-renderer.js`. Recommendation: Fully adopt `specs/UI_COMPONENTIZATION_IMPLEMENTATION.md`.
2. **Message Passing**: Background and content scripts use raw `chrome.runtime.sendMessage` with repetitive error handling. Recommendation: Create a shared `MessageBus` utility.
3. **URL Parsing**: Repeated URL normalization logic in `matcher.js` and `app.js`. Recommendation: Use unified `interaction-helpers.js`.

## Reusability Opportunities
1. **DOM Helpers**: Extract DOM manipulation logic (e.g., event delegation) into a reusable library.
2. **Storage Wrappers**: Create a unified interface for `chrome.storage` and IndexedDB.
3. **UI Components**: Build standalone, reusable UI widgets (Toggle, Modal, Tooltip) independent of global state.

## Architecture Review
* Scalability: Acceptable for a browser extension, but the background service worker handles too many responsibilities (storage, licensing, routing).
* Maintainability: `app.js` (3200+ lines) is a 'god module' and needs urgent decomposition.
* Separation of concerns: UI rendering is tightly coupled with state management.

## Performance Findings
1. O(N) filtering during render in `app.js`. Must precompute filters.
2. Excessive DOM reflows when updating the list. Use DocumentFragment or a virtual DOM library.
3. `parseUrl` cache in `interaction-helpers.js` may grow unbounded; needs an LRU eviction policy.

## Security & Reliability Findings
1. `sanitizeHTML` is not consistently used for `innerHTML` assignments.
2. Missing retry logic for external API calls in `worker.js`.
3. Incomplete error handling for IndexedDB operations in `store.js`.

## Testing Gaps
1. Smoke tests are Python-based and don't natively test the extension UI.
2. No unit tests for `app.js` or `layouts.js`.
3. Missing contract tests for the worker API.

## Rules Compliance Findings
1. **Magic Numbers**: Found hardcoded delays in `app.js` (e.g., `80`, `300`). Must use constants.
2. **DOM in Service Worker**: Ensure `background.js` strictly avoids DOM APIs.
3. **Componentization**: `app.js` violates the spec by retaining legacy render functions.

## Recommended Refactor Plan
1. Quick wins: Replace `innerHTML` with `sanitizeHTML()`, fix `new URL()` performance bottlenecks.
2. Medium effort: Break `app.js` into smaller state/view modules. Adopt `columns.js` fully.
3. Long-term: Introduce a lightweight build step (e.g., Vite) or a virtual DOM library to manage complex UI state.

### Top 10 highest-value fixes
1. Replace `new URL()` in loops with cached `parseUrl()`.
2. Apply `sanitizeHTML()` to all `innerHTML` assignments in `app.js`.
3. Precompute filtered arrays before rendering to fix O(N) bottleneck.
4. Add LRU caching to `interaction-helpers.js` URL parser.
5. Move hardcoded delays in `app.js` to named constants.
6. Add explicit error handling for IndexedDB failures in `store.js`.
7. Remove legacy render functions from `app.js`.
8. Add a retry mechanism to Cloudflare worker fetch calls.
9. Fix missing `aria-label` and `title` on button elements in `app.js`.
10. Extract inline styles in `interaction-renderer.js` to CSS classes.

### Top 10 duplication-removal opportunities
1. Consolidate URL normalization between `matcher.js` and `app.js`.
2. Unify message passing wrappers in content/background scripts.
3. Remove duplicated empty state rendering logic in `app.js` and `layouts.js`.
4. Merge similar event delegation listeners in `app.js`.
5. Deduplicate time formatting logic across components.
6. Consolidate modal creation logic.
7. Unify badge rendering (mode, conflict) into helper functions.
8. Share HTTP method color mapping between `app.js` and `waterfall-renderer.js`.
9. Extract generic debounce wrapper to a shared utility.
10. Consolidate API interaction fetching logic in CLI and extension.

### Top reusable abstractions
1. Shared MessageBus for extension communication.
2. UI Component Library (Button, Modal, Input).
3. Unified StorageManager.
4. Generalized API Client for worker/backend.
5. Safe DOM Manipulator (wrapping `sanitizeHTML`).

### Files with highest technical debt
1. `extension/shared/app.js` (massive size, mixed concerns).
2. `extension/background.js` (too many responsibilities).
3. `extension/injected.js` (complex mocking logic).
4. `cli/bin/echokit-server.js` (monolithic script).
5. `extension/shared/layouts.js` (transitional state).

### Missing engineering standards
1. Strict XSS prevention policy (enforced via linting).
2. Centralized State Management Pattern (e.g., Redux-like or Signals).
3. Frontend Unit Testing Strategy (e.g., Jest/Vitest for UI components).
4. UI Componentization Guidelines (partially defined, poorly enforced).
5. Automated Performance Profiling in CI.
