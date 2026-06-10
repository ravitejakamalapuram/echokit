# EchoKit Engineering Review Report

## Executive Summary
* **Overall repo health score**: 7.5/10. The codebase represents a very useful utility, but suffers from organic growth in its core UI components, leading to maintainability and performance issues.
* **Biggest risks**: `extension/shared/app.js` is an oversized 'god' component (3243 lines) that handles too many responsibilities (UI generation, state management, event delegation). It violates the 2000-line hard limit defined in `DEVELOPMENT_RULES.md` and poses a massive regression risk. Code duplication in HTML generation via string concatenation opens the door to XSS and makes reusability hard.
* **Highest ROI improvements**: Aggressively chunking `app.js` following the UI Componentization Implementation plan (`specs/UI_COMPONENTIZATION_IMPLEMENTATION.md`). Moving all URL parsing to the cached `parseUrl` utility from `interaction-helpers.js`. Replacing raw string-concatenated `innerHTML` rendering with proper UI component structures.
* **Architecture concerns**: The Vanilla JS approach without a framework or bundler is starting to break down under the weight of the application size. There is tight coupling between data management and DOM manipulation.

## Critical Issues
* **Oversized files violating DEVELOPMENT_RULES.md**: `extension/shared/app.js` is 3243 lines (limit is 2000).
* **XSS and Code Injection Risks**: Raw string interpolation fed directly into `innerHTML` throughout `app.js` and `layouts.js` instead of using `sanitizeHTML` exclusively and correctly as required by security guidelines.
* **Tight UI loop performance**: Instantiating `new URL()` inside loops (e.g., in `app.js` line 1341, `interaction-renderer.js` line 179) causes measurable memory allocation and CPU overhead during frequent UI renders.
* **Array Filter performance bottleneck**: `.filter()` is chained or called inside maps in tight rendering cycles (e.g., `background.js` lines 959, 1551, `interaction-renderer.js` line 290) creating O(N*K) complexity.

## Duplication Report
* **HTML Template Generation**: The pattern `overlay.innerHTML = sanitizeHTML(... template string ...)` is duplicated dozens of times in `app.js`. This should be abstracted into a generic Modal/Overlay component manager.
* **URL Parsing Logic**: Trying to get pathname/query/domain from URLs using `try-catch { new URL() }` is repeated across `app.js`, `background.js`, and `interaction-helpers.js`.
* **Matcher Logic**: `extension/shared/matcher.js`, `extension/injected.js` (hand-inlined), and `cli/lib/match.js` duplicate the same request matching logic to support different execution contexts.
* **Consolidation Suggestions**: Implement a central `OverlayComponent` class for managing dialogs. Unify all URL operations under the `parseUrl` cached utility.

## Reusability Opportunities
* **UI Components**: Extract buttons, inputs, toggles, badges into reusable template functions or Web Components to reduce `app.js` sprawl.
* **Storage Layer Abstraction**: The interaction logging logic interacts with `store.js` directly in many places. Creating an `InteractionService` wrapper would standardize cache and IndexedDB queries.
* **Mock Handlers**: Generalize the logic that applies mock payloads to outgoing requests in `injected.js`.

## Architecture Review
* The system uses a hand-rolled Vanilla JS approach for the Chrome extension, which is increasingly common for MV3 but is struggling to scale. State management is ad-hoc (`const state = {...}`).
* Tight coupling between `app.js` (UI) and `background.js` via message passing that relies on implicit object structures.
* The decision to avoid bundlers is respected, but requires disciplined modularity (ES modules) which is currently lacking in the 3000+ line UI file.

## Performance Findings
* **Uncached URL instantiation**: Multiple calls to `new URL()` inside mapping loops instead of using the `parseUrl` utility. (Seen in `app.js:3238`, `interaction-renderer.js:179`)
* **Inefficient filtering**: O(N) filtering inside UI render loops (`interaction-renderer.js:290`). For 1000+ requests, this freezes the popup UI.
* **Memory Leaks in Layouts**: Event listeners are aggressively attached but it's unclear if they are reliably detached when views switch.

## Security & Reliability Findings
* Direct string interpolation into `.innerHTML` bypasses standard escaping mechanisms. While `sanitizeHTML` exists, it must be audited to ensure it covers all vectors, or better, the codebase should switch to `document.createElement()` or `textContent` for dynamic values.
* The `eval()` or similar dynamic code execution risks if mocked responses containing malicious scripts are injected into contexts without strong CSPs.

## Testing Gaps
* The custom testing structure (`cli/test/test.js`, `tests/test-store.js`) is decent but lacks comprehensive end-to-end coverage across the extension boundary.
* UI component tests are mostly manual. Playwright is present but test coverage for complex interactions (like editing mock payloads) appears low.

## Rules Compliance Findings
* **Rule Violation**: File size > 2000 lines limit. (`extension/shared/app.js` is ~3200 lines). Impact: High cognitive load, difficult merges, high defect rate.
* **Rule Violation**: Function size > 150 lines. (`app.js` contains multiple render functions exceeding this).
* **Rule Violation**: Security conventions regarding DOM generation. Several places use `innerHTML` directly or with inadequate sanitization for user-provided data (e.g., recorded URLs/bodies).

## Recommended Refactor Plan
1. **Quick Wins**: Replace all `new URL()` calls in rendering loops with the cached `parseUrl` helper. Optimize array `.filter()` chains.
2. **Medium Effort**: Extract Modal/Overlay logic from `app.js` into `extension/shared/components/modal.js`.
3. **Long-Term**: Fully implement the UI Componentization Plan from `specs/UI_COMPONENTIZATION_IMPLEMENTATION.md`. Break `app.js` into domain-specific modules (State, Navigation, Rendering, Handlers).

## Final Requirements Lists

### Top 10 highest-value fixes
1. Break up `extension/shared/app.js` to get under 2000 lines.
2. Replace raw `new URL()` in loops with cached `parseUrl`.
3. Audit and fix `.innerHTML` assignments to ensure strict `sanitizeHTML` usage.
4. Pre-compute and cache array `.filter()` results in UI render cycles.
5. Standardize event listener detachment to prevent memory leaks.
6. Centralize storage operations into an `InteractionService`.
7. Extract repeated overlay/modal HTML strings into a reusable component.
8. Sync matcher logic across Node CLI, background, and injected script.
9. Break down 150+ line render functions into smaller helpers.
10. Enhance error handling around `JSON.parse` operations in mock data handling.

### Top 10 duplication-removal opportunities
1. Modal overlay string templates in `app.js`.
2. URL parsing `try-catch` blocks.
3. Request matcher logic across 3 different environments.
4. Date/time formatting logic.
5. Badge rendering HTML strings (method, status).
6. Storage lookup and cache miss logic.
7. Event listener attachment/detachment boilerplate.
8. Empty state rendering logic.
9. Message passing boilerplate to background script.
10. Tooltip HTML generation.

### Top reusable abstractions worth introducing
1. `ModalManager` / `OverlayComponent`
2. `InteractionService` (Repository pattern for Store)
3. `BadgeComponent` (Method/Status styling)
4. `DataGridComponent` (For the main interaction list)
5. `EventEmitter` (To decouple UI state from DOM events)

### Files/components with highest technical debt
1. `extension/shared/app.js` (Oversized, god component)
2. `extension/injected.js` (Hand-inlined string matching, complex overrides)
3. `extension/background.js` (Complex state machine, multiple responsibilities)
4. `extension/shared/matcher.js` (Needs strict synchronization with other files)

### Suggested engineering standards missing from the repository
1. Strict enforcement of DOM manipulation via helper functions rather than raw `innerHTML`.
2. Use of a lightweight state management pattern (e.g., Signals or simple PubSub) instead of direct `state` mutation with manual UI repaints.
3. Automated linting rule for file and function length bounds (currently just a markdown guideline).
4. Standardized API client for all `fetch` calls originating from the extension.
5. A defined component lifecycle (Mount, Update, Unmount) to manage side effects and event listeners.