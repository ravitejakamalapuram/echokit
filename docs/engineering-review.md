# EchoKit Codebase Audit Report

## Executive Summary
* **Overall repo health score:** 6.5/10
* **Biggest risks:** `extension/shared/app.js` is a monolithic file (3252 lines) handling UI rendering, state management, and DOM event delegation. This violates single responsibility principles and creates a significant regression risk. Potential DOM XSS vectors in UI rendering when assigning raw template strings to `.innerHTML` without consistent use of `sanitizeHTML()`.
* **Highest ROI improvements:** Extract DOM rendering logic into separate pure functions and implement a Virtual List for large interaction sets. Implement caching mechanisms (`WeakMap` for stringified JSON, O(1) `Map` cache for parsed `URL` objects).
* **Architecture concerns:** The vanilla JS architecture tightly couples the view layer with the data and network layers. Prop-drilling occurs implicitly via global variables and DOM attributes.

## Critical Issues
1. **DOM XSS Vulnerability via Unsanitized `innerHTML`**: Multiple files (`app.js`, `layouts.js`). Wrap all dynamic template literal evaluations with `sanitizeHTML(html)` before assignment.
2. **O(N) String Allocations in Render Loops**: `extension/shared/app.js`. Use a `WeakMap` to cache the stringified representation of interaction bodies.
3. **Unhandled `TypeError` from `new URL()`**: `extension/shared/matcher.js`. Always pass a valid base URL.
4. **Missing `postMessage` Source Validation**: `extension/injected.js`. Add an explicit guard: `if (ev.source !== window) return;`.

## Duplication Report
1. **Repeated DOM Creation Boilerplate**: Manual DOM node creation (`document.createElement`, `classList.add`, `appendChild`) is duplicated across UI logic.
2. **Repeated `chrome.runtime.sendMessage` Error Handling**: Try-catch blocks and response validations are scattered across different views.
3. **URL Normalization Logic**: Stripping queries, trailing slashes, and hashes happens in both matching and UI logic inconsistently.

## Reusability Opportunities
1. **`UrlCache` / `UrlParser`**: A centralized LRU `Map` cache for parsed `URL` objects.
2. **`MessageBroker`**: A strongly-typed wrapper around `chrome.runtime.sendMessage`.
3. **`WeakMapFilterCache`**: A reusable class to cache expensive `JSON.stringify()` outputs.
4. **`VirtualListRenderer`**: A reusable UI component using `IntersectionObserver`.
5. **`ScopeManager`**: A class abstracting the complex domain/tab/global logic.

## Architecture Review
* **Scalability:** The current vanilla JS approach lacks state-driven reactivity, meaning DOM updates rely on manual `innerHTML` wipes or specific node updates.
* **Maintainability:** `app.js` operates as a god file. The lack of modular boundaries makes concurrent development difficult.
* **Separation of Concerns:** UI rendering logic is interleaved with Chrome API calls and business logic.
* **Resiliency:** The codebase relies heavily on manual escaping (`escapeHtml`).

## Performance Findings
1. **Expensive Renders**: Modifying the `innerHTML` of large parent containers forces the browser to recalculate styles.
2. **Memory Usage**: Uncached `new URL()` and `JSON.stringify()` calls inside loops lead to excessive garbage collection pressure.
3. **Missing Caching**: Repeated normalizations of identical URLs and bodies.

## Security & Reliability Findings
1. **Unvalidated `postMessage` sources** in `injected.js` can lead to cross-origin state spoofing.
2. **`javascript:` URI Bypass** risk if custom sanitizers do not correctly strip ASCII control characters.
3. **Missing `aria-label` / `title` attributes** on interactive buttons reducing accessibility.
4. **Memory Leaks**: Event listeners on DOM elements are not always properly deregistered.

## Testing Gaps
* **Missing UI Unit Tests**: The complex manual state management within `app.js` lacks isolated unit testing.
* **Edge Case Gaps**: No specific tests verifying the handling of malicious HTML payloads to ensure `sanitizeHTML()` operates effectively.
* **Flaky Tests**: Playwright testing of Chrome extensions can exhibit flakiness due to Service Worker lifecycle management.

## Rules Compliance Findings
* **Rule Violation**: Magic strings and duplicated logic in message passing (violates clean code / DRY rules).
* **Rule Violation**: Weak boundaries between isolated worlds. Ensure source validation for all message events.
* **Rule Compliance**: The no DOM access in service worker rule is well adhered to.

## Recommended Refactor Plan
### Quick Wins (High ROI)
1. Add `ev.source === window` check to `injected.js`.
2. Update `new URL(url)` invocations to include `location.href` as a base.
3. Implement `WeakMap` cache for search stringifications.

### Medium Effort
1. Enforce `sanitizeHTML()` across all `innerHTML` assignments.
2. Consolidate URL normalization and caching into a `UrlCache` module.
3. Add accessibility attributes (`aria-label`, `title`) to all interactive elements.

### Long-Term Architecture Improvements
1. Decompose `app.js` into separate cohesive modules (`StateStore`, `NetworkClient`, `LayoutManager`, `InteractionList`).
2. Implement virtualized list rendering for interactions.

---

1. Top 10 highest-value fixes: Fix DOM XSS vulnerabilities, Secure `postMessage` in `injected.js`, Fix relative path crashes in `new URL()`, Prevent `javascript:` URI bypasses, Cache parsed `URL` objects, Cache `JSON.stringify` results, Add matching `title` and `aria-label` attributes to buttons, Clear event listeners during DOM unmounting, Map `aria-pressed` to toggle chips, Ensure `app-metadata.json` exists.
2. Top 10 duplication-removal opportunities: Consolidate manual DOM element creation, Extract `chrome.runtime.sendMessage` blocks, Unify URL normalization logic, Extract `JSON.parse` blocks, Centralize debounce logic, Extract interaction body formatting logic, Unify HTTP header array/object conversions, Consolidate mock state toggling logic, Extract scope-filtering logic, Unify theme toggle logic.
3. Top reusable abstractions worth introducing: `UrlCache`, `MessageBroker`, `VirtualList`, `DOMSanitizer`, `ScopeManager`.
4. Files/components with highest technical debt: `extension/shared/app.js`, `extension/shared/interaction-renderer.js`, `extension/injected.js`, `extension/shared/matcher.js`.
5. Suggested engineering standards missing from the repository: Enforced ESLint rules for `no-console` and `no-inner-html`, Requirement for `WeakMap` caching, Mandatory base URL parameter for all `new URL()`, Standardized requirement for virtualized lists, Strict UI accessibility guidelines.
