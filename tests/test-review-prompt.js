// Unit tests for the once-only review prompt (extension/shared/review-prompt.js).
// Run with: node tests/test-review-prompt.js
import assert from 'assert';
import {
  getReviewState, recordMockLoop, shouldShowReviewPrompt, markReviewPromptAnswered,
  normalizeReviewState, REVIEW_PROMPT_KEY, REVIEW_PROMPT_THRESHOLD, REVIEW_URL
} from '../extension/shared/review-prompt.js';

// Minimal chrome.storage.StorageArea fake.
function fakeArea(initial = {}, { failSet = false } = {}) {
  const data = { ...initial };
  return {
    data,
    async get(keys) {
      const list = Array.isArray(keys) ? keys : [keys];
      const out = {};
      for (const k of list) if (k in data) out[k] = data[k];
      return out;
    },
    async set(obj) {
      if (failSet) throw new Error('quota');
      Object.assign(data, obj);
    }
  };
}

let passed = 0;
let failed = 0;
async function test(name, fn) {
  try {
    await fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (e) {
    console.error(`❌ ${name}`);
    console.error(`   ${e.message}`);
    failed++;
  }
}

console.log('Running review-prompt tests...\n');

await test('threshold is 3 loops and URL points at the CWS reviews page', async () => {
  assert.strictEqual(REVIEW_PROMPT_THRESHOLD, 3);
  assert.strictEqual(REVIEW_URL, 'https://chromewebstore.google.com/detail/jndhbmaokpclbpjoogffaimahadpidcf/reviews');
});

await test('fresh install → not due', async () => {
  const s = await getReviewState(fakeArea());
  assert.strictEqual(s.loops, 0);
  assert.strictEqual(shouldShowReviewPrompt(s), false);
});

await test('many mock hits in one session count as a single loop', async () => {
  const area = fakeArea();
  assert.strictEqual((await recordMockLoop(area, 'mock_1_1')).counted, true);
  assert.strictEqual((await recordMockLoop(area, 'mock_1_1')).counted, false);
  assert.strictEqual((await recordMockLoop(area, 'mock_1_1')).counted, false);
  assert.strictEqual((await getReviewState(area)).loops, 1);
});

await test('missing session id is ignored', async () => {
  const area = fakeArea();
  assert.strictEqual((await recordMockLoop(area, null)).counted, false);
  assert.strictEqual((await getReviewState(area)).loops, 0);
});

await test('due after 3 distinct loops', async () => {
  const area = fakeArea();
  await recordMockLoop(area, 'mock_1_1');
  await recordMockLoop(area, 'mock_1_2');
  assert.strictEqual(shouldShowReviewPrompt(await getReviewState(area)), false);
  await recordMockLoop(area, 'mock_2_3');
  assert.strictEqual(shouldShowReviewPrompt(await getReviewState(area)), true);
});

await test('never shown during an active recording', async () => {
  const s = normalizeReviewState({ loops: 5 });
  assert.strictEqual(shouldShowReviewPrompt(s, { recording: true }), false);
  assert.strictEqual(shouldShowReviewPrompt(s, { recording: false }), true);
});

await test('"Not now" answers once and forever', async () => {
  const area = fakeArea({ [REVIEW_PROMPT_KEY]: { loops: 3, sessions: ['a', 'b', 'c'] } });
  await markReviewPromptAnswered(area, 'later', 42);
  const s = await getReviewState(area);
  assert.strictEqual(s.asked, true);
  assert.strictEqual(s.response, 'later');
  assert.strictEqual(s.askedAt, 42);
  assert.strictEqual(shouldShowReviewPrompt(s), false);
  // Further loops don't re-arm it.
  await recordMockLoop(area, 'mock_9_9');
  assert.strictEqual(shouldShowReviewPrompt(await getReviewState(area)), false);
});

await test('"Rate it" is recorded as rate; unknown answers become later', async () => {
  const area = fakeArea();
  assert.strictEqual((await markReviewPromptAnswered(area, 'rate')).response, 'rate');
  assert.strictEqual((await markReviewPromptAnswered(fakeArea(), 'bogus')).response, 'later');
});

await test('corrupt stored state is normalized, not trusted', async () => {
  const area = fakeArea({ [REVIEW_PROMPT_KEY]: { loops: 'lots', asked: 'yes', sessions: 'x' } });
  const s = await getReviewState(area);
  assert.deepStrictEqual(s, { loops: 0, sessions: [], asked: false, response: null, askedAt: null });
});

await test('storage write failure does not count or throw', async () => {
  const area = fakeArea({}, { failSet: true });
  const r = await recordMockLoop(area, 'mock_1_1');
  assert.strictEqual(r.counted, false);
  assert.strictEqual(r.loops, 0);
});

await test('tracked session ids are capped', async () => {
  const area = fakeArea();
  for (let i = 0; i < 50; i++) await recordMockLoop(area, `mock_${i}`);
  const s = await getReviewState(area);
  assert.strictEqual(s.loops, 50);
  assert.ok(s.sessions.length <= 20);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
