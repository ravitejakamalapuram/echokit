# EchoKit Engineering Review

## Executive Summary
**Overall Repo Health Score**: 70/100
**Biggest Risks**:
- High complexity and tech debt in `extension/shared/app.js` (3200+ lines).
- Frequent XSS vulnerability risks due to manual string interpolation with `innerHTML`.
- Duplication in `matcher.js` vs `injected.js` logic leading to silent matching bugs.
**Highest ROI Improvements**:
- Break down `extension/shared/app.js` into modular components.
- Centralize DOM rendering functions to enforce `sanitizeHTML` globally.
- Automate syncing between Node and extension matcher logic.
**Architecture Concerns**:
- Lack of bundler leads to manual duplication (`injected.js` copy-paste of matcher logic).
- Oversized state objects and deep UI component hierarchies in Vanilla JS.

## Critical Issues
1. **DOM XSS Risks in `app.js`**: `innerHTML` is often populated directly with user/API data. `sanitizeHTML` is inconsistently applied.
2. **`extension/shared/app.js` Size**: Approaching 3300 lines, violating the 2000-line hard limit. It contains state management, routing, component logic, and styling hooks all in one file.
3. **Array processing bottlenecks**: UI maps and filters run `O(n^2)` operations within render loops. `Array.filter` chains inside render functions slow down interactions significantly on >1000 items.
4. **URL Object allocations**: Tight loops use `new URL()` instead of cached versions, creating GC churn.

## Duplication Report
1. **Matcher Logic**: `extension/shared/matcher.js`, `extension/injected.js` (inline copy), and `cli/lib/match.js`. This is extremely dangerous. If one changes without the others, requests silently fail to match mocks.
2. **Empty State / Error State UI**: Duplicated HTML strings across `app.js` and `popup.js`.
3. **CORS/DNR Rule Generation**: Similar logic exists in background.js and worker scripts for handling domains.
4. **Debounce Logic**: Multiple instances of manual `setTimeout`/`clearTimeout` debouncing inside `app.js` instead of a central utility.

## Reusability Opportunities
1. **Create `ui-utils.js`**: Extract debouncing, throttling, formatting, and date/time manipulation.
2. **Create `dom-builder.js`**: Reusable abstractions for safe DOM creation to replace manual template strings (`createElement(tag, props, children)`).
3. **State Management Hook**: Create a Vanilla JS reactive proxy store to replace the manual `state` object and manual `render()` calls.
4. **Shared Matcher Package**: Extract matcher logic to a shared submodule or use a build step to inject it into `injected.js`.

## Architecture Review
- **Scalability**: Poor frontend scalability due to god-file `app.js` and lack of reactive framework.
- **Maintainability**: Low. High coupling between business logic and UI.
- **Readability**: Reduced by massive file sizes and inline HTML templates.
- **Extensibility**: Difficult to add new UI surfaces without further bloating `app.js`.

## Performance Findings
- **Frontend**: Full DOM replacement via `innerHTML` on minor state changes destroys scroll state and focus. Requires targeted `softRenderList` adoption.
- **Backend/Worker**: Efficient, but IndexedDB reads/writes in `background.js` could be further batched.
- **Memory**: High risk of memory leaks due to un-removed event listeners on DOM nodes that are overwritten by `innerHTML`.

## Security & Reliability Findings
- **XSS Vector**: As mentioned, `innerHTML` usage with unescaped variables.
- **Extension Sandboxing**: `injected.js` correctly uses an IIFE to avoid polluting the global scope.
- **Sync Storage Limits**: `chrome.storage.sync` has tight quotas (8KB). Storing complex settings could exceed limits and silently fail.

## Testing Gaps
- **UI Unit Tests**: Non-existent. Testing relies entirely on E2E Playwright scripts (`smoke_echokit.py`).
- **Matcher Sync Tests**: Missing tests to strictly enforce that the hash output from `cli/lib/match.js` matches `extension/shared/matcher.js` identically.
- **Worker E2E Tests**: Mock payment webhooks and license generation lacks automated integration tests.

## Rules Compliance Findings
- **Rule Violated**: "File size limit: 2000 lines" (`DEVELOPMENT_RULES.md`)
  - **Impact**: `app.js` is ~3200 lines. Hard to maintain, review, and test.
  - **Suggestion**: Split into `components/`, `services/`, `state/` directories.
- **Rule Violated**: "Security Convention: To prevent DOM XSS vulnerabilities... pass the template literal through the sanitizeHTML() utility function" (`memory`)
  - **Impact**: Multiple direct `innerHTML` assignments exist without `sanitizeHTML`.
  - **Suggestion**: Create a strict lint rule or wrapper function overriding `innerHTML`.
- **Rule Violated**: "Never mutate returned cached instances directly" (`memory`)
  - **Impact**: Cross-request data corruption in caching utilities.
  - **Suggestion**: Ensure caching functions return deep copies or freeze objects.

## Recommended Refactor Plan
### Quick Wins
1. Enforce `sanitizeHTML` globally across all `innerHTML` assignments.
2. Extract debounce and basic formatting helpers into `utils.js`.
3. Fix the `new URL()` loop bottlenecks by implementing cached `parseUrl`.

### Medium Effort Improvements
1. Consolidate array filter chains to single passes.
2. Abstract common UI components (buttons, toggles, chips) into shared factory functions.
3. Write cross-platform tests for the matcher logic.

### Long-Term Architecture Improvements
1. Incrementally dismantle `app.js` into modular pieces following `specs/UI_COMPONENTIZATION_IMPLEMENTATION.md`.
2. Introduce a lightweight build step (e.g., esbuild) specifically to solve the `injected.js` module sharing problem, eliminating the need for hand-inlined copies.
3. Implement a tiny reactive DOM library (or use lit-html) to manage UI state without full innerHTML wipes.

---

### Top 10 highest-value fixes
1. Fix DOM XSS vulnerabilities by enforcing `sanitizeHTML` on all `innerHTML` writes.
2. Extract `extension/shared/app.js` logic incrementally to smaller files.
3. Fix O(n^2) array filtering performance bottlenecks in UI rendering.
4. Add caching for `new URL()` operations in tight loops.
5. Create automated tests verifying identical outputs between Node and extension matcher logic.
6. Replace sequential `.filter()` chains with single-pass filtering.
7. Centralize debounce logic across all inputs.
8. Validate `chrome.storage.sync` payload sizes before writing to avoid quota errors.
9. Fix un-removed event listeners causing memory leaks during soft renders.
10. Synchronize ARIA state attributes dynamically with UI state variables.

### Top 10 duplication-removal opportunities
1. Matcher logic in `extension/shared/matcher.js`, `cli/lib/match.js`, and `extension/injected.js`.
2. Empty state UI templates in `app.js`.
3. Error state UI templates in `app.js`.
4. Debounce timers in various input handlers.
5. URL parsing and formatting logic.
6. HTTP method color mapping objects.
7. IndexedDB read wrapper boilerplate.
8. `chrome.storage.local` get/set boilerplate.
9. CORS overriding logic in background/worker.
10. Theme toggle event listener logic.

### Top reusable abstractions
1. Safe DOM element builder (e.g., `h('div', { class: 'x' })`).
2. Reactive state proxy (to eliminate manual renders).
3. Centralized debouncer hook/function.
4. Unified logging service with configurable log levels.
5. Pre-computed view-model mappings (for array rendering).

### Files with highest technical debt
1. `extension/shared/app.js` (Severe size and responsibility overload)
2. `extension/injected.js` (Hand-inlined duplicate logic)
3. `extension/background.js` (Mixed state, messaging, and storage concerns)
4. `cli/lib/server.js` (Large monolithic server file)
5. `extension/shared/matcher.js` (Tight coupling to external environments)

### Missing engineering standards
1. Enforced module bundler to prevent manual code inlining.
2. Pre-commit hooks for unit test and lint execution.
3. Formal UI Component testing methodology (e.g., component testing with Playwright).
4. Strict ESLint rules blocking `innerHTML` usage without an escape function.
5. Automated bundle size and memory leak tracking in CI.