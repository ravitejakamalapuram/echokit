// EchoKit — CORS response-header semantics.
//
// Vendored from cors-enabler v1.0.1:
//   src/engine/rule-builder.ts   (buildResponseHeaderSpecs)
//   src/engine/cors-validator.ts (resolveOriginContext)
// See docs/adr/0002-reuse-cors-enabler-cors-engine.md for why only this pure
// header-semantics slice is vendored, and not cors-enabler's engine, adapter or
// rule-manager (they cannot express EchoKit's tab/domain session-rule scoping
// and would collide with EchoKit's blocklist rule range). Diff against those
// two source files when cors-enabler bumps past 1.0.1 to pick up any
// header-semantics fixes.
//
// Standalone module: no Chrome API dependency, and not yet wired into
// background.js — that wiring is a separate PR (ADR 0002 step 2).

/**
 * @typedef {Object} CorsProfile
 * @property {boolean} [allowCredentials=false] When true, the response must never use
 *   "*" for origin/methods/headers — the browser rejects that combination.
 * @property {string[]} [allowedOrigins] Allowed origins. When credentialed, the first
 *   entry is echoed back (Chrome cannot echo the request Origin dynamically).
 * @property {string} [credentialedOrigin] Fallback origin used when `allowCredentials`
 *   is true and `allowedOrigins` is empty.
 * @property {string[]} [allowMethods] Explicit methods; defaults to "*" (or a safe
 *   method list when credentialed) when omitted.
 * @property {string[]} [allowHeaders] Explicit headers; defaults to "*" (or a safe
 *   header list when credentialed) when omitted.
 * @property {string[]} [exposeHeaders] Opt-in Access-Control-Expose-Headers value.
 *   No header is emitted unless this is set — deferred to ADR 0002 step 3.
 * @property {number} [maxAge] Opt-in Access-Control-Max-Age value in seconds. No
 *   header is emitted unless this is set — deferred to ADR 0002 step 3.
 * @property {boolean} [allowPrivateNetwork=false] Opt-in
 *   Access-Control-Allow-Private-Network. Deferred to ADR 0002 step 3.
 */

/**
 * @typedef {Object} HeaderSpec
 * @property {string} header
 * @property {'set'|'remove'|'append'} operation
 * @property {string} [value]
 */

const DEFAULT_CREDENTIALED_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'];
const DEFAULT_CREDENTIALED_HEADERS = ['Authorization', 'Content-Type', 'Accept', 'Origin', 'X-Requested-With', 'X-CSRF-Token', 'X-Api-Key'];

/**
 * EchoKit's current, live CORS behavior: relax everything, no credentials.
 * Reproduces today's 3 hardcoded headers in background.js's applyCorsRules /
 * applyCorsRulesForAllTabs byte-for-byte.
 * @type {CorsProfile}
 */
export const ECHOKIT_DEFAULT_PROFILE = Object.freeze({
  allowCredentials: false,
  allowedOrigins: [],
  allowMethods: [],
  allowHeaders: []
});

/**
 * Resolve the effective Access-Control-Allow-Origin value and credentials flag for a
 * profile. Ported from cors-enabler's cors-validator.ts resolveOriginContext.
 *
 * The rule this encodes: a credentialed response may never use "*" for origin,
 * methods or headers — the browser rejects that combination.
 * @param {CorsProfile} profile
 * @returns {{ credentials: boolean, origin: string, origins: string[] }}
 */
export function resolveOriginContext(profile) {
  const credentials = !!profile.allowCredentials;
  const origins = (profile.allowedOrigins || []).filter(Boolean);
  let origin;
  if (credentials) {
    origin = origins[0] || profile.credentialedOrigin || '';
  } else {
    origin = origins.length === 1 && origins[0] !== '*' ? origins[0] : '*';
  }
  return { credentials, origin, origins };
}

/**
 * Build the declarativeNetRequest `responseHeaders` specs for a CORS profile.
 * Ported from cors-enabler's rule-builder.ts buildResponseHeaderSpecs.
 *
 * `Access-Control-Expose-Headers`, `Access-Control-Max-Age` and
 * `Access-Control-Allow-Private-Network` are opt-in and only emitted when the
 * profile sets them explicitly — see ADR 0002 step 3.
 * @param {CorsProfile} [profile]
 * @returns {HeaderSpec[]}
 */
export function buildCorsResponseHeaders(profile = ECHOKIT_DEFAULT_PROFILE) {
  const { credentials, origin } = resolveOriginContext(profile);
  const specs = [];

  specs.push({ header: 'Access-Control-Allow-Origin', operation: 'set', value: origin });

  const methods = profile.allowMethods && profile.allowMethods.length > 0
    ? profile.allowMethods.join(', ')
    : credentials ? DEFAULT_CREDENTIALED_METHODS.join(', ') : '*';
  specs.push({ header: 'Access-Control-Allow-Methods', operation: 'set', value: methods });

  const allowHeaders = profile.allowHeaders && profile.allowHeaders.length > 0
    ? profile.allowHeaders.join(', ')
    : credentials ? DEFAULT_CREDENTIALED_HEADERS.join(', ') : '*';
  specs.push({ header: 'Access-Control-Allow-Headers', operation: 'set', value: allowHeaders });

  // Caches must not serve a credentialed, origin-specific response to a different Origin.
  if (origin !== '*') {
    specs.push({ header: 'Vary', operation: 'set', value: 'Origin' });
  }

  if (credentials) {
    specs.push({ header: 'Access-Control-Allow-Credentials', operation: 'set', value: 'true' });
  }

  if (profile.exposeHeaders && profile.exposeHeaders.length > 0) {
    specs.push({ header: 'Access-Control-Expose-Headers', operation: 'set', value: profile.exposeHeaders.join(', ') });
  }

  if (profile.maxAge != null) {
    specs.push({ header: 'Access-Control-Max-Age', operation: 'set', value: String(profile.maxAge) });
  }

  if (profile.allowPrivateNetwork) {
    specs.push({ header: 'Access-Control-Allow-Private-Network', operation: 'set', value: 'true' });
  }

  return specs;
}
