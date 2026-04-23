// EchoKit — shared matcher.
// Produces a stable, synchronous hash of (method, url, body) for STRICT matching.
// Used in both the MAIN-world injected script and the extension background.

export function normalizeUrl(url, base) {
  try {
    const u = new URL(url, base || 'http://local.local');
    // Sort query params for deterministic hashing.
    const params = [...u.searchParams.entries()].sort((a, b) =>
      a[0] === b[0] ? (a[1] < b[1] ? -1 : 1) : a[0] < b[0] ? -1 : 1
    );
    u.search = params.length ? '?' + params.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&') : '';
    // Drop hash fragment — not sent to server anyway.
    u.hash = '';
    return u.toString();
  } catch {
    return String(url);
  }
}

export function normalizeBody(body) {
  if (body == null || body === '') return '';
  if (typeof body === 'string') {
    // Try to JSON-stringify to canonicalize whitespace / key order.
    try {
      return stableStringify(JSON.parse(body));
    } catch {
      return body;
    }
  }
  if (typeof FormData !== 'undefined' && body instanceof FormData) {
    const arr = [];
    for (const [k, v] of body.entries()) arr.push([k, typeof v === 'string' ? v : '[file]']);
    arr.sort();
    return JSON.stringify(arr);
  }
  if (typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams) {
    const arr = [...body.entries()].sort();
    return JSON.stringify(arr);
  }
  if (typeof Blob !== 'undefined' && body instanceof Blob) return `[blob:${body.size}:${body.type}]`;
  if (body instanceof ArrayBuffer) return `[ab:${body.byteLength}]`;
  if (ArrayBuffer.isView(body)) return `[view:${body.byteLength}]`;
  try {
    return stableStringify(body);
  } catch {
    return String(body);
  }
}

function stableStringify(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(stableStringify).join(',') + ']';
  const keys = Object.keys(v).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + stableStringify(v[k])).join(',') + '}';
}

// Fast synchronous FNV-1a 32-bit hash.
function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

export function computeHash(method, url, body) {
  const key = `${String(method || 'GET').toUpperCase()}|${normalizeUrl(url)}|${normalizeBody(body)}`;
  return fnv1a(key) + '-' + key.length.toString(16);
}

export default { computeHash, normalizeUrl, normalizeBody };
