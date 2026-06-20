# Privacy Policy for EchoKit — API Recorder & Mocker

Last updated: 2026-06-02

## Overview
We take your privacy seriously. EchoKit is designed to operate securely and keep your data safe.

## What Data We Collect
**EchoKit does not collect, store, or transmit any personal data, telemetry, or browsing history.**
All preferences, configuration settings, and recorded API interactions are stored strictly on your local device.

## How Data Is Stored
All data is stored locally on the device using standard Chrome Extension API methods:
- `chrome.storage.local` / `chrome.storage.sync`: Used to save settings, configuration, and preferences.
- `chrome.storage.session`: Used to keep session states active for individual tabs.
- `IndexedDB`: Used to store recorded API mock interactions and logs.

No data is uploaded, shared, or synced to external servers unless you explicitly configure the GitHub Gist integration to back up or sync your own mocks to your own GitHub Gist.

## Third-Party Services
This extension does not use any third-party services, APIs, analytics platforms, or external tracking services. All processing is completed client-side on your machine.

## Contact
If you have any questions or feedback regarding this policy, please open a GitHub Issue in the project repository.
