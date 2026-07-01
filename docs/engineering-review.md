# Repository Engineering Review

## Executive Summary
* **Overall Repo Health Score**: 75/100
* **Biggest Risks**: High performance bottlenecks due to `new URL()` instantiation in inner render and background script loops, severe lack of component modularity in the frontend (`app.js` is over 3,000 lines), and DOM XSS vulnerabilities when creating UI templates.
* **Highest ROI Improvements**: Extracting URL parsing into a module-level O(1) LRU Map cache. Decomposing `extension/shared/app.js` into distinct ES modules for distinct UI components. Adopting `sanitizeHTML` universally across all DOM injections.
* **Architecture Concerns**: The frontend is a monolithic vanilla JavaScript file which makes state management, rendering, and testing fragile. Direct usage of `innerHTML` across multiple layouts presents a continuous XSS risk if sanitization is missed.

## Critical Issues
1. **O(N) URL Parsing Bottleneck**: `new URL()` is called heavily inside iterative array processing functions in `extension/background.js` and `extension/injected.js`, and within rendering loops. This creates serious rendering lag when a large number of requests are tracked.
2. **DOM XSS via `innerHTML`**: Multiple places in `extension/shared/app.js` and `extension/shared/layouts.js` assign strings directly to `element.innerHTML` without using the available `sanitizeHTML()` wrapper. While some usages pass `sanitizeHTML()`, others do not, providing a bypass.
3. **God Component Pattern**: `extension/shared/app.js` acts as a God component. It contains routing, state management, UI rendering, event delegation, and business logic. It violates Single Responsibility and makes testing nearly impossible.

## Duplication Report
1. **URL Normalization**: Repeated URL stripping logic (`u.search = ''; u.hash = '';`) exists independently in `extension/injected.js` and `extension/shared/matcher.js`. *Fix: Consolidate to a shared URL utility.*
2. **Feature Flags / Context Detection**: Checking if the script is in "popup" or "devtools" mode and determining available feature sets (`FEATURES.popup` vs `FEATURES.devtools`) is duplicated in `app.js` and other extension components. *Fix: Extract to a `context.js` service.*
3. **Template Rendering**: `overlay.innerHTML = sanitizeHTML(str)` pattern is duplicated over 10 times in `app.js`. *Fix: Extract to a reusable `renderOverlay(template)` function.*

## Reusability Opportunities
1. **URL Cache Manager**: A reusable `parseUrlCache` utility that memoizes `new URL()` calls.
2. **Overlay Manager**: A reusable modal/overlay component that handles DOM injection, sanitization, state, and cleanup (removing event listeners).
3. **Virtual List Renderer**: A reusable virtualized list to efficiently render thousands of network interactions, instead of relying on debounced soft re-renders that still generate large DOM trees.

## Architecture Review
* **Scalability**: Poor. Rendering thousands of interactions will lag the browser due to lack of DOM virtualization. The `app.js` file is too large for multiple engineers to work on concurrently without severe merge conflicts.
* **Maintainability**: Poor for the frontend. The `app.js` logic relies heavily on implicit global state (e.g., `const state = {...}`).
* **Layering**: Missing. There is no clear separation between the Model (interactions, rules), View (HTML generation), and Controller (event handling) in the popup/devtools UI.

## Performance Findings
1. **Frontend Rendering**: `app.js` triggers soft and hard renders. The lack of a virtual DOM means rendering 1,000+ items builds huge HTML strings which causes jank.
2. **Memory Leaks**: `app.js` attaches listeners (e.g., `oninput`) which are not explicitly cleaned up if the DOM elements are destroyed and recreated, though garbage collection might handle some.
3. **Background Worker**: Iterating over `interactions` arrays while parsing URLs for matching will block the service worker thread, potentially delaying other extension functions.

## Security & Reliability Findings
1. **Unsanitized HTML Injection**: Search for `innerHTML = ` across `app.js` reveals potential bypasses if `sanitizeHTML` is forgotten in the future.
2. **Insecure Storage Risks**: Mock data is persisted. If malicious data is imported via the JSON import function, and `sanitizeHTML` fails to strip it, a stored XSS could execute in the extension context.
3. **Message Validation**: `window.addEventListener('message', ...)` in `injected.js` needs strict origin checks. Currently, it checks `ev.source !== window`, which is good, but must be consistently audited against iframe spoofing.

## Testing Gaps
1. **Unit Tests for Rendering**: The vanilla JS frontend (`app.js`) is largely untested at the unit level because it is tightly coupled to the DOM.
2. **Security Tests**: No automated tests exist to verify that `sanitizeHTML()` correctly catches XSS payloads specifically in the context of the extension's rendering engine.
3. **Performance Benchmarks**: No automated tests to assert that parsing 10,000 URLs or rendering 1,000 UI rows happens within the required millisecond budget.

## Rules Compliance Findings
1. **Rule Violation (Performance)**: The rule "No memory leaks — event listeners removed, timers cleared" is violated by anonymous event listeners attached in `app.js` during re-renders.
2. **Rule Violation (Performance)**: `new URL()` in loops violates the implicit rule for performance and the specific memory instructions.
3. **Rule Violation (Architecture)**: The rule "Function size within limits — no function > 150 lines" is frequently violated in `app.js`.

## Recommended Refactor Plan

### Quick Wins (Next Sprint)
1. Implement the `Map` based URL cache across `background.js`, `injected.js`, and `matcher.js`.
2. Wrap all `innerHTML` assignments in `app.js` with `sanitizeHTML()`.

### Medium Effort Improvements (Next Quarter)
1. Split `app.js` into smaller modules: `State.js`, `Renderer.js`, `Events.js`.
2. Implement a `renderOverlay` utility to DRY up the template injection logic.

### Long-Term Architecture Improvements (Next 6 Months)
1. Rewrite the frontend using a virtual DOM approach or a lightweight framework (like Preact or SolidJS) to improve render performance and component isolation.
2. Implement a robust background messaging bus to decouple UI components from direct `chrome.runtime.sendMessage` calls.

---

### Top 10 Highest-Value Fixes
1. Introduce O(1) URL parsing cache.
2. Standardize `sanitizeHTML` on all `innerHTML` usages.
3. Decompose `app.js` into multiple files.
4. Add `title` attributes matching `aria-label` on all interactive buttons.
5. Create a unified Overlay/Modal component.
6. Enforce strict `window` source validation on all `postMessage` listeners.
7. Implement DOM virtualization for the interaction list.
8. Consolidate URL normalization logic into a single shared utility.
9. Refactor event delegation to avoid stale closures in `app.js`.
10. Add unit tests for `sanitizeHTML` edge cases.

### Top 10 Duplication-Removal Opportunities
1. URL normalization (`u.search = ''; u.hash = '';`).
2. Mode checking (`if (state.mode === 'popup')`).
3. Overlay template rendering blocks.
4. Error handling around `JSON.parse`.
5. Button group rendering (HTML strings for icons).
6. Message passing wrappers (`BG(msg)` vs raw `chrome.runtime.sendMessage`).
7. Filtering logic (iterating arrays for visibility checks).
8. DOM querying (`document.getElementById`).
9. CSS classes for layout structure.
10. Request header formatting functions.

### Top Reusable Abstractions Worth Introducing
1. `URLCache` - Module-level memoized URL parser.
2. `ModalManager` - Handles UI overlays securely.
3. `VirtualList` - Handles rendering long lists efficiently.
4. `MessageBus` - Type-safe wrapper around Chrome message passing.
5. `StoreService` - Abstraction over IndexedDB interactions.

### Files/Components With Highest Technical Debt
1. `extension/shared/app.js` (Over 3,000 lines, god component).
2. `extension/background.js` (Large, stateful, heavy parsing).
3. `extension/shared/layouts.js` (Direct DOM manipulation).
4. `extension/injected.js` (Complex state logic inside the main world).
5. `cli/lib/server.js` (Monolithic server logic).

### Suggested Engineering Standards Missing From the Repository
1. Strict component modularity (Max lines per file).
2. Automated performance benchmarking for UI rendering.
3. Automated XSS vulnerability scanning on HTML templates.
4. State management patterns (e.g., unidirectional data flow).
5. Explicit event listener cleanup documentation/rules.
