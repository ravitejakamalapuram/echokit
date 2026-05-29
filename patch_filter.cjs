const fs = require('fs');
const path = './extension/shared/app.js';
let code = fs.readFileSync(path, 'utf8');

const oldFilteredInteractions = `function filteredInteractions() {
  const features = getFeatures();
  let results = state.interactions;

  // PHASE 1: Method filter
  if (features.multiSelect && state.filters.methods.length > 0) {
    results = results.filter(i => state.filters.methods.includes(i.method));
  } else if (state.methodFilter) {
    // Popup mode: single-select (backward compat)
    results = results.filter(i => i.method === state.methodFilter);
  }

  // PHASE 2: Status filter
  if (features.multiSelect && state.filters.statusCodes.length > 0) {
    results = results.filter(i => matchesStatusFilter(i.responseStatus, state.filters.statusCodes));
  } else if (state.statusFilter != null) {
    // Popup mode: single-select (backward compat)
    const filterFn = (i) => {
      const bucket = String(Math.floor((i.responseStatus || 0) / 100));
      if (state.statusFilter === '0') return (i.responseStatus || 0) === 0;
      return bucket === state.statusFilter;
    };
    results = results.filter(filterFn);
  }

  // PHASE 3: URL search (both modes)
  const q = state.search.trim().toLowerCase();
  if (q) {
    results = results.filter(i => i.url.toLowerCase().includes(q));
  }

  // PHASE 4: Body search (DevTools only)
  if (features.bodySearch) {
    if (state.filters.requestBodyContains) {
      const query = state.filters.requestBodyContains.toLowerCase();
      results = results.filter(i => searchBodyContent(i.requestBody, query));
    }

    if (state.filters.responseBodyContains) {
      const query = state.filters.responseBodyContains.toLowerCase();
      results = results.filter(i => searchBodyContent(i.responseBody, query));
    }
  }

  // PHASE 5: Header search (DevTools only)
  if (features.headerSearch) {
    if (state.filters.requestHeader.name || state.filters.requestHeader.value) {
      results = results.filter(i =>
        searchHeaders(
          i.requestHeaders,
          state.filters.requestHeader.name,
          state.filters.requestHeader.value
        )
      );
    }

    if (state.filters.responseHeader.name || state.filters.responseHeader.value) {
      results = results.filter(i =>
        searchHeaders(
          i.responseHeaders,
          state.filters.responseHeader.name,
          state.filters.responseHeader.value
        )
      );
    }
  }

  // PHASE 6: Boolean filters (DevTools only)
  if (state.filters.mockEnabled !== null) {
    results = results.filter(i => i.mockEnabled === state.filters.mockEnabled);
  }
  if (state.filters.blocked !== null) {
    results = results.filter(i => i.blocked === state.filters.blocked);
  }
  if (state.filters.hasNotes !== null) {
    results = results.filter(i => state.filters.hasNotes ? (i.notes && i.notes.trim()) : !i.notes);
  }

  // PHASE 6.5: Source filters (DevTools only) - NEW
  if (features.sourceFilters) {
    results = results.filter(i => {
      const source = classifySource(i, state.tabId);
      if (source === 'this-tab') return state.filters.sources.thisTab;
      if (source === 'other-tab') return state.filters.sources.otherTabs;
      if (source === 'closed-tab') return state.filters.sources.closedTabs;
      if (source === 'imported') return state.filters.sources.imported;
      return true;
    });
  }

  // PHASE 7: Sort (DevTools only)
  if (features.sortableColumns) {
    results = sortInteractions(results, state.sortBy, state.sortOrder);
  } else {
    results = sortInteractions(results, 'timestamp', 'desc');
  }

  return results;
}`;

const newFilteredInteractions = `function filteredInteractions() {
  const features = getFeatures();
  const q = state.search.trim().toLowerCase();
  let reqBodyQuery = features.bodySearch && state.filters.requestBodyContains ? state.filters.requestBodyContains.toLowerCase() : null;
  let resBodyQuery = features.bodySearch && state.filters.responseBodyContains ? state.filters.responseBodyContains.toLowerCase() : null;
  let reqHeaderName = features.headerSearch && state.filters.requestHeader.name ? state.filters.requestHeader.name : null;
  let reqHeaderValue = features.headerSearch && state.filters.requestHeader.value ? state.filters.requestHeader.value : null;
  let resHeaderName = features.headerSearch && state.filters.responseHeader.name ? state.filters.responseHeader.name : null;
  let resHeaderValue = features.headerSearch && state.filters.responseHeader.value ? state.filters.responseHeader.value : null;

  let results = state.interactions.filter(i => {
    // PHASE 1: Method filter
    if (features.multiSelect && state.filters.methods.length > 0) {
      if (!state.filters.methods.includes(i.method)) return false;
    } else if (state.methodFilter) {
      if (i.method !== state.methodFilter) return false;
    }

    // PHASE 2: Status filter
    if (features.multiSelect && state.filters.statusCodes.length > 0) {
      if (!matchesStatusFilter(i.responseStatus, state.filters.statusCodes)) return false;
    } else if (state.statusFilter != null) {
      const bucket = String(Math.floor((i.responseStatus || 0) / 100));
      if (state.statusFilter === '0') {
        if ((i.responseStatus || 0) !== 0) return false;
      } else if (bucket !== state.statusFilter) {
        return false;
      }
    }

    // PHASE 3: URL search
    if (q && !i.url.toLowerCase().includes(q)) return false;

    // PHASE 4: Body search
    if (reqBodyQuery && !searchBodyContent(i.requestBody, reqBodyQuery)) return false;
    if (resBodyQuery && !searchBodyContent(i.responseBody, resBodyQuery)) return false;

    // PHASE 5: Header search
    if ((reqHeaderName || reqHeaderValue) && !searchHeaders(i.requestHeaders, reqHeaderName, reqHeaderValue)) return false;
    if ((resHeaderName || resHeaderValue) && !searchHeaders(i.responseHeaders, resHeaderName, resHeaderValue)) return false;

    // PHASE 6: Boolean filters
    if (state.filters.mockEnabled !== null && i.mockEnabled !== state.filters.mockEnabled) return false;
    if (state.filters.blocked !== null && i.blocked !== state.filters.blocked) return false;
    if (state.filters.hasNotes !== null && (state.filters.hasNotes ? !(i.notes && i.notes.trim()) : !!i.notes)) return false;

    // PHASE 6.5: Source filters
    if (features.sourceFilters) {
      const source = classifySource(i, state.tabId);
      if (source === 'this-tab' && !state.filters.sources.thisTab) return false;
      if (source === 'other-tab' && !state.filters.sources.otherTabs) return false;
      if (source === 'closed-tab' && !state.filters.sources.closedTabs) return false;
      if (source === 'imported' && !state.filters.sources.imported) return false;
    }

    return true;
  });

  // PHASE 7: Sort (DevTools only)
  if (features.sortableColumns) {
    results = sortInteractions(results, state.sortBy, state.sortOrder);
  } else {
    results = sortInteractions(results, 'timestamp', 'desc');
  }

  return results;
}`;

if (code.includes('function filteredInteractions() {')) {
  code = code.replace(oldFilteredInteractions, newFilteredInteractions);
  fs.writeFileSync(path, code);
  console.log("Patched successfully");
} else {
  console.log("Could not find filteredInteractions");
}
