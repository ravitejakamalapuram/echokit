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

## 2026-06-18 - Prevent DOM XSS in Layouts
**Vulnerability:** `extension/shared/layouts.js` directly assigned unsanitized strings to `this.container.innerHTML` from `renderInteractionList`.
**Learning:** Even though rendering helpers generate UI structure, any dynamic content within these layouts could contain malicious payloads that exploit missing DOM-based sanitization in upstream caller assignments.
**Prevention:** Always wrap dynamically generated HTML strings from render helpers in `sanitizeHTML(html)` before assigning them to any `innerHTML` sink.
