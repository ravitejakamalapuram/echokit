# EchoKit UI Componentization — Master Checklist

> **Print this document and check off each item as you complete it**

---

## Phase 0: Deep Analysis & Design Validation

### 0.1 Visual Inventory
- [ ] Take screenshot: Popup light theme with interactions
- [ ] Take screenshot: Popup dark theme with interactions
- [ ] Take screenshot: DevTools light theme with interactions
- [ ] Take screenshot: DevTools dark theme with interactions
- [ ] List ALL columns visible in popup grouped view
- [ ] List ALL columns visible in DevTools table view
- [ ] Document badge positions (mock, source, conflict, mode)
- [ ] Document button styles differences
- [ ] Measure spacing (gaps, padding, margins)
- [ ] Document font sizes for each mode
- [ ] Document color usage for status codes
- [ ] Test and document all hover states

### 0.2 Behavioral Inventory
- [ ] Document popup selection behavior
- [ ] Document DevTools selection behavior
- [ ] Test click on method badge in both modes
- [ ] Test click on status in both modes
- [ ] Document sorting behavior in DevTools
- [ ] Confirm no sorting in popup
- [ ] Test filters in both modes

### 0.3 Data Flow Audit
- [ ] Trace filteredInteractions() output
- [ ] Trace groupByDomain() logic
- [ ] Trace state.selectedId usage
- [ ] Trace state.sortBy and state.sortOrder
- [ ] List all feature flags used
- [ ] List all helper functions (prettyUrl, formatTimestamp, etc.)

### 0.4 CSS Audit
- [ ] Document .ek-row complete styles
- [ ] Document .ek-table-row complete styles
- [ ] Document .ek-col styles and flex rules
- [ ] Document .ek-domain group header styles
- [ ] Document .ek-list-header styles
- [ ] Identify any CSS that might break

### 0.5 Accessibility Audit
- [ ] Test keyboard navigation in popup
- [ ] Test keyboard navigation in DevTools
- [ ] Check all aria-labels present
- [ ] Verify data-testid consistency
- [ ] Test focus management
- [ ] Run Chrome Lighthouse a11y audit

### 0.6 Component Boundaries
- [ ] Draw complete component tree on paper
- [ ] Define MethodCell input/output contract
- [ ] Define UrlCell input/output contract
- [ ] Define StatusCell input/output contract
- [ ] Define ActionsCell input/output contract

### 0.7 Design Decisions
- [ ] Lock in column visibility strategy
- [ ] Lock in layout detection approach
- [ ] Lock in CSS strategy (no breaking changes)
- [ ] Lock in error handling pattern
- [ ] Lock in testing strategy

### 0.8 Create Audit Documents
- [ ] Create specs/CURRENT_STATE_AUDIT.md
- [ ] Create specs/COMPONENT_CONTRACTS.md
- [ ] Create specs/CSS_IMPACT_ANALYSIS.md
- [ ] Create specs/MIGRATION_RISK_MATRIX.md

**✋ STOP: Do NOT proceed to Phase 1 until ALL of Phase 0 is complete**

---

## Phase 1: Column Configuration System

- [ ] Create extension/shared/columns.js
- [ ] Define method column with render function
- [ ] Define url column with render function
- [ ] Define status column with render function
- [ ] Define duration column (DevTools only)
- [ ] Define timestamp column (DevTools only)
- [ ] Define source column (conditional)
- [ ] Define badges column (popup only)
- [ ] Define actions column with both button styles
- [ ] Implement getVisibleColumns(mode, features)
- [ ] Implement getColumn(key)
- [ ] Implement sortInteractions(interactions, sortBy, sortOrder)
- [ ] Implement validateColumnConfig()
- [ ] Write 15+ unit tests in tests/unit/columns.test.js
- [ ] All tests pass

**✋ STOP: Do NOT proceed to Phase 2 until Phase 1 tests are green**

---

## Phase 2: Core Rendering Components

- [ ] Create extension/shared/interaction-renderer.js
- [ ] Implement renderInteractionCell() with error handling
- [ ] Implement renderInteractionTableRow() for DevTools
- [ ] Implement renderInteractionGroupedRow() for popup
- [ ] Implement renderTableHeader() for DevTools
- [ ] Implement renderDomainGroupHeader() for popup
- [ ] Add JSDoc comments to all functions
- [ ] Write 20+ unit tests in tests/unit/interaction-renderer.test.js
- [ ] Test error handling (render throws error)
- [ ] Test selected row has correct class
- [ ] All tests pass

**✋ STOP: Do NOT proceed to Phase 3 until Phase 2 tests are green**

---

## Phase 3: Layout Adaptors

- [ ] Create extension/shared/layouts.js
- [ ] Implement groupByDomain() helper
- [ ] Implement renderTableLayout() for DevTools
- [ ] Implement renderGroupedLayout() for popup
- [ ] Handle empty state in both layouts
- [ ] Add JSDoc comments
- [ ] Write 10+ tests in tests/unit/layouts.test.js
- [ ] Test with 0 interactions
- [ ] Test with 1 interaction
- [ ] Test with 100+ interactions
- [ ] All tests pass

**✋ STOP: Do NOT proceed to Phase 4 until Phase 3 tests are green**

---

## Phase 4: Integration & Migration

- [ ] Add imports to extension/shared/app.js
- [ ] Add ENABLE_COMPONENTIZED_RENDERING feature flag
- [ ] Implement buildRenderConfig() function
- [ ] Rename old renderListView to renderListViewLegacy
- [ ] Implement new renderListView using layouts
- [ ] Update softRenderList() to use new system
- [ ] Write migration tests in tests/integration/migration.test.js
- [ ] Test with flag OFF → verify old code works
- [ ] Test with flag ON → verify new code works
- [ ] Compare HTML output (old vs new) → must match
- [ ] Verify all data-testid attributes preserved
- [ ] Run smoke tests with flag OFF → all pass
- [ ] Run smoke tests with flag ON → all pass

**✋ STOP: Do NOT proceed to Phase 5 until migration tests pass**

---

## Phase 5: Testing & Validation

### Visual Regression
- [ ] Set up Playwright visual tests
- [ ] Capture popup baseline screenshots
- [ ] Capture DevTools baseline screenshots
- [ ] Enable new code, compare screenshots
- [ ] Fix any visual differences

### Manual Testing: Popup
- [ ] Grouped layout appears correctly
- [ ] Domain headers show counts
- [ ] Click row → detail slides in
- [ ] Method badges render correctly
- [ ] Status colors correct
- [ ] Mock toggle works
- [ ] Block button works
- [ ] Light theme looks good
- [ ] Dark theme looks good

### Manual Testing: DevTools
- [ ] Table layout appears correctly
- [ ] Table header with sortable columns
- [ ] Click header → sort ascending
- [ ] Click again → sort descending
- [ ] All columns align correctly
- [ ] Duration column visible
- [ ] Timestamp column visible
- [ ] Light theme looks good
- [ ] Dark theme looks good

### Cross-Mode Testing
- [ ] Record in popup → open DevTools → same data
- [ ] Toggle mock in popup → check DevTools → synced
- [ ] Delete in popup → check DevTools → removed
- [ ] Export from popup → import in DevTools → works

### Performance & Accessibility
- [ ] Render 1000 rows in <100ms
- [ ] Sort 1000 rows in <50ms
- [ ] Lighthouse a11y score >95
- [ ] No console errors
- [ ] No memory leaks

**✋ STOP: Do NOT proceed to Phase 6 until ALL tests pass**

---

## Phase 6: Cleanup & Documentation

- [ ] Remove renderDomainGroup() from app.js
- [ ] Remove renderRow() from app.js
- [ ] Remove renderSortableTable() from app.js
- [ ] Remove renderSortableListHeader() from app.js
- [ ] Remove renderInteractionRow() from app.js
- [ ] Remove renderListViewLegacy() from app.js
- [ ] Remove ENABLE_COMPONENTIZED_RENDERING flag
- [ ] Update extension/README.md with new architecture
- [ ] Create docs/ADR_002_COMPONENTIZED_UI.md
- [ ] Update CHANGELOG.md
- [ ] Run python3 tests/smoke_echokit.py → all pass
- [ ] Create PR with detailed description
- [ ] Request code review
- [ ] Merge to main

---

## ✅ DONE!

Congratulations! You've successfully componentized the EchoKit UI with:
- Zero code duplication
- Professional architecture
- Comprehensive test coverage
- Complete documentation

**Time to celebrate!** 🎉
