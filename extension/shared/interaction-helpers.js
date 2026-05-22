/**
 * EchoKit Interaction Helpers
 * 
 * SINGLE SOURCE OF TRUTH for all interaction data processing.
 * 
 * @architecture-rule ALL rendering logic must use these functions
 * @architecture-rule NO inline logic in column renderers
 * @architecture-rule Changes here automatically update BOTH popup and DevTools
 * 
 * @file extension/shared/interaction-helpers.js
 */

/**
 * Get CSS color variable for HTTP status code.
 * 
 * @param {number|null} status - HTTP status code
 * @returns {string} CSS variable (e.g., 'var(--red)')
 * 
 * @single-source-of-truth
 * Used by BOTH popup (via getStatusClass) and DevTools (inline style)
 * 
 * @example
 * getStatusColor(200) // 'var(--emerald)'
 * getStatusColor(404) // 'var(--amber)'
 * getStatusColor(500) // 'var(--red)'
 */
export function getStatusColor(status) {
  if (!status) return 'var(--text-muted)';
  if (status >= 500) return 'var(--red)';
  if (status >= 400) return 'var(--amber)';
  if (status >= 300) return 'var(--blue)';
  return 'var(--emerald)';
}

/**
 * Get CSS class name for status code (popup mode only).
 * 
 * @param {number|null} status - HTTP status code
 * @returns {string} CSS class (e.g., 's2', 's4', 's5')
 * 
 * @note Popup uses .ek-status.s2, .s4, etc. CSS classes
 */
export function getStatusClass(status) {
  return 's' + Math.floor((status || 0) / 100);
}

/**
 * Get final status value, respecting overrides.
 * 
 * @param {Object} interaction - Interaction object
 * @returns {number|null} Final status code
 * 
 * @single-source-of-truth
 */
export function getStatusValue(interaction) {
  return interaction.overrideStatus ?? interaction.responseStatus;
}

/**
 * Normalize HTTP method to uppercase.
 * 
 * @param {string|null} method - HTTP method
 * @returns {string} Uppercase method (e.g., 'GET', 'POST')
 * 
 * @single-source-of-truth
 * Defaults to 'GET' if null/empty
 */
export function normalizeMethod(method) {
  return (method || 'GET').toUpperCase();
}

/**
 * Format duration for display.
 * 
 * @param {number|null} ms - Duration in milliseconds
 * @returns {string} Formatted duration (e.g., '45ms' or '—')
 */
export function formatDuration(ms) {
  return ms ? ms + 'ms' : '—';
}

/**
 * Format timestamp as relative time.
 * 
 * @param {number} timestamp - Unix timestamp in milliseconds
 * @returns {string} Relative time (e.g., '2m ago', '5h ago')
 * 
 * @single-source-of-truth
 */
export function formatTimestamp(timestamp) {
  const now = Date.now();
  const diff = now - timestamp;
  if (diff < 60_000) return Math.floor(diff / 1000) + 's ago';
  if (diff < 3600_000) return Math.floor(diff / 60_000) + 'm ago';
  if (diff < 86400_000) return Math.floor(diff / 3600_000) + 'h ago';
  return Math.floor(diff / 86400_000) + 'd ago';
}

/**
 * Pretty-print URL (extract path and query).
 * 
 * @param {string} url - Full URL
 * @returns {{path: string, query: string}} Path and query parts
 * 
 * @single-source-of-truth
 */
export function prettyUrl(url) {
  try {
    const u = new URL(url);
    return {
      path: u.pathname,
      query: u.search
    };
  } catch {
    return { path: url, query: '' };
  }
}

/**
 * Get match mode badge text abbreviation.
 * 
 * @param {string} mode - Match mode (e.g., 'ignore-query')
 * @returns {string} Badge text (e.g., 'NOQ')
 */
export function getModeBadgeText(mode) {
  const mapping = {
    'ignore-query': 'NOQ',
    'ignore-body': 'NOB',
    'path-wildcard': 'PATH'
  };
  return mapping[mode] || mode;
}

/**
 * Check if interaction has conflict (multiple versions with same hash).
 * 
 * @param {Object} interaction - Interaction to check
 * @param {Array} allInteractions - All interactions to compare against
 * @returns {boolean} True if conflict exists
 */
export function hasConflict(interaction, allInteractions) {
  const count = allInteractions.filter(x => x.hash === interaction.hash).length;
  return count > 1;
}

/**
 * Get number of conflicting versions.
 * 
 * @param {Object} interaction - Interaction to check
 * @param {Array} allInteractions - All interactions to compare against
 * @returns {number} Number of versions
 */
export function getConflictCount(interaction, allInteractions) {
  return allInteractions.filter(x => x.hash === interaction.hash).length;
}

/**
 * Escape HTML special characters.
 * 
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
export function escapeHtml(str) {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
