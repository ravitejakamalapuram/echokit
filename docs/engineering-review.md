
# EchoKit Repository Engineering Review

## Executive Summary
* **Overall Repo Health Score**: 75/100
* **Biggest Risks**: High code duplication between backend (cli) and frontend (extension/shared/matcher.js), extreme god component in `extension/shared/app.js` (3243 LOC), manually duplicated dependencies across MAIN/ISOLATED worlds, XSS risks in manual DOM rendering.
* **Highest ROI Improvements**: Splitting `app.js` into smaller domain modules (settings, request detail, header), unifying matcher logic into a single shared package, migrating to a build tool (Vite) to eliminate manual IIFE wrapping and duplicate files, and standardizing error handling.
* **Architecture Concerns**: The lack of a bundler forces manual script injection and duplicated logic. The `background.js` service worker handles too many responsibilities (storage, DNR rules, license validation).

## Critical Issues
1. **God Component**: `extension/shared/app.js` is massive (>3000 LOC), violating the 2000 LOC limit rule and acting as a central bottleneck for UI changes.
2. **Duplicated Matching Logic**: `cli/lib/match.js` and `extension/shared/matcher.js` contain almost identical logic for FNV-1a hashing and URL normalization. A bug fix in one must be manually ported to the other, leading to inconsistent mock behavior between the browser and CLI.
3. **Manual Dependency Management**: Files like `extension/injected.js` hand-inline dependencies (like matcher logic) because there's no build step.
4. **Service Worker Bloat**: `extension/background.js` (1806 LOC) manages IndexedDB, declarative net request rules, cross-tab state, and license validation.

## Duplication Report
* **Matcher Logic**: `cli/lib/match.js` and `extension/shared/matcher.js` duplicate core hashing logic. *Suggestion: Extract to a shared `packages/core` workspace.*
* **UI State Management**: Event handlers and state updates are duplicated across multiple UI panels in `app.js`. *Suggestion: Implement a lightweight state store (e.g., Zustand-lite).*
* **API Utilities**: Fetch wrappers and response parsers are duplicated in `injected.js` and `background.js`.

## Reusability Opportunities
* **State Management Hook**: Extract the global `state` object in `app.js` into a generic observable store that components can subscribe to.
* **Component Primitives**: Create reusable UI primitives (Buttons, Inputs, Modals) instead of hand-coding HTML strings for every panel.
* **Shared Types/Interfaces**: Define standard types for interactions, mocks, and settings to be shared between the CLI and extension.

## Architecture Review
* **Scalability**: The vanilla JS approach with hand-coded HTML strings is reaching its limits. As features grow, maintaining `innerHTML` templates becomes brittle and error-prone.
* **Maintainability**: The lack of a bundler makes module sharing difficult, forcing anti-patterns like copy-pasting code into `injected.js`.
* **Separation of Concerns**: The UI layer (`app.js`) is tightly coupled to business logic (filtering, sorting) and storage.
* **Testability**: Testing `app.js` requires heavy DOM mocking. Splitting logic into pure functions would improve test coverage.

## Performance Findings
* **Expensive Renders**: The UI relies on full DOM replacements for many updates. *Suggestion: Use a virtual DOM library or fine-grained DOM updates.*
* **Large Array Operations**: Filtering and sorting the interaction list happens inline during render, causing O(N) operations on every keystroke. *Suggestion: Pre-compute filtered lists and use `WeakMap` for memoization as specified in rules.*
* **Service Worker Caching**: License validation results are cached, but API mock indexes are pushed fully to `injected.js`, which could cause memory pressure for very large mock sets.

## Security & Reliability Findings
* **XSS Risks**: While `sanitizeHTML` is used, hand-coding HTML strings with interpolated variables is inherently risky. *Suggestion: Migrate to a safer templating engine or React/Preact.*
* **Offline Fallbacks**: License validation falls back to format-checking offline, which is good, but could be bypassed if the cached timestamp is manipulated.
* **Async Handling**: Many async operations in `background.js` lack proper timeout handling, potentially leading to unresolved promises if the network hangs.

## Testing Gaps
* **Unit Tests**: The core UI logic in `app.js` has almost no unit tests, relying entirely on the Playwright smoke tests.
* **CLI Coverage**: While the CLI has tests, they cover happy paths. Edge cases for malformed JSON or corrupted exported mocks are missing.

## Rules Compliance Findings
* **File Size Limit**: `app.js` violates the 2000 LOC limit defined in `DEVELOPMENT_RULES.md`. (Rule: "Files over 2000 lines must be split.")
* **Function Size**: Several functions in `app.js` exceed the 150 LOC limit.
* **Performance Rule**: Repeated inline `.filter()` operations violate the rule against O(N) rendering bottlenecks.

## Recommended Refactor Plan

### Quick Wins (1-2 weeks)
1. Split `app.js` into domain-specific modules (`settings.js`, `detail.js`, `header.js`) following the componentization strategy already started.
2. Fix inline `.filter()` bottlenecks by memoizing filtered arrays.

### Medium Effort (1-2 months)
1. Extract shared logic (matcher, utilities) into an npm workspace or shared folder that both CLI and extension can import (requires a lightweight build step).
2. Refactor `background.js` into smaller service modules (e.g., `storage-service.js`, `license-service.js`).

### Long-term (3-6 months)
1. Migrate the frontend to a modern framework (e.g., Preact or React) with Vite to handle templating securely and manage state efficiently.
2. Unify the CLI and Extension core logic into a true monorepo structure.

## Final Requirement

1. **Top 10 highest-value fixes**
   - Split `extension/shared/app.js` to resolve the 3243 LOC god component.
   - Pre-compute filtered interaction lists to resolve O(N) rendering bottlenecks.
   - Unify `cli/lib/match.js` and `extension/shared/matcher.js`.
   - Refactor `extension/background.js` into separate modules for storage, license, and DNR.
   - Standardize error handling and timeout wrappers for all async network calls.
   - Replace `innerHTML` string concatenation with safer DOM APIs or a templating engine.
   - Centralize configuration constants (currently scattered).
   - Add unit tests for core UI logic, decoupled from the DOM.
   - Implement a lightweight state store for UI state.
   - Remove hand-inlined dependencies from `injected.js` using a minimal build step.

2. **Top 10 duplication-removal opportunities**
   - Matcher logic (`cli/lib/match.js` vs `extension/shared/matcher.js`).
   - FNV-1a hashing function (duplicated across multiple files).
   - URL normalization logic.
   - HTTP method color constants.
   - Search/filter helper logic.
   - Empty state UI rendering.
   - Timestamp formatting utilities.
   - Error notification popups.
   - Storage read/write wrappers.
   - Tab state synchronization logic.

3. **Top reusable abstractions worth introducing**
   - `useInteractionStore`: Centralized state management for interactions.
   - `safeRender`: A wrapper for DOM updates that automatically sanitizes.
   - `createMessageBridge`: A standard utility for cross-world messaging.
   - `APIClient`: A shared wrapper for internal API calls (e.g., to the license worker).

4. **Files/components with highest technical debt**
   - `extension/shared/app.js`
   - `extension/background.js`
   - `extension/injected.js`
   - `cli/lib/server.js`

5. **Suggested engineering standards missing from the repository**
   - **Build Tooling**: A bundler (Vite/Rollup) to allow standard imports across all extension contexts.
   - **Type Safety**: TypeScript adoption to catch payload mismatches between the CLI, Worker, and Extension.
   - **State Management Protocol**: A defined pattern for unidirectional data flow in the vanilla JS UI.
