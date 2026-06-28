# EchoKit Engineering Review Report

## Executive Summary

* **Overall Repo Health Score:** 68/100
* **Biggest Risks:** Critical DOM XSS vulnerabilities via `innerHTML` bypasses using HTML-encoded control characters, severe performance bottlenecks from O(N) array filtering in render loops, and `new URL()` instantiations inside tight loops.
* **Highest ROI Improvements:** Refactoring `extension/shared/app.js` into modular components based on `extension/shared/columns.js` and centralizing URL caching via an LRU Map.
* **Architecture Concerns:** High tight coupling and massive god component (`extension/shared/app.js` has ~3252 lines). Repetitive UI logic and lack of reusable component abstractions.

## Critical Issues

* **DOM XSS via `innerHTML` Assignments:**
  * Files: `extension/shared/app.js`, `extension/shared/layouts.js`
  * Impact: Potential for cross-site scripting attacks. Malicious input bypasses URI checks using ASCII control characters (e.g., `&#09;`).
  * Fix: Must strip ASCII control characters and spaces (`/[\x00-\x20\x7F]/g`) from strings before prefix checks in `extension/shared/sanitize.js`. All template strings assigned to `innerHTML` must be passed through `sanitizeHTML()`.

* **Performance Bottleneck: `new URL()` in Tight Loops:**
  * Files: `extension/shared/interaction-helpers.js`, `extension/background.js`, `extension/injected.js`
  * Impact: Creating `new URL()` instances in tight loops (e.g., array filtering, render loops) is a severe performance bottleneck, leading to lag during high interaction volume.
  * Fix: Centralize and memoize URL parsing using a module-level LRU Map cache (`parseUrl`). Ensure the cached `URL` instance is cloned before mutation to avoid cross-request data corruption. Add a prominent JSDoc warning against mutating cached results.

## Duplication Report

* **Repeated Array Filtering (O(N) rendering bottlenecks):**
  * Impact: Sequential `.filter()` calls on large arrays cause multiple intermediate array allocations and O(K*N) time complexity, leading to garbage collection spikes.
  * Spread: Mostly in `extension/shared/app.js`.
  * Suggestion: Consolidate multiple filter conditions into a single O(N) pass with early returns to reduce overhead. Pre-compute filtered arrays once at the top level of the render function rather than inside child UI components.

* **Duplicated Column Rendering Logic:**
  * Impact: Repetitive inline HTML string generation for tables.
  * Spread: `extension/shared/app.js` and `extension/shared/interaction-renderer.js`.
  * Suggestion: Adhere to component-based architecture in `specs/UI_COMPONENTIZATION_IMPLEMENTATION.md`. Use `extension/shared/columns.js` as the single source of truth for column rendering.

## Reusability Opportunities

* **UI Components Layer:**
  * Extract modular vanilla JS components for headers, tables, toggles, and filters to replace the monolith in `extension/shared/app.js`.
* **State Selectors and Handlers:**
  * Create a unified event delegation utility to reduce duplicated `addEventListener` blocks and state mutations in UI callbacks.
* **URL Caching Abstraction:**
  * Extract a robust LRU URL cache to be shared across background, injected, and shared scripts.

## Architecture Review

* **God Component (app.js):**
  * `extension/shared/app.js` is over 3,000 lines long, violating the file size limit (< 2000 lines, ideally < 1000). It handles state, DOM manipulation, routing, and filtering simultaneously.
* **Missing State Ownership:**
  * Variables like `state` in `app.js` are mutated globally without a strict unidirectional data flow.
* **Accessibility (a11y) Gaps:**
  * Toggle chips and filters sometimes lack dynamic `aria-pressed`/`aria-expanded` attributes tied to state variables, and lack visual tooltips via the `title` attribute matching `aria-label`.

## Performance Findings

* **Unnecessary Re-renders:**
  * Re-rendering the entire interaction list instead of soft rendering updates.
  * O(K*N) array filtering chains instead of single-pass O(N) evaluation.
* **Expensive Computations:**
  * Repetitive `new URL()` instantiation in `visibleInContext` and `renderRow`.

## Security & Reliability Findings

* **Incomplete Validation:**
  * Custom HTML sanitizers (`sanitizeHTML`) do not strip control characters before validating schemes, which allows bypassing `javascript:` checks.
* **Reliability Risk - Mutation of Cached URLs:**
  * Returning a shared `URL` instance directly from a cache allows downstream code to mutate it (e.g., `u.search = ''`), corrupting the cache for future reads.

## Testing Gaps

* **Missing Edge Case Tests:**
  * Need tests specifically targeting XSS payloads with control characters (e.g., `javascript&#09;:alert(1)`).
* **Missing Component Tests:**
  * Lack of tests asserting UI component accessibility states (e.g., `aria-pressed` mapped correctly).

## Rules Compliance Findings

* **Rule Violated:** File size limit (DEVELOPMENT_RULES.md - no file > 2000 lines).
  * **Impact:** High cognitive load, merge conflicts, hard to test.
  * **Fix:** Decompose `extension/shared/app.js` into smaller modules.
* **Rule Violated:** No magic numbers.
  * **Impact:** Magic delays and constants used inside event handlers.
  * **Fix:** Extract to named constants at module scope.
* **Rule Violated:** No DOM manipulation in service workers.
  * **Impact:** Safe, but keep an eye on `background.js` avoiding any DOM-related references.

## Recommended Refactor Plan

* **Quick Wins (1-2 Days):**
  * Implement the control character stripping (`/[\x00-\x20\x7F]/g`) in `extension/shared/sanitize.js`.
  * Replace chained array `.filter()` calls with a single-pass O(N) loop in `app.js`.
  * Add the LRU cache Map for `new URL()` parsing in `interaction-helpers.js`.
* **Medium Effort (1-2 Weeks):**
  * Extract table row and column rendering out of `app.js` and strict adoption of `extension/shared/columns.js`.
* **Long-term Architecture (1-2 Months):**
  * Break `extension/shared/app.js` down into strict vanilla JS component classes (e.g., `ToolbarComponent`, `InteractionListComponent`) governed by a single state manager.

---

### Top 10 highest-value fixes

1. Strip ASCII control characters/spaces in `sanitizeHTML()` to patch DOM XSS bypasses.
2. Memoize `new URL()` instantiations via an LRU cache across the app.
3. Consolidate chained array `.filter()` operations into a single O(N) pass.
4. Clone cached `URL` objects before returning them to prevent cross-request mutation.
5. Bind `aria-pressed` and `aria-expanded` attributes dynamically to `state` for toggle buttons.
6. Enforce `sanitizeHTML()` wrapper around all `innerHTML` assignments in `app.js` and `layouts.js`.
7. Extract hardcoded constants (e.g., magic delays) in `app.js` to named constants.
8. Add missing `title` attributes matching `aria-label` to icon-only buttons.
9. Implement early return paths inside rendering loops to prevent unnecessary allocations.
10. Pass explicit base URLs (e.g., `location.href`) into URL parsing logic for relative URLs.

### Top 10 duplication-removal opportunities

1. **Column Rendering Logic:** Centralize using `extension/shared/columns.js`.
2. **Event Delegation:** Create a unified click/input handler utility rather than dozens of inline listeners.
3. **Array Filtering:** Share a single generic single-pass filter utility instead of repeating filter conditions.
4. **URL Parsing:** Replace scattered `new URL(url)` with a shared `parseUrl(url, base)` utility.
5. **State Mutation:** Centralize state updates in a generic `setState` function to avoid scattered object mutations.
6. **Overlay HTML Generation:** Standardize overlay and modal generation into a single reusable function.
7. **Accessibility Setup:** Share a helper to correctly initialize aria tags and titles on interactive elements.
8. **Date/Time Formatting:** Ensure timestamp formatting logic isn't duplicated in multiple renderers.
9. **JSON Validation/Highlighting:** Rely strictly on `highlightJSON` avoiding ad-hoc regex.
10. **Empty States:** Share a single `renderEmptyState()` instead of multiple inline empty states.

### Top reusable abstractions worth introducing

1. **`LRUUrlCache`:** A module-level map specifically handling `URL` string-to-object parsing and cloning.
2. **`SinglePassFilter`:** A utility for efficiently reducing arrays of interactions.
3. **`ComponentManager`:** A basic vanilla JS lifecycle class (mount, render, update, unmount).
4. **`EventBus` or `Dispatcher`:** To handle cross-module communication rather than direct coupling in `app.js`.
5. **`SanitizedHTMLRenderer`:** A wrapper that explicitly combines template literal generation with `sanitizeHTML`.

### Files/components with highest technical debt

1. `extension/shared/app.js` (God object, >3000 lines).
2. `extension/background.js` (Complex state, needs better module separation).
3. `extension/shared/layouts.js` (Security risks with `innerHTML` and unsanitized template generation).
4. `extension/shared/sanitize.js` (Security logic needs strengthening).

### Suggested engineering standards missing from the repository

1. **Componentization Strategy:** Explicit rules on how to build vanilla JS components to prevent monoliths.
2. **Accessibility (a11y) Standards:** Mandate `aria-*` state tracking and visual tooltips for all interactive elements.
3. **Performance Profiling Rule:** Any new rendering logic must prove it doesn't cause O(N^2) or multiple intermediate array allocations.
4. **Caching Standard:** Mandate that all cached objects returned by utilities MUST be cloned to ensure immutability.
5. **Strict HTML Assignment:** A lint rule or standard explicitly banning direct assignment to `innerHTML` without a sanitizer wrapper.
