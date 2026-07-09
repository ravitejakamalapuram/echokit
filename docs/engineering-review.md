# EchoKit Engineering Review

## Executive Summary

- **Overall Repo Health Score**: 85/100 (B+)
- **Biggest Risks**:
  - Massive UI monofile (`extension/shared/app.js` is over 3,200 lines long).
  - Silent failure vulnerabilities due to lack of strict source checks on `postMessage` listeners.
  - Frequent allocation and stringification in the rendering loop, severely degrading performance with 1000+ interactions.
- **Highest ROI Improvements**:
  - Decompose `app.js` into modular React-like vanilla components.
  - Introduce an abstraction for message passing (`postMessage` handlers).
  - Implement a `WeakMap` cache for JSON stringification in the filtering loop.
- **Architecture Concerns**: The `shared/app.js` file handles layout, routing, state, rendering, and logic simultaneously. The codebase relies heavily on innerHTML string interpolation which, while sanitized, poses maintainability and memory risks over time.

## Critical Issues

1. **Security / Reliability Risk (`extension/injected.js`)**:
   - `window.addEventListener('message')` does not verify `ev.source === window`. This opens the MAIN world script to state spoofing or unauthorized interception from cross-origin iframes.
2. **Performance Bottleneck (`extension/shared/app.js`)**:
   - The `searchBodyContent` function repeatedly calls `JSON.stringify(body).toLowerCase()` for every interaction object inside a `results.filter` loop. This causes severe O(N) object allocation and CPU thrashing during user typing or continuous API capturing.

## Duplication Report

1. **Matcher Logic (`fnv1a`, `computeMatchKeys`, `parseGraphQL`, `normalizeBody`)**:
   - **Locations**: `extension/injected.js`, `extension/shared/matcher.js`, and `cli/lib/match.js`.
   - **Impact**: Breaking changes in matcher logic must be manually applied across 3 separate files.
   - **Why Problematic**: Increases risk of subtle hashing mismatches between the CLI server, the extension background, and the injected MAIN world script.
   - **Consolidation Strategy**: Move the CLI match logic to use a single shared package, or extract a pure JS package `echokit-core-matcher` that can be built and bundled into the extension and CLI using a bundler (like esbuild or rollup). Note: the injected script needs an inlined copy, which a bundler can generate automatically.

2. **CORS Headers (`corsHeaders`)**:
   - Similar access-control logic exists in `extension/background.js` and `cli/lib/server.js`.
   - **Consolidation**: Shared constants utility.

3. **String Parsing / Escape Logic (`escapeHtml`)**:
   - Repeated in multiple rendering contexts within `app.js`.

## Reusability Opportunities

1. **Reusable UI Components**:
   - `<Switch>`, `<Button>`, `<Checkbox>`, and `<TextInput>` abstractions should replace raw template literals in `app.js`.
   - The `ek-modal` dialogs (settings, import, export, paste) all share the same overlay boilerplate. A `createModal(title, body, actions)` utility would drastically reduce size.
2. **Reusable Message Bridge**:
   - Creating a `MessageClient` wrapper to abstract `postMessage` and `chrome.runtime.sendMessage` with built-in timeouts, source validation, and try-catch safety.

## Architecture Review

- **Scalability**: Moderate. The UI will struggle with >5,000 interactions due to DOM thrashing and heavy `innerHTML` repaints. The lack of a virtual DOM or fine-grained reactivity means entire lists are rebuilt (`softRenderList`).
- **Maintainability**: Low for UI. `app.js` violates the Single Responsibility Principle and is nearly impossible to navigate. State management is a mutable global variable (`state`).
- **Resiliency**: Good. Most parsing and storage operations are wrapped in `try-catch` blocks, preventing catastrophic crashes.

## Performance Findings

- **Frontend**: `JSON.stringify` inside the filter loop is the largest performance risk. Needs a `WeakMap` cache. Additionally, iterating over `Object.entries(headers)` in `searchHeaders` allocates new arrays per interaction; a `for...in` loop with `hasOwnProperty` checks would avoid this.
- **Backend/Worker**: Valid. IndexedDB use for storage mitigates `chrome.storage` size limits well.

## Security & Reliability Findings

- **Missing Origin Check**: `injected.js` `message` event listener missing `if (ev.source !== window) return;`.
- **Inherited Prototypes**: Refactoring `Object.entries` to `for...in` requires `Object.prototype.hasOwnProperty.call(obj, key)` to avoid prototype pollution vulnerabilities if an attacker manages to spoof the object prototype.

## Testing Gaps

- **E2E Stability**: The test suite uses Python Playwright, but UI components lack unit tests. `test-matcher.js` exists, but there are no tests for `app.js` rendering logic.

## Rules Compliance Findings

- **Rule Violated**: `DEVELOPMENT_RULES.md` File size limits (Warning at 1000 lines, Hard limit 2000 lines).
- **Impact**: `extension/shared/app.js` is over 3,200 lines, severely violating this rule.
- **Rule Violated**: "Optimize for performance from the start, not as a retrofit" and Memory rules about O(N) rendering.
- **Impact**: The filter loop allocates JSON stringification continuously, causing UI lag.

## Recommended Refactor Plan

- **Quick Wins**: Fix `injected.js` security check and implement `WeakMap` caching for `searchBodyContent` in `app.js`.
- **Medium Effort**: Extract `renderSettingsGeneral` and modal creation logic into a separate `settings-ui.js` file to split `app.js`. Convert `Object.entries` in `searchHeaders` to `for...in` loops.
- **Long-term**: Introduce a bundler to generate `injected.js` from `matcher.js` to completely eliminate matcher duplication. Migrate the UI to preact or a lightweight reactivity framework (like Alpine or solid.js) to fix the `innerHTML` DOM thrashing.

## Top 10 Highest-Value Fixes
1. Add `ev.source !== window` check to `injected.js` message listener.
2. Add `WeakMap` stringification cache to `searchBodyContent` in `app.js`.
3. Replace `Object.entries` with `for...in` in `searchHeaders` for performance.
4. Extract Settings Modals out of `app.js` into `settings.js`.
5. Extract List Row rendering out of `app.js` into `list-item.js`.
6. Use a bundler for `injected.js` to automatically inline `matcher.js`.
7. Add `try-catch` around custom Header rule application in `background.js`.
8. Throttle/Debounce `onResize` in `app.js` to prevent jank.
9. Abstract `postMessage` emitters to guarantee structure.
10. Implement virtual scrolling for the interaction list to scale beyond 1,000 items.

## Top 10 Duplication-Removal Opportunities
1. `matcher.js` across `extension` and `cli`.
2. `parseGraphQL` regex and extraction logic.
3. `normalizeBody` and `stableStringify` deep object sorting.
4. `escapeHtml` utility functions in `app.js` and `json-highlight.js`.
5. Modal wrapper HTML `ek-modal-overlay` string literals.
6. Checkbox HTML template generation in Settings.
7. Event listener binding for custom UI actions (`data-action`).
8. `try-catch` wrappers for `chrome.storage.sync.get/set`.
9. Button UI templates (`<button class="ek-btn...">`).
10. Form input debouncing logic.

## Top Reusable Abstractions
1. `ModalBuilder` (UI)
2. `DOMPurify` or centralized sanitization layer.
3. `MessageBus` for cross-world messaging.
4. `SettingsManager` class for syncing Chrome storage.

## Files with Highest Technical Debt
1. `extension/shared/app.js` (3200+ lines, mixed logic).
2. `extension/injected.js` (inline matcher code, manual syncing).

## Suggested Engineering Standards Missing
1. Strict type checking (TypeScript or JSDoc types enforced via ESLint).
2. Bundling step for extension to allow modularity in `MAIN` world scripts.
3. Automated UI component testing (e.g., Jest + JSDOM).
