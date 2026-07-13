# EchoKit Engineering Review Report

## Executive Summary
* **Overall repo health score**: 70/100
* **Biggest risks**:
    * Monolithic frontend (`extension/shared/app.js` is over 3253 lines).
    * Duplicated logic between `extension/shared/matcher.js` and `extension/injected.js`.
    * Potential DOM-based vulnerabilities in UI rendering (e.g., `innerHTML` usage).
* **Highest ROI improvements**:
    * Decompose `app.js` into modular vanilla JS components or adopt a lightweight framework.
    * Centralize and deduplicate URL matching logic.
* **Architecture concerns**:
    * Tight coupling of UI rendering, state management, and business logic in `app.js`.
    * State synchronization complexities between background worker and injected scripts.

## Critical Issues
1. **app.js Monolith:** `extension/shared/app.js` is a massive file (~3253 lines), making it extremely difficult to maintain, test, and onboard new developers. It violates separation of concerns.
2. **Duplicated Matching Logic:** Significant duplication exists between `cli/lib/match.js`, `extension/shared/matcher.js`, and the hand-inlined copy in `extension/injected.js`. This creates a high risk of inconsistent behavior between environments.
3. **Security Risks:** The use of `innerHTML` or unsafe DOM manipulations in the UI codebase could lead to DOM Clobbering or XSS. Specifically, `Element.prototype` methods should be strictly used when interacting with DOM elements (as per agent instructions).

## Duplication Report
* **URL/Body Normalization & Matching:** Logic is duplicated across `cli/lib/match.js`, `extension/shared/matcher.js`, and `extension/injected.js`.
    * *Why problematic:* Changes to matching logic must be manually synchronized across three locations, leading to bugs and API inconsistencies.
    * *Spread:* Core to all request interception.
    * *Suggestion:* Create a truly shared core package/module (perhaps bundled via a build step for `injected.js`) that defines a single source of truth.
* **UI Event Binding:** Repeated boilerplate for DOM event listeners throughout `app.js`.
    * *Suggestion:* Abstract into a simple generic event delegation or UI binding utility.

## Reusability Opportunities
* **Reusable UI Components:** Extract common UI elements (dialogs, chips, form inputs) from `app.js` into standalone classes or functions (e.g., `Dialog`, `Toggle`, `SearchInput`).
* **Reusable State Management:** Decouple state updates from DOM updates. Implement a simple observer pattern or reactive store (e.g., a lightweight `Proxy`-based store).
* **Reusable Fetch/XHR Interceptor:** The interception logic in `injected.js` could be abstracted into a reusable hook pattern for extensibility.

## Architecture Review
* **Scalability:** Poor. The current monolithic approach limits the ability to add complex new features without exponentially increasing technical debt.
* **Maintainability:** Low for the frontend. High dependency chains and tight coupling make localized changes risky.
* **Separation of Concerns:** Weak in `app.js`. It handles API communication, local storage, complex state, and DOM manipulation simultaneously.
* **Violations:** `app.js` and `background.js` exceed the recommended file size limits defined in `DEVELOPMENT_RULES.md` (no file > 2000 lines, warning at 1000).

## Performance Findings
* **DOM Updates:** Direct and frequent DOM manipulation in `app.js` (e.g., re-rendering lists) without diffing can cause jank on large datasets.
* **JSON Parsing:** Frequent JSON stringify/parse operations in filtering and matching loops (O(N) operations).
    * *Recommendation:* Use WeakMap caching for stringified bodies as noted in codebase memory.

## Security & Reliability Findings
* **DOM Clobbering:** Risks when interacting with potentially untrusted DOM elements.
    * *Fix:* Enforce the use of `Element.prototype.getAttribute.call(el)` over `el.getAttribute()`.
* **Injection Risks:** Ensure all user inputs (e.g., request bodies, URLs) are properly sanitized before rendering in the UI.

## Testing Gaps
* **Unit Testing for UI:** Lacking isolated unit tests for UI rendering logic because it's tightly coupled to the DOM and global state in `app.js`.
* **Mock Testing:** Need stronger contract tests to ensure `cli/lib/match.js` and `extension/shared/matcher.js` behave identically.

## Rules Compliance Findings
* **Rule:** File size limits (no file > 2000 lines).
    * *Violation:* `extension/shared/app.js` (~3253 lines).
    * *Impact:* Code readability and maintainability severely impacted.
    * *Fix:* Decompose into smaller modules (e.g., `sidebar.js`, `details-panel.js`, `settings-dialog.js`).

## Recommended Refactor Plan
### Quick Wins
1. **Security Review:** Enforce `Element.prototype` usage for DOM attribute access.
2. **Performance:** Implement WeakMap caching for JSON stringification in filtering loops.
3. **Accessibility:** Audit and fix `<label>` and `aria-label` implementations in form components.

### Medium Effort
1. **Deduplicate Matcher:** Create a build step (e.g., esbuild/rollup) to inject the shared matcher into `injected.js` to ensure a single source of truth.
2. **Extract UI Utilities:** Move generic DOM helpers (e.g., show/hide, element creation) into a dedicated `ui-utils.js`.

### Long-Term Architecture
1. **Decompose app.js:** Break the monolith into logical feature components (Sidebar, Main Panel, Settings).
2. **State Management:** Introduce a robust state management pattern to decouple logic from the view.

# Final Requirement
1. **Top 10 highest-value fixes:**
    1. Break down `app.js`.
    2. Unify matcher logic via build step.
    3. Fix DOM clobbering vulnerabilities using `Element.prototype`.
    4. Implement O(N) optimizations with WeakMap caching.
    5. Fix non-semantic `<div class="ek-label">` to proper accessibility standards.
    6. Ensure strict input sanitization on all raw API data displayed.
    7. Decouple background state sync from UI rendering.
    8. Abstract event binding logic.
    9. Implement UI unit testing strategy.
    10. Address file size limit violations.
2. **Top 10 duplication-removal opportunities:**
    1. `matcher.js` vs `injected.js` URL matching.
    2. `matcher.js` vs `cli/lib/match.js`.
    3. DOM event listeners in `app.js`.
    4. API request formatting.
    5. JSON parsing try-catch blocks.
    6. Modal/Dialog show/hide logic.
    7. Storage sync callbacks.
    8. Header normalization logic.
    9. Date formatting utilities.
    10. State toggle handlers.
3. **Top reusable abstractions worth introducing:**
    1. UI Component Base Class/Function.
    2. Reactive State Store.
    3. Safe DOM Manipulator Utility.
    4. Generic HTTP Interceptor Hook.
4. **Files/components with highest technical debt:** `extension/shared/app.js`, `extension/background.js`, `extension/injected.js`.
5. **Suggested engineering standards missing from the repository:**
    1. Component-driven development guidelines.
    2. State management architecture standards.
    3. Mandatory performance profiling for large list renders.
    4. Automated bundle size monitoring.
    5. Strict DOM manipulation safety guidelines (DOM Clobbering prevention).
