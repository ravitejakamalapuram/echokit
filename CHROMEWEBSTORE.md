# Chrome Web Store Listing — EchoKit — API Recorder & Mocker

> Last Updated: 2026-06-02

## Store Listing

**Extension Name**
EchoKit — API Recorder & Mocker

**Short Description**
Record real API interactions and instantly mock them. Zero setup. Built for frontend devs & QA. Record once, mock reliably.

**Detailed Description**
EchoKit is a developer tool designed to simplify API mocking and testing. Simply turn on recording, interact with your web application, and instantly convert captured requests/responses into local mocks. 

Features:
- Zero setup: runs entirely inside your browser
- Intercept and mock fetch/XHR requests client-side
- Simulated latency, error simulation (4xx, 5xx), and API blocking
- Six powerful matching modes (strict, ignore-query, path-wildcard, GraphQL, etc.)
- Export mock interactions to Postman or HAR format

**Category**
Developer Tools

**Single Purpose**
Enables web developers to record real HTTP network requests and instantly replay them as mocks client-side to simplify testing and development.

**Primary Language**
English

## Graphics & Assets

| Asset | Dimensions | Status | Filename |
|---|---|---|---|
| Store Icon | 128×128 PNG | ✅ Ready | extension/icons/icon128.png |

## Permissions Justification

Every permission in manifest.json needs a justification. The review team reads these.

| Permission | Type | Justification |
|---|---|---|
| `storage` | permissions | Persists EchoKit settings (recording/mock mode, matching mode, scope, CORS override), license status and per-session tab state in chrome.storage so they survive service-worker restarts. |
| `tabs` | permissions | Reads the URL/origin of the tab being recorded or mocked and pushes recording/mocking state updates to open tabs so each tab's in-page recorder stays in sync. |
| `activeTab` | permissions | Lets the popup and DevTools panel act on the tab the user is currently working in when they click the EchoKit toolbar button (e.g. start recording or copy that tab's storage). |
| `scripting` | permissions | Runs a user-initiated function in the selected tab to read or write that page's localStorage, used by the 'Copy/Paste localStorage' developer utility. |
| `declarativeNetRequest` | permissions | Installs rules that add CORS response headers when the user enables the CORS override, and blocks API URLs the user adds to the blocklist, for local development and testing. |
| `unlimitedStorage` | permissions | Recorded API interactions (request/response bodies) are stored locally in IndexedDB and can exceed the default quota for large mock sets. |
| `clipboardRead` | permissions | Reads clipboard contents only when the user clicks 'Paste localStorage' or 'Paste cookies', to import values previously copied from another environment. |
| `clipboardWrite` | permissions | Copies the selected tab's localStorage or cookies (for the Copy/Paste developer utilities) and the link of a shared mock set to the clipboard when the user clicks a copy action. |
| `cookies` | permissions | Reads and sets cookies for the selected tab's URL only when the user uses the 'Copy/Paste cookies' developer utility, e.g. to reproduce a logged-in state across local/staging environments. |
| `<all_urls>` | host_permissions | EchoKit records and mocks the fetch/XHR traffic of whatever web application the developer is testing, so its recorder/mocking content scripts and CORS/blocklist rules must be able to run on any site the developer opens. Captured data is stored locally. |

## Privacy & Data Use

### Data Collection
**Does the extension collect user data?** No

Recorded interactions, settings and preferences are stored locally on the device. Nothing is sent off-device unless the user explicitly shares a mock set to their own GitHub Gist or enters a Pro license key (validated against the EchoKit license endpoint).

### Data Use Certification
- [x] Data is NOT sold to third parties
- [x] Data is NOT used for purposes unrelated to the extension's core functionality
- [x] Data is NOT used for creditworthiness or lending purposes

## Privacy Policy
https://ravitejakamalapuram.github.io/echokit.html (source: `PRIVACY.md`).

## Version History

| Version | Date | Changes | Status |
|---|---|---|---|
| 1.11.0 | 2026-06-02 | Added free access configuration during LemonSqueezy payment transition. | Active |
