# EchoKit Daily Engineering Review

## Executive Summary
* **Overall Repo Health Score**: 72 / 100
* **Biggest Risks**:
  1. **Cross-Site Scripting (XSS) Vulnerabilities**: Systemic use of raw `.innerHTML` string concatenation in UI components without DOMPurify/`sanitizeHTML()` wrapper. (Violates Security Convention).
  2. **Technical Debt Godzilla Component**: `extension/shared/app.js` is bloated at ~3,200 lines, severely hindering maintainability, violating the 2000-line hard limit rule.
  3. **Brittle Shared Logic**: Duplicate implementations of URL Matcher logic across three entirely separate areas (`cli/lib/match.js`, `extension/shared/matcher.js`, and hand-inlined in `extension/injected.js`), creating a high risk of desynchronization.
  4. **DOM/UI Performance**: Extensive reliance on expensive `.innerHTML` full string DOM replacements and re-parsing rather than using granular DOM patches or soft rendering frameworks.
* **Highest ROI Improvements**:
  1. Create a centralized template literal tag (e.g., `html`) wrapping DOMPurify to automatically sanitize `.innerHTML` assignments across `app.js` and other renderers.
  2. Incrementally rip out standalone components (e.g., Settings Dialog, Header, Footer) from `app.js` into distinct ES modules.
  3. Adopt a lightweight bundler (e.g., esbuild/Rollup) purely to compile `injected.js` so it can import `extension/shared/matcher.js` instead of relying on manually maintained hand-inlined copies.
* **Architecture Concerns**:
  - The "Vanilla JS + ES Modules" architecture works, but the lack of a build step is artificially enforcing bad practices (like hand-inlining `matcher.js` into `injected.js` for the MAIN world).
  - The UI uses event delegation (`data-action="select"`), which is good, but managing state across a 3,000-line file with global variables (`state` object) and manual `render()` calls makes it prone to race conditions and lost cursor focus.

## Critical Issues

1. **Unsafe HTML Assignments (Security & Reliability)**
   - **Where**: `extension/shared/app.js` and `extension/shared/layouts.js` heavily use `.innerHTML = \`...\``.
   - **Why it's problematic**: Although manual `escapeHtml()` is used on variables, any missed variable or dynamic attribute could lead to XSS. The security convention mandates passing HTML templates through a `sanitizeHTML()` wrapper.

2. **God File `app.js` Violates Code Size Limits**
   - **Where**: `extension/shared/app.js` (3264 lines).
   - **Why it's problematic**: Violates `DEVELOPMENT_RULES.md` limit of 2000 lines. The file handles routing, state management, event delegation, dialog rendering, logic, and layout.

3. **Inlined Matcher Logic (Maintainability)**
   - **Where**: `extension/injected.js` (lines ~100-250) has a hand-inlined copy of `extension/shared/matcher.js`.
   - **Why it's problematic**: If URL normalization or hash logic changes in one place and not the other, the entire record/replay pipeline silently breaks.

4. **Accessibility (A11y) Keyboard Event Failures**
   - **Where**: `extension/shared/app.js` uses `<span>` and `<div>` elements with `data-action` (e.g., source badges, chips) but does not provide adequate `<button type="button">` wrappers or `keydown` listeners for Enter/Space (as noted in `.jules/palette.md`).

## Duplication Report

1. **Request Matching Logic**
   - **Locations**: `cli/lib/match.js`, `extension/shared/matcher.js`, `extension/injected.js`.
   - **Spread**: Core business logic duplicated 3 times.
   - **Abstraction Opportunity**: Implement a minimal build step (e.g., simple Rollup script in `scripts/`) to bundle `injected.js` so it can directly import `matcher.js`.

2. **Settings/Dialog Rendering**
   - **Locations**: Settings, Gist Upload, Gist Import, Paste LocalStorage dialogs in `app.js`.
   - **Spread**: Each dialog manually creates a modal overlay, binds cancel/confirm events, and manages DOM insertion.
   - **Abstraction Opportunity**: Create a reusable `ModalManager` or `showDialog({ title, body, actions, onConfirm })` utility.

3. **Filter/Search Logic**
   - **Locations**: `filteredInteractions()` in `app.js`.
   - **Spread**: Complex cascading filters evaluating HTTP methods, statuses, and body contents.
   - **Abstraction Opportunity**: Extract into `extension/shared/filters.js` and use a functional composition pattern for filtering.

## Reusability Opportunities

1. **`createModal` / `DialogComponent`**
   - Replace the dozen `document.createElement('div')` modal overlay blocks in `app.js` with a single reusable service.

2. **`DOMUtils.bindActionHandlers`**
   - Event delegation logic in `bindEvents()`, `bindGlobalEvents()`, `bindFilterEvents()` in `app.js` is highly repetitive and tightly coupled. Extract a generic event delegation utility.

3. **`SanitizedHTML` Template Tag**
   - Implement `const html = (strings, ...values) => sanitizeHTML(String.raw({raw: strings}, ...values))` to guarantee DOM XSS safety across all views.

## Architecture Review
* **Scalability**: The state management is a single global `state` object. As feature flags (e.g., `FEATURES.popup` vs `FEATURES.devtools`) grow, state reconciliation will become complex.
* **Maintainability**: High reliance on manual DOM synchronization (e.g., restoring scroll positions after re-renders). A shift to a lightweight Virtual DOM or fine-grained reactivity (like Signals) would drastically reduce boilerplate.
* **Separation of Concerns**: Very weak in the UI layer. `app.js` handles data fetching (RPCs to background), business logic, filtering, state, and rendering.

## Performance Findings
* **Frontend - Re-rendering Lists**:
  - `softRenderList()` in `app.js` completely replaces `list.innerHTML`. While debounce is used, re-rendering a large DOM list (e.g., 1000 items) is O(N) DOM node creation and blocks the main thread.
  - *Fix*: Implement DOM virtualization (windowing) for the list view or use precise DOM patching.
* **Frontend - `WeakMap` adoption**:
  - Conflict resolution count has been optimized using `WeakMap` in `extension/shared/interaction-helpers.js`, which resolved an O(N²) bottleneck (good fix!).

## Security & Reliability Findings
* **Injection Risks**: Missing `sanitizeHTML()` across `innerHTML` usages in `app.js`.
* **DNR Rules**: The CORS override utilizes `declarativeNetRequest`, which is secure and modern, but we must ensure blocklist/rewrite rules inputted by users are sanitized so they don't break the extension networking.
* **Worker Validation**: HMAC signatures in `worker/worker.js` use `timingSafeEqual`, which correctly prevents timing attacks.

## Testing Gaps
* **Mock File Deserialization Anomalies**: Missing tests for edge cases around corrupted `mockChain` or extreme latency inputs.
* **Frontend Unit Tests**: No unit tests exist for complex filtering logic (`filteredInteractions`), URL normalization, or search matching in the UI layer.
* **UI E2E**: Playwright tests (`tests/smoke_echokit.py`) cover core recording, but more contract tests are needed to ensure the `cli` server behaves identically to the browser extension's interception.

## Rules Compliance Findings
1. **Rule**: Functions over 150 lines must be refactored.
   - **Violation**: `renderDetail` in `app.js` is over 150 lines.
2. **Rule**: Files over 2000 lines must be split.
   - **Violation**: `extension/shared/app.js` is ~3,200 lines.
3. **Rule**: Use native `<button>` tags for interactive UI (`.jules/palette.md`).
   - **Violation**: Elements with `data-action="select"` are using `<div>` without keyboard handlers, preventing keyboard navigation for list selection.
4. **Rule**: Use `sanitizeHTML()` utility for DOM innerHTML (`Memory`).
   - **Violation**: Widespread `innerHTML` assignments in `app.js` lacking `sanitizeHTML()`.

## Recommended Refactor Plan

### Phase 1: Quick Wins (Days 1-3)
1. Introduce a generic `sanitizeHTML` utility (DOMPurify wrapper).
2. Refactor `app.js` string interpolations to use `sanitizeHTML`.
3. Fix accessibility in `app.js` list rows by changing `<div>` rows to `<button>` or adding proper `keydown` bindings for Enter/Space.

### Phase 2: Medium Effort Improvements (Weeks 1-2)
1. **Dismantle `app.js`**: Split out `renderDetail`, `renderSettingsGeneral`, and modal dialog logic into `extension/shared/detail.js` and `extension/shared/settings.js`.
2. Extract the monolithic event delegation logic into a unified `event-binder.js`.
3. Add a tiny build step for `injected.js` using `esbuild` to eliminate the `matcher.js` duplication.

### Phase 3: Long-term Architecture (Months 1-2)
1. **Virtualization**: Replace `innerHTML` list rendering with a lightweight DOM windowing library to support 10,000+ interactions smoothly.
2. **State Management**: Introduce a basic pub-sub or reactive state primitive to decouple business logic from rendering updates.

---

## Final Review Priorities

### 1. Top 10 Highest-Value Fixes
1. Wrap all `.innerHTML` writes in `sanitizeHTML()`.
2. Introduce a minimal bundler for `injected.js` to remove `matcher.js` duplication.
3. Replace custom `<div>` clickable elements with native `<button type="button">` tags.
4. Extract Settings dialog logic out of `app.js`.
5. Extract Export/Import/Gist dialog logic out of `app.js`.
6. Extract Filter logic into a pure-function utility module.
7. Split `renderDetail` into its own module (currently massive).
8. Implement DOM windowing/virtualization for list rendering.
9. Add unit tests for `filteredInteractions`.
10. Adopt explicit event listener cleanup when destroying dynamically created modals.

### 2. Top 10 Duplication-Removal Opportunities
1. `matcher.js` logic in `injected.js`
2. `matcher.js` logic in `cli/lib/match.js`
3. Modal background/overlay creation logic across 8+ dialogs.
4. Debounce function implementation across `app.js`.
5. Error toast notifications code.
6. Event delegation blocks (`if (action === '...')`).
7. Header generation logic.
8. Filter active-state checks.
9. Array sorting comparators.
10. `chrome.storage` vs `BG` RPC wrapper duplication.

### 3. Top Reusable Abstractions Worth Introducing
1. **`ModalController`**: Centralizes `<dialog>` overlay logic, focus trapping, and teardown.
2. **`EventDelegator`**: Declarative mapping of `[data-action]` to handler functions.
3. **`DOM.patch()`**: A utility to diff and update DOM instead of destructive `innerHTML` clears.
4. **`StateStore`**: A simple reactive proxy object that triggers specific UI updates on change.

### 4. Files with Highest Technical Debt
1. `extension/shared/app.js`
2. `extension/injected.js`
3. `cli/lib/server.js`

### 5. Suggested Engineering Standards Missing
1. **Strict DOM Manipulation Rules**: Ban `element.innerHTML` in ESLint; enforce `element.textContent` or a sanitization wrapper.
2. **A11y Linting**: Use `eslint-plugin-jsx-a11y` (or standard equivalent) to catch missing keyboard listeners on interactive elements.
3. **Component File Size Limits**: Enforce the 150-line function and 500-line file soft limits via ESLint rules (`max-lines` and `max-lines-per-function`).
4. **Centralized Dependency Management**: Move away from 100% buildless if it forces architectural compromise (like copying file contents). A simple script concatenator is necessary for extension MAIN worlds.