
# EchoKit Engineering Review

## Executive Summary

- **Overall repo health score**: 65/100 (Needs improvement in UI architecture and security).
- **Biggest risks**:
  - DOM XSS vulnerabilities throughout `extension/shared/app.js` and `layouts.js` using `innerHTML` without `sanitizeHTML`.
  - Massive God File (`extension/shared/app.js` at 3243 lines), tightly coupling state, rendering, and DOM manipulation.
  - Performance bottlenecks in tight UI loops: O(N^2) filtering and un-cached `new URL()` instantiations during rendering.
- **Highest ROI improvements**:
  - Implement component-based UI rendering (`specs/UI_COMPONENTIZATION_IMPLEMENTATION.md`).
  - Cache parsed URLs via `parseUrl` utility across the codebase.
  - Wrap all `innerHTML` assignments in `sanitizeHTML`.
- **Architecture concerns**:
  - The single-file Vanilla JS approach is reaching its breaking point. State ownership is vague (global `state` object mutated everywhere).
  - Matcher logic is duplicated across three distinct environments (Node.js `cli/lib/match.js`, Service Worker `extension/shared/matcher.js`, MAIN world `extension/injected.js`).

## Critical Issues

1. **DOM XSS Vulnerabilities (High Severity)**
   - **Location**: `extension/shared/app.js` (`root.innerHTML`, `overlay.innerHTML`, `list.innerHTML`) and `extension/shared/layouts.js`.
   - **Impact**: Template literals containing un-escaped variables are assigned directly to `innerHTML`. A crafted URL or mock body could execute arbitrary JavaScript in the extension's context.
   - **Fix**: Mandatory use of `sanitizeHTML()` from `extension/shared/sanitize.js` for all template literals assigned to `innerHTML`.

2. **O(N^2) Array Filtering Performance Bottleneck (High Severity)**
   - **Location**: `extension/shared/app.js` (filtering arrays sequentially inside render functions like `renderRow` or continuous filtering during renders).
   - **Impact**: Massive UI lag when the interaction count grows beyond a few hundred items.
   - **Fix**: Precompute filtered arrays at the top level of the render function and pass them to child UI components, or use a single O(N) pass with early returns.

3. **URL Parsing Overhead in Render Loops (Medium Severity)**
   - **Location**: `extension/shared/layouts.js` (`groupByDomain`), `extension/shared/app.js` (inside maps and loops).
   - **Impact**: Instantiating `new URL()` in tight loops is expensive and causes severe performance bottlenecks during render cycles.
   - **Fix**: Always use the `parseUrl` utility from `extension/shared/interaction-helpers.js` to leverage the module-level Map cache.

## Duplication Report

1. **Matcher Logic Duplication**
   - **Location**: `extension/shared/matcher.js`, `extension/injected.js`, `cli/lib/match.js`.
   - **Problem**: Hand-inlining the identical logic across three environments makes maintenance prone to errors. If one diverges, exported mocks will fail to match.
   - **Suggestion**: Create a shared builder or build step that injects the single source of truth for matcher logic into the required environments during the build process (`scripts/build-store-zip.sh`).

2. **UI Component Rendering Duplication**
   - **Location**: `extension/shared/app.js` (`renderRow`, `renderSortableTable`, `renderDomainGroup`).
   - **Problem**: The popup and DevTools layouts contain duplicated button creation and formatting logic.
   - **Suggestion**: Fully adopt `specs/UI_COMPONENTIZATION_IMPLEMENTATION.md`, migrating columns logic to `columns.js` and layout logic to `layouts.js`.

3. **URL Normalization / Domain Parsing**
   - **Location**: `extension/shared/app.js` (`domainOf`, inline parsing), `extension/shared/interaction-helpers.js`, `extension/shared/layouts.js`.
   - **Problem**: Redundant try/catch blocks for URL parsing.
   - **Suggestion**: Standardize all URL parsing to use the cached `parseUrl` utility.

## Reusability Opportunities

1. **Reusable State Management**
   - **Issue**: The `state` object in `app.js` is a global variable mutated by various DOM event listeners. Tight coupling makes testing impossible.
   - **Abstraction**: Introduce a centralized state management module (e.g., `store.js` for state, not just IndexedDB) that dispatches events when state changes.

2. **Reusable UI Components (Vanilla JS Components)**
   - **Issue**: Buttons, badges, and chips are constructed via raw HTML strings in multiple places.
   - **Abstraction**: Create a `components.js` utility that exports pure functions returning standardized HTML strings for common UI elements (e.g., `Badge(type, text)`, `ToggleButton(state, icon)`).

3. **Shared Error/Notification System**
   - **Issue**: `showToast` and error alerts are scattered.
   - **Abstraction**: Extract a `notification.js` module.

## Architecture Review

- **Scalability**: Poor. A 3200+ line UI file cannot scale. The architecture needs strict separation of concerns (State -> Render -> Event Binding).
- **Maintainability**: Low. High coupling between logic and view.
- **Layering**: UI is currently handling business logic, data formatting, and DOM manipulation concurrently.
- **God File**: `extension/shared/app.js` violates the 2000-line limit by a significant margin.

## Performance Findings

1. `app.js` loops over `new URL()` causing GC thrashing.
2. Sequential `.filter()` chains in `app.js` cause unnecessary allocations.
3. Repainting entire lists using `innerHTML` causes lost focus and layout recalculation. Should move towards fine-grained DOM updates or virtual DOM (even a minimal Vanilla one).

## Security & Reliability Findings

- **DOM XSS**: Unsafe string interpolation into `innerHTML` across layouts.
- **Memory Leaks**: Event listeners attached to DOM nodes that are subsequently wiped by `innerHTML` without cleanup.
- **Missing Relative Base URLs**: Relative URLs passed to `new URL()` without a base URL (like `location.href`) will throw errors and break rendering.

## Testing Gaps

- Missing unit tests for the complex state reduction logic in `app.js`.
- Missing tests for the `parseUrl` caching utility to prevent mutation bugs.
- No automated visual regression testing.

## Rules Compliance Findings

1. **File Size Limit Exceeded**: `extension/shared/app.js` (3243 lines) violates the 2000-line limit from `DEVELOPMENT_RULES.md`.
2. **Missing JSDoc**: Many helper functions in `app.js` lack required JSDoc comments.
3. **Magic Numbers**: Hardcoded pixel values and timeouts in `app.js`.

## Recommended Refactor Plan

**Phase 1: Security & Performance (Immediate Wins)**
- Wrap all `innerHTML` calls in `app.js` and `layouts.js` with `sanitizeHTML`.
- Replace inline `new URL()` calls with `parseUrl` in all UI render paths.

**Phase 2: UI Componentization (Medium Effort)**
- Implement `specs/UI_COMPONENTIZATION_IMPLEMENTATION.md`.
- Migrate row/column rendering out of `app.js` into `interaction-renderer.js` and `columns.js`.

**Phase 3: State Decoupling (Long-term)**
- Extract state management into a dedicated class/module with a publish/subscribe pattern.
- Move towards event delegation rather than direct binding on re-rendered elements.

---

1. **Top 10 highest-value fixes**
   - Apply `sanitizeHTML` to all `innerHTML` assignments.
   - Replace `new URL()` instantiations with cached `parseUrl` in `app.js` and `layouts.js`.
   - Consolidate sequential `.filter()` operations into single O(N) passes.
   - Pass `location.href` as the base URL to `new URL()` to prevent relative URL errors.
   - Add ARIA `title` tooltips to match `aria-label` on interactive elements.
   - Extract the matcher logic into a single build-time injected file.
   - Split `extension/shared/app.js` into smaller feature-specific files.
   - Add `"browser": true` to ESLint config for Service Worker files resolving `AbortController` errors.
   - Fix missing `aria-pressed` states dynamically tied to application state variables.
   - Ensure un-mutated URLs from caches by cloning `new URL(parsed.href)` if modification is needed.

2. **Top 10 duplication-removal opportunities**
   - Matcher logic (`extension/shared/matcher.js` vs `injected.js` vs `cli/lib/match.js`).
   - DevTools vs Popup table rendering logic in `app.js`.
   - URL domain parsing/extraction.
   - Empty state rendering across different views.
   - Filter badge generation logic.
   - Timestamp formatting logic.
   - Mock toggle button generation.
   - Error handling blocks for JSON parsing.
   - Storage synchronization wrappers.
   - Feature flag checks across surfaces.

3. **Top reusable abstractions**
   - Centralized Event Dispatcher / State Store (pub/sub).
   - Cached URL Parser (`parseUrl`).
   - Shared UI Component Factory (Badges, Buttons).
   - DOM Sanitizer (`sanitizeHTML`).
   - Common API Client for background scripts.
   - Unified Error Logger / Notifier.

4. **Files with highest technical debt**
   - `extension/shared/app.js` (3243 lines, mixed concerns).
   - `extension/background.js` (1806 lines, mixed SW responsibilities).
   - `extension/injected.js` (Duplicated matcher logic).

5. **Suggested engineering standards missing**
   - Strict UI Componentization (e.g., mandatory separation of templates and logic).
   - Security linting (e.g., eslint-plugin-security or no-unsafe-innerhtml).
   - Centralized state management architecture guidelines.
   - Automated bundle size monitoring.
   - Strict typing or JSDoc requirements for all shared utilities.
