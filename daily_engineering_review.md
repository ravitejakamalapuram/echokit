# EchoKit Engineering Review

## Executive Summary

- **Overall Repo Health Score:** 6/10 (Fair).
- **Biggest Risks:**
  - `extension/shared/app.js` is a massive "God component" (3,264 lines) mixing UI rendering, state management, event handling, and data fetching.
  - Duplication of parsing logic (`JSON.parse` wrappers) and UI filtering (O(N^2) array mapping issues) across the extension and the CLI.
  - Lack of modern frontend tooling (bundler/React). All HTML is built via string literals, leaving potential surface areas for DOM XSS (despite `sanitizeHTML` which wasn't fully enforced consistently for large files).
  - Code duplication across `extension/shared/matcher.js`, `cli/lib/match.js` and `extension/injected.js`.
- **Highest ROI Improvements:**
  - Componentize `extension/shared/app.js` completely. (PR #56 started this but stopped at `columns.js`, `layouts.js` etc., while `app.js` itself is still 3k lines.)
  - Refactor `JSON.parse` wrapper to a shared utility to prevent crash scenarios and handle empty states.
  - Fix performance bottleneck in `app.js` filtering mechanism which does multiple sequential `.filter()` operations instead of a single loop.
- **Architecture Concerns:**
  - Duplication between `cli` mock engine and `extension` mock engine. The `matcher.js` rules and definitions are duplicated in multiple environments.
  - Usage of `innerHTML` with template literals extensively without enforced `sanitizeHTML`.

## Critical Issues

1. **Massive God File (`extension/shared/app.js`):**
   - The file is over 3,200 LOC, violating the `DEVELOPMENT_RULES.md` (no file > 2000 lines). It handles search, rendering, state mutations, and DOM event bindings all in one place.
2. **Sequential Array Filtering Performance (`extension/shared/app.js`):**
   - Sequential `.filter()` calls on potentially large arrays (`state.interactions`). In `app.js` `filteredInteractions`, it runs `.filter()` up to 6 times. For an array of 5,000 interactions, this is extremely expensive and causes memory allocation overhead (thrashing).
3. **Repeated `JSON.parse` error handling:**
   - Over 15 places where `JSON.parse` is wrapped in try-catch without a reusable helper.
4. **Missing/Invalid `sanitizeHTML` Usage:**
   - Many `innerHTML` calls build strings directly, some use `escapeHtml` locally. Security conventions require `sanitizeHTML` (wrapper for DOMPurify). The repo instructions mention this convention, but raw `innerHTML = ` is everywhere.

## Duplication Report

- **Matcher Logic:**
  - `extension/shared/matcher.js` and `cli/lib/match.js` share multiple identical functions (`normalizeUrl`, `stripQuery`, `computeMatchKeys`). This is a 150+ lines duplication.
  - `extension/injected.js` also has inlined versions of these functions because it runs in the MAIN world. This should be built using a pre-build step rather than copy-pasted (violates Single Source of Truth).
- **JSON Try/Catch Pattern:**
  - Repeated inline `try { JSON.parse(str) } catch { return {} }` in `injected.js`, `app.js`, and `matcher.js`.
- **Layout Definitions:**
  - Duplicate layout configurations in `extension/shared/layouts.js` (lines 129-144 vs 221-236).
- **Scripts:**
  - `worker/setup-webhook.sh` and `worker/test-lemonsqueezy.sh` have heavy logic duplication.

## Reusability Opportunities

- **Shared `utils.js`:**
  - Create a utility file for `safeJsonParse`, `debounceInput`, `escapeHtml`, and shared constants.
- **Form Abstractions:**
  - The DOM query bindings in `app.js` (`document.querySelector('...').addEventListener('input', ...)` ) should be abstracted into a simple declarative event binding system or miniature view component class.
- **Shared Matcher Package:**
  - Move `cli/lib/match.js` and `extension/shared/matcher.js` into a shared mono-repo package (`packages/core/matcher.js`) and bundle it for the extension and the CLI.

## Architecture Review

- **Scalability:**
  - Vanilla JS without a bundler is hitting its limits. `app.js` is too large. Maintaining `injected.js` manually without bundler-based code sharing for `matcher.js` is error-prone.
- **Maintainability:**
  - `app.js` has very high technical debt. It handles popup logic and devtools logic together via `FEATURES` flags. The file should be split into domain folders (e.g., `features/waterfall`, `features/search`, `features/settings`).
- **Data Flow:**
  - State mutations happen directly on the `state` object from anywhere in `app.js`. A single `dispatch` or action layer would make the application predictable.

## Performance Findings

- **Frontend Bottleneck:** `app.js` `filteredInteractions()` does `results.filter()` sequentially. This is O(K*N). It should be refactored to a single loop `results.filter(i => matchMethod(i) && matchStatus(i) && matchUrl(i)...)`.
- **Render Thrashing:** `softRenderList()` uses `innerHTML` for the entire list. For hundreds of items, DOM node destruction and recreation is expensive. Using a virtual list or incremental DOM patching is highly recommended.

## Security & Reliability Findings

- **XSS Vectors:** `app.js` uses `innerHTML = ...` heavily. While `escapeHtml` is used for user data, relying on developer discipline for escaping is fragile. `sanitizeHTML` (DOMPurify) is missing in several DOM mutations.
- **Global Pollution:** `benchmark.js` uses `global` without defining it properly, leading to ESLint failure.

## Testing Gaps

- Missing automated contract test for `matcher.js` across environments (`cli`, `extension`, `injected.js`). If one changes, they fall out of sync.
- The `tests/consistency/single-source-enforcement.test.js` has missing `test`, `expect`, `describe` globals (failing linting).
- No frontend unit tests for `app.js` state logic (only playwright E2E).

## Rules Compliance Findings

- **Rule:** "Functions over 150 lines must be refactored, and files over 2000 lines must be split."
  - **Violation:** `extension/shared/app.js` (3264 lines).
- **Rule:** "All JSON.parse calls must be wrapped in try-catch."
  - **Compliance:** Yes, mostly compliant, but creates duplicate code.
- **Rule:** "ESLint globals must be correctly configured."
  - **Violation:** `benchmark.js`, `single-source-enforcement.test.js`, and `worker/test.js` fail ESLint with `no-undef` errors.

## Recommended Refactor Plan

**Quick Wins (1-2 Days):**
1. Fix ESLint global errors in test files and `benchmark.js`.
2. Refactor sequential `.filter()` chains in `app.js` to use a single pass filter to improve UI performance.
3. Extract `try { JSON.parse(str) }` into a shared `safeParse(str, fallback)` utility.

**Medium Effort (1-2 Weeks):**
1. Extract filtering, searching, and sorting logic from `app.js` into a dedicated `extension/shared/interaction-store.js` or `filter-service.js`.
2. Refactor `matcher.js` to act as the true single source. Add a build script (`npm run build:injected`) that bundles `matcher.js` into `injected.js` rather than relying on manual copy-pasting.

**Long-Term Architecture (1-3 Months):**
1. Introduce a lightweight component framework (e.g., Preact or a custom vanilla component class) to replace manual `innerHTML` template literals and imperative DOM event bindings in `app.js`.
2. Fully split `app.js` into feature modules (`settings.js`, `request-detail.js`, `mock-editor.js`).

---

## Final Metrics

1. **Top 10 highest-value fixes.**
   1. Fix ESLint errors in the test suite so CI passes cleanly.
   2. Refactor `filteredInteractions()` in `app.js` to a single-pass filter loop.
   3. Migrate to a single `matcher.js` file bundled into `injected.js` using a pre-commit hook/script.
   4. Extract `JSON.parse` into a safe utility to reduce boiler plate.
   5. Apply DOMPurify (`sanitizeHTML`) globally before any `innerHTML` assignment.
   6. Extract UI event listener binding out of the main `app.js` initialization.
   7. Combine duplicate layout configurations in `layouts.js`.
   8. Combine duplicated bash scripts in `worker/`.
   9. Move URL manipulation (`normalizeUrl`, `stripQuery`) to a shared `utils.js` used by both extension and CLI.
   10. Remove `console.log` in `app.js` line 2771 (development artifact).

2. **Top 10 duplication-removal opportunities.**
   1. `matcher.js` (extension) vs `match.js` (cli)
   2. `matcher.js` inline copy inside `injected.js`
   3. `try/catch JSON.parse` inline wrappers
   4. `worker/setup-webhook.sh` and `worker/test-lemonsqueezy.sh`
   5. Layout configuration objects in `layouts.js`
   6. `searchBodyContent` in `app.js` (could be shared utility)
   7. `debounceInput` pattern in `app.js` vs `interaction-helpers.js`
   8. `stableStringify` implementations (currently in multiple files)
   9. Error formatting and logging blocks
   10. HTML templates for empty states

3. **Top reusable abstractions worth introducing.**
   1. **`SafeJSON`** (`safeParse`, `safeStringify`)
   2. **`EventManager`** (for declarative DOM event bindings instead of manual `addEventListener` spaghetti)
   3. **`DataGrid / VirtualList`** (to efficiently render thousands of interactions without innerHTML thrashing)
   4. **`MatcherCore`** (shared package for both CLI and extension)

4. **Files/components with highest technical debt.**
   1. `extension/shared/app.js` (Massive size, mixed concerns, imperative DOM manipulation)
   2. `extension/injected.js` (Contains duplicated matcher logic)
   3. `cli/lib/match.js` (Duplicated from extension logic)

5. **Suggested engineering standards missing from the repository.**
   1. **Frontend Testing:** Need a unit testing framework (Vitest/Jest) for frontend logic, not just Python Playwright.
   2. **Bundler for Extension:** Using Rollup/Vite to bundle `injected.js` to prevent manual file copy-pasting.
   3. **DOM Manipulation Policy:** Ban direct `element.innerHTML = \`...\`` in favor of a helper function `render(element, htmlString)` that automatically runs DOMPurify.