/**
 * Quick import test - verify all modules load without error
 */

import { createScopedLogger } from '../extension/shared/logger.js';
import { validateSettings, validateUrlPattern } from '../extension/shared/validation.js';

const log = createScopedLogger('test');

log.info('Logger loaded successfully');
log.warn('Test warning');
log.error('Test error', new Error('test'), { context: 'test' });

const result = validateSettings({ corsOverride: true });
console.log('Validation result:', result);

console.log('✅ All imports successful!');
