# Chrome Extension Automated Testing for CI/CD - Research & Recommendations

## Executive Summary

**Goal**: Implement automated regression testing for EchoKit Chrome extension in CI/CD pipeline that blocks PR merges to `develop` unless all tests pass.

**Current State**: 
- ✅ Smoke tests exist (`tests/smoke_echokit.py`) with 24 assertions
- ✅ Tests work perfectly locally
- ❌ Tests disabled in CI due to headless Chrome + service worker limitations

**Recommended Solution**: Multi-tiered approach combining headless-compatible tests with strategic use of headed mode in CI.

---

## 🔍 Research Findings (2026)

### 1. **Testing Frameworks for Chrome Extensions**

#### **Playwright** (Recommended ⭐)
- **Pros**: 
  - Official Chrome extension support
  - Cross-browser testing (Chromium, Firefox, WebKit)
  - Built-in screenshot/video recording
  - Excellent headless support with `channel: 'chromium'`
  - Active development and community
- **Cons**: 
  - Service worker registration can be flaky in pure headless mode
  - Requires persistent context for extensions
- **CI Compatibility**: ✅ Good (with workarounds)

#### **Puppeteer**
- **Pros**: 
  - Direct Chrome DevTools Protocol access
  - Lightweight and fast
  - Good extension support with `new headless` mode
- **Cons**: 
  - Chrome-only (no Firefox/Safari)
  - Less mature extension testing APIs than Playwright
- **CI Compatibility**: ✅ Good

#### **Selenium**
- **Pros**: 
  - Mature and battle-tested
  - Wide browser support
- **Cons**: 
  - Service workers don't terminate in tests (ChromeDriver keeps debugger attached)
  - Slower than modern alternatives
  - More complex setup
- **CI Compatibility**: ⚠️ Fair (service worker limitations)

**Verdict**: **Stick with Playwright** - EchoKit already uses it, and it has the best modern extension support.

---

### 2. **Headless Mode Challenges & Solutions**

#### The Problem
Chrome extensions with service workers have historically struggled in headless mode:
- Service workers don't register reliably
- Extension ID retrieval fails
- Timeouts waiting for extension to load

#### The Solutions (2026)

**Option A: New Chromium Channel (Preferred)**
```python
context = playwright.chromium.launch_persistent_context(
    user_data_dir,
    channel='chromium',  # Key: Uses newer headless implementation
    args=[
        '--disable-extensions-except=/path/to/extension',
        '--load-extension=/path/to/extension'
    ]
)
```
✅ Works in CI  
✅ No display server needed  
✅ Official Playwright recommendation  

**Option B: Xvfb (Virtual Display Server)**
```yaml
- name: Run tests
  run: xvfb-run -a python3 tests/smoke_echokit.py
```
✅ Works reliably  
⚠️ Requires Linux (Ubuntu/Debian)  
⚠️ Slightly slower than pure headless  

**Option C: GitHub Actions with Headed Mode**
```yaml
- uses: browser-actions/setup-chrome@latest
- run: python3 tests/smoke_echokit.py
  env:
    DISPLAY: ':99'
```
Requires additional setup but most reliable.

---

### 3. **Testing Strategy: Test Pyramid**

Following industry best practices (Chrome Extension Testing Guide 2026):

```
        /\
       /10\    E2E Tests (Playwright - Full browser)
      /____\   
     /      \
    /   20%  \  Integration Tests (API + State)
   /__________\
  /            \
 /     70%      \ Unit Tests (Jest/Vitest - Fast)
/________________\
```

#### **Tier 1: Unit Tests (70%)** - NEW
- **What**: Test individual functions without browser
- **Tools**: Jest or Vitest
- **Coverage**: 
  - `shared/app.js` - UI state management
  - `shared/matcher.js` - Request matching logic
  - `shared/json-highlight.js` - JSON formatting
- **Runtime**: < 5 seconds
- **CI**: ✅ Always run

#### **Tier 2: Integration Tests (20%)** - NEW
- **What**: Test component interactions without full browser
- **Tools**: Playwright component testing or mock Chrome APIs
- **Coverage**:
  - Message passing (popup ↔ background ↔ content)
  - Storage operations (IndexedDB mocks)
  - State synchronization
- **Runtime**: 10-20 seconds
- **CI**: ✅ Run on every PR

#### **Tier 3: E2E Tests (10%)** - EXISTING (Enhanced)
- **What**: Full browser tests (current `smoke_echokit.py`)
- **Coverage**:
  - Extension loads and popup renders
  - Recording/mocking toggles work
  - API interception works end-to-end
  - Settings persist
- **Runtime**: 30-60 seconds
- **CI**: ✅ Run on every PR (with fixes)

---

### 4. **Visual Regression Testing**

Prevent "blank screen" bugs that slip through functional tests.

#### **Option A: Percy.io** (Cloud SaaS)
```python
from percy import percy_snapshot
percy_snapshot(browser, "EchoKit Popup - Default State")
```
✅ Easy setup, hosted comparison  
✅ Works in CI out of box  
✅ PR comments with visual diffs  
❌ Costs $249+/month for private repos  

#### **Option B: Chromatic** (Storybook-focused)
- Best for component libraries
- Not ideal for full extension UI
- ❌ Not recommended for EchoKit

#### **Option C: Playwright Built-in**
```python
await page.screenshot(path='baseline.png')
assert compare_images('baseline.png', 'current.png', threshold=0.01)
```
✅ Free and self-hosted  
✅ Full control over baselines  
❌ Manual baseline management  
❌ No automatic PR comments  

**Recommendation**: Start with **Playwright built-in** visual comparison (free), evaluate Percy after 3 months if needed.

---

## 📋 Recommended Implementation Plan

### Phase 1: Fix CI/CD Pipeline (Week 1) ⭐ **PRIORITY**

**Objective**: Get existing smoke tests running in CI

**Tasks**:
1. Update `tests/smoke_echokit.py` to use `channel='chromium'`
2. Add fallback to xvfb if chromium channel fails
3. Enable smoke test job in `.github/workflows/test.yml`
4. Add branch protection rule: require `smoke` job to pass
5. Test on a feature branch → PR → verify tests block merge

**Acceptance Criteria**:
- ✅ Smoke tests pass in GitHub Actions
- ✅ Failed tests block PR merge to `develop`
- ✅ Runtime < 2 minutes

**Files to Modify**:
- `tests/smoke_echokit.py` (add channel='chromium')
- `.github/workflows/test.yml` (remove `if: false`, update setup)
- `.github/BRANCH_PROTECTION_RULES.md` (document new rule)

### Phase 2: Add Unit Tests (Week 2-3)

**Objective**: 70% test coverage with fast unit tests

**Tasks**:
1. Set up Vitest (modern, fast, ESM-native)
2. Write tests for core modules:
   - `shared/matcher.js` - 20 test cases
   - `shared/app.js` - state management tests
   - `shared/json-highlight.js` - formatting tests
3. Add to CI pipeline (runs before smoke tests)
4. Aim for 70%+ coverage

**New Files**:
- `tests/unit/matcher.test.js`
- `tests/unit/app.test.js`
- `vitest.config.js`
- `.github/workflows/test.yml` (add unit test step)

### Phase 3: Visual Regression (Week 4)

**Objective**: Catch UI regressions automatically

**Tasks**:
1. Add screenshot capture to smoke tests
2. Store baseline screenshots in `tests/baselines/`
3. Compare screenshots on each test run
4. Fail test if diff > 2% pixels
5. Add baseline update command for intentional UI changes

**Implementation**:
```python
# In smoke_echokit.py
def test_popup_renders():
    popup_page.goto(popup_url)
    popup_page.wait_for_selector('[data-testid="echokit-app"]')
    
    # Visual regression check
    actual = popup_page.screenshot()
    baseline = Path('tests/baselines/popup-default.png')
    diff = compare_images(baseline, actual)
    assert diff < 0.02, f"Visual diff {diff:.2%} exceeds threshold"
```

### Phase 4: Integration Tests (Future)

**Objective**: Test message passing and Chrome API interactions

**Tasks**:
- Mock Chrome APIs (storage, runtime, tabs)
- Test background ↔ popup communication
- Test background ↔ content script communication
- Test declarativeNetRequest rule management

---

## 🔧 Immediate Action Items

### 1. Update `tests/smoke_echokit.py`

**Change Required**:
```python
# Current (line ~100-120):
context = p.chromium.launch_persistent_context(
    "",
    headless=False,  # ❌ Doesn't work in CI
    args=[...]
)

# Updated:
context = p.chromium.launch_persistent_context(
    "",
    channel='chromium',  # ✅ Enables headless extension support
    headless=True,       # ✅ Works in CI
    args=[...]
)
```

### 2. Update `.github/workflows/test.yml`

**Remove the `if: false` gate**:
```yaml
smoke:
  runs-on: ubuntu-latest
  if: false  # ❌ Remove this line
```

**Update to**:
```yaml
smoke:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-python@v5
      with: { python-version: '3.11' }

    - name: Install Playwright
      run: |
        pip install playwright
        python -m playwright install chromium

    - name: Run smoke tests
      run: python3 tests/smoke_echokit.py
```

### 3. Add Branch Protection Rule

**GitHub Settings** → **Branches** → **Branch protection rules**:

Rule for `develop`:
- ✅ Require status checks to pass before merging
  - ✅ smoke (from test.yml)
  - ✅ validate (from test.yml)
- ✅ Require branches to be up to date
- ⚠️ Do not allow bypass (even admins must pass tests)

---

## 🎯 Success Metrics

Track these to measure testing effectiveness:

| Metric | Current | Target (1 month) |
|--------|---------|------------------|
| Tests passing in CI | 0% (disabled) | 100% |
| Test runtime in CI | N/A | < 2 minutes |
| PRs blocked by tests | 0 | All failing PRs |
| Blank screen bugs in prod | 1+ | 0 |
| Test coverage | ~5% (E2E only) | 40%+ (unit + E2E) |
| Time to debug failures | Hours | < 10 minutes |

---

## 📚 Additional Resources

### Official Documentation
- [Playwright Chrome Extensions](https://playwright.dev/docs/chrome-extensions) - Official guide
- [Chrome Extension E2E Testing](https://developer.chrome.com/docs/extensions/how-to/test/end-to-end-testing) - Google's official guide
- [Puppeteer Extension Testing](https://developer.chrome.com/docs/extensions/how-to/test/puppeteer) - Alternative approach

### Community Resources
- [Extension.js Playwright Guide](https://extension.js.org/docs/workflows/playwright-e2e) - Modern framework examples
- [Contentsquare E2E Blog](https://engineering.contentsquare.com/2024/automating-e2e-tests-chrome-extensions/) - Real-world case study
- [Playwright Extension Testing Template](https://github.com/kelseyaubrecht/playwright-chrome-extension-testing-template) - Working example

### Testing Tools
- **Playwright**: https://playwright.dev
- **Vitest**: https://vitest.dev (for unit tests)
- **Percy**: https://percy.io (visual testing SaaS)
- **Chromatic**: https://chromatic.com (Storybook visual testing)

---

## 🚨 Known Gotchas & Troubleshooting

### Issue 1: "Failed to get extension ID"
**Cause**: Extension doesn't have a service worker
**Fix**: Ensure `manifest.json` includes:
```json
"background": {
  "service_worker": "background.js"
}
```

### Issue 2: Service worker timeout in CI
**Cause**: Headless mode doesn't support extensions (old headless)
**Fix**: Use `channel: 'chromium'` in launch config

### Issue 3: Extension loads but popup is blank
**Cause**: CSP violations or missing resources
**Fix**:
1. Check browser console for errors
2. Verify all resources in `web_accessible_resources`
3. Use `headless: False` locally to debug

### Issue 4: Tests flaky in CI but work locally
**Cause**: Race conditions, timing issues
**Fix**:
1. Use explicit waits: `page.wait_for_selector()` instead of `time.sleep()`
2. Increase timeout: `timeout=10000` (10 seconds)
3. Wait for service worker: `context.wait_for_event('serviceworker')`

### Issue 5: Tests pass but PR still merges
**Cause**: Branch protection not configured
**Fix**: Enable required status checks in GitHub settings

---

## 🏁 Quick Start Guide

**To run tests locally**:
```bash
# Install dependencies
pip install playwright
python -m playwright install chromium

# Run all tests
python3 tests/smoke_echokit.py

# Run with headed browser (for debugging)
HEADLESS=false python3 tests/smoke_echokit.py
```

**To add a new test case**:
```python
# In tests/smoke_echokit.py

def step(name, ok, detail=''):
    # ... existing code ...

# Add your test
resp = popup_page.evaluate("window.doFetch('/api/new-endpoint')")
step("NEW: New endpoint captured",
     resp['status'] == 200 and 'expected_field' in resp['body'])
```

**To update visual baselines** (after intentional UI changes):
```bash
# Take new baseline screenshots
python3 tests/smoke_echokit.py --update-baselines

# Review changes
git diff tests/baselines/

# Commit new baselines
git add tests/baselines/
git commit -m "chore: update visual test baselines for new UI"
```

---

## 🎬 Next Steps

1. **Immediate** (Today):
   - Review this document with team
   - Decide on Phase 1 timeline
   - Assign owner for CI/CD fixes

2. **This Week**:
   - Implement Phase 1 (fix CI pipeline)
   - Test on feature branch
   - Enable branch protection

3. **This Month**:
   - Implement Phase 2 (unit tests)
   - Reach 40%+ test coverage
   - Zero blank screen bugs

4. **This Quarter**:
   - Implement Phase 3 (visual regression)
   - Implement Phase 4 (integration tests)
   - Achieve 70%+ test coverage

---

## 📞 Questions?

**Q: Will this slow down our development velocity?**
A: Initially ~10 minutes to set up, then saves hours debugging production issues. Net positive after first week.

**Q: What if tests are flaky?**
A: Start with deterministic tests (syntax, structure). Add E2E tests carefully with proper waits. Aim for <1% flake rate.

**Q: Can we skip tests for hotfixes?**
A: No. Tests are especially important for hotfixes. Use feature flags to disable risky features instead.

**Q: What about manual testing?**
A: Automated tests complement (not replace) manual testing. Still manually test before releases.

**Q: How do we handle breaking changes to the test suite?**
A: Update tests in same PR as code changes. Never merge broken tests to `develop`.

---

**Last Updated**: 2026-05-12
**Document Owner**: Development Team
**Related Docs**: `AUTOMATED_TESTING.md`, `CONTRIBUTING.md`, `.github/workflows/test.yml`
