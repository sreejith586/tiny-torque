// Deno unit tests for the ai-scan v2 pure helpers (MV-S3-02). Offline — no network, no Supabase.
// Run: deno test supabase/functions/ai-scan/lib.test.ts
import { assertEquals, assert } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  normalizeCandidate,
  parseToolUse,
  estimateCostUsd,
  scoreBand,
  bestMatch,
  isFlagEnabled,
  SCAN_TOOL,
} from './lib.ts';

Deno.test('normalizeCandidate: fills brand, clamps confidence, trims + nulls blanks', () => {
  const c = normalizeCandidate({
    brand: '  ',
    model: ' Skyline GT-R ',
    confidence: 1.7,
    notes: '',
  });
  assertEquals(c.brand, 'Unknown');
  assertEquals(c.model, 'Skyline GT-R');
  assertEquals(c.confidence, 1); // clamped
  assertEquals(c.notes, null);
});

Deno.test(
  'normalizeCandidate: non-numeric confidence defaults to 0.5, negative clamps to 0',
  () => {
    assertEquals(normalizeCandidate({ brand: 'Hot Wheels' }).confidence, 0.5);
    assertEquals(normalizeCandidate({ brand: 'Hot Wheels', confidence: -2 }).confidence, 0);
    assertEquals(normalizeCandidate({ brand: 'X', confidence: NaN }).confidence, 0.5);
  }
);

Deno.test('parseToolUse: extracts + normalises cars from a tool_use block', () => {
  const data = {
    stop_reason: 'tool_use',
    content: [
      { type: 'text', text: 'Let me record those.' },
      {
        type: 'tool_use',
        name: SCAN_TOOL.name,
        input: {
          cars: [
            { brand: 'Hot Wheels', model: 'Datsun 240Z', confidence: 0.9 },
            { brand: ' Tomica ', confidence: 2 },
          ],
        },
      },
    ],
  };
  const out = parseToolUse(data);
  assert(out !== null);
  assertEquals(out!.length, 2);
  assertEquals(out![0].model, 'Datsun 240Z');
  assertEquals(out![1].brand, 'Tomica');
  assertEquals(out![1].confidence, 1);
  assertEquals(out![1].model, null);
});

Deno.test('parseToolUse: empty cars array is valid (no cars seen), not a retry', () => {
  const out = parseToolUse({
    content: [{ type: 'tool_use', name: SCAN_TOOL.name, input: { cars: [] } }],
  });
  assertEquals(out, []);
});

Deno.test('parseToolUse: returns null when the model emitted prose instead of the tool', () => {
  assertEquals(parseToolUse({ content: [{ type: 'text', text: 'I see a red car.' }] }), null);
  assertEquals(parseToolUse({ content: [] }), null);
  assertEquals(parseToolUse({}), null);
  assertEquals(parseToolUse(null), null);
});

Deno.test('parseToolUse: null when tool_use block lacks a cars array', () => {
  assertEquals(
    parseToolUse({ content: [{ type: 'tool_use', name: SCAN_TOOL.name, input: {} }] }),
    null
  );
});

Deno.test('estimateCostUsd: sonnet pricing, rounded to 5dp', () => {
  // 1000 in * $3/M + 500 out * $15/M = 0.003 + 0.0075 = 0.0105
  assertEquals(estimateCostUsd(1000, 500, 'claude-sonnet-5'), 0.0105);
  // unknown model falls back to sonnet rate rather than 0
  assertEquals(estimateCostUsd(1000, 500, 'mystery-model'), 0.0105);
  // negatives floored to 0
  assertEquals(estimateCostUsd(-5, -5, 'claude-sonnet-5'), 0);
});

Deno.test('scoreBand: trigram bands', () => {
  assertEquals(scoreBand(0.95), 'strong');
  assertEquals(scoreBand(0.6), 'strong');
  assertEquals(scoreBand(0.45), 'weak');
  assertEquals(scoreBand(0.3), 'weak');
  assertEquals(scoreBand(0.29), null);
  assertEquals(scoreBand(0), null);
});

Deno.test('bestMatch: picks the top row and bands it', () => {
  const m = bestMatch([
    { id: 'a', brand_id: 'b1', name: 'Skyline', score: 0.41 },
    { id: 'c', brand_id: 'b2', name: 'Skyline GT-R', score: 0.82 },
  ]);
  assertEquals(m, {
    model_id: 'c',
    brand_id: 'b2',
    name: 'Skyline GT-R',
    score: 0.82,
    band: 'strong',
  });
});

Deno.test('bestMatch: below-weak-threshold -> null (no misleading chip)', () => {
  assertEquals(bestMatch([{ id: 'a', brand_id: 'b', name: 'x', score: 0.25 }]), null);
  assertEquals(bestMatch([]), null);
  assertEquals(bestMatch(null), null);
  assertEquals(bestMatch(undefined), null);
});

Deno.test('isFlagEnabled: hard kill switch wins', () => {
  assertEquals(isFlagEnabled({ enabled: false, audience: {} }), false);
  assertEquals(isFlagEnabled(null), false);
  assertEquals(isFlagEnabled(undefined), false);
  assertEquals(isFlagEnabled({ enabled: true, audience: {} }), true);
});

Deno.test('isFlagEnabled: audience narrows an enabled flag', () => {
  const flag = { enabled: true, audience: { plans: ['pro'] } };
  assertEquals(isFlagEnabled(flag, { plan: 'pro' }), true);
  assertEquals(isFlagEnabled(flag, { plan: 'free' }), false);
  // user_ids allowlist overrides other clauses
  const allow = { enabled: true, audience: { plans: ['pro'], user_ids: ['u1'] } };
  assertEquals(isFlagEnabled(allow, { plan: 'free', userId: 'u1' }), true);
  // percent rollout is deterministic + fails closed without a userId
  const pct = { enabled: true, audience: { percent: 100 } };
  assertEquals(isFlagEnabled(pct, { userId: 'anyone' }), true);
  assertEquals(isFlagEnabled(pct, {}), false);
});
