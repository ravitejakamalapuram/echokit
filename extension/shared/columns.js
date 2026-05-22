/**
 * EchoKit Column Configuration
 *
 * SINGLE SOURCE OF TRUTH for all interaction table columns.
 *
 * @architecture-rule MUST import helpers from interaction-helpers.js
 * @architecture-rule MUST NOT inline business logic
 * @architecture-rule Mode parameter controls presentation ONLY
 * @architecture-rule Changes here update BOTH popup and DevTools
 *
 * @file extension/shared/columns.js
 */

import {
  getStatusColor,
  getStatusClass,
  getStatusValue,
  normalizeMethod,
  formatDuration,
  formatTimestamp,
  prettyUrl,
  getModeBadgeText,
  hasConflict,
  getConflictCount,
  escapeHtml
} from './interaction-helpers.js';

/**
 * Column metadata and render functions.
 *
 * Each column has:
 * - key: Unique identifier
 * - label: Header text
 * - width: Fixed width (CSS value) or null for flexible
 * - sortable: Whether column can be sorted (DevTools only)
 * - visibleIn: Array of modes where column appears
 * - render: Function (interaction, mode, allInteractions) => HTML string
 *
 * @type {Object.<string, Column>}
 */
export const INTERACTION_COLUMNS = {
  /**
   * HTTP Method badge
   */
  method: {
    key: 'method',
    label: 'Method',
    width: '80px',
    sortable: true,
    visibleIn: ['popup', 'devtools'],
    render: (i, mode) => {
      const method = normalizeMethod(i.method);

      if (mode === 'popup') {
        // Popup uses badge with specific class
        return `<span class="ek-method ${method}">${escapeHtml(method)}</span>`;
      } else {
        // DevTools uses simpler badge
        return `<span class="ek-method-badge ek-method-${method.toLowerCase()}">${escapeHtml(method)}</span>`;
      }
    }
  },

  /**
   * Status code with color
   */
  status: {
    key: 'status',
    label: 'Status',
    width: '70px',
    sortable: true,
    visibleIn: ['popup', 'devtools'],
    render: (i, mode) => {
      const status = getStatusValue(i);
      const color = getStatusColor(status);
      const cssClass = getStatusClass(status);

      if (mode === 'popup') {
        // Popup uses CSS class for color
        return `<span class="ek-status ${cssClass}">${status || '—'}</span>`;
      } else {
        // DevTools uses inline style
        return `<span class="ek-status" style="color:${color}">${status || '—'}</span>`;
      }
    }
  },

  /**
   * URL with path and query
   */
  url: {
    key: 'url',
    label: 'URL',
    width: null, // Flexible
    sortable: true,
    visibleIn: ['popup', 'devtools'],
    render: (i, mode) => {
      const { path, query } = prettyUrl(i.url);

      if (mode === 'popup') {
        // Popup shows path + query with separate styling
        return `<span class="ek-url">` +
          `<span class="ek-url-path">${escapeHtml(path)}</span>` +
          (query ? `<span class="ek-url-query">${escapeHtml(query)}</span>` : '') +
          `</span>`;
      } else {
        // DevTools shows just pathname with ellipsis
        return `<span class="ek-url" title="${escapeHtml(i.url)}">${escapeHtml(path)}</span>`;
      }
    }
  },

  /**
   * Duration in milliseconds
   */
  duration: {
    key: 'duration',
    label: 'Duration',
    width: '90px',
    sortable: true,
    visibleIn: ['devtools'], // DevTools only
    render: (i) => {
      const duration = formatDuration(i.duration);
      return `<span class="ek-duration">${escapeHtml(duration)}</span>`;
    }
  },

  /**
   * Timestamp (relative)
   */
  timestamp: {
    key: 'timestamp',
    label: 'Time',
    width: '90px',
    sortable: true,
    visibleIn: ['devtools'], // DevTools only
    render: (i) => {
      const time = formatTimestamp(i.timestamp);
      return `<span class="ek-timestamp">${escapeHtml(time)}</span>`;
    }
  },

  /**
   * Mode badge (NOQ, NOB, PATH)
   */
  modeBadge: {
    key: 'modeBadge',
    label: '',
    width: '50px',
    sortable: false,
    visibleIn: ['popup'], // Popup only
    render: (i) => {
      if (!i.matchMode || i.matchMode === 'exact') return '';

      const badgeText = getModeBadgeText(i.matchMode);
      return `<span class="ek-mode-badge">${escapeHtml(badgeText)}</span>`;
    }
  },

  /**
   * Conflict badge (shows version count)
   */
  conflictBadge: {
    key: 'conflictBadge',
    label: '',
    width: '50px',
    sortable: false,
    visibleIn: ['popup'], // Popup only
    render: (i, mode, allInteractions) => {
      if (!hasConflict(i, allInteractions)) return '';

      const count = getConflictCount(i, allInteractions);
      return `<span class="ek-conflict-badge" title="${count} versions">⚠️ ${count}</span>`;
    }
  },

  /**
   * Action buttons (mock toggle, edit, delete)
   */
  actions: {
    key: 'actions',
    label: 'Actions',
    width: '120px',
    sortable: false,
    visibleIn: ['popup', 'devtools'],
    render: (i, mode) => {
      if (mode === 'popup') {
        // Popup uses toggle switch
        const isActive = i.mockActive || false;
        const toggleClass = isActive ? 'active' : '';

        return `<div class="ek-actions">` +
          `<label class="ek-mock-toggle ${toggleClass}">` +
          `<input type="checkbox" ${isActive ? 'checked' : ''} data-id="${i.id}">` +
          `<span class="ek-toggle-slider"></span>` +
          `</label>` +
          `</div>`;
      } else {
        // DevTools uses icon buttons
        const editIcon = `<svg class="ek-icon" viewBox="0 0 16 16"><path d="M11 0l5 5-9 9H2v-5z"/></svg>`;
        const deleteIcon = `<svg class="ek-icon" viewBox="0 0 16 16"><path d="M3 3l10 10M13 3L3 13"/></svg>`;

        return `<div class="ek-actions">` +
          `<button class="ek-icon-btn" data-action="edit" data-id="${i.id}" title="Edit">${editIcon}</button>` +
          `<button class="ek-icon-btn" data-action="delete" data-id="${i.id}" title="Delete">${deleteIcon}</button>` +
          `</div>`;
      }
    }
  }
};

/**
 * Get columns visible in a specific mode.
 *
 * @param {string} mode - 'popup' or 'devtools'
 * @returns {Array<Column>} Columns visible in this mode
 */
export function getColumnsForMode(mode) {
  return Object.values(INTERACTION_COLUMNS).filter(col =>
    col.visibleIn.includes(mode)
  );
}

/**
 * Get column by key.
 *
 * @param {string} key - Column key
 * @returns {Column|null}
 */
export function getColumn(key) {
  return INTERACTION_COLUMNS[key] || null;
}
