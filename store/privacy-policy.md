# Privacy Policy — EchoKit

_Last updated: February 2026_

EchoKit is a developer tool that records and mocks HTTP API traffic in your browser. It is **fully local-first**. This policy explains exactly what the extension does and does not do with data.

## 1. What EchoKit collects

When **recording is ON** for a given tab, EchoKit captures the following about each `fetch` / `XMLHttpRequest` call made from that tab:

- Request URL, method, headers, body
- Response status, headers, body
- Timestamp and duration
- The tab's URL (for scoping & display)

All captured data is stored **exclusively in your browser's IndexedDB**. It never leaves your device.

## 2. What EchoKit does NOT collect

- No telemetry, analytics, crash reports, or usage pings are sent anywhere.
- No accounts, logins, or cloud storage.
- No background network requests are made by the extension itself.

## 3. Permissions we request and why

| Permission | Why |
|---|---|
| `host_permissions: <all_urls>` | The extension must observe fetch/XHR on the pages you choose to record. Scoped to tabs where you explicitly press REC. |
| `storage`, `unlimitedStorage` | Persist your recordings locally in IndexedDB. |
| `tabs`, `activeTab` | Track which tab is recording / has mocking enabled; display the host in the UI. |
| `declarativeNetRequest` | Optional CORS-override feature. Rules are written dynamically only when you enable the toggle; removed when you disable it. |

## 4. Data retention & deletion

- Recordings live in your browser until **you** clear them (the **Clear** menu item or the **Wipe ALL recordings** button in Settings).
- Uninstalling the extension removes all stored data.
- You can export all data to a JSON file at any time via **Export JSON**, and re-import it on any device.

## 5. Third-party services

EchoKit uses **no third-party services**. Fonts (IBM Plex Sans, JetBrains Mono) are loaded from Google Fonts for the UI — this means Google can see that the UI was opened. If you want to avoid this, fork the repo and bundle fonts locally (the `@import` is at the top of `shared/styles.css`).

## 6. Open source

EchoKit is open source under the MIT License. Source code is available at `https://github.com/ravitejakamalapuram/echokit`. You can audit every line yourself.

## 7. Contact

Issues or privacy questions: file at the GitHub repo above.
