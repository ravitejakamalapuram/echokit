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
3. Click **Load unpacked** and pick the `/app/extension` folder.
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

## Feature map (PRD phases)

| Phase | Feature | Status |
|-------|---------|--------|
| 1 | Record `fetch` + `XMLHttpRequest` per tab | ✅ |
| 1 | Strict matching — `method` + normalized URL + normalized body (FNV-1a hash) | ✅ |
| 1 | Per-API mock toggle + master toggle per tab | ✅ |
| 1 | Raw JSON editor for response body, status code, headers | ✅ |
| 1 | Domain grouping, API list UI, prominent Mock-Active banner | ✅ |
| 2 | Search (URL substring) + method chips + status filter | ✅ |
| 2 | Latency simulation (ms slider) per API | ✅ |
| 2 | Error simulation per API: `4xx`, `5xx`, network failure, timeout | ✅ |
| 3 | Export / Import mocks as JSON (merge or override strategy) | ✅ |
| 3 | Conflict handling — multi-version badge + version dropdown (latest wins by default) | ✅ |
| 3 | CORS override toggle (declarativeNetRequest dynamic rules) | ✅ |
| future | GraphQL / WebSockets | schema is extensible (hash key is swappable) |

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

Toggling CORS in Settings installs a dynamic `declarativeNetRequest` rule that rewrites `Access-Control-Allow-*` headers on real responses. Mocked responses always include permissive CORS headers by default.

---

## File layout

```
extension/
├── manifest.json
├── background.js          # service worker (module)
├── content.js             # isolated-world bridge
├── injected.js            # MAIN-world fetch/XHR hook
├── popup/
│   ├── popup.html
│   └── popup.js
├── devtools/
│   ├── devtools.html      # creates the DevTools panel
│   ├── devtools.js
│   ├── panel.html
│   └── panel.js
├── shared/
│   ├── app.js             # single UI module (both surfaces)
│   ├── styles.css         # design tokens + components
│   ├── matcher.js         # hash + normalization (used by background)
│   └── store.js           # IndexedDB wrapper (used by background)
├── icons/ (16/48/128.png)
└── README.md
```

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
