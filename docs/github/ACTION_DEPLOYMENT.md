# Deploying the EchoKit GitHub Action

This guide explains how to publish the EchoKit GitHub Action to the marketplace.

## Prerequisites

- GitHub account with permission to create public repositories
- Git installed locally

## Steps

### 1. Create the Action Repository

```bash
# Create a new public repository on GitHub
# Name: echokit-action
# URL: https://github.com/ravitejakamalapuram/echokit-action

# Clone it locally
git clone https://github.com/ravitejakamalapuram/echokit-action.git
cd echokit-action
```

### 2. Copy Action Files

Copy the following files from this directory to the new repository:

```bash
# From echokit/.github/ copy these files:
cp /path/to/echokit/.github/echokit-action.yml ./action.yml
cp /path/to/echokit/.github/ECHOKIT_ACTION_README.md ./README.md
cp /path/to/echokit/.github/EXAMPLE_USAGE.yml ./example-workflow.yml
```

### 3. Create Initial Commit

```bash
git add action.yml README.md example-workflow.yml
git commit -m "feat: Initial EchoKit GitHub Action"
git push origin main
```

### 4. Tag and Release

Create a v1 release for semantic versioning:

```bash
# Tag the release
git tag -a v1.0.0 -m "EchoKit Action v1.0.0"
git push origin v1.0.0

# Create the v1 major version tag (for users to reference @v1)
git tag -a v1 -m "EchoKit Action v1"
git push origin v1 --force  # use --force to move the tag as you release v1.x updates
```

### 5. Publish to GitHub Marketplace

1. Go to https://github.com/ravitejakamalapuram/echokit-action
2. Click "Releases" → "Draft a new release"
3. Choose tag: `v1.0.0`
4. Title: `EchoKit Action v1.0.0`
5. Description:
   ```
   🎉 First release of the EchoKit GitHub Action!
   
   Run integration tests against EchoKit-recorded API mocks with:
   - ✅ Automatic coverage tracking
   - 📊 PR comments with coverage reports
   - 🚀 Simple two-step setup (start/stop)
   - 📝 JSON and Markdown report formats
   
   See README for usage examples.
   ```
6. Check "Publish this Action to the GitHub Marketplace"
7. Select category: **Testing**
8. Click "Publish release"

### 6. Test the Action

Create a test repository and add this workflow:

```yaml
name: Test EchoKit Action
on: [push]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ravitejakamalapuram/echokit-action@v1
        with:
          mocks-file: 'path/to/mocks.json'
```

## Updating the Action

When you make changes:

```bash
# Make your changes to action.yml
git add action.yml
git commit -m "feat: add new feature"
git push origin main

# Tag patch version
git tag -a v1.0.1 -m "EchoKit Action v1.0.1"
git push origin v1.0.1

# Move v1 tag to latest v1.x.x
git tag -a v1 -m "EchoKit Action v1" --force
git push origin v1 --force

# Create GitHub release from the new tag
```

## Versioning Strategy

- **v1**: Always points to the latest stable v1.x.x release
- **v1.0.x**: Patch releases (bug fixes)
- **v1.x.0**: Minor releases (new features, backward compatible)
- **v2.0.0**: Major releases (breaking changes)

Users should reference `@v1` in their workflows to get automatic updates within the v1 major version.

## Marketplace Badge

Add this badge to your main EchoKit README:

```markdown
[![GitHub Action](https://img.shields.io/badge/GitHub_Action-echokit--action-blue?logo=github)](https://github.com/marketplace/actions/echokit-mock-server)
```
