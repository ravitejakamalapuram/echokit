# EchoKit Daily Engineering Review Report

## Executive Summary

- **Overall Repo Health Score:** 65/100
- **Biggest Risks:** Massive DOM monolith (`extension/shared/app.js`), redundant API logic across node/extension boundaries, undocumented performance degradation on large datasets due to N-plus-1 filters, and implicit state derivations that risk desyncs.
- **Highest ROI Improvements:** Componentize the `app.js` UI, introduce centralized data layer for cached interactions, unify matcher hash generation, and implement standard linting constraints.
- **Architecture Concerns:** The vanilla JavaScript architecture has reached its breaking point. State is mutated freely across functions without strict ownership. There is logic duplication between `cli/` and `extension/shared/`.

## Critical Issues

- **Monolithic `app.js` File:** `extension/shared/app.js` is over 3200 lines long, serving as a "god file" containing UI rendering, state management, event listeners, and business logic.
- **XSS & Security Vulnerabilities:** Repeated issues with DOM XSS from `innerHTML` assignments in UI renderers.
- **Performance bottlenecks in Rendering:** Re-evaluating parsed URLs and iterating across the entire interactions array multiple times creates severe O(N) and O(N²) scaling issues on large mocked datasets.

## Duplication Report

- **Duplicate Hash Matching:** `cli/lib/match.js` and `extension/shared/matcher.js` implement duplicate logic for normalizing URLs, parsing GraphQL, and creating FNV-1a hashes. This breaks DRY and requires manual synchronization, causing a significant maintenance burden.
- **UI Components:** Toggle buttons, layout structures, and input filters duplicate similar DOM structure rendering logic across multiple files (`app.js`, `layouts.js`, `interaction-renderer.js`).

## Reusability Opportunities

- **Reusable UI Components:** Extract native UI components (Toggles, Dropdowns, Modals) into a centralized `components/` directory.
- **Single Source of Truth for State:** Extract application state from `app.js` into a lightweight, framework-agnostic store using a publish-subscribe (PubSub) pattern.
- **Unified Matcher Core:** Extract the `matcher.js` core into a shared, framework-agnostic npm package to serve both the `cli` and the `extension`.

## Architecture Review

- **Scalability:** The application relies entirely on Vanilla JS and direct DOM manipulation. While performant initially, manual DOM updates become impossible to maintain at scale.
- **Maintainability:** Poor separation of concerns in the frontend UI files. Missing componentization boundaries.
- **Testability:** High coupling between state and UI in `app.js` makes unit testing individual UI views impossible without heavy DOM mocking.

## Performance Findings

- **Repeated `new URL()` Calls:** `new URL()` is instantiated inside tight loops like `renderRow` and `visibleInContext`, causing significant garbage collection overhead.
- **Redundant Filtering:** Arrays are filtered sequentially, resulting in O(K*N) complexity. It should be collapsed into a single pass.
- **Waterfall Rendering:** Excessive direct DOM reflows due to poorly batched updates.

## Security & Reliability Findings

- **DOM XSS via `innerHTML`:** Generating HTML strings dynamically and appending via `innerHTML` is inherently unsafe. Requires rigorous `sanitizeHTML()` wrapping on every single interpolation.
- **Message Passing Risks:** Unvalidated payload structure over `postMessage` may lead to injection risks from malicious pages if origin is not verified.

## Testing Gaps

- **Unit Testing Missing for Core UI:** The heavy UI logic in `app.js` lacks unit testing due to DOM dependencies.
- **Duplicate Test Coverage:** Brittle Playwright tests checking DOM presence instead of component contracts.
- **Mocking Strategy:** Missing isolated unit tests for `injected.js` logic without a full headless browser.

## Rules Compliance Findings

- **DEVELOPMENT_RULES.md - Function Size Limitations:** `app.js` violates the rule: "No function > 150 lines; warning at 100".
- **DEVELOPMENT_RULES.md - File Size Limitations:** `app.js` violates the rule: "No file > 2000 lines; warning flag at 1000".
- **No Console Logging:** Unverified `console.log` instances scattered in development workflows.

## Recommended Refactor Plan

- **Quick Wins:**
  - Introduce an LRU cache or `Map` for parsed URLs to eliminate `new URL()` calls in rendering loops.
  - Consolidate all O(N) array `.filter()` chains into a single-pass function.
- **Medium Effort Improvements:**
  - Move the duplicate `matcher.js` logic into a unified directory shared between CLI and the extension.
  - Implement a central event bus / state manager to untangle `app.js`.
- **Long-Term Architecture Improvements:**
  - Adopt a lightweight Virtual DOM library (e.g., Preact) or standard Web Components to componentize the massive `app.js` interface.
  - Implement strict Type Safety using TypeScript to prevent runtime payload mismatches.

---

### Top 10 highest-value fixes

1. Implement LRU cache for URL parsing during renders.
2. Refactor `app.js` O(N) chained filters into a single pass.
3. Consolidate hash matching logic between `cli` and `extension/shared`.
4. Wrap all dynamic HTML concatenations with `sanitizeHTML()`.
5. Fix ARIA state mappings (`aria-pressed`, `aria-expanded`) for accessibility.
6. Decouple event listeners from the DOM elements in `app.js`.
7. Eliminate memory leaks by properly cleaning up Chrome message listeners.
8. Validate and sanitize all `postMessage` input in `content.js`.
9. Enforce strict `npm` -> `pnpm` usage lock in `package.json` / CI.
10. Refactor direct DOM manipulation to batched `documentFragment` appends.

### Top 10 duplication-removal opportunities

1. `fnv1a` hash function in `match.js` and `matcher.js`.
2. GraphQL parsing logic duplicated across files.
3. DOM template rendering for Interaction Rows.
4. Filter matching logic on URL schemas.
5. Error boundary try/catch blocks repeated across asynchronous handlers.
6. API mocking boilerplate across tests.
7. Toggle chip accessibility ARIA mapping duplicated manually.
8. Shared constants declared separately in CLI and extension.
9. Event binding wrappers.
10. File upload/Blob handling logic.

### Top reusable abstractions worth introducing

1. `useUIState` / `StateStore` (PubSub pattern).
2. `<ToggleChip>` component.
3. `<InteractionRow>` component.
4. `safeHTML` template literal tag function.
5. Shared `URLParser` Cache singleton.
6. Unified `HashGenerator` library.
7. `EventDelegator` utility for the root element.

### Files/components with highest technical debt

1. `extension/shared/app.js` (3200+ lines, multiple concerns).
2. `extension/shared/interaction-renderer.js` (complex string-based templates).
3. `extension/injected.js` (fragile mock cache).
4. `cli/lib/match.js` (duplicate business logic).

### Suggested engineering standards missing from the repository

1. Strict TypeScript usage (`.ts`) for complex domains.
2. Standardized component architecture (e.g., Web Components).
3. Formal state management pattern (Redux-lite or Signals).
4. Automated E2E CI execution with headless Chrome workers.
5. Explicit file size limitation enforced via ESLint rules (instead of just markdown rules).