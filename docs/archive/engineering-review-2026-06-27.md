# Engineering Review Report - 2026-06-27

## Executive Summary
* **Overall Repo Health Score**: 7/10 (Functional, but contains significant legacy UI architecture technical debt).
* **Biggest Risks**:
  * Massive god file in `extension/shared/app.js` (3200+ lines) handling rendering, state, DOM manipulation, and event handling.
  * O(N) array filtering performance bottlenecks in UI rendering.
  * High risk of DOM XSS via raw `innerHTML` assignments without proper `sanitizeHTML` wrapping.
* **Highest ROI Improvements**:
  * Implement the UI Componentization strategy (`UI_COMPONENTIZATION_IMPLEMENTATION.md`).
  * Introduce URL caching mechanism (`parseUrl`) to eliminate `new URL()` performance hits in loops.
* **Architecture Concerns**:
  * Tight coupling between state and DOM in `app.js`.
  * Lack of component abstraction; relying on raw string template interpolation for UI.
  * Mixed responsibilities in background script (1800+ lines).

## Critical Issues
* **God File Pattern**: `extension/shared/app.js` is 3200+ lines long. It is extremely difficult to maintain and test.
* **Performance Degradation via `new URL()`**: Repeatedly calling `new URL()` in loops (background script filters, UI rendering) causes severe performance degradation on high network traffic.
* **Security - DOM XSS**: Some UI template strings using `innerHTML` need strict auditing to ensure variables are escaped via `escapeHtml()` or `sanitizeHTML()`.
* **console.log in Production Paths**: `extension/shared/app.js` and `extension/background.js` contain `console.log` statements which violate the `DEVELOPMENT_RULES.md` for production paths.

## Duplication Report
* **Repeated UI Logic**: Row rendering logic for `popup` vs `devtools` is duplicated and fragmented. The specs recommend a single source of truth (`columns.js`) to fix this.
* **Repeated URL Parsing**: Parsing URL hostnames to create domains is repeated across different group-by functions.
* **Shared Array Filtering**: Sequential `.filter()` chaining is used in background interactions, leading to O(K*N) performance overhead.

## Reusability Opportunities
* **UI Components**: Extract UI rendering into `layouts.js` and `interaction-renderer.js` to decouple from state management.
* **URL Parsing Utility**: Create a centralized `parseUrl` with an LRU cache.
* **Shared Event Handlers**: Centralize click delegation in `app.js` so we don't have fragmented `addEventListener` blocks for every overlay.

## Architecture Review
* **Scalability**: The vanilla JS architecture is straining under the weight of the UI features. Componentization is necessary.
* **Extensibility**: Adding new columns or features currently requires modifying multiple parts of `app.js`. Implementing `columns.js` will solve this.
* **Separation of Concerns**: State handling, DOM events, network communication, and HTML rendering are heavily mixed.

## Performance Findings
* **O(N) Operations in Render**: Rendering performs array filtering repeatedly instead of using pre-computed filtered sets.
* **new URL() in Loops**: Found in `background.js` and `matcher.js`. This is a known severe bottleneck.
* **Sequential Filters**: Avoid chaining `.filter()`. Use a single pass loop.

## Security & Reliability Findings
* **DOM XSS via `innerHTML`**: Any user-controlled data (URL, JSON response bodies) injected directly into `innerHTML` strings without `sanitizeHTML` is an XSS vector.
* **Control Characters in Sanitize**: `extension/shared/sanitize.js` must validate URIs properly by stripping control chars before prefix checks.
* **Missing Error Boundaries**: Try/catch is sometimes missing around network payload parsing or JSON parsing.

## Testing Gaps
* **Unit Tests**: Missing unit tests for the UI components and formatters.
* **E2E Stability**: The Playwright smoke tests are large but cover primarily the happy path.

## Rules Compliance Findings
* **No Magic Numbers**: Some timeout delays are hardcoded.
* **No `console.log`**: Found `console.log` in `app.js` and `background.js`.
* **UTF-8 Markdown Generation**: All markdown generation must explicitly use `encoding='utf-8'`.

## Recommended Refactor Plan
### Quick Wins (1-2 Days)
1. Replace `new URL()` with `parseUrl` LRU cache in `background.js` and `app.js`.
2. Remove production `console.log` statements.
3. Fix sequential array filtering by combining them into single-pass loops.

### Medium Effort (1-2 Weeks)
1. Implement Phase 1 & 2 of `UI_COMPONENTIZATION_IMPLEMENTATION.md` (`columns.js`, `interaction-renderer.js`).
2. Add comprehensive Unit tests for the new UI component rendering.
3. Migrate `app.js` rendering logic to use `layouts.js`.

### Long-Term (1-3 Months)
1. Completely decouple `app.js` state management into a formal State container.
2. Refactor `background.js` into smaller service modules (StorageService, NetworkService, DNRService).

---

## 1. Top 10 highest-value fixes
1. Implement `UI_COMPONENTIZATION_IMPLEMENTATION.md` to break up `app.js`.
2. Replace `new URL()` in loops with cached `parseUrl`.
3. Combine sequential array `.filter()` calls into single passes.
4. Enforce `sanitizeHTML()` on all `innerHTML` assignments.
5. Remove all production `console.log` calls.
6. Refactor `background.js` out of the "God File" pattern.
7. Wrap all JSON.parse and network/storage calls in robust try/catch blocks.
8. Create a central event delegation system instead of scattered listeners.
9. Fix DOM XSS vulnerability in URI validation logic.
10. Remove magic numbers across the codebase.

## 2. Top 10 duplication-removal opportunities
1. UI rendering logic across popup and devtools modes.
2. URL hostname extraction and grouping logic.
3. Request blocking/mocking toggle HTML logic.
4. Waterfall row rendering.
5. Search and filtering loops.
6. Error toast rendering.
7. Event listener setup for dynamic content.
8. Message passing boilerplates.
9. Storage sync logic.
10. Badge and state indicator logic.

## 3. Top reusable abstractions worth introducing
1. `columns.js` for data grid definitions.
2. `interaction-renderer.js` for pure functional UI components.
3. `layouts.js` for layout state management.
4. Cached URL Parser Service.
5. Unified Error Handler and Reporter.
6. Debounce/Throttle utility service.
7. Typed State Management module.

## 4. Files/components with highest technical debt
1. `extension/shared/app.js`
2. `extension/background.js`
3. `extension/injected.js`
4. `cli/lib/server.js`

## 5. Suggested engineering standards missing from the repository
1. Strict UI Componentization standard (enforcing pure functions returning HTML).
2. Centralized State Management standard (no direct mutable state in DOM handlers).
3. URL/URI Parsing guidelines (mandatory caching).
4. XSS Prevention Standard (strict `sanitizeHTML` usage).
5. Comprehensive unit testing requirement for pure utility functions.
