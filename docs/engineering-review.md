# Repository Engineering Review

## Executive Summary
* **Overall Repo Health Score**: 70/100
* **Biggest Risks**: Extremely large "God files" (`extension/shared/app.js` is >3200 lines, `extension/background.js` is >1800 lines) which violate the max 2000 lines rule in `DEVELOPMENT_RULES.md`. Manual DOM manipulation and tight coupling between UI and data fetching logic make testing and scaling difficult.
* **Highest ROI Improvements**: Decompose `app.js` and `background.js` into smaller, highly cohesive modules. Implement a robust caching mechanism for O(N) URL parsing operations. Standardize Vanilla JS UI component creation.
* **Architecture Concerns**: The architecture relies heavily on imperative Vanilla JS, which is reaching its limit. There's a severe lack of separation of concerns in the UI layer (rendering, event handling, network, and storage are intermingled). State management is fragmented.

## Critical Issues
1. **God Files**: `extension/shared/app.js` (3252 lines) and `extension/background.js` (1816 lines) are far too large. They handle rendering, routing, state, and API communication.
2. **Performance Bottleneck (O(N) new URL())**: In `extension/shared/app.js`, `extension/background.js`, and `extension/injected.js`, repeatedly creating `new URL()` within loops (e.g., during array filtering or rendering lists) causes massive CPU spikes.
3. **Tight Coupling**: UI rendering logic is tightly coupled to specific DOM structures and `chrome.storage`/`IndexedDB` calls.
4. **Memory Leaks**: Potential unmanaged event listeners and closures in `app.js` during rapid DOM re-renders (soft rendering vs full wiping).

## Duplication Report
1. **DOM Element Creation**: Repeated `document.createElement`, `setAttribute`, `classList.add` blocks. Needs a shared helper or UI component factory.
2. **Message Passing**: `chrome.runtime.sendMessage` and `window.postMessage` logic is duplicated across `app.js`, `background.js`, `injected.js`, and `content.js` without a unified abstraction.
3. **Error Handling**: `try/catch` blocks for `JSON.parse` and `chrome.storage` are repeated everywhere.
4. **URL Normalization/Parsing**: Similar logic for parsing URLs and query strings exists in `matcher.js`, `app.js`, and `background.js`.

## Reusability Opportunities
1. **UI Component Factory**: Extract `createButton`, `createToggle`, `createModal` functions to standardise DOM creation and accessibility attributes (`aria-label`, `title`).
2. **Message Router**: A central `MessageBus` to handle cross-world/cross-script communication (`MAIN` to `ISOLATED` to `BACKGROUND`).
3. **State Management**: A lightweight `Store` or `PubSub` system to separate data fetching from UI rendering.
4. **Storage Abstraction**: Wrap `IndexedDB` and `chrome.storage` in a repository class (`StorageService`).

## Architecture Review
* **Scalability**: The vanilla JS architecture is straining under the weight of a >3000-line main app file. It is difficult for new developers to safely add features.
* **Maintainability**: Low. Finding specific bugs requires navigating massive files and tracking imperative DOM updates.
* **Separation of Concerns**: Poor. `app.js` contains business logic, layout management, event binding, and data fetching.
* **Extensibility**: Hard to extend without breaking existing fragile DOM references.
* **Consistency**: Inconsistent error handling and state updates.

## Performance Findings
* **Frontend Performance**: Repeated manual DOM updates and `.innerHTML` assignments are slower than necessary and risk layout thrashing. Soft rendering is attempted but complex to maintain manually.
* **Parsing Bottlenecks**: Heavy use of `JSON.parse` and `new URL()` in critical paths (e.g., filtering lists). Needs caching.
* **Bundle Size Risks**: While small now, continuing to build a custom UI framework inside `app.js` will bloat the extension.

## Security & Reliability Findings
* **XSS Risks**: Direct use of `.innerHTML` and unsanitized template strings in some UI components. The `sanitizeHTML` helper is present but must be strictly enforced.
* **Message Validation**: `content.js` must strictly validate `event.source === window` to prevent spoofing from malicious iframes.
* **JSON Parsing**: Unsafe `JSON.parse` operations could throw and halt execution if not properly wrapped (Rule: "Naked JSON.parse").

## Testing Gaps
* **Unit Tests**: Missing unit tests for critical UI logic in `app.js`. Testing relies almost entirely on Playwright E2E smoke tests which are fragile to UI changes.
* **Test Isolation**: Cannot easily test UI components in isolation because they depend heavily on the global `window.chrome` API and complex DOM state.
* **Edge Cases**: Missing tests for DNR rule limit exceptions and IndexedDB quota exceeded scenarios.

## Rules Compliance Findings
* **Violation of `.augment/rules` / `DEVELOPMENT_RULES.md`**:
  * **Rule**: "No file > 2000 lines; warning flag at 1000"
    * **Violation**: `app.js` (3252 lines), `background.js` (1816 lines).
  * **Rule**: "No magic numbers"
    * **Violation**: Hardcoded timeouts (e.g., 300ms debounce), layout dimensions, and API limits throughout the codebase.
  * **Rule**: "Function size within limits — no function > 150 lines"
    * **Violation**: Several rendering and initialization functions in `app.js` exceed this.

## Recommended Refactor Plan

### Phase 1: Quick Wins & Performance (Weeks 1-2)
1. **URL Caching**: Implement an LRU Map cache for `parseUrl` to eliminate O(N) performance bottlenecks in filtering/rendering.
2. **Magic Numbers Extraction**: Extract hardcoded limits, timeouts, and string literals into a central `constants.js` file.
3. **Message Validation**: Audit and fix all `window.addEventListener('message')` listeners to ensure strict `event.source === window` checks.

### Phase 2: Medium Effort Refactors (Weeks 3-4)
1. **Decompose `background.js`**: Split into `storage.js`, `dnr-manager.js`, `messaging.js`, and `license-check.js`.
2. **Create UI Component Factory**: Create `ui-components.js` to standardize the creation of Buttons, Toggles, and Inputs, enforcing `aria-label` and `title` parity.
3. **Storage Repository**: Abstract IndexedDB and Chrome Storage interactions into a centralized module.

### Phase 3: Long-term Architecture Improvements (Months 2-3)
1. **Decompose `app.js`**: Break down the 3200+ line monolith into smaller, focused modules (e.g., `sidebar.js`, `details-pane.js`, `toolbar.js`, `state-manager.js`).
2. **State Management**: Implement a simple Pub/Sub or unidirectional data flow architecture to decouple UI from data.
3. **Mock Environment for UI Tests**: Build a lightweight wrapper/mock for `chrome.*` APIs so UI components can be unit tested in Node using Jest/Mocha without a browser.

---

## Top 10 Highest-Value Fixes
1. Decompose `extension/shared/app.js` to eliminate the 3200+ line "God file" violation.
2. Decompose `extension/background.js` into cohesive domain modules.
3. Implement `urlHostCache` to prevent O(N) allocations in `new URL()` during list filtering.
4. Add strict `event.source === window` validation in `content.js` message listeners.
5. Extract DOM creation logic into a reusable `UIComponentFactory` to ensure accessibility and reduce duplication.
6. Centralize and wrap all `chrome.runtime.sendMessage` calls into a `MessageRouter`.
7. Enforce usage of `sanitizeHTML` for all dynamic HTML rendering to prevent DOM XSS.
8. Extract magic numbers (timeouts, sizes, limits) into `constants.js`.
9. Wrap all scattered `chrome.storage` calls into a single `StorageRepository`.
10. Refactor large functions (>150 lines) in `app.js` into smaller helper methods.

## Top 10 Duplication-Removal Opportunities
1. DOM element creation logic (imperative `createElement` sequences).
2. Cross-script messaging handlers and routers.
3. Error handling blocks for `JSON.parse` and storage APIs.
4. URL and query string normalization logic.
5. Layout computation for standard panes and lists.
6. Theme toggling and state persistence.
7. Status indicator and badge rendering.
8. IndexedDB transaction wrappers.
9. Fetch/XHR interception mocking logic in testing vs injected scripts.
10. Debounce and throttling utility functions scattered across files.

## Top Reusable Abstractions
1. **UI Component Factory**: Declarative wrapper for creating accessible DOM elements.
2. **State Manager / Event Bus**: Pub/sub system for decoupled UI reactivity.
3. **Message Router**: Typed wrapper for cross-world extension messaging.
4. **Storage Repository**: Unified async API for IndexedDB and Chrome Storage.
5. **Safe Renderer**: Centralized template parser and HTML sanitizer.

## Files with Highest Technical Debt
1. `extension/shared/app.js` (Violates size limits, God component)
2. `extension/background.js` (Violates size limits, tight coupling)
3. `extension/injected.js` (Complex fetch/XHR interception logic mixed with state)

## Suggested Engineering Standards
1. **Max File Size Enforcement**: Add an ESLint rule or CI script to strictly enforce the 2000-line limit.
2. **Component Architecture Guidelines**: Standardize how Vanilla JS UI components are structured, instantiated, and destroyed.
3. **State Management Pattern**: Document a required pattern (e.g., unidirectional flow) for managing application state.
4. **Accessibility (a11y) Baseline**: Require `title` and `aria-label` for all interactive elements.
5. **Mocking Standards**: Provide a standard `chrome.*` API mock library for frontend unit testing.
