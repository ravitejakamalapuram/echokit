// Port of EchoKit's matcher (extension/injected.js) — Node.js version.
// Must produce IDENTICAL match keys to the extension so exported JSON works.

'use strict';

const urlCache = new Map();
function parseUrlCached(url, base) {
  if (!url) return null;
  const key = base ? url + '|' + base : url;
  if (urlCache.has(key)) return urlCache.get(key);
  try {
    const parsed = base ? new URL(url, base) : new URL(url);
    if (urlCache.size >= 1000) urlCache.delete(urlCache.keys().next().value);
    urlCache.set(key, parsed);
    return parsed;
  } catch { return null; }
}

function normalizeUrl(url) {
  try {
    const cached = parseUrlCached(url, 'http://_/');
    if (!cached) throw new Error();
    const u = new URL(cached.href);
    const params = [...u.searchParams.entries()].sort((a, b) =>
      a[0] === b[0] ? (a[1] < b[1] ? -1 : 1) : a[0] < b[0] ? -1 : 1
    );
    u.search = params.length
      ? '?' + params.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&')
      : '';
    u.hash = '';
    return u.toString();
  } catch { return String(url); }
}

function stripQuery(url) {
  try {
    const cached = parseUrlCached(url, 'http://_/');
    if (!cached) throw new Error();
    const u = new URL(cached.href);
    u.search = '';
    u.hash = '';
    return u.toString();
  } catch { return String(url); }
}

function stableStringify(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(stableStringify).join(',') + ']';
  const keys = Object.keys(v).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + stableStringify(v[k])).join(',') + '}';
}

function normalizeBody(body) {
  if (body == null || body === '') return '';
  if (typeof body === 'string') {
    try { return stableStringify(JSON.parse(body)); } catch { return body; }
  }
  try { return stableStringify(body); } catch { return String(body); }
}

function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/**
 * Extracts the GraphQL operation name from a query string.
 * @param {string} query - GraphQL query text or value coercible to string.
 * @returns {string} The operation name if present (from `query`, `mutation`, or `subscription`), otherwise an empty string.
 */
function extractOpName(query) {
  if (!query) return '';
  const m = String(query).match(/(?:query|mutation|subscription)\s+(\w+)/);
  return m ? m[1] : '';
}

/**
 * Parse a GraphQL HTTP request payload and extract the operation name, normalized query, and variables.
 * @param {string|object|null|undefined} body - Request body as a JSON string or already-parsed object; falsy values yield `null`.
 * @returns {{operationName: string, query: string, variables: object}|null} An object with:
 *  - `operationName`: the explicit `operationName` from the payload or the first operation name parsed from the `query`, or `''` if none;
 *  - `query`: the GraphQL `query` with contiguous whitespace collapsed to single spaces and trimmed;
 *  - `variables`: the `variables` object from the payload or an empty object.
 *  Returns `null` if the body is falsy, is not valid JSON (when a string), or does not contain a `query` field.
 */
function parseGraphQL(body, _url) {
  if (!body) return null;
  let parsed;
  try { parsed = typeof body === 'string' ? JSON.parse(body) : body; } catch { return null; }
  if (parsed && typeof parsed === 'object' && parsed.query) {
    return {
      operationName: parsed.operationName || extractOpName(parsed.query) || '',
      query: String(parsed.query).replace(/\s+/g, ' ').trim(),
      variables: parsed.variables || {}
    };
  }
  return null;
}

function computeMatchKeys(method, url, body) {
  const M = String(method || 'GET').toUpperCase();
  const full = `${M}|${normalizeUrl(url)}|${normalizeBody(body)}`;
  const noQuery = `${M}|${stripQuery(url)}|${normalizeBody(body)}`;
  const noBody = `${M}|${normalizeUrl(url)}|`;
  const pathOnly = `${M}|${stripQuery(url)}|`;
  const out = {
    strict: fnv1a(full) + '-' + full.length.toString(16),
    'ignore-query': fnv1a(noQuery) + '-' + noQuery.length.toString(16),
    'ignore-body': fnv1a(noBody) + '-' + noBody.length.toString(16),
    'path-wildcard': fnv1a(pathOnly) + '-' + pathOnly.length.toString(16)
  };
  const gql = parseGraphQL(body, url);
  if (gql) {
    const gqlKey = `${M}|${stripQuery(url)}|gql|${gql.operationName}|${gql.query}|${stableStringify(gql.variables)}`;
    out.graphql = fnv1a(gqlKey) + '-' + gqlKey.length.toString(16);
    const gqlNoVars = `${M}|${stripQuery(url)}|gql|${gql.operationName}|${gql.query}|`;
    out['graphql-op'] = fnv1a(gqlNoVars) + '-' + gqlNoVars.length.toString(16);
  }
  return out;
}

const MODES = ['strict', 'ignore-query', 'ignore-body', 'path-wildcard', 'graphql', 'graphql-op'];

module.exports = { computeMatchKeys, MODES, normalizeUrl, stripQuery };
