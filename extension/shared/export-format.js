// EchoKit — mock-set export envelope.
//
// Shared by file export and GitHub Gist upload so both produce the same shape.
// `_generator` credits EchoKit in fixtures that get committed and shared; it is
// metadata only — the extension importer and the echokit-server CLI read just
// `interactions` and ignore unknown top-level fields.

export const EXPORT_VERSION = 2;
export const EXPORT_GENERATOR = 'EchoKit — https://echokit.dev';

/**
 * Build the JSON object written for an exported mock set.
 * @param {object[]} interactions
 * @param {Date} [now]
 * @returns {{ _generator: string, version: number, exportedAt: string, interactions: object[] }}
 */
export function buildMockExport(interactions, now = new Date()) {
  return {
    _generator: EXPORT_GENERATOR,
    version: EXPORT_VERSION,
    exportedAt: now.toISOString(),
    interactions: Array.isArray(interactions) ? interactions : []
  };
}
