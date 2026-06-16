/**
 * Waterfall Timeline Renderer
 *
 * Componentized waterfall rendering with Chrome Network tab parity.
 * Single source of truth - all timing logic delegated to interaction-helpers.js.
 *
 * Architecture:
 * - renderWaterfall() → main entry point
 * - renderWaterfallHeader() → column headers + time markers
 * - renderWaterfallRow() → single row with timing bars
 * - renderTimingBars() → multi-phase timing visualization
 * - renderTimingTooltip() → hover tooltip with breakdown
 */

import {
  escapeHtml,
  getStatusColor,
  getStatusValue,
  normalizeMethod,
  prettyUrl,
  parseUrl,
  calculateTimingPhases,
  getTimingColor,
  getTimingLabel,
  formatDuration,
  formatBytes,
  calculateTimelineScale
} from './interaction-helpers.js';

/**
 * Render waterfall timeline view
 *
 * @param {Array} interactions - Interactions to display
 * @param {Object} options - { selectedId: string }
 * @returns {string} HTML string
 */
export function renderWaterfall(interactions, options = {}) {
  if (!interactions || interactions.length === 0) {
    return `<div class="ek-empty-state">
      <div class="ek-empty-icon">📭</div>
      <div class="ek-empty-message">No interactions recorded yet</div>
    </div>`;
  }

  // Sort by start time
  const sorted = [...interactions].sort((a, b) => {
    const aStart = a.timestamp - (a.durationMs || 0);
    const bStart = b.timestamp - (b.durationMs || 0);
    return aStart - bStart;
  });

  // Calculate timeline scale
  const scale = calculateTimelineScale(sorted);

  return `
    <div class="ek-waterfall" data-testid="waterfall-view">
      ${renderWaterfallHeader(scale)}
      <div class="ek-waterfall-body">
        ${sorted.map(i => renderWaterfallRow(i, scale, options)).join('')}
      </div>
    </div>
  `;
}

/**
 * Render waterfall header with column labels and time markers
 *
 * @param {Object} scale - Timeline scale { minTime, maxTime, totalSpan, timeLabel }
 * @returns {string} HTML string
 */
export function renderWaterfallHeader(scale) {
  return `
    <div class="ek-waterfall-header">
      <span class="ek-waterfall-col-method">Method</span>
      <span class="ek-waterfall-col-path">Path</span>
      <span class="ek-waterfall-col-status">Status</span>
      <span class="ek-waterfall-col-size">Size</span>
      <span class="ek-waterfall-col-bar">Timeline (${scale.timeLabel})</span>
    </div>
  `;
}

/**
 * Render single waterfall row
 *
 * @param {Object} interaction - Interaction object
 * @param {Object} scale - Timeline scale
 * @param {Object} options - { selectedId: string }
 * @returns {string} HTML string
 */
export function renderWaterfallRow(interaction, scale, options = {}) {
  const selected = interaction.id === options.selectedId;
  const method = normalizeMethod(interaction.method);
  const path = getPathFromUrl(interaction.url);
  const status = getStatusValue(interaction);
  const statusColor = getStatusColor(status);
  const size = formatBytes(interaction.size?.total || 0);

  // Calculate timing bar position and width
  const startAt = interaction.timestamp - (interaction.durationMs || 0);
  const relStart = ((startAt - scale.minTime) / scale.totalSpan) * 100;
  const relWidth = Math.max((interaction.durationMs || 1) / scale.totalSpan * 100, 0.5);

  // Render timing bars
  const timingBarsHtml = renderTimingBars(interaction, relWidth);

  // Tooltip content
  const tooltipHtml = renderTimingTooltip(interaction);

  // Sanitize fields for HTML injection safety
  const safeId = escapeHtml(interaction.id);
  const safeMethod = escapeHtml(method);
  const safeMethodClass = method.toLowerCase().replace(/[^a-z0-9-]/g, ''); // Safe for CSS class
  const safeStatus = escapeHtml(String(status ?? '—'));

  return `
    <div class="ek-waterfall-row ${selected ? 'selected' : ''}"
         data-action="select"
         data-id="${safeId}"
         data-testid="waterfall-row"
         tabindex="0"
         title="${escapeHtml(interaction.url)}">
      <span class="ek-waterfall-col-method">
        <span class="ek-method-badge ek-method-${safeMethodClass}">${safeMethod}</span>
      </span>
      <span class="ek-waterfall-col-path ek-mono" title="${escapeHtml(interaction.url)}">
        ${escapeHtml(path)}
      </span>
      <span class="ek-waterfall-col-status" style="color: ${statusColor}">
        ${safeStatus}
      </span>
      <span class="ek-waterfall-col-size ek-mono">
        ${size}
      </span>
      <span class="ek-waterfall-col-bar">
        <span class="ek-waterfall-bars" style="left: ${relStart.toFixed(2)}%; width: ${relWidth.toFixed(2)}%">
          ${timingBarsHtml}
        </span>
        <span class="ek-waterfall-tooltip">${tooltipHtml}</span>
      </span>
    </div>
  `;
}

/**
 * Render timing phase bars (TTFB + Download with colors)
 *
 * @param {Object} interaction - Interaction object
 * @param {number} totalWidth - Total width percentage
 * @returns {string} HTML string
 */
export function renderTimingBars(interaction, totalWidth) {
  const phases = calculateTimingPhases(interaction);
  const total = interaction.durationMs || 0;

  if (total === 0) {
    return '<span class="ek-timing-bar" style="background: #8b8fa8; width: 100%"></span>';
  }

  // Only show visible phases (TTFB + Download for now)
  const wait = phases.wait || 0;
  const receive = phases.receive || 0;

  const waitPercent = (wait / total) * 100;
  const receivePercent = (receive / total) * 100;

  return `
    ${wait > 0 ? `<span class="ek-timing-bar" style="background: ${getTimingColor('wait')}; width: ${waitPercent.toFixed(1)}%"></span>` : ''}
    ${receive > 0 ? `<span class="ek-timing-bar" style="background: ${getTimingColor('receive')}; width: ${receivePercent.toFixed(1)}%"></span>` : ''}
  `;
}

/**
 * Render timing breakdown tooltip
 *
 * @param {Object} interaction - Interaction object
 * @returns {string} HTML string
 */
export function renderTimingTooltip(interaction) {
  const phases = calculateTimingPhases(interaction);
  const total = interaction.durationMs || 0;
  const method = normalizeMethod(interaction.method);
  const path = getPathFromUrl(interaction.url);
  const status = getStatusValue(interaction);
  const size = formatBytes(interaction.size?.total || 0);

  // Build timing rows (only show non-zero phases)
  const timingRows = [
    { phase: 'wait', value: phases.wait, important: true },
    { phase: 'receive', value: phases.receive, important: true },
    { phase: 'queueing', value: phases.queueing },
    { phase: 'dns', value: phases.dns },
    { phase: 'connect', value: phases.connect },
    { phase: 'ssl', value: phases.ssl },
    { phase: 'send', value: phases.send }
  ].filter(r => r.value > 0);

  return `
    <div class="ek-tooltip-content">
      <div class="ek-tooltip-header">
        <span class="ek-method-badge ek-method-${method.toLowerCase()}">${method}</span>
        <span class="ek-tooltip-path">${escapeHtml(path)}</span>
      </div>
      <div class="ek-tooltip-status">
        Status: ${status || 'pending'} · Size: ${size}
      </div>
      <div class="ek-tooltip-divider"></div>
      ${timingRows.map(r => `
        <div class="ek-tooltip-row ${r.important ? 'ek-tooltip-row-important' : ''}">
          <span class="ek-tooltip-label">${getTimingLabel(r.phase)}:</span>
          <span class="ek-tooltip-value">${formatDuration(r.value)}</span>
        </div>
      `).join('')}
      <div class="ek-tooltip-divider"></div>
      <div class="ek-tooltip-row ek-tooltip-row-total">
        <span class="ek-tooltip-label">Total:</span>
        <span class="ek-tooltip-value">${formatDuration(total)}</span>
      </div>
    </div>
  `;
}

/**
 * Extract path from URL (helper)
 *
 * @param {string} url - Full URL
 * @returns {string} Path + query (truncated)
 */
function getPathFromUrl(url) {
  const parsed = parseUrl(url);
  if (parsed) {
    const path = parsed.pathname;
    const query = parsed.search;

    if (query && query.length > 20) {
      return path + query.slice(0, 20) + '...';
    }

    return path + query;
  } catch {
    // Fallback for invalid URLs
    return url.length > 40 ? url.slice(0, 40) + '...' : url;
  }
}
