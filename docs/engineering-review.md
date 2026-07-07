# EchoKit Engineering Review Report

## Executive Summary
- **Overall Repo Health Score**: 70/100
- **Biggest Risks**: Severe DOM Clobbering vulnerability in the HTML sanitizer (`extension/shared/sanitize.js`), and performance bottlenecks from unoptimized `new URL()` instantiation.
- **Highest ROI Improvements**: Fix `sanitizeHTML` by using `Element.prototype` methods, cache URL parsing with a local Map or variable, and decompose the `app.js` god component.
- **Architecture Concerns**: The frontend relies on a large monolithic `app.js` file (~3000 lines) which tightly couples UI rendering, state management, and business logic, lacking functional abstractions or reusable components.

## Critical Issues
1. **DOM Clobbering Vulnerability in Sanitizer**:
   - **Location**: `extension/shared/sanitize.js`
   - **Impact**: The sanitizer accesses `el.attributes` to iterate over attributes. If a malicious user injects `<form><input name="attributes"></form>`, `el.attributes` returns the input element instead of the expected `NamedNodeMap`. This causes the sanitizer loop to fail or behave unexpectedly, bypassing sanitization and leading to DOM XSS.
   - **Fix**: Always use `Element.prototype` methods directly (e.g., `Element.prototype.getAttributeNames.call(el)`, `Element.prototype.getAttribute.call(el, ...)`) instead of properties or methods on the element instance to completely prevent DOM Clobbering vulnerabilities.

2. **O(N) Performance Bottleneck in URL Parsing**:
   - **Location**: `extension/background.js` (e.g., lines 92, 1067, 1082, 1564), `extension/injected.js` (e.g., lines 182, 193, 255), `extension/shared/matcher.js`
   - **Impact**: `new URL()` is instantiated inside frequent operations and loops. This causes severe object allocation overhead and GC pressure.
   - **Fix**: Pre-calculate and cache the results of expensive normalization functions (e.g., `normalizeUrl`, `stripQuery`) in local variables or use a module-level LRU `Map` cache to avoid redundant `new URL()` allocations.

## Duplication Report
1. **Matcher Logic Duplication**:
   - **Location**: `extension/shared/matcher.js` vs `extension/injected.js`
   - **Impact**: Complex logic is duplicated across these files.
   - **Suggestion**: Consider leveraging a build step to allow module sharing, eliminating the need to maintain redundant copies.

## Reusability Opportunities
1. **UI Component Abstraction**:
   - **Location**: `extension/shared/app.js`
   - **Impact**: Tight coupling of UI rendering, state management, and business logic.
   - **Suggestion**: Extract rendering logic into reusable vanilla JS components. Create separate modules for Header, FilterBar, InteractionList, and SettingsModal.

## Architecture Review
- **Scalability & Maintainability**: `app.js` is an oversized file. This severely limits maintainability. The codebase relies on large, monolithic vanilla JavaScript files that tightly couple UI rendering and state management.
- **Suggestion**: Move towards smaller, modular JavaScript files with clear separation of concerns.

## Performance Findings
- **Object Allocation in Loops**: Instantiating `new URL()` inside loops (such as UI rendering loops or array filtering loops) is a severe performance bottleneck. Mitigate this using a local cache.

## Security & Reliability Findings
- **Unsafe Data Handling in Messaging**: The `injected.js` script receives messages via `postMessage`. It should strictly validate the event source (`if (ev.source !== window) return;`) to prevent unauthorized cross-origin messaging and state spoofing from malicious iframes.

## Testing Gaps
- **Missing Edge Cases in Sanitizer**: The test suite should include DOM clobbering payloads to verify the sanitizer's robustness.
- **Performance Tests**: Add tests to ensure repeated string interpolations and URL parsing do not degrade performance.

## Rules Compliance Findings
- **Rule Violated**: Missing modularity in frontend scripts.
- **Impact**: Technical debt is accumulating in `app.js`.
- **Fix**: Decompose `app.js` into smaller modules.

## Recommended Refactor Plan
- **Quick Wins**: Fix the DOM clobbering vulnerability in `sanitize.js` and add `ev.source === window` check in `injected.js`.
- **Medium Effort**: Introduce caching for `new URL()` in `matcher.js` and `background.js`.
- **Long-term**: Split `app.js` into modular files (`header.js`, `menu.js`, etc.) and introduce a bundler for `injected.js`.

## Final Requirement
1. **Top 10 highest-value fixes**:
   - Fix DOM clobbering in `sanitize.js`
   - Cache `new URL()` inside loops
   - Validate `postMessage` source in `injected.js`
   - Decompose `app.js` into smaller modules
   - Pre-calculate hash keys optimally
   - Move inline styles to CSS classes in `app.js`
   - Add DOM clobbering tests
   - Add large dataset performance tests
   - Ensure proper error boundary wrapping
   - Add strict Content Security Policy checks
2. **Top 10 duplication-removal opportunities**:
   - Matcher logic
   - URL parsing logic
   - Message dispatching logic
   - Badge rendering logic
   - Layout template strings
   - Event listener attachment patterns
   - Debounce implementations
   - State synchronization handlers
   - Error handling try-catch blocks
   - Storage read wrappers
3. **Top reusable abstractions**:
   - `URLParserCache`
   - `EventDispatcher`
   - `SafeDOMElement`
   - `VirtualList`
4. **Files/components with highest technical debt**:
   - `extension/shared/app.js`
   - `extension/background.js`
   - `extension/injected.js`
5. **Suggested engineering standards missing**:
   - Strict Content Security Policy (CSP) enforcement.
   - Bundling process for content/injected scripts.
   - Automated performance benchmarking in CI.
