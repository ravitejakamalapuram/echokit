# 0001 Surface stale-tab state on first run instead of claiming to listen

Status: accepted   Date: 2026-09-25

Issue: POR-117 (first-run/onboarding check), under POR-114 (goal check), stage 5 "Live: adoption".

## Context

EchoKit is live (1.14.0 PUBLISHED) with 7 weekly users and a 5.0 rating. Stage 5 asks that the
first recording-to-mock moment take under a minute. This ADR records a read-only audit of what a
brand-new install actually shows, and the smallest fix for the one defect it found.

### What first run does today — and it is mostly good

`chrome.runtime.onInstalled` (`extension/background.js:1833`) grants the 7-day Pro trial and opens
`onboarding/welcome.html` in a new tab. That page is genuinely strong: a "Try a 10-second demo"
checklist that walks record → stop → mock → edit → reload against JSONPlaceholder, a copyable
two-line `fetch` snippet, a three-card RECORD / EDIT / MOCK explainer, and the keyboard shortcuts.
The popup's empty state (`renderEmpty()`, `extension/shared/app.js:1420`) also points at `● REC`
and names the shortcut. The record-to-mock path **is** discoverable without reading docs.

So the answer to the audit question is: onboarding is not missing. There is one specific defect.

### The defect: already-open tabs cannot record, and the UI says the opposite

`injected.js` (MAIN world, hooks `window.fetch`/XHR) and `content.js` (bridge) are declared only as
static content scripts at `run_at: document_start` (`extension/manifest.json:64-86`). Chrome does
not retroactively inject static content scripts into tabs that were already open. There is no
backfill: `grep` for `registerContentScripts` returns nothing, and the only
`chrome.scripting.executeScript` calls in the repo are the localStorage bridge
(`background.js:1143`, `:1179`). So on a fresh install, **every tab the user already had open —
including the app they installed EchoKit to debug — has no interceptor until it is reloaded.**

Nothing tells the user. The failure is silent in three places:

1. `safeSend()` (`background.js:425`) is `chrome.tabs.sendMessage(...).catch(() => {})`. The push to
   a tab with no listener rejects and is swallowed, so the background believes the push succeeded.
2. The badge still turns red and reads `REC` (`updateBadge`, `background.js:428`), because badge
   state is derived from `tabState`, not from whether a content script exists.
3. `renderEmpty()` renders, on `state.tab.recording` alone:
   *"Listening for API calls… Trigger some fetch or XHR calls on `<host>` — they'll appear here
   instantly."* Nothing is listening and nothing will ever appear. The UI states a falsehood.

The result is the worst available first-minute outcome: the user presses REC on their own app,
exercises it, sees a red REC badge and a confident "Listening…", captures zero requests, and
concludes the extension is broken. The one-keystroke remedy — reload the tab — is documented
nowhere in the product. `extension/README.md:32` mentions reloading only to *apply* mocks, which is
a different step later in the flow.

This has plausibly gone unnoticed because the guided path dodges it: the welcome tab is itself a new
tab, and its demo step 1 opens JSONPlaceholder in *another* new tab. Both have the interceptor. Only
the user who skips the demo and goes straight to their own open app — the natural move for a
developer who just installed a debugging tool — hits the trap. The DevTools panel has the same
exposure, since opening DevTools does not reload the page.

### The signal we need already exists and is being discarded

`injected.js` emits `'ready'` unconditionally at top level on every page load
(`injected.js:331`); `content.js` forwards it as `echokit:contentReady`
(`content.js:95`). The handler `handleEchokitContentReady` (`background.js:1314`) calls
`pushTabMeta` and returns `{ok: true}` — it never records that the tab *has* a live interceptor.
Adding liveness is therefore a small change, not new machinery.

### Constraints

`shared/app.js` is ~3,300 lines and must be changed incrementally. The hash pipeline and
`shared/matcher.js` must not be touched — changing either breaks every recorded mock silently.
CD publishes from `main`, so merging is releasing and needs board approval.

## Decision

Make the extension detect whether the active tab has a live interceptor, and when it does not, tell
the truth in the popup and offer a one-click reload. Implement it as an **on-demand ping**, not a
cached flag:

- `content.js` tracks a local `sawInjectedReady` flag and answers a new `echokit:ping` message with
  `{alive: true, sawInjectedReady}`.
- `background.js` pings the tab inside `handleEchokitGetState` and returns the result on the
  existing `tab` object (the popup already reads all its state from one `echokit:getState` call at
  `app.js:156`, so no new round-trip is added).
- `renderEmpty()` gains one branch: when recording is on but the tab has no interceptor, replace the
  "Listening for API calls…" copy with "This tab was open before EchoKit loaded — reload it to start
  capturing" plus a **Reload tab** button.

Ping-on-demand rather than a cached `injected: true` bit because MV3 service workers idle out and
`tabState` is in-memory. A cached flag would reset to `false` on every worker restart while the page
stays loaded and never re-emits `ready`, producing a *false* "needs reload" warning on a tab that
works fine. Wrongly nagging a working tab erodes trust faster than the bug we are fixing; the ping is
authoritative and immune to worker restarts.

## Rejected

**Backfill injection on install** — on `onInstalled`, `chrome.scripting.executeScript` both scripts
(`world: 'MAIN'` is supported) into all existing `http(s)` tabs. Attractive because it needs no UI
and appears to fix things invisibly. Rejected: it cannot recreate `document_start` semantics. The
page's own JS has already run and may hold a captured reference to the original `window.fetch`, and
every call made before injection is already lost. The outcome is *partial* capture — some requests
recorded, some silently missing, mocks that match inconsistently. That is a materially worse failure
mode than capturing nothing, because it is much harder for a user to diagnose and it can corrupt a
recorded mock set. It also needs a double-injection guard in `injected.js`. A deterministic reload
gets the correct end state; this gets a plausible-looking wrong one.

**Document the reload in the README / welcome page only** — cheapest, zero code. Rejected: the
premise of this audit is the first minute, and a developer who has just installed a tool is not
reading the README when the UI already told them it was listening. Documentation does not remove a
false statement from the UI. (Worth doing as well, but it is not the fix.)

**Full onboarding tour / coach marks over the popup** (TODO.md P3 "Onboarding tour"). Rejected for
now: it is much larger, it touches `shared/app.js` broadly against the incremental-change rule, and
it does not address this defect at all. The audit found discoverability already adequate, so a tour
would be polish spent on a non-problem while the real defect stayed. Leave it in P3.

**Force-reload matching tabs automatically on install.** Rejected: reloading a developer's open tabs
without asking can lose unsaved form state and in-progress work. Offer the button; do not take the
action.

## Consequences

- Risk is low and contained: no change to `matcher.js`, the hash pipeline, storage schema, message
  names, or manifest permissions. `echokit:ping` is a new message type, so no existing installation
  breaks.
- One new failure mode to watch: a tab where `content.js` is alive but the ping is slow. The ping
  must have a short timeout (~300 ms) and **fail open** — on timeout, render today's copy rather
  than accusing a working tab of being stale.
- Pages where content scripts can never run (`chrome://`, the Chrome Web Store, PDF viewer) will
  report not-alive. There the honest message is that EchoKit cannot record this page at all, not
  "reload it" — reloading will not help. Distinguish by URL scheme.
- What we will watch: whether the "first recording within a minute" friction shows up in reviews or
  support, and that the 5.0 rating does not move. The audit's other finding — that the welcome page
  is good — means we should not spend further stage-5 effort on onboarding copy.

## Build plan

One PR, ~60 changed lines, small enough to review in one sitting.

1. `extension/content.js` — add the `sawInjectedReady` flag and the `echokit:ping` responder.
2. `extension/background.js` — add a `pingTab(tabId)` helper with a ~300 ms fail-open timeout; call
   it in `handleEchokitGetState` and include the result on the returned `tab` object; classify
   non-injectable URL schemes.
3. `extension/shared/app.js` — add the stale-tab branch to `renderEmpty()` and wire the
   **Reload tab** action (`chrome.tabs.reload`). Single function, no restructuring.
4. `tests/smoke_echokit.py` — one assertion: with recording on and no interceptor, the popup shows
   the reload prompt and not "Listening for API calls…".
5. Docs per `CLAUDE.md`: `extension/README.md` feature row, `CHANGELOG.md` under `[Unreleased]`,
   `TODO.md` note under the P3 onboarding item.

Not in scope: the onboarding tour, any copy rewrite of `welcome.html`, and anything touching
`matcher.js`. Merging to `main` publishes, so the release itself is a separate board decision.
