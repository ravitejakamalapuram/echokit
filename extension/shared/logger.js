/**
 * Centralized logging module for EchoKit.
 * 
 * Provides consistent, context-rich logging across all extension components
 * (background, app, injected script). All messages are prefixed with [EchoKit]
 * for easy filtering in browser console.
 */

const LOG_PREFIX = '[EchoKit]';

/**
 * Format a timestamp for logging.
 * @returns {string} Formatted timestamp (HH:MM:SS.mmm)
 */
function timestamp() {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  const ms = String(now.getMilliseconds()).padStart(3, '0');
  return `${h}:${m}:${s}.${ms}`;
}

/**
 * Logger instance with methods for different log levels.
 */
export const logger = {
  /**
   * Log informational message.
   * @param {string} msg - Message to log
   * @param {...any} args - Additional arguments
   */
  info(msg, ...args) {
    console.log(`${LOG_PREFIX} [${timestamp()}] ${msg}`, ...args);
  },

  /**
   * Log warning message.
   * @param {string} msg - Warning message
   * @param {...any} args - Additional arguments
   */
  warn(msg, ...args) {
    console.warn(`${LOG_PREFIX} [${timestamp()}] ⚠️  ${msg}`, ...args);
  },

  /**
   * Log error message with optional Error object and context.
   * 
   * @param {string} msg - Error message
   * @param {Error|string|null} error - Error object or message
   * @param {Object} context - Additional context (e.g., {url, tabId})
   */
  error(msg, error = null, context = {}) {
    const errorDetails = {
      message: error instanceof Error ? error.message : String(error || 'Unknown error'),
      stack: error instanceof Error ? error.stack : undefined,
      ...context
    };
    console.error(`${LOG_PREFIX} [${timestamp()}] ❌ ${msg}`, errorDetails);
  },

  /**
   * Log debug message (only if debug mode is enabled).
   * Debug mode can be enabled by setting debugMode flag.
   * 
   * @param {string} msg - Debug message
   * @param {...any} args - Additional arguments
   */
  debug(msg, ...args) {
    // Check if debug mode is enabled (can be set via chrome.storage or global flag)
    if (globalThis.ECHOKIT_DEBUG) {
      console.debug(`${LOG_PREFIX} [${timestamp()}] 🔍 ${msg}`, ...args);
    }
  },

  /**
   * Log message at specified level.
   * Useful for dynamic logging.
   * 
   * @param {'info'|'warn'|'error'|'debug'} level - Log level
   * @param {string} msg - Message
   * @param {...any} args - Additional arguments
   */
  log(level, msg, ...args) {
    switch (level) {
      case 'info':
        this.info(msg, ...args);
        break;
      case 'warn':
        this.warn(msg, ...args);
        break;
      case 'error':
        this.error(msg, args[0], args[1]);
        break;
      case 'debug':
        this.debug(msg, ...args);
        break;
      default:
        this.info(msg, ...args);
    }
  }
};

/**
 * Create a scoped logger with a component prefix.
 * Useful for identifying which component logged a message.
 * 
 * @param {string} component - Component name (e.g., 'background', 'app', 'injected')
 * @returns {Object} Scoped logger instance
 * 
 * @example
 * const log = createScopedLogger('background');
 * log.info('Service worker started'); // [EchoKit] [background] Service worker started
 */
export function createScopedLogger(component) {
  return {
    info: (msg, ...args) => logger.info(`[${component}] ${msg}`, ...args),
    warn: (msg, ...args) => logger.warn(`[${component}] ${msg}`, ...args),
    error: (msg, error, context) => logger.error(`[${component}] ${msg}`, error, context),
    debug: (msg, ...args) => logger.debug(`[${component}] ${msg}`, ...args),
    log: (level, msg, ...args) => logger.log(level, `[${component}] ${msg}`, ...args)
  };
}

/**
 * Enable debug mode globally.
 * Call this from console to enable debug logging: enableDebugMode()
 */
export function enableDebugMode() {
  globalThis.ECHOKIT_DEBUG = true;
  logger.info('Debug mode enabled');
}

/**
 * Disable debug mode globally.
 */
export function disableDebugMode() {
  globalThis.ECHOKIT_DEBUG = false;
  logger.info('Debug mode disabled');
}

// Export logger as default
export default logger;
