# EchoKit — TODO / Backlog

Living roadmap. Anything below this line is fair game for the next session.
Each item has enough context to resume without re-reading the codebase.

Legend: 🔴 P0 critical · 🟠 P1 high · 🟡 P2 nice-to-have · 🟢 P3 polish · 💡 idea

---

## 🔴 P0 — Ship blockers / must-do next

- [x] **Deploy the Cloudflare Worker** ✅
  - Worker deployed: `https://echokit-license.echokit-rk.workers.dev`
  - Secrets configured: ECHOKIT_HMAC_SECRET and ECHOKIT_ADMIN_TOKEN
  - Health check passing: `{"ok":true}`
  - Helper scripts created: `worker/issue-license.sh`, `worker/verify-deployment.sh`
  - Documentation: `WORKER_EXPLAINED.md`

- [ ] **Mint real license keys** for paying customers
  - Hit `POST <worker-url>/v1/issue` with `Authorization: Bearer <ECHOKIT_ADMIN_TOKEN>` and `{plan:"PRO"|"YEAR"|"LTD", expiresAt:<unix>}`. For LTD set `expiresAt:0`.
  - Hook this into the payment flow (Stripe webhook → call `/v1/issue` → email key).
  - **NEW**: Consider LemonSqueezy integration (easier global payments, tax handling, better UX)
    - Already has Stripe webhook implemented in `worker.js`
    - LemonSqueezy webhook would be similar: `POST /v1/lemonsqueezy-webhook`
    - Benefits: Merchant of Record, automatic tax/VAT, better for global SaaS
    - See: `worker/LEMONSQUEEZY_INTEGRATION.md` (to be created)

- [x] **Publish `echokit-server` to npm** ✅
  - Published: `echokit-server@1.0.0` live on npm
  - Link: https://www.npmjs.com/package/echokit-server
  - Users can install: `npx echokit-server --help`

- [ ] **Upload `/app/store/echokit-api-recorder-mocker-v1.6.0.zip` to Chrome Web Store**
  - Dev console: <https://chrome.google.com/webstore/devconsole>
  - Listing copy lives in `/app/store/chrome-web-store.md`

---

## 🟠 P1 — High-value next features

- [x] **WebSocket / SSE replay correctness pass** ✅
  - Implemented ping/pong keep-alive (opcodes 0x9/0xA)
  - Clean close frame handling (opcode 0x8)
  - Support for large payloads >64KB (8-byte length encoding)
  - Binary frame support (opcode 0x2)
  - Proper FIN bit handling and frame parsing
  - See: `cli/lib/server.js` `encodeWSFrame`, `handleWSUpgrade`

- [x] **License-endpoint UI** in extension Settings ✅
  - Added input row in `app.js` `showSettingsDialog()` after License Key
  - Saves to `chrome.storage.sync` via `BG({ type: 'echokit:license:setEndpoint' })`
  - "Test" button validates `<endpoint>/__health`
  - See: `extension/shared/app.js` lines 1380-1392, 1523-1567

- [x] **Add `--report` UX polish** ✅
  - Colored terminal output with ANSI codes (green/yellow/red)
  - Beautiful box-drawing characters for report sections
  - `--report-format markdown` for human-readable CI logs
  - `printCoverageSummary()` and `buildMarkdownReport()` functions
  - See: `cli/lib/server.js`, `cli/bin/echokit-server.js`

- [x] **Bundled GitHub Action** ✅
  - Created reusable composite action at `.github/echokit-action.yml`
  - Two-step lifecycle: start/stop modes
  - Automatic PR comment with coverage report
  - Complete docs in `.github/ECHOKIT_ACTION_README.md`
  - Ready to publish at `github.com/ravitejakamalapuram/echokit-action`

- [x] **Stripe → license auto-issue webhook** ✅
  - Worker endpoint `POST /v1/stripe-webhook` implemented
  - Parses `checkout.session.completed` and `payment_intent.succeeded`
  - Auto-issues keys based on `echokit_plan` metadata
  - Logs for manual email follow-up (Resend integration ready)
  - See: `worker/worker.js` lines 105-169

- [ ] **LemonSqueezy integration** 🌍 **RECOMMENDED for global sales**
  - Add `POST /v1/lemonsqueezy-webhook` endpoint
  - Easier than Stripe: Merchant of Record handles ALL tax/VAT globally
  - No need to register in 50+ countries, no tax compliance headaches
  - Better webhooks, simpler API, faster to production
  - Can run alongside Stripe (dual webhooks for gradual migration)
  - Implementation guide: `worker/LEMONSQUEEZY_INTEGRATION.md`
  - Estimated time: 30 minutes (vs hours for Stripe tax setup)

---

## 🟡 P2 — Quality & UX improvements

- [ ] **Refactor `extension/shared/app.js`** (currently ~1700 LOC)
  - Suggested split: `header.js` · `menu.js` · `settings-dialog.js` · `request-detail.js` · `waterfall.js` · `gist-sync.js`
  - Use ES modules; `popup.js` and `panel.js` import the entry point
  - Each module < 250 LOC

- [ ] **Mock-templating** (Pro)
  - Allow `{{faker.name}}`, `{{request.body.userId}}`, `{{$randomInt(1,100)}}` in mock body
  - Substitute at serve-time in both extension and CLI
  - Implementation: tiny tag parser in `injected.js` + `cli/lib/template.js`

- [ ] **Per-request scripts (Pro)**
  - Like Postman pre-request / test scripts. Tiny VM in extension service worker (no eval — use `Function` or `vm-shim`)
  - Surfaced as a "Script" tab in the request detail panel

- [ ] **Auto-import from common API specs**
  - Postman Collection v2.1 → done (export only). Add **import**.
  - Insomnia exports
  - HTTP Archive (HAR) → already done

- [ ] **Branching scenarios**
  - "Login flow": chain mocks across multiple endpoints with shared state
  - State stored in `interaction.scenario` field; mocks gated by `scenario === active`

- [ ] **Test coverage badge generator**
  - `echokit-server --badge ./coverage.svg` writes a Shields.io-style SVG so users can put a coverage badge in their README

- [ ] **Settings: import/export config**
  - Backup + restore: rewriteRules, transformRules, blocklist, scope, theme, license endpoint

- [ ] **Search by request body / response body**
  - Currently search only matches URL. Add a toggle for full-text body search.

- [ ] **Diff view for multiple versions**
  - When a request has N versions, show a side-by-side JSON diff between them

- [ ] **Mock from cURL paste**
  - Paste a `curl …` command into a dialog → parse → create a mock interaction
  - Useful when devs receive curl examples from API docs / Slack

- [ ] **Mock-from-JSON-Schema**
  - Paste a JSON Schema → generate a fake-data mock body that conforms
  - Use `json-schema-faker` or hand-written tiny generator (zero dep)

---

## 🟢 P3 — Polish / smaller wins

- [ ] **Onboarding tour** (extension)
  - First install → highlight Record button → mock toggle → settings
  - Use `/app/extension/onboarding/welcome.html` as starting point

- [ ] **Keyboard shortcuts modal**
  - Already exists. Add: `/` to focus search, `Esc` to close detail, `j/k` to nav rows.

- [ ] **Light theme polish**
  - Some `--text-muted` reads as too-light grey. Audit contrast at `chrome://extensions/?id=…`.

- [ ] **Dark/light icon variants** for the toolbar (currently single set)

- [ ] **i18n scaffolding**
  - `chrome.i18n` API. Start with English; structure JSON for community translations.

- [ ] **DevTools panel: separate "Coverage" tab**
  - Re-uses the same coverage report as the CLI but live. "13/20 mocks hit this session."

- [ ] **Coverage diff between runs**
  - `echokit-server --report a.json` then `--diff-against a.json` flags newly unused/missing mocks

- [ ] **Postman → EchoKit migration helper**
  - Already export Postman. Add a "convert your Postman collection to EchoKit mocks" CLI: `echokit-server import-postman <coll.json>`

- [ ] **VS Code extension** (long shot)
  - Right-click in test files → "Open in EchoKit"; show coverage gutters from `echokit-coverage.json`

---

## 💡 Ideas / blue-sky

- [ ] **AI-powered mock generation**
  - "Generate 10 plausible user records matching this schema" — call user's own LLM via `Bring Your Own Key`
  - Or use the Emergent LLM key as a paid Pro perk

- [ ] **Replay from production traces**
  - Import OpenTelemetry / Datadog traces → auto-build mocks for the dependencies a service called

- [ ] **Mock-as-contract**
  - Recorded mocks as the source-of-truth contract; generate TypeScript types from them
  - `echokit-server types ./mocks.json --out types.ts`

- [ ] **Team sharing layer**
  - Right now: GitHub Gist sync (Pro). Could add: shared Worker-backed namespaces so a team's mocks live in one place
  - Backend on Cloudflare D1 or KV

- [ ] **Plugin API**
  - Let users write small JS modules that mutate requests/responses based on app-specific logic. Worker-side or extension-side.

- [ ] **Mock recording from CI**
  - Reverse: record a real backend in CI (against staging) → write to a baseline JSON → diff against last commit's baseline to detect API changes (a contract-test substitute)

- [ ] **Browser-DevTools-like timeline waterfall**
  - Current waterfall shows req duration. Add: request initiator stack trace, request size, transfer time, mock vs real coloring.

- [ ] **Conditional mocks based on request headers / body content**
  - "If `Authorization` header is missing → 401, else → 200"
  - Tiny rule engine on top of the existing match modes

---

## 📦 Repo hygiene

- [ ] **CI for the repo itself**
  - GitHub Action that runs:
    - `node /app/cli/test/test.js`
    - `node /app/worker/test.js`
    - `xvfb-run python3 /app/tests/smoke_echokit.py` (needs xvfb + chromium in the runner)
  - Currently only run manually before push.

- [ ] **CHANGELOG.md** at repo root, generated from commit messages on tagged releases

- [ ] **Versioning automation**
  - Tag `v1.x.x` → auto-build store zip + draft GitHub release with the zip attached + auto-publish CLI

- [ ] **Move pricing page from `/app/docs/pricing.html` to a real site (echokit.dev)**
  - Current page is plain HTML; consider a Next/Astro static site for SEO

---

## 🔧 Known limitations / tech debt

- `app.js` `showSettingsDialog()` reopens the modal on every change to refresh the rendered list (cheap, but causes a brief flicker). Switch to in-place DOM patches.
- `injected.js` chain advancement relies on `pushAllTabs()` round-trip after each hit. Under high request rates this can race. Consider batching cursor updates.
- CLI `match.js` requires interactions to have `matchKeys` baked in. If users hand-edit exports without keys, we re-compute, but the URL normalizer treats `http://_/` as the base — fine for relative paths, brittle for absolute URLs with mismatched origins.
- Worker has no rate limiting. Add Cloudflare's built-in rate-limit rules in the dashboard before going public.

---

_Last updated: Feb 2026 — see `git log` for commit-level history._
