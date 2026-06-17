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

## 2026-06-17 - Prevent DOM XSS in layout rendering
**Vulnerability:** The `layouts.js` file assigned the raw HTML string returned by `renderInteractionList` directly to `this.container.innerHTML` without sanitization, creating a high risk for Cross-Site Scripting (DOM XSS).
**Learning:** Even when UI components delegate their rendering to external helper functions, the caller that actually performs the DOM assignment must enforce security constraints (like sanitization). Do not assume the helper returns safe HTML unless explicitly documented.
**Prevention:** Imported and applied `sanitizeHTML()` from `sanitize.js` to wrap the HTML output before assigning it to `innerHTML` in all Layout classes.
