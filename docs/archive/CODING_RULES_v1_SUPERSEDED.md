# Coding Rules & PR Review Guidelines

**Version**: 1.0  
**Last Updated**: 2026-05-07  
**Purpose**: Guidelines for code quality, PR reviews, and avoiding common mistakes

---

## 🎯 Core Principles

### 1. Zero Breaking Changes
- **Rule**: Never break existing functionality unless explicitly approved
- **Check**: Test backward compatibility before merging
- **Example**: Keep old API signatures when adding new ones
- **Why**: Users depend on existing behavior

### 2. Performance First
- **Rule**: Optimize for performance from the start
- **Check**: Consider performance implications of all changes
- **Example**: Use debouncing, soft rendering, in-memory operations
- **Why**: Performance issues are hard to fix retroactively

### 3. Progressive Enhancement
- **Rule**: Add features progressively, not all at once
- **Check**: Can the feature be disabled without breaking the app?
- **Example**: Feature flags for experimental features
- **Why**: Easier to test, debug, and rollback

---

## 📝 Code Quality Standards

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

**Why**: 
- Self-documenting code
- Easy to change globally
- Prevents inconsistencies

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
- JSON.parse()
- API calls
- File operations
- localStorage/sessionStorage
- User input parsing

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

**Why**:
- Better IDE autocomplete
- Clear function contracts
- Easier for others to use

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

**Apply to**:
- Search inputs
- Filter inputs
- Any text input that triggers expensive operations

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

**Why**:
- Preserves cursor position in inputs
- Maintains scroll position
- Faster re-renders
- Better UX

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

**Why**:
- Easy A/B testing
- Gradual rollout
- Easy rollback if issues arise
- Different features for different contexts

---

## 🏗️ Architecture Patterns

### Dual Interface Strategy
When adding complex features to space-constrained UIs:

**Problem**: Feature clutter in small popup (480x600px)

**Solution**: 
- Keep popup simple (quick actions only)
- Move advanced features to unlimited space (DevTools panel)
- Use feature flags to control rendering

**Implementation**:
```javascript
const FEATURES = {
  popup: { advancedFilters: false, sortableColumns: false },
  devtools: { advancedFilters: true, sortableColumns: true }
};

function render() {
  const features = getFeatures();
  if (features.advancedFilters) {
    renderAdvancedToolbar();
  } else {
    renderSimpleToolbar();
  }
}
```

---

### Performance-Optimized Filtering Pipeline
For complex multi-criteria filtering:

**Pattern**: Sequential filtering with early exits
```javascript
function filteredInteractions() {
  let result = state.interactions;
  
  // Phase 1: Quick filters (early exit if empty)
  if (filters.methods.length > 0) {
    result = result.filter(i => filters.methods.includes(i.method));
    if (result.length === 0) return [];
  }
  
  // Phase 2: More expensive filters
  if (filters.bodySearch) {
    result = result.filter(i => searchBody(i.body, filters.bodySearch));
    if (result.length === 0) return [];
  }
  
  return result;
}
```

**Benefits**:
- Early exit saves processing
- Most selective filters first
- O(n) instead of O(n²)

---

## 📚 Documentation Standards

### Required Documentation Files
For major features, create:

1. **IMPLEMENTATION_STATUS.md**
   - What was implemented
   - Technical details
   - Code statistics

2. **WHAT_WE_BUILT.md**
   - User-friendly summary
   - Feature list
   - How to use

3. **ARCHITECTURE_DESIGN.md** (if applicable)
   - Design decisions
   - Alternative approaches considered
   - Why this approach was chosen

4. **TESTING_CHECKLIST.md** (if applicable)
   - Manual test cases
   - Edge cases
   - Acceptance criteria

---

## 🧪 Testing Requirements

### Manual Testing Checklist
Every PR must include:
- [ ] Happy path testing
- [ ] Edge cases (empty state, 0 items, 1000+ items)
- [ ] Error scenarios
- [ ] Backward compatibility
- [ ] Performance testing (if applicable)
- [ ] Cross-browser testing (if UI changes)
- [ ] Light/dark theme testing (if UI changes)

### Automated Testing (Aspirational)
- Unit tests for business logic
- Integration tests for critical paths
- E2E tests for user workflows

---

## 🚫 Common Mistakes to Avoid

### 1. Hard-coded Values
- ❌ Magic numbers (300, 500, 1000)
- ❌ Hard-coded strings
- ❌ Hard-coded URLs
- ✅ Use constants with descriptive names

### 2. Missing Error Handling
- ❌ Unhandled promise rejections
- ❌ JSON.parse without try-catch
- ❌ Network calls without error handling
- ✅ Wrap all external operations in try-catch

### 3. Performance Anti-patterns
- ❌ Full re-renders on every keystroke
- ❌ No debouncing on search inputs
- ❌ N+1 queries
- ❌ Unnecessary loops
- ✅ Debounce, memoize, optimize

### 4. Breaking Changes Without Notice
- ❌ Changing public APIs
- ❌ Removing features
- ❌ Changing default behavior
- ✅ Deprecate first, then remove

### 5. Insufficient Documentation
- ❌ No comments on complex logic
- ❌ No README updates
- ❌ No migration guides
- ✅ Document everything non-obvious

---

## 📊 PR Review Checklist

### Code Quality
- [ ] No magic numbers - all extracted to constants
- [ ] Error handling for all external input
- [ ] JSDoc comments on public functions
- [ ] Descriptive variable/function names
- [ ] No commented-out code
- [ ] No console.log statements (unless intentional)

### Performance
- [ ] No unnecessary re-renders
- [ ] Debounced user input
- [ ] Optimized loops and filters
- [ ] No memory leaks
- [ ] Tested with large datasets

### Architecture
- [ ] Follows existing patterns
- [ ] Proper separation of concerns
- [ ] Reusable functions
- [ ] Feature flags for experimental features
- [ ] Backward compatible

### Testing
- [ ] Manual testing checklist completed
- [ ] Edge cases tested
- [ ] Error scenarios tested
- [ ] Performance tested
- [ ] Cross-browser tested (if applicable)

### Documentation
- [ ] README updated (if applicable)
- [ ] Implementation docs created
- [ ] JSDoc comments added
- [ ] Migration guide (if breaking changes)
- [ ] Changelog updated

---

## 🎨 Code Style Guide

### Naming Conventions
- **Constants**: `SCREAMING_SNAKE_CASE`
- **Functions**: `camelCase`
- **Variables**: `camelCase`
- **Components**: `PascalCase` (if applicable)
- **Private functions**: `_camelCase` or prefix with underscore

### Function Length
- **Ideal**: < 50 lines
- **Max**: < 150 lines
- **If longer**: Extract helper functions

### File Length
- **Ideal**: < 500 lines
- **Warning**: > 1000 lines (consider splitting)
- **Critical**: > 2000 lines (must split into modules)

---

## 🔄 Continuous Improvement

This document should be updated whenever:
- New patterns emerge
- Common mistakes are identified
- Better practices are discovered
- Team standards evolve

**How to update**:
1. Add new rule with example
2. Update version number
3. Note date of change
4. Reference PR that prompted the change

---

**Remember**: These rules exist to maintain code quality and prevent bugs. When in doubt, prioritize:
1. User experience
2. Performance
3. Maintainability
4. Documentation
