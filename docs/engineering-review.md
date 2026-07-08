# EchoKit Engineering Review Report

## Executive Summary

* **Overall Repo Health:** 70/100
* **Biggest Risks:**
  1. **DOM Clobbering in HTML Sanitization:** The `sanitizeHTML` function is vulnerable to DOM clobbering, which could bypass XSS protections.
  2. **Cross-Origin PostMessage Spoofing:** The `injected.js` script lacks origin validation on `window.message` events, allowing untrusted iframes to spoof events.
  3. **Performance Bottleneck in Interaction Filtering:** The `filteredInteractions` function in `extension/shared/app.js` runs in O(N) on every keypress with high object allocations, causing UI lag on large API dumps.
* **Highest ROI Improvements:**
  1. Secure the DOM usage in `sanitizeHTML` to fix the clobbering bypass.
  2. Implement `ev.source === window` check in `injected.js`.
  3. Optimize `filteredInteractions` via a WeakMap cache and pre-computing expensive values.
* **Architecture Concerns:**
  * **Monolithic Vanilla JS:** The extension relies on large, monolithic vanilla JavaScript files (e.g., `extension/shared/app.js` and `extension/background.js`) that tightly couple UI rendering, state management, and business logic, lacking functional abstractions or reusable components.
  * **Duplicated Code:** Matcher logic is heavily duplicated between the extension (`extension/shared/matcher.js`) and the CLI server (`cli/lib/match.js`).

## Critical Issues

1. **DOM Clobbering Vulnerability (Security)**
   * **Location:** `extension/shared/sanitize.js`
   * **Issue:** The code iterates over attributes using `Array.from(el.attributes)`. A malicious payload like `<form id="attributes">` or `<img name="attributes">` will clobber the `attributes` property, returning the element itself rather than a NamedNodeMap. This causes the sanitizer to skip attribute validation completely, allowing an XSS payload to execute.
   * **Fix:** Always use `Element.prototype.getAttributeNames.call(el)` and `Element.prototype.getAttribute.call(el, name)` to bypass any clobbered properties.

2. **Cross-Origin Message Spoofing (Security)**
   * **Location:** `extension/injected.js`
   * **Issue:** The script registers a listener via `window.addEventListener('message', ...)` but fails to strictly validate the event source. Any iframe on the page can send messages spoofing the `SRC_CONTENT` source.
   * **Fix:** Add an explicit check: `if (ev.source !== window) return;` at the beginning of the message handler.

3. **Performance Bottleneck in Interaction Filtering (Performance)**
   * **Location:** `extension/shared/app.js` (`filteredInteractions`)
   * **Issue:** Filtering arrays in frequent rendering or update loops currently involves repeatedly stringifying JSON bodies or allocating new arrays. This causes severe O(N) performance bottlenecks and object allocations during search.
   * **Fix:** Utilize a `WeakMap` to cache stringified representations of object bodies (e.g., `JSON.stringify(body).toLowerCase()`) and favor `for...in` loops over `Object.entries()` (with `Object.prototype.hasOwnProperty.call(obj, key)` safety checks) to eliminate the overhead.

## Duplication Report

1. **Matcher Logic Duplication:**
   * **Locations:** `extension/shared/matcher.js` and `cli/lib/match.js`
   * **Issue:** Both files implement almost identical logic for computing match keys and checking mock enabled status. This is problematic because bug fixes in one environment (e.g., the CLI) might be forgotten in the other (extension).
   * **Abstraction:** Extract this core logic into a shared package (e.g., `packages/core` or `shared/` synced via build script) so that both the Node.js server and Chrome extension consume the exact same matching algorithms.

2. **URL and Match Key Computation:**
   * **Issue:** The extension code repeatedly computes match keys (`computeMatchKeys`) and normalizes URLs without caching the results of expensive normalizations like `normalizeUrl` and `stripQuery`.
   * **Abstraction:** Pre-calculate and cache the results of expensive normalization functions in local variables.

## Reusability Opportunities

1. **UI Component Extraction:**
   * The `extension/shared/app.js` file is over 3,000 lines long and handles rendering everything from list items to the toolbar. Extract reusable UI components (e.g., Toolbar, InteractionList, DetailView) into separate ES modules.

2. **State Management Abstraction:**
   * State is currently mutated globally (`state.mode`, `state.interactions`). Introducing a lightweight reactive state store or an Event Bus would decouple rendering from data fetching and mutation.

## Architecture Review

* **Scalability & Maintainability:** The tight coupling in `extension/shared/app.js` and `extension/background.js` makes it difficult to maintain and scale. Features like "body search" and "advanced filters" are implemented via inline procedural code rather than a declarative architecture.
* **Separation of Concerns:** UI rendering logic, state management, and business logic are intermixed. A cleaner separation (Model-View-Controller or similar) is needed to improve testability.

## Performance Findings

* **Excessive Stringification in Render Loops:** The UI lag on typing in the search box is driven by repeated `JSON.stringify` calls inside the `filteredInteractions` loop.
* **Redundant Allocations:** Avoid computing derived state (like sorting criteria) on every filter iteration; pre-compute them outside the loop.

## Security & Reliability Findings

* **HTML Sanitization Bypass:** Detailed in Critical Issues.
* **Untrusted DOM Elements:** When interacting with untrusted DOM elements, especially `<form>`, avoid relying on element instance properties.
* **Event Validation:** Detailed in Critical Issues (`ev.source` validation).

## Testing Gaps

* **E2E UI Tests:** The repository lacks comprehensive E2E tests for the popup and devtools panel interfaces.
* **Performance Regression Tests:** There are no tests ensuring that operations on large datasets (e.g., 10,000 interactions) complete within a reasonable timeframe (e.g., <50ms).

## Rules Compliance Findings

* **Rule Violation:** `.augment/rules` and internal guidelines dictate strict adherence to safe DOM manipulation. The current implementation of `sanitizeHTML` directly accesses properties that can be clobbered.
* **Fix:** Refactor `sanitizeHTML` to strictly use `Element.prototype` methods.

## Recommended Refactor Plan

1. **Quick Wins (Days 1-2):**
   * Fix DOM Clobbering vulnerability in `sanitizeHTML`.
   * Add `ev.source` validation in `injected.js`.
   * Implement `WeakMap` caching for JSON stringification in `filteredInteractions`.

2. **Medium Effort Improvements (Weeks 1-2):**
   * Extract duplicated matcher logic into a single source of truth shared between `extension` and `cli`.
   * Introduce a lightweight component model to break up `extension/shared/app.js`.

3. **Long-Term Architecture Improvements (Months 1-3):**
   * Overhaul the state management system to be fully reactive.
   * Add comprehensive Playwright E2E tests for the frontend UI.

## Top Priorities Summary

1. **Top 10 highest-value fixes:**
   1. Fix DOM clobbering in `sanitizeHTML`.
   2. Fix `window.message` spoofing in `injected.js`.
   3. Optimize `filteredInteractions` using WeakMap.
   4. Pre-calculate `normalizeUrl` and `stripQuery` in loops.
   5. Extract duplicated match logic.
   6. Add `hasOwnProperty` checks to `for...in` loops.
   7. Fix `npm run lint` configuration issues.
   8. Standardize component rendering.
   9. Add tests for edge-case URL matching.
   10. Ensure destructive buttons have `aria-label` and `title`.
2. **Top 10 duplication-removal opportunities:**
   1. `matchKeys` computation (`extension` vs `cli`).
   2. URL normalization logic.
   3. DOM rendering fragments in `app.js`.
   4. Message passing boilerplate in `injected.js`.
   5. Status code styling helpers.
   6. Search filter preparation logic.
   7. Fallback error handling in API intercepts.
   8. Test data setups.
   9. Date formatting utilities.
   10. Sanitization checks.
3. **Top reusable abstractions worth introducing:**
   1. A shared `Matcher` package.
   2. A reactive State Manager.
   3. A centralized Event Bus.
   4. A safe DOM Manipulation Utility.
4. **Files/components with highest technical debt:**
   1. `extension/shared/app.js`
   2. `extension/background.js`
   3. `extension/injected.js`
   4. `extension/shared/matcher.js`
5. **Suggested engineering standards missing:**
   1. Strict ESLint rules for DOM interactions (no-restricted-properties).
   2. Require explicit `ev.source` checks on all postMessage handlers.
   3. Prohibit direct property access on form elements.
