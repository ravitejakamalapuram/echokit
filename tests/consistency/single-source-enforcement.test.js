/**
 * CRITICAL CONSISTENCY ENFORCEMENT TESTS
 * 
 * Purpose: Guarantee that popup and DevTools never diverge in business logic.
 * 
 * These tests MUST pass before deployment. If they fail, it means the
 * single-source-of-truth architecture has been violated.
 * 
 * @test-category critical
 * @architecture-enforcement
 */

import {
  getStatusColor,
  getStatusClass,
  getStatusValue,
  normalizeMethod,
  formatDuration,
  formatTimestamp,
  prettyUrl,
  getModeBadgeText,
  hasConflict,
  getConflictCount,
  escapeHtml
} from '../../extension/shared/interaction-helpers.js';

describe('SINGLE SOURCE ENFORCEMENT - Status Colors', () => {
  test('status color logic is deterministic', () => {
    // 2xx - Success
    expect(getStatusColor(200)).toBe('var(--emerald)');
    expect(getStatusColor(201)).toBe('var(--emerald)');
    expect(getStatusColor(204)).toBe('var(--emerald)');
    
    // 3xx - Redirect
    expect(getStatusColor(300)).toBe('var(--blue)');
    expect(getStatusColor(301)).toBe('var(--blue)');
    expect(getStatusColor(304)).toBe('var(--blue)');
    
    // 4xx - Client Error
    expect(getStatusColor(400)).toBe('var(--amber)');
    expect(getStatusColor(404)).toBe('var(--amber)');
    expect(getStatusColor(422)).toBe('var(--amber)');
    
    // 5xx - Server Error
    expect(getStatusColor(500)).toBe('var(--red)');
    expect(getStatusColor(502)).toBe('var(--red)');
    expect(getStatusColor(503)).toBe('var(--red)');
    
    // Null/undefined
    expect(getStatusColor(null)).toBe('var(--text-muted)');
    expect(getStatusColor(undefined)).toBe('var(--text-muted)');
  });
  
  test('status color MUST match CSS class colors', () => {
    // This documents the contract between JavaScript and CSS
    // If CSS .ek-status.s2 color changes, getStatusColor(200) must change too
    
    const contracts = [
      { status: 200, jsColor: 'var(--emerald)', cssClass: 's2' },
      { status: 300, jsColor: 'var(--blue)', cssClass: 's3' },
      { status: 400, jsColor: 'var(--amber)', cssClass: 's4' },
      { status: 500, jsColor: 'var(--red)', cssClass: 's5' }
    ];
    
    contracts.forEach(({ status, jsColor, cssClass }) => {
      expect(getStatusColor(status)).toBe(jsColor);
      expect(getStatusClass(status)).toBe(cssClass);
    });
  });
  
  test('status functions are idempotent', () => {
    // Same input MUST produce same output every time
    const status = 404;
    
    const call1 = getStatusColor(status);
    const call2 = getStatusColor(status);
    const call3 = getStatusColor(status);
    
    expect(call1).toBe(call2);
    expect(call2).toBe(call3);
  });
});

describe('SINGLE SOURCE ENFORCEMENT - Method Normalization', () => {
  test('method normalization is consistent', () => {
    expect(normalizeMethod('get')).toBe('GET');
    expect(normalizeMethod('GET')).toBe('GET');
    expect(normalizeMethod('post')).toBe('POST');
    expect(normalizeMethod('Post')).toBe('POST');
    expect(normalizeMethod('delete')).toBe('DELETE');
  });
  
  test('method defaults to GET', () => {
    expect(normalizeMethod(null)).toBe('GET');
    expect(normalizeMethod(undefined)).toBe('GET');
    expect(normalizeMethod('')).toBe('GET');
  });
  
  test('method normalization is idempotent', () => {
    const method = 'post';
    
    const call1 = normalizeMethod(method);
    const call2 = normalizeMethod(method);
    
    expect(call1).toBe(call2);
    expect(call1).toBe('POST');
  });
});

describe('SINGLE SOURCE ENFORCEMENT - Status Value', () => {
  test('respects override status', () => {
    const interaction = {
      responseStatus: 200,
      overrideStatus: 404
    };
    
    expect(getStatusValue(interaction)).toBe(404);
  });
  
  test('falls back to response status', () => {
    const interaction = {
      responseStatus: 200,
      overrideStatus: null
    };
    
    expect(getStatusValue(interaction)).toBe(200);
  });
  
  test('handles null gracefully', () => {
    const interaction = {
      responseStatus: null,
      overrideStatus: null
    };
    
    expect(getStatusValue(interaction)).toBe(null);
  });
});

describe('SINGLE SOURCE ENFORCEMENT - Timestamp Formatting', () => {
  test('formats seconds correctly', () => {
    const now = Date.now();
    expect(formatTimestamp(now - 30_000)).toBe('30s ago');
    expect(formatTimestamp(now - 45_000)).toBe('45s ago');
  });
  
  test('formats minutes correctly', () => {
    const now = Date.now();
    expect(formatTimestamp(now - 120_000)).toBe('2m ago');
    expect(formatTimestamp(now - 300_000)).toBe('5m ago');
  });
  
  test('formats hours correctly', () => {
    const now = Date.now();
    expect(formatTimestamp(now - 7200_000)).toBe('2h ago');
  });
  
  test('formats days correctly', () => {
    const now = Date.now();
    expect(formatTimestamp(now - 172800_000)).toBe('2d ago');
  });
});

describe('SINGLE SOURCE ENFORCEMENT - URL Formatting', () => {
  test('extracts path and query', () => {
    const result = prettyUrl('https://api.example.com/users?page=1');
    expect(result.path).toBe('/users');
    expect(result.query).toBe('?page=1');
  });
  
  test('handles invalid URLs', () => {
    const result = prettyUrl('not-a-url');
    expect(result.path).toBe('not-a-url');
    expect(result.query).toBe('');
  });
});

describe('SINGLE SOURCE ENFORCEMENT - Mode Badge', () => {
  test('maps modes to abbreviations', () => {
    expect(getModeBadgeText('ignore-query')).toBe('NOQ');
    expect(getModeBadgeText('ignore-body')).toBe('NOB');
    expect(getModeBadgeText('path-wildcard')).toBe('PATH');
  });
  
  test('returns original mode if no mapping', () => {
    expect(getModeBadgeText('custom-mode')).toBe('custom-mode');
  });
});

describe('SINGLE SOURCE ENFORCEMENT - Conflict Detection', () => {
  test('detects conflicts correctly', () => {
    const interactions = [
      { id: 1, hash: 'abc123' },
      { id: 2, hash: 'abc123' },
      { id: 3, hash: 'def456' }
    ];
    
    expect(hasConflict(interactions[0], interactions)).toBe(true);
    expect(hasConflict(interactions[1], interactions)).toBe(true);
    expect(hasConflict(interactions[2], interactions)).toBe(false);
  });
  
  test('counts conflicts correctly', () => {
    const interactions = [
      { id: 1, hash: 'abc123' },
      { id: 2, hash: 'abc123' },
      { id: 3, hash: 'abc123' },
      { id: 4, hash: 'def456' }
    ];
    
    expect(getConflictCount(interactions[0], interactions)).toBe(3);
    expect(getConflictCount(interactions[3], interactions)).toBe(1);
  });
});

describe('SINGLE SOURCE ENFORCEMENT - HTML Escaping', () => {
  test('escapes HTML special characters', () => {
    expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
    expect(escapeHtml('&')).toBe('&amp;');
    expect(escapeHtml('"quotes"')).toBe('&quot;quotes&quot;');
    expect(escapeHtml("'single'")).toBe('&#039;single&#039;');
  });
  
  test('handles null/undefined', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });
});
