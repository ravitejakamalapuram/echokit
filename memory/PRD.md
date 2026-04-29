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

## What's Been Implemented (2026-04-29 — v1.4)
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
- ✅ CORS standalone toggle in header (next to MOCK button)
- ✅ "MOCKING ACTIVE" watermark banner removed
- ✅ Default scope changed to `tab`
- ✅ API-level blocking (⊘ button per row, `blocked` flag, `isBlocked()` in fetch+XHR hooks)
- ✅ HAR export (DevTools-compatible, from overflow menu)
- ✅ Cookies copy/paste (from overflow menu)
- ✅ Bug fix: `injected.js` fetch hook was missing `isBlocked()` call — now fixed

### Fixed during smoke-test
- Bug: injected.js sent relative URLs to the background; the background re-normalized them with a placeholder base (`http://local.local`) — producing a different hash than the MAIN-world matcher computed at replay time. Fix: injected.js now computes the hash at record time and passes it through; background uses it as-is, keeping record-hash ≡ replay-hash byte-for-byte.

### Phase-by-phase checklist
- **Phase 1 (Core):** Recording, API list UI, toggle mock, strict matching, response editing — ✅
- **Phase 2:** Search/filter, latency simulation, error simulation — ✅
- **Phase 3:** Export/import with strategy, conflict handling UI with version picker, CORS toggle — ✅

## Non-goals (v1)
GraphQL / WebSocket mocking, cloud sync, AI-generated mocks, complex rule engines — intentionally deferred. Schema is extensible (hash key is the swappable abstraction point).

## Prioritized Backlog
- **P0** — None outstanding; all PRD phases + v1.4 features shipped.
- **P2** — WebSocket/SSE *mocking* (capture works; replay not yet built).
- **P2** — GraphQL / WebSocket mocking, cloud sync, AI-generated mocks.
- **P3** — Chrome Web Store submission (manual upload from `/app/store` with $5 dev account).
- **P3** — Freemium/Stripe gating if monetization is needed.

## Next Action Items
1. Side-load `/app/extension` via `chrome://extensions` → Load unpacked.
2. Smoke-test: record a page, toggle MOCK, verify responses are mocked; test ⊘ blocking, HAR export, cookies copy/paste.
3. Optional: Implement WebSocket mock replay (P2).

## Architecture (summary)
```
injected.js (MAIN) ←postMessage→ content.js (ISOLATED) ←runtime→ background.js (SW)
                                                                       │
                                                           IndexedDB + DNR rules
popup/popup.js  ─┐
devtools/panel.js ┴─► shared/app.js (single UI module, mode-switched)
```

Matching: `FNV1a(METHOD | normalizeUrl(url) | normalizeBody(body))` → `hash`. Latest-timestamp version wins unless user pinned.
