// Formatting utilities for EchoKit

/**
 * Escape HTML to prevent XSS
 * @param {*} str - String to escape
 * @returns {string} Escaped HTML string
 */
export function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Format timestamp as HH:MM:SS.mmm
 * @param {number} ts - Unix timestamp in milliseconds
 * @returns {string} Formatted time string
 */
export function formatTimestamp(ts) {
  if (!ts) return '--:--:--';
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  const ms = String(d.getMilliseconds()).padStart(3, '0');
  return `${hh}:${mm}:${ss}.${ms}`;
}

/**
 * Extract domain from URL
 * @param {string} url - URL to parse
 * @returns {string} Domain or fallback
 */
export function domainOf(url) {
  try {
    return new URL(url, location.href).host || '(local)';
  } catch {
    return '(unknown)';
  }
}

/**
 * Parse URL into path and query components
 * @param {string} url - URL to parse
 * @returns {{path: string, query: string}} Path and query object
 */
export function prettyUrl(url) {
  try {
    const u = new URL(url, location.href);
    return { path: u.pathname, query: u.search };
  } catch {
    return { path: url, query: '' };
  }
}

/**
 * Pretty-print JSON with syntax highlighting
 * @param {*} obj - Object to format
 * @returns {string} HTML string with syntax-highlighted JSON
 */
export function prettyJson(obj) {
  if (obj == null) return '';
  try {
    const str = typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2);
    return escapeHtml(str)
      .replace(/(".*?")/g, '<span class="json-string">$1</span>')
      .replace(/\b(\d+)\b/g, '<span class="json-number">$1</span>')
      .replace(/\b(true|false|null)\b/g, '<span class="json-keyword">$1</span>');
  } catch {
    return escapeHtml(String(obj));
  }
}

/**
 * Format bytes as human-readable size
 * @param {number} bytes - Number of bytes
 * @returns {string} Formatted size string
 */
export function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  if (!bytes) return '--';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Math.round(bytes / Math.pow(k, i) * 10) / 10} ${sizes[i]}`;
}

/**
 * Format duration in milliseconds
 * @param {number} ms - Duration in milliseconds
 * @returns {string} Formatted duration
 */
export function formatDuration(ms) {
  if (!ms && ms !== 0) return '--';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * Truncate string with ellipsis
 * @param {string} str - String to truncate
 * @param {number} maxLen - Maximum length
 * @returns {string} Truncated string
 */
export function truncate(str, maxLen = 50) {
  if (!str) return '';
  if (str.length <= maxLen) return str;
  return str.substring(0, maxLen - 3) + '...';
}

/**
 * Format HTTP status code with text
 * @param {number} status - HTTP status code
 * @returns {string} Formatted status string
 */
export function formatStatus(status) {
  const statusTexts = {
    200: 'OK', 201: 'Created', 204: 'No Content',
    301: 'Moved Permanently', 302: 'Found', 304: 'Not Modified',
    400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found',
    500: 'Internal Server Error', 502: 'Bad Gateway', 503: 'Service Unavailable'
  };
  return statusTexts[status] || '';
}
