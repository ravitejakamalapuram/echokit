# Engineering Review Report

## Executive Summary
* **Overall Repo Health Score**: B (Functional, but UI needs architectural componentization)
* **Biggest Risks**: Monolithic `extension/shared/app.js` (3200+ lines) mixing rendering, DOM manipulation, state, and network calls; DOM clobbering risks in layout logic; O(N) array filtering in render loop.
* **Highest ROI Improvements**: Extracting pure UI components out of `app.js`, caching JSON strings in filters, standardizing form label accessibility.
* **Architecture Concerns**: Lack of standard component model causes huge boilerplate in DOM string templating. Tight coupling between UI state and DOM. Intentional code duplication between CLI and Extension for `matcher.js`.

## Critical Issues
1. **Security (XSS/DOM Clobbering)**: `app.js` heavily relies on manual string concatenation for HTML construction and iterates over `el.attributes` unsafely in `layouts.js`/`sanitize.js`.
2. **Monolithic Architecture**: `extension/shared/app.js` is an unmaintainable god file (~3269 lines).
3. **O(N) Render Bottlenecks**: Rendering loop in `app.js` calls `filteredInteractions()` continuously, which internally runs expensive `JSON.stringify(body)` inside a loop.

## Duplication Report
1. **Hashing Logic**: `cli/lib/match.js` and `extension/shared/matcher.js` have heavily duplicated FNV-1a hashing and URL normalization logic. *Note: Intentional to maintain zero dependencies in CLI, but causes high maintenance overhead.*
2. **Form Layouts**: Repeated `<div class="ek-label">` and manual `aria-label`/`title` attribute applications in `app.js` dialogs.
3. **Error Toasts**: Toast notification DOM construction is duplicated in `app.js` vs extracted toast logic.

## Reusability Opportunities
* **Form Controls**: Extract `InputGroup`, `Button`, and `Modal` as shared JS render functions in `layouts.js`.
* **Notification System**: Create a unified `toast(message, type)` module that automatically sets `role="status"` and `aria-live="polite"`.
* **Store Hook**: Create a publish/subscribe EventBus for `state` instead of manually setting `state` properties and calling `render()`.

## Architecture Review
* **Scalability**: Manual DOM diffing and templating inside `app.js` will break down with hundreds of UI interactions. Need a virtual scroller or component state system.
* **Maintainability**: Extreme logic tangling in `app.js` makes adding features like "multi-select" hard without causing bugs.
* **Extensibility**: The extension UI should use a modern reactive abstraction, even a lightweight custom vanilla one, to prevent 3200-line DOM handlers.

## Performance Findings
* **Frontend**: `filteredInteractions()` does `JSON.stringify` repetitively. `Math.max(...array)` is used in waterfall rendering, though recent fixes have partially addressed this. `setInterval` state polling is inefficient compared to message passing.
* **Backend (Worker/CLI)**: Relatively lightweight, but polling could be optimized to long-polling or Server-Sent Events (SSE).

## Security & Reliability Findings
* **XSS Vectors**: Using `innerHTML = sanitizeHTML(...)` is safe *if* sanitizeHTML is perfect, but error-prone. Need CSP enforcement.
* **DOM Clobbering**: Using `Element.attributes` directly allows bypass via `<input name="attributes">`.
* **State Desync**: `setInterval` in UI polling can desync if background script fails.

## Testing Gaps
* **UI E2E Tests**: Manual DOM manipulation in `app.js` is brittle and heavily under-tested.
* **Sanitizer Tests**: Need more comprehensive test cases for `sanitizeHTML` against DOM clobbering edge cases.

## Rules Compliance Findings
* **Refactoring App.js**: Rule `never refactor extension/shared/app.js in one shot` requires an incremental approach.
* **Accessibility**: `aria-label` and `title` pairs must be standardized on all destructive action buttons.

## Recommended Refactor Plan
### Quick Wins
1. Fix DOM clobbering by using `Element.prototype.getAttributeNames.call(el)`.
2. Cache stringified JSON in `filteredInteractions()` to fix O(N) lag.
3. Ensure `aria-label` and `title` on all dialog inputs.

### Medium Effort
1. Abstract common UI components (Toast, Button, Input) to pure functions.
2. Extract IndexedDB polling to a proper State/Storage Manager EventBus.

### Long-Term Architecture
1. Progressively decompose `app.js` into modular views (e.g., `sidebar.js`, `details-panel.js`).
2. Migrate to an Event-driven UI update model instead of manual `render()` calls.

---
### Top 10 highest-value fixes
1. Optimize `filteredInteractions()` O(N) performance bottleneck by caching `JSON.stringify`.
2. Fix DOM Clobbering in `sanitize.js` and `layouts.js` using `Element.prototype`.
3. Add `aria-label` and `title` to all form inputs and destructive buttons.
4. Add `role="status"` and `aria-live="polite"` to all dynamic toast notifications.
5. Refactor `setInterval` polling in UI to event-based message passing.
6. Implement single-pass iterations instead of chained `.filter().map()`.
7. Consolidate URL normalization logic.
8. Fix any missing origin checks in `postMessage` handlers.
9. Ensure robust error handling (try/catch) around `JSON.parse` in network paths.
10. Remove magic numbers (delays, timeouts) into shared constants.

### Top 10 duplication-removal opportunities
1. `cli/lib/match.js` vs `extension/shared/matcher.js` (FNV-1a hashing).
2. URL parsing and normalization across the codebase.
3. Form input group `<div class="ek-label">` DOM generation.
4. Empty state placeholder rendering.
5. Toast notification DOM strings.
6. Settings dialog vs Import/Export dialog layout structures.
7. Button DOM generation (Primary/Secondary styles).
8. Event listener delegation logic scattered across dialogs.
9. JSON highlighting functions.
10. Error handling wrapper boilerplates.

### Top reusable abstractions worth introducing
1. `EventBus`: For cross-component state synchronization.
2. `UIComponent`: Base abstraction for safe, sanitized HTML generation.
3. `VirtualScroller`: To handle rendering thousands of interactions without jank.
4. `StorageService`: Centralized API for IndexedDB.
5. `ToastManager`: Unified accessible notifications.

### Files/components with highest technical debt
1. `extension/shared/app.js` (3269 line god file)
2. `extension/injected.js` (Complex monkey patching logic)
3. `cli/lib/server.js` (Large procedural file)
4. `extension/background.js` (Mixes network routing, state, and DNR rules)

### Suggested engineering standards missing from the repository
1. **UI Component Boundaries**: Explicit rules that views cannot manipulate DOM outside their scope.
2. **Strict Accessibility (a11y)**: Mandate `aria-label`/`title` and semantic HTML for all new PRs.
3. **State Management**: Rule forbidding direct local mutation of shared mock state; use dynamic filtering.
4. **Safe DOM Standard**: Rule forbidding direct property access for attributes (prevent DOM clobbering).
5. **Performance Budgets**: Mandate avoiding O(N) operations inside `render()` loops.
