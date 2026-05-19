# Changelog

All notable changes to EchoKit are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Planned
- LemonSqueezy payment integration (Merchant of Record, global tax handling)
- Mint real license keys for paying customers via payment webhook
- Upload v1.10.3 release bundle to Chrome Web Store
- Refactor `shared/app.js` (~2800 lines) into focused modules: `header.js`, `menu.js`, `settings-dialog.js`, `request-detail.js`, `waterfall.js` (Issue [#8](https://github.com/ravitejakamalapuram/echokit/issues/8))

---

## [1.10.3] — Current

### Changed
- Stability and polish pass across the extension UI

---

## [1.6.0] — Advanced Debugging & Companion Infrastructure

### Added — Extension
- **Global request headers** — inject, override, or remove headers on all outgoing requests; supports add/override/remove modes with optional URL pattern filtering; applied in `injected.js` to both `fetch` and XHR before hitting the network
- **URL rewrite rules** — substring or `/regex/flags` pattern applied to outgoing fetch URLs (Settings → URL Rewrite Rules)
- **Response transform rules** — add/remove header, set body, or regex-replace body on mocked responses (Settings → Response Transform Rules)
- **Network waterfall visualizer** — header toggle switches the request list to a timeline view showing method, path, status, and duration bars
- **API source visibility badges** — each request in the list shows whether it was served from a mock, passed through to the real network, or blocked
- **GitHub Gist sync** (Pro) — backup and share mock sets via personal Gist
- **Cookie read/write bridge** and **localStorage read/write bridge**
- **OpenAPI / Swagger 2 import** — walks `paths × methods`, extracts examples, and creates mock interactions automatically
- **7-day Pro trial** — automatically granted on install; trial badge shown in header; `getProStatus()` returns `{pro, trial, trialDaysLeft}`
- **License endpoint UI** — Settings input to point the extension at a custom license worker; "Test" button validates `<endpoint>/__health`

### Added — CLI (`echokit-server`)
- `--report` flag: color-coded coverage report on exit (which mocks were hit, missed, coverage %)
- `--report-format markdown` for CI PR-comment-friendly output
- WebSocket / SSE frame handling: ping/pong keep-alive (opcodes 0x9/0xA), clean close frame (0x8), large payload support (8-byte length encoding), binary frames (opcode 0x2)
- `/__healthz` endpoint for GitHub Actions wait-loop

### Added — Infrastructure
- **Cloudflare Worker** (`worker/`) — stateless HMAC-SHA256 license validation. Key format: `EK-{PLAN}-{EXPIRY}-{SIG}`. Endpoints: `POST /v1/validate`, `POST /v1/issue` (admin), `GET /__health`. Deployed at `https://echokit-license.echokit-rk.workers.dev`
- **Stripe webhook** — `POST /v1/stripe-webhook` auto-issues license keys on `checkout.session.completed`; Resend email integration ready
- **Bundled GitHub Action** (`.github/echokit-action.yml`) — reusable composite action with start/stop modes and automatic PR coverage comment
- **`echokit-mock.yml`** CI workflow template — drop-in CI that runs tests against `echokit-server`
- **`scripts/build-store-zip.sh`** — one-shot Chrome Web Store builder: lints + validates manifest + zips, supports `--bump` for version bumps
- Pre-built upload bundle: `store/echokit-api-recorder-mocker-v1.6.0.zip`

### Test Coverage
- End-to-end Playwright smoke test: **87/87 assertions passing**
- CLI unit tests: **7/7 passing**
- Worker tests: **8/8 passing**

---

## [1.5.0] — Pro Features & Freemium Gating

### Added
- **Freemium model** — 50-request free tier; Pro features gated behind license key with `showProGate()` modal
- **License key system** — stored in `chrome.storage.sync`; validated via `echokit:license:check/set` handlers; activate in Settings → License Key
- **HAR import** — convert Chrome HAR exports (`.har` files) into mock interactions via menu item
- **Postman Collection v2.1 export** — `echokit:export:postman` generates a Postman-compatible collection JSON
- **Conditional mock** (`mockMaxCount`) — fire a mock N times then pass through to the real network; tracked locally and in background
- **Mock chaining** — define N response steps per interaction; cursor advances on each hit with optional loop and manual cursor reset
- **API blocking** — block specific requests from ever reaching the network
- **WS/SSE mock replay** — `createFakeMockWS` and `createFakeMockSSE` in `injected.js`; frame-timed replay with loop mode
- Pricing page at `docs/pricing.html` (Free / Pro monthly / Pro annual / Lifetime tiers)

### Fixed
- Hash mismatch between record time and replay time: `injected.js` now computes the FNV-1a hash at record time and passes it through; background uses it as-is, keeping record-hash ≡ replay-hash byte-for-byte

### Infrastructure
- Chrome Web Store submission package: `store/echokit-v1.5.0.zip`
- End-to-end Playwright smoke test: **69/69 assertions passing**

---

## [1.4.0] — CLI & npm Package

### Added
- **`echokit-server`** — zero-dependency Node.js headless mock server (published to npm as `echokit-server`)
  - Replays exported EchoKit JSON in CI or locally, no browser required
  - Supports all six match modes: `strict`, `ignore-query`, `ignore-body`, `path-wildcard`, `graphql`, `graphql-op`
  - `--ci` mode: exits non-zero if any request is unmatched
  - `--watch` mode: reloads mocks when the export file changes
  - Mock chain support: cycles through response steps on each hit
  - Published at: https://www.npmjs.com/package/echokit-server

---

## [1.3.0] — Export, Import & CORS

### Added
- **Export / Import** mocks as JSON with two merge strategies: merge (add new, keep existing) or override (replace all)
- **CORS override toggle** — scope-aware `declarativeNetRequest` dynamic rules:
  - Global scope: browser-wide dynamic rules
  - Domain scope: session rules with `requestDomains` filter
  - Tab scope: session rules with `tabIds` filter
- **Conflict handling UI** — multi-version badge when a URL hash has multiple recordings; version dropdown to pin a specific version (latest wins by default)
- Prominent amber **MOCKING ACTIVE** banner — always visible when mock mode is on

---

## [1.2.0] — Latency, Errors & Filtering

### Added
- **Latency simulation** — per-mock millisecond slider to add artificial delay
- **Error simulation** — four modes: `4xx`, `5xx`, network failure, timeout
- **URL search** — filter the API list by URL substring
- **Method chips** — filter by HTTP method (GET / POST / PUT / PATCH / DELETE)
- **Status bucket filter** — filter by 2xx / 3xx / 4xx / 5xx / blocked
- **Six match modes** — strict, ignore-query, ignore-body, path-wildcard, graphql, graphql-op

---

## [1.1.0] — DevTools Panel & Response Editing

### Added
- **DevTools panel** (`devtools/`) — full-screen two-pane layout registered under the "EchoKit" tab in Chrome DevTools; shares the same `shared/app.js` engine as the popup
- **Raw JSON editor** — edit response body, status code, and headers directly in the UI
- **Domain grouping** — API list groups requests by origin domain
- Per-API mock toggle independent of the master toggle
- Dark high-contrast design system (`shared/styles.css`) with CSS design tokens

---

## [1.0.0] — Initial Release

### Added
- **Chrome Extension (MV3)** — Manifest V3, service worker architecture
- **Request recording** — hooks `window.fetch` and `XMLHttpRequest` from the MAIN world (`injected.js`); captures method, URL, request body, response body, status, headers, timing
- **Isolated-world bridge** (`content.js`) — relays messages between the page and the background service worker
- **Background service worker** (`background.js`) — IndexedDB storage for interactions, per-tab session state in `chrome.storage.session`, mock index broadcast
- **Strict request matching** — FNV-1a hash of `METHOD | normalizeUrl(url) | normalizeBody(body)`; URL query params sorted, body JSON stableStringified
- **Master mock toggle** — per-tab, flips all mocks on/off; scoped so different tabs can be in different modes
- **Browser popup** (`popup/`) — toolbar icon opens a 400×600 compact panel
- **Keyboard shortcuts** — `Alt+Shift+R` toggle recording, `Alt+Shift+M` toggle mocking, `Alt+Shift+E` open popup
- **First-install welcome page** (`onboarding/welcome.html`)
- Icons at 16 × 48 × 128 px

---

[Unreleased]: https://github.com/ravitejakamalapuram/echokit/compare/v1.10.3...HEAD
[1.10.3]: https://github.com/ravitejakamalapuram/echokit/compare/v1.6.0...v1.10.3
[1.6.0]: https://github.com/ravitejakamalapuram/echokit/compare/v1.5.0...v1.6.0
[1.5.0]: https://github.com/ravitejakamalapuram/echokit/compare/v1.4.0...v1.5.0
[1.4.0]: https://github.com/ravitejakamalapuram/echokit/compare/v1.3.0...v1.4.0
[1.3.0]: https://github.com/ravitejakamalapuram/echokit/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/ravitejakamalapuram/echokit/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/ravitejakamalapuram/echokit/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/ravitejakamalapuram/echokit/releases/tag/v1.0.0
