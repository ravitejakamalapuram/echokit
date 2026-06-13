# EchoKit - Daily Engineering Review Report

## Executive Summary
**Overall Repo Health Score:** 68/100 (Moderate Risk)

The EchoKit repository demonstrates a functional and capable product but suffers from significant architectural drift, excessive duplication of critical business logic, and a monolithic frontend file structure that severely impedes maintainability. The codebase heavily biases towards rapid prototyping over enterprise-grade maintainability.

**Biggest Risks:**
1. **Critical Logic Duplication:** The matcher logic is hand-inlined across three separate environments (`extension/shared/matcher.js`, `extension/injected.js`, `cli/lib/match.js`). If one diverges, exported mocks will fail in headless mode.
2. **Monolithic UI:** `extension/shared/app.js` is a 3,200+ line god file that violates the 2,000-line limit in `DEVELOPMENT_RULES.md`. It tightly couples state, rendering, and DOM manipulation.
3. **XSS & Security Vulnerabilities:** Widespread use of `innerHTML` with template literals throughout `app.js` and `layouts.js`. While `sanitizeHTML` is present, inline DOM construction creates risk.
4. **Performance Bottlenecks:** Chained `filter()` operations on O(N) lists inside render loops, and repeated `new URL()` instantiation.

**Highest ROI Improvements:**
* Modularize `app.js` into distinct component files using the componentization strategy defined in the `specs/` folder.
* Create a single, tested build step (or shared package) for `match.js` that can be imported by the CLI, Service Worker, and injected into the MAIN world, rather than manually mirroring code.

**Architecture Concerns:**
The "Single Source of Truth" strategy is poorly enforced in implementation. The project uses ES Modules but still manually inlines code for the injected MAIN world script to avoid bundlers, leading to structural code duplication.

---

## Critical Issues

1. **Monolithic App.js God File**
   * **Location:** `extension/shared/app.js` (3,243 lines).
   * **Impact:** Violates the maximum 2,000 lines rule. Extremely difficult to test, debug, or onboard new engineers. Causes massive git merge conflicts.
   * **Fix:** Follow the `specs/UI_COMPONENTIZATION_IMPLEMENTATION.md` to split into smaller rendering classes (e.g., `InteractionList`, `DetailPanel`, `Header`).

2. **Divergent Matcher Logic**
   * **Location:** `extension/shared/matcher.js`, `extension/injected.js` (lines ~200-350), `cli/lib/match.js`.
   * **Impact:** The hash generation (`fnv1a`), URL normalization, and GraphQL parsing must be identical across all three files. Currently, developers must "manually mirror" changes. This is a severe architectural anti-pattern and a high risk for data corruption/incompatibility.
   * **Fix:** Extract to a standalone `/packages/matcher` module, and use a lightweight bundler (esbuild/rollup) exclusively for generating the `injected.js` payload.

3. **Insecure DOM Construction**
   * **Location:** `extension/shared/app.js` (e.g., lines 360, 710, 2326), `extension/shared/layouts.js`.
   * **Impact:** Reliance on `innerHTML = sanitizeHTML(string)` is fragile. While `sanitizeHTML` provides some protection, manual string interpolation for complex UI state is error-prone and invites DOM XSS.
   * **Fix:** Transition to standard DOM APIs (`document.createElement`) or a lightweight virtual DOM wrapper.

---

## Duplication Report

1. **Matcher Hash Generation & Normalization**
   * **Spread:** 3 separate files (`matcher.js`, `injected.js`, `cli/lib/match.js`).
   * **Problem:** Duplicating cryptographic hash generation (`fnv1a`) and GraphQL parsing means a bug fix in one place must be manually copied to two others.
   * **Abstraction:** Consolidate into a single isomorphic library.

2. **Empty State & Overlay Rendering**
   * **Spread:** Widespread throughout `app.js` (`overlay.innerHTML = ...`).
   * **Problem:** Repeated modal/overlay wrapper boilerplate.
   * **Abstraction:** Create a reusable `Modal.show(title, contentNode)` component.

3. **Error Handling & API Fetching**
   * **Spread:** `background.js`, `store.js`.
   * **Problem:** Repeated `try/catch` blocks for `indexedDB` and `JSON.parse` operations.
   * **Abstraction:** Create generic wrapper functions like `safeParseJSON(string, fallback)` and `executeIdbRequest(req)`.

---

## Reusability Opportunities

1. **UI Component Factory (Frontend)**
   * **Tight Coupling:** `app.js` mixes DOM lookup, event binding, state mutation, and string rendering.
   * **Suggestion:** Introduce reusable UI building blocks (e.g., `Button`, `Table`, `Badge`) that manage their own ARIA states and event listeners.

2. **URL Parsing Cache (Shared)**
   * **Leakage:** `app.js` frequently instantiates `new URL()` inline.
   * **Suggestion:** The `parseUrl` utility from `interaction-helpers.js` should be the standard everywhere. Ensure developers do not mutate the returned object from the `urlCache`. Add an `Object.freeze()` to the cached object in dev environments to prevent cross-request corruption.

3. **Storage Access Layer (Backend/Worker)**
   * **Tight Coupling:** IndexedDB queries are scattered and specific.
   * **Suggestion:** Build a generic generic repository pattern on top of `store.js` for interacting with storage.

---

## Architecture Review

* **Scalability:** Poor. Adding new features to `app.js` is becoming exponentially harder due to its size.
* **Maintainability:** Poor. The lack of a bundler forces manual code duplication (e.g., `injected.js`).
* **Testability:** Weak. UI logic is untestable via unit tests because it relies entirely on the global DOM and `chrome.*` APIs being present.
* **Separation of Concerns:** Violated in `app.js`, which acts as Model, View, and Controller simultaneously.

---

## Performance Findings

1. **O(N) Operations inside Render Loops**
   * **Location:** `extension/shared/app.js` filtering logic.
   * **Concern:** Sequential `.filter()` chaining inside the main render loop. For large interaction lists (e.g., 5,000+ items), this causes massive garbage collection overhead and blocking of the main thread.
   * **Fix:** Pre-compute filtered arrays once or use a single-pass `reduce`/`for` loop with early exits.

2. **URL Instantiation**
   * **Location:** `matcher.js` and inline rendering.
   * **Concern:** Calling `new URL()` in tight loops is expensive.
   * **Fix:** Enforce usage of the memoized `parseUrl` helper.

---

## Security & Reliability Findings

1. **Global Variable Pollution in Service Worker**
   * **Location:** `extension/background.js`.
   * **Concern:** The `.eslintrc.json` overrides define `browser: true` and `serviceworker: true`, but explicit care must be taken that local `localStorage` and `AbortController` usage respects MV3 limitations.
   * **Fix:** Ensure no DOM API calls leak into the SW context.

2. **JSON Serialization Risks**
   * **Location:** `cli/test/test.js` and IPC messaging.
   * **Concern:** Data anomalies (BigInt, circular refs) cause silent crashes during IPC messaging or mock export.
   * **Fix:** Implement robust, cycle-safe JSON stringifiers.

---

## Testing Gaps

1. **UI Component Testing:** `app.js` has zero isolated unit tests because it cannot run outside a browser context without massive mocking.
2. **End-to-End CI Integration:** Playwright tests exist (`tests/smoke_echokit.py`) but are documented as "locally only" due to Chromium headless limitations with service workers. This means PRs can easily break the build if developers forget to run tests locally.
3. **Unit Tests for Matcher Parity:** There are tests, but they don't dynamically verify that `injected.js`, `matcher.js`, and `match.js` produce the identical hash *at runtime* against the exact same test vector suite.

---

## Rules Compliance Findings

1. **File Size Rule Violation:** `extension/shared/app.js` is 3,243 lines. `DEVELOPMENT_RULES.md` states: "Functions over 150 lines must be refactored, and files over 2000 lines must be split."
2. **JSDoc Missing:** Many internal helper functions lack JSDoc, violating documentation rules.
3. **Magic Strings:** Hardcoded HTML strings and CSS class names inside JS logic instead of referencing constants.

---

## Recommended Refactor Plan

**Phase 1: Quick Wins (1-2 Days)**
* Replace all chained `.filter()` calls in UI rendering with single-pass loops.
* Enforce `parseUrl()` caching everywhere instead of `new URL()`.
* Add `Object.freeze` to cached URLs to prevent mutation bugs.

**Phase 2: Medium Effort (1-2 Weeks)**
* Create a dedicated bundler script strictly for `injected.js` to compile `matcher.js` into the payload, eliminating the manual code duplication.
* Write unit tests that dynamically import all three matcher implementations and assert output parity.

**Phase 3: Long-term Architecture (1-2 Months)**
* Execute the UI Componentization strategy (`specs/UI_COMPONENTIZATION_IMPLEMENTATION.md`) to decompose `app.js` into modular class-based components.
* Migrate from `innerHTML` string interpolation to a safer DOM rendering paradigm (e.g., standard `document.createElement` abstractions).

---

## Top 10 Highest-Value Fixes
1. Refactor `app.js` to break it down below 2,000 lines.
2. Setup a bundler for `injected.js` to eliminate matcher duplication.
3. Optimize chained `.filter()` operations into a single O(N) pass.
4. Replace raw `innerHTML` interpolations with safer abstractions.
5. Apply `Object.freeze` to the `parseUrl` cache to prevent mutation bugs.
6. Centralize IndexedDB `try/catch` error handling logic.
7. Implement cycle-safe JSON stringification for message passing.
8. Add automated tests to ensure cross-environment matcher parity.
9. Refactor overlay/modal HTML strings into a single reusable UI component.
10. Ensure ARIA states are dynamically linked via string interpolation properly in UI toggles.

## Top 10 Duplication-Removal Opportunities
1. Hand-inlined matcher hash generation (`fnv1a`).
2. GraphQL operation parsing logic across 3 environments.
3. URL normalization and query stripping logic.
4. `body` stringification logic.
5. Repeated `overlay.innerHTML` wrapper strings in `app.js`.
6. Error handling `try/catch` blocks for `JSON.parse`.
7. IndexedDB request handling wrappers.
8. DOM selection and event listener attachment boilerplate.
9. Empty state HTML rendering blocks.
10. Date/Time formatting inline blocks.

## Top Reusable Abstractions
1. **Isomorphic Matcher Module**: Shared logic compiled for Node, SW, and injected contexts.
2. **Safe DOM Renderer**: A utility to safely create DOM elements without `innerHTML`.
3. **Modal/Overlay Component**: A reusable class to handle popup overlays.
4. **IDB Repository Layer**: Generic wrappers for IndexedDB CRUD operations.
5. **Cycle-Safe JSON Parser/Stringifier**: Unified data serialization utility.

## Files with Highest Technical Debt
1. `extension/shared/app.js` (3,243 lines, violates size limits, tight coupling).
2. `extension/injected.js` (736 lines, manual duplication of matcher logic).
3. `extension/shared/layouts.js` (heavy reliance on `innerHTML`).
4. `cli/lib/match.js` (manual duplication, drift risk).
5. `extension/background.js` (1,800+ lines, growing monolithic service worker).

## Missing Engineering Standards
1. **Automated CI/CD Test Enforcement**: E2E tests are manual/local only. CI must run tests using `xvfb` or new headless mode.
2. **Bundler Usage for Injected Contexts**: Lack of a build step for injected scripts leads to anti-patterns.
3. **UI Testing Paradigm**: No component-level testing framework (e.g., Vitest/JSDOM) is present for the frontend.
4. **Strict Content Security Policy (CSP)**: `innerHTML` usage implies weak CSP enforcement regarding inline scripts/templates.
5. **Mutation Prevention**: No standard mechanism (like `Object.freeze`) to prevent mutation of cached shared state objects.
