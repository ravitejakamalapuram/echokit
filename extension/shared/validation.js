/**
 * Input validation module for EchoKit settings and messages.
 * 
 * Provides whitelist-based validation to prevent:
 * - Invalid setting keys
 * - Wrong data types
 * - Malformed data structures
 * - Security issues from unvalidated input
 */

// Whitelist of allowed top-level settings keys
const ALLOWED_SETTINGS = new Set([
  'corsOverride',
  'scope',
  'theme',
  'autoOpenOnRefresh',
  'blocklist',
  'rewriteRules',
  'transformRules',
  'requestHeaders'
]);

// Valid values for specific settings
const VALID_SCOPES = ['tab', 'domain', 'global'];
const VALID_THEMES = ['light', 'dark', 'auto'];
const VALID_REQUEST_HEADER_MODES = ['override', 'append', 'remove'];
const VALID_TRANSFORM_PHASES = ['request', 'response'];
const VALID_TRANSFORM_ACTIONS = ['add-header', 'set-header', 'remove-header', 'modify-body'];

/**
 * Validate a settings patch object.
 * 
 * @param {Object} patch - Settings patch to validate
 * @returns {{valid: boolean, errors: string[]}} Validation result
 */
export function validateSettings(patch) {
  const errors = [];

  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    errors.push('Settings patch must be a non-null object');
    return { valid: false, errors };
  }

  // Check for invalid keys
  for (const key of Object.keys(patch)) {
    if (!ALLOWED_SETTINGS.has(key)) {
      errors.push(`Invalid setting key: "${key}". Allowed: ${Array.from(ALLOWED_SETTINGS).join(', ')}`);
    }
  }

  // Type validation for specific keys
  if ('corsOverride' in patch && typeof patch.corsOverride !== 'boolean') {
    errors.push('corsOverride must be boolean');
  }

  if ('autoOpenOnRefresh' in patch && typeof patch.autoOpenOnRefresh !== 'boolean') {
    errors.push('autoOpenOnRefresh must be boolean');
  }

  if ('scope' in patch) {
    if (!VALID_SCOPES.includes(patch.scope)) {
      errors.push(`scope must be one of: ${VALID_SCOPES.join(', ')}`);
    }
  }

  if ('theme' in patch) {
    if (!VALID_THEMES.includes(patch.theme)) {
      errors.push(`theme must be one of: ${VALID_THEMES.join(', ')}`);
    }
  }

  // Array validations
  if ('blocklist' in patch) {
    if (!Array.isArray(patch.blocklist)) {
      errors.push('blocklist must be an array');
    } else {
      patch.blocklist.forEach((item, idx) => {
        if (!item || typeof item !== 'object') {
          errors.push(`blocklist[${idx}] must be an object`);
        } else if (!('pattern' in item) || typeof item.pattern !== 'string') {
          errors.push(`blocklist[${idx}].pattern must be a string`);
        }
      });
    }
  }

  if ('requestHeaders' in patch) {
    if (!Array.isArray(patch.requestHeaders)) {
      errors.push('requestHeaders must be an array');
    } else {
      patch.requestHeaders.forEach((item, idx) => {
        if (!item || typeof item !== 'object') {
          errors.push(`requestHeaders[${idx}] must be an object`);
        } else {
          if (!('key' in item) || typeof item.key !== 'string') {
            errors.push(`requestHeaders[${idx}].key must be a string`);
          }
          if ('mode' in item && !VALID_REQUEST_HEADER_MODES.includes(item.mode)) {
            errors.push(`requestHeaders[${idx}].mode must be one of: ${VALID_REQUEST_HEADER_MODES.join(', ')}`);
          }
        }
      });
    }
  }

  if ('rewriteRules' in patch) {
    if (!Array.isArray(patch.rewriteRules)) {
      errors.push('rewriteRules must be an array');
    } else {
      patch.rewriteRules.forEach((item, idx) => {
        if (!item || typeof item !== 'object') {
          errors.push(`rewriteRules[${idx}] must be an object`);
        }
      });
    }
  }

  if ('transformRules' in patch) {
    if (!Array.isArray(patch.transformRules)) {
      errors.push('transformRules must be an array');
    } else {
      patch.transformRules.forEach((item, idx) => {
        if (!item || typeof item !== 'object') {
          errors.push(`transformRules[${idx}] must be an object`);
        } else {
          if ('phase' in item && !VALID_TRANSFORM_PHASES.includes(item.phase)) {
            errors.push(`transformRules[${idx}].phase must be one of: ${VALID_TRANSFORM_PHASES.join(', ')}`);
          }
          if ('action' in item && !VALID_TRANSFORM_ACTIONS.includes(item.action)) {
            errors.push(`transformRules[${idx}].action must be one of: ${VALID_TRANSFORM_ACTIONS.join(', ')}`);
          }
        }
      });
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate a URL pattern (used in blocklist, rewrite rules, etc.)
 * 
 * @param {string} pattern - URL pattern to validate
 * @returns {{valid: boolean, error: string|null}} Validation result
 */
export function validateUrlPattern(pattern) {
  if (typeof pattern !== 'string') {
    return { valid: false, error: 'URL pattern must be a string' };
  }
  if (pattern.trim() === '') {
    return { valid: true, error: null }; // Empty pattern is valid (matches all)
  }
  // Basic validation - could be enhanced with regex
  return { valid: true, error: null };
}
