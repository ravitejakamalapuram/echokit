#!/usr/bin/env python3
"""
Minimal test to debug why echokit:getState returns None
"""
import os
import sys
import json
from playwright.sync_api import sync_playwright
import time

EXT_PATH = os.path.join(os.path.dirname(__file__), '..', 'extension')

def sw_send(sw, msg):
    """Send message to service worker and wait for response"""
    result = sw.evaluate(f"""
        (async () => {{
          console.log('[TEST] Sending message:', {json.dumps(msg)});

          // Use __echokitHandle if available (direct call to handleMessage)
          // Otherwise fall back to chrome.runtime.sendMessage (which won't work from SW context)
          if (typeof self.__echokitHandle === 'function') {{
            console.log('[TEST] Using __echokitHandle');
            const response = await self.__echokitHandle({json.dumps(msg)}, {{}});
            console.log('[TEST] Got response:', response);
            return response;
          }} else {{
            console.error('[TEST] __echokitHandle not available, falling back to sendMessage (will fail)');
            const response = await new Promise((resolve) => {{
              chrome.runtime.sendMessage({json.dumps(msg)}, (resp) => {{
                console.log('[TEST] Got response:', resp);
                if (chrome.runtime.lastError) {{
                  console.error('[TEST] Runtime error:', chrome.runtime.lastError.message);
                  resolve(null);
                }} else {{
                  resolve(resp);
                }}
              }});
            }});
            console.log('[TEST] Returning:', response);
            return response;
          }}
        }})()
    """)
    print(f"[PYTHON] sw_send result type: {type(result)}, value: {result}")
    return result

def main():
    with sync_playwright() as p:
        # Clean profile
        user_data = '/tmp/echokit-test-debug'
        if os.path.exists(user_data):
            import shutil
            shutil.rmtree(user_data)

        # Launch with extension
        ctx = p.chromium.launch_persistent_context(
            user_data,
            headless=True,
            channel='chromium',
            args=[
                f'--disable-extensions-except={EXT_PATH}',
                f'--load-extension={EXT_PATH}',
                '--no-sandbox',
            ],
            timeout=30000,
        )

        # Wait for service worker
        print("[TEST] Waiting for service worker...")
        sw = None
        if ctx.service_workers:
            sw = ctx.service_workers[0]
        else:
            sw = ctx.wait_for_event('serviceworker', timeout=10000)

        # Listen to console
        console_logs = []
        sw.on('console', lambda msg: console_logs.append(f"[SW CONSOLE] {msg.type}: {msg.text}"))

        print(f"[TEST] Service worker URL: {sw.url}")

        # Check if __echokitHandle was already set by background.js
        # The module-level code at the end of background.js exposes it
        has_handle = sw.evaluate("""
            (function() {
                if (typeof self.__echokitHandle === 'function') {
                    console.log('[TEST] __echokitHandle already available');
                    return true;
                } else {
                    console.error('[TEST] __echokitHandle not found - extension may not be loaded yet');
                    return false;
                }
            })()
        """)

        if not has_handle:
            print("[WARNING] __echokitHandle not available, messages will fail")

        # Open a page
        page = ctx.new_page()
        page.goto('http://example.com')
        time.sleep(1)

        # Get tab ID
        tab_id = sw.evaluate("async () => (await chrome.tabs.query({}))[0]?.id")
        print(f"[TEST] Tab ID: {tab_id}")

        # Test 1: Simple message that should always work
        print("\n[TEST 1] Testing echokit:interactions:clearAll (no response expected)")
        result1 = sw_send(sw, {'type': 'echokit:interactions:clearAll'})
        print(f"Result: {result1}\n")

        # Test 2: getState (should return object)
        print("[TEST 2] Testing echokit:getState")
        result2 = sw_send(sw, {'type': 'echokit:getState', 'tabId': tab_id})
        print(f"Result type: {type(result2)}")
        print(f"Result: {result2}")

        if result2 is None:
            print("\n❌ FAILED: getState returned None")

            # Debug: check what handleMessage returns
            print("\n[DEBUG] Checking handleMessage directly...")
            debug_result = sw.evaluate(f"""
                (async () => {{
                  const msg = {{type: 'echokit:getState', tabId: {tab_id}}};
                  const sender = {{}};

                  // Access the handleMessage function if available
                  // This is a hack - in production it's not exposed
                  return "handleMessage not directly accessible - checking console";
                }})()
            """)
            print(f"Debug result: {debug_result}")
        else:
            print("\n✅ SUCCESS: getState returned data")
            if isinstance(result2, dict) and 'interactions' in result2:
                print(f"   Interactions count: {len(result2.get('interactions', []))}")

        # Get console logs
        print("\n[CONSOLE LOGS]")
        for log in console_logs:
            print(f"  {log}")

        ctx.close()

if __name__ == '__main__':
    main()
