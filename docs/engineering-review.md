# EchoKit Engineering Review Report

## Executive Summary
- **Overall Repo Health Score:** 85/100 (Strong, but hindered by large UI and service worker monoliths).
- **Biggest Risks:** `extension/shared/app.js` is a 3243-line monolith, presenting a major maintenance and onboarding bottleneck. Manual synchronization required between `extension/shared/matcher.js` and `cli/lib/match.js` creates a risk of drift and mismatched hashes.
- **Highest ROI Improvements:** Extract components from `app.js` incrementally (following the UI componentization spec). Extract the shared matcher logic into a single source of truth, or automate synchronization.
- **Architecture Concerns:** The dual-interface strategy (popup vs devtools) handled via feature flags in `app.js` increases cyclomatic complexity. The service worker (`background.js`) is 1806 lines long, which borders on the 2000-line rule limit.

## Critical Issues
1. **The `app.js` Monolith:** At 3243 lines, `extension/shared/app.js` vastly exceeds the 2000-line limit mandated in `DEVELOPMENT_RULES.md`. Although there's an exception to refactor incrementally, the sheer size of the file limits velocity and increases merge conflict likelihood.
2. **Matcher Logic Duplication:** The hash generation logic in `extension/shared/matcher.js` and `cli/lib/match.js` must be kept in sync manually. Any drift will cause CLI mocks to fail since the hashes will differ from the extension.

## Duplication Report
1. **Matcher Algorithms:** Both `extension/shared/matcher.js` and `cli/lib/match.js` implement identical functions (`normalizeUrl`, `stripQuery`, `normalizeBody`, `fnv1a`, `parseGraphQL`, `computeMatchKeys`).
   - *Impact:* High risk of hash generation drift.
   - *Suggestion:* Create a shared core package/directory or utilize a build step to copy the file to the CLI automatically.

## Reusability Opportunities
1. **UI Components (`app.js`):** There are repeated patterns for rendering table rows, badges, and headers across different views (waterfall vs list).
   - *Suggestion:* Introduce reusable vanilla JS web components or pure rendering functions for common UI elements like badges, chips, and table cells.
2. **State Management Hooks:** The state polling mechanism (`setInterval` checking for active elements) in `app.js` could be abstracted into a reusable pub-sub or reactive state wrapper.

## Architecture Review
- **Scalability:** The current Vanilla JS architecture is starting to strain under the feature set (Advanced filters, waterfall view). The lack of a component model in the frontend makes adding new features error-prone.
- **Maintainability:** The extension relies heavily on manual DOM manipulation. `background.js` handles too many distinct responsibilities (license validation, IndexedDB interactions, DNR rules, WS/SSE overrides).
- **Resiliency:** The offline fallback for license validation is robust. The usage of try-catch blocks around `JSON.parse` is consistently applied (per `DEVELOPMENT_RULES.md`).

## Performance Findings
- **O(N²) Array Processing:** Previously identified in `.jules/bolt.md`, the UI has been moving towards O(N) rendering using `WeakMap` for conflict resolution, which is a positive trend.
- **DOM Manipulations:** The `softRenderList` approach prevents full DOM re-renders, but `innerHTML` (even when sanitized via `sanitizeHTML`) is slower than specific DOM updates (`textContent`).
- **Memory Management:** The application holds all interactions in an array (`state.interactions`) in memory. If thousands of requests are recorded, this might cause high memory consumption in the DevTools panel.

## Security & Reliability Findings
- **DOM XSS Sanitization:** The codebase successfully utilizes a DOM-based `sanitizeHTML` function, which is a highly secure mitigation against XSS compared to previous regex approaches.
- **License Validation:** The HMAC-SHA256 license validation via Cloudflare Worker is stateless and secure.
- **Content Script Isolation:** Proper use of `'/'` target origin for `window.postMessage` ensures communication is strictly same-origin.

## Testing Gaps
- **UI Interaction Testing:** While the E2E Playwright tests (87 assertions) are solid, the logic locked inside `app.js` is virtually untestable in isolation due to tight coupling with the DOM and global `state`.
- **Mock Cache Synchronization:** The tests for `background.js` state synchronization under high concurrency are missing.

## Rules Compliance Findings
- **File Size Rule (`DEVELOPMENT_RULES.md`):** `extension/shared/app.js` (3243 lines) violates the strict 2000-line rule.
- **Function Size Rule:** Several render functions likely exceed the 150-line limit inside `app.js`.
- **TODO Tracking:** There is an active TODO in `extension/background.js:204` regarding LemonSqueezy payment integration. `TODO.md` should be verified to contain this item.

## Recommended Refactor Plan
### Quick Wins
- Create a build script to automatically sync `extension/shared/matcher.js` into `cli/lib/match.js`.
- Move the license validation logic out of `background.js` into a dedicated `license.js` module.

### Medium Effort Improvements
- Refactor the search and filtering logic in `app.js` into a pure function module (e.g., `filter-logic.js`), which can be unit tested without DOM dependencies.
- Split `extension/background.js` into modular service worker scripts using `importScripts` or ES module imports (e.g., `storage.js`, `network.js`, `license.js`).

### Long-term Architecture Improvements
- Adopt a lightweight component model (like Lit, preact, or just a custom Vanilla component class) to break `app.js` into manageable UI components (`WaterfallView`, `InteractionList`, `DetailPane`).

---

## 1. Top 10 highest-value fixes
1. Split `extension/background.js` into smaller domain-specific files (Storage, DNR, API, License).
2. Automate the synchronization of `matcher.js` and `match.js`.
3. Extract filtering and sorting logic from `app.js` into `extension/shared/filters.js`.
4. Address the `TODO` in `background.js:204` for LemonSqueezy payment integration.
5. Extract the state management pattern from `app.js` into a dedicated `store-wrapper.js`.
6. Implement a virtual list (windowing) for the UI to handle thousands of interactions without lag.
7. Replace `setInterval` polling in `app.js` with a purely message-driven state update.
8. Refactor the `initEchoKitUI` initialization function to reduce its size.
9. Extract reusable UI elements (Chips, Badges) into `extension/shared/components/`.
10. Move the `features` flag logic into a dedicated `config.js` to simplify `app.js`.

## 2. Top 10 duplication-removal opportunities
1. Matcher logic: `extension/shared/matcher.js` vs `cli/lib/match.js`.
2. URL Parsing: Duplicated URL construction and parameter sorting in matching.
3. Stringification logic: `stableStringify` is defined in multiple places.
4. Badge rendering logic for different status codes in `app.js`.
5. Event binding patterns inside `app.js` for different buttons.
6. The dual interface configuration logic for Popup vs Devtools.
7. Mock indexing code between `background.js` and `cli/lib/server.js`.
8. DOM element creation patterns (e.g., creating cells, spans).
9. Filter checking logic repeated across different views.
10. The `escapeHtml` function which might be redundantly called alongside `sanitizeHTML`.

## 3. Top reusable abstractions worth introducing
1. **Component Base Class:** A lightweight vanilla JS base class with `render()`, `mount()`, and `update(props)` lifecycle methods.
2. **State Store:** A central reactive store with `subscribe()` instead of manual DOM updates on `chrome.runtime.onMessage`.
3. **Virtual List Renderer:** An abstraction to render only visible DOM nodes for high performance.
4. **Shared Matcher Package:** An npm workspace or shared package for the `fnv1a` and request hashing algorithm.
5. **DOM Builder Utility:** A hyperscript-like utility `h('div', { class: 'x' }, children)` to replace template strings.

## 4. Files with highest technical debt
1. `extension/shared/app.js` (3243 lines, mixed state/UI/events).
2. `extension/background.js` (1806 lines, handles storage, DNR, messaging, and licensing).
3. `extension/injected.js` (736 lines, complex XHR/Fetch overriding).
4. `cli/lib/server.js` (595 lines, mock routing and mock chain logic).
5. `extension/shared/matcher.js` (Manual syncing requirement).

## 5. Suggested engineering standards missing from the repository
1. **Frontend Component Standard:** Guidelines on how to write modular Vanilla JS components to prevent monoliths.
2. **State Management Pattern:** A defined standard on how state should flow from the background worker to the UI.
3. **Code Sharing Policy:** A standard for sharing code between the Node CLI and the Browser Extension (e.g., symlinks, build steps, or monorepo).
4. **File Size Enforcement in CI:** Automatically failing CI builds when files exceed 2000 lines (currently it relies on manual review).
5. **UI Testing Guidelines:** Standards for testing UI behavior independently of the service worker, potentially using unit tests with JSDOM.
