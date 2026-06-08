# EchoKit Engineering Review Report

## Executive Summary
- **Overall Repo Health Score:** 65/100
- **Biggest Risks:** Massive technical debt in `extension/shared/app.js` (3,243 lines), manual code duplication of core matcher logic across multiple environments, and latent performance bottlenecks in the UI rendering loop causing O(N²) execution times.
- **Highest ROI Improvements:** Implement a centralized `URL` caching mechanism for UI loops, incrementally refactor `app.js` into modular components using `specs/UI_COMPONENTIZATION_IMPLEMENTATION.md`, and replace sequential `.filter()` chains with single-pass filter structures.
- **Architecture Concerns:** The lack of a bundler requires manual duplication of `matcher.js` into `injected.js` (MAIN world) and `cli/lib/match.js`. This creates a severe synchronization risk where match hash algorithms can silently diverge, breaking imported mock data.

## Critical Issues
1. **Manual Sync of Matcher Logic:** The `matcher.js` code is duplicated in `extension/injected.js` (inside an IIFE) and `cli/lib/match.js`. If one changes, the match keys diverge. This should be isolated or tested rigorously to prevent drift.
2. **God File `extension/shared/app.js`:** The file has over 3,200 lines and 98 functions, violating the rule that files over 2,000 lines should be split. It contains state management, UI rendering, event handling, and logic.
3. **Performance Degredation from Array Operations:** UI rendering loops repeatedly call `.filter().length` resulting in O(N²) rendering times.
4. **Performance Sink from Repeated Parsing:** `new URL()` is instantiated inside tight UI rendering loops (`renderRow`, `groupByDomain`).

## Duplication Report
- **Matcher Logic:** `matcher.js`, `injected.js`, and `cli/lib/match.js` duplicate the core API matching logic. **Consolidation Suggestion:** Write a script to automate the inlining of `matcher.js` into `injected.js` and `cli/lib/match.js` during a prep step, or enforce a strict test suite that tests all three implementations identically.
- **UI Rendering Loops:** Multiple functions manually iterate over the `interactions` array and perform chained `.filter()` operations instead of using a unified data pipeline. **Consolidation Suggestion:** Pre-calculate grouped and filtered state.
- **Column Configurations:** Hardcoded column structures appear across `app.js` and rendering modules. **Consolidation Suggestion:** Fully utilize `extension/shared/columns.js` as the single source of truth for all table rendering logic.

## Reusability Opportunities
- **URL Parser Cache:** Create a shared URL parsing utility module that caches `new URL()` results up to a limit (e.g., 5000 entries) and use it across `app.js`, `interaction-renderer.js`, and `waterfall-renderer.js`.
- **UI Components:** Isolate toolbar, filters, dialogs, and specific interaction views from `app.js` into specific shared components based on `specs/UI_COMPONENTIZATION_IMPLEMENTATION.md`.
- **State Selectors:** Introduce shared getter functions for derived state, computing conflict counts using a `WeakMap` cached mechanism.

## Architecture Review
- **Scalability:** The vanilla JS approach works but is scaling poorly as features expand (evidenced by the `app.js` size). The architecture needs strict adherence to modularization to remain maintainable.
- **Maintainability:** High coupling between state and DOM updates in `app.js` makes testing interactions difficult.
- **Observability:** Missing generalized telemetry or robust logging in `app.js` to track rendering bottlenecks.

## Performance Findings
1. **O(N²) Conflict Counting:** Filtering arrays during rendering by `.filter(x => x.hash === i.hash).length` to count conflicts within loops is creating massive UI thread blockage. Needs a pre-computed `WeakMap` cache structure.
2. **O(K*N) Filter Chains:** Sequential `.filter()` calls inside `app.js` are creating intermediate array allocations. Consolidate into a single O(N) pass.
3. **Repeated Object Parsing:** Redundant `new URL(url)` evaluations in tight loops (e.g., `domainOf(url)` inside `app.js` and `interaction-renderer.js`). Needs memoization.

## Security & Reliability Findings
- **DOM XSS Vulnerabilities:** Direct assignments of template strings using `innerHTML` are risky. While `sanitizeHTML` is in place, developers must rigorously ensure it's wrapped around all template rendering, particularly inside `app.js` and `interaction-renderer.js`.
- **`postMessage` Security:** Ensure `'/'` target origin is strictly enforced when communicating between `injected.js` and `content.js` to prevent malicious frame interception.
- **Offline Reliability:** Service Worker relies on IndexedDB wrapper (`store.js`). The max-retry logic is good, but failure to open IndexedDB should degrade gracefully rather than fail silently.

## Testing Gaps
- **Divergence Testing:** Lack of tests specifically validating that `matcher.js`, `injected.js`, and `cli/lib/match.js` generate the exact same match hashes for a wide array of edge-case request signatures.
- **State Store Mocking:** Ensure dynamic imports are correctly positioned below `global.self.indexedDB` mocks in test files to prevent ES module hoisting from breaking store tests.
- **Component Unit Testing:** The massive `app.js` lacks modular unit testing for its 98 individual functions.

## Rules Compliance Findings
- **Rule Violated:** File size limit (2000 lines max).
  - **Impact:** `app.js` is 3243 lines. It is an exception in `DEVELOPMENT_RULES.md` to be refactored incrementally, but current progress is lacking.
  - **Action:** Incrementally move discrete UI pieces into the `extension/shared/` modular structure.
- **Rule Violated:** Avoid `new URL()` in tight loops.
  - **Impact:** Causes UI lag on large HAR imports or heavy network pages.
  - **Action:** Introduce an LRU cache or `Map` caching implementation for URLs.

## Recommended Refactor Plan
### Quick Wins
- Introduce a module-level `Map` cache for URL parsing in `app.js` and `interaction-renderer.js` with a 5000-entry flush limit.
- Refactor O(N²) `.filter().length` operations into a precomputed `WeakMap` approach.
- Enforce `sanitizeHTML()` uniformly across all `innerHTML` assignments.

### Medium Effort Improvements
- Refactor the multiple chained `.filter()` operations into a single-pass O(N) reducer for the main list rendering pipeline.
- Migrate column definitions inside `app.js` to strictly consume `extension/shared/columns.js`.

### Long-term Architecture Improvements
- Break down `app.js` into distinct component files (e.g., `Toolbar.js`, `FilterPanel.js`, `ListRenderer.js`) orchestrated by a lightweight central state manager.
- Implement an automated build or verification step that ensures `matcher.js` logic is perfectly synchronized with `injected.js` and CLI copies.

---

### 1. Top 10 highest-value fixes
1. Implement `Map` caching for `new URL()` in rendering loops.
2. Replace O(N²) inline `.filter()` usage with precomputed `WeakMap` conflict counts.
3. Consolidate chained `.filter()` calls into a single O(N) loop.
4. Replace `innerHTML` template interpolations with `sanitizeHTML()` comprehensively.
5. Fix `window.postMessage` to strictly use the `'/'` origin.
6. Extract toolbar rendering functions from `app.js` into a separate module.
7. Implement automated sync/testing for `matcher.js` duplication.
8. Add `"browser": true` to ESLint config for Service Worker globals.
9. Link ARIA attributes (like `aria-expanded`) dynamically to state variables using string interpolation for interactive components.
10. Wrap all global declarations in `extension/injected.js` in an IIFE to prevent global scope pollution.

### 2. Top 10 duplication-removal opportunities
1. Core `matcher.js` logic duplicated in `injected.js` and `cli/lib/match.js`.
2. Repeated column definitions across `app.js` and `interaction-renderer.js` (migrate to `columns.js`).
3. Replicated date formatting logic across views.
4. Duplicate array filtering loops across advanced filters and search functionality.
5. Identical HTML rendering logic for badges and chips.
6. Duplicated `new URL()` destructuring functions.
7. Redundant error boundary/toast notification code.
8. Duplicate mock assertion counts in CLI tests (`__health` and `__coverage`).
9. Repetitive layout toggle logic between popup and devtools panels.
10. Duplicated HTTP header normalization logic across extensions and Node.js server.

### 3. Top reusable abstractions worth introducing
1. **Memoized URL Parser:** A shared cache for `URL` object parsing.
2. **Unified Data Pipeline:** A single function that takes raw interactions and applies sorting, filtering, and grouping in one pass.
3. **Component Factory:** A standardized function for generating accessible UI components (buttons, chips) using native semantic HTML.
4. **State Selector Hooks:** Shared vanilla JS functions for deriving computed state safely.
5. **DOM Sanitization Wrapper:** A higher-order function that wraps all raw HTML string generations in `sanitizeHTML()`.

### 4. Files/components with highest technical debt
1. `extension/shared/app.js` (Size and coupling)
2. `extension/injected.js` (Hand-inlined code duplication)
3. `extension/shared/interaction-renderer.js` (Performance and DOM manipulation)
4. `cli/lib/match.js` (Divergence risk)
5. `extension/background.js` (Complex message handling)

### 5. Suggested engineering standards missing from the repository
1. **Strict Performance Budgets:** Require benchmarking for UI rendering loops > 1000 items.
2. **Automated Duplication Checks:** CI step to fail builds if matcher logic diverges.
3. **Vanilla JS State Management Guideline:** Standardize on how state updates trigger DOM re-renders without a framework.
4. **HTML Sanitization Pipeline:** A linting rule or CI check to strictly disallow `innerHTML` without `sanitizeHTML()`.
5. **DOM Reflow Optimization:** Rules against triggering synchronous layouts (reading `offsetHeight`/`clientWidth` interleaved with writes) during render cycles.
