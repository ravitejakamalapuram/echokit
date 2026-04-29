# EchoKit — Product Requirements Document (Living)

## Original Problem Statement
Build a zero-setup Chrome extension ("EchoKit") for frontend devs & QA engineers to record real API interactions (fetch + XHR) from a browser session, instantly mock them with strict matching, edit responses, simulate latency / errors, handle conflicts, export/import mock sets, and toggle a CORS override. Core promise: **"Record once. Mock reliably. Debug faster."**

## User Personas
- **Frontend developer** — backend not ready / unstable; wants to build UI against realistic API shapes without waiting.
- **QA engineer** — needs to reproduce edge cases (4xx/5xx, slow networks, timeouts, network failures) deterministically.

## Core Requirements (static)
- Record fetch + XHR per tab (manual Start/Stop).
- Strict matching via `method + normalized URL + normalized body` hash.
- Toggle mock ON/OFF per API + a master toggle per tab.
- Edit response body (raw JSON), status code, headers.
- Simulate latency (ms) + errors (4xx / 5xx / network / timeout).
- Group API list by domain; search by URL; filter by method & status bucket.
- Conflict handling: latest-wins default + version dropdown.
- Export / Import mock sets as JSON (merge | override).
- CORS override toggle (declarativeNetRequest dynamic rules).
- Prominent "MOCKING ACTIVE" amber banner whenever mocking is enabled.
- Persist in IndexedDB (scoped by session) with per-tab state in `chrome.storage.session`.
- Two UI surfaces sharing the same module: **Popup** (400×600) and **DevTools panel**.

## What's Been Implemented (2026 — v1.5)
- ✅ Manifest V3 extension scaffold (`/app/extension/`)
- ✅ MAIN-world `injected.js` hooking `fetch` + `XMLHttpRequest` (record + mock + block)
- ✅ Isolated-world `content.js` bridging page ↔ background
- ✅ `background.js` service worker: IndexedDB store, per-tab state, mock cache broadcast, CORS DNR rules, export/import, HAR export, cookies read/write, localStorage read/write
- ✅ Shared `shared/app.js` vanilla JS UI module (used by both popup + devtools panel)
- ✅ Dark high-contrast design system (`shared/styles.css`)
- ✅ Popup surface (`popup/popup.html` + `popup.js`) — single column, slide-over detail
- ✅ DevTools surface (`devtools/devtools.html` + `devtools.js` + `panel.html` + `panel.js`) — two-pane layout
- ✅ Icons 16/48/128 generated
- ✅ README with install + architecture + feature map
- ✅ End-to-end Playwright smoke test (`tests/smoke_echokit.py`) — **55/55 assertions passing**
- ✅ WS/SSE mock replay (injected.js `createFakeMockWS` + `createFakeMockSSE`, frame-timed replay, loop mode)
- ✅ Freemium/Pro gating: 50-request free limit, `isPro()` via license key, all Pro features gated with `showProGate()` modal
- ✅ License key system: `chrome.storage.sync`, `echokit:license:check/set` handlers, activate via Settings → License Key
- ✅ Conditional mock: `mockMaxCount` field — mock fires N times then passes through; tracked locally + in background
- ✅ HAR import: menu item → file picker → `echokit:import:har` converts entries to interactions
- ✅ Postman export: `echokit:export:postman` generates Postman Collection v2.1 JSON
- ✅ Pricing page: `/app/docs/pricing.html` with all tiers ($5/mo, $49/yr, $199 LTD)
- ✅ Chrome Web Store submission package: `/app/store/echokit-v1.5.0.zip`
- ✅ End-to-end Playwright smoke test — **69/69 assertions passing**

### Fixed during smoke-test
- Bug: injected.js sent relative URLs to the background; the background re-normalized them with a placeholder base (`http://local.local`) — producing a different hash than the MAIN-world matcher computed at replay time. Fix: injected.js now computes the hash at record time and passes it through; background uses it as-is, keeping record-hash ≡ replay-hash byte-for-byte.

### Phase-by-phase checklist
- **Phase 1 (Core):** Recording, API list UI, toggle mock, strict matching, response editing — ✅
- **Phase 2:** Search/filter, latency simulation, error simulation — ✅
- **Phase 3:** Export/import with strategy, conflict handling UI with version picker, CORS toggle — ✅

## Non-goals (v1)
GraphQL / WebSocket mocking, cloud sync, AI-generated mocks, complex rule engines — intentionally deferred. Schema is extensible (hash key is the swappable abstraction point).

## Prioritized Backlog
- **P1** — Cloudflare Worker for HMAC-signed license validation (replace current format-only check)
- **P2** — Import from OpenAPI/Swagger spec → auto-generate mocks
- **P2** — URL rewrite rules (redirect /api/v1 → /api/v2 transparently)
- **P2** — Request/response transform rules (add/remove headers, mutate body on-the-fly)
- **P2** — Mock response chaining (simulate multi-step auth flows)
- **P2** — In-extension network waterfall visualizer
- **P3** — CLI companion tool (`echokit-server`) + GitHub Actions CI template
- **P3** — Chrome Web Store submission (manual upload from `/app/store`)
- **P3** — HAR import (already done in v1.5)

## Next Action Items
1. **Chrome Web Store**: Upload `/app/store/echokit-v1.5.0.zip` via https://chrome.google.com/webstore/devconsole — use the listing copy from `/app/store/chrome-web-store.md`
2. **Cloudflare Worker**: Deploy a Worker for HMAC-signed key generation + validation (free tier)
3. **Next features**: OpenAPI import, URL rewrite, transform rules

## Architecture (summary)
```
injected.js (MAIN) ←postMessage→ content.js (ISOLATED) ←runtime→ background.js (SW)
                                                                       │
                                                           IndexedDB + DNR rules
popup/popup.js  ─┐
devtools/panel.js ┴─► shared/app.js (single UI module, mode-switched)
```

Matching: `FNV1a(METHOD | normalizeUrl(url) | normalizeBody(body))` → `hash`. Latest-timestamp version wins unless user pinned.
