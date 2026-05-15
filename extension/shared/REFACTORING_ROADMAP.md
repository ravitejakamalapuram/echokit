# App.js Refactoring Roadmap

## Current State

`extension/shared/app.js` is currently **2,816 lines** - a monolithic file containing:
- State management
- UI rendering (80+ functions)
- Event handlers
- Dialog implementations
- Feature-specific logic
- Utility functions

This makes the code hard to:
- Navigate and understand
- Test in isolation
- Modify without merge conflicts
- Reuse across components

## Phase 1: Foundation (COMPLETED) ✅

**Goal**: Extract pure utility functions that have no dependencies on state or DOM.

**Modules Created**:
- `utils/formatting.js` - Text formatting, escaping, JSON pretty-printing, byte/duration formatting
- `utils/dom.js` - DOM utilities, toast notifications, clipboard, file downloads, element creation
- `utils/api.js` - Chrome extension API wrappers for messaging, tab state, settings, etc.
- `state/ui-state.js` - Centralized state management with observer pattern

**Benefits**:
- Utilities can be tested in isolation
- Clear separation of concerns
- Reusable across future components
- Foundation for further refactoring

## Phase 2: State Management (FUTURE)

**Goal**: Migrate from inline state object to centralized state management.

**Tasks**:
1. Replace all `state.` references with `getState().`
2. Replace direct assignments with `setState({ ... })`
3. Add state change listeners for reactive updates
4. Test state persistence and restoration

**Files to Modify**:
- `extension/shared/app.js` - Replace state usage

## Phase 3: UI Components (FUTURE)

**Goal**: Extract rendering functions into focused UI modules.

**Modules to Create**:
- `ui/toolbar.js` - Toolbar rendering and controls
- `ui/list-view.js` - Interaction list rendering
- `ui/detail-panel.js` - Request/response detail view
- `ui/filters.js` - Advanced filter panel
- `ui/footer.js` - Footer with stats

**Benefits**:
- Each UI module can be tested independently
- Easier to modify individual UI sections
- Clearer responsibility boundaries

## Phase 4: Dialogs (FUTURE)

**Goal**: Extract modal/dialog logic into separate modules.

**Modules to Create**:
- `dialogs/settings-dialog.js` - Settings modal
- `dialogs/import-export.js` - HAR/Postman import/export dialogs
- `dialogs/gist-sync.js` - GitHub Gist upload/import dialogs
- `dialogs/license-dialog.js` - Pro license validation

## Phase 5: Features (FUTURE)

**Goal**: Extract feature-specific logic into focused modules.

**Modules to Create**:
- `features/request-headers.js` - Global request header injection
- `features/url-rewrite.js` - URL rewriting rules
- `features/transforms.js` - Request/response transformations
- `features/blocklist.js` - Request blocking rules

## Phase 6: Final Integration (FUTURE)

**Goal**: Reduce app.js to a minimal orchestration layer.

**Target**:
- app.js < 200 lines
- Entry point that imports and coordinates modules
- No business logic - just initialization and wiring

## Testing Strategy

For each phase:
1. Run smoke tests before extraction
2. Create module with tests
3. Integrate module into app.js
4. Run smoke tests to verify no regressions
5. Commit incrementally

## Benefits of Incremental Approach

- **Low Risk**: Each phase is independently tested
- **Reviewable**: Smaller PRs are easier to review
- **Reversible**: Can roll back individual phases
- **Continuous Delivery**: Each phase delivers value
- **Team-Friendly**: Multiple developers can work in parallel on different phases

## Next Steps

1. Review Phase 1 utilities (this PR)
2. Plan Phase 2 state migration
3. Continue incrementally through phases
