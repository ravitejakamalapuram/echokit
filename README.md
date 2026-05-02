# EchoKit

> **Record once. Mock reliably. Debug faster.**

A zero-setup Chrome extension that lets frontend devs & QA engineers **record** real `fetch` / `XMLHttpRequest` traffic from any tab and instantly **mock** any of it back — with strict matching, editable responses, latency + error simulation, conflict resolution, export/import, and a CORS override toggle.

Two UI surfaces sharing the same module:
- **Popup** (400×600) — click the toolbar icon.
- **DevTools panel** — opens next to Network/Console as an **EchoKit** tab.

## Install (unpacked)

1. `git clone https://github.com/ravitejakamalapuram/echokit.git`
2. Open `chrome://extensions` → toggle **Developer mode** → **Load unpacked** → pick `echokit/extension/`.
3. Pin the icon, hit **● REC**, use your app, toggle **MOCK** on — done.

See [`extension/README.md`](extension/README.md) for the full architecture, feature map, and the 30-second flow.

## Repo layout

```
echokit/
├── extension/            # Chrome MV3 extension (the actual product)
│   ├── manifest.json
│   ├── background.js     # service worker: IndexedDB + state + DNR
│   ├── injected.js       # MAIN-world fetch/XHR hook
│   ├── content.js        # isolated-world bridge
│   ├── popup/            # 400×600 popup surface
│   ├── devtools/         # DevTools panel surface
│   └── shared/           # single UI module + design tokens + matcher + store
├── tests/
│   └── smoke_echokit.py  # Playwright end-to-end smoke test (24 assertions)
├── memory/
│   └── PRD.md            # living product spec
└── README.md
```

## Run the end-to-end smoke test

```bash
pip install playwright && python3 -m playwright install chromium
sudo apt-get install -y xvfb xauth
xvfb-run -a python3 tests/smoke_echokit.py
```

It spins up a local HTTP server, loads the unpacked extension in headed Chromium via xvfb, drives fetch + XHR on a test page, and validates the full record → toggle → mock → edit loop.

## Documentation

- [`extension/README.md`](extension/README.md) — extension architecture and feature map
- [`TODO.md`](TODO.md) — living roadmap and backlog
- [`docs/internal/`](docs/internal/README.md) — internal project docs (deployment, status, design history, architecture)
- [`docs/`](docs/) — public-facing website assets (HTML pages: pricing, FAQ, privacy)

## License

MIT — use it however you like.
