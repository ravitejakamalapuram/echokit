import { normalizeUrl, normalizeBody, stripQuery, parseGraphQL, computeMatchKeys as orig } from './extension/shared/matcher.js';
import { performance } from 'perf_hooks';

function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0; }
  return h.toString(16).padStart(8, '0');
}

function stableStringify(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(stableStringify).join(',') + ']';
  const keys = Object.keys(v).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + stableStringify(v[k])).join(',') + '}';
}

function computeMatchKeys(method, url, body) {
  const M = String(method || 'GET').toUpperCase();
  const normUrl = normalizeUrl(url);
  const normBody = normalizeBody(body);
  const strQuery = stripQuery(url);

  const full = `${M}|${normUrl}|${normBody}`;
  const noQuery = `${M}|${strQuery}|${normBody}`;
  const noBody = `${M}|${normUrl}|`;
  const pathOnly = `${M}|${strQuery}|`;

  const out = {
    strict: fnv1a(full) + '-' + full.length.toString(16),
    'ignore-query': fnv1a(noQuery) + '-' + noQuery.length.toString(16),
    'ignore-body': fnv1a(noBody) + '-' + noBody.length.toString(16),
    'path-wildcard': fnv1a(pathOnly) + '-' + pathOnly.length.toString(16)
  };
  const gql = parseGraphQL(body, url);
  if (gql) {
    const gqlKey = `${M}|${strQuery}|gql|${gql.operationName}|${gql.query}|${stableStringify(gql.variables)}`;
    out.graphql = fnv1a(gqlKey) + '-' + gqlKey.length.toString(16);
    // Also a looser GQL key that ignores variables.
    const gqlNoVars = `${M}|${strQuery}|gql|${gql.operationName}|${gql.query}|`;
    out['graphql-op'] = fnv1a(gqlNoVars) + '-' + gqlNoVars.length.toString(16);
  }
  return out;
}

const start = performance.now();
for (let i = 0; i < 10000; i++) {
  computeMatchKeys('GET', 'http://example.com/api/v1/users?limit=10&offset=20', '{"data": "test", "more": [1,2,3]}');
}
const end = performance.now();
console.log(`Time taken optimized: ${(end - start).toFixed(2)} ms`);

const startOrig = performance.now();
for (let i = 0; i < 10000; i++) {
  orig('GET', 'http://example.com/api/v1/users?limit=10&offset=20', '{"data": "test", "more": [1,2,3]}');
}
const endOrig = performance.now();
console.log(`Time taken unoptimized: ${(endOrig - startOrig).toFixed(2)} ms`);
