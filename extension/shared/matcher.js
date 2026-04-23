// EchoKit — shared matcher.
// Produces a stable, synchronous hash of (method, url, body) for STRICT matching.
// Also supports relaxed match modes: ignore-query, ignore-body, path-wildcard.
// Used by the MAIN-world injected script and the extension background.

export function normalizeUrl(url, base) {
  try {
    const u = new URL(url, base || 'http://local.local');
    const params = [...u.searchParams.entries()].sort((a, b) =>
      a[0] === b[0] ? (a[1] < b[1] ? -1 : 1) : a[0] < b[0] ? -1 : 1
    );
    u.search = params.length ? '?' + params.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&') : '';
    u.hash = '';
    return u.toString();
  } catch {
    return String(url);
  }
}

export function stripQuery(url) {
  try {
    const u = new URL(url, 'http://local.local');
    u.search = '';
    u.hash = '';
    return u.toString();
  } catch { return String(url); }
}

export function normalizeBody(body) {
  if (body == null || body === '') return '';
  if (typeof body === 'string') {
    try { return stableStringify(JSON.parse(body)); } catch { return body; }
  }
  if (typeof FormData !== 'undefined' && body instanceof FormData) {
    const arr = []; for (const [k, v] of body.entries()) arr.push([k, typeof v === 'string' ? v : '[file]']);
    arr.sort(); return JSON.stringify(arr);
  }
  if (typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams) {
    const arr = [...body.entries()].sort(); return JSON.stringify(arr);
  }
  if (typeof Blob !== 'undefined' && body instanceof Blob) return `[blob:${body.size}:${body.type}]`;
  if (body instanceof ArrayBuffer) return `[ab:${body.byteLength}]`;
  if (ArrayBuffer.isView(body)) return `[view:${body.byteLength}]`;
  try { return stableStringify(body); } catch { return String(body); }
}

function stableStringify(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(stableStringify).join(',') + ']';
  const keys = Object.keys(v).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + stableStringify(v[k])).join(',') + '}';
}

function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

// Compute ALL match keys for a request — one per supported match mode.
// We pre-compute these at RECORD time; at replay time we compute the same keys
// for the incoming request and look up any mock whose (mode, key) pair matches.
export function computeMatchKeys(method, url, body) {
  const M = String(method || 'GET').toUpperCase();
  const full = `${M}|${normalizeUrl(url)}|${normalizeBody(body)}`;
  const noQuery = `${M}|${stripQuery(url)}|${normalizeBody(body)}`;
  const noBody = `${M}|${normalizeUrl(url)}|`;
  const pathOnly = `${M}|${stripQuery(url)}|`;
  return {
    strict: fnv1a(full) + '-' + full.length.toString(16),
    'ignore-query': fnv1a(noQuery) + '-' + noQuery.length.toString(16),
    'ignore-body': fnv1a(noBody) + '-' + noBody.length.toString(16),
    'path-wildcard': fnv1a(pathOnly) + '-' + pathOnly.length.toString(16)
  };
}

// Backwards-compatible — used where we only need the strict hash (storage primary key).
export function computeHash(method, url, body) {
  return computeMatchKeys(method, url, body).strict;
}

export default { computeHash, computeMatchKeys, normalizeUrl, normalizeBody, stripQuery };
