# Chrome Web Store submission — EchoKit

## 1. Listing copy

### Name (max 45 chars)
`EchoKit — API Recorder & Mocker`

### Summary (max 132 chars)
`Record any fetch / XHR call on any page, then instantly mock it. Strict matching. Raw JSON editor. Zero setup. For devs & QA.`

### Detailed description (~5000 chars max)

```
EchoKit is a zero-setup Chrome extension that lets frontend developers and QA engineers RECORD real API interactions from a browser session and instantly MOCK them back — with strict matching, editable responses, latency & error simulation, and conflict resolution.

Record once. Mock reliably. Debug faster.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WHAT YOU CAN DO

• Record `fetch` and `XMLHttpRequest` traffic per tab with one click
• Toggle MOCK mode per tab — hit the same endpoint, get your edited response
• Edit response body (raw JSON), status code, and headers inline
• Simulate latency (0–10 s) and errors: 4xx, 5xx, network failure, timeout
• Strict matching on method + URL + normalized body — no ghost mocks
• Relaxed match modes per API: ignore query params · ignore body · path-wildcard
• Multi-version conflict resolution — latest wins, or pick a specific version
• Search, filter by method / status, group by domain
• Export & Import mock sets as JSON — commit them to your repo or share in PRs
• CORS override toggle — inject permissive headers into real responses
• Works side-by-side with Chrome DevTools — opens as its own panel
• Keyboard shortcuts (Alt+Shift+R record, Alt+Shift+M mock, Alt+Shift+E popup)
• Dark / Light / Auto theme
• Scope modes: Domain (default) · Tab · Global

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
THE 30-SECOND FLOW

1. Click the EchoKit icon on any page.
2. Press ● REC. Use your app. Hit STOP.
3. Flip MOCK. Tap a request. Edit the JSON body.
4. Reload the page — the app now hits your mocks.
5. A big amber "MOCKING ACTIVE" banner means you never confuse real vs fake.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PRIVACY

• 100% local. All captured data stays in your browser (IndexedDB).
• No accounts, no telemetry, no servers.
• Read the full privacy policy at the homepage link.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OPEN SOURCE

MIT-licensed. Source: https://github.com/ravitejakamalapuram/echokit
Issues + PRs welcome.
```

### Category
`Developer Tools`

### Language
English

---

## 2. Graphic assets checklist (sizes Chrome Web Store requires)

| Asset | Size | Status | File |
|---|---|---|---|
| **Icon** | 128×128 PNG | ✅ | `extension/icons/icon128.png` |
| **Small promo tile** | 440×280 PNG or JPEG | ☐ | `store/promo-tile-440x280.png` (TODO) |
| **Marquee promo tile** | 1400×560 PNG or JPEG | ☐ (optional, for featured) | `store/promo-marquee.png` |
| **Screenshots 1–5** | 1280×800 (or 640×400) PNG | ☐ | `store/screenshots/*.png` (see `screenshot-guide.md`) |

See `screenshot-guide.md` for the recipe (what to capture, how to stage).

---

## 3. Privacy & permission justifications

You'll be asked to justify each permission at submission:

| Permission | Justification |
|---|---|
| `storage` | Remember per-extension settings (theme, scope, CORS toggle, auto-open). |
| `tabs` | Per-tab recording state and messaging to content scripts. |
| `activeTab` | Read current tab URL to display the host in the popup footer. |
| `scripting` | (reserved for dynamic script injection — currently unused; remove before submission if you want to trim, see note below). |
| `declarativeNetRequest` | Implement the optional CORS-override feature (inject permissive CORS response headers on user request). |
| `unlimitedStorage` | Recordings can exceed 10 MB; IndexedDB needs elbow-room. |
| `notifications` | (reserved — currently unused). Remove before submission unless we add notifications. |
| `host_permissions: <all_urls>` | The extension records and mocks requests on whatever page the user is debugging. Without `<all_urls>` the core product cannot function. |

### Note before submission
Trim unused permissions (`scripting`, `notifications` if we don't ship notifications) — the Chrome Web Store review team is strict about the principle of least privilege.

---

## 4. Single-purpose description (required field)

`EchoKit records real fetch / XHR API calls made by a web page, and mocks those same requests with user-edited responses on subsequent calls. It is a single-purpose developer tool for intercepting and replaying HTTP traffic during local debugging and testing.`

---

## 5. Submission steps

1. Sign up (or log in) to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole). One-time $5 registration fee.
2. Click **New item**.
3. Upload `echokit-extension.zip` (run `zip -rq echokit-extension.zip extension/` from repo root).
4. Fill listing fields from the copy above.
5. Upload icon + promo tile + screenshots.
6. Paste the privacy policy URL (host `store/privacy-policy.md` on GitHub Pages or your site and use that URL).
7. Declare permission justifications.
8. Set distribution: **Public**. Choose visibility: **Listed** (discoverable) or **Unlisted** (link-only).
9. Submit for review. Typical turnaround: 1–7 days.

---

## 6. Post-launch checklist

- Turn on auto-publish for approved updates.
- Set up a `v*` Git tag → GitHub Actions workflow that builds the zip and uploads via the [Chrome Web Store Publish API](https://developer.chrome.com/docs/webstore/using-api).
- Claim an analytics ID (if you add any) via [GA4 Chrome Extension setup](https://developer.chrome.com/docs/extensions/how-to/integrate/google-analytics-4). Keep telemetry opt-in only.
- Add a "What's new" dialog that fires on version change (`chrome.runtime.onInstalled` with `reason === 'update'`).
