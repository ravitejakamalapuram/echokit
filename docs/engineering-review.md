# EchoKit - Daily Engineering Review Report

## Executive Summary
* **Overall Repo Health Score**: 72/100
* **Biggest Risks**: High cognitive load in UI layers, extreme duplication of DOM rendering logic, monolithic God files (`app.js`), potential performance issues when scaling to thousands of interactions, and a lack of standardized frontend architecture.
* **Highest ROI Improvements**: Splitting `extension/shared/app.js` into distinct component files according to the `specs/` documentation. Implementing a more scalable rendering mechanism (like virtual lists) for interaction grids.
* **Architecture Concerns**: The architecture is tightly coupled, mixing state management, event handling, and view rendering in global spaces. Hand-inlined code (e.g., matcher logic in `injected.js`) presents a synchronization risk. The use of string-based template generation leaves room for XSS if `escapeHtml` is forgotten.

## Critical Issues

1. **God Component Warning (`extension/shared/app.js`)**
   * **Issue**: The file is > 3,200 lines, violating the `< 2000 lines` limit in `DEVELOPMENT_RULES.md`. It handles rendering, events, state management, and business logic.
   * **Impact**: Decreased maintainability, high likelihood of merge conflicts, difficult to onboard new engineers, and prone to bug regressions.
   * **Fix**: Follow `specs/UI_COMPONENTIZATION_IMPLEMENTATION.md` to split this file into functional modules (e.g., `Header.js`, `List.js`, `Details.js`).

2. **Hand-Inlined Matcher Logic (`extension/injected.js`)**
   * **Issue**: ~100 lines of FNV-1a hashing logic is manually duplicated in `injected.js` because ES module imports are not permitted in the MAIN world script.
   * **Impact**: Changing the matcher in `extension/shared/matcher.js` but forgetting to update `injected.js` or `cli/lib/match.js` will silently break mock functionality.
   * **Fix**: Implement a build step or pre-commit script to auto-inline or verify parity of the hashing logic.

3. **Performance Risk: O(N) Re-Renders**
   * **Issue**: Interactions lists are rendered using `.map()` and `.filter()` operations over the entire `state.interactions` array directly inside the render loop.
   * **Impact**: Freezes the UI and causes lag when processing > 1,000 interactions.
   * **Fix**: Pre-compute filtered and sorted interaction arrays into a `WeakMap` or cached derived state object prior to rendering, and implement Virtual Scrolling.

## Duplication Report

1. **Fetch vs XHR Interception**
   * **File**: `extension/injected.js`
   * **Problem**: The setup logic for intercepting and logging `window.fetch` and `XMLHttpRequest` contains heavily duplicated patterns (header normalization, response parsing, message posting).
   * **Fix**: Extract a shared `RequestTracker` utility class/function to handle logging and response mocking for both APIs.

2. **UI Component Templates**
   * **Files**: `app.js`, `interaction-renderer.js`, `layouts.js`
   * **Problem**: Similar HTML structures (buttons, toggles, badges) are re-created manually via string interpolation multiple times.
   * **Fix**: Create a `components.js` file exposing functions like `Button(props)`, `Badge(props)`, which return sanitized HTML strings or DOM nodes.

3. **URL Parsing and Manipulation**
   * **Files**: `app.js`, `matcher.js`
   * **Problem**: URL parameters are parsed inline in various functions.
   * **Fix**: Unify around `parseUrl` and `prettyUrl` in `interaction-helpers.js`.

## Reusability Opportunities

1. **Pub/Sub State Management**
   * Currently, `state` in `app.js` is a globally mutable object. Introduce a simple `createStore` function that allows subscribing to specific state keys to trigger targeted re-renders.

2. **Form and Filter Abstractions**
   * The Advanced Filters panel in DevTools has manual DOM bindings for every input. A reusable `useForm` or `FilterForm` component would reduce boilerplate.

3. **API Client for Chrome Messaging**
   * Calls to `chrome.runtime.sendMessage` are wrapped individually. Create a typed, reusable API service map to handle message passing and error catching safely.

## Architecture Review

* **Scalability**: The vanilla JS, string-based innerHTML rendering will not scale well visually or performantly for complex interactive tables. The application needs a structured component model.
* **Layering**: UI is heavily mixed with DB access (IndexedDB reads) and Chrome API calls. These should be separated into a `services/` layer, a `store/` layer, and a `views/` layer.
* **Separation of Concerns**: Inconsistent handling of events. Some are inline HTML attributes (avoided generally, but risks remain), others are global event delegation `document.addEventListener('click')` with massive `switch` or `if/else` chains in `app.js`.

## Performance Findings

1. **URL Parsing Overhead**:
   * Repeatedly creating `new URL()` inside `app.js` map/filter loops causes garbage collection spikes. Use cached URL parsers (implemented partially, needs full adoption).
2. **List Rendering**:
   * Re-rendering the entire `.echokit-list` on single state changes (like selecting an item) causes layout thrashing. Implement precise DOM updates (e.g., toggling `.active` class directly via element reference).

## Security & Reliability Findings

1. **XSS via innerHTML**:
   * The usage of `sanitizeHTML` is good, but relies on developer discipline to use `escapeHtml` consistently. Direct DOM creation (`document.createElement`) or a safer templating library is recommended for long-term security.
2. **Missing Try/Catch on Chrome APIs**:
   * Some `chrome.storage.sync.get` and IndexedDB operations are not wrapped in `try/catch`, violating `DEVELOPMENT_RULES.md`.

## Testing Gaps

* **UI Logic Tests**: No unit tests exist for the massive `app.js` file or the complex filtering logic.
* **Mock Hashing Tests**: Need robust tests covering identical outputs between `shared/matcher.js`, `injected.js`, and `cli/lib/match.js`.

## Rules Compliance Findings

1. **God File Rule Violation**:
   * `extension/shared/app.js` is 3,243 lines. Limit is < 2000 lines.
2. **Error Handling Rule Violation**:
   * Missing `try/catch` wrappers around several `JSON.parse` operations in `app.js`.

## Recommended Refactor Plan

* **Quick Wins (This Week)**:
  * Extract formatting and URL helpers from `app.js` to `interaction-helpers.js`.
  * Ensure all `JSON.parse` calls are wrapped in `try/catch`.
* **Medium Effort (Next Sprint)**:
  * Decompose `app.js` into `Header`, `FilterPanel`, `InteractionList`, and `DetailView` modules.
  * Extract fetch/XHR shared logic in `injected.js`.
* **Long-Term Architecture (Next Quarter)**:
  * Migrate the DOM rendering engine to a lightweight virtual DOM or standard reactive framework (e.g., Preact) if allowed by strict MV3 constraints, or build a strict vanilla JS reactive tree.
  * Implement automated testing to verify the parity of the hand-inlined matcher function.

## Top 10 Highest-Value Fixes
1. Split `extension/shared/app.js` into logical component files.
2. Implement Virtual Scrolling for the interaction list to prevent UI freezing.
3. Consolidate `fetch` and `XHR` interception logic into a single class in `injected.js`.
4. Replace all manual array filtering loops in renders with pre-computed cached arrays.
5. Create an automated test for FNV-1a matcher parity across all 3 implementations.
6. Wrap all unguarded `JSON.parse` and `chrome.storage` calls in try/catch blocks.
7. Refactor the global event delegation `click` handler in `app.js` into component-level listeners.
8. Unify status code to color mapping into a single helper function.
9. Refactor the manual DOM updates for UI selection (e.g., `.active` class toggling) to avoid full list re-renders.
10. Remove any hardcoded `new URL()` calls inside loop renders, using cached parsers instead.

## Top 10 Duplication-Removal Opportunities
1. List row rendering (Popup vs DevTools).
2. Detail view rendering (Popup vs DevTools).
3. `fetch` and `XMLHttpRequest` interception headers/body parsing.
4. FNV-1a hash implementations.
5. Search bar input debouncing.
6. Timestamp formatting and duration calculation.
7. Mock response template generation.
8. Status code and method badge HTML string generation.
9. Theme toggling and initialization logic.
10. Scope mode (domain/tab/global) filter evaluation logic.

## Top Reusable Abstractions Worth Introducing
1. `PubSub` State Manager (to decouple state from views).
2. `VirtualList` Component (for rendering thousands of rows efficiently).
3. `Interceptor` base class for `injected.js`.
4. `SafeTemplate` tagged literal for innerHTML.

## Files with Highest Technical Debt
1. `extension/shared/app.js` (Size, Complexity)
2. `extension/injected.js` (Duplication, Manual inline code)
3. `extension/shared/styles.css` (Unorganized, missing design tokens)
4. `cli/lib/server.js` (Mixed responsibilities)

## Suggested Engineering Standards Missing From the Repository
1. Strict component lifecycle guidelines (Mount/Update/Unmount).
2. Automated visual regression testing for UI components.
3. Performance budgets (e.g., List render must be < 16ms).
4. Centralized Dictionary/Constants file for all `echokit:*` message types.
