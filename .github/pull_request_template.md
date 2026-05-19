## What does this PR do?

<!-- One sentence. What is the user-visible or developer-visible change? -->

## Why?

<!-- Link to issue, or explain the motivation if there's no issue -->

Closes #

## Type of change

- [ ] 🐛 Bug fix
- [ ] ✨ New feature
- [ ] 💥 Breaking change ← requires explicit description below
- [ ] ♻️ Refactor (no behavior change)
- [ ] ⚡ Performance improvement
- [ ] 📝 Documentation only
- [ ] 🧪 Tests only
- [ ] 🔧 Chore / tooling / CI

---

## Breaking change details

<!-- Only fill in if you checked "Breaking change" above -->

**What breaks:**

**Migration path for existing users:**

---

## Testing done

<!-- Check everything you actually ran — don't check things you skipped -->

- [ ] Loaded extension unpacked in Chrome (`chrome://extensions` → Load unpacked → `extension/`)
- [ ] Ran smoke tests: `python3 tests/smoke_echokit.py` — all 87 assertions passing
- [ ] Tested popup surface (400×600 toolbar icon)
- [ ] Tested DevTools panel (DevTools → EchoKit tab)
- [ ] Tested with 1000+ recorded interactions (no lag)
- [ ] Tested scope modes: tab / domain / global (if any interaction logic changed)
- [ ] Tested light and dark themes (if UI changed)
- [ ] Tested error scenarios: network failure, invalid JSON, empty state

---

## Code quality checklist

### Every PR

- [ ] No magic numbers — all values extracted to named constants
- [ ] All `JSON.parse`, storage reads, and network calls wrapped in try-catch
- [ ] Text inputs debounced at `DEBOUNCE_DELAY` (300 ms)
- [ ] List updates use `softRenderList()`, not full `render()`
- [ ] No `console.log` left in production paths (or explained with a comment if intentional)
- [ ] All new public functions have JSDoc (`@param`, `@returns`)
- [ ] No function longer than 150 lines (warn at 100)
- [ ] No file longer than 2000 lines (warn at 1000)
- [ ] No secrets or credentials committed

### If interactions are read or written

- [ ] Query uses `getVisibleInteractions(tabId, host, scope)` — **not** `getAllInteractions()`
- [ ] Scope modes (tab / domain / global) all behave correctly

### If `manifest.json` is changed

- [ ] Version bumped (`fix:` → patch, `feat:` → minor, `BREAKING:` → major)
- [ ] No new permissions added without justification in this PR description
- [ ] Extension still loads without errors in `chrome://extensions`
- [ ] No console errors in the background service worker

### If `shared/matcher.js` is changed

- [ ] Hash output is identical for the same inputs (record ↔ replay must match)
- [ ] Existing recorded mocks still match after the change — or a migration is documented

### If UI is changed

- [ ] Works in both popup and DevTools panel
- [ ] Feature flags (`FEATURES[mode]`) used for popup vs. DevTools differences
- [ ] `echokit:category:action` message type convention followed for any new messages

### If `cli/` is changed

- [ ] CLI tests passing: `node cli/test/test.js`
- [ ] No new npm dependencies introduced (CLI is intentionally zero-dependency)
- [ ] `cli/README.md` updated if flags or behavior changed

### If `worker/` is changed

- [ ] Worker tests passing
- [ ] License key format (`EK-{PLAN}-{EXPIRY}-{SIG}`) unchanged, or migration documented

---

## Documentation checklist

- [ ] `extension/README.md` feature table updated (for new user-facing features)
- [ ] `CHANGELOG.md` has an entry under `[Unreleased]`
- [ ] `TODO.md` item marked `[x]` done (if this closes a backlog item)
- [ ] No new unnecessary `.md` files created (use inline JSDoc or update existing docs)
- [ ] No broken links introduced

---

## Screenshots / recordings

<!-- For any UI change — before/after is ideal. Skip if no UI change. -->

---

## Reviewer focus

<!-- What should reviewers pay particular attention to? Any areas of uncertainty? -->

---

<!--
── VERSION BUMP GUIDE ────────────────────────────────────────────────────────
Conventional commit prefixes control the auto-release version bump:

  fix:      → patch   (1.10.3 → 1.10.4)
  feat:     → minor   (1.10.3 → 1.11.0)
  BREAKING: → major   (1.10.3 → 2.0.0)

The CI workflow reads the commit prefix on merge to main and bumps
manifest.json automatically, then creates a GitHub Release.

── FOLDER RULES ─────────────────────────────────────────────────────────────
website/   → public HTML/CSS (served by Cloudflare Pages)
docs/      → contributor docs only (never served publicly)
specs/     → product specs and feature designs
extension/ → Chrome MV3 source only

Never use: docs/internal/  memory/  /app/extension/
──────────────────────────────────────────────────────────────────────────────
-->
