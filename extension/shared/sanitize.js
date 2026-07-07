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
    // Use Element.prototype to prevent DOM Clobbering (e.g. <form><input name="attributes"></form>)
    const attrNames = Element.prototype.getAttributeNames.call(el);
    attrNames.forEach(name => {
      // Remove event handlers (onclick, onerror, etc.)
      if (dangerousAttributes.test(name)) {
        Element.prototype.removeAttribute.call(el, name);
      } else if (name === 'href' || name === 'src') {
        // Sanitize href and src to remove javascript: and data: URIs
        const value = Element.prototype.getAttribute.call(el, name);
        if (value) {
          // Strip control characters (0x00-0x1F, 0x7F) before checking prefix to prevent bypasses
          const cleanVal = value.replace(/[\x00-\x20\x7F]/g, '').toLowerCase();
          if (cleanVal.startsWith('javascript:') || cleanVal.startsWith('data:') || cleanVal.startsWith('vbscript:')) {
            Element.prototype.setAttribute.call(el, name, '#');
          }
        }
      }
    });
  });

  // Create a div to serialize the sanitized content
  const div = document.createElement('div');
  div.appendChild(fragment);
  return div.innerHTML;
}
