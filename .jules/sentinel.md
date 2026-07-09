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
## 2026-07-07 - DOM Clobbering in HTML Sanitizer
**Vulnerability:** DOM Clobbering allowed bypassing the HTML sanitizer because it relied on `el.attributes`, `el.removeAttribute`, and `el.setAttribute`. An injected form with inputs named `attributes`, `removeAttribute`, or `setAttribute` would clobber these properties.
**Learning:** Never trust properties or methods on potentially untrusted DOM elements (especially `<form>`).
**Prevention:** Always use `Element.prototype` methods directly (e.g., `Element.prototype.getAttributeNames.call(el)`) when interacting with untrusted DOM nodes.

## 2026-07-09 - Fix DOM Clobbering vulnerability in DOM sanitizer
**Vulnerability:** The `sanitizeHTML` function was vulnerable to DOM clobbering. An attacker could inject a payload like `<form><input name="attributes"><input name="removeAttribute"><input name="remove"></form>` to overwrite standard DOM properties on the element instance, causing the sanitizer to crash or bypass attribute/element sanitization logic when it tried to access `el.attributes` or call `el.removeAttribute()` or `el.remove()$.
**Learning:** When writing DOM-based HTML sanitizers or interacting with potentially untrusted DOM elements (especially `<form>`), always use `Element.prototype` methods directly (e.g., `Element.prototype.getAttributeNames.call(el)`, `Element.prototype.getAttribute.call(el, ...)`, `Element.prototype.remove.call(el)`) instead of properties or methods on the element instance to completely prevent DOM Clobbering vulnerabilities.
**Prevention:** Updated `sanitizeHTML` to iterate over attributes using `Element.prototype.getAttributeNames.call(el)` and explicitly use `Element.prototype.getAttribute`, `removeAttribute`, `setAttribute`, and `remove` via `.call(el, ...)` rather than relying on instance properties.
