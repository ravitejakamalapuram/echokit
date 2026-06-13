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
## 2026-06-13 - Prevent DOM XSS in Layout Components
**Vulnerability:** The `PopupLayout` and `DevToolsLayout` components in `extension/shared/layouts.js` were vulnerable to DOM-based Cross-Site Scripting (XSS) because they rendered dynamically generated HTML templates using `innerHTML` without proper sanitization.
**Learning:** Even if data seems safe or follows a predetermined template (like `renderInteractionList`), untrusted data from network interactions could theoretically be injected if escaping is missed at the template level. Using raw `innerHTML` directly exposes the extension to injection attacks.
**Prevention:** Always wrap HTML strings generated for dynamic lists and components in `sanitizeHTML(html)` before passing them to `innerHTML`. This ensures all potentially malicious tags and attributes are scrubbed using secure DOM-based parsing techniques.
