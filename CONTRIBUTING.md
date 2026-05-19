# Contributing to EchoKit

Thank you for considering contributing to EchoKit! This document provides guidelines and best practices.

## 📋 Table of Contents

- [Development Workflow](#development-workflow)
- [PR Checklist](#pr-checklist)
- [Version Bumping](#version-bumping)
- [Testing](#testing)
- [Code Quality Standards](#code-quality-standards)
- [Architecture Guidelines](#architecture-guidelines)

---

## 🔄 Development Workflow

### 1. Create a Feature Branch

```bash
git checkout main
git pull origin main
git checkout -b feature/your-feature-name
```

### 2. Make Your Changes

- Keep changes focused and atomic
- Write clear commit messages
- Follow existing code style

### 3. Test Locally

```bash
# Run smoke tests
python3 tests/smoke_echokit.py

# Load extension unpacked in Chrome
# 1. Open chrome://extensions
# 2. Enable Developer mode
# 3. Click "Load unpacked"
# 4. Select echokit/extension/
```

### 4. Create Pull Request

- Use the PR template
- Fill out all relevant sections
- Link related issues

### 5. Review & Merge

- Address review feedback
- Ensure all CI checks pass
- Squash and merge when approved

---

## ✅ PR Checklist

### Required for ALL PRs

- [ ] ✅ Code reviewed and approved
- [ ] ✅ All CI checks passing
- [ ] ✅ No merge conflicts
- [ ] ✅ Branch is up-to-date with main

### Required for RELEASES (merging to main)

- [ ] 📦 **Version bump is AUTOMATED!** Just use conventional commits:
  - `fix:` for bug fixes → Auto-bumps patch (1.6.4 → 1.6.5)
  - `feat:` for new features → Auto-bumps minor (1.6.4 → 1.7.0)
  - `BREAKING:` in message → Auto-bumps major (1.6.4 → 2.0.0)
- [ ] 📝 CHANGELOG updated (optional but recommended)
- [ ] 🧪 Smoke tests run locally and passing
- [ ] 📚 Documentation updated (if needed)

### Code Quality Checks

- [ ] 🧹 No console.log/debugger statements
- [ ] 📏 Functions are < 50 lines
- [ ] 📄 Files are < 500 lines (see [refactoring issues](https://github.com/ravitejakamalapuram/echokit/issues))
- [ ] 🔒 No hardcoded secrets or sensitive data
- [ ] ✍️ JSDoc comments for new functions (recommended)

---

## 📦 Automated Version Bumping

### ✨ Version Bumping is Now AUTOMATED!

You **NO LONGER need to manually update** `extension/manifest.json`. The version is automatically bumped based on your commit messages.

### How It Works

**Use Conventional Commits** in your commit messages:

| Commit Prefix | Version Bump | Example |
|--------------|--------------|---------|
| `fix:` `bugfix:` `patch:` | **Patch** | 1.6.4 → 1.6.5 |
| `feat:` `feature:` | **Minor** | 1.6.4 → 1.7.0 |
| `BREAKING:` `BREAKING CHANGE:` | **Major** | 1.6.4 → 2.0.0 |

**Examples:**
```bash
git commit -m "fix: Resolve header duplication bug"        # → 1.6.4 to 1.6.5
git commit -m "feat: Add global request headers feature"   # → 1.6.4 to 1.7.0
git commit -m "feat!: Remove deprecated API endpoints"     # → 1.6.4 to 2.0.0
```

### Auto-Release Workflow

When you merge to `main`:

1. ✅ Auto-release **detects commit messages**
2. ✅ **Automatically bumps** version in `manifest.json`
3. ✅ **Commits the version bump** back to main
4. ✅ Creates git tag (e.g., `v1.7.0`)
5. ✅ Triggers release workflow
6. ✅ Creates GitHub Release
7. ✅ Publishes to Chrome Web Store (if configured)

**No manual work required!** Just merge with proper commit messages.

---

## 🧪 Testing

### Run Smoke Tests Locally

**Required before merging any PR:**

```bash
# Install dependencies (first time only)
pip install playwright
python3 -m playwright install chromium
sudo apt-get install -y xvfb xauth  # Linux only

# Run tests
python3 tests/smoke_echokit.py
```

**Note**: Tests are currently disabled in CI due to headless Chrome limitations. Always run locally.

### Manual Testing Checklist

- [ ] Load extension unpacked
- [ ] Test in popup UI
- [ ] Test in DevTools panel
- [ ] Test recording/mocking flow
- [ ] Test all settings dialogs
- [ ] Test new feature functionality
- [ ] Verify no console errors

---

## 🎨 Code Quality Standards

### File Size Limits

- **Maximum file size**: 500 lines
- **Current issues**: `app.js` is 2,700 lines (see [Issue #8](https://github.com/ravitejakamalapuram/echokit/issues/8))
- **Action**: Break large files into modules

### Function Guidelines

- **Maximum function length**: 50 lines
- **Single responsibility**: One function = one task
- **Descriptive names**: Use clear, verb-based names

### Error Handling

- **No empty catch blocks** without TODO comment
- **Log errors with context**: Use consistent logging
- **Validate inputs**: Check message handlers, settings updates
- See [Issue #10](https://github.com/ravitejakamalapuram/echokit/issues/10) for details

### Comments & Documentation

```javascript
/**
 * Apply global request headers to an HTTP request
 * @param {Object} headers - Current request headers
 * @param {string} url - Request URL for pattern matching
 * @returns {Object} Modified headers
 */
function applyRequestHeaders(headers, url) {
  // Implementation
}
```

---

## 🏗️ Architecture Guidelines

### Module Organization

```
extension/
├── background.js     # Service worker, storage, state
├── injected.js       # fetch/XHR hooks in MAIN world
├── content.js        # Message bridge (isolated world)
├── shared/           # Reusable utilities
│   ├── app.js        # UI module (⚠️ needs refactoring)
│   ├── matcher.js    # URL matching logic
│   └── store.js      # IndexedDB wrapper
└── popup/            # Popup UI surface
```

### Known Technical Debt

See detailed refactoring issues:

- [Issue #8](https://github.com/ravitejakamalapuram/echokit/issues/8): Break up `app.js` monolith
- [Issue #9](https://github.com/ravitejakamalapuram/echokit/issues/9): Fix matcher logic duplication
- [Issue #10](https://github.com/ravitejakamalapuram/echokit/issues/10): Add input validation

---

## 🚫 What NOT to Do

- ❌ Don't merge to `main` without bumping version (for releases)
- ❌ Don't skip local testing before creating PR
- ❌ Don't leave console.log statements in production code
- ❌ Don't create files > 500 lines (refactor instead)
- ❌ Don't commit secrets or API keys
- ❌ Don't use `git push --force` on shared branches

---

## 🤝 Getting Help

- **Questions?** Open a [GitHub Discussion](https://github.com/ravitejakamalapuram/echokit/discussions)
- **Bug?** Create an [Issue](https://github.com/ravitejakamalapuram/echokit/issues)
- **Feature idea?** Start with a Discussion first

---

## 📚 Additional Resources

- [README.md](README.md) - Project overview
- [extension/README.md](extension/README.md) - Extension architecture
- [specs/PRD.md](specs/PRD.md) - Product requirements
- [TODO.md](TODO.md) - Project roadmap and backlog

---

**Thank you for contributing to EchoKit!** 🎉
