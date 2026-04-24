"""
Chrome Web Store screenshot generator.
Loads the unpacked extension, seeds demo recordings via the SW handler,
then captures 1280x800 screenshots of the popup in key states.

Run:  xvfb-run -a python3 tools/generate_screenshots.py
Out:  store/screenshots/01-*.png ... 05-*.png
"""

import os, time, json, shutil, http.server, socketserver, threading
from pathlib import Path
from playwright.sync_api import sync_playwright

EXT_PATH = str(Path('/app/extension').resolve())
OUT_DIR = Path('/app/store/screenshots'); OUT_DIR.mkdir(parents=True, exist_ok=True)
PORT = 18790

class H(http.server.BaseHTTPRequestHandler):
    def _send(self, code, body, ctype='application/json'):
        self.send_response(code); self.send_header('Content-Type', ctype)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Content-Length', str(len(body))); self.end_headers()
        self.wfile.write(body)
    def do_GET(self):
        if self.path == '/': return self._send(200, b'<!doctype html><h1>demo</h1>', 'text/html')
        if self.path.startswith('/api/users'): return self._send(200, json.dumps({'source':'real','users':[{'id':1,'name':'Ada'},{'id':2,'name':'Grace'},{'id':3,'name':'Linus'}]}).encode())
        if self.path.startswith('/api/products'): return self._send(200, json.dumps({'source':'real','products':[{'id':1,'name':'Widget'}]}).encode())
        if self.path.startswith('/api/orders'): return self._send(200, json.dumps({'source':'real','orders':[]}).encode())
        if self.path == '/api/ping': return self._send(200, b'{"source":"real","pong":true}')
        return self._send(404, b'{}')
    def do_POST(self):
        length = int(self.headers.get('Content-Length') or 0); body = self.rfile.read(length)
        if self.path == '/api/login': return self._send(200, json.dumps({'source':'real','token':'tok','received':body.decode()}).encode())
        if self.path == '/api/checkout': return self._send(200, b'{"source":"real","orderId":"ORD-9912"}')
        return self._send(404, b'{}')
    def log_message(self, *a, **k): pass

def sw_send(sw, msg):
    return sw.evaluate(f"(async()=>{{return await __echokitHandle({json.dumps(msg)},{{}})}})()")

def main():
    socketserver.TCPServer.allow_reuse_address = True
    srv = socketserver.TCPServer(('127.0.0.1', PORT), H)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    try:
        with sync_playwright() as p:
            ud = '/tmp/echokit-shots-profile'
            if os.path.exists(ud): shutil.rmtree(ud)
            ctx = p.chromium.launch_persistent_context(
                ud, headless=False,
                args=[f'--disable-extensions-except={EXT_PATH}', f'--load-extension={EXT_PATH}', '--no-sandbox', '--no-first-run'],
                viewport={'width': 1280, 'height': 800},
            )
            page = ctx.new_page(); page.goto(f'http://127.0.0.1:{PORT}/')
            page.wait_for_load_state('domcontentloaded')
            for _ in range(40):
                if ctx.service_workers: break
                time.sleep(0.3)
            sw = ctx.service_workers[0]
            ext_id = sw.url.split('/')[2]
            tab_id = sw.evaluate("async()=>(await chrome.tabs.query({url:'http://127.0.0.1:*/*'}))[0]?.id")

            # Seed some colourful recordings
            sw_send(sw, {'type':'echokit:interactions:clearAll'})
            sw_send(sw, {'type':'echokit:settings:update','patch':{'scope':'global'}})
            sw_send(sw, {'type':'echokit:recording:start','tabId':tab_id})
            time.sleep(0.3)
            for u in ['/api/users', '/api/products', '/api/orders', '/api/ping']:
                page.evaluate(f"fetch('{u}')")
            page.evaluate("fetch('/api/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({u:'ada',p:'lovelace'})})")
            page.evaluate("fetch('/api/checkout',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({items:[1,2,3]})})")
            time.sleep(1.0)
            sw_send(sw, {'type':'echokit:recording:stop','tabId':tab_id})

            all_int = sw_send(sw, {'type':'echokit:getState','tabId':tab_id})['interactions']
            users = next(i for i in all_int if '/api/users' in i['url'])
            sw_send(sw, {'type':'echokit:interaction:update','id':users['id'],
                         'patch':{'mockEnabled':True, 'overrideStatus':201,
                                  'overrideBody':'{\n  "users": [\n    { "id": 99, "name": "Mocked Hero" },\n    { "id": 100, "name": "Another Ada" }\n  ]\n}',
                                  'mockLatency': 1200}})
            sw_send(sw, {'type':'echokit:mocking:toggle','tabId':tab_id,'enabled':True})

            popup = ctx.new_page()
            popup.set_viewport_size({'width': 480, 'height': 600})
            popup.goto(f'chrome-extension://{ext_id}/popup/popup.html')
            popup.wait_for_selector('[data-testid="api-list"]')
            time.sleep(0.5)

            # 01 — hero: recorded list with mock-active banner
            popup.screenshot(path=str(OUT_DIR / '01-record-mock-loop.png'), full_page=False)

            # 02 — detail view expanded on users endpoint
            popup.locator('[data-testid="api-row"]').first.click()
            time.sleep(0.4)
            popup.screenshot(path=str(OUT_DIR / '02-detail-editor.png'))

            # 03 — settings with scope + theme + blocklist
            popup.locator('[data-testid="close-detail"]').click()
            time.sleep(0.2)
            popup.locator('[data-testid="menu-btn"]').click()
            time.sleep(0.2)
            popup.locator('[data-testid="menu-settings"]').click()
            time.sleep(0.3)
            popup.screenshot(path=str(OUT_DIR / '03-settings.png'))

            # 04 — light theme
            popup.locator('[data-testid="settings-theme"]').select_option('light')
            time.sleep(0.4)
            popup.screenshot(path=str(OUT_DIR / '04-light-theme.png'))

            # 05 — wide devtools-style view via the devtools panel page (opened standalone)
            popup.locator('[data-testid="settings-theme"]').select_option('dark')
            popup.locator('.ek-modal button[data-a="close"]').click()
            wide = ctx.new_page()
            wide.set_viewport_size({'width': 1280, 'height': 800})
            wide.goto(f'chrome-extension://{ext_id}/devtools/panel.html')
            wide.wait_for_selector('[data-testid="api-list"]', timeout=5000)
            time.sleep(0.5)
            wide.screenshot(path=str(OUT_DIR / '05-devtools-wide.png'))

            print('Screenshots written to', OUT_DIR)
            ctx.close()
    finally:
        srv.shutdown()

if __name__ == '__main__':
    main()
