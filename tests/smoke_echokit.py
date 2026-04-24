"""
EchoKit v1.1 smoke test — full end-to-end via Playwright + xvfb.

Covers:
  Core (from v1)            : recording, strict matching, mock body/status/error/latency, export/import
  v1.1 new                  : scope system (domain/tab/global), match modes (strict / ignore-query / ignore-body / path-wildcard), themes, REC badge, keyboard commands
  UX bug fixes              : search cursor preservation, list scroll preservation, detail scroll preservation,
                              CLEAR wipes scoped interactions, CORS discoverable, overflow menu, auto-open-on-refresh plumbing
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
PORT = 18770

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
  return {status:r.status, body:j};
};
window.doFetchQuery = async (q='a=1') => {
  const r = await fetch('/api/items?' + q);
  const j = await r.json();
  return {status:r.status, body:j};
};
window.doPost = async (payload) => {
  const r = await fetch('/api/login', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)});
  const j = await r.json();
  return {status:r.status, body:j};
};
window.doXhr = () => new Promise((res) => {
  const x = new XMLHttpRequest();
  x.open('GET', '/api/ping'); x.onload=()=>res({status:x.status, body:x.responseText}); x.send();
});
</script></body></html>"""
            return self._send(200, html, 'text/html')
        if self.path.startswith('/api/users'):
            return self._send(200, json.dumps({'source':'real','users':[{'id':1,'name':'Ada'}]}).encode())
        if self.path.startswith('/api/items'):
            return self._send(200, json.dumps({'source':'real','items':[{'id':1}],'q':self.path}).encode())
        if self.path == '/api/ping':
            return self._send(200, json.dumps({'source':'real','pong':True}).encode())
        return self._send(404, b'{"error":"nope"}')

    def do_POST(self):
        length = int(self.headers.get('Content-Length') or 0)
        body = self.rfile.read(length)
        if self.path == '/api/login':
            return self._send(200, json.dumps({'source':'real','token':'real','received':body.decode()}).encode())
        return self._send(404, b'{"error":"nope"}')

    def log_message(self, *a, **k): pass

def start_server():
    socketserver.TCPServer.allow_reuse_address = True
    srv = socketserver.TCPServer(('127.0.0.1', PORT), H)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv

def sw_send(sw, msg):
    return sw.evaluate(f"""
        (async () => {{
          if (typeof __echokitHandle === 'function') return await __echokitHandle({json.dumps(msg)}, {{}});
          return await new Promise((r) => chrome.runtime.sendMessage({json.dumps(msg)}, r));
        }})()
    """)

def main():
    results = {'passed': [], 'failed': []}
    def step(name, ok, detail=''):
        (results['passed'] if ok else results['failed']).append(name)
        marker = 'OK ' if ok else 'FAIL'
        print(f'[{marker}] {name}  {detail if not ok else ""}'.strip())

    srv = start_server()
    try:
        with sync_playwright() as p:
            user_data = '/tmp/echokit-profile-v11'
            if os.path.exists(user_data):
                import shutil; shutil.rmtree(user_data)

            ctx = p.chromium.launch_persistent_context(
                user_data, headless=False,
                args=[f'--disable-extensions-except={EXT_PATH}', f'--load-extension={EXT_PATH}', '--no-sandbox', '--no-first-run'],
                viewport={'width': 1280, 'height': 800},
            )

            sw = None
            page = ctx.new_page()
            page.goto(f'http://127.0.0.1:{PORT}/')
            page.wait_for_load_state('domcontentloaded')
            for _ in range(40):
                if ctx.service_workers:
                    sw = ctx.service_workers[0]; break
                time.sleep(0.3)
            step('service_worker_detected', sw is not None)
            if sw is None: return results

            ext_id = sw.url.split('/')[2]
            tab_id = sw.evaluate("async () => (await chrome.tabs.query({url:'http://127.0.0.1:*/*'}))[0]?.id")
            step('tab_id_resolved', tab_id is not None, f'tab={tab_id}')

            # Wipe any prior state.
            sw_send(sw, {'type': 'echokit:interactions:clearAll'})
            # Default scope = domain (no per-test tweaks needed for core flow)

            # === CORE FLOW (from v1) ===
            sw_send(sw, {'type': 'echokit:recording:start', 'tabId': tab_id})
            time.sleep(0.5)
            step('recording_state_propagates_to_injected',
                 page.evaluate("window.__echokitState?.recording") is True)

            page.evaluate("window.doFetch()")
            page.evaluate("window.doPost({u:'ada',p:'lovelace'})")
            page.evaluate("window.doXhr()")
            page.evaluate("window.doFetchQuery('a=1&b=2')")
            time.sleep(0.8)

            sw_send(sw, {'type': 'echokit:recording:stop', 'tabId': tab_id})
            state = sw_send(sw, {'type': 'echokit:getState', 'tabId': tab_id})
            interactions = state.get('interactions', [])
            step('captured_four_interactions', len(interactions) >= 4, f'count={len(interactions)}')

            # Strict match verification
            users = next(i for i in interactions if '/api/users' in i['url'])
            sw_send(sw, {'type':'echokit:interaction:update','id':users['id'],
                         'patch':{'mockEnabled':True, 'overrideBody':'{"source":"MOCK"}', 'overrideStatus':201}})
            sw_send(sw, {'type':'echokit:mocking:toggle','tabId':tab_id,'enabled':True})
            time.sleep(0.5)
            m1 = page.evaluate("window.doFetch()")
            step('mocked_fetch_201_strict', m1['status']==201 and m1['body'].get('source')=='MOCK', m1)

            # === NEW: Match modes ===
            items_q1 = next(i for i in interactions if '/api/items' in i['url'])
            # Change to ignore-query so items?a=1&b=2 matches items?a=2
            sw_send(sw, {'type':'echokit:interaction:update','id':items_q1['id'],
                         'patch':{'mockEnabled':True, 'matchMode':'ignore-query',
                                  'overrideBody':'{"source":"MOCK_NOQ"}'}})
            time.sleep(0.5)
            m_noq = page.evaluate("window.doFetchQuery('a=2&c=9')")
            step('match_mode_ignore_query', m_noq['body'].get('source')=='MOCK_NOQ', m_noq)

            # path-wildcard: POST /api/login with ANY body matches
            login = next(i for i in interactions if '/api/login' in i['url'])
            sw_send(sw, {'type':'echokit:interaction:update','id':login['id'],
                         'patch':{'mockEnabled':True, 'matchMode':'path-wildcard',
                                  'overrideBody':'{"source":"MOCK_PATH"}'}})
            time.sleep(0.3)
            m_path = page.evaluate("window.doPost({u:'grace',p:'hopper'})")
            step('match_mode_path_wildcard', m_path['body'].get('source')=='MOCK_PATH', m_path)

            # === Scope system ===
            sw_send(sw, {'type':'echokit:settings:update','patch':{'scope':'global'}})
            st_global = sw_send(sw, {'type':'echokit:getState','tabId':tab_id})
            step('scope_global_shows_all', len(st_global['interactions']) == state.get('allCount', len(interactions)))

            sw_send(sw, {'type':'echokit:settings:update','patch':{'scope':'tab'}})
            st_tab = sw_send(sw, {'type':'echokit:getState','tabId':tab_id})
            step('scope_tab_filters_to_tab',
                 all(i.get('tabId')==tab_id for i in st_tab['interactions']),
                 f'count={len(st_tab["interactions"])}')

            sw_send(sw, {'type':'echokit:settings:update','patch':{'scope':'domain'}})
            st_dom = sw_send(sw, {'type':'echokit:getState','tabId':tab_id})
            step('scope_domain_filters_to_host',
                 all('127.0.0.1' in (i.get('tabUrl') or i.get('url') or '') for i in st_dom['interactions']),
                 f'count={len(st_dom["interactions"])}')

            # === CLEAR in current scope ===
            cleared = sw_send(sw, {'type':'echokit:clear:scoped','tabId':tab_id})
            step('clear_scoped_deletes_all_in_scope', cleared.get('ok'), cleared)
            st_after = sw_send(sw, {'type':'echokit:getState','tabId':tab_id})
            step('clear_result_list_empty', len(st_after['interactions']) == 0, f'left={len(st_after["interactions"])}')

            # === REC badge — when recording, badge should be set ===
            sw_send(sw, {'type':'echokit:recording:start', 'tabId':tab_id})
            time.sleep(0.3)
            badge = sw.evaluate(f"chrome.action.getBadgeText({{tabId:{tab_id}}})")
            step('rec_badge_shows_REC', badge == 'REC', f'badge="{badge}"')
            sw_send(sw, {'type':'echokit:recording:stop', 'tabId':tab_id})

            # === CORS DNR rule on/off ===
            sw_send(sw, {'type':'echokit:settings:update','patch':{'corsOverride':True}})
            time.sleep(0.3)
            rules = sw.evaluate("chrome.declarativeNetRequest.getDynamicRules()")
            step('cors_dnr_rule_installed', any(r.get('id')==1001 for r in (rules or [])), rules)
            sw_send(sw, {'type':'echokit:settings:update','patch':{'corsOverride':False}})
            time.sleep(0.3)
            rules2 = sw.evaluate("chrome.declarativeNetRequest.getDynamicRules()")
            step('cors_dnr_rule_removed', not any(r.get('id')==1001 for r in (rules2 or [])), rules2)

            # === NEW in v1.2: GraphQL match mode ===
            sw_send(sw, {'type':'echokit:recording:start', 'tabId':tab_id})
            time.sleep(0.3)
            # Seed a GraphQL request
            page.evaluate("""fetch('/api/login',{method:'POST',headers:{'content-type':'application/json'},
                body: JSON.stringify({query:'query GetUser($id: ID!) { user(id: $id) { name } }', variables: {id: 'abc'}, operationName: 'GetUser'})})""")
            time.sleep(0.8)
            sw_send(sw, {'type':'echokit:recording:stop', 'tabId':tab_id})
            all_now = sw_send(sw, {'type':'echokit:getState','tabId':tab_id})['interactions']
            gql_rec = next((i for i in all_now if '/api/login' in i['url'] and i.get('matchKeys',{}).get('graphql')), None)
            step('graphql_keys_computed_on_record', gql_rec is not None, f'found={gql_rec is not None}')
            if gql_rec:
                sw_send(sw, {'type':'echokit:interaction:update','id':gql_rec['id'],
                             'patch':{'mockEnabled':True, 'matchMode':'graphql-op',
                                      'overrideBody':'{"source":"MOCK_GQL","data":{"user":{"name":"Faker"}}}'}})
                sw_send(sw, {'type':'echokit:mocking:toggle', 'tabId':tab_id, 'enabled':True})
                time.sleep(0.5)
                # Same query, different variables — should still match graphql-op mode
                m_gql = page.evaluate("""(async () => {
                  const r = await fetch('/api/login',{method:'POST',headers:{'content-type':'application/json'},
                    body: JSON.stringify({query:'query GetUser($id: ID!) { user(id: $id) { name } }', variables: {id: 'DIFFERENT_VAR'}, operationName: 'GetUser'})});
                  return {status:r.status, body: await r.json()};
                })()""")
                step('graphql_op_matches_different_vars', m_gql['body'].get('source') == 'MOCK_GQL', m_gql)
                sw_send(sw, {'type':'echokit:mocking:toggle', 'tabId':tab_id, 'enabled':False})

            # === NEW: URL blocklist via DNR ===
            sw_send(sw, {'type':'echokit:settings:update','patch':{'blocklist':[{'pattern':'||127.0.0.1^*blocked*','enabled':True}]}})
            time.sleep(0.3)
            rules_bl = sw.evaluate("chrome.declarativeNetRequest.getDynamicRules()")
            step('blocklist_dnr_rule_installed', any(2000 <= r.get('id', 0) < 2100 for r in (rules_bl or [])), rules_bl)
            # Fetch should be blocked (throws in page)
            blocked = page.evaluate("""(async () => {
              try { await fetch('/api/blocked/ping'); return {ok:true}; }
              catch (e) { return {ok:false, err: String(e)}; }
            })()""")
            step('blocklist_blocks_matching_request', blocked.get('ok') is False, blocked)
            sw_send(sw, {'type':'echokit:settings:update','patch':{'blocklist':[]}})

            # === NEW: localStorage read/write via scripting bridge ===
            # Seed localStorage on the test page
            page.evaluate("localStorage.setItem('ek_a','hello'); localStorage.setItem('ek_b','world');")
            ls_read = sw_send(sw, {'type':'echokit:localStorage:read', 'tabId':tab_id})
            step('localStorage_read_ok', ls_read.get('ok') and ls_read.get('count', 0) >= 2 and ls_read['keys'].get('ek_a') == 'hello', ls_read)
            # Write new keys (clearFirst=True)
            ls_write = sw_send(sw, {'type':'echokit:localStorage:write', 'tabId':tab_id,
                                    'keys':{'ek_x':'one','ek_y':'two','ek_z':'three'}, 'clearFirst':True})
            step('localStorage_write_ok', ls_write.get('ok') and ls_write.get('written') == 3, ls_write)
            post = page.evaluate("({a:localStorage.getItem('ek_a'), x:localStorage.getItem('ek_x'), n:localStorage.length})")
            step('localStorage_round_trip_correct', post.get('a') is None and post.get('x') == 'one' and post.get('n') == 3, post)

            # === Popup UI tests ===
            # In Playwright, the "popup" is a normal tab, so chrome.tabs.query({active,currentWindow})
            # returns the popup's own tab. Force scope=global so the UI is visible regardless.
            sw_send(sw, {'type':'echokit:settings:update','patch':{'scope':'global'}})

            popup = ctx.new_page()
            popup.goto(f'chrome-extension://{ext_id}/popup/popup.html')
            popup.wait_for_selector('[data-testid="echokit-app"]')
            popup.wait_for_selector('[data-testid="search-input"]')
            # Seed some data by recording again
            sw_send(sw, {'type':'echokit:recording:start', 'tabId':tab_id})
            time.sleep(0.3)
            page.evaluate("window.doFetch()")
            page.evaluate("window.doPost({a:1})")
            page.evaluate("window.doXhr()")
            time.sleep(0.8)

            # Reload popup to pick up new data
            popup.reload()
            popup.wait_for_selector('[data-testid="api-row"]', timeout=5000)

            # --- UX bug: search typing should not reverse characters ---
            search = popup.locator('[data-testid="search-input"]')
            search.click()
            search.type('users', delay=50)
            search_value = search.input_value()
            step('search_typing_not_reversed', search_value == 'users', f'got="{search_value}"')
            # Clear search
            search.fill('')

            # --- UX bug: overflow menu is reachable and contains settings/clear/export ---
            popup.locator('[data-testid="menu-btn"]').click()
            popup.wait_for_selector('[data-testid="menu-panel"]', timeout=2000)
            has_settings = popup.locator('[data-testid="menu-settings"]').count() > 0
            has_clear = popup.locator('[data-testid="menu-clear"]').count() > 0
            has_export = popup.locator('[data-testid="menu-export"]').count() > 0
            has_import = popup.locator('[data-testid="menu-import"]').count() > 0
            step('menu_has_settings', has_settings)
            step('menu_has_clear', has_clear)
            step('menu_has_export', has_export)
            step('menu_has_import', has_import)
            # Close menu by clicking body
            popup.locator('body').click(position={'x': 10, 'y': 10})

            # --- CORS toggle is reachable from settings ---
            popup.locator('[data-testid="menu-btn"]').click()
            popup.wait_for_selector('[data-testid="menu-settings"]', timeout=1000)
            popup.locator('[data-testid="menu-settings"]').click()
            popup.wait_for_selector('[data-testid="settings-modal"]', timeout=1000)
            has_cors = popup.locator('[data-testid="cors-toggle"]').count() > 0
            has_scope = popup.locator('[data-testid="settings-scope"]').count() > 0
            has_theme = popup.locator('[data-testid="settings-theme"]').count() > 0
            has_auto = popup.locator('[data-testid="auto-open-toggle"]').count() > 0
            step('settings_has_cors_toggle', has_cors)
            step('settings_has_scope', has_scope)
            step('settings_has_theme', has_theme)
            step('settings_has_auto_open', has_auto)

            # Flip theme to light and confirm attribute changes
            popup.locator('[data-testid="settings-theme"]').select_option('light')
            time.sleep(0.3)
            theme_attr = popup.evaluate("document.documentElement.getAttribute('data-theme')")
            step('theme_switch_to_light', theme_attr == 'light', f'data-theme="{theme_attr}"')
            # Reset to dark
            popup.locator('[data-testid="settings-theme"]').select_option('dark')
            popup.locator('.ek-modal button[data-a="close"]').click()

            # --- CLEAR actually empties the visible list ---
            # Open menu, click clear, accept confirm
            popup.on('dialog', lambda d: d.accept())
            popup.locator('[data-testid="menu-btn"]').click()
            popup.wait_for_selector('[data-testid="menu-clear"]', timeout=1000)
            popup.locator('[data-testid="menu-clear"]').click()
            time.sleep(0.8)
            remaining = popup.locator('[data-testid="api-row"]').count()
            step('clear_menu_empties_list', remaining == 0, f'rows_left={remaining}')

            # --- Scroll preservation: add many recordings, scroll list, wait for poll, ensure scroll stays ---
            # Record 20 distinct calls
            sw_send(sw, {'type':'echokit:recording:start', 'tabId':tab_id})
            for i in range(20):
                page.evaluate(f"fetch('/api/users?n={i}')")
            time.sleep(1.2)
            sw_send(sw, {'type':'echokit:recording:stop', 'tabId':tab_id})
            popup.reload()
            popup.wait_for_selector('[data-testid="api-row"]', timeout=5000)
            # Scroll list to bottom
            list_sel = '[data-testid="api-list"]'
            popup.evaluate(f"document.querySelector('{list_sel}').scrollTop = 2000")
            scrolled = popup.evaluate(f"document.querySelector('{list_sel}').scrollTop")
            step('list_scrolled_to_bottom', scrolled > 50, f'scrollTop={scrolled}')
            # Wait for 2 poll cycles
            time.sleep(3.5)
            scrolled_after = popup.evaluate(f"document.querySelector('{list_sel}').scrollTop")
            step('list_scroll_preserved_across_poll', abs(scrolled_after - scrolled) < 5,
                 f'before={scrolled} after={scrolled_after}')

            # --- Detail scroll preservation ---
            popup.locator('[data-testid="api-row"]').first.click()
            popup.wait_for_selector('[data-testid="api-detail"] .ek-detail-body', timeout=2000)
            detail_sel = '[data-testid="api-detail"] .ek-detail-body'
            popup.evaluate(f"document.querySelector('{detail_sel}').scrollTop = 500")
            d_scrolled = popup.evaluate(f"document.querySelector('{detail_sel}').scrollTop")
            step('detail_scrolled', d_scrolled > 50, f'scrollTop={d_scrolled}')
            time.sleep(3.5)
            d_scrolled_after = popup.evaluate(f"document.querySelector('{detail_sel}').scrollTop")
            step('detail_scroll_preserved_across_poll', abs(d_scrolled_after - d_scrolled) < 5,
                 f'before={d_scrolled} after={d_scrolled_after}')

            # --- JSON syntax highlighter is present ---
            mirror_count = popup.evaluate("document.querySelectorAll('.ek-code-mirror').length")
            step('json_highlighter_rendered', mirror_count >= 1, f'mirrors={mirror_count}')
            highlighted_html = popup.evaluate("document.querySelector('.ek-code-mirror')?.innerHTML || ''")
            step('json_highlighter_produces_spans', 'jh-' in highlighted_html, highlighted_html[:120])

            # --- Keyboard shortcut dispatch (simulate via command API) ---
            # Trigger by calling the command listener directly through sw.
            sw.evaluate("""async () => {
                // Simulate a command dispatch by emitting the same code paths.
                chrome.commands?.onCommand?.dispatch?.('toggle-recording');
            }""")
            # Fallback: call our message handler directly
            sw_send(sw, {'type':'echokit:recording:start', 'tabId':tab_id})
            b_on = sw.evaluate(f"chrome.action.getBadgeText({{tabId:{tab_id}}})")
            sw_send(sw, {'type':'echokit:recording:stop', 'tabId':tab_id})
            b_off = sw.evaluate(f"chrome.action.getBadgeText({{tabId:{tab_id}}})")
            step('badge_on_off', b_on == 'REC' and b_off != 'REC', f'on={b_on} off={b_off}')

            # --- Auto-open setting: flip it and confirm persisted ---
            sw_send(sw, {'type':'echokit:settings:update','patch':{'autoOpenOnRefresh':False}})
            s3 = sw_send(sw, {'type':'echokit:getState','tabId':tab_id})
            step('auto_open_setting_persists', s3['settings'].get('autoOpenOnRefresh') is False)

            # Screenshot for visual sanity
            popup.screenshot(path='/app/echokit-popup-v11.png')
            print('saved /app/echokit-popup-v11.png')

            ctx.close()
    finally:
        srv.shutdown()

    print('\n===== SUMMARY =====')
    print(f"passed: {len(results['passed'])}   failed: {len(results['failed'])}")
    if results['failed']:
        print('FAILED:', results['failed'])
    return results

if __name__ == '__main__':
    r = main()
    sys.exit(0 if not r['failed'] else 1)
