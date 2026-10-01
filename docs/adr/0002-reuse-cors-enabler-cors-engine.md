# 0002 Vendor only cors-enabler's pure CORS header semantics, not its engine

Status: accepted   Date: 2026-09-26

Issue: POR-184 (Architecture), under POR-182 (utilise cors engine in echokit to maintain
reusability).

## Context

POR-182 asks how EchoKit reuses cors-enabler's "portable `CorsEngine`"
(`~/git-personal/cors-enabler/src/engine/`, 1415 lines of TypeScript across 11 files) in place of
EchoKit's hand-rolled `declarativeNetRequest` CORS logic in `extension/background.js`
(`applyCorsRules` at :520 and `applyCorsRulesForAllTabs` at :618, ~120 lines).

The accepted POR-182 plan offered two options: (a) vendor-and-adapt into `extension/shared/`, or
(b) extract `src/engine` into a shared npm package consumed by both repos.

I read both implementations before deciding. Four findings reframe the question, because they show
the engine is **not** a drop-in library — it is an application component of a single-feature
extension, and parts of it are actively wrong for EchoKit.

### Finding 1 — The engine cannot express EchoKit's scope model

`ChromeNetworkAdapter` (`network-adapter.ts`) is dynamic-rules-only: `updateDynamicRules`,
`getDynamicRules`. EchoKit's `domain` and `tab` scopes require **session** rules with
`condition.tabIds` / `condition.requestDomains` (`background.js:648`, `:677`). The engine's
`CorsRule` type has no `tabIds` field at all, and it flattens `requestDomains` into one
`urlFilter` rule **per domain** (`network-adapter.ts:36`) rather than one rule with a
`requestDomains` array.

So adopting the engine's adapter would: lose tab scope entirely, change domain-match semantics
(`urlFilter` ≠ `requestDomains`), and turn EchoKit's single rule into N rules for N open-tab
domains — pushing a normal browsing session toward Chrome's unsafe-dynamic-rule limit that the
engine itself guards against (`DNR_UNSAFE_RULE_LIMIT`, `network-adapter.ts:59`). Scoped CORS is
EchoKit's differentiator over cors-enabler; the engine is the weaker model here, not the stronger.

### Finding 2 — The engine assumes it owns the entire dynamic-rule namespace

`getInstalledIds()` returns *every* dynamic rule; `clear()` deletes *all* of them
(`network-adapter.ts:92-110`). EchoKit shares that namespace: rule `1001` is CORS, and
`2000..2099` are reserved for the request **blocklist** (`background.js:21-22`, `:697`).

Dropping the engine in means `engine.disable()` silently deletes the user's blocklist rules. This
is the single most concrete reason the engine is not reusable as an engine.

### Finding 3 — The "portable" engine's dependencies escape `src/engine/`

`cors-engine.ts` imports `@/shared/logger`; `network-adapter.ts` and `rule-builder.ts` import
`@/shared/constants`. Neither option (a) nor (b) is a clean lift — both first need those shared
deps factored out. Option (b) additionally needs the `@/` path aliases removed.

### Finding 4 — Header output differs observably, and EchoKit is live

EchoKit sets 3 response headers, all `*` (Allow-Origin, Allow-Methods, Allow-Headers) across **10**
resource types. The engine's `buildResponseHeaderSpecs` (`rule-builder.ts`) sets up to **8** —
adding `Access-Control-Expose-Headers`, `Access-Control-Max-Age: 600`, conditionally `Vary: Origin`,
`Access-Control-Allow-Credentials`, `Access-Control-Allow-Private-Network` — and defaults to **1**
resource type (`xmlhttprequest`).

A straight swap would therefore (i) stop relaxing CORS for images/fonts/media/websocket, and
(ii) newly cache preflights for 600s and expose all response headers to page JS. Both are
user-visible behaviour changes on a published extension. EchoKit is live at **1.13.28** with
**1.14.0 still in PENDING_REVIEW**; cors-enabler (1.0.1) has **not yet passed its first review**,
so its model is not yet validated by review or real use.

### What is genuinely worth reusing

One thing: the **CORS header semantics**. `rule-builder.ts` + `resolveOriginContext`
(`cors-validator.ts`) encode the subtle, easy-to-get-wrong rule that credentialed responses may
never use `*` for origin/methods/headers, and must set `Vary: Origin`. It is pure, has no Chrome
dependency, and is exactly the logic EchoKit would get wrong the day it supports credentialed CORS.
Everything else — `CorsEngine`, `RuleManager`, `StateMachine`, `ChromeNetworkAdapter`,
`DiagnosticsEngine`, `presets` — models a user-managed rule list with presets, diagnostics and
import/export. EchoKit has no such surface and POR-182 does not ask for one.

## Decision

**Option (a), vendor-and-adapt, with a narrow and explicit boundary.**

Vendor into a new plain-JS `extension/shared/cors-headers.js`:

- `buildResponseHeaderSpecs` (from `rule-builder.ts`) — the header semantics
- `resolveOriginContext` (from `cors-validator.ts`) — the credentials × wildcard rule
- `extractHostPort` (from `domain-matcher.ts`) — only if step 3 needs it

Do **not** vendor: `cors-engine.ts`, `rule-manager.ts`, `state-manager.ts`, `network-adapter.ts`,
`diagnostics-engine.ts`, `presets.ts`. EchoKit keeps its own `applyCorsRules`, which continues to
own rule ID `1001` and the dynamic-vs-session split, because that scoping is EchoKit's feature and
the engine's adapter conflicts with it (Findings 1 and 2).

The module takes an explicit profile argument and ships first with a profile that reproduces
EchoKit's current 3 headers **byte-for-byte**. The engine's extra headers become opt-in later.

**No new Chrome manifest permission is required.** `declarativeNetRequest` is already declared
(`extension/manifest.json:13`), and the vendored code is pure — it touches no Chrome API. Note that
`Access-Control-Allow-Private-Network` is a *response header*, not a permission, so even step 3
adds no manifest change. `extension/manifest.json` is touched only for the release version bump.

## Rejected

**(b) Shared npm package.** Rejected on cost and governance, not on principle.

- EchoKit's extension is deliberately build-less: `npm run build` is `bash scripts/build-store-zip.sh`,
  which zips raw JS after a `node -c` syntax pass. A package consumer needs a bundler, which changes
  the build script, `ci.yml` and `cd.yml`. **CD from `main` publishes to the Chrome Web Store**, so
  that is board territory per the charter, as is the npm publish credential the versioning workflow
  would need.
- It breaks load-unpacked debugging, or adds a watch step to keep it.
- It would freeze a shared contract around cors-enabler's model *before* that model has passed its
  first store review — the worst possible moment to commit to it.
- The whole cost buys deduplication of ~120 lines across two consumers, one of which needs only
  ~40 lines of it (Finding 5's corollary: the pure part is small).

Reconsider (b) if a third extension needs CORS rules, or after cors-enabler is published and its
model has survived real use.

**(a) naive — vendor the whole engine.** Rejected on Findings 1, 2 and 4: it loses tab scope,
silently deletes users' blocklist rules on CORS-off, and changes header output for live users.

**Do nothing.** Rejected, but it is the honest baseline: the immediate user-visible payoff here is
zero. This is a correctness and optionality move that removes a duplicated header literal
(currently copy-pasted in both `applyCorsRules` and `applyCorsRulesForAllTabs`) and puts the
credentials rule in one tested place. Kept small precisely because the payoff is small.

## Consequences

- **Accepted cost: the fork.** `cors-headers.js` will drift from `rule-builder.ts`. Accepted — the
  vendored surface is ~60 lines of pure logic that changes rarely. Record the source file and
  cors-enabler version in a header comment so the next reader can diff it.
- **The more valuable reuse runs the other way.** EchoKit's session-rule tab/domain scoping is the
  better model. Once cors-enabler is published, consider porting *that* into its engine. Out of
  scope here; worth a POR-182 follow-up.
- **`shared/matcher.js` is not touched.** CORS is orthogonal to the record/replay hash pipeline, so
  the "recorded mocks break silently" hazard does not apply. Development should not go looking for a
  matcher migration.
- **`shared/app.js` is not touched.** The CORS UI is the existing `corsOverride` toggle and `scope`
  select; no big-bang refactor, per the standing constraint.
- **Blast radius is small by default.** `corsOverride` defaults to `false` (`background.js:28`), so
  only users who explicitly enabled CORS override can be affected — and turning the toggle off is an
  immediate self-service mitigation.
- **Watch after release:** store rating (guard: stays ≥ 4.5), and any new issue mentioning CORS,
  preflight, or blocked requests.

## Build plan

Each step is one PR, each well under ~300 changed lines. Steps 1–2 are behaviour-preserving.

**Step 1 — Add `extension/shared/cors-headers.js` + tests. Not wired in.**
Port `buildResponseHeaderSpecs` and `resolveOriginContext` to plain JS with JSDoc types. Export a
`buildCorsResponseHeaders(profile)` that returns DNR `responseHeaders` specs. Add
`tests/test-cors-headers.js` to the `npm test` chain asserting: the EchoKit profile emits exactly
today's 3 `*` headers; a credentialed profile never emits `*` and does emit `Vary: Origin`.
Add the file to the `lint` / `lint:fix` globs in `package.json`.

**Step 2 — Wire it into `background.js`. Zero behaviour change.**
Replace the duplicated inline header literal in `applyCorsRules` (:555) and
`applyCorsRulesForAllTabs` (:622) with one `buildCorsResponseHeaders()` call. Keep rule ID `1001`,
the 10 `resourceTypes`, and the dynamic/session split exactly as they are.
Verification gate before merge: `npm test`, `npm run lint`,
`python3 tests/smoke_echokit.py`, and a manual check in all three scopes (global / domain / tab)
using the existing `echokit:cors:diagnostics` message (`background.js:1716`), which returns the
installed rule — confirm the rule JSON is **identical** to a pre-change capture. Capture that
baseline first.

**Step 3 — Separate issue, separate release. Opt-in semantics.**
Only after step 2 has been live for one release: add `Access-Control-Expose-Headers`,
`Access-Control-Max-Age`, and credentialed-CORS mode, each gated behind settings, each with its own
regression note. This is where the reuse actually pays off; it is deliberately not bundled with the
refactor.

### Release sequencing constraint

`1.14.0` is still in `PENDING_REVIEW`. Do **not** merge step 2 to `main` until `1.14.0` clears
Chrome review — CD from `main` publishes, and stacking a CORS change onto an unreviewed release
makes any rollback ambiguous. The version bump and merge need board approval as always.

## Rollback plan

The cut-over is designed so rollback is a plain revert:

1. **No persisted-data change.** Steps 1–2 add no storage key, change no schema, and do not alter
   `echokit_settings`. Reverting cannot leave a user on data the old code cannot read. This is the
   property that makes the rest of the plan safe.
2. **Pre-merge**: revert the commit. Blast radius is the branch.
3. **Post-merge, pre-publish**: revert on `main`; the next CD run carries the revert.
4. **Post-publish regression**: three tiers, in order.
   - *Immediate, user-side*: the `corsOverride` toggle is off by default and turning it off fully
     disables the code path — `applyCorsRules` removes both the dynamic and session rule and
     returns (`background.js:548`). Document this as the workaround in the issue.
   - *Repo*: revert the step-2 commit, restoring the inline literal. `cors-headers.js` can stay in
     the tree unreferenced; it is inert.
   - *Users*: patch release via CD, which needs board approval. Expect Chrome review latency —
     1.13.28 → 1.14.0 review is still outstanding, so assume days, not hours. That latency is the
     reason step 2 must be a verified no-op rather than "probably fine".
5. **Regression signal to watch**: any report of CORS still blocked with the toggle on, or of
   requests succeeding that previously failed, in any of the three scopes. Preflight caching is the
   subtle one and is deferred to step 3 specifically so it cannot be the cause of a step-2
   regression.
