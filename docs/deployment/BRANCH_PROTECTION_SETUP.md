# Branch Protection Setup for EchoKit

## Overview

This document describes the required branch protection rules to ensure automated regression tests block bad code from merging to `develop`.

## Required Branch Protection Rules

### For `develop` Branch

1. **Go to GitHub Repository Settings**
   - Navigate to: Settings → Branches
   - Click "Add rule" or edit existing rule for `develop`

2. **Configure Required Status Checks**
   - ✅ **Require status checks to pass before merging**
   - ✅ **Require branches to be up to date before merging**
   - Select required checks:
     - ✅ `smoke` (E2E regression tests - ~90 seconds)
     - ✅ `validate` (Syntax and structure validation - ~10 seconds)

3. **Additional Recommended Settings**
   - ✅ **Require a pull request before merging**
   - ✅ **Require approvals**: 1 (at minimum)
   - ✅ **Dismiss stale pull request approvals when new commits are pushed**
   - ✅ **Do not allow bypassing the above settings** (enforce for admins too)
   - ⚠️ **Allow force pushes**: DISABLED
   - ⚠️ **Allow deletions**: DISABLED

## Visual Guide

### Step 1: Navigate to Branch Protection
```
GitHub Repo → Settings → Branches → Add rule (or Edit existing)
```

### Step 2: Branch Name Pattern
```
Branch name pattern: develop
```

### Step 3: Protection Settings

**Required:**
```
☑ Require a pull request before merging
  ☑ Require approvals: 1
  ☑ Dismiss stale pull request approvals when new commits are pushed

☑ Require status checks to pass before merging
  ☑ Require branches to be up to date before merging
  Status checks that are required:
    ✓ smoke
    ✓ validate

☑ Do not allow bypassing the above settings
  ☑ Include administrators

☐ Allow force pushes (leave unchecked)
☐ Allow deletions (leave unchecked)
```

## What This Achieves

### Before Branch Protection
- ❌ Broken code can merge to `develop`
- ❌ Tests are optional and often skipped
- ❌ Regressions reach production
- ❌ Manual testing is the only safety net

### After Branch Protection
- ✅ All PRs automatically tested
- ✅ Failed tests block merge
- ✅ "Merge pull request" button disabled until tests pass
- ✅ Zero regressions reach `develop` or production

## Testing the Setup

### 1. Create a Test PR (Should Pass)
```bash
git checkout -b test/branch-protection
echo "# Test" >> README.md
git add README.md
git commit -m "test: verify branch protection works"
git push origin test/branch-protection
```

Create PR to `develop`:
- ✅ Both `smoke` and `validate` jobs should run
- ✅ Both should pass
- ✅ "Merge pull request" button should be enabled
- ✅ PR shows "All checks have passed"

### 2. Test Failure Scenario (Should Block)
```bash
# Break the extension
echo "syntax error!" >> extension/background.js
git add extension/background.js
git commit -m "test: verify tests catch broken code"
git push
```

Expected behavior:
- ❌ `validate` job fails (syntax check)
- ❌ PR shows "Some checks were not successful"
- ❌ "Merge pull request" button is disabled or shows warning
- ❌ Cannot merge until fixed

### 3. Clean Up
```bash
git checkout develop
git branch -D test/branch-protection
git push origin --delete test/branch-protection
```

## CI Job Descriptions

### `smoke` Job
- **Purpose**: Full E2E regression tests
- **Runtime**: ~90 seconds
- **Coverage**: 88 test cases covering:
  - Extension loading and service worker registration
  - Recording and mocking functionality
  - API interception and response modification
  - Settings persistence
  - UI rendering and interactions
  - Import/export features
  - WebSocket handling
  - GraphQL support
  - Conditional mocking
  - Request/response transformations

### `validate` Job
- **Purpose**: Fast syntax and structure checks
- **Runtime**: ~10 seconds
- **Coverage**:
  - Extension file structure validation
  - manifest.json syntax validation
  - JavaScript syntax checking (all core files)

## Enforcement Policy

**DO NOT** bypass branch protection rules, even for:
- ⚠️ Hotfixes (write a test first, then fix)
- ⚠️ "Quick fixes" (no such thing - test it)
- ⚠️ Documentation changes (rules apply to all changes)
- ⚠️ "Emergency" merges (fix the tests or revert)

**Bypassing tests leads to production incidents.**

## Troubleshooting

### Issue: "Merge pull request" button still enabled despite test failures

**Solution**: 
1. Check branch protection rules are saved
2. Verify `smoke` and `validate` are in the required status checks list
3. Ensure "Do not allow bypassing" is checked
4. Wait a few minutes for GitHub to update (caching)

### Issue: Tests pass locally but fail in CI

**Solution**:
1. Run tests in headless mode locally: `python3 tests/smoke_echokit.py`
2. Check GitHub Actions logs for specific errors
3. Ensure all dependencies are listed in workflow file
4. Review CI_CD_IMPLEMENTATION_GUIDE.md troubleshooting section

### Issue: Tests are taking too long in CI

**Current runtime**: ~90 seconds for smoke tests
**Acceptable runtime**: < 2 minutes

If tests exceed 2 minutes:
1. Check for network timeouts
2. Review service worker registration timing
3. Consider parallel test execution (future optimization)

## Maintenance

### When to Update Rules

**Add new required checks when**:
- Adding unit tests (future Phase 2)
- Adding visual regression tests (future Phase 3)
- Adding integration tests (future Phase 4)

**Review rules when**:
- Tests become flaky (>5% failure rate)
- New team members join
- Changing CI/CD provider
- Major GitHub feature updates

## Related Documentation

- **Implementation Guide**: `CI_CD_IMPLEMENTATION_GUIDE.md`
- **Research**: `CHROME_EXTENSION_CI_CD_TESTING_RESEARCH.md`
- **Quick Reference**: `QUICK_REFERENCE_TESTING.md`
- **Framework Comparison**: `TESTING_FRAMEWORK_COMPARISON.md`

## Success Criteria

Branch protection is working correctly when:
- ✅ 100% of PRs are automatically tested
- ✅ Failed tests block merges
- ✅ Zero bypasses in the last 30 days
- ✅ Zero production bugs from untested code
- ✅ Team accepts rules as part of workflow

---

**Last Updated**: 2026-05-12
**Status**: Active
**Owner**: Engineering Team
