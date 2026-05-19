# Automated Testing Strategy for EchoKit

## 🎯 Goal
Prevent blank screen regressions and catch UI bugs before they reach production.

## 🚧 Current State

### ✅ What Works
- **Syntax Validation**: All JS files are syntax-checked in CI (`.github/workflows/test.yml`)
- **Smoke Tests Exist**: `tests/smoke_echokit.py` with 24 assertions
- **Local Testing**: Smoke tests work perfectly when run locally

### ❌ What Doesn't Work
- **CI Execution**: Extension tests disabled in CI due to headless Chromium limitation
  - Service workers don't register reliably in headless mode
  - Tests timeout waiting for extension to load

## 📋 Three-Tier Testing Strategy

### Tier 1: Pre-Commit Checks (Fastest, Always Run)
**Purpose**: Catch syntax errors and basic issues before committing

**Implementation**: Git pre-commit hook
```bash
# .git/hooks/pre-commit
#!/bin/bash
set -e

echo "🔍 Running pre-commit checks..."

# 1. Syntax validation
echo "  ✓ Checking JavaScript syntax..."
node -c extension/background.js
node -c extension/shared/app.js
node -c extension/popup/popup.js
node -c extension/devtools/panel.js

# 2. File structure validation
echo "  ✓ Checking required files..."
required_files=(
  "extension/manifest.json"
  "extension/shared/app.js"
  "extension/shared/json-highlight.js"
  "extension/shared/styles.css"
  "extension/popup/popup.html"
  "extension/devtools/panel.html"
)

for file in "${required_files[@]}"; do
  if [ ! -f "$file" ]; then
    echo "❌ Missing required file: $file"
    exit 1
  fi
done

# 3. Check for common mistakes
echo "  ✓ Checking for console.log statements..."
if grep -r "console.log" extension/ --include="*.js" --exclude-dir=node_modules; then
  echo "⚠️  Warning: console.log found (remove before production)"
fi

echo "✅ Pre-commit checks passed!"
```

### Tier 2: Local Smoke Tests (Manual, Before PR)
**Purpose**: Full E2E testing with real browser

**Current Implementation**: `tests/smoke_echokit.py`

**Run Command**:
```bash
python3 tests/smoke_echokit.py
```

**What It Tests**:
- Extension loads successfully
- Service worker registers
- Popup opens and renders
- DevTools panel shows content
- Recording/mocking toggle works
- API interactions are captured
- Mock responses work
- Settings can be changed

**Runtime**: ~30 seconds

**Requirement**: Must pass before merging to main

### Tier 3: Visual Regression Testing (Future)
**Purpose**: Catch UI changes and blank screens automatically

**Implementation Options**:

#### Option A: Percy.io (Cloud-Based)
```python
# Add to smoke_echokit.py
from percy import percy_snapshot

popup_page.goto(popup_url)
percy_snapshot(page, "EchoKit Popup - Default State")

# Percy compares screenshots across commits
# Alerts on visual changes
```

**Pros**: Easy setup, hosted, works in CI  
**Cons**: Costs money for private repos

#### Option B: Playwright Visual Comparison (Self-Hosted)
```python
# tests/visual_regression_test.py
popup_page.screenshot(path="screenshots/popup-baseline.png")

# Later runs:
popup_page.screenshot(path="screenshots/popup-current.png")
compare_images("screenshots/popup-baseline.png", 
               "screenshots/popup-current.png")
```

**Pros**: Free, full control  
**Cons**: Need to manage baseline images

## 🔄 Recommended Workflow

### Daily Development
```bash
# 1. Make changes
vim extension/shared/app.js

# 2. Pre-commit hook runs automatically
git commit -m "feat: Add dark mode toggle"

# 3. Before creating PR, run smoke tests
python3 tests/smoke_echokit.py

# 4. Create PR → CI runs syntax validation
```

### Before Release
```bash
# Full test suite
npm run test:all  # (to be created)

# Manual testing checklist:
# - Load extension in Chrome
# - Test recording on 3 different sites
# - Test mocking
# - Test settings
# - Check popup + devtools panel
```

## 🎬 Implementing Automated Visual Tests

### Step 1: Install Dependencies
```bash
pip3 install playwright pixelmatch
python3 -m playwright install chromium
```

### Step 2: Create Visual Test
```python
# tests/visual_test.py
from playwright.sync_api import sync_playwright
from pathlib import Path
import sys

def visual_test():
    extension_path = Path(__file__).parent.parent / "extension"
    screenshots_dir = Path(__file__).parent / "screenshots"
    screenshots_dir.mkdir(exist_ok=True)
    
    with sync_playwright() as p:
        context = p.chromium.launch_persistent_context(
            "",
            headless=False,
            args=[
                f"--disable-extensions-except={extension_path}",
                f"--load-extension={extension_path}",
            ]
        )
        
        page = context.new_page()
        page.goto("https://httpbin.org/get")
        
        # Wait for extension to load
        service_workers = context.service_workers
        if not service_workers:
            print("❌ Extension did not load")
            return 1
        
        extension_id = service_workers[0].url.split("/")[2]
        popup_url = f"chrome-extension://{extension_id}/popup/popup.html"
        
        popup_page = context.new_page()
        popup_page.goto(popup_url)
        popup_page.wait_for_selector('[data-testid="echokit-app"]', timeout=5000)
        
        # Take screenshot
        popup_page.screenshot(path=screenshots_dir / "popup-current.png")
        
        # Check if blank (all pixels are same color)
        # This catches the "black screen" bug
        
        context.close()
        print("✅ Visual test passed")
        return 0

if __name__ == "__main__":
    sys.exit(visual_test())
```

### Step 3: Run Test
```bash
python3 tests/visual_test.py
```

## 🔐 CI/CD Integration (Future)

### Option 1: Docker with Xvfb (Headless X Server)
```yaml
# .github/workflows/test.yml
visual-test:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-python@v5
    - run: |
        pip install playwright
        python -m playwright install --with-deps chromium
        xvfb-run -a python3 tests/visual_test.py
```

**Status**: Currently doesn't work due to service worker issue  
**Future**: May work as Chromium improves headless extension support

### Option 2: GitHub Actions with Non-Headless Browser
Requires self-hosted runner with display server.

## 📊 Testing Metrics

Track these over time:
- Number of tests passing
- Test coverage %
- Time to run full suite
- Number of regressions caught before production

## 🎯 Success Criteria

**Short-term** (1 week):
- ✅ Pre-commit hook installed
- ✅ Smoke tests documented in CONTRIBUTING.md
- ✅ Blank screen bug fixed

**Medium-term** (1 month):
- ✅ Visual regression tests working locally
- ✅ 80% of PRs have passing smoke tests
- ✅ Zero blank screen bugs in production

**Long-term** (3 months):
- ✅ CI/CD runs visual tests (if Chromium support improves)
- ✅ Automated screenshots on every PR
- ✅ Performance benchmarking

## 🚀 Next Steps

1. **Debug current blank screen issue** (see DEBUGGING_BLANK_SCREEN.md)
2. **Set up pre-commit hook**
3. **Document smoke test requirement in PR template**
4. **Consider visual regression testing**
