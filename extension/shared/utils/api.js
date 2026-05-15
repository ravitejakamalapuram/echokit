// Chrome extension API utilities for EchoKit

import { createLogger } from '../logger.js';
const log = createLogger('API');

/**
 * Send message to service worker and wait for response
 * @param {string} type - Message type
 * @param {*} payload - Message payload
 * @returns {Promise<*>} Response from service worker
 */
export async function sendMessage(type, payload = null) {
  try {
    return await chrome.runtime.sendMessage({ type, payload });
  } catch (err) {
    log.error('sendMessage failed', err, { type, payload });
    throw err;
  }
}

/**
 * Get tab state for a specific tab
 * @param {number} tabId - Tab ID
 * @returns {Promise<Object>} Tab state object
 */
export async function getTabState(tabId) {
  return await sendMessage('echokit:getTabState', { tabId });
}

/**
 * Get all interactions with optional filters
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Array of interactions
 */
export async function getInteractions(options = {}) {
  return await sendMessage('echokit:getInteractions', options);
}

/**
 * Get extension settings
 * @returns {Promise<Object>} Settings object
 */
export async function getSettings() {
  return await sendMessage('echokit:getSettings');
}

/**
 * Update extension settings
 * @param {Object} updates - Settings to update
 * @returns {Promise<void>}
 */
export async function updateSettings(updates) {
  return await sendMessage('echokit:settings:update', updates);
}

/**
 * Start recording on a tab
 * @param {number} tabId - Tab ID
 * @returns {Promise<void>}
 */
export async function startRecording(tabId) {
  return await sendMessage('echokit:recording:start', { tabId });
}

/**
 * Stop recording on a tab
 * @param {number} tabId - Tab ID
 * @returns {Promise<void>}
 */
export async function stopRecording(tabId) {
  return await sendMessage('echokit:recording:stop', { tabId });
}

/**
 * Stop recording on all tabs
 * @returns {Promise<Object>} Result with count of stopped tabs
 */
export async function stopAllRecordings() {
  return await sendMessage('echokit:recording:stopAll');
}

/**
 * Toggle mocking on a tab
 * @param {number} tabId - Tab ID
 * @param {boolean} enabled - Enable/disable mocking
 * @returns {Promise<void>}
 */
export async function toggleMocking(tabId, enabled) {
  const type = enabled ? 'echokit:mocking:start' : 'echokit:mocking:stop';
  return await sendMessage(type, { tabId });
}

/**
 * Clear session interactions
 * @param {Object} options - Clear options (sessionId, tabId, domain, etc.)
 * @returns {Promise<void>}
 */
export async function clearSession(options = {}) {
  return await sendMessage('echokit:session:clear', options);
}

/**
 * Export interactions as HAR
 * @param {Array} interactions - Interactions to export
 * @returns {Promise<Object>} HAR object
 */
export async function exportHar(interactions) {
  return await sendMessage('echokit:export:har', { interactions });
}

/**
 * Export interactions as Postman collection
 * @param {Array} interactions - Interactions to export
 * @returns {Promise<Object>} Postman collection object
 */
export async function exportPostman(interactions) {
  return await sendMessage('echokit:export:postman', { interactions });
}

/**
 * Import HAR file
 * @param {Object} har - HAR object
 * @returns {Promise<Object>} Import result
 */
export async function importHar(har) {
  return await sendMessage('echokit:import:har', { har });
}

/**
 * Import OpenAPI spec
 * @param {Object} spec - OpenAPI specification
 * @returns {Promise<Object>} Import result
 */
export async function importOpenAPI(spec) {
  return await sendMessage('echokit:import:openapi', { spec });
}

/**
 * Check if user is Pro
 * @returns {Promise<boolean>} Pro status
 */
export async function checkProStatus() {
  try {
    const result = await sendMessage('echokit:pro:check');
    return result?.isPro || false;
  } catch {
    return false;
  }
}

/**
 * Resolve current tab ID
 * @returns {Promise<number>} Tab ID
 */
export async function resolveTabId() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id || null;
}
