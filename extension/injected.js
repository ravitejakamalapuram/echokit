// EchoKit — MAIN-world injected script.
// Hooks window.fetch + XMLHttpRequest. Records real traffic (when recording is on)
// and serves mocked responses (when mocking is on AND a match exists).

(() => {

class MockWebSocket {
  constructor(url, mock) {
    this.url = url;
    this.CONNECTING = 0;
    this.OPEN = 1;
    this.CLOSING = 2;
    this.CLOSED = 3;
    this._readyState = 0;
    this.protocol = '';
    this.bufferedAmount = 0;
    this.binaryType = 'blob';
    this.extensions = '';

    this._onopen = null;
    this._onmessage = null;
    this._onclose = null;
    this._onerror = null;

    this._listeners = { open: [], message: [], close: [], error: [] };
    this._closed = false;
    this._loopTimer = null;

    const body = (() => { try { return JSON.parse(mock.body || '{}'); } catch { return {}; } })();
    this.inFrames = (body.frames || []).filter(f => f.dir === 'in');
    this.latency = mock.latency || 0;
    this.loop = mock.wsLoop || false;

    setTimeout(() => {
      if (this._closed) return;
      this._readyState = 1;
      this.dispatchEvent(new Event('open'));
      this.replayFrames();
      if (this.loop && this.inFrames.length > 0) {
        const dur = (this.inFrames[this.inFrames.length - 1]?.t || 1000) + 1000;
        this._loopTimer = setInterval(() => {
          if (this._closed) { clearInterval(this._loopTimer); return; }
          this.replayFrames();
        }, dur);
      }
    }, this.latency);
  }

  get readyState() { return this._readyState; }

  set onopen(v) { this._onopen = v; }
  get onopen() { return this._onopen; }

  set onmessage(v) { this._onmessage = v; }
  get onmessage() { return this._onmessage; }

  set onclose(v) { this._onclose = v; }
  get onclose() { return this._onclose; }

  set onerror(v) { this._onerror = v; }
  get onerror() { return this._onerror; }

  dispatch(type, ev) {
    const h = { open: this._onopen, message: this._onmessage, close: this._onclose, error: this._onerror }[type];
    if (h) h(ev);
    (this._listeners[type] || []).forEach(fn => { try { fn(ev); } catch {} });
  }

  addEventListener(type, fn) { (this._listeners[type] = this._listeners[type] || []).push(fn); }
  removeEventListener(type, fn) { this._listeners[type] = (this._listeners[type] || []).filter(f => f !== fn); }
  dispatchEvent(ev) { this.dispatch(ev.type, ev); }

  replayFrames() {
    this.inFrames.forEach(f => setTimeout(() => {
      if (this._closed) return;
      this.dispatch('message', new MessageEvent('message', { data: f.data, origin: this.url }));
    }, f.t));
  }

  send() { /* accepted, no-op */ }

  close(code) {
    if (this._closed) return;
    this._closed = true;
    this._readyState = 3;
    if (this._loopTimer) { clearInterval(this._loopTimer); this._loopTimer = null; }
    try { this.dispatch('close', new CloseEvent('close', { wasClean: true, code: code || 1000, reason: '' })); } catch {}
  }
}

class MockEventSource {
  constructor(url, mock) {
    this.url = url;
    this.CONNECTING = 0;
    this.OPEN = 1;
    this.CLOSED = 2;
    this.readyState = 0;
    this.withCredentials = false;

    this._onmessage = null;
    this._onerror = null;
    this._onopen = null;

    this._listeners = { message: [], error: [], open: [] };
    this._closed = false;
    this._loopTimer = null;

    const body = (() => { try { return JSON.parse(mock.body || '{}'); } catch { return {}; } })();
    this.frames = body.frames || [];
    this.latency = mock.latency || 0;
    this.loop = mock.wsLoop || false;

    setTimeout(() => {
      if (this._closed) return;
      this.readyState = 1;
      this.dispatchEvent(new Event('open'));
      this.replayFrames();
      if (this.loop && this.frames.length > 0) {
        const dur = (this.frames[this.frames.length - 1]?.t || 1000) + 1000;
        this._loopTimer = setInterval(() => {
          if (this._closed) { clearInterval(this._loopTimer); return; }
          this.replayFrames();
        }, dur);
      }
    }, this.latency);
  }

  set onmessage(v) { this._onmessage = v; }
  get onmessage() { return this._onmessage; }

  set onerror(v) { this._onerror = v; }
  get onerror() { return this._onerror; }

  set onopen(v) { this._onopen = v; }
  get onopen() { return this._onopen; }

  dispatch(type, ev) {
    const h = { message: this._onmessage, error: this._onerror, open: this._onopen }[type];
    if (h) h(ev);
    (this._listeners[type] || []).forEach(fn => { try { fn(ev); } catch {} });
  }

  addEventListener(type, fn) { (this._listeners[type] = this._listeners[type] || []).push(fn); }
  removeEventListener(type, fn) { this._listeners[type] = (this._listeners[type] || []).filter(f => f !== fn); }
  dispatchEvent(ev) { this.dispatch(ev.type, ev); }

  replayFrames() {
    this.frames.forEach(f => setTimeout(() => {
      if (this._closed) return;
      this.dispatch('message', new MessageEvent('message', { data: f.data, origin: this.url }));
    }, f.t));
  }

  close() {
    this._closed = true;
    if (this._loopTimer) clearInterval(this._loopTimer);
  }
}

(function () {
  if (window.__echokitInjected) return;
  window.__echokitInjected = true;

  const SRC_INJECTED = 'echokit-injected';
  const SRC_CONTENT = 'echokit-content';

  const state = {
    recording: false,
    mocking: false,
    // mockIndex is a per-mode map: { mode -> { key -> [versions] } }
    mockIndex: { strict: {}, 'ignore-query': {}, 'ignore-body': {}, 'path-wildcard': {} },
  };
  window.__echokitState = state;

  // Track mock hits locally to avoid race conditions with background sync
  const localMockHits = new Map();

  // ---------- Matcher (inlined — MAIN world can't import shared modules) ----------
  // NOTE: This is a hand-inlined copy of shared/matcher.js. Any changes to
  // shared/matcher.js MUST be manually mirrored here. The only difference:
  // this uses location.href as the base (page context), while shared/matcher.js
  // takes a configurable base parameter.
  function normalizeUrl(url) {
    try {
      const u = new URL(url, location.href);
      const params = [...u.searchParams.entries()].sort((a, b) =>
        a[0] === b[0] ? (a[1] < b[1] ? -1 : 1) : a[0] < b[0] ? -1 : 1
      );
      u.search = params.length ? '?' + params.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&') : '';
      u.hash = '';
      return u.toString();
    } catch { return String(url); }
  }
  function stripQuery(url) {
    try {
      const u = new URL(url, location.href); u.search = ''; u.hash = ''; return u.toString();
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
    if (typeof body === 'string') { try { return stableStringify(JSON.parse(body)); } catch { return body; } }
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
  function fnv1a(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0; }
    return h.toString(16).padStart(8, '0');
  }
  function computeMatchKeys(method, url, body) {
    const M = String(method || 'GET').toUpperCase();

    // ⚡ Bolt: Cache normalized inputs in local variables to prevent
    // redundant O(N) operations (like `new URL` and JSON parsing)
    // across the multiple match keys below.
    const nUrl = normalizeUrl(url);
    const sUrl = stripQuery(url);
    const nBody = normalizeBody(body);

    const full = `${M}|${nUrl}|${nBody}`;
    const noQuery = `${M}|${sUrl}|${nBody}`;
    const noBody = `${M}|${nUrl}|`;
    const pathOnly = `${M}|${sUrl}|`;
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
  function parseGraphQL(body, url) {
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
    try {
      const u = new URL(url, location.href);
      const q = u.searchParams.get('query');
      if (q) return {
        operationName: u.searchParams.get('operationName') || extractOpName(q) || '',
        query: q.replace(/\s+/g, ' ').trim(),
        variables: (() => { try { return JSON.parse(u.searchParams.get('variables') || '{}'); } catch { return {}; } })()
      };
    } catch {}
    return null;
  }
  function extractOpName(query) {
    const m = /\b(query|mutation|subscription)\s+(\w+)/.exec(String(query || ''));
    return m ? m[2] : '';
  }

  // ---------- Messaging ----------
  function emit(type, payload, requestId) {
    // Edge case fix: Wrap in try-catch to prevent postMessage errors from breaking page
    try {
      window.postMessage({ source: SRC_INJECTED, type, payload, requestId }, '/');
    } catch (err) {
      console.warn('[EchoKit] Failed to emit message:', type, err);
    }
  }
  window.addEventListener('message', (ev) => {
    // Edge case fix: Wrap in try-catch to prevent malformed messages from breaking state
    try {
      if (ev.source !== window) return;
      const d = ev.data;
      if (!d || d.source !== SRC_CONTENT) return;
      if (d.type === 'echokit:mockIndex') {
        // payload may be { mocks, blocked } (new) or the bare index (legacy)
        const p = d.payload || {};
        if (p.mocks) { state.mockIndex = p.mocks; state.blockedKeys = p.blocked || state.blockedKeys; }
        else { state.mockIndex = p; }
        // Clear local hits when background sends a fresh mock index,
        // or they will accumulate forever for new mock definitions.
        // We only care about tracking *recent* rapid local hits.
        // Actually, we shouldn't clear here because background state could be stale due to race conditions.
        // The Math.max handles reconciliation.
      }
      else if (d.type === 'echokit:tabState') {
        const p = d.payload || {};
        state.recording = !!p.recording;
        state.mocking = !!p.mocking;
        state.rewriteRules = p.rewriteRules || [];
        state.transformRules = p.transformRules || [];
        state.requestHeaders = p.requestHeaders || [];
      }
    } catch (err) {
      console.warn('[EchoKit] Error processing message:', err);
    }
  }, false);
  emit('ready');

  // Apply URL rewrite rules to a URL (real requests only, not mocks)
  function applyRewriteRules(url) {
    for (const rule of (state.rewriteRules || [])) {
      if (!rule.enabled) continue;
      try {
        const from = rule.from || '';
        if (from.startsWith('/') && from.lastIndexOf('/') > 0) {
          const flags = from.slice(from.lastIndexOf('/') + 1);
          const pattern = from.slice(1, from.lastIndexOf('/'));
          const re = new RegExp(pattern, flags);
          if (re.test(url)) return url.replace(re, rule.to || '');
        } else if (from && url.includes(from)) {
          return url.replace(from, rule.to || '');
        }
      } catch {}
    }
    return url;
  }

  // Apply response transform rules to body/headers
  function applyResponseTransforms(body, headers, url) {
    const rules = (state.transformRules || []).filter(r => r.enabled && r.phase === 'response');
    if (!rules.length) return { body, headers };
    for (const rule of rules) {
      try {
        if (rule.urlPattern && !url.includes(rule.urlPattern)) continue;
        if (rule.action === 'add-header') headers = { ...headers, [rule.key]: rule.value };
        else if (rule.action === 'remove-header') { headers = { ...headers }; delete headers[rule.key]; }
        else if (rule.action === 'set-body') body = rule.value;
        else if (rule.action === 'regex-replace-body' && typeof body === 'string')
          body = body.replace(new RegExp(rule.key, 'g'), rule.value);
      } catch {}
    }
    return { body, headers };
  }

  // Apply global request headers to outgoing requests
  function applyRequestHeaders(headers, url) {
    const rules = (state.requestHeaders || []).filter(r => r.enabled !== false);
    if (!rules.length) return headers;

    const modified = { ...headers };

    for (const rule of rules) {
      try {
        // URL pattern filtering (blank = apply to all)
        if (rule.urlPattern && !url.includes(rule.urlPattern)) continue;

        const key = rule.key || '';
        if (!key) continue;

        if (rule.mode === 'add') {
          // Only add if header doesn't exist
          if (!(key in modified) && !(key.toLowerCase() in Object.keys(modified).map(k => k.toLowerCase()))) {
            modified[key] = rule.value || '';
          }
        } else if (rule.mode === 'override' || !rule.mode) {
          // Set header (replace or add) - default mode
          // First remove any case-variant duplicates
          const lowerKey = key.toLowerCase();
          for (const k of Object.keys(modified)) {
            if (k.toLowerCase() === lowerKey) delete modified[k];
          }
          modified[key] = rule.value || '';
        } else if (rule.mode === 'remove') {
          // Delete header (case-insensitive)
          delete modified[key];
          const lowerKey = key.toLowerCase();
          for (const k of Object.keys(modified)) {
            if (k.toLowerCase() === lowerKey) delete modified[k];
          }
        }
      } catch (e) {
        console.warn('[EchoKit] Request header rule error:', e);
      }
    }

    return modified;
  }

  // ---------- Mock lookup (tries each supported match mode) ----------
  const MODES = ['strict', 'ignore-query', 'ignore-body', 'path-wildcard', 'graphql', 'graphql-op'];
  function isBlocked(keys) {
    for (const mode of MODES) {
      const bucket = state.blockedKeys?.[mode];
      if (bucket && bucket[keys[mode]]) return true;
    }
    return false;
  }
  function pickMock(keys) {
    if (!state.mocking) return null;
    for (const mode of MODES) {
      const bucket = state.mockIndex?.[mode];
      if (!bucket) continue;
      const versions = bucket[keys[mode]];
      if (!versions || !versions.length) continue;
      // Filter out conditional mocks that have hit their limit (local count)
      const available = versions.filter(v => {
        if (!v.mockMaxCount) return true;
        const localHits = localMockHits.get(v.id) || 0;
        const currentHits = Math.max(v.mockCallCount || 0, localHits);
        return currentHits < v.mockMaxCount;
      });
      if (!available.length) continue;
      const active = available[0].activeVersionId;
      let mock = null;
      if (active) mock = available.find(v => v.id === active);
      if (!mock) mock = available[0];
      // Track conditional mock hit locally + notify background
      if (mock.mockMaxCount != null) {
        const localHits = localMockHits.get(mock.id) || 0;
        const currentHits = Math.max(mock.mockCallCount || 0, localHits);
        localMockHits.set(mock.id, currentHits + 1);
        mock.mockCallCount = currentHits + 1;
        // We intentionally don't set mockEnabled=false here so the state remains consistent
        // with the background script. available.filter already checks mockCallCount < mockMaxCount.
        emit('mock-hit', { id: mock.id });
      } else if (mock.hasChain) {
        // Mock chain: notify background to advance cursor
        emit('mock-hit', { id: mock.id });
      }
      return mock;
    }
    return null;
  }

  function delay(ms) { return new Promise(r => setTimeout(r, Math.max(0, ms | 0))); }

  function headersToObject(h) {
    if (!h) return {};
    if (h instanceof Headers) { const o = {}; h.forEach((v, k) => { o[k] = v; }); return o; }
    if (Array.isArray(h)) { const o = {}; for (const [k, v] of h) o[k] = v; return o; }
    if (typeof h === 'object') return { ...h };
    return {};
  }

  // ---------- fetch hook ----------
  const origFetch = window.fetch?.bind(window);
  if (origFetch) {
    window.fetch = async function echokitFetch(input, init) {
      let url, method, reqHeaders, reqBody;
      try {
        if (typeof input === 'string' || input instanceof URL) {
          url = String(input);
          method = (init && init.method) || 'GET';
          reqHeaders = headersToObject(init && init.headers);
          reqBody = init && init.body != null ? await bodyToText(init.body) : null;
        } else if (input && typeof input === 'object') {
          url = input.url;
          method = (init && init.method) || input.method || 'GET';
          const inputHeaders = headersToObject(input.headers);
          const initHeaders = headersToObject(init && init.headers);
          reqHeaders = { ...inputHeaders, ...initHeaders };
          try { reqBody = await input.clone().text(); } catch { reqBody = null; }
        } else {
          url = String(input); method = 'GET'; reqHeaders = {}; reqBody = null;
        }
      } catch { return origFetch(input, init); }

      const matchKeys = computeMatchKeys(method, url, reqBody);
      // Per-API block (fetch variant).
      if (isBlocked(matchKeys)) throw new TypeError('Failed to fetch (EchoKit: blocked)');
      const mock = pickMock(matchKeys);
      if (mock) {
        if (mock.latency) await delay(mock.latency);
        if (mock.errorMode === 'network') throw new TypeError('Failed to fetch (EchoKit mock: network failure)');
        if (mock.errorMode === 'timeout') return new Promise(() => {});
        let status = mock.status || 200;
        if (mock.errorMode === '4xx') status = 400;
        else if (mock.errorMode === '5xx') status = 500;
        // Apply response transforms to mock
        const transformed = applyResponseTransforms(mock.body ?? '', mock.headers || {}, url);
        const headers = new Headers(transformed.headers);
        if (!headers.has('content-type')) headers.set('content-type', 'application/json');
        return new Response(transformed.body, { status, statusText: statusText(status), headers });
      }

      // Apply URL rewrite rules to real requests
      const rewrittenUrl = applyRewriteRules(url);

      // Apply global request headers to real requests
      const modifiedReqHeaders = applyRequestHeaders(reqHeaders, url);

      const started = Date.now();
      let res, err;
      try {
        // Use rewritten URL if different
        const fetchTarget = rewrittenUrl !== url ? rewrittenUrl : input;
        // Create modified init with updated headers
        const modifiedInit = init ? { ...init } : {};
        modifiedInit.headers = modifiedReqHeaders;
        res = await origFetch(fetchTarget, modifiedInit);
      } catch (e) { err = e; }
      if (state.recording) {
        try {
          if (res) {
            const clone = res.clone();
            const text = await clone.text().catch(() => '');
            emit('record', {
              matchKeys,
              method, url: normalizeUrl(url),
              requestHeaders: modifiedReqHeaders, requestBody: reqBody,
              responseStatus: res.status,
              responseHeaders: headersToObject(res.headers),
              responseBody: text,
              durationMs: Date.now() - started,
              type: 'fetch'
            });
          } else if (err) {
            emit('record', {
              matchKeys,
              method, url: normalizeUrl(url),
              requestHeaders: modifiedReqHeaders, requestBody: reqBody,
              responseStatus: 0, responseHeaders: {}, responseBody: String(err),
              durationMs: Date.now() - started, type: 'fetch', failed: true
            });
          }
        } catch {}
      }
      if (err) throw err;
      return res;
    };
  }

  async function bodyToText(body) {
    if (body == null) return null;
    if (typeof body === 'string') return body;
    if (typeof FormData !== 'undefined' && body instanceof FormData) {
      const o = {}; for (const [k, v] of body.entries()) o[k] = typeof v === 'string' ? v : '[file]';
      return JSON.stringify(o);
    }
    if (typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams) return body.toString();
    if (typeof Blob !== 'undefined' && body instanceof Blob) return await body.text();
    if (body instanceof ArrayBuffer) return new TextDecoder().decode(body);
    if (ArrayBuffer.isView(body)) return new TextDecoder().decode(body.buffer);
    try { return JSON.stringify(body); } catch { return String(body); }
  }

  // ---------- XHR hook ----------
  const XHR = window.XMLHttpRequest;
  if (XHR) {
    const origOpen = XHR.prototype.open;
    const origSend = XHR.prototype.send;
    const origSetHeader = XHR.prototype.setRequestHeader;

    XHR.prototype.open = function (method, url, async) {
      this.__echokit = { method: String(method || 'GET').toUpperCase(), url: String(url), headers: {}, async: async !== false };
      return origOpen.apply(this, arguments);
    };
    XHR.prototype.setRequestHeader = function (k, v) {
      // Only update internal state, don't call origSetHeader yet (send() will apply all headers)
      if (this.__echokit) this.__echokit.headers[k] = v;
    };
    XHR.prototype.send = function (body) {
      const ctx = this.__echokit || {};
      ctx.body = body != null ? (typeof body === 'string' ? body : (body instanceof URLSearchParams ? body.toString() : '[binary]')) : null;

      // Apply global request headers BEFORE matching/blocking
      const url = ctx.url || '';
      ctx.headers = applyRequestHeaders(ctx.headers || {}, url);

      // Now re-set all headers on the XHR object
      for (const [key, value] of Object.entries(ctx.headers)) {
        try {
          origSetHeader.call(this, key, value);
        } catch (e) {
          console.warn('[EchoKit] Failed to set header:', key, e);
        }
      }

      const matchKeys = computeMatchKeys(ctx.method, ctx.url, ctx.body);
      // Per-API block (XHR variant).
      if (isBlocked(matchKeys)) {
        const xhr = this;
        setTimeout(() => xhr.dispatchEvent(new Event('error')), 0);
        return;
      }
      const mock = pickMock(matchKeys);
      if (mock) {
        const xhr = this;
        setTimeout(async () => {
          if (mock.latency) await delay(mock.latency);
          if (mock.errorMode === 'timeout') { xhr.dispatchEvent(new Event('timeout')); return; }
          if (mock.errorMode === 'network') { xhr.dispatchEvent(new Event('error')); return; }
          let status = mock.status || 200;
          if (mock.errorMode === '4xx') status = 400;
          else if (mock.errorMode === '5xx') status = 500;
          const bodyStr = mock.body ?? '';
          const headerStr = Object.entries(mock.headers || {}).map(([k, v]) => `${k}: ${v}`).join('\r\n') || 'content-type: application/json';
          try {
            Object.defineProperty(xhr, 'readyState', { configurable: true, get: () => 4 });
            Object.defineProperty(xhr, 'status', { configurable: true, get: () => status });
            Object.defineProperty(xhr, 'statusText', { configurable: true, get: () => statusText(status) });
            Object.defineProperty(xhr, 'responseText', { configurable: true, get: () => bodyStr });
            Object.defineProperty(xhr, 'response', { configurable: true, get: () => bodyStr });
            Object.defineProperty(xhr, 'responseURL', { configurable: true, get: () => ctx.url });
            xhr.getAllResponseHeaders = () => headerStr;
            xhr.getResponseHeader = (name) => {
              const line = headerStr.split(/\r\n/).find(l => l.toLowerCase().startsWith(name.toLowerCase() + ':'));
              return line ? line.split(':').slice(1).join(':').trim() : null;
            };
          } catch {}
          xhr.dispatchEvent(new Event('readystatechange'));
          xhr.dispatchEvent(new Event('load'));
          xhr.dispatchEvent(new Event('loadend'));
        }, 0);
        return;
      }

      if (state.recording) {
        const started = Date.now();
        this.addEventListener('loadend', () => {
          try {
            emit('record', {
              matchKeys,
              method: ctx.method, url: normalizeUrl(ctx.url),
              requestHeaders: ctx.headers, requestBody: ctx.body,
              responseStatus: this.status,
              responseHeaders: parseXhrHeaders(this.getAllResponseHeaders()),
              responseBody: typeof this.responseText === 'string' ? this.responseText : '',
              durationMs: Date.now() - started,
              type: 'xhr'
            });
          } catch {}
        });
      }
      return origSend.apply(this, arguments);
    };
  }

  function parseXhrHeaders(str) {
    const o = {}; if (!str) return o;
    for (const line of str.split(/\r\n/)) {
      if (!line) continue;
      const i = line.indexOf(':'); if (i < 0) continue;
      o[line.slice(0, i).trim()] = line.slice(i + 1).trim();
    }
    return o;
  }

  // ---------- WebSocket hook ----------


  const OrigWS = window.WebSocket;
  if (OrigWS) {
    function EchoKitWS(url, protocols) {
      const ekUrl = String(url);
      const matchKeys = computeMatchKeys('WS', ekUrl, '');
      // Mock replay — return fake WebSocket if mocking is on and a mock exists
      if (state.mocking) {
        const mock = pickMock(matchKeys);
        if (mock) return new MockWebSocket(ekUrl, mock);
      }
      const ws = new OrigWS(url, protocols);
      if (!state.recording && !state.mocking) return ws;
      const frames = [];
      const openedAt = Date.now();
      const origSend = ws.send.bind(ws);
      ws.send = function (data) {
        frames.push({ dir: 'out', t: Date.now() - openedAt, data: tryStringify(data) });
        if (state.recording) emit('record', {
          matchKeys: computeMatchKeys('WS', ekUrl, ''),
          method: 'WS', url: ekUrl,
          requestHeaders: {}, requestBody: null,
          responseStatus: 101,
          responseHeaders: {},
          responseBody: JSON.stringify({ __echokitWS: true, openedAt, frames: [...frames] }),
          type: 'websocket'
        });
        return origSend(data);
      };
      ws.addEventListener('message', (ev) => {
        frames.push({ dir: 'in', t: Date.now() - openedAt, data: tryStringify(ev.data) });
        if (state.recording) emit('record', {
          matchKeys: computeMatchKeys('WS', ekUrl, ''),
          method: 'WS', url: ekUrl,
          requestHeaders: {}, requestBody: null,
          responseStatus: 101,
          responseHeaders: {},
          responseBody: JSON.stringify({ __echokitWS: true, openedAt, frames: [...frames] }),
          type: 'websocket'
        });
      });
      return ws;
    }
    EchoKitWS.prototype = OrigWS.prototype;
    EchoKitWS.CONNECTING = OrigWS.CONNECTING;
    EchoKitWS.OPEN = OrigWS.OPEN;
    EchoKitWS.CLOSING = OrigWS.CLOSING;
    EchoKitWS.CLOSED = OrigWS.CLOSED;
    try { window.WebSocket = EchoKitWS; } catch {}
  }

  // ---------- EventSource (SSE) hook ----------
  const OrigES = window.EventSource;
  if (OrigES) {
    function EchoKitES(url, init) {
      const ekUrl = String(url);
      const matchKeys = computeMatchKeys('SSE', ekUrl, '');
      // Mock replay — return fake EventSource if mocking is on and a mock exists
      if (state.mocking) {
        const mock = pickMock(matchKeys);
        if (mock) return new MockEventSource(ekUrl, mock);
      }
      const es = new OrigES(url, init);
      if (!state.recording) return es;
      const frames = [];
      const openedAt = Date.now();
      es.addEventListener('message', (ev) => {
        frames.push({ t: Date.now() - openedAt, data: tryStringify(ev.data) });
        emit('record', {
          matchKeys: computeMatchKeys('SSE', ekUrl, ''),
          method: 'SSE', url: ekUrl,
          requestHeaders: {}, requestBody: null,
          responseStatus: 200,
          responseHeaders: { 'content-type': 'text/event-stream' },
          responseBody: JSON.stringify({ __echokitSSE: true, openedAt, frames: [...frames] }),
          type: 'sse'
        });
      });
      return es;
    }
    EchoKitES.prototype = OrigES.prototype;
    EchoKitES.CONNECTING = OrigES.CONNECTING;
    EchoKitES.OPEN = OrigES.OPEN;
    EchoKitES.CLOSED = OrigES.CLOSED;
    try { window.EventSource = EchoKitES; } catch {}
  }

  function tryStringify(v) {
    if (typeof v === 'string') return v;
    if (v instanceof Blob) return `[blob:${v.size}]`;
    if (v instanceof ArrayBuffer) return `[ab:${v.byteLength}]`;
    try { return JSON.stringify(v); } catch { return String(v); }
  }

  function statusText(code) {
    const map = { 200: 'OK', 201: 'Created', 204: 'No Content', 301: 'Moved Permanently', 302: 'Found', 304: 'Not Modified', 400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found', 408: 'Request Timeout', 418: "I'm a teapot", 422: 'Unprocessable Entity', 429: 'Too Many Requests', 500: 'Internal Server Error', 502: 'Bad Gateway', 503: 'Service Unavailable', 504: 'Gateway Timeout' };
    return map[code] || '';
  }
})();

})();
