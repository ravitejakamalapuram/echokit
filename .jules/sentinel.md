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

## 2026-06-08 - Missing DOM XSS protections in layouts
**Vulnerability:** Several innerHTML assignments in layouts.js and app.js were not properly secured using sanitizeHTML(), leading to DOM XSS risks.
**Learning:** Newly created UI components (like layouts.js) and obscure code editor mirror sections in app.js were missed when the project-wide sanitizeHTML standard was applied. Centralized layout renderers often inherit this vulnerability when directly applying unescaped HTML strings to containers.
**Prevention:** Apply a strict AST or lint rule enforcing that any assignment to innerHTML must be wrapped in a sanitization function.
