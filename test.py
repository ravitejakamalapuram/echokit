with open("tests/smoke_echokit.py", "r") as f:
    text = f.read()
    if 'popup.locator' in text:
        if 'aria-label' in text or 'title' in text or 'remove' in text or 'close' in text:
            print("Found aria-label/title/remove/close")
