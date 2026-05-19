<div align="center">
  <h1>EchoKit</h1>
  <p><strong>Record once. Mock reliably. Debug faster.</strong></p>

  <p>
    <a href="https://chromewebstore.google.com/detail/echokit-api-recorder-mock/jndhbmaokpclbpjoogffaimahadpidcf">
      <img src="https://img.shields.io/chrome-web-store/v/jndhbmaokpclbpjoogffaimahadpidcf?label=Chrome%20Web%20Store&style=for-the-badge" alt="Chrome Web Store">
    </a>
    <a href="https://github.com/ravitejakamalapuram/echokit/blob/main/LICENSE">
      <img src="https://img.shields.io/badge/license-MIT-blue.svg?style=for-the-badge" alt="License">
    </a>
    <a href="https://github.com/ravitejakamalapuram/echokit/stargazers">
      <img src="https://img.shields.io/github/stars/ravitejakamalapuram/echokit?style=for-the-badge" alt="GitHub Stars">
    </a>
  </p>

  <p>
    <a href="#features">Features</a> •
    <a href="#installation">Installation</a> •
    <a href="#quick-start">Quick Start</a> •
    <a href="#documentation">Documentation</a> •
    <a href="#contributing">Contributing</a>
  </p>
</div>

---

## Overview

EchoKit is a powerful Chrome extension designed for frontend developers and QA engineers that captures real API traffic (`fetch` / `XMLHttpRequest`) from any webpage and enables instant mocking with full control over responses, timing, and errors.

### Two Interface Options

- **🎯 Browser Popup** — Quick access via toolbar icon (400×600)
- **🛠️ DevTools Panel** — Integrated tab alongside Network and Console

Both interfaces share the same powerful engine, giving you flexibility in how you work.

## Features

✅ **Zero-Setup Recording** — Capture real API traffic instantly
✅ **Smart Request Matching** — URL patterns with strict query/body matching
✅ **Response Editing** — Modify status codes, headers, and body content
✅ **Latency Simulation** — Add delays to test loading states
✅ **Error Injection** — Simulate network failures and timeouts
✅ **CORS Override** — Bypass CORS restrictions during development
✅ **Export/Import** — Share mock configurations across teams
✅ **Conflict Resolution** — Handle overlapping mock rules intelligently

## Installation

### Chrome Web Store (Recommended)

Install the latest stable version:

[![Install from Chrome Web Store](https://storage.googleapis.com/web-dev-uploads/image/WlD8wC6g8khYWPJUsQceQkhXSlv1/iNEddTyWiMfLSwFD6qGq.png)](https://chromewebstore.google.com/detail/echokit-api-recorder-mock/jndhbmaokpclbpjoogffaimahadpidcf)

### Development Installation

For contributors and local development:

```bash
# Clone the repository
git clone https://github.com/ravitejakamalapuram/echokit.git
cd echokit

# Load unpacked extension
# 1. Open chrome://extensions
# 2. Enable "Developer mode"
# 3. Click "Load unpacked"
# 4. Select the echokit/extension/ folder
```

## Quick Start

1. **📍 Pin the extension** — Click the puzzle icon in Chrome toolbar → pin EchoKit
2. **🔴 Start Recording** — Click the EchoKit icon → press **● REC**
3. **🌐 Use your application** — Browse and interact normally
4. **✅ Enable Mocking** — Toggle **MOCK** on
5. **🎭 Test your app** — Requests now return mocked responses

For detailed workflows, see the [Extension Architecture Guide](extension/README.md). For the full product roadmap, see [TODO.md](TODO.md).

## Repository Structure

```
echokit/
│
│  ── SOURCE CODE ─────────────────────────────────────────────────────
├── 📦 extension/              # Chrome MV3 extension (load this in chrome://extensions)
│   ├── manifest.json          # Extension manifest (version, permissions)
│   ├── background.js          # Service worker (IndexedDB, state, DNR)
│   ├── injected.js            # Main-world fetch/XHR interception
│   ├── content.js             # Isolated-world messaging bridge
│   ├── popup/                 # Browser popup UI (400×600)
│   ├── devtools/              # DevTools panel UI
│   ├── shared/                # Shared UI components & logic
│   ├── icons/                 # Extension icons (16/48/128px)
│   └── onboarding/            # First-install welcome page
│
├── 🖥️  cli/                    # Node.js headless mock server (npm: echokit-server)
│   ├── bin/echokit-server.js  # CLI entry point
│   ├── lib/                   # Server & matcher logic
│   └── test/                  # CLI unit tests
│
├── ☁️  worker/                  # Cloudflare Worker — HMAC license validation
│   ├── worker.js              # Worker source
│   └── wrangler.toml          # Cloudflare config
│
│  ── TESTS ────────────────────────────────────────────────────────────
├── 🧪 tests/                  # All automated tests
│   ├── smoke_echokit.py       # Playwright E2E smoke tests (87 assertions)
│   ├── debug_extension.py     # Extension debug helper
│   ├── test_imports.js        # Import validation
│   └── test_validation.js     # Input validation tests
│
│  ── SCRIPTS & TOOLS ─────────────────────────────────────────────────
├── 🛠️  scripts/                # Build, deploy, and setup scripts
│   ├── build-store-zip.sh     # Builds Chrome Web Store zip
│   ├── test-cws-auth.sh       # Tests CWS authentication
│   ├── setup/                 # Cloudflare & DNS setup scripts
│   └── tools/                 # Developer utilities
│       └── generate_screenshots.py
│
│  ── WEB ASSETS ──────────────────────────────────────────────────────
├── 🌐 website/                # Public website — served by Cloudflare Pages
│   ├── index.html             # Landing page
│   ├── docs.html              # Documentation page
│   ├── pricing.html           # Pricing page
│   ├── faq.html               # FAQ page
│   ├── changelog.html         # Changelog page
│   ├── simulator.html         # Interactive API mock simulator
│   ├── privacy.html           # Privacy policy
│   └── style.css              # Shared stylesheet
│
│  ── CONTRIBUTOR DOCS ────────────────────────────────────────────────
├── 📖 docs/                   # Internal contributor documentation (not served publicly)
│   ├── architecture/          # System design & technical deep-dives
│   ├── deployment/            # CI/CD, hosting, and publishing guides
│   ├── design/                # Design system & UI history
│   ├── github/                # GitHub Actions & repo setup docs
│   ├── research/              # Testing framework research notes
│   ├── testing/               # Manual test plans & checklists
│   ├── troubleshooting/       # Debug guides
│   └── archive/               # Completed feature docs (historical reference)
│
│  ── STORE ASSETS ────────────────────────────────────────────────────
├── 🏪 store/                  # Chrome Web Store listing assets
│   ├── screenshots/           # Store screenshots (1280×800)
│   ├── chrome-web-store.md    # Store listing copy
│   ├── privacy-policy.md      # Privacy policy text
│   ├── screenshot-guide.md    # Screenshot capture guide
│   └── *.zip                  # Pre-built release bundles
│
│  ── DESIGN ──────────────────────────────────────────────────────────
├── 🎨 design/                 # UI mockups & design system prototypes
│   ├── EchoKit Design System v2.html
│   ├── EchoKit Popup v1.html
│   └── screenshots/           # Design reference screenshots
│
│  ── PRODUCT SPECS ───────────────────────────────────────────────────
├── 📋 specs/                  # Living product specifications & decisions
│   ├── PRD.md                 # Product Requirements Document
│   ├── DECISION_SUMMARY.md    # Architecture & product decisions log
│   ├── QUICK_REFERENCE.md     # Developer quick reference card
│   └── ...                    # Feature designs, UX comparisons, etc.
│
│  ── ROOT DOCS ───────────────────────────────────────────────────────
├── README.md                  # ← you are here
├── CLAUDE.md                  # AI agent instructions (auto-loaded by Claude Code / Cursor)
├── CHANGELOG.md               # Version history
├── CONTRIBUTING.md            # Contribution guide & workflow
├── DEVELOPMENT_RULES.md       # Code quality rules, PR checklist, merge rules
└── TODO.md                    # Living roadmap (P0–P3 backlog)
```

## Testing

EchoKit includes comprehensive end-to-end tests using Playwright.

### Prerequisites

```bash
# Install Playwright and Chromium
pip install playwright
python3 -m playwright install chromium

# Linux only: Install display server dependencies
sudo apt-get install -y xvfb xauth
```

### Run Tests

```bash
# Run the full smoke test suite (24+ assertions)
python3 tests/smoke_echokit.py
```

The test suite validates:
- ✅ Request recording (fetch & XMLHttpRequest)
- ✅ Mock activation and response interception
- ✅ Response editing and persistence
- ✅ CORS override functionality
- ✅ Export/import workflows

> **Note**: Tests currently run locally only. CI automation is disabled due to a Chromium headless mode limitation with extension service workers. Always run tests before submitting PRs.

## Contributing

We welcome contributions from the community! 🎉

### Getting Started

1. **Read the guidelines** — [CONTRIBUTING.md](CONTRIBUTING.md)
2. **Review dev rules** — [DEVELOPMENT_RULES.md](DEVELOPMENT_RULES.md) (code quality, PR checklist, merge rules)
3. **Review the PR template** — [Pull Request Checklist](.github/pull_request_template.md)
4. **Check the product spec** — [specs/PRD.md](specs/PRD.md)

### Contribution Workflow

```bash
# Fork and clone the repository
git clone https://github.com/YOUR_USERNAME/echokit.git
cd echokit

# Create a feature branch
git checkout -b feature/your-feature-name

# Make your changes and test locally
python3 tests/smoke_echokit.py

# Commit and push
git commit -m "feat: add amazing feature"
git push origin feature/your-feature-name

# Open a Pull Request
```

### Before Submitting

- ✅ Run tests locally and ensure they pass
- ✅ Update version in `manifest.json` if needed
- ✅ Complete the PR template checklist
- ✅ Update documentation for new features

## Documentation

### Core Documentation
- **[Extension Architecture](extension/README.md)** — Deep dive into architecture, feature map, and technical design
- **[Product Roadmap](TODO.md)** — Current priorities and upcoming features
- **[Contributing Guide](CONTRIBUTING.md)** — Development workflow and code standards
- **[Development Rules](DEVELOPMENT_RULES.md)** — Code quality rules, PR checklist, merge checklist

### Internal Contributor Docs
- **[Internal Documentation](docs/README.md)** — Deployment guides, design history, and architecture decisions
- **[Architecture](docs/architecture/)** — CORS implementation, Worker design
- **[Deployment](docs/deployment/)** — CI/CD, Chrome publishing, Cloudflare hosting
- **[GitHub CI/CD Setup](docs/github/)** — GitHub Actions setup, branch protection, release automation
- **[Troubleshooting](docs/troubleshooting/)** — CORS issues, blank screen debugging

### Web Assets
- **[Website](website/)** — Public-facing pages (pricing, FAQ, privacy policy) — served by Cloudflare Pages
- **[Chrome Web Store Listing](https://chromewebstore.google.com/detail/echokit-api-recorder-mock/jndhbmaokpclbpjoogffaimahadpidcf)** — Official extension page

## Support

- 🐛 **Bug Reports** — [Open an issue](https://github.com/ravitejakamalapuram/echokit/issues/new)
- 💡 **Feature Requests** — [Request a feature](https://github.com/ravitejakamalapuram/echokit/issues/new)
- 💬 **Questions** — [Start a discussion](https://github.com/ravitejakamalapuram/echokit/discussions)

## License

MIT License — Copyright © 2025 EchoKit

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

See [LICENSE](LICENSE) for full details.

---

<div align="center">
  <p>Made with ❤️ by developers, for developers</p>
  <p>
    <a href="https://chromewebstore.google.com/detail/echokit-api-recorder-mock/jndhbmaokpclbpjoogffaimahadpidcf">Chrome Web Store</a> •
    <a href="https://github.com/ravitejakamalapuram/echokit">GitHub</a> •
    <a href="https://github.com/ravitejakamalapuram/echokit/issues">Issues</a> •
    <a href="https://github.com/ravitejakamalapuram/echokit/blob/main/CONTRIBUTING.md">Contributing</a>
  </p>
</div>
