/**
 * EchoKit Interaction Rendering Components
 *
 * Core rendering functions that use column configuration.
 *
 * @architecture-rule MUST use INTERACTION_COLUMNS from columns.js
 * @architecture-rule MUST NOT duplicate column rendering logic
 * @architecture-rule Mode-agnostic - works for both popup and DevTools
 *
 * @file extension/shared/interaction-renderer.js
 */

import { INTERACTION_COLUMNS, getColumnsForMode } from './columns.js';

/**
 * Render a single interaction row.
 *
 * @param {Object} interaction - Interaction object
 * @param {string} mode - 'popup' or 'devtools'
 * @param {Array} allInteractions - All interactions (for conflict detection)
 * @returns {string} HTML string
 */
export function renderInteractionRow(interaction, mode, allInteractions = []) {
  const columns = getColumnsForMode(mode);
  const isSelected = false; // Will be determined by caller

  if (mode === 'popup') {
    // Popup uses grouped list row
    const cells = columns
      .map(col => col.render(interaction, mode, allInteractions))
      .join('');

    return `<div class="ek-row${isSelected ? ' selected' : ''}" data-id="${interaction.id}" data-action="select" data-testid="api-row">
      ${cells}
    </div>`;
  } else {
    // DevTools uses table row
    const cells = columns
      .map(col => {
        const content = col.render(interaction, mode, allInteractions);
        const width = col.width ? ` style="width:${col.width}"` : '';
        return `<td class="ek-table-cell"${width}>${content}</td>`;
      })
      .join('');

    return `<tr class="ek-table-row${isSelected ? ' selected' : ''}" data-id="${interaction.id}" data-action="select" data-testid="interaction-row">
      ${cells}
    </tr>`;
  }
}

/**
 * Render table header (DevTools only).
 *
 * @param {string} mode - Must be 'devtools'
 * @param {Object} sortState - { sortBy: string, sortOrder: 'asc'|'desc' }
 * @returns {string} HTML string
 */
export function renderTableHeader(mode, sortState = {}) {
  if (mode !== 'devtools') return '';

  const columns = getColumnsForMode('devtools');
  const { sortBy, sortOrder } = sortState;

  const headers = columns
    .map(col => {
      const width = col.width ? ` style="width:${col.width}"` : '';
      const sortable = col.sortable ? ' ek-sortable' : '';
      const sorted = sortBy === col.key ? ` ek-sorted-${sortOrder}` : '';
      const sortIcon = sortBy === col.key
        ? (sortOrder === 'asc' ? ' ▲' : ' ▼')
        : '';

      return `<th class="ek-table-header${sortable}${sorted}"${width} data-sort-key="${col.key}">
        ${col.label}${sortIcon}
      </th>`;
    })
    .join('');

  return `<thead class="ek-table-head">
    <tr>${headers}</tr>
  </thead>`;
}

/**
 * Render domain group header (Popup only).
 *
 * @param {string} domain - Domain name
 * @param {number} count - Number of interactions in group
 * @returns {string} HTML string
 */
export function renderGroupHeader(domain, count) {
  return `<div class="ek-group-header">
    <span class="ek-group-domain">${domain}</span>
    <span class="ek-group-count">${count}</span>
  </div>`;
}

/**
 * Render empty state message.
 *
 * @param {string} mode - 'popup' or 'devtools'
 * @param {string} reason - 'no-data' | 'no-results' | 'no-tab'
 * @returns {string} HTML string
 */
export function renderEmptyState(mode, reason = 'no-data') {
  const messages = {
    'no-data': 'No interactions recorded yet',
    'no-results': 'No interactions match your filters',
    'no-tab': 'No active tab selected'
  };

  const message = messages[reason] || messages['no-data'];
  const emoji = reason === 'no-results' ? '🔍' : '📭';

  return `<div class="ek-empty-state">
    <div class="ek-empty-icon">${emoji}</div>
    <div class="ek-empty-message">${message}</div>
  </div>`;
}

/**
 * Render interaction list (grouped or flat).
 *
 * @param {Array} interactions - Interactions to render
 * @param {string} mode - 'popup' or 'devtools'
 * @param {Object} options - { groupByDomain: boolean, sortState: object }
 * @returns {string} HTML string
 */
export function renderInteractionList(interactions, mode, options = {}) {
  const { groupByDomain = false, sortState = {} } = options;

  if (!interactions || interactions.length === 0) {
    return renderEmptyState(mode, 'no-data');
  }

  if (mode === 'popup' && groupByDomain) {
    // Popup grouped mode
    return renderGroupedList(interactions, mode);
  } else if (mode === 'devtools') {
    // DevTools table mode
    return renderTableList(interactions, mode, sortState);
  } else {
    // Popup flat mode
    return renderFlatList(interactions, mode);
  }
}

/**
 * Render flat list of interactions (Popup mode).
 *
 * @param {Array} interactions - Interactions to render
 * @param {string} mode - 'popup'
 * @returns {string} HTML string
 */
function renderFlatList(interactions, mode) {
  const rows = interactions
    .map(i => renderInteractionRow(i, mode, interactions))
    .join('');

  return `<div class="ek-interaction-list">
    ${rows}
  </div>`;
}

/**
 * Render grouped list of interactions (Popup mode).
 *
 * @param {Array} interactions - Interactions to render
 * @param {string} mode - 'popup'
 * @returns {string} HTML string
 */
function renderGroupedList(interactions, mode) {
  // Group by domain
  const groups = {};
  interactions.forEach(i => {
    const domain = new URL(i.url).hostname;
    if (!groups[domain]) groups[domain] = [];
    groups[domain].push(i);
  });

  // Render each group
  const groupHtml = Object.entries(groups)
    .map(([domain, items]) => {
      const header = renderGroupHeader(domain, items.length);
      const rows = items
        .map(i => renderInteractionRow(i, mode, interactions))
        .join('');

      return `${header}${rows}`;
    })
    .join('');

  return `<div class="ek-interaction-list grouped">
    ${groupHtml}
  </div>`;
}

/**
 * Render table list of interactions (DevTools mode).
 *
 * @param {Array} interactions - Interactions to render
 * @param {string} mode - 'devtools'
 * @param {Object} sortState - { sortBy: string, sortOrder: 'asc'|'desc' }
 * @returns {string} HTML string
 */
function renderTableList(interactions, mode, sortState) {
  const header = renderTableHeader(mode, sortState);
  const rows = interactions
    .map(i => renderInteractionRow(i, mode, interactions))
    .join('');

  return `<table class="ek-interaction-table">
    ${header}
    <tbody class="ek-table-body">
      ${rows}
    </tbody>
  </table>`;
}

/**
 * Sort interactions by a column key.
 *
 * @param {Array} interactions - Interactions to sort
 * @param {string} sortBy - Column key to sort by
 * @param {string} sortOrder - 'asc' or 'desc'
 * @returns {Array} Sorted interactions
 */
export function sortInteractions(interactions, sortBy, sortOrder = 'asc') {
  if (!sortBy || !interactions || interactions.length === 0) {
    return interactions;
  }

  const sorted = [...interactions].sort((a, b) => {
    let aVal, bVal;

    switch (sortBy) {
      case 'status':
        aVal = a.overrideStatus ?? a.responseStatus ?? 0;
        bVal = b.overrideStatus ?? b.responseStatus ?? 0;
        break;
      case 'method':
        aVal = (a.method || 'GET').toUpperCase();
        bVal = (b.method || 'GET').toUpperCase();
        break;
      case 'url':
        aVal = a.url || '';
        bVal = b.url || '';
        break;
      case 'duration':
        aVal = a.duration || 0;
        bVal = b.duration || 0;
        break;
      case 'timestamp':
        aVal = a.timestamp || 0;
        bVal = b.timestamp || 0;
        break;
      default:
        return 0;
    }

    if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  return sorted;
}

/**
 * Filter interactions by search term.
 *
 * @param {Array} interactions - Interactions to filter
 * @param {string} searchTerm - Search term
 * @returns {Array} Filtered interactions
 */
export function filterInteractions(interactions, searchTerm) {
  if (!searchTerm || searchTerm.trim() === '') {
    return interactions;
  }

  const term = searchTerm.toLowerCase().trim();

  return interactions.filter(i => {
    const url = (i.url || '').toLowerCase();
    const method = (i.method || '').toLowerCase();
    const status = String(i.responseStatus || '');

    return url.includes(term) ||
           method.includes(term) ||
           status.includes(term);
  });
}
