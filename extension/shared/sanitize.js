/**
 * Sanitize HTML to prevent XSS using DOM-based parsing.
 * Creates a temporary DOM element, parses HTML, and sanitizes by removing dangerous elements and attributes.
 * This is safer than regex-based sanitization which can be bypassed.
 *
 * @param {string} dirty - Dirty HTML string
 * @returns {string} Sanitized HTML string
 */
export function sanitizeHTML(dirty) {
  if (!dirty) return '';

  const template = document.createElement('template');
  template.innerHTML = dirty.trim();

  const fragment = template.content;

  // Remove all script tags
  fragment.querySelectorAll('script').forEach(el => el.remove());

  // Remove all elements with dangerous tags
  const dangerousTags = ['iframe', 'object', 'embed', 'link', 'style', 'base', 'meta'];
  dangerousTags.forEach(tag => {
    fragment.querySelectorAll(tag).forEach(el => el.remove());
  });

  // Remove all dangerous attributes from all elements
  const dangerousAttributes = /^on|^formaction$|^form$|^xmlns$/i;
  fragment.querySelectorAll('*').forEach(el => {
    Array.from(el.attributes).forEach(attr => {
      // Remove event handlers (onclick, onerror, etc.)
      if (dangerousAttributes.test(attr.name)) {
        el.removeAttribute(attr.name);
      }
      // Sanitize href and src to remove javascript: and data: URIs
      if ((attr.name === 'href' || attr.name === 'src') && attr.value) {
        // Strip control characters (0x00-0x1F, 0x7F) before checking prefix to prevent bypasses
        const cleanVal = attr.value.replace(/[\x00-\x20\x7F]/g, '').toLowerCase();
        if (cleanVal.startsWith('javascript:') || cleanVal.startsWith('data:') || cleanVal.startsWith('vbscript:')) {
          el.setAttribute(attr.name, '#');
        }
      }
    });
  });

  // Create a div to serialize the sanitized content
  const div = document.createElement('div');
  div.appendChild(fragment);
  return div.innerHTML;
}
