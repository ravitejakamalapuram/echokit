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
  if (ms === 0) return '0ms';
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
  const diff = Math.max(0, now - timestamp); // Clamp to zero for future timestamps
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

const conflictGroupCache = new WeakMap();

function getHashGroups(allInteractions) {
  let groups = conflictGroupCache.get(allInteractions);
  if (!groups) {
    groups = new Map();
    for (let i = 0; i < allInteractions.length; i++) {
      const h = allInteractions[i].hash;
      if (h) {
        if (!groups.has(h)) groups.set(h, []);
        groups.get(h).push(allInteractions[i]);
      }
    }
    conflictGroupCache.set(allInteractions, groups);
  }
  return groups;
}

/**
 * Check if interaction has conflict (multiple versions with same hash).
 *
 * @param {Object} interaction - Interaction to check
 * @param {Array} allInteractions - All interactions to compare against
 * @returns {boolean} True if conflict exists
 */
export function hasConflict(interaction, allInteractions) {
  return getConflictCount(interaction, allInteractions) > 1;
}

/**
 * Get number of conflicting versions.
 *
 * @param {Object} interaction - Interaction to check
 * @param {Array} allInteractions - All interactions to compare against
 * @returns {number} Number of versions
 */
export function getConflictCount(interaction, allInteractions) {
  if (!interaction || !interaction.hash || !allInteractions) return 0;
  const group = getHashGroups(allInteractions).get(interaction.hash);
  return group ? group.length : 0;
}

/**
 * Get all conflicting versions for a given interaction.
 *
 * @param {Object} interaction - Interaction to check
 * @param {Array} allInteractions - All interactions to search
 * @returns {Array} Array of conflicting interactions
 */
export function getConflicts(interaction, allInteractions) {
  if (!interaction || !interaction.hash || !allInteractions) return [];
  return getHashGroups(allInteractions).get(interaction.hash) || [];
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

// =============================================================================
// Waterfall Timing Helpers
// =============================================================================

/**
 * Calculate timing phases for waterfall visualization
 *
 * @param {Object} interaction - Interaction object
 * @returns {Object} Timing phases { queueing, dns, connect, ssl, send, wait, receive }
 */
export function calculateTimingPhases(interaction) {
  const total = interaction.durationMs || 0;

  // If we have detailed timing data from Performance API
  if (interaction.timing) {
    return {
      queueing: interaction.timing.queueing || 0,
      dns: interaction.timing.dns || 0,
      connect: interaction.timing.connect || 0,
      ssl: interaction.timing.ssl || 0,
      send: interaction.timing.send || 0,
      wait: interaction.timing.wait || 0,
      receive: interaction.timing.receive || 0
    };
  }

  // Fallback: estimate phases based on total duration
  // Typical split for XHR/fetch: ~30% TTFB, ~70% download
  const wait = Math.round(total * 0.3);
  const receive = total - wait;

  return {
    queueing: 0,
    dns: 0,
    connect: 0,
    ssl: 0,
    send: 0,
    wait,
    receive
  };
}

/**
 * Get color for timing phase (Chrome Network tab style)
 *
 * @param {string} phase - Phase name (queueing, dns, connect, ssl, send, wait, receive)
 * @returns {string} CSS color
 */
export function getTimingColor(phase) {
  const colors = {
    queueing: '#e4e4e7',  // light gray
    dns: '#10b981',       // emerald
    connect: '#f59e0b',   // amber
    ssl: '#a78bfa',       // purple
    send: '#60a5fa',      // blue
    wait: '#34d399',      // green (TTFB - most important)
    receive: '#3b82f6'    // blue (Download - most important)
  };

  return colors[phase] || '#8b8fa8';
}

/**
 * Format bytes to human-readable size
 *
 * @param {number} bytes - Size in bytes
 * @returns {string} Formatted size (e.g., "1.2 KB", "3.4 MB")
 */
export function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const value = bytes / Math.pow(k, i);

  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/**
 * Get timing phase label (human-readable)
 *
 * @param {string} phase - Phase name
 * @returns {string} Human-readable label
 */
export function getTimingLabel(phase) {
  const labels = {
    queueing: 'Queueing',
    dns: 'DNS Lookup',
    connect: 'Initial Connection',
    ssl: 'SSL',
    send: 'Request Sent',
    wait: 'Waiting (TTFB)',
    receive: 'Content Download'
  };

  return labels[phase] || phase;
}

/**
 * Calculate waterfall timeline scale
 *
 * @param {Array} interactions - Array of interactions
 * @returns {Object} { minTime, maxTime, totalSpan, timeLabel }
 */
export function calculateTimelineScale(interactions) {
  if (!interactions || interactions.length === 0) {
    return { minTime: 0, maxTime: 1, totalSpan: 1, timeLabel: '0ms' };
  }

  // Calculate start time for each interaction
  const rows = interactions.map(i => ({
    startAt: i.timestamp - (i.durationMs || 0),
    endAt: i.timestamp
  }));

  const minTime = Math.min(...rows.map(r => r.startAt));
  const maxTime = Math.max(...rows.map(r => r.endAt));
  const totalSpan = Math.max(maxTime - minTime, 1);

  // Format timeline label
  const timeLabel = totalSpan < 1000
    ? `${Math.round(totalSpan)}ms`
    : totalSpan < 60000
      ? `${(totalSpan / 1000).toFixed(2)}s`
      : `${(totalSpan / 60000).toFixed(1)}min`;

  return { minTime, maxTime, totalSpan, timeLabel };
}
