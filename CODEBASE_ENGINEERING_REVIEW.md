# EchoKit Codebase Engineering Review & Audit Report

## Executive Summary
* **Repo Health Score:** B-
* **Biggest Risks:**
  - Massive god file (`extension/shared/app.js` is ~3200 lines) with tight coupling of DOM manipulation, state, and business logic.
  - Hard dependency on `setInterval` for UI polling instead of reactive event-driven state updates.
  - Multiple file duplications (e.g., `cli/lib/match.js` vs `extension/shared/matcher.js`) requiring manual synchronization.
* **Highest ROI Improvements:**
  - Break down `app.js` into smaller, isolated View, Controller, and Store abstractions.
  - Replace polling `setInterval` in UI with a Pub/Sub or reactive state manager.
  - Extract reusable DOM components (e.g. Modals, Buttons, Forms) instead of inline `innerHTML` and `document.createElement` repetition.
* **Architecture Concerns:** The application heavily mixes UI rendering and side effects. There is no abstraction layer for UI components.

## Critical Issues
* **God File (app.js):** 3,200+ lines of monolithic code making maintenance and unit testing of UI logic nearly impossible.
* **State Polling Anti-pattern:** The UI uses `setInterval` every 1.5s to refresh state instead of listening to data mutation events.
* **XSS / DOM Clobbering Vulnerabilities Risk:** High usage of `innerHTML` and manual DOM parsing. Although `sanitizeHTML` is used, inline event handlers or DOM clobbering via prototype pollution remain risks without a strict CSP.

## Duplication Report
1. **Matcher Logic:** `cli/lib/match.js` and `extension/shared/matcher.js` share identical functionality.
   - *Why problematic:* High risk of diverging hashing logic which would break mocked interactions exported from extension to CLI.
   - *Fix:* Publish a shared utility NPM package or symlink/build-step the file to ensure a single source of truth.
2. **Modal Creation:** 17+ duplicated instances of modal creation logic in `app.js` (`document.createElement('div')`).
   - *Fix:* Create a `ModalService` or a reusable `showModal({ title, content, actions })` function.

## Reusability Opportunities
* **Modal Component:** Abstract the overlay creation, dismissal, and `innerHTML` generation into a reusable modal builder.
* **Toast Notification:** The `toast` function creates DOM elements ad-hoc. It could be expanded into a proper `NotificationManager`.
* **Forms & Labels:** Create a `FormField` abstraction that guarantees an `ek-label` paired with an `aria-label` for accessibility.

## Architecture Review
* **Scalability:** The current monolithic `app.js` structure will not scale to more complex DevTools features.
* **Maintainability:** Poor. State is mutated globally, leading to unpredictable render cycles.
* **Separation of Concerns:** Weak. Event listeners, markup strings, business logic, and network calls are tightly intertwined.

## Security & Reliability Findings
* **Accessibility:** `ek-label` is used with `div` elements rather than semantic `<label for="id">`. Forms are missing proper `aria` links.

## Testing Gaps
* **UI Testing:** Minimal isolation. The `app.js` cannot be unit tested without a full DOM and Chrome extension mock environment.
* **Suggestion:** Refactor UI logic into pure functions that return HTML strings and test them independently of the DOM.

## Recommended Refactor Plan
### Quick Wins
1. Extract the duplicated Modal creation code into a single `createModal()` utility.
2. Fix accessibility on form inputs by converting `<div class="ek-label">` to `<label>` or adding `aria-label`.

### Medium Effort
1. Implement an event-driven state manager to replace the 1.5s `setInterval` polling in `app.js`.
2. Break out Settings, Headers, and Rules into separate renderer files.

### Long-term Architecture
1. Migrate the frontend to a lightweight VDOM library (like Preact) or use a component-based architecture to manage state and rendering cleanly.
2. Unify the `matcher.js` code via a build step or mono-repo structure to eliminate the manual sync requirement between CLI and Extension.

---

### Top 10 Highest-Value Fixes
1. Remove `setInterval` UI polling.
2. Abstract Modal creation logic.
3. Fix `ek-label` semantic HTML structure.
4. Extract `toast()` into a robust notification manager.
5. Create a shared build artifact for `matcher.js`.
6. Separate Settings UI logic from `app.js`.
7. Centralize API calls with timeout/retry logic.
8. Unify list rendering patterns (Key-Value rows).
9. Move search/filter logic to a separate reducer/module.
10. Implement proper DOM cleanup on UI unmounts.

### Top Duplication-Removal Opportunities
1. Modal overlays.
2. `cli/lib/match.js` vs `extension/shared/matcher.js`.

### Top Reusable Abstractions Worth Introducing
1. `ModalService`
2. `NotificationService`
3. `FormBuilder`
4. `EventEmitter` / State Store

### Files/Components With Highest Technical Debt
1. `extension/shared/app.js`
2. `extension/background.js`
3. `extension/injected.js`
4. `cli/lib/server.js`

### Suggested Engineering Standards Missing
1. Strict Content Security Policy (CSP) enforcement.
2. Declarative UI framework / VDOM conventions.
3. Automated UI component testing (e.g. Storybook / Playwright).
