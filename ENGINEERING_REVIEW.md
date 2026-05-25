
# EchoKit Repository Engineering Review

**Date:** 2026-05-25
**Role:** Senior Staff Software Engineer

## 1. Executive Summary

- **Overall Repo Health Score:** 80/100
- **Biggest Risks:**
  1. The monolithic UI architecture in `extension/shared/app.js` (>3100 lines) makes rendering sluggish and maintenance hazardous.
  2. Potential XSS vulnerabilities through raw `innerHTML` assignments without DOMPurify or `sanitizeHTML` usage, violating security conventions.
  3. Redundant `matcher.js` logic hand-inlined across `injected.js` and `cli/lib/match.js` introducing drift and testability issues.
- **Highest ROI Improvements:**
  1. Complete the Phase 4 UI componentization plan (`extension/shared/app.js` refactoring).
  2. Implement proper ES build/bundling (e.g., Rollup/Vite) to share modules into `injected.js` instead of hand-inlining code.
  3. Replace direct `innerHTML` usage with `sanitizeHTML()` uniformly.
- **Architecture Concerns:**
  - Lack of a modern UI library (React/Preact) for state reconciliation, leading to manual DOM manipulation and full DOM tree replacements (`list.innerHTML = ...`) which hurts performance.
  - Test framework fragmentation (Python Playwright smoke tests, Node `assert` CLI tests).

## 2. Critical Issues

- **Security - Missing `sanitizeHTML`:** `DEVELOPMENT_RULES.md` / memories mandate passing template literals through `sanitizeHTML()` before `innerHTML` assignments to prevent DOM XSS. However, `extension/shared/app.js` directly assigns template literals to `innerHTML` in multiple overlay renders and list renders (e.g., lines 353, 701, 724, 815, 2252, etc.). `extension/shared/layouts.js` also assigns `innerHTML` directly.
- **Oversized File Violation:** `extension/shared/app.js` is 3188 lines long, breaching the 2000-line limit mandated in `DEVELOPMENT_RULES.md`. It has one massive god function `renderDetail` which is >200 lines (breaching the 150-line limit).

## 3. Duplication Report

- **Match Logic Drift:** `extension/shared/matcher.js` code is duplicated in `cli/lib/match.js` and `extension/injected.js` (lines 182-270). The injected script contains hand-inlined implementations of FNV-1a and normalization functions.
- **UI Rendering Duplication:** `renderSortableTable` vs `renderListView` logic (currently in process of being refactored out in Phase 4 of the Componentization Plan).

## 4. Reusability Opportunities

- **Build/Bundling Setup:** The project avoids a build step but pays for it by hand-inlining `matcher.js` into `injected.js`. Introducing esbuild/rollup for extension content scripts would allow real module sharing.
- **UI Components:** Extract the various "overlay" dialogs in `app.js` into a reusable `DialogManager` to stop redefining `overlay.innerHTML` string templates.
- **Centralized Event Delegation:** `app.js` is re-attaching event listeners over and over after blowing away the DOM with `innerHTML`.

## 5. Architecture Review

- **Scalability & Maintainability:** The vanilla JS architecture is hitting its limits. `app.js` holds a lot of derived state and manages DOM updates manually, causing friction.
- **Separation of Concerns:** The Service Worker (`background.js`) does a good job with IndexedDB, but UI concerns are tangled in `app.js`. The Phase 0-4 UI refactoring specs exist but are only partially integrated.
- **Performance:** Re-rendering 1000 items with `.join('')` and `innerHTML` is O(N) DOM creation. Virtual scrolling is needed for the interactions list.

## 6. Performance Findings

- **Frontend Renders:** Rebuilding the interaction list with `innerHTML = items.map(...).join('')` drops frames when recording many items. Memory indicates O(N^2) bottlenecks exist if inline `.filter().length` is used in list renders.
- **No Virtualization:** The DOM contains every list item, causing memory pressure.

## 7. Security & Reliability Findings

- **XSS Vector:** Direct `innerHTML` use needs `sanitizeHTML`.
- **window.postMessage:** `injected.js` and `content.js` use `window.postMessage(..., '/')`. This securely restricts it to same-origin.

## 8. Testing Gaps

- Missing automated unit tests for `extension/shared/app.js` logic.
- Only Playwright end-to-end tests exist for the UI. Needs component-level unit tests.

## 9. Rules Compliance Findings

- **Violated Rule:** File size > 2000 lines (`app.js`).
- **Violated Rule:** Function size > 150 lines (`renderDetail` in `app.js`).
- **Violated Rule:** Security convention to use `sanitizeHTML()` for `innerHTML` assignments.

## 10. Recommended Refactor Plan

1. **Quick Wins:** Wrap all `innerHTML` assignments with `sanitizeHTML()`.
2. **Medium Effort:** Finish Phase 4 UI Componentization to shrink `app.js`.
3. **Long-Term:** Add a lightweight bundler to share code between CLI, injected script, and extension UI.

---

### End of Report

1. **Top 10 highest-value fixes:**
   1. Fix XSS vector with `sanitizeHTML()` around `innerHTML`.
   2. Refactor `renderDetail` to be < 150 lines.
   3. Finish `app.js` refactoring to split out UI modules.
   4. Introduce esbuild to eliminate duplicated `matcher.js` code.
   5. Virtualize the API interaction list for performance.
   6. Clean up legacy functions from UI componentization.
   7. Add component tests for the new UI shared layouts.
   8. Fix ESLint `"browser": true` config for background service worker.
   9. Add WeakMap precomputation for UI list rendering.
   10. Prevent multiple `window.postMessage` listeners from accumulating.

2. **Top 10 duplication-removal opportunities:**
   1. `matcher.js` vs `injected.js`.
   2. `matcher.js` vs `cli/lib/match.js`.
   3. Overlay dialog string templates.
   4. Table row rendering vs Grouped row rendering (handled by UI Componentization).
   5. Webhook verification in `worker` scripts.
   6. `chrome.storage` interactions across background script.
   7. Header rule rendering logic.
   8. Filter rendering functions.
   9. Copy/paste logic duplication.
   10. `renderEmpty()` variations.

3. **Top reusable abstractions worth introducing:**
   - Dialog/Modal Manager.
   - Component state reconciliation wrapper.
   - Module bundler config.

4. **Files/components with highest technical debt:**
   - `extension/shared/app.js`
   - `extension/injected.js`

5. **Suggested engineering standards missing from the repository:**
   - Pre-commit hooks for file size and function size.
   - Automated XSS linting for `innerHTML`.
   - UI framework usage policy.
