# EchoKit — Development Rules & Guidelines

**Version**: 3.0  
**Last Updated**: 2026-05-19  
**Purpose**: Authoritative rules for any contributor or AI agent working on EchoKit. Read this before writing a single line of code or documentation.

---

## 📚 Table of Contents

- [AI Agent Instructions](#-ai-agent-instructions) ← **read this first if you are an AI**
- [Project Structure](#-project-structure)
- [Core Principles](#-core-principles)
- [Code Writing Rules](#-code-writing-rules)
- [Chrome Extension Rules](#-chrome-extension-specific-rules)
- [Documentation Rules](#-documentation-rules)
- [PR Review Checklist](#-pr-review-phase)
- [Merge Checklist](#-merge-phase)
- [Common Mistakes](#-common-mistakes-to-avoid)
- [Key References](#-key-references)

---

## 🤖 AI Agent Instructions

> **If you are an AI assistant working on this project — read this section completely before doing anything else.**

### Understand the project first

Before making any changes, read these files in order:
1. `README.md` — project overview and repository structure
2. `extension/README.md` — extension architecture, feature map, file layout
3. `TODO.md` — current priorities; don't implement things that are explicitly deferred
4. `specs/PRD.md` — what has shipped vs. what is backlog
5. `CHANGELOG.md` — version history

### Folder structure is fixed — do not reorganize

The folder layout below is intentional and final. Do not move files between folders, rename folders, or create new top-level directories without an explicit instruction.

```
extension/      ← Chrome MV3 source code only
cli/            ← Node.js CLI server source only
worker/         ← Cloudflare Worker source only
tests/          ← All automated test files
scripts/        ← Shell and Python build/deploy scripts
website/        ← Public HTML/CSS files served by Cloudflare Pages
docs/           ← Internal contributor documentation (NOT served publicly)
store/          ← Chrome Web Store listing assets and release zips
design/         ← UI mockups and design prototypes
specs/          ← Living product specs, PRDs, and feature designs
```

### File creation rules for AI agents

**Before creating any file, ask**: does a file that already covers this exist?

| What you want to create | Where it goes instead |
|------------------------|----------------------|
| Implementation notes for a feature | Inline JSDoc in the source file |
| A new design decision | `specs/` — only if it's a major feature |
| A new deployment step | `docs/deployment/` — append to existing file if possible |
| Any `.md` file in the root | Only `README.md`, `CLAUDE.md`, `CONTRIBUTING.md`, `DEVELOPMENT_RULES.md`, `CHANGELOG.md`, `TODO.md`, `LICENSE` belong at root. Do not add others. |
| A new HTML/CSS file for the public site | `website/` |
| A new contributor guide | `docs/` |

**Never create**: `IMPLEMENTATION.md`, `DESIGN.md`, `NOTES.md`, `SUMMARY.md`, `PLAN.md`, `ANALYSIS.md`, `STATUS.md`, or any similar working-notes file. These rot immediately.

### What to update when you ship a feature

1. `extension/manifest.json` — bump the version
2. `extension/README.md` — add to the feature map table under the correct version group
3. `TODO.md` — mark the item `[x]` done
4. `CHANGELOG.md` — add the feature under `[Unreleased]` or the correct version section
5. If it's a major feature: add a spec to `specs/`
6. Do NOT update `specs/PRD.md` "What's Been Implemented" sections — those are frozen historical records

### Stale path reference — always use these

| Old path (stale, never use) | Correct path |
|-----------------------------|-------------|
| `docs/internal/` | `docs/` |
| `memory/` | `specs/` |
| `/app/extension/` | `extension/` |
| `/app/cli/` | `cli/` |
| `/app/scripts/` | `scripts/` |
| `rules.md`, `CODING_RULES.md` | `DEVELOPMENT_RULES.md` |

### Behavior rules for AI agents

- **Never delete files** — move to `docs/archive/` if truly obsolete; the user will clean up
- **Never refactor** `extension/shared/app.js` in one shot — it's 2800 lines; changes must be incremental and scoped
- **Never change the Chrome extension version** in `manifest.json` without an explicit instruction
- **Never add npm dependencies** to the CLI without explicit approval — it is intentionally zero-dependency
- **Always run tests mentally** — before proposing any change to `injected.js`, `matcher.js`, or `store.js`, trace the impact on the recording → replay hash pipeline
- **Prefer editing existing files** over creating new ones
- **When uncertain**, describe what you're about to do and ask before acting

---

## 📁 Project Structure

The authoritative folder layout. Any deviation from this is a bug.

```
echokit/
│
│  ── SOURCE CODE ─────────────────────────────────────────────────────
├── extension/              Chrome MV3 extension
│   ├── manifest.json       Version, permissions, entry points
│   ├── background.js       Service worker: IndexedDB, state, DNR, license
│   ├── injected.js         MAIN-world fetch/XHR interception + mock cache
│   ├── content.js          ISOLATED-world message bridge
│   ├── popup/              Toolbar popup UI (400×600px)
│   ├── devtools/           DevTools panel UI
│   ├── shared/
│   │   ├── app.js          Entire UI (~2800 lines) — both surfaces
│   │   ├── styles.css      Design tokens + all UI components
│   │   ├── matcher.js      FNV-1a hashing + URL/body normalisation
│   │   ├── store.js        IndexedDB wrapper (background only)
│   │   └── json-highlight.js  JSON syntax highlighter
│   ├── icons/              icon16, icon48, icon128
│   └── onboarding/         First-install welcome page
│
├── cli/                    echokit-server (npm package)
│   ├── bin/echokit-server.js
│   ├── lib/                Server + matcher logic
│   └── test/               CLI unit tests
│
├── worker/                 Cloudflare Worker — HMAC license validation
│   ├── worker.js
│   └── wrangler.toml
│
│  ── TESTS ─────────────────────────────────────────────────────────────
├── tests/
│   ├── smoke_echokit.py    Playwright E2E (87 assertions)
│   ├── debug_extension.py  Extension debug helper
│   ├── test_imports.js     Import validation
│   └── test_validation.js  Input validation
│
│  ── SCRIPTS ────────────────────────────────────────────────────────────
├── scripts/
│   ├── build-store-zip.sh  Chrome Web Store zip builder
│   ├── test-cws-auth.sh    CWS OAuth credential tester
│   ├── setup/              One-time infrastructure setup scripts
│   └── tools/              Developer utilities
│       └── generate_screenshots.py
│
│  ── WEB ASSETS (served by Cloudflare Pages) ───────────────────────────
├── website/
│   ├── index.html
│   ├── docs.html
│   ├── pricing.html
│   ├── faq.html
│   ├── changelog.html
│   ├── simulator.html
│   ├── privacy.html
│   └── style.css
│
│  ── CONTRIBUTOR DOCS (never served publicly) ──────────────────────────
├── docs/
│   ├── architecture/       System design deep-dives
│   ├── deployment/         CI/CD, hosting, Chrome publishing
│   ├── design/             Design system history
│   ├── github/             GitHub Actions setup docs
│   ├── research/           Testing framework research
│   ├── testing/            Manual test plans
│   ├── troubleshooting/    Debug guides
│   └── archive/            Completed/superseded docs (read-only)
│
│  ── STORE ASSETS ──────────────────────────────────────────────────────
├── store/                  Chrome Web Store assets and release zips
│
│  ── DESIGN PROTOTYPES ──────────────────────────────────────────────────
├── design/                 HTML mockups and design system prototypes
│
│  ── PRODUCT SPECS ──────────────────────────────────────────────────────
├── specs/                  Living product specs and feature designs
│
│  ── ROOT FILES (complete — do not add more) ────────────────────────────
├── README.md
├── CHANGELOG.md
├── TODO.md
├── CONTRIBUTING.md
├── DEVELOPMENT_RULES.md    ← you are here
└── LICENSE
```

---

## 🎯 Core Principles

### 1. Zero Breaking Changes
- **Rule**: Never break existing functionality without explicit approval
- **Check**: Test backward compatibility before merging
- **Example**: Keep old message types when adding new ones; never rename `echokit:*` event names
- **Why**: EchoKit has public users on the Chrome Web Store; silent breakage destroys trust

### 2. Performance First
- **Rule**: Optimize for performance from the start, not as a retrofit
- **Check**: Every change must handle 1000+ recorded interactions without lag
- **Examples**: Debounce inputs (300ms), soft-render list updates, batch IndexedDB ops
- **Why**: Extension runs in every tab; performance regressions affect every user, every page load

### 3. Dual Interface Awareness
- **Popup** (400×600px): Simple, quick actions, minimal controls
- **DevTools panel**: Advanced features, unlimited space, power-user tools
- **Rule**: Use the `FEATURES[mode]` flag to control what each surface renders
- **Never**: Show DevTools-only controls in the popup; never hide essential actions behind the panel

### 4. Scope Compliance — Non-negotiable
Every feature that reads or writes interactions **must** respect `settings.scope`:
- `domain` — interactions scoped to origin (default)
- `tab` — strict per-tab sandboxing
- `global` — all tabs see all interactions

Violating scope creates unpredictable behavior and is treated as a critical bug.

### 5. Minimal Surface Area
- Add as little as possible to achieve the goal
- No new files without a reason; no new dependencies without approval
- No new permissions in `manifest.json` without explicit justification
- The smallest correct change is the best change

---

## 📝 Code Writing Rules

### Constants over magic numbers

❌ Bad:
```javascript
setTimeout(() => doSomething(), 300);
```
✅ Good:
```javascript
const DEBOUNCE_DELAY = 300; // ms — standard input debounce
setTimeout(() => doSomething(), DEBOUNCE_DELAY);
```

---

### Error handling on all external input

Every call to `JSON.parse`, `chrome.storage.*`, IndexedDB, or a network endpoint must be wrapped:

```javascript
// ❌ Bad
const data = JSON.parse(userInput);

// ✅ Good
let data;
try {
  data = JSON.parse(userInput);
} catch (e) {
  console.error('[EchoKit] Failed to parse JSON:', e.message);
  showError('Invalid JSON format');
  return;
}
```

**Required for**: `JSON.parse`, all `chrome.storage` ops, IndexedDB reads/writes, license worker calls, import file parsing, URL construction.

---

### JSDoc on all exported and public functions

```javascript
/**
 * Filters interactions by the current scope and UI filter state.
 * @param {Interaction[]} items - Raw interactions from IndexedDB
 * @param {string} tabId - Active tab identifier
 * @param {string} host - Origin hostname
 * @param {ScopeMode} scope - 'tab' | 'domain' | 'global'
 * @param {FilterState} filters - Active UI filters
 * @returns {Interaction[]} Interactions visible in the current context
 */
function filterInteractions(items, tabId, host, scope, filters) { … }
```

---

### Debounce all user text inputs

```javascript
const DEBOUNCE_DELAY = 300; // ms
let debounceTimer;
searchInput.addEventListener('input', (e) => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => softRenderList(e.target.value), DEBOUNCE_DELAY);
});
```

**Apply to**: URL search, any filter input, any text field triggering a list update or storage write.

---

### Soft rendering for list updates

```javascript
// ❌ Bad — full re-render loses scroll position and input cursor
function onFilterChange() { render(); }

// ✅ Good — update only the list node
function onFilterChange() { softRenderList(); }
```

---

### Scope-aware interaction queries

```javascript
// ❌ Bad — ignores scope
const items = await getAllInteractions();

// ✅ Good — always pass scope context
const items = await getVisibleInteractions(tabId, host, settings.scope);
```

---

### Feature flags for surface-specific UI

```javascript
const FEATURES = {
  popup:   { advancedFilters: false, waterfall: false },
  devtools: { advancedFilters: true,  waterfall: true  }
};

// In render logic
if (FEATURES[mode].waterfall) { renderWaterfallToggle(); }
```

---

### File and function size limits

| Unit | Ideal | Warning | Hard limit |
|------|-------|---------|-----------|
| Function | < 50 lines | 100 lines | 150 lines — must refactor |
| File | < 500 lines | 1000 lines | 2000 lines — must split |

**Known tech debt**: `extension/shared/app.js` is ~2800 lines — tracked in [Issue #8](https://github.com/ravitejakamalapuram/echokit/issues/8). Do not make it larger; extract to new module files where possible.

---

### Naming conventions

| Thing | Convention | Example |
|-------|-----------|---------|
| Constants | `SCREAMING_SNAKE_CASE` | `DEBOUNCE_DELAY`, `DB_VERSION` |
| Functions | `camelCase` | `filterInteractions` |
| Variables | `camelCase` | `tabId`, `mockIndex` |
| Message types | `echokit:category:action` | `echokit:mocking:toggle` |
| Private helpers | `_camelCase` | `_buildMatchKey` |

---

### Code style

- 2-space indentation
- No trailing whitespace
- No `console.log` in production paths (unless explicitly logging; add a comment explaining why)
- No commented-out code — use git history
- Descriptive names; single-letter variables only in `for` loop counters

---

## 🛡️ Chrome Extension Specific Rules

### World contexts — never mix them

| File | World | Can access |
|------|-------|-----------|
| `injected.js` | MAIN | `window.fetch`, `XMLHttpRequest`, page globals |
| `content.js` | ISOLATED | `chrome.runtime`, can `postMessage` to MAIN |
| `background.js` | Service Worker | IndexedDB, `chrome.*` APIs, NO DOM |
| `popup/`, `devtools/` | Extension page | `chrome.runtime`, DOM |

**Communication path**: `injected.js` ←postMessage→ `content.js` ←chrome.runtime→ `background.js`

---

### Message type convention

All internal messages follow `echokit:category:action`:

```javascript
// ✅ Correct
{ type: 'echokit:interaction:record' }
{ type: 'echokit:mocking:toggle' }
{ type: 'echokit:license:check' }

// ❌ Wrong — no namespace
{ type: 'toggle' }
{ type: 'updateMock' }
```

---

### Storage strategy — use the right store

| Data | Store | Why |
|------|-------|-----|
| Settings (theme, scope, CORS mode) | `chrome.storage.sync` | Synced across devices; 8KB limit |
| Interactions / recordings | IndexedDB (`store.js`) | Scales beyond storage limits |
| Per-tab session state (recording, mocking) | `chrome.storage.session` | Survives SW restart, clears on browser close |
| License key | `chrome.storage.sync` | Small, needs to persist |

---

### DNR (Declarative Net Request) rules — CORS override

CORS rules are scope-aware. When writing or modifying `syncCorsRules()`:

- **Global**: dynamic rules (all tabs, all domains)
- **Domain**: session rules with `requestDomains` filter
- **Tab**: session rules with `tabIds` filter
- Remove `Access-Control-Allow-Credentials: true` — it is incompatible with `*` origin per CORS spec

---

### Critical MV3 constraints

- ❌ No `eval()` or `new Function()` with dynamic strings
- ❌ No DOM access in `background.js` — it's a service worker
- ❌ No `localStorage` in the service worker
- ❌ No remote scripts — all code must be bundled in the extension package
- ✅ Service worker may be killed at any time; re-initialize all state from storage on each message

---

### Hash pipeline — never break silently

The recording↔replay pipeline depends on the FNV-1a hash being identical at both ends:

```
Record time (injected.js):  hash = FNV1a(`${METHOD}|${normalizeUrl(url)}|${normalizeBody(body)}`)
Replay time (injected.js):  same computation → must produce the same hash
```

Any change to `normalizeUrl`, `normalizeBody`, or `computeHash` in `shared/matcher.js` is a **breaking change** — all existing recorded mocks will stop matching. Such changes require a migration path.

> ⚠️ **Dual maintenance**: `injected.js` contains a hand-inlined copy of the matcher (~100 lines) because the MAIN world cannot use ES module imports. **Any change to `shared/matcher.js` must be manually mirrored into `injected.js`**, and the unit tests in `tests/test-matcher.js` cover the `shared/` version only. Verify behavior parity with the smoke tests after any matcher change.

### IndexedDB schema migrations

`shared/store.js` uses DB version `1`. The `onupgradeneeded` callback only creates stores — there is no migration branch. If you need to add an index or change a store's `keyPath`:

1. Increment `DB_VERSION`.
2. Add a version-guarded migration block inside `onupgradeneeded`:
   ```js
   req.onupgradeneeded = (event) => {
     const db = req.result;
     const oldVersion = event.oldVersion;
     if (oldVersion < 2) { /* migration from v1 to v2 */ }
   };
   ```
3. Test that existing data survives the upgrade — never call `store.clear()` in a migration without explicit approval.

---

## 📄 Documentation Rules

### The documentation hierarchy

```
Code comment / JSDoc      ← for function-level behavior
extension/README.md       ← for extension architecture and feature map
README.md                 ← for project overview and getting started
specs/                    ← for major feature designs and PRDs
docs/                     ← for contributor guides, deployment, troubleshooting
CHANGELOG.md              ← for version history
TODO.md                   ← for roadmap and backlog
```

### When to create a new doc vs. update an existing one

| Situation | Action |
|-----------|--------|
| New function or module | Add JSDoc inline — no new file |
| New CLI flag | Update `cli/README.md` |
| New extension feature | Update `extension/README.md` feature table + `CHANGELOG.md` |
| Architecture decision | Update or add to `docs/architecture/` |
| New deployment step | Update relevant file in `docs/deployment/` |
| Major new feature (spec-worthy) | Add to `specs/` |
| Completed feature doc no longer active | Move to `docs/archive/` |

### Documentation quality standards

- Write for a reader who is unfamiliar with the codebase
- Every code example must be copy-pasteable and correct
- Every link must resolve — verify before committing
- Include "why" not just "what" — motivation matters more than mechanics
- No placeholder text (`TODO: fill this in`) in committed docs

### Keeping CHANGELOG.md current

Every PR that ships user-facing behavior must add an entry under `[Unreleased]`:

```markdown
## [Unreleased]

### Added
- Brief description of new capability

### Fixed
- Brief description of bug fixed

### Changed
- Brief description of behavior change
```

When a version is released, rename `[Unreleased]` to `[X.Y.Z] — Release title` and create a new empty `[Unreleased]` section.

---

## 🔍 PR Review Phase

### Before starting any review

1. ✅ Read `DEVELOPMENT_RULES.md` (this file)
2. ✅ Read `CONTRIBUTING.md` for workflow requirements
3. ✅ Understand what the PR is trying to achieve before reading the diff

### Code quality

- [ ] No magic numbers — all extracted to named constants
- [ ] Error handling — `JSON.parse`, API calls, storage, file ops all wrapped in try-catch
- [ ] JSDoc — all new public functions documented
- [ ] Descriptive names — no single-letter variables outside loops
- [ ] No `console.log` in production paths without explanation
- [ ] File size within limits — no file > 2000 lines; warning flag at 1000
- [ ] Function size within limits — no function > 150 lines; warning at 100

### Performance

- [ ] No unnecessary full re-renders — soft render for list updates
- [ ] Input debounced at 300ms
- [ ] Tested with 1000+ interactions — no lag
- [ ] No memory leaks — event listeners removed, timers cleared
- [ ] IndexedDB operations batched and indexed

### Architecture

- [ ] Follows existing patterns — consistent with codebase conventions
- [ ] Single responsibility — functions do one thing
- [ ] Backward compatible — no message types renamed or removed
- [ ] Scope compliant — all interaction reads/writes use scope context
- [ ] Dual interface — works correctly in both popup and DevTools

### Security

- [ ] No secrets committed — API keys, tokens, credentials
- [ ] Input validated before use
- [ ] CSP compliant — no inline eval or remote scripts
- [ ] No XSS vectors in HTML template strings
- [ ] Minimum permissions — no new `manifest.json` permissions without justification

### Chrome Extension

- [ ] MV3 compliant — no MV2 patterns
- [ ] Service worker safe — no DOM access, no localStorage in background.js
- [ ] Message types follow `echokit:category:action` convention
- [ ] Correct world context — MAIN vs. ISOLATED handled appropriately
- [ ] Storage in the right place — sync/session/IndexedDB used correctly

### Testing

- [ ] Manual testing completed by author
- [ ] Edge cases covered: 0 items, 1 item, 1000+ items, empty state
- [ ] Error scenarios tested: network failure, invalid input, corrupt data
- [ ] Smoke tests pass: `python3 tests/smoke_echokit.py` (87 assertions)
- [ ] Both light and dark themes tested (for UI changes)

### Documentation

- [ ] `extension/README.md` feature table updated (for new features)
- [ ] `CHANGELOG.md` updated under `[Unreleased]`
- [ ] `TODO.md` item marked done
- [ ] No new unnecessary `.md` files created
- [ ] All new functions have JSDoc
- [ ] No broken links introduced

---

## ✅ Merge Phase

### Pre-merge checklist — all must pass

#### Code quality
- [ ] All PR review items approved
- [ ] No unresolved review comments
- [ ] No TODO comments without a corresponding `TODO.md` entry
- [ ] Smoke tests passing: `python3 tests/smoke_echokit.py`
- [ ] CLI tests passing: `node cli/test/test.js`

#### Testing
- [ ] Manual testing documented in the PR description
- [ ] No regressions in existing workflows
- [ ] Performance verified with 1000+ interactions
- [ ] Scope modes tested: tab, domain, global (if scope-related change)

#### Documentation
- [ ] `CHANGELOG.md` has an entry for this change
- [ ] No new root-level `.md` files (only the six allowed ones)
- [ ] No broken doc links
- [ ] Breaking changes clearly documented

#### Security & privacy
- [ ] No credentials committed
- [ ] Privacy policy still accurate
- [ ] No new permissions without justification
- [ ] All external requests use HTTPS

#### Extension-specific
- [ ] `extension/manifest.json` version bumped (if releasing)
- [ ] Extension loads without errors in `chrome://extensions`
- [ ] No console errors in background service worker
- [ ] CORS override functional (if DNR rules changed)

---

### Version bump guidelines

Update `extension/manifest.json` before merging a release:

| Change | Version increment |
|--------|------------------|
| Breaking changes, major new surface | Major (2.0.0) |
| New features, backward compatible | Minor (1.X.0) |
| Bug fixes, polish, minor improvements | Patch (1.0.X) |

---

### Commit message format

```
<type>(<scope>): <subject>

<body — what changed and why>

<footer — closes #issue, breaking changes>
```

**Types**: `feat`, `fix`, `refactor`, `perf`, `docs`, `test`, `chore`

```
feat(waterfall): add method-color-coded bars to timeline view

- Added color constants per HTTP method (GET=green, POST=blue, …)
- Duration bar width calculated from min/max in current view
- Toggle persists across page navigations via chrome.storage.session

Closes #42
```

---

### Post-merge

- [ ] Mark `TODO.md` item as `[x]` complete
- [ ] Update `CHANGELOG.md` — move `[Unreleased]` to versioned section if releasing
- [ ] Create GitHub release if version bumped
- [ ] Upload new zip to Chrome Web Store dev console if releasing
- [ ] Monitor Chrome Web Store reviews for user-reported issues

---

## ⚠️ Common Mistakes to Avoid

### 1. Ignoring scope
```javascript
// ❌ shows everything regardless of user's scope setting
const items = await getAllInteractions();

// ✅ respects scope
const items = await getVisibleInteractions(tabId, host, settings.scope);
```

### 2. Magic numbers
```javascript
// ❌ what is 300?
setTimeout(fn, 300);

// ✅ self-documenting
setTimeout(fn, DEBOUNCE_DELAY);
```

### 3. Naked JSON.parse
```javascript
// ❌ throws on bad input, crashes silently
const obj = JSON.parse(raw);

// ✅ graceful
let obj;
try { obj = JSON.parse(raw); } catch { showError('Invalid JSON'); return; }
```

### 4. Full re-render on keypress
```javascript
// ❌ loses cursor, jumps scroll, feels broken
searchInput.oninput = () => render();

// ✅ smooth
searchInput.oninput = debounce(() => softRenderList(), DEBOUNCE_DELAY);
```

### 5. DOM in service worker
```javascript
// ❌ service worker has no DOM
// In background.js:
document.querySelector('#something');

// ✅ use offscreen documents or content scripts for DOM operations
```

### 6. Hardcoded feature visibility
```javascript
// ❌ experimental feature visible everywhere
renderButton('Export Postman');

// ✅ surface-aware
if (FEATURES[mode].postmanExport) renderButton('Export Postman');
```

### 7. Breaking hash compatibility
```javascript
// ❌ changing normalizeUrl without a migration = all existing mocks break silently
function normalizeUrl(url) {
  // … changed behavior …
}

// ✅ treat matcher.js changes as breaking API changes; version or migrate
```

### 8. Creating stale docs
```javascript
// ❌ creates a file that will be forgotten immediately
// → IMPLEMENTATION_NOTES.md

// ✅ put it where it will be read: inline JSDoc, or append to an existing spec
```

### 9. Stale path references
```javascript
// ❌ old paths that no longer exist
// docs/internal/   memory/   /app/extension/

// ✅ current paths
// docs/   specs/   extension/
```

---

## 📚 Key References

### Always read before contributing

| File | What it contains |
|------|-----------------|
| `README.md` | Project overview, repo structure, quick start |
| `extension/README.md` | Extension architecture, feature map, file layout |
| `CONTRIBUTING.md` | Branch workflow, PR process |
| `CHANGELOG.md` | Version history |
| `TODO.md` | Roadmap; don't build what's deliberately deferred |
| `specs/PRD.md` | What's shipped vs. backlog |
| `specs/DUAL_INTERFACE_STRATEGY.md` | Popup vs. DevTools feature decisions |

### Key source files

| File | Role |
|------|------|
| `extension/background.js` | Service worker — storage, state, DNR, license validation |
| `extension/injected.js` | MAIN world — fetch/XHR hook, mock cache, transform rules |
| `extension/content.js` | ISOLATED world — page↔background message bridge |
| `extension/shared/app.js` | Full UI (~2800 lines) — both surfaces, mode-switched |
| `extension/shared/matcher.js` | FNV-1a hash + URL/body normalisation — **treat as critical** |
| `extension/shared/store.js` | IndexedDB wrapper — all interaction persistence |

### Test commands

```bash
# Extension E2E smoke tests (87 assertions)
python3 tests/smoke_echokit.py

# CLI unit tests (7 assertions)
node cli/test/test.js

# Build Chrome Web Store zip
bash scripts/build-store-zip.sh

# Bump patch version + build
bash scripts/build-store-zip.sh --bump
```

---

**End of Rules** • Version 3.0 • Last Updated: 2026-05-19
