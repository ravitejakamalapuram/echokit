# EchoKit Complete Engineering Review Report

## Executive Summary
* **Overall Repo Health Score:** B-
* **Biggest Risks:** High duplication of core hashing logic across boundaries (CLI vs Extension vs Injected), security vulnerabilities (DOM Clobbering in HTML sanitizers, XSS risks in manual HTML string building), and performance bottlenecks (O(N) `JSON.stringify` inside render loops, `Math.max(...array)` on large datasets).
* **Highest ROI Improvements:** Fix DOM Clobbering by enforcing `Element.prototype` methods, fix performance limits by removing spread syntax on large arrays, caching object stringification via `WeakMap` for O(1) filtering lookups, and replacing manual file syncing of `matcher.js` with an automated build step.
* **Architecture Concerns:** The extension heavily relies on a monolithic `app.js` (~3269 lines). Lack of reusable abstraction means boilerplate UI structures are manually repeated (e.g., non-semantic `<div class="ek-label">` without proper ARIA pairings). The manual inlining of `shared/matcher.js` into `injected.js` breaks single-source-of-truth. State updates rely on frequent `setInterval` polling rather than event-driven patterns.

## Critical Issues
1. **DOM Clobbering Vulnerabilities:** Code interacting with untrusted DOM elements (specifically sanitizers processing `el.attributes`) is using instance properties instead of `Element.prototype.getAttributeNames.call(el)`, exposing the extension to clobbered property exploits.
2. **XSS in URL Attributes:** HTML sanitizers fail to check for `javascript:` prefixes in all URL-accepting attributes (e.g., `action`, `xlink:href`), creating XSS bypass vectors.
3. **Severe O(N) Rendering Bottlenecks:** `filteredInteractions()` in `extension/shared/app.js` is repeatedly computing `JSON.stringify(body).toLowerCase()` inside render loops.
4. **Call Stack Limits:** Operations like `Math.max(...array)` used on large arrays (e.g., timelines or waterfalls) will crash with "Maximum call stack size exceeded".
5. **Manual File Syncing (Matcher):** `extension/shared/matcher.js` is hand-inlined into `extension/injected.js`, leading to desynchronization bugs.
6. **Mock State Desync:** `extension/injected.js` locally mutates shared mock state (`mockEnabled = false`) instead of relying on dynamic filtering (`mockCallCount < mockMaxCount`), breaking sync with `background.js`.

## Duplication Report
1. **Matcher Logic (CLI vs. Extension):** `cli/lib/match.js` and `extension/shared/matcher.js` share duplicated logic. Note: `DEVELOPMENT_RULES.md` / intent dictates zero-dependency for CLI, but it remains a technical debt.
   * *Suggestion:* Create a shared core package in the monorepo to generate both.
2. **Matcher Logic (Extension Shared vs. Injected):** The exact logic from `shared/matcher.js` is duplicated into `injected.js` manually, varying only by the base URL parameter (`location.href` vs configurable).
   * *Suggestion:* Introduce a lightweight bundler (e.g., `esbuild` or `Rollup`) for `injected.js` to automatically bundle `shared/matcher.js`.
3. **Form Labels and Dialogs:** `extension/shared/app.js` manually constructs dialog inputs wrapped in `<div class="ek-label">` repeatedly.
   * *Suggestion:* Abstract to a reusable `createInput()` or `InputGroup` function.

## Reusability Opportunities
1. **Accessible UI Component Factory:** A single reusable component builder for form inputs that automatically pairs `aria-label` and `title` attributes for screen readers, mitigating the non-semantic `div` wrapper issue.
2. **Caching Filter Utility:** A shared memoized filter utility that leverages `WeakMap` for caching `JSON.stringify` results, eliminating the need to parse bodies on every render loop.
3. **Safe DOM Access Utility:** A centralized utility (e.g., `safeGetAttribute(el, attr)`) wrapping `Element.prototype` to strictly prevent DOM clobbering across all sanitizers and DOM traversal code.
4. **Event Bus:** Replace `setInterval` polling with an event-driven pub/sub model for syncing IndexedDB changes to the UI.

## Architecture Review
* **Scalability:** The manual syncing of `matcher.js` is unscalable and error-prone. The `O(N)` inline filtering and `Math.max` array spreads severely limit the extension's capacity to handle thousands of interactions.
* **Maintainability:** `extension/shared/app.js` remains a monolithic bottleneck (3200+ lines). It handles DOM rendering, routing, filtering, and API calls.
* **Separation of Concerns:** `injected.js` mixes intercept logic with state mutation (mock counters), leading to background desyncs.

## Performance Findings
1. **Frontend Filtering:** Stringifying bodies inside the filter loop is an expensive O(N) operation. Utilize `WeakMap` for caching and favor `for...in` loops (with `hasOwnProperty` checks) over `Object.entries()`.
2. **Call Stack Overflows:** Use iterative loops for min/max calculations instead of spread syntax on arrays.
3. **Polling Overhead:** State updates rely on `setInterval` which is inefficient.

## Security & Reliability Findings
1. **DOM Clobbering:** Unsafe access via `el.attributes` instead of `Element.prototype.getAttributeNames.call(el)`.
2. **Sanitization Gaps:** `action` and `xlink:href` are missing from `javascript:` prefix checks.
3. **State Desync:** Local mutation of `mockEnabled` in `injected.js` causes divergence from the background script source of truth.
4. **Prototype Pollution:** `for...in` loops iterating over objects without `Object.prototype.hasOwnProperty.call(obj, key)` validation.

## Testing Gaps
1. **JSDOM DOM Clobbering Caveats:** JSDOM does not fully emulate browser-level DOM Clobbering for the `attributes` property. Tests for clobbering may pass in JSDOM but fail in real browsers.
   * *Suggestion:* Supplement with real browser testing (Playwright) for DOM sanitization correctness.
2. **UI Componentization E2E:** E2E UI testing should be integrated.

## Rules Compliance Findings
1. **Accessibility (ARIA):** Destructive action buttons (e.g., Wipe settings) lack matching `aria-label` and `title` pairs. Inputs within `<div class="ek-label">` lack `aria-label` and `title`.
   * *Impact:* Non-compliant with accessibility rules.
2. **Accessibility (Live Regions):** Dynamic toasts (`toast()`) are missing `role="status"` and `aria-live="polite"`.
   * *Impact:* Screen readers fail to announce notifications.

## Recommended Refactor Plan
### Quick Wins
1. Fix DOM clobbering by replacing `el.attributes` with `Element.prototype` methods in sanitizers.
2. Add `javascript:` prefix blocking to `action` and `xlink:href` attributes in sanitizers.
3. Refactor `Math.max(...array)` and `Math.min(...array)` to use iterative `for` loops.
4. Add `aria-label`, `title`, `role="status"`, and `aria-live="polite"` to required UI elements.
5. Fix `for...in` loops to use `hasOwnProperty`.

### Medium Effort Improvements
1. Optimize UI rendering by caching stringified representations in a `WeakMap` for `filteredInteractions()`.
2. Fix `mockEnabled` local mutations in `injected.js` by shifting to dynamic filtering logic (`mockCallCount < mockMaxCount`).
3. Replace manual DOM string construction for dialogs with reusable accessible UI component factories.

### Long-Term Architecture Improvements
1. Implement a build step (e.g., Rollup) to bundle `shared/matcher.js` into `injected.js`, eliminating manual syncing and establishing a single source of truth.
2. Decompose `extension/shared/app.js` into modular components.
3. Replace `setInterval` polling with a reactive EventBus model.

---

### 1. Top 10 highest-value fixes
1. Patch DOM Clobbering via `Element.prototype` methods.
2. Block XSS vectors in `action` and `xlink:href` attributes.
3. Replace `Math.max(...array)` with iterative loops to prevent call stack crashes.
4. Implement `WeakMap` caching for `JSON.stringify` filtering in render loops.
5. Fix local mutation of shared mock state (`mockEnabled = false`) in `injected.js`.
6. Apply `role="status"` and `aria-live="polite"` to `toast()` notifications.
7. Pair `aria-label` and `title` on all destructive action buttons.
8. Pair `aria-label` and `title` on `<input>` elements inside non-semantic label wrappers.
9. Enforce `hasOwnProperty` checks on all `for...in` loops.
10. Pre-compute filtered arrays instead of evaluating them repeatedly in nested components.

### 2. Top 10 duplication-removal opportunities
1. Bundle `extension/shared/matcher.js` into `extension/injected.js`.
2. Extract repetitive `<div class="ek-label">` markup into a unified `EkInput` UI helper.
3. Abstract safe DOM attribute access into a single utility file.
4. Centralize URL hash normalization logic across the monorepo (long-term CLI/Ext sync).
5. Extract mock state evaluation logic to prevent duplicate tracking between injected/background.
6. Centralize object stringification caching into a shared filter util.
7. Consolidate repetitive Toast/Notification creation logic.
8. Combine Timeline min/max calculation loops.
9. Combine empty-state HTML placeholders.
10. Extract primary/secondary button DOM generation to a shared component factory.

### 3. Top reusable abstractions worth introducing
* **DOM Clobbering Defense Wrapper:** `safeGetAttribute(el, attr)`
* **Accessible UI Component Factory:** `createInput({ label, title, ... })`
* **Memoized Filter Cache:** `const cachedStringify = new WeakMap()` wrapper.
* **Event Bus:** Replace `setInterval` polling for cross-component state updates.

### 4. Files/components with highest technical debt
* `extension/shared/app.js` (O(N) rendering, 3200+ lines, mixed concerns)
* `extension/injected.js` (Manual sync of matcher, local state mutation bugs)
* `extension/shared/matcher.js` (Requires manual cross-file syncing)

### 5. Suggested engineering standards missing from the repository
* **Automated Bundling:** Manual syncing of code (like `matcher.js` into `injected.js`) should be banned and replaced with a bundler.
* **DOM Safety Rules:** Enforce `Element.prototype` usage via ESLint for DOM interactions.
* **Strict A11y Standards:** Require `aria-label`/`title` pairs on interactive UI elements via linting.
* **Performance Budgets:** Prohibit O(N) operations and array spreads on unpaginated datasets in render loops.
