# EchoKit Engineering Review Report

## Executive Summary
**Overall Repo Health Score:** 6.5/10

**Biggest Risks:**
*   **Massive UI Monolith:** `extension/shared/app.js` is over 3200 lines, violating the 2000-line split rule in `DEVELOPMENT_RULES.md`. It handles rendering, state, and DOM events natively, risking memory leaks from stale closures and making feature expansion highly error-prone.
*   **State & DOM Coupling:** Heavy manual DOM manipulation within render loops (e.g., `renderRow`, `renderWaterfall`) causes O(N) performance bottlenecks and forces tight coupling between state updates and UI.
*   **Duplicate Matcher Logic:** The core request matching logic exists in three distinct places (`extension/shared/matcher.js`, `cli/lib/match.js`, and hand-inlined in `extension/injected.js`), creating a high risk of divergence and breaking the "Single Source of Truth Guarantee".
*   **Script Injection Pollution:** Variables and classes in `extension/injected.js` lack an IIFE, violating memory guidelines and risking conflicts with host applications running in the MAIN world.

**Highest ROI Improvements:**
*   **Componentize UI:** Migrate `extension/shared/app.js` to the component-based architecture described in `specs/UI_COMPONENTIZATION_IMPLEMENTATION.md`.
*   **Consolidate Matchers:** Unify the matching logic by building a shared module that is packaged or transformed automatically, removing manual syncing overhead.
*   **Optimize Filtering:** Precompute filtering arrays at the top level instead of executing O(N) operations inside render loops in `app.js`.

**Architecture Concerns:**
*   The absence of a bundler forces manual syncing of modules (like `injected.js`).
*   The "Single Source of Truth Guarantee" is documented (`specs/SINGLE_SOURCE_OF_TRUTH_GUARANTEE.md`) but actively violated by duplicated code.
*   Performance issues stem from repeated object creation (e.g., `new URL()`) inside tight loops during UI rendering.

## Critical Issues
*   **`extension/shared/app.js` Monolith:** At ~3243 lines, this file handles state, routing, DOM selection, rendering, and filtering. Violates the rule: files over 2000 lines must be split.
*   **Duplicate `matcher.js` implementations:** `extension/shared/matcher.js` (160+ lines), `extension/injected.js` (inline, 700+ lines), and `cli/lib/match.js` (100+ lines) share identical core logic. Changes to one require manual updates to the others.
*   **O(N) Performance bottlenecks in rendering:** In `extension/shared/app.js`, inline array `.filter()` calls and `new URL()` instantiations happen during render cycles (e.g., in `renderRow` and `groupByDomain`), severely impacting performance with large mock datasets.
*   **Missing IIFE in `extension/injected.js`:** Runs in the MAIN world without isolating its scope. Violates security and stability rules by potentially polluting the host window object.
*   **`eval`-like HTML injection risks:** Constructing complex HTML strings and manually inserting them requires strict sanitization. While `sanitizeHTML` is used, the pattern is fragile and error-prone compared to a virtual DOM or strict templating engine.

## Duplication Report
1.  **Request Matcher Logic:**
    *   **Locations:** `extension/shared/matcher.js`, `cli/lib/match.js`, `extension/injected.js`.
    *   **Impact:** A bug fix or feature (e.g., matching headers) must be implemented three times.
    *   **Suggestion:** Create a core `matcher.js` and use a minimal build step (or script) to bundle/inline it into the required locations.
2.  **HTML/DOM Construction:**
    *   **Locations:** `extension/shared/app.js`, `extension/shared/layouts.js`, `extension/shared/interaction-renderer.js`.
    *   **Impact:** Repeated string interpolation and manual sanitization.
    *   **Suggestion:** Abstract a generic DOM builder or templating function.
3.  **URL Parsing:**
    *   **Locations:** Throughout `app.js`, `interaction-helpers.js`.
    *   **Impact:** Re-instantiating `new URL()` degrades performance.
    *   **Suggestion:** Centralize around the `parseUrl` utility with its Map cache.

## Reusability Opportunities
1.  **UI Component Library:** Extract standard UI elements (buttons, inputs, toggles, chips) into a `components/` directory using vanilla JS factories to reduce DOM boilerplate in `app.js`.
2.  **State Store Wrapper:** The IndexedDB logic in `extension/shared/store.js` is good, but a unified pub/sub store could prevent prop/state drilling across `app.js` and `layouts.js`.
3.  **Event Delegation Manager:** Centralize event listener attachments (currently scattered across `app.js`) to avoid memory leaks when re-rendering lists.

## Architecture Review
*   **Scalability:** Poor. Adding new tabs or advanced filtering to the 3000-line `app.js` increases complexity exponentially.
*   **Maintainability:** Low. The lack of a bundler forces anti-patterns (hand-inlining code into `injected.js`).
*   **Observability:** Minimal. Error handling is mostly `console.error` and lacks a unified telemetry or error logging mechanism.
*   **Separation of Concerns:** Weak. UI layout (`layouts.js`), rendering logic (`interaction-renderer.js`), and state management (`app.js`) are heavily intertwined.

## Performance Findings
*   **Inefficient Render Loops:** Calling `.filter()` inside loops in `app.js` leads to O(K*N) complexity. Precompute filtered arrays once.
*   **URL Parsing Overheads:** Repeatedly calling `new URL()` in `renderRow` slows down rendering significantly. Use the cached `parseUrl`.
*   **DOM Thrashing:** Modifying `innerHTML` on large lists without windowing or chunking causes browser lag.

## Security & Reliability Findings
*   **XSS Vectors in DOM string construction:** Although `sanitizeHTML` is present, manual string interpolation (`${value}`) is risky.
*   **Unsafe Global Scope:** `extension/injected.js` injects variables into the MAIN world without an IIFE.
*   **CORS Override Weakness:** Modifying headers for CORS bypass must be carefully isolated to development environments to prevent security regressions.

## Testing Gaps
*   **Automated UI Tests:** The Python Playwright tests (`tests/smoke_echokit.py`) are robust but slow. Consider lightweight DOM integration tests in JS.
*   **Mock Coverage:** Testing IndexedDB with mock environments in Node.js requires careful setup to avoid module hoisting issues.
*   **Injected Script Tests:** No standalone tests verify the behavior of `injected.js` within a sandboxed mock page.

## Rules Compliance Findings
*   **Violated Rule:** "Functions over 150 lines must be refactored, and files over 2000 lines must be split."
    *   **Location:** `extension/shared/app.js` (~3243 lines).
    *   **Action:** Refactor incrementally according to `specs/UI_COMPONENTIZATION_IMPLEMENTATION.md`.
*   **Violated Rule:** "Single Source of Truth Guarantee"
    *   **Location:** Matcher logic duplicated in `cli/lib/match.js`, `extension/shared/matcher.js`, `extension/injected.js`.
    *   **Action:** Unify matcher logic.
*   **Violated Rule:** "All declarations within injected.js must be securely wrapped inside an IIFE."
    *   **Location:** `extension/injected.js`.
    *   **Action:** Wrap the entire file in `(() => { ... })();`.

## Recommended Refactor Plan
### Phase 1: Quick Wins (Days 1-3)
1.  Wrap `extension/injected.js` in an IIFE.
2.  Replace inline `new URL()` calls in `app.js` with the cached `parseUrl` utility.
3.  Precompute array filtering in `app.js` before passing to rendering functions.

### Phase 2: Medium Effort (Weeks 1-2)
1.  Extract component templates from `app.js` into modular files (e.g., `components/button.js`, `components/list.js`).
2.  Implement a simple build step (e.g., `esbuild` or custom script) to inject `matcher.js` into `injected.js` and `cli/lib/match.js` to enforce the Single Source of Truth.

### Phase 3: Long-term Architecture
1.  Complete the UI componentization plan from `specs/UI_COMPONENTIZATION_IMPLEMENTATION.md`.
2.  Migrate state management to a unified Vanilla JS store.

---

### Final Section

1. **Top 10 highest-value fixes:**
   1. Wrap `extension/injected.js` in an IIFE.
   2. Unify duplicated matcher logic (`match.js` / `matcher.js` / `injected.js`).
   3. Replace `new URL()` loops with cached `parseUrl()`.
   4. Precompute `.filter()` logic before UI rendering.
   5. Extract HTML templates out of `app.js`.
   6. Abstract DOM event delegation to a central handler.
   7. Enable `"browser": true` in ESLint to fix `no-undef`.
   8. Fix IndexedDB mock module hoisting in tests.
   9. Consolidate API recording state management.
   10. Implement native `<button>` tags for interactive chips (accessibility).

2. **Top 10 duplication-removal opportunities:**
   1. Matcher logic (`injected.js`, `cli/lib/match.js`, `shared/matcher.js`).
   2. HTML string templating and sanitization.
   3. URL parsing and formatting functions.
   4. Error handling and logging wrappers.
   5. IndexedDB access patterns (`get`, `set`, `getAll`).
   6. CSS class assignments in dynamic UI elements.
   7. Message passing wrappers (`chrome.runtime.sendMessage`).
   8. Feature flag checks (`getFeatures()`).
   9. Debounce function implementations.
   10. Date/time formatting logic.

3. **Top reusable abstractions worth introducing:**
   1. Universal Matcher Utility (bundled).
   2. Vanilla JS DOM Component Factory.
   3. Centralized Event Bus / PubSub for State.
   4. Cached URL Parser Module.
   5. Unified Logger/Telemetry Service.

4. **Files/components with highest technical debt:**
   1. `extension/shared/app.js` (massive size, state/UI coupling).
   2. `extension/injected.js` (no IIFE, manual code duplication).
   3. `extension/shared/layouts.js` (complex HTML interpolation).
   4. `cli/lib/match.js` (divergent logic risk).
   5. Test suite setup (complex mocking of browser globals).

5. **Suggested engineering standards missing from the repository:**
   1. Enforced module bundling for shared core logic (to stop hand-inlining).
   2. Strict templating guidelines (e.g., no raw template literals for DOM insertion without a typed builder).
   3. Centralized state management rules for Vanilla JS.
   4. Telemetry/error boundary definitions for the extension.
   5. Automated visual regression testing for UI components.
