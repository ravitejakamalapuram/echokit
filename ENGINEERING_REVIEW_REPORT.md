# EchoKit Engineering Review Report

## Executive Summary
* **Overall Repo Health Score:** 6.5/10
* **Biggest Risks:** Massive monolithic files (`extension/shared/app.js` and `extension/background.js`) leading to tight coupling; severe performance bottlenecks due to `setInterval` UI polling, uncached `new URL()` calls, and sequential `.filter()` operations; DOM clobbering risks with forms.
* **Highest ROI Improvements:** Extracting `app.js` into modular ES components, implementing LRU cache for `new URL()`, combining sequential `.filter()` calls, and addressing memory limits in waterfall rendering.
* **Architecture Concerns:** The vanilla JavaScript architecture tightly couples UI rendering, state management, and business logic without functional abstractions. The structure leads to code duplication across `matcher.js` implementations.

## Critical Issues
* **Monolithic God Files:** `extension/shared/app.js` (3,261 LOC) and `extension/background.js` (1,816 LOC) handle everything from UI to complex business logic. This drastically degrades maintainability and extensibility.
* **Polling Anti-pattern:** `extension/shared/app.js` uses `setInterval` (running every 1500ms) to poll for state changes. This causes layout thrashing and sluggish UI updates.
* **DOM XSS Vulnerability:** A known DOM XSS bypass in `sanitize.js` exists where control characters can bypass `javascript:` prefix checks for URI validation (noted in `TODO.md`).
* **DOM Clobbering Risks:** The codebase uses direct properties for attribute access on DOM elements which makes it vulnerable to DOM clobbering via `<form>` inputs. Need to enforce `Element.prototype` usage.

## Duplication Report
* **Matcher Logic:** `cli/lib/match.js` and `extension/shared/matcher.js` contain duplicated code. Both files exist separately by design but there is an opportunity to abstract the core functionality into a single package.
* **Event Binding:** Hundreds of instances of `document.createElement` and `el.addEventListener` scattered across `app.js`. *Suggestion: Implement a global delegated event listener as noted in TODO.md.*

## Reusability Opportunities
* **Storage Abstraction:** A `StorageService` to wrap `IndexedDB` and `chrome.storage.local`.
* **Event Bus:** A reusable event emitter for cross-component communication to decouple the monolithic `app.js` file.

## Architecture Review
* **Scalability:** Very low on the frontend. `app.js` is too large for multiple engineers to work on concurrently without severe merge conflicts.
* **Maintainability:** Poor. The lack of modularity makes the codebase fragile. Any change to DOM structure risks breaking implicit state expectations.
* **Readability:** Inline DOM construction (`document.createElement`) and deep DOM querying obscures business logic.
* **Separation of Concerns:** Very poor. UI rendering functions directly read from and modify application global state.

## Performance Findings
* **Uncached Object Creation:** Uncached `new URL()` constructor calls inside loops (like `background.js` filtering logic and `app.js` rendering) cause severe performance bottlenecks during heavy network traffic (noted in `TODO.md`).
* **Sequential Filters:** The background interaction filtering and UI rendering execute sequential array `.filter()` calls, creating O(K*N) performance overhead (noted in `TODO.md`).
* **Min/Max Spread:** Usage of `Math.max(...array)` on potentially large datasets (like waterfall rendering) can cause `Maximum call stack size exceeded` errors.

## Security & Reliability Findings
* **Control Character URI Bypass:** `sanitize.js` needs to strip control chars before URI validation to prevent DOM XSS.
* **DOM Clobbering:** Need to enforce `Element.prototype.getAttribute.call(el, ...)` over `el.getAttribute` for all dynamic elements.
* **Accessibility:** Form labels are implemented using non-semantic `<div class="ek-label">` instead of proper `<label for="...">` elements, impacting screen readers. Toasts lack `role="status"` and `aria-live="polite"`.

## Testing Gaps
* **Frontend UI Coverage:** The massive `app.js` file has zero component-level unit test coverage.

## Rules Compliance Findings
* **Production `console.log` Calls:** Violates DEVELOPMENT_RULES.md production path rules (noted in `TODO.md`).

## Recommended Refactor Plan
### Quick Wins (Weeks 1-2)
* Replace `new URL()` with cached `parseUrl` in loops.
* Combine sequential array `.filter()` calls into single passes.
* Remove production `console.log` calls.
* Add `aria-label` and `title` to all non-semantic form inputs.
* Fix DOM XSS in URI validation logic by stripping control characters.

### Medium Effort (Weeks 3-6)
* Replace `setInterval` polling in `app.js` with `chrome.storage.onChanged` and message passing.
* Refactor `app.js` into focused ES modules: `header.js`, `menu.js`, `settings-dialog.js`, `request-detail.js`, etc.
* Create a central event delegation system at the document root.

### Long-Term Architecture (Months 2-3)
* Migrate UI from vanilla DOM manipulation to a lightweight component architecture.
* Refactor `background.js` into distinct service modules (StorageService, NetworkService).

# Final Requirement

1. **Top 10 highest-value fixes:**
   1. Componentize `app.js` into modular files (`header.js`, `menu.js`, etc.).
   2. Refactor `background.js` into service modules.
   3. Replace `new URL()` with cached `parseUrl` in loops to fix rendering bottlenecks.
   4. Combine sequential array `.filter()` calls into single passes.
   5. Fix DOM XSS bypass in `sanitize.js` control character handling.
   6. Remove all production `console.log` calls to meet code rules.
   7. Create a central event delegation system for the UI.
   8. Replace `Math.max(...array)` spread operations with standard `for` loops in waterfall rendering.
   9. Add `aria-label` and `title` to all custom `<div class="ek-label">` wrapped inputs.
   10. Enforce `Element.prototype` methods to prevent DOM Clobbering on forms.

2. **Top 10 duplication-removal opportunities:**
   1. Matcher logic duplicated across `extension/shared/matcher.js` and `cli/lib/match.js`.
   2. Sequential `.filter()` iterations on the same datasets.
   3. Verbose `document.createElement` usage.
   4. Scattered `addEventListener` blocks (can be delegated).
   5. `console.log` usage instead of a central logger.
   6. `new URL()` parsing without caching.
   7. Duplicated header rendering.
   8. Magic numbers for delays/timeouts across files.
   9. Inline styles vs class usages.
   10. Tab ID resolution across multiple flows.

3. **Top reusable abstractions worth introducing:**
   * A `DOMBuilder` utility (`h()` function) for safe and declarative DOM creation.
   * A `StorageService` module with unified Promise-based APIs.
   * An LRU Cache for URL parsing.
   * A central delegated click handler.

4. **Files/components with highest technical debt:**
   * `extension/shared/app.js` (3,261 LOC God File)
   * `extension/background.js` (1,816 LOC God File)
   * `extension/shared/sanitize.js` (XSS logic gaps)

5. **Suggested engineering standards missing from the repository:**
   * **Reactive State Standard:** Forbid polling (`setInterval`) for UI state synchronization.
   * **Module Boundary Standard:** Enforce strict ES Module boundaries with single-responsibility constraints.
   * **UI Component Testing:** Require unit test coverage for individual UI rendering modules, not just core logic.
