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
| `storage` | permissions | Used to persist user settings and configuration preferences locally, ensuring they are preserved across service worker restarts. |
| `tabs` | permissions | Used to coordinate recording/mocking state transitions and apply CORS modifications to active browser tabs. |
| `activeTab` | permissions | Used to inject the API recording proxy script into the active tab when requested. |
| `scripting` | permissions | Used to programmatically inject the recorder proxy code block into the page context. |
| `declarativeNetRequest` | permissions | Used to dynamically intercept and mock API requests, redirecting matching network URLs to local mock handlers. |
| `unlimitedStorage` | permissions | Used to allow unlimited local storage space for large captured API recordings, response bodies, and mock sets. |
| `clipboardRead` | permissions | Used to allow the user to import mocks directly from the clipboard. |
| `clipboardWrite` | permissions | Used to copy mock interactions, JSON schemas, and API documentation to the clipboard. |
| `cookies` | permissions | Used to capture, inspect, and temporarily mock cookies during API simulation. |
| `<all_urls>` | host_permissions | Used to record and mock API traffic across all user-permitted domains for development and testing. |

## Privacy & Data Use

### Data Collection
**Does the extension collect user data?** No

All extension preferences and inputs are stored locally on the device and never sent off-device.

### Data Use Certification
- [x] Data is NOT sold to third parties
- [x] Data is NOT used for purposes unrelated to the extension's core functionality
- [x] Data is NOT used for creditworthiness or lending purposes

## Privacy Policy
Privacy Policy available in `PRIVACY.md` in the project root. Recommended to host via GitHub Pages.

## Version History

| Version | Date | Changes | Status |
|---|---|---|---|
| 1.11.0 | 2026-06-02 | Added free access configuration during LemonSqueezy payment transition. | Active |
