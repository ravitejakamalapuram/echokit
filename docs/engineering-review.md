# Engineering Review Report

## Executive Summary
* **Overall repo health score:** B- (Requires structural refactoring but functionally sound)
* **Biggest risks:** High coupling in UI layer (`app.js`), duplicated hashing logic (Matcher), XSS risks in manual DOM string construction, missing architectural abstractions.
* **Highest ROI improvements:** Breaking down `app.js` into smaller, reusable UI components, unifying the `Matcher` logic between CLI and extension, and fixing DOM clobbering/XSS vulnerabilities.
* **Architecture concerns:** The project heavily relies on a monolithic `app.js` (3270 lines). Missing reusable abstractions and standardized API handling patterns.

## Critical Issues
1. **Security (XSS/DOM Clobbering):** `app.js` and `layouts.js` use extensive manual string concatenation for HTML construction (`innerHTML`) and unsafe `Element.attributes` iteration, introducing XSS and DOM Clobbering risks.
2. **Monolithic Architecture:** `extension/shared/app.js` is a 3200+ line god file tightly coupling rendering, state, and business logic.
3. **Synchronous/Blocking Code:** Inefficient N+1 rendering loops inside `app.js` filter functions cause severe UI jank.

## Duplication Report
1. `cli/lib/match.js`, `extension/shared/matcher.js` and `extension/injected.js` contain heavily duplicated URL parsing, normalization, and FNV-1a hashing logic. This is an intentional decision to maintain CLI zero-dependency isolation, but should be managed carefully.
2. Form label structures (`<div class="ek-label">`) are manually repeated across UI dialogs instead of a unified `InputGroup` component.
3. Empty state placeholders and Toast notifications are manually rendered across multiple views.

## Reusability Opportunities
* **UI Components:** Introduce reusable `Button`, `Modal/Dialog`, `FormInput`, and `Toast` abstractions instead of manual DOM element creation scattered throughout `app.js`.
* **Hooks/State:** Extract indexedDB polling into a shared `useStore` or explicit EventBus model instead of `setInterval`.
* **API Client:** Create a central API client for the Cloudflare worker instead of manual `fetch` calls scattered in `background.js`.

## Architecture Review
* **Scalability:** The extension's rendering loop (manual DOM diffing and N+1 filtering) will not scale with thousands of interactions.
* **Maintainability:** Poor separation of concerns in `app.js` makes bug fixing risky and onboarding difficult.
* **Extensibility:** The lack of a component model means new features require boilerplate DOM manipulation.
* **Testing:** The monolithic nature of `app.js` makes it untestable in isolation.

## Performance Findings
* **Frontend:** `filteredInteractions()` in `app.js` does `JSON.stringify(body)` repeatedly inside a loop on every render, causing O(N) performance drops. `Math.max(...array)` is used on large arrays in waterfalls, risking call stack limits.
* **Backend (CLI/Worker):** Efficient and lightweight, but repetitive polling could be optimized.

## Security & Reliability Findings
* **XSS:** Manual HTML string concatenation in `app.js` (e.g., `renderInteractionListNew`).
* **DOM Clobbering:** Iterating over `el.attributes` instead of `Element.prototype.getAttributeNames.call(el)`.
* **Side-Effects:** Unbounded `setInterval` polling in `app.js` can cause memory leaks if not cleaned up.

## Testing Gaps
* Missing E2E tests for the frontend UI.
* DOM manipulation functions in `app.js` are virtually untested.
* No contract tests for the interactions between CLI and Extension.

## Rules Compliance Findings
* **Rule:** "Form labels are commonly implemented using non-semantic \`<div class="ek-label">\`" -> Violates accessibility standards. Need `aria-label`/`title` on inputs.
* **Rule:** "never refactor `extension/shared/app.js` in one shot" -> Need an incremental plan.

## Recommended Refactor Plan
### Quick Wins
1. Fix DOM clobbering by using `Element.prototype` methods.
2. Add `aria-label` and `title` to all inputs missing proper semantic labels.
3. Optimize `filteredInteractions` by caching stringified JSON in a `WeakMap`.

### Medium Effort Improvements
1. Replace manual DOM string construction with a safe HTML builder or template literals that automatically sanitize.
2. Abstract common UI components (Toast, Modal, Input).
3. Introduce an Event Bus for background-to-frontend communication instead of polling.

### Long-Term Architecture Improvements
1. Progressively decompose `app.js` into modular view components (e.g., `Sidebar`, `DetailsPanel`, `Settings`).
2. Implement a proper reactive state management layer.

# Final Requirement
1. Top 10 highest-value fixes.
   1. Fix `filteredInteractions` O(N) `JSON.stringify` performance bottleneck.
   2. Mitigate XSS risks by sanitizing manual HTML construction in `app.js`.
   3. Fix DOM Clobbering vulnerabilities via `Element.prototype` usage.
   4. Replace `Math.max(...array)` with iterative loops for large datasets.
   5. Add missing accessible labels (`aria-label`, `title`) to inputs/buttons.
   6. Fix `setInterval` memory leak risks in UI polling.
   7. Ensure all dynamically created Toasts have `role="status"` and `aria-live="polite"`.
   8. Safely sanitize URL rendering in the UI.
   9. Fix any missing origin checks in `postMessage` listeners.
   10. Ensure unhandled promise rejections are caught in `background.js` API calls.
2. Top 10 duplication-removal opportunities.
   1. FNV-1a hashing logic (Matcher vs CLI vs injected.js).
   2. URL normalization (Matcher vs CLI vs injected.js).
   3. Header normalization functions.
   4. Settings dialog rendering logic in `app.js`.
   5. Import/Export dialog rendering logic.
   6. Paste dialog rendering logic.
   7. Empty state placeholders.
   8. Error toast notifications.
   9. Form input groups (label + input).
   10. Primary/Secondary button styles/DOM creation.
3. Top reusable abstractions worth introducing.
   1. `UIComponent` base class for safe DOM generation.
   2. `EventManager` for cross-module messaging.
   3. `StorageService` wrapping IndexedDB.
   4. `Sanitizer` utility for all user inputs.
   5. `VirtualScroller` for large lists of interactions.
4. Files/components with highest technical debt.
   1. `extension/shared/app.js` (God file, mixed concerns)
   2. `extension/injected.js` (High complexity, monkey-patching)
   3. `extension/background.js` (Mixed state/API logic)
5. Suggested engineering standards missing from the repository.
   1. Explicit UI component boundaries (no DOM manipulation outside designated view functions).
   2. Strict CSP (Content Security Policy) enforcement for all `innerHTML` usage.
   3. Automated a11y (accessibility) linting.
   4. Centralized state management guidelines.
   5. E2E UI testing mandate for new features.
