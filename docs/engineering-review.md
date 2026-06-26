# EchoKit Engineering Review Report

## Executive Summary
- **Overall Repo Health Score**: 7/10
- **Biggest Risks**: Huge monolithic file (`extension/shared/app.js`), redundant loop structures causing performance issues (filtering list updates), unsafe innerHTML assignments directly bypassing sanitization patterns.
- **Highest ROI Improvements**: Refactor `app.js` into smaller components (as outlined in UI_COMPONENTIZATION_IMPLEMENTATION.md). Implement caching for URL parsing. Sanitize HTML templates before injection.
- **Architecture Concerns**: The UI layer currently mixes state management, event delegation, and raw HTML generation, leading to tight coupling and testing difficulties.

## Critical Issues
- **Monolithic UI File (`extension/shared/app.js`)**: At 3,247 lines, this file handles state, rendering, and DOM updates for both popup and devtools, making it brittle and hard to test.
- **DOM XSS Vulnerabilities**: Raw string concatenations to `innerHTML` exist without uniform usage of the new `sanitizeHTML()` helper.
- **Performance Bottlenecks in URL Parsing**: `new URL()` is instantiated inside tight rendering and filtering loops, consuming excessive CPU time on large interaction lists.
- **Accessibility Gaps**: Several interactive UI elements lack proper ARIA states tied to dynamic properties, violating accessibility standards.

## Duplication Report
- **Repeated Filtering Logic**: Array filtering logic inside `app.js` and `background.js` executes multiple chained `.filter()` passes instead of single O(N) passes.
  - *Fix*: Pre-compute filtered lists and pass to sub-renders.
- **HTML Generation**: Shared structures (like rows, headers, toggle chips) are repeatedly defined as string templates across `app.js` and `layouts.js`.
  - *Fix*: Standardize component usage using `interaction-renderer.js`.

## Reusability Opportunities
- **URL Parsing Cache**: Create a shared LRU cache for URL objects to prevent `new URL()` thrashing.
- **DOM Sanitization Service**: Ensure every string bound to the DOM routes through `extension/shared/sanitize.js`.
- **State Manager**: Abstract the reactive state updates out of the UI components into a dedicated store.

## Architecture Review
- **Scalability**: The core extension architecture correctly leverages IndexedDB for scale, but the UI layer scales poorly with large DOM arrays.
- **Maintainability**: High due to strict separation of worlds (MAIN vs ISOLATED), but poor in the shared UI layer.
- **Extensibility**: The CLI backend and the Chrome extension share the matcher logic, which is good, but any matcher change currently requires manual synchronization to `injected.js`.

## Performance Findings
- **Frontend**: Tight loop instantiation of `new URL()` in `visibleInContext` and `renderRow` causes O(N) penalties per user interaction.
- **Backend (CLI)**: Adequate, though loading huge JSON lists directly into memory could be stream-processed.

## Security & Reliability Findings
- **Security**: DOM XSS is possible where sanitized templates are not enforced. Must validate URIs against `javascript:` by stripping control characters like `&#09;` first.
- **Reliability**: No major race conditions detected, but missing `try/catch` around some custom parsing can silently fail the extension.

## Testing Gaps
- E2E tests exist (smoke_echokit.py), but component-level unit tests for DOM updates in `app.js` are missing.

## Rules Compliance Findings
- **DEVELOPMENT_RULES.md Violations**: `extension/shared/app.js` exceeds the 2000-line hard limit.
- **Security Convention**: `sanitizeHTML()` is not uniformly applied to all `innerHTML` assignments.

## Recommended Refactor Plan
- **Quick Wins**: Implement `parseUrl` with an LRU cache. Fix accessibility attributes on toggle buttons.
- **Medium Effort**: Standardize `sanitizeHTML()` usage across `app.js`.
- **Long Term**: Completely break apart `extension/shared/app.js` into modular components based on `specs/UI_COMPONENTIZATION_IMPLEMENTATION.md`.

## Top 10 Highest-Value Fixes
1. Refactor `app.js` to split UI rendering logic.
2. Implement `parseUrl` LRU cache to fix O(N) URL instantiations.
3. Apply `sanitizeHTML()` to all `innerHTML` templates to prevent DOM XSS.
4. Strip ASCII control characters in URL sanitizers to block `javascript:` bypasses.
5. Add ARIA `aria-pressed` / `aria-expanded` bindings to interactive toggles.
6. Combine chained `.filter()` calls into single O(N) loops in `app.js`.
7. Ensure `.eslintrc.json` compatibility with current Node/ESLint versions.
8. Implement UI unit tests for isolated template rendering.
9. Extract shared CSS/HTML structures into reusable functional components.
10. Automate the synchronization of `shared/matcher.js` to `injected.js`.

## Top 10 Duplication-Removal Opportunities
1. Array filtering chains in background vs foreground.
2. Mock status rendering logic.
3. URL parsing (use shared cache).
4. Error boundary wrappers.
5. Button / Tooltip component HTML templates.
6. Header / Row layout structures.
7. Event listener attachment and cleanup handlers.
8. Scope context evaluation.
9. Storage read/write utilities.
10. CSS class condition toggling.

## Top Reusable Abstractions
1. `parseUrl` LRU cache module.
2. Standardized `IconButton` UI component string generator.
3. Centralized `StateStore` class for reactive UI updates.
4. `DOMSanitizer` utility service.
5. `FilterPipeline` function to chain array conditions efficiently.

## Files With Highest Technical Debt
1. `extension/shared/app.js`
2. `extension/injected.js` (inline matcher code duplication)
3. `cli/lib/server.js`

## Missing Engineering Standards
1. Component-level unit testing for vanilla JS DOM manipulation.
2. Automated DOM XSS scanning in CI.
3. Strict ESLint rules for `innerHTML` usage.
4. Accessibility CI audits (e.g. axe-core integration).
5. Automated checks preventing file size bloat beyond rule limits.
