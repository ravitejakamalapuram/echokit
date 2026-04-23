// EchoKit — Content script (ISOLATED world).
// Bridges the page (MAIN world injected.js) <-> background service worker.

(function () {
  const SRC_INJECTED = 'echokit-injected';
  const SRC_CONTENT = 'echokit-content';

  // Forward postMessage from the page to the background.
  window.addEventListener('message', (ev) => {
    const d = ev.data;
    if (!d || d.source !== SRC_INJECTED) return;
    const { type, payload, requestId } = d;

    if (type === 'record') {
      chrome.runtime.sendMessage({ type: 'echokit:interaction:record', data: payload })
        .catch(() => {});
    } else if (type === 'ready') {
      chrome.runtime.sendMessage({ type: 'echokit:contentReady' }).catch(() => {});
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
