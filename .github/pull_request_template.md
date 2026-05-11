## Description

<!-- Provide a brief description of the changes in this PR -->

## Type of Change

<!-- Check the relevant option(s) -->

- [ ] 🐛 Bug fix (non-breaking change that fixes an issue)
- [ ] ✨ New feature (non-breaking change that adds functionality)
- [ ] 💥 Breaking change (fix or feature that causes existing functionality to break)
- [ ] 📝 Documentation update
- [ ] 🔧 Refactoring (code improvement without changing functionality)
- [ ] 🎨 UI/UX improvement
- [ ] ⚡ Performance improvement
- [ ] 🧪 Test update

## Related Issues

<!-- Link related issues using #issue_number -->

Closes #

## Changes Made

<!-- List the key changes made in this PR -->

- 
- 
- 

## Testing

<!-- Describe how you tested these changes -->

- [ ] Tested locally by loading extension unpacked
- [ ] Ran smoke tests: `python3 tests/smoke_echokit.py`
- [ ] Tested in Chrome/Edge
- [ ] Verified backward compatibility
- [ ] Tested edge cases

## Screenshots (if applicable)

<!-- Add screenshots/recordings to demonstrate UI changes -->

## Pre-Merge Checklist

**Required for ALL PRs:**

- [ ] ✅ Code reviewed and approved
- [ ] ✅ All CI checks passing
- [ ] ✅ No merge conflicts
- [ ] ✅ Branch is up-to-date with main

**Required for RELEASES (merging to main):**

- [ ] 📦 Version bumped in `extension/manifest.json` (following [semver](https://semver.org/))
  - Patch (1.6.4 → 1.6.5) for bug fixes
  - Minor (1.6.4 → 1.7.0) for new features
  - Major (1.6.4 → 2.0.0) for breaking changes
- [ ] 📝 CHANGELOG updated (optional but recommended)
- [ ] 🧪 Smoke tests run locally and passing
- [ ] 📚 Documentation updated (if needed)

**Code Quality:**

- [ ] 🧹 No console.log/debugger statements left in code
- [ ] 📏 Functions are < 50 lines (refactor if longer)
- [ ] 📄 No single file > 500 lines (see refactoring issues #8, #9, #10)
- [ ] 🔒 No hardcoded secrets or sensitive data
- [ ] ✍️ JSDoc comments added for new functions (optional but recommended)

## Deployment Notes

<!-- Any special considerations for deployment? -->

- [ ] No special deployment steps required
- [ ] Requires manual testing after deployment
- [ ] Other: <!-- specify -->

## Reviewer Notes

<!-- Anything specific you want reviewers to focus on? -->

---

<!-- 
Auto-Release Reminder:
When this PR is merged to main with a new version in manifest.json,
the auto-release workflow will automatically:
1. Create a git tag (e.g., v1.7.0)
2. Trigger the release workflow
3. Create a GitHub Release
4. Publish to Chrome Web Store (if configured)

If you DON'T want an automatic release, keep the version unchanged.
-->
