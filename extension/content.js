// EchoKit — Content script (ISOLATED world).
// Bridges the page (MAIN world injected.js) <-> background service worker.

(function () {
  const SRC_INJECTED = 'echokit-injected';
  const SRC_CONTENT = 'echokit-content';

  // Allowlisted message types accepted from injected.js.
  const ALLOWED_TYPES = new Set(['record', 'ready', 'mock-hit']);

  /**
   * Validate and sanitize a payload object before forwarding to the background.
   * Returns a plain, safe copy — never the raw untrusted object.
   * Returns null if the payload is structurally invalid for that type.
   *
   * @param {string} type - The message type (already allowlisted).
   * @param {unknown} payload - The untrusted payload from the page.
   * @returns {object|null}
   */
  function sanitizePayload(type, payload) {
    if (type === 'ready') return null; // no payload needed

    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) return null;

    if (type === 'record') {
      // Expected shape: { method, url, status, requestBody, responseBody, requestId, ... }
      const { method, url, status, requestBody, responseBody, requestId, requestHeaders, responseHeaders, duration } = payload;
      if (typeof url !== 'string' || !url) return null;
      return {
        method:          typeof method === 'string'      ? method.toUpperCase().slice(0, 16)   : 'GET',
        url:             url.slice(0, 4096),
        status:          Number.isFinite(status)         ? (status | 0)                        : 0,
        requestBody:     typeof requestBody === 'string' ? requestBody.slice(0, 1_048_576)     : '',
        responseBody:    typeof responseBody === 'string'? responseBody.slice(0, 1_048_576)    : '',
        requestId:       typeof requestId === 'string'   ? requestId.slice(0, 64)              : '',
        requestHeaders:  sanitizeHeaders(requestHeaders),
        responseHeaders: sanitizeHeaders(responseHeaders),
        duration:        Number.isFinite(duration)       ? Math.max(0, duration | 0)           : 0,
      };
    }

    if (type === 'mock-hit') {
      // Expected shape: { requestId, hash, mode }
      const { requestId, hash, mode } = payload;
      if (typeof requestId !== 'string' || typeof hash !== 'string') return null;
      return {
        requestId: requestId.slice(0, 64),
        hash:      hash.slice(0, 128),
        mode:      typeof mode === 'string' ? mode.slice(0, 32) : '',
      };
    }

    return null;
  }

  /**
   * Sanitize an HTTP headers object — allow only string keys and string values.
   * @param {unknown} headers
   * @returns {object}
   */
  function sanitizeHeaders(headers) {
    if (!headers || typeof headers !== 'object' || Array.isArray(headers)) return {};
    const safe = {};
    for (const [k, v] of Object.entries(headers)) {
      if (typeof k === 'string' && typeof v === 'string') {
        safe[k.slice(0, 256)] = v.slice(0, 4096);
      }
    }
    return safe;
  }

  // Forward postMessage from the page to the background.
  // Security guards applied in order:
  //   1. ev.source === window  — same frame only (blocks cross-origin iframes)
  //   2. d.source === SRC_INJECTED — our namespace
  //   3. ALLOWED_TYPES allowlist — no unexpected message types
  //   4. sanitizePayload()     — validated, size-capped plain copy forwarded
  window.addEventListener('message', (ev) => {
    // Guard 1: must originate from the same window (blocks iframes / workers).
    if (ev.source !== window) return;

    const d = ev.data;
    // Guard 2: namespace check.
    if (!d || typeof d !== 'object' || d.source !== SRC_INJECTED) return;

    const { type, payload } = d;
    // Guard 3: allowlisted types only.
    if (typeof type !== 'string' || !ALLOWED_TYPES.has(type)) return;

    // Guard 4: sanitize before forwarding.
    const safePayload = sanitizePayload(type, payload);

    if (type === 'record') {
      if (!safePayload) return;
      chrome.runtime.sendMessage({ type: 'echokit:interaction:record', data: safePayload })
        .catch(() => {});
    } else if (type === 'ready') {
      chrome.runtime.sendMessage({ type: 'echokit:contentReady' }).catch(() => {});
    } else if (type === 'mock-hit') {
      if (!safePayload) return;
      chrome.runtime.sendMessage({ type: 'echokit:mock:hit', data: safePayload }).catch(() => {});
    }
  }, false);

  // Receive pushes from background and forward to the page.
  chrome.runtime.onMessage.addListener((msg) => {
    if (!msg || typeof msg !== 'object') return;
    if (msg.type === 'echokit:mockIndex' || msg.type === 'echokit:tabState' || msg.type === 'echokit:settings') {
      window.postMessage({ source: SRC_CONTENT, type: msg.type, payload: msg.payload }, '*');
    }
  });

  // Announce readiness once DOM is attached (injected.js runs at document_start too).
  try {
    chrome.runtime.sendMessage({ type: 'echokit:contentReady' }).catch(() => {});
  } catch { /* ignore */ }
})();
