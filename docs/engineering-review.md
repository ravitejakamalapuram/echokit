# Repository Engineering Review Report

## Executive Summary
* **Overall repo health score**: B-
* **Biggest risks**:
  * God files like `extension/shared/app.js` (3269 lines).
  * XSS and DOM Clobbering vulnerabilities due to manual DOM manipulation and HTML strings.
  * O(N) performance bottlenecks in rendering loops and filtering.
  * Inconsistent mocking logic duplicated across components.
* **Highest ROI improvements**:
  * Componentize the frontend UI logic into modular abstractions.
  * Implement event-driven state management to replace polling.
  * Introduce test-driven security linting for DOM interactions.
* **Architecture concerns**:
  * High coupling of UI and state in `app.js`.
  * Repeated `fetch` and `setInterval` logic.
  * Lack of standard reusable hooks or UI components.
  * Redundant implementation of URL parsing and hashing.

## Critical Issues
* **XSS/DOM Clobbering**: In `extension/shared/app.js` and `extension/shared/layouts.js`, manual DOM manipulations (e.g., using `innerHTML`, `el.attributes`) expose the application to clobbering bypasses. All iterations over DOM elements must use `Element.prototype` methods (e.g., `Element.prototype.getAttributeNames.call(el)`).
* **God Component (`app.js`)**: `extension/shared/app.js` is 3269 lines long. It handles state, DOM manipulation, feature toggling, and business logic. This drastically increases maintenance risk.
* **Performance Bottlenecks**: Rendering functions like `renderInteractionListNew` and `renderWaterfallNew` are subject to O(N) constraints due to redundant filtering inside nested loops. WeakMap caching or pre-computed arrays must be utilized.

## Duplication Report
* **Mock Logic**: Matcher logic and mock evaluation are duplicated across `extension/shared/matcher.js`, `extension/injected.js`, and `cli/lib/match.js`. This creates a drift risk (e.g., URL normalization differences).
* **UI Patterns**: Empty states, toast notifications, form elements (`<div class="ek-label">`), and dialog wrappers are manually reconstructed throughout `app.js`.
  * **Spread**: Dozens of manual DOM reconstructions.
  * **Abstraction**: Create modular Web Components or standard JS UI builder functions (`createButton`, `createDialog`).
* **Storage Access**: Polling `chrome.storage.local` is repeatedly hardcoded using `setInterval`.

## Reusability Opportunities
* **State Management**: A pub/sub EventBus or shared store module to broadcast state changes instead of component-level polling.
* **UI Components**:
  * `NotificationToast(message, type)`
  * `SettingsDialog(content)`
  * `FormField(label, input)`
* **Tight Coupling**: Features in `app.js` leak into one another. The dual interface strategy (popup vs. devtools) relies on brittle feature flags.

## Architecture Review
* **Scalability**: Polling via `setInterval` for state synchronization is not scalable for many interactions.
* **Maintainability**: Low cohesion in `app.js` makes adding features complex.
* **Resiliency**: Fragile async flows with multiple unhandled rejections in UI handlers.
* **Anti-patterns**:
  * God files (`app.js`, `background.js`).
  * Weak DOM manipulation and non-semantic HTML (`<div class="ek-label">`).

## Performance Findings
* **Expensive Renders**: Redundant execution of `filteredInteractions()` causes UI freezing on large datasets.
* **Inefficient Loops**: Spread operators used on large arrays (e.g., `Math.max(...array)`) cause stack overflows in `waterfall-renderer.js`. Iterative tracking should be used.
* **Redundant Transformations**: Frequent JSON stringification during filtering should be cached using `WeakMap` or precomputed hashes.

## Security & Reliability Findings
* **Injection Risks**: Unsafe HTML insertion via `innerHTML` without comprehensive sanitization (e.g., bypassing `javascript:` links).
* **DOM Clobbering**: In `sanitize.js`, using `el.attributes` can be clobbered by `<input name="attributes">`.
* **State Sync**: Local mutation of shared mock state (e.g., setting `mockEnabled = false` locally) leads to desync with `background.js`.

## Testing Gaps
* **Missing Coverage**: The monolithic `app.js` lacks unit tests due to tight DOM coupling.
* **DOM Clobbering Mocks**: JSDOM doesn't perfectly emulate DOM Clobbering, meaning tests might falsely pass. Needs E2E browser tests for sanitizers.

## Rules Compliance Findings
* **Accessibility Rule Violation**: Non-semantic labels (`<div class="ek-label">`) lack `aria-label` and `title` attributes on inner inputs.
  * *Impact*: Screen reader failure.
  * *Fix*: Require `aria-label` and `title` for all inputs.
* **Security Rule Violation**: Missing explicit DOM clobbering prevention (Rule: `Element.prototype` direct usage).
  * *Impact*: High severity XSS bypass.
  * *Fix*: Implement `Element.prototype` usage for all attribute handling.
* **Performance Rule Violation**: O(N) array transformations inside render loops.
  * *Impact*: UI stutter.
  * *Fix*: Pre-compute arrays before passing them down to components.

## Recommended Refactor Plan
### 1. Quick Wins (1-2 weeks)
* Fix DOM clobbering vulnerabilities in `sanitize.js` by strictly using `Element.prototype`.
* Replace `Math.max(...array)` with iterative `for` loops in `waterfall-renderer.js`.
* Pre-compute `filteredInteractions()` in `app.js` to eliminate rendering lag.

### 2. Medium Effort (1-2 months)
* Extract `Toast`, `Dialog`, and `Button` UI logic into standard reusable utility functions.
* Move from `setInterval` polling to an Event-driven state sync mechanism using `chrome.storage.onChanged`.
* Unify the FNV-1a hashing and URL parsing between `cli` and `extension`.

### 3. Long-Term Architecture (3-6 months)
* Decompose `app.js` (3269 lines) into domain-specific modules (`SettingsUI.js`, `InteractionListUI.js`, `EditorUI.js`).
* Standardize on Web Components for the UI layer to naturally encapsulate styles and logic.

# Top Priority Summary
## Top 10 Highest-Value Fixes
1. Prevent DOM Clobbering in HTML sanitizers.
2. Fix maximum call stack errors in waterfall rendering (remove spread syntax).
3. Pre-compute and cache expensive list filtering in `app.js`.
4. Ensure `aria-label` and `title` pair matching on all destructive actions and inputs.
5. Standardize on `Element.prototype` methods for DOM interactions.
6. Centralize mock desynchronization logic instead of local mutations.
7. Replace all non-semantic form labels with accessible attributes.
8. Filter all `javascript:` URL prefixes on `action` and `xlink:href` attributes.
9. Cache object stringification via `WeakMap` in rendering loops.
10. Remove unhandled promise rejections on async UI clicks.

## Top 10 Duplication-Removal Opportunities
1. FNV-1a hashing (CLI vs Extension).
2. URL parameter sorting and normalization (CLI vs Extension).
3. DOM element creation logic (manual `document.createElement`).
4. Toast notifications rendering.
5. Empty state UI.
6. Settings toggle UI.
7. Modal/Dialog wrappers.
8. Storage polling loops (`setInterval`).
9. Tab state persistence logic.
10. Mock conflict resolution display logic.

## Top Reusable Abstractions Worth Introducing
1. `UIFactory`: Reusable Web Components / JS renderers for common UI (Buttons, Modals, Inputs).
2. `EventBus`: A pub/sub system to replace `setInterval` state polling.
3. `SharedMatcher`: A unified matching engine shared across the Extension, CLI, and Worker.
4. `DomUtils`: Safe, standardized wrappers for DOM manipulation that mitigate clobbering.

## Files/Components with Highest Technical Debt
1. `extension/shared/app.js` (Monolithic, highly coupled, security risks, performance bottlenecks)
2. `extension/background.js` (Large state machine with mixed responsibilities)
3. `extension/injected.js` (Complex state synching and duplication of matching logic)

## Suggested Engineering Standards Missing
1. **Strict DOM Security Linting**: Require `Element.prototype` access for all untrusted DOM manipulations.
2. **Pre-commit Performance Checks**: Static analysis for O(N) operations inside render functions.
3. **Component Modularity Standard**: Maximum file length limit (e.g., 500 lines) and strict separation of UI and State.
4. **Accessibility Linting**: Enforce `aria-label` and `title` matching for all interactable elements.
