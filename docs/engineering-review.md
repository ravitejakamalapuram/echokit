# EchoKit - Comprehensive Engineering Review

## Executive Summary

* **Overall Repo Health Score**: 60/100
* **Biggest Risks**: High security risk from extensive `innerHTML` usage with `sanitizeHTML` which may be bypassed (DOM XSS risk). Heavy performance bottlenecks during list rendering in `app.js` (O(N^2) loops and redundant parsing). No build step constraints lead to code duplication across MV3 worlds.
* **Highest ROI Improvements**: Componentize `extension/shared/app.js` to fix rendering logic duplication and performance drops. Extract shared `innerHTML` template functions to use proper DOM creation or robust component libraries. Adopt a minimal build step (e.g., esbuild/vite) to share code seamlessly between `background.js`, `injected.js`, and `app.js`.
* **Architecture Concerns**: The "Zero Build Step" philosophy forced architectural workarounds like duplicating `matcher.js` into `injected.js` and creating a 2800+ line God file (`app.js`). This limits scalability and makes onboarding difficult.

## Critical Issues

* **God Component (`extension/shared/app.js`)**: `app.js` handles state management, routing, UI rendering for both Popup and DevTools, and complex DOM manipulations. At ~3200 lines, it exceeds the 2000-line limit mandated by `DEVELOPMENT_RULES.md` and violates single-responsibility principles.
* **DOM XSS Risks via `innerHTML`**: Over 15 instances of `element.innerHTML = sanitizeHTML(...)` exist in `app.js` and `layouts.js`. This is a fragile pattern that risks XSS if `sanitizeHTML` is ever misconfigured or bypassed.
* **Performance Bottleneck in Rendering**: Rendering loops inside `app.js` (like `renderListView` and `groupByDomain`) reconstruct elements, instantiate `new URL()` continuously, and perform sequential `.filter()` operations over interactions, causing O(N^2) complexity that degrades performance with 1000+ items.
* **Manual Mirroring of Logic**: `extension/injected.js` runs in the MAIN world and cannot use ES modules natively due to the lack of a bundler. Thus, `matcher.js` logic is hand-inlined into `injected.js`. A single desync breaks the entire record/replay pipeline.

## Duplication Report

* **Matcher Logic**: The FNV-1a hashing and URL/body normalization logic in `extension/shared/matcher.js` is manually duplicated inside `extension/injected.js`.
  * *Impact*: High risk of hashing desynchronization. If updated in one place but not the other, mocks will fail to replay.
  * *Fix*: Implement a minimal build step (e.g., `esbuild` or `Rollup`) specifically to bundle `injected.js` with its dependencies so `matcher.js` can be imported natively.
* **UI Rendering Templates**: `app.js` contains duplicated HTML string templates for popup and devtools rows (e.g., `renderRow`, `renderGroupedRow`).
  * *Impact*: Making a small UI change requires updating multiple string literals.
  * *Fix*: Extract a shared component system (like the proposed `specs/UI_COMPONENTIZATION_IMPLEMENTATION.md`) to reuse templates.
* **DOM Event Listeners**: Multiple places bind similar `click` and `input` events with debouncing logic for searches and filters.
  * *Fix*: Create a global event delegation system or custom hooks/utilities for common UI interactions.

## Reusability Opportunities

* **DOM Update Engine**: Instead of manually wiping and rewriting `innerHTML`, introduce a small Virtual DOM utility or reactive state binder (e.g., `lit-html` or a lightweight proxy-based reactive store) to reuse DOM updates safely.
* **Event Delegation Manager**: Extract a reusable event listener manager to handle `data-action="..."` clicks globally, replacing multiple independent `addEventListener` attachments.
* **URL Parsing Cache Module**: The `new URL()` calls inside tight loops should be abstracted into a `CachedURLParser` utility that memoizes results to avoid performance hits during large list renders.
* **Storage Wrapper**: Unify `chrome.storage.local`, `chrome.storage.session`, and `IndexedDB` access behind a unified asynchronous storage service interface.

## Architecture Review

* **Scalability**: Poor. The current architecture hits a wall due to the lack of a bundler. Adding more features to `app.js` will eventually make it unmaintainable.
* **Maintainability**: Low for frontend, moderate for backend (`cli/` and `worker/` are well-structured). The `app.js` file is too complex and mixes state, business logic, and view logic.
* **Readability**: The heavy use of string-based HTML templates makes syntax highlighting and linting ineffective for UI components.
* **Separation of Concerns**: Lacking in the frontend. `app.js` acts as a controller, view, and model.
* **Extensibility**: Difficult. Adding new UI columns requires updating dual rendering paths (table vs. grouped).

## Performance Findings

* **Frontend**:
  * Array filtering inside render loops causes O(K*N) complexity. Repeatedly calculating `interactions.filter(...)` per render cycle destroys frames.
  * Calling `new URL(url)` for every interaction inside `groupByDomain` during popup rendering causes high garbage collection overhead.
  * Overwriting `innerHTML` drops focus state, requiring manual focus/selection restoration hacks as seen in `app.js` line 396.
* **Backend (`cli/`)**:
  * Good performance overall. The mock server responds quickly.

## Security & Reliability Findings

* **Unsafe Data Handling**: The extension relies heavily on `sanitizeHTML` for dynamically rendered content. While it mitigates some risk, using `textContent` or standard DOM methods (`document.createElement`) is significantly safer for user-provided data (like API bodies and URLs).
* **Missing CSP Constraints**: Since string templates are used to build DOM, any future introduction of complex interactions might lead to template injection.
* **Reliability**: Manual syncing of the `matcher.js` algorithm into `injected.js` is a ticking time bomb.

## Testing Gaps

* **Missing Component Tests**: UI components (like the waterfall timeline or domain groups) lack isolated unit tests.
* **E2E Brittle Automation**: E2E tests are implemented in Python (`tests/smoke_echokit.py`) but lack CI integration due to headless Chromium limitations with service workers. This forces manual local testing.
* **Missing Negative Tests**: Ensure invalid payloads or corrupted IndexedDB state are handled gracefully without crashing the UI.

## Rules Compliance Findings

* **File Size Limits**: `extension/shared/app.js` is ~3200 lines, violating the `< 2000 lines` rule in `DEVELOPMENT_RULES.md`.
  * *Impact*: Difficult to read, prone to merge conflicts.
  * *Implementation*: Split `app.js` into `state.js`, `events.js`, `render.js`, and `components/`.
* **Zero Dependencies Constraint**: While enforced, this is actively harming the architecture (forcing code duplication in `injected.js`). A build step for the extension is strongly recommended to resolve these issues.

## Recommended Refactor Plan

### Quick Wins (0-2 weeks)
* Extract a `parseUrl` caching utility to optimize the `groupByDomain` and `render` loops in `app.js`.
* Pre-compute filtered arrays in `app.js` before mapping to avoid O(N^2) complexity.

### Medium Effort Improvements (2-6 weeks)
* Implement UI Componentization (`extension/shared/columns.js`, `layouts.js`, etc.) to break down `app.js` templates into modular functions.
* Replace `innerHTML` with `document.createElement` or a micro-framework (like `uhtml` or `lit-html`) to eliminate XSS vectors.

### Long-Term Architecture Improvements (2-3 months)
* Introduce a lightweight build step (e.g., `esbuild`) for the Chrome extension to bundle `injected.js` properly, eliminating the need to manually inline `matcher.js`.
* Abstract the storage layer into a unified interface to simplify mocking and caching.

---

## 1. Top 10 highest-value fixes
1. Cache `new URL()` parsing in UI rendering loops to fix severe performance bottlenecks.
2. Pre-compute filtered interaction arrays instead of chaining `.filter()` during renders.
3. Replace `innerHTML` string interpolation with safe DOM methods (`textContent`) to fix DOM XSS vulnerabilities.
4. Remove duplicated matcher logic from `injected.js` via a bundler or shared loader.
5. Abstract table row and grouped row rendering into shared functional components.
6. Extract global state management out of `app.js` into a dedicated `store-manager.js`.
7. Move event listener registration in `app.js` to a centralized event delegator.
8. Add unit tests for the `sanitizeHTML` utility.
9. Fix keyboard accessibility for interactive chips (`span` to `button` tags).
10. Ensure dynamic ARIA states (`aria-expanded`, `aria-pressed`) update properly in `app.js`.

## 2. Top 10 duplication-removal opportunities
1. `matcher.js` duplicated inside `injected.js`.
2. Row rendering templates for DevTools (table) vs. Popup (grouped).
3. Search and filter debouncing logic duplicated across different input handlers.
4. Error handling try-catch blocks for `JSON.parse` across multiple modules.
5. Timestamp formatting logic.
6. Copy-to-clipboard feedback UI popups.
7. Interaction mock status toggling logic.
8. Local storage and sync storage read/write wrappers.
9. Domain parsing and grouping logic.
10. Source badge rendering for different feature modes.

## 3. Top reusable abstractions worth introducing
1. **URL Parsing Cache**: A module-level `Map` cache for parsed URLs.
2. **Virtual DOM / Template Engine**: A safe wrapper around DOM creation replacing `innerHTML`.
3. **Global Event Delegator**: A single listener on `document.body` handling `[data-action]`.
4. **State Machine Hook**: A centralized way to manage and subscribe to state changes.
5. **Storage API Client**: A unified wrapper for Chrome Storage and IndexedDB.
6. **Reusable Debounce/Throttle Hook**: For all input fields.
7. **UI Component Factory**: A standardized way to define layout columns (as per specs).
8. **Theme Manager**: A centralized handler for light/dark mode persistence.
9. **Error Boundary**: A top-level UI catch for rendering failures.
10. **Safe JSON Parser**: A utility wrapping `JSON.parse` with strict validation.

## 4. Files/components with highest technical debt
1. `extension/shared/app.js` (~3200 lines, god object).
2. `extension/injected.js` (hand-inlined matcher logic).
3. `extension/background.js` (large service worker managing diverse logic).
4. `extension/shared/layouts.js` (heavy `innerHTML` usage).
5. UI filtering logic (inefficient sequential passes).

## 5. Suggested engineering standards missing from the repository
1. **Bundler Integration**: A standard build step (like Vite or Rollup) to allow ES module imports in all worlds.
2. **Component Framework**: Adoption of a lightweight UI framework (e.g., Preact or Lit) to handle safe reactivity.
3. **Automated CI for E2E**: Moving the Playwright tests from manual local scripts to automated GitHub Actions.
4. **Strict CSP enforcement**: Ban `unsafe-inline` and enforce strict template validation.
5. **CSS Variables & Design Tokens**: Formalizing color and spacing into a single `:root` token file for consistency.
