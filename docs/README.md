# Internal Documentation

Contributor-only working notes, deployment guides, architecture decisions, and design history for the EchoKit project.

> The **public-facing website** (HTML/CSS) now lives in [`website/`](../website/). This `docs/` folder is for contributors only — nothing here is served publicly.

---

## 📁 Folder Map

### architecture/
Technical deep-dives into subsystems.

- [`architecture/WORKER_EXPLAINED.md`](architecture/WORKER_EXPLAINED.md) — What the Cloudflare license worker does and why the project needs it
- [`architecture/CORS_IMPLEMENTATION_COMPARISON.md`](architecture/CORS_IMPLEMENTATION_COMPARISON.md) — Comparison of MV2 webRequest vs MV3 DNR CORS approaches

### deployment/
CI/CD, hosting, and publishing guides.

- [`deployment/DEPLOYMENT_GUIDE.md`](deployment/DEPLOYMENT_GUIDE.md) — Step-by-step v1.6.0 deployment guide (worker, npm, Chrome Web Store)
- [`deployment/CI_CD_IMPLEMENTATION_GUIDE.md`](deployment/CI_CD_IMPLEMENTATION_GUIDE.md) — CI/CD pipeline implementation guide
- [`deployment/CHROME_PUBLISHING_CICD_SETUP.md`](deployment/CHROME_PUBLISHING_CICD_SETUP.md) — Chrome Web Store auto-publishing pipeline setup
- [`deployment/CLOUDFLARE_HOSTING_CI_CD_PLAN.md`](deployment/CLOUDFLARE_HOSTING_CI_CD_PLAN.md) — Cloudflare hosting and CI/CD plan
- [`deployment/AUTOMATED_TESTING.md`](deployment/AUTOMATED_TESTING.md) — Automated testing setup in CI
- [`deployment/AUTOMATION_SETUP.md`](deployment/AUTOMATION_SETUP.md) — Automation setup guide
- [`deployment/BRANCH_PROTECTION_SETUP.md`](deployment/BRANCH_PROTECTION_SETUP.md) — Branch protection rules setup
- [`deployment/PROFESSIONAL_EMAIL_SETUP_PLAN.md`](deployment/PROFESSIONAL_EMAIL_SETUP_PLAN.md) — Email setup for echokit.dev domain

### design/
Design system notes and UI history.

- [`design/DESIGN_SYSTEM_UPDATES.md`](design/DESIGN_SYSTEM_UPDATES.md) — Design system changes (v2 design system)
- [`design/DESIGN_UPGRADE_SUMMARY.md`](design/DESIGN_UPGRADE_SUMMARY.md) — Summary of the v2 UI upgrade

### github/
GitHub Actions workflow setup and repo configuration docs.  
*(These were moved here from `.github/` to keep `.github/` clean — only CI workflows live there.)*

- [`github/GITHUB_SETUP_README.md`](github/GITHUB_SETUP_README.md) — Overview of GitHub setup
- [`github/ECHOKIT_ACTION_README.md`](github/ECHOKIT_ACTION_README.md) — How to use the bundled `echokit-action` in CI
- [`github/ACTION_DEPLOYMENT.md`](github/ACTION_DEPLOYMENT.md) — GitHub Actions deployment overview
- [`github/ACTION_DEPLOYMENT_STEPS.md`](github/ACTION_DEPLOYMENT_STEPS.md) — Step-by-step deployment via GitHub Actions
- [`github/AUTOMATED_RELEASE.md`](github/AUTOMATED_RELEASE.md) — Auto-release workflow documentation
- [`github/AUTO_RELEASE_ON_MAIN.md`](github/AUTO_RELEASE_ON_MAIN.md) — Auto-release on merge to main
- [`github/BRANCH_PROTECTION_RULES.md`](github/BRANCH_PROTECTION_RULES.md) — Branch protection configuration
- [`github/CHROME_WEB_STORE_SETUP.md`](github/CHROME_WEB_STORE_SETUP.md) — Chrome Web Store credentials for CI
- [`github/SETUP_CHECKLIST.md`](github/SETUP_CHECKLIST.md) — Full repo setup checklist

### research/
Evaluations and research notes.

- [`research/TESTING_FRAMEWORK_COMPARISON.md`](research/TESTING_FRAMEWORK_COMPARISON.md) — Playwright vs Puppeteer vs Selenium for Chrome extension testing
- [`research/TESTING_RESEARCH_SUMMARY.md`](research/TESTING_RESEARCH_SUMMARY.md) — Summary of testing research findings
- [`research/CHROME_EXTENSION_CI_CD_TESTING_RESEARCH.md`](research/CHROME_EXTENSION_CI_CD_TESTING_RESEARCH.md) — CI/CD testing research for Chrome extensions
- [`research/QUICK_REFERENCE_TESTING.md`](research/QUICK_REFERENCE_TESTING.md) — Quick reference for running tests

### testing/
Manual test plans and QA checklists.

- [`testing/TEST_SOURCE_VISIBILITY.md`](testing/TEST_SOURCE_VISIBILITY.md) — Test plan for the API source visibility feature

### troubleshooting/
Debug guides for known issues.

- [`troubleshooting/CORS_TROUBLESHOOTING.md`](troubleshooting/CORS_TROUBLESHOOTING.md) — CORS override troubleshooting guide
- [`troubleshooting/DEBUGGING_BLANK_SCREEN.md`](troubleshooting/DEBUGGING_BLANK_SCREEN.md) — Diagnosing blank screen issues in the popup

### archive/
Completed feature docs kept for historical reference. **Not actively maintained.**

- [`archive/FEATURE_GLOBAL_REQUEST_HEADERS.md`](archive/FEATURE_GLOBAL_REQUEST_HEADERS.md) — Global Request Headers feature implementation notes
- [`archive/GLOBAL_REQUEST_HEADERS_SUMMARY.md`](archive/GLOBAL_REQUEST_HEADERS_SUMMARY.md) — Summary of Global Request Headers feature
- [`archive/IMPLEMENTATION_GUIDE_REQUEST_HEADERS.md`](archive/IMPLEMENTATION_GUIDE_REQUEST_HEADERS.md) — Implementation guide for request headers
- [`archive/IMPLEMENTATION_CHECKLIST.md`](archive/IMPLEMENTATION_CHECKLIST.md) — One-time implementation checklist (completed)
- [`archive/REVISED_IMPLEMENTATION_PLAN.md`](archive/REVISED_IMPLEMENTATION_PLAN.md) — Revised plan for the initial implementation
- [`archive/CHANGELOG_GLOBAL_REQUEST_HEADERS.md`](archive/CHANGELOG_GLOBAL_REQUEST_HEADERS.md) — Changelog for global request headers feature
- [`archive/QE_AUDIT_REPORT.md`](archive/QE_AUDIT_REPORT.md) — QE audit findings report

---

## Other documentation in the repo

These live close to their code:

| Location | Content |
|---|---|
| `../README.md` | Project README (start here) |
| `../CONTRIBUTING.md` | Contribution workflow |
| `../DEVELOPMENT_RULES.md` | Code quality rules & PR/merge checklists |
| `../TODO.md` | Living roadmap (P0–P3 backlog) |
| `../CHANGELOG.md` | Version history |
| `../extension/README.md` | Extension architecture and feature map |
| `../worker/README.md` | Cloudflare Worker setup and deployment |
| `../cli/README.md` | CLI (echokit-server) usage and publishing |
| `../store/` | Chrome Web Store listing copy and upload guides |
| `../specs/` | Product specs, PRD, design decisions |
| `../website/` | Public website HTML/CSS (served by Cloudflare) |
| `../.github/workflows/` | CI/CD workflow YAML files |
| `../.github/echokit-action.yml` | Reusable echokit CI composite action |
