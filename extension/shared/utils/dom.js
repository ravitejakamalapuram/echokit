// DOM utility functions for EchoKit

/**
 * Debounce input events
 * @param {HTMLElement} el - Input element
 * @param {Function} callback - Callback function
 * @param {number} delay - Debounce delay in ms
 */
export function debounceInput(el, callback, delay = 300) {
  let timer;
  el.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => callback(el.value), delay);
  });
}

/**
 * Show toast notification
 * @param {string} text - Toast message
 * @param {string} type - Toast type ('info', 'success', 'error')
 */
export function toast(text, type = 'info') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  
  const div = document.createElement('div');
  div.className = `toast toast-${type}`;
  div.textContent = text;
  document.body.appendChild(div);
  
  setTimeout(() => div.classList.add('show'), 10);
  setTimeout(() => {
    div.classList.remove('show');
    setTimeout(() => div.remove(), 300);
  }, 3000);
}

/**
 * Bind resizer functionality to an element
 * @param {HTMLElement} el - Resizer element
 * @param {Function} onResize - Callback with new width
 */
export function bindResizer(el, onResize) {
  let startX, startWidth;
  
  el.addEventListener('mousedown', (e) => {
    startX = e.clientX;
    startWidth = parseInt(getComputedStyle(el.previousElementSibling).width, 10);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    e.preventDefault();
  });
  
  function onMouseMove(e) {
    const dx = e.clientX - startX;
    const newWidth = Math.max(200, Math.min(startWidth + dx, window.innerWidth - 100));
    if (onResize) onResize(newWidth);
  }
  
  function onMouseUp() {
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  }
}

/**
 * Scroll element into view if needed
 * @param {HTMLElement} el - Element to scroll into view
 * @param {HTMLElement} container - Container element
 */
export function scrollIntoViewIfNeeded(el, container) {
  if (!el || !container) return;
  
  const elRect = el.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();
  
  if (elRect.top < containerRect.top) {
    container.scrollTop -= containerRect.top - elRect.top;
  } else if (elRect.bottom > containerRect.bottom) {
    container.scrollTop += elRect.bottom - containerRect.bottom;
  }
}

/**
 * Copy text to clipboard
 * @param {string} text - Text to copy
 * @returns {Promise<boolean>} Success status
 */
export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error('Failed to copy:', err);
    return false;
  }
}

/**
 * Read text from clipboard
 * @returns {Promise<string|null>} Clipboard text or null
 */
export async function readFromClipboard() {
  try {
    return await navigator.clipboard.readText();
  } catch (err) {
    console.error('Failed to read clipboard:', err);
    return null;
  }
}

/**
 * Download content as file
 * @param {string} content - File content
 * @param {string} filename - Filename
 * @param {string} mimeType - MIME type
 */
export function downloadFile(content, filename, mimeType = 'application/json') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Create element with attributes
 * @param {string} tag - HTML tag name
 * @param {Object} attrs - Attributes object
 * @param {string|HTMLElement|HTMLElement[]} children - Child content
 * @returns {HTMLElement} Created element
 */
export function createElement(tag, attrs = {}, children = null) {
  const el = document.createElement(tag);
  
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'className') el.className = value;
    else if (key === 'style' && typeof value === 'object') {
      Object.assign(el.style, value);
    } else if (key.startsWith('on') && typeof value === 'function') {
      el.addEventListener(key.substring(2).toLowerCase(), value);
    } else {
      el.setAttribute(key, value);
    }
  }
  
  if (children) {
    if (typeof children === 'string') {
      el.textContent = children;
    } else if (Array.isArray(children)) {
      children.forEach(child => el.appendChild(child));
    } else {
      el.appendChild(children);
    }
  }
  
  return el;
}
