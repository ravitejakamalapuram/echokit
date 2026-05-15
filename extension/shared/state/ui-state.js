// UI State management for EchoKit with observer pattern

/**
 * Initial state structure
 */
const initialState = {
  mode: 'popup',
  tabId: null,
  tab: { recording: false, mocking: false, sessionId: null, host: '' },
  settings: {
    corsOverride: false,
    scope: 'domain',
    theme: 'dark',
    autoOpenOnRefresh: true,
    blocklist: [],
    rewriteRules: [],
    transformRules: [],
    requestHeaders: []
  },
  interactions: [],
  allCount: 0,
  isPro: false,
  trial: false,
  trialDaysLeft: 0,
  waterfall: false,
  search: '',
  // OLD filters (kept for popup backward compatibility)
  methodFilter: null,
  statusFilter: null,
  // NEW filters (DevTools only)
  filters: {
    methods: [],
    statusCodes: [],
    requestBodyContains: '',
    responseBodyContains: '',
    requestHeader: { name: '', value: '' },
    responseHeader: { name: '', value: '' },
    mockEnabled: null,
    blocked: null,
    hasNotes: null,
    sources: {
      thisTab: true,
      otherTabs: true,
      closedTabs: false,
      imported: true
    }
  },
  // Advanced UI state
  advancedFilterOpen: false,
  sortBy: 'timestamp',
  sortOrder: 'desc',
  // Existing state
  selectedId: null,
  detailOpen: false,
  menuOpen: false,
  listWidth: 360,
  clipboardPreview: null,
};

/**
 * Global application state
 */
let state = { ...initialState };

/**
 * State change listeners
 */
const listeners = new Set();

/**
 * Get current state (read-only)
 * @returns {Object} Current state object
 */
export function getState() {
  return state;
}

/**
 * Update state and notify listeners
 * @param {Object} updates - State updates
 */
export function setState(updates) {
  const prev = { ...state };
  state = { ...state, ...updates };
  notifyListeners(prev, state);
}

/**
 * Update nested state property
 * @param {string} path - Dot-separated path (e.g., 'filters.methods')
 * @param {*} value - New value
 */
export function setStatePath(path, value) {
  const keys = path.split('.');
  const updates = { ...state };
  let current = updates;
  
  for (let i = 0; i < keys.length - 1; i++) {
    current[keys[i]] = { ...current[keys[i]] };
    current = current[keys[i]];
  }
  
  current[keys[keys.length - 1]] = value;
  setState(updates);
}

/**
 * Subscribe to state changes
 * @param {Function} listener - Listener function(prevState, newState)
 * @returns {Function} Unsubscribe function
 */
export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Notify all listeners of state change
 * @param {Object} prev - Previous state
 * @param {Object} next - New state
 */
function notifyListeners(prev, next) {
  listeners.forEach(listener => {
    try {
      listener(prev, next);
    } catch (err) {
      console.error('State listener error:', err);
    }
  });
}

/**
 * Reset state to initial values
 */
export function resetState() {
  setState({ ...initialState });
}

/**
 * Snapshot current UI state for preservation
 * @returns {Object} UI state snapshot
 */
export function snapshotUIState() {
  const list = document.querySelector('.list-view');
  const detail = document.querySelector('.detail-panel');
  return {
    listScroll: list?.scrollTop || 0,
    detailScroll: detail?.scrollTop || 0,
    selectedId: state.selectedId,
    detailOpen: state.detailOpen
  };
}

/**
 * Restore UI state from snapshot
 * @param {Object} snap - State snapshot
 */
export function restoreUIState(snap) {
  if (!snap) return;
  
  if (snap.selectedId) state.selectedId = snap.selectedId;
  if (snap.detailOpen !== undefined) state.detailOpen = snap.detailOpen;
  
  setTimeout(() => {
    const list = document.querySelector('.list-view');
    const detail = document.querySelector('.detail-panel');
    if (list && snap.listScroll) list.scrollTop = snap.listScroll;
    if (detail && snap.detailScroll) detail.scrollTop = snap.detailScroll;
  }, 0);
}
