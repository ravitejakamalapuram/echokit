## 2026-06-03 - Prevent DOM XSS in UI rendering
**Vulnerability:** The application used `innerHTML` directly with template literals for rendering HTML fragments without proper sanitization, posing a high risk for Cross-Site Scripting (DOM XSS).
**Learning:** `innerHTML` shouldn't be populated directly with untrusted data unless it goes through proper sanitization. Regex-based sanitization is insufficient and can be bypassed by attackers.
**Prevention:** Implemented DOM-based `sanitizeHTML()` function that:
- Creates a temporary DOM element to parse HTML safely
- Removes dangerous tags (script, iframe, object, embed, link, style, base, meta)
- Strips all event handler attributes (onclick, onerror, etc.)
- Sanitizes href/src attributes to block javascript:, data:, and vbscript: URIs
- Uses DOM APIs for safe parsing instead of regex patterns
This approach is more secure than regex-based sanitization as it uses the browser's own HTML parser and cannot be bypassed with malformed markup.

## 2026-06-21 - DOM XSS bypass via control characters in URI sanitization
**Vulnerability:** The HTML sanitizer's URI prefix checking (for `javascript:`, etc.) could be bypassed by inserting HTML entity-encoded control characters or spaces (like `&#09;` for tab) into the URI. The browser decodes these entities into control characters, but the standard `trim()` function only removes leading/trailing spaces, not internal control characters, allowing the payload to execute.
**Learning:** Checking for dangerous URI prefixes requires stripping all control characters (`\x00-\x20` and `\x7F`) from the decoded value before prefix matching, because the browser's URI parser typically ignores these characters when executing the URI scheme.
**Prevention:** Modified the `sanitizeHTML` logic to strip all control characters and spaces from the attribute value using `.replace(/[\x00-\x20\x7F]/g, '')` prior to executing the `startsWith` prefix checks.

## $(date +%Y-%m-%d) - Prevent DOM XSS in code editor highlight and empty state
**Vulnerability:** The application assigned unsanitized strings returned by `highlightJSON` and `renderEmpty` directly to `innerHTML` properties in `extension/shared/app.js`, creating vectors for Cross-Site Scripting (DOM XSS).
**Learning:** Even helper functions generating UI elements internally within the app logic must be wrapped in a sanitization pass when injected via `innerHTML` to guarantee safety from unexpected injections or alterations in function output.
**Prevention:** Ensured all assignments to `innerHTML` are defensively wrapped with the `sanitizeHTML` utility.

## $(date +%Y-%m-%d) - Prevent cross-origin state spoofing via postMessage
**Vulnerability:** The `window.addEventListener('message', ...)` handler in `extension/injected.js` processed messages from any origin without validating `ev.source === window`, allowing potentially malicious iframes or other windows to spoof state payloads and compromise extension logic.
**Learning:** Browser extension content and injected scripts that communicate via `postMessage` must explicitly verify the message source to prevent Cross-Origin spoofing. Validating the namespace alone (`source: 'echokit-content'`) is insufficient as any origin can forge this payload.
**Prevention:** Added an explicit `if (ev.source !== window) return;` guard at the beginning of the `message` event listener to ensure only messages originating from the same window (e.g., communication between content and injected scripts) are processed.
