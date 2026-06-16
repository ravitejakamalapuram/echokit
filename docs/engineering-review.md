# EchoKit Engineering Review

## Executive Summary
* **Overall Repo Health Score**: 6/10. The repository demonstrates a solid foundation but suffers from a few key architectural bottlenecks, specifically around god files, code duplication in critical logic paths, and inconsistent UI performance.
* **Biggest Risks**:
    1. A severe performance bottleneck exists in the frontend rendering loops due to `new URL()` instantiations and multiple sequential `.filter()` operations.
    2. Duplication of critical domain logic (the FNV-1a matcher) across three separate locations introduces a high risk of hash drift.
* **Highest ROI Improvements**:
    1. Implementing componentization as outlined in the `specs/` directory to break down the 3200+ line god file (`extension/shared/app.js`).
    2. Caching parsed URLs and pre-computing filtered data structures to immediately solve O(N^2) rendering delays.
* **Architecture Concerns**: The architecture lacks a unified single source of truth for the interaction schema, leading to defensive `JSON.parse` operations that are occasionally left naked.

## Critical Issues
1. **Unsafe JSON Parsing**: The file `tests/test-matcher.js` contains a naked `JSON.parse(result)` on line 125 and 135 without `try/catch` wrapping, violating the `DEVELOPMENT_RULES.md` requirement that *all* `JSON.parse` calls must be wrapped.
2. **God Component**: `extension/shared/app.js` is over 3,200 lines long, flagrantly violating the hard 2,000-line file size limit. It handles rendering, state, API calls, and event listeners simultaneously.
3. **Matcher Duplication**: The core FNV-1a hashing logic is manually duplicated across `extension/shared/matcher.js`, `extension/injected.js`, and `cli/lib/match.js`. This breaks the DRY principle and risks silent caching corruption if logic drifts.

## Duplication Report
* **FNV-1a Matcher Logic**: Duplicated 3 times (`extension/shared/matcher.js`, `extension/injected.js`, `cli/lib/match.js`). *Spread*: Core to all request matching. *Impact*: Hash drift will cause mock misses. *Suggestion*: Expose a shared, injectable normalization and hashing pure function that can be utilized in Node, Main world, and Isolated world.
* **Rendering Loops**: The UI layout components consistently duplicate the iteration over interaction arrays, applying `.filter()` inline repeatedly. *Suggestion*: Precompute a single filtered view of interactions at the top level of the render cycle.
* **Error Handling**: `try/catch` blocks around `JSON.parse` are repeated verbatim over 10 times. *Suggestion*: Introduce a utility `safeJsonParse(text, fallback)` to centralize this.

## Reusability Opportunities
* **safeJsonParse**: Create a shared utility in `extension/shared/` to handle JSON parsing with a default fallback, replacing dozens of inline `try/catch` blocks.
* **URL Parsing Cache**: Centralize the URL instantiation with a cache (e.g., a memoized `parseUrl` with an LRU cache) to prevent excessive allocations during rendering.
* **UI Componentization**: The UI elements (buttons, toggles, tables) are manually constructed via string interpolation or DOM methods throughout `app.js`. Extract these into a reusable `components/` directory.

## Architecture Review
* **Scalability**: The system scales well for single developers but the God File structure of `app.js` severely limits team concurrency.
* **Maintainability**: Low maintainability in the frontend due to tight coupling in `app.js`.
* **Layering**: The backend/worker is nicely layered. The frontend, however, mixes business logic (filtering, sorting) directly with DOM manipulation.
* **Resiliency**: The system correctly handles IndexedDB constraints, but the manual state synchronization between worlds (MAIN vs ISOLATED) is fragile.

## Performance Findings
* **Excessive Allocations**: Calling `new URL()` inside `app.js` mapping functions creates significant garbage collection overhead during list updates.
* **O(K*N) Filtering**: Sequential `.filter()` chaining on the interactions array forces multiple full-array passes.
* **Reflows**: Inefficient DOM updates in `app.js` occasionally trigger full repaints instead of utilizing the `softRenderList()` pattern strictly for all updates.

## Security & Reliability Findings
* **Missing Error Boundaries**: Naked `JSON.parse` in `tests/test-matcher.js` lines 125, 135.
* **DOM XSS Risks**: While `sanitizeHTML` exists, manual string interpolation for DOM elements in `app.js` requires constant vigilance.
* **Silent Failures**: The worker has weak observability if the LemonSqueezy API changes its payload format.

## Testing Gaps
* **Integration Tests**: There is a lack of integration tests proving that the duplicated matcher logic produces identical hashes across all environments.
* **Component Tests**: The UI rendering logic in `app.js` is virtually untestable in isolation due to its size and coupling.

## Rules Compliance Findings
* **Violation 1**: Rule: "File < 2000 lines". Found: `extension/shared/app.js` is 3200+ lines. *Impact*: Maintenance nightmare. *Fix*: Execute the incremental refactoring plan in `specs/`.
* **Violation 2**: Rule: "Error handling on all external input (JSON.parse)". Found: `tests/test-matcher.js`. *Impact*: Uncaught exceptions in test pipeline. *Fix*: Wrap with `try/catch`.

## Recommended Refactor Plan
* **Phase 1: Quick Wins**
  - Implement `safeJsonParse` utility and replace inline blocks.
  - Implement URL caching to resolve performance issues.
  - Fix naked `JSON.parse` in test files.
* **Phase 2: Medium Effort**
  - Consolidate matcher logic into a single source of truth, injected into the MAIN world during build/initialization.
  - Optimize the interactions array filtering to use a single O(N) pass.
* **Phase 3: Long-term Architecture**
  - Execute the full UI componentization refactor of `app.js`, breaking it into distinct view controllers and rendering components.

---

1. **Top 10 highest-value fixes:**
   1. Fix naked `JSON.parse` in `tests/test-matcher.js`.
   2. Introduce `parseUrl` with Map caching to remove `new URL()` in render loops.
   3. Consolidate chained `.filter()` operations in `app.js` into single O(N) passes.
   4. Implement `sanitizeHTML()` on all template literals in `layouts.js` and `app.js`.
   5. Explicitly pass base URL to `new URL` to prevent relative URL crashes.
   6. Remove inline DOM creation strings and use safe document.createElement wrappers.
   7. Ensure `aria-pressed` and `aria-expanded` strictly bind to state variables.
   8. Introduce a single `safeJsonParse` utility.
   9. Resolve ESLint Node 22 compat via `--no-import-attributes` or config tweak.
   10. Precompute filtered array values at top level of render, passing references down.

2. **Top 10 duplication-removal opportunities:**
   1. FNV-1a hash calculation (`matcher.js`, `injected.js`, `match.js`).
   2. URL Normalization logic (`matcher.js`, `injected.js`, `match.js`).
   3. Body stringification logic (`matcher.js`, `injected.js`, `match.js`).
   4. `try { JSON.parse() } catch {}` blocks (over 10 occurrences).
   5. List rendering and pagination wrappers across popup/devtools.
   6. Header formatting functions.
   7. Theme toggling logic.
   8. Date formatting utilities.
   9. Copy-to-clipboard error handling.
   10. Modal/Dialog open/close state management.

3. **Top reusable abstractions worth introducing:**
   1. `safeJsonParse(text, fallback)`
   2. `parseUrl(url, base)` with LRU caching
   3. `createSafeElement(tag, attributes, children)` DOM builder
   4. `InteractionStore` abstraction for IndexedDB
   5. Shared Matcher Engine (injected as string for MAIN world)

4. **Files/components with highest technical debt:**
   1. `extension/shared/app.js` (3200+ lines, multiple responsibilities)
   2. `extension/injected.js` (contains duplicated matcher logic)
   3. `cli/lib/match.js` (contains duplicated matcher logic)

5. **Suggested engineering standards missing from the repository:**
   1. **Strict Dependency Injection**: To handle MAIN vs ISOLATED world execution cleanly without duplicating code.
   2. **Automated Component Tests**: Missing tooling for DOM component isolation testing.
   3. **State Management Pattern**: Moving away from global mutable variables to predictable, unidirectional state updates (e.g., Redux-lite or signals).
