# EchoKit — AI Agent Instructions

> This file is auto-loaded by Claude Code, Cursor, and GitHub Copilot.  
> **Read it completely before writing any code or documentation.**  
> Full rules with examples live in [`DEVELOPMENT_RULES.md`](DEVELOPMENT_RULES.md).

---

## Read these files first — in this order

```
README.md                  → repo overview and folder structure
extension/README.md        → extension architecture, feature map, file layout
TODO.md                    → roadmap; do NOT build what is marked deferred
specs/PRD.md               → what has shipped vs. what is backlog
CHANGELOG.md               → version history
DEVELOPMENT_RULES.md       → comprehensive code rules and checklists
```

---

## Folder structure — fixed, do not reorganize

```
extension/    Chrome MV3 source — JS/HTML/CSS/icons only
cli/          Node.js CLI server source (npm: echokit-server)
worker/       Cloudflare Worker source (HMAC license validation)
tests/        All automated test files
scripts/      Build and deploy shell/Python scripts
website/      Public HTML/CSS — served by Cloudflare Pages
docs/         Contributor documentation — NOT served publicly
store/        Chrome Web Store assets and release zips
design/       UI mockups and design prototypes
specs/        Living product specs, PRDs, feature designs
```

Root files allowed: `README.md`, `CHANGELOG.md`, `TODO.md`, `CONTRIBUTING.md`, `DEVELOPMENT_RULES.md`, `CLAUDE.md`, `LICENSE`. **Do not add more.**

---

## Stale paths — always use the right column

| ❌ Old (stale — never write this) | ✅ Current |
|-----------------------------------|-----------|
| `docs/internal/` | `docs/` |
| `memory/` | `specs/` |
| `/app/extension/` | `extension/` |
| `/app/cli/` | `cli/` |
| `/app/scripts/` | `scripts/` |
| `rules.md` / `CODING_RULES.md` | `DEVELOPMENT_RULES.md` |

---

## Hard rules — no exceptions

### Never do these
- ❌ Delete files — move to `docs/archive/` instead
- ❌ Rename existing `echokit:*` message types — breaks all existing installations
- ❌ Change `shared/matcher.js` behaviour without a migration — all recorded mocks break silently
- ❌ Add npm dependencies to `cli/` — it is intentionally zero-dependency
- ❌ Add new `manifest.json` permissions without an explicit instruction
- ❌ Touch `extension/manifest.json` version without being explicitly told to release
- ❌ Create `IMPLEMENTATION.md`, `DESIGN.md`, `NOTES.md`, `PLAN.md`, `SUMMARY.md` or any working-notes file — they rot immediately
- ❌ DOM access in `background.js` — it is a service worker with no DOM
- ❌ `localStorage` in the service worker
- ❌ Reorganise in one shot — `shared/app.js` is ~2800 lines; changes must be incremental

### Always do these
- ✅ Scope-filter every interaction query: `getVisibleInteractions(tabId, host, scope)` not `getAllInteractions()`
- ✅ Wrap all `JSON.parse`, storage reads, and network calls in try-catch
- ✅ Debounce text inputs at `DEBOUNCE_DELAY` (300 ms)
- ✅ Use `softRenderList()` for filter/search updates — never `render()` on keypress
- ✅ Follow the `echokit:category:action` message type convention
- ✅ Use `FEATURES[mode].featureName` flags for popup vs. DevTools differences

---

## When you ship a feature — update all of these

1. `extension/manifest.json` — bump the version (patch/minor/major)
2. `extension/README.md` — add a row to the correct feature table
3. `TODO.md` — mark the item `[x]` done
4. `CHANGELOG.md` — add entry under `[Unreleased]`
5. Inline JSDoc on new public functions
6. `specs/` — only if this is a major standalone feature

---

## Architecture in 30 seconds

```
injected.js  (MAIN world)     hooks window.fetch + XHR; holds mock cache
    ↕ postMessage
content.js   (ISOLATED world) message bridge
    ↕ chrome.runtime
background.js (Service Worker) IndexedDB, tab state, DNR rules, license
    ↕ chrome.runtime
popup/panel  (Extension page)  both use shared/app.js with mode='popup'|'devtools'
```

**Hash pipeline** (record ≡ replay — never break silently):
```
hash = FNV1a(`${METHOD}|${normalizeUrl(url)}|${normalizeBody(body)}`)
```

**Storage strategy:**
- `chrome.storage.sync` → settings (8 KB limit)
- IndexedDB (`store.js`) → all interactions
- `chrome.storage.session` → per-tab recording/mocking state

---

## Test commands

```bash
python3 tests/smoke_echokit.py   # E2E smoke tests (87 assertions)
node cli/test/test.js             # CLI unit tests (7 assertions)
bash scripts/build-store-zip.sh  # Build Chrome Web Store zip
```

---

## Decision log — why things are the way they are

| Decision | Reason |
|----------|--------|
| MAIN world injection | Only way to override `window.fetch` so the page sees mocks |
| Synchronous mock lookup | No round-trip per request — mock index is pushed to injected.js in-memory |
| IndexedDB over chrome.storage | Scales past 10 MB; service worker can use `self.indexedDB` directly |
| Zero-dep CLI | Works in any CI with just Node; no install step |
| Stateless HMAC worker | No database needed; license validated cryptographically |
| `docs/` for contributor docs | Separated from `website/` so nothing internal is ever served publicly |

---

*Full rules, code examples, and checklists: [`DEVELOPMENT_RULES.md`](DEVELOPMENT_RULES.md)*
