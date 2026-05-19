# EchoKit Feature Enhancements

## Summary
This PR implements three user-requested features to improve EchoKit's usability and discoverability.

---

## ✅ Feature 1: Stop All Recordings Across All Tabs

### Implementation
- **Backend** (`extension/background.js`):
  - Added new message type `echokit:recording:stopAll`
  - Iterates through all tabs in `tabState` Map and stops recording on each
  - Returns count of stopped tabs for user feedback

- **Frontend** (`extension/shared/app.js`):
  - Added "Stop all recordings" menu item at the top of the menu
  - Includes confirmation dialog and success feedback
  - Shows count of tabs where recording was stopped

### User Benefit
- Quickly stop recording on all tabs with one click instead of manually stopping each tab
- Helpful when testing across multiple tabs or wanting to pause all recording activity

---

## ✅ Feature 2: Improved Headers Override Discoverability

### Implementation
- **Moved Global Request Headers section** to the top of Advanced Features
- **Enhanced visual prominence**:
  - Golden/amber background highlight
  - "FEATURED" badge
  - Better emoji icon (🔑)
  - Bold text emphasizing "all outgoing requests"
  - Changed button style from ghost to primary (blue)

- **Updated menu hint**: Changed Settings description to mention "headers" explicitly

### User Benefit
- Headers functionality was already implemented but hard to find
- Now prominently featured as the first advanced setting
- Clear visual hierarchy makes it obvious this is an important feature

---

## ✅ Feature 3: Better Advanced Settings Access in DevTools

### Implementation
- **Added gear icon button** in main toolbar for quick settings access
  - Positioned between waterfall toggle and menu button
  - Tooltip: "Advanced Settings (CORS, Headers, Blocklist, etc.)"
  
- **DevTools-specific info banner** in settings dialog:
  - Blue informational banner when opened from DevTools panel
  - Explains that settings apply to all tabs
  - Provides context about DevTools vs Popup mode

### User Benefit
- One-click access to settings from DevTools toolbar (no need to use menu)
- Clear guidance that settings in DevTools affect all tabs globally
- Better discoverability of advanced features

---

## Testing

All existing smoke tests pass:
- ✅ Service worker detection
- ✅ Recording state propagation
- ✅ Interaction capture
- ✅ Mocking functionality
- ✅ Scope filtering
- ✅ CORS override
- ✅ GraphQL matching
- ✅ Blocklist functionality
- ✅ LocalStorage operations

---

## Files Changed

1. `extension/background.js` - Added `echokit:recording:stopAll` handler
2. `extension/shared/app.js` - UI improvements for all three features
