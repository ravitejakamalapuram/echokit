# EchoKit — Chrome Extension

> **Record once. Mock reliably. Debug faster.**

A zero-setup Chrome extension that lets frontend devs & QA engineers **record** real `fetch` / `XMLHttpRequest` traffic in the browser and instantly **mock** any of it back — with strict matching, editable responses, latency & error simulation, conflict resolution, export/import, and a CORS override toggle.

Available in **two surfaces** (same data, same controls):

- **Popup** — click the toolbar icon for a compact 400×600 panel.
- **DevTools panel** — open DevTools → **EchoKit** tab for a wide two-pane view.

---

## Install (unpacked, dev mode)

1. Open `chrome://extensions` in Chrome / Edge / Brave / Arc.
2. Toggle **Developer mode** ON (top-right).
3. Click **Load unpacked** and pick the `extension/` folder from this repository.
4. Pin the EchoKit icon from the toolbar puzzle menu.

That's it — no backend, no accounts, no setup.

---

## How to use it (the 30-second flow)

1. Open the tab you want to record.
2. Click the EchoKit icon → press **● REC**.
3. Use the app normally — every `fetch` / `XHR` call is captured.
4. Hit **STOP**. Flip the master **MOCK** switch on.
5. Tap any request, edit the body / status / headers / latency / error mode.
6. Reload the page — the app now hits your mocks instead of the network.

The giant amber **MOCKING ACTIVE** banner guarantees you always know which mode you're in.

---

## Feature map

### Core (v1.0–v1.3)

| Feature | Status |
|---------|--------|
| Record `fetch` + `XMLHttpRequest` per tab | ✅ |
| Strict matching — `method` + normalized URL + normalized body (FNV-1a hash) | ✅ |
| Six match modes: strict, ignore-query, ignore-body, path-wildcard, graphql, graphql-op | ✅ |
| Per-API mock toggle + master toggle per tab | ✅ |
| Raw JSON editor — response body, status code, headers | ✅ |
| Domain grouping, API list UI, prominent MOCKING ACTIVE amber banner | ✅ |
| URL search + method chips + status bucket filter | ✅ |
| Latency simulation (ms slider) | ✅ |
| Error simulation: `4xx`, `5xx`, network failure, timeout | ✅ |
| Export / Import mocks as JSON (merge or override strategy) | ✅ |
| Conflict handling — multi-version badge + version dropdown (latest wins by default) | ✅ |
| CORS override toggle (scope-aware `declarativeNetRequest` dynamic rules) | ✅ |
| WebSocket / SSE mock replay (frame-timed, loop mode) | ✅ |

### Pro features (v1.4–v1.5)

| Feature | Status |
|---------|--------|
| Freemium gating — 50-request free limit; Pro unlocked via license key | ✅ |
| 7-day Pro trial automatically granted on install | ✅ |
| License key system — `chrome.storage.sync`, validated via Cloudflare Worker (HMAC-SHA256), 24h cache | ✅ |
| HAR import — convert Chrome HAR exports into mock interactions | ✅ |
| Postman Collection v2.1 export | ✅ |
| OpenAPI / Swagger 2 import — auto-creates interactions from `paths × methods` | ✅ |
| Conditional mock — `mockMaxCount` fires mock N times then passes through | ✅ |
| Mock chaining — N response steps, cursor advances on each hit, optional loop | ✅ |
| API blocking — block specific requests from reaching the network | ✅ |

### Advanced / Debugging (v1.6+)

| Feature | Status |
|---------|--------|
| Global request headers — inject/override/remove headers on all outgoing requests (supports URL pattern filtering) | ✅ |
| URL rewrite rules — substring or `/regex/flags` applied to outgoing fetch URLs | ✅ |
| Response transform rules — add/remove header, set body, regex-replace body on mocked responses | ✅ |
| Network waterfall visualizer — timeline view with method, path, status, duration bars | ✅ |
| API source visibility badges — distinguish mocked vs real vs blocked responses | ✅ |
| GitHub Gist sync (Pro) — backup and share mock sets | ✅ |
| Cookie read/write bridge, localStorage read/write bridge | ✅ |

### Keyboard shortcuts

| Shortcut | Action |
|----------|--------|
| `Alt+Shift+R` | Toggle recording |
| `Alt+Shift+M` | Toggle MOCK mode |
| `Alt+Shift+E` | Open popup |

### Non-goals (v1)

Per the PRD — intentionally deferred: complex GraphQL rule engines, cloud sync backend, AI-generated mocks, visual rule builders.

---

## Architecture

```
┌───────────────────────┐  postMessage  ┌───────────────────┐ runtime ┌────────────────────────┐
│ injected.js (MAIN)    │ ────────────► │ content.js (ISO)  │ ──────► │ background.js (SW)     │
│ hooks fetch + XHR     │ ◄──────────── │ bridge            │ ◄────── │ IndexedDB + state +    │
│ keeps mock cache      │   mockIndex   │                   │         │ DNR (CORS), cache push │
└───────────────────────┘               └───────────────────┘         └────────────────────────┘
                                                                         ▲
                                                                         │ runtime.sendMessage
                                                                         │
                                                       ┌─────────────────┴──────────────────┐
                                                       │ popup/popup.js  +  devtools/panel  │
                                                       │   → shared/app.js (one UI module)  │
                                                       └────────────────────────────────────┘
```

### Why this shape?

- **MAIN world injection** is required to override `window.fetch` and `XMLHttpRequest` so the page sees mocks. The isolated content script can't reach page globals.
- **Synchronous mock lookup** — the MAIN-world script holds a pushed in-memory `mockIndex`; no round-trip per request.
- **IndexedDB in the service worker** — scales well beyond `chrome.storage.local`'s 10 MB limit, and the worker can use `self.indexedDB` directly.
- **Per-tab session state** lives in `chrome.storage.session` so it survives SW restarts but clears on browser close.

### Strict matching key

```
hash = FNV1a(`${METHOD}|${normalizeUrl(url)}|${normalizeBody(body)}`)
```

- URL is parsed; query params are sorted; hash fragment dropped.
- Body: JSON is `stableStringify`-ed (sorted keys); FormData / URLSearchParams are sorted; blobs/buffers use a size-tagged placeholder.
- If multiple interactions share a hash → **latest timestamp wins** unless the user picked a specific version.

### CORS override

Toggling CORS in Settings installs `declarativeNetRequest` rules that rewrite `Access-Control-Allow-Origin: *`, `Access-Control-Allow-Methods: *`, and `Access-Control-Allow-Headers: *` on real responses. Mocked responses always include permissive CORS headers by default.

**Scope-aware behavior:**
- **Global**: Uses dynamic rules (browser-wide, all tabs)
- **Domain**: Uses session rules with `requestDomains` filter (current domain only)
- **Tab**: Uses session rules with `tabIds` filter (current tab only)

**Implementation notes:**
- We removed `Access-Control-Allow-Credentials: true` because it's mutually exclusive with `Access-Control-Allow-Origin: *` per CORS spec
- Rules are automatically updated when tabs are created/removed/navigated (for tab/domain scopes)
- Use the "🔍 Run Diagnostics" button in settings to verify rules are installed correctly
- Error logging to console when rule installation fails

---

## File layout

```
extension/
├── manifest.json          # MV3 manifest — version, permissions, entry points
├── background.js          # Service worker: IndexedDB, tab state, DNR rules, license
├── content.js             # Isolated-world bridge (page ↔ background messaging)
├── injected.js            # MAIN-world fetch/XHR hook + mock cache
├── popup/
│   ├── popup.html         # Toolbar popup (400×600px)
│   ├── popup.js           # Initialises shared/app.js in popup mode
│   └── diagnostic.js      # Connection diagnostics helper
├── devtools/
│   ├── devtools.html      # Registers the DevTools panel
│   ├── devtools.js        # chrome.devtools.panels.create()
│   ├── panel.html         # Full-screen DevTools panel
│   └── panel.js           # Initialises shared/app.js in devtools mode
├── shared/
│   ├── app.js             # Entire UI (~2800 lines) — mode-aware, both surfaces
│   ├── styles.css         # Design tokens + all UI components
│   ├── matcher.js         # FNV-1a hashing + URL/body normalisation
│   ├── store.js           # IndexedDB wrapper (background-only)
│   └── json-highlight.js  # JSON syntax highlighter for response viewer
├── icons/                 # icon16.png, icon48.png, icon128.png
└── onboarding/
    └── welcome.html       # First-install welcome page
```

> **Tech debt**: `shared/app.js` at ~2800 lines is slated for refactoring (Issue [#8](https://github.com/ravitejakamalapuram/echokit/issues/8)) into modules: `header.js`, `menu.js`, `settings-dialog.js`, `request-detail.js`, `waterfall.js`.

---

## Non-goals (v1)

Per the PRD — intentionally deferred:

- GraphQL / WebSocket mocking (schema is extensible)
- Cloud sync / backend sharing
- AI-generated mocks
- Visual / no-code rule engines

---

## Keyboard & tips

- `MOCK` master switch is scoped **per tab** — one tab can be mocking while another hits the real API.
- The hash of each recording is visible in its detail view — handy for debugging match failures.
- Export → commit the JSON to your repo → teammates import → consistent mocks across the team.
