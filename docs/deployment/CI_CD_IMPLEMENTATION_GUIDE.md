# EchoKit CI/CD Testing Implementation Guide

## 🎯 Goal
Enable automated regression testing in GitHub Actions that **blocks merges to `develop`** unless all tests pass.

---

## ✅ Phase 1: Enable Smoke Tests in CI (Priority)

**Estimated Time**: 2-3 hours  
**Risk**: Low

### Step 1: Update Smoke Test for Headless Mode

Edit `tests/smoke_echokit.py`:

**Find this section** (around line 102):
```python
with sync_playwright() as p:
    context = p.chromium.launch_persistent_context(
        "",
        headless=False,
        args=[
            f"--disable-extensions-except={EXT_PATH}",
            f"--load-extension={EXT_PATH}",
        ]
    )
```

**Replace with**:
```python
with sync_playwright() as p:
    # Use chromium channel for better headless extension support
    # Falls back to headed mode if HEADLESS env var is set to 'false'
    headless_mode = os.getenv('HEADLESS', 'true').lower() == 'true'
    
    launch_kwargs = {
        'args': [
            f"--disable-extensions-except={EXT_PATH}",
            f"--load-extension={EXT_PATH}",
        ]
    }
    
    if headless_mode:
        # Use chromium channel for headless CI support
        launch_kwargs['channel'] = 'chromium'
        launch_kwargs['headless'] = True
        print("🤖 Running in HEADLESS mode (CI-compatible)")
    else:
        # Use regular Chrome for local debugging
        launch_kwargs['headless'] = False
        print("👁️  Running in HEADED mode (debugging)")
    
    context = p.chromium.launch_persistent_context("", **launch_kwargs)
```

**Why this change?**
- `channel='chromium'` enables the new headless mode that supports extensions
- `HEADLESS` env var lets you debug locally with `HEADLESS=false python3 tests/smoke_echokit.py`
- Works in both CI and local environments

### Step 2: Update GitHub Actions Workflow

Edit `.github/workflows/test.yml`:

**Find this section** (around line 18-22):
```yaml
smoke:
  runs-on: ubuntu-latest
  # Skip extension tests in CI - they require non-headless browser
  # Run them locally before merging: python3 tests/smoke_echokit.py
  if: false  # TODO: Re-enable when headless extension support improves
```

**Replace with**:
```yaml
smoke:
  runs-on: ubuntu-latest
  # Smoke tests now run in headless mode using chromium channel
  env:
    FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true
```

**Update the steps section** (around line 26-53):
```yaml
steps:
  - uses: actions/checkout@v4
  
  - uses: actions/setup-python@v5
    with: 
      python-version: '3.11'
  
  - name: Install Playwright
    run: |
      pip install playwright
      python -m playwright install chromium
  
  - name: Run smoke tests (headless)
    run: python3 tests/smoke_echokit.py
    env:
      HEADLESS: 'true'
  
  - name: Upload test artifacts on failure
    if: failure()
    uses: actions/upload-artifact@v4
    with:
      name: test-results
      path: |
        test-results/
        screenshots/
      retention-days: 7
```

**Key improvements**:
- Removed xvfb and dbus setup (not needed with chromium channel)
- Simplified to just install Playwright and run tests
- Added artifact upload for debugging failures
- Explicitly set `HEADLESS=true`

### Step 3: Add Branch Protection Rule

#### Option A: Via GitHub UI
1. Go to repository **Settings** → **Branches**
2. Click **Add rule** for `develop` branch
3. Configure:
   - ✅ Require status checks to pass before merging
   - Search and select: `smoke` and `validate`
   - ✅ Require branches to be up to date before merging
   - ✅ Do not allow bypassing the above settings
4. Click **Create** or **Save changes**

#### Option B: Via GitHub CLI
```bash
gh api repos/:owner/:repo/branches/develop/protection \
  --method PUT \
  --field required_status_checks='{"strict":true,"contexts":["smoke","validate"]}' \
  --field enforce_admins=true \
  --field required_pull_request_reviews='{"required_approving_review_count":1}'
```

### Step 4: Test the Setup

**Create a test branch**:
```bash
git checkout -b test/ci-smoke-tests
```

**Make a trivial change**:
```bash
echo "# CI Test" >> README.md
git add README.md
git commit -m "test: verify CI smoke tests work"
git push origin test/ci-smoke-tests
```

**Create a PR** targeting `develop`:
1. Go to GitHub → **Pull Requests** → **New pull request**
2. Base: `develop`, Compare: `test/ci-smoke-tests`
3. Create PR
4. Watch the **Checks** tab - you should see:
   - ✅ `validate` job (fast)
   - ✅ `smoke` job (slower, ~1-2 min)

**Verify**:
- [ ] Both jobs pass
- [ ] PR shows "All checks have passed"
- [ ] "Merge pull request" button is enabled

**Test failure scenario**:
```bash
# Break the extension
echo "syntax error!" >> extension/background.js
git add extension/background.js
git commit -m "test: verify CI catches broken code"
git push
```

**Verify**:
- [ ] `validate` job fails (syntax check)
- [ ] PR shows "Some checks were not successful"
- [ ] "Merge pull request" button is blocked

**Clean up**:
```bash
git checkout develop
git branch -D test/ci-smoke-tests
git push origin --delete test/ci-smoke-tests
```

---

## 🧪 Phase 2: Add Unit Tests (Optional but Recommended)

**Estimated Time**: 1-2 days  
**Risk**: Low  
**Benefit**: 10x faster feedback (seconds vs minutes)

### Step 1: Install Vitest

```bash
# In project root
npm init -y  # If no package.json exists
npm install -D vitest @vitest/ui
```

### Step 2: Create Vitest Config

Create `vitest.config.js`:
```javascript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['extension/shared/**/*.js'],
      exclude: ['extension/shared/json-highlight.js'] // External library
    }
  }
});
```

### Step 3: Create Sample Unit Test

Create `tests/unit/matcher.test.js`:
```javascript
import { describe, it, expect } from 'vitest';

// Mock implementation - replace with actual import when ready
function matchesRequest(recorded, incoming, mode = 'strict') {
  // Simplified matcher logic for demonstration
  if (mode === 'strict') {
    return recorded.url === incoming.url && 
           recorded.method === incoming.method;
  }
  // Add other match modes
  return false;
}

describe('Request Matcher', () => {
  describe('Strict Mode', () => {
    it('matches identical requests', () => {
      const recorded = { url: '/api/users', method: 'GET' };
      const incoming = { url: '/api/users', method: 'GET' };
      expect(matchesRequest(recorded, incoming, 'strict')).toBe(true);
    });

    it('rejects different URLs', () => {
      const recorded = { url: '/api/users', method: 'GET' };
      const incoming = { url: '/api/posts', method: 'GET' };
      expect(matchesRequest(recorded, incoming, 'strict')).toBe(false);
    });

    it('rejects different methods', () => {
      const recorded = { url: '/api/users', method: 'GET' };
      const incoming = { url: '/api/users', method: 'POST' };
      expect(matchesRequest(recorded, incoming, 'strict')).toBe(false);
    });
  });

  describe('Ignore Query Mode', () => {
    it('matches URLs with different query params', () => {
      const recorded = { url: '/api/users?page=1', method: 'GET' };
      const incoming = { url: '/api/users?page=2', method: 'GET' };
      expect(matchesRequest(recorded, incoming, 'ignore-query')).toBe(true);
    });
  });
});
```

### Step 4: Add Test Script to package.json

Edit `package.json`:
```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest run --coverage"
  }
}
```

### Step 5: Run Tests Locally

```bash
# Run once
npm test

# Watch mode (auto-rerun on file changes)
npm run test:watch

# Coverage report
npm run test:coverage
```

### Step 6: Add to GitHub Actions

Edit `.github/workflows/test.yml`, add this job BEFORE `smoke`:

```yaml
unit:
  runs-on: ubuntu-latest
  env:
    FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true
  steps:
    - uses: actions/checkout@v4

    - uses: actions/setup-node@v4
      with:
        node-version: '20'
        cache: 'npm'

    - name: Install dependencies
      run: npm ci

    - name: Run unit tests
      run: npm test

    - name: Upload coverage
      if: always()
      uses: actions/upload-artifact@v4
      with:
        name: coverage-report
        path: coverage/
        retention-days: 30
```

### Step 7: Update Branch Protection

Add `unit` to required status checks:
- Go to Settings → Branches → `develop` rule
- Add `unit` to required status checks
- Now both `unit` and `smoke` must pass

---

## 📸 Phase 3: Visual Regression Testing

**Estimated Time**: 4-6 hours
**Risk**: Medium
**Benefit**: Catches blank screen bugs automatically

### Implementation

Create `tests/visual_regression.py`:

```python
"""
Visual regression testing for EchoKit extension.
Compares screenshots against baseline images to detect UI changes.
"""

import sys
from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image, ImageChops
import math

EXT_PATH = str(Path(__file__).parent.parent / "extension")
BASELINE_DIR = Path(__file__).parent / "baselines"
BASELINE_DIR.mkdir(exist_ok=True)

def compare_images(baseline_path, current_path, threshold=0.02):
    """
    Compare two images and return similarity score.
    Returns: float between 0 (identical) and 1 (completely different)
    """
    baseline = Image.open(baseline_path).convert('RGB')
    current = Image.open(current_path).convert('RGB')

    # Ensure same size
    if baseline.size != current.size:
        return 1.0  # Completely different if sizes don't match

    # Calculate pixel difference
    diff = ImageChops.difference(baseline, current)
    diff_stat = diff.convert('L')
    diff_pixels = sum(diff_stat.getdata())
    total_pixels = baseline.size[0] * baseline.size[1] * 255

    return diff_pixels / total_pixels if total_pixels > 0 else 0

def main():
    update_baselines = '--update-baselines' in sys.argv
    results = {'passed': [], 'failed': []}

    with sync_playwright() as p:
        context = p.chromium.launch_persistent_context(
            "",
            channel='chromium',
            headless=True,
            args=[
                f"--disable-extensions-except={EXT_PATH}",
                f"--load-extension={EXT_PATH}",
            ]
        )

        # Wait for extension to load
        service_workers = context.service_workers
        if not service_workers:
            service_workers = [context.wait_for_event('serviceworker')]

        extension_id = service_workers[0].url.split("/")[2]

        # Test 1: Popup Default State
        popup_url = f"chrome-extension://{extension_id}/popup/popup.html"
        popup_page = context.new_page()
        popup_page.goto(popup_url)
        popup_page.wait_for_selector('[data-testid="echokit-app"]', timeout=5000)

        screenshot_path = Path('/tmp/popup-current.png')
        popup_page.screenshot(path=screenshot_path)

        baseline_path = BASELINE_DIR / 'popup-default.png'

        if update_baselines:
            screenshot_path.rename(baseline_path)
            print(f"✅ Updated baseline: {baseline_path}")
        else:
            if not baseline_path.exists():
                print(f"❌ Baseline missing: {baseline_path}")
                print(f"   Run with --update-baselines to create it")
                return 1

            diff_score = compare_images(baseline_path, screenshot_path)
            threshold = 0.02  # 2% difference allowed

            if diff_score <= threshold:
                print(f"✅ Visual test passed (diff: {diff_score:.2%})")
                results['passed'].append('popup-default')
            else:
                print(f"❌ Visual test failed (diff: {diff_score:.2%} > {threshold:.2%})")
                results['failed'].append('popup-default')
                # Save diff image for debugging
                diff_path = Path('/tmp/popup-diff.png')
                baseline_img = Image.open(baseline_path)
                current_img = Image.open(screenshot_path)
                diff_img = ImageChops.difference(baseline_img, current_img)
                diff_img.save(diff_path)
                print(f"   Diff saved to: {diff_path}")

        context.close()

    # Summary
    if not update_baselines:
        print(f"\n{'='*50}")
        print(f"Passed: {len(results['passed'])}, Failed: {len(results['failed'])}")
        return 1 if results['failed'] else 0

    return 0

if __name__ == "__main__":
    sys.exit(main())
```

### Add to CI

Update `.github/workflows/test.yml`:

```yaml
visual:
  runs-on: ubuntu-latest
  needs: smoke  # Run after smoke tests pass
  steps:
    - uses: actions/checkout@v4

    - uses: actions/setup-python@v5
      with: { python-version: '3.11' }

    - name: Install dependencies
      run: |
        pip install playwright pillow
        python -m playwright install chromium

    - name: Run visual regression tests
      run: python3 tests/visual_regression.py

    - name: Upload visual diffs on failure
      if: failure()
      uses: actions/upload-artifact@v4
      with:
        name: visual-diffs
        path: /tmp/popup-diff.png
```

---

## 🎯 Testing Checklist

Before merging to `develop`, verify:

**Automated Checks**:
- [ ] `validate` job passes (syntax, structure)
- [ ] `smoke` job passes (E2E tests)
- [ ] `unit` job passes (if implemented)
- [ ] `visual` job passes (if implemented)

**Manual Checks**:
- [ ] Load extension locally and verify core features
- [ ] Test recording on 2-3 different websites
- [ ] Test mocking works correctly
- [ ] Test settings persist across browser restart

**Code Quality**:
- [ ] No `console.log` or `debugger` statements
- [ ] Functions are < 50 lines
- [ ] No hardcoded secrets

---

## 🚨 Troubleshooting

### "Tests pass locally but fail in CI"

**Check 1**: Timing issues
```python
# ❌ Bad (race condition)
page.goto(url)
page.click('button')

# ✅ Good (explicit wait)
page.goto(url)
page.wait_for_selector('button', state='visible')
page.click('button')
```

**Check 2**: Extension ID differences
```python
# ❌ Bad (assumes fixed ID)
popup_url = 'chrome-extension://abcdefg/popup.html'

# ✅ Good (dynamic ID)
extension_id = service_workers[0].url.split("/")[2]
popup_url = f'chrome-extension://{extension_id}/popup.html'
```

### "Service worker doesn't register in CI"

**Solution**: Ensure using `channel='chromium'`:
```python
context = p.chromium.launch_persistent_context(
    "",
    channel='chromium',  # ← Critical for CI
    headless=True,
    args=[...]
)
```

### "Visual tests are flaky"

**Solution 1**: Increase difference threshold
```python
threshold = 0.05  # Allow 5% difference instead of 2%
```

**Solution 2**: Disable animations before screenshot
```javascript
await page.addStyleTag({
  content: '* { animation: none !important; transition: none !important; }'
});
```

---

## ✅ Success Criteria

**Phase 1 Complete When**:
- ✅ CI runs smoke tests on every PR
- ✅ Failed tests block merge to `develop`
- ✅ Test runtime < 2 minutes
- ✅ Zero false positives for 1 week

**Phase 2 Complete When**:
- ✅ Unit tests cover 40%+ of code
- ✅ Unit tests run in < 10 seconds
- ✅ Unit tests added to required checks

**Phase 3 Complete When**:
- ✅ Visual tests detect UI changes
- ✅ Zero blank screen bugs in production
- ✅ Baseline images committed to git

---

**Next**: See `CHROME_EXTENSION_CI_CD_TESTING_RESEARCH.md` for detailed research and alternatives.
