# EchoKit — Development Rules & Guidelines

**Version**: 2.0  
**Last Updated**: 2026-05-19  
**Purpose**: Comprehensive rules for code writing, PR reviews, and merge phases

---

## 📚 Table of Contents

- [Core Principles](#core-principles)
- [Code Writing Phase](#code-writing-phase)
- [Chrome Extension Specific Rules](#chrome-extension-specific-rules)
- [PR Review Phase](#pr-review-phase)
- [Merge Phase](#merge-phase)
- [Common Mistakes to Avoid](#common-mistakes-to-avoid)
- [Key References](#key-references)

---

## 🎯 Core Principles

### 1. Zero Breaking Changes
- **Rule**: Never break existing functionality without explicit approval
- **Check**: Test backward compatibility before merging
- **Example**: Keep old API signatures when adding new ones
- **Why**: Users depend on existing behavior (EchoKit has public users on Chrome Web Store)

### 2. Performance First
- **Rule**: Optimize for performance from the start
- **Check**: Consider performance implications of all changes
- **Example**: Use debouncing (300ms), soft rendering, in-memory operations
- **Why**: Performance issues are hard to fix retroactively; extension must handle 1000+ interactions

### 3. Progressive Enhancement
- **Rule**: Add features progressively, not all at once
- **Check**: Can the feature be disabled without breaking the app?
- **Example**: Feature flags for experimental features (`FEATURES.popup` vs `FEATURES.devtools`)
- **Why**: Easier to test, debug, and rollback

### 4. Dual Interface Strategy
- **Popup**: Simple, uncluttered (400×600px) — quick actions only
- **DevTools**: Advanced features with unlimited space
- **Rule**: Use feature flags to control rendering based on interface
- **Why**: Different contexts need different UX; avoid UI clutter

### 5. Minimal Documentation Files
- **Rule**: Do NOT create unnecessary .md files; only create documentation when explicitly required
- **Check**: Before creating any .md file, ask: Is this absolutely necessary? Will it be maintained?
- **Guidelines**:
  - Use existing files: Update `README.md`, `CONTRIBUTING.md`, `TODO.md`, or `memory/` docs
  - Avoid: Creating `IMPLEMENTATION.md`, `DESIGN.md`, `NOTES.md`, etc. unless critical
  - For feature documentation: Add to `memory/` directory ONLY for major features
  - For implementation notes: Use inline JSDoc comments instead
- **Why**: Too many docs become outdated, confusing, and unmaintained; code should be self-documenting

---

## 📝 Code Writing Phase

### Constants Over Magic Numbers

❌ **Bad**:
```javascript
setTimeout(() => doSomething(), 300);
debounceInput(el, callback, 300);
```

✅ **Good**:
```javascript
const DEBOUNCE_DELAY = 300; // ms - Delay for debounced text inputs
setTimeout(() => doSomething(), DEBOUNCE_DELAY);
debounceInput(el, callback, DEBOUNCE_DELAY);
```

**Why**: Self-documenting code, easy to change globally, prevents inconsistencies

---

### Error Handling for All External Input

❌ **Bad**:
```javascript
const data = JSON.parse(userInput);
processData(data);
```

✅ **Good**:
```javascript
try {
  const data = JSON.parse(userInput);
  processData(data);
} catch (e) {
  console.error('Failed to parse JSON:', e.message);
  showError('Invalid JSON format');
}
```

**Required for**:
- `JSON.parse()`
- API calls (license validation, Worker calls)
- File operations (import/export)
- `localStorage`/`chrome.storage` operations
- User input parsing
- IndexedDB operations

---

### JSDoc Comments for Public Functions

❌ **Bad**:
```javascript
function filterInteractions(items, filters) {
  // ...
}
```

✅ **Good**:
```javascript
/**
 * Filters interactions based on multiple criteria
 * @param {Array} items - Array of interaction objects
 * @param {Object} filters - Filter criteria object
 * @param {string[]} filters.methods - HTTP methods to include
 * @param {string[]} filters.statusCodes - Status code ranges
 * @returns {Array} Filtered array of interactions
 */
function filterInteractions(items, filters) {
  // ...
}
```

**Why**: Better IDE autocomplete, clear function contracts, easier for contributors

---

### Debounce User Input

❌ **Bad**:
```javascript
input.addEventListener('input', (e) => {
  performExpensiveOperation(e.target.value);
});
```

✅ **Good**:
```javascript
const DEBOUNCE_DELAY = 300;
let timer;
input.addEventListener('input', (e) => {
  clearTimeout(timer);
  timer = setTimeout(() => {
    performExpensiveOperation(e.target.value);
  }, DEBOUNCE_DELAY);
});
```

**Apply to**: Search inputs, filter inputs, any text input triggering expensive operations

---

### Soft Rendering for Partial Updates

❌ **Bad**:
```javascript
// Full re-render loses cursor position and scroll
function updateFilter() {
  state.filter = newValue;
  render(); // Re-renders everything
}
```

✅ **Good**:
```javascript
// Soft render updates only the list, preserves input state
function updateFilter() {
  state.filter = newValue;
  softRenderList(); // Updates only list portion
}
```

**Why**: Preserves cursor position, maintains scroll, faster re-renders, better UX

---

### Respect Scope Settings in All Features

**CRITICAL RULE**: All features MUST respect the `settings.scope` value selected by the user.

**Scope options**:
- `domain` (default) — Recordings from `api.foo.com` visible on any tab on `api.foo.com`
- `tab` (strict) — Each tab is a sandbox; recordings only visible in that specific tab
- `global` — All recordings visible everywhere

❌ **Bad**:
```javascript
// Ignores scope, shows all interactions regardless of user setting
function getVisibleInteractions() {
  return getAllInteractions();
}
```

✅ **Good**:
```javascript
// Respects scope setting from user preferences
function getVisibleInteractions(tabId, host, scope) {
  const all = getAllInteractions();
  if (scope === 'global') return all;
  if (scope === 'tab') return all.filter(i => i.tabId === tabId);
  // domain scope
  return all.filter(i => hostOf(i.tabUrl || i.url) === host);
}
```

**Apply to**:
- Interaction filtering and display
- Mock activation (only mocks in scope can fire)
- Clear session operations
- Export/import operations
- CORS rule installation (DNR rules)
- Any feature that reads or writes interactions

**Why**: User expectations depend on scope; violating scope creates confusing behavior and breaks trust

---

### Feature Flags for Experimental Features

❌ **Bad**:
```javascript
// Hardcoded features visible to all users
function renderToolbar() {
  return `
    <button>Simple Feature</button>
    <button>Complex Experimental Feature</button>
  `;
}
```

✅ **Good**:
```javascript
const FEATURES = {
  popup: { experimental: false },
  devtools: { experimental: true }
};

function renderToolbar() {
  const features = getFeatures();
  return `
    <button>Simple Feature</button>
    ${features.experimental ? '<button>Experimental Feature</button>' : ''}
  `;
}
```

**Why**: Easy A/B testing, gradual rollout, easy rollback, different features per context

---

### File Size & Function Length Limits

| Type | Ideal | Warning | Critical |
|------|-------|---------|----------|
| **Function** | < 50 lines | > 100 lines | > 150 lines (must refactor) |
| **File** | < 500 lines | > 1000 lines | > 2000 lines (must split) |

**Current Tech Debt**:
- `extension/shared/app.js`: ~2700 lines (needs splitting into modules)
- See [Issue #8](https://github.com/ravitejakamalapuram/echokit/issues/8)

---

### Naming Conventions

- **Constants**: `SCREAMING_SNAKE_CASE`
- **Functions**: `camelCase`
- **Variables**: `camelCase`
- **Components**: `PascalCase` (if applicable)
- **Private functions**: `_camelCase` or prefix with underscore

---

### Code Style

- **Indentation**: 2 spaces (JavaScript)
- **No trailing whitespace**
- **No console.log** in production code (unless intentional logging)
- **No commented-out code** (use git history instead)
- **Descriptive names**: Avoid single-letter variables except in loops

---

## 🛡️ Chrome Extension Specific Rules

**Architecture**: Follow EchoKit's Chrome MV3 patterns

#### World Contexts & Message Passing
- **`injected.js`** - MAIN world (page context), intercepts `fetch`/`XMLHttpRequest`
- **`content.js`** - ISOLATED world (extension context), message bridge
- **`background.js`** - Service worker (NO DOM, NO window, NO localStorage)
- **Communication**: MAIN ↔ postMessage ↔ ISOLATED ↔ chrome.runtime ↔ SW

#### Message Type Convention
All messages use format: `echokit:category:action`
- Examples: `echokit:interaction:update`, `echokit:mocking:toggle`, `echokit:settings:update`

#### Storage Strategy
- **`chrome.storage.sync`** - Settings only (8KB limit)
- **IndexedDB** - Interactions/recordings (unlimited)
  - Indexes: `hash`, `tabId`, `sessionId`, `timestamp` (see `extension/shared/store.js`)
- **Service worker memory** - Tab state Map (ephemeral)

#### DNR (Declarative Net Request) - CORS Override
- **Global scope**: Dynamic rules (browser-wide)
- **Domain scope**: Session rules with `requestDomains`
- **Tab scope**: Session rules with `tabIds`
- Implementation: `extension/background.js` → `syncCorsRules()`

#### Critical MV3 Rules
- ❌ NO `eval()` or `new Function()` with dynamic code
- ❌ NO DOM access in `background.js`
- ❌ NO `localStorage` in service worker
- ✅ All code in extension package (no remote scripts)

---

### Security & Performance

**Security**:
- HTTPS only for external requests (license endpoint)
- Wrap `JSON.parse()` and URL parsing in try-catch
- Validate message `sender` before processing
- NO sensitive data in storage (not encrypted)

**Performance**:
- Debounce input: 300ms (`DEBOUNCE_DELAY`)
- IndexedDB: Use indexes, batch operations, avoid full scans
- Service worker: Never rely on globals; re-initialize on messages
- Test with 1000+ interactions

---

## �🔍 PR Review Phase

### Pre-Review Checklist (Reviewer Must Read)

**BEFORE starting any PR review**:
1. ✅ Read this `rules.md` file
2. ✅ Read `memory/CODING_RULES.md` for detailed examples
3. ✅ Review `CONTRIBUTING.md` for workflow requirements
4. ✅ Check existing patterns in the codebase

### Code Quality Review

- [ ] **No magic numbers** - All extracted to constants with descriptive names
- [ ] **Error handling** - All external input (JSON.parse, API calls, storage) wrapped in try-catch
- [ ] **JSDoc comments** - All public functions have parameter/return documentation
- [ ] **Descriptive names** - Variables, functions clearly describe their purpose
- [ ] **No console.log** - Unless intentional logging (document why)
- [ ] **Constants used** - All repeated values extracted to constants
- [ ] **File size** - No files > 500 lines (warning), must split if > 2000 lines
- [ ] **Function size** - No functions > 50 lines (ideal), must refactor if > 150 lines

### Performance Review

- [ ] **No unnecessary re-renders** - Use soft rendering where appropriate
- [ ] **Debounced user input** - Search/filter inputs use `DEBOUNCE_DELAY`
- [ ] **Optimized loops** - Sequential filtering with early exits
- [ ] **No memory leaks** - Event listeners properly managed, timers cleared
- [ ] **Tested with large datasets** - Works with 1000+ interactions
- [ ] **IndexedDB efficiency** - Batch operations, avoid unnecessary reads

### Architecture Review

- [ ] **Follows existing patterns** - Consistent with codebase style
- [ ] **Separation of concerns** - Single responsibility principle
- [ ] **Reusable functions** - Extract common logic into helpers
- [ ] **Feature flags** - Experimental features behind flags
- [ ] **Backward compatible** - No breaking changes without approval
- [ ] **Dual interface support** - Features work in both popup and DevTools (where applicable)

### Security Review

- [ ] **No secrets committed** - API keys, tokens, credentials excluded
- [ ] **Input validation** - User input sanitized before use
- [ ] **CSP compliance** - Content Security Policy rules followed
- [ ] **Safe HTML rendering** - No XSS vulnerabilities in templates
- [ ] **Permission usage** - Only request necessary Chrome permissions

### EchoKit-Specific Review

- [ ] **Chrome MV3 compliance** - Follows Manifest V3 requirements
- [ ] **Service worker compatibility** - Works with background.js limitations
- [ ] **Message passing** - Correct `postMessage` and `chrome.runtime` usage
- [ ] **Storage usage** - Proper use of IndexedDB, chrome.storage.sync
- [ ] **DNR rules** - Declarative Net Request rules correct (for CORS)
- [ ] **Injection context** - MAIN world vs ISOLATED world handled correctly

### Testing Review

- [ ] **Manual testing done** - Checklist completed by PR author
- [ ] **Edge cases tested** - Empty state, 0 items, 1000+ items
- [ ] **Error scenarios tested** - Network failures, invalid input
- [ ] **Backward compatibility tested** - Old workflows still work
- [ ] **Performance tested** - No lag with realistic data volumes
- [ ] **Cross-browser tested** - Works on Chrome/Edge (if UI changes)
- [ ] **Light/dark theme tested** - Both themes work correctly (if UI changes)

### Documentation Review

- [ ] **README updated** - If public API or features changed
- [ ] **JSDoc comments** - Added for new functions
- [ ] **TODO.md updated** - Mark completed items, add new ones if needed
- [ ] **memory/ docs** - ONLY for major features; avoid creating unnecessary .md files
- [ ] **No unnecessary .md files** - Don't create IMPLEMENTATION.md, DESIGN.md, NOTES.md, etc.
  - Use existing docs: `README.md`, `CONTRIBUTING.md`, `TODO.md`, `memory/`
  - Inline JSDoc comments preferred over separate doc files
- [ ] **Scope compliance** - ALL features respect `settings.scope` (tab/domain/global)

---

## ✅ Merge Phase

### Pre-Merge Checklist

**CRITICAL**: ALL items must be checked before merging

#### Code Quality
- [ ] All PR review checklist items completed and approved
- [ ] No unresolved review comments
- [ ] Code follows all rules in this document
- [ ] No TODO comments without corresponding TODO.md entry
- [ ] Smoke tests pass: `python3 tests/smoke_echokit.py`

#### Testing
- [ ] Manual testing completed and documented
- [ ] No regressions in existing functionality
- [ ] Performance tested with 1000+ interactions
- [ ] Scope tested in tab, domain, and global modes (if scope-related)

#### Documentation
- [ ] User-facing changes documented in existing files
- [ ] Technical decisions recorded in `memory/` ONLY if major feature
- [ ] No unnecessary .md files created (use existing docs instead)
- [ ] Breaking changes clearly documented (if any)
- [ ] Version number updated in `manifest.json` (if releasing)

#### Security & Privacy
- [ ] No sensitive data committed
- [ ] Privacy policy still accurate
- [ ] No new permissions added without justification
- [ ] All external requests use HTTPS

#### Chrome Extension Specific
- [ ] Manifest V3 compliance verified
- [ ] Extension loads without errors in `chrome://extensions`
- [ ] No console errors in background service worker
- [ ] CORS override works (if modified)
- [ ] Scope filtering works correctly (if modified)

---

### Version Bump Guidelines

Update `extension/manifest.json` version before merging:

- **Major** (2.0.0) - Breaking changes, major features
- **Minor** (1.X.0) - New features, backward compatible
- **Patch** (1.0.X) - Bug fixes, minor improvements

**Current version**: Check `extension/manifest.json`

---

### Merge Commit Message Format

Use conventional commit format:

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types**: `feat`, `fix`, `refactor`, `perf`, `docs`, `test`, `chore`

**Example**:
```
feat(scope): Add scope-aware filtering for all features

- Refactored interaction filtering to respect scope settings
- Updated CORS rules to scope-aware DNR rules
- Added scope parameter to all interaction queries
- Tested with tab, domain, and global scope modes

Closes #123
```

---

### Post-Merge Actions

- [ ] Monitor Chrome Web Store reviews for user issues
- [ ] Update `TODO.md` to mark completed items
- [ ] Create GitHub release if version bumped
- [ ] Update Chrome Web Store listing if needed
- [ ] Announce significant changes to users (if applicable)

---

## ⚠️ Common Mistakes to Avoid

### 1. Ignoring Scope Settings
❌ **Bad**: `const items = getAllInteractions();`
✅ **Good**: `const items = getVisibleInteractions(tabId, host, scope);`

### 2. Magic Numbers
❌ **Bad**: `setTimeout(() => doSomething(), 300);`
✅ **Good**: `setTimeout(() => doSomething(), DEBOUNCE_DELAY);`

### 3. Unhandled JSON.parse
❌ **Bad**: `const data = JSON.parse(userInput);`
✅ **Good**: `try { const data = JSON.parse(userInput); } catch { showError(); }`

### 4. Full Re-render on Input
❌ **Bad**: `input.oninput = () => render();` (loses cursor)
✅ **Good**: `input.oninput = debounce(() => softRenderList(), 300);`

### 5. Service Worker DOM Access
❌ **Bad**: `document.querySelector()` in background.js
✅ **Good**: Use offscreen document or content script

### 6. Hardcoded Feature Visibility
❌ **Bad**: Always show experimental features
✅ **Good**: Use `FEATURES[mode].experimental` flag

### 7. No Error Boundaries
❌ **Bad**: Async calls without error handling
✅ **Good**: All async wrapped in try-catch with user feedback

### 8. Breaking Backward Compatibility
❌ **Bad**: Remove or rename existing message types
✅ **Good**: Add new types, deprecate old ones gradually

---

## 📚 EchoKit Code References

### Documentation Files
- `README.md` - Main project overview
- `extension/README.md` - Extension architecture details
- `CONTRIBUTING.md` - Contribution workflow
- `TODO.md` - Product roadmap
- `memory/` - Design decisions (use sparingly)

### Key Source Files
- `extension/background.js` - Service worker, state management
- `extension/injected.js` - MAIN world fetch/XHR interception
- `extension/content.js` - ISOLATED world message bridge
- `extension/shared/app.js` - UI module (~2700 lines, needs refactoring)
- `extension/shared/store.js` - IndexedDB wrapper
- `extension/shared/matcher.js` - URL/body hashing logic

### Testing Files
- `tests/smoke_echokit.py` - Playwright smoke tests (24+ assertions)
- `cli/test/test.js` - CLI server tests
- `worker/test.js` - License worker tests

---

**End of Rules** • Version 2.0 • Last Updated: 2026-05-19

