#!/usr/bin/env python3
"""
Debug script to check EchoKit extension rendering issues.
Captures console errors and takes screenshots to diagnose blank screen issue.
"""

import sys
from pathlib import Path
from playwright.sync_api import sync_playwright
import time

def debug_extension():
    """Load extension and capture any console errors."""
    
    extension_path = Path(__file__).parent.parent / "extension"
    
    with sync_playwright() as p:
        # Launch browser with extension loaded (non-headless for debugging)
        context = p.chromium.launch_persistent_context(
            "",
            headless=False,  # Must be non-headless for extensions
            args=[
                f"--disable-extensions-except={extension_path}",
                f"--load-extension={extension_path}",
                "--no-sandbox",
            ]
        )
        
        # Collect console messages and errors
        console_messages = []
        errors = []
        
        page = context.new_page()
        
        # Listen for console events
        page.on("console", lambda msg: console_messages.append(f"[{msg.type}] {msg.text}"))
        page.on("pageerror", lambda exc: errors.append(f"PAGE ERROR: {exc}"))
        
        # Navigate to a test page
        page.goto("https://httpbin.org/get")
        time.sleep(2)
        
        # Try to open the extension popup
        print("\n🔍 Attempting to open extension popup...")
        try:
            # Get extension ID
            service_workers = context.service_workers
            if service_workers:
                sw = service_workers[0]
                extension_id = sw.url.split("/")[2]
                print(f"✓ Extension ID: {extension_id}")
                
                # Open popup
                popup_url = f"chrome-extension://{extension_id}/popup/popup.html"
                popup_page = context.new_page()
                popup_page.on("console", lambda msg: console_messages.append(f"[POPUP-{msg.type}] {msg.text}"))
                popup_page.on("pageerror", lambda exc: errors.append(f"POPUP ERROR: {exc}"))
                
                popup_page.goto(popup_url)
                time.sleep(3)
                
                # Take screenshot
                screenshot_path = Path(__file__).parent / "debug_popup_screenshot.png"
                popup_page.screenshot(path=str(screenshot_path))
                print(f"✓ Screenshot saved: {screenshot_path}")
                
                # Check if root element exists and has content
                root = popup_page.query_selector("#ek-root")
                if root:
                    inner_html = root.inner_html()
                    print(f"\n📄 Root element HTML length: {len(inner_html)} chars")
                    if len(inner_html) < 100:
                        print(f"⚠️  Root element appears empty!")
                        print(f"HTML: {inner_html[:200]}")
                else:
                    print("❌ #ek-root element not found!")
                
                # Check for app element
                app = popup_page.query_selector('[data-testid="echokit-app"]')
                if app:
                    print("✓ EchoKit app element found")
                else:
                    print("❌ EchoKit app element NOT found - rendering failed!")
                
            else:
                print("❌ No service workers found - extension may not have loaded")
                
        except Exception as e:
            print(f"❌ Error opening popup: {e}")
            errors.append(f"POPUP OPEN ERROR: {e}")
        
        # Print console messages
        if console_messages:
            print("\n📋 Console Messages:")
            for msg in console_messages:
                print(f"  {msg}")
        else:
            print("\n✓ No console messages")
        
        # Print errors
        if errors:
            print("\n❌ Errors Detected:")
            for err in errors:
                print(f"  {err}")
            return 1
        else:
            print("\n✅ No JavaScript errors detected")
            return 0
        
        time.sleep(5)  # Keep browser open for manual inspection

if __name__ == "__main__":
    sys.exit(debug_extension())
