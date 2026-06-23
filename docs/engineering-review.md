# EchoKit Engineering Review Report

## Executive Summary
* **Overall Repo Health Score**: 82/100
* **Biggest Risks**:
  * The size and complexity of `extension/shared/app.js` (over 3200 lines).
  * O(N) array filtering performance issues and `new URL()` instantiations during interaction rendering loops.
  * Potential DOM XSS vulnerabilities if raw HTML from `renderInteractionList` in `extension/shared/interaction-renderer.js` is not properly sanitized.
  * Incomplete stripping of ASCII control characters in `sanitizeHTML` which might lead to DOM XSS bypass.
* **Highest ROI Improvements**:
  * Decompose `extension/shared/app.js` into modular components to align with `specs/UI_COMPONENTIZATION_IMPLEMENTATION.md`.
  * Add a precomputed module-level LRU map cache for `URL` parsing inside tight loops to fix rendering bottlenecks.
  * Consolidate array filtering loops to reduce intermediate allocations and precompute arrays at the top level of render functions.
* **Architecture Concerns**:
  * Duplicate logic for matcher generation in `extension/shared/matcher.js` and `extension/injected.js`.

## Critical Issues
1. **Oversized `app.js`**: `extension/shared/app.js` has grown to 3247 lines. This violates the `DEVELOPMENT_RULES.md` limit (2000 lines max). It creates a "god file" anti-pattern.
2. **Missing Precomputed Arrays in Rendering**: The rendering cycle dynamically filters values sequentially. O(N) array operations within rendering loops must be precomputed and cached.
3. **URL Parsing Performance Bottleneck**: Instantiating `new URL()` in tight UI loops (like `renderRow`) without an LRU cache degrades performance.
4. **Improper URL Parsing**: Using `new URL(url)` for potentially relative URLs without passing `location.href` as a base will throw `TypeError` and break UI rendering.

## Duplication Report
1. **Matcher Dual-Maintenance**: The `matcher.js` logic is copied manually into `injected.js` because `injected.js` cannot import ES modules in the MAIN world context.
   * *Impact*: High risk of regressions if hash logic falls out of sync.
   * *Consolidation*: Introduce a build step to inline `matcher.js` directly into `injected.js`.
2. **Settings Parsing & Binding Events**: Settings binding events share structurally identical code for parsing, patching state, and refreshing.
   * *Consolidation*: Abstract to a generic factory function `createSettingsBinder()`.
3. **Array Mapping/Filtering**: Sequential chained `.filter()` operations are duplicated across files.
   * *Consolidation*: Abstract common filter conditions to reduce passes to O(N).

## Reusability Opportunities
1. **Shared LRU Cache Utility**: Centralize the LRU `Map` cache used for `URL` parsed objects or complex hash lookups.
2. **UI Component Abstractions**: Decompose `app.js` UI structures to reusable vanilla JavaScript Web Components or specialized DOM renderer modules.
3. **Generic Event Binders**: Generic binders for configuration sections to prevent repeated event listener attachment code.

## Architecture Review
* **Scalability**: IndexedDB wrapper (`store.js`) relies on in-memory filtering rather than advanced query indices, which won't scale well with large dataset limits.
* **Maintainability**: There's an effort for componentization (`layouts.js`, `interaction-renderer.js`), but `app.js` remains deeply intertwined with state mutations and view updates.
* **Separation of Concerns**: `app.js` currently mixes business logic, global state mutation, and DOM element assignments without strict boundaries.
* **Resiliency**: The application properly wraps major operations in `try/catch` per `DEVELOPMENT_RULES.md`, but network issues might silently fail during unauthenticated requests in `worker/worker.js`.
* **Consistency**: Shared utilities (`prettyUrl`, `parseUrl`) are inconsistently applied.

## Performance Findings
1. **URL Parsing**: Calling `new URL(url)` inside tight loops is a severe bottleneck. Implement LRU Map cache, and never mutate returned cached instances directly (safely clone if needed).
2. **Array Filtering**: Chaining `.filter()` causes O(K*N) intermediate array allocations. Consolidate multiple filter conditions into a single O(N) pass with early returns.
3. **Redundant DOM Calculations**: Avoid inline `.filter().length` calls inside rendering or mapping functions.

## Security & Reliability Findings
1. **DOM XSS via HTML Injection**: `renderInteractionList` in `extension/shared/interaction-renderer.js` returns raw HTML strings. Callers must pass the output through `sanitizeHTML()` before `innerHTML` assignment.
2. **XSS Bypass via Control Characters**: `sanitizeHTML` currently lacks explicit stripping of ASCII control characters (`/[\x00-\x20\x7F]/g`) prior to scheme checks, opening up vectors for `java&#09;script:` payloads.
3. **Accessibility Attributes**: Interactive elements (e.g. toggle chips) use missing or detached `aria-pressed` and `aria-expanded` attributes. These need dynamic string interpolation with app state to function with screen readers correctly. Include `title` alongside `aria-label` for tooltips.

## Testing Gaps
1. **LRU URL Cache Mutation**: Tests are missing to verify that developers do not mistakenly mutate retrieved cached `URL` instances.
2. **Accessibility (A11y) Verification**: No automated tests exist to verify dynamic ARIA roles match UI state toggles.
3. **Frontend Playwright Tests**: Complex UI updates lack validation with Playwright mocked default states via `echokit:getState`.
4. **App Metadata Validation**: CI relies on `app-metadata.json` for validation, but lack of rigorous test assertions over this schema might break CI pipelines.

## Rules Compliance Findings
1. **File Size Limit** (`DEVELOPMENT_RULES.md`): `extension/shared/app.js` is 3247 lines, exceeding the hard limit of 2000 lines.
2. **Performance Constraints** (`DEVELOPMENT_RULES.md`): Sequential chained `.filter()` and inline `.filter().length` in `app.js` violate optimization directives.
3. **Sanitizer Validation Rule**: The codebase lacks control character stripping in URI checks, violating established security conventions.
4. **URL Instantiation Conventions**: Not supplying `location.href` to relative URLs breaks expected conventions for `URL` parsing.

## Recommended Refactor Plan
### Quick Wins
1. Update `sanitizeHTML` in `extension/shared/sanitize.js` to strip ASCII control chars (`/[\x00-\x20\x7F]/g`) before validating URI prefixes.
2. Safely wrap UI template literal interpolations and raw HTML helper outputs with `sanitizeHTML()` prior to assignment.
3. Introduce an LRU cache module for `parseUrl` with JSDoc warnings against mutation.

### Medium Effort Improvements
1. Fix relative URL crashes by passing `location.href` to `new URL()` instantiations.
2. Ensure toggle chips dynamically map `aria-pressed` and `aria-expanded` attributes to `state.waterfall` or `state.menuOpen` variables.
3. Consolidate `app.js` sequential `.filter()` operations into unified, single-pass iterations.

### Long-Term Architecture Improvements
1. Deconstruct `app.js` into targeted ES modules using `extension/shared/columns.js` as a single source of truth.
2. Automate the synchronization of `matcher.js` hashing logic to `injected.js` during the build pipeline.
3. Shift from global DOM state mutations to a strict, reactive state-management pattern.

---

1. **Top 10 highest-value fixes**
   - Strip ASCII control characters in `sanitizeHTML` URI checks to prevent DOM XSS bypass.
   - Force use of `sanitizeHTML()` on the output of `renderInteractionList` prior to DOM insertion.
   - Introduce an LRU `Map` cache for `URL` parsing inside tight rendering loops.
   - Fix `TypeError` crashes by consistently passing `location.href` to `new URL()` calls.
   - Consolidate O(N^2) array filtering loops inside `app.js` and `background.js` into single-pass O(N) operations.
   - Bind `aria-pressed` / `aria-expanded` attributes dynamically to actual state variables.
   - Supply matching `title` attributes for all elements using `aria-label`.
   - Prefix unused variables with underscores per the ESLint config (e.g., `_LICENSE_CACHE_TTL_MS`).
   - Remove "Temporary free access" TODO inside `worker.js`.
   - Update ESLint dependencies locally (`pnpm install`) to avoid Flat Config conflicts.

2. **Top 10 duplication-removal opportunities**
   - `matcher.js` duplicated hashing logic manually embedded inside `injected.js`.
   - Repeated inline parsing loops of `URL` search parameters.
   - Duplicated array mapping strategies scattered across popup and devtools panels.
   - Repeated settings event listeners binding boilerplate.
   - `MockWebSocket` and `MockEventSource` identical message-dispatch routines.
   - Duplicated raw string HTML generators for similar list components.
   - Error handling boilerplate duplicating `console.error` and visual toasts.
   - Layout management duplications between popup vs devtools initializers.
   - DOM querying for standard components duplicated across modules.
   - Inconsistent utility formatting code (recreating `prettyUrl` vs using it).

3. **Top reusable abstractions worth introducing**
   - **LRU Cache Utility**: For storing and safely returning parsed `URL` clones without re-instantiation.
   - **Generic Settings Event Binder Factory**: To reduce duplicate form input handling for user configurations.
   - **MockStreamController**: Centralized abstraction replacing separate `MockWebSocket` and `MockEventSource` internals.
   - **DOM DOM Patcher / Reconciler**: To update UI regions in-place without wholesale `innerHTML` destruction.
   - **SafeDOMRenderer**: Wrapper ensuring outputs of string-based renders are passed through `sanitizeHTML`.

4. **Files/components with highest technical debt**
   - `extension/shared/app.js` (Major violation of the 2000-line rule; intertwines DOM, logic, and state).
   - `extension/injected.js` (Duplicated matching logic and large XHR/fetch hijacking monolith).
   - `extension/background.js` (Message passing and context orchestration is loosely structured).
   - `extension/shared/interaction-renderer.js` (Emits unsafe raw HTML).
   - `extension/shared/store.js` (Uses in-memory dataset mapping instead of fast indexing).

5. **Suggested engineering standards missing from the repository**
   - **Build Process for Injected Code**: No CI/CD standard for automatically injecting shared module code into MAIN-world scripts.
   - **Reactive State Pattern**: Lack of standardized single-direction data flow or reactive bindings.
   - **A11y Enforcement Guidelines**: Missing conventions for dynamic ARIA properties binding during DOM renders.
   - **Component Security Pipeline**: No standard requiring component-level unit tests for DOM XSS.
   - **Performance Profiling Benchmarks**: Absence of standard Playwright performance gating tests for list rendering with 1000+ items.
