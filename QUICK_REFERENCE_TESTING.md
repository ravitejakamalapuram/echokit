# EchoKit Testing - Quick Reference Card

## ⚡ TL;DR

**Goal**: Block bad code from merging to `develop` using automated tests

**Solution**: Fix existing Playwright tests to run in CI headless mode

**Time**: 2-3 hours

**Files to change**: 2 files (`tests/smoke_echokit.py`, `.github/workflows/test.yml`)

---

## 🎯 Phase 1: Minimum Changes (PRIORITY)

### Change 1: `tests/smoke_echokit.py` (Line ~102)

```python
# Before:
context = p.chromium.launch_persistent_context(
    "",
    headless=False,  # ❌ Doesn't work in CI
    args=[...]
)

# After:
context = p.chromium.launch_persistent_context(
    "",
    channel='chromium',  # ✅ Enables headless extensions
    headless=True,
    args=[...]
)
```

### Change 2: `.github/workflows/test.yml` (Line ~22)

```yaml
# Before:
smoke:
  runs-on: ubuntu-latest
  if: false  # ❌ Tests disabled

# After:
smoke:
  runs-on: ubuntu-latest
  # ✅ Tests enabled
```

### Change 3: GitHub Settings (UI)

Settings → Branches → `develop` → Branch protection rules:
- ✅ Require status checks: `smoke`, `validate`
- ✅ Require branches up to date
- ✅ Do not allow bypassing

---

## 🧪 Testing Commands

```bash
# Run locally (headed mode for debugging)
HEADLESS=false python3 tests/smoke_echokit.py

# Run locally (headless, same as CI)
python3 tests/smoke_echokit.py

# Run with Playwright UI inspector
PWDEBUG=1 python3 tests/smoke_echokit.py

# Install dependencies
pip install playwright
python -m playwright install chromium
```

---

## ✅ Verification Checklist

After implementing Phase 1:

**Local Testing** (before pushing):
- [ ] `python3 tests/smoke_echokit.py` passes
- [ ] Takes < 2 minutes
- [ ] No errors in output

**CI Testing** (after pushing):
- [ ] Create test PR to `develop`
- [ ] `validate` job passes (~10s)
- [ ] `smoke` job passes (~90s)
- [ ] PR shows "All checks have passed"
- [ ] Merge button is enabled

**Failure Testing**:
- [ ] Break extension (add syntax error)
- [ ] Push and verify `validate` job fails
- [ ] Verify PR is blocked from merging
- [ ] Fix error and verify tests pass again

---

## 🐛 Common Issues & Fixes

### Issue: "Extension service worker not found"

**Fix**: Add explicit wait
```python
# In smoke_echokit.py
sw = context.wait_for_event('serviceworker', timeout=30000)
```

### Issue: "Tests pass locally but fail in CI"

**Fix**: Use `channel='chromium'` for headless compatibility
```python
context = p.chromium.launch_persistent_context(
    "",
    channel='chromium',  # ← Add this
    headless=True,
    args=[...]
)
```

### Issue: "Merge button still enabled despite test failures"

**Fix**: Check branch protection rules
1. GitHub → Settings → Branches
2. Edit `develop` rule
3. Ensure `smoke` is in required status checks
4. Save changes

### Issue: "Tests are flaky (sometimes pass, sometimes fail)"

**Fix**: Add explicit waits instead of sleeps
```python
# ❌ Bad
time.sleep(1)
page.click('button')

# ✅ Good
page.wait_for_selector('button', state='visible')
page.click('button')
```

---

## 📊 Expected Results

### Current State (Before)
- ❌ Tests disabled in CI
- ❌ Bad code can merge to `develop`
- ❌ Blank screen bugs reach production

### Target State (After Phase 1)
- ✅ Tests run on every PR
- ✅ Failed tests block merge
- ✅ Zero blank screen bugs in prod

### Metrics (1 Month)
- Test runtime: < 2 minutes
- Flakiness: < 5%
- PRs blocked: 2-3 (expected)
- Production bugs: 0 (vs 1+ before)

---

## 🚀 Beyond Phase 1 (Optional)

### Phase 2: Unit Tests (1-2 days)
- Add Vitest for fast unit tests
- Test `shared/matcher.js`, `shared/app.js`
- Target: 40%+ code coverage
- Runtime: < 10 seconds

### Phase 3: Visual Regression (4-6 hours)
- Screenshot comparison
- Catches "blank screen" bugs
- Runtime: +30 seconds

---

## 📞 Help & Resources

**Documentation**:
- Full research: `CHROME_EXTENSION_CI_CD_TESTING_RESEARCH.md`
- Step-by-step: `CI_CD_IMPLEMENTATION_GUIDE.md`
- Framework comparison: `TESTING_FRAMEWORK_COMPARISON.md`
- Overview: `TESTING_RESEARCH_SUMMARY.md`

**External Resources**:
- [Playwright Chrome Extensions](https://playwright.dev/docs/chrome-extensions)
- [Chrome Testing Guide](https://developer.chrome.com/docs/extensions/how-to/test)

**Getting Stuck?**:
1. Check troubleshooting section above
2. Run with `PWDEBUG=1` to debug
3. Try `headless=False` locally to see what's happening
4. Review `CI_CD_IMPLEMENTATION_GUIDE.md` troubleshooting

---

## 🎬 Implementation Steps (30 minutes)

1. **Update smoke test** (5 min)
   - Edit `tests/smoke_echokit.py`
   - Add `channel='chromium'`, `headless=True`

2. **Update CI workflow** (5 min)
   - Edit `.github/workflows/test.yml`
   - Remove `if: false` from smoke job

3. **Test locally** (5 min)
   ```bash
   python3 tests/smoke_echokit.py
   ```

4. **Push to test branch** (5 min)
   ```bash
   git checkout -b test/ci-tests
   git add tests/smoke_echokit.py .github/workflows/test.yml
   git commit -m "fix: enable CI smoke tests with headless mode"
   git push origin test/ci-tests
   ```

5. **Create PR and verify** (5 min)
   - Create PR to `develop`
   - Watch CI run
   - Verify both jobs pass

6. **Enable branch protection** (5 min)
   - GitHub → Settings → Branches
   - Add rule for `develop`
   - Require `smoke` and `validate` checks

**Done!** ✅ Tests now block bad PRs from merging.

---

**Last Updated**: 2026-05-12  
**Estimated ROI**: 10x reduction in production bugs  
**Cost**: $0 (all free tools)
