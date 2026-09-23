// EchoKit — once-only, non-modal "rate EchoKit" prompt.
//
// A "completed record→mock loop" is one mock session (MOCK switched on for a
// tab) in which at least one request was actually served from a mock. After
// REVIEW_PROMPT_THRESHOLD such loops the popup/panel shows a small dismissible
// banner. Whatever the user clicks, the prompt is never shown again.
//
// Pure helpers with injected storage (chrome.storage.local in production) so
// they can be unit-tested in Node — same pattern as pro-status.js.

export const REVIEW_PROMPT_KEY = 'echokit_review_prompt';
export const REVIEW_PROMPT_THRESHOLD = 3;
export const REVIEW_URL = 'https://chromewebstore.google.com/detail/jndhbmaokpclbpjoogffaimahadpidcf/reviews';
// Only the most recent counted session ids are kept — enough to dedupe the
// many mock hits of a live session without growing storage unbounded.
const MAX_TRACKED_SESSIONS = 20;

/** Coerce an untrusted stored value into a well-formed prompt state. */
export function normalizeReviewState(raw) {
  const s = raw && typeof raw === 'object' ? raw : {};
  return {
    loops: Number.isInteger(s.loops) && s.loops > 0 ? s.loops : 0,
    sessions: Array.isArray(s.sessions) ? s.sessions.filter(x => typeof x === 'string').slice(-MAX_TRACKED_SESSIONS) : [],
    asked: s.asked === true,
    response: typeof s.response === 'string' ? s.response : null,
    askedAt: typeof s.askedAt === 'number' ? s.askedAt : null
  };
}

/** @param {chrome.storage.StorageArea} storage */
export async function getReviewState(storage) {
  try {
    return normalizeReviewState((await storage.get(REVIEW_PROMPT_KEY))[REVIEW_PROMPT_KEY]);
  } catch {
    return normalizeReviewState(null);
  }
}

/**
 * Count a completed record→mock loop for `mockSessionId` the first time a
 * request is served from a mock in that session. Repeat hits are no-ops.
 * @param {chrome.storage.StorageArea} storage
 * @param {string} mockSessionId
 * @returns {Promise<{counted: boolean, loops: number}>}
 */
export async function recordMockLoop(storage, mockSessionId) {
  const s = await getReviewState(storage);
  if (!mockSessionId || s.asked || s.sessions.includes(mockSessionId)) {
    return { counted: false, loops: s.loops };
  }
  const next = {
    ...s,
    loops: s.loops + 1,
    sessions: [...s.sessions, mockSessionId].slice(-MAX_TRACKED_SESSIONS)
  };
  try {
    await storage.set({ [REVIEW_PROMPT_KEY]: next });
  } catch {
    return { counted: false, loops: s.loops };
  }
  return { counted: true, loops: next.loops };
}

/**
 * Whether the banner should be visible right now.
 * @param {ReturnType<typeof normalizeReviewState>} s
 * @param {{ recording?: boolean }} ctx - `recording` is true while any tab is recording.
 */
export function shouldShowReviewPrompt(s, { recording = false } = {}) {
  return !recording && !s.asked && s.loops >= REVIEW_PROMPT_THRESHOLD;
}

/**
 * Persist the user's answer ('rate' | 'later'); either way we never ask again.
 * @param {chrome.storage.StorageArea} storage
 * @param {string} response
 * @param {number} [now]
 */
export async function markReviewPromptAnswered(storage, response, now = Date.now()) {
  const s = await getReviewState(storage);
  const next = {
    ...s,
    asked: true,
    response: response === 'rate' ? 'rate' : 'later',
    askedAt: now,
    sessions: []
  };
  try {
    await storage.set({ [REVIEW_PROMPT_KEY]: next });
  } catch {}
  return next;
}
