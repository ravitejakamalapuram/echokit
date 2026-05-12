// External diagnostic script (avoids CSP issues)
console.log('🔍 Diagnostic script loaded');

const results = document.getElementById('results');
const status = document.getElementById('status');

function log(msg, isError = false) {
  console.log((isError ? '❌ ' : '✅ ') + msg);
  const p = document.createElement('p');
  p.className = isError ? 'error' : 'success';
  p.textContent = isError ? '❌ ' + msg : '✅ ' + msg;
  results.appendChild(p);
}

// Test 1: Basic JS
status.textContent = '✅ External script loaded!';
log('Step 1: HTML rendered');
log('Step 2: External JavaScript executing');

// Test 2: Chrome APIs
if (typeof chrome !== 'undefined' && chrome.runtime) {
  log('Step 3: Chrome APIs available');
  try {
    const manifest = chrome.runtime.getManifest();
    log(`Step 4: Extension v${manifest.version}`);
  } catch (e) {
    log(`Manifest error: ${e.message}`, true);
  }
} else {
  log('Chrome APIs NOT available', true);
}

// Test 3: Background service worker
async function testBackground() {
  try {
    log('Step 5: Testing background service worker...');
    
    const response = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'ping' }, resolve);
    });
    
    if (response) {
      log(`Step 6: Background responded: ${JSON.stringify(response)}`);
    } else {
      log('Step 6: Background returned null (may be normal)', false);
    }
  } catch (e) {
    log(`Background test error: ${e.message}`, true);
  }
  
  // Test 4: Module import
  try {
    log('Step 7: Testing module import...');
    const { initEchoKitUI } = await import('../shared/app.js');
    
    if (typeof initEchoKitUI === 'function') {
      log('Step 8: app.js imported successfully');
      log('Step 9: initEchoKitUI function found');
      
      // Test 5: Try to initialize
      try {
        log('Step 10: Attempting to initialize UI...');
        const root = document.getElementById('ek-root-test');
        if (root) {
          await initEchoKitUI({ mode: 'popup', root });
          log('Step 11: UI initialized successfully! 🎉');
        } else {
          log('Test root element not found', true);
        }
      } catch (initError) {
        log(`UI init error: ${initError.message}`, true);
        console.error('Init error details:', initError);
      }
    } else {
      log('initEchoKitUI is not a function!', true);
    }
  } catch (importError) {
    log(`Module import failed: ${importError.message}`, true);
    console.error('Import error details:', importError);
  }
}

// Run async tests
testBackground();
