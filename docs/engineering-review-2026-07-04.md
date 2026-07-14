# Engineering Review Report - 2026-07-04

## Executive Summary
* **Overall Repo Health Score**: 6/10 (Functional but burdened by significant UI and legacy architecture debt)
* **Biggest Risks**:
  * The god file `extension/shared/app.js` is extremely bloated (>3200 lines). It mixes rendering, state management, and DOM event handling, which violates the single responsibility principle and makes maintainability very difficult.
  * O(N) or O(N^2) array filtering performance bottlenecks exist in the frequent UI rendering loops (e.g. `filteredInteractions`).
  * Severe DOM XSS risk through `innerHTML` assignments without proper data sanitation or `sanitizeHTML` wrapping.
  * Reinstantiating `new URL()` in tight loops degrades performance under high traffic.
* **Highest ROI Improvements**:
  * Execute the `UI_COMPONENTIZATION_IMPLEMENTATION.md` strategy fully to modularize `app.js`.
  * Create a robust, memoized `parseUrl` utility with an LRU cache to eliminate redundant parsing.
  * Implement stricter `sanitizeHTML` enforcement on all `innerHTML` assignments and replace raw string concatenation with safer DOM Element manipulation (`Element.prototype` methods).
* **Architecture Concerns**:
  * Tight coupling between vanilla JS state and DOM elements limits extensibility and tests.
  * Reusable component abstraction is absent; raw string template interpolation dictates the UI.
  * `extension/background.js` (1800+ lines) is taking on mixed responsibilities (storage, license validation, DNR rules, event handling).

## Critical Issues
* **God Component (app.js)**: `extension/shared/app.js` exceeds acceptable complexity (3250+ lines). It handles layout rendering, request processing, state holding, and UI event delegation, leading to tight coupling and fragile DOM manipulations.
* **God Component (background.js)**: `extension/background.js` exceeds 1800 lines, bundling IndexedDB interactions, license checks, state synchronization, and declarativeNetRequest (DNR) management.
* **Performance Bottleneck (`new URL()`)**: Inside `extension/background.js` and `extension/injected.js`, `new URL()` is called inside event listeners tracking network interactions. This will lead to serious performance and garbage collection overhead.
* **Security (DOM XSS)**: `app.js` builds overlay and layout templates as strings and assigns them via `innerHTML`. If any dynamic property (like URL, Header keys) bypasses `sanitizeHTML()`, it opens DOM XSS vectors.
* **Development Rules Violations**: `console.log` statements are present in production code (`extension/background.js` and `cli/lib/server.js`), which violates `DEVELOPMENT_RULES.md` stating "No `console.log` in production paths".

## Duplication Report
* **Repeated URL Parsing**: Domain mapping and hash calculation logic repeats URL normalization and extraction across `extension/shared/matcher.js`, `extension/injected.js`, and `extension/background.js`.
* **Repeated Filter Logic**: Sequential filtering operations over the interactions array (for URL searches, method filters, and status filters) are spread across the UI update cycles.
* **Repeated DOM Operations**: Event attachment and detachment logic is scattered globally, often duplicating similar `addEventListener` boilerplates and failing to consistently implement event delegation.

## Reusability Opportunities
* **UI Abstractions**: Migrate string templates to formal reusable functional components within `extension/shared/interaction-renderer.js` and `extension/shared/layouts.js`.
* **State Management Service**: Extract a typed State Container from `app.js` to manage `interactions`, `settings`, and UI states symmetrically.
* **URL Caching Utility**: Introduce a `parseUrl` utility module to centralize caching, normalizing, and parsing of network URLs, returning frozen objects to prevent cross-request mutations.
* **DOM Sanitize Service**: Build a rigid HTML templating tag function (e.g. \`html\`...\`\`) that automatically escapes bound values to guarantee safety over manual `sanitizeHTML()` calls.

## Architecture Review
* **Scalability**: The vanilla JS application has outgrown its procedural architecture. Transitioning towards a more formalized event-driven or component-driven structure (like Web Components or a lightweight VDOM) would improve scalability.
* **Maintainability**: Files over 1,000 lines (with warnings supposed to happen at 1,000 lines according to docs) degrade developer experience. Specifically, `app.js` makes adding new columns or views very hard.
* **Extensibility**: Integrating plugins or advanced data filters requires altering core `app.js` flows.
* **Layering**: Missing strict boundaries between Data/Store layers, Application Logic layers, and View/Rendering layers.

## Performance Findings
* **Array Filtering Overhead**: `app.js` iteratively filters the `interactions` list on every keystroke or update, without using indexed state or weak maps for the object bodies.
* **Unnecessary Re-renders**: Triggering full DOM updates via `innerHTML` on minor changes causes layout trashing. The docs require "soft render for list updates" but this isn't strictly adhered to.
* **Repeated URL Allocation**: Found `new URL()` in `background.js` and `injected.js` tight loops.

## Security & Reliability Findings
* **Untrusted DOM Elements**: When interacting with potentially untrusted DOM elements (e.g., forms), there is a DOM Clobbering risk if methods are not safely invoked using `Element.prototype` methods directly.
* **Sanitization Escapes**: `extension/shared/sanitize.js` validates URIs against malicious schemes (`javascript:`), but it must strip ASCII control characters and spaces before prefix checks to avoid XSS bypasses.
* **PostMessage Validation**: Message listeners must strictly validate `ev.source === window` to prevent state spoofing from malicious iframes.

## Testing Gaps
* **Unit Testing**: Core pure functions in UI rendering and caching lack independent unit tests.
* **Integration Tests**: CLI and smoke tests exist, but mocking engine resilience during heavy loads (1000+ rapid requests) is under-verified.
* **End-to-End Validation**: Playwright mocking scripts must properly stub `window.chrome` APIs to verify state isolation without needing manual browser interactions.

## Rules Compliance Findings
* **DEVELOPMENT_RULES.md (Performance)**: Fails "No unnecessary full re-renders".
* **DEVELOPMENT_RULES.md (Code Quality)**: Fails "No `console.log` in production paths".
* **DEVELOPMENT_RULES.md (Code Quality)**: Fails "File size within limits — no file > 2000 lines" (`app.js` is 3200+).

## Recommended Refactor Plan

### Quick Wins
1. Remove all `console.log` invocations in production scripts (`background.js`, `app.js`).
2. Add ASCII control character stripping in `sanitize.js` to fix the URI validation XSS gap.
3. Validate `ev.source` strictly in `window.addEventListener('message')` within `injected.js` and `content.js`.

### Medium Effort Improvements
1. Implement an LRU cache module for URL parsing to eliminate `new URL()` overhead globally.
2. Refactor array filtering in UI render loops using memoized maps or weak maps to achieve O(1) body lookups.
3. Replace raw `innerHTML` concatenation with secure DOM builders or a specialized template literal tag.

### Long-term Architecture Improvements
1. Fully dismantle `extension/shared/app.js` into isolated components (`Header`, `Toolbar`, `DataGrid`, `SettingsModal`).
2. Implement a unified Application State Manager.
3. Decompose `extension/background.js` into distinct service modules (DNR Service, Sync Service, License Service).

## Top 10 highest-value fixes
1. Eliminate `new URL()` calls in request interception loops by implementing an LRU cache.
2. Secure `sanitize.js` by aggressively stripping ASCII control characters before scheme validation.
3. Implement `ev.source === window` validation on all `postMessage` receivers.
4. Remove all `console.log` output from production execution paths.
5. Fix O(N^2) array filtering overhead in `app.js` UI updates.
6. Centralize and sanitize all `innerHTML` assignments using a safer template literal tag.
7. Wrap unhandled `JSON.parse` blocks in `app.js` with try-catch per development rules.
8. Use `Element.prototype.getAttribute.call()` to mitigate DOM Clobbering vulnerabilities.
9. Enforce proper debounce wrappers around rapid UI inputs (search, filter).
10. Explicitly set UTF-8 encoding in all python documentation generators.

## Top 10 duplication-removal opportunities
1. URL parsing and domain extraction logic duplicated across background, injected, and matcher scripts.
2. The logic for compiling matched hashes is fragmented across network hooks.
3. Row rendering templates for DevTools and Popup modes are partially divergent and repetitive.
4. UI DOM event listener attachment logic repeats across multiple overlay modals.
5. Error toast notifications have duplicated instantiation logic.
6. Form data serialization loops are repeated in request handlers.
7. Sequential array filters (`filter(method).filter(status).filter(search)`) can be squashed.
8. State synchronization listeners repeat validation blocks.
9. Message passing boilerplate `chrome.runtime.sendMessage` wraps could be abstracted.
10. `chrome.storage.session` read/write blocks repeat default-state checks.

## Top reusable abstractions worth introducing
1. `parseUrl` - Centralized, memoized URL parser with an LRU cache.
2. `SafeHTML` - Template tag function for auto-escaping XSS risks in DOM injections.
3. `UIComponent` - Base class or functional abstraction for rendering detached DOM chunks.
4. `StoreDispatcher` - Central state mutation event bus.
5. `StorageService` - Abstracted wrapper over IndexedDB and `chrome.storage`.
6. `DOMDelegate` - Global event delegation registry for the document body.
7. `Debounce` / `Throttle` utility module.

## Files/components with highest technical debt
1. `extension/shared/app.js` (3250+ lines, multiple concerns).
2. `extension/background.js` (1800+ lines, bloated service worker).
3. `extension/injected.js` (Complex fetch/XHR proxy logic).
4. `extension/shared/matcher.js` (Inefficient hash generation in loops).

## Suggested engineering standards missing from the repository
1. **Strict Content Security Policy (CSP) & HTML Templating**: Disallow all raw `.innerHTML` usage in favor of a mandated sanitization pipeline or Web Components.
2. **State Immutability Standard**: Mandate that all application state updates must generate new object references to reliably trigger soft UI renders.
3. **Event Delegation Policy**: Prohibit inline `onclick` or disparate `.addEventListener` usage in favor of a unified global event dispatcher for UI elements.
4. **URL & Parsing Efficiency Standards**: Forbid `new URL()` or `JSON.parse()` within tight loops or iterative array functions without explicit caching.
5. **Component Size Limits**: Hard limits preventing UI module files from exceeding 500 lines to enforce modularity.
