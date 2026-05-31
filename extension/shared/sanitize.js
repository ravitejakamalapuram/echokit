/**
 * Sanitize HTML to prevent XSS.
 * This uses a basic fallback sanitizer due to limitations on injecting large third-party libraries (< 50 lines).
 * For a complete solution, a library like DOMPurify is recommended.
 *
 * @param {string} dirty - Dirty HTML string
 * @returns {string} Sanitized HTML string
 */
export function sanitizeHTML(dirty) {
  if (!dirty) return '';
  // Fallback for non-browser environments or when DOMPurify isn't available
  // It removes script tags and on* attributes.
  let safe = String(dirty);

  // Remove <script> tags and content
  safe = safe.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // Remove on* event handlers (e.g. onclick, onerror)
  safe = safe.replace(/(\s)(on\w+)=['"]?[^>]*?['"]?(?=>|\s)/gi, '$1');

  // Remove javascript: and data: URIs in href and src
  safe = safe.replace(/(href|src)=['"]?(javascript|data):[^>]*?['"]?(?=>|\s)/gi, '$1="#"');

  return safe;
}
