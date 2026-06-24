# EchoKit Engineering Review Report

## Executive Summary
* **Overall Repo Health Score**: 85/100
* **Biggest Risks**:
  * The size and complexity of `extension/shared/app.js` (over 3200 lines).
  * O(N) filtering performance issues during interaction rendering if not precomputed.
  * Extension world context boundary handling (isolated vs main world) complexity and missing checks in message passing.
  * Hardcoded endpoints (`LICENSE_ENDPOINT_ALLOWLIST`) requiring code changes when deployed endpoints update.
* **Highest ROI Improvements**:
  * Decompose `extension/shared/app.js` into modular components (e.g., `settings.js`, `header.js`).
  * Add a precomputed module-level LRU map cache for `URL` parsing inside tight loops to fix rendering bottlenecks.
  * Consolidate array filtering loops to reduce intermediate allocations.
* **Architecture Concerns**:
  * Some code duplication exists between `extension/shared/matcher.js` and `extension/injected.js` due to MV3 constraints; it creates dual-maintenance overhead.

## Critical Issues
1. **Oversized `app.js`**: `extension/shared/app.js` has grown past 3000 lines (3247 lines). This violates the `DEVELOPMENT_RULES.md` limit (2000 lines max). It makes maintenance, navigation, and testing difficult.
2. **Missing Precomputed Arrays in Rendering**: The rendering cycle in `app.js` may still dynamically filter or calculate values sequentially. O(N) operations within rendering loops must be precomputed and cached.
3. **URL Parsing Performance Bottleneck**: Instantiating `new URL()` in tight UI or filtering loops without an LRU cache can degrade performance for high volumes of interactions.
4. **Hardcoded Logic**: `worker/worker.js` contains `// TODO: Temporary free access during LemonSqueezy payment integration`, meaning unauthenticated access might be exposed, risking revenue.

## Duplication Report
1. **Matcher Dual-Maintenance**: The `matcher.js` logic is copied manually into `injected.js` because `injected.js` is injected into the MAIN world and cannot import ES modules natively.
   * *Impact*: High risk of regression if hash generation logic falls out of sync.
   * *Consolidation*: Create a build step that automatically injects/inlines `matcher.js` code into `injected.js` rather than copying manually.
2. **Settings Parsing & Binding Events**: In `app.js`, settings binding events (e.g. `bindSettingsBlocklistEvents`, `bindSettingsRewriteRulesEvents`) share structurally identical code for parsing, patching state, and refreshing.
   * *Consolidation*: Abstract to a generic factory function `createSettingsBinder(key, overlay)`.
3. **Mock WebSocket/EventSource**: `MockWebSocket` and `MockEventSource` in `injected.js` duplicate much event dispatch and mock frame replaying logic.
   * *Consolidation*: Extract a common `MockStreamController` class.

## Reusability Opportunities
1. **Event Binding Factory**: As mentioned, a generic binder for settings can remove ~100 lines from `app.js`.
2. **LRU Cache Utility**: Create a generic module-level LRU `Map` cache utility that can cache `URL` parsed objects or complex hash lookups, so it isn't implemented ad-hoc.
3. **Shared UI Components**: Decompose `app.js` HTML templates into vanilla JS Web Components or separate functional ES modules returning DOM nodes (e.g., `SettingsDialog`, `RequestDetailView`).

## Architecture Review
* **Scalability**: IndexedDB wrapper (`store.js`) is correctly handling large arrays, but queries lack advanced indexing, requiring in-memory filtering.
* **Maintainability**: Componentization has started (`layouts.js`, `interaction-renderer.js`), but the main controller (`app.js`) handles too much state management and event delegation. Needs a clear separation between State Management (Store/Actions) and View.
* **Separation of Concerns**: Good boundary between MAIN world (`injected.js`) and extension logic. But `app.js` mixes DOM manipulation, Chrome extension messaging, and business logic.
* **Resiliency**: The app relies heavily on `try/catch` (good), but network errors in the Worker might be swallowed.
* **Observability**: Missing structured logging. Currently relies on `console.log` wrapped in a `DEBUG` flag.

## Performance Findings
1. **URL Parsing**: `new URL(url)` is called inside loops (`parseUrl`, filtering). Needs LRU cache.
2. **Array Filtering**: Chaining `.filter()` causes O(K*N) intermediate allocations. Consolidate to single-pass loops.
3. **DOM Updates**: `softRenderList()` is a great optimization, but full modal re-renders (`showSettingsDialog()` drops the modal and recreates it) causes reflows. Switch to in-place DOM patches for settings updates.

## Security & Reliability Findings
1. **DOM XSS Preventative measures**: `sanitizeHTML` is well implemented, but care must be taken that callers use it exclusively when setting `innerHTML`.
2. **Control Characters in Sanitizer**: `sanitizeHTML` doesn't explicitly strip ASCII control characters (`/[\x00-\x20\x7F]/g`) before prefix checks (e.g. `javascript:`). A payload like `java&#09;script:` could bypass the check.
3. **Free Access TODO**: `worker.js` contains a TODO bypassing auth. This is a severe business risk.
4. **Extension Content Script Validation**: `content.js` sanitizes messages well, but ensuring all nested objects in payloads are structurally validated is critical.

## Testing Gaps
1. **LRU Cache & URL Parsing**: No unit tests verifying URL mutation bugs (users must safely clone cached URLs, but no tests enforce this).
2. **UI Componentization Coverage**: E2E tests exist, but vanilla JS components lack isolated unit tests.
3. **Worker Integration Tests**: Missing test coverage for Webhook payload processing (Stripe/LemonSqueezy logic) and signature validation.

## Rules Compliance Findings
1. **Violation**: File Size Limit (`DEVELOPMENT_RULES.md`)
   * *Rule*: No file > 2000 lines.
   * *Impact*: `app.js` is 3247 lines.
   * *Fix*: Split `app.js` into smaller domain files (`settings-dialog.js`, `detail-panel.js`).
2. **Violation**: Sanitizer URI Validation (`DEVELOPMENT_RULES.md` / Security Memory Facts)
   * *Rule*: Always strip ASCII control characters and spaces from strings prior to performing prefix checks.
   * *Impact*: DOM XSS risk via encoded control entities in URIs.
   * *Fix*: Update `sanitizeHTML` to strip control chars before `.startsWith('javascript:')`.
3. **Violation**: O(N) Array Operations (`DEVELOPMENT_RULES.md` / Perf Memory Facts)
   * *Rule*: Prevent O(N) array filtering performance bottlenecks during rendering.
   * *Impact*: UI lag on large datasets.
   * *Fix*: Precompute filtered arrays at the top level and cache parsed URLs.

## Recommended Refactor Plan
### Quick Wins
1. Update `sanitizeHTML` to strip ASCII control characters before URI scheme checks.
2. Add LRU caching to `parseUrl` and `normalizeUrl` utilities.
3. Remove or resolve the "Temporary free access" TODO in `worker.js`.

### Medium Effort Improvements
1. Consolidate chained array `.filter()` calls into single-pass `.reduce()` or loops.
2. Extract settings event binders into a generic factory function.
3. Automate the synchronization of `matcher.js` into `injected.js` via a build step.

### Long-Term Architecture Improvements
1. Break down `app.js` into smaller modules (`settings.js`, `detail.js`, `state.js`).
2. Implement in-place DOM patches for UI updates rather than full innerHTML replacement.
3. Introduce structured state management (e.g. a simple reactive store) rather than global mutable objects.

---
## 1. Top 10 highest-value fixes
1. Strip ASCII control characters in `sanitizeHTML` URI checks.
2. Split `app.js` into smaller modules to comply with the 2000 LOC limit.
3. Introduce an LRU cache for parsed `URL` objects.
4. Remove the temporary free access check in `worker.js`.
5. Automate syncing `matcher.js` to `injected.js`.
6. Consolidate chained `.filter()` operations into single loops.
7. Refactor settings event binders to use a shared factory.
8. Implement DOM patching instead of destroying and recreating the Settings modal.
9. Extract `MockWebSocket` and `MockEventSource` common logic.
10. Add unit tests for `URL` mutation and cache safety.

## 2. Top 10 duplication-removal opportunities
1. `matcher.js` logic manually copied to `injected.js`.
2. Settings event listeners (`bindSettingsBlocklistEvents`, `bindSettingsRewriteRulesEvents`, etc).
3. `MockWebSocket` and `MockEventSource` event dispatching logic.
4. Array mapping/filtering patterns repeated in `filterInteractions`.
5. Empty state rendering across different layouts (mostly fixed, but some edge cases remain).
6. Theme application logic duplicated across popup and devtools.
7. HTML string generation for similar list items.
8. JSON parsing and error handling blocks across the background worker.
9. Message sending boilerplate `BG({ type: ... })`.
10. Layout toggling logic.

## 3. Top reusable abstractions worth introducing
1. **Generic Settings Event Binder Factory**: For list-based configuration sections.
2. **Module-level LRU Map Cache**: For URL parsing and hash generation.
3. **MockStreamController**: Base class for WS/SSE mocking.
4. **DOM Patcher Utility**: Simple diff/patch for updating DOM elements without destroying focus.
5. **SafeJSON Utility**: Wraps `try/catch` parsing consistently.

## 4. Files/components with highest technical debt
1. `extension/shared/app.js` (Size, complexity, state management).
2. `extension/injected.js` (Duplicated matcher logic, complex XHR/Fetch overriding).
3. `extension/background.js` (Growing monolithic message handler).

## 5. Suggested engineering standards missing from the repository
1. **Build Step for Injected Scripts**: No standard for sharing code between ES Modules and non-module injected scripts.
2. **State Management Protocol**: No formal pattern for state mutation and UI reactivity (currently ad-hoc).
3. **DOM Patching Standard**: Standardizing soft UI updates over innerHTML replacements.
4. **Performance Profiling Standard**: No automated checks for rendering speed with >1000 items.
