// EchoKit — MAIN-world injected script.
// Hooks window.fetch + XMLHttpRequest. Records real traffic (when recording is on)
// and serves mocked responses (when mocking is on AND a match exists).

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

  // ---------- Matcher (inlined — MAIN world can't import shared modules) ----------
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
    window.postMessage({ source: SRC_INJECTED, type, payload, requestId }, '*');
  }
  window.addEventListener('message', (ev) => {
    const d = ev.data;
    if (!d || d.source !== SRC_CONTENT) return;
    if (d.type === 'echokit:mockIndex') {
      // payload may be { mocks, blocked } (new) or the bare index (legacy)
      const p = d.payload || {};
      if (p.mocks) { state.mockIndex = p.mocks; state.blockedKeys = p.blocked || state.blockedKeys; }
      else { state.mockIndex = p; }
    }
    else if (d.type === 'echokit:tabState') {
      state.recording = !!d.payload?.recording;
      state.mocking = !!d.payload?.mocking;
    }
  }, false);
  emit('ready');

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
      const available = versions.filter(v => !v.mockMaxCount || (v.mockCallCount || 0) < v.mockMaxCount);
      if (!available.length) continue;
      const active = available[0].activeVersionId;
      let mock = null;
      if (active) mock = available.find(v => v.id === active);
      if (!mock) mock = available[0];
      // Track conditional mock hit locally + notify background
      if (mock.mockMaxCount != null) {
        mock.mockCallCount = (mock.mockCallCount || 0) + 1;
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
          method = input.method || 'GET';
          reqHeaders = headersToObject(input.headers);
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
        const headers = new Headers(mock.headers || {});
        if (!headers.has('content-type')) headers.set('content-type', 'application/json');
        return new Response(mock.body ?? '', { status, statusText: statusText(status), headers });
      }

      const started = Date.now();
      let res, err;
      try { res = await origFetch(input, init); } catch (e) { err = e; }
      if (state.recording) {
        try {
          if (res) {
            const clone = res.clone();
            const text = await clone.text().catch(() => '');
            emit('record', {
              matchKeys,
              method, url: normalizeUrl(url),
              requestHeaders: reqHeaders, requestBody: reqBody,
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
              requestHeaders: reqHeaders, requestBody: reqBody,
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
      if (this.__echokit) this.__echokit.headers[k] = v;
      return origSetHeader.apply(this, arguments);
    };
    XHR.prototype.send = function (body) {
      const ctx = this.__echokit || {};
      ctx.body = body != null ? (typeof body === 'string' ? body : (body instanceof URLSearchParams ? body.toString() : '[binary]')) : null;
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
  // Fake WebSocket for mock replay
  function createFakeMockWS(url, mock) {
    const body = (() => { try { return JSON.parse(mock.body || '{}'); } catch { return {}; } })();
    const inFrames = (body.frames || []).filter(f => f.dir === 'in');
    const latency = mock.latency || 0;
    const loop = mock.wsLoop || false;
    let onopen = null, onmessage = null, onclose = null, onerror = null;
    const _listeners = { open: [], message: [], close: [], error: [] };
    let _readyState = 0, _closed = false, _loopTimer = null;
    function dispatch(type, ev) {
      const h = { open: onopen, message: onmessage, close: onclose, error: onerror }[type];
      if (h) h(ev);
      (_listeners[type] || []).forEach(fn => { try { fn(ev); } catch {} });
    }
    function replayFrames() {
      inFrames.forEach(f => setTimeout(() => {
        if (_closed) return;
        dispatch('message', new MessageEvent('message', { data: f.data, origin: url }));
      }, f.t));
    }
    const fake = {
      get readyState() { return _readyState; }, url, protocol: '', bufferedAmount: 0, binaryType: 'blob', extensions: '',
      CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3,
      set onopen(v) { onopen = v; }, get onopen() { return onopen; },
      set onmessage(v) { onmessage = v; }, get onmessage() { return onmessage; },
      set onclose(v) { onclose = v; }, get onclose() { return onclose; },
      set onerror(v) { onerror = v; }, get onerror() { return onerror; },
      addEventListener(type, fn) { (_listeners[type] = _listeners[type] || []).push(fn); },
      removeEventListener(type, fn) { _listeners[type] = (_listeners[type] || []).filter(f => f !== fn); },
      dispatchEvent(ev) { dispatch(ev.type, ev); },
      send() { /* accepted, no-op */ },
      close(code) {
        if (_closed) return;
        _closed = true; _readyState = 3;
        if (_loopTimer) { clearInterval(_loopTimer); _loopTimer = null; }
        try { dispatch('close', new CloseEvent('close', { wasClean: true, code: code || 1000, reason: '' })); } catch {}
      }
    };
    setTimeout(() => {
      if (_closed) return;
      _readyState = 1;
      dispatch('open', new Event('open'));
      replayFrames();
      if (loop && inFrames.length > 0) {
        const dur = (inFrames[inFrames.length - 1]?.t || 1000) + 1000;
        _loopTimer = setInterval(() => { if (_closed) { clearInterval(_loopTimer); return; } replayFrames(); }, dur);
      }
    }, latency);
    return fake;
  }

  // Fake EventSource for SSE mock replay
  function createFakeMockSSE(url, mock) {
    const body = (() => { try { return JSON.parse(mock.body || '{}'); } catch { return {}; } })();
    const frames = body.frames || [];
    const latency = mock.latency || 0;
    const loop = mock.wsLoop || false;
    let onmessage = null, onerror = null, onopen = null;
    const _listeners = { message: [], error: [], open: [] };
    let _closed = false, _loopTimer = null;
    function dispatch(type, ev) {
      const h = { message: onmessage, error: onerror, open: onopen }[type];
      if (h) h(ev);
      (_listeners[type] || []).forEach(fn => { try { fn(ev); } catch {} });
    }
    function replayFrames() {
      frames.forEach(f => setTimeout(() => {
        if (_closed) return;
        dispatch('message', new MessageEvent('message', { data: f.data, origin: url }));
      }, f.t));
    }
    const fake = {
      url, CONNECTING: 0, OPEN: 1, CLOSED: 2, readyState: 0, withCredentials: false,
      set onmessage(v) { onmessage = v; }, get onmessage() { return onmessage; },
      set onerror(v) { onerror = v; }, get onerror() { return onerror; },
      set onopen(v) { onopen = v; }, get onopen() { return onopen; },
      addEventListener(type, fn) { (_listeners[type] = _listeners[type] || []).push(fn); },
      removeEventListener(type, fn) { _listeners[type] = (_listeners[type] || []).filter(f => f !== fn); },
      close() { _closed = true; if (_loopTimer) clearInterval(_loopTimer); }
    };
    setTimeout(() => {
      if (_closed) return;
      fake.readyState = 1;
      dispatch('open', new Event('open'));
      replayFrames();
      if (loop && frames.length > 0) {
        const dur = (frames[frames.length - 1]?.t || 1000) + 1000;
        _loopTimer = setInterval(() => { if (_closed) { clearInterval(_loopTimer); return; } replayFrames(); }, dur);
      }
    }, latency);
    return fake;
  }

  const OrigWS = window.WebSocket;
  if (OrigWS) {
    function EchoKitWS(url, protocols) {
      const ekUrl = String(url);
      const matchKeys = computeMatchKeys('WS', ekUrl, '');
      // Mock replay — return fake WebSocket if mocking is on and a mock exists
      if (state.mocking) {
        const mock = pickMock(matchKeys);
        if (mock) return createFakeMockWS(ekUrl, mock);
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
        if (mock) return createFakeMockSSE(ekUrl, mock);
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
