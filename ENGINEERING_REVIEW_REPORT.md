# Daily Engineering Review Report

## Executive Summary
* **Overall Repo Health Score:** 65/100
* **Biggest Risks:** Critical code duplication enforced by buildless architecture (matcher logic across 3 separate files), oversized god files (`extension/shared/app.js` at 3264 lines, `extension/background.js` at 1806 lines), and potential security risks from manual DOM manipulation without strict sanitization guarantees in the large UI module.
* **Highest ROI Improvements:** Introduce a lightweight build/bundle step (e.g., esbuild, rollup) to eliminate hand-inlined code duplication across environments. Incrementally refactor `extension/shared/app.js` to separate DOM event binding, state management, and rendering logic.
* **Architecture Concerns:** The strict "no bundler" architecture forces anti-patterns like hand-inlining `matcher.js` into `injected.js` and `cli/lib/match.js`. This creates a high risk of divergence where hashes will silently stop matching between the extension and the CLI server.

## Critical Issues
1. **Matcher Divergence Risk (High Severity):**
   - The core hashing and matching logic is duplicated three times (`extension/shared/matcher.js`, `extension/injected.js`, `cli/lib/match.js`).
   - *Impact:* A single bug fix or tweak to one file that isn't manually ported to the others will silently break the mock replay functionality, which is the core value proposition of the product.
2. **God File `app.js` (High Severity):**
   - `extension/shared/app.js` is over 3200 lines, violating the 2000-line hard limit defined in `DEVELOPMENT_RULES.md`.
   - *Impact:* extremely high cognitive load, difficult to maintain, and prone to merge conflicts.

## Duplication Report
1. **URL/Body Normalization and Hashing (`matcher.js` / `injected.js` / `match.js`)**
   - *Why it's problematic:* Violates DRY. Changes to the hashing algorithm or query strip logic must be replicated perfectly.
   - *Duplication Spread:* Extension ISOLATED world, Extension MAIN world, Node CLI.
   - *Abstraction Opportunity:* If a build step is introduced, this logic can be written once in a shared `core/` package and bundled into the injected script and imported normally by the Node CLI and Extension background.
2. **UI Component Rendering Logic**
   - *Why it's problematic:* HTML string construction is scattered throughout `app.js` and other renderer files (e.g., `waterfall-renderer.js`).
   - *Abstraction Opportunity:* Create a centralized DOM builder or template function that automatically sanitizes input using `sanitizeHTML()`.

## Reusability Opportunities
1. **State Management Extraction:** `extension/shared/app.js` holds a massive global `state` object. Extracting this into a `Store` or `StateObserver` class (e.g., `extension/shared/state.js`) would decouple state mutations from DOM updates.
2. **UI Componentization:** Create reusable modules for specific UI panels (e.g., `FilterPanel.js`, `InteractionList.js`, `DetailView.js`). Currently, `app.js` manages all of these.
3. **Event Bus/PubSub:** Abstract `postMessage` and `chrome.runtime.sendMessage` into a typed Event Bus to reduce boilerplate when communicating between `injected.js`, `content.js`, and `background.js`.

## Architecture Review
* **Scalability:** The current Vanilla JS approach with manual DOM updates scales poorly as UI complexity increases. The dual-interface strategy (Popup vs DevTools) managed by a monolithic file makes conditional rendering complex.
* **Maintainability:** Very poor in UI layers due to file sizes. The backend/CLI layer is better structured.
* **Dependency Management:** The zero-dependency CLI server is a strong constraint but leads to reimplementing standard features.
* **Resiliency:** The background service worker correctly handles re-initialization from storage, but the reliance on `self.__echokitHandle` for testing is a leaky abstraction.

## Performance Findings
1. **O(N²) Array Processing:**
   - *Issue:* Conflict resolution and counts during mapping loops (e.g., using `.filter(x => x.hash === i.hash).length` inside `renderRow`) causes O(N²) scaling.
   - *Recommendation:* As noted by the 'Bolt' agent, pre-compute counts using a `Map` or `WeakMap` cached mechanism prior to rendering to reduce this to O(N).
2. **DOM Update Thrashing:**
   - Large updates to the interaction list can cause layout thrashing. Implement a virtual list (windowing) for the interactions to ensure the UI remains responsive with 10,000+ recorded events.

## Security & Reliability Findings
1. **XSS via innerHTML:**
   - *Issue:* The Vanilla JS architecture relies on setting `.innerHTML`. While `escapeHtml` is used, complex templates are prone to missed variables.
   - *Recommendation:* Enforce the security convention that all template literals assigned to `innerHTML` must pass through a `sanitizeHTML()` wrapper (using DOMPurify).
2. **Insecure Global Test Hooks:**
   - *Issue:* Exposing `self.__echokitHandle` in the background worker for tests exposes internal message handling.
   - *Recommendation:* Guard this export with a strict environment check or strip it out for production builds.

## Testing Gaps
1. **CI Automation Disabled:**
   - The README notes CI is disabled due to a Chromium headless limitation. This is a massive reliability gap. Without automated PR checks, regressions will slip into the `main` branch.
2. **Missing Unit Tests for UI Logic:**
   - The logic in `app.js` is entirely untested at the unit level, relying solely on Playwright E2E smoke tests.

## Rules Compliance Findings
1. **File Size Limit Violation:** `extension/shared/app.js` (3264 lines) strictly violates `DEVELOPMENT_RULES.md` rule: "File < 2000 lines — must split".
2. **A11y Button Rule:** Ensure interactive UI elements use native `<button type="button">` tags rather than `<span>` with `role="button"` to ensure automatic keyboard accessibility, per 'Palette' rules.
3. **Pre-commit verification:** Missing automated checks. Running ESLint via `npm run lint` on modern Node (v22+) fails due to `ERR_IMPORT_ATTRIBUTE_MISSING` on `.eslintrc.json`.

## Recommended Refactor Plan

**Quick Wins (1-2 weeks):**
* Implement the O(N) `WeakMap` caching mechanism for UI counts to resolve the O(N²) rendering bottleneck.
* Fix the ESLint config for Node 22+ compatibility.
* Replace any `<span>` interactive elements with `<button>` for native a11y support.
* Add DOMPurify wrapper for all `innerHTML` assignments.

**Medium Effort (1-2 months):**
* Incrementally split `extension/shared/app.js` by extracting the state object and pure rendering functions into separate files.
* Abstract the storage/IndexedDB logic out of `background.js` to reduce its file size.

**Long-term Architecture Improvements (3-6 months):**
* Introduce a lightweight bundler (e.g., esbuild). This will allow importing the matcher logic into `injected.js` rather than hand-inlining it, drastically reducing the divergence risk.
* Re-enable CI automation by exploring alternative browser drivers or workarounds for the Chromium headless service worker bug.

---

### Top 10 Highest-Value Fixes
1. Introduce a build step to eliminate hand-inlined matcher logic duplication.
2. Fix O(N²) array filtering bottlenecks in UI rendering.
3. Fix ESLint import attribute missing error to restore linting pipeline.
4. Replace all interactive `<span>` elements with semantic `<button>` tags.
5. Create a `sanitizeHTML` wrapper for all `.innerHTML` assignments.
6. Re-enable GitHub Actions CI pipeline with a workaround for headless Chromium.
7. Wrap all JSON.parse and async storage reads in strict try/catch blocks globally.
8. Implement a virtual list (windowing) for the UI interactions list.
9. Guard `self.__echokitHandle` test exposure to only run in development.
10. Explicitly set `"browser": true` in `.eslintrc.json` overrides to fix `no-undef`.

### Top 10 Duplication-Removal Opportunities
1. `matcher.js` vs `injected.js` core hashing algorithm.
2. `match.js` (CLI) vs `matcher.js` (Extension) normalization logic.
3. UI Modal / Dialog creation logic in `app.js`.
4. DOM Event listener binding/unbinding logic across UI components.
5. `escapeHtml` utility defined in multiple UI files.
6. Local storage / sync storage retrieval boilerplate.
7. PostMessage bridge serialization logic.
8. Request/Response header formatting logic.
9. CSS class generation for status code colors.
10. Mock JSON payload validation checks.

### Top Reusable Abstractions Worth Introducing
1. Lightweight State Store (e.g., Zustand-lite pattern for Vanilla JS).
2. Typed Event Bus for Cross-World Messaging (Main <-> Isolated <-> Background).
3. Centralized API Request Interceptor Class (to replace the injected fetch/XHR monkey patch).
4. `sanitizeHTML` Template Tag function for secure DOM rendering.
5. Reusable Virtual List / Scroller component.

### Files/Components with Highest Technical Debt
1. `extension/shared/app.js`
2. `extension/injected.js` (due to inlined logic)
3. `extension/background.js`
4. `cli/lib/server.js`
5. `.eslintrc.json` (outdated standard)

### Suggested Engineering Standards Missing From the Repository
1. Mandatory Build Step for Frontend/Extension compilation.
2. Strict CSP validation in CI.
3. Unit Test Coverage Thresholds (currently only relying on E2E smoke tests).
4. Centralized Feature Flag Management (currently hardcoded as `FEATURES` object).
5. Automated Accessibility (a11y) linting for UI components.
