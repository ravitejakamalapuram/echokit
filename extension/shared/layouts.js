/**
 * EchoKit Layout Adaptors
 *
 * Manages rendering and event handling for popup and DevTools modes.
 *
 * @architecture-rule MUST use renderInteractionList from interaction-renderer.js
 * @architecture-rule MUST NOT duplicate rendering logic
 * @architecture-rule Handles events and state, delegates rendering to Phase 2
 *
 * @file extension/shared/layouts.js
 */

import {
  renderInteractionList,
  sortInteractions,
  filterInteractions
} from './interaction-renderer.js';
import { sanitizeHTML } from './sanitize.js';

/**
 * Base Layout class with common functionality.
 */
class BaseLayout {
  constructor(containerElement, mode) {
    this.container = containerElement;
    this.mode = mode;
    this.state = {
      interactions: [],
      filteredInteractions: [],
      selectedId: null,
      searchTerm: '',
      sortBy: null,
      sortOrder: 'asc'
    };
    this.listeners = [];
  }

  /**
   * Set interactions data.
   */
  setInteractions(interactions) {
    this.state.interactions = interactions;
    this.applyFiltersAndSort();
  }

  /**
   * Set search term.
   */
  setSearchTerm(term) {
    this.state.searchTerm = term;
    this.applyFiltersAndSort();
  }

  /**
   * Apply filters and sorting, then render.
   */
  applyFiltersAndSort() {
    let filtered = filterInteractions(this.state.interactions, this.state.searchTerm);
    let sorted = sortInteractions(filtered, this.state.sortBy, this.state.sortOrder);
    this.state.filteredInteractions = sorted;
    this.render();
  }

  /**
   * Soft render - update DOM without full re-render.
   * Override in subclasses for optimization.
   */
  softRender() {
    this.render();
  }

  /**
   * Add event listener wrapper for cleanup.
   */
  addEventListener(element, event, handler) {
    element.addEventListener(event, handler);
    this.listeners.push({ element, event, handler });
  }

  /**
   * Remove all event listeners.
   */
  removeAllListeners() {
    this.listeners.forEach(({ element, event, handler }) => {
      element.removeEventListener(event, handler);
    });
    this.listeners = [];
  }

  /**
   * Destroy layout and cleanup.
   */
  destroy() {
    this.removeAllListeners();
    this.container.innerHTML = '';
  }

  /**
   * Render - must be implemented by subclass.
   */
  render() {
    throw new Error('render() must be implemented by subclass');
  }
}

/**
 * Popup Layout - Grouped list with toggle switches.
 */
export class PopupLayout extends BaseLayout {
  constructor(containerElement) {
    super(containerElement, 'popup');
    this.state.groupByDomain = true;
  }

  /**
   * Toggle domain grouping.
   */
  setGroupByDomain(enabled) {
    this.state.groupByDomain = enabled;
    this.render();
  }

  /**
   * Render popup layout.
   */
  render() {
    const html = renderInteractionList(
      this.state.filteredInteractions,
      'popup',
      { groupByDomain: this.state.groupByDomain }
    );

    // SECURITY: Sanitize generated HTML before assignment to prevent DOM XSS
    this.container.innerHTML = sanitizeHTML(html);
    this.attachEventListeners();
  }

  /**
   * Attach event listeners using delegation.
   */
  attachEventListeners() {
    this.removeAllListeners();

    // Row click for selection
    this.addEventListener(this.container, 'click', (e) => {
      const row = e.target.closest('.ek-row');
      if (row) {
        this.handleRowClick(row);
      }
    });

    // Mock toggle change
    this.addEventListener(this.container, 'change', (e) => {
      if (e.target.matches('.ek-mock-toggle input')) {
        this.handleMockToggle(e.target);
      }
    });
  }

  /**
   * Handle row click.
   */
  handleRowClick(row) {
    const id = row.dataset.id;
    this.state.selectedId = id;

    // Update UI
    this.container.querySelectorAll('.ek-row').forEach(r => {
      r.classList.toggle('selected', r.dataset.id === id);
    });

    // Emit event for app.js to handle
    this.container.dispatchEvent(new CustomEvent('interaction-selected', {
      detail: { id }
    }));
  }

  /**
   * Handle mock toggle.
   */
  handleMockToggle(checkbox) {
    const id = checkbox.dataset.id;
    const enabled = checkbox.checked;

    // Emit event for app.js to handle
    this.container.dispatchEvent(new CustomEvent('mock-toggled', {
      detail: { id, enabled }
    }));
  }
}

/**
 * DevTools Layout - Sortable table with action buttons.
 */
export class DevToolsLayout extends BaseLayout {
  constructor(containerElement) {
    super(containerElement, 'devtools');
    this.state.sortBy = 'timestamp';
    this.state.sortOrder = 'desc';
  }

  /**
   * Set sort column and order.
   */
  setSorting(sortBy, sortOrder) {
    this.state.sortBy = sortBy;
    this.state.sortOrder = sortOrder;
    this.applyFiltersAndSort();
  }

  /**
   * Render DevTools layout.
   */
  render() {
    const html = renderInteractionList(
      this.state.filteredInteractions,
      'devtools',
      {
        sortState: {
          sortBy: this.state.sortBy,
          sortOrder: this.state.sortOrder
        }
      }
    );

    // SECURITY: Sanitize generated HTML before assignment to prevent DOM XSS
    this.container.innerHTML = sanitizeHTML(html);
    this.attachEventListeners();
  }

  /**
   * Attach event listeners using delegation.
   */
  attachEventListeners() {
    this.removeAllListeners();

    // Row click for selection
    this.addEventListener(this.container, 'click', (e) => {
      const row = e.target.closest('.ek-table-row');
      if (row) {
        this.handleRowClick(row);
      }
    });

    // Header click for sorting
    this.addEventListener(this.container, 'click', (e) => {
      const header = e.target.closest('.ek-table-header.ek-sortable');
      if (header) {
        this.handleHeaderClick(header);
      }
    });

    // Action button clicks
    this.addEventListener(this.container, 'click', (e) => {
      const btn = e.target.closest('.ek-icon-btn');
      if (btn) {
        this.handleActionClick(btn);
      }
    });
  }

  /**
   * Handle row click.
   */
  handleRowClick(row) {
    const id = row.dataset.id;
    this.state.selectedId = id;

    // Update UI
    this.container.querySelectorAll('.ek-table-row').forEach(r => {
      r.classList.toggle('selected', r.dataset.id === id);
    });

    // Emit event
    this.container.dispatchEvent(new CustomEvent('interaction-selected', {
      detail: { id }
    }));
  }

  /**
   * Handle header click for sorting.
   */
  handleHeaderClick(header) {
    const sortKey = header.dataset.sortKey;

    // Toggle sort order if same column
    if (this.state.sortBy === sortKey) {
      this.state.sortOrder = this.state.sortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      this.state.sortBy = sortKey;
      this.state.sortOrder = 'asc';
    }

    this.applyFiltersAndSort();
  }

  /**
   * Handle action button click.
   */
  handleActionClick(btn) {
    const action = btn.dataset.action;
    const id = btn.dataset.id;

    // Emit event
    this.container.dispatchEvent(new CustomEvent('interaction-action', {
      detail: { action, id }
    }));
  }
}

/**
 * Create layout instance based on mode.
 *
 * @param {HTMLElement} container - Container element
 * @param {string} mode - 'popup' or 'devtools'
 * @returns {PopupLayout|DevToolsLayout}
 */
export function createLayout(container, mode) {
  if (mode === 'popup') {
    return new PopupLayout(container);
  } else if (mode === 'devtools') {
    return new DevToolsLayout(container);
  } else {
    throw new Error(`Invalid mode: ${mode}`);
  }
}
