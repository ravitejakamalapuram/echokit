# Engineering Review Report

## Executive Summary
* **overall repo health score:** B (Strong functionality, but monolithic frontend)
* **biggest risks:** Huge files (`extension/shared/app.js`), high coupling between UI/logic, duplicated logic between CLI/extension
* **highest ROI improvements:** Decomposing `app.js` into smaller reusable components, unifying duplicate matcher logic if possible (or accepting it for zero-dependency), centralizing API/storage layers
* **architecture concerns:** Lack of a component-based frontend framework (Vanilla JS DOM manipulation), heavy use of polling (`setInterval`) for state updates

## Critical Issues
1. **Monolithic UI:** `extension/shared/app.js` is over 3,200 lines long, combining state management, business logic, rendering, and DOM event handling. It's difficult to maintain, test, and scale.
2. **Polling for State:** `app.js` relies on `setInterval` polling to check for IndexedDB updates instead of an event-driven architecture (like Service Worker message passing or `storage` events).
3. **Vanilla DOM Manipulation Risks:** Extensive use of `innerHTML` with `escapeHtml` is used. While `sanitize.js` exists, the manual DOM string construction is error-prone and a constant XSS risk if an escape is missed.

## Duplication Report
1. **Matcher Logic:** `cli/lib/match.js`, `extension/shared/matcher.js`, and `extension/injected.js` contain duplicated URL normalization, checking, and FNV-1a hashing logic.
    * *Why problematic:* Bug fixes must be applied in three places manually.
    * *Spread:* Core matching logic.
    * *Suggestion:* Create a single source of truth for the matching logic, even if it has to be bundled or copied via build step to maintain CLI zero-dependency.
2. **Form / Label Structures:** The UI constructs inputs and labels manually with non-semantic `div.ek-label` elements across settings, export, and details panels.
    * *Why problematic:* Reduces accessibility and causes visual inconsistencies.
    * *Spread:* Across all dialog/form renderings in `app.js`.
    * *Suggestion:* Abstract a reusable `InputGroup` or `FormField` component that guarantees a connected `<label>` and proper `aria-label`/`title` attributes.

## Reusability Opportunities
1. **Reusable UI Components:** Extract common UI elements (Buttons, Inputs, Dialogs, Toasts) into standard functions or classes (e.g., `renderButton`, `showModal`) to reduce boilerplate and standardize styling.
2. **State Management Hook/Abstraction:** Replace `setInterval` polling with a reusable `useStore` or `StorageService` that abstracts IndexedDB and provides a subscription mechanism for UI updates.
3. **API Client:** Standardize `fetch` calls and error handling into a reusable API client for interacting with the background script or external services.

## Architecture Review
* **Scalability:** Manual DOM diffing and re-rendering whole lists will not scale well with thousands of interactions. A virtualized list or proper reactive framework is needed.
* **Maintainability:** `app.js` is a god component. Needs decomposition.
* **Separation of Concerns:** Logic, state, and UI are tightly coupled in the vanilla JS files.
* **Layering:** Missing a distinct data/service layer in the frontend. Everything is in the view layer.

## Performance Findings
1. **N+1 Filtering:** `filteredInteractions()` in `app.js` stringifies JSON bodies on every render loop, causing O(N) performance bottlenecks. This needs caching (e.g., WeakMap) or pre-computation.
2. **DOM Re-rendering:** Continuous polling might trigger unnecessary full re-renders of the interaction list.

## Security & Reliability Findings
1. **XSS Risks:** Continuous manual string concatenation for HTML requires constant vigilance. A template literal function that auto-escapes or a virtual DOM would mitigate this.
2. **Memory Leaks:** Unbounded `setInterval` polling in `app.js` could cause memory leaks if the app lifecycle is not managed correctly.

## Testing Gaps
1. **Frontend UI Tests:** Lacking unit tests for the complex rendering logic in `app.js` and `layouts.js`. E2E tests exist but UI components are untested in isolation.
2. **Duplication Drift:** Tests need to ensure that the duplicated `matcher` logic stays perfectly synchronized.

## Rules Compliance Findings
* **Violated Rule:** Form labels using non-semantic `div` tags without proper `aria-label` and `title` on inputs.
    * *Impact:* Poor accessibility.
    * *Fix:* Implement accessible input wrappers.
* **Violated Rule:** O(N) performance bottlenecks in render loops (JSON.stringify in filteredInteractions).
    * *Impact:* UI freezing on large data sets.
    * *Fix:* Implement a WeakMap cache for stringified bodies.

## Recommended Refactor Plan

### Quick Wins
1. **Performance:** Implement a `WeakMap` cache for `JSON.stringify(body)` inside `filteredInteractions()` to fix the O(N) bottleneck.
2. **Accessibility:** Audit all inputs in `app.js` and add `aria-label` and `title` attributes.

### Medium Effort Improvements
1. **State Management:** Replace `setInterval` polling with an EventBus or `chrome.storage.onChanged` listener to drive UI updates reactively.
2. **Component Extraction:** Extract Toast and Dialog rendering logic into reusable utility functions.

### Long-term Architecture Improvements
1. **Decompose app.js:** Break `app.js` into separate modules: `Sidebar`, `List`, `DetailsPane`, `Settings`.
2. **Build System for CLI/Extension Shared Logic:** Introduce a lightweight build step to share the `Matcher` logic without maintaining manual copies, preserving the CLI's zero-dependency rule by bundling it.

---

### Top 10 highest-value fixes
1. Cache stringified JSON in `filteredInteractions`.
2. Replace polling with event-driven state updates.
3. Fix accessibility on all form inputs (`aria-label`, `title`).
4. Ensure Toasts have `role="status"` and `aria-live="polite"`.
5. Break out the Settings modal into its own file.
6. Break out the Import/Export logic into its own file.
7. Break out the Details pane rendering into its own file.
8. Abstract the Toast notification logic.
9. Audit and secure all `innerHTML` assignments.
10. Implement a Virtual Scroller for the interactions list.

### Top 10 duplication-removal opportunities
1. FNV-1a hash function (`matcher.js`, `injected.js`, `cli`).
2. URL parsing/normalization logic.
3. DOM creation for Buttons.
4. DOM creation for Input Groups.
5. DOM creation for empty states.
6. Error handling in API calls.
7. Header normalization logic.
8. Settings dialog boilerplate.
9. Clipboard copying logic.
10. Timestamp formatting logic.

### Top reusable abstractions worth introducing
1. `UIComponent` builder (to replace manual string concat).
2. `EventBus` for cross-component communication.
3. `StorageService` for IndexedDB abstraction.
4. `InputGroup` component for accessible forms.
5. `VirtualizedList` for rendering interactions.

### Files/components with highest technical debt
1. `extension/shared/app.js` (3200+ lines, mixed concerns).
2. `extension/injected.js` (complex monkey patching, duplicated matcher logic).
3. `extension/shared/layouts.js` (DOM manipulation complexity).

### Suggested engineering standards missing from the repository
1. Strict component boundaries (no monolithic files > 500 lines).
2. Required accessibility (a11y) linting for all UI code.
3. Centralized state management pattern (no ad-hoc polling).
4. Auto-escaping template literals for HTML construction.
5. Shared logic generation build step (to prevent manual duplication syncing).
