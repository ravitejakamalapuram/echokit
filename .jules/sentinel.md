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

## 2026-06-03 - Prevent DOM XSS in UI layout files
**Vulnerability:** The application used `innerHTML` directly in layout render functions (`extension/shared/layouts.js`) when setting the interaction list HTML, risking DOM XSS if any data generated in `interaction-renderer.js` isn't fully escaped.
**Learning:** Even if helper template components sanitize individual fields, injecting concatenated HTML fragments via `innerHTML` at the top level Layout components without final sanitization is a vulnerable pattern and can be bypassed in complex UI rendering chains.
**Prevention:** Wrapped all template string and generated HTML outputs with `sanitizeHTML()` before they are injected into the DOM via `innerHTML` in layout class render methods (`PopupLayout` and `DevToolsLayout`).
