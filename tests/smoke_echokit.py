"""
EchoKit smoke test — loads the unpacked extension in Chromium via Playwright,
opens a test page that performs fetch + XHR calls, and validates:
  1. Recording captures fetch + XHR
  2. Mock-enabling a recording returns mocked response bytes to the page
  3. Status override + error simulation work
  4. Export returns the recorded interactions
"""

import json
import os
import sys
import time
import http.server
import socketserver
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

EXT_PATH = str(Path('/app/extension').resolve())
PORT = 18767

# ---------- tiny test HTTP server with fetch + XHR endpoints ----------
class H(http.server.BaseHTTPRequestHandler):
    def _send(self, code, body, ctype='application/json'):
        self.send_response(code)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == '/':
            html = b"""<!doctype html><html><head><title>EchoKit Test</title></head>
<body><h1>EchoKit smoke-test page</h1>
<pre id="out">ready</pre>
<script>
window.__calls = [];
window.doFetch = async (suffix='') => {
  const r = await fetch('/api/users' + suffix);
  const j = await r.json();
  window.__calls.push({type:'fetch-users'+suffix, status:r.status, body:j});
  document.getElementById('out').textContent = JSON.stringify(j);
  return {status:r.status, body:j};
};
window.doPost = async (payload) => {
  const r = await fetch('/api/login', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)});
  const j = await r.json();
  window.__calls.push({type:'fetch-login', status:r.status, body:j});
  return {status:r.status, body:j};
};
window.doXhr = () => new Promise((res, rej) => {
  const x = new XMLHttpRequest();
  x.open('GET', '/api/ping');
  x.onload = () => { window.__calls.push({type:'xhr-ping', status:x.status, body:x.responseText}); res({status:x.status, body:x.responseText}); };
  x.onerror = () => rej(new Error('xhr error'));
  x.send();
});
</script></body></html>"""
            return self._send(200, html, 'text/html')
        if self.path.startswith('/api/users'):
            return self._send(200, json.dumps({'source':'real','users':[{'id':1,'name':'Ada'},{'id':2,'name':'Grace'}]}).encode())
        if self.path == '/api/ping':
            return self._send(200, json.dumps({'source':'real','pong':True}).encode())
        return self._send(404, b'{"error":"nope"}')

    def do_POST(self):
        length = int(self.headers.get('Content-Length') or 0)
        body = self.rfile.read(length)
        if self.path == '/api/login':
            return self._send(200, json.dumps({'source':'real','token':'real-token-abc','received':body.decode()}).encode())
        return self._send(404, b'{"error":"nope"}')

    def log_message(self, *a, **k): pass

def start_server():
    # Use SO_REUSEADDR to avoid TIME_WAIT collisions from prior runs.
    socketserver.TCPServer.allow_reuse_address = True
    srv = socketserver.TCPServer(('127.0.0.1', PORT), H)
    t = threading.Thread(target=srv.serve_forever, daemon=True)
    t.start()
    return srv

# ---------- test helper: talk to the extension via its service worker ----------
def sw_send(sw, msg, timeout=5000):
    """Invoke the background handler directly inside the SW context
    (chrome.runtime.sendMessage from the SW itself does not round-trip)."""
    return sw.evaluate(f"""
        (async () => {{
          if (typeof __echokitHandle === 'function') return await __echokitHandle({json.dumps(msg)}, {{}});
          return await new Promise((resolve) => chrome.runtime.sendMessage({json.dumps(msg)}, resolve));
        }})()
    """)

def main():
    results = {'steps': [], 'failed': [], 'passed': []}

    def step(name, ok, detail=''):
        entry = {'step': name, 'ok': bool(ok), 'detail': str(detail)[:400]}
        results['steps'].append(entry)
        (results['passed'] if ok else results['failed']).append(name)
        marker = 'OK ' if ok else 'FAIL'
        print(f'[{marker}] {name}  {detail if not ok else ""}'.strip())

    srv = start_server()
    try:
        with sync_playwright() as p:
            user_data = '/tmp/echokit-profile'
            if os.path.exists(user_data):
                import shutil; shutil.rmtree(user_data)

            ctx = p.chromium.launch_persistent_context(
                user_data,
                headless=False,  # MV3 extensions only work headed (or with new-headless)
                args=[
                    f'--disable-extensions-except={EXT_PATH}',
                    f'--load-extension={EXT_PATH}',
                    '--no-sandbox',
                    '--no-first-run',
                ],
            )

            # Wait for the extension's service worker.
            sw = None
            for _ in range(30):
                svc = ctx.service_workers
                if svc:
                    sw = svc[0]
                    break
                time.sleep(0.3)
            # If no SW yet, try opening a page so the extension initializes.
            page = ctx.new_page()
            page.goto(f'http://127.0.0.1:{PORT}/')
            page.wait_for_load_state('domcontentloaded')
            for _ in range(30):
                svc = ctx.service_workers
                if svc:
                    sw = svc[0]; break
                time.sleep(0.3)
            step('service_worker_detected', sw is not None)
            if sw is None:
                print('SWs:', ctx.service_workers)
                return results

            ext_id = sw.url.split('/')[2]
            print('Extension id:', ext_id)
            step('extension_id_present', bool(ext_id))

            # Tab id for our test page
            tab_id = sw.evaluate("""async () => {
                const tabs = await chrome.tabs.query({url: 'http://127.0.0.1:*/*'});
                return tabs[0]?.id ?? null;
            }""")
            step('tab_id_resolved', tab_id is not None, f'tab_id={tab_id}')

            # --- Clear any prior data ---
            sw_send(sw, {'type': 'echokit:interactions:clearAll'})

            # --- Start recording ---
            r = sw_send(sw, {'type': 'echokit:recording:start', 'tabId': tab_id})
            step('recording_start', r and r.get('ok'), r)

            # Give the injected script a moment to pick up state
            time.sleep(0.6)

            # --- Trigger calls on the page ---
            r1 = page.evaluate("window.doFetch()")
            step('real_fetch_get_users', r1.get('status') == 200 and r1['body'].get('source') == 'real', r1)

            r2 = page.evaluate("window.doPost({u:'ada', p:'lovelace'})")
            step('real_fetch_post_login', r2.get('status') == 200 and r2['body'].get('source') == 'real', r2)

            r3 = page.evaluate("window.doXhr()")
            step('real_xhr_ping', r3.get('status') == 200 and 'real' in r3['body'], r3)

            # Give background time to persist
            time.sleep(0.8)

            # --- Stop recording ---
            sw_send(sw, {'type': 'echokit:recording:stop', 'tabId': tab_id})

            # --- Verify recordings persisted ---
            state = sw_send(sw, {'type': 'echokit:getState', 'tabId': tab_id})
            interactions = state.get('interactions', [])
            urls = sorted({i['url'].split('127.0.0.1:')[1] for i in interactions if '127.0.0.1' in i['url']})
            step('captured_three_interactions', len(interactions) >= 3, f'count={len(interactions)} urls={urls}')
            step('captured_fetch_users', any('/api/users' in i['url'] and i['method'] == 'GET' for i in interactions))
            step('captured_fetch_login_post', any('/api/login' in i['url'] and i['method'] == 'POST' for i in interactions))
            step('captured_xhr_ping', any('/api/ping' in i['url'] and i['method'] == 'GET' for i in interactions))

            # --- Enable mocks + override body on the /api/users GET ---
            users_mock = next((i for i in interactions if '/api/users' in i['url'] and i['method'] == 'GET'), None)
            assert users_mock, 'users_mock should exist'
            mocked_body = json.dumps({'source': 'ECHOKIT_MOCK', 'users': [{'id': 99, 'name': 'Mocked'}]})
            sw_send(sw, {'type': 'echokit:interaction:update', 'id': users_mock['id'], 'patch': {
                'mockEnabled': True, 'overrideBody': mocked_body, 'overrideStatus': 201
            }})

            ping_mock = next((i for i in interactions if '/api/ping' in i['url']), None)
            sw_send(sw, {'type': 'echokit:interaction:update', 'id': ping_mock['id'], 'patch': {
                'mockEnabled': True, 'overrideBody': json.dumps({'source':'ECHOKIT_MOCK','pong':'mocked'}),
                'mockLatency': 100
            }})

            # --- Master mock toggle ON ---
            sw_send(sw, {'type': 'echokit:mocking:toggle', 'tabId': tab_id, 'enabled': True})
            time.sleep(1.0)  # let the pushed state reach the injected script

            # --- Re-trigger same calls; expect mocked responses ---
            m1 = page.evaluate("window.doFetch()")
            step('mocked_fetch_status_201', m1.get('status') == 201, m1)
            step('mocked_fetch_body_echokit', m1.get('body', {}).get('source') == 'ECHOKIT_MOCK', m1)

            t0 = time.time()
            m3 = page.evaluate("window.doXhr()")
            elapsed = time.time() - t0
            step('mocked_xhr_status_200', m3.get('status') == 200, m3)
            step('mocked_xhr_body_echokit', 'ECHOKIT_MOCK' in m3.get('body', ''), m3)
            step('mocked_xhr_latency_applied', elapsed >= 0.08, f'elapsed={elapsed:.3f}s')

            # --- POST with DIFFERENT body must NOT match (strict matching) ---
            m_post_diff = page.evaluate("window.doPost({u:'grace', p:'hopper'})")
            step('strict_match_different_body_hits_real', m_post_diff.get('body', {}).get('source') == 'real', m_post_diff)

            # --- POST with SAME body SHOULD match if we enable its mock ---
            login_mock = next((i for i in interactions if '/api/login' in i['url']), None)
            sw_send(sw, {'type': 'echokit:interaction:update', 'id': login_mock['id'], 'patch': {
                'mockEnabled': True, 'overrideBody': json.dumps({'source':'ECHOKIT_MOCK','token':'fake'})
            }})
            time.sleep(0.3)
            m_post_same = page.evaluate("window.doPost({u:'ada', p:'lovelace'})")
            step('strict_match_same_body_hits_mock', m_post_same.get('body', {}).get('source') == 'ECHOKIT_MOCK', m_post_same)

            # --- Error simulation: force 5xx on users ---
            sw_send(sw, {'type': 'echokit:interaction:update', 'id': users_mock['id'], 'patch': {
                'mockErrorMode': '5xx'
            }})
            time.sleep(0.2)
            m_err = page.evaluate("window.doFetch()")
            step('error_simulation_5xx', m_err.get('status') == 500, m_err)

            # --- Disable master mock; should fall back to real ---
            sw_send(sw, {'type': 'echokit:mocking:toggle', 'tabId': tab_id, 'enabled': False})
            time.sleep(0.3)
            m_real = page.evaluate("window.doFetch()")
            step('mock_off_falls_back_to_real', m_real.get('body', {}).get('source') == 'real', m_real)

            # --- Export produces the saved interactions ---
            exp = sw_send(sw, {'type': 'echokit:export'})
            exp_count = len(exp.get('data', {}).get('interactions', [])) if exp else 0
            step('export_returns_interactions', exp_count >= 3, f'count={exp_count}')

            # --- Import override wipes and replaces ---
            fake_export = {
                'version': 1,
                'exportedAt': '2026-02-23T00:00:00Z',
                'interactions': [{
                    'id': 'fake_1',
                    'hash': 'aaaaaaaa-1',
                    'url': 'http://127.0.0.1:18765/api/imported',
                    'method': 'GET',
                    'requestHeaders': {}, 'requestBody': None,
                    'responseStatus': 200, 'responseHeaders': {},
                    'responseBody': '{"imported":true}',
                    'timestamp': 1, 'tabId': 0, 'sessionId': 'imp',
                    'mockEnabled': False, 'mockLatency': 0, 'mockErrorMode': 'none',
                    'overrideStatus': None, 'overrideBody': None, 'overrideHeaders': None,
                    'activeVersionId': None
                }]
            }
            imp = sw_send(sw, {'type': 'echokit:import', 'data': fake_export, 'strategy': 'override'})
            step('import_override_ok', imp and imp.get('ok'), imp)
            state2 = sw_send(sw, {'type': 'echokit:getState', 'tabId': tab_id})
            step('import_override_wiped_and_replaced', len(state2.get('interactions', [])) == 1, f'after import count={len(state2.get("interactions", []))}')

            # --- Popup page loads without error ---
            popup = ctx.new_page()
            popup.goto(f'chrome-extension://{ext_id}/popup/popup.html')
            popup.wait_for_selector('[data-testid="echokit-app"]', timeout=5000)
            has_header = popup.locator('.ek-logo').count() > 0
            step('popup_renders', has_header)

            # Screenshot for visual sanity
            popup.screenshot(path='/app/echokit-popup-screenshot.png')
            print('saved /app/echokit-popup-screenshot.png')

            ctx.close()
    finally:
        srv.shutdown()

    print('\n===== SUMMARY =====')
    print(f"passed: {len(results['passed'])}   failed: {len(results['failed'])}")
    if results['failed']:
        print('FAILED STEPS:', results['failed'])
    return results

if __name__ == '__main__':
    r = main()
    sys.exit(0 if not r['failed'] else 1)
