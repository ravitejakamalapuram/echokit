## 2025-02-26 - Prevent DOM XSS in UI rendering
**Vulnerability:** The application used `innerHTML` directly with template literals for rendering HTML fragments without proper sanitization, posing a high risk for Cross-Site Scripting (DOM XSS).
**Learning:** `innerHTML` shouldn't be populated directly with untrusted data unless it goes through a safe sanitization library such as DOMPurify to clean out dangerous inputs like script tags or inline event handlers.
**Prevention:** Use DOMPurify and a helper function (`sanitizeHTML()`) when constructing complex HTML using `innerHTML` to ensure untrusted inputs are completely stripped out before they enter the DOM.
