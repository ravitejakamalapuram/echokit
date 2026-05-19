# Branch Protection Rules

This document describes the recommended branch protection rules for the EchoKit repository.

## 🔒 Recommended Settings for `main` Branch

### How to Configure

1. Go to **Settings** → **Branches** → **Add rule**
2. Apply to branch: `main`
3. Configure the following rules:

---

## ✅ Required Checks

### Protect Matching Branches

- [x] **Require a pull request before merging**
  - [x] Require approvals: **1**
  - [x] Dismiss stale pull request approvals when new commits are pushed
  - [ ] Require review from Code Owners (optional - create CODEOWNERS file first)
  - [x] Require approval of the most recent reviewable push

### Status Checks

- [x] **Require status checks to pass before merging**
  - [x] Require branches to be up to date before merging
  - Required status checks:
    - `Test/validate` ✓ (file structure + syntax checks)
    - `CodeRabbit` ✓ (code review bot)

**Note**: `Test/smoke` is currently skipped in CI (see Issue #4), so it's not a required check.

---

## 🚫 Restrictions

- [x] **Require conversation resolution before merging**
  - All review comments must be resolved

- [x] **Require signed commits** (optional but recommended)
  - Ensures commit authenticity

- [ ] **Require linear history** (optional)
  - Prevents merge commits (only squash/rebase)

- [x] **Do not allow bypassing the above settings**
  - Applies to administrators too (recommended)

---

## 🔐 Additional Protections

### Force Push

- [x] **Do not allow force pushes**
  - Prevents `git push --force` on main

### Deletions

- [x] **Do not allow deletions**
  - Prevents accidental branch deletion

---

## 📋 Complete Configuration Checklist

Copy-paste this into GitHub's branch protection UI:

```
Branch name pattern: main

☑️ Require a pull request before merging
  ☑️ Require approvals: 1
  ☑️ Dismiss stale pull request approvals when new commits are pushed
  ☐ Require review from Code Owners
  ☑️ Require approval of the most recent reviewable push
  ☐ Require conversation resolution before merging (recommended)

☑️ Require status checks to pass before merging
  ☑️ Require branches to be up to date before merging
  Status checks that are required:
    - Test/validate
    - CodeRabbit

☐ Require signed commits (optional)

☑️ Require linear history (optional - prevents merge commits)

☑️ Do not allow bypassing the above settings (recommended)

☑️ Restrict who can push to matching branches (optional)
  Add: github-actions[bot] (for auto-release)

Rules applied to administrators:
  ☑️ Include administrators (recommended)
```

---

## 🤖 Auto-Release Considerations

### GitHub Actions Permissions

The `auto-release.yml` workflow needs permission to push tags to `main`. Configure:

1. **Settings** → **Actions** → **General**
2. **Workflow permissions**: Select "Read and write permissions"
3. ✅ Allow GitHub Actions to create and approve pull requests (optional)

### Required for Auto-Release

```yaml
# In .github/workflows/auto-release.yml
permissions:
  contents: write  # Allows creating tags
```

---

## 🔧 Alternative: Rulesets (New GitHub Feature)

If your repository uses GitHub's new **Rulesets** feature:

### Create Ruleset for `main`

1. **Settings** → **Rules** → **Rulesets** → **New ruleset**
2. **Name**: `Protect main branch`
3. **Target branches**: `main`
4. **Rules**:
   - Require pull request: ✓
   - Require status checks: ✓ (`Test/validate`, `CodeRabbit`)
   - Block force pushes: ✓
   - Require conversation resolution: ✓

---

## 📝 Enforcement Level

### Option 1: Strict (Recommended for Teams)

- No one can bypass rules (including admins)
- All checks must pass
- Best for production repositories

### Option 2: Flexible (Recommended for Solo Development)

- Admins can bypass in emergencies
- Allows hotfixes when needed
- Still enforces best practices

**Current Recommendation**: Start with **Flexible**, move to **Strict** as team grows.

---

## ✅ Verification

After configuring, verify by:

1. Creating a test PR
2. Attempting to merge without approval → Should be blocked ✓
3. Attempting to push directly to main → Should be blocked ✓
4. Checking that auto-release workflow can push tags → Should work ✓

---

## 🔄 Updates to This Document

Last updated: 2026-05-11  
Update when: Branch protection requirements change

---

**Note**: These are recommendations based on EchoKit's current workflow. Adjust based on your team's needs.
